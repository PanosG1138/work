# Hatch εμβολιακά — Step 4: "Start the εμβολιακό" reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From 35 days before a hatch until its εμβολιακό is activated, a big banner above the houses on the homepage and above the tabs in the beta tracker says so — amber, red once the first order is already late — with a button that opens that hatch's sheet.

**Architecture:** One pure function `vaxReminders(...)` and one HTML builder `vaxReminderHtml(list, hrefOf)` in common.js (VACCINE PLANNING block), styles in theme.css, both bumped to `?v=16` on all 9 pages. The homepage and the beta each load the few things it needs (recent hatches, εμβολιακό records, the hatch's lines, the template's days) and draw `#vax-remind`. The beta opens a hatch's sheet from the link `#vax=<placement id>` (also from the homepage). No database change.

**Tech Stack:** plain HTML/JS, Supabase via `sbFetch`, common.js / theme.css.

**Spec:** `docs/superpowers/specs/2026-11-06-hatch-programmes-and-bin-design.md` (section 4; layout option A).

## Global Constraints

- Shown from **35 days before** the hatch date until the εμβολιακό is **activated**; never for binned hatches (older than 126 days).
- A hatch entered the old way (tracker lines, no εμβολιακό record) is **not** reminded: its lines are already live.
- **Late** (red): the first order date has passed — for a draft εμβολιακό the earliest order date of its draft lines; without one, hatch date + the template's first day − 30.
- One line per hatch: days left (big number; age "ημ. N" once hatched), house · hatch date, state (no εμβολιακό / draft), "πρώτη παραγγελία από dd/mm/yyyy" when late, button "Άνοιγμα εμβολιακού →".
- Every visible Greek text through `t()` with English (shared words in common.js); "no missing translations" in EN.
- Code style: clear names, short comments, banners. Stubbed data only. No commit/push without "commit and push now"; /ponytail-review first.
- Edits by a script: normalise CRLF, assert each replacement matches once, write at the end.

---

### Task 1: Checks first — `<session scratchpad>/remind_checks.js`

```js
// Checks for the "start the εμβολιακό" reminder — stubbed data only. Load into vaccine_tracker_beta.html, then `await runChecks()`.
(() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  window.runChecks = async () => {
    const out = [], check = (n, ok) => out.push((ok ? 'PASS ' : 'FAIL ') + n);
    const T = todayIso(), d = n => subDays(T, -n);
    const programme = [{ days: [8, 38] }, { days: [15] }, { days: [60] }];
    const placements = [
      { id: 'A', house: 'Θ1', doc_date: d(40) },    // too far ahead
      { id: 'B', house: 'Θ2', doc_date: d(30) },    // no εμβολιακό, first order d(8) → not late
      { id: 'C', house: 'Θ3', doc_date: d(18) },    // no εμβολιακό, first order d(-4) → late
      { id: 'D', house: 'Θ4', doc_date: d(10) },    // draft, a draft line ordered by d(-2) → late
      { id: 'E', house: 'Θ5', doc_date: d(-20) },   // active → never
      { id: 'F', house: 'Θ1', doc_date: d(-50) },   // old way: lines, no record → never
      { id: 'G', house: 'Θ2', doc_date: d(-130) },  // binned → never
      { id: 'H', house: 'Θ5', doc_date: d(-3) },    // draft, hatched 3 days ago, no draft line late
    ];
    const plans = [{ placement_id: 'D', activated_at: null }, { placement_id: 'E', activated_at: '2026-01-01' }, { placement_id: 'H', activated_at: null }];
    const rows = [
      { anath: 'Θ4', hm_ekk: d(10), hm_paragelia: d(-2), draft: true }, { anath: 'Θ4', hm_ekk: d(10), hm_paragelia: d(5), draft: true },
      { anath: 'Θ1', hm_ekk: d(-50), hm_paragelia: d(-60), draft: false },
      { anath: 'Θ5', hm_ekk: d(-3), hm_paragelia: d(20), draft: true },
    ];
    const list = vaxReminders({ placements, plans, rows, programme, today: T });
    check('who is reminded: C, D, H, B (by hatch date)', list.map(r => r.placement.id).join() === 'H,D,C,B');
    check('late: C (template) and D (draft line)', list.filter(r => r.late).map(r => r.placement.id).sort().join() === 'C,D');
    check('first order of C = hatch + 8 − 30', list.find(r => r.placement.id === 'C').firstOrder === d(-4));
    check('states', list.map(r => r.state).join() === 'draft,draft,none,none');
    check('days left / age', list.find(r => r.placement.id === 'B').days === 30 && list.find(r => r.placement.id === 'H').days === -3);
    check('activated → gone', vaxReminders({ placements, plans: plans.map(p => ({ ...p, activated_at: 'x' })), rows, programme, today: T }).every(r => r.state === 'none'));

    const html = vaxReminderHtml(list, p => `#vax=${p.id}`);
    const box = document.createElement('div'); box.innerHTML = html;
    check('late group first and red', box.firstElementChild.classList.contains('late') && box.children.length === 2);
    check('one line per hatch, link to its sheet', box.querySelectorAll('.vr-row').length === 4 && !!box.querySelector('a[href="#vax=C"]'));
    check('hatched: age instead of days', box.textContent.includes(t('ημ. {n}', { n: 3 })));
    check('late line shows the first order date', box.textContent.includes(t('πρώτη παραγγελία από {d}', { d: d(-4).split('-').reverse().join('/') })));
    check('nothing to remind → empty', vaxReminderHtml([], p => '') === '');

    // the beta draws it above the tabs and opens a sheet from #vax=<id>
    const S = [{ id: 'p1', house: 'Θ3', doc_date: d(20), breed: 'ISA', chicks: 1000, customers: [] }];
    window.sbFetch = async (p, o = {}) => {
      if (o.method) return null;
      if (p.startsWith('placements')) return JSON.parse(JSON.stringify(S));
      if (p.startsWith('vaccine_programme')) return [{ id: 1, kind: 'general', vaccine: 'SALMOVAC', days: [8], rule: 'fixed', fixed_qty: 1, extra_pct: 0, divide_by: 1, round_to: 1000, unit: 'Δόσεις' }];
      if (p.startsWith('hatch_plans')) return [];
      return [];
    };
    const cb = [..._sb.auth.stateChangeEmitters.values()].pop().callback;
    cb('INITIAL_SESSION', { user: { id: 'u1', email: 'panos@internal.local', user_metadata: { lang: LANG } }, access_token: 't' });
    await wait(1200);
    const banner = document.getElementById('vax-remind');
    check('beta: banner above the tabs, late (first order d(-2))', !!banner.querySelector('.vax-remind.late a[href="#vax=p1"]')
      && banner.compareDocumentPosition(document.querySelector('.tabs')) === Node.DOCUMENT_POSITION_FOLLOWING);
    location.hash = '#vax=p1'; await wait(500);
    check('beta: #vax=<id> opens the sheet', !document.getElementById('tab-vax').hidden && sheetHatchId === 'p1' && document.getElementById('vax-sheet').textContent.includes('Θ3'));

    check('no missing translations', LANG === 'el' || window.missingTranslations.size === 0);
    return out.join('\n') + (LANG === 'en' ? '\nmissing: ' + [...window.missingTranslations].join(' | ') : '');
  };
})();
```

Homepage check (run in the browser on `index.html?r=…` after sign-in callback with a stub): `#vax-remind a[href="vaccine_tracker_beta.html#vax=p1"]` exists above `#tiles`.

- [ ] Run on the beta: `ReferenceError: vaxReminders is not defined`.

### Task 2: common.js + theme.css

- [ ] **common.js**, at the end of the VACCINE PLANNING block (after `planQty`):

```js
// ── VAX REMINDER ── homepage + beta tracker: hatches whose εμβολιακό must be started or activated.
// From VAX_REMIND_DAYS before the hatch until activation; not hatches entered the old way (lines, no record), not binned ones.
const VAX_REMIND_DAYS = 35, VAX_BIN_DAYS = 126;
const isoPlus = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isoGr = iso => iso.split('-').reverse().join('/');   // 2026-11-24 → 24/11/2026
// placements {id,house,doc_date}, plans {placement_id,activated_at}, rows {anath,hm_ekk,hm_paragelia,draft}, programme {days}
function vaxReminders({ placements, plans, rows, programme, today }) {
  const firstDay = Math.min(...programme.flatMap(r => r.days || []));
  return placements.filter(p => p.doc_date <= isoPlus(today, VAX_REMIND_DAYS) && p.doc_date >= isoPlus(today, -VAX_BIN_DAYS)).map(p => {
    const plan = plans.find(x => x.placement_id === p.id);
    const lines = rows.filter(r => r.anath === p.house && r.hm_ekk === p.doc_date);
    if ((plan && plan.activated_at) || (!plan && lines.length)) return null;
    // the first order: the earliest draft line's, or (no εμβολιακό yet) the template's first day − 30
    const firstOrder = plan ? lines.filter(r => r.draft && r.hm_paragelia).map(r => r.hm_paragelia).sort()[0] || null
      : isFinite(firstDay) ? isoPlus(p.doc_date, firstDay - 30) : null;
    return { placement: p, state: plan ? 'draft' : 'none', days: Math.round((Date.parse(p.doc_date) - Date.parse(today)) / 864e5),
      firstOrder, late: !!firstOrder && firstOrder <= today };
  }).filter(Boolean).sort((a, b) => a.placement.doc_date.localeCompare(b.placement.doc_date));
}
// the banner: late hatches first (red), then the rest (amber); hrefOf(placement) = the link that opens its sheet
function vaxReminderHtml(list, hrefOf) {
  const group = (late, items) => !items.length ? '' : `<div class="vax-remind${late ? ' late' : ''}"><div class="vr-title">` +
    (late ? '⚠ ' + t('Εμβολιακό — έχουν ήδη αργήσει παραγγελίες') : '🗓 ' + t('Ξεκινήστε το εμβολιακό')) + '</div>' +
    items.map(r => `<div class="vr-row"><div class="vr-days">${r.days >= 0 ? r.days + `<small>${t('ημέρες')}</small>` : t('ημ. {n}', { n: -r.days })}</div>` +
      `<div class="vr-who"><b>${escapeHtml(r.placement.house)}</b> · ${t('εκκόλαψη')} ${isoGr(r.placement.doc_date)}` +
      `<span>${t(r.state === 'draft' ? 'Πρόχειρο — δεν έχει ενεργοποιηθεί' : 'Δεν έχει ξεκινήσει εμβολιακό')}` +
      `${r.late ? ' · ' + t('πρώτη παραγγελία από {d}', { d: isoGr(r.firstOrder) }) : ''}</span></div>` +
      `<a class="vr-btn" href="${hrefOf(r.placement)}">${t('Άνοιγμα εμβολιακού →')}</a></div>`).join('') + '</div>';
  return group(true, list.filter(r => r.late)) + group(false, list.filter(r => !r.late));
}
```

  and in the shared `addTranslations({` (top of common.js), a line:

```js
  // the "start the εμβολιακό" banner (VAX REMINDER)
  'Ξεκινήστε το εμβολιακό': 'Start the vaccination plan', 'Εμβολιακό — έχουν ήδη αργήσει παραγγελίες': 'Vaccination plan — orders are already late',
  'ημέρες': 'days', 'εκκόλαψη': 'hatch', 'ημ. {n}': 'day {n}', 'Πρόχειρο — δεν έχει ενεργοποιηθεί': 'Draft — not activated',
  'Δεν έχει ξεκινήσει εμβολιακό': 'No vaccination plan yet', 'πρώτη παραγγελία από {d}': 'first order from {d}', 'Άνοιγμα εμβολιακού →': 'Open plan →',
```

  Header comment of common.js: VACCINE PLANNING is now also used by index.html.

- [ ] **theme.css**, new section at the end:

```css
/* ── VAX REMINDER ── "start the εμβολιακό" banner (vaxReminderHtml in common.js): homepage + beta tracker */
.vax-remind{border:2px solid var(--gh-attention-fg);background:var(--gh-attention-subtle);border-radius:var(--gh-r-lg);padding:12px 16px;margin-bottom:10px;color:var(--gh-attention-fg);font-family:'Inter',system-ui,sans-serif}
.vax-remind.late{border-color:var(--gh-danger-fg);background:var(--gh-danger-subtle);color:var(--gh-danger-fg)}
.vr-title{font-size:17px;font-weight:700;margin-bottom:6px}
.vr-row{display:flex;align-items:center;gap:14px;padding:8px 0;border-top:1px solid var(--gh-border-default)}
.vr-days{font-size:24px;font-weight:700;min-width:64px;text-align:center;line-height:1}
.vr-days small{display:block;font-size:11px;font-weight:400}
.vr-who{flex:1;font-size:14px;color:var(--gh-fg-default)}
.vr-who span{display:block;font-size:12px;color:var(--gh-fg-muted)}
.vr-btn{border:1px solid var(--gh-border-default);border-radius:var(--rs);padding:6px 12px;background:var(--gh-canvas-subtle);color:var(--gh-fg-default);font-size:13px;text-decoration:none;white-space:nowrap}
.vr-btn:hover{background:var(--gh-hover-bg)}
```

- [ ] `?v=15` → `?v=16` on all 9 pages (common.js and theme.css links).

### Task 3: Beta tracker

- [ ] markup: before `  <nav class="tabs">` add `  <div id="vax-remind"></div>`.
- [ ] script, after `loadPlanHatches` (3a):

```js
// the "start the εμβολιακό" banner above the tabs (vaxReminders / vaxReminderHtml in common.js); never blocks loading
let remindData = null;
async function loadReminders() {
  const today = todayIso();
  try {
    const [placements, plans, programme] = await Promise.all([
      sbFetch(`placements?select=id,house,doc_date&doc_date=gte.${subDays(today, VAX_BIN_DAYS)}&doc_date=lte.${subDays(today, -VAX_REMIND_DAYS)}`),
      sbFetch(`${PLANS}?select=placement_id,activated_at`),
      sbFetch('vaccine_programme?select=days'),
    ]);
    remindData = { placements, plans, programme };
  } catch (e) { remindData = null; }
}
function renderReminders() {
  const box = document.getElementById('vax-remind');
  if (!remindData) { box.innerHTML = ''; return; }
  // the Εμβολιακά tab's records are newer once it has been opened (create / activate / delete)
  const plans = vaxData ? vaxData.plans : remindData.plans;
  box.innerHTML = vaxReminderHtml(vaxReminders({ ...remindData, plans, rows: data, today: todayIso() }), p => `#vax=${p.id}`);
}
```
- [ ] `loadData`: `[data] = await Promise.all([sbSelect(), loadVaccineNames(), loadPlanHatches()]);` → add `loadReminders()` to the list.
- [ ] end of `render()`: after `renderVax();` add `renderReminders();`.
- [ ] `#vax=<id>` opens that hatch's sheet: replace the init line `showTab(location.hash.slice(1));` with

```js
// "#vax=<placement id>" (banner links, also from the homepage) opens that hatch's sheet
function openFromHash() {
  const [tab, hatchId] = location.hash.slice(1).split('=');
  if (hatchId) sheetHatchId = hatchId;
  showTab(tab);
}
openFromHash();
window.addEventListener('hashchange', openFromHash);
```

### Task 4: Homepage

- [ ] markup: in `<section class="dash" id="dash">` before `<div class="sec" data-t>Θάλαμοι</div>` add `<div id="vax-remind"></div>`.
- [ ] script, after `loadDashboard`'s data load (separately, so a failure never hides the dashboard): at the end of `loadDashboard()` add `loadVaxReminder(placements, todayIso);` and

```js
// the "start the εμβολιακό" banner above the houses (common.js VAX REMINDER); opens the hatch's sheet in the beta tracker
async function loadVaxReminder(placements, todayIso) {
  try {
    const since = isoOf(addDays(new Date(todayIso), -VAX_BIN_DAYS));
    const [plans, rows, programme] = await Promise.all([
      sbFetch('hatch_plans?select=placement_id,activated_at'),
      sbFetch(`emvolia?select=anath,hm_ekk,hm_paragelia,draft&hm_ekk=gte.${since}`),
      sbFetch('vaccine_programme?select=days'),
    ]);
    document.getElementById('vax-remind').innerHTML = vaxReminderHtml(vaxReminders({ placements, plans, rows, programme, today: todayIso }),
      p => `vaccine_tracker_beta.html#vax=${p.id}`);
  } catch (e) { /* the banner is a reminder only: the dashboard stays as it is */ }
}
```

### Task 5: Run, commit

- [ ] `remind_checks.js` EL + EN on the beta; homepage stub check; `vax_checks.js` (44), `vax3b_checks.js` (29), `tabs_checks.js` (12) still green; `vp_checks.js` (33) on the template page (v=16). Screenshot homepage + beta with a banner.
- [ ] CLAUDE.md: common.js gets "VAX REMINDER (`vaxReminders`, `vaxReminderHtml`, VAX_REMIND_DAYS 35, VAX_BIN_DAYS 126) — homepage + beta banner"; page count unchanged; v=16.
- [ ] /ponytail-review; on "commit and push now": add all 9 pages, common.js, theme.css, CLAUDE.md, this plan; message `Vaccine plans: "start the εμβολιακό" banner on the homepage and beta tracker` + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push; confirm Pages serves `vax-remind` on index.html.
