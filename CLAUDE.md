# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project: PanosG1138/work

Internal Greek-language poultry operations tools, hosted on GitHub Pages
(panosg1138.github.io/work). Backend: Supabase (oorhbrphdbigwgizejcc.supabase.co).
Two users: Panos and Ελένη.

## Tools
- index.html — landing page linking all tools
- vaccine_tracker.html — vaccine order tracking (ΕΜΒΟΛΙΑ), with an alternate house/cycle card view
- inventory.html — vaccine stock/inventory, bidirectionally linked to vaccine_tracker
- feed_tracker.html — feed/nutrition schedule tracking per breed
- schedule_checker.html — rearing house scheduling + conflict detection (placement/vaccination/loading)
- truck_calculator_kamposos.html / truck_calculator_doukakis.html — truck+trailer loading calculators for two separate facilities
- backup.py — nightly Supabase → Google Sheets backup, run by `.github/workflows/backup.yml`

## Commands
No build step, no package manager, no test suite, no linter — that's deliberate (see Design principles). Practical commands actually used when working here:
- Local preview: `python -m http.server 8080` from the repo root, then open the page in a browser.
- Syntax-check a file's inline JS after editing (nothing else will catch a typo before it ships): extract the `<script>` contents and run `node --check` against them, e.g.
  ```
  python -c "import re; open('x.js','w',encoding='utf-8').write('\n'.join(s for s in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', open('FILE.html',encoding='utf-8').read(), re.S) if 'supabase.min.js' not in s))"
  node --check x.js
  ```
- Deploy: push to `main` — GitHub Pages serves the repo directly, no build/publish step.

## Architecture
Each HTML file is fully self-contained: inline `<style>` and `<script>`, no JS imports, no shared JS files between tools (see gotcha below). `theme.css` (CSS custom properties for the dark/light GitHub-style theme) is the *only* thing actually shared across files — everything else that looks shared (Supabase client setup, auth, date-parsing helpers, theme-toggle logic, `VACCINE_OPTIONS`) is copy-pasted independently into each tool by design, so a fix in one file does not propagate and must be applied per-file if it applies elsewhere.

- **Auth**: Supabase Auth (email/password), two accounts mapped to display names via a per-file `emailToDisplayName()` (`panos@internal.local` → Πάνος, `eleni@internal.local` → Ελένη). `onAuthStateChange` gates the UI and triggers the initial data load.
- **Persistence pattern — list tools** (vaccine_tracker, inventory, schedule_checker): rows are read/written via direct PostgREST calls (`sbFetch` wrapping `fetch` to `${SB_URL}/rest/v1/...`), and edits are logged to a paired `*_history` table (`emvolia_history`, `inventory_history`) with `user_name`/`ts`/`changes_json`, used to render the changelog/history UI in edit modals. Follow this convention for any new editable data.
- **Persistence pattern — calculator tools** (truck_calculator_*): a single pinned row (`id=1`, upserted via `resolution=merge-duplicates`), last-write-wins, no history. Don't conflate this with the list-tool pattern above.
- **"Flock"/cycle concept**: a rearing cycle is identified by *house + hatch date together*, not house alone (see `flockLabel()` in vaccine_tracker.html and the equivalent grouping in schedule_checker.html). The same house is reused across generations — anything that groups or displays "by house" needs to account for this or it will conflate unrelated flocks.
- **Automation** (`.github/workflows/`): `backup.yml` runs `backup.py` nightly, pulling every Supabase table to a Google Sheet via `gspread`. `feed_notify.yml` emails 7-day/3-day feed-change reminders — it re-implements the feed schedule tables (`SCHEDULES`, `BREED_SCHEDULE`) as a **separate copy** inline in the workflow YAML. If `feed_tracker.html`'s schedules change, that copy has to be updated by hand or the reminders drift out of sync.

## Facility structure
Five rearing houses: Θ1, Θ2, Θ3, Θ4, Θ5. Θ4 has a linked sub-house A1.
Θ1/Θ2 are a linked pair — never conflict with each other on any event type,
must always move together (5–14 day gap maintained). A1/Θ4 conflicts with
each other are exempt.
This is schedule_checker's/feed_tracker's house list — vaccine_tracker.html's own dropdown is narrower (Θ1–Θ4 + A1, no Θ5). Check the specific file's own house list rather than assuming every tool covers the same set.

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
