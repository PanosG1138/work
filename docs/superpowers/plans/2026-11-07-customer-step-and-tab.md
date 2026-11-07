# Customers first: one memory per customer, a «Πελάτες» step, a Customers tab

**Goal:**
- Each customer's vaccines live in one memory (injections and water, any day, who pays).
- They are reviewed in a first «Πελάτες» step when building an εμβολιακό, with «+» for any vaccine.
- A new Customers tab shows, per customer, their memory and what they did in each hatch.

**User decisions (2026-11-07):**
- Step 1 = customers and the vaccines planned for them from memory. Add or remove any vaccine (injection or water, day 60, 82 or any other day).
- After step 1, customer injections are added in **one** step, not separate 60 / 82 steps.
- Water vaccines of a customer (E.COLI for ΠΤΗΝΟΤΡΟΦΙΚΗ) **move into customer memory**. The template keeps only what every hatch gets.
- Customers tab history: **from now on only**, no backfill.
- Wherever vaccines are chosen for a customer, there is a «+» for a vaccine not in the list.
- Later (reminder kept): a salmonella step. When a customer with GALLIMUNE SE+ST in memory is in the hatch → only two SALMOVAC.

## Database (SQL for the user, after this plan is OK)

```sql
-- one memory per customer: what they do, when, how, who pays
create table customer_vaccines (
  id bigint generated always as identity primary key,
  customer text not null,             -- tracker form (capitals, no accents)
  vaccine text not null,              -- '' with how = 'none' → "nothing this round"
  at text not null,                   -- 'inj1' / 'inj2' = the template's injection days; 'day:N' = day N of age
  how text not null check (how in ('injection', 'water', 'share', 'none')),   -- share = pays own share of a template vaccine
  payer text not null default 'us' check (payer in ('us', 'customer')),
  product text                         -- ΚΟΡΥΖΑ product
);
-- (RLS: same four authenticated policies as customer_injectables)

-- what each customer did per hatch, kept for good (written when an εμβολιακό is activated and whenever it changes after)
create table customer_history (
  id bigint generated always as identity primary key,
  customer text not null, house text not null, hatch date not null,
  vaccine text not null, day int not null, how text not null, payer text not null default 'us',
  saved_at timestamptz not null default now()
);
-- + copy: customer_injectables (round 1/2 → inj1/inj2, round 0 → share) and the template rows «μόνο με …»
--   (one water row per customer per day) into customer_vaccines; then those template rows are deleted.
--   customer_injectables stays untouched until the switch is verified, then dropped (asked first).
```

## Steps of a new εμβολιακό

1. **Πελάτες** — a window with every customer of the hatch.
   - Each customer's vaccines come from memory; ★ = the standard injections when nothing is remembered.
   - Each vaccine is a chip: name · day (60 / 82 / any) · injection or water · «πληρώνει» · ΚΟΡΥΖΑ product.
   - «+» adds any vaccine (from the vaccine list or typed, through the spelling check) at a chosen day and how.
   - The customer's notes are shown next to them.
   - OK saves the memory and marks the step done. «Αλλαγή» reopens it and applies the difference to the lines already made, as the Ενέσιμα window does today.
2. **Βασικά εμβόλια**:
   - the template's vaccines;
   - each customer's **water** vaccines as whole-house lines;
   - paid shares.
   - Names + days only. Customer-driven lines are «προς έλεγχο».
3. **Εμβόλια πελατών** — every customer injection at its day:
   - birds rounded ↑1.000;
   - ΥΠΟΛΟΙΠΑ gets the standard set on the injection days;
   - all «προς έλεγχο».
4. **Ποσότητες** — as now.
5. (later) **Σαλμονέλα** — see the decisions above.

Plans already done keep their steps (the 4 existing ones stay "all done").

## Customers tab (beta, between Παραγγελίες and the page links)

- A search box with a list of customers, from memory, history and the scheduler.
- Picking a customer shows:
  - **Memory**: editable in the same window as step 1, without a hatch.
  - **History**: per hatch (house, hatch date), the vaccines by day, e.g. «ημ. 60: SG-9R, ΚΟΡΥΖΑ CORIPRAVAC · ημ. 82: …», who paid, and water vaccines. Newest first.
- The template page's «Πελάτες με δικά τους ενέσιμα» section moves here (one place). The template page keeps the vaccines, the injectables list (★) and the rules.

## Also in this round (already built, uncommitted)

- No whole-page scroll on Εμβολιακά: the lines and the customers panel scroll on their own.
- Εμβόλια table columns only as wide as their content; long headers wrap; no Ενέργειες column.
- Κάδος is the last tab.
- Click a customer in the sheet → their lines in red (click again to clear).
- Template page: one line per day (E.COLI on 12 and on 72); the supplier section is hidden.

## Tasks

1. SQL (user) + copy, verify.
2. Memory functions on customer_vaccines (replacing usualItems / paysFor / only_customers); «+» in every vaccine chooser.
3. Step 1 window (new) + steps 2–4 rebuilt on the memory; «Αλλαγή» diff.
4. customer_history writes (activation + later changes of an active εμβολιακό).
5. Customers tab; template page section moved.
6. Checks (stubbed, EL + EN), screenshots; commit on the user's word.
