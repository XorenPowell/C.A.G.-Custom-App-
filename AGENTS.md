<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Design matters now

The original build spec said "function over aesthetics, plain, dense, fast."
That was right for getting the thing working. It is no longer the brief.

The app is a daily-use sales tool, so layout and density are the product, not
decoration. When building a screen:

- **Match `design/mockup/` where it covers the screen.** It is the agreed
  layout, not a loose reference. Two-column grids, header actions, column
  sets and pill rows should match it.
- **Pair related panels side by side on desktop** (`grid md:grid-cols-2`).
  Stacking everything in one column wastes half a widescreen and pushes the
  useful thing below the fold.
- **Filters apply as you type.** A filter form with an Apply button costs a
  round trip for every adjustment.
- **Mobile is not a fallback.** Pill rows scroll sideways rather than
  wrapping; wide tables become cards under `md`.
- Still true: no animation, no decoration that carries no information.
