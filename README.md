# Tabme

Human-in-the-loop tab triage. Capture open browser tabs, review a short list of suggested actions, and approve before anything is written.

This repo started from the [CopilotKit Agents Everywhere starter kit](https://github.com/CopilotKit/agents-everywhere-starter-kit): one `agent-core`, CopilotKit React on the web review, HITL writes, and optional Ambiguous / Exa / OpenRouter. The sample incident and finance domains were replaced with Tabme.

UI work should follow [Impeccable](https://github.com/pbakaus/impeccable). Agents: read [`.cursor/skills/impeccable/SKILL.md`](.cursor/skills/impeccable/SKILL.md) and [AGENTS.md](AGENTS.md).

## Quick start

Node.js 22+. From the repository root:

```bash
npm ci
cp .env.example .env
npm run dev:web
```

Open `http://127.0.0.1:3100` and click **Review sample tabs**, or load `apps/extension` unpacked in Chrome and capture a real window.

Set `OPENAI_API_KEY` (or OpenRouter) before using the in-page assistant or model-generated suggestions. Set `AMBIGUOUS_API_KEY` to approve suggestions as real workplace tasks. Optional: `EXA_API_KEY` enables grounded web search in chat.

Preflight the backend with `curl http://127.0.0.1:3100/api/health`. Lost a review link? Open `/reviews` or `GET /api/reviews`.

## Repo map

| Path | What it is |
|---|---|
| `apps/web` | Next.js review app, APIs, CopilotKit runtime |
| `apps/extension` | Chrome Manifest V3 capture popup |
| `packages/agent-core` | Shared agent prompt, model routing, optional tools |
| `docs/tabme-prd.md` | Product requirements |
| `docs/tabme-person1-extension.md` | Person 1: extension |
| `docs/tabme-person2-review.md` | Person 2: review and execution |
| `PRODUCT.md` / `DESIGN.md` | Impeccable product truth and visual world |

## Inherited vs Tabme

Starter-kit code we kept: workspace layout, `makeAgent`, CopilotKit Hono runtime, model resolver, Ambiguous MCP adapter, HITL “ask before writes,” and the sponsor/hackathon docs.

Tabme-specific: tab capture, durable review sessions, task-first triage with heuristic fallback, real Ambiguous execution after approval, extension, branding, and Impeccable skill.

The git folder may still be named `tab-me-agent`. That is a remote/path identifier, not the product name.

## Verify

```bash
npm run verify
```
