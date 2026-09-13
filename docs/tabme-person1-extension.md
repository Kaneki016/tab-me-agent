# Tabme — Person 1: Extension and ingestion

**Owner:** Person 1  
**Timebox:** 4 hours (shared with Person 2)  
**Goal:** Own the whole in-Chrome loop — capture tabs, run them through the agent's categorization, review the proposed actions, and approve the ones that get written to Ambiguous.

The extension already lives in `apps/extension`. Do not invent a second copy at the repo root.

Review happens in the extension, not in the Next.js app. `apps/web` is the API and agent runtime; a demo never has to open `/review/:reviewId`.

---

## 1. Deliverables

1. Manifest V3 extension named **Tabme** (`apps/extension/manifest.json`).
2. Tab capture: `id`, `url`, `title`; mark unsupported pages.
3. Optional scrape of up to 3 public pages.
4. The full backend loop through `utils/api.js`: generate, fetch review, execute, assistant, health.
5. Review UI that shows the agent's category for each action and the Ambiguous record it will create.
6. States on every surface: idle, capturing, analyzing, error, empty, executed.
7. Keep `apps/extension/README.md` accurate.

---

## 2. File structure

```
apps/extension/
  manifest.json
  popup.html / popup.css / popup.js          toolbar entry
  dashboard.html / dashboard.css / dashboard.js   full review surface
  sidepanel.html / sidepanel.css / sidepanel.js   docked review surface
  utils/api.js         backend client, base URL, request shapes
  utils/taxonomy.js    categories, action types, Ambiguous routing
  utils/tabs.js        capture and scrape
  utils/group-title.js
  README.md
```

---

## 3. Coordination with Person 2

- Backend URL: `http://127.0.0.1:3100` (starter-kit web port), set once in `utils/api.js`.
- Tab schema: `id`, `url`, `title`, optional `content`, `status`. Max 20 tabs per review.
- Suggestions carry `category` and `surface`. `surface` comes from `apps/web/src/lib/surface.ts` and names the Ambiguous record the action will create; `utils/taxonomy.js` mirrors that table, so the two change together.
- `GET /api/health` reports `model`, `workplace`, and `search`. The extension uses `workplace` to warn before an approval that would fail.
- Approvals are capped at 5 per call and dismiss the unselected suggestions in the same review.
- CORS reflects any `chrome-extension://` origin on every route the extension calls.

---

## 4. Testing checklist

- [ ] `npm run dev:web` is running.
- [ ] Load unpacked from `apps/extension`.
- [ ] Capture 5–10 normal tabs.
- [ ] Actions appear grouped under the agent's categories, each with a destination badge.
- [ ] Connection strip reads "Ambiguous connected" when `AMBIGUOUS_API_KEY` is set.
- [ ] Approve one action → the row shows its Ambiguous record and the banner names what was created.
- [ ] Unset `AMBIGUOUS_API_KEY` → the strip warns before approval, and approval fails with a readable reason.
- [ ] A `chrome://` tab is marked unsupported.
- [ ] Backend down → clear error naming `npm run dev:web`, with a Try again button.

---

## 5. Known limits

- Current window only, 20 tabs per review, 5 approvals per run.
- No auth. Reviews live in a local session store and expire after 24 hours.
- Design: follow [../.cursor/skills/impeccable/SKILL.md](../.cursor/skills/impeccable/SKILL.md). No Inter, no purple gradient, no nested cards.

---

## 6. Stretch (only after the core loop works)

- Demo-mode button that posts the sample tabs from `apps/web/src/lib/tabs.ts`.
- List captured titles in the popup.
- Persist last `reviewId` in `chrome.storage.local`.
