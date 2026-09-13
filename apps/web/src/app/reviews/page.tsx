"use client";

import { useEffect, useState } from "react";

type ReviewSummary = {
  reviewId: string;
  createdAt: string;
  status: string;
  tabCount: number;
  suggestionCount: number;
  source: string;
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/reviews");
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Could not load reviews.");
        setReviews(data.reviews ?? []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load reviews.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="shell stack">
      <header className="topbar">
        <a className="wordmark" href="/">
          Tabme
        </a>
        <a className="btn" href="/">
          Back
        </a>
      </header>

      <section>
        <h1 className="page-title">Recent reviews</h1>
        <p className="lede">
          Lost the popup link? Pick a recent capture and reopen the review page.
        </p>
      </section>

      {loading ? <p className="meta">Loading…</p> : null}
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && reviews.length === 0 ? (
        <p className="empty">
          No reviews yet. Capture tabs or{" "}
          <a href="/">start a sample review</a>.
        </p>
      ) : null}

      {!loading && reviews.length > 0 ? (
        <ul className="review-list">
          {reviews.map((review) => (
            <li key={review.reviewId}>
              <a href={`/review/${review.reviewId}`} className="review-link">
                <strong>{review.reviewId}</strong>
                <span className="meta">
                  {review.tabCount} tabs · {review.suggestionCount} suggestions ·{" "}
                  {review.source} · {review.status}
                </span>
                <span className="meta">{new Date(review.createdAt).toLocaleString()}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
