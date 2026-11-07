# Εμβολιακό as steps, customers on the right

**Goal:** building a hatch's εμβολιακό becomes a visible step-by-step process. The plan is on the left, and the
scheduler's customers with notes and memory are on the right, always in view.

**User decisions (2026-11-07):**
- Customers, notes and everything that isn't the plan sit on the right. The plan is on the left and scrolls on its own.
- «Δημιουργία εμβολιακού» starts an **empty** plan. The steps fill it, one button each, with clear visual feedback.
- Step 1 adds names and days only. Quantities come in a 4th step «Ποσότητες» (user picked the recommended option). More steps may come later.

## Database (SQL for the user)

```sql
-- which steps of the hatch's εμβολιακό are done ('base', 'inj1', 'inj2', 'qty'); a step can be done with 0 lines
alter table hatch_plans add column steps_done text[] not null default '{}';
-- every εμβολιακό made before this was built in one go: all its steps count as done
update hatch_plans set steps_done = array['base', 'inj1', 'inj2', 'qty'];
```

## Design

- **Layout:** the hatch sheet becomes a two-column grid.
  - Left: header, step bar, tools («+ Εμβόλιο», «Πληρώνει πελάτης…», print) and the lines table, which scrolls (max height = window).
  - Right, sticky: Νεοσσοί (✎ + ↻), the customers table (Κ/Λ/C, notes in full, total + ΥΠΟΛΟΙΠΑ), and under each customer «θυμάται: …». That line is built from customer memory: injections per round (★ when nothing is remembered), what they pay themselves, and the «μόνο με» water vaccines.
  - On a phone the right column goes under the plan.
- **Steps** (`VAX_STEPS`, in order; each = { key, label, run, undo }):
  1. `base` Βασικά εμβόλια:
     - the template's general rows, with the «μόνο με» rows when such a customer is in;
     - each paying customer's share line, as now;
     - posotita empty. Customer-driven lines are to_check.
  2. `inj1` Ενέσιμα ημ. 60: opens the existing Ενέσιμα window (memory / ★). Its OK marks the step done, even with 0 lines.
  3. `inj2` Ενέσιμα ημ. 82: the same for round 2.
  4. `qty` Ποσότητες:
     - a list of every empty quantity on template lines, with what it will become (template rule × chicks, shares × their birds); OK fills them;
     - typed quantities are never touched.
- **Step bar:**
  - done = green ✓ + «N γραμμές» + «Αναίρεση». Re-open stays for inj1/inj2.
  - next = blue outline + button.
  - later = dashed, «μετά το N».
  - «Ενεργοποίηση» appears once every step is done. The existing to_check question stays.
- **Undo a step:**
  - base: removes the step's lines (general and share lines);
  - inj1/inj2: removes that round's lines;
  - qty: empties the quantities it filled on unordered lines.
  - Ordered lines → the ordered-line question first.
  - The step is removed from steps_done, with history.
- **Unchanged:** «+ Εμβόλιο», «Πληρώνει πελάτης…», Νεοσσοί recalculation (it still only touches lines with a quantity), to_check, the bin, reminders.
  - The reminder banner's "draft" state still counts.
  - The hatch cards show «βήμα N/4» for a draft.

## Tasks

1. SQL above (user) → verify.
2. Two-column sheet + right panel with memory lines.
3. Steps: VAX_STEPS, step bar, empty create, base/qty runs, inj1/inj2 done on window OK, undo, Ενεργοποίηση gate, cards «βήμα N/4».
4. Checks: new `steps_checks.js`; update suites that relied on create-with-lines (vax, usual, template); EL + EN; desktop + phone screenshots.
5. Commit on the user's word (includes the uncommitted «↻ Από τον Προγραμματισμό» button).
