/**
 * Tabme web runtime. Same wiring as the Agents Everywhere starter kit:
 * a Hono app at module scope, factory-form agents, no Channels on this process.
 *
 * Workplace writes stay off this runtime. Approved create_task actions go
 * through /api/execute-suggestions after the review-page click.
 *
 * Thread identity: CopilotRuntime v2 AgentFactoryContext is `{ request }` only.
 * handle-run later sets agent.threadId from the client run payload. The factory
 * still uses a placeholder UUID because the agents callback has no threadId.
 */
import { randomUUID } from "node:crypto";
import {
  BuiltInAgent,
  CopilotRuntime,
  createCopilotHonoHandler,
} from "@copilotkit/runtime/v2";
import { buildSystemPrompt, isSearchConfigured, makeAgent } from "agent-core";

function createWebAgent() {
  const prompt = buildSystemPrompt({ searchConfigured: isSearchConfigured() });
  try {
    return makeAgent(randomUUID(), { workplace: false, prompt });
  } catch {
    const agent = new BuiltInAgent({
      model: "openai:gpt-5.6-sol",
      prompt,
      maxSteps: 10,
    });
    agent.threadId = randomUUID();
    return agent;
  }
}

const runtime = new CopilotRuntime({
  agents: () => ({ default: createWebAgent() }),
});

const app = createCopilotHonoHandler({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = app.fetch;
export const POST = app.fetch;
export const OPTIONS = app.fetch;
