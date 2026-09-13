"use client";

import { useAgentContext, useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import type { ReviewSession } from "@/lib/types";

export function ReviewControl({ session }: { session: ReviewSession }) {
  useAgentContext({
    description:
      "The Tabme review currently on screen. CRITICAL: proposing in chat does not save anything. Only Approve Selected on the page executes. Never invent tabs or record links.",
    value: {
      reviewId: session.reviewId,
      status: session.status,
      source: session.source ?? "heuristic",
      tabs: session.tabs.map((tab) => ({
        title: tab.title,
        url: tab.url,
        status: tab.status,
      })),
      suggestions: session.suggestions.map((suggestion) => ({
        id: suggestion.id,
        type: suggestion.type,
        category: suggestion.category ?? "follow_up",
        title: suggestion.title,
        description: suggestion.description ?? "",
        status: suggestion.status,
        mode: suggestion.mode ?? null,
      })),
    },
  });

  useFrontendTool(
    {
      name: "summarize_tabs",
      description:
        "Return the captured tabs already visible on this review. Read-only.",
      parameters: z.object({}),
      handler: async () => ({
        reviewId: session.reviewId,
        tabs: session.tabs,
      }),
    },
    [session],
  );

  useFrontendTool(
    {
      name: "search_web",
      description:
        "Search the public web for grounded answers. Read-only; does not write anywhere.",
      parameters: z.object({
        query: z.string().describe("Natural-language search query."),
        results: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("How many results to return."),
      }),
      handler: async ({ query, results }) => {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, results }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          return data.error || "Web search is not available.";
        }
        return data.results;
      },
    },
    [],
  );

  return null;
}
