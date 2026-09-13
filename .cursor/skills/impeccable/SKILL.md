---
name: impeccable
description: Use when designing, redesigning, shaping, critiquing, auditing, polishing, or otherwise improving Tabme UI — the Chrome extension popup, review page, landing page, empty/error states, typography, color, motion, or copy. Also use when the user mentions Impeccable, /impeccable, design quality, visual hierarchy, or anti-patterns. Not for backend-only or non-UI tasks.
---

# Impeccable for Tabme

Design quality for this repo follows [Impeccable](https://github.com/pbakaus/impeccable). Do not invent a generic SaaS look.

Install or refresh the full engine when needed:

```bash
npx impeccable install --providers=cursor --scope=project
```

Then `/impeccable init` writes durable product truth into `PRODUCT.md`. Visual direction lives in `DESIGN.md`. Full docs: https://impeccable.style

## When to apply

Read this skill before any Tabme UI work: `apps/web` pages and CSS, `apps/extension` popup, generative cards, empty/error/loading states.

Mode for Tabme surfaces is **Operate**: scanability and an obvious approve/reject path outrank decoration.

## Craft floor

- Contrast: body text ≥4.5:1. On colored surfaces, tint secondary text from that hue — never gray-on-color.
- Type: no Inter, Arial, or system-ui as the display voice. Tabme uses Fraunces + Figtree + IBM Plex Mono. Body measure 65–75ch.
- Depth: shadows have offset and blur. No zero-offset colored glow.
- Spacing: tight groups, generous separation, more space above a heading than below it.
- States: hover, disabled, loading, error, empty, keyboard focus. Theme selection, caret, and focus rings.
- Copy: controls name the action; errors name the problem and the recovery.
- Motion: one authored moment, exponential ease-out, already-visible default.

## Refuse unless the brief earns it

- Nested cards, or a page made of identical icon+heading+text cards
- Purple-to-blue gradients, gradient text, glass as decoration
- Eyebrow/kicker labels above headings
- Pure black or untinted gray
- Bounce/elastic easing
- Unicode glyphs standing in for an icon system
- Chat text treated as approval — Tabme writes only after a page click

## Commands

If the full Impeccable skill/engine is installed, route `/impeccable <command>` there. Otherwise apply the matching intent here:

| Command | Intent on Tabme |
|---|---|
| `init` | Update `PRODUCT.md` only with durable product truth |
| `document` | Refresh `DESIGN.md` from current CSS/components |
| `shape` | Plan the review or popup before coding |
| `critique` / `audit` / `polish` | Hierarchy, a11y, shipping readiness |
| `clarify` | Extension and review copy |
| `onboard` | First capture, empty review, sample-tabs path |

## Project pointers

- Product truth: [PRODUCT.md](../../../PRODUCT.md)
- Visual world: [DESIGN.md](../../../DESIGN.md)
- Upstream: https://github.com/pbakaus/impeccable
