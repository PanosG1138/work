# Vaccine planning — Step 1: settings page, suppliers, chicks placed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store the vaccine programme, the injectables per round, each customer's usual injectables and a default supplier per vaccine — edited on a new page "Πρόγραμμα εμβολίων" — and add a "Νεοσσοί" (chicks placed) field to the scheduler's hatch card.

**Architecture:** One new plain HTML page (`vaccine_programme.html`) in the same style as `inventory.html`, using `common.js` (sbFetch, startPage, t(), resolveVaccineName). Five database changes, delivered to the user as SQL to paste into the Supabase SQL Editor (the MCP connector refuses migrations), then verified read-only. Small edits to `schedule_checker.html`, `vaccine_tracker.html`, `backup.py`, `CLAUDE.md`.

**Tech Stack:** plain HTML/CSS/JS, supabase-js 2.117.1 (auth only), PostgREST via `sbFetch`, Supabase Postgres, Python (backup.py).

**Spec:** `docs/superpowers/specs/2026-11-06-vaccine-planning-design.md` (sections 1, 2 and "Database changes"). This is step 1 of 4; steps 2–4 get their own plans after this one lands.

## Global Constraints

- No frameworks, no build step, no new dependencies; one way to do things; fail fast; no dead code (CLAUDE.md).
- Clear names, a short comment per block, `// ── NAME ──` section banners (user rule).
- Every fixed Greek text is tagged `data-t` / `data-t-title` / `data-t-placeholder` or goes through `t()`, and has an English line in the page's `// ── TRANSLATIONS ──` block; pages pass `startPage({ translated: true })`. Vaccine, customer and supplier names are never translated. "Injectables" is "injections" in English (user, 2026-11-03).
- RLS: new tables get policies for the `authenticated` role only — never anon/public.
- History convention: every change to the new settings data is logged (table `settings_history`).
- `common.js` and `theme.css` are NOT changed in this step (so no `?v=` bump).
- Never test against live data: browser checks stub `sbFetch` and the auth callback.
- Database SQL goes to the user to run; never `apply_migration`. Verify afterwards with `execute_sql` (read-only).
- Nothing is committed until the user says "commit"; run /ponytail-review before asking.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Files

- Create `vaccine_programme.html` — the settings page (programme rows, injectables per round, customers' usual injectables, supplier per vaccine).
- Modify `schedule_checker.html` — Νεοσσοί field in the add/edit window, saved to `placements.chicks`, shown on the card.
- Modify `vaccine_tracker.html` — toolbar link to the new page.
- Modify `backup.py` — back up the four new tables; old settings history cleaned after 6 months like the others.
- Modify `CLAUDE.md` — new page, new tables.
- Scratch (not in the repo, CLAUDE.md: no test suite by design): `<scratchpad>/vp_checks.js`, `<scratchpad>/sc_chicks_checks.js`, `<scratchpad>/step1.sql`.

---

### Task 1: Database changes

**Files:** Create `<scratchpad>/step1.sql`

**Interfaces — Produces** (later tasks and steps rely on these exact names):
- `vaccines.supplier text` (only column authenticated users may UPDATE on `vaccines`)
- `placements.chicks integer` (> 0 or NULL)
- `vaccine_programme(id, day, kind, vaccine, rule, factor, round_to, fixed_qty, unit, created_at)`;
  kind ∈ `general | injectables_1 | injectables_2`; rule ∈ `placed | fixed`; unit ∈ `Δόσεις | Κιλά | Μπουκαλάκια`
- `injectables(id, round, vaccine, sort)` — round 1|2; vaccine is a `vaccines.name` or the literal `ΚΟΡΥΖΑ`
- `customer_injectables(customer, round, vaccine, payer)` — PK (customer, round, vaccine); payer ∈ `us | customer`
- `settings_history(id, table_name, row_key, action, user_name, ts, changes_json)`

- [ ] **Step 1: Write the SQL file**

```sql
-- Vaccine planning, step 1 (spec docs/superpowers/specs/2026-11-06-vaccine-planning-design.md)

-- ── default supplier per vaccine; names stay read+insert only, just this column can change ──
alter table vaccines add column supplier text;
revoke update on vaccines from authenticated;
grant update (supplier) on vaccines to authenticated;
create policy authenticated_update on vaccines for update
  using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');
-- seed: the supplier each vaccine was ordered from most often in the tracker
update vaccines v set supplier = s.p
from (select distinct on (emvolio) emvolio, upper(trim(promitheutis)) as p
      from emvolia where coalesce(trim(promitheutis), '') <> ''
      group by emvolio, upper(trim(promitheutis))
      order by emvolio, count(*) desc) s
where s.emvolio = v.name;

-- ── chicks placed per hatch (scheduler card) ──
alter table placements add column chicks integer check (chicks > 0);

-- ── the saved programme ──
create table vaccine_programme (
  id bigint generated always as identity primary key,
  day integer not null check (day >= 1),
  kind text not null default 'general' check (kind in ('general', 'injectables_1', 'injectables_2')),
  vaccine text references vaccines(name),
  rule text not null default 'placed' check (rule in ('placed', 'fixed')),
  factor numeric not null default 1 check (factor > 0),
  round_to integer not null default 1000 check (round_to >= 1),
  fixed_qty numeric check (fixed_qty > 0),
  unit text not null default 'Δόσεις' check (unit in ('Δόσεις', 'Κιλά', 'Μπουκαλάκια')),
  created_at timestamptz not null default now(),
  check ((kind = 'general') = (vaccine is not null)),
  check (rule <> 'fixed' or fixed_qty is not null)
);
insert into vaccine_programme (day, kind, vaccine, rule, fixed_qty, unit) values
  (8,  'general', 'SALMOVAC',    'placed', null, 'Δόσεις'),
  (15, 'general', 'IB 4/91',     'placed', null, 'Δόσεις'),
  (15, 'general', 'Ma5',         'placed', null, 'Δόσεις'),
  (21, 'general', 'CLONE30',     'placed', null, 'Δόσεις'),
  (24, 'general', 'TARTYLL',     'fixed',  5,    'Κιλά'),
  (27, 'general', 'NEMOVAC TRT', 'placed', null, 'Δόσεις'),
  (32, 'general', 'MG 6/85',     'placed', null, 'Δόσεις'),
  (38, 'general', 'SALMOVAC',    'placed', null, 'Δόσεις'),
  (45, 'general', 'IB PRIMER',   'placed', null, 'Δόσεις'),
  (52, 'general', 'CLONE30',     'placed', null, 'Δόσεις'),
  (60, 'injectables_1', null,    'placed', null, 'Δόσεις'),
  (75, 'general', 'NEMOVAC TRT', 'placed', null, 'Δόσεις'),
  (80, 'general', 'MG 6/85',     'placed', null, 'Δόσεις'),
  (82, 'injectables_2', null,    'placed', null, 'Δόσεις'),
  (89, 'general', 'IB 4/91',     'placed', null, 'Δόσεις'),
  (89, 'general', 'Ma5',         'placed', null, 'Δόσεις'),
  (94, 'general', 'CLONE30',     'placed', null, 'Δόσεις'),
  (100,'general', 'SALMOVAC',    'placed', null, 'Δόσεις');

-- ── injectables offered per round (columns of the customers' grid); ΚΟΡΥΖΑ = product chosen per hatch ──
create table injectables (
  id bigint generated always as identity primary key,
  round smallint not null check (round in (1, 2)),
  vaccine text not null,
  sort integer not null default 0,
  unique (round, vaccine)
);
insert into injectables (round, vaccine, sort) values
  (1, 'SG-9R', 1), (1, 'ΚΟΡΥΖΑ', 2), (1, 'VAXSAFE', 3), (1, 'POULVAC E.COLI', 4),
  (2, 'SG-9R', 1), (2, 'ΚΟΡΥΖΑ', 2), (2, 'VAXSAFE', 3), (2, 'POULVAC E.COLI', 4),
  (2, 'VECTROMUNE', 5), (2, 'IZOVAC', 6), (2, 'OLVAC B+HG', 7), (2, 'GALLIMUNE SE+ST', 8),
  (2, 'SALENVAC ETC', 9), (2, 'GALLIMUNE 407', 10);

-- ── each customer's usual injectables (customer = name before " - " in placements.customers) ──
create table customer_injectables (
  customer text not null,
  round smallint not null check (round in (1, 2)),
  vaccine text not null,
  payer text not null check (payer in ('us', 'customer')),
  primary key (customer, round, vaccine)
);

-- ── history of every settings change (no foreign key: history outlives deletes) ──
create table settings_history (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_key text not null,
  action text not null,
  user_name text,
  ts timestamptz not null default now(),
  changes_json text
);

-- ── RLS: signed-in users only, never anon ──
alter table vaccine_programme    enable row level security;
alter table injectables          enable row level security;
alter table customer_injectables enable row level security;
alter table settings_history     enable row level security;
create policy authenticated_select on vaccine_programme for select using ((select auth.role()) = 'authenticated');
create policy authenticated_insert on vaccine_programme for insert with check ((select auth.role()) = 'authenticated');
create policy authenticated_update on vaccine_programme for update using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');
create policy authenticated_delete on vaccine_programme for delete using ((select auth.role()) = 'authenticated');
create policy authenticated_select on injectables for select using ((select auth.role()) = 'authenticated');
create policy authenticated_insert on injectables for insert with check ((select auth.role()) = 'authenticated');
create policy authenticated_update on injectables for update using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');
create policy authenticated_delete on injectables for delete using ((select auth.role()) = 'authenticated');
create policy authenticated_select on customer_injectables for select using ((select auth.role()) = 'authenticated');
create policy authenticated_insert on customer_injectables for insert with check ((select auth.role()) = 'authenticated');
create policy authenticated_update on customer_injectables for update using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');
create policy authenticated_delete on customer_injectables for delete using ((select auth.role()) = 'authenticated');
create policy authenticated_select on settings_history for select using ((select auth.role()) = 'authenticated');
create policy authenticated_insert on settings_history for insert with check ((select auth.role()) = 'authenticated');
```

- [ ] **Step 2: Give the SQL to the user** — one block, "Supabase → SQL Editor → New query → paste → Run", and wait for "done".

- [ ] **Step 3: Verify (read-only, `execute_sql`)**

```sql
select
  (select count(*) from vaccine_programme)                                   as programme_rows,   -- expect 18
  (select count(*) from vaccine_programme where kind <> 'general')           as placeholders,     -- expect 2
  (select count(*) from injectables where round = 1)                         as round1,           -- expect 4
  (select count(*) from injectables where round = 2)                         as round2,           -- expect 10
  (select count(*) from vaccines where supplier is not null)                 as with_supplier,    -- expect > 0
  (select count(*) from information_schema.columns
     where table_name = 'placements' and column_name = 'chicks')            as chicks_col,       -- expect 1
  (select count(*) from pg_policies where tablename in
     ('vaccine_programme','injectables','customer_injectables','settings_history')) as policies, -- expect 14
  (select count(*) from pg_policies where tablename in
     ('vaccine_programme','injectables','customer_injectables','settings_history')
     and roles::text like '%anon%')                                          as anon_policies;    -- expect 0
```

Also run the security advisor (`get_advisors type=security`) and confirm no new RLS findings.

---

### Task 2: The settings page `vaccine_programme.html`

**Files:** Create `vaccine_programme.html`; scratch `<scratchpad>/vp_checks.js`

**Interfaces:**
- Consumes (common.js): `sbFetch`, `startPage`, `t`, `addTranslations`, `escapeHtml`, `resolveVaccineName`, `VACCINE_OPTIONS` (global `let`), `fillVaccineList`, `userDisplayName` via startPage's `onSignedIn(name)`.
- Produces (step 2's wizard will reuse the same rules — keep these names): `customerName(s)` (text before " - "), `CORYZA = 'ΚΟΡΥΖΑ'`. Step 2 moves both into common.js when the tracker needs them.

- [ ] **Step 1: Write the failing checks** — `<scratchpad>/vp_checks.js`:

```js
// Checks for vaccine_programme.html — load into the page (stubbed data, never live), then `await runChecks()`.
(() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const results = [];
  const check = (name, ok) => results.push((ok ? 'PASS ' : 'FAIL ') + name);
  window.runChecks = async () => {
    const writes = [];
    const PROGRAMME = [
      { id: 1, day: 8,  kind: 'general', vaccine: 'SALMOVAC', rule: 'placed', factor: 1, round_to: 1000, fixed_qty: null, unit: 'Δόσεις' },
      { id: 2, day: 15, kind: 'general', vaccine: 'IB 4/91', rule: 'placed', factor: 0.65, round_to: 10000, fixed_qty: null, unit: 'Δόσεις' },
      { id: 3, day: 24, kind: 'general', vaccine: 'TARTYLL', rule: 'fixed', factor: 1, round_to: 1000, fixed_qty: 5, unit: 'Κιλά' },
      { id: 4, day: 60, kind: 'injectables_1', vaccine: null, rule: 'placed', factor: 1, round_to: 1000, fixed_qty: null, unit: 'Δόσεις' },
    ];
    const INJ = [{ id: 1, round: 1, vaccine: 'SG-9R', sort: 1 }, { id: 2, round: 1, vaccine: 'ΚΟΡΥΖΑ', sort: 2 }, { id: 3, round: 2, vaccine: 'VECTROMUNE', sort: 1 }];
    const CUST = [{ customer: 'Βενιζέλος', round: 1, vaccine: 'SG-9R', payer: 'us' }];
    const PLACEMENTS = [{ customers: [{ name: 'Συντιχάκης - από Δεκ 2026', k: 1, l: 0, c: 0 }, { name: 'Βενιζέλος', k: 1, l: 0, c: 0 }] }, { customers: null }];
    const VACCINES = [{ name: 'IB 4/91', supplier: null }, { name: 'SALMOVAC', supplier: 'FAENTINA' }, { name: 'SG-9R', supplier: 'ΤΡΑΙΚΟΥΔΗΣ' }];
    window.sbFetch = async (p, o = {}) => {
      if (o.method) { writes.push(`${o.method} ${p} ${o.body || ''}`); return o.prefer && o.prefer.includes('return=representation') ? [{ id: 99, ...JSON.parse(o.body) }] : null; }
      if (p.startsWith('vaccine_programme')) return JSON.parse(JSON.stringify(PROGRAMME));
      if (p.startsWith('injectables')) return JSON.parse(JSON.stringify(INJ));
      if (p.startsWith('customer_injectables')) return JSON.parse(JSON.stringify(CUST));
      if (p.startsWith('placements')) return JSON.parse(JSON.stringify(PLACEMENTS));
      if (p.startsWith('vaccines')) return JSON.parse(JSON.stringify(VACCINES));
      throw new Error('unexpected fetch ' + p);
    };
    window.confirm = () => true;
    const cb = [..._sb.auth.stateChangeEmitters.values()].pop().callback;
    cb('INITIAL_SESSION', { user: { id: 'u1', email: 'panos@internal.local', user_metadata: { lang: LANG } }, access_token: 't' });
    await wait(1500);

    // pure rules
    check('customerName strips notes', customerName('Συντιχάκης - από Δεκ 2026') === 'Συντιχάκης');
    check('customerList: placements + usual, unique, sorted', JSON.stringify(customerList(PLACEMENTS, CUST)) === JSON.stringify(['Βενιζέλος', 'Συντιχάκης']));
    check('ruleText placed ×1', ruleText(PROGRAMME[0]) === t('= Νεοσσοί'));
    check('ruleText formula', ruleText(PROGRAMME[1]) === t('= Νεοσσοί × {f}, στρογγ. {step}', { f: '0,65', step: '10.000' }));
    check('ruleText fixed', ruleText(PROGRAMME[2]) === '5 ' + t('Κιλά'));
    check('ruleText placeholder', ruleText(PROGRAMME[3]) === t('ενέσιμα πελατών'));

    // rendering
    const text = document.body.innerText;
    check('programme rows drawn', document.querySelectorAll('#prog-body tr').length === 4);
    check('placeholder row named', text.includes(t('ΠΡΩΤΑ ΕΝΕΣΙΜΑ')));
    check('round-1 chips drawn', document.querySelectorAll('#inj-1 .chip').length === 2);
    check('customers grid: 2 customers × 2 round-1 columns', document.querySelectorAll('#cust-1 select.cell').length === 4);
    check('usual tick pre-selected', document.querySelector('#cust-1 select.cell[data-customer="Βενιζέλος"][data-vaccine="SG-9R"]').value === 'us');
    check('supplier inputs drawn', document.querySelectorAll('#sup-body input').length === 3);

    // saving a cell: upsert + history line
    const cell = document.querySelector('#cust-1 select.cell[data-customer="Συντιχάκης"][data-vaccine="SG-9R"]');
    cell.value = 'customer'; await setUsual(cell);
    check('cell upserted', writes.some(w => w.startsWith('POST customer_injectables?on_conflict=customer,round,vaccine') && w.includes('"payer":"customer"')));
    check('cell change logged', writes.some(w => w.startsWith('POST settings_history') && w.includes('customer_injectables')));
    cell.value = ''; await setUsual(cell);
    check('cell cleared = delete', writes.some(w => w.startsWith('DELETE customer_injectables?customer=eq.')));

    // supplier change
    const sup = document.querySelector('#sup-body input[data-name="IB 4/91"]');
    sup.value = 'faentina'; await setSupplier(sup);
    check('supplier patched, upper-cased', writes.some(w => w.startsWith('PATCH vaccines?name=eq.IB%204%2F91') && w.includes('"supplier":"FAENTINA"')));

    // programme row: validation, then a valid fixed row
    openProg(null);
    document.getElementById('m-day').value = '0'; await saveProg();
    check('day 0 refused', !writes.some(w => w.startsWith('POST vaccine_programme')));
    document.getElementById('m-day').value = '30'; document.getElementById('m-kind').value = 'general'; syncModal();
    document.getElementById('m-vaccine').value = 'SALMOVAC'; document.getElementById('m-rule').value = 'fixed'; syncModal();
    document.getElementById('m-fixed').value = '2,5'; document.getElementById('m-unit').value = 'Κιλά';
    await saveProg();
    check('fixed row inserted', writes.some(w => w.startsWith('POST vaccine_programme') && w.includes('"fixed_qty":2.5') && w.includes('"rule":"fixed"')));

    // adding a round-2 injectable
    await addInjectable(2, 'IZOVAC');
    check('injectable inserted with next sort', writes.some(w => w.startsWith('POST injectables') && w.includes('"vaccine":"IZOVAC"') && w.includes('"sort":2')));

    check('no missing translations', LANG === 'el' || window.missingTranslations.size === 0);
    return results.join('\n') + (LANG === 'en' ? '\nmissing: ' + [...window.missingTranslations].join(' | ') : '');
  };
})();
```

- [ ] **Step 2: Run the checks to see them fail** — start the local server (`preview_start` name `work-repo`, port 8765), open `http://localhost:8765/vaccine_programme.html?r=1`. Expected: 404 (page doesn't exist yet).

- [ ] **Step 3: Write the page** — create `vaccine_programme.html`:

```html
<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title data-t>ΕΜΒΟΛΙΑ — Πρόγραμμα</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/dist/umd/supabase.min.js"></script>
<script src="common.js?v=11"></script>
<link rel="stylesheet" href="theme.css?v=11">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--gh-canvas-default);color:var(--gh-fg-default);font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5}

/* ── HEADER ── */
header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 16px;height:48px;border-bottom:1px solid var(--gh-border-default);position:sticky;top:0;background:var(--gh-canvas-default);z-index:50}
.header-left,.header-right{display:flex;align-items:center;gap:12px}
.logo-title{font-weight:600;font-size:15px}
.btn-back{display:flex;align-items:center;height:28px;padding:0 12px;border:1px solid var(--gh-border-default);border-radius:var(--rs);background:var(--gh-canvas-subtle);color:var(--gh-fg-muted);font-size:12px;font-weight:500;text-decoration:none}
.btn-back:hover{background:var(--gh-hover-bg);color:var(--gh-fg-default)}
.sync-badge{display:flex;align-items:center;gap:5px;font-size:12px;padding:0 10px;height:24px;border-radius:99px;border:1px solid var(--gh-border-default);background:var(--gh-canvas-subtle);color:var(--gh-fg-muted);white-space:nowrap}
.sync-badge.ok{border-color:rgba(79,209,139,0.4);color:var(--gh-success-fg);background:var(--gh-success-subtle)}
.sync-badge.err{border-color:rgba(255,107,107,0.4);color:var(--gh-danger-fg);background:var(--gh-danger-subtle)}
.sync-badge.loading{border-color:rgba(240,180,41,0.4);color:var(--gh-attention-fg);background:var(--gh-attention-subtle)}
.sync-dot{width:6px;height:6px;border-radius:50%;background:currentColor}

/* ── SECTIONS ── */
main{max-width:1100px;margin:0 auto;padding:20px 16px 48px;display:flex;flex-direction:column;gap:28px}
section h2{font-size:16px;font-weight:600;margin-bottom:4px}
.hint{color:var(--gh-fg-muted);font-size:13px;margin-bottom:10px}
.muted{color:var(--gh-fg-muted)}
.row-between{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
.tbl{overflow-x:auto;border:1px solid var(--gh-border-default);border-radius:var(--rs)}
table{width:100%;border-collapse:collapse;font-size:13px}
th{padding:7px 12px;text-align:left;font-size:12px;font-weight:600;background:var(--gh-canvas-subtle);border-bottom:1px solid var(--gh-border-default);white-space:nowrap}
td{padding:6px 12px;border-bottom:1px solid var(--gh-border-muted);vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
.empty-state{padding:24px;text-align:center;color:var(--gh-fg-muted)}
.rounds{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:800px){.rounds{grid-template-columns:1fr}}
.round-title{font-size:13px;font-weight:600;margin-bottom:6px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.chip{display:inline-flex;align-items:center;gap:4px;padding:2px 4px 2px 10px;border:1px solid var(--gh-border-default);border-radius:99px;background:var(--gh-canvas-subtle);font-size:12px}
.chip button{border:none;background:none;color:var(--gh-fg-muted);cursor:pointer;font-size:14px;padding:0 4px}
.chip button:hover{color:var(--gh-danger-fg)}

/* ── FORM CONTROLS + BUTTONS ── */
input[type=text],input[type=number],select{background:var(--gh-canvas-default);border:1px solid var(--gh-border-default);border-radius:var(--rs);color:var(--gh-fg-default);font-family:inherit;font-size:13px;padding:5px 8px;outline:none}
input:focus,select:focus{border-color:var(--gh-accent-emphasis)}
select.cell{padding:3px 6px;font-size:12px;min-width:84px}
select.cell.on{border-color:rgba(79,209,139,0.5);color:var(--gh-success-fg);background:var(--gh-success-subtle)}
.btn-primary,.btn-secondary,.btn-danger{height:30px;padding:0 14px;border-radius:var(--rs);font-family:inherit;font-size:13px;font-weight:500;cursor:pointer}
.btn-primary{background:var(--gh-accent-emphasis);color:#fff;border:1px solid rgba(240,246,252,0.1)}
.btn-secondary{background:var(--gh-canvas-subtle);color:var(--gh-fg-default);border:1px solid var(--gh-border-default)}
.btn-secondary:hover{background:var(--gh-hover-bg)}
.btn-danger{background:var(--gh-danger-subtle);color:var(--gh-danger-fg);border:1px solid rgba(255,107,107,0.4)}
.btn-sm{height:26px;padding:0 10px;font-size:12px}

/* ── MODAL + TOAST ── */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:200}
.modal{background:var(--gh-canvas-subtle);border:1px solid var(--gh-border-default);border-radius:var(--r);padding:22px;width:420px;max-width:95vw;max-height:90vh;overflow-y:auto}
.modal h3{font-size:16px;font-weight:600;margin-bottom:16px}
.fgroup{margin-bottom:12px}
.fgroup label{display:block;font-size:12px;font-weight:500;color:var(--gh-fg-muted);margin-bottom:4px}
.fgroup input,.fgroup select{width:100%}
.modal-actions{display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid var(--gh-border-muted)}
.confirm-box{background:var(--gh-canvas-subtle);border:1px solid var(--gh-border-default);border-radius:var(--r);padding:24px;text-align:center}
.confirm-box p{color:var(--gh-fg-muted);margin-bottom:16px;line-height:1.6}
.vname-typed{display:block;margin-top:8px;color:var(--gh-fg-default);font-weight:600}
.toast{position:fixed;bottom:20px;right:20px;background:var(--gh-canvas-subtle);border:1px solid var(--gh-border-default);padding:10px 16px;border-radius:var(--rs);font-size:13px;z-index:999;opacity:0;transform:translateY(60px);transition:all .25s;pointer-events:none;max-width:340px}
.toast.show{opacity:1;transform:translateY(0)}
.toast.err{background:var(--gh-danger-subtle);border-color:rgba(255,107,107,0.4);color:var(--gh-danger-fg)}
</style>
</head>
<body>

<!-- PROGRAMME ROW — add / edit window -->
<div id="prog-bg" class="modal-bg" style="display:none" onclick="if(event.target===this)closeProg()">
  <div class="modal">
    <h3 data-t>Γραμμή προγράμματος</h3>
    <div class="fgroup"><label data-t>Ημέρα</label><input type="number" id="m-day" min="1" step="1"></div>
    <div class="fgroup"><label data-t>Είδος</label>
      <select id="m-kind" onchange="syncModal()">
        <option value="general" data-t>Εμβόλιο</option>
        <option value="injectables_1" data-t>ΠΡΩΤΑ ΕΝΕΣΙΜΑ</option>
        <option value="injectables_2" data-t>ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ</option>
      </select></div>
    <div id="m-general">
      <div class="fgroup"><label data-t>Εμβόλιο</label><input type="text" id="m-vaccine" list="vaccine-list" data-t-placeholder placeholder="Όνομα εμβολίου…"></div>
      <div class="fgroup"><label data-t>Ποσότητα</label>
        <select id="m-rule" onchange="syncModal()">
          <option value="placed" data-t>= Νεοσσοί × συντελεστή</option>
          <option value="fixed" data-t>Σταθερή ποσότητα</option>
        </select></div>
      <div id="m-placed">
        <div class="fgroup"><label data-t>Συντελεστής</label><input type="text" id="m-factor"></div>
        <div class="fgroup"><label data-t>Στρογγυλοποίηση προς τα πάνω σε</label><input type="text" id="m-round"></div>
      </div>
      <div id="m-fixed-wrap" class="fgroup"><label data-t>Σταθερή ποσότητα</label><input type="text" id="m-fixed"></div>
      <div class="fgroup"><label data-t>Μονάδα</label>
        <select id="m-unit"><option value="Δόσεις" data-t>Δόσεις</option><option value="Κιλά" data-t>Κιλά</option><option value="Μπουκαλάκια" data-t>Μπουκαλάκια</option></select></div>
    </div>
    <div class="modal-actions">
      <button data-t class="btn-danger" id="m-delete" onclick="deleteProg()">Διαγραφή</button>
      <div style="flex:1"></div>
      <button data-t class="btn-secondary" onclick="closeProg()">Ακύρωση</button>
      <button data-t class="btn-primary" onclick="saveProg()">Αποθήκευση</button>
    </div>
  </div>
</div>

<!-- VACCINE NAME — "did you mean" / add a new name (filled by common.js) -->
<div id="vname-bg" class="modal-bg" style="display:none;z-index:400" onclick="if(event.target===this)resolveVaccineAsk(null)" onkeydown="if(event.key==='Escape'){event.stopPropagation();resolveVaccineAsk(null)}">
  <div class="confirm-box" style="width:440px;max-width:95vw">
    <p id="vname-msg"></p>
    <div id="vname-actions" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"></div>
  </div>
</div>

<div class="toast" id="toast"></div>

<header>
  <div class="header-left">
    <a data-t href="vaccine_tracker.html" class="btn-back" data-t-title title="Πίσω στις παραγγελίες">← Παραγγελίες</a>
    <span data-t class="logo-title">Πρόγραμμα εμβολίων</span>
  </div>
  <div class="header-right">
    <div id="sync-badge" class="sync-badge loading"><div class="sync-dot"></div><span id="sync-text">…</span></div>
    <span id="common-nav"></span>
  </div>
</header>

<main>
  <datalist id="vaccine-list"></datalist>
  <datalist id="supplier-list"></datalist>

  <section>
    <div class="row-between">
      <div><h2 data-t>Πρόγραμμα</h2>
        <p data-t class="hint">Κάθε νέα εκκόλαψη αντιγράφει αυτές τις γραμμές. Η ημέρα μετράει από την εκκόλαψη (ημέρα 0).</p></div>
      <button data-t class="btn-primary" onclick="openProg(null)">+ Γραμμή</button>
    </div>
    <div class="tbl"><table>
      <thead><tr><th data-t>Ημέρα</th><th data-t>Εμβόλιο</th><th data-t>Ποσότητα</th><th data-t>Ενέργειες</th></tr></thead>
      <tbody id="prog-body"></tbody>
    </table></div>
  </section>

  <section>
    <h2 data-t>Ενέσιμα ανά γύρο</h2>
    <p data-t class="hint">Οι στήλες του πίνακα πελατών. Η ΚΟΡΥΖΑ είναι στήλη: το προϊόν (BIONEW BI + COR ή CORIPRAVAC) επιλέγεται σε κάθε εκκόλαψη.</p>
    <div class="rounds">
      <div><div data-t class="round-title">1ος γύρος (ΠΡΩΤΑ ΕΝΕΣΙΜΑ)</div><div class="chips" id="inj-1"></div>
        <select id="inj-add-1" onchange="addInjectable(1, this.value)"></select></div>
      <div><div data-t class="round-title">2ος γύρος (ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ)</div><div class="chips" id="inj-2"></div>
        <select id="inj-add-2" onchange="addInjectable(2, this.value)"></select></div>
    </div>
  </section>

  <section>
    <h2 data-t>Συνήθη ενέσιμα πελατών</h2>
    <p data-t class="hint">Προεπιλέγονται σε κάθε νέα εκκόλαψη και αλλάζουν εκεί όταν χρειάζεται. «Εμείς» = τα πληρώνουμε εμείς, «Πελάτης» = τιμολογούνται απευθείας στον πελάτη.</p>
    <div data-t class="round-title">1ος γύρος (ΠΡΩΤΑ ΕΝΕΣΙΜΑ)</div>
    <div class="tbl" id="cust-1" style="margin-bottom:16px"></div>
    <div data-t class="round-title">2ος γύρος (ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ)</div>
    <div class="tbl" id="cust-2"></div>
  </section>

  <section>
    <h2 data-t>Προμηθευτής ανά εμβόλιο</h2>
    <p data-t class="hint">Ο προμηθευτής που προτείνεται σε κάθε νέα γραμμή.</p>
    <div class="tbl"><table>
      <thead><tr><th data-t>Εμβόλιο</th><th data-t>Προμηθευτής</th></tr></thead>
      <tbody id="sup-body"></tbody>
    </table></div>
  </section>
</main>

<script>
// ── TRANSLATIONS ── this page's English (Greek text → English); shared words are in common.js
addTranslations({
  'ΕΜΒΟΛΙΑ — Πρόγραμμα': 'VACCINES — Programme', '← Παραγγελίες': '← Orders', 'Πίσω στις παραγγελίες': 'Back to orders',
  'Πρόγραμμα εμβολίων': 'Vaccine programme', 'Πρόγραμμα': 'Programme', '+ Γραμμή': '+ Row',
  'Κάθε νέα εκκόλαψη αντιγράφει αυτές τις γραμμές. Η ημέρα μετράει από την εκκόλαψη (ημέρα 0).': 'Every new hatch copies these rows. The day counts from the hatch (day 0).',
  'Ημέρα': 'Day', 'Εμβόλιο': 'Vaccine', 'Ποσότητα': 'Quantity', 'Ενέργειες': 'Actions', 'Επεξ.': 'Edit',
  'Ενέσιμα ανά γύρο': 'Injections per round',
  'Οι στήλες του πίνακα πελατών. Η ΚΟΡΥΖΑ είναι στήλη: το προϊόν (BIONEW BI + COR ή CORIPRAVAC) επιλέγεται σε κάθε εκκόλαψη.': "The columns of the customers' table. CORYZA is a column: the product (BIONEW BI + COR or CORIPRAVAC) is picked for each hatch.",
  '1ος γύρος (ΠΡΩΤΑ ΕΝΕΣΙΜΑ)': '1st round (FIRST INJECTIONS)', '2ος γύρος (ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ)': '2nd round (SECOND INJECTIONS)',
  'Συνήθη ενέσιμα πελατών': "Customers' usual injections",
  'Προεπιλέγονται σε κάθε νέα εκκόλαψη και αλλάζουν εκεί όταν χρειάζεται. «Εμείς» = τα πληρώνουμε εμείς, «Πελάτης» = τιμολογούνται απευθείας στον πελάτη.': 'Pre-ticked on every new hatch and changed there when needed. «Us» = we pay, «Customer» = billed directly to the customer.',
  'Πελάτης': 'Customer', 'Εμείς': 'Us', 'ΚΟΡΥΖΑ': 'CORYZA',
  'Προμηθευτής ανά εμβόλιο': 'Supplier per vaccine', 'Ο προμηθευτής που προτείνεται σε κάθε νέα γραμμή.': 'The supplier suggested for every new row.', 'Προμηθευτής': 'Supplier',
  'Γραμμή προγράμματος': 'Programme row', 'Είδος': 'Type', 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ': 'FIRST INJECTIONS', 'ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ': 'SECOND INJECTIONS',
  'Όνομα εμβολίου…': 'Vaccine name…', '= Νεοσσοί × συντελεστή': '= chicks placed × factor', 'Σταθερή ποσότητα': 'Fixed quantity',
  'Συντελεστής': 'Factor', 'Στρογγυλοποίηση προς τα πάνω σε': 'Round up to', 'Μονάδα': 'Unit', 'Μπουκαλάκια': 'Bottles',
  'Διαγραφή': 'Delete', 'Αποθήκευση': 'Save',
  'Φόρτωση…': 'Loading…', 'Συνδέθηκε ✓': 'Connected ✓', 'Σφάλμα σύνδεσης': 'Connection error', 'Σφάλμα: {msg}': 'Error: {msg}',
  'Αποθηκεύτηκε ✓': 'Saved ✓', 'Διαγράφηκε.': 'Deleted.', 'Δεν υπάρχουν γραμμές.': 'No rows.',
  'ενέσιμα πελατών': "customers' injections", '= Νεοσσοί': '= chicks placed', '= Νεοσσοί × {f}, στρογγ. {step}': '= chicks placed × {f}, rounded up to {step}',
  'Η ημέρα πρέπει να είναι ακέραιος από 1 και πάνω.': 'The day must be a whole number from 1 up.',
  'Εισάγετε όνομα εμβολίου.': 'Enter a vaccine name.',
  'Ο συντελεστής και η στρογγυλοποίηση πρέπει να είναι θετικοί αριθμοί.': 'The factor and the rounding must be positive numbers.',
  'Η σταθερή ποσότητα πρέπει να είναι θετικός αριθμός.': 'The fixed quantity must be a positive number.',
  'Η εγγραφή δεν υπάρχει πια — ανανεώστε τη σελίδα.': 'The record no longer exists — reload the page.',
  'Διαγραφή της γραμμής «{name}» (ημέρα {day});': 'Delete the row «{name}» (day {day})?',
  'Αφαίρεση': 'Remove', 'Κανένα': 'None', '— προσθήκη —': '— add —',
  'Αφαίρεση του «{name}» από τον γύρο {n};': 'Remove «{name}» from round {n}?',
  'Δεν υπάρχουν πελάτες στον Προγραμματισμό.': 'No customers in the scheduler.',
});

// ── TABLES ──
const PROG = 'vaccine_programme', INJ = 'injectables', CUST = 'customer_injectables', HIST = 'settings_history';
const KIND_LABEL = { injectables_1: 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ', injectables_2: 'ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ' };   // shown through t()
const CORYZA = 'ΚΟΡΥΖΑ';   // a grid column, not a product: BIONEW BI + COR or CORIPRAVAC is picked per hatch
// grid cell: '' = not ticked, 'us' = ticked and we pay, 'customer' = ticked and billed to the customer
const PAYER_LABEL = { '': '—', us: 'Εμείς', customer: 'Πελάτης' };

// ── STATE ──
let programme = [], injectables = [], customerInj = [], customers = [], suppliers = [];
let currentUser = '', editId = null;

// ── RULES ── (step 2's wizard uses the same customerName rule)
// customer = text before " - " in placements.customers ("Συντιχάκης - από Δεκ 2026" → "Συντιχάκης")
const customerName = s => String(s || '').split(' - ')[0].trim();
// every customer booked in the scheduler plus those already in the usual lists — unique, sorted
function customerList(placements, usual) {
  const names = placements.flatMap(p => (p.customers || []).map(c => customerName(c.name))).concat(usual.map(u => u.customer));
  return [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el'));
}
const nf = n => Number(n).toLocaleString('el-GR');
// how a programme row's quantity is worked out, in words
function ruleText(r) {
  if (r.kind !== 'general') return t('ενέσιμα πελατών');
  if (r.rule === 'fixed') return `${nf(r.fixed_qty)} ${t(r.unit)}`;
  const factor = Number(r.factor), step = Number(r.round_to);
  return factor === 1 && step <= 1000 ? t('= Νεοσσοί')
    : t('= Νεοσσοί × {f}, στρογγ. {step}', { f: String(factor).replace('.', ','), step: nf(step) });
}

// ── SYNC BADGE + TOAST ──
function setSync(state, text) {
  document.getElementById('sync-badge').className = 'sync-badge ' + state;
  document.getElementById('sync-text').textContent = text;
}
let toastTimer;
function toast(msg, err = false) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = 'toast'; }, 3500);
}

// ── HISTORY ── every settings change is logged: changes_json = { field: { from, to } }
function logChange(table, rowKey, action, before, after) {
  const changes = {};
  for (const k of new Set([...Object.keys(before || {}), ...Object.keys(after || {})])) {
    if (k === 'id' || k === 'created_at') continue;
    const from = (before || {})[k] ?? null, to = (after || {})[k] ?? null;
    if (String(from ?? '') !== String(to ?? '')) changes[k] = { from, to };
  }
  return sbFetch(HIST, { method: 'POST', body: JSON.stringify({ table_name: table, row_key: String(rowKey), action,
    user_name: currentUser, ts: new Date().toISOString(), changes_json: JSON.stringify(changes) }) });
}

// ── LOAD ──
async function loadAll() {
  setSync('loading', t('Φόρτωση…'));
  try {
    let placements;
    [programme, injectables, customerInj, placements, suppliers] = await Promise.all([
      sbFetch(`${PROG}?order=day.asc,id.asc`),
      sbFetch(`${INJ}?order=round.asc,sort.asc`),
      sbFetch(`${CUST}?select=customer,round,vaccine,payer`),
      sbFetch('placements?select=customers'),
      sbFetch('vaccines?select=name,supplier&order=name.asc'),
    ]);
    VACCINE_OPTIONS = suppliers.map(v => v.name);   // the vaccine list resolveVaccineName checks against
    fillVaccineList();
    customers = customerList(placements, customerInj);
    setSync('ok', t('Συνδέθηκε ✓'));
    renderProgramme(); renderInjectables(); renderCustomers(); renderSuppliers();
  } catch (e) {
    setSync('err', t('Σφάλμα σύνδεσης'));
    toast(t('Σφάλμα: {msg}', { msg: e.message }), true);
  }
}

// ── PROGRAMME ──
function renderProgramme() {
  document.getElementById('prog-body').innerHTML = programme.length ? programme.map(r =>
    `<tr ondblclick="openProg(${r.id})"><td>${r.day}</td>` +
    `<td>${r.kind === 'general' ? escapeHtml(r.vaccine) : `<b>${t(KIND_LABEL[r.kind])}</b>`}</td>` +
    `<td class="muted">${escapeHtml(ruleText(r))}</td>` +
    `<td><button class="btn-secondary btn-sm" onclick="openProg(${r.id})">${t('Επεξ.')}</button></td></tr>`).join('')
    : `<tr><td colspan="4" class="empty-state">${t('Δεν υπάρχουν γραμμές.')}</td></tr>`;
}
// show only the fields that apply to the chosen type and quantity rule
function syncModal() {
  const general = document.getElementById('m-kind').value === 'general';
  const placed = document.getElementById('m-rule').value === 'placed';
  document.getElementById('m-general').style.display = general ? '' : 'none';
  document.getElementById('m-placed').style.display = placed ? '' : 'none';
  document.getElementById('m-fixed-wrap').style.display = placed ? 'none' : '';
}
// id null = new row
function openProg(id) {
  editId = id;
  const r = programme.find(x => x.id === id) || { day: '', kind: 'general', vaccine: '', rule: 'placed', factor: 1, round_to: 1000, fixed_qty: '', unit: 'Δόσεις' };
  const set = (el, v) => { document.getElementById(el).value = v ?? ''; };
  set('m-day', r.day); set('m-kind', r.kind); set('m-vaccine', r.vaccine); set('m-rule', r.rule);
  set('m-factor', String(r.factor).replace('.', ',')); set('m-round', nf(r.round_to));
  set('m-fixed', r.fixed_qty == null || r.fixed_qty === '' ? '' : String(r.fixed_qty).replace('.', ',')); set('m-unit', r.unit);
  document.getElementById('m-delete').style.display = id ? '' : 'none';
  syncModal();
  document.getElementById('prog-bg').style.display = 'flex';
}
function closeProg() { document.getElementById('prog-bg').style.display = 'none'; editId = null; }
const parseNum = s => Number(String(s).trim().replace(/\./g, '').replace(',', '.'));   // "10.000" → 10000, "0,65" → 0.65
async function saveProg() {
  const id = editId;   // remembered now: Esc closes the window (editId = null) while a save is still running
  const g = el => document.getElementById(el).value.trim();
  const row = { day: Number(g('m-day')), kind: g('m-kind'), vaccine: null, rule: 'placed', factor: 1, round_to: 1000, fixed_qty: null, unit: 'Δόσεις' };
  if (!Number.isInteger(row.day) || row.day < 1) { toast(t('Η ημέρα πρέπει να είναι ακέραιος από 1 και πάνω.'), true); return; }
  if (row.kind === 'general') {
    if (!g('m-vaccine')) { toast(t('Εισάγετε όνομα εμβολίου.'), true); return; }
    row.rule = g('m-rule'); row.unit = g('m-unit');
    if (row.rule === 'placed') {
      row.factor = Number(g('m-factor').replace(',', '.')); row.round_to = parseNum(g('m-round'));
      if (!(row.factor > 0) || !Number.isInteger(row.round_to) || row.round_to < 1) { toast(t('Ο συντελεστής και η στρογγυλοποίηση πρέπει να είναι θετικοί αριθμοί.'), true); return; }
    } else {
      row.fixed_qty = Number(g('m-fixed').replace(',', '.'));
      if (!(row.fixed_qty > 0)) { toast(t('Η σταθερή ποσότητα πρέπει να είναι θετικός αριθμός.'), true); return; }
    }
    row.vaccine = await resolveVaccineName(g('m-vaccine'));
    if (row.vaccine === null) return;
  }
  try {
    const before = id ? programme.find(r => r.id === id) : null;
    const [saved] = (id
      ? await sbFetch(`${PROG}?id=eq.${id}`, { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify(row) })
      : await sbFetch(PROG, { method: 'POST', prefer: 'return=representation', body: JSON.stringify(row) })) || [];
    if (!saved) throw new Error(t('Η εγγραφή δεν υπάρχει πια — ανανεώστε τη σελίδα.'));
    await logChange(PROG, saved.id, id ? 'edited' : 'created', before, saved);
    programme = (id ? programme.map(r => r.id === id ? saved : r) : [...programme, saved]).sort((a, b) => a.day - b.day || a.id - b.id);
    closeProg(); renderProgramme(); toast(t('Αποθηκεύτηκε ✓'));
  } catch (e) { toast(t('Σφάλμα: {msg}', { msg: e.message }), true); }
}
async function deleteProg() {
  const r = programme.find(x => x.id === editId);
  if (!r || !confirm(t('Διαγραφή της γραμμής «{name}» (ημέρα {day});', { name: r.vaccine || t(KIND_LABEL[r.kind]), day: r.day }))) return;
  try {
    await sbFetch(`${PROG}?id=eq.${r.id}`, { method: 'DELETE' });
    await logChange(PROG, r.id, 'deleted', r, null);
    programme = programme.filter(x => x.id !== r.id);
    closeProg(); renderProgramme(); toast(t('Διαγράφηκε.'));
  } catch (e) { toast(t('Σφάλμα: {msg}', { msg: e.message }), true); }
}

// ── INJECTABLES PER ROUND ── (the columns of the customers' grid)
const injLabel = v => v === CORYZA ? t(CORYZA) : escapeHtml(v);
function renderInjectables() {
  [1, 2].forEach(round => {
    const list = injectables.filter(i => i.round === round);
    document.getElementById(`inj-${round}`).innerHTML = list.map(i =>
      `<span class="chip">${injLabel(i.vaccine)}<button title="${t('Αφαίρεση')}" onclick="removeInjectable(${i.id})">×</button></span>`).join('')
      || `<span class="muted">${t('Κανένα')}</span>`;
    document.getElementById(`inj-add-${round}`).innerHTML = `<option value="">${t('— προσθήκη —')}</option>` +
      [CORYZA, ...VACCINE_OPTIONS].filter(v => !list.some(i => i.vaccine === v)).map(v => `<option value="${escapeHtml(v)}">${injLabel(v)}</option>`).join('');
  });
}
async function addInjectable(round, vaccine) {
  if (!vaccine) return;
  const sort = Math.max(0, ...injectables.filter(i => i.round === round).map(i => i.sort)) + 1;
  try {
    const [saved] = await sbFetch(INJ, { method: 'POST', prefer: 'return=representation', body: JSON.stringify({ round, vaccine, sort }) });
    await logChange(INJ, saved.id, 'created', null, saved);
    injectables.push(saved);
    renderInjectables(); renderCustomers(); toast(t('Αποθηκεύτηκε ✓'));
  } catch (e) { toast(t('Σφάλμα: {msg}', { msg: e.message }), true); renderInjectables(); }
}
// the customers' ticks for a removed column are kept: adding the column back brings them back
async function removeInjectable(id) {
  const inj = injectables.find(i => i.id === id);
  if (!confirm(t('Αφαίρεση του «{name}» από τον γύρο {n};', { name: inj.vaccine === CORYZA ? t(CORYZA) : inj.vaccine, n: inj.round }))) return;
  try {
    await sbFetch(`${INJ}?id=eq.${id}`, { method: 'DELETE' });
    await logChange(INJ, id, 'deleted', inj, null);
    injectables = injectables.filter(i => i.id !== id);
    renderInjectables(); renderCustomers(); toast(t('Διαγράφηκε.'));
  } catch (e) { toast(t('Σφάλμα: {msg}', { msg: e.message }), true); }
}

// ── CUSTOMERS' USUAL INJECTABLES ── one select per customer × injectable: — / Εμείς / Πελάτης
function renderCustomers() {
  [1, 2].forEach(round => {
    const cols = injectables.filter(i => i.round === round);
    const usual = (c, v) => (customerInj.find(u => u.customer === c && u.round === round && u.vaccine === v) || {}).payer || '';
    const cell = (c, v) => { const now = usual(c, v);
      return `<td><select class="cell${now ? ' on' : ''}" data-customer="${escapeHtml(c)}" data-round="${round}" data-vaccine="${escapeHtml(v)}" onchange="setUsual(this)">` +
        Object.entries(PAYER_LABEL).map(([k, label]) => `<option value="${k}"${k === now ? ' selected' : ''}>${k ? t(label) : label}</option>`).join('') + '</select></td>'; };
    document.getElementById(`cust-${round}`).innerHTML = !customers.length
      ? `<p class="empty-state">${t('Δεν υπάρχουν πελάτες στον Προγραμματισμό.')}</p>`
      : `<table><thead><tr><th>${t('Πελάτης')}</th>${cols.map(c => `<th>${injLabel(c.vaccine)}</th>`).join('')}</tr></thead><tbody>` +
        customers.map(c => `<tr><td>${escapeHtml(c)}</td>${cols.map(col => cell(c, col.vaccine)).join('')}</tr>`).join('') + '</tbody></table>';
  });
}
// saves one cell at once: ticked → upsert, '—' → delete
async function setUsual(sel) {
  const { customer, vaccine } = sel.dataset, round = Number(sel.dataset.round), payer = sel.value;
  const before = customerInj.find(u => u.customer === customer && u.round === round && u.vaccine === vaccine) || null;
  const after = payer ? { customer, round, vaccine, payer } : null;
  try {
    if (after) await sbFetch(`${CUST}?on_conflict=customer,round,vaccine`, { method: 'POST', prefer: 'resolution=merge-duplicates', body: JSON.stringify(after) });
    else await sbFetch(`${CUST}?customer=eq.${encodeURIComponent(customer)}&round=eq.${round}&vaccine=eq.${encodeURIComponent(vaccine)}`, { method: 'DELETE' });
    await logChange(CUST, `${customer}|${round}|${vaccine}`, !before ? 'created' : after ? 'edited' : 'deleted', before, after);
    customerInj = customerInj.filter(u => u !== before).concat(after ? [after] : []);
    sel.classList.toggle('on', !!after);
    setSync('ok', t('Αποθηκεύτηκε ✓'));
  } catch (e) {
    sel.value = before ? before.payer : '';
    toast(t('Σφάλμα: {msg}', { msg: e.message }), true);
  }
}

// ── SUPPLIER PER VACCINE ──
function fillSupplierList() {
  document.getElementById('supplier-list').innerHTML = [...new Set(suppliers.map(s => s.supplier).filter(Boolean))].sort()
    .map(s => `<option value="${escapeHtml(s)}">`).join('');
}
function renderSuppliers() {
  fillSupplierList();
  document.getElementById('sup-body').innerHTML = suppliers.map(s =>
    `<tr><td>${escapeHtml(s.name)}</td><td><input type="text" list="supplier-list" value="${escapeHtml(s.supplier || '')}" data-name="${escapeHtml(s.name)}" onchange="setSupplier(this)"></td></tr>`).join('');
}
// suppliers are stored in capitals, like the tracker's Προμηθευτής column (FAENTINA, ΚΟΜΠΟΥΛΗΣ)
async function setSupplier(input) {
  const v = suppliers.find(s => s.name === input.dataset.name);
  const supplier = input.value.trim().toUpperCase() || null;
  try {
    const [saved] = await sbFetch(`vaccines?name=eq.${encodeURIComponent(v.name)}`, { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ supplier }) }) || [];
    if (!saved) throw new Error(t('Η εγγραφή δεν υπάρχει πια — ανανεώστε τη σελίδα.'));
    await logChange('vaccines', v.name, 'edited', { supplier: v.supplier }, { supplier });
    v.supplier = supplier; input.value = supplier || '';
    fillSupplierList(); setSync('ok', t('Αποθηκεύτηκε ✓'));
  } catch (e) { input.value = v.supplier || ''; toast(t('Σφάλμα: {msg}', { msg: e.message }), true); }
}

// ── INIT ──
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProg(); });
// shared sign-in, load-once guard and home/ΕΛ-EN/Έξοδος buttons: common.js
startPage({ onSignedIn: name => { currentUser = name; loadAll(); }, translated: true,
  hasUnsavedWork: () => document.getElementById('prog-bg').style.display !== 'none' });
</script>
</body>
</html>
```

- [ ] **Step 4: Run the checks in Greek** — serve the scratchpad on port 8766 (`python -m http.server 8766 --directory <scratchpad>`, in the background), open `http://localhost:8765/vaccine_programme.html?r=2` in the browser pane, then with `javascript_tool`:

```js
const s = document.createElement('script'); s.src = 'http://localhost:8766/vp_checks.js?' + Date.now(); document.head.append(s);
```
```js
await runChecks()
```
Expected: every line `PASS`.

- [ ] **Step 5: Run the checks in English** — `localStorage.lang = 'en'`, reload with `?r=3`, rerun. Expected: every line `PASS` and `missing:` empty. Then `localStorage.lang = 'el'`.

- [ ] **Step 6: Syntax check** — the CLAUDE.md `node --check` recipe on `vaccine_programme.html`. Expected: no output.

- [ ] **Step 7: Look at it** — screenshot the page in the pane (desktop and 375 px) with the stubbed data; the four sections are readable and the grid scrolls sideways on a phone.

---

### Task 3: Νεοσσοί on the scheduler card

**Files:** Modify `schedule_checker.html` (modal markup near the `m-breed` group; `openModal`, `openEditModal`, `saveNew`, `cardBody`, `hcard`; TRANSLATIONS block); scratch `<scratchpad>/sc_chicks_checks.js`

**Interfaces:** Consumes `placements.chicks` (Task 1). Produces nothing new for other tasks (step 2 reads `placements.chicks` directly).

- [ ] **Step 1: Write the failing checks** — `<scratchpad>/sc_chicks_checks.js`:

```js
// Νεοσσοί on schedule_checker.html — stubbed data, then `await runChecks()`.
(() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  window.runChecks = async () => {
    const out = [], check = (n, ok) => out.push((ok ? 'PASS ' : 'FAIL ') + n), writes = [];
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
    const ROWS = [{ id: 'a1', house: 'Θ3', doc_date: ago(2), breed: 'Hy-Line', status: 'Confirmed', ptino: null, keep: false, chicks: 55000, customers: [] }];
    window.sbFetch = async (p, o = {}) => {
      if (o.method) { writes.push(`${o.method} ${p} ${o.body || ''}`); return [{ ...ROWS[0], ...JSON.parse(o.body || '{}') }]; }
      if (p.startsWith('resolved_conflicts')) return [];
      return JSON.parse(JSON.stringify(ROWS));
    };
    const cb = [..._sb.auth.stateChangeEmitters.values()].pop().callback;
    cb('INITIAL_SESSION', { user: { id: 'u1', email: 'panos@internal.local', user_metadata: { lang: LANG } }, access_token: 't' });
    await wait(1500);
    const card = document.getElementById('card-a1'); if (!card.classList.contains('open')) card.click();
    check('card shows chicks', card.innerText.includes('55.000') && card.innerText.includes(t('Νεοσσοί')));
    openEditModal('a1');
    check('edit window filled', document.getElementById('m-chicks').value === '55.000');
    document.getElementById('m-chicks').value = '56.500'; await saveNew();
    check('chicks saved as a number', writes.some(w => w.startsWith('PATCH placements') && w.includes('"chicks":56500')));
    openEditModal('a1'); document.getElementById('m-chicks').value = '12,5'; await saveNew();
    check('decimal refused', !writes.some(w => w.includes('"chicks":12')));
    closeModal();
    openEditModal('a1'); document.getElementById('m-chicks').value = ''; await saveNew();
    check('empty saves null', writes.some(w => w.includes('"chicks":null')));
    check('no missing translations', LANG === 'el' || window.missingTranslations.size === 0);
    return out.join('\n');
  };
})();
```

- [ ] **Step 2: Run them to see them fail** — load into `schedule_checker.html?r=1`. Expected: `FAIL card shows chicks` (and the rest fail on the missing `m-chicks` field).

- [ ] **Step 3: Add the field to the add/edit window** — in `schedule_checker.html`, right after the `m-breed` `fgroup` `</div>`:

```html
    <div class="fgroup">
      <label data-t>Νεοσσοί (τοποθετημένοι)</label>
      <input type="text" id="m-chicks" inputmode="numeric" data-t-placeholder placeholder="π.χ. 55.000" />
    </div>
```

- [ ] **Step 4: Fill it and save it** — change `openModal` to take the chicks and `openEditModal` to pass them:

```js
function openModal(title, house, date, breed, status, saveText, ptino = '', chicks = null){
  document.getElementById('modal-title').textContent = title;
  document.getElementById('m-house').value  = house;
  document.getElementById('m-house').disabled = !!editId;
  document.getElementById('m-date').value   = date;
  document.getElementById('m-breed').value  = breed;
  document.getElementById('m-status').value = status;
  document.getElementById('m-ptino').value  = ptino;
  document.getElementById('m-chicks').value = chicks ? nf(chicks) : '';
  document.getElementById('m-save').textContent = saveText;
  document.getElementById('modal-bg').classList.remove('hidden');
  checkModalWarn();
}
```
```js
  openModal(t('Επεξεργασία τοποθέτησης'), r.house, r.doc_date, r.breed||'', r.status, t('Ενημέρωση'), r.ptino||'', r.chicks);
```
In `saveNew`, after `const ptino = …`:
```js
  // chicks placed: a whole number, dots allowed as thousands ("55.000"); empty = not known yet
  const chicksText = document.getElementById('m-chicks').value.trim();
  if(chicksText && !/^(\d{1,3}(\.\d{3})+|\d+)$/.test(chicksText)){ setSyncStatus('err', t('Οι νεοσσοί πρέπει να είναι ακέραιος αριθμός (π.χ. 55.000).')); return; }
  const chicks = chicksText ? Number(chicksText.replace(/\./g, '')) : null;
```
and add `chicks` to both payloads:
```js
      const [updated] = await sbUpdate(id, {doc_date:date, breed, status, ptino, chicks, ...(status === 'Confirmed' && {keep:false})});
```
```js
      const [inserted] = await sbInsert({house, doc_date:date, breed, status, ptino, chicks, keep: addKeep && status !== 'Confirmed'});
```

- [ ] **Step 5: Show it on the card** — `cardBody` gets a `chicks` parameter (signature becomes `function cardBody(house, s, breed, hl = new Set(), ptino = null, chicks = null){`) and one new expanded-only row inserted directly after the `row(t('Εκκόλαψη'), fmt(s.hatch), true) +` line:

```js
    row(t('Νεοσσοί'), chicks ? nf(chicks) : '—', false, true) +
```
and in `hcard` the `cardBody(...)` call passes the chicks, looked up from `custId` (the placement id; the dashed suggestion card has none):
```js
    `<div class="hc-breed">${breed}</div>` + cardBody(house, s, rawBreed, hl, ptino, custId && data.find(x => x.id === custId).chicks) + custButton(custId) +
```

- [ ] **Step 6: Translations** — add to the scheduler's TRANSLATIONS block:

```js
  'Νεοσσοί': 'Chicks placed', 'Νεοσσοί (τοποθετημένοι)': 'Chicks placed', 'π.χ. 55.000': 'e.g. 55.000',
  'Οι νεοσσοί πρέπει να είναι ακέραιος αριθμός (π.χ. 55.000).': 'Chicks placed must be a whole number (e.g. 55.000).',
```

- [ ] **Step 7: Run the checks** — Greek then English (`localStorage.lang`), plus the existing scheduler state runner `sc_states.js` from the earlier sessions (its texts must be unchanged apart from the new Νεοσσοί row). Expected: all `PASS`, `node --check` clean.

---

### Task 4: Link, backup, docs

**Files:** Modify `vaccine_tracker.html` (toolbar near line 645, phone CSS near line 500, TRANSLATIONS); `backup.py`; `CLAUDE.md`

- [ ] **Step 1: Toolbar link** — next to the `📦 Απόθεμα` link in `vaccine_tracker.html`:

```html
    <a data-t href="vaccine_programme.html" class="btn-tool" data-t-title title="Πρόγραμμα εμβολίων και συνήθη ενέσιμα πελατών">🗓 Πρόγραμμα</a>
```
phone CSS, next to the inventory rules:
```css
  a.btn-tool[href="vaccine_programme.html"]{font-size:0}
  a.btn-tool[href="vaccine_programme.html"]::before{content:"🗓";font-size:16px}
```
translations (check `grep -n "'Πρόγραμμα'" vaccine_tracker.html` first — no clash expected):
```js
  '🗓 Πρόγραμμα': '🗓 Programme', 'Πρόγραμμα εμβολίων και συνήθη ενέσιμα πελατών': "Vaccine programme and customers' usual injections",
```

- [ ] **Step 2: Backup** — in `backup.py`, add to `extra`:

```python
        ("Πρόγραμμα Εμβολίων",     fetch("vaccine_programme",    "day.asc")),
        ("Ενέσιμα ανά Γύρο",       fetch("injectables",          "round.asc")),
        ("Ενέσιμα Πελατών",        fetch("customer_injectables", "customer.asc")),
        ("Ιστορικό Ρυθμίσεων",     fetch("settings_history",     "ts.desc")),
```
and in `cleanup_old_history` the list becomes `["emvolia_history", "inventory_history", "settings_history"]` (user's 6-month rule). Check: `python -c "import ast; ast.parse(open('backup.py', encoding='utf-8').read())"`.

- [ ] **Step 3: CLAUDE.md** — in "Tools" add:
`- vaccine_programme.html — settings for vaccine planning: the saved programme (vaccine_programme), injectables per round (injectables), customers' usual injectables (customer_injectables), default supplier per vaccine (vaccines.supplier); every change logged to settings_history. Design: docs/superpowers/specs/2026-11-06-vaccine-planning-design.md`
and in the Supabase gotcha about `vaccines`: "read + insert only — plus UPDATE of the `supplier` column (column grant)". Mention `placements.chicks` (Νεοσσοί) under schedule_checker.

- [ ] **Step 4: Whole-repo checks** — the static checks script from the 2026-11-05 audit (syntax + `?v=` + ids + handlers over every page) passes on all 8 pages.

---

### Task 5: Review and hand-over

- [ ] **Step 1:** /ponytail-review on the full diff; apply cuts that keep behaviour.
- [ ] **Step 2:** Show the user: screenshots of the new page and the scheduler field (stubbed data), the check results, and the diff summary. Ask them to fill the customers' usual injectables after deploy (the grid starts empty — not seeded from past free-text notes).
- [ ] **Step 3:** On "commit": commit all step-1 files plus the updated spec, push, confirm GitHub Pages deployed.

```bash
git add vaccine_programme.html schedule_checker.html vaccine_tracker.html backup.py CLAUDE.md docs/superpowers/specs/2026-11-06-vaccine-planning-design.md docs/superpowers/plans/2026-11-06-vaccine-planning-step1-settings.md
git commit -m "Vaccine planning step 1: programme settings page, suppliers, chicks placed"
```
