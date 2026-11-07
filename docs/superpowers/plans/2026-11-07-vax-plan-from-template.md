# Εμβολιακό from the template: DOC total, lines to check, who pays, water memory

**Goal:** make «Δημιουργία εμβολιακού» work as the user's wizard: the template (set vaccines on set days), plus
each customer's extras in a highlight colour until checked, plus who pays, built on the scheduler's total chicks.
It is not a new wizard screen. The create window builds the draft and the hatch sheet is where it gets finished.

**User decisions (2026-11-07):**
- DOC total = the scheduler's «Νεοσσοί» only. If that is empty, the box is blank with a red note. The customers' sum is never used.
- Customer extras get a colour + «προς έλεγχο» until one click marks them checked. «Ενεργοποίηση» asks if any are left.
- A customer can pay for a whole-house (water) vaccine: **their share** (their birds) becomes its own line, paid by them.

**Constraints:** beta + Βασικό εμβολιακό page only; the scheduler is never written; DB changes as SQL for the
user; stubbed data in tests; every existing rule stays (drafts, locked fields, ordered-quantity question, bin…).

## Database (SQL for the user)

```sql
-- lines added because of a customer, until someone checks them
alter table emvolia add column to_check boolean not null default false;
-- round 0 = whole-house vaccines this customer pays for themselves (vaccine = the programme's vaccine)
alter table customer_injectables drop constraint customer_injectables_round_check;
alter table customer_injectables add constraint customer_injectables_round_check check (round in (0, 1, 2));
```

## Tasks

0. **Customers of the placement, from the scheduler (user, 2026-11-07).**
   - Shown in the create window, replacing today's «name · birds» list. Also shown in the hatch sheet, under its header and open by default.
   - The table matches the scheduler's: Πελάτης, Κ, Λ, C, Σύνολο, plus a total row and capacity.
   - Notes are shown **in full** under each name, not behind ⓘ, because they hold vaccine wishes (e.g. «ΧΩΡΙΣ ΕΜΒ. ΚΟΚΚΙΔΙΑΣΗΣ»).
   - Note rule, the same as the scheduler's:
     - a `note` field when present (2027+ tabs);
     - otherwise the text after « - » in the name (older tabs).
   - The parsing goes in common.js as `customerNote(c)`, next to `customerName`. Customers with 0 birds are listed too (their note may matter) but get no lines.
   - The scheduler is read only. In the hatch sheet it is read fresh, so changes made there show here.
1. **DOC total.** `openCreateVax`: Νεοσσοί = `p.chicks` or blank + red note «Δεν έχει συμπληρωθεί στον
   Προγραμματισμό — πληκτρολογήστε ή συμπληρώστε τον πρώτα». Remove the fallback to the customers' sum.
2. **Lines to check.**
   - `newVaxRows` sets `to_check: true` on:
     - every customer injection line;
     - every line from a «μόνο με …» programme row;
     - every paying customer's share line (task 4).
   - Lines added later get the same flag. That covers the Ενέσιμα window, `syncConditional` and a share split.
   - Shown in the hatch sheet and the main table in a highlight colour, with a «προς έλεγχο» button. One click sets `to_check = false` and writes a history entry.
   - «Ενεργοποίηση» asks: «{n} γραμμές δεν έχουν ελεγχθεί. Ενεργοποίηση;».
3. **Who pays, shown.**
   - Hatch sheet: the Πελάτης cell shows «πληρώνει ο πελάτης» when `payer` is set.
   - Main table: a small tag in the Πελάτης cell.
4. **Customer's share of a water vaccine.**
   - Memory: `customer_injectables` rows with round 0 (customer, vaccine, payer 'customer').
   - New εμβολιακό: for each whole-house line whose vaccine a customer in the hatch pays for:
     - house line quantity = rule applied to (chicks − their birds);
     - their line quantity = rule applied to their birds, with pelatis = payer = that customer and to_check set.
   - Each part is rounded on its own, so the total can come out a little above one line's.
   - In the hatch sheet, a house line gets «Πληρώνει πελάτης…»: pick a customer of the hatch, the line splits as above, and the choice is remembered. «Δεν πληρώνει πλέον» merges the share back and forgets it.
   - Ordered lines are never split or merged without the ordered-line question.
5. **Water vaccines that learn.**
   - «+ Εμβόλιο» in the hatch sheet gets a tick: «Πάντα όταν υπάρχει ο πελάτης [customer of the hatch]».
   - It adds that customer to `only_customers` of the programme row with that vaccine and day, creating the row if it is missing (kind general, rule placed, same unit).
   - The Βασικό εμβολιακό page shows it as «μόνο με …» like E.COLI.
6. **Names.**
   - Tab link «🗓 Βασικό εμβολιακό» → «🗓 Πρότυπο εμβολιακού».
   - Page title follows.
   - Create button → «Δημιουργία εμβολιακού από το πρότυπο».
7. **Checks.**
   - New `template_checks.js`:
     - blank DOC + note; no customer fallback;
     - to_check flags and colours; one-click check and history; activation question;
     - payer tag;
     - share split on creation and from the sheet; merge back; memory rows;
     - learn tick writes `only_customers`;
     - EL + EN translations.
   - All existing suites stay green. Screenshots.
8. **Commit** on the user's word.
