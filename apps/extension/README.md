# Tabme browser extension

The tab-triage surface running inside Chrome or Firefox. Captures current-window tabs, sends them to the Tabme agent for categorization, shows the proposed actions grouped by category, and writes the approved ones to Ambiguous.

Review happens here, in the extension. The Next.js app at port 3100 is the API and agent runtime; you do not need to open it to complete a run.

One manifest and one codebase target both browsers — see [Cross-browser support](#cross-browser-support) below for how.

## Load unpacked — Chrome / Edge / other Chromium browsers

1. Start the backend from the repo root: `npm run dev:web`
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `apps/extension` folder
5. Click the Tabme toolbar icon, then **Group Tabs & Open Tabme** for the dashboard or **Open Side Panel** for in-place triage

## Load temporary — Firefox

1. Start the backend from the repo root: `npm run dev:web`
2. Open `about:debugging` → **This Firefox**
3. Click **Load Temporary Add-on…** and select `apps/extension/manifest.json`
4. Click the Tabme toolbar icon, then **Group Tabs & Open Tabme** for the dashboard, or **Open Side Panel** to open Tabme in Firefox's sidebar

Temporary add-ons are removed when Firefox restarts, so re-load after every restart. Firefox 121+ is required (see below); any current release or ESR channel clears that easily.

## Surfaces

| Surface | File | Role |
|---|---|---|
| Popup | `popup.html` | Stash the current window and jump to the dashboard or side panel |
| Dashboard | `dashboard.html` | Full review: tab group, categorized actions, approval, assistant, saved sessions |
| Side panel | `sidepanel.html` | Same capture-to-approve loop, docked beside your tabs |

## Cross-browser support

`manifest.json` is a single unified manifest — no separate Firefox build:

| Manifest key | Chrome uses | Firefox uses |
|---|---|---|
| `background.service_worker` | ✓ (as a service worker) | ignored |
| `background.scripts` | ignored | ✓ (as an event page) |
| `side_panel` + `sidePanel` permission | ✓ | ignored (harmless console warning) |
| `sidebar_action` | ignored | ✓ |
| `browser_specific_settings.gecko` | ignored | ✓ — sets the add-on ID and `strict_min_version: "121.0"` |

`strict_min_version` is pinned to 121 because Firefox 109–120 fail to start the background page at all when both `service_worker` and `scripts` are present in `background` ([bug 1860304](https://bugzilla.mozilla.org/show_bug.cgi?id=1860304)); 121 is the first version that starts it correctly either way.

All extension code calls a single `browserApi` from `utils/browser-runtime.js`, never `chrome.*` or `browser.*` directly:

```js
// utils/browser-runtime.js
export const browserApi = globalThis.browser ?? globalThis.chrome;
```

This matters because Firefox's `chrome.*` alias is callback-based for compatibility with older Chrome extensions, not promise-based — `await chrome.tabs.query(...)` silently resolves to `undefined` there instead of a tab list. `browser.*` is Firefox's native, promise-based API and is preferred whenever it exists; Chrome never defines a global `browser`, so `browserApi` resolves to `chrome` there.

Two things don't unify cleanly and are handled explicitly:

- **Opening the docked panel.** Chrome's Side Panel and Firefox's Sidebar are different APIs. Firefox's `sidebarAction.open()` also has a strict rule: it must run with **no `await` before it** anywhere in the click handler, or Firefox rejects it as not a user gesture. `popup.js` branches on `isFirefox` before doing anything async, so the Firefox path calls `sidebarAction.open()` as its first statement.
- **Tab grouping.** Firefox only gained a `tabGroups`/`tabs.group()` API in Firefox 139 (2025). Every call site already feature-detects with `browserApi.tabs?.group` and `browserApi.tabGroups?.update`, so on older Firefox the tabs still open — they're just not visually grouped. Nothing errors either way.

Any URL filter that excludes the extension's own pages checks both `chrome-extension://` and `moz-extension://` prefixes (`utils/tabs.js`, `utils/group-title.js`, `dashboard.js`, `popup.js`).

## Backend wiring

All backend calls go through `utils/api.js`, which owns the base URL (`http://127.0.0.1:3100`) and the request shapes. Change `API_BASE` there and every surface follows.

| Call | Endpoint | Purpose |
|---|---|---|
| `fetchHealth` | `GET /api/health` | Is the backend up, is a model key set, is Ambiguous configured |
| `generateSuggestions` | `POST /api/generate-suggestions` | Send captured tabs, get a `reviewId` |
| `fetchReview` | `GET /api/suggestions/:reviewId` | Tabs, categorized suggestions, `source`, status |
| `executeSuggestions` | `POST /api/execute-suggestions` | Write the approved actions to Ambiguous |
| `askAssistant` | `POST /api/assistant` | Read-only chat over the current review |

`utils/taxonomy.js` mirrors the agent's categories and the type-to-Ambiguous routing from `apps/web/src/lib/surface.ts`. Keep the two in step.

## How a suggestion reaches Ambiguous

The agent assigns each captured tab a category (`learning`, `research`, `competitor`, `reference`, `follow_up`) and an action type. The type decides which Ambiguous record gets written:

| Suggestion type | Ambiguous record |
|---|---|
| `create_task` | Task |
| `save_note`, `create_doc` | Document |
| `add_competitor` | Sheet, plus a marker doc |
| `add_crm` | Contact |
| `draft_email` | Draft email |
| `upload_drive` | Not supported yet; fails with a clear message |

Every row shows its destination before you approve, so nothing is written blind.

## Features

- **Category grouping**: proposed actions are grouped under the agent's own triage categories.
- **Destination badges**: each action names the Ambiguous record it will create.
- **Connection strip**: tells you when the backend is down or `AMBIGUOUS_API_KEY` is missing, before you try to approve.
- **Triage source**: says whether the model categorized the tabs or the keyword fallback did.
- **Human-in-the-loop approval**: nothing is written until you click **Approve selected**. Unselected actions are dismissed in the same step.
- **Tab grouping**: optionally groups or closes triaged tabs after approval, where the browser supports it.
- **Ask Tabme**: read-only assistant over the current review. Chat cannot write to Ambiguous.

## Known limits

- Only the current window is captured, and at most 20 tabs per review.
- At most 5 actions can be approved per run; approving dismisses the rest of that review.
- `chrome://`/`about:`, extension, and system pages are marked unsupported and never produce actions.
- Page scraping is best-effort on the first 3 tabs.
- Backend reviews live in a local session store and are dropped after 24 hours.
- The side panel keeps its session in memory only; the dashboard persists sessions in extension storage.
- Tab grouping needs Firefox 139+ (2025). Older Firefox still opens and closes tabs on approval, just without the visual group.
- Firefox requires Firefox 121+ to load this extension at all (see [Cross-browser support](#cross-browser-support)).
