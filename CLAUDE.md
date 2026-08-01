# Simple Budget App

One-job personal expense tracker PWA: show this month's spending vs. budget
and what's left. Quick entry (amount, category, optional note, date), ONE
total monthly budget (categories are just labels on expenses — no
per-category targets), month history. All data in the browser's localStorage
— no accounts, no backend, USD only. Separate from and much smaller than
Eric's other apps. Runs on Eric's Samsung Galaxy S25 Ultra (SM-S938W):
Android Chrome is the install path and the platform we verify on.

Explicitly out of scope: debt tracking, multi-currency, income tracking,
charts, cloud sync, notifications.

## Status

Planning. The approved build plan lives in `tasks/todo.md`. No app code yet.

## Stack (deliberately tiny — do not add to it)

- Vanilla HTML/CSS/JS. No frameworks, no npm dependencies, no build step.
- Data: single localStorage key holding one JSON blob (`schemaVersion`,
  `monthlyBudgetCents`, `categories`, `expenses`). Money is ALWAYS integer
  cents in code; format to dollars only at display time. Dates are
  `YYYY-MM-DD` strings, months `YYYY-MM`.
- PWA: `manifest.webmanifest` + network-first service worker (`docs/sw.js`).
  Network-first is a deliberate safety choice — see the PWA lessons in
  `tasks/lessons.md` before touching the worker.
- Hosting: GitHub Pages serving the `docs/` folder (repo `simple-budget`,
  public). All asset paths must be relative — the site lives under
  `/simple-budget/`, not at the domain root.
- Tests: Node's built-in runner (`node --test tests/`) over the pure logic
  in `docs/js/logic.js`. No test frameworks.

## Structure

- `CLAUDE.md` — this file
- `tasks/todo.md` — current plan and progress; `tasks/lessons.md` — gotchas
- `docs/` — the deployed app (GitHub Pages can only serve root or `docs/`)
  - `index.html`, `css/styles.css`
  - `js/logic.js` (pure functions), `js/storage.js` (localStorage),
    `js/app.js` (UI wiring)
  - `sw.js`, `manifest.webmanifest`, `icons/`
- `tests/` — unit tests for logic
- `tools/` — one-off dev scripts (icon generation)

## Rules for this repo

- Follow the `eric-coding-style` skill: plan in `tasks/todo.md` and get
  approval before building, mark progress as you go, verify before claiming
  done, log corrections in `tasks/lessons.md`.
- No Playwright. Logic is verified by unit tests; visuals are verified by
  Eric on his phone against the deployed URL (tell him exactly what to open
  and what to look for).
- No emojis in the app UI. Icons are inline SVG.
- Phone-only (Eric's call, 2026-08-01). No desktop layout work — on a
  computer the app just renders as a phone-width column. Approved visual
  direction lives in the mockup artifact linked from tasks/todo.md.
- Eric is a beginner: explain each new concept briefly as it first comes up.
- When Eric confirms something works, commit and push without re-asking.
  After every push, update CLAUDE.md / tasks files if anything changed.
