import { executeAction, type WorkplaceConnection } from "./actions";
import { getSession, updateSession } from "./sessions";
import type { ExecutionResult, ReviewSession } from "./types";

const globalForExecutions = globalThis as typeof globalThis & {
  tabmeExecutionLocks?: Map<string, Promise<void>>;
};
const executionLocks = globalForExecutions.tabmeExecutionLocks ?? new Map<string, Promise<void>>();
globalForExecutions.tabmeExecutionLocks = executionLocks;

async function withReviewLock<T>(reviewId: string, work: () => Promise<T>): Promise<T> {
  const previous = executionLocks.get(reviewId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  executionLocks.set(reviewId, queued);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (executionLocks.get(reviewId) === queued) executionLocks.delete(reviewId);
  }
}

async function executeLocked(
  reviewId: string,
  approvedIds: string[],
  connection: WorkplaceConnection | null,
  run: typeof executeAction,
): Promise<{ session: ReviewSession; results: ExecutionResult[] }> {
  const session = getSession(reviewId);
  if (!session) throw new Error("Session not found");

  const approved = new Set(approvedIds);
  const knownIds = new Set(session.suggestions.map((suggestion) => suggestion.id));
  if ([...approved].some((id) => !knownIds.has(id))) {
    throw new Error("Unknown suggestion selected");
  }

  updateSession(reviewId, (current) => {
    for (const suggestion of current.suggestions) {
      if (!approved.has(suggestion.id) && suggestion.status === "pending_review") {
        suggestion.status = "rejected";
      }
    }
    current.status = "reviewed";
  });

  const results: ExecutionResult[] = [];
  for (const suggestion of session.suggestions) {
    if (!approved.has(suggestion.id)) continue;

    if (suggestion.status === "completed") {
      results.push({
        id: suggestion.id,
        status: "skipped",
        actionId: suggestion.actionId,
        resultUrl: suggestion.resultUrl,
        mode: suggestion.mode,
        modeReason: suggestion.modeReason,
      });
      continue;
    }

    updateSession(reviewId, (current) => {
      const item = current.suggestions.find((candidate) => candidate.id === suggestion.id);
      if (item) item.status = "approved";
    });
    suggestion.status = "approved";

    const result = await run(suggestion, reviewId, connection);
    results.push(result);
    updateSession(reviewId, (current) => {
      const item = current.suggestions.find((candidate) => candidate.id === suggestion.id);
      if (!item) return;
      if (result.status !== "skipped") item.status = result.status;
      item.actionId = result.actionId;
      item.resultUrl = result.resultUrl;
      item.error = result.error;
      item.mode = result.mode;
      item.modeReason = result.modeReason;
    });
  }

  const completedCount = results.filter((item) => item.status === "completed").length;
  const final = updateSession(reviewId, (current) => {
    if (completedCount > 0) current.status = "executed";
  });
  return { session: final, results };
}

export async function executeApprovedSuggestions(
  reviewId: string,
  approvedIds: string[],
  connection: WorkplaceConnection | null = null,
  run: typeof executeAction = executeAction,
): Promise<{ session: ReviewSession; results: ExecutionResult[] }> {
  return withReviewLock(reviewId, () =>
    executeLocked(reviewId, approvedIds, connection, run),
  );
}
