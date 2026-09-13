"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CopilotChat, useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { GenerativeUI } from "@/components/generative-ui";
import { ReviewControl } from "@/components/review-control";
import type {
  ExecutionResult,
  ReviewSession,
  Suggestion,
  SuggestionType,
} from "@/lib/types";

function isSelectable(suggestion: Suggestion): boolean {
  return suggestion.status === "pending_review" || suggestion.status === "failed";
}

function destinationLabel(type: SuggestionType): string {
  switch (type) {
    case "save_note":
    case "create_doc":
      return "New doc";
    case "add_competitor":
      return "Competitor sheet";
    case "add_crm":
      return "CRM contact";
    case "draft_email":
      return "Email draft";
    case "upload_drive":
      return "Drive upload";
    default:
      return "Task";
  }
}

function executionModeLabel(type: SuggestionType): string {
  switch (type) {
    case "save_note":
    case "create_doc":
      return "Doc saved";
    case "add_competitor":
      return "Sheet created";
    case "add_crm":
      return "Contact added";
    case "draft_email":
      return "Draft saved";
    default:
      return "Task created";
  }
}

function summarizeExecution(results: ExecutionResult[]): string {
  const surfaces = new Map<string, number>();
  let mock = 0;
  let failed = 0;

  for (const item of results) {
    if (item.status === "failed") {
      failed += 1;
      continue;
    }
    if (item.status === "skipped") continue;
    if (item.mode === "mock") {
      mock += 1;
      continue;
    }
    if (item.mode === "real") {
      const surface = item.surface ?? "task";
      surfaces.set(surface, (surfaces.get(surface) ?? 0) + 1);
    }
  }

  const parts: string[] = [];
  for (const [surface, count] of surfaces) {
    parts.push(`${count} ${surface}${count === 1 ? "" : "s"}`);
  }
  if (parts.length > 0) parts.push("written to Ambiguous");
  if (mock > 0) parts.push(`${mock} simulated locally`);
  if (failed > 0) parts.push(`${failed} failed`);

  return parts.length > 0 ? parts.join(", ") + "." : "No actions completed.";
}

export default function ReviewPage() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<ExecutionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasFailed = useMemo(
    () => session?.suggestions.some((item) => item.status === "failed") ?? false,
    [session],
  );

  const hasRetryable = useMemo(
    () => session?.suggestions.some(isSelectable) ?? false,
    [session],
  );

  useConfigureSuggestions(
    {
      suggestions: [
        {
          title: "Cluster these tabs",
          message:
            "Using the captured tabs on this page, group them and say which three actions are most useful.",
        },
        {
          title: "What would you approve?",
          message:
            "Which current suggestions are worth approving, and which should I reject? Do not claim anything was saved.",
        },
      ],
      available: "before-first-message",
    },
    [reviewId],
  );

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/suggestions/${reviewId}`);
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        setSession({
          reviewId: data.reviewId,
          tabs: data.tabs,
          suggestions: data.suggestions,
          createdAt: data.createdAt,
          status: data.status,
          source: data.source,
        });
        setSelected(
          new Set(
            data.suggestions
              .filter((item: Suggestion) => isSelectable(item))
              .map((item: Suggestion) => item.id),
          ),
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to load suggestions");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reviewId]);

  async function handleApprove() {
    setExecuting(true);
    setError(null);
    setResults(null);
    try {
      const response = await fetch("/api/execute-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId,
          approvedIds: Array.from(selected),
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Execution failed");
      setResults(data.results ?? []);
      const refresh = await fetch(`/api/suggestions/${reviewId}`);
      const next = await refresh.json();
      if (next.success) {
        setSession({
          reviewId: next.reviewId,
          tabs: next.tabs,
          suggestions: next.suggestions,
          createdAt: next.createdAt,
          status: next.status,
          source: next.source,
        });
        setSelected(
          new Set(
            next.suggestions
              .filter((item: Suggestion) => isSelectable(item))
              .map((item: Suggestion) => item.id),
          ),
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to execute suggestions");
    } finally {
      setExecuting(false);
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <p className="meta">Loading suggestions…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="shell">
        <h1>Review not found</h1>
        <p className="alert">
          {error ?? "This reviewId is not available. Capture tabs again or check recent reviews."}
        </p>
        <div className="cluster">
          <a className="btn" href="/">
            Back to Tabme
          </a>
          <a className="btn" href="/reviews">
            Recent reviews
          </a>
        </div>
      </main>
    );
  }

  const canExecute =
    selected.size > 0 && (hasRetryable || session.status !== "executed");

  return (
    <main className="shell stack">
      <GenerativeUI />
      <ReviewControl session={session} />
      <header className="topbar">
        <a className="wordmark" href="/">
          Tabme
        </a>
        <code>{session.reviewId}</code>
      </header>

      <div className="grid">
        <section aria-labelledby="review-title">
          <h1 id="review-title" className="page-title">
            Review these actions
          </h1>
          <p className="lede">
            {session.tabs.length} tabs captured. Approve only the suggestions you
            want Tabme to run.
          </p>
          {session.source ? (
            <p className="meta">
              Suggestions from{" "}
              <span className="source-pill" data-source={session.source}>
                {session.source === "model" ? "model triage" : "heuristic fallback"}
              </span>
            </p>
          ) : null}

          <div className="tab-rail" aria-label="Captured tabs">
            {session.tabs.map((tab) => (
              <span
                key={`${tab.id}-${tab.url}`}
                className="tab-chip"
                data-status={tab.status}
                title={tab.url}
              >
                {tab.title || tab.url}
                <small>{tab.status}</small>
              </span>
            ))}
          </div>

          {session.suggestions.length === 0 ? (
            <p className="empty">No suggestions generated for this session.</p>
          ) : (
            session.suggestions.map((suggestion) => (
              <label className="suggestion" key={suggestion.id}>
                <input
                  type="checkbox"
                  checked={selected.has(suggestion.id)}
                  disabled={!isSelectable(suggestion)}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.target.checked) next.add(suggestion.id);
                    else next.delete(suggestion.id);
                    setSelected(next);
                  }}
                />
                <span>
                  <strong>{suggestion.title}</strong>
                  {suggestion.description ? (
                    <span className="meta">{suggestion.description}</span>
                  ) : null}
                  <span className="meta">
                    {(suggestion.category ?? "follow_up").replaceAll("_", " ")}
                    {suggestion.status !== "pending_review"
                      ? ` · ${suggestion.status}`
                      : ""}
                    {suggestion.actionId ? ` · ${suggestion.actionId}` : ""}
                  </span>
                  <span className="category-chip">{destinationLabel(suggestion.type)}</span>
                  {suggestion.mode ? (
                    <span
                      className="mode-chip"
                      data-mode={suggestion.mode}
                      title={suggestion.modeReason}
                    >
                      {suggestion.mode === "real"
                        ? executionModeLabel(suggestion.type)
                        : "Legacy simulated"}
                    </span>
                  ) : null}
                  {suggestion.resultUrl ? (
                    <a href={suggestion.resultUrl} target="_blank" rel="noreferrer">
                      Open workplace record
                    </a>
                  ) : null}
                  {suggestion.error ? (
                    <span className="alert">{suggestion.error}</span>
                  ) : null}
                </span>
              </label>
            ))
          )}

          <div className="cluster">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApprove}
              disabled={executing || !canExecute}
            >
              {executing
                ? "Executing…"
                : hasFailed
                  ? `Retry selected (${selected.size})`
                  : `Approve selected (${selected.size})`}
            </button>
            <a className="btn" href="/reviews">
              Recent reviews
            </a>
          </div>
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          {results ? (
            <section className="execution-summary" aria-live="polite">
              <p className="notice" role="status">
                {summarizeExecution(results)} Open Ambiguous to see your records.
              </p>
              <ul className="execution-list">
                {results.map((item) => {
                  const suggestion = session.suggestions.find(
                    (candidate) => candidate.id === item.id,
                  );
                  return (
                    <li key={item.id}>
                      <strong>{suggestion?.title ?? "Tabme suggestion"}</strong>
                      {item.actionId ? <code>{item.actionId}</code> : null}
                      {item.resultUrl ? (
                        <a href={item.resultUrl} target="_blank" rel="noreferrer">
                          Open this task
                        </a>
                      ) : null}
                      {item.status === "skipped" ? (
                        <span className="meta">Already present in Ambiguous.</span>
                      ) : null}
                      {item.error ? <span className="alert">{item.error}</span> : null}
                    </li>
                  );
                })}
              </ul>
              <a className="btn" href="https://app.ambiguous.ai" target="_blank" rel="noreferrer">
                Open Ambiguous workspace
              </a>
            </section>
          ) : null}
        </section>

        <aside className="chat-panel" aria-labelledby="assistant-title">
          <h2 id="assistant-title">Ask Tabme</h2>
          <p className="meta">
            It can read this review. It cannot write without your page approval.
          </p>
          <CopilotChat
            className="ck-chat"
            labels={{
              welcomeMessageText: "Which tabs should become work?",
              chatInputPlaceholder: "Ask about this pile of tabs…",
            }}
          />
        </aside>
      </div>
    </main>
  );
}
