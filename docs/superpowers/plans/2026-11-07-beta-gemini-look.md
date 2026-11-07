# Beta tracker — Gemini-inspired look on the classic layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give `vaccine_tracker_beta.html` the look of Gemini's "Executive Grid" proposal (user's file `Desktop\option_1a_executive_grid_app.html`) without losing any core behaviour of the beta.

**Backup:** git tag `beta-ui-classic-graphite` (commit 70e317c, pushed) = the beta before this change. Revert only on the user's word: `git checkout beta-ui-classic-graphite -- vaccine_tracker_beta.html` + commit.

## Decisions (user, 2026-11-07: "go ahead with your recommendations")

- **Summary strip (A):** one slim row of clickable cards, not Gemini's tall cards: «Παραγγελίες που αργούν» (red when > 0), «Επόμενες 7 ημέρες», «Στο ψυγείο», «Σύνολο πουλάδων» (εμβολιακά of the houses now in rearing). A click filters the table to those lines; a second click clears it.
- **Rows (A):** one line per row, every current column kept (all information at a glance).
- **Step track (A):** the three dot columns Παρ. / Ψυγ. / Εμβ. become one «Πορεία» cell with three pills: **Παραγγελία** and **Ψυγείο** clickable (one click, same rules as the edit window: newer-version check, which alternative arrived on fridge, history), **Εμβολιασμός** display only (set automatically 6 days after the date when ordered + in fridge; hand override stays in the edit window). FAENTINA orders keep magenta. No cascades.
- From Gemini also: house pills above the table (Θ1–Θ5 with the current hatch's age; red when an order is late in that house, amber when an order is due within 7 days), late rows highlighted (red left edge, «⚠ αργεί» on the order date), one late-orders strip with «Προβολή» next to the εμβολιακό reminders, rounded graphite panels, filled blue main button «+ Νέα καταχώρηση» (opens the side form), segmented tabs, the edit window as a right-side drawer.
- Not taken: manual "vaccinated" step, silent cascades, two-line cells, tall KPI cards, restore in the bin, Tailwind / FontAwesome / external icon fonts (the look is rebuilt in the page's own CSS), demo data, removal of the side form / step-by-step entry / εμβολιακά flows.

## Constraints

- Beta page only; shared files, other pages and the database untouched.
- Every existing rule stays (draft lines, locked hatch fields, ordered-quantity question, alternatives, conflict check, auto-vaccinated, batch edit, bin, εμβολιακά, reminders).
- Greek through `t()` with English; clear names, short comments, banners; stubbed data only; no commit/push without the user's words; edits by a checking script.

## Tasks

1. **Look (CSS):** segmented tabs with a filled active tab; rounded (12px) panels for the table and bars; filled accent `.btn-primary`; header main button «+ Νέα καταχώρηση» → the side form.
2. **Summary strip + urgency filter:** `#kpi-strip` in the Εμβόλια tab above the toolbar; `urgencyFilter` ('late' | 'week' | 'fridge' | null) applied in `getFiltered`; counts ignore drafts and vaccinated lines; «Σύνολο πουλάδων» from `hatch_plans.chicks` of houses with a hatch in rearing (`loadPlanHatches` also reads chicks).
3. **House pills:** `#house-filter-row` moves out of the Φίλτρα menu into a pill bar under the strip (same `toggleHouseFilter`), each pill with age + late/due colour.
4. **Step pills + quick save:** «Πορεία» column replaces the three dot columns (header sorts by step); `toggleStepQuick(id, field)` for paragelia / psygeio with the edit window's rules; tfoot colspans adjusted.
5. **Late highlight + strip:** `row-late` class; red order date with ⚠; `#late-strip` (count + houses/vaccines + «Προβολή» → urgency 'late').
6. **Drawer:** the edit window (`#modal-bg`) slides in from the right at full height; content unchanged.
7. **Checks:** new `gemini_checks.js` (strip counts + filters, pills, step pills incl. alternatives + history + no manual vaccinated, late class + strip, sort by step, drawer position, translations EL + EN); existing suites green (vax 44, 3c 35, usual 18, tabs 12, remind 14, bin 7). Screenshots desktop + phone.
8. **Commit** on the user's word.
