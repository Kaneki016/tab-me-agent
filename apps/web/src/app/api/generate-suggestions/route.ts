import { createSession, setSuggestions } from "@/lib/sessions";
import { generateSuggestions } from "@/lib/suggestions";
import { parseTabs } from "@/lib/tabs";
import { jsonWithCors, optionsWithCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsWithCors();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tabs?: unknown };
    const tabs = parseTabs(body.tabs);
    const session = createSession(tabs);
    const suggestions = generateSuggestions(tabs);
    setSuggestions(session.reviewId, suggestions);

    return jsonWithCors({
      success: true,
      reviewId: session.reviewId,
      suggestionCount: suggestions.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate suggestions.";
    const status = message === "No tabs provided" ? 400 : 400;
    return jsonWithCors({ success: false, error: message }, status);
  }
}
