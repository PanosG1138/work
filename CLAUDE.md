# Project: PanosG1138/work

Internal Greek-language poultry operations tools, hosted on GitHub Pages
(panosg1138.github.io/work). Backend: Supabase (oorhbrphdbigwgizejcc.supabase.co).
Two users: Panos and Ελένη.

## Tools
- vaccine_tracker.html — vaccine order tracking (ΕΜΒΟΛΙΑ)
- inventory.html — vaccine stock/inventory, bidirectionally linked to vaccine_tracker
- feed_tracker.html — feed tracking
- schedule_checker.html — rearing house scheduling + conflict detection
- index.html — landing page linking all tools

## Facility structure
Five rearing houses: Θ1, Θ2, Θ3, Θ4, Θ5. Θ4 has a linked sub-house A1.
Θ1/Θ2 are a linked pair — never conflict with each other on any event type,
must always move together (5–14 day gap maintained). A1/Θ4 conflicts with
each other are exempt.

## Design principles (non-negotiable)
1. No frameworks, no build tools — plain HTML/CSS/JS only
2. Surgical changes only — minimal, focused diffs, no speculative edits
3. One way to do things — no fallbacks, no alternate code paths
4. Fail fast — throw errors when preconditions aren't met, don't swallow them
5. Every significant change gets a full audit afterward
6. Detective method: theory → evidence → fix. Never guess.
7. No dead code, no backups of logic "just in case"

## Known gotchas
- Shared JS files are risky here: a previous shared.js approach for
  VACCINE_OPTIONS caused a 404 → ReferenceError. Vaccine list is now
  defined inline in both HTML files (commented as duplicated-by-design).
- All Supabase tables need explicit anon_all RLS policies + grants for the
  anon key to work — check this first if a save/load silently fails.
- <datalist> must be inside <body>, not floating outside it (caused a
  past bug).

## Workflow
- I review every diff before commit.
- Test against the live file's actual functions, not reimplementations.
- Push only after I explicitly say so.
- Run /ponytail-review on every change before I confirm a commit.
