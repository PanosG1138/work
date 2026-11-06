# Hatch εμβολιακά — Step 3c: a clean sheet + the injections window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The hatch sheet shows only its table; editing opens on demand from small header buttons — **+ Εμβόλιο** (small window), **Ενέσιμα ημ. N** per round (the injections window: customers from the scheduler, their vaccines from the Βασικό εμβολιακό as chips, "Πληρώνει κάποια εμβόλια" per customer, ΚΟΡΥΖΑ product **per customer**, OK writes the lines), **Νεοσσοί ✎** (small window). Dark number fields; the rounding switch only where it fits.

**Architecture:** Beta page only, no database change. Replaces the 3b editing panel (`sheetEditHtml` and the per-cell actions) with two windows: a generic small window `vaxmini-bg` (+ Εμβόλιο, Νεοσσοί) and the injections window `injwin-bg` with an in-memory model `injWin` that is applied on OK as one diff (add / change / remove lines, rename / remove customers, round day). Keeps the 3b write helpers (`addLines`, `patchLines`, `removeLines`, `savePlanRecord`, `confirmOrdered`, `chicksRecalc`, `templateOf`, `stepOf`, `roundDay`, `gridCustomers`, `injQty`, `LEFTOVER`, `ROUND_LABEL`).

**Spec:** `docs/superpowers/specs/2026-11-06-hatch-programmes-and-bin-design.md` §3 — revised by the user 2026-11-06: editing hidden until asked for; injections chosen per customer in one window; ΚΟΡΥΖΑ product per customer.

## Global Constraints

- Nothing editable under the sheet's table; one window at a time.
- Injections window: customers = the εμβολιακό's (scheduler, corrected) + ΥΠΟΛΟΙΠΑ; first time a round is opened (no lines yet) each customer's usual injections are pre-ticked; afterwards the window shows exactly the existing lines. ΥΠΟΛΟΙΠΑ never pre-ticked, payer us only. Customer-pays boxes appear only when "Πληρώνει κάποια εμβόλια" is ticked.
- ΚΟΡΥΖΑ: one product per customer per round (BIONEW BI + COR / CORIPRAVAC), required before OK.
- OK writes the diff: new lines, changed lines (product, payer, quantity if not ordered, day), removed lines; ordered lines removed or changed only after `confirmOrdered`. Renamed customers rename their lines in every round; a customer removed with ✕ leaves the εμβολιακό with all their lines (asked first).
- Number fields dark like the rest. Rounding switch only on unordered lines whose quantity matches a step.
- Every visible Greek text through `t()` with English. Code style as before. Stubbed data only; no commit/push without "commit and push now"; /ponytail-review first. Edits by a checking script.

---

### Task 1: Checks — replace `<session scratchpad>/vax3b_checks.js` with `vax3c_checks.js`

Same stub setup as `vax3b_checks.js` (PROGRAMME, INJ plus round 2 `{ id: 3, round: 2, vaccine: 'VECTROMUNE', sort: 1 }` and template `{ id: 5, days: [82], kind: 'injectables_2', … }`, USUAL = `[{ customer: 'Συντιχάκης', round: 1, vaccine: 'SG-9R', payer: 'customer' }, { customer: 'Συντιχάκης', round: 1, vaccine: 'ΚΟΡΥΖΑ', payer: 'us' }, { customer: 'Κόκος', round: 1, vaccine: 'ΚΟΡΥΖΑ', payer: 'us' }]`, PLAN with customers Συντιχάκης 16.400 / Κόκος 10.000, chicks 30.000, ROWS = the three general lines only — no injection line yet; the hatch_plans PATCH stub updates PLAN). Checks:

```js
    // the sheet is clean
    check('no editing panel under the table', !document.querySelector('#vax-sheet .vax-edit'));
    check('header buttons', ['openAddVax()', 'openInjWin(1)', 'openInjWin(2)', 'openChicksVax()'].every(f => document.querySelector(`#vax-sheet [onclick="${f}"]`)));
    check('number fields dark', getComputedStyle(document.createElement('input')).color !== '' &&
      (() => { const i = document.createElement('input'); i.type = 'number'; document.body.appendChild(i); const bg = getComputedStyle(i).backgroundColor; i.remove(); return bg !== 'rgb(255, 255, 255)'; })());
    check('rounding switch only where it fits', !document.querySelector('#vax-sheet .vax-step option[value=""]'));

    // injections window, first time: usual injections pre-ticked, ΥΠΟΛΟΙΠΑ unticked
    openInjWin(1);
    const W = () => injWin, cu = name => W().customers.find(c => c.name === name);
    check('window open with the round day', document.getElementById('injwin-bg').style.display === 'flex' && W().day === 60);
    check('customers + ΥΠΟΛΟΙΠΑ', W().customers.map(c => c.name).join() === `Συντιχάκης,Κόκος,${LEFTOVER}` && cu(LEFTOVER).qty === 3600);
    check('usual pre-ticked', cu('Συντιχάκης').items.filter(i => i.on).map(i => i.vaccine).join() === 'SG-9R,ΚΟΡΥΖΑ' && cu('Κόκος').items.map(i => i.vaccine).join() === 'ΚΟΡΥΖΑ');
    check('pays ticked where usual says customer', cu('Συντιχάκης').pays && cu('Συντιχάκης').items.find(i => i.vaccine === 'SG-9R').customer);
    check('ΥΠΟΛΟΙΠΑ starts empty', cu(LEFTOVER).items.length === 0);
    check('customer box only when pays', !document.querySelector(`#injwin-body [data-cust="1"] .inj-pay`) && !!document.querySelector(`#injwin-body [data-cust="0"] .inj-pay`));
    check('OK counts the lines', document.getElementById('injwin-ok').textContent.includes('3'));

    // ΚΟΡΥΖΑ product per customer is required
    let n = writes.length;
    await applyInjWin();
    check('no ΚΟΡΥΖΑ product → nothing written', writes.length === n && document.getElementById('injwin-bg').style.display === 'flex');
    injSet(0, 'ΚΟΡΥΖΑ', 'product', 'BIONEW BI + COR'); injSet(1, 'ΚΟΡΥΖΑ', 'product', 'CORIPRAVAC');
    injAdd(2, 'SG-9R');   // ΥΠΟΛΟΙΠΑ gets SG-9R
    n = writes.length;
    await applyInjWin(); await wait(50);
    const posted = writes.slice(n).filter(w => w.startsWith('POST emvolia ')).map(w => JSON.parse(w.slice(w.indexOf('{'))));
    check('OK → 4 lines', posted.length === 4 && document.getElementById('injwin-bg').style.display === 'none');
    check('ΚΟΡΥΖΑ per customer', posted.find(r => r.pelatis === 'ΣΥΝΤΙΧΑΚΗΣ' && r.emvolio === 'BIONEW BI + COR') && posted.find(r => r.pelatis === 'ΚΟΚΟΣ' && r.emvolio === 'CORIPRAVAC'));
    check('payer: customer only where ticked', posted.find(r => r.emvolio === 'SG-9R' && r.pelatis === 'ΣΥΝΤΙΧΑΚΗΣ').payer === 'ΣΥΝΤΙΧΑΚΗΣ' && posted.find(r => r.emvolio === 'BIONEW BI + COR').payer === null);
    check('ΥΠΟΛΟΙΠΑ line, we pay, birds ↑1.000', (r => r && r.payer === null && r.posotita === '4000')(posted.find(r => r.pelatis === LEFTOVER)));
    check('date = hatch + 60, ΕΝΕΣΙΜΑ note', posted.every(r => r.hm_emv === d(60) && r.sxolia_panos === 'ΠΡΩΤΑ ΕΝΕΣΙΜΑ Θ3'));

    // reopening shows exactly the lines (no re-suggesting), and a diff is written on OK
    openInjWin(1);
    check('reopen = existing lines', cu('Κόκος').items.map(i => `${i.vaccine}:${i.product}`).join() === 'ΚΟΡΥΖΑ:CORIPRAVAC' && cu(LEFTOVER).items.length === 1);
    injSet(1, 'ΚΟΡΥΖΑ', 'product', 'BIONEW BI + COR');          // Κόκος changes product
    injToggle(2, 'SG-9R');                                       // ΥΠΟΛΟΙΠΑ unticked
    W().day = 65;                                                // round moved
    W().customers[0].qty = 18500;                                // Συντιχάκης birds
    W().customers[1].name = 'Κόκκος';                            // rename
    n = writes.length;
    await applyInjWin(); await wait(50);
    const w = writes.slice(n);
    check('diff: product changed', w.some(x => x.startsWith('PATCH emvolia?id=in.') && x.includes('"emvolio":"BIONEW BI + COR"') && x.includes('"pelatis":"ΚΟΚΚΟΣ"')));
    check('diff: unticked removed', w.some(x => x.startsWith('DELETE emvolia?id=in.')));
    check('diff: day moved', w.some(x => x.includes(`"hm_emv":"${d(65)}"`)));
    check('diff: birds → qty 19.000', w.some(x => x.includes('"posotita":"19000"')));
    check('diff: record saved', w.some(x => x.startsWith('PATCH hatch_plans') && x.includes('Κόκκος') && x.includes('18500')));

    // ordered lines: asked first, refusal writes nothing
    data.filter(r => roundOf(r) === 1).forEach(r => { r.paragelia = 'ΝΑΙ'; });
    openInjWin(1); injToggle(0, 'SG-9R');
    answer = false; n = writes.length; asked.length = 0;
    await applyInjWin();
    check('ordered: asked, refused → nothing', asked.length >= 1 && writes.length === n);
    answer = true; closeInjWin();

    // ✕ removes the customer from the εμβολιακό with all their lines
    data.forEach(r => { r.paragelia = null; });
    openInjWin(1); injRemoveCustomer(1);
    n = writes.length;
    await applyInjWin(); await wait(50);
    check('removed customer: lines + record', writes.slice(n).some(x => x.startsWith('DELETE emvolia')) && writes.slice(n).some(x => x.startsWith('PATCH hatch_plans') && !x.includes('Κόκκος')));

    // + Εμβόλιο and Νεοσσοί in small windows
    openAddVax();
    document.getElementById('vx-add-day').value = '32'; document.getElementById('vx-add-vaccine').value = 'SALMOVAC';
    n = writes.length;
    await document.getElementById('vaxmini-ok').onclick();
    check('+ Εμβόλιο window adds a line', writes.slice(n).some(x => x.startsWith('POST emvolia ') && x.includes(`"hm_emv":"${d(32)}"`)) && document.getElementById('vaxmini-bg').style.display === 'none');
    openAddVax(); document.getElementById('vx-add-day').value = '0';
    await document.getElementById('vaxmini-ok').onclick();
    check('invalid → window stays open', document.getElementById('vaxmini-bg').style.display === 'flex');
    closeMini();
    openChicksVax(); document.getElementById('vx-chicks').value = '31.000';
    n = writes.length;
    await document.getElementById('vaxmini-ok').onclick();
    check('Νεοσσοί window saves', writes.slice(n).some(x => x.startsWith('PATCH hatch_plans') && x.includes('"chicks":31000')));
```
plus the 3b checks that still apply: `templateOf`, `stepOf`, `roundDay`, rounding switch (`setLineStep`), Νεοσσοί recalculation listing from → to, the edit window and delete box warnings, scheduler never written, no missing translations.

- [ ] Run on the beta: FAIL / `ReferenceError: openInjWin is not defined`.

### Task 2: Code

- [ ] **Remove** (3b): `let sheetCoryza`, `coryzaOf`, `setRoundDay`, `setRoundCoryza`, `setVaxCell`, `renameVaxCustomer`, `setVaxBirds`, `removeVaxCustomer`, `addVaxCustomer`, `sheetEditHtml`, the `+ (pl ? sheetEditHtml(p) : '')` in `renderSheet`, `sheetCoryza = {};` in `openSheet`, and the CSS rules `.vax-edit*`, `#vx-add-vaccine,…`, `.vax-sec*`, `.vax-row*`, `.vax-grid*`.

- [ ] **`sheetAction` returns the action's result** (so a window can stay open on invalid input):
```js
async function sheetAction(fn) {
  if (!guardConnected()) return false;
  let result;
  try { result = await fn(sheetHatch()); } catch (e) { toast(t('Σφάλμα: {msg}', { msg: e.message }), true); result = false; }
  render();
  return result;
}
```
`setVaxChicks` and `addVaxLine`: every validation `return;` → `return false;`.

- [ ] **Rounding switch only where it fits** — in `stepSel`: `return step === undefined ? '' :` → `return step == null ? '' :` and drop the `(step === null ? … : '')` option.

- [ ] **Dark number fields** — line `input[type=date],input[type=text],input[type=email],input[type=password],select,textarea{` → add `input[type=number],` at the start (and the same in the `.modal .fgroup input` rule needs nothing: it targets all inputs).

- [ ] **Header buttons** in `renderSheet` — `actions` for a hatch with an εμβολιακό (draft or active) gets, before the existing draft buttons:
```js
  const edit = pl ? `<button class="btn-secondary" onclick="openAddVax()">${t('+ Εμβόλιο')}</button>` +
    [1, 2].filter(round => roundDay(p, round)).map(round => `<button class="btn-secondary" onclick="openInjWin(${round})">${t('Ενέσιμα ημ. {n}', { n: roundDay(p, round) })}</button>`).join('') : '';
```
rendered as `${edit}${print}${actions}`; the Νεοσσοί text in the header becomes a link: `` `${t('Νεοσσοί')} <a href="#" class="vax-chicks" onclick="openChicksVax(); return false">${nfmt(pl.chicks)} ✎</a>` ``.

- [ ] **Small window** (markup next to `vaxnew-bg`):
```html
<!-- small HATCH ΕΜΒΟΛΙΑΚΑ window: + Εμβόλιο, Νεοσσοί (openMini) -->
<div id="vaxmini-bg" class="modal-bg" style="display:none" onclick="if(event.target===this)closeMini()">
  <div class="modal" style="width:440px;max-width:95vw">
    <h3 id="vaxmini-title"></h3>
    <div id="vaxmini-body"></div>
    <div class="modal-actions"><div style="flex:1"></div>
      <button data-t class="btn-secondary" onclick="closeMini()">Ακύρωση</button>
      <button data-t class="btn-primary" id="vaxmini-ok">OK</button></div>
  </div>
</div>
```
```js
// a small window: title, fields, OK runs onOk — it stays open when onOk returns false (invalid input)
function openMini(title, html, onOk) {
  document.getElementById('vaxmini-title').textContent = title;
  document.getElementById('vaxmini-body').innerHTML = html;
  document.getElementById('vaxmini-ok').onclick = async () => { if (await onOk() !== false) closeMini(); };
  document.getElementById('vaxmini-bg').style.display = 'flex';
  const first = document.querySelector('#vaxmini-body input'); if (first) first.focus();
}
function closeMini() { document.getElementById('vaxmini-bg').style.display = 'none'; }
const field = (label, inner) => `<div class="fgroup"><label>${label}</label>${inner}</div>`;
function openAddVax() {
  openMini(t('+ Εμβόλιο'), field(t('Ημέρα'), '<input type="number" id="vx-add-day" min="1">') +
    field(t('Εμβόλιο'), '<input type="text" id="vx-add-vaccine" list="vaccine-list">') +
    field(t('Ποσότητα'), '<input type="text" id="vx-add-qty">') + field(t('Προμηθευτής'), '<input type="text" id="vx-add-supplier">'), addVaxLine);
}
function openChicksVax() {
  openMini(t('Νεοσσοί'), field(t('Νεοσσοί'), `<input type="text" id="vx-chicks" value="${nfmt(planOf(sheetHatch()).chicks)}">`),
    () => setVaxChicks(document.getElementById('vx-chicks').value));
}
```

- [ ] **Injections window** (markup next to it):
```html
<!-- ΕΝΕΣΙΜΑ of one round: customers × their vaccines, OK writes the lines (injWin in the script) -->
<div id="injwin-bg" class="modal-bg" style="display:none" onclick="if(event.target===this)closeInjWin()">
  <div class="modal inj-modal">
    <h3 id="injwin-title"></h3>
    <div id="injwin-body"></div>
    <div class="modal-actions"><div style="flex:1"></div>
      <button data-t class="btn-secondary" onclick="closeInjWin()">Ακύρωση</button>
      <button class="btn-primary" id="injwin-ok" onclick="applyInjWin()"></button></div>
  </div>
</div>
```
```js
// ── HATCH ΕΜΒΟΛΙΑΚΑ: injections window ── one round's customers and their vaccines, written on OK as one diff
let injWin = null;   // { round, day, customers: [{ orig, name, qty, leftover, pays, items: [{ vaccine, product, on, customer }] }], removed: [names] }
const colOf = v => CORYZA_PRODUCTS.includes(v) ? CORYZA : v;   // a ΚΟΡΥΖΑ product shows as the ΚΟΡΥΖΑ chip
function openInjWin(round) {
  const p = sheetHatch(), lines = hatchRows(p).filter(r => roundOf(r) === round);
  const fresh = !lines.length;   // first time: each customer's usual injections are suggested
  injWin = { round, day: roundDay(p, round), removed: [], customers: gridCustomers(p).map(c => {
    const pel = c.leftover ? LEFTOVER : pelatisName(c.name);
    const items = lines.filter(r => r.pelatis === pel).map(r => ({ vaccine: colOf(r.emvolio), product: CORYZA_PRODUCTS.includes(r.emvolio) ? r.emvolio : '', on: true, customer: !!r.payer }));
    if (fresh && !c.leftover) vaxData.usual.filter(u => u.customer === c.name && u.round === round)
      .forEach(u => items.push({ vaccine: u.vaccine, product: '', on: true, customer: u.payer === 'customer' }));
    return { orig: c.leftover ? null : c.name, name: c.name, qty: c.qty, leftover: c.leftover, pays: items.some(i => i.customer), items };
  }) };
  renderInjWin();
  document.getElementById('injwin-bg').style.display = 'flex';
}
function closeInjWin() { document.getElementById('injwin-bg').style.display = 'none'; injWin = null; }
// ΥΠΟΛΟΙΠΑ = chicks − the window's booked birds
const injLeftover = () => Math.max(planOf(sheetHatch()).chicks - injWin.customers.filter(c => !c.leftover).reduce((s, c) => s + c.qty, 0), 0);
function renderInjWin() {
  const p = sheetHatch(), W = injWin, roundVaccines = vaxData.injectables.filter(i => i.round === W.round).map(i => i.vaccine);
  document.getElementById('injwin-title').textContent = `${t(ROUND_LABEL[W.round])} · ${p.house} ${fmt(p.doc_date)}`;
  const chip = (c, k, it) => `<span class="inj-chip${it.on ? ' on' : ''}"><a href="#" onclick="injToggle(${k}, '${x(it.vaccine)}'); return false">${it.on ? '✓ ' : ''}${it.vaccine === CORYZA ? t(CORYZA) : x(it.vaccine)}</a>` +
    (it.vaccine === CORYZA && it.on ? `<select onchange="injSet(${k}, '${CORYZA}', 'product', this.value)"><option value="">${t('— επιλογή —')}</option>` +
      CORYZA_PRODUCTS.map(v => `<option${v === it.product ? ' selected' : ''}>${x(v)}</option>`).join('') + '</select>' : '') +
    (it.on ? ` · ${nfmt(injQty(c.leftover ? injLeftover() : c.qty))}` : '') +
    (it.on && c.pays && !c.leftover ? `<label class="inj-pay"><input type="checkbox"${it.customer ? ' checked' : ''} onchange="injSet(${k}, '${x(it.vaccine)}', 'customer', this.checked)"> ${t('πελάτης')}</label>` : '') + '</span>';
  document.getElementById('injwin-body').innerHTML =
    `<p class="inj-day">${t('Ημέρα')} <input type="number" min="1" value="${W.day}" onchange="injWin.day = Number(this.value); renderInjWin()"> ${fmt(dayDate(p, W.day || 0))}</p>` +
    W.customers.map((c, k) => `<div class="inj-cust" data-cust="${k}"><div class="inj-head">` +
      (c.leftover ? `<b>${t(LEFTOVER)}</b><span class="muted">${t('Πουλιά')} ${nfmt(injLeftover())}</span>`
        : `<input type="text" class="inj-name" value="${x(c.name)}" onchange="injWin.customers[${k}].name = this.value.trim()">` +
          `<span class="muted">${t('Πουλιά')}</span><input type="text" class="inj-qty" value="${nfmt(c.qty)}" onchange="injWin.customers[${k}].qty = parseBirds(this.value); renderInjWin()">` +
          `<label><input type="checkbox"${c.pays ? ' checked' : ''} onchange="injWin.customers[${k}].pays = this.checked; renderInjWin()"> ${t('Πληρώνει κάποια εμβόλια')}</label>` +
          `<span class="tb-spacer"></span><button class="btn-secondary" title="${t('Αφαίρεση')}" onclick="injRemoveCustomer(${k})">✕</button>`) + '</div>' +
      `<div class="inj-chips">${c.items.map(it => chip(c, k, it)).join('')}` +
      `<select class="inj-add" onchange="injAdd(${k}, this.value)"><option value="">${t('+ εμβόλιο')}</option>` +
        roundVaccines.filter(v => !c.items.some(it => it.vaccine === v)).map(v => `<option value="${x(v)}">${v === CORYZA ? t(CORYZA) : x(v)}</option>`).join('') + '</select></div></div>').join('') +
    `<div class="inj-new"><input type="text" id="inj-new-name" placeholder="${t('Όνομα πελάτη')}"><input type="text" id="inj-new-qty" placeholder="${t('Πουλιά')}" class="inj-qty">` +
      `<button class="btn-secondary" onclick="injAddCustomer()">${t('+ Πελάτης')}</button></div>`;
  document.getElementById('injwin-ok').textContent = t('OK — {n} γραμμές', { n: W.customers.reduce((s, c) => s + c.items.filter(i => i.on).length, 0) });
}
const injItem = (k, v) => injWin.customers[k].items.find(i => i.vaccine === v);
function injToggle(k, v) { const it = injItem(k, v); it.on = !it.on; renderInjWin(); }
function injSet(k, v, key, value) { injItem(k, v)[key] = value; renderInjWin(); }
function injAdd(k, v) { if (v) injWin.customers[k].items.push({ vaccine: v, product: '', on: true, customer: false }); renderInjWin(); }
function injRemoveCustomer(k) { const c = injWin.customers[k]; if (c.orig) injWin.removed.push(c.orig); injWin.customers.splice(k, 1); renderInjWin(); }
function injAddCustomer() {
  const name = document.getElementById('inj-new-name').value.trim(), qty = parseBirds(document.getElementById('inj-new-qty').value);
  if (!name || name === LEFTOVER || injWin.customers.some(c => c.name === name)) { toast(t('Το όνομα είναι κενό ή υπάρχει ήδη.'), true); return; }
  if (!Number.isInteger(qty) || qty < 1) { toast(t('Τα πουλιά πρέπει να είναι ακέραιος αριθμός.'), true); return; }
  injWin.customers.splice(injWin.customers.filter(c => !c.leftover).length, 0, { orig: null, name, qty, leftover: false, pays: false, items: [] });
  renderInjWin();
}
// OK: the window → lines (add / change / remove), renamed and removed customers, the round day, the εμβολιακό record
const applyInjWin = () => sheetAction(async p => {
  const W = injWin, pl = planOf(p), names = W.customers.filter(c => !c.leftover).map(c => c.name);
  if (!Number.isInteger(W.day) || W.day < 1) { toast(t('Η ημέρα πρέπει να είναι ακέραιος από 1 και πάνω.'), true); return false; }
  if (names.some(n => !n || n === LEFTOVER) || new Set(names).size !== names.length) { toast(t('Το όνομα είναι κενό ή υπάρχει ήδη.'), true); return false; }
  if (W.customers.some(c => !c.leftover && !(Number.isInteger(c.qty) && c.qty > 0))) { toast(t('Τα πουλιά πρέπει να είναι ακέραιος αριθμός.'), true); return false; }
  if (W.customers.some(c => c.items.some(i => i.on && i.vaccine === CORYZA && !i.product))) { toast(t('Επιλέξτε προϊόν ΚΟΡΥΖΑ για κάθε πελάτη.'), true); return false; }
  const date = dayDate(p, W.day), roundLines = hatchRows(p).filter(r => roundOf(r) === W.round);
  // what the round should contain
  const want = W.customers.flatMap(c => { const pel = c.leftover ? LEFTOVER : pelatisName(c.name), oldPel = c.leftover ? LEFTOVER : c.orig && pelatisName(c.orig);
    return c.items.filter(i => i.on).map(i => ({ oldPel, pelatis: pel, emvolio: i.vaccine === CORYZA ? i.product : i.vaccine,
      payer: !c.leftover && c.pays && i.customer ? pel : null, posotita: injQty(c.leftover ? injLeftover() : c.qty) })); });
  const changes = [], used = new Set();
  roundLines.forEach(r => {
    const w = want.find(w => !used.has(w) && w.oldPel === r.pelatis && colOf(w.emvolio) === colOf(r.emvolio));
    if (!w) return;
    used.add(w);
    const f = {};
    for (const k of ['pelatis', 'emvolio', 'payer']) if ((r[k] || null) !== (w[k] || null)) f[k] = w[k];
    if (r.hm_emv !== date) Object.assign(f, { hm_emv: date, hm_paragelia: subDays(date, 30) });
    if (!ordered(r) && String(r.posotita) !== w.posotita) f.posotita = w.posotita;
    if (Object.keys(f).length) changes.push({ row: r, fields: f });
  });
  const removedPel = W.removed.map(pelatisName);
  const removals = [...roundLines.filter(r => ![...used].some(w => w.oldPel === r.pelatis && colOf(w.emvolio) === colOf(r.emvolio)) || removedPel.includes(r.pelatis)),
    ...hatchRows(p).filter(r => roundOf(r) !== W.round && removedPel.includes(r.pelatis))];
  // renamed customers: their lines outside this round follow
  const renames = W.customers.filter(c => c.orig && c.orig !== c.name).map(c => ({ from: pelatisName(c.orig), to: pelatisName(c.name) }));
  const outside = hatchRows(p).filter(r => roundOf(r) !== W.round && renames.some(n => n.from === r.pelatis));
  if (!confirmOrdered([...new Set([...removals, ...changes.filter(c => 'emvolio' in c.fields || 'payer' in c.fields).map(c => c.row)])])) return false;
  await removeLines([...new Set(removals)]);
  for (const c of changes) await patchLines([c.row], c.fields);
  for (const r of outside) { const n = renames.find(n => n.from === r.pelatis); await patchLines([r], r.payer ? { pelatis: n.to, payer: n.to } : { pelatis: n.to }); }
  await addLines(p, want.filter(w => !used.has(w)).map(w => ({ hm_emv: date, emvolio: w.emvolio, posotita: w.posotita, pelatis: w.pelatis, payer: w.payer,
    promitheutis: vaxData.supplier[w.emvolio] || null, sxolia_panos: `${ROUND_LABEL[W.round]} ${p.house}` })));
  const customers = W.customers.filter(c => !c.leftover).map(c => ({ name: c.name, qty: c.qty }));
  if (JSON.stringify(customers) !== JSON.stringify(pl.customers)) await savePlanRecord(p, { customers });
  closeInjWin();
});
```

- [ ] **CSS** (Εμβολιακά block):
```css
.vax-chicks{color:inherit;text-decoration:underline dotted}
.inj-modal{width:760px;max-width:96vw;max-height:90vh;overflow:auto}
.inj-day input{width:70px;display:inline-block}
.inj-cust{border-top:1px solid var(--gh-border-muted);padding:10px 0}
.inj-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.inj-head b{font-size:13px}
.inj-name{width:180px!important}.inj-qty{width:90px!important}
.inj-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.inj-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--gh-border-default);border-radius:var(--rs);padding:3px 8px;font-size:12px}
.inj-chip a{color:var(--gh-fg-muted);text-decoration:none}
.inj-chip.on{border-color:rgba(79,209,139,0.5);background:var(--gh-success-subtle)}.inj-chip.on a{color:var(--gh-success-fg)}
.inj-chip select{width:auto;padding:1px 4px;font-size:12px}
.inj-pay{display:inline-flex;align-items:center;gap:3px;color:var(--gh-attention-fg);font-size:11px}
.inj-add{width:auto!important;padding:2px 6px;font-size:12px}
.inj-new{display:flex;gap:6px;margin-top:10px}.inj-new input{width:180px}
```

- [ ] **Translations** (skip existing): `'Ενέσιμα ημ. {n}': 'Injections day {n}'`, `'Πληρώνει κάποια εμβόλια': 'Pays some vaccines'`, `'πελάτης': 'customer'`, `'+ εμβόλιο': '+ vaccine'`, `'OK — {n} γραμμές': 'OK — {n} lines'`, `'Επιλέξτε προϊόν ΚΟΡΥΖΑ για κάθε πελάτη.': 'Choose the CORYZA product for every customer.'`, `'OK': 'OK'`. Remove keys only the removed panel used (grep first).

### Task 3: Run, commit

- [ ] `vax3c_checks.js` EL + EN, `vax_checks.js` (44), `tabs_checks.js` (12): all PASS. Screenshot the clean sheet and the injections window.
- [ ] CLAUDE.md beta line: replace the "Edited in the sheet: …" sentence with the window-based description.
- [ ] /ponytail-review; on "commit and push now": `vaccine_tracker_beta.html`, CLAUDE.md, this plan; message `Vaccine tracker beta: clean hatch sheet — editing in small windows, injections chosen per customer` + Co-Authored-By; push; confirm Pages serves `injwin-bg`.
- [ ] Then the step-4 reminder plan (already written) is built.
