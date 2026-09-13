import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReviewSuggestions, generateSuggestions } from "./suggestions";
import { SAMPLE_TABS } from "./tabs";

test("generates three to five suggestions from sample tabs", () => {
  const suggestions = generateSuggestions(SAMPLE_TABS);
  assert.ok(suggestions.length >= 3 && suggestions.length <= 5);
  assert.ok(suggestions.every((item) => item.status === "pending_review"));
  assert.ok(suggestions.every((item) => item.type === "create_task"));
  assert.ok(suggestions.every((item) => item.category));
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

test("no model key produces heuristic output with source heuristic", async () => {
  const previous = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    MODEL_PROVIDER: process.env.MODEL_PROVIDER,
  };
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.MODEL_PROVIDER;
  process.env.OPENAI_API_KEY = "stub-replace-me";
  try {
    const result = await buildReviewSuggestions(SAMPLE_TABS);
    assert.equal(result.source, "heuristic");
    assert.ok(result.suggestions.length >= 1);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("falls back to a real follow-up task when no heuristic matches", () => {
  const suggestions = generateSuggestions([
    {
      id: 9,
      url: "https://example.com/notes",
      title: "Random page",
      status: "captured",
    },
  ]);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]?.type, "create_task");
  assert.equal(suggestions[0]?.category, "follow_up");
});
