import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ReviewSession, Suggestion, SuggestionSource, Tab } from "./types";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 50;
const REVIEW_ID_PATTERN = /^rev_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const globalForSessions = globalThis as typeof globalThis & {
  tabmeSessions?: Map<string, ReviewSession>;
  tabmeSessionDirReady?: boolean;
  tabmeLastSessionCreatedAt?: number;
};

const sessions = globalForSessions.tabmeSessions ?? new Map<string, ReviewSession>();
globalForSessions.tabmeSessions = sessions;

function sessionDir(): string {
  return process.env.TABME_SESSION_DIR?.trim() || path.join(process.cwd(), ".tabme-sessions");
}

function ensureSessionDir(): void {
  if (globalForSessions.tabmeSessionDirReady) return;
  mkdirSync(sessionDir(), { recursive: true });
  globalForSessions.tabmeSessionDirReady = true;
}

function sessionPath(reviewId: string): string {
  return path.join(sessionDir(), `${reviewId}.json`);
}

export function isReviewId(reviewId: string): boolean {
  return REVIEW_ID_PATTERN.test(reviewId);
}

function writeSession(session: ReviewSession): void {
  ensureSessionDir();
  writeFileSync(sessionPath(session.reviewId), JSON.stringify(session, null, 2), "utf8");
}

function readSessionFromDisk(reviewId: string): ReviewSession | undefined {
  try {
    const raw = readFileSync(sessionPath(reviewId), "utf8");
    return JSON.parse(raw) as ReviewSession;
  } catch {
    return undefined;
  }
}

function isExpired(session: ReviewSession, now = Date.now()): boolean {
  const created = Date.parse(session.createdAt);
  return Number.isNaN(created) || now - created > SESSION_TTL_MS;
}

function sessionCap(): number {
  const raw = process.env.TABME_SESSION_CAP;
  const parsed = raw ? Number(raw) : MAX_SESSIONS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : MAX_SESSIONS;
}

function evictSessions(now = Date.now()): void {
  for (const [id, session] of sessions) {
    if (isExpired(session, now)) {
      sessions.delete(id);
      try {
        unlinkSync(sessionPath(id));
      } catch {
        // File may already be gone.
      }
    }
  }

  const ordered = [...sessions.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  for (const session of ordered.slice(sessionCap())) {
    sessions.delete(session.reviewId);
    try {
      unlinkSync(sessionPath(session.reviewId));
    } catch {
      // File may already be gone.
    }
  }
}

function rehydrateFromDisk(): void {
  ensureSessionDir();
  let files: string[];
  try {
    files = readdirSync(sessionDir()).filter((name) => name.endsWith(".json"));
  } catch {
    return;
  }

  for (const file of files) {
    const reviewId = file.replace(/\.json$/, "");
    if (sessions.has(reviewId)) continue;
    const session = readSessionFromDisk(reviewId);
    if (session && !isExpired(session)) {
      sessions.set(reviewId, session);
    }
  }
}

export function createSession(tabs: Tab[]): ReviewSession {
  evictSessions();
  const reviewId = `rev_${randomUUID()}`;
  const createdAtMs = Math.max(
    Date.now(),
    (globalForSessions.tabmeLastSessionCreatedAt ?? 0) + 1,
  );
  globalForSessions.tabmeLastSessionCreatedAt = createdAtMs;
  const session: ReviewSession = {
    reviewId,
    tabs,
    suggestions: [],
    createdAt: new Date(createdAtMs).toISOString(),
    status: "pending",
    source: "heuristic",
  };
  sessions.set(reviewId, session);
  writeSession(session);
  evictSessions();
  return session;
}

export function getSession(reviewId: string): ReviewSession | undefined {
  if (!isReviewId(reviewId)) return undefined;
  const cached = sessions.get(reviewId);
  if (cached) {
    if (isExpired(cached)) {
      sessions.delete(reviewId);
      try {
        unlinkSync(sessionPath(reviewId));
      } catch {
        // File may already be gone.
      }
      return undefined;
    }
    return cached;
  }

  const fromDisk = readSessionFromDisk(reviewId);
  if (!fromDisk || isExpired(fromDisk)) {
    if (fromDisk) {
      try {
        unlinkSync(sessionPath(reviewId));
      } catch {
        // File may already be gone.
      }
    }
    return undefined;
  }

  sessions.set(reviewId, fromDisk);
  return fromDisk;
}

export function listSessions(): ReviewSession[] {
  rehydrateFromDisk();
  evictSessions();
  return [...sessions.values()]
    .filter((session) => !isExpired(session))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateSession(
  reviewId: string,
  updater: (session: ReviewSession) => void,
): ReviewSession {
  const session = getSession(reviewId);
  if (!session) throw new Error("Session not found");
  updater(session);
  sessions.set(reviewId, session);
  writeSession(session);
  return session;
}

export function setSuggestions(
  reviewId: string,
  suggestions: Suggestion[],
  source?: SuggestionSource,
): ReviewSession {
  return updateSession(reviewId, (session) => {
    session.suggestions = suggestions;
    if (source) session.source = source;
  });
}

/** Test helper: reset in-memory cache without touching disk. */
export function resetSessionsForTests(): void {
  sessions.clear();
  globalForSessions.tabmeSessionDirReady = false;
  globalForSessions.tabmeLastSessionCreatedAt = undefined;
}
