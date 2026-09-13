# Tabme — Person 2: Review and execution

**Owner:** Person 2  
**Timebox:** 4 hours (shared with Person 1)  
**Goal:** Keep the web review, suggestion generation, CopilotKit assistant, and one execution path working.

The app already lives in `apps/web` on the Agents Everywhere starter-kit layout (Next.js + `agent-core`). Do not invent a parallel `backend/` tree.

---

## 1. Deliverables

1. APIs:
   - `POST /api/generate-suggestions`
   - `GET /api/suggestions/:reviewId`
   - `POST /api/execute-suggestions`
2. In-memory review sessions (`src/lib/sessions.ts`).
3. Suggestion heuristics (`src/lib/suggestions.ts`), 3–5 items.
4. Review page at `/review/:reviewId` with checkboxes and **Approve selected**.
5. One real or mocked action: `create_task` via Ambiguous when `AMBIGUOUS_API_KEY` is set.
6. CopilotKit chat that can read the review and cannot write without the page button.

---

## 2. File structure

```
apps/web/src/
  app/page.tsx
  app/review/[reviewId]/page.tsx
  app/api/generate-suggestions/route.ts
  app/api/suggestions/[reviewId]/route.ts
  app/api/execute-suggestions/route.ts
  app/api/copilotkit/[[...path]]/route.ts
  lib/sessions.ts
  lib/suggestions.ts
  lib/actions.ts
  lib/server/workplace.ts
packages/agent-core/src/prompt.ts
```

---

## 3. Run

From the repo root:

```bash
npm ci
cp .env.example .env
npm run dev:web
```

Open `http://127.0.0.1:3100`. Use **Review sample tabs** if the extension is not loaded.

---

## 4. Coordination with Person 1

- Same tab schema and review URL shape.
- CORS on generate-suggestions for the extension.
- Do not change env var names (`OPENAI_API_KEY`, `AMBIGUOUS_API_KEY`, `MODEL_PROVIDER`).

---

## 5. Testing checklist

- [ ] Sample tabs or extension capture returns a `reviewId`.
- [ ] Review page lists suggestions.
- [ ] Approve selected shows a result.
- [ ] Failed individual actions do not hide the summary.
- [ ] `npm run verify` passes.

---

## 6. Known limits

- In-memory storage.
- Only `create_task` can be a real write.
- No auth. Loopback only.
- Slack/mobile starter-kit apps are not part of Tabme MVP.

---

## 7. Design

Read [../.cursor/skills/impeccable/SKILL.md](../.cursor/skills/impeccable/SKILL.md) and [../DESIGN.md](../DESIGN.md) before changing the review UI.
