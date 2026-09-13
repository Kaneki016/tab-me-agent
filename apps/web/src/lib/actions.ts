import { isWorkplaceConfigured } from "agent-core";
import { FollowupError } from "./server/followup-error";
import { configuredWorkplace, type Workplace } from "./server/workplace";
import type { ExecutionResult, Suggestion } from "./types";

export type WorkplaceConnection = {
  workplace: Workplace;
  close(): Promise<void>;
};

function sourceUrls(suggestion: Suggestion): string[] {
  const urls = suggestion.data.urls;
  if (Array.isArray(urls)) {
    return urls.filter((url): url is string => typeof url === "string");
  }
  const url = suggestion.data.url;
  return typeof url === "string" ? [url] : [];
}

/**
 * A marker makes an approval safely retryable across page reloads and process
 * restarts. The in-process execution lock handles the small race before this
 * lookup; the provider lookup handles a retry after a successful write.
 */
async function existingTask(
  connection: WorkplaceConnection,
  marker: string,
) {
  const tasks = await connection.workplace.list(marker);
  return tasks.find((task) => task.description.includes(marker));
}

export async function executeAction(
  suggestion: Suggestion,
  reviewId: string,
  connection?: WorkplaceConnection | null,
): Promise<ExecutionResult> {
  if (!isWorkplaceConfigured()) {
    return {
      id: suggestion.id,
      status: "failed",
      error: "Ambiguous is not configured. This approval was not written.",
    };
  }

  const active = connection ?? configuredWorkplace();
  const ownsConnection = !connection;
  const marker = `suggestion:${suggestion.id}`;

  try {
    const existing = await existingTask(active, marker);
    if (existing) {
      return {
        id: suggestion.id,
        status: "skipped",
        actionId: existing.id,
        resultUrl: existing.url,
        mode: "real",
        modeReason: "already written to Ambiguous",
      };
    }

    const title =
      typeof suggestion.data.title === "string"
        ? suggestion.data.title
        : suggestion.title;
    const description = [
      suggestion.description ?? "",
      suggestion.category ? `Category: ${suggestion.category.replace("_", " ")}` : "",
      ...sourceUrls(suggestion).map((url) => `Source: ${url}`),
      `tabme:${reviewId}`,
      marker,
    ]
      .filter(Boolean)
      .join("\n");

    const task = await active.workplace.create(title, description, async () => {
      // This function is reached only from the page's explicit approval route.
    });
    return {
      id: suggestion.id,
      status: "completed",
      actionId: task.id,
      resultUrl: task.url,
      mode: "real",
      modeReason: "written to Ambiguous",
    };
  } catch (error) {
    const message =
      error instanceof FollowupError
        ? error.message
        : "Unable to create the Ambiguous task. No completion was recorded.";
    return { id: suggestion.id, status: "failed", error: message };
  } finally {
    if (ownsConnection) {
      try {
        await active.close();
      } catch {
        console.warn("Ambiguous workplace cleanup failed after Tabme execution.");
      }
    }
  }
}
