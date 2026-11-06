# Hatch εμβολιακά — Step 3b: editing inside the hatch sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Everything that changes during rearing can be done in the hatch's sheet: add a vaccine, tick/untick each customer's injections, move an injection round's day, change ΚΟΡΥΖΑ product, fix customers (rename / birds / remove / add), change Νεοσσοί with a recalculation of unordered lines, switch rounding — and nothing that was already ordered changes without a clear warning.

**Architecture:** Pure beta-page change (`vaccine_tracker_beta.html`), no database change. A new section `// ── HATCH ΕΜΒΟΛΙΑΚΑ: editing ──` after the 3a code. All writes go through three small helpers — `addLines`, `patchLines`, `removeLines` — that write `emvolia` + `emvolia_history` exactly like hand edits, and `savePlanRecord` for `hatch_plans` (+ `settings_history` via `logPlan`). The sheet gets an editing panel under the table (only when the hatch has an εμβολιακό). The edit window and the delete box also warn on ordered lines.

**Tech Stack:** plain HTML/JS, Supabase via `sbFetch`, common.js v=14 (`planQty`, `CORYZA`, `CORYZA_PRODUCTS`, `customerName`).

**Spec:** `docs/superpowers/specs/2026-11-06-hatch-programmes-and-bin-design.md` (section 3, "3b adds").

## Global Constraints

- One living εμβολιακό per hatch; its lines are the hatch's `emvolia` rows; never locked.
- Days of age: a round's day / a new line's day → date = hatch date + day; order date = date − 30.
- New lines of a draft εμβολιακό are draft (`draft = true`); of an active one, normal.
- Ordered lines (Παραγγελία = ΝΑΙ): a quantity change or a removal asks first and lists what was ordered; Νεοσσοί / birds recalculation never touches them.
- Recalculations (Νεοσσοί, birds) list every from → to and apply only on OK.
- Customers are fixed in `hatch_plans.customers` only; the scheduler is never written. Line `pelatis` = `pelatisName(name)`; customer-billed `payer` = the same.
- Injection quantity = birds rounded up to 1.000; ΥΠΟΛΟΙΠΑ (chicks − booked) payer us only.
- Every visible Greek text through `t()` with English; "no missing translations" in EN. Code style: clear names, short comments, banners.
- Stubbed data only. Never commit or push without "commit and push now"; /ponytail-review first.
- Edits by a script: normalise CRLF, assert each replacement matches once, write at the end.

## Interfaces (from 3a, used here)

`vaxData {programme, injectables, usual, placements, plans, supplier}`, `sheetHatchId`, `renderSheet()`, `hatchRows(p)`, `roundOf(r)`, `ageOf(r)`, `planOf(p)`, `vaxState(p)`, `logPlan(p, action, before, after)`, `posotitaText`, `pelatisName`, `dayDate`, `parseBirds`, `nfmt`, `PLANS`, tracker `insertRows(rows, now)`, `logDeleted(rows)`, `buildChanges(before, row)`, `sbHInsert`, `TABLE`, `data`, `render()`, `fmtPosotita`, `vaccineLabel`, `resolveVaccineAlts`, `guardConnected`.

## Produces

`sheetHatch()`, `templateOf(r)`, `stepOf(r, chicks)`, `roundCols(p, round)`, `roundDay(p, round)`, `roundLine(p, round, customerName, vaccine)`, `gridCustomers(p)`, `chicksRecalc(p, chicks) → [{row, to}]`, `addLines(p, lines)`, `patchLines(rows, fields)`, `removeLines(rows)`, `savePlanRecord(p, fields)`, `confirmOrdered(rows) → bool`; UI actions `setVaxChicks`, `setLineStep`, `addVaxLine`, `setRoundDay`, `setRoundCoryza`, `setVaxCell`, `renameVaxCustomer`, `setVaxBirds`, `removeVaxCustomer`, `addVaxCustomer`.

---

### Task 1: Checks first

- [ ] **Step 1: Write `<session scratchpad>/vax3b_checks.js`:**

```js
// Checks for editing inside the hatch sheet (3b) — stubbed data only. Load into vaccine_tracker_beta.html, then `await runChecks()`.
(() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  window.runChecks = async () => {
    const out = [], check = (n, ok) => out.push((ok ? 'PASS ' : 'FAIL ') + n), writes = [], asked = [];
    const today = todayIso(), H = subDays(today, -33), d = n => subDays(H, -n);
    const PROGRAMME = [
      { id: 1, days: [8],      kind: 'general', vaccine: 'SALMOVAC', rule: 'placed', extra_pct: 5, divide_by: 1, round_to: 1000, fixed_qty: null, unit: 'Δόσεις' },
      { id: 2, days: [15],     kind: 'general', vaccine: 'IB 4/91', rule: 'placed', extra_pct: 30, divide_by: 2, round_to: 10000, fixed_qty: null, unit: 'Δόσεις' },
      { id: 3, days: [24],     kind: 'general', vaccine: 'TARTYLL', rule: 'fixed', extra_pct: 0, divide_by: 1, round_to: 1000, fixed_qty: 5, unit: 'Κιλά' },
      { id: 4, days: [60],     kind: 'injectables_1', vaccine: null, rule: 'placed', extra_pct: 0, divide_by: 1, round_to: 1000, fixed_qty: null, unit: 'Δόσεις' },
    ];
    const INJ = [{ id: 1, round: 1, vaccine: 'SG-9R', sort: 1 }, { id: 2, round: 1, vaccine: 'ΚΟΡΥΖΑ', sort: 2 }];
    const P = { id: 'p1', house: 'Θ3', doc_date: H, breed: 'Hy-Line', chicks: null, customers: [] };
    const PLAN = { id: 50, placement_id: 'p1', chicks: 26400, customers: [{ name: 'Συντιχάκης', qty: 16400 }, { name: 'Κόκος', qty: 10000 }], activated_at: null, updated_at: 'x' };
    const L = (id, f) => ({ id, anath: 'Θ3', hm_ekk: H, hm_paragelia: subDays(f.hm_emv, 30), paragelia: null, payer: null, pelatis: null, sxolia_panos: null, draft: true, updated_at: 'x', ...f });
    const ROWS = [
      L(1, { hm_emv: d(8),  emvolio: 'SALMOVAC', posotita: '28000' }),
      L(2, { hm_emv: d(15), emvolio: 'IB 4/91', posotita: '20000' }),
      L(3, { hm_emv: d(24), emvolio: 'TARTYLL', posotita: '5 ΚΙΛΑ' }),
      L(4, { hm_emv: d(60), emvolio: 'SG-9R', posotita: '17000', pelatis: 'ΣΥΝΤΙΧΑΚΗΣ', payer: 'ΣΥΝΤΙΧΑΚΗΣ', sxolia_panos: 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ Θ3' }),
      L(5, { hm_emv: d(60), emvolio: 'CORIPRAVAC', posotita: '10000', pelatis: 'ΚΟΚΟΣ', sxolia_panos: 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ Θ3' }),
    ];
    let nextId = 200;
    window.sbFetch = async (p, o = {}) => {
      if (o.method) {
        writes.push(`${o.method} ${p} ${o.body || ''}`);
        const body = o.body ? JSON.parse(o.body) : null;
        if (o.method === 'DELETE') return null;
        if (p.startsWith('hatch_plans') && o.method === 'PATCH') { Object.assign(PLAN, body); return [JSON.parse(JSON.stringify(PLAN))]; }
        if (p.startsWith('emvolia?id=in.') && o.method === 'PATCH') return p.match(/\((.*)\)/)[1].split(',').map(id => ({ ...data.find(r => r.id === Number(id)), ...body }));
        if (p === 'emvolia' && o.method === 'POST') return [{ id: nextId++, ...body }];
        return null;
      }
      if (p.startsWith('vaccine_programme')) return JSON.parse(JSON.stringify(PROGRAMME));
      if (p.startsWith('injectables')) return JSON.parse(JSON.stringify(INJ));
      if (p.startsWith('customer_injectables')) return [];
      if (p.startsWith('vaccines')) return [{ name: 'SALMOVAC', supplier: 'FAENTINA' }, { name: 'IB 4/91', supplier: '' }, { name: 'TARTYLL', supplier: '' },
        { name: 'SG-9R', supplier: 'ΤΡΑΙΚΟΥΔΗΣ' }, { name: 'CORIPRAVAC', supplier: '' }, { name: 'BIONEW BI + COR', supplier: '' }, { name: 'MG 6/85', supplier: '' }];
      if (p.startsWith('placements')) return [JSON.parse(JSON.stringify(P))];
      if (p.startsWith('hatch_plans?select=placement')) return [{ placement: { house: 'Θ3', doc_date: H } }];
      if (p.startsWith('hatch_plans')) return [JSON.parse(JSON.stringify(PLAN))];
      if (p.startsWith('emvolia')) return JSON.parse(JSON.stringify(ROWS));
      return [];
    };
    let answer = true;
    window.confirm = msg => { asked.push(msg); return answer; };
    const cb = [..._sb.auth.stateChangeEmitters.values()].pop().callback;
    cb('INITIAL_SESSION', { user: { id: 'u1', email: 'panos@internal.local', user_metadata: { lang: LANG } }, access_token: 't' });
    await wait(1200);
    showTab('vax'); await wait(300); openSheet('p1');
    const p = sheetHatch(), row = id => data.find(r => r.id === id), since = n => writes.slice(n);
    let n;

    // pure rules
    check('templateOf matches vaccine + day', templateOf(row(1)).id === 1 && templateOf(row(4)) === undefined);
    check('stepOf finds the rounding used', stepOf(row(1), 26400) === 1000 && stepOf(row(2), 26400) === 10000);
    check('round columns: injectables + ΚΟΡΥΖΑ', roundCols(p, 1).join() === 'SG-9R,ΚΟΡΥΖΑ');
    check('round day from its lines', roundDay(p, 1) === 60);
    check('ΚΟΡΥΖΑ cell finds the product line', roundLine(p, 1, 'Κόκος', CORYZA).id === 5);
    check('editing panel shown', !!document.querySelector('#vax-sheet .vax-edit'));

    // Νεοσσοί → unordered template lines recalculated, ordered ones untouched
    row(2).paragelia = 'ΝΑΙ';
    n = writes.length; asked.length = 0;
    await setVaxChicks('30.000');
    check('chicks: record saved', since(n).some(w => w.startsWith('PATCH hatch_plans?id=eq.50') && w.includes('"chicks":30000')));
    check('chicks: from → to listed', asked.some(m => m.includes('SALMOVAC') && m.includes('28.000') && m.includes('32.000')));
    check('chicks: unordered line updated', since(n).some(w => w.startsWith('PATCH emvolia?id=in.(1)') && w.includes('"posotita":"32000"')));
    check('chicks: ordered + fixed lines untouched', !since(n).some(w => w.startsWith('PATCH emvolia?id=in.(2)') || w.startsWith('PATCH emvolia?id=in.(3)')));
    check('chicks: history written', since(n).some(w => w.startsWith('POST emvolia_history') && w.includes('posotita')));

    // rounding switch
    n = writes.length;
    await setLineStep(1, '10000');
    check('rounding: 30.000 +5% → 40.000', since(n).some(w => w.startsWith('PATCH emvolia?id=in.(1)') && w.includes('"posotita":"40000"')));

    // + Εμβόλιο
    document.getElementById('vx-add-day').value = '32'; document.getElementById('vx-add-vaccine').value = 'MG 6/85';
    document.getElementById('vx-add-qty').value = '30.000';
    n = writes.length;
    await addVaxLine();
    const added = since(n).map(w => w.startsWith('POST emvolia ') && JSON.parse(w.slice(w.indexOf('{')))).find(Boolean);
    check('add: date = hatch + day, order date − 30, draft', added && added.hm_emv === d(32) && added.hm_paragelia === subDays(d(32), 30) && added.draft === true && added.posotita === '30000');

    // injections grid
    n = writes.length;
    await setVaxCell(1, 'Κόκος', 'SG-9R', 'us');
    const tick = since(n).map(w => w.startsWith('POST emvolia ') && JSON.parse(w.slice(w.indexOf('{')))).find(Boolean);
    check('tick → line (birds ↑1.000, ΕΝΕΣΙΜΑ note)', tick && tick.pelatis === 'ΚΟΚΟΣ' && tick.payer === null && tick.posotita === '10000' && tick.sxolia_panos === 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ Θ3' && tick.hm_emv === d(60));
    n = writes.length;
    await setVaxCell(1, 'Κόκος', 'SG-9R', 'customer');
    check('payer → customer', since(n).some(w => w.startsWith('PATCH emvolia?id=in.') && w.includes('"payer":"ΚΟΚΟΣ"')));
    row(4).paragelia = 'ΝΑΙ';
    answer = false; n = writes.length; asked.length = 0;
    await setVaxCell(1, 'Συντιχάκης', 'SG-9R', '');
    check('untick ordered line → asked, refused → kept', asked.some(m => m.includes(t('έχουν ήδη παραγγελθεί').slice(0, 10))) && !since(n).some(w => w.startsWith('DELETE')));
    answer = true; n = writes.length;
    await setVaxCell(1, 'Κόκος', 'SG-9R', '');
    check('untick → line removed + logged', since(n).some(w => w.startsWith('DELETE emvolia?id=in.')) && since(n).some(w => w.includes('"deleted"')));

    // ΚΟΡΥΖΑ product + round day
    n = writes.length;
    await setRoundCoryza(1, 'BIONEW BI + COR');
    check('ΚΟΡΥΖΑ product changed on its lines', since(n).some(w => w.startsWith('PATCH emvolia?id=in.(5)') && w.includes('"emvolio":"BIONEW BI + COR"')));
    n = writes.length;
    await setRoundDay(1, '65');
    check('round day 60 → 65 moves its lines', since(n).some(w => w.startsWith('PATCH emvolia?id=in.') && w.includes(`"hm_emv":"${d(65)}"`) && w.includes(`"hm_paragelia":"${subDays(d(65), 30)}"`)));

    // customers
    n = writes.length;
    await renameVaxCustomer(1, 'Κόκκος');
    check('rename → lines + record', since(n).some(w => w.startsWith('PATCH emvolia?id=in.(5)') && w.includes('"pelatis":"ΚΟΚΚΟΣ"'))
      && since(n).some(w => w.startsWith('PATCH hatch_plans') && w.includes('Κόκκος')));
    n = writes.length;
    await renameVaxCustomer(1, 'Συντιχάκης');
    check('duplicate name refused', !since(n).some(w => w.startsWith('PATCH')));
    row(4).paragelia = null;
    n = writes.length; asked.length = 0;
    await setVaxBirds(0, '18.500');
    check('birds → injection qty offered + updated', asked.some(m => m.includes('17.000') && m.includes('19.000')) && since(n).some(w => w.startsWith('PATCH emvolia?id=in.(4)') && w.includes('"posotita":"19000"')));
    document.getElementById('vx-cust-name').value = 'Βενιζέλος'; document.getElementById('vx-cust-qty').value = '2.000';
    n = writes.length;
    await addVaxCustomer();
    check('customer added to the record', since(n).some(w => w.startsWith('PATCH hatch_plans') && w.includes('"name":"Βενιζέλος","qty":2000')));
    n = writes.length;
    await removeVaxCustomer(0);
    check('customer removed with its lines', since(n).some(w => w.startsWith('DELETE emvolia?id=in.(4)')) && since(n).some(w => w.startsWith('PATCH hatch_plans') && !w.includes('Συντιχάκης')));
    check('ΥΠΟΛΟΙΠΑ row in the grid (payer us only)', [...document.querySelector('#vax-sheet select.cell[data-c="ΥΠΟΛΟΙΠΑ"]').options].map(o => o.value).join() === ',us');

    // the edit window + delete box warn on ordered lines
    row(1).paragelia = 'ΝΑΙ';
    editEntry(1); await wait(50);
    document.getElementById('m-qty').value = '50000';
    answer = false; asked.length = 0; n = writes.length;
    await saveEdit();
    check('edit window: ordered qty change asked, refused → nothing saved', asked.length === 1 && !since(n).some(w => w.startsWith('PATCH')));
    closeModal(); answer = true;
    promptDelete(1);
    check('delete box: ordered note', document.getElementById('confirm-ordered').style.display !== 'none');
    closeConfirm();

    check('scheduler never written', !writes.some(w => w.includes('placements')));
    check('no missing translations', LANG === 'el' || window.missingTranslations.size === 0);
    return out.join('\n') + (LANG === 'en' ? '\nmissing: ' + [...window.missingTranslations].join(' | ') : '');
  };
})();
```

- [ ] **Step 2: Run to see it fail** — `vaccine_tracker_beta.html?r=1`: `ReferenceError: sheetHatch is not defined`. Also re-run `vax_checks.js` (44) and `tabs_checks.js` (12) after Task 2 — they must stay green.

### Task 2: The editing code

- [ ] **Step 1: Insert after `deleteVax` (end of the 3a block, before the Esc listener):**

```js
// ── HATCH ΕΜΒΟΛΙΑΚΑ: editing in the sheet (3b) ── every change writes emvolia + history like a hand edit;
// ordered lines (Παραγγελία = ΝΑΙ) never change without a warning, recalculations skip them
const sheetHatch = () => vaxData.placements.find(h => h.id === sheetHatchId);
const ROUND_LABEL = { 1: 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ', 2: 'ΔΕΥΤΕΡΑ ΕΝΕΣΙΜΑ' };
const LEFTOVER = 'ΥΠΟΛΟΙΠΑ';   // chicks no customer has booked
const injQty = birds => String(Math.ceil(birds / 1000) * 1000);   // injections: birds rounded up to 1.000
// the Βασικό εμβολιακό row a general line came from (same vaccine, its day in the row's days)
const templateOf = r => !roundOf(r) && !r.pelatis ? vaxData.programme.find(t => t.kind === 'general' && t.vaccine === r.emvolio && t.days.includes(ageOf(r))) : undefined;
// which rounding step reproduces the line's quantity, the template's own first (null = typed by hand)
const stepOf = (r, chicks) => { const tpl = templateOf(r);
  return tpl && tpl.rule === 'placed' ? [tpl.round_to, 1000, 5000, 10000].find(s => posotitaText(planQty({ ...tpl, round_to: s }, chicks), tpl.unit) === String(r.posotita)) ?? null : null; };
// a round's vaccine columns: that round's injectables + any vaccine already in its lines (ΚΟΡΥΖΑ products shown as ΚΟΡΥΖΑ)
const roundCols = (p, round) => [...new Set([...vaxData.injectables.filter(i => i.round === round).map(i => i.vaccine),
  ...hatchRows(p).filter(r => roundOf(r) === round).map(r => CORYZA_PRODUCTS.includes(r.emvolio) ? CORYZA : r.emvolio)])];
// a round's day of age: from its lines, else the template's ΕΝΕΣΙΜΑ row
const roundDay = (p, round) => { const l = hatchRows(p).find(r => roundOf(r) === round);
  return l ? ageOf(l) : ((vaxData.programme.find(t => t.kind === `injectables_${round}`) || {}).days || [null])[0]; };
const roundLine = (p, round, name, v) => hatchRows(p).find(r => roundOf(r) === round && r.pelatis === (name === LEFTOVER ? LEFTOVER : pelatisName(name))
  && (v === CORYZA ? CORYZA_PRODUCTS.includes(r.emvolio) : r.emvolio === v));
// the hatch's customers + ΥΠΟΛΟΙΠΑ when chicks are more than booked
const gridCustomers = p => { const pl = planOf(p), left = pl.chicks - pl.customers.reduce((s, c) => s + c.qty, 0);
  return [...pl.customers.map(c => ({ ...c, leftover: false })), ...(left > 0 ? [{ name: LEFTOVER, qty: left, leftover: true }] : [])]; };
let sheetCoryza = {};   // ΚΟΡΥΖΑ product chosen per round while no ΚΟΡΥΖΑ line exists yet
const coryzaOf = (p, round) => (hatchRows(p).find(r => roundOf(r) === round && CORYZA_PRODUCTS.includes(r.emvolio)) || {}).emvolio || sheetCoryza[round] || '';
const ordered = r => r.paragelia === 'ΝΑΙ';
// → true when none is ordered, or the user agrees after seeing what was ordered
function confirmOrdered(rows) {
  const o = rows.filter(ordered);
  return !o.length || confirm(t('Προσοχή: {n} γραμμές έχουν ήδη παραγγελθεί:\n{list}\nΣυνέχεια;', { n: o.length,
    list: o.map(r => `${vaccineLabel(r.emvolio)} · ${r.pelatis || '—'} · ${fmtPosotita(r.posotita)} · ${fmt(r.hm_emv)}`).join('\n') }));
}
// → true when the user agrees to a list of quantity changes (nothing to change = true)
const confirmChanges = (title, changes) => !changes.length || confirm(title + '\n' +
  changes.map(c => `${vaccineLabel(c.row.emvolio)}${c.row.pelatis ? ' · ' + c.row.pelatis : ''}: ${fmtPosotita(c.row.posotita)} → ${fmtPosotita(c.to)}`).join('\n'));

// ── writes ──
async function addLines(p, lines) {
  const now = new Date().toISOString();
  const base = { hm_ekk: p.doc_date, anath: p.house, hm_par: null, paragelia: null, psygeio: null, emvoliasmos: null, sxolia_eleni: null,
    payer: null, pelatis: null, sxolia_panos: null, draft: vaxState(p) === 'draft',
    created_by: currentUser, created_at: now, updated_by: currentUser, updated_at: now };
  await insertRows(lines.map(l => ({ ...base, hm_paragelia: subDays(l.hm_emv, 30), ...l })), now);
}
async function patchLines(rows, fields) {
  if (!rows.length) return;
  const now = new Date().toISOString();
  const updated = await sbFetch(`${TABLE}?id=in.(${rows.map(r => r.id).join(',')})`, { method: 'PATCH', prefer: 'return=representation',
    body: JSON.stringify({ ...fields, updated_at: now, updated_by: currentUser }) }) || [];
  await Promise.all(updated.map(u => sbHInsert({ row_id: u.id, action: 'edited', user_name: currentUser, ts: now,
    changes_json: JSON.stringify(buildChanges(data.find(r => r.id === u.id), fields)) })));
  updated.forEach(u => { const i = data.findIndex(r => r.id === u.id); if (i >= 0) data[i] = u; });
}
async function removeLines(rows) {
  if (!rows.length) return;
  await sbFetch(`${TABLE}?id=in.(${rows.map(r => r.id).join(',')})`, { method: 'DELETE' });
  await logDeleted(rows);
  rows.forEach(r => { const i = data.indexOf(r); if (i >= 0) data.splice(i, 1); });
}
async function savePlanRecord(p, fields) {
  const pl = planOf(p), now = new Date().toISOString();
  const [rec] = await sbFetch(`${PLANS}?id=eq.${pl.id}`, { method: 'PATCH', prefer: 'return=representation',
    body: JSON.stringify({ ...fields, updated_at: now, updated_by: currentUser }) });
  await logPlan(p, 'edited', pl, rec);
  Object.assign(pl, rec);
}
// every sheet action: connection check, errors as a toast, then the table + sheet redrawn
async function sheetAction(fn) {
  if (!guardConnected()) return;
  try { await fn(sheetHatch()); } catch (e) { toast(t('Σφάλμα: {msg}', { msg: e.message }), true); }
  render();
}

// unordered template lines + ΥΠΟΛΟΙΠΑ injection lines whose quantity changes with new chicks (hand-typed quantities stay)
function chicksRecalc(p, chicks) {
  const pl = planOf(p), booked = pl.customers.reduce((s, c) => s + c.qty, 0);
  return hatchRows(p).filter(r => !ordered(r)).map(r => {
    if (roundOf(r) && r.pelatis === LEFTOVER) return { row: r, to: injQty(Math.max(chicks - booked, 0)) };
    const tpl = templateOf(r);
    const step = tpl && tpl.rule === 'placed' ? stepOf(r, pl.chicks) : null;
    if (!step) return null;
    return { row: r, to: posotitaText(planQty({ ...tpl, round_to: step }, chicks), tpl.unit) };
  }).filter(c => c && c.to !== String(c.row.posotita));
}

// ── actions (called from the sheet) ──
const setVaxChicks = s => sheetAction(async p => {
  const n = parseBirds(s);
  if (!Number.isInteger(n) || n < 1) { toast(t('Οι νεοσσοί πρέπει να είναι θετικός ακέραιος.'), true); return; }
  const changes = chicksRecalc(p, n);
  await savePlanRecord(p, { chicks: n });
  if (changes.length && confirmChanges(t('Νέοι νεοσσοί {n}: ενημέρωση ποσοτήτων που δεν έχουν παραγγελθεί;', { n: nfmt(n) }), changes))
    for (const c of changes) await patchLines([c.row], { posotita: c.to });
});
const setLineStep = (id, step) => sheetAction(async p => {
  const r = data.find(x => x.id === id), tpl = templateOf(r);
  if (!confirmOrdered([r])) return;
  await patchLines([r], { posotita: posotitaText(planQty({ ...tpl, round_to: Number(step) }, planOf(p).chicks), tpl.unit) });
});
const addVaxLine = () => sheetAction(async p => {
  const g = id => document.getElementById(id).value.trim();
  const day = Number(g('vx-add-day'));
  if (!Number.isInteger(day) || day < 1) { toast(t('Η ημέρα πρέπει να είναι ακέραιος από 1 και πάνω.'), true); return; }
  if (!g('vx-add-vaccine')) { toast(t('Εισάγετε όνομα εμβολίου'), true); return; }
  const emvolio = await resolveVaccineAlts(g('vx-add-vaccine'));
  if (emvolio === null) return;
  await addLines(p, [{ hm_emv: dayDate(p, day), emvolio, posotita: rawQty(g('vx-add-qty')) || null,
    promitheutis: (g('vx-add-supplier') || vaxData.supplier[emvolio] || '').toUpperCase() || null }]);
});
const setRoundDay = (round, s) => sheetAction(async p => {
  const day = Number(s);
  if (!Number.isInteger(day) || day < 1) { toast(t('Η ημέρα πρέπει να είναι ακέραιος από 1 και πάνω.'), true); return; }
  const date = dayDate(p, day);
  await patchLines(hatchRows(p).filter(r => roundOf(r) === round), { hm_emv: date, hm_paragelia: subDays(date, 30) });
});
const setRoundCoryza = (round, product) => sheetAction(async p => {
  sheetCoryza[round] = product;
  const lines = hatchRows(p).filter(r => roundOf(r) === round && CORYZA_PRODUCTS.includes(r.emvolio) && r.emvolio !== product);
  if (lines.length && confirmOrdered(lines)) await patchLines(lines, { emvolio: product, promitheutis: vaxData.supplier[product] || null });
});
const setVaxCell = (round, name, v, value) => sheetAction(async p => {
  const line = roundLine(p, round, name, v), c = gridCustomers(p).find(x => x.name === name);
  if (!value) { if (line && confirmOrdered([line])) await removeLines([line]); return; }
  const payer = value === 'customer' && !c.leftover ? pelatisName(name) : null;
  if (line) { if ((line.payer || null) !== payer) await patchLines([line], { payer }); return; }
  const emvolio = v === CORYZA ? coryzaOf(p, round) : v;
  if (!emvolio) { toast(t('Επιλέξτε προϊόν για την ΚΟΡΥΖΑ ({n}ος γύρος).', { n: round }), true); return; }
  await addLines(p, [{ hm_emv: dayDate(p, roundDay(p, round)), emvolio, posotita: injQty(c.qty), pelatis: c.leftover ? LEFTOVER : pelatisName(name),
    payer, promitheutis: vaxData.supplier[emvolio] || null, sxolia_panos: `${ROUND_LABEL[round]} ${p.house}` }]);
});
const renameVaxCustomer = (i, s) => sheetAction(async p => {
  const pl = planOf(p), name = s.trim(), old = pl.customers[i].name;
  if (!name || name === LEFTOVER || pl.customers.some((c, j) => j !== i && c.name === name)) { toast(t('Το όνομα είναι κενό ή υπάρχει ήδη.'), true); return; }
  const lines = hatchRows(p).filter(r => r.pelatis === pelatisName(old));
  await patchLines(lines.filter(r => r.payer), { pelatis: pelatisName(name), payer: pelatisName(name) });
  await patchLines(lines.filter(r => !r.payer), { pelatis: pelatisName(name) });
  await savePlanRecord(p, { customers: pl.customers.map((c, j) => j === i ? { ...c, name } : c) });
});
const setVaxBirds = (i, s) => sheetAction(async p => {
  const pl = planOf(p), qty = parseBirds(s), c = pl.customers[i];
  if (!Number.isInteger(qty) || qty < 1) { toast(t('Τα πουλιά πρέπει να είναι ακέραιος αριθμός.'), true); return; }
  const changes = hatchRows(p).filter(r => roundOf(r) && r.pelatis === pelatisName(c.name) && !ordered(r))
    .map(r => ({ row: r, to: injQty(qty) })).filter(x => x.to !== String(x.row.posotita));
  await savePlanRecord(p, { customers: pl.customers.map((x, j) => j === i ? { ...x, qty } : x) });
  if (changes.length && confirmChanges(t('{name}: {n} πουλιά — ενημέρωση ενέσιμων που δεν έχουν παραγγελθεί;', { name: c.name, n: nfmt(qty) }), changes))
    for (const x of changes) await patchLines([x.row], { posotita: x.to });
});
const removeVaxCustomer = i => sheetAction(async p => {
  const pl = planOf(p), c = pl.customers[i], lines = hatchRows(p).filter(r => r.pelatis === pelatisName(c.name));
  if (!confirm(t('Αφαίρεση του πελάτη {name} και των {n} γραμμών του;', { name: c.name, n: lines.length })) || !confirmOrdered(lines)) return;
  await removeLines(lines);
  await savePlanRecord(p, { customers: pl.customers.filter((x, j) => j !== i) });
});
const addVaxCustomer = () => sheetAction(async p => {
  const pl = planOf(p), name = document.getElementById('vx-cust-name').value.trim(), qty = parseBirds(document.getElementById('vx-cust-qty').value);
  if (!name || name === LEFTOVER || pl.customers.some(c => c.name === name)) { toast(t('Το όνομα είναι κενό ή υπάρχει ήδη.'), true); return; }
  if (!Number.isInteger(qty) || qty < 1) { toast(t('Τα πουλιά πρέπει να είναι ακέραιος αριθμός.'), true); return; }
  await savePlanRecord(p, { customers: [...pl.customers, { name, qty }] });
});

// the editing panel under the sheet's table (hatches with an εμβολιακό)
function sheetEditHtml(p) {
  const pl = planOf(p);
  const custRows = pl.customers.map((c, i) => `<tr><td><input type="text" value="${x(c.name)}" onchange="renameVaxCustomer(${i}, this.value)"></td>` +
    `<td><input type="text" value="${nfmt(c.qty)}" onchange="setVaxBirds(${i}, this.value)" style="width:90px"></td>` +
    `<td><button class="btn-secondary" title="${t('Αφαίρεση')}" onclick="removeVaxCustomer(${i})">✕</button></td></tr>`).join('');
  const payerOptions = (c, now) => [['', '—'], ['us', t('Εμείς')], ...(c.leftover ? [] : [['customer', t('Πελάτης')]])]
    .map(([k, label]) => `<option value="${k}"${k === now ? ' selected' : ''}>${label}</option>`).join('');
  const roundHtml = round => {
    const cols = roundCols(p, round), day = roundDay(p, round);
    if (!cols.length || !day) return '';
    return `<p class="vax-sec">${t(ROUND_LABEL[round])} · ${t('Ημέρα')} <input type="number" min="1" value="${day}" onchange="setRoundDay(${round}, this.value)" style="width:64px"> ${fmt(dayDate(p, day))}` +
      (cols.includes(CORYZA) ? ` · ${t('ΚΟΡΥΖΑ')}: <select onchange="setRoundCoryza(${round}, this.value)"><option value="">${t('— επιλογή —')}</option>` +
        CORYZA_PRODUCTS.map(v => `<option${v === coryzaOf(p, round) ? ' selected' : ''}>${x(v)}</option>`).join('') + '</select>' : '') + '</p>' +
      `<table class="vax-grid"><thead><tr><th>${t('Πελάτης')}</th><th>${t('Πουλιά')}</th>${cols.map(v => `<th>${v === CORYZA ? t(CORYZA) : x(v)}</th>`).join('')}</tr></thead><tbody>` +
      gridCustomers(p).map(c => `<tr><td>${c.leftover ? t(LEFTOVER) : x(c.name)}</td><td>${nfmt(c.qty)}</td>` + cols.map(v => {
        const line = roundLine(p, round, c.name, v), now = !line ? '' : line.payer ? 'customer' : 'us';
        return `<td><select class="cell${now ? ' on' : ''}${line && ordered(line) ? ' ordered' : ''}" data-c="${x(c.name)}" data-v="${x(v)}" onchange="setVaxCell(${round}, this.dataset.c, this.dataset.v, this.value)">${payerOptions(c, now)}</select></td>`;
      }).join('') + '</tr>').join('') + '</tbody></table>';
  };
  return `<div class="vax-edit">` +
    `<p class="vax-sec">${t('Νεοσσοί')} <input type="text" value="${nfmt(pl.chicks)}" onchange="setVaxChicks(this.value)" style="width:100px"></p>` +
    `<p class="vax-sec">${t('+ Εμβόλιο')}</p><div class="vax-row"><input type="number" id="vx-add-day" min="1" placeholder="${t('Ημέρα')}" style="width:70px">` +
    `<input type="text" id="vx-add-vaccine" list="vaccine-list" placeholder="${t('Εμβόλιο')}"><input type="text" id="vx-add-qty" placeholder="${t('Ποσότητα')}" style="width:100px">` +
    `<input type="text" id="vx-add-supplier" placeholder="${t('Προμηθευτής')}" style="width:130px"><button class="btn-secondary" onclick="addVaxLine()">${t('Προσθήκη')}</button></div>` +
    `<p class="vax-sec">${t('Πελάτες')}</p><table class="vax-grid"><tbody>${custRows}</tbody></table>` +
    `<div class="vax-row"><input type="text" id="vx-cust-name" placeholder="${t('Όνομα πελάτη')}"><input type="text" id="vx-cust-qty" placeholder="${t('Πουλιά')}" style="width:100px">` +
    `<button class="btn-secondary" onclick="addVaxCustomer()">${t('+ Πελάτης')}</button></div>` +
    [1, 2].map(roundHtml).join('') + '</div>';
}
```

- [ ] **Step 2: Hook into `renderSheet`** (3a code):
  - qty cell: `` `<td>${fmtPosotita(r.posotita)}</td>` `` inside `line` → add the rounding switch for unordered template lines (click must not open the edit window):

```js
  const stepSel = r => { const tpl = templateOf(r), step = pl && tpl && tpl.rule === 'placed' && !ordered(r) ? stepOf(r, pl.chicks) : undefined;
    return step === undefined ? '' : `<select class="vax-step" onclick="event.stopPropagation()" onchange="setLineStep(${r.id}, this.value)" title="${t('Στρογγυλοποίηση προς τα πάνω σε')}">` +
      (step === null ? `<option value="">—</option>` : '') + [1000, 5000, 10000].map(s => `<option value="${s}"${s === step ? ' selected' : ''}>${nfmt(s)}</option>`).join('') + '</select>'; };
```
  (defined inside `renderSheet` after `pl`), and the cell becomes `` `<td>${fmtPosotita(r.posotita)}${stepSel(r)}</td>` ``.
  - after the table/empty-state, before the closing `'</div>'` of `.vax-sheet`: `+ (pl ? sheetEditHtml(p) : '')`.
  - `openSheet(id)` also resets `sheetCoryza = {};`.

- [ ] **Step 3: Ordered warnings in the tracker's own windows**
  - `saveEdit`: after the spelling-check block (`if (row.emvolio !== before.emvolio) { … }`) add
```js
  // an ordered line's quantity changes only after a clear question
  if (before.paragelia === 'ΝΑΙ' && String(row.posotita ?? '') !== String(before.posotita ?? '') &&
      !confirm(t('Αυτή η γραμμή έχει ήδη παραγγελθεί με ποσότητα {old}. Αλλαγή σε {new};', { old: fmtPosotita(before.posotita), new: fmtPosotita(row.posotita) }))) return;
```
  - delete box: after `<span class="confirm-name" id="confirm-name"></span>` add `<span data-t class="confirm-ordered" id="confirm-ordered" style="display:none">Προσοχή: έχει ήδη παραγγελθεί.</span>`; in `promptDelete` after setting `confirm-name`: `document.getElementById('confirm-ordered').style.display = r && r.paragelia === 'ΝΑΙ' ? '' : 'none';`.

- [ ] **Step 4: CSS** (append to the Εμβολιακά CSS block):
```css
.vax-edit{margin-top:14px;border-top:1px solid var(--gh-border-default);padding-top:6px}
.vax-edit input[type=text],.vax-edit input[type=number]{width:auto}
#vx-add-vaccine,#vx-cust-name,.vax-grid td input[type=text]:first-child{min-width:200px}
.vax-sec{margin:12px 0 6px;font-weight:600;font-size:13px}
.vax-sec input,.vax-sec select{width:auto;display:inline-block;padding:3px 8px;font-size:12px}
.vax-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.vax-row input{padding:4px 8px;font-size:12px}
.vax-grid{border-collapse:collapse;font-size:12px}
.vax-grid th,.vax-grid td{padding:3px 8px;border-bottom:1px solid var(--gh-border-muted);text-align:left}
.vax-grid select.cell{padding:2px 4px;font-size:12px}
.vax-grid select.cell.on{border-color:rgba(79,209,139,0.5);color:var(--gh-success-fg)}
.vax-grid select.cell.ordered{box-shadow:0 0 0 1px var(--gh-attention-fg)}
.vax-step{margin-left:6px;padding:1px 4px;font-size:11px;width:auto}
.confirm-ordered{display:block;margin-top:8px;color:var(--gh-attention-fg);font-weight:600;font-size:12px}
```

- [ ] **Step 5: Translations** (skip keys already present; the EN run lists the missing ones):
```js
  '+ Εμβόλιο': '+ Vaccine', 'Προσθήκη': 'Add', 'Όνομα πελάτη': 'Customer name', '+ Πελάτης': '+ Customer', 'Πουλιά': 'Birds', 'Εμείς': 'Us',
  'ΥΠΟΛΟΙΠΑ': 'LEFTOVER', 'Αφαίρεση': 'Remove', 'Προμηθευτής': 'Supplier', '— επιλογή —': '— choose —',
  'Στρογγυλοποίηση προς τα πάνω σε': 'Round up to',
  'Προσοχή: {n} γραμμές έχουν ήδη παραγγελθεί:\n{list}\nΣυνέχεια;': 'Warning: {n} lines are already ordered:\n{list}\nContinue?',
  'έχουν ήδη παραγγελθεί': 'are already ordered',
  'Νέοι νεοσσοί {n}: ενημέρωση ποσοτήτων που δεν έχουν παραγγελθεί;': 'New chicks placed {n}: update the quantities not yet ordered?',
  '{name}: {n} πουλιά — ενημέρωση ενέσιμων που δεν έχουν παραγγελθεί;': '{name}: {n} birds — update the injections not yet ordered?',
  'Αφαίρεση του πελάτη {name} και των {n} γραμμών του;': 'Remove the customer {name} and their {n} lines?',
  'Το όνομα είναι κενό ή υπάρχει ήδη.': 'The name is empty or already used.', 'Τα πουλιά πρέπει να είναι ακέραιος αριθμός.': 'Birds must be a whole number.',
  'Η ημέρα πρέπει να είναι ακέραιος από 1 και πάνω.': 'The day must be a whole number from 1 up.',
  'Αυτή η γραμμή έχει ήδη παραγγελθεί με ποσότητα {old}. Αλλαγή σε {new};': 'This line is already ordered with quantity {old}. Change to {new}?',
  'Προσοχή: έχει ήδη παραγγελθεί.': 'Warning: already ordered.',
```
(The check `'untick ordered line → asked…'` looks for the first 10 characters of `t('έχουν ήδη παραγγελθεί')` inside the question — keep that phrase inside the confirmOrdered message in both languages.)

- [ ] **Step 6: Run** `vax3b_checks.js`, `vax_checks.js`, `tabs_checks.js`, EL then EN: all PASS, `missing:` empty. Screenshot the sheet with the editing panel (desktop, stubbed).

### Task 3: Commit

- [ ] /ponytail-review; CLAUDE.md beta line: add "edited in the sheet: + Εμβόλιο, injections grid per round (day, ΚΟΡΥΖΑ product), customers, Νεοσσοί recalculation of unordered lines, rounding switch; ordered lines only change after a warning".
- [ ] On "commit and push now":
```bash
git add vaccine_tracker_beta.html CLAUDE.md docs/superpowers/plans/2026-11-06-hatch-vax-step3b.md
git commit -m "Vaccine tracker beta: edit the εμβολιακό inside the hatch sheet"
```
(ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, confirm Pages serves `vax-edit`.
