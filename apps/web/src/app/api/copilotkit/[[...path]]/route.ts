/**
 * Tabme web runtime. Same wiring as the Agents Everywhere starter kit:
 * a Hono app at module scope, factory-form agents, no Channels on this process.
 *
 * Workplace writes stay off this runtime. Approved create_task actions go
 * through /api/execute-suggestions after the review-page click.
 */
import { randomUUID } from "node:crypto";
import {
  BuiltInAgent,
  CopilotRuntime,
  createCopilotHonoHandler,
} from "@copilotkit/runtime/v2";
import { makeAgent, SYSTEM_PROMPT } from "agent-core";

function createWebAgent() {
  try {
    return makeAgent(randomUUID(), { workplace: false });
  } catch {
    const agent = new BuiltInAgent({
      model: "openai:gpt-5.6-sol",
      prompt: SYSTEM_PROMPT,
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
