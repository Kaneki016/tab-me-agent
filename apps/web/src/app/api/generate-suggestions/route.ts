import { ZodError } from "zod";
import { createSession, setSuggestions } from "@/lib/sessions";
import { buildReviewSuggestions } from "@/lib/suggestions";
import { parseTabs } from "@/lib/tabs";
import { jsonWithCors, optionsWithCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return optionsWithCors(request);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tabs?: unknown };
    const tabs = parseTabs(body.tabs);
    const session = createSession(tabs);
    const { suggestions, source } = await buildReviewSuggestions(tabs);
    setSuggestions(session.reviewId, suggestions, source);

    return jsonWithCors(
      {
        success: true,
        reviewId: session.reviewId,
        suggestionCount: suggestions.length,
      },
      200,
      request,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate suggestions.";
    const isValidation =
      error instanceof ZodError || error instanceof SyntaxError || message === "No tabs provided";
    if (!isValidation) {
      console.error("generate-suggestions failed:", error);
    }
    const status = isValidation ? 400 : 500;
    const clientMessage = isValidation
      ? error instanceof ZodError
        ? "Invalid tabs payload"
        : message
      : "Unable to generate suggestions.";
    return jsonWithCors({ success: false, error: clientMessage }, status, request);
  }
}
