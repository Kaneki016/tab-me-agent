import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import {
  createSession,
  getSession,
  listSessions,
  resetSessionsForTests,
  setSuggestions,
} from "./sessions";
import { generateSuggestions } from "./suggestions";
import { SAMPLE_TABS } from "./tabs";

const ORIGINAL_SESSION_DIR = process.env.TABME_SESSION_DIR;

afterEach(() => {
  resetSessionsForTests();
  if (ORIGINAL_SESSION_DIR === undefined) {
    delete process.env.TABME_SESSION_DIR;
  } else {
    process.env.TABME_SESSION_DIR = ORIGINAL_SESSION_DIR;
  }
});

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

test("uses unguessable rev_ UUID review ids", () => {
  const session = createSession(SAMPLE_TABS);
  assert.match(session.reviewId, /^rev_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test("persists sessions to disk and rehydrates after cache reset", () => {
  const dir = mkdtempSync(join(tmpdir(), "tabme-sessions-"));
  process.env.TABME_SESSION_DIR = dir;
  try {
    const session = createSession(SAMPLE_TABS);
    setSuggestions(session.reviewId, generateSuggestions(SAMPLE_TABS));
    resetSessionsForTests();
    const loaded = getSession(session.reviewId);
    assert.ok(loaded);
    assert.equal(loaded?.reviewId, session.reviewId);
    assert.ok(listSessions().some((item) => item.reviewId === session.reviewId));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("caps persisted session count", () => {
  const dir = mkdtempSync(join(tmpdir(), "tabme-sessions-"));
  const previousCap = process.env.TABME_SESSION_CAP;
  process.env.TABME_SESSION_DIR = dir;
  process.env.TABME_SESSION_CAP = "2";
  try {
    const first = createSession(SAMPLE_TABS);
    const second = createSession(SAMPLE_TABS);
    const third = createSession(SAMPLE_TABS);
    resetSessionsForTests();
    const listed = listSessions();
    assert.equal(listed.length, 2);
    assert.ok(listed.some((item) => item.reviewId === second.reviewId));
    assert.ok(listed.some((item) => item.reviewId === third.reviewId));
    assert.equal(getSession(first.reviewId), undefined);
  } finally {
    if (previousCap === undefined) delete process.env.TABME_SESSION_CAP;
    else process.env.TABME_SESSION_CAP = previousCap;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("evicts sessions older than 24 hours", () => {
  const dir = mkdtempSync(join(tmpdir(), "tabme-sessions-"));
  process.env.TABME_SESSION_DIR = dir;
  try {
    const session = createSession(SAMPLE_TABS);
    setSuggestions(session.reviewId, generateSuggestions(SAMPLE_TABS));
    const filePath = join(dir, `${session.reviewId}.json`);
    const onDisk = JSON.parse(readFileSync(filePath, "utf8")) as { createdAt: string };
    onDisk.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    writeFileSync(filePath, JSON.stringify(onDisk));
    resetSessionsForTests();
    assert.equal(getSession(session.reviewId), undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
