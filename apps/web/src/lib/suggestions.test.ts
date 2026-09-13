import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReviewSuggestions, generateSuggestions } from "./suggestions";
import { SAMPLE_TABS } from "./tabs";

test("generates three to five suggestions from sample tabs", () => {
  const suggestions = generateSuggestions(SAMPLE_TABS);
  assert.ok(suggestions.length >= 3 && suggestions.length <= 5);
  assert.ok(suggestions.every((item) => item.status === "pending_review"));
  assert.ok(suggestions.some((item) => item.type === "create_task"));
  assert.ok(suggestions.some((item) => item.type === "add_competitor"));
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

test("routes reference tabs to save_note in heuristic fallback", () => {
  const suggestions = generateSuggestions([
    {
      id: 10,
      url: "https://example.com/reference/api",
      title: "API reference",
      status: "captured",
    },
  ]);
  assert.equal(suggestions[0]?.type, "save_note");
  assert.equal(suggestions[0]?.category, "reference");
});

test("routes email threads to draft_email in heuristic fallback", () => {
  const suggestions = generateSuggestions([
    {
      id: 11,
      url: "https://mail.google.com/mail/u/0/#inbox/abc123",
      title: "Re: Contract renewal",
      status: "captured",
    },
  ]);
  assert.equal(suggestions[0]?.type, "draft_email");
});

test("routes LinkedIn/Crunchbase profiles to add_crm in heuristic fallback", () => {
  const person = generateSuggestions([
    {
      id: 12,
      url: "https://www.linkedin.com/in/jane-doe",
      title: "Jane Doe",
      status: "captured",
    },
  ]);
  assert.equal(person[0]?.type, "add_crm");

  const company = generateSuggestions([
    {
      id: 13,
      url: "https://www.crunchbase.com/organization/acme",
      title: "Acme Inc",
      status: "captured",
    },
  ]);
  assert.equal(company[0]?.type, "add_crm");
});

test("bundles three or more research/reference tabs into a create_doc suggestion", () => {
  const suggestions = generateSuggestions([
    {
      id: 14,
      url: "https://arxiv.org/abs/1234",
      title: "A paper on distributed systems research",
      status: "captured",
    },
    {
      id: 15,
      url: "https://example.com/reference/manual",
      title: "Reference manual",
      status: "captured",
    },
    {
      id: 16,
      url: "https://example.com/research/report",
      title: "Research report",
      status: "captured",
    },
  ]);

  const doc = suggestions.find((s) => s.type === "create_doc");
  assert.ok(doc, "expected a create_doc suggestion");
  assert.equal(doc?.category, "research");
  assert.equal((doc?.data.urls as string[]).length, 3);
});
