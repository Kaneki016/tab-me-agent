/**
 * Single client for the Tabme web APIs on port 3100.
 *
 * Every extension surface (popup, side panel, dashboard) goes through here so
 * the backend URL and the request/response contract live in one place.
 * Contract reference: apps/web/src/app/api/**.
 */

export const API_BASE = "http://127.0.0.1:3100";

/** Limits enforced by the backend Zod schemas. */
export const MAX_TABS_PER_REVIEW = 20;
export const MAX_APPROVALS_PER_EXECUTION = 5;

/** A backend call that reached the server but was refused. */
export class TabmeApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "TabmeApiError";
    this.status = status;
  }
}

/** A backend call that never reached the server. */
export class TabmeOfflineError extends Error {
  constructor() {
    super(
      `Tabme backend is not reachable at ${API_BASE}. Start it with \`npm run dev:web\`.`,
    );
    this.name = "TabmeOfflineError";
  }
}

async function request(path, init) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new TabmeOfflineError();
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    throw new TabmeApiError(
      payload?.error || `Request to ${path} failed (${response.status}).`,
      response.status,
    );
  }

  return payload ?? {};
}

function postJson(path, body) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Which capabilities the backend has credentials for. `workplace` is the one
 * that decides whether Approve writes real Ambiguous records or fails closed.
 */
export async function fetchHealth() {
  try {
    const data = await request("/api/health");
    return {
      online: true,
      model: Boolean(data.model),
      workplace: Boolean(data.workplace),
      search: Boolean(data.search),
    };
  } catch {
    return { online: false, model: false, workplace: false, search: false };
  }
}

/** Sends captured tabs for AI categorization. Returns the new reviewId. */
export function generateSuggestions(tabs) {
  return postJson("/api/generate-suggestions", { tabs: toApiTabs(tabs) });
}

/** Full review: tabs, categorized suggestions, status, and model-vs-heuristic source. */
export function fetchReview(reviewId) {
  return request(`/api/suggestions/${encodeURIComponent(reviewId)}`);
}

/** Writes the approved suggestions to Ambiguous. Max 5 per call. */
export function executeSuggestions(reviewId, approvedIds) {
  return postJson("/api/execute-suggestions", { reviewId, approvedIds });
}

export function askAssistant({ reviewId, tabs, suggestions, message }) {
  return postJson("/api/assistant", { reviewId, tabs, suggestions, message });
}

/**
 * Captured tabs carry extension-only fields such as favIconUrl, and a busy
 * window can exceed the 20-tab cap, so trim to the documented shape:
 * { id, url, title, content?, status }. Over the cap, unsupported pages are
 * dropped first because they never produce suggestions.
 */
export function toApiTabs(tabs) {
  const usable = tabs.filter((tab) => Boolean(tab.url) && typeof tab.id === "number");
  const trimmed =
    usable.length <= MAX_TABS_PER_REVIEW
      ? usable
      : [
          ...usable.filter((tab) => tab.status !== "unsupported"),
          ...usable.filter((tab) => tab.status === "unsupported"),
        ].slice(0, MAX_TABS_PER_REVIEW);

  return trimmed.map((tab) => ({
    id: tab.id,
    url: tab.url,
    title: tab.title || "",
    status: tab.status || "captured",
    ...(tab.content ? { content: tab.content.slice(0, 5000) } : {}),
  }));
}

export function describeError(error) {
  if (error instanceof TabmeOfflineError || error instanceof TabmeApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
