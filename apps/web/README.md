# Tabme web review

**OpenAI + CopilotKit React + Ambiguous AI**

The review surface for Tabme. It lists suggestions from captured tabs, keeps
writes behind **Approve selected**, and hosts the same `agent-core` agent the
starter kit wires through CopilotKit.

## Get started

From the repository root, with Node.js 22+:

```bash
npm ci
cp .env.example .env
npm run dev:web
```

Open `http://127.0.0.1:3100`. The approval server binds to loopback.

Set `OPENAI_API_KEY` (or OpenRouter) before using the in-page assistant or
model-generated suggestions. Heuristics run if the model is missing or times out.
Set `AMBIGUOUS_API_KEY` to approve suggestions. Every approved suggestion
creates a real Ambiguous task; without it, approval fails without a write.
Optional: `EXA_API_KEY` enables `search_web` in chat via `POST /api/search`.

Sessions persist under `.tabme-sessions/` (24h, cap 50). Lost a link? Open
`/reviews` or `GET /api/health` for a preflight.

## Try the flow

1. Click **Review sample tabs** on the home page, or capture tabs from the extension.
2. Check or uncheck suggestions.
3. Click **Approve selected**. Chat text is not approval.
4. Confirm the result summary. If Ambiguous is configured, refresh and look up the task ID.

## Customize these files

| Piece | File |
| --- | --- |
| Review page | [src/app/review/[reviewId]/page.tsx](src/app/review/[reviewId]/page.tsx) |
| Suggestion heuristics | [src/lib/suggestions.ts](src/lib/suggestions.ts) |
| Execution / Ambiguous | [src/lib/actions.ts](src/lib/actions.ts) |
| Agent prompt | [../../packages/agent-core/src/prompt.ts](../../packages/agent-core/src/prompt.ts) |
| CopilotKit runtime | [src/app/api/copilotkit/[[...path]]/route.ts](src/app/api/copilotkit/[[...path]]/route.ts) |

Inherited starter-kit patterns: factory-form `makeAgent`, `workplace: false` on
the web runtime, page context via `useAgentContext`, and HITL before irreversible
talk. Slack and mobile templates from the kit are not copied into this repo.
