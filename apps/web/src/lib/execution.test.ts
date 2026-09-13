import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { executeAction } from "./actions";
import { executeApprovedSuggestions } from "./execute";
import { createSession, resetSessionsForTests, setSuggestions } from "./sessions";
import type { ExecutionResult, Suggestion } from "./types";

const ORIGINAL_SESSION_DIR = process.env.TABME_SESSION_DIR;

const baseSuggestion: Suggestion = {
  id: "sug_test_1",
  type: "create_task",
  category: "follow_up",
  status: "pending_review",
  data: { title: "Follow up", url: "https://example.com" },
  editable: true,
  title: "Create task: Follow up",
};

afterEach(() => {
  resetSessionsForTests();
  if (ORIGINAL_SESSION_DIR === undefined) {
    delete process.env.TABME_SESSION_DIR;
  } else {
    process.env.TABME_SESSION_DIR = ORIGINAL_SESSION_DIR;
  }
});

test("every suggestion type uses the real task path", async () => {
  const result = await executeAction(
    { ...baseSuggestion, type: "save_note" },
    "rev_test",
  );
  assert.equal(result.status, "failed");
  assert.match(result.error ?? "", /Ambiguous is not configured/);
});

test("executeAction fails closed when Ambiguous is missing", async () => {
  const previous = process.env.AMBIGUOUS_API_KEY;
  delete process.env.AMBIGUOUS_API_KEY;
  try {
    const result = await executeAction(baseSuggestion, "rev_test");
    assert.equal(result.status, "failed");
    assert.match(result.error ?? "", /Ambiguous is not configured/);
  } finally {
    if (previous === undefined) delete process.env.AMBIGUOUS_API_KEY;
    else process.env.AMBIGUOUS_API_KEY = previous;
  }
});

test("approving twice does not execute a completed suggestion again", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tabme-exec-"));
  process.env.TABME_SESSION_DIR = dir;
  try {
    const session = createSession([
      {
        id: 1,
        url: "https://example.com",
        title: "Example",
        status: "captured",
      },
    ]);
    setSuggestions(session.reviewId, [{ ...baseSuggestion }]);

    let calls = 0;
    const run = async (suggestion: Suggestion): Promise<ExecutionResult> => {
      calls += 1;
      return {
        id: suggestion.id,
        status: "completed",
        actionId: `mock_create_task_${calls}`,
        resultUrl: null,
        mode: "real",
        modeReason: "written to Ambiguous",
      };
    };

    const first = await executeApprovedSuggestions(
      session.reviewId,
      [baseSuggestion.id],
      null,
      run,
    );
    const second = await executeApprovedSuggestions(
      session.reviewId,
      [baseSuggestion.id],
      null,
      run,
    );

    assert.equal(calls, 1);
    assert.equal(first.results[0]?.status, "completed");
    assert.equal(second.results[0]?.status, "skipped");
    assert.equal(first.session.suggestions[0]?.status, "completed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("concurrent approvals execute a suggestion once", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tabme-exec-"));
  process.env.TABME_SESSION_DIR = dir;
  try {
    const session = createSession([
      { id: 1, url: "https://example.com", title: "Example", status: "captured" },
    ]);
    setSuggestions(session.reviewId, [{ ...baseSuggestion }]);

    let calls = 0;
    const run = async (suggestion: Suggestion): Promise<ExecutionResult> => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return {
        id: suggestion.id,
        status: "completed",
        actionId: "task_once",
        mode: "real",
        modeReason: "written to Ambiguous",
      };
    };

    const [first, second] = await Promise.all([
      executeApprovedSuggestions(session.reviewId, [baseSuggestion.id], null, run),
      executeApprovedSuggestions(session.reviewId, [baseSuggestion.id], null, run),
    ]);

    assert.equal(calls, 1);
    assert.equal(first.results[0]?.status, "completed");
    assert.equal(second.results[0]?.status, "skipped");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("failed items stay failed when not selected", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tabme-exec-"));
  process.env.TABME_SESSION_DIR = dir;
  try {
    const session = createSession([
      {
        id: 1,
        url: "https://example.com",
        title: "Example",
        status: "captured",
      },
    ]);
    setSuggestions(session.reviewId, [
      { ...baseSuggestion, id: "sug_ok", status: "pending_review" },
      { ...baseSuggestion, id: "sug_fail", status: "failed" },
    ]);

    const run = async (suggestion: Suggestion): Promise<ExecutionResult> => ({
      id: suggestion.id,
      status: "completed",
      actionId: "mock_ok",
      mode: "real",
      modeReason: "written to Ambiguous",
    });

    const { session: next } = await executeApprovedSuggestions(
      session.reviewId,
      ["sug_ok"],
      null,
      run,
    );

    assert.equal(next.suggestions.find((item) => item.id === "sug_fail")?.status, "failed");
    assert.equal(next.suggestions.find((item) => item.id === "sug_ok")?.status, "completed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
