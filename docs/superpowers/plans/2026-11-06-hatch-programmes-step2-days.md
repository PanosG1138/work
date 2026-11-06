# Hatch programmes — Step 2: Several days per programme row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One programme row can carry several days of age ("NEMOVAC TRT · 27, 75") with one quantity rule; the beta's new-hatch window expands each day into its own line.

**Architecture:** `vaccine_programme.day integer` becomes `days integer[]` (database SQL run by the user). The programme page edits the list as text "27, 75" through a small `parseDays` helper; the beta's `pickPlan` uses `flatMap` over `days`. Injection placeholder rows keep exactly one day (database check + form check).

**Tech Stack:** plain HTML/JS, Supabase/PostgREST (`order=days.asc` sorts arrays), common.js v=14 unchanged.

**Spec:** `docs/superpowers/specs/2026-11-06-hatch-programmes-and-bin-design.md` (section 2).

## Global Constraints

- Days of age, never fixed dates: a line's date is always hatch date + day.
- No automatic merging of the user's rows; existing rows become one-day lists.
- Every visible Greek text through `data-t` / `t()` with English; "no missing translations" in EN.
- Code style: clear names, short comments, `// ── NAME ──` banners.
- Stubbed data only; database changes are SQL the user runs in the SQL Editor, verified afterwards with `execute_sql`.
- Never commit or push without the user's "commit and push now". Run /ponytail-review before committing.
- Edits by a script that normalises CRLF, asserts each replacement matches exactly once, writes only at the end.

---

### Task 1: Programme page edits a list of days

**Files:**
- Modify: `vaccine_programme.html`
- Test: `<session scratchpad>/vp_checks.js` (existing, served on :8766)

**Interfaces:**
- Produces: `parseDays(text) → number[] | null` (sorted, unique, all whole ≥ 1; null if empty or invalid); rows carry `days: number[]`.

- [ ] **Step 1: Update the checks first** — in `vp_checks.js`:
  - stub rows `day: N` → `days: [N]`; give TARTYLL (id 3) `days: [24, 52]`;
  - add after the ruleText checks:

```js
    check('parseDays sorts + dedupes', JSON.stringify(parseDays('75, 27 ,27')) === '[27,75]');
    check('parseDays spaces only', JSON.stringify(parseDays('8 38')) === '[8,38]');
    check('parseDays refuses 0 / text / empty', parseDays('0, 5') === null && parseDays('ημ 5') === null && parseDays(' ') === null);
```

  - add after `check('programme rows drawn', …)`:

```js
    check('days shown joined', document.querySelector('#prog-body tr:nth-child(3) td').textContent === '24 · 52');
```

  - the "day 0 refused" block: `document.getElementById('m-day')` → `m-days` (both places, value `'0'` then `'30'`);
  - after `check('fixed row inserted', …)` add:

```js
    check('days saved as a list', writes.some(w => w.startsWith('POST vaccine_programme') && w.includes('"days":[30]')));
    openProg(3);
    check('edit shows the days', document.getElementById('m-days').value === '24, 52');
    document.getElementById('m-days').value = '52, 24, 80'; await saveProg();
    check('several days patched', writes.some(w => w.startsWith('PATCH vaccine_programme?id=eq.3') && w.includes('"days":[24,52,80]')));
    openProg(4); document.getElementById('m-days').value = '60, 61';
    const beforeInj = writes.length; await saveProg();
    check('injections: one day only', writes.length === beforeInj); closeProg();
```

- [ ] **Step 2: Run to see them fail** — preview `vaccine_programme.html?r=1`, inject `http://localhost:8766/vp_checks.js`, `await runChecks()`. Expected: `ReferenceError: parseDays is not defined` (or FAILs).

- [ ] **Step 3: Implement** — edit script on `vaccine_programme.html`:

(a) form field

```html
    <div class="fgroup"><label data-t>Ημέρα</label><input type="number" id="m-day" min="1" step="1"></div>
```
→
```html
    <div class="fgroup"><label data-t>Ημέρες</label><input type="text" id="m-days" data-t-placeholder placeholder="π.χ. 27, 75"></div>
```

(b) table header `<th data-t>Ημέρα</th>` → `<th data-t>Ημέρες</th>`

(c) fetch `${PROG}?order=day.asc,id.asc` → `${PROG}?order=days.asc,id.asc`

(d) table cell `<td>${r.day}</td>` → `<td>${r.days.join(' · ')}</td>`

(e) helper, inserted right before `// how a programme row's quantity is worked out, in words`:

```js
// "27, 75" → [27, 75]: sorted, no repeats; null if empty or any part isn't a whole number from 1 up
function parseDays(text) {
  const days = String(text).split(/[\s,]+/).filter(Boolean).map(Number);
  if (!days.length || days.some(d => !Number.isInteger(d) || d < 1)) return null;
  return [...new Set(days)].sort((a, b) => a - b);
}
```

(f) openProg default row `{ day: '', kind: 'general', …` → `{ days: [], kind: 'general', …`; `set('m-day', r.day);` → `set('m-days', r.days.join(', '));`

(g) saveProg

```js
  const row = { day: Number(g('m-day')), kind: g('m-kind'), …
  if (!Number.isInteger(row.day) || row.day < 1) { toast(t('Η ημέρα πρέπει να είναι ακέραιος από 1 και πάνω.'), true); return; }
```
→
```js
  const row = { days: parseDays(g('m-days')), kind: g('m-kind'), …   (rest of the object unchanged)
  if (!row.days) { toast(t('Οι ημέρες πρέπει να είναι ακέραιοι από 1 και πάνω, χωρισμένοι με κόμμα.'), true); return; }
  if (row.kind !== 'general' && row.days.length > 1) { toast(t('Τα ενέσιμα έχουν μία μόνο ημέρα.'), true); return; }
```

(h) sort after save `.sort((a, b) => a.day - b.day || a.id - b.id)` → `.sort((a, b) => a.days[0] - b.days[0] || a.id - b.id)`

(i) delete confirm `day: r.day` → `day: r.days.join(', ')`; message key `'Διαγραφή της γραμμής «{name}» (ημέρα {day});'` → `'Διαγραφή της γραμμής «{name}» (ημέρες {day});'` in both the call and the translations (EN `'Delete the row «{name}» (days {day})?'`).

(j) translations: replace `'Η ημέρα πρέπει να είναι ακέραιος από 1 και πάνω.': …` with

```js
  'Οι ημέρες πρέπει να είναι ακέραιοι από 1 και πάνω, χωρισμένοι με κόμμα.': 'The days must be whole numbers from 1 up, separated by commas.',
  'Τα ενέσιμα έχουν μία μόνο ημέρα.': 'Injections have one day only.', 'Ημέρες': 'Days', 'π.χ. 27, 75': 'e.g. 27, 75',
```
and drop `'Ημέρα': 'Day'` if nothing else on the page uses it (grep `Ημέρα'` / `>Ημέρα<` first).

- [ ] **Step 4: Run the checks** — EL and EN: all PASS, `missing:` empty.

### Task 2: Beta new-hatch window expands days; leftovers

**Files:**
- Modify: `vaccine_tracker_beta.html`, `backup.py`
- Test: `<session scratchpad>/plan_checks.js` (existing)

**Interfaces:**
- Consumes: programme rows with `days: number[]` (Task 1 / SQL).

- [ ] **Step 1: Update the checks first** — in `plan_checks.js`: stub rows `day: N` → `days: [N]`, and make TARTYLL (id 3) `days: [24, 52]`. Then:
  - `'general rows from programme'` expects `4` table rows (was 3);
  - `'fixed row text'` reads `plan.general[2]` — still TARTYLL day 24 after sorting by date, keep;
  - add after it:

```js
    check('second day = own line, own date', plan.general[3].vaccine === 'TARTYLL' && plan.general[3].date === subDays(today, -52));
    check('lines sorted by date', plan.general.every((g, i, a) => !i || a[i - 1].date <= g.date));
```
  - `'rows saved: 3 general + 2 round-1'` → `4 general`, count `6`; `'general rows: no customer, we pay'` → `=== 4`; history `=== 6`; `'rows shown in the table'` → `before + 6`;
  - `'round-up switch only on placed rows'` stays 2.

- [ ] **Step 2: Run to see them fail** — `vaccine_tracker_beta.html?r=1`, expected FAIL on the 4-line / date checks.

- [ ] **Step 3: Implement**

(a) `sbFetch('vaccine_programme?order=day.asc,id.asc')` → `sbFetch('vaccine_programme?order=days.asc,id.asc')`

(b) in `pickPlan`:

```js
  const general = planData.programme.filter(r => r.kind === 'general').map(r => ({ include: true, vaccine: r.vaccine,
    date: subDays(p.doc_date, -r.day), posotita: …
```
→
```js
  // one line per day of age; a row with days 27 · 75 gives two lines, sorted by date with the rest
  const general = planData.programme.filter(r => r.kind === 'general').flatMap(r => r.days.map(day => ({ include: true, vaccine: r.vaccine,
    date: subDays(p.doc_date, -day), posotita: …
```
closing `prog: r, round_to: r.round_to }));` → `prog: r, round_to: r.round_to })))
    .sort((a, b) => a.date.localeCompare(b.date));`

(c) `subDays(p.doc_date, -placeholder.day)` → `subDays(p.doc_date, -placeholder.days[0])`

(d) leftover from step 1 (links left the header): delete from the phone CSS

```css
  /* hide Απόθεμα text, keep emoji */
  a.btn-tool[href="inventory.html"]{font-size:0}
  a.btn-tool[href="inventory.html"]::before{content:"📦";font-size:16px}
  a.btn-tool[href="vaccine_programme.html"]{font-size:0}
  a.btn-tool[href="vaccine_programme.html"]::before{content:"🗓";font-size:16px}
```

(e) `backup.py`: `fetch("vaccine_programme",    "day.asc")` → `fetch("vaccine_programme",    "days.asc")` (the list is written as `[27, 75]` by the existing json.dumps).

- [ ] **Step 4: Run the checks** — plan_checks EL + EN all PASS; tabs_checks still 12/12.

### Task 3: Database change, verify, commit

- [ ] **Step 1: Give the user this SQL** (SQL Editor). Explain: between running it and the push, the live programme page and the beta's new-hatch window can't load the programme.

```sql
alter table vaccine_programme add column days integer[];
update vaccine_programme set days = array[day];
alter table vaccine_programme
  alter column days set not null,
  add constraint vaccine_programme_days_valid check (cardinality(days) >= 1 and 1 <= all(days)),
  add constraint vaccine_programme_injectables_one_day check (kind = 'general' or cardinality(days) = 1);
alter table vaccine_programme drop column day;
```

- [ ] **Step 2: Verify** with `execute_sql`: `select id, kind, vaccine, days from vaccine_programme order by days, id` — every row has a one-element list equal to its old day; column `day` gone.

- [ ] **Step 3: Ponytail review**, then on "commit and push now":

```bash
git add vaccine_programme.html vaccine_tracker_beta.html backup.py docs/superpowers/plans/2026-11-06-hatch-programmes-step2-days.md
git commit -m "Vaccine programme: several days per row (days list)"
```
(ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, confirm Pages serves `m-days`.

- [ ] **Step 4: Tell the user** how to merge repeated rows by hand (edit one row to "27, 75", delete the other) — nothing is merged automatically.
