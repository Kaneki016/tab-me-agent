# Tabme — Product Requirements Document (PRD)

## 1. Product Overview

**Name:** Tabme  
**Tagline:** Human-in-the-loop tab triage for AI workspaces  
**Goal:** Let users capture open browser tabs, generate actionable suggestions, and approve them before any action is taken in an AI workspace.

**Core principle:** Never auto-execute without user approval. Users must see, review, and approve every suggestion before Tabme takes action. Chat text such as “yes” is not approval.

**Foundation:** CopilotKit [Agents Everywhere starter kit](https://github.com/CopilotKit/agents-everywhere-starter-kit) (web + `agent-core`). Design quality: [Impeccable](https://github.com/pbakaus/impeccable).

---

## 2. Problem Statement

Knowledge workers often have many tabs open for research, competitors, vendors, and documentation, but lack a structured way to turn those tabs into organized tasks, notes, and records. Existing solutions either:

- Do nothing (tabs remain chaotic).
- Auto-execute without review (risky and untrustworthy).
- Require manual copy-paste into task managers, sheets, and docs.

Tabme addresses this by:

1. Capturing tab context.
2. Generating structured suggestions.
3. Requiring explicit approval on the review page.
4. Executing only approved actions.

---

## 3. Target Users

- Individual knowledge workers and researchers.
- Small teams using AI workspaces (e.g., Ambiguous AI).
- Early adopters comfortable with AI assistants and browser extensions.

---

## 4. Scope (Hackathon MVP)

### In Scope

- Chrome extension that:
  - Captures current window tabs (URL + title).
  - Optionally scrapes a small subset of pages.
  - Sends tab data to the web app.
  - Shows processing and success/error states.
- Web app (`apps/web`) that:
  - Receives tab data at `POST /api/generate-suggestions`.
  - Generates 3–5 structured suggestions.
  - Stores suggestions with a review ID (in memory).
  - Exposes `/review/:reviewId`.
  - Hosts a CopilotKit assistant that can read the review, not write.
- Review page that:
  - Lists suggestions with checkboxes.
  - Allows approve/reject per suggestion.
  - Executes one safe action on approval (`create_task` via Ambiguous when configured; otherwise mocked).
  - Shows completion result.
- Clear error handling for unsupported pages and failures.

### Out of Scope (for a 4-hour build)

- Full 40+ tab scraping.
- Six fully implemented action types.
- Per-suggestion edit modals.
- Slack or React Native surfaces from the starter kit.
- Production-grade auth, persistence, and monitoring.

---

## 5. User Stories

### US1: Capture Tabs

> As a user, I want to click an extension button and capture my open tabs so that I can triage them later.

**Acceptance criteria:**

- Clicking the extension icon opens a popup.
- The popup shows a “Capture tabs” button.
- After clicking, the extension reads the current window, collects URL and title, optionally scrapes up to 3 public pages, and POSTs to `/api/generate-suggestions`.
- Success: “Captured X tabs” and a link to `/review/:reviewId`.
- Failure: a clear error message.

### US2: Generate Suggestions

> As a user, I want the system to propose a small number of actions based on my tabs so that I can quickly decide what to do.

Each suggestion includes `id`, `type`, `title`, optional `description`, optional `dueDate`, optional `confidence`. Stored with a `reviewId`.

### US3: Review and Approve

> As a user, I want to review and approve or reject each suggestion so that I stay in control.

The review page lists suggestions, supports per-item selection, and **Approve selected** is the only write trigger.

### US4: Execute One Action

> As a user, I want approved suggestions to trigger one concrete action so that I see value immediately.

`create_task` writes to Ambiguous when `AMBIGUOUS_API_KEY` is set. Other types are mocked. The page shows a result summary and any provider ID/link.

### US5: Handle Failures Gracefully

Unsupported pages keep URL + title. A failed action does not block the others.

---

## 6. Functional Requirements

### FR1: Tab Capture

Use `chrome.tabs.query` for the current window. Collect `id`, `url`, `title`. Skip unsupported URLs. Optionally scrape up to 3 public pages.

### FR2: Suggestion Generation

`POST /api/generate-suggestions` accepts tab data, stores a session, returns `{ reviewId, suggestionCount }`.

### FR3: Review Page

`GET /review/:reviewId` fetches `GET /api/suggestions/:reviewId` and renders checkboxes plus Approve selected.

### FR4: Execution

`POST /api/execute-suggestions` with `reviewId` and `approvedIds`. One real or mocked action. Return a result summary.

### FR5: Error Handling

Handle unsupported pages, scraper failures, invalid sessions, and execution failures with user-facing messages.

---

## 7. Non-Functional Requirements

- Capture and send within 3 seconds for up to 20 tabs.
- Suggestion generation within 5 seconds for the MVP.
- Review page load within 2 seconds.
- Minimal extension permissions. No unnecessary personal data stored.
- UI follows Impeccable Operate-mode rules in `DESIGN.md`.

---

## 8. Data Model

```typescript
interface Tab {
  id: number;
  url: string;
  title: string;
  content?: string;
  status: "captured" | "scraped" | "unsupported";
}

interface Suggestion {
  id: string;
  type: "create_task" | "save_note" | "add_competitor" | "draft_email" | "create_doc" | "add_crm" | "upload_drive";
  status: "pending_review" | "approved" | "rejected" | "completed" | "failed";
  data: Record<string, unknown>;
  editable: boolean;
  title: string;
  description?: string;
  dueDate?: string;
  confidence?: number;
}

interface ReviewSession {
  reviewId: string;
  tabs: Tab[];
  suggestions: Suggestion[];
  createdAt: string;
  status: "pending" | "reviewed" | "executed";
}
```

---

## 9. API Endpoints

Implemented on the Next.js app (`apps/web`, port 3100):

- `POST /api/generate-suggestions` → `{ success, reviewId, suggestionCount }`
- `GET /api/suggestions/:reviewId` → `{ success, suggestions, tabs, status }`
- `POST /api/execute-suggestions` → `{ success, results[] }`
- `POST /api/copilotkit/*` — CopilotKit runtime (no raw workplace writes)

---

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Tab scraping fails | High | Fall back to URL + title |
| AI / model unavailable | Medium | Deterministic suggestion heuristics |
| Ambiguous unavailable | High | Mock `create_task`; label it honestly |
| Time overruns | High | Sample-tabs path on the home page |

---

## 11. Success Metrics (Demo)

- Extension or sample path captures tabs.
- Backend generates 3–5 suggestions.
- Review page allows approval.
- One action completes (real or mocked).
- Demo finishes in under 3 minutes.

---

## 12. Future Enhancements

- Full action types, per-suggestion editing, Slack via CopilotKit Channels, undo, weekly summaries, auth and persistence.
