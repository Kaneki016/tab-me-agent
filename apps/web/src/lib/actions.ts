import { isWorkplaceConfigured } from "agent-core";
import { FollowupError } from "./server/followup-error";
import { configuredWorkplace } from "./server/workplace";
import type { ExecutionResult, Suggestion } from "./types";

function mockResult(suggestion: Suggestion): ExecutionResult {
  const actionId = `mock_${suggestion.type}_${Date.now()}`;
  return { id: suggestion.id, status: "completed", actionId, resultUrl: null };
}

export async function executeAction(
  suggestion: Suggestion,
  reviewId: string,
): Promise<ExecutionResult> {
  if (suggestion.type !== "create_task") {
    return mockResult(suggestion);
  }

  if (!isWorkplaceConfigured()) {
    return mockResult(suggestion);
  }

  const connection = configuredWorkplace();
  try {
    const title =
      typeof suggestion.data.title === "string"
        ? suggestion.data.title
        : suggestion.title;
    const description = [
      suggestion.description ?? "",
      typeof suggestion.data.url === "string"
        ? `Source: ${suggestion.data.url}`
        : "",
      `tabme:${reviewId}`,
      `suggestion:${suggestion.id}`,
    ]
      .filter(Boolean)
      .join("\n");

    const task = await connection.workplace.create(title, description, async () => {
      // Approval already happened on the review page. This hook only marks the send.
    });
    return {
      id: suggestion.id,
      status: "completed",
      actionId: task.id,
      resultUrl: task.url,
    };
  } catch (error) {
    const message =
      error instanceof FollowupError
        ? error.message
        : "Unable to create the Ambiguous task. Other approvals were not blocked.";
    return { id: suggestion.id, status: "failed", error: message };
  } finally {
    try {
      await connection.close();
    } catch {
      console.warn("Ambiguous workplace cleanup failed after Tabme execution.");
    }
  }
}
