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
   - `GET /api/reviews` (recent captures)
   - `GET /api/health` (preflight for extension / demo)
   - `POST /api/search` (optional, when `EXA_API_KEY` is set)
2. Durable review sessions (`src/lib/sessions.ts`) — JSON write-through under `.tabme-sessions/`, 24h TTL, 50-session cap.
3. Model triage with heuristic fallback (`packages/agent-core/src/capabilities/triage.ts` + `src/lib/suggestions.ts`).
4. Review page at `/review/:reviewId` with categories, checkboxes, real-write result chips, and **Approve selected** / **Retry selected**.
5. Every approved suggestion creates a task via Ambiguous. Missing configuration fails without a write.
6. CopilotKit chat that can read the review, optionally search the web, and cannot write without the page button.

---

## 2. File structure

```
apps/web/src/
  app/page.tsx
  app/reviews/page.tsx
  app/review/[reviewId]/page.tsx
  app/api/generate-suggestions/route.ts
  app/api/suggestions/[reviewId]/route.ts
  app/api/execute-suggestions/route.ts
  app/api/reviews/route.ts
  app/api/health/route.ts
  app/api/search/route.ts
  app/api/copilotkit/[[...path]]/route.ts
  lib/sessions.ts
  lib/suggestions.ts
  lib/actions.ts
  lib/server/workplace.ts
  scripts/check-workplace.ts
packages/agent-core/src/prompt.ts
packages/agent-core/src/capabilities/triage.ts
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

Preflight Ambiguous before a demo:

```bash
npm run check:workplace --workspace web
```

Backend health (for Person 1 or screenshots):

```bash
curl http://127.0.0.1:3100/api/health
```

---

## 4. Coordination with Person 1

- Same tab schema and review URL shape.
- CORS reflects any `chrome-extension://` origin plus `http://127.0.0.1:3100` / `http://localhost:3100`. Person 1's unpacked extension ID does not need to be hardcoded. Escape hatch: `CORS_ALLOW_ALL=true` or `CHROME_EXTENSION_ORIGIN`.
- Do not change env var names (`OPENAI_API_KEY`, `AMBIGUOUS_API_KEY`, `MODEL_PROVIDER`).
- Optional: `GET /api/health` before capture; `GET /api/reviews` if the popup link is lost.

---

## 5. Testing checklist

- [ ] Sample tabs or extension capture returns a `reviewId`.
- [ ] Review page lists suggestions and shows model vs heuristic source.
- [ ] Approve selected shows real vs simulated counts.
- [ ] Failed Ambiguous writes stay selectable; **Retry selected** works.
- [ ] Dev-server restart still loads `/review/:reviewId` from disk.
- [ ] `npm run verify` passes.

---

## 6. Known limits

- Sessions expire after 24 hours and are capped at ~50; not a production store.
- All generated suggestions are `create_task` items; approval never reports a simulated success.
- No auth. Loopback + extension CORS only by default.
- Chat thread memory: CopilotRuntime v2 `AgentFactoryContext` is `{ request }` only — no `threadId`. `handle-run` later sets `agent.threadId` from the client run payload. The factory still uses a placeholder UUID.
- Slack/mobile starter-kit apps are not part of Tabme MVP.

---

## 7. Design

Read [../.cursor/skills/impeccable/SKILL.md](../.cursor/skills/impeccable/SKILL.md) and [../DESIGN.md](../DESIGN.md) before changing the review UI.
