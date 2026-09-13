import assert from "node:assert/strict";
import { test } from "node:test";
import { createSession, getSession, setSuggestions } from "./sessions";
import { generateSuggestions } from "./suggestions";
import { SAMPLE_TABS } from "./tabs";

test("stores a review session that can be fetched by id", () => {
  const session = createSession(SAMPLE_TABS);
  const suggestions = generateSuggestions(SAMPLE_TABS);
  setSuggestions(session.reviewId, suggestions);
  const stored = getSession(session.reviewId);
  assert.ok(stored);
  assert.equal(stored?.tabs.length, SAMPLE_TABS.length);
  assert.equal(stored?.suggestions.length, suggestions.length);
  assert.equal(stored?.status, "pending");
});
