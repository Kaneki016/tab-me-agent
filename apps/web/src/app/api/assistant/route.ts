import { getSession } from "@/lib/sessions";
import { jsonWithCors, optionsWithCors } from "@/lib/cors";
import { SYSTEM_PROMPT } from "agent-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsWithCors();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { reviewId?: string; message?: string };
    const { reviewId, message } = body;

    if (!message || typeof message !== "string") {
      return jsonWithCors({ success: false, error: "Missing message" }, 400);
    }

    const session = reviewId ? getSession(reviewId) : undefined;
    const tabs = session?.tabs ?? [];
    const suggestions = session?.suggestions ?? [];

    // Check if an AI provider API key is configured
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;
    let reply = "";

    if (openRouterKey && openRouterKey !== "stub-replace-me") {
      try {
        const modelName = process.env.MODEL || "openai/gpt-4o-mini";
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openRouterKey}`,
            "HTTP-Referer": process.env.PUBLIC_APP_URL || "http://127.0.0.1:3100",
            "X-Title": process.env.APP_TITLE || "Tabme",
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              {
                role: "system",
                content: `${SYSTEM_PROMPT}\n\nActive review session context:\nTabs: ${JSON.stringify(
                  tabs.map((t) => ({ title: t.title, url: t.url, status: t.status })),
                )}\nSuggestions: ${JSON.stringify(
                  suggestions.map((s) => ({ id: s.id, title: s.title, type: s.type, status: s.status })),
                )}`,
              },
              { role: "user", content: message },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          reply = data.choices?.[0]?.message?.content || "";
        }
      } catch (err) {
        console.warn("OpenRouter call failed, falling back to deterministic advice:", err);
      }
    } else if (openAiKey && openAiKey !== "stub-replace-me") {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `${SYSTEM_PROMPT}\n\nActive review session context:\nTabs: ${JSON.stringify(
                  tabs.map((t) => ({ title: t.title, url: t.url, status: t.status })),
                )}\nSuggestions: ${JSON.stringify(
                  suggestions.map((s) => ({ id: s.id, title: s.title, type: s.type, status: s.status })),
                )}`,
              },
              { role: "user", content: message },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          reply = data.choices?.[0]?.message?.content || "";
        }
      } catch (err) {
        console.warn("Direct OpenAI call failed, falling back to deterministic advice:", err);
      }
    }

    if (!reply) {
      const lower = message.toLowerCase();
      if (lower.includes("cluster") || lower.includes("group")) {
        const docs = tabs.filter((t) =>
          /doc|guide|learn|spec|tutorial|react|next/i.test(t.title || t.url),
        );
        const competitor = tabs.filter((t) =>
          /linear|notion|asana|competitor|pricing/i.test(t.title || t.url),
        );
        const others = tabs.filter((t) => !docs.includes(t) && !competitor.includes(t));

        reply =
          `I analyzed your ${tabs.length} captured tabs:\n` +
          `• Documentation/Learning (${docs.length}): ${
            docs.map((d) => d.title || d.url).slice(0, 3).join(", ") || "None"
          }\n` +
          `• Competitor/Tools (${competitor.length}): ${
            competitor.map((c) => c.title || c.url).slice(0, 2).join(", ") || "None"
          }\n` +
          `• Other References (${others.length}): ${
            others.map((o) => o.title || o.url).slice(0, 2).join(", ") || "None"
          }\n\n` +
          `Recommendation: Review the suggestions above, select the ones you want, and click Approve Selected.`;
      } else if (lower.includes("approve") || lower.includes("reject")) {
        const pendingCount = suggestions.filter((s) => s.status === "pending_review").length;
        reply =
          `You have ${pendingCount} pending suggestions. Prioritize actionable learning tasks and competitor notes. ` +
          `Remember: chatting here does not trigger any writes. You must check the boxes and click 'Approve selected' above.`;
      } else {
        reply =
          `I can see ${tabs.length} captured tabs and ${suggestions.length} suggestions for this session. ` +
          `Ask me to cluster them, recommend what to approve, or summarize the pile. Nothing will execute without your approval click.`;
      }
    }

    return jsonWithCors({ success: true, reply });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Assistant error";
    return jsonWithCors({ success: false, error: errMessage }, 500);
  }
}
