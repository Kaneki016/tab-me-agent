# Notes for coding agents

Tabme is a tab-triage product built on the [CopilotKit Agents Everywhere starter kit](https://github.com/CopilotKit/agents-everywhere-starter-kit). Read [PRODUCT.md](PRODUCT.md), [docs/tabme-prd.md](docs/tabme-prd.md), [hackathon-overview.md](hackathon-overview.md), [hackathon-rules.md](hackathon-rules.md), and [using-sponsor-tools.md](using-sponsor-tools.md) before changing architecture.

## Surfaces

| Surface | Path | Role |
|---|---|---|
| Web review | `apps/web` | Suggestions, approval, CopilotKit chat |
| Chrome extension | `apps/extension` | Capture current-window tabs |
| Shared agent | `packages/agent-core` | Prompt, model routing, optional Exa / Ambiguous |

Slack and React Native templates from the starter kit are **not** in this repo. Do not add them unless the team asks. The kit's hard-won wiring rules still apply to `apps/web`.

## Design

Before any UI edit, read [`.cursor/skills/impeccable/SKILL.md`](.cursor/skills/impeccable/SKILL.md) and [DESIGN.md](DESIGN.md). Tabme is Operate-mode: scan, decide, approve.

## CopilotKit rules inherited from the kit

- `@ag-ui/client` must stay deduped. The root `package.json` pins it via `overrides` to the version `@copilotkit/runtime` declares.
- `@copilotkit/channels` and `@copilotkit/runtime` are a tested pair if Channels is added later. Bump together.
- `maxSteps` defaults to 1 on `BuiltInAgent`. Any agent with tools needs more.
- Do not add `identifyUser` to `CopilotRuntime`.
- Do not declare Channels on the Next.js runtime. A long-running Channels listener is a separate process.
- Never invent a Channels component or prop.
- Web chat does not receive raw Ambiguous write tools. Writes go through `/api/execute-suggestions` after **Approve selected**.

## Verification

```bash
npm run verify
npm run build --workspace web
```

`npm run verify` typechecks and runs offline tests without credentials. Live Ambiguous and model calls need keys in `.env`.
