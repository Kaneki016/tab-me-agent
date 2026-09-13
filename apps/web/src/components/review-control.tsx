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
      tabs: session.tabs.map((tab) => ({
        title: tab.title,
        url: tab.url,
        status: tab.status,
      })),
      suggestions: session.suggestions.map((suggestion) => ({
        id: suggestion.id,
        type: suggestion.type,
        title: suggestion.title,
        description: suggestion.description ?? "",
        status: suggestion.status,
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

  return null;
}
