import { isWorkplaceConfigured } from "agent-core";
import { configuredWorkplace } from "@/lib/server/workplace";
import { executeApprovedSuggestions } from "@/lib/execute";
import { jsonWithCors, optionsWithCors } from "@/lib/cors";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const executeBodySchema = z.object({
  reviewId: z.string().regex(/^rev_[0-9a-f-]{36}$/),
  approvedIds: z.array(z.string().min(1)).min(1).max(5),
});

export function OPTIONS(request: Request) {
  return optionsWithCors(request);
}

export async function POST(request: Request) {
  let connection: ReturnType<typeof configuredWorkplace> | null = null;

  try {
    const { reviewId, approvedIds } = executeBodySchema.parse(await request.json());

    if (isWorkplaceConfigured()) {
      connection = configuredWorkplace();
    }

    const { results } = await executeApprovedSuggestions(
      reviewId,
      approvedIds,
      connection,
    );

    return jsonWithCors({ success: true, results }, 200, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to execute suggestions.";
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return jsonWithCors({ success: false, error: "Invalid approval request" }, 400, request);
    }
    if (message === "Session not found") {
      return jsonWithCors({ success: false, error: message }, 404, request);
    }
    if (message === "Unknown suggestion selected") {
      return jsonWithCors({ success: false, error: message }, 400, request);
    }
    console.error("execute-suggestions failed:", error);
    return jsonWithCors(
      { success: false, error: "Unable to execute suggestions." },
      500,
      request,
    );
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {
        console.warn("Ambiguous workplace cleanup failed after Tabme execution.");
      }
    }
  }
}
