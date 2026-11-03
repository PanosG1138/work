# ΕΛ/EN language switch (project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every page can be shown in Greek or English, chosen per account with an ΕΛ/EN switch, Greek by default.

**Architecture:** common.js gains a LANGUAGE section: `LANG`, `t(greek, values)`, `addTranslations(list)`, `translatePage()`, the switch, and the account check in `startPage`. Pages keep their Greek text as the key, tag fixed texts with `data-t*`, wrap built texts in `t()`, and add an English list in a `// ── TRANSLATIONS ──` block. Pages are converted one per commit.

**Tech Stack:** plain HTML/CSS/JS, supabase-js 2.117.1 (`_sb.auth.updateUser({ data })` → `user_metadata`), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-03-language-switch-design.md`

**Outcome (2026-11-03):** Tasks 1–6 done. Task 7 dropped — the user decided the truck pages stay Greek only. So Task 8 kept the `translated` option instead of removing it: pages without an English list show no switch and stay Greek.

## Global Constraints

- No build step, no new dependencies, no new table, no RLS change.
- CRLF line endings kept; edit with the Edit tool or Python written via the Write tool (normalise CRLF, restore after).
- Code style (user rule): clear names, short comments on what a block does and who uses it, `// ── NAME ──` banners.
- Every commit that changes common.js or theme.css bumps `common.js?v=N` and `theme.css?v=N` on all 7 pages. This project starts at **v=2**.
- Greek wording on Greek pages must not change. Never translated: vaccine names, breeds, houses, feed phase names, additive names, people names, typed text, database error messages. Dates stay dd/mm/yyyy.
- Never test on live data (stub `sbFetch`, the Supabase client, `reloadPage`). Never handle real credentials.
- **Commit/push only on the user's explicit "commit and push now".** Before each page's commit: translation table, EL/EN screenshots, check results.
- `/ponytail-review` before each commit. Attribution: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Rollout rule (plan detail, not in spec):** until every page is translated, the switch shows only on pages that pass `translated: true` to `startPage`; other pages stay Greek even if the account says English. Task 8 removes the option.

## Files

| File | Change |
|---|---|
| `common.js` | LANGUAGE section; switch in shared buttons; account check; shared English list; texts via `t()` |
| `theme.css` | switch styles |
| `index.html`, `vaccine_tracker.html`, `inventory.html`, `feed_tracker.html`, `schedule_checker.html`, `truck_calculator_kamposos.html`, `truck_calculator_doukakis.html` | tags, `t()`, TRANSLATIONS block, `translated: true` |
| `CLAUDE.md` | language system + the "update the English line" rule |
| scratchpad `common_test.html`, `b_lang_check.js`, `b_<page>_strings.md` | checks and per-page translation tables (not committed) |

`$SP` = `C:\Users\georg\AppData\Local\Temp\claude\C--Users-georg-Claude-Code\471487d4-325a-4b0e-8654-01c5ce72ae3e\scratchpad`.
Servers: repo on 8765, `$SP` on 8766 (`python -m http.server`, run_in_background; stop with Stop-Process on the port). Browser caches pages: always open pages with a fresh `?r=N`.

---

### Task 1: Language system in common.js

**Files:** Modify `common.js`, `theme.css`; Test `$SP/common_test.html`

**Interfaces — Produces:**
- `LANG` (`'el'|'en'`), `LANGS`, `t(greek, values?) → string`, `addTranslations(object)`, `translatePage(root = document)`, `window.missingTranslations` (Set), `switchLanguage(to, hasUnsavedWork?)`, `reloadPage()` (wraps `location.reload`, overridable in checks), `saveDeviceLanguage(l) → boolean`.
- `startPage({ onSignedIn, onSignedOut?, hasUnsavedWork?, translated? })`.
- DOM: `#common-lang` with `button[data-lang]`, current one has class `on`.

- [ ] **Step 1: Add the language checks to `$SP/common_test.html`** (fail: functions missing)

Add a second runner after `runChecks` (keep `runChecks` as is; it must still pass):

```js
// project B: language checks. Run on a fresh load: `await runLangChecks()`
window.runLangChecks = async () => {
  const out = [];
  const ok = (name, cond) => out.push((cond ? 'PASS ' : 'FAIL ') + name);
  let reloads = 0, saved = null, updateError = null;
  window.reloadPage = () => { reloads++; };
  _sb.auth.updateUser = async ({ data }) => { saved = data.lang; return { error: updateError }; };
  addTranslations({ 'Γεια': 'Hello', 'σε {n} ημέρες': 'in {n} days' });
  document.body.insertAdjacentHTML('beforeend',
    '<span id="tt" data-t>Γεια</span><input id="tp" data-t-placeholder placeholder="Γεια"><b id="ti" data-t-title title="Γεια">x</b>');

  LANG = 'el';
  ok('el: t returns Greek', t('Γεια') === 'Γεια');
  ok('el: values filled', t('σε {n} ημέρες', { n: 3 }) === 'σε 3 ημέρες');
  LANG = 'en';
  ok('en: t returns English', t('Γεια') === 'Hello');
  ok('en: values filled', t('σε {n} ημέρες', { n: 3 }) === 'in 3 days');
  ok('en: missing stays Greek', t('Άγνωστο') === 'Άγνωστο');
  ok('en: missing recorded', window.missingTranslations.has('Άγνωστο'));
  ok('en: shared list has ΝΑΙ', t('ΝΑΙ') === 'YES');
  translatePage();
  ok('data-t translated', document.getElementById('tt').textContent === 'Hello');
  ok('data-t-placeholder translated', document.getElementById('tp').placeholder === 'Hello');
  ok('data-t-title translated', document.getElementById('ti').title === 'Hello');

  LANG = 'el';
  await switchLanguage('en');
  ok('switch: saved on account', saved === 'en');
  ok('switch: saved on device', localStorage.getItem('lang') === 'en');
  ok('switch: reloads', reloads === 1);

  updateError = { message: 'offline' }; saved = null; localStorage.setItem('lang', 'el');
  let alerted = ''; window.alert = m => { alerted = m; };
  await switchLanguage('en');
  ok('no internet: message', alerted === 'Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.');
  ok('no internet: device unchanged, no reload', localStorage.getItem('lang') === 'el' && reloads === 1);

  updateError = null; window.confirm = () => false;
  await switchLanguage('en', () => true);
  ok('unsaved + Cancel: stays', saved === null && reloads === 1);
  window.confirm = () => true;
  await switchLanguage('en', () => true);
  ok('unsaved + OK: switches', saved === 'en' && reloads === 2);

  // account language differs from the device → one reload before onSignedIn
  localStorage.setItem('lang', 'el'); LANG = 'el';
  let signedIn = 0;
  startPage({ onSignedIn: () => signedIn++, translated: true });
  authCallback('INITIAL_SESSION', { user: { id: 'z', email: 'panos@internal.local', user_metadata: { lang: 'en' } }, access_token: 't' });
  ok('account ≠ device: reload, device updated, no load', reloads === 3 && localStorage.getItem('lang') === 'en' && signedIn === 0);
  LANG = 'en';
  authCallback('SIGNED_IN', { user: { id: 'y', email: 'panos@internal.local', user_metadata: { lang: 'en' } }, access_token: 't' });
  ok('account = device: no reload, loads', reloads === 3 && signedIn === 1);
  ok('switch shown on a translated page', getComputedStyle(document.getElementById('common-lang')).display !== 'none');
  localStorage.removeItem('lang');
  return out.join('\n');
};
```

- [ ] **Step 2: Run — fails** — open `http://localhost:8766/common_test.html?r=1`, `await runLangChecks()` → `addTranslations is not defined`.

- [ ] **Step 3: Add the LANGUAGE section to common.js** — insert after the SESSION section (before `── sbFetch ──`):

```js
// ── LANGUAGE ── ΕΛ/EN. The page is written in Greek; t() gives the English when LANG is 'en'.
// LANG starts from this device's saved copy (else Greek); after sign-in the account's choice
// (user_metadata.lang) wins — startPage reloads once if the two differ.
// Each page adds its own English list with addTranslations({...}) in its TRANSLATIONS block.
const LANGS = ['el', 'en'];
let LANG = 'el';
try { if (LANGS.includes(localStorage.getItem('lang'))) LANG = localStorage.getItem('lang'); } catch (e) {}

// Greek text → English. The shared words live here; pages add theirs.
const EN = {};
function addTranslations(list) { Object.assign(EN, list); }
addTranslations({
  // shared sign-in box and buttons
  'Σύνδεση': 'Sign in', 'Είσοδος': 'Sign in', 'Σύνδεση…': 'Signing in…', 'Κωδικός…': 'Password…',
  'Λάθος email ή κωδικός.': 'Wrong email or password.',
  'Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.': 'No connection — try again.',
  'Αρχική': 'Home', '← Έξοδος': '← Sign out', 'Αποσύνδεση': 'Sign out', 'Αποσύνδεση;': 'Sign out?',
  'Γλώσσα': 'Language',
  'Έχετε αλλαγές που δεν αποθηκεύτηκαν. Συνέχεια;': 'You have unsaved changes. Continue?',
  // values stored in Greek, translated on screen only
  'ΝΑΙ': 'YES', 'ΟΧΙ': 'NO', 'Αυτόματα': 'Automatic',
  // short weekday names
  'Κυρ': 'Sun', 'Δευ': 'Mon', 'Τρί': 'Tue', 'Τετ': 'Wed', 'Πέμ': 'Thu', 'Παρ': 'Fri', 'Σάβ': 'Sat',
});

// Greek texts asked for in English that have no English yet — read by the checks, never shown
window.missingTranslations = new Set();

// t('Greek text', { n: 3 }) → the text in the current language, {name} parts filled from values
function t(greek, values) {
  let text = greek;
  if (LANG === 'en') {
    if (greek in EN) text = EN[greek];
    else window.missingTranslations.add(greek);
  }
  if (values && typeof values === 'object')
    text = text.replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m));
  return text;
}

// translate every tagged element: data-t (its own text — tag only elements holding just text),
// data-t-title, data-t-placeholder. startPage runs it for the whole page.
function translatePage(root = document) {
  if (LANG === 'el') return;
  root.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.textContent.replace(/\s+/g, ' ').trim()); });
  root.querySelectorAll('[data-t-title]').forEach(el => { el.title = t(el.title); });
  root.querySelectorAll('[data-t-placeholder]').forEach(el => { el.placeholder = t(el.placeholder); });
}

// device copy of the language; false when the browser blocks storage
function saveDeviceLanguage(lang) {
  try { localStorage.setItem('lang', lang); return true; } catch (e) { return false; }
}

// separate so the checks can replace it
function reloadPage() { location.reload(); }

// ΕΛ/EN pressed: ask if there's unsaved work, save on the account, then the device, then reload.
// If the account can't be reached nothing changes, so device and account never disagree.
async function switchLanguage(to, hasUnsavedWork) {
  if (hasUnsavedWork && hasUnsavedWork() && !confirm(t('Έχετε αλλαγές που δεν αποθηκεύτηκαν. Συνέχεια;'))) return;
  let error;
  try { ({ error } = await _sb.auth.updateUser({ data: { lang: to } })); } catch (e) { error = e; }
  if (error) { alert(t('Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.')); return; }
  saveDeviceLanguage(to);
  reloadPage();
}
```

- [ ] **Step 4: Route the existing common.js texts through `t()`**

In `drawSignInBox`: `'<p>' + t('Σύνδεση') + '</p>'`, `placeholder="' + t('Κωδικός…') + '"`, button text `t('Είσοδος')`.
In `signIn`: `btn.textContent = t('Σύνδεση…')` / `t('Είσοδος')`; error texts `t('Λάθος email ή κωδικός.')` / `t('Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.')`.
In `signOut`: `confirm(t('Αποσύνδεση;'))`.

- [ ] **Step 5: Switch in the shared buttons + account check in startPage**

Replace `drawNav()` with `drawNav(showLanguageSwitch)`:

```js
// ── SHARED BUTTONS ── ⌂ Αρχική · ΕΛ/EN · ← Έξοδος, drawn into the page's <span id="common-nav">.
// The homepage gets no ⌂. ΕΛ/EN and Έξοδος stay hidden until someone is signed in.
function drawNav(showLanguageSwitch) {
  const nav = document.getElementById('common-nav');
  const onHomepage = /\/(index\.html)?$/.test(location.pathname);
  nav.className = 'common-nav';
  nav.innerHTML =
    (onHomepage ? '' : `<a class="common-nav-btn" href="index.html" title="${t('Αρχική')}">⌂<span class="common-nav-label"> ${t('Αρχική')}</span></a>`) +
    (showLanguageSwitch ? `<span class="common-lang" id="common-lang" title="${t('Γλώσσα')}" style="display:none">` +
      LANGS.map(l => `<button type="button" data-lang="${l}"${l === LANG ? ' class="on"' : ''}>${l === 'el' ? 'ΕΛ' : 'EN'}</button>`).join('') +
      '</span>' : '') +
    `<button type="button" class="common-nav-btn" id="common-signout" title="${t('Αποσύνδεση')}" style="display:none">${t('← Έξοδος')}</button>`;
  document.getElementById('common-signout').onclick = signOut;
}
```

Replace `startPage` with:

```js
// ── startPage ── the one setup call each page makes, as the last line of its script:
//   startPage({ onSignedIn: name => …, onSignedOut, hasUnsavedWork, translated })   (all but onSignedIn optional)
// translated: true once the page has its English list (rollout — removed when all pages have one);
//   untranslated pages stay Greek whatever the account says.
// hasUnsavedWork: () => true while the page holds edits not yet saved (asked before switching language).
// onSignedIn(displayName) runs ONCE per signed-in user: supabase re-sends SIGNED_IN right after
// INITIAL_SESSION and on every tab refocus, and reloading then wiped highlights and reopened
// popups (commit 1b004c2). _authSession is still updated on every event, so the hourly
// background token renewal keeps saves working.
function startPage({ onSignedIn, onSignedOut, hasUnsavedWork, translated }) {
  if (!translated) LANG = 'el';
  document.documentElement.lang = LANG;
  translatePage();
  drawNav(translated);
  const signInArea = drawSignInBox();
  const signOutBtn = document.getElementById('common-signout');
  const langSwitch = document.getElementById('common-lang');
  if (langSwitch) langSwitch.querySelectorAll('button:not(.on)').forEach(b => {
    b.onclick = () => switchLanguage(b.dataset.lang, hasUnsavedWork);
  });
  let loadedForUser = null;
  _sb.auth.onAuthStateChange((event, session) => {
    _authSession = session;
    signInArea.style.display = session ? 'none' : '';
    signOutBtn.style.display = session ? '' : 'none';
    if (langSwitch) langSwitch.style.display = session ? '' : 'none';
    if (session && session.user.id !== loadedForUser) {
      // the account's language wins over this device's copy: save it and reload once, before any data
      // loads (only if the device can store it — otherwise it would reload forever)
      const accountLang = (session.user.user_metadata || {}).lang;
      if (translated && LANGS.includes(accountLang) && accountLang !== LANG && saveDeviceLanguage(accountLang)) {
        reloadPage();
        return;
      }
      loadedForUser = session.user.id;
      onSignedIn(userDisplayName(session.user.email));
    } else if (!session) {
      loadedForUser = null;
      if (onSignedOut) onSignedOut();
      setTimeout(() => document.getElementById('common-email').focus(), 100);
    }
  });
}
```

- [ ] **Step 6: Switch styles — append to theme.css**

```css
/* ΕΛ/EN switch in the shared buttons (common.js); the current language is highlighted */
.common-lang{display:inline-flex;height:28px;border:1px solid var(--gh-border-default);border-radius:var(--rs);overflow:hidden}
.common-lang button{border:none;background:var(--gh-canvas-subtle);color:var(--gh-fg-muted);font-family:'Inter',system-ui,sans-serif;font-size:12px;font-weight:500;padding:0 8px;cursor:pointer}
.common-lang button:hover{color:var(--gh-fg-default);background:var(--gh-hover-bg)}
.common-lang button.on{background:var(--gh-accent-subtle);color:var(--gh-accent-fg);cursor:default}
```

- [ ] **Step 7: Run both runners — all pass** — fresh `common_test.html?r=2`: `await runChecks()` → 18 PASS (the test page calls `startPage` without `translated`, so it stays Greek); reload `?r=3`: `await runLangChecks()` → 20 PASS.

- [ ] **Step 8: Checkpoint** — report; continue to Task 2 (committed together).

---

### Task 2: Homepage in both languages + first commit

**Files:** Modify `index.html`, all 7 pages' `?v=1` → `?v=2`, `CLAUDE.md`

**Interfaces — Consumes:** `t`, `addTranslations`, `startPage({ translated: true })`.

- [ ] **Step 1: Snapshot the Greek homepage before changing it** — fresh `index.html?r=1`, stub `sbFetch` with the dashboard stub below, fire a fake sign-in, then save `document.body.innerText` to `window.__before` (copy the string into `$SP/b_index_before.txt` via the javascript_tool result).

Dashboard stub (reuse in every homepage check):
```js
window.sbFetch = async p =>
  p.startsWith('placements') ? [{id:1,house:'Θ1',doc_date:'2026-09-01',breed:'Lohman Brown',status:'Confirmed',ptino:false},{id:2,house:'Θ1',doc_date:'2027-02-05',breed:'Lohman Brown',status:'Requested',ptino:false},{id:3,house:'Θ5',doc_date:'2026-11-20',breed:'Lohman Brown',status:'Confirmed',ptino:false}]
  : p.startsWith('emvolia') ? [{anath:'Θ1',hm_ekk:'2026-09-01',hm_emv:isoOf(addDays(new Date(),1)),emvolio:'MG 6/85 / AVINEW',paragelia:'ΟΧΙ',psygeio:'ΟΧΙ'},{anath:'Θ2',hm_ekk:'2026-08-01',hm_emv:isoOf(addDays(new Date(),2)),emvolio:'IZOVAC',paragelia:'ΝΑΙ',psygeio:'ΟΧΙ'}]
  : [{house:'Θ1',breed:'Lohman Brown',hatch:'2026-09-01'}];
const cb = [..._sb.auth.stateChangeEmitters.values()].pop().callback;
cb('INITIAL_SESSION', { user: { id: 'u1', email: 'panos@internal.local', user_metadata: {} }, access_token: 't' });
```

- [ ] **Step 2: Tag the fixed texts in index.html**

Add `data-t` to: `<div class="sec">Θάλαμοι</div>`, `<div class="dash-msg">Φόρτωση…</div>`, `<div class="sec">Εκτροφή</div>`, `<div class="sec">Φόρτωση</div>`, every `<span class="tool-name">` and `<span class="tool-desc">`. Footer: `<footer>PanosG1138 · <span data-t>Εσωτερική χρήση</span></footer>`.
The two truck tool names (Καμπόσος, Δουκάκης) are names — **not** tagged.

- [ ] **Step 3: Wrap the built texts in `t()`**

Exact replacements in `loadDashboard` / helpers:
```js
// when()
if (n === 0) return t('Σήμερα');
if (n === 1) return t('Αύριο');
return d.getFullYear() === today.getFullYear() ? `${t(WD[d.getDay()])} ${ddmm(d)}` : `${ddmm(d)}/${String(d.getFullYear()).slice(2)}`;
// STATUS labels
const STATUS = { 'Confirmed': ['επιβεβαιωμένη', 'ok'], 'Requested': ['ζητήθηκε', ''], 'Not ordered': ['χωρίς επιβεβαίωση', ''] };
//   … where used:  const [stText, stCls] = next ? (STATUS[next.status] ? [t(STATUS[next.status][0]), STATUS[next.status][1]] : [x(next.status), '']) : [t('καμία προγραμματισμένη'), ''];
// load error
`<div class="dash-msg err">${t('Σφάλμα φόρτωσης: {msg}', { msg: x(e.message) })}</div>`
// empty house
const what = next ? t(n === 1 ? 'εκκόλαψη σε {n} ημέρα' : 'εκκόλαψη σε {n} ημέρες', { n }) : t('καμία προγραμματισμένη');
`<div class="t-sub">${t('Άδειο')}</div>`
// vaccine names joined with "ή"
.replace(/ \/ /g, ` ${t('ή')} `)
// vaccination line
`${t('Εμβόλια: άλλη εκκόλαψη ({d})', { d: ddmm(parseISO(stray.hm_ekk)) })}`   … and  'κανένας καταχωρημένος' → t('κανένας καταχωρημένος')
// feed line
!fr ? t('λείπει από Ζωοτροφές') : t('Ζωοτροφές: άλλη εκκόλαψη')      … and  'καμία άλλη αλλαγή' → t('καμία άλλη αλλαγή')
// tile subtitle
`<div class="t-sub">${t('{breed} · ημέρα {n}', { breed: x(cur.breed || '—'), n: age })}</div>`
// pills
`<a class="pill" href="…">${t(week.size === 1 ? '{n} εμβολιασμός τις επόμενες 7 ημέρες' : '{n} εμβολιασμοί τις επόμενες 7 ημέρες', { n: `<b>${week.size}</b>` })}` +
  (notOrdered ? ` · <span class="warn">${t('{n} χωρίς παραγγελία', { n: notOrdered })}</span>` : '') +
  (notArrived ? ` · ${t(notArrived === 1 ? '{n} δεν έχει έρθει' : '{n} δεν έχουν έρθει', { n: notArrived })}` : '') + '</a>' +
(firstFeed ? `<a class="pill" href="…">${t('Επόμενο σιτηρέσιο: {what}, {when}', { what: `<b>${firstFeed.house} → ${x(firstFeed.name)}</b>`, when: when(firstFeed.date, today) })}</a>` : '');
```

- [ ] **Step 4: Add the TRANSLATIONS block** — at the top of the main script, before `── SIGN-IN ──`:

```js
// ── TRANSLATIONS ── this page's English (Greek text → English); shared words are in common.js
addTranslations({
  'Θάλαμοι': 'Houses', 'Φόρτωση…': 'Loading…', 'Εκτροφή': 'Rearing', 'Φόρτωση': 'Loading',
  'Εμβόλια': 'Vaccines', 'Παραγγελίες και εμβολιασμοί ανά σμήνος': 'Orders and vaccinations per flock',
  'Απόθεμα': 'Stock', 'Απόθεμα εμβολίων': 'Vaccine stock',
  'Ζωοτροφές': 'Feed', 'Σιτηρέσια και πρόσθετα ανά σμήνος': 'Feed phases and additives per flock',
  'Προγραμματισμός': 'Scheduling', 'Εκκολάψεις ανά θάλαμο': 'Hatches per house',
  'Φόρτωση καρότσας': 'Truck loading', 'Εσωτερική χρήση': 'Internal use',
  'Σήμερα': 'Today', 'Αύριο': 'Tomorrow',
  'επιβεβαιωμένη': 'confirmed', 'ζητήθηκε': 'requested', 'χωρίς επιβεβαίωση': 'not confirmed',
  'καμία προγραμματισμένη': 'none planned', 'Άδειο': 'Empty',
  'εκκόλαψη σε {n} ημέρα': 'hatch in {n} day', 'εκκόλαψη σε {n} ημέρες': 'hatch in {n} days',
  'Σφάλμα φόρτωσης: {msg}': 'Loading error: {msg}', 'ή': 'or',
  'Εμβόλια: άλλη εκκόλαψη ({d})': 'Vaccines: different hatch ({d})', 'κανένας καταχωρημένος': 'none entered',
  'λείπει από Ζωοτροφές': 'missing from Feed', 'Ζωοτροφές: άλλη εκκόλαψη': 'Feed: different hatch',
  'καμία άλλη αλλαγή': 'no more changes', '{breed} · ημέρα {n}': '{breed} · day {n}',
  '{n} εμβολιασμός τις επόμενες 7 ημέρες': '{n} vaccination in the next 7 days',
  '{n} εμβολιασμοί τις επόμενες 7 ημέρες': '{n} vaccinations in the next 7 days',
  '{n} χωρίς παραγγελία': '{n} not ordered',
  '{n} δεν έχει έρθει': '{n} not arrived yet', '{n} δεν έχουν έρθει': '{n} not arrived yet',
  'Επόμενο σιτηρέσιο: {what}, {when}': 'Next feed: {what}, {when}',
});
```
And the last line becomes:
```js
startPage({ onSignedIn: () => showDashboard(), onSignedOut: () => hideDashboard(), translated: true });
```

- [ ] **Step 5: Bump versions on all 7 pages** — replace `common.js?v=1` → `common.js?v=2` and `theme.css?v=1` → `theme.css?v=2` in every `*.html`; grep: 7 hits each for `v=2`, 0 for `v=1`.

- [ ] **Step 6: Check the homepage**

a) Greek: fresh `index.html?r=2`, same stub + sign-in → `document.body.innerText` equals `b_index_before.txt` except the new ΕΛ/EN switch text ("ΕΛ" "EN") in the header.
b) English: `localStorage.setItem('lang','en')`, fresh `index.html?r=3`, same stub + sign-in with `user_metadata: { lang: 'en' }` → `[...missingTranslations]` is `[]`; tiles show "hatch in N days", "Today"/"Tomorrow", "not confirmed"/"requested", pills in English; vaccine names, breeds, houses, feed phase names unchanged.
c) Signed-out English homepage: shared box in English ("Sign in", "Password…").
d) Switch: click EN on the Greek page with `_sb.auth.updateUser` and `reloadPage` stubbed → both called. Reset `localStorage.removeItem('lang')` after.
e) Other pages still Greek with no switch: fresh `vaccine_tracker.html?r=1` with `lang=en` in localStorage → page Greek, no `#common-lang`, shared buttons Greek.
f) `common_test.html`: `runChecks` 18 PASS, `runLangChecks` 20 PASS.
g) Screenshots EL and EN of the homepage.

- [ ] **Step 7: CLAUDE.md** — under the common.js bullet add:

```markdown
- **Language (ΕΛ/EN)**: pages are written in Greek; `t('Greek text', { n })` returns English when `LANG` is `'en'`. Fixed texts are tagged `data-t` / `data-t-title` / `data-t-placeholder`; each page's English list is in its `// ── TRANSLATIONS ──` block (`addTranslations`), shared words in common.js. The choice is saved on the account (`user_metadata.lang`) and on the device (`localStorage.lang`). **Changing a Greek text means updating its English line too** — otherwise English shows the Greek. Never translated: vaccine names, breeds, houses, feed phase and additive names, people names, typed text. Design: `docs/superpowers/specs/2026-11-03-language-switch-design.md`.
```

- [ ] **Step 8: Ponytail review, report (translation table = the TRANSLATIONS block, screenshots, checks), wait for "commit and push now"**, then:
```bash
git add common.js theme.css index.html vaccine_tracker.html inventory.html feed_tracker.html schedule_checker.html truck_calculator_kamposos.html truck_calculator_doukakis.html CLAUDE.md docs/superpowers/plans/2026-11-03-language-switch.md
git commit -m "ΕΛ/EN language system in common.js; homepage in both languages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Tasks 3–7: one page each — same method

Order and page notes:

| Task | Page | `onSignedIn` stays | `hasUnsavedWork` | Notes |
|---|---|---|---|---|
| 3 | vaccine_tracker.html | `name => initApp(name)` | `() => isEditOpen()` (true while the edit window, batch edit or wizard is open — define it from the page's own open-state checks) | biggest page: table, filters, wizard, edit window, history, changes popup, «Μήπως εννοείτε;», batch edit, prints, ΝΑΙ/ΟΧΙ cells, `Αυτόματα` |
| 4 | inventory.html | `name => initApp(name)` | `() => editId !== null` | table, edit window, history |
| 5 | feed_tracker.html | `() => loadFromSupabase()` | `() => unsaved.size > 0` | **Greek rewrite first** |
| 6 | schedule_checker.html | `() => load()` | `() => isModalOpen()` (add/edit placement window open — define from the page's modal state) | **Greek rewrite first** |
| 7 | both truck pages | `name => { currentUser = name; loadState(); }` | none (saves as you go) | layout labels, printed load sheet; same list in both files |

Each page task:

- [ ] **Step 1: Snapshot Greek before** — fresh page, stub data covering every part (one row per status/state the page shows), fake sign-in; for each state (main view, each window/wizard step/popup opened, print HTML via a stubbed `window.open` that records the written HTML) save `document.body.innerText` (or the print HTML) to `$SP/b_<page>_before.json` as `{ state: text }`. The state list is written down in this step and reused in Step 5.

- [ ] **Step 2: Inventory every shown text → `$SP/b_<page>_strings.md`** — a table `Greek | English | where`. Sources: HTML text nodes, `title=`, `placeholder=`, `<option>` texts, JS string literals that reach the screen (`innerHTML`/`textContent` templates, `toast(`/`showToast(`, `confirm(`, `alert(`, `setSyncStatus(`/`setSyncState(`, print templates), stored Greek values shown as-is. Values with numbers/names become `{name}` placeholders. Plural pairs get two keys. Excluded per Global Constraints.
  **Tasks 5–6 only:** the table is `current English | Greek draft | where`; farm terms the draft is unsure of are marked **(?)**.

- [ ] **Step 3: User review checkpoint** — send the table; wait for corrections. (Tasks 5–6: nothing is built before the user corrects the Greek draft.)

- [ ] **Step 4: Convert the page** — tag fixed texts (`data-t*`; an element mixing an icon and text gets its text wrapped in `<span data-t>`), wrap built texts in `t()`, add the `// ── TRANSLATIONS ──` block from the reviewed table (Tasks 5–6: first replace the English source texts with the approved Greek, then the block maps Greek → today's English), add `translated: true` and `hasUnsavedWork` to `startPage`, bump `?v=N` only if common.js/theme.css changed.

- [ ] **Step 5: Check in both languages**
  - Greek: replay Step 1's states → every text equals `before` (Tasks 5–6: equals the approved Greek instead).
  - English: same states with `lang=en` → `[...missingTranslations]` is `[]`; spot-check the table's English appears.
  - Every `confirm()`/toast/alert triggered once in English (stub `confirm`/`alert` to record the text) → English.
  - Project A page check (`$SP/page_check.js`, `PAGE_LOADER` as in the table) passes; dashboard-link highlight still works for vaccine/feed/scheduler.
  - Switch with unsaved work asks first (stub `confirm` → false keeps the page).
  - EL and EN screenshots of the main view.

- [ ] **Step 6: Ponytail review, report, wait for "commit and push now"**, then commit that page (+ plan/CLAUDE.md if touched) with message `<Page> in both languages` and the attribution line; push.

---

### Task 8: Finish — remove the rollout option, final sweep

**Files:** Modify `common.js`, all 7 pages, `CLAUDE.md`

- [ ] **Step 1:** In common.js `startPage`: delete `translated` from the parameters, the `if (!translated) LANG = 'el';` line and the `translated &&` in the account check; `drawNav(true)` → make `drawNav()` always draw the switch (remove its parameter and the `showLanguageSwitch ?` branch); update the startPage comment. Remove `translated: true` from all 7 pages' `startPage` calls. Bump `?v=N` on all 7 pages.
- [ ] **Step 2:** Update `common_test.html`: the "switch shown" and "account ≠ device" checks no longer pass `translated`. Run `runChecks` and `runLangChecks` → all pass.
- [ ] **Step 3: Sweep** — grep all `*.html` for `confirm('`, `confirm("`, `alert('`, `toast('`, `showToast('`, `setSyncStatus('`, `setSyncState('` whose first argument is a literal not inside `t(` → 0 hits. Grep `translated` in `*.html` and `common.js` → 0 hits.
- [ ] **Step 4:** Rerun every page's Step 5 checks in both languages (all 7 pages).
- [ ] **Step 5:** CLAUDE.md: drop any rollout wording. Ponytail review, report, wait for "commit and push now", commit `Language switch on every page`, push. Stop both servers.
