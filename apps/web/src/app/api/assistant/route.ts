import { getSession } from "@/lib/sessions";
import { jsonWithCors, optionsWithCors } from "@/lib/cors";
import {
  SYSTEM_PROMPT,
  isSearchConfigured,
  isWorkplaceConfigured,
  searchWeb,
} from "agent-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsWithCors();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      reviewId?: string;
      message?: string;
      tabs?: any[];
      suggestions?: any[];
    };
    const { reviewId, message } = body;

    if (!message || typeof message !== "string") {
      return jsonWithCors({ success: false, error: "Missing message" }, 400);
    }

    const session = reviewId ? getSession(reviewId) : undefined;
    const tabs: any[] = (session?.tabs && session.tabs.length > 0) ? session.tabs : (body.tabs ?? []);
    const suggestions: any[] = (session?.suggestions && session.suggestions.length > 0)
      ? session.suggestions
      : (body.suggestions ?? []);

    const workplaceReady = isWorkplaceConfigured();
    const searchReady = isSearchConfigured();

    // Check if web search grounding should be triggered
    let liveSearchAddendum = "";
    if (searchReady && /search|find online|latest|current|look up|who won|score|news/i.test(message)) {
      try {
        const hits = await searchWeb({ query: message, results: 3 });
        if (Array.isArray(hits) && hits.length > 0) {
          liveSearchAddendum =
            `\n\nLive Web Search Grounding (via Exa):\n` +
            hits.map((h) => `• ${h.title}: ${h.highlight || h.url}`).join("\n");
        }
      } catch (searchErr) {
        console.warn("Exa web search in assistant failed:", searchErr);
      }
    }

    const formattedSuggestions = suggestions.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      category: s.category,
      description: s.description,
      status: s.status,
      actionId: s.actionId || null,
      resultUrl: s.resultUrl || null,
      mode: s.mode || (s.status === "completed" ? "real" : null),
      modeReason: s.modeReason || (s.status === "completed" ? "written to Ambiguous AI" : null),
      dueDate: s.dueDate || null,
    }));

    const executionLog = formattedSuggestions.map((s) => {
      const isCompleted = s.status === "completed";
      const actionText = s.actionId
        ? `Ambiguous Task ID: "${s.actionId}" (${s.modeReason || "written to Ambiguous"})`
        : "Not executed yet";
      return `• [${s.status.toUpperCase()}] "${s.title}" — ${actionText}`;
    }).join("\n");

    const activeContext = `
Connected Services:
- Ambiguous AI: ${workplaceReady ? "CONNECTED (Active workspace for task creation)" : "Not configured"}
- Exa Search: ${searchReady ? "CONNECTED (Active for live grounded web search)" : "Not configured"}

Active Review Session Context:
Captured Tabs (${tabs.length}):
${tabs.map((t) => `- [${t.status || "captured"}] ${t.title || "Untitled"} (${t.url})`).join("\n") || "No tabs captured"}

Proposed / Executed Actions (${formattedSuggestions.length}):
${executionLog || "No actions available."}
${liveSearchAddendum}

Instructions for workplace status:
If any suggestion has status "completed" and an Ambiguous Task ID, confirm that it was successfully approved and written into Ambiguous AI with that ID. Only pending suggestions need page approval.
`.trim();

    // Check if an AI provider API key is configured
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;
    let reply = "";

    if (openRouterKey && openRouterKey !== "stub-replace-me") {
      try {
        const modelName = process.env.MODEL || "openai/gpt-5.6-luna";
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
                content: `${SYSTEM_PROMPT}\n\n${activeContext}`,
              },
              { role: "user", content: message },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          reply = data.choices?.[0]?.message?.content || "";
        } else {
          const errBody = await response.text();
          console.warn("OpenRouter returned non-OK:", response.status, errBody);
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
                content: `${SYSTEM_PROMPT}\n\n${activeContext}`,
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
      if (lower.includes("action") || lower.includes("done") || lower.includes("completed") || lower.includes("executed")) {
        const completed = formattedSuggestions.filter((s) => s.status === "completed");
        if (completed.length > 0) {
          reply =
            `You approved and executed ${completed.length} actions in your workspace:\n\n` +
            completed
              .map(
                (c) =>
                  `• **${c.title}**\n  Status: Written to Ambiguous AI (Action ID: \`${c.actionId || "recorded"}\`)`
              )
              .join("\n\n") +
            `\n\nThese tasks are now tracked in your Ambiguous AI workspace.`;
        } else {
          reply =
            `No actions have been executed yet for this tab group. Select the suggestions on the left and click **Approve selected** to write them to your Ambiguous AI workspace.`;
        }
      } else if (lower.includes("cluster") || lower.includes("group")) {
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
          `Recommendation: Review the suggestions on the left, select the ones you want, and click Approve Selected.`;
      } else if (lower.includes("approve") || lower.includes("reject")) {
        const pendingCount = suggestions.filter((s) => s.status === "pending_review").length;
        reply =
          `You have ${pendingCount} pending suggestions. Prioritize actionable tasks and follow-ups. ` +
          `Remember: chatting here does not trigger any writes. You must check the boxes and click 'Approve selected' on the left.`;
      } else {
        reply =
          `I can see ${tabs.length} captured tabs and ${suggestions.length} suggestions for this session. ` +
          `Ambiguous AI is connected for workspace execution. Ask me to cluster tabs, recommend what to approve, or summarize recent actions.`;
      }
    }

    return jsonWithCors({ success: true, reply });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "Assistant error";
    return jsonWithCors({ success: false, error: errMessage }, 500);
  }
}
