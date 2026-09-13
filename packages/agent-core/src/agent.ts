import { BuiltInAgent } from "@copilotkit/runtime/v2";
import { resolveModel } from "./model";
import { SYSTEM_PROMPT } from "./prompt";
import { workplaceMcpServers } from "./capabilities/workplace";

/**
 * The agent factory.
 *
 * Return a FRESH agent per threadId — never share one stateful instance across
 * conversations. To swap in LangGraph or another AG-UI agent, replace the body
 * with an HttpAgent pointed at that endpoint. Nothing else in Tabme changes.
 */
export type AgentFactoryOptions = {
  workplace?: boolean;
  prompt?: string;
};

export function makeAgent(threadId: string, options: AgentFactoryOptions = {}) {
  const agent = new BuiltInAgent({
    model: resolveModel(),
    prompt: options.prompt ?? SYSTEM_PROMPT,
    maxSteps: 10,
    mcpServers: options.workplace === false ? [] : [...workplaceMcpServers()],
  });
  agent.threadId = threadId;
  return agent;
}
