/**
 * Server surface. Client code wants `agent-core/shared`.
 */
export { makeAgent } from "./agent";
export { resolveModel, isModelConfigured } from "./model";
export { buildSystemPrompt } from "./prompt";
export {
  triageTabs,
  type TriageTab,
  type TriageResult,
  type TriageSuggestion,
} from "./capabilities/triage";
export { searchWeb, isSearchConfigured } from "./capabilities/search";
export {
  workplaceMcpServers,
  isWorkplaceConfigured,
  WORKPLACE_CONTEXT,
} from "./capabilities/workplace";
export * from "./shared";
