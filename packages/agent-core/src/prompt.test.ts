import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSystemPrompt } from "./prompt";

test("mentions search_web only when search is configured", () => {
  const withSearch = buildSystemPrompt({ searchConfigured: true });
  const withoutSearch = buildSystemPrompt({ searchConfigured: false });
  assert.match(withSearch, /search_web/);
  assert.doesNotMatch(withoutSearch, /search_web/);
});
