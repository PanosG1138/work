# Vaccine planning, ordering and arrivals — design

Date: 2026-11-06 · Status: agreed in chat, awaiting review of this document
Pages touched: vaccine_tracker.html, schedule_checker.html, index.html, a new settings page,
a new workflow (.github/workflows/vaccine_notify.yml), backup.py, common.js only if shared code is needed.

## Why

Every new hatch is typed into the vaccine tracker by hand: ~15 general vaccines with dates and
quantities, then the customer injectables, customer by customer. Nothing reminds Eleni when to
order, and arrivals are ticked row by row, which can't express "45.000 of 50.000 came" or
"145.000 came for 100.000 ordered".

## What the data shows (checked 2026-11-06)

- The programme has settled: the last three hatches (Θ4 08/10, Θ5 27/10, Θ3 05/11) use almost the
  same days and products. Per-hatch differences still happen (e.g. Θ4 had E.COLI on days 12/72).
- Order date = vaccination date − 30 days on every row.
- General vaccine quantities follow chicks placed (Θ3 05/11: 55.000 placed, 50.000 booked).
- Customer injectables (days ~60 and ~82–95) are per customer, quantity = that customer's booked
  birds. placements.customers already holds them (name before " - ", k/l/c counts).
- Some customers are billed directly by the supplier (ΣΥΝΤΙΧΑΚΗΣ): their doses are ordered on
  their account, separately from ours.

## Decisions (from the user)

1. The programme is saved once in the tool and edited when the vet changes it (not read from
   each ΕΜΒΟΛΙΑΚΟ Excel). A new hatch copies it; single rows can differ per hatch.
2. Each customer has a usual list of injectables, pre-ticked for every new hatch, adjustable per hatch.
3. Chicks placed is a new field on the scheduler's hatch card; quantities follow it.
4. Eleni gets a weekday morning email, only when something needs action, grouped by supplier.
   Recipient: info@georgasopoulos.gr (stored as a GitHub secret, not in the code).
5. Arrivals are recorded as quantities; the tracker works out coverage itself (below).
   Late-delivery warning: 14 days before vaccination. Stock (Απόθεμα) integration: maybe later, not now.
6. Expiry of surplus doses: ignored for now.
7. Column F numbers on the ΕΜΒΟΛΙΑΚΟ sheet (30, 22, 18) are days between salmonella doses — ignored.
8. One programme for all breeds: the schedule changes over time, never because of breed.
9. ΚΟΡΥΖΑ: BIONEW BI + COR or CORIPRAVAC depending on the situation, decided each hatch in the
   preview — not in the customers' usual lists.

## 1. Settings page "Πρόγραμμα εμβολίων" (new file: vaccine_programme.html)

Linked from the vaccine tracker. Translated (ΕΛ/EN) like the other tool pages.

**Programme** — table `vaccine_programme`, one row per vaccination:

| column | meaning |
|---|---|
| day | days after hatch (date = hatch + day) |
| vaccine | name from the `vaccines` table; NULL on the two placeholder rows |
| kind | `general` · `injectables_1` (ΠΡΩΤΑ ΕΝΕΣΙΜΑ) · `injectables_2` (ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ) |
| rule | `placed` (= (chicks placed + extra_pct %) ÷ divide_by, rounded up to round_to) or `fixed` (fixed_qty) |
| extra_pct, divide_by, round_to | for `placed`: default 0 %, ÷ 1, 1.000; round_to is 1.000, 5.000 or 10.000. E.g. SALMOVAC +5 %: 54.000 → 56.700 → 57.000 (or 60.000). The IB 4/91 + Ma5 formula is +30 % ÷ 2 |
| fixed_qty, unit | for `fixed`, e.g. TARTYLL 5 Κιλά |

Seed (from ΕΜΒΟΛΙΑΚΟ Θ3 05/11/2026; days 0, 2 and the ΖΥΓΑΡΙΑ rows left out):
8 SALMOVAC · 15 IB 4/91 · 15 Ma5 · 21 CLONE30 · 24 TARTYLL (fixed 5 Κιλά) · 27 NEMOVAC TRT ·
32 MG 6/85 · 38 SALMOVAC · 45 IB PRIMER · 52 CLONE30 · 60 ΠΡΩΤΑ ΕΝΕΣΙΜΑ · 75 NEMOVAC TRT ·
80 MG 6/85 · 82 ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ · 89 IB 4/91 · 89 Ma5 · 94 CLONE30 · 100 SALMOVAC.
All `placed` × 1 unless noted (IB 4/91 and Ma5 also × 1: Θ3 05/11 used 55.000 for both).

**Injectables grid columns** — table `injectables`, the products offered per round (seeded from the
user's "Sheet 1"): round 1: SG-9R, ΚΟΡΥΖΑ, VAXSAFE, POULVAC E.COLI;
round 2: the same plus VECTROMUNE, IZOVAC, OLVAC B+HG, GALLIMUNE SE+ST, SALENVAC ETC, GALLIMUNE 407.
**ΚΟΡΥΖΑ** is a column, not a product: the product (BIONEW BI + COR or CORIPRAVAC) is chosen per
hatch in the preview (section 3), never stored in the customers' usual lists.

**Customers' usual injectables** — table `customer_injectables` (customer, round, vaccine, payer):
the same grid, one row per customer; payer = `us` or `customer` (billed directly).
Customer = the name before " - " in placements.customers.

**Default supplier per vaccine** — new column `vaccines.supplier`, editable on this page.

## 2. Chicks placed on the scheduler card

New column `placements.chicks` (integer). Shown and edited in the scheduler's add/edit window and
on the card. It is read when the hatch's vaccines are planned (section 3); changing it afterwards
does not change entries already saved — their quantities are edited in the tracker as today.

## 3. "Νέα εκκόλαψη από πρόγραμμα" (vaccine tracker)

1. Pick a hatch (house + hatch date) from the scheduler's placements. Refused if Νεοσσοί is empty,
   or if the hatch already has entries (to add more, use the normal add form).
2. Preview, nothing saved yet:
   - every `general` programme row: date, vaccine, quantity from its rule, order date (−30),
     supplier from the vaccine default — all editable, rows can be removed or added;
   - for each placeholder round, a grid: one row per customer of this hatch plus a
     **ΥΠΟΛΟΙΠΑ** row (chicks placed − booked, unticked by default); columns = that round's
     injectables; ticks pre-filled from the customers' usual lists; quantity = the customer's
     k + l + c; payer per tick (us / customer). Each round's ΚΟΡΥΖΑ column has a product choice
     (BIONEW BI + COR / CORIPRAVAC) that must be picked before saving if any ΚΟΡΥΖΑ box is ticked.
3. **Αποθήκευση** inserts the entries (with history "created", as today). Customer-injectable
   entries get `pelatis` = customer and `payer` set.

The existing add form and step-by-step entry stay for one-off rows.

## 4. Quantities as numbers

`emvolia.posotita` (free text like "60000", "5 ΚΙΛΑ") becomes `qty` (numeric) + `unit`
(Δόσεις / Κιλά / Μπουκαλάκια). Existing values are converted once; a value that can't be read stays
NULL and shows **"χωρίς ποσότητα"**. New column `emvolia.payer` (NULL = us, else the customer name).
backup.py, the CSV export, the print card and the edit forms move to qty + unit.

## 5. Orders and arrivals

Tables:
- `vaccine_orders`: id, vaccine, unit, supplier, payer, qty, ordered_on, closed (bool), created_by/at
- `vaccine_arrivals`: id, order_id, qty, arrived_on, created_by/at
- `vaccine_orders_history`: order_id, action, user_name, ts, changes_json (same convention as emvolia_history;
  arrivals are logged against their order)

**Coverage (one database view, `vaccine_coverage`, read by the page and the email).**
Pool = vaccine + unit + payer. Within a pool, entries from the go-live date on are taken in
vaccination-date order (then id). Supply = all arrived doses, then the still-open part of open orders
(ordered − arrived, for orders not closed). Walking the entries, each takes what it needs from
arrived first, then from open orders. Per entry the view returns: covered_arrived, covered_ordered,
missing, order_by (= hm_emv − 30), and the status:

| status | when | red when |
|---|---|---|
| Ήρθε | missing = 0 and covered_ordered = 0 | — |
| Παραγγέλθηκε | missing = 0, some covered by open orders | under 14 days to vaccination |
| Λείπει N | missing > 0 | order_by has passed |

Arrived doses beyond all entries = **Περίσσευμα** (surplus); they cover the next entries automatically,
including hatches created later. Entries vaccinated before go-live are not in the view.

**Παραλαβή less than ordered** asks "Θα έρθουν τα υπόλοιπα;": yes → order stays open; no → order
closed, the rest becomes missing again. More than ordered → surplus.

Auto-marking Εμβολιασμός ΝΑΙ (6 days after vaccination) uses status Ήρθε for go-live rows instead of
the two ticks.

## 6. Tracker screens

- Rows from go-live: the Παραγγελία and Ψυγείο columns show the status chip instead (tooltip: which
  orders/deliveries cover it) and who pays. Older rows keep their ticks. Filters follow the status.
- New **Παραγγελίες** tab, three lists:
  1. **Να παραγγελθούν** — missing doses grouped by supplier, then payer; per line vaccine, total
     missing, earliest order-by date (overdue first, red), the entries it's for. **Παραγγελία** opens
     a form: qty (pre-filled with the missing total, editable), supplier, payer, date.
  2. **Σε αναμονή** — open orders, ordered vs arrived; **Παραλαβή** (qty pre-filled with what's
     outstanding, date).
  3. **Περίσσευμα** — surplus per vaccine + payer.
- Orders and arrivals can be edited/deleted; every change goes to vaccine_orders_history.
- Homepage dashboard: "χωρίς παραγγελία / δεν έχουν έρθει" counts come from the view for go-live rows.

## 7. Morning email (.github/workflows/vaccine_notify.yml)

Weekdays (cron Mon–Fri, same hour as the feed reminders); sent only when there is something.
Reads `vaccine_coverage` with the same key the feed workflow uses. In Greek. Sections:
1. 🔴 late: Λείπει past order_by; Παραγγέλθηκε with under 14 days to vaccination;
2. to order today and in the next 7 days, grouped by supplier then payer (vaccine, qty, order-by,
   hatch / customers);
3. orders closed short that still leave doses missing.
Each line links to vaccine_tracker.html's Παραγγελίες tab (focusFromLink highlight).
Secrets: reuses GMAIL_USER / GMAIL_APP_PASS; new VACCINE_NOTIFY_EMAIL = info@georgasopoulos.gr.

## Switch-over (with step 3)

Go-live date = the day the beta starts (step 3 deployed in the beta); the coverage view covers
entries vaccinated on/after it. At the switch, entries that the beta's orders don't already cover:
Παραγγελία ΝΑΙ → one order per entry of its quantity (ordered_on = hm_paragelia or today);
Ψυγείο ΝΑΙ → an arrival of the same quantity. Customer-billed rows (e.g. ΣΥΝΤΙΧΑΚΗΣ) get payer set
by hand in the switch-over review: the conversion is shown to the user as a table before it runs.
During the beta, rows ticked in the old tracker but without beta orders show "Λείπει" in the beta —
expected until either Eleni records them in the beta or the switch converts them.

## Database changes

Delivered as SQL for the Supabase SQL Editor (the connector refuses migrations), then verified.
New tables get RLS with `authenticated` policies only (never anon); the view uses
security_invoker. History tables keep no foreign key (history outlives deletes, as agreed 2026-11-05).
backup.py gets the new tables.

## Build order

1. Settings page + `vaccines.supplier` + `placements.chicks` (scheduler field). Only adds; live 2026-11-06.
2. "Νέα εκκόλαψη από πρόγραμμα" — in the beta page (below).
3. Orders, arrivals, coverage view, statuses, Παραγγελίες tab — in the beta page.
   Then the switch (homepage counts, switch-over, beta replaces the tracker).
4. Morning email — switched on only after the switch.

Each step: tested with made-up data, shown to the user, committed only on "commit".

## Beta page for steps 2–3 (decided 2026-11-06)

Steps 2–3 are built in a copy of the tracker, `vaccine_tracker_beta.html`, so they can be tried
side by side with real data while Eleni keeps using `vaccine_tracker.html` unchanged.

- Both pages read and write the same `emvolia` rows. During the beta nothing the old tracker uses
  changes meaning: `posotita` stays free text and stays the truth. The coverage view parses
  numbers from it ("60000", "60.000", "5 ΚΙΛΑ"); rows it can't parse show "χωρίς ποσότητα".
  The qty + unit split of section 4 happens at the switch, not before.
- New columns/tables the old tracker ignores: `emvolia.payer`, `vaccine_orders`, `vaccine_arrivals`,
  `vaccine_orders_history`. Orders and deliveries recorded in the beta are real records.
- The old tracker's Παραγγελία / Ψυγείο ticks keep working as today and are not touched by the
  beta. The beta shows each row's computed status next to the old ticks, so the two can be compared.
- The wizard in the beta creates real rows (they appear in the old tracker too). To try it without
  that, use its preview and cancel, or plan a test hatch and delete it afterwards.
- The beta is linked only from the vaccine tracker (a small "Beta" button), not from the homepage.
- The switch, when the user is happy: the beta's code replaces vaccine_tracker.html (one commit),
  the beta file is deleted, the switch-over conversion (below) runs once, homepage counts move to
  the statuses, then step 4's email is switched on. If the beta disappoints, delete it and its
  tables; the old tracker never changed.

## Testing

- Coverage view: SQL checks over made-up rows (VALUES), covering: 45.000 of 50.000 then closed
  (missing 5.000); 145.000 arriving for 10.000 + 25.000 + 65.000 (all covered, surplus 45.000,
  next entry covered by surplus); ΣΥΝΤΙΧΑΚΗΣ 32.000 customer-billed + 28.000 ours (separate pools);
  one order arriving in two parts; overdue and 14-day red flags against a fixed "today".
- Pages: stubbed-data state runners (same harness as before), Greek and English.
- Email: dry run printing the email body instead of sending.

## Not now

Stock (Απόθεμα) linked to arrivals and vaccinations · expiry dates · reading the ΕΜΒΟΛΙΑΚΟ Excel.

## ΥΠΟΛΟΙΠΑ row (decided 2026-11-06)

The chicks placed but not booked by any customer (Θ3 05/11: 55.000 − 50.000 = 5.000) also reach
day 60/82 and may be sold later; past hatches sometimes ordered injectables for them under pelatis
"ΥΠΟΛΟΙΠΑ" (e.g. Θ1 17/08: SG-9R 10.000). The injectables grid always offers a ΥΠΟΛΟΙΠΑ row,
quantity = chicks placed − booked, **all boxes unticked by default**, payer = us. It is not shown
when nothing is left over (placed ≤ booked).
