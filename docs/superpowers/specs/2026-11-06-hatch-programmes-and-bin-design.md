# Hatch programmes, draft reminder, bin and tracker tabs — design

Date: 2026-11-06 · Follows `2026-11-06-vaccine-planning-design.md` (steps 1–2 done). Comes **before** that spec's
step 3 (orders/arrivals), which is built afterwards on top of this.

## Ground rule: days of age, never fixed dates

A vaccination is defined by the birds' **age in days** ("SALMOVAC on day 8"), not by a calendar date.
Every vaccination date = hatch date + day. Nothing stores a hand-fixed date that would stay behind when the
hatch date changes. Changing a hatch date moves everything of that hatch.

## Build order (all in `vaccine_tracker_beta.html` unless stated)

1. Tracker tabs (header clean-up)
2. Several days per programme row
3. Hatch drafts + hatch-date shift
4. "Start the programme" reminder
5. Bin

Each step: tested on stubbed data only; database changes given to the user as SQL for the SQL Editor and
verified afterwards. Steps 3 (shift) and 5 (bin) act on live rows the moment their SQL runs, so before giving
that SQL, show the user a table of exactly which hatches/rows it would touch.

## 1. Tracker tabs

The header keeps only: logo + BETA badge, connection status, the three counts, zoom, and the shared
sign-out / ΕΛ-EN / Αρχική buttons. Under it, a row of tabs:

`Εμβόλια` · `Προγράμματα εκκολάψεων` · `Παραγγελίες` (empty until the old step 3) · `Κάδος` ·
right-aligned links `Απόθεμα` (inventory.html) and `Πρόγραμμα` (vaccine_programme.html).

Tabs switch views inside the page (no reload); the chosen tab is kept in the URL hash so a link or reload
returns to it. The old "🗓 Νέα εκκόλαψη από πρόγραμμα" sidebar button is replaced by the Προγράμματα tab.

## 2. Several days per programme row

- `vaccine_programme.day integer` → `days integer[]` (non-empty, each ≥ 1). Existing rows: `days = {day}`.
- Programme form: field **Ημέρες**, typed "27, 75" (sorted, duplicates removed). Table shows "27 · 75".
- The quantity rule (% ÷ rounding) is the same for every day of the row. SALMOVAC may stay as separate rows.
- No automatic merging of the user's rows; they merge by hand.
- A draft expands each day into its own line.
- Injection placeholder rows (`injectables_1/2`) keep exactly one day.

## 3. Hatch drafts (Προγράμματα εκκολάψεων tab)

**List:** the scheduler's hatches with doc_date from 60 days ago onwards (not binned), each with status
*χωρίς πρόγραμμα* / *πρόχειρο* / *επιβεβαιωμένο*, and days until the hatch date.

**Table `hatch_drafts`** (one per placement):
`placement_id` (unique, the scheduler's placement id), `chicks integer`, `customers jsonb` ([{name, birds}]),
`lines jsonb`, `rounds jsonb`, `confirmed_at timestamptz null`, `updated_at`, `updated_by`.
- a line = {include, vaccine, day, unit, rule, extra_pct, divide_by, round_to, qty_typed (null = calculated),
  supplier}; dates are never stored, always hatch date + day.
- a round = {round, day, coryza, cols, cells}, as in the current window.
RLS: authenticated only. Changes logged to `settings_history` like the programme page.

**Starting a draft:** lines from the programme, **all ticked**; customers from the scheduler's placement
(names cleaned with `customerName`, same name added up, 0 left out); `chicks` = scheduler Νεοσσοί if filled,
else the customers' booked total.

**Editing:**
- lines: tick/untick, change **day** (not date), vaccine, supplier, rounding switch, type a quantity by hand,
  add a line;
- Νεοσσοί: changing it recalculates every line without a typed quantity;
- customers: rename, delete (notes), add, change birds — **stored only in the draft, the scheduler is never
  written**;
- injections: the current grid (to be redesigned later — user finds the usual-injections method too
  complicated; only a handful of customers pay directly). Injection quantity = birds rounded up to 1.000.
- dates shown next to each day, from the placement's current hatch date.

**Αποθήκευση** saves the draft (anyone can continue later). **Διαγραφή** deletes an unconfirmed draft.

**Επιβεβαίωση** creates the tracker rows exactly as the current window does (same fields, ΥΠΟΛΟΙΠΑ, payer,
ΚΟΡΥΖΑ product check, "hatch already has rows" check), then sets `confirmed_at`. A confirmed draft is
read-only; from then on changes happen in the tracker. The user confirms early (3–4 weeks before arrival)
with the expected chicks, so orders are not late; quantities are corrected in the tracker afterwards.

**Hatch-date shift (database trigger on `placements`):** when a placement's `doc_date` changes by N days,
every `emvolia` row with `anath = house` and `hm_ekk = old date` gets `hm_ekk`, `hm_emv` and `hm_paragelia`
moved by N days, each change written to `emvolia_history` (action `edited`, before/after). Drafts need no
change (they store days). Rows are matched by house + hatch date — the same match `hatchHasRows` uses.

**Tracker:** new column **Ημέρα** = hm_emv − hm_ekk (shown, not stored); editing a row's date in the
tracker simply changes its age.

## 4. "Start the programme" reminder

From **35 days before** a hatch date until its draft is **confirmed**, a large banner above the houses on
the homepage and above the table in the tracker (chosen layout: option A, one line per hatch):
- line: days left (big number), house · hatch date, draft state, button "Άνοιγμα προγράμματος →" opening that
  hatch's draft;
- amber; turns **red** once the first order date of the programme has passed (earliest line's
  hatch date + day − 30 ≤ today), with title "έχουν ήδη αργήσει παραγγελίες";
- binned hatches never appear.
When the morning email (old step 4) is built, the same lines go into it.

## 5. Bin (Κάδος)

- Column `emvolia.binned_at timestamptz null`.
- Nightly database job (pg_cron, available but not yet enabled):
  - rows with `hm_ekk <= today − 126 days` (18 weeks) and `binned_at is null` → `binned_at = now()`;
  - rows with `binned_at <= now() − 30 days` → deleted, each logged to `emvolia_history` as `deleted` with the
    row's last values (same as a hand delete).
- Automatic only: no hand binning, **no restore**. The Κάδος tab is view-only: binned hatches (house, hatch
  date, number of rows, days until deletion), expandable to see the rows.
- Binned rows are not loaded with normal rows (`binned_at=is.null` on every read), so they disappear from the
  table, hatch-date suggestions (`hatch-list`), the step-by-step entry, `isKnownFlock`, the drafts list, the
  reminder, and the homepage counts. The old `vaccine_tracker.html` and `index.html` get the
  same filter.
- `backup.py` keeps exporting binned rows (they are still data) until deleted; add a ΚΑΔΟΣ column with
  `binned_at`.

## Out of scope here

Orders/arrivals/coverage (old step 3), the morning email (old step 4), redesign of customers' usual
injections, the switch from beta to the normal tracker.
