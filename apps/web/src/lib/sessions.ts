import type { ReviewSession, Suggestion, Tab } from "./types";

const globalForSessions = globalThis as typeof globalThis & {
  tabmeSessions?: Map<string, ReviewSession>;
};

const sessions = globalForSessions.tabmeSessions ?? new Map<string, ReviewSession>();
globalForSessions.tabmeSessions = sessions;

export function createSession(tabs: Tab[]): ReviewSession {
  const reviewId = `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const session: ReviewSession = {
    reviewId,
    tabs,
    suggestions: [],
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  sessions.set(reviewId, session);
  return session;
}

export function getSession(reviewId: string): ReviewSession | undefined {
  return sessions.get(reviewId);
}

export function listSessions(): ReviewSession[] {
  return [...sessions.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function updateSession(
  reviewId: string,
  updater: (session: ReviewSession) => void,
): ReviewSession {
  const session = sessions.get(reviewId);
  if (!session) throw new Error("Session not found");
  updater(session);
  return session;
}

export function setSuggestions(
  reviewId: string,
  suggestions: Suggestion[],
): ReviewSession {
  return updateSession(reviewId, (session) => {
    session.suggestions = suggestions;
  });
}
