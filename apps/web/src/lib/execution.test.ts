import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { executeAction, type WorkplaceConnection } from "./actions";
import { executeApprovedSuggestions } from "./execute";
import { createSession, resetSessionsForTests, setSuggestions } from "./sessions";
import type { ExecutionResult, Suggestion } from "./types";
import type { Workplace, WorkplaceRecord } from "./server/workplace";

const ORIGINAL_SESSION_DIR = process.env.TABME_SESSION_DIR;
const ORIGINAL_AMBIGUOUS_KEY = process.env.AMBIGUOUS_API_KEY;

const baseSuggestion: Suggestion = {
  id: "sug_test_1",
  type: "create_task",
  category: "follow_up",
  surface: "task",
  status: "pending_review",
  data: { title: "Follow up", url: "https://example.com" },
  editable: true,
  title: "Create task: Follow up",
};

function record(kind: WorkplaceRecord["kind"], id: string, title: string): WorkplaceRecord {
  return { kind, id, title, url: null };
}

function mockWorkplace(
  handlers: Partial<{
    list: Workplace["list"];
    create: Workplace["create"];
    listDocuments: Workplace["listDocuments"];
    createDocument: Workplace["createDocument"];
    createSheet: Workplace["createSheet"];
    appendSheetValues: Workplace["appendSheetValues"];
    findContacts: Workplace["findContacts"];
    createContact: Workplace["createContact"];
    createDraftEmail: Workplace["createDraftEmail"];
  }>,
): WorkplaceConnection {
  const unimplemented = async () => {
    throw new Error("Unexpected workplace call in test.");
  };
  return {
    workplace: {
      identity: async () => ({ id: "user", workspaceId: "ws", name: "Test" }),
      get: async (id) => record("task", id, "Task"),
      list: handlers.list ?? (async () => []),
      create: handlers.create ?? unimplemented,
      listDocuments: handlers.listDocuments ?? (async () => []),
      createDocument: handlers.createDocument ?? unimplemented,
      createSheet: handlers.createSheet ?? unimplemented,
      appendSheetValues: handlers.appendSheetValues ?? unimplemented,
      findContacts: handlers.findContacts ?? (async () => []),
      createContact: handlers.createContact ?? unimplemented,
      createDraftEmail: handlers.createDraftEmail ?? unimplemented,
    },
    close: async () => {},
  };
}

afterEach(() => {
  resetSessionsForTests();
  if (ORIGINAL_SESSION_DIR === undefined) {
    delete process.env.TABME_SESSION_DIR;
  } else {
    process.env.TABME_SESSION_DIR = ORIGINAL_SESSION_DIR;
  }
  if (ORIGINAL_AMBIGUOUS_KEY === undefined) {
    delete process.env.AMBIGUOUS_API_KEY;
  } else {
    process.env.AMBIGUOUS_API_KEY = ORIGINAL_AMBIGUOUS_KEY;
  }
});

test("executeAction fails closed when Ambiguous is missing", async () => {
  delete process.env.AMBIGUOUS_API_KEY;
  const result = await executeAction(baseSuggestion, "rev_test");
  assert.equal(result.status, "failed");
  assert.match(result.error ?? "", /Ambiguous is not configured/);
});

test("upload_drive fails closed with a clear message", async () => {
  process.env.AMBIGUOUS_API_KEY = "test-key";
  const result = await executeAction(
    { ...baseSuggestion, type: "upload_drive" },
    "rev_test",
    mockWorkplace({}),
  );
  assert.equal(result.status, "failed");
  assert.match(result.error ?? "", /Drive upload is not supported/);
});

test("save_note routes to createDocument", async () => {
  process.env.AMBIGUOUS_API_KEY = "test-key";
  let called = false;
  const result = await executeAction(
    { ...baseSuggestion, type: "save_note", title: "Save API notes" },
    "rev_test",
    mockWorkplace({
      createDocument: async (args) => {
        called = true;
        assert.equal(args.type, "doc");
        assert.deepEqual(args.labels, ["tabme:sug_test_1"]);
        return record("document", "doc-1", args.title);
      },
    }),
  );
  assert.equal(called, true);
  assert.equal(result.status, "completed");
  assert.equal(result.surface, "doc");
  assert.equal(result.actionId, "doc-1");
});

test("add_competitor routes to createSheet and appendSheetValues", async () => {
  process.env.AMBIGUOUS_API_KEY = "test-key";
  let sheetCreated = false;
  let appended = false;
  const result = await executeAction(
    { ...baseSuggestion, type: "add_competitor", title: "Assess Linear" },
    "rev_test",
    mockWorkplace({
      createSheet: async () => {
        sheetCreated = true;
        return record("sheet", "sheet-1", "Competitor sheet");
      },
      appendSheetValues: async (id, range, values) => {
        appended = true;
        assert.equal(id, "sheet-1");
        assert.equal(range, "A1");
        assert.equal(values[0]?.[0], "Name");
      },
      createDocument: async () => record("document", "marker-1", "marker"),
    }),
  );
  assert.equal(sheetCreated, true);
  assert.equal(appended, true);
  assert.equal(result.status, "completed");
  assert.equal(result.surface, "sheet");
});

test("add_crm routes to createContact after dedupe", async () => {
  process.env.AMBIGUOUS_API_KEY = "test-key";
  let created = false;
  const result = await executeAction(
    {
      ...baseSuggestion,
      type: "add_crm",
      title: "Contact: Acme Corp",
      data: { title: "Contact: Acme Corp", url: "https://example.com" },
    },
    "rev_test",
    mockWorkplace({
      findContacts: async () => [],
      createContact: async (args) => {
        created = true;
        assert.equal(args.name, "Acme Corp");
        assert.equal(args.custom_properties?.tabme_marker, "tabme:sug_test_1");
        return record("contact", "contact-1", args.name);
      },
    }),
  );
  assert.equal(created, true);
  assert.equal(result.status, "completed");
  assert.equal(result.surface, "contact");
});

test("draft_email routes to createDraftEmail with idempotency_key", async () => {
  process.env.AMBIGUOUS_API_KEY = "test-key";
  let drafted = false;
  const result = await executeAction(
    { ...baseSuggestion, type: "draft_email", title: "Follow up with team" },
    "rev_test",
    mockWorkplace({
      createDraftEmail: async (args) => {
        drafted = true;
        assert.equal(args.idempotency_key, "tabme-sug_test_1");
        return record("draft_email", "draft-1", args.subject);
      },
    }),
  );
  assert.equal(drafted, true);
  assert.equal(result.status, "completed");
  assert.equal(result.surface, "email draft");
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
