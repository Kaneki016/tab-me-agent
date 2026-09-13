import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { parseTriageOutput, triageTabs } from "./triage";

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
