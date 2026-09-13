"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CopilotChat, useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { GenerativeUI } from "@/components/generative-ui";
import { ReviewControl } from "@/components/review-control";
import type { ReviewSession, Suggestion } from "@/lib/types";

export default function ReviewPage() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        });
        setSelected(
          new Set(
            data.suggestions
              .filter((item: Suggestion) => item.status === "pending_review")
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
    setResult(null);
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
      const completed = (data.results ?? []).filter(
        (item: { status: string }) => item.status === "completed",
      ).length;
      const failed = (data.results ?? []).filter(
        (item: { status: string }) => item.status === "failed",
      ).length;
      setResult(
        failed
          ? `Completed ${completed} actions. ${failed} failed.`
          : `Completed ${completed} actions.`,
      );
      const refresh = await fetch(`/api/suggestions/${reviewId}`);
      const next = await refresh.json();
      if (next.success) {
        setSession({
          reviewId: next.reviewId,
          tabs: next.tabs,
          suggestions: next.suggestions,
          createdAt: next.createdAt,
          status: next.status,
        });
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
        <p className="alert">{error ?? "This reviewId is not in memory. Capture tabs again."}</p>
        <a className="btn" href="/">
          Back to Tabme
        </a>
      </main>
    );
  }

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
                  disabled={session.status === "executed"}
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
                    {suggestion.type.replaceAll("_", " ")}
                    {suggestion.status !== "pending_review"
                      ? ` · ${suggestion.status}`
                      : ""}
                    {suggestion.actionId ? ` · ${suggestion.actionId}` : ""}
                  </span>
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
              disabled={
                executing || selected.size === 0 || session.status === "executed"
              }
            >
              {executing
                ? "Executing…"
                : `Approve selected (${selected.size})`}
            </button>
          </div>
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          {result ? (
            <p className="notice" role="status">
              {result}
            </p>
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
