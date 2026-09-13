import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { parseTriageOutput, repairTriageJson, SUGGESTION_TYPES, triageTabs } from "./triage";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

test("triageTabs falls back when no model key is configured", async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.MODEL_PROVIDER;

  const result = await triageTabs([
    {
      id: 1,
      url: "https://example.com/docs",
      title: "Example docs",
      content: "Some scraped page text.",
      status: "scraped",
    },
  ]);

  assert.equal(result, null);
});

test("rejects suggestion types outside the union", () => {
  assert.throws(() =>
    parseTriageOutput({
      suggestions: [
        {
          type: "hack_the_planet",
          category: "research",
          title: "Nope",
          description: "",
          sourceUrl: "",
          dueDate: "",
          confidence: 0.5,
        },
      ],
    }),
  );
});

test("accepts widened routed suggestion types", () => {
  for (const type of SUGGESTION_TYPES) {
    const parsed = parseTriageOutput({
      suggestions: [
        {
          type,
          category: "follow_up",
          title: `Suggestion for ${type}`,
          description: "Details",
          sourceUrl: "https://example.com",
          dueDate: "",
          confidence: 0.8,
        },
      ],
    });
    assert.equal(parsed.suggestions[0]?.type, type);
  }
});

test("repairTriageJson recovers JSON wrapped in a markdown fence", () => {
  const text = [
    "Here are the suggestions:",
    "```json",
    '{"suggestions":[{"type":"create_task","category":"follow_up","title":"Do it","description":"","sourceUrl":"","dueDate":"","confidence":0.7}]}',
    "```",
    "Let me know if you need anything else.",
  ].join("\n");

  const repaired = repairTriageJson({ text });
  assert.ok(repaired);
  const parsed = parseTriageOutput(JSON.parse(repaired!));
  assert.equal(parsed.suggestions[0]?.title, "Do it");
});

test("repairTriageJson recovers JSON with leading/trailing prose and no fence", () => {
  const text =
    'Sure thing! {"suggestions":[{"type":"save_note","category":"reference","title":"Keep this","description":"","sourceUrl":"","dueDate":"","confidence":0.6}]} Hope that helps.';

  const repaired = repairTriageJson({ text });
  assert.ok(repaired);
  const parsed = parseTriageOutput(JSON.parse(repaired!));
  assert.equal(parsed.suggestions[0]?.type, "save_note");
});

test("repairTriageJson gives up on text with no JSON object", () => {
  assert.equal(repairTriageJson({ text: "I cannot help with that." }), null);
});

test("triageTabs ignores unsupported tabs", async () => {
  delete process.env.OPENAI_API_KEY;

  const result = await triageTabs([
    {
      id: 1,
      url: "chrome://settings",
      title: "Settings",
      status: "unsupported",
    },
  ]);

  assert.equal(result, null);
});
