# Simple Budget App — Build Plan

**Status: BUILT AND LIVE (2026-08-01) — awaiting Eric's checks on the S25 Ultra.**
**Live app: https://ericmiguelsoto.github.io/simple-budget/**

**Updates (2026-08-01):**
- Eric: phone-only, no desktop version. The app gets no desktop layout work;
  opened on a computer it will just show a phone-width column.
- Interactive mockup published for approval (fake numbers, nothing saves):
  https://claude.ai/code/artifact/bc822ff0-b956-427e-9995-6e001bab0758
- Small navigation change vs. the sketch below: bottom bar is Home / big
  add button / History; Settings moved behind the gear icon, top-right of
  Home. Faster thumb path to the add button.
- Mockup design direction ("ledger by lamplight"): dark bottle-green
  ground, cream text, brass money numbers; sage / ember / brick for
  on-track / near-limit / over-budget; each ledger row's ruled line fills
  as its budget is spent. System fonts (matches the zero-dependency build).
- **Eric approved the aesthetic** and changed the budget model: ONE total
  monthly budget instead of per-category targets. Categories are now just
  labels on expenses; Home's category rows show "where it went" (each
  line fills as its share of the monthly budget). Only the TOTAL can go
  over — the big brass number goes brick/negative. Decisions 5, 7, 8 and
  Phase 3 below are updated to match; the mockup is the visual spec.
- Target device: Samsung Galaxy S25 Ultra (SM-S938W) — Android, Chrome.
  PWA install = Chrome's "Add to Home screen" (installs a real WebAPK);
  maskable icons and theme-color matter most. Minimal iPhone tags stay in
  (harmless) but Android is the platform we verify on.

## What we're building

A tiny installable phone app with one job: show how much of this month's budget
is left. Enter an expense in under 5 seconds, glance at the home screen to see
spent vs. target per category and total remaining. All data stays in the
phone's browser storage. No accounts, no server, USD only.

Out of scope (agreed): debt tracking, multi-currency, income tracking, charts,
cloud sync, notifications.

---

## Decisions I made, and why (plain language)

1. **The app's code lives in a `docs/` folder.** GitHub Pages (the free
   hosting we're using) can only publish the repo root or a folder literally
   named `docs`. Using `docs/` keeps app code separate from planning files
   like this one. Quirky name, real constraint.

2. **The GitHub repo will be public.** Free GitHub accounts can only use
   Pages on public repos. Only the app's code is public — your spending data
   never leaves your phone (it lives in your browser's storage, not in the
   repo).

3. **Money is stored as whole cents (integers), never decimals.** Computers
   store decimal numbers imperfectly (0.1 + 0.2 comes out as
   0.30000000000000004). Whole cents are always exact. We only turn cents
   into "$12.34" at display time.

4. **Dates are stored as plain text like `2026-08-01`, and months as
   `2026-08`.** Doing calendar math with text keys avoids timezone bugs that
   bit us in the tech-advance app.

5. **One storage key holds everything.** A single JSON blob in localStorage
   (the browser's small built-in storage). Roughly:

   ```
   {
     "schemaVersion": 1,
     "monthlyBudgetCents": 80000,
     "categories": [ { id, name, archived } ],
     "expenses":   [ { id, amountCents, categoryId, note, date } ]
   }
   ```

6. **Deleting a category "archives" it instead of erasing it.** It vanishes
   from the entry form and home screen, but past months' history still knows
   its name. Erasing it would orphan old expenses.

7. **Budget math (updated 2026-08-01):** one total monthly budget, set in
   Settings. Remaining = monthly budget − everything spent this month.
   Categories have no individual targets — they're labels answering
   "where did it go".

8. **History shows what you spent, not the old budget number.** The budget
   changes over time; we don't store a snapshot of it per month. History =
   per-month spending totals with a per-category breakdown.

9. **The service worker is "network-first."** A service worker is the small
   background script that makes the app work offline by caching files. The
   tech-advance app taught us a hard lesson: cache-first workers can trap
   your phone on a broken version. Network-first means: when online you
   ALWAYS get the newest version; the cache is only used when offline.
   Slightly slower on open, immune to the poisoned-cache trap.

10. **Zero dependencies, zero build step.** No npm packages, no frameworks.
    System fonts, hand-inlined SVG icons (no emojis). Tests use Node's
    built-in test runner (`node --test`) — nothing to install.

11. **Backup/restore buttons (small addition to your spec).** localStorage
    can be wiped by clearing browser data or uninstalling the app. An
    "Export backup" button downloads your data as a small file;
    "Import" restores it. It's manual — not cloud sync — and it's cheap
    insurance. Veto it if you want it gone.

12. **Fixing typos must be possible.** A $210.00 entry that should have been
    $21.00 would silently wreck your month. Home screen gets a "this month"
    expense list; tap an entry to edit or delete it.

---

## The screens

```
 HOME (the 95% screen)          ADD EXPENSE (slides up)
 ┌─────────────────────┐        ┌─────────────────────┐
 │ August 2026         │        │ Amount   [ 24.50 ]  │  ← keypad opens
 │                     │        │                     │    automatically
 │   $612.50           │        │ [Groceries] [Random]│  ← tap one
 │   left of $1,200    │        │                     │
 │ ▓▓▓▓▓▓▓▓░░░░░░░     │        │ Date  [Aug 1]  ←today
 │                     │        │ Note  [optional]    │
 │ Where it went       │        │                     │
 │ Groceries $310 ▓▓▓░░│        │ [      Save       ] │
 │ Random  $277.50 ▓▓░░│        └─────────────────────┘
 │                     │
 │                     │        Amount → tap category →
 │ This month          │        Save. Under 5 seconds.
 │ · Aug 1  Beans $4.50│
 │ · ...               │
 │              ( + )  │
 ├─────────────────────┤
 │ Home  History  Setup│  ← bottom tabs
 └─────────────────────┘
```

- **History:** one row per past month ("Jul 2026 — $1,134 spent"), tap to
  expand the per-category breakdown. Will look sparse until September — it
  only knows months you've actually tracked.
- **Settings:** one monthly-budget field; category list (add / rename /
  archive); Export / Import backup.
- Look and feel: dark, mobile-first, big type for the money numbers,
  thumb-reach controls at the bottom. No emojis.

---

## How we verify (no Playwright — your standing rule)

- **Logic** (money parsing, month grouping, summaries): unit tests run with
  `node --test`. Written BEFORE the code they test, so we know they can fail.
- **Visuals:** after each phase I push, the live site updates in ~1 minute,
  and I tell you exactly what to open and what to look for on your phone.
- A stop-hook (small script that runs automatically when I claim I'm done)
  will block me from finishing while any unit test fails.

---

## Build phases

Each phase ends deployed. You test on your phone, say "works", I commit any
fixes and move on. If something breaks mid-phase: stop, re-plan, no pushing
through (your rule).

### Phase 0 — Repo, safety hooks, live placeholder page
- [x] `git init`, set your git identity (ericmiguelsoto@gmail.com)
- [x] Folder structure: `docs/` (app), `tests/`, `tools/`, `.claude/hooks/`
- [x] Copy `block-destructive.sh` hook from tech-advance-app (blocks
      dangerous commands before they run); write a small stop-hook that runs
      `node --test` so I can't claim "done" with failing tests
- [x] Placeholder `docs/index.html` ("Budget — under construction")
- [x] Create public GitHub repo `simple-budget` with `gh`, push, turn on
      Pages (main branch, `/docs` folder)
- [x] **Your check:** `https://ericmiguelsoto.github.io/simple-budget/`
      loads on your phone. Bookmark it.

### Phase 1 — Money and month logic, tests first
- [x] Write failing tests: dollars→cents parsing ("12", "12.3", "$1,234.56",
      junk input), cents→"$1,234.56" formatting, month keys, this-month
      filtering, per-category totals, remaining-budget math, history grouping
- [x] Run `node --test` — confirm they FAIL (nothing exists yet; proves the
      tests are real)
- [x] Build `docs/js/logic.js` (pure calculation functions) until all pass
- [x] Build `docs/js/storage.js` (load/save/seed localStorage; seeds
      categories **Groceries** and **Random** on first run)
- [x] Commit. **Your check:** none — I'll show you the passing test output.

### Phase 2 — Home screen + quick entry (the core loop)
- [x] `docs/index.html` — real structure: three views, bottom tabs, + button
- [x] `docs/css/styles.css` — dark mobile-first layout
- [x] `docs/js/app.js` — render Home from storage; add-expense sheet with
      auto-focused amount field (numeric keypad pops immediately), category
      chips, today-by-default date, optional note
- [x] Deploy. **Your check:** add a real expense start-to-finish in under
      5 seconds; numbers on Home are right; kill the tab, reopen — still
      there. (Budget targets are still $0 until Phase 3, so Home shows
      spending without "remaining" — expected.)

### Phase 3 — Settings + fixing mistakes
- [x] Settings view: single monthly-budget field (typed as dollars, stored
      as cents); add / rename / archive categories
- [x] Home: "This month" expense list; tap an entry → edit or delete
- [x] Deploy. **Your check:** set your real monthly budget; Home now shows
      "left of $X" correctly; fat-finger an expense, fix it by tapping it.

### Phase 4 — Make it installable (PWA)
- [x] `manifest.webmanifest` — app name, colors, standalone display
- [x] App icons generated by a small Node script in `tools/` (geometric
      mark, no downloads, no emoji)
- [x] `docs/sw.js` — network-first service worker, versioned cache, offline
      fallback; safe-area padding; maskable icon + theme-color (Android
      launcher/status bar); minimal iPhone tags kept as a harmless extra
- [x] Deploy. **Your check (on the S25 Ultra):** install FROM THE REAL URL
      via Chrome menu → "Add to Home screen". Open it, add an expense, then
      airplane mode → open again — it still works.

### Phase 5 — History + backup
- [x] History view: month rows, tap to expand category breakdown
- [x] Settings: Export backup (downloads a JSON file) / Import (restores it)
- [x] Deploy. **Your check:** history shows August; export a backup, delete
      an expense, import — it's back.

### Phase 6 — Polish + wrap-up
- [x] Empty states (no expenses yet, no targets yet), over-budget styling,
      spacing/typography pass
- [x] Update CLAUDE.md with final structure; write the review section below;
      final lessons into tasks/lessons.md
- [ ] Deploy. **Your check:** daily-driver sign-off. ← THE ONLY OPEN ITEM

---

## Questions for you (only two)

1. **Repo name = app URL.** Default is `simple-budget` →
   `ericmiguelsoto.github.io/simple-budget/`. Want a different name?
2. **Approve this plan?** Say the word (or tell me what to change) and I
   start Phase 0. Nothing gets built before that.

---

## Review (2026-08-01)

**What was built:** everything in the plan, in one build session, live at
https://ericmiguelsoto.github.io/simple-budget/ — repo
https://github.com/ericmiguelsoto/simple-budget (public, Pages from
main:/docs). Six commits, one per phase.

**What changed from the plan, and why:**
- Budget model switched to ONE monthly total (Eric's call during mockup
  review); categories are labels on expenses only.
- History view and expense edit/delete shipped early (Phase 2 instead of
  5 and 3) — they reuse the same rendering/sheet code, so building them
  together was less code than stubbing them.
- Bottom bar became Home / add / History with Settings behind the gear
  (from the approved mockup).
- `node --test tests/` fails on this machine (treats the dir as a module,
  likely the space in the project path) — bare `node --test` everywhere,
  including the stop hook.

**Verification:** 35 unit tests (written first, watched fail, then pass)
covering money parsing/formatting, month math, summaries, history
grouping, and storage corruption recovery; JS syntax checks; all
referenced asset paths exist; icons visually verified; live URL checks.
Visual/phone verification is Eric's, per his no-Playwright rule.

**Still open:** Eric's daily-driver sign-off on the S25 Ultra (install,
add real expenses, set his real budget).
