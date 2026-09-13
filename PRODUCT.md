# Tabme

Durable product truth for Impeccable and coding agents. Visual direction is in [DESIGN.md](DESIGN.md), not here.

## Audience

Individual knowledge workers and researchers who already have too many browser tabs open. They are comfortable with a Chrome extension and an AI assistant, and they do not trust tools that act without asking.

## Purpose

Turn the current browser window into a short list of proposed actions, then wait. Tabme captures tabs, suggests work, and executes only what the user explicitly approves on the review page.

## Operating context

- Chrome extension popup for capture (Person 1)
- Local web review at `http://127.0.0.1:3100` (Person 2)
- Optional in-page CopilotKit assistant that can see the review
- Optional Ambiguous AI workspace for one real `create_task` write
- Hackathon demo: one complete capture → review → approve loop in under three minutes

## Constraints

- Never auto-execute. Chat assent is not approval.
- Minimal extension permissions. Skip `chrome://` and similar pages.
- Scrape at most three public pages; keep title and URL if scrape fails.
- Sessions persist locally for 24 hours (capped). Do not invent a cloud store.
- Do not invent workplace record links. Only show IDs/URLs returned by Ambiguous.

## Voice

Direct, brief, slightly editorial. Name the action. Do not sound like a generic copilot or a productivity SaaS.

## Evidence

A successful run shows: captured tab count, 3–5 task suggestions, an approval click, and returned Ambiguous task IDs or links.
