# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project: PanosG1138/work

Internal Greek-language poultry operations tools, hosted on GitHub Pages
(panosg1138.github.io/work). Backend: Supabase (oorhbrphdbigwgizejcc.supabase.co).
Two users: Panos and Ελένη.

## Tools
- index.html — landing page: a signed-in dashboard (one tile per rearing house: current flock, next vaccination, next feed change, next placement; plus this week's vaccinations and the next feed change) above the tool links. Its house list is its own (Θ7 hidden until it's built); the loading days and the house-empty day come from common.js (LOADING RULES), the feed rules from common.js (FEED RULES).
- vaccine_tracker.html — vaccine order tracking (ΕΜΒΟΛΙΑ), with an alternate house/cycle card view
- inventory.html — vaccine stock/inventory, bidirectionally linked to vaccine_tracker
- feed_tracker.html — feed/nutrition schedule tracking per breed and feed additives (Avidecoxx, Robenz) by day since hatch: house cards (now / next) + a timeline, editing in a folded "Edit flocks" table, and a "Sync from scheduler" button (each change confirmed)
- schedule_checker.html — rearing house hatch planner (one card per hatch, earliest-next suggestions, clashes between houses; Νεοσσοί = chicks placed, `placements.chicks`) — rules in `docs/rearing_scheduler.md`
- vaccine_tracker_beta.html — side-by-side BETA of the vaccine tracker (spec `docs/superpowers/specs/2026-11-06-hatch-programmes-and-bin-design.md`): tabs Εμβόλια · Εμβολιακά · Παραγγελίες · Κάδος. **Εμβολιακά** = one living εμβολιακό per scheduler hatch: its lines ARE the `emvolia` rows of the hatch (matched by `anath` + `hm_ekk`), created as draft lines (`emvolia.draft`) from the Βασικό εμβολιακό + each customer's usual injections, activated with Ενεργοποίηση, never locked; record per hatch in `hatch_plans` (Νεοσσοί, corrected customers — the scheduler is never written); ΕΝΕΣΙΜΑ round read from the `sxolia_panos` note ("ΠΡΩΤΑ/ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ Θx"); lines of a hatch with an εμβολιακό can't change hatch date or house in the edit window / batch edit. The sheet shows only its table; editing opens from header buttons: + Εμβόλιο and Νεοσσοί ✎ (small window; Νεοσσοί recalculates unordered lines, hand-typed quantities stay), «Ενέσιμα ημ. N» per round (injections window: customers from the εμβολιακό + ΥΠΟΛΟΙΠΑ, their usual injections pre-ticked the first time, «Πληρώνει κάποια εμβόλια» per customer, ΚΟΡΥΖΑ product per customer, OK writes the diff); rounding switch in the table where it fits; ordered lines only change or go after a warning (also in the edit window and delete box). The `placements_shift_hatch_rows` trigger moves a hatch's rows when its date or house changes in the scheduler (history user "Αυτόματα (αλλαγή εκκόλαψης)"). `vaccine_tracker.html` and `index.html` read only `draft=is.false`. Linked only from the tracker's 🧪 Beta button. **While it exists, any fix to vaccine_tracker.html must be made in the beta too.** It replaces the tracker at the switch.
- vaccine_programme.html — **Βασικό εμβολιακό**: the template every hatch's εμβολιακό starts from (`vaccine_programme`, `days` list per row), injectables per round (`injectables`, ΚΟΡΥΖΑ = a column whose product is picked per hatch), customers' usual injectables (`customer_injectables`, payer us/customer), default supplier per vaccine (`vaccines.supplier`); every change logged to `settings_history`. Design: `docs/superpowers/specs/2026-11-06-vaccine-planning-design.md`
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
Each HTML file has its own inline `<style>` and `<script>`, no JS imports. Two files are shared by all 9 pages: `theme.css` (CSS custom properties for the single dark GitHub-style theme — no light theme — plus the shared sign-in box and home/Έξοδος button styles) and `common.js` (below). Everything else that looks shared (small date-parsing helpers) is still copy-pasted into each tool by design, so a fix there must be applied per-file.

- **common.js** — shared by all 9 pages (design: `docs/superpowers/specs/2026-11-03-common-js-foundation-design.md`). Holds the Supabase connection (`SB_URL`, `SB_KEY`, `_sb`), `_authSession`, `sbFetch`, `userDisplayName`, `escapeHtml`, the language system (`t`, `tValue`, `addTranslations`, `translatePage`), VACCINE PLANNING (`customerName`, `CORYZA`, `CORYZA_PRODUCTS`, `planExact`, `planQty` — programme quantity = (chicks + extra_pct %) ÷ divide_by, rounded up to round_to 1.000/5.000/10.000), VACCINE NAMES (`resolveVaccineName` and the "Μήπως εννοείτε" question), LOADING RULES (`LOAD_START`, `PTINO_LOAD_START`, `LOAD_DAYS`, `emptyDay`), FEED RULES (`BREEDS`, `BREED_SCHEDULE`, `ADDITIVES`, `NO_ADDITIVES_HOUSES`, `toWeekday`), `focusFromLink` (dashboard-link highlight; its `.focus-glow` styles are in theme.css), the shared sign-in box and the sign-out icon · ΕΛ/EN · home (house icon + Αρχική, last and largest) buttons. Each page loads `<script src="common.js?v=N"></script>` right after supabase-js, has `<span id="common-nav"></span>` in its header (the homepage also has `<div id="common-signin">` for its inline box), and calls `startPage({ onSignedIn, onSignedOut })` as the **last line** of its script. `onSignedIn(name)` runs once per signed-in user — supabase re-sends SIGNED_IN on every tab refocus, and reloading then wiped highlights and reopened popups.
  - **Bump `?v=N` on all 9 pages in the same commit whenever common.js or theme.css changes** (`common.js?v=N`, `theme.css?v=N`; GitHub Pages lets browsers keep an old copy ~10 min).
  - One bug there breaks every page: test every page after changing it (check scripts: see the plan in `docs/superpowers/plans/`).
  - `feed_notify.yml` and `backup.py` (Python on GitHub) can't use it — their copies of rules stay duplicated.
  - **Language (ΕΛ/EN)**: pages are written in Greek; `t('Greek text', { n })` returns English when `LANG` is `'en'`. Fixed texts are tagged `data-t` / `data-t-title` / `data-t-placeholder` / `data-t-aria-label`; each page's English list is in its `// ── TRANSLATIONS ──` block (`addTranslations`), shared words in common.js. The choice is saved on the account (`user_metadata.lang`) and on the device (`localStorage.lang`). **Changing a Greek text means updating its English line too** — otherwise English shows the Greek. Never translated: vaccine names, breeds, houses, feed phase and additive names, people names, typed text. Pages with an English list pass `startPage({ translated: true })`; the two truck pages are Greek only (user's choice) — no switch, always Greek. Aviary is never translated. Design: `docs/superpowers/specs/2026-11-03-language-switch-design.md`.

- **Auth**: Supabase Auth (email/password), two accounts mapped to display names by `userDisplayName()` in common.js (`panos@internal.local` → Πάνος, `eleni@internal.local` → Ελένη). `startPage` in common.js gates the UI and triggers the page's initial data load.
- **Persistence pattern — list tools** (vaccine_tracker, inventory, schedule_checker): rows are read/written via direct PostgREST calls (`sbFetch` in common.js, wrapping `fetch` to `${SB_URL}/rest/v1/...`; a refusal throws with `.status`, an empty reply returns `null`). vaccine_tracker and inventory also log edits to a paired `*_history` table (`emvolia_history`, `inventory_history`) with `user_name`/`ts`/`changes_json`, used to render the changelog/history UI in edit modals. `emvolia.payer`: NULL = we pay, else the customer billed directly by the supplier (written by the beta's plan window; the old tracker leaves it alone). A delete is logged too (emvolia_history: action `deleted` with the row's last values; inventory_history: `posotita_after` empty) and history has no foreign key, so it outlives the deleted row; inventory_history also stores the vaccine name (`emvolio`). backup.py deletes history older than 6 months (user's choice); schedule_checker (`placements`) keeps no history. Follow the history convention for any new editable data.
- **Persistence pattern — calculator tools** (truck_calculator_*): a single pinned row (`id=1`, upserted via `resolution=merge-duplicates`), last-write-wins, no history. Don't conflate this with the list-tool pattern above.
- **"Flock"/cycle concept**: a rearing cycle is identified by *house + hatch date together*, not house alone (see `flockLabel()` in vaccine_tracker.html and the equivalent grouping in schedule_checker.html). The same house is reused across generations — anything that groups or displays "by house" needs to account for this or it will conflate unrelated flocks.
- **Automation** (`.github/workflows/`): `backup.yml` runs `backup.py` nightly, pulling every Supabase table to a Google Sheet via `gspread`. `feed_notify.yml` emails 7-day/3-day feed-change reminders and 3-day/1-day feed-additive start reminders — it re-implements the feed schedule tables (`SCHEDULES`, `BREED_SCHEDULE`) and the additive list (`ADDITIVES`) as a **separate copy** inline in the workflow YAML. If the feed rules in common.js (FEED RULES: breeds/phases, additives, aviaries) change, that copy has to be updated by hand or the reminders drift out of sync. Both apply the same weekend rule (Saturday → Friday, Sunday → Monday).

## Facility structure
Rearing houses: Θ1–Θ4 (cage), Θ5 (aviary), Θ7 (new aviary, planned — first hatch possible 25/10/2027). A1 is no longer used.
Full house rules, cycle timings and the Θ1/Θ2 and Θ4/Θ5 pairing live in `docs/rearing_scheduler.md`.
Exception: vaccine_tracker.html keeps A1 in its house lists (Θ1–Θ5 + A1) by the user's choice — check the specific file.

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
  VACCINE_OPTIONS caused a 404 → ReferenceError. common.js must always be committed together
  with the pages that use it, loaded by its plain relative path, and checked on every page.
- Vaccine names: the `vaccines` table (name primary key; read + insert only, plus UPDATE of the `supplier` column only — column grant) is the one
  correct spelling of each name. vaccine_tracker.html and inventory.html load it on start and
  send every saved name through `resolveVaccineName` (block "VACCINE NAMES" in common.js,
  shared by both files): a different typing is corrected silently (skeleton = capitals without
  spaces and - / . +), a typo within 1–2 changes asks "Μήπως εννοείτε", a new name asks to be
  added to the table. Removing a wrongly added name is done in the database by hand.
- Supabase access is locked to logged-in users: every tool signs in with
  Supabase Auth and sends the session token, so RLS policies must allow the
  `authenticated` role. The publishable key alone sees 0 rows on every
  table — keep it that way. Never add anon/public policies: that key is in
  the public page source. If a load/save silently returns nothing (200 with
  `[]` or 0 rows), check that table's `authenticated` policies first.
- <datalist> must be inside <body>, not floating outside it (caused a
  past bug).

## Code style
Clear names, a short comment saying what each block does and who uses it, `// ── NAME ──`
section banners — so code is easy to find by search and reference (especially in common.js,
where a page no longer shows its whole story in one file).

## Workflow
- I review every diff before commit.
- Test against the live file's actual functions, not reimplementations.
- Push only after I explicitly say so.
- Run /ponytail-review on every change before I confirm a commit.
