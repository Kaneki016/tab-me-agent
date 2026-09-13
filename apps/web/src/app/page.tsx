"use client";

import { useState } from "react";
import { SAMPLE_TABS } from "@/lib/tabs";

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSampleReview() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabs: SAMPLE_TABS }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        reviewId?: string;
        error?: string;
      };
      if (!response.ok || !data.reviewId) {
        throw new Error(data.error || "Could not start a sample review.");
      }
      window.location.href = `/review/${data.reviewId}`;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start a sample review.");
      setBusy(false);
    }
  }

  return (
    <main className="shell stack">
      <header className="topbar">
        <a className="wordmark" href="/">
          Tabme
        </a>
        <span className="status-pill">Approve first</span>
      </header>

      <section>
        <h1 className="page-title">Turn a messy window into a short list you still control.</h1>
        <p className="lede">
          Tabme captures the tabs already open, proposes a few actions, and waits.
          Nothing is written until you approve it on the review page.
        </p>
      </section>

      <div className="cluster">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={startSampleReview}
        >
          {busy ? "Preparing…" : "Review sample tabs"}
        </button>
        <a className="btn" href="#setup">
          Load the extension
        </a>
        <a className="btn" href="/reviews">
          Recent reviews
        </a>
      </div>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      <section id="setup" className="stack">
        <h2>How a review starts</h2>
        <p className="lede">
          Person 1 ships the Chrome extension. Person 2 ships this review app.
          Both talk to the same APIs on port 3100.
        </p>
        <ol>
          <li>Load <code>apps/extension</code> unpacked in Chrome.</li>
          <li>Click Capture Tabs. Unsupported pages stay as title and URL only.</li>
          <li>Open the review link, check the suggestions you want, then Approve Selected.</li>
        </ol>
      </section>
    </main>
  );
}
