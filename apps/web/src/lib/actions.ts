import { isWorkplaceConfigured } from "agent-core";
import { FollowupError } from "./server/followup-error";
import { configuredWorkplace, type Workplace } from "./server/workplace";
import { surfaceFor } from "./surface";
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

function suggestionTitle(suggestion: Suggestion): string {
  return typeof suggestion.data.title === "string"
    ? suggestion.data.title
    : suggestion.title;
}

function tabmeLabel(suggestionId: string): string {
  return `tabme:${suggestionId}`;
}

function taskMarker(suggestionId: string): string {
  return `suggestion:${suggestionId}`;
}

function completed(
  suggestion: Suggestion,
  record: { id: string; url: string | null },
  modeReason = "written to Ambiguous",
): ExecutionResult {
  return {
    id: suggestion.id,
    status: "completed",
    actionId: record.id,
    resultUrl: record.url,
    mode: "real",
    modeReason,
    surface: surfaceFor(suggestion.type),
  };
}

function skipped(
  suggestion: Suggestion,
  record: { id: string; url: string | null },
): ExecutionResult {
  return {
    id: suggestion.id,
    status: "skipped",
    actionId: record.id,
    resultUrl: record.url,
    mode: "real",
    modeReason: "already written to Ambiguous",
    surface: surfaceFor(suggestion.type),
  };
}

function failed(suggestion: Suggestion, message: string): ExecutionResult {
  return {
    id: suggestion.id,
    status: "failed",
    error: message,
    surface: surfaceFor(suggestion.type),
  };
}

async function executeCreateTask(
  suggestion: Suggestion,
  reviewId: string,
  connection: WorkplaceConnection,
): Promise<ExecutionResult> {
  const marker = taskMarker(suggestion.id);
  const existing = await connection.workplace.list(marker);
  if (existing[0]) return skipped(suggestion, existing[0]);

  const title = suggestionTitle(suggestion);
  const description = [
    suggestion.description ?? "",
    suggestion.category ? `Category: ${suggestion.category.replace("_", " ")}` : "",
    ...sourceUrls(suggestion).map((url) => `Source: ${url}`),
    `tabme:${reviewId}`,
    marker,
  ]
    .filter(Boolean)
    .join("\n");

  const task = await connection.workplace.create(title, description, async () => {});
  return completed(suggestion, task);
}

async function executeSaveNote(
  suggestion: Suggestion,
  reviewId: string,
  connection: WorkplaceConnection,
): Promise<ExecutionResult> {
  const label = tabmeLabel(suggestion.id);
  const existing = await connection.workplace.listDocuments(label);
  if (existing[0]) return skipped(suggestion, existing[0]);

  const title = suggestionTitle(suggestion);
  const content = [
    suggestion.description ?? "",
    "",
    "## Sources",
    ...sourceUrls(suggestion).map((url) => `- ${url}`),
    "",
    `Review: tabme:${reviewId}`,
  ]
    .filter(Boolean)
    .join("\n");

  const doc = await connection.workplace.createDocument(
    { type: "doc", title, content, labels: [label] },
    async () => {},
  );
  return completed(suggestion, doc);
}

async function executeCreateDoc(
  suggestion: Suggestion,
  reviewId: string,
  connection: WorkplaceConnection,
): Promise<ExecutionResult> {
  const label = tabmeLabel(suggestion.id);
  const existing = await connection.workplace.listDocuments(label);
  if (existing[0]) return skipped(suggestion, existing[0]);

  const title = suggestionTitle(suggestion);
  const content = [
    `# ${title}`,
    "",
    "## Summary",
    suggestion.description ?? "",
    "",
    "## Sources",
    ...sourceUrls(suggestion).map((url) => `- ${url}`),
    "",
    "## Next steps",
    "- Review captured material and capture key findings",
    "- Link related tasks or contacts in Ambiguous",
    "",
    `Review: tabme:${reviewId}`,
  ].join("\n");

  const doc = await connection.workplace.createDocument(
    { type: "doc", title, content, labels: [label] },
    async () => {},
  );
  return completed(suggestion, doc);
}

async function executeAddCompetitor(
  suggestion: Suggestion,
  reviewId: string,
  connection: WorkplaceConnection,
): Promise<ExecutionResult> {
  const label = tabmeLabel(suggestion.id);
  const existing = await connection.workplace.listDocuments(label);
  if (existing[0]) return skipped(suggestion, existing[0]);

  const title = suggestionTitle(suggestion);
  const urls = sourceUrls(suggestion);
  const sheet = await connection.workplace.createSheet(async () => {});
  await connection.workplace.appendSheetValues(
    sheet.id,
    "A1",
    [
      ["Name", "URL", "Notes"],
      [title, urls[0] ?? "", suggestion.description ?? ""],
      ...urls.slice(1).map((url) => ["", url, ""]),
    ],
    async () => {},
  );

  await connection.workplace
    .createDocument(
      {
        type: "doc",
        title: `${title} (tabme marker)`,
        content: `Competitor sheet ${sheet.id} from review tabme:${reviewId}.`,
        labels: [label],
      },
      async () => {},
    )
    .catch(() => undefined);

  return completed(suggestion, sheet, "competitor sheet written to Ambiguous");
}

async function executeAddCrm(
  suggestion: Suggestion,
  reviewId: string,
  connection: WorkplaceConnection,
): Promise<ExecutionResult> {
  const marker = tabmeLabel(suggestion.id);
  const title = suggestionTitle(suggestion);
  const name = title.replace(/^(add|create|contact)\s*:?\s*/i, "").trim() || title;
  const existing = await connection.workplace.findContacts(name);
  const duplicate = existing.find(
    (contact) =>
      contact.title.toLowerCase() === name.toLowerCase() ||
      contact.title.includes(marker),
  );
  if (duplicate) return skipped(suggestion, duplicate);

  const urls = sourceUrls(suggestion);
  const contact = await connection.workplace.createContact(
    {
      type: "company",
      name,
      website: urls[0],
      custom_properties: {
        tabme_review: reviewId,
        tabme_marker: marker,
      },
    },
    async () => {},
  );
  return completed(suggestion, contact);
}

async function executeDraftEmail(
  suggestion: Suggestion,
  reviewId: string,
  connection: WorkplaceConnection,
): Promise<ExecutionResult> {
  const title = suggestionTitle(suggestion);
  const body = [
    suggestion.description ?? "",
    "",
    ...sourceUrls(suggestion).map((url) => `Source: ${url}`),
    "",
    `Drafted from Tabme review tabme:${reviewId}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const draft = await connection.workplace.createDraftEmail(
    {
      subject: title,
      body_markdown: body,
      idempotency_key: `tabme-${suggestion.id}`,
    },
    async () => {},
  );
  return completed(suggestion, draft);
}

export async function executeAction(
  suggestion: Suggestion,
  reviewId: string,
  connection?: WorkplaceConnection | null,
): Promise<ExecutionResult> {
  if (!isWorkplaceConfigured()) {
    return failed(
      suggestion,
      "Ambiguous is not configured. This approval was not written.",
    );
  }

  const active = connection ?? configuredWorkplace();
  const ownsConnection = !connection;

  try {
    switch (suggestion.type) {
      case "create_task":
        return await executeCreateTask(suggestion, reviewId, active);
      case "save_note":
        return await executeSaveNote(suggestion, reviewId, active);
      case "create_doc":
        return await executeCreateDoc(suggestion, reviewId, active);
      case "add_competitor":
        return await executeAddCompetitor(suggestion, reviewId, active);
      case "add_crm":
        return await executeAddCrm(suggestion, reviewId, active);
      case "draft_email":
        return await executeDraftEmail(suggestion, reviewId, active);
      case "upload_drive":
        return failed(
          suggestion,
          "Drive upload is not supported yet. Approve a doc or task instead.",
        );
      default:
        return failed(suggestion, "This suggestion type cannot be executed.");
    }
  } catch (error) {
    const message =
      error instanceof FollowupError
        ? error.message
        : `Unable to write this ${surfaceFor(suggestion.type)} to Ambiguous. No completion was recorded.`;
    return failed(suggestion, message);
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
