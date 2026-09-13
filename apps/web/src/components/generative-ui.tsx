"use client";

import { useComponent, useHumanInTheLoop } from "@copilotkit/react-core/v2";
import { z } from "zod";

export function GenerativeUI() {
  useComponent({
    name: "suggestion_card",
    description:
      "Draw one proposed Tabme action so the user can scan it without reading a paragraph.",
    parameters: z.object({
      headline: z.string().describe("The action in under twelve words."),
      summary: z.string().describe("Which tabs this comes from."),
      facts: z
        .array(z.object({ label: z.string(), value: z.string() }))
        .max(4)
        .default([]),
    }),
    render: ({ headline, summary, facts }) => (
      <article className="suggestion">
        <div />
        <div>
          <strong>{headline ?? "Suggested action"}</strong>
          <p className="meta">{summary}</p>
          {facts?.length ? (
            <p className="meta">
              {facts.map((fact) => `${fact.label}: ${fact.value}`).join(" · ")}
            </p>
          ) : null}
        </div>
      </article>
    ),
  });

  useComponent({
    name: "tab_stack",
    description:
      "Draw the captured tab pile as a compact stack. Call this when the user asks what is open.",
    parameters: z.object({
      titles: z.array(z.string()).max(12),
    }),
    render: ({ titles }) => (
      <div className="tab-rail" aria-label="Captured tabs">
        {(titles ?? []).map((title) => (
          <span className="tab-chip" key={title}>
            {title}
          </span>
        ))}
      </div>
    ),
  });

  useHumanInTheLoop({
    name: "propose_action",
    description:
      "Ask before anything that would write to a workspace. Call this first and only continue if it returns approval. Page approval still executes the write.",
    parameters: z.object({
      action: z.string().describe("What you are about to do, in one sentence."),
      blastRadius: z.string().describe("What this affects if it goes wrong."),
    }),
    render: ({ args, respond, result }) => {
      if (!respond) {
        return <p className="meta">{result ? String(result) : "Waiting…"}</p>;
      }
      return (
        <section aria-label="Confirm this action">
          <h3>{args.action ?? "Confirm this action"}</h3>
          <p className="meta">{args.blastRadius}</p>
          <div className="cluster">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                respond(
                  "Approved in chat. Still wait for Approve Selected on the page before claiming a write.",
                )
              }
            >
              Approve
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                respond(
                  "The user declined. Do not take the action and say nothing changed.",
                )
              }
            >
              Cancel
            </button>
          </div>
        </section>
      );
    },
  });

  return null;
}
