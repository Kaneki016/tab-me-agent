import { isSearchConfigured, searchWeb } from "agent-core";
import { z } from "zod";
import { jsonWithCors, optionsWithCors } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const searchBodySchema = z.object({
  query: z.string().min(1),
  results: z.number().int().min(1).max(10).optional(),
});

export function OPTIONS(request: Request) {
  return optionsWithCors(request);
}

export async function POST(request: Request) {
  if (!isSearchConfigured()) {
    return jsonWithCors(
      { success: false, error: "Web search is not configured." },
      503,
      request,
    );
  }

  try {
    const body = searchBodySchema.parse(await request.json());
    const hits = await searchWeb({
      query: body.query,
      results: body.results ?? 5,
    });

    if (typeof hits === "string") {
      return jsonWithCors({ success: false, error: hits }, 503, request);
    }

    return jsonWithCors({ success: true, results: hits }, 200, request);
  } catch (error) {
    const message = error instanceof z.ZodError ? "Invalid search request." : "Search failed.";
    if (!(error instanceof z.ZodError)) {
      console.error("search failed:", error);
    }
    const status = error instanceof z.ZodError ? 400 : 500;
    return jsonWithCors({ success: false, error: message }, status, request);
  }
}
