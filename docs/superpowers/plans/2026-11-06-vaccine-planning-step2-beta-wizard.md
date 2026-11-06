# Vaccine planning — Step 2: beta tracker + "Νέα εκκόλαψη από πρόγραμμα" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A side-by-side copy of the vaccine tracker, `vaccine_tracker_beta.html`, with a new window that turns the saved programme + the hatch's customers into that hatch's tracker rows in one step (editable preview, nothing saved until Αποθήκευση).

**Architecture:** The beta starts as an exact copy of `vaccine_tracker.html` (same rows, same table) plus a BETA badge and the new window. The wizard reads the step-1 settings (`vaccine_programme`, `injectables`, `customer_injectables`, `vaccines.supplier`) and `placements` (chicks, customers), builds rows in the tracker's existing format (`posotita` stays free text during the beta), and saves them with the tracker's existing `insertRows` (history "created"). One new column, `emvolia.payer`. The shared rules `customerName`, `CORYZA`, `CORYZA_PRODUCTS` move into common.js.

**Tech Stack:** plain HTML/CSS/JS, common.js, PostgREST via `sbFetch`, Supabase Postgres, Python (backup.py).

**Spec:** `docs/superpowers/specs/2026-11-06-vaccine-planning-design.md` — sections 3 ("Νέα εκκόλαψη από πρόγραμμα"), "ΥΠΟΛΟΙΠΑ row", "Beta page for steps 2–3". Step 1 plan: `docs/superpowers/plans/2026-11-06-vaccine-planning-step1-settings.md`.

## Global Constraints

- No frameworks/build/dependencies; one way to do things; fail fast; no dead code (CLAUDE.md).
- Clear names, short comments, `// ── NAME ──` banners.
- Every fixed Greek text tagged or through `t()`, with an English line; "injectables" = "injections" in English; vaccine/customer/supplier names never translated.
- `vaccine_tracker.html` keeps working exactly as today — the only change there is one "Beta" link.
- During the beta, `posotita` stays free text and stays the truth (spec "Beta page"): the wizard writes `"55000"` for doses and `"5 ΚΙΛΑ"` / `"12 ΜΠΟΥΚΑΛΑΚΙΑ"` otherwise.
- `common.js` / `theme.css` change → `?v=13` on all 9 pages (8 + the beta) in the same commit.
- RLS unchanged (emvolia already has authenticated-only policies); never anon.
- Database SQL goes to the user (SQL Editor), then verified with `execute_sql`.
- Never test against live data; nothing committed until the user says "commit"; /ponytail-review first.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisions taken in this plan (technical, stated for the user)

- Wizard rows follow today's tracker conventions so they look like hand-entered ones:
  Πελάτης in capitals without accents ("Βενιζέλος" → "ΒΕΝΙΖΕΛΟΣ"), Σχόλια Πάνος "ΠΡΩΤΑ ΕΝΕΣΙΜΑ Θ3" /
  "ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ Θ3" on injectable rows (same text the add form's checkbox writes), order date = vaccination − 30.
- `payer` = NULL when we pay, the customer's name (capitals) when billed directly.
- A customer booked twice in one hatch is added up; customers with 0 booked birds are left out.
- The ΥΠΟΛΟΙΠΑ row offers only — / Εμείς (a leftover can't be billed to a customer).
- Hatches offered: placements from 60 days ago onwards. A hatch that already has tracker rows, or has no Νεοσσοί,
  is listed but can't be picked (with the reason shown). Re-checked against the database just before saving.
- ΚΟΡΥΖΑ products offered: BIONEW BI + COR, CORIPRAVAC (spec decision 9).

## Files

- Modify `common.js` — new block `── VACCINE PLANNING ──` (`customerName`, `CORYZA`, `CORYZA_PRODUCTS`).
- Modify `vaccine_programme.html` — drop its local `customerName` / `CORYZA` (now in common.js).
- Create `vaccine_tracker_beta.html` — copy of the tracker + BETA badge + the plan window.
- Modify `vaccine_tracker.html` — "🧪 Beta" link in the header.
- Modify all 9 pages — `?v=13`.
- Modify `backup.py` — `payer` in the Δεδομένα tab.
- Modify `CLAUDE.md` — the beta page, `emvolia.payer`, "tracker fixes go to both files while the beta exists".
- Scratch: `<scratchpad>/step2.sql`, `<scratchpad>/plan_checks.js`, `<scratchpad>/vp_checks.js` (step 1, rerun), `<scratchpad>/vt_states.js` (rerun).

---

### Task 1: `emvolia.payer`

**Interfaces — Produces:** `emvolia.payer text` (NULL = we pay; else the customer's name in capitals).

- [ ] **Step 1: SQL** — `<scratchpad>/step2.sql`:

```sql
-- Vaccine planning, step 2: who pays for an entry. NULL = us; otherwise the customer billed directly
-- (e.g. ΣΥΝΤΙΧΑΚΗΣ). The old tracker never writes it, so its edits leave it as it is.
alter table emvolia add column payer text;
```

- [ ] **Step 2:** Give it to the user (SQL Editor → New query → Run); wait for "done".
- [ ] **Step 3: Verify:** `select count(*) from information_schema.columns where table_name='emvolia' and column_name='payer';` → 1.
- [ ] **Step 4: backup.py** — add `"payer"` after `"pelatis"` in `DATA_COLUMNS` and `"ΠΛΗΡΩΝΕΙ"` after `"ΠΕΛΑΤΗΣ"` in `DATA_HEADERS`. Check: `python -c "import ast; ast.parse(open('backup.py', encoding='utf-8').read())"`.

---

### Task 2: Shared rules move into common.js

**Interfaces — Produces:** `customerName(s) → string`, `CORYZA = 'ΚΟΡΥΖΑ'`, `CORYZA_PRODUCTS = ['BIONEW BI + COR', 'CORIPRAVAC']` (globals from common.js).

- [ ] **Step 1: common.js** — after the VACCINE NAMES block (before `── LOADING RULES ──`):

```js
// ── VACCINE PLANNING ── used by vaccine_programme.html and vaccine_tracker_beta.html.
// Design: docs/superpowers/specs/2026-11-06-vaccine-planning-design.md
// customer = text before " - " in placements.customers ("Συντιχάκης - από Δεκ 2026" → "Συντιχάκης")
const customerName = s => String(s || '').split(' - ')[0].trim();
// ΚΟΡΥΖΑ is a column of the injectables grid, not a product: one of these is picked for each hatch
const CORYZA = 'ΚΟΡΥΖΑ';
const CORYZA_PRODUCTS = ['BIONEW BI + COR', 'CORIPRAVAC'];
```

- [ ] **Step 2: vaccine_programme.html** — delete its own `const CORYZA = 'ΚΟΡΥΖΑ';   // a grid column…` line and the two lines
`// customer = text before " - " …` + `const customerName = …` (keep the `// ── RULES ──` banner, now
`// ── RULES ── (customerName and CORYZA: common.js, VACCINE PLANNING)`). Declaring them twice would be a SyntaxError.

- [ ] **Step 3: `?v=13`** — `sed -i 's/common\.js?v=12/common.js?v=13/; s/theme\.css?v=12/theme.css?v=13/' *.html` (after Task 3 creates the beta, it inherits v=13 from the copy).

- [ ] **Step 4: Check** — rerun step 1's `vp_checks.js` on `vaccine_programme.html` (Greek + English): all PASS. Static checks script: all pages syntax OK, all `?v=13`.

---

### Task 3: The beta page

**Files:** Create `vaccine_tracker_beta.html` (copy); modify `vaccine_tracker.html` (Beta link)

- [ ] **Step 1: Copy** — `cp vaccine_tracker.html vaccine_tracker_beta.html` (after Task 2, so it carries `?v=13`).

- [ ] **Step 2: Mark it as the beta** — in `vaccine_tracker_beta.html`:
  - `<title data-t>ΕΜΒΟΛΙΑ</title>` → `<title data-t>ΕΜΒΟΛΙΑ — Beta</title>`
  - after `<span data-t class="logo-title">ΕΜΒΟΛΙΑ</span>` add
    `<a href="vaccine_tracker.html" class="beta-badge" data-t-title title="Δοκιμαστική έκδοση — πατήστε για την κανονική">BETA</a>`
  - CSS (next to `.logo-title`): `.beta-badge{margin-left:8px;padding:1px 8px;border-radius:99px;border:1px solid rgba(240,180,41,0.5);background:var(--gh-attention-subtle);color:var(--gh-attention-fg);font-size:11px;font-weight:700;letter-spacing:.05em;text-decoration:none}`
  - TRANSLATIONS: `'ΕΜΒΟΛΙΑ — Beta': 'VACCINES — Beta', 'Δοκιμαστική έκδοση — πατήστε για την κανονική': 'Test version — click for the normal one',`

- [ ] **Step 3: Link from the tracker** — in `vaccine_tracker.html`, after the 🗓 Πρόγραμμα link:

```html
    <a data-t href="vaccine_tracker_beta.html" class="btn-tool" data-t-title title="Δοκιμαστική έκδοση με τις νέες λειτουργίες">🧪 Beta</a>
```
TRANSLATIONS: `'🧪 Beta': '🧪 Beta', 'Δοκιμαστική έκδοση με τις νέες λειτουργίες': 'Test version with the new features',`
(The beta, being a copy, also has this link; delete it from the beta — it would point at itself.)

- [ ] **Step 4: Regression** — run the earlier `vt_states.js` state runner on `vaccine_tracker.html` and on `vaccine_tracker_beta.html`; compare per state (added/removed lines, as done for the scheduler in step 1). Expected: tracker = before + the 🧪 Beta link only; beta = tracker − Beta link + BETA badge/title only.

---

### Task 4: The plan window (beta only)

**Files:** Modify `vaccine_tracker_beta.html` (markup next to the other modals, sidebar button under `openWizard()`'s button, CSS, a new script block before `// ── INIT ──`, TRANSLATIONS); scratch `<scratchpad>/plan_checks.js`

**Interfaces:**
- Consumes: common.js `customerName`, `CORYZA`, `CORYZA_PRODUCTS`, `resolveVaccineName`, `sbFetch`, `t`, `escapeHtml`; tracker `insertRows(rows, now)`, `subDays(iso, n)`, `todayIso()`, `guardConnected()`, `dateOrderInvalid(hatch, vacc)`, `resolveVaccineAlts(s)`, `fmt(iso)`, `toast`, `render`, `setSyncStatus`, `data`, `currentUser`, `#vaccine-list` datalist.
- Produces (step 3 may reuse): `planQty(row, chicks)`, `posotitaText(qty, unit)`, `pelatisName(name)`, `hatchCustomers(placement)`, `buildPlanRows(plan)`, `LEFTOVER = 'ΥΠΟΛΟΙΠΑ'`.

- [ ] **Step 1: Write the failing checks** — `<scratchpad>/plan_checks.js`:

```js
// Checks for the beta's "Νέα εκκόλαψη από πρόγραμμα" window — stubbed data only. Load, then `await runChecks()`.
(() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  window.runChecks = async () => {
    const out = [], check = (n, ok) => out.push((ok ? 'PASS ' : 'FAIL ') + n), writes = [];
    const PROGRAMME = [
      { id: 1, day: 8,  kind: 'general', vaccine: 'SALMOVAC', rule: 'placed', factor: 1, round_to: 1000, fixed_qty: null, unit: 'Δόσεις' },
      { id: 2, day: 15, kind: 'general', vaccine: 'IB 4/91', rule: 'placed', factor: 0.65, round_to: 10000, fixed_qty: null, unit: 'Δόσεις' },
      { id: 3, day: 24, kind: 'general', vaccine: 'TARTYLL', rule: 'fixed', factor: 1, round_to: 1000, fixed_qty: 5, unit: 'Κιλά' },
      { id: 4, day: 60, kind: 'injectables_1', vaccine: null, rule: 'placed', factor: 1, round_to: 1000, fixed_qty: null, unit: 'Δόσεις' },
      { id: 5, day: 82, kind: 'injectables_2', vaccine: null, rule: 'placed', factor: 1, round_to: 1000, fixed_qty: null, unit: 'Δόσεις' },
    ];
    const INJ = [{ round: 1, vaccine: 'SG-9R', sort: 1 }, { round: 1, vaccine: 'ΚΟΡΥΖΑ', sort: 2 }, { round: 2, vaccine: 'SG-9R', sort: 1 }];
    const USUAL = [{ customer: 'Συντιχάκης', round: 1, vaccine: 'SG-9R', payer: 'customer' }, { customer: 'Κόκος', round: 1, vaccine: 'ΚΟΡΥΖΑ', payer: 'us' }];
    const VACCINES = [{ name: 'SALMOVAC', supplier: null }, { name: 'IB 4/91', supplier: null }, { name: 'TARTYLL', supplier: null },
      { name: 'SG-9R', supplier: 'ΤΡΑΙΚΟΥΔΗΣ' }, { name: 'CORIPRAVAC', supplier: null }, { name: 'BIONEW BI + COR', supplier: 'FAENTINA' }];
    const today = new Date().toISOString().slice(0, 10);
    const PLACEMENTS = [
      { id: 'p1', house: 'Θ3', doc_date: today, breed: 'Hy-Line', chicks: 55000, customers: [
        { name: 'Συντιχάκης', k: 15000, l: 2000, c: 0 }, { name: 'Κόκος - σημείωση', k: 6000, l: 3000, c: 0 },
        { name: 'Κόκος', k: 1000, l: 0, c: 0 }, { name: 'Παπαγιάννης', k: 0, l: 0, c: 0 }] },
      { id: 'p2', house: 'Θ4', doc_date: today, breed: 'ISA', chicks: null, customers: [] },
      { id: 'p3', house: 'Θ5', doc_date: '2026-10-27', breed: 'Hy-Line', chicks: 70000, customers: [] },
    ];
    let existingRows = [];
    window.sbFetch = async (p, o = {}) => {
      if (o.method) { writes.push(`${o.method} ${p} ${o.body || ''}`); return o.prefer && o.prefer.includes('return=representation') ? [{ id: 1000 + writes.length, ...JSON.parse(o.body) }] : null; }
      if (p.startsWith('vaccine_programme')) return JSON.parse(JSON.stringify(PROGRAMME));
      if (p.startsWith('injectables')) return JSON.parse(JSON.stringify(INJ));
      if (p.startsWith('customer_injectables')) return JSON.parse(JSON.stringify(USUAL));
      if (p.startsWith('vaccines')) return JSON.parse(JSON.stringify(VACCINES));
      if (p.startsWith('placements')) return JSON.parse(JSON.stringify(PLACEMENTS));
      if (p.startsWith('emvolia?select=id')) return existingRows;
      if (p.startsWith('emvolia_history')) return [];
      if (p.startsWith('emvolia')) return [{ id: 7, anath: 'Θ5', hm_ekk: '2026-10-27', hm_emv: '2026-11-04', emvolio: 'SALMOVAC', posotita: '70000' }];
      throw new Error('unexpected fetch ' + p);
    };
    const cb = [..._sb.auth.stateChangeEmitters.values()].pop().callback;
    cb('INITIAL_SESSION', { user: { id: 'u1', email: 'panos@internal.local', user_metadata: { lang: LANG } }, access_token: 't' });
    await wait(1500); closeChangelog();

    // pure rules
    check('planQty placed ×1', planQty(PROGRAMME[0], 55000) === 55000);
    check('planQty formula rounds up', planQty(PROGRAMME[1], 55000) === 40000);
    check('planQty fixed', planQty(PROGRAMME[2], 55000) === 5);
    check('posotitaText doses', posotitaText(55000, 'Δόσεις') === '55000');
    check('posotitaText kg with comma', posotitaText(2.5, 'Κιλά') === '2,5 ΚΙΛΑ');
    check('pelatisName capitals, no accents', pelatisName('Βενιζέλος') === 'ΒΕΝΙΖΕΛΟΣ');
    const hc = hatchCustomers(PLACEMENTS[0]);
    check('hatchCustomers adds up, drops 0, adds ΥΠΟΛΟΙΠΑ',
      JSON.stringify(hc.map(c => [c.name, c.qty])) === JSON.stringify([['Συντιχάκης', 17000], ['Κόκος', 10000], ['ΥΠΟΛΟΙΠΑ', 28000]]));

    // picker
    await openPlan(); await wait(100);
    const picks = [...document.querySelectorAll('#plan-body .plan-hatch')];
    check('picker lists the 3 hatches', picks.length === 3);
    check('no chicks → disabled', picks.find(b => b.textContent.includes('Θ4')).disabled);
    check('already has rows → disabled', picks.find(b => b.textContent.includes('Θ5')).disabled);

    // preview
    pickPlan('p1'); await wait(50);
    check('general rows from programme', document.querySelectorAll('#plan-body .plan-general tbody tr').length === 3);
    check('fixed row text', plan.general[2].posotita === '5 ΚΙΛΑ');
    check('dates = hatch + day', plan.general[0].date === subDays(today, -8));
    check('usual payer pre-filled', plan.rounds[0].cells['Συντιχάκης']['SG-9R'] === 'customer');
    check('ΥΠΟΛΟΙΠΑ unticked', Object.values(plan.rounds[0].cells['ΥΠΟΛΟΙΠΑ']).every(v => v === ''));
    check('ΥΠΟΛΟΙΠΑ has no Πελάτης option', [...document.querySelectorAll('#plan-body select.cell[data-c="ΥΠΟΛΟΙΠΑ"] option')].every(o => o.value !== 'customer'));

    // ΚΟΡΥΖΑ ticked (Κόκος) without a product → refused
    await savePlan();
    check('no product → nothing saved', !writes.some(w => w.startsWith('POST emvolia ')));
    plan.rounds[0].coryza = 'CORIPRAVAC';

    // existing rows appear meanwhile → refused
    existingRows = [{ id: 1 }];
    await savePlan();
    check('hatch filled meanwhile → nothing saved', !writes.some(w => w.startsWith('POST emvolia ')));
    existingRows = [];

    // save
    const before = data.length;
    await savePlan(); await wait(50);
    const rows = writes.filter(w => w.startsWith('POST emvolia ')).map(w => JSON.parse(w.slice(w.indexOf('{'))));
    check('rows saved: 3 general + 2 round-1', rows.length === 5);
    const sg = rows.find(r => r.emvolio === 'SG-9R');
    check('customer-billed row', sg.pelatis === 'ΣΥΝΤΙΧΑΚΗΣ' && sg.payer === 'ΣΥΝΤΙΧΑΚΗΣ' && sg.posotita === '17000' && sg.promitheutis === 'ΤΡΑΙΚΟΥΔΗΣ');
    const cor = rows.find(r => r.emvolio === 'CORIPRAVAC');
    check('ΚΟΡΥΖΑ → chosen product, we pay', cor && cor.pelatis === 'ΚΟΚΟΣ' && cor.payer === null && cor.posotita === '10000');
    check('injectable note', sg.sxolia_panos === 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ Θ3');
    check('order date = vaccination − 30', rows.every(r => r.hm_paragelia === subDays(r.hm_emv, 30)));
    check('general rows: no customer, we pay', rows.filter(r => !r.pelatis).length === 3 && rows.filter(r => !r.pelatis).every(r => r.payer === null));
    check('history "created" per row', writes.filter(w => w.startsWith('POST emvolia_history') && w.includes('"created"')).length === 5);
    check('rows shown in the table', data.length === before + 5);
    check('window closed', document.getElementById('plan-bg').style.display === 'none');
    check('no missing translations', LANG === 'el' || window.missingTranslations.size === 0);
    return out.join('\n') + (LANG === 'en' ? '\nmissing: ' + [...window.missingTranslations].join(' | ') : '');
  };
})();
```

- [ ] **Step 2: Run them to see them fail** — on `vaccine_tracker_beta.html?r=1`. Expected: `ReferenceError: planQty is not defined`.

- [ ] **Step 3: Markup** — in `vaccine_tracker_beta.html`, next to the other modals (after the `wizard-bg` block):

```html
<!-- PLAN A HATCH FROM THE PROGRAMME — pick a hatch, edit the preview, save -->
<div id="plan-bg" class="modal-bg" style="display:none" onclick="if(event.target===this)closePlan()">
  <div class="modal plan-modal">
    <h3 data-t>Νέα εκκόλαψη από πρόγραμμα</h3>
    <div id="plan-body"></div>
    <datalist id="plan-supplier-list"></datalist>
    <div class="modal-actions">
      <button data-t class="btn-secondary" id="plan-back" onclick="plan = null; renderPlan()" style="display:none">← Πίσω</button>
      <div style="flex:1"></div>
      <button data-t class="btn-secondary" onclick="closePlan()">Ακύρωση</button>
      <button data-t class="btn-primary" id="plan-save" onclick="savePlan()" style="display:none">Αποθήκευση</button>
    </div>
  </div>
</div>
```
Sidebar, right after the `openWizard()` button:
```html
    <button data-t class="btn-wizard-entry" onclick="openPlan()">🗓 Νέα εκκόλαψη από πρόγραμμα</button>
```
CSS (with the other modal styles):
```css
/* plan a hatch from the programme (beta) */
.plan-modal{width:1000px}
.plan-hatch{display:block;width:100%;text-align:left;margin-bottom:6px;padding:8px 12px;border:1px solid var(--gh-border-default);border-radius:var(--rs);background:var(--gh-canvas-default);color:var(--gh-fg-default);font:inherit;cursor:pointer}
.plan-hatch:hover:not(:disabled){border-color:var(--gh-accent-fg)}
.plan-hatch:disabled{opacity:.5;cursor:default}
.plan-why{color:var(--gh-fg-muted);font-size:12px;margin-left:8px}
.plan-sec{margin:14px 0 6px;font-weight:600;font-size:13px}
.plan-modal table{width:100%;border-collapse:collapse;font-size:12px}
.plan-modal th,.plan-modal td{padding:4px 6px;border-bottom:1px solid var(--gh-border-muted);text-align:left}
.plan-modal td input[type=text],.plan-modal td input[type=date]{width:100%;padding:3px 6px;font-size:12px}
.plan-modal select.cell{padding:2px 4px;font-size:12px}
.plan-modal select.cell.on{border-color:rgba(79,209,139,0.5);color:var(--gh-success-fg)}
/* vaccine names get the room (35%): tick, date, quantity and supplier columns have set shares */
.plan-general{table-layout:fixed}
.plan-general th:nth-child(1){width:5%}.plan-general th:nth-child(2){width:23%}.plan-general th:nth-child(4){width:17%}.plan-general th:nth-child(5){width:20%}
.plan-sec select{width:auto;display:inline-block;padding:3px 8px;font-size:12px}
```
(The last four lines were added during the build: in a narrow window the vaccine names were cut off and the ΚΟΡΥΖΑ select stretched full width.)

- [ ] **Step 4: Script** — new block before `// ── INIT ──`:

```js
// ── PLAN A HATCH FROM THE PROGRAMME ── (beta) the saved programme + the hatch's customers → that hatch's
// rows, as an editable preview; nothing is saved until Αποθήκευση. Settings: vaccine_programme.html.
// Rows are written in the tracker's usual format (Ποσότητα stays text during the beta — see the spec).
let planData = null;   // programme, injectables, usual lists, suppliers, recent placements — read when the window opens
let plan = null;       // the preview being edited; null = choosing the hatch

const LEFTOVER = 'ΥΠΟΛΟΙΠΑ';   // the chicks no customer has booked (chicks placed − booked)
const UNIT_TEXT = { Κιλά: 'ΚΙΛΑ', Μπουκαλάκια: 'ΜΠΟΥΚΑΛΑΚΙΑ' };   // how Ποσότητα writes non-dose units
// one programme row's quantity for a hatch: chicks × factor, rounded up to round_to — or the fixed amount
const planQty = (r, chicks) => r.rule === 'fixed' ? Number(r.fixed_qty) : Math.ceil(chicks * Number(r.factor) / r.round_to) * r.round_to;
// Ποσότητα as the tracker stores it: "55000" for doses, "5 ΚΙΛΑ" otherwise
const posotitaText = (qty, unit) => UNIT_TEXT[unit] ? `${String(qty).replace('.', ',')} ${UNIT_TEXT[unit]}` : String(qty);
// Πελάτης as the tracker writes it: capitals without accents ("Βενιζέλος" → "ΒΕΝΙΖΕΛΟΣ")
const pelatisName = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
// the hatch's customers with their booked birds (a name booked twice is added up, 0 left out), then ΥΠΟΛΟΙΠΑ
function hatchCustomers(placement) {
  const booked = new Map();
  (placement.customers || []).forEach(c => { const n = customerName(c.name); if (n) booked.set(n, (booked.get(n) || 0) + c.k + c.l + c.c); });
  const list = [...booked].filter(([, qty]) => qty > 0).map(([name, qty]) => ({ name, qty, leftover: false }));
  const left = placement.chicks - list.reduce((sum, c) => sum + c.qty, 0);
  return left > 0 ? [...list, { name: LEFTOVER, qty: left, leftover: true }] : list;
}
const hatchHasRows = p => data.some(r => r.anath === p.house && r.hm_ekk === p.doc_date);

async function openPlan() {
  if (!guardConnected()) return;
  try {
    const [programme, injectables, usual, vaccines, placements] = await Promise.all([
      sbFetch('vaccine_programme?order=day.asc,id.asc'),
      sbFetch('injectables?order=round.asc,sort.asc'),
      sbFetch('customer_injectables?select=customer,round,vaccine,payer'),
      sbFetch('vaccines?select=name,supplier'),
      sbFetch(`placements?select=id,house,doc_date,breed,chicks,customers&doc_date=gte.${subDays(todayIso(), 60)}&order=doc_date.asc`),
    ]);
    planData = { programme, injectables, usual, placements, supplier: Object.fromEntries(vaccines.map(v => [v.name, v.supplier || ''])) };
  } catch (e) { toast(t('Σφάλμα φόρτωσης: {msg}', { msg: e.message }), true); return; }
  document.getElementById('plan-supplier-list').innerHTML = [...new Set(Object.values(planData.supplier).filter(Boolean))].sort()
    .map(s => `<option value="${x(s)}">`).join('');
  plan = null; renderPlan();
  document.getElementById('plan-bg').style.display = 'flex';
}
function closePlan() { document.getElementById('plan-bg').style.display = 'none'; plan = null; }

// a hatch was picked: build the preview from the programme and the customers' usual lists
function pickPlan(id) {
  const p = planData.placements.find(x => x.id === id);
  const customers = hatchCustomers(p);
  const general = planData.programme.filter(r => r.kind === 'general').map(r => ({ include: true, vaccine: r.vaccine,
    date: subDays(p.doc_date, -r.day), posotita: posotitaText(planQty(r, p.chicks), r.unit), supplier: planData.supplier[r.vaccine] || '' }));
  const usualPayer = (c, round, v) => (planData.usual.find(u => u.customer === c && u.round === round && u.vaccine === v) || {}).payer || '';
  const rounds = [1, 2].map(round => {
    const placeholder = planData.programme.find(r => r.kind === `injectables_${round}`);
    const cols = planData.injectables.filter(i => i.round === round).map(i => i.vaccine);
    return placeholder && { round, date: subDays(p.doc_date, -placeholder.day), coryza: '', cols,
      cells: Object.fromEntries(customers.map(c => [c.name, Object.fromEntries(cols.map(v => [v, c.leftover ? '' : usualPayer(c.name, round, v)]))])) };
  }).filter(Boolean);   // a round whose ΕΝΕΣΙΜΑ row isn't in the programme is skipped
  plan = { placement: p, customers, general, rounds };
  renderPlan();
}

function renderPlan() {
  const body = document.getElementById('plan-body');
  document.getElementById('plan-back').style.display = plan ? '' : 'none';
  document.getElementById('plan-save').style.display = plan ? '' : 'none';
  if (!plan) {   // choose the hatch
    body.innerHTML = `<p class="plan-sec">${t('Επιλέξτε εκκόλαψη')}</p>` + (planData.placements.map(p => {
      const why = hatchHasRows(p) ? t('έχει ήδη γραμμές') : !p.chicks ? t('χωρίς Νεοσσούς — συμπληρώστε τους στον Προγραμματισμό') : '';
      return `<button class="plan-hatch" onclick="pickPlan('${p.id}')"${why ? ' disabled' : ''}><b>${x(p.house)}</b> · ${fmt(p.doc_date)} · ${x(p.breed || '—')}` +
        (p.chicks ? ` · ${t('Νεοσσοί')} ${Number(p.chicks).toLocaleString('el-GR')}` : '') + (why ? `<span class="plan-why">${why}</span>` : '') + '</button>';
    }).join('') || `<p class="muted">${t('Δεν υπάρχουν εκκολάψεις.')}</p>`);
    return;
  }
  const p = plan.placement;
  const general = plan.general.map((g, i) => `<tr>
    <td><input type="checkbox"${g.include ? ' checked' : ''} onchange="plan.general[${i}].include = this.checked"></td>
    <td><input type="date" value="${g.date}" onchange="plan.general[${i}].date = this.value"></td>
    <td><input type="text" list="vaccine-list" value="${x(g.vaccine)}" onchange="plan.general[${i}].vaccine = this.value.trim()"></td>
    <td><input type="text" value="${x(g.posotita)}" onchange="plan.general[${i}].posotita = this.value.trim()"></td>
    <td><input type="text" list="plan-supplier-list" value="${x(g.supplier)}" onchange="plan.general[${i}].supplier = this.value.trim().toUpperCase()"></td></tr>`).join('');
  const payerOptions = (c, now) => [['', '—'], ['us', t('Εμείς')], ...(c.leftover ? [] : [['customer', t('Πελάτης')]])]
    .map(([k, label]) => `<option value="${k}"${k === now ? ' selected' : ''}>${label}</option>`).join('');
  const roundHtml = (r, k) => `<p class="plan-sec">${t(r.round === 1 ? 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ' : 'ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ')} ·
      <input type="date" value="${r.date}" onchange="plan.rounds[${k}].date = this.value" style="width:auto">` +
    (r.cols.includes(CORYZA) ? ` · ${t('ΚΟΡΥΖΑ')}: <select onchange="plan.rounds[${k}].coryza = this.value"><option value="">${t('— επιλογή —')}</option>` +
      CORYZA_PRODUCTS.map(v => `<option${v === r.coryza ? ' selected' : ''}>${x(v)}</option>`).join('') + '</select>' : '') + '</p>' +
    `<table><thead><tr><th>${t('Πελάτης')}</th><th>${t('Πουλιά')}</th>${r.cols.map(v => `<th>${v === CORYZA ? t(CORYZA) : x(v)}</th>`).join('')}</tr></thead><tbody>` +
    plan.customers.map(c => `<tr><td>${c.leftover ? t(LEFTOVER) : x(c.name)}</td><td>${c.qty.toLocaleString('el-GR')}</td>` +
      r.cols.map(v => `<td><select class="cell${r.cells[c.name][v] ? ' on' : ''}" data-k="${k}" data-c="${x(c.name)}" data-v="${x(v)}" onchange="planCell(this)">${payerOptions(c, r.cells[c.name][v])}</select></td>`).join('') +
      '</tr>').join('') + '</tbody></table>';
  body.innerHTML = `<p><b>${x(p.house)}</b> · ${t('Εκκόλαψη')} ${fmt(p.doc_date)} · ${x(p.breed || '—')} · ${t('Νεοσσοί')} ${Number(p.chicks).toLocaleString('el-GR')}</p>` +
    `<p class="plan-sec">${t('Εμβόλια')}</p><table class="plan-general"><thead><tr><th></th><th>${t('Ημ. Εμβολιασμού')}</th><th>${t('Εμβόλιο')}</th><th>${t('Ποσότητα')}</th><th>${t('Προμηθευτής')}</th></tr></thead><tbody>${general}</tbody></table>` +
    `<button class="btn-secondary" style="margin-top:6px" onclick="plan.general.push({ include: true, vaccine: '', date: '', posotita: '', supplier: '' }); renderPlan()">${t('+ Γραμμή')}</button>` +
    plan.rounds.map(roundHtml).join('') +
    (plan.customers.length ? '' : `<p class="muted">${t('Η εκκόλαψη δεν έχει πελάτες στον Προγραμματισμό.')}</p>`);
}
function planCell(sel) {
  plan.rounds[Number(sel.dataset.k)].cells[sel.dataset.c][sel.dataset.v] = sel.value;
  sel.classList.toggle('on', !!sel.value);
}

// the preview → tracker rows (same fields and conventions as a hand-entered row)
function buildPlanRows(plan) {
  const p = plan.placement;
  const base = { hm_ekk: p.doc_date, anath: p.house, hm_par: null, paragelia: null, psygeio: null, emvoliasmos: null, sxolia_eleni: null };
  const rows = plan.general.filter(g => g.include).map(g => ({ ...base, emvolio: g.vaccine, hm_emv: g.date, hm_paragelia: subDays(g.date, 30),
    posotita: g.posotita || null, pelatis: null, payer: null, promitheutis: g.supplier || null, sxolia_panos: null }));
  plan.rounds.forEach(r => plan.customers.forEach(c => r.cols.forEach(v => {
    const payer = r.cells[c.name][v];
    if (!payer) return;
    const emvolio = v === CORYZA ? r.coryza : v;
    rows.push({ ...base, emvolio, hm_emv: r.date, hm_paragelia: subDays(r.date, 30), posotita: String(c.qty),
      pelatis: c.leftover ? LEFTOVER : pelatisName(c.name), payer: payer === 'customer' ? pelatisName(c.name) : null,
      promitheutis: planData.supplier[emvolio] || null, sxolia_panos: `${r.round === 1 ? 'ΠΡΩΤΑ' : 'ΔΕΥΤΕΡΑ'} ΕΝΕΣΙΜΑ ${p.house}` });
  })));
  return rows;
}

async function savePlan() {
  if (!guardConnected()) return;
  const p = plan.placement, chosen = plan.general.filter(g => g.include);
  if (chosen.some(g => !g.vaccine || !g.date)) { toast(t('Κάθε επιλεγμένη γραμμή χρειάζεται εμβόλιο και ημερομηνία.'), true); return; }
  if (chosen.some(g => dateOrderInvalid(p.doc_date, g.date)) || plan.rounds.some(r => !r.date || dateOrderInvalid(p.doc_date, r.date))) {
    toast(t('Η ημ. εμβολιασμού δεν μπορεί να είναι πριν την εκκόλαψη'), true); return;
  }
  const noProduct = plan.rounds.find(r => !r.coryza && plan.customers.some(c => r.cells[c.name][CORYZA]));
  if (noProduct) { toast(t('Επιλέξτε προϊόν για την ΚΟΡΥΖΑ ({n}ος γύρος).', { n: noProduct.round }), true); return; }
  // a typed or edited vaccine name goes through the spelling check, like every other save
  for (const g of chosen) { const v = await resolveVaccineAlts(g.vaccine); if (v === null) return; g.vaccine = v; }
  const rows = buildPlanRows(plan);
  if (!rows.length) { toast(t('Δεν επιλέχθηκε καμία γραμμή.'), true); return; }
  const btn = document.getElementById('plan-save');
  btn.disabled = true;
  setSyncStatus('loading', t('Αποθήκευση…'));
  let saved = 0;
  try {
    // the other user may have entered this hatch since the window opened
    const existing = await sbFetch(`emvolia?select=id&anath=eq.${encodeURIComponent(p.house)}&hm_ekk=eq.${p.doc_date}&limit=1`);
    if (existing.length) { toast(t('Αυτή η εκκόλαψη έχει ήδη γραμμές — χρησιμοποιήστε τη φόρμα προσθήκης.'), true); setSyncStatus('ok', t('Συνδέθηκε ✓')); return; }
    const now = new Date().toISOString();
    rows.forEach(r => Object.assign(r, { created_by: currentUser, created_at: now, updated_by: currentUser, updated_at: now }));
    const before = data.length;
    try { await insertRows(rows, now); } finally { saved = data.length - before; }
    closePlan(); render();
    setSyncStatus('ok', t('Αποθηκεύτηκε ✓'));
    toast(t('{n} προστέθηκαν!', { n: saved }));
  } catch (e) {
    render();
    setSyncStatus('err', t('Σφάλμα'));
    toast(t('Σφάλμα μετά από {n} γραμμές: {msg}', { n: saved, msg: e.message }), true);
  } finally { btn.disabled = false; }
}
```
(`x()` is the tracker's own escape helper; `dateOrderInvalid`, `subDays`, `todayIso`, `fmt`, `insertRows`, `guardConnected`, `resolveVaccineAlts` already exist in the tracker.)
Also: Escape closes the window — add `closePlan();` to the tracker's existing Escape handler in the beta (find `e.key === 'Escape'` in the beta's keydown listener and add it there).

- [ ] **Step 5: Translations** — add to the beta's TRANSLATIONS block (check each Greek key isn't already there with `grep -n` first; skip the ones that are):

```js
  'Νέα εκκόλαψη από πρόγραμμα': 'New hatch from programme', '🗓 Νέα εκκόλαψη από πρόγραμμα': '🗓 New hatch from programme',
  '← Πίσω': '← Back', 'Επιλέξτε εκκόλαψη': 'Choose a hatch', 'έχει ήδη γραμμές': 'already has rows',
  'χωρίς Νεοσσούς — συμπληρώστε τους στον Προγραμματισμό': 'no chicks placed — fill them in on the scheduler',
  'Νεοσσοί': 'Chicks placed', 'Δεν υπάρχουν εκκολάψεις.': 'No hatches.', 'Εμβόλια': 'Vaccines', '+ Γραμμή': '+ Row',
  'ΠΡΩΤΑ ΕΝΕΣΙΜΑ': 'FIRST INJECTIONS', 'ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ': 'SECOND INJECTIONS', 'ΚΟΡΥΖΑ': 'CORYZA', 'ΥΠΟΛΟΙΠΑ': 'LEFTOVER',
  '— επιλογή —': '— choose —', 'Πουλιά': 'Birds', 'Εμείς': 'Us',
  'Η εκκόλαψη δεν έχει πελάτες στον Προγραμματισμό.': 'This hatch has no customers in the scheduler.',
  'Κάθε επιλεγμένη γραμμή χρειάζεται εμβόλιο και ημερομηνία.': 'Every ticked row needs a vaccine and a date.',
  'Επιλέξτε προϊόν για την ΚΟΡΥΖΑ ({n}ος γύρος).': 'Choose the product for CORYZA (round {n}).',
  'Δεν επιλέχθηκε καμία γραμμή.': 'No rows chosen.',
  'Αυτή η εκκόλαψη έχει ήδη γραμμές — χρησιμοποιήστε τη φόρμα προσθήκης.': 'This hatch already has rows — use the add form.',
  'Σφάλμα μετά από {n} γραμμές: {msg}': 'Error after {n} rows: {msg}',
```

- [ ] **Step 6: Run the checks** — Greek then English (`localStorage.lang`). Expected: all PASS, `missing:` empty. `node --check` clean.

- [ ] **Step 7: Look at it** — screenshots of the picker and the preview (stubbed data), desktop width.

---

### Task 5: Docs, review, hand-over

- [ ] **Step 1: CLAUDE.md** — Tools: `- vaccine_tracker_beta.html — side-by-side BETA of the vaccine tracker for vaccine planning steps 2–3 (spec "Beta page for steps 2–3"): the tracker + "Νέα εκκόλαψη από πρόγραμμα". **While it exists, any fix to vaccine_tracker.html must be made in the beta too.** It replaces the tracker at the switch.` Persistence: `emvolia.payer` (NULL = we pay, else the customer billed directly). "shared by all 8 pages" → 9 (and the `?v=N` line); common.js "Used by" list gets the beta; common.js's description lists the VACCINE PLANNING block.
- [ ] **Step 2:** static checks (9 pages, `?v=13`), /ponytail-review, show the user screenshots + check results.
- [ ] **Step 3:** On "commit": commit + push; confirm Pages deployed.

```bash
git add common.js theme.css *.html backup.py CLAUDE.md docs/superpowers/plans/2026-11-06-vaccine-planning-step2-beta-wizard.md
git commit -m "Vaccine planning step 2: beta tracker with 'Νέα εκκόλαψη από πρόγραμμα'"
```
