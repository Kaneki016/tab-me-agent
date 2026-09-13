import { listSessions } from "@/lib/sessions";
import { jsonWithCors, optionsWithCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return optionsWithCors(request);
}

export async function GET(request: Request) {
  const reviews = listSessions().map((session) => ({
    reviewId: session.reviewId,
    createdAt: session.createdAt,
    status: session.status,
    tabCount: session.tabs.length,
    suggestionCount: session.suggestions.length,
    source: session.source ?? "heuristic",
  }));

  return jsonWithCors({ success: true, reviews }, 200, request);
}
