import { getSession } from "@/lib/sessions";
import { jsonWithCors, optionsWithCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return optionsWithCors(request);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await params;
  const session = getSession(reviewId);
  if (!session) {
    return jsonWithCors({ success: false, error: "Session not found" }, 404, request);
  }

  return jsonWithCors(
    {
      success: true,
      reviewId: session.reviewId,
      status: session.status,
      source: session.source ?? "heuristic",
      tabs: session.tabs,
      suggestions: session.suggestions,
      createdAt: session.createdAt,
    },
    200,
    request,
  );
}
