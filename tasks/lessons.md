# Lessons

Gotchas and rules discovered while building. Append whenever something
surprising costs time, and after every deployment. Review at session start.

## Carried over from tech-advance-app and Trading (2026-08-01)

These earned their place the hard way in Eric's other projects and apply
directly to this stack (PWA + service worker + Windows dev machine):

- **Never deploy broken code to "test on phone".** A service worker caches
  every deployed bundle; reverting the source does NOT fix a phone that
  already cached the broken version. Multiple bad deploys compound it. This
  app uses a network-first worker to blunt the risk, but the rule stands:
  verify locally (unit tests + local server check) before every push.
- **A PWA is pinned forever to the origin it was installed from.** Only
  install from the final GitHub Pages URL — never from a preview or
  temporary URL.
- **Android "Clear cache" does NOT clear service-worker CacheStorage.**
  Real reset: Chrome → Settings → Privacy → Clear browsing data → "Cookies
  and site data" + "Cached images and files". (Warning: for THIS app that
  also wipes the budget data in localStorage — export a backup first.)
- **Date math with `Date` objects lies across timezones/times of day.**
  Compare calendar days as text (`YYYY-MM-DD`, month keys `YYYY-MM`), never
  via `new Date()` subtraction.
- **Windows orphans backgrounded dev servers.** Killing the wrapper leaves
  node grandchildren holding the port. Before starting a local server for a
  check, kill existing listeners on that port and curl-verify the response
  before handing the check to Eric.
- **Run tests from `C:\...` (uppercase drive letter).** A lowercase `c:\`
  cwd once made Node treat the same file as two different modules.
- **Fat-fingered magnitudes look fine in derived numbers.** A $210.00 typo
  for $21.00 reads as "spent more" everywhere. This is why expenses are
  editable/deletable from Home — and why totals should be eyeballed against
  gut feel after entry.
- **Never claim a visual fix worked without actually seeing it.** Eric
  checks visuals on his phone. "I can't tell — can you check?" is always
  acceptable. Guessing dressed up as verification is not.
- **When "prod" misbehaves but every audit passes, confirm which URL is in
  the user's address bar** before digging deeper. One wrong-origin PWA cost
  an entire investigation (2026-07-31).

## This project

- **When every view is a time filter, check what falls outside ALL of them**
  (2026-08-01). Home shows the current month; History shows past months; a
  future-dated expense matched neither and silently vanished until its
  month arrived. Found while answering Eric's "does it reset monthly?"
  question, fixed by capping the date picker at today. Rule: for any
  filtered view, ask "where does data go that no filter matches?"
- **`node --test tests/` fails on this machine — use bare `node --test`**
  (2026-08-01). With a directory argument, Node 24 throws MODULE_NOT_FOUND
  ("Cannot find module ...\tests"), likely because of the space in the
  project path. Bare `node --test` discovers tests/*.test.js fine. The
  stop hook and package.json both use the bare form.
- **App icons are generated, not designed by hand** (2026-08-01).
  `tools/make-icons.mjs` draws them pixel-by-pixel and encodes PNGs with
  only node:zlib — no image libraries on this machine needed. Verify the
  output visually by Reading the PNG (the Read tool renders images).
- **Eric thinks in one monthly total, not per-category envelopes**
  (2026-08-01, from the mockup review). The per-category-targets layout
  confused the app's only user — he expected a single monthly budget with
  categories as mere labels on expenses. The model was changed to match.
  Rule: when a design decision adds a concept Eric didn't ask for, default
  to the simplest mental model and let him ask for more.
