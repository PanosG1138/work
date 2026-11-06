# Hatch εμβολιακά — Step 3a: data, Εμβολιακά tab, create / view / activate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every scheduler hatch can get its own living εμβολιακό whose lines are the tracker rows themselves: create it from the Βασικό εμβολιακό (as draft lines), see it per house in an Excel-like sheet, open any line in the tracker's edit window, and activate it. Hatch date/house changes in the scheduler move the hatch's rows.

**Architecture:** `emvolia.draft` marks lines of a not-yet-activated εμβολιακό; `hatch_plans` holds one record per placement (Νεοσσοί, corrected customers, activated_at). Lines are matched to their hatch by `anath` + `hm_ekk`. A `placements` trigger shifts rows on date/house change. The beta's step-2 "plan a hatch" window is removed and replaced by the Εμβολιακά tab (house cards + sheet + a small create box). 3b adds editing inside the sheet.

**Tech Stack:** plain HTML/JS, Supabase (PostgREST, plpgsql trigger), common.js v=14.

**Spec:** `docs/superpowers/specs/2026-11-06-hatch-programmes-and-bin-design.md` (Names, section 3, 3a items).

## Global Constraints

- One εμβολιακό per hatch, never locked; its lines ARE the `emvolia` rows of that hatch (anath + hm_ekk).
- Days of age, never fixed dates: a new line's date = hatch date + day; the age shown = hm_emv − hm_ekk.
- The scheduler (`placements`) is never written by the beta.
- Draft lines: faded + "πρόχειρο" tag in the beta, left out of the beta counts; `vaccine_tracker.html` and `index.html` read only `draft=is.false`.
- Names: **Βασικό εμβολιακό** (template page), **Εμβολιακό / Εμβολιακά** (per hatch / tab). "Aviary" never translated.
- Every visible Greek text through `data-t` / `t()` with English; "no missing translations" in EN.
- Code style: clear names, short comments, `// ── NAME ──` banners.
- Stubbed data only. Database changes = SQL for the user's SQL Editor, verified with `execute_sql`. The trigger is tested only inside a rolled-back transaction on made-up rows, after asking the user.
- Never commit or push without the user's "commit and push now". /ponytail-review before committing.
- Edits by a script that normalises CRLF, asserts each replacement matches exactly once, writes only at the end.

---

### Task 1: Database (SQL for the user)

- [ ] **Step 1: Give the user this SQL.** It adds a column whose default (`false`) leaves every existing row exactly as it is, a new table, and a trigger that only acts on future scheduler edits. Say: run it, then "commit and push" right away — between the two, the live tracker and homepage still work (they don't filter yet), but nothing should be created in the beta.

```sql
-- lines of a not-yet-activated εμβολιακό
alter table emvolia add column draft boolean not null default false;

-- one εμβολιακό record per scheduler hatch: Νεοσσοί, corrected customers, activation
create table hatch_plans (
  id bigint generated always as identity primary key,
  placement_id uuid not null unique references placements(id) on delete cascade,
  chicks integer not null check (chicks > 0),
  customers jsonb not null default '[]',
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table hatch_plans enable row level security;
create policy "hatch_plans select" on hatch_plans for select to authenticated using (true);
create policy "hatch_plans insert" on hatch_plans for insert to authenticated with check (true);
create policy "hatch_plans update" on hatch_plans for update to authenticated using (true) with check (true);
create policy "hatch_plans delete" on hatch_plans for delete to authenticated using (true);
grant select, insert, update, delete on hatch_plans to authenticated;

-- a hatch's date or house changes in the scheduler → its tracker rows move with it (matched by house + old date)
create or replace function shift_hatch_rows() returns trigger language plpgsql set search_path = public as $$
declare
  delta integer := new.doc_date - old.doc_date;
  r emvolia;
begin
  if new.doc_date = old.doc_date and new.house = old.house then return new; end if;
  for r in select * from emvolia where anath = old.house and hm_ekk = old.doc_date loop
    update emvolia set anath = new.house, hm_ekk = new.doc_date,
      hm_emv = hm_emv + delta, hm_paragelia = hm_paragelia + delta,
      updated_at = now(), updated_by = 'Αυτόματα'
    where id = r.id;
    insert into emvolia_history (row_id, action, user_name, ts, changes_json)
    values (r.id, 'edited', 'Αυτόματα (αλλαγή εκκόλαψης)', now(), jsonb_strip_nulls(jsonb_build_object(
      'hm_ekk', case when delta <> 0 then jsonb_build_object('label', 'Ημ. Εκκόλαψης', 'from', r.hm_ekk, 'to', new.doc_date) end,
      'anath', case when new.house <> old.house then jsonb_build_object('label', 'Αναθρεπτήριο', 'from', r.anath, 'to', new.house) end,
      'hm_emv', case when delta <> 0 and r.hm_emv is not null then jsonb_build_object('label', 'Ημ. Εμβολιασμού', 'from', r.hm_emv, 'to', r.hm_emv + delta) end,
      'hm_paragelia', case when delta <> 0 and r.hm_paragelia is not null then jsonb_build_object('label', 'Ημ. Παραγγελίας', 'from', r.hm_paragelia, 'to', r.hm_paragelia + delta) end
    ))::text);
  end loop;
  return new;
end $$;
create trigger placements_shift_hatch_rows after update of doc_date, house on placements
  for each row execute function shift_hatch_rows();
```

- [ ] **Step 2: Verify** with `execute_sql`: `emvolia.draft` exists and `count(*) where draft` = 0; `hatch_plans` + 4 policies (`pg_policies`); trigger in `information_schema.triggers`.

- [ ] **Step 3: Trigger test, rolled back** — ask the user first; then one `execute_sql`:

```sql
do $$
declare pid uuid; e1 bigint; got text;
begin
  insert into placements (house, doc_date, status) values ('ΤΕΣΤ', '2030-01-10', 'Not ordered') returning id into pid;
  insert into emvolia (anath, hm_ekk, hm_emv, hm_paragelia, emvolio, draft) values ('ΤΕΣΤ', '2030-01-10', '2030-01-18', '2029-12-19', 'X', true) returning id into e1;
  insert into emvolia (anath, hm_ekk, hm_emv, emvolio) values ('ΤΕΣΤ', '2030-01-11', '2030-01-19', 'OTHER HATCH');
  update placements set doc_date = '2030-01-07' where id = pid;
  select string_agg(format('%s %s %s %s', emvolio, hm_ekk, hm_emv, hm_paragelia), ' | ' order by id) into got from emvolia where anath = 'ΤΕΣΤ';
  got := got || ' || history: ' || (select changes_json from emvolia_history where row_id = e1 order by id desc limit 1);
  raise exception 'ROLLBACK OK: %', got;
end $$;
```
Expected error text: `X 2030-01-07 2030-01-15 2029-12-16 | OTHER HATCH 2030-01-11 2030-01-19 <NULL>` + a history json with hm_ekk / hm_emv / hm_paragelia from → to. Then `select count(*) from emvolia where anath = 'ΤΕΣΤ'` = 0 and `select count(*) from placements where house = 'ΤΕΣΤ'` = 0.

### Task 2: Checks first

**Files:** Test: `<session scratchpad>/vax_checks.js` (replaces `plan_checks.js`; `tabs_checks.js` updated).

- [ ] **Step 1: Write `vax_checks.js`:**

```js
// Checks for the beta's Εμβολιακά tab — stubbed data only. Load into vaccine_tracker_beta.html, then `await runChecks()`.
(() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  window.runChecks = async () => {
    const out = [], check = (n, ok) => out.push((ok ? 'PASS ' : 'FAIL ') + n), writes = [];
    const today = todayIso(), d = n => subDays(today, -n);
    const P3 = subDays(today, 10);   // Θ5 hatched 10 days ago, entered the old way
    const PROGRAMME = [
      { id: 1, days: [8],      kind: 'general', vaccine: 'SALMOVAC', rule: 'placed', extra_pct: 5, divide_by: 1, round_to: 1000, fixed_qty: null, unit: 'Δόσεις' },
      { id: 2, days: [15],     kind: 'general', vaccine: 'IB 4/91', rule: 'placed', extra_pct: 30, divide_by: 2, round_to: 10000, fixed_qty: null, unit: 'Δόσεις' },
      { id: 3, days: [24, 52], kind: 'general', vaccine: 'TARTYLL', rule: 'fixed', extra_pct: 0, divide_by: 1, round_to: 1000, fixed_qty: 5, unit: 'Κιλά' },
      { id: 4, days: [60],     kind: 'injectables_1', vaccine: null, rule: 'placed', extra_pct: 0, divide_by: 1, round_to: 1000, fixed_qty: null, unit: 'Δόσεις' },
    ];
    const INJ = [{ id: 1, round: 1, vaccine: 'SG-9R', sort: 1 }, { id: 2, round: 1, vaccine: 'ΚΟΡΥΖΑ', sort: 2 }];
    const USUAL = [{ customer: 'Συντιχάκης', round: 1, vaccine: 'SG-9R', payer: 'customer' }, { customer: 'Κόκος', round: 1, vaccine: 'ΚΟΡΥΖΑ', payer: 'us' }];
    const PLACEMENTS = [
      { id: 'p1', house: 'Θ3', doc_date: d(33), breed: 'Hy-Line', chicks: null, customers: [
        { name: 'Συντιχάκης', k: 15000, l: 1400, c: 0 }, { name: 'Κόκος - σημείωση', k: 6000, l: 3000, c: 0 },
        { name: 'Κόκος', k: 1000, l: 0, c: 0 }, { name: 'Παπαγιάννης', k: 0, l: 0, c: 0 }] },
      { id: 'p2', house: 'Θ4', doc_date: d(18), breed: 'ISA', chicks: 40000, customers: [] },
      { id: 'p3', house: 'Θ5', doc_date: P3, breed: 'Hy-Line', chicks: 70000, customers: [] },
    ];
    const ROWS = [
      { id: 1, anath: 'Θ5', hm_ekk: P3, hm_emv: subDays(P3, -8), hm_paragelia: subDays(P3, 22), emvolio: 'SALMOVAC', posotita: '70000', paragelia: 'ΝΑΙ', hm_par: subDays(P3, 25), draft: false, updated_at: 'x' },
      { id: 2, anath: 'Θ5', hm_ekk: P3, hm_emv: subDays(P3, -15), hm_paragelia: subDays(P3, 15), emvolio: 'IB 4/91', posotita: '50000', paragelia: null, draft: false, updated_at: 'x' },
      { id: 3, anath: 'Θ5', hm_ekk: P3, hm_emv: subDays(P3, -60), hm_paragelia: subDays(P3, -30), emvolio: 'SG-9R', posotita: '10000', pelatis: 'ΚΟΚΟΣ', sxolia_panos: 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ Θ5', draft: false, updated_at: 'x' },
    ];
    let planId = 50;
    window.sbFetch = async (p, o = {}) => {
      if (o.method) {
        writes.push(`${o.method} ${p} ${o.body || ''}`);
        const body = o.body ? JSON.parse(o.body) : null;
        if (o.method === 'DELETE') return null;
        if (p.startsWith('hatch_plans') && o.method === 'POST') return [{ id: planId++, ...body }];
        if (p.startsWith('hatch_plans') && o.method === 'PATCH') return [{ id: Number(p.split('eq.')[1]), placement_id: 'p1', chicks: 26400, customers: [], ...body }];
        if (p.startsWith('emvolia?id=in.') && o.method === 'PATCH') return p.match(/\((.*)\)/)[1].split(',').map(id => ({ id: Number(id), ...body }));
        if (p === 'emvolia' && o.method === 'POST') return [{ id: 100 + writes.length, ...body }];
        return null;
      }
      if (p.startsWith('vaccine_programme')) return JSON.parse(JSON.stringify(PROGRAMME));
      if (p.startsWith('injectables')) return JSON.parse(JSON.stringify(INJ));
      if (p.startsWith('customer_injectables')) return JSON.parse(JSON.stringify(USUAL));
      if (p.startsWith('vaccines')) return [{ name: 'SALMOVAC', supplier: 'FAENTINA' }, { name: 'IB 4/91', supplier: '' }, { name: 'TARTYLL', supplier: '' },
        { name: 'SG-9R', supplier: 'ΤΡΑΙΚΟΥΔΗΣ' }, { name: 'CORIPRAVAC', supplier: '' }, { name: 'BIONEW BI + COR', supplier: '' }];
      if (p.startsWith('placements')) return JSON.parse(JSON.stringify(PLACEMENTS));
      if (p.startsWith('hatch_plans')) return [];
      if (p.startsWith('emvolia?select=id')) return [];
      if (p.startsWith('emvolia')) return JSON.parse(JSON.stringify(ROWS));
      return [];
    };
    window.confirm = () => true;
    const cb = [..._sb.auth.stateChangeEmitters.values()].pop().callback;
    cb('INITIAL_SESSION', { user: { id: 'u1', email: 'panos@internal.local', user_metadata: { lang: LANG } }, access_token: 't' });
    await wait(1200);

    // pure rules
    check('placementCustomers cleans + adds up', JSON.stringify(placementCustomers(PLACEMENTS[0])) === JSON.stringify([{ name: 'Συντιχάκης', qty: 16400 }, { name: 'Κόκος', qty: 10000 }]));
    check('roundOf by the ΕΝΕΣΙΜΑ note', roundOf(ROWS[2]) === 1 && roundOf(ROWS[0]) === 0 && roundOf({ sxolia_panos: 'ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ Θ1' }) === 2);
    check('ageOf', ageOf(ROWS[0]) === 8);

    // tab + cards
    showTab('vax'); await wait(300);
    const cards = [...document.querySelectorAll('#vax-cards .vax-house')];
    check('cards Θ1–Θ5, Α1 only with a hatch', cards.map(c => c.querySelector('b').textContent).join() === 'Θ1,Θ2,Θ3,Θ4,Θ5');
    check('Θ3 hatch: χωρίς εμβολιακό', cards[2].textContent.includes(t('χωρίς εμβολιακό')));

    // sheet of the old-way hatch
    openSheet('p3');
    const sheet = () => document.getElementById('vax-sheet');
    check('sheet: 2 general lines then ΠΡΩΤΑ ΕΝΕΣΙΜΑ group', [...sheet().querySelectorAll('tbody tr')].map(tr => tr.classList.contains('vax-grp') ? 'G' : 'L').join('') === 'LLGL');
    check('sheet: ordered ✓, late order red', !!sheet().querySelector('.ord-yes') && !!sheet().querySelector('.ord-late'));
    check('sheet: age column', sheet().querySelector('tbody td').textContent === '8');
    check('sheet: create button', !!sheet().querySelector('button[onclick="openCreateVax()"]'));

    // line click opens the tracker's edit window with the age
    sheet().querySelector('tbody tr').click(); await wait(50);
    check('line → edit window with age', document.getElementById('modal-bg').style.display !== 'none' && document.getElementById('m-age').textContent === t('ημ. {n}', { n: 8 }));
    closeModal();
    check('closing clears the age', document.getElementById('m-age').textContent === '');

    // create for the old-way hatch: record only, active, customers from its rows
    openCreateVax();
    check('old-way box explains', document.getElementById('vaxnew-body').textContent.includes(t('Η εκκόλαψη έχει ήδη γραμμές: δημιουργείται μόνο το εμβολιακό της, ενεργό, χωρίς να αλλάξει καμία γραμμή.')));
    let n = writes.length;
    await createVax();
    const oldPost = writes.slice(n).find(w => w.startsWith('POST hatch_plans'));
    check('old-way: record active, no rows added', oldPost && !oldPost.includes('"activated_at":null') && !writes.slice(n).some(w => w.startsWith('POST emvolia ')));
    check('old-way: customers from rows', oldPost.includes('"name":"ΚΟΚΟΣ","qty":10000'));
    check('old-way: active late count on card', document.querySelector('#vax-cards').textContent.includes(t('{n} χωρίς παραγγελία', { n: 1 })));

    // create for a new hatch
    openSheet('p1'); openCreateVax();
    check('box: chicks = booked total', document.getElementById('vaxnew-chicks').value === '26.400');
    check('box: ΚΟΡΥΖΑ asked for round 1 only', !!document.getElementById('vaxnew-coryza-1') && !document.getElementById('vaxnew-coryza-2'));
    n = writes.length;
    await createVax();
    check('no ΚΟΡΥΖΑ product → nothing created', !writes.slice(n).some(w => w.startsWith('POST')));
    document.getElementById('vaxnew-coryza-1').value = 'CORIPRAVAC';
    n = writes.length;
    await createVax(); await wait(50);
    const posted = writes.slice(n).filter(w => w.startsWith('POST emvolia ')).map(w => JSON.parse(w.slice(w.indexOf('{'))));
    check('record draft', writes.slice(n).some(w => w.startsWith('POST hatch_plans') && w.includes('"activated_at":null') && w.includes('"chicks":26400')));
    check('6 draft lines (4 general + 2 injections)', posted.length === 6 && posted.every(r => r.draft === true));
    check('dates = hatch + day', posted.filter(r => !r.pelatis).map(r => r.hm_emv).join() === [8, 15, 24, 52].map(n => subDays(PLACEMENTS[0].doc_date, -n)).join());
    check('qty by template rule', posted.find(r => r.emvolio === 'SALMOVAC').posotita === '28000' && posted.find(r => r.emvolio === 'TARTYLL').posotita === '5 ΚΙΛΑ');
    check('injection: birds ↑1.000, customer pays', (r => r.posotita === '17000' && r.payer === 'ΣΥΝΤΙΧΑΚΗΣ' && r.sxolia_panos === 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ Θ3')(posted.find(r => r.emvolio === 'SG-9R')));
    check('ΚΟΡΥΖΑ → chosen product, we pay', (r => r && r.pelatis === 'ΚΟΚΟΣ' && r.payer === null)(posted.find(r => r.emvolio === 'CORIPRAVAC')));
    check('order date = date − 30', posted.every(r => r.hm_paragelia === subDays(r.hm_emv, 30)));

    // tracker shows drafts faded, counts leave them out
    check('tracker: draft rows faded + tagged', document.querySelectorAll('#tbody tr.row-draft').length === 6 && document.getElementById('tbody').textContent.includes(t('πρόχειρο')));
    check('tracker: counts exclude drafts', document.getElementById('stat-total').textContent === '3');
    check('tracker: age in date cell', document.getElementById('tbody').textContent.includes(t('ημ. {n}', { n: 15 })));

    // activate
    check('draft sheet: activate + delete buttons', !!sheet().querySelector('button[onclick="activateVax()"]') && !!sheet().querySelector('button[onclick="deleteVax()"]'));
    n = writes.length;
    await activateVax();
    check('activate: lines PATCHed draft=false', writes.slice(n).some(w => w.startsWith('PATCH emvolia?id=in.') && w.includes('"draft":false')));
    check('activate: record PATCHed', writes.slice(n).some(w => w.startsWith('PATCH hatch_plans?id=eq.') && w.includes('activated_at')));
    check('activate: counts include them', document.getElementById('stat-total').textContent === '9');
    check('activate: logged', writes.slice(n).some(w => w.startsWith('POST settings_history') && w.includes('"activated"')));

    // delete a draft εμβολιακό (Θ4, no customers)
    openSheet('p2'); openCreateVax(); await createVax(); await wait(50);
    const draftIds = data.filter(r => r.anath === 'Θ4' && r.draft).map(r => r.id);
    n = writes.length;
    await deleteVax();
    check('delete: lines + record removed, logged', writes.slice(n).some(w => w.startsWith(`DELETE emvolia?id=in.(${draftIds.join(',')})`))
      && writes.slice(n).some(w => w.startsWith('DELETE hatch_plans?id=eq.')) && writes.slice(n).some(w => w.startsWith('POST settings_history') && w.includes('"deleted"')));
    check('delete: rows gone from the table', !data.some(r => r.anath === 'Θ4'));

    check('scheduler never written', !writes.some(w => w.includes('placements')));
    check('no missing translations', LANG === 'el' || window.missingTranslations.size === 0);
    return out.join('\n') + (LANG === 'en' ? '\nmissing: ' + [...window.missingTranslations].join(' | ') : '');
  };
})();
```

- [ ] **Step 2: Update `tabs_checks.js`:** `'programmes'` → `'vax'` everywhere; the `'programmes panel has the plan button'` check → `check('vax panel has cards', !!document.getElementById('vax-cards'))`; the header link check also accepts the renamed link (unchanged href).

- [ ] **Step 3: Run both to see them fail** — `vaccine_tracker_beta.html?r=1`: `ReferenceError: placementCustomers is not defined` / tab FAILs.

### Task 3: Beta page

**Files:** Modify `vaccine_tracker_beta.html`.

**Interfaces — Produces (3b and step 4 build on these):** `vaxData`, `sheetHatchId`, `openVaxTab()`, `renderVax()`, `renderSheet()`, `openSheet(id)`, `hatchRows(p)`, `roundOf(r)`, `ageOf(r)`, `planOf(p)`, `vaxState(p)` ('none' | 'draft' | 'active'), `placementCustomers(p)`, `newVaxRows(p, chicks, customers, coryza)`, `logPlan(p, action, before, after)`, `posotitaText`, `pelatisName`, `dayDate`, `parseBirds`, `nfmt`.

- [ ] **Step 1: Remove the step-2 window** — delete:
  - the script block from `// ── PLAN A HATCH FROM THE PROGRAMME ──` up to (not including) `// Esc closes the plan window`, and the two-line Esc listener for `plan-bg` after it;
  - the `<!-- PLAN A HATCH FROM THE PROGRAMME … -->` modal markup (`plan-bg`);
  - the CSS block starting `/* plan a hatch from the programme (beta) */` (all `.plan-*` rules);
  - translations used only by it (grep each key in the page before removing).

- [ ] **Step 2: Add the HATCH ΕΜΒΟΛΙΑΚΑ block** where the removed block was:

```js
// ── HATCH ΕΜΒΟΛΙΑΚΑ ── (beta) one living εμβολιακό per scheduler hatch. Its lines ARE the tracker rows of the
// hatch (anath + hm_ekk); before Ενεργοποίηση they are draft rows (draft = true). Everything is by DAY OF AGE.
// Template: vaccine_programme.html (Βασικό εμβολιακό). Spec: docs/superpowers/specs/2026-11-06-hatch-programmes-and-bin-design.md
const PLANS = 'hatch_plans';
const VAX_HOUSES = ['Θ1', 'Θ2', 'Θ3', 'Θ4', 'Θ5', 'Α1'];   // Α1 shows only when it has a hatch
let vaxData = null;       // template, injectables, usual lists, suppliers, hatches, εμβολιακό records — read when the tab opens
let sheetHatchId = null;  // the hatch whose sheet is open (placement id)
let vaxNew = null;        // what the "Δημιουργία εμβολιακού" box was opened with

const UNIT_TEXT = { Κιλά: 'ΚΙΛΑ', Μπουκαλάκια: 'ΜΠΟΥΚΑΛΑΚΙΑ' };   // how Ποσότητα writes non-dose units
// Ποσότητα as the tracker stores it: "55000" for doses, "5 ΚΙΛΑ" otherwise
const posotitaText = (qty, unit) => UNIT_TEXT[unit] ? `${String(qty).replace('.', ',')} ${UNIT_TEXT[unit]}` : String(qty);
// Πελάτης as the tracker writes it: capitals without accents ("Βενιζέλος" → "ΒΕΝΙΖΕΛΟΣ")
const pelatisName = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const dayDate = (p, day) => subDays(p.doc_date, -day);   // day of age → date
const ageOf = r => r.hm_ekk && r.hm_emv ? Math.round((Date.parse(r.hm_emv) - Date.parse(r.hm_ekk)) / 864e5) : null;
const parseBirds = s => Number(String(s).trim().replace(/\./g, ''));   // "16.400" → 16400
const nfmt = n => Number(n).toLocaleString('el-GR');
const hatchRows = p => data.filter(r => r.anath === p.house && r.hm_ekk === p.doc_date);
// injection round of a line: the ΕΝΕΣΙΜΑ note the user has always written (0 = a general vaccine)
const roundOf = r => /^ΠΡΩΤΑ ΕΝΕΣΙΜΑ/.test(r.sxolia_panos || '') ? 1 : /^ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ/.test(r.sxolia_panos || '') ? 2 : 0;
const planOf = p => vaxData.plans.find(x => x.placement_id === p.id);
const vaxState = p => { const pl = planOf(p); return !pl ? 'none' : pl.activated_at ? 'active' : 'draft'; };
const VAX_STATE_LABEL = { none: 'χωρίς εμβολιακό', draft: 'πρόχειρο', active: 'ενεργό' };
// active lines whose order date has passed without an order
const lateOrders = p => hatchRows(p).filter(r => !r.draft && r.paragelia !== 'ΝΑΙ' && r.emvoliasmos !== 'ΝΑΙ' && r.hm_paragelia && r.hm_paragelia < todayIso());

// the scheduler's customers, cleaned: name before " - ", a name booked twice added up, 0 left out
function placementCustomers(p) {
  const booked = new Map();
  (p.customers || []).forEach(c => { const n = customerName(c.name); if (n) booked.set(n, (booked.get(n) || 0) + c.k + c.l + c.c); });
  return [...booked].filter(([, qty]) => qty > 0).map(([name, qty]) => ({ name, qty }));
}
// customers of a hatch entered the old way: the Πελάτης of its injection lines, birds from the scheduler when the name matches
function rowCustomers(p) {
  const sched = placementCustomers(p), rows = hatchRows(p).filter(r => roundOf(r) && r.pelatis && r.pelatis !== 'ΥΠΟΛΟΙΠΑ');
  return [...new Set(rows.map(r => r.pelatis))].map(name => {
    const s = sched.find(c => pelatisName(c.name) === name);
    return s || { name, qty: parseBirds(rows.find(r => r.pelatis === name).posotita) || 0 };
  });
}
// a new εμβολιακό's draft lines: every Βασικό εμβολιακό vaccine (one line per day) + each customer's usual injections
function newVaxRows(p, chicks, customers, coryza) {
  const base = { hm_ekk: p.doc_date, anath: p.house, hm_par: null, paragelia: null, psygeio: null, emvoliasmos: null, sxolia_eleni: null, draft: true };
  const line = (date, fields) => ({ ...base, hm_emv: date, hm_paragelia: subDays(date, 30), ...fields });
  const rows = vaxData.programme.filter(r => r.kind === 'general').flatMap(r => r.days.map(day => line(dayDate(p, day), {
    emvolio: r.vaccine, posotita: posotitaText(planQty(r, chicks), r.unit), pelatis: null, payer: null,
    promitheutis: vaxData.supplier[r.vaccine] || null, sxolia_panos: null })));
  [1, 2].forEach(round => {
    const placeholder = vaxData.programme.find(r => r.kind === `injectables_${round}`);
    if (!placeholder) return;   // a round whose ΕΝΕΣΙΜΑ row isn't in the template is skipped
    const cols = vaxData.injectables.filter(i => i.round === round).map(i => i.vaccine);
    customers.forEach(c => vaxData.usual.filter(u => u.customer === c.name && u.round === round && cols.includes(u.vaccine)).forEach(u => {
      const emvolio = u.vaccine === CORYZA ? coryza[round] : u.vaccine;
      rows.push(line(dayDate(p, placeholder.days[0]), { emvolio, posotita: String(Math.ceil(c.qty / 1000) * 1000),   // birds rounded up to 1.000
        pelatis: pelatisName(c.name), payer: u.payer === 'customer' ? pelatisName(c.name) : null,
        promitheutis: vaxData.supplier[emvolio] || null, sxolia_panos: `${round === 1 ? 'ΠΡΩΤΑ' : 'ΔΕΥΤΕΡΑ'} ΕΝΕΣΙΜΑ ${p.house}` }));
    }));
  });
  return rows.sort((a, b) => a.hm_emv.localeCompare(b.hm_emv));
}
// every change to an εμβολιακό record goes to settings_history (from → to of what changed)
function logPlan(p, action, before, after) {
  const changes = {};
  for (const k of ['chicks', 'customers', 'activated_at']) {
    const from = (before || {})[k] ?? null, to = (after || {})[k] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[k] = { from, to };
  }
  return sbFetch('settings_history', { method: 'POST', body: JSON.stringify({ table_name: PLANS, row_key: `${p.house} ${p.doc_date}`,
    action, user_name: currentUser, ts: new Date().toISOString(), changes_json: JSON.stringify(changes) }) });
}

// ── HATCH ΕΜΒΟΛΙΑΚΑ: house cards + sheet ──
async function openVaxTab() {
  try {
    const [programme, injectables, usual, vaccines, placements, plans] = await Promise.all([
      sbFetch('vaccine_programme?order=days.asc,id.asc'),
      sbFetch('injectables?order=round.asc,sort.asc'),
      sbFetch('customer_injectables?select=customer,round,vaccine,payer'),
      sbFetch('vaccines?select=name,supplier'),
      // hatches not yet binned (≤ 126 days old) up to 60 days ahead
      sbFetch(`placements?select=id,house,doc_date,breed,chicks,customers&doc_date=gte.${subDays(todayIso(), 126)}&doc_date=lte.${subDays(todayIso(), -60)}&order=doc_date.asc`),
      sbFetch(`${PLANS}?select=*`),
    ]);
    vaxData = { programme, injectables, usual, placements, plans, supplier: Object.fromEntries(vaccines.map(v => [v.name, v.supplier || ''])) };
  } catch (e) { document.getElementById('vax-cards').innerHTML = `<p class="tab-soon">${x(t('Σφάλμα φόρτωσης: {msg}', { msg: e.message }))}</p>`; return; }
  renderVax();
}
function renderVax() {
  if (!vaxData) return;
  const today = todayIso();
  const when = p => { const n = Math.round((Date.parse(p.doc_date) - Date.parse(today)) / 864e5);
    return n > 0 ? t('σε {n} ημ.', { n }) : t('ημ. {n}', { n: -n }); };
  const houses = [...new Set([...VAX_HOUSES, ...vaxData.placements.map(p => p.house)])];
  document.getElementById('vax-cards').innerHTML = houses.map(h => {
    const hatches = vaxData.placements.filter(p => p.house === h);
    if (!hatches.length && h === 'Α1') return '';
    return `<div class="vax-house"><b>${x(h)}</b>` + (hatches.map(p => {
      const st = vaxState(p), late = st === 'active' ? lateOrders(p).length : 0;
      return `<button class="vax-hatch${p.id === sheetHatchId ? ' on' : ''}" onclick="openSheet('${p.id}')">${fmt(p.doc_date)} · ${when(p)}` +
        `<span class="vax-pill ${st}">${t(VAX_STATE_LABEL[st])}${late ? ' · ' + t('{n} χωρίς παραγγελία', { n: late }) : ''}</span></button>`;
    }).join('') || `<span class="muted">${t('Καμία εκκόλαψη')}</span>`) + '</div>';
  }).join('');
  renderSheet();
}
function openSheet(id) { sheetHatchId = id; renderVax(); }
// the hatch's sheet, like the vet's Excel: general vaccines by date, then the ΠΡΩΤΑ / ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ groups
function renderSheet() {
  const box = document.getElementById('vax-sheet');
  const p = vaxData && vaxData.placements.find(h => h.id === sheetHatchId);
  if (!p) { box.innerHTML = ''; return; }
  const st = vaxState(p), pl = planOf(p), rows = hatchRows(p), today = todayIso();
  const byDate = (a, b) => (a.hm_emv || '').localeCompare(b.hm_emv || '') || (a.emvolio || '').localeCompare(b.emvolio || '');
  const short = iso => fmt(iso).slice(0, 5);   // dd/mm
  const orderCell = r => r.paragelia === 'ΝΑΙ' ? `<span class="ord-yes">✓${r.hm_par ? ' ' + short(r.hm_par) : ''}</span>`
    : r.hm_paragelia ? `<span class="${r.hm_paragelia < today ? 'ord-late' : 'ord-due'}">${t('έως {d}', { d: short(r.hm_paragelia) })}</span>` : '—';
  const line = r => `<tr class="${r.draft ? 'row-draft' : ''}" onclick="editEntry(${r.id})" title="${t('Κλικ για επεξεργασία')}">` +
    `<td>${ageOf(r) ?? '—'}</td><td>${fmt(r.hm_emv)}</td><td>${x(vaccineLabel(r.emvolio))}</td><td>${fmtPosotita(r.posotita)}</td>` +
    `<td>${x(r.pelatis || '—')}</td><td>${orderCell(r)}</td><td>${r.psygeio === 'ΝΑΙ' ? '✓' : '—'}</td></tr>`;
  const group = (round, label) => {
    const g = rows.filter(r => roundOf(r) === round).sort(byDate);
    return g.length ? `<tr class="vax-grp"><td colspan="7">${t(label)} · ${t('ημ. {n}', { n: ageOf(g[0]) })} · ${fmt(g[0].hm_emv)}</td></tr>` + g.map(line).join('') : '';
  };
  const actions = st === 'none' ? `<button class="btn-primary" onclick="openCreateVax()">${t('Δημιουργία εμβολιακού')}</button>`
    : st === 'draft' ? `<button class="btn-danger" onclick="deleteVax()">${t('Διαγραφή εμβολιακού')}</button><button class="btn-primary" onclick="activateVax()">${t('Ενεργοποίηση')}</button>` : '';
  box.innerHTML = `<div class="vax-sheet"><div class="vax-top"><b>${x(p.house)} · ${t('Εκκόλαψη')} ${fmt(p.doc_date)}</b>` +
    `<span class="muted">${x(p.breed || '—')}${pl ? ` · ${t('Νεοσσοί')} ${nfmt(pl.chicks)} · ${t('Πελάτες')} ${pl.customers.length}` : ''}</span>` +
    `<span class="vax-pill ${st}">${t(VAX_STATE_LABEL[st])}</span><span class="tb-spacer"></span>${actions}</div>` +
    (rows.length ? `<table class="vax-table"><thead><tr><th>${t('Ημέρα')}</th><th>${t('Ημερομηνία')}</th><th>${t('Εμβόλιο')}</th><th>${t('Ποσότητα')}</th>` +
      `<th>${t('Πελάτης')}</th><th>${t('Παραγγελία')}</th><th>${t('Ψυγείο')}</th></tr></thead><tbody>` +
      rows.filter(r => !roundOf(r)).sort(byDate).map(line).join('') + group(1, 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ') + group(2, 'ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ') + '</tbody></table>'
      : `<p class="tab-soon">${t('Δεν υπάρχουν γραμμές για αυτή την εκκόλαψη.')}</p>`) + '</div>';
}

// ── HATCH ΕΜΒΟΛΙΑΚΑ: create, activate, delete ──
function openCreateVax() {
  const p = vaxData.placements.find(h => h.id === sheetHatchId);
  const old = hatchRows(p).length > 0;   // entered the old way: only the record is created, no line is added or changed
  const customers = old ? rowCustomers(p) : placementCustomers(p);
  const coryzaRounds = old ? [] : [1, 2].filter(round => vaxData.programme.some(r => r.kind === `injectables_${round}`)
    && customers.some(c => vaxData.usual.some(u => u.customer === c.name && u.round === round && u.vaccine === CORYZA)));
  document.getElementById('vaxnew-title').textContent = `${p.house} · ${t('Εκκόλαψη')} ${fmt(p.doc_date)}`;
  document.getElementById('vaxnew-body').innerHTML =
    (old ? `<p class="muted">${t('Η εκκόλαψη έχει ήδη γραμμές: δημιουργείται μόνο το εμβολιακό της, ενεργό, χωρίς να αλλάξει καμία γραμμή.')}</p>` : '') +
    `<div class="fgroup"><label>${t('Νεοσσοί')}</label><input type="text" id="vaxnew-chicks" value="${nfmt(p.chicks || customers.reduce((s, c) => s + c.qty, 0))}"></div>` +
    `<div class="fgroup"><label>${t('Πελάτες')}</label><div>${customers.map(c => `${x(c.name)} · ${nfmt(c.qty)}`).join('<br>') || '—'}</div></div>` +
    coryzaRounds.map(round => `<div class="fgroup"><label>${t('ΚΟΡΥΖΑ')} · ${t(round === 1 ? 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ' : 'ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ')}</label>` +
      `<select id="vaxnew-coryza-${round}"><option value="">${t('— επιλογή —')}</option>${CORYZA_PRODUCTS.map(v => `<option>${x(v)}</option>`).join('')}</select></div>`).join('');
  vaxNew = { p, old, customers, coryzaRounds };
  document.getElementById('vaxnew-bg').style.display = 'flex';
}
function closeCreateVax() { document.getElementById('vaxnew-bg').style.display = 'none'; vaxNew = null; }
async function createVax() {
  if (!guardConnected()) return;
  const { p, old, customers, coryzaRounds } = vaxNew;
  const chicks = parseBirds(document.getElementById('vaxnew-chicks').value);
  if (!Number.isInteger(chicks) || chicks < 1) { toast(t('Οι νεοσσοί πρέπει να είναι θετικός ακέραιος.'), true); return; }
  const coryza = Object.fromEntries(coryzaRounds.map(round => [round, document.getElementById(`vaxnew-coryza-${round}`).value]));
  const missing = coryzaRounds.find(round => !coryza[round]);
  if (missing) { toast(t('Επιλέξτε προϊόν για την ΚΟΡΥΖΑ ({n}ος γύρος).', { n: missing }), true); return; }
  const btn = document.getElementById('vaxnew-ok'), now = new Date().toISOString();
  btn.disabled = true;
  try {
    // the other user may have entered rows for this hatch since the tab opened
    const existing = await sbFetch(`emvolia?select=id&anath=eq.${encodeURIComponent(p.house)}&hm_ekk=eq.${p.doc_date}&limit=1`);
    if (!old && existing.length) { toast(t('Αυτή η εκκόλαψη έχει ήδη γραμμές — ανανεώστε τη σελίδα.'), true); return; }
    const [rec] = await sbFetch(PLANS, { method: 'POST', prefer: 'return=representation', body: JSON.stringify({ placement_id: p.id, chicks,
      customers, activated_at: old ? now : null, updated_at: now, updated_by: currentUser }) });
    await logPlan(p, 'created', null, rec);
    vaxData.plans.push(rec);
    if (!old) {
      const rows = newVaxRows(p, chicks, customers, coryza);
      rows.forEach(r => Object.assign(r, { created_by: currentUser, created_at: now, updated_by: currentUser, updated_at: now }));
      await insertRows(rows, now);   // ponytail: one request per line (~20), like the rest of the tracker
    }
    closeCreateVax(); render(); toast(t('Το εμβολιακό δημιουργήθηκε ✓'));
  } catch (e) {
    toast(String(e.message).includes('duplicate') ? t('Ο άλλος χρήστης δημιούργησε ήδη εμβολιακό για αυτή την εκκόλαψη — ανανεώστε τη σελίδα.')
      : t('Σφάλμα: {msg}', { msg: e.message }), true);
    render();   // lines saved before an error stay visible as drafts; Διαγραφή εμβολιακού removes them
  } finally { btn.disabled = false; }
}
// draft lines become normal lines (they count for orders from now on); the εμβολιακό stays editable
async function activateVax() {
  if (!guardConnected()) return;
  const p = vaxData.placements.find(h => h.id === sheetHatchId), pl = planOf(p), drafts = hatchRows(p).filter(r => r.draft);
  if (!confirm(t('Ενεργοποίηση του εμβολιακού {house} {date}: οι {n} γραμμές του μετρούν πλέον στις παραγγελίες. Συνέχεια;',
    { house: p.house, date: fmt(p.doc_date), n: drafts.length }))) return;
  const now = new Date().toISOString();
  try {
    if (drafts.length) {
      const updated = await sbFetch(`emvolia?id=in.(${drafts.map(r => r.id).join(',')})`, { method: 'PATCH', prefer: 'return=representation',
        body: JSON.stringify({ draft: false, updated_at: now, updated_by: currentUser }) });
      updated.forEach(u => Object.assign(data.find(r => r.id === u.id) || {}, u));
    }
    const [rec] = await sbFetch(`${PLANS}?id=eq.${pl.id}`, { method: 'PATCH', prefer: 'return=representation',
      body: JSON.stringify({ activated_at: now, updated_at: now, updated_by: currentUser }) });
    await logPlan(p, 'activated', pl, rec);
    Object.assign(pl, rec); render(); toast(t('Το εμβολιακό ενεργοποιήθηκε ✓'));
  } catch (e) { toast(t('Σφάλμα: {msg}', { msg: e.message }), true); render(); }
}
// only a draft εμβολιακό can be deleted, with its draft lines (history kept)
async function deleteVax() {
  if (!guardConnected()) return;
  const p = vaxData.placements.find(h => h.id === sheetHatchId), pl = planOf(p), rows = hatchRows(p);
  if (rows.some(r => !r.draft)) { toast(t('Το εμβολιακό έχει γραμμές που δεν είναι πρόχειρες — διαγράψτε τες από τον πίνακα.'), true); return; }
  if (!confirm(t('Διαγραφή του εμβολιακού {house} {date} και των {n} πρόχειρων γραμμών του;', { house: p.house, date: fmt(p.doc_date), n: rows.length }))) return;
  try {
    if (rows.length) {
      await sbFetch(`emvolia?id=in.(${rows.map(r => r.id).join(',')})`, { method: 'DELETE' });
      await logDeleted(rows);
      data = data.filter(r => !rows.includes(r));
    }
    await sbFetch(`${PLANS}?id=eq.${pl.id}`, { method: 'DELETE' });
    await logPlan(p, 'deleted', pl, null);
    vaxData.plans = vaxData.plans.filter(x => x !== pl);
    render(); toast(t('Διαγράφηκε.'));
  } catch (e) { toast(t('Σφάλμα: {msg}', { msg: e.message }), true); render(); }
}
```

(If `data` is declared with `const`, use `data.splice` in place instead of reassigning — check its declaration.)

- [ ] **Step 3: Markup**

(a) Esc: after the HATCH block add
```js
// Esc closes the "Δημιουργία εμβολιακού" box
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('vaxnew-bg').style.display === 'flex') closeCreateVax(); });
```

(b) where the `plan-bg` modal was:
```html
<!-- "Δημιουργία εμβολιακού": Νεοσσοί, the customers found, ΚΟΡΥΖΑ product (HATCH ΕΜΒΟΛΙΑΚΑ in the script) -->
<div id="vaxnew-bg" class="modal-bg" style="display:none" onclick="if(event.target===this)closeCreateVax()">
  <div class="modal" style="width:460px;max-width:95vw">
    <h3 id="vaxnew-title"></h3>
    <div id="vaxnew-body"></div>
    <div class="modal-actions">
      <div style="flex:1"></div>
      <button data-t class="btn-secondary" onclick="closeCreateVax()">Ακύρωση</button>
      <button data-t class="btn-primary" id="vaxnew-ok" onclick="createVax()">Δημιουργία</button>
    </div>
  </div>
</div>
```

(c) tab row: `data-tab="programmes" onclick="showTab('programmes')">Προγράμματα εκκολάψεων</button>` → `data-tab="vax" onclick="showTab('vax')">Εμβολιακά</button>`; the link `🗓 Πρόγραμμα` → `🗓 Βασικό εμβολιακό` with title `Βασικό εμβολιακό και συνήθη ενέσιμα πελατών`.

(d) panel: `<div class="tab-panel" id="tab-programmes" hidden>…</div>` →
```html
  <div class="tab-panel" id="tab-vax" hidden>
    <div class="vax-cards" id="vax-cards"><p data-t class="tab-soon">Φόρτωση…</p></div>
    <div id="vax-sheet"></div>
  </div>
```

(e) script hooks: `const TABS = ['vaccines', 'programmes', 'orders', 'bin'];` → `['vaccines', 'vax', 'orders', 'bin']`; in `showTab` after `history.replaceState(…)`:
`  if (name === 'vax' && currentUser) openVaxTab();   // fresh cards every time the tab opens`;
in `initApp` after `currentUser = name;`:
`  if (!document.getElementById('tab-vax').hidden) openVaxTab();   // page opened on #vax`;
at the end of `render()`: `  renderVax();   // the open sheet follows every change in the table`.

(f) tracker row (render): `tr.classList.add('selected');` line → add after it `    if (r.draft) tr.classList.add('row-draft');`; the flock cell
`` `<td class="sticky-l1"><span class="badge b-flock" title="${x(fl)}">${x(fl)}</span></td>`+ `` →
`` `<td class="sticky-l1"><span class="badge b-flock" title="${x(fl)}">${x(fl)}</span>${r.draft ? ` <span class="draft-tag">${t('πρόχειρο')}</span>` : ''}</td>`+ ``;
the date cell `` `<td>${fmt(r.hm_emv)}</td>`+ `` → `` `<td>${fmt(r.hm_emv)}${ageOf(r) != null ? `<span class="age">${t('ημ. {n}', { n: ageOf(r) })}</span>` : ''}</td>`+ ``.

(g) counts: `const active = showDone ? data : data.filter(r=>r.emvoliasmos !== 'ΝΑΙ');` → `const active = (showDone ? data : data.filter(r=>r.emvoliasmos !== 'ΝΑΙ')).filter(r => !r.draft);   // draft lines don't count`; in the total-quantity loop `if (r.paragelia === 'ΝΑΙ') return; // exclude already ordered` → `if (r.paragelia === 'ΝΑΙ' || r.draft) return; // exclude already ordered and draft lines`.

(h) edit window age: `<div class="fgroup"><label data-t>Ημ. Εμβολιασμού</label><input type="text" id="m-vacc"` → `<div class="fgroup"><label><span data-t>Ημ. Εμβολιασμού</span> <span id="m-age" class="age"></span></label><input type="text" id="m-vacc"`; in `editEntry` after `setDate('m-hatch', r.hm_ekk); setDate('m-vacc', r.hm_emv); setDate('m-deliv', r.hm_par);` add
`  document.getElementById('m-age').textContent = ageOf(r) != null ? t('ημ. {n}', { n: ageOf(r) }) : '';`;
`closeModal()` also clears it: `document.getElementById('m-age').textContent = '';`.

(i) CSS (where the `.plan-*` block was):
```css
/* Εμβολιακά tab: house cards + the hatch sheet (HATCH ΕΜΒΟΛΙΑΚΑ) */
#tab-vax{overflow:auto}
.vax-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
.vax-house{background:var(--gh-canvas-subtle);border:1px solid var(--gh-border-default);border-radius:var(--gh-r-md);padding:8px;display:flex;flex-direction:column;gap:4px}
.vax-house>b{font-size:15px}
.vax-hatch{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;background:none;border:1px solid transparent;border-radius:var(--rs);padding:4px 6px;color:var(--gh-fg-default);font-family:inherit;font-size:12px;cursor:pointer}
.vax-hatch:hover{background:var(--gh-hover-bg)}.vax-hatch.on{border-color:var(--gh-accent-fg)}
.vax-pill{font-size:11px;border-radius:99px;padding:0 7px}
.vax-pill.none{background:var(--gh-danger-subtle);color:var(--gh-danger-fg)}
.vax-pill.draft{background:var(--gh-attention-subtle);color:var(--gh-attention-fg)}
.vax-pill.active{background:var(--gh-success-subtle);color:var(--gh-success-fg)}
.vax-sheet{background:var(--gh-canvas-subtle);border:1px solid var(--gh-border-default);border-radius:var(--gh-r-md);padding:12px;max-width:980px}
.vax-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}.vax-top>b{font-size:15px}
.vax-table{width:100%;border-collapse:collapse;font-size:12px}
.vax-table th{text-align:left;color:var(--gh-fg-muted);font-weight:500;padding:4px 6px;border-bottom:1px solid var(--gh-border-default)}
.vax-table td{padding:5px 6px;border-bottom:1px solid var(--gh-border-muted)}
.vax-table tbody tr{cursor:pointer}.vax-table tbody tr:hover td{background:var(--gh-hover-bg)}
.vax-table tr.vax-grp td{background:var(--gh-canvas-inset);color:var(--gh-fg-muted);font-weight:600;font-size:11px;cursor:default}
.ord-yes{color:var(--gh-success-fg)}.ord-due{color:var(--gh-attention-fg)}.ord-late{color:var(--gh-danger-fg);font-weight:600}
.row-draft td{opacity:.55}
.draft-tag{font-size:10px;color:var(--gh-attention-fg);border:1px solid rgba(240,180,41,0.5);border-radius:99px;padding:0 6px}
.age{color:var(--gh-fg-subtle);font-size:11px;margin-left:4px}
```

(j) translations — add (skip any key already present; the EN run lists what's missing):
```js
  'Εμβολιακά': 'Vaccination plans', '🗓 Βασικό εμβολιακό': '🗓 Base plan', 'Βασικό εμβολιακό και συνήθη ενέσιμα πελατών': "Base vaccination plan and customers' usual injections",
  'χωρίς εμβολιακό': 'no plan', 'πρόχειρο': 'draft', 'ενεργό': 'active', 'Καμία εκκόλαψη': 'No hatch',
  'σε {n} ημ.': 'in {n} d', 'ημ. {n}': 'day {n}', '{n} χωρίς παραγγελία': '{n} not ordered', 'έως {d}': 'by {d}',
  'Ημέρα': 'Day', 'Ημερομηνία': 'Date', 'Ψυγείο': 'Fridge', 'Πελάτες': 'Customers', 'Κλικ για επεξεργασία': 'Click to edit',
  'Δημιουργία εμβολιακού': 'Create plan', 'Διαγραφή εμβολιακού': 'Delete plan', 'Ενεργοποίηση': 'Activate', 'Δημιουργία': 'Create',
  'Δεν υπάρχουν γραμμές για αυτή την εκκόλαψη.': 'No lines for this hatch.',
  'Η εκκόλαψη έχει ήδη γραμμές: δημιουργείται μόνο το εμβολιακό της, ενεργό, χωρίς να αλλάξει καμία γραμμή.': 'This hatch already has lines: only its plan is created, active, without changing any line.',
  'Οι νεοσσοί πρέπει να είναι θετικός ακέραιος.': 'Chicks placed must be a positive whole number.',
  'Αυτή η εκκόλαψη έχει ήδη γραμμές — ανανεώστε τη σελίδα.': 'This hatch already has lines — reload the page.',
  'Ο άλλος χρήστης δημιούργησε ήδη εμβολιακό για αυτή την εκκόλαψη — ανανεώστε τη σελίδα.': 'The other user already created a plan for this hatch — reload the page.',
  'Το εμβολιακό δημιουργήθηκε ✓': 'Plan created ✓', 'Το εμβολιακό ενεργοποιήθηκε ✓': 'Plan activated ✓',
  'Ενεργοποίηση του εμβολιακού {house} {date}: οι {n} γραμμές του μετρούν πλέον στις παραγγελίες. Συνέχεια;': 'Activate the plan {house} {date}: its {n} lines count for orders from now on. Continue?',
  'Το εμβολιακό έχει γραμμές που δεν είναι πρόχειρες — διαγράψτε τες από τον πίνακα.': 'The plan has lines that are not drafts — delete them from the table.',
  'Διαγραφή του εμβολιακού {house} {date} και των {n} πρόχειρων γραμμών του;': 'Delete the plan {house} {date} and its {n} draft lines?',
```

- [ ] **Step 4: Run** `vax_checks.js` and `tabs_checks.js`, EL then EN: all PASS, `missing:` empty.

### Task 3½: Agreed additions (user, after the tracker review)

1. **Lock hatch date + house on lines of a hatch that has an εμβολιακό** (option A). A single line moved to another hatch date/house silently leaves its εμβολιακό; the whole hatch is moved in the scheduler (trigger).
   - `planHatches` = Set of "house|date" with an εμβολιακό, loaded with the data: `hatch_plans?select=placement:placements(house,doc_date)` (FK embedding); `inPlan(r)`; kept current by createVax (add) and deleteVax (delete).
   - edit window: `m-hatch` readOnly + `m-flock` disabled + note `#m-hatch-lock` "Αλλάζει από τον Προγραμματισμό (εμβολιακό)" when `inPlan(r)`; `closeModal` resets them.
   - batch edit: `batchMovesPlanLine(updates)` (hm_ekk or anath in updates and a selected line `inPlan`) → refused with a toast, before any write.
2. **Remove 🏠 Προβολή Αναθρεπτηρίων** from the beta: toolbar button, `#house-view`, the HOUSE VIEW section (`toggleHouseView`, `houseGroups`, `hvChipClass`, `hvRowHTML`, `hvCardHTML`, `buildHouseView`, `houseViewOn`), the `if (houseViewOn) buildHouseView();` line in `render()`, the `.house-view` / `.hv-card*` / `.hv-house` / `.hv-cycle` / `.hv-count` / `.hv-rows` / `.hv-row*` / `.hv-vacc` / `.hv-qty` / `.hv-chip*` CSS (keep `.hv-dot*`, used by the table), and translations used only there. The Εμβολιακά tab replaces it.
3. **🖨 Εκτύπωση on every hatch sheet with lines**: `printHatch()` opens the existing print card for that hatch (`renderPrintCard(date|house)`, picker hidden). The ⋯ menu's 🖨 Καρτέλα stays.
4. **Age shown live while typing dates**: `ageText(hatchIso, vaccIso)` → "ημ. N" or ''; `#f-age` next to the add form's Ημ. Εμβολιασμού label (set in `onDateChange`), `#m-age` in the edit window set in `modalDateChange` (which `editEntry` already calls) — replaces Task 3 Step 3 (h)'s line in `editEntry`.

Checks added to `vax_checks.js`: unlocked before the old-way create / locked after (readOnly, disabled, note shown); `batchMovesPlanLine` true for `{hm_ekk}` and `{anath}`, false for `{posotita}`; house-view button gone; sheet print button → print card open with the hatch's vaccines; add form `#f-age` shows "ημ. 8".

### Task 4: Normal tracker, homepage, template page, backup, docs

- [ ] `vaccine_tracker.html`: `const sbSelect  = ()        => sbFetch(\`${TABLE}?order=hm_emv.asc\`);` → `sbFetch(\`${TABLE}?draft=is.false&order=hm_emv.asc\`)   // draft lines live only in the beta until activated`; header link `🗓 Πρόγραμμα` → `🗓 Βασικό εμβολιακό`, title `Βασικό εμβολιακό και συνήθη ενέσιμα πελατών` (+ translations, as in the beta). Check: its changelog popup copes with history lines of rows it doesn't load (draft rows) — open it with stubbed history containing a `created` entry for an unknown row id; it must not throw.
- [ ] `index.html`: `` sbFetch(`emvolia?select=anath,hm_ekk,hm_emv,emvolio,paragelia,psygeio&hm_emv=gte.${todayIso}&order=hm_emv.asc`) `` → add `&draft=is.false`.
- [ ] `vaccine_programme.html`: `<title data-t>ΕΜΒΟΛΙΑ — Πρόγραμμα</title>` → `ΕΜΒΟΛΙΑ — Βασικό εμβολιακό`; logo `Πρόγραμμα εμβολίων` → `Βασικό εμβολιακό`; section heading `<h2 data-t>Πρόγραμμα</h2>` → `<h2 data-t>Εμβόλια</h2>`; translations updated (`'ΕΜΒΟΛΙΑ — Βασικό εμβολιακό': 'VACCINES — Base plan'`, `'Βασικό εμβολιακό': 'Base vaccination plan'`; drop unused keys). Run `vp_checks.js` EL + EN (33).
- [ ] `backup.py`: DATA_COLUMNS gets `"draft"` with header `"ΠΡΟΧΕΙΡΟ"` (same position in both lists, after `payer`); extra tab `("Εμβολιακά Εκκολάψεων", fetch("hatch_plans", "placement_id.asc")),` after the template line; `python -m py_compile backup.py`.
- [ ] `CLAUDE.md`: vaccine_programme.html is the **Βασικό εμβολιακό**; the beta's Εμβολιακά tab (hatch_plans, emvolia.draft, lines matched by anath + hm_ekk, ΕΝΕΣΙΜΑ round from the sxolia_panos note); the `placements_shift_hatch_rows` trigger; the normal tracker and homepage read `draft=is.false`.

### Task 5: SQL, verify, commit

- [ ] Give the user Task 1's SQL; verify (Task 1 Step 2); ask, then run the rolled-back trigger test and report it.
- [ ] Screenshot the Εμβολιακά tab with a sheet open (desktop, stubbed).
- [ ] /ponytail-review; on "commit and push now":
```bash
git add vaccine_tracker_beta.html vaccine_tracker.html index.html vaccine_programme.html backup.py CLAUDE.md docs/superpowers/specs/2026-11-06-hatch-programmes-and-bin-design.md docs/superpowers/plans/2026-11-06-hatch-vax-step3a.md
git commit -m "Vaccine tracker beta: Εμβολιακά tab — one living εμβολιακό per hatch (create, sheet, activate) + hatch-date shift"
```
(ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, confirm Pages serves `vax-cards`.
- [ ] Then write the 3b plan (editing inside the sheet).
