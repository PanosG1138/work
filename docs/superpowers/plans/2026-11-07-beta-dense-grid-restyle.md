# Beta tracker — dense grid restyle (direction B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Restyle `vaccine_tracker_beta.html` as the high-density grid of design direction B (canvas https://claude.ai/artifact/4PKj6yg5uNXpQKYU2HxHDV, artboard "B — Πυκνό πλέγμα"), with switches for the three steps, a computed state badge, a full filter bar, a columns menu, inline cell editing with save states, keyboard grid navigation, skeleton and empty states.

**Backup:** git tag `beta-ui-classic` (commit 50de216) = the beta before this restyle. Revert = `git checkout beta-ui-classic -- vaccine_tracker_beta.html` (+ commit), only on the user's word.

**Architecture:** beta page only (no shared file, no database change). The look comes from re-pointing the page's `--gh-*` colour tokens to the B palette inside the beta's own `<style>` (so every existing beta component — tabs, windows, sheet, bin — follows), plus Fira Sans. The table's row builder is rewritten; editing goes through one shared `saveFields(id, fields)` that keeps every rule of the edit window (conflict check, history, alternatives question on fridge, ordered-quantity warning, order date = vaccination − 30).

## Decisions (user, 2026-11-07)

- Direction B chosen; A and C rejected.
- Three switches **Παρ. · Ψυγ. · Εμβ.** + a state badge computed from them (A).
- Optional columns hidden by default behind a **Στήλες** menu, remembered per browser (A): Ημ. παραγγελίας, Ημ. καταχώρησης, Προμηθευτής, Σχόλια Πάνος, Σχόλια Ελένη.
- Quick in-cell edits saved on leaving the cell: vaccination date, vaccine, quantity, customer, supplier; ✎ still opens the full edit window (A).
- Keep a backup of the classic UI (tag above).

## Global constraints

- Every rule of the current tracker survives: draft lines faded + tag, not counted; lines of a hatch with an εμβολιακό can't change hatch date / house; ordered lines ask before a quantity change; FAENTINA orders keep their own colour (magenta) on the Παρ. switch; "Αυτόματα" auto-mark vaccinated unchanged; batch edit / delete unchanged.
- Normal tracker, homepage, shared common.js / theme.css untouched.
- Phone (Eleni, read-only): table scrolls sideways, actions column stays pinned.
- Greek text through `t()` with English; clear names, short comments, banners; stubbed data only; no commit/push without "commit and push now"; /ponytail-review first; edits by a checking script.

## Tasks

### 1. Look
- `<head>`: Fira Sans 400/500/600/700 from Google Fonts; body font Fira Sans, `font-variant-numeric: tabular-nums`.
- Beta `<style>` start: `:root{--gh-canvas-default:#121315;--gh-canvas-subtle:#1A1C20;--gh-canvas-elev2:#1F2126;--gh-canvas-inset:#0E0F11;--gh-border-default:#2B2E34;--gh-border-muted:#24272C;--gh-fg-default:#EDEEF0;--gh-fg-muted:#A3A7AF;--gh-fg-subtle:#7C818A;--gh-accent-fg:#8DB4FF;--gh-accent-emphasis:#4D8DFF;--gh-hover-bg:#191B1F}` (state colours below).
- State palette: not ordered `#F2C38B` on `#6E5530`; late `#FF8A80` on `#8C3A35`; ordered `#9FC2FF` on `#3B5C99`; fridge `#7FD8D0` on `#2A6E6A`; vaccinated `#7FD1AE` on `#2F7A63`; draft `#A3A7AF` on `#34373E`; FAENTINA `#E879F9`.
- House badges, one hue per house: Θ1 `#C9B6FF`, Θ2 `#FFB3C7`, Θ3 `#A6E3A1`, Θ4 `#F2C38B`, Θ5 `#9FC2FF`, Α1 `#E0E3E8` (dark text).
- Header: title "Εμβόλια" + one-line subtitle; tabs as a segmented control; one white primary button **Νέα γραμμή** that opens the entry panel (the panel starts closed on desktop).

### 2. Table
- Columns: ☐ · Εκκόλαψη (house badge + date, draft tag) · Ημ. (age) · Ημ. εμβολιασμού · Εμβόλιο · Ποσότητα · Πελάτης · Κατάσταση · Παρ. · Ψυγ. · Εμβ. · [optional] · **Ενέργειες** (pinned right: ✎ window, ⟲ history, ✕ delete).
- `lineState(r)`: draft → «Πρόχειρο»; vaccinated → «Εμβολιάστηκε»; fridge → «Στο ψυγείο»; ordered → «Παραγγέλθηκε»; order date passed → «Αργεί η παραγγελία»; else «Χωρίς παραγγελία · έως dd/mm».
- Switches `role="switch"` `aria-checked`, `aria-label` "Παραγγελία / Ψυγείο / Εμβολιασμός"; click or Space → `saveFields(id, {paragelia|psygeio|emvoliasmos: 'ΝΑΙ'|null})`.
- Sticky header, column lines, `role="grid"`, `aria-sort` on sortable headers, `aria-rowcount`.

### 3. Filter bar (replaces the Φίλτρα menu)
- Search (as today). Multi-selects: **Αναθρεπτήριο** (`filterHouses`), **Εκκόλαψη** (`filterHatchDates`), **Κατάσταση** (`filterStates`, default every state except «Εμβολιάστηκε» = today's "hide vaccinated"). Ranges: vaccination date from/to, quantity min/max. "N από M" + **Καθαρισμός**.
- `getFiltered()` rewritten on these; `showDone`, `filt-ordered`, `filt-fridge` and their buttons go (references updated: stats, totals footer, loadData).

### 4. Columns menu
- **Στήλες** button → checkboxes for the five optional columns; `localStorage['vt-beta-cols']` (try/catch); hidden columns by a class on the table.

### 5. Inline editing + keyboard
- Editable cells: Ημ. εμβολιασμού (smart date), Εμβόλιο (searchable, `vaccine-list`), Ποσότητα, Πελάτης (`customer-list`), Προμηθευτής (`supplier-list`). Enter or double-click → edit; Enter / leaving the cell → save; Esc → cancel.
- Cell states: «αποθήκευση…», «✓ αποθηκεύτηκε» (fades), «σφάλμα · ξανά» (retry button).
- `saveFields(id, fields)`: conflict check on `updated_at` (newer version → toast + reload, nothing overwritten), vaccine name check, fridge-with-alternatives question, ordered-quantity question, vaccination date → order date −30 and "not before hatch" check, PATCH, history `edited`, update the row.
- Keyboard: one focusable cell at a time (roving `tabindex`); arrows move, Home/End row ends, Enter edit, Space toggles a switch cell, Esc cancels.

### 6. Loading + empty
- While loading: 6 skeleton rows (`aria-busy`).
- No lines at all: "Δεν υπάρχουν γραμμές ακόμα" + Νέα γραμμή / Εμβολιακά. Filters hide everything: "Κανένα αποτέλεσμα" + **Καθαρισμός φίλτρων**.

### 7. Checks
- New `restyle_checks.js` (stubbed): palette + font; columns; every `lineState`; switch save + history + conflict + alternatives; each filter + count + clear; columns menu + memory; inline edit saving / saved / error / retry / Esc; ordered quantity question; keyboard moves; skeleton; both empty states; ARIA attributes; EN translations.
- Existing suites stay green (adjusted only where they read the old markup): `vax_checks` 44, `vax3c_checks` 35, `tabs_checks` 12, `remind_checks` 14, `bin_checks` 7.
- Screenshots desktop + phone width.

### 8. Commit (on "commit and push now"), pushing the tag `beta-ui-classic` too.
