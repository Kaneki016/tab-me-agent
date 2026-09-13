import assert from "node:assert/strict";
import { test } from "node:test";
import { generateSuggestions } from "./suggestions";
import { SAMPLE_TABS } from "./tabs";

test("generates three to five suggestions from sample tabs", () => {
  const suggestions = generateSuggestions(SAMPLE_TABS);
  assert.ok(suggestions.length >= 3 && suggestions.length <= 5);
  assert.ok(suggestions.every((item) => item.status === "pending_review"));
  assert.ok(suggestions.some((item) => item.type === "create_task"));
});

test("does not invent actions from unsupported tabs alone", () => {
  const suggestions = generateSuggestions([
    {
      id: 1,
      url: "chrome://settings",
      title: "Settings",
      status: "unsupported",
    },
  ]);
  assert.equal(suggestions.length, 0);
});

test("falls back to a note when no heuristic matches", () => {
  const suggestions = generateSuggestions([
    {
      id: 9,
      url: "https://example.com/notes",
      title: "Random page",
      status: "captured",
    },
  ]);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]?.type, "save_note");
});
