# Tabme — Person 1: Extension and ingestion

**Owner:** Person 1  
**Timebox:** 4 hours (shared with Person 2)  
**Goal:** Keep the Chrome extension capturing tabs, optionally scraping a few pages, and sending them to the Tabme web app.

The extension already lives in `apps/extension`. Do not invent a second copy at the repo root.

---

## 1. Deliverables

1. Manifest V3 extension named **Tabme** (`apps/extension/manifest.json`).
2. Tab capture: `id`, `url`, `title`; mark unsupported pages.
3. Optional scrape of up to 3 public pages.
4. `POST` to `http://127.0.0.1:3100/api/generate-suggestions`.
5. Popup states: idle, capturing, success with review link, error.
6. Keep `apps/extension/README.md` accurate.

---

## 2. File structure

```
apps/extension/
  manifest.json
  popup.html
  popup.css
  popup.js
  utils/tabs.js
  README.md
```

---

## 3. Coordination with Person 2

- Backend URL: `http://127.0.0.1:3100` (starter-kit web port).
- Tab schema: `id`, `url`, `title`, optional `content`, `status`.
- Review link: `/review/:reviewId`.
- CORS is enabled on the generate-suggestions route for the extension origin.

---

## 4. Testing checklist

- [ ] `npm run dev:web` is running.
- [ ] Load unpacked from `apps/extension`.
- [ ] Capture 5–10 normal tabs.
- [ ] Popup shows a review link that opens Tabme.
- [ ] A `chrome://` tab is marked unsupported.
- [ ] Backend down → clear error.

---

## 5. Known limits

- Current window only.
- No auth. Sessions die when the web app restarts.
- Design: follow [../.cursor/skills/impeccable/SKILL.md](../.cursor/skills/impeccable/SKILL.md). No Inter, no purple gradient, no nested cards.

---

## 6. Stretch (only after the core loop works)

- Demo-mode button that posts the sample tabs from `apps/web/src/lib/tabs.ts`.
- List captured titles in the popup.
- Persist last `reviewId` in `chrome.storage.local`.
