# Hatch εμβολιακά, reminder, bin and tracker tabs — design

Date: 2026-11-06 (revised the same day: "one living εμβολιακό per hatch") · Follows
`2026-11-06-vaccine-planning-design.md` (steps 1–2 done). Comes **before** that spec's step 3
(orders/arrivals), which is built afterwards on top of this.

## The overarching goal (user's words, condensed)

For every hatch the vet drafts a vaccination plan (**εμβολιακό**): mostly the same for every hatch, with
additions or removals per house (e.g. E.Coli in Θ4, not in Θ3). The user used to print it from Excel and type
each vaccine into the tracker by hand (date from the day of age, vaccine, quantity). The day-60 and day-82
injections (ΠΡΩΤΑ / ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ) were never in the Excel — the user typed them from memory of what each
customer wants. During rearing, customers change and change their preferences; dates, vaccines and
quantities move. So:

- **Every hatch has one εμβολιακό for its whole life** (before arrival until it leaves). It is what ties each
  vaccination to its day of age / date, vaccine, quantity, customer, order and fridge state.
- **The automation is only the start:** the standard vaccines from the template, the customers from the
  scheduler (corrected by hand), and each customer's usual injections.
- **It must stay easy to edit before and during rearing** — never locked.
- **At a glance per house:** what each house's hatch has, for which customers, ordered or not, quantity, date;
  when customer Y changes vaccine X, the line is easy to find.

## Names

- **Βασικό εμβολιακό** — the template every hatch starts from (`vaccine_programme.html`, table
  `vaccine_programme`; was "Πρόγραμμα").
- **Εμβολιακό** — one hatch's plan. Tab **Εμβολιακά**.

## Ground rule: days of age, never fixed dates

A vaccination is defined by the birds' **age in days** ("SALMOVAC on day 8"). Every vaccination date = hatch
date + day. Changing a hatch date moves everything of that hatch.

## Build order (all in `vaccine_tracker_beta.html` unless stated)

1. Tracker tabs — done (cb5f57a)
2. Several days per template row — done (041e439)
3. Hatch εμβολιακά — split in two plans:
   - **3a** data (draft flag, hatch record, hatch-date shift), Εμβολιακά tab with house cards, creating an
     εμβολιακό, the hatch sheet (view + open a line in the tracker's edit window), activation, age in tracker
   - **3b** editing in the sheet: add a vaccine, injections grid, customers (rename/remove/add/birds),
     Νεοσσοί recalculation, rounding switch, ordered-line warnings
4. "Start the εμβολιακό" reminder
5. Bin

Each step: stubbed data only; database changes as SQL for the user's SQL Editor, verified afterwards. Anything
that changes live rows when its SQL runs is shown to the user as a table first.

## 1. Tracker tabs (done)

Header: logo + BETA, connection, counts, zoom, shared buttons. Tab row: `Εμβόλια` · `Εμβολιακά` ·
`Παραγγελίες` · `Κάδος`, right-aligned links `Απόθεμα` and `Βασικό εμβολιακό`. Tab kept in the URL hash.

## 2. Several days per template row (done)

`vaccine_programme.days integer[]`; form "27, 75"; injection placeholder rows one day.

## 3. Hatch εμβολιακά

### Data

- **The εμβολιακό's lines are the tracker rows themselves** (`emvolia`), matched to the hatch by
  `anath = house` and `hm_ekk = hatch date`. No copy anywhere else: the tracker table and the hatch sheet are
  two views of the same rows. Day of age = `hm_emv − hm_ekk`.
- **New column `emvolia.draft boolean not null default false`.** Lines of a not-yet-activated εμβολιακό are
  `draft = true`: shown faded with a "πρόχειρο" tag in the beta tracker, left out of the counts, the order
  reminders and the homepage; still moved by the hatch-date shift. `vaccine_tracker.html` and `index.html`
  read only `draft=eq.false`.
- **New table `hatch_plans`** (one per scheduler placement): `placement_id uuid unique` (FK placements,
  on delete cascade), `chicks integer > 0`, `customers jsonb` ([{name, qty}] — corrected list, **the
  scheduler is never written**), `activated_at timestamptz null`, `updated_at`, `updated_by`. RLS
  authenticated only; changes logged to `settings_history`.
- **Injection round of a line:** the existing convention — `sxolia_panos` starts with `ΠΡΩΤΑ ΕΝΕΣΙΜΑ` (round 1)
  or `ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ` (round 2), followed by the house. Rows the user typed by hand the same way group the
  same. Every other line is a general vaccine.
- **Hatch-date shift** — database trigger on `placements` (date or house change): every `emvolia` row with the
  old house + old date gets `anath`, `hm_ekk`, `hm_emv`, `hm_paragelia` moved, each change written to
  `emvolia_history` by user "Αυτόματα (αλλαγή εκκόλαψης)". Draft lines move too.

### Εμβολιακά tab

- **House cards**, one per house (Θ1–Θ5, Α1 when it has a hatch): the current hatch (latest hatch date ≤ today
  + 60 days, not binned) with date, age or days until arrival, and state: *χωρίς εμβολιακό* / *πρόχειρο* /
  *ενεργό* (+ "N χωρίς παραγγελία" when lines with an order date already passed are not ordered). A house can
  have an upcoming hatch and a current one: both are listed in its card.
- Clicking a hatch opens **its sheet** below the cards (in the tab, not a popup, so the tracker's own edit
  window can open on top of it).

### Creating an εμβολιακό (button "Δημιουργία εμβολιακού" on a hatch without one)

- Hatch **with no tracker rows**: creates the `hatch_plans` record (chicks = scheduler Νεοσσοί, else the
  booked total; customers = the scheduler's, cleaned) **and the draft lines at once**: every Βασικό εμβολιακό
  vaccine, one line per day (all included — removals are done in the sheet), quantities by the template rule
  (`planQty`), supplier, order date = date − 30; plus each customer's usual injections (round 1 / 2, quantity =
  birds rounded up to 1.000, payer). A short "Δημιουργία εμβολιακού" box first shows the Νεοσσοί (editable)
  and the customers found, and asks the ΚΟΡΥΖΑ product (BIONEW BI + COR / CORIPRAVAC) for each round where a
  customer usually gets ΚΟΡΥΖΑ.
- Hatch **that already has tracker rows** (entered the old way): creates only the `hatch_plans` record,
  **already activated** (its rows are live); customers = the distinct `pelatis` of its injection rows with the
  scheduler's birds where the names match. No row is added or changed.

### The hatch sheet

Laid out like the vet's Excel, sorted by day: **Ημέρα · Ημερομηνία · Εμβόλιο · Ποσότητα · Πελάτης ·
Παραγγελία · Ψυγείο**, general vaccines first, then a "ΠΡΩΤΑ ΕΝΕΣΙΜΑ · ημ. N · date" group and a
"ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ" group. Παραγγελία: ✓ when ordered, otherwise "έως dd/mm" (the order date) in amber, red
once passed. Header: house · hatch date · breed · Νεοσσοί · state · customers count.

- 3a: clicking a line opens the tracker's existing edit window for that row (everything editable there,
  history kept); the window shows the line's age next to the vaccination date.
- 3b adds, in the sheet itself:
  - **+ Εμβόλιο** (day, vaccine, quantity, supplier) → a new line;
  - **injections grid** per round (customers × that round's vaccines plus any vaccine already in its lines):
    tick → line created, untick → line removed, payer us / customer; ΚΟΡΥΖΑ product per round;
  - **customers**: rename (renames `pelatis`/`payer` on the hatch's lines), change birds (offers to update the
    unordered injection quantities), remove (removes their lines), add;
  - **Νεοσσοί**: changing it offers to recalculate the **not yet ordered** template lines (matched to the
    Βασικό εμβολιακό by vaccine + day), listing every from → to before applying;
  - **rounding switch** 1.000 / 5.000 / 10.000 on unordered template lines;
  - **ordered lines**: changing the quantity of or removing a line with Παραγγελία = ΝΑΙ asks first, showing
    what was ordered.
- **Ενεργοποίηση** (draft εμβολιακό only): asks once, sets `draft = false` on all its lines and
  `activated_at`. The sheet stays fully editable afterwards; new lines of an active εμβολιακό are not drafts.
- **Διαγραφή εμβολιακού** (draft only): removes its draft lines and the record (history kept).

### Tracker

- Each vaccination date shows the age: "14/11/2026 ημ. 8" (in the date cell, not a new column).
- Draft lines faded with a "πρόχειρο" tag; counts exclude them.

## 4. "Start the εμβολιακό" reminder

From **35 days before** a hatch date until its εμβολιακό is **activated**, a large banner above the houses on
the homepage and above the table in the tracker (option A, one line per hatch): days left (big number),
house · hatch date, state (no εμβολιακό / πρόχειρο), button "Άνοιγμα εμβολιακού →". Amber; **red** once the
earliest line's order date has passed, title "έχουν ήδη αργήσει παραγγελίες". Binned hatches never appear.
Later the same lines go into the morning email.

## 5. Bin (Κάδος)

- Column `emvolia.binned_at timestamptz null`.
- Nightly database job (pg_cron): rows with `hm_ekk <= today − 126 days` and not binned → `binned_at = now()`;
  rows binned 30+ days ago → deleted, each logged to `emvolia_history` as `deleted`.
- Automatic only, **no restore**; the Κάδος tab is view-only (house, hatch date, rows, days until deletion).
- Binned rows are not loaded with normal rows (`binned_at=is.null` on every read): gone from the table, the
  hatch-date suggestions, the step-by-step entry, the Εμβολιακά tab, the reminder and the homepage. Same filter
  in `vaccine_tracker.html` and `index.html`.
- `backup.py` keeps exporting them until deleted (ΚΑΔΟΣ column).

## Out of scope here

Orders/arrivals/coverage (old step 3), the morning email (old step 4), redesign of the customers' usual
injections table, the switch from beta to the normal tracker.
