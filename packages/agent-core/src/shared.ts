/**
 * The browser-safe surface of agent-core.
 *
 * `agent-core` (the root export) pulls in @copilotkit/runtime, which pulls in
 * Express and Node's `fs`. Client code must import `agent-core/shared`.
 */
export { SYSTEM_PROMPT, SURFACE_RULES, TABME_ROLE, ONCALL_ROLE } from "./prompt";
export { DEFAULT_MODEL, MODEL_NOTES } from "./model-meta";
export {
  searchWebParameters,
  type SearchWebArgs,
  type SearchHit,
} from "./schemas";
