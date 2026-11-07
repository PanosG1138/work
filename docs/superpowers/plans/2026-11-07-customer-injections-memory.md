# Customers' injections: remembered per customer + customer-triggered house vaccines — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the empty 51 × 14 "Συνήθη ενέσιμα πελατών" grid with (a) a standard set per injection round, (b) each customer's injections remembered automatically from the hatch's Ενέσιμα window, editable in advance from a short list, and (c) Βασικό εμβολιακό rows that are added to a hatch only when certain customers are in the house (e.g. POULVAC E.COLI days 12 + 72 with ΠΤΗΝΟΤΡΟΦΙΚΗ, given in the water to the whole house).

## Decisions (user, 2026-11-07)

- Option A: no grid to fill; the Ενέσιμα window remembers each customer (vaccines, who pays, ΚΟΡΥΖΑ product); new customers start from a standard set per round; customers can be changed in advance from a short list (✎).
- Customer-triggered vaccines: a Βασικό εμβολιακό row can have «Μόνο όταν στο αναθρεπτήριο υπάρχει: …» (any number of customers, any number of rows). Whole-house line, quantity by the row's rule, no customer, we pay.
- When customers change later, the εμβολιακό offers to add / remove those lines (ordered lines warn).
- POULVAC E.COLI leaves both injection lists; new conditional row POULVAC E.COLI, days 12 + 72, only with ΠΤΗΝΟΤΡΟΦΙΚΗ (starts at all chicks rounded up to 1.000; the user adjusts on the page).
- There are other such customers/vaccines; the user fills them on the page.

## Data (SQL for the user)

```sql
alter table injectables add column standard boolean not null default false;      -- the round's standard (βασικό) set
alter table customer_injectables add column product text;                         -- the ΚΟΡΥΖΑ product the customer last got
alter table vaccine_programme add column only_customers text[];                    -- only when one of these customers is in the house
-- POULVAC E.COLI is now given in the water to the whole house: off the injection lists (logged), on as a conditional row
insert into settings_history (table_name, row_key, action, user_name, ts, changes_json)
  select 'injectables', id::text, 'deleted', 'Αυτόματα (ρύθμιση)', now(),
         json_build_object('round', json_build_object('from', round, 'to', null), 'vaccine', json_build_object('from', vaccine, 'to', null))::text
  from injectables where vaccine = 'POULVAC E.COLI';
delete from injectables where vaccine = 'POULVAC E.COLI';
insert into vaccine_programme (days, kind, vaccine, rule, extra_pct, divide_by, round_to, unit, only_customers)
  values ('{12,72}', 'general', 'POULVAC E.COLI', 'placed', 0, 1, 1000, 'Δόσεις', '{ΠΤΗΝΟΤΡΟΦΙΚΗ}');
```

- `customer_injectables.customer` = the customer's name in tracker form (`pelatisName`: capitals, no accents) so Βενιζέλος = ΒΕΝΙΖΕΛΟΣ; a row with `vaccine = ''` = "nothing this round" (so a customer who chose nothing doesn't fall back to the standard set). The table is empty today.
- `only_customers` holds names in the same form; ΠΤΗΝΟΤΡΟΦΙΚΗ also matches the scheduler's Πτηνοτροφική field (`placements.ptino`).

## Tasks

1. **common.js** — `pelatisName` moves here (VACCINE PLANNING) from the beta; v=19 on all pages.
2. **Βασικό εμβολιακό page**
   - injection chips get a «βασικό» toggle (★) → `injectables.standard`, logged;
   - the grid section becomes «Πελάτες με δικά τους ενέσιμα»: only customers whose remembered set differs from the standard or who pay something themselves (link «Όλοι οι πελάτες» shows every remembered one); each with ✎; «+ Πελάτης» to set one in advance;
   - the customer window: per round, the round's vaccines as chips (tick on/off), «Πληρώνει κάποια εμβόλια» + a «πελάτης» box per chip, ΚΟΡΥΖΑ product; Αποθήκευση replaces that customer's remembered rows; «Επαναφορά στα βασικά» deletes them (back to standard); every change logged;
   - the programme row window gets «Μόνο όταν στο αναθρεπτήριο υπάρχει» (comma-separated, suggestions from the scheduler's customers + ΠΤΗΝΟΤΡΟΦΙΚΗ); the table shows «μόνο με …».
3. **Beta (Εμβολιακά)**
   - `usualItems(name, round)`: remembered rows (vaccines still in the round's list; '' = nothing) else the round's standard set;
   - `hatchHasCustomer(p, customers, names)`; creating an εμβολιακό adds a conditional row only when such a customer is in the house; the create box asks the ΚΟΡΥΖΑ product only for customers with none remembered (per customer and round);
   - the Ενέσιμα window pre-ticks with `usualItems`; OK also saves each customer's choices (memory) and then checks the conditional rows against the εμβολιακό's customers: missing → offer to add (whole house, quantity by the row's rule); no longer needed → offer to remove (`confirmOrdered` for ordered ones).
4. **Checks** (stubbed): new `usual_checks.js` (beta) and `prog_usual_checks.js` (Βασικό εμβολιακό); existing suites updated only for the memory names / per-customer ΚΟΡΥΖΑ question; all green EL + EN.
5. **Commit** on "commit and push now".
