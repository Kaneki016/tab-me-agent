import { executeAction } from "@/lib/actions";
import { getSession, updateSession } from "@/lib/sessions";
import { jsonWithCors, optionsWithCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsWithCors();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      reviewId?: string;
      approvedIds?: string[];
    };
    const reviewId = body.reviewId;
    const approvedIds = Array.isArray(body.approvedIds) ? body.approvedIds : [];

    if (!reviewId) {
      return jsonWithCors({ success: false, error: "Missing reviewId" }, 400);
    }

    const session = getSession(reviewId);
    if (!session) {
      return jsonWithCors({ success: false, error: "Session not found" }, 404);
    }

    const approved = session.suggestions.filter((suggestion) =>
      approvedIds.includes(suggestion.id),
    );
    const rejected = session.suggestions.filter(
      (suggestion) => !approvedIds.includes(suggestion.id),
    );

    for (const suggestion of rejected) {
      if (suggestion.status === "pending_review") {
        suggestion.status = "rejected";
      }
    }

    const results = [];
    for (const suggestion of approved) {
      suggestion.status = "approved";
      const result = await executeAction(suggestion, reviewId);
      results.push(result);
      suggestion.status = result.status;
      suggestion.actionId = result.actionId;
      suggestion.resultUrl = result.resultUrl;
      suggestion.error = result.error;
    }

    updateSession(reviewId, (current) => {
      current.status = "executed";
    });

    return jsonWithCors({ success: true, results });
  } catch {
    return jsonWithCors(
      { success: false, error: "Unable to execute suggestions." },
      500,
    );
  }
}
