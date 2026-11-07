// ══ common.js — shared by every page of the tools site ══════════════════════════
// Load right after the Supabase library:   <script src="common.js?v=N"></script>
// Used by: index.html, vaccine_tracker.html, inventory.html, feed_tracker.html,
//          schedule_checker.html, vaccine_programme.html, truck_calculator_kamposos.html,
//          truck_calculator_doukakis.html, vaccine_tracker_beta.html (until it replaces vaccine_tracker.html)
// Whenever this file changes, bump ?v=N on ALL those pages in the same commit
// (GitHub Pages lets browsers keep an old copy for ~10 minutes).
// Each page calls startPage({...}) as the LAST line of its script — see startPage below.
// Design: docs/superpowers/specs/2026-11-03-common-js-foundation-design.md

// ── CONNECTION ── the one Supabase client. SB_KEY is the public (publishable) key, safe in a page.
const SB_URL = 'https://oorhbrphdbigwgizejcc.supabase.co';
const SB_KEY = 'sb_publishable_1S3L1sNMOjr-YgwGAAD2Kg_X_3S4cTl';
const _sb = supabase.createClient(SB_URL, SB_KEY);

// ── SESSION ── the signed-in session, null when signed out. startPage keeps it current.
let _authSession = null;

// login email → the name shown on the page and written into history rows
function userDisplayName(email) {
  const names = { 'panos@internal.local': 'Πάνος', 'eleni@internal.local': 'Ελένη' };
  return names[email] || email.split('@')[0];
}

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
  // the "start the εμβολιακό" banner (VAX REMINDER)
  '{n} γραμμή': '{n} line', '{n} γραμμές': '{n} lines', 'διαγραφή σε {n} ημέρα': 'deleted in {n} day', 'διαγραφή σε {n} ημέρες': 'deleted in {n} days', 'Ο κάδος είναι άδειος.': 'The bin is empty.',
  'Εκκολάψεις άνω των 18 εβδομάδων. Διαγράφονται οριστικά 30 ημέρες μετά — μένει μόνο το ιστορικό.': 'Hatches older than 18 weeks. Deleted for good 30 days later — only the history stays.',
  'Ξεκινήστε το εμβολιακό': 'Start the vaccination plan', 'Εμβολιακό — έχουν ήδη αργήσει παραγγελίες': 'Vaccination plan — orders are already late',
  'ημέρες': 'days', 'εκκόλαψη': 'hatch', 'ημ. {n}': 'day {n}', 'Πρόχειρο — δεν έχει ενεργοποιηθεί': 'Draft — not activated',
  'Δεν έχει ξεκινήσει εμβολιακό': 'No vaccination plan yet', 'πρώτη παραγγελία από {d}': 'first order from {d}', 'Άνοιγμα εμβολιακού →': 'Open plan →',
  // shared sign-in box and buttons
  'Σύνδεση': 'Sign in', 'Είσοδος': 'Log in', 'Σύνδεση…': 'Logging in…', 'Κωδικός…': 'Password…',
  'Λάθος email ή κωδικός.': 'Wrong email or password.',
  'Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.': 'No connection — try again.',
  'Αρχική': 'Home', 'Αποσύνδεση': 'Sign out', 'Αποσύνδεση;': 'Sign out?',
  'Γλώσσα': 'Language',
  'Έχετε αλλαγές που δεν αποθηκεύτηκαν. Συνέχεια;': 'You have unsaved changes. Continue?',
  // vaccine-name questions (VACCINE NAMES below)
  'Μήπως εννοείτε;': 'Did you mean?', 'Γράψατε: «{name}»': 'You typed: «{name}»', 'Όχι, κράτα «{name}»': 'No, keep «{name}»',
  'Το «{name}» δεν υπάρχει στη λίστα εμβολίων.': "«{name}» isn't in the vaccine list.",
  'Προσθήκη στη λίστα και αποθήκευση;': 'Add it to the list and save?', 'Προσθήκη και αποθήκευση': 'Add and save',
  'Ακύρωση': 'Cancel',
  // values stored in Greek, translated on screen only
  'ΝΑΙ': 'YES', 'ΟΧΙ': 'NO', 'Αυτόματα': 'Automatic', 'Δόσεις': 'Doses', 'Κιλά': 'kg',
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

// a value stored in Greek in the database (ΝΑΙ, ΟΧΙ, Αυτόματα, the stock unit) shown in the reader's language;
// any other stored value (names, notes, dates) comes back unchanged and is never reported missing
const STORED_GREEK = ['ΝΑΙ', 'ΟΧΙ', 'Αυτόματα', 'Δόσεις', 'Κιλά'];
function tValue(value) { return STORED_GREEK.includes(value) ? t(value) : value; }

// translate every tagged element: data-t (its own text — tag only elements holding just text),
// data-t-title, data-t-placeholder, data-t-aria-label. startPage runs it for the whole page.
function translatePage(root = document) {
  if (LANG === 'el') return;
  root.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.textContent.replace(/\s+/g, ' ').trim()); });
  root.querySelectorAll('[data-t-title]').forEach(el => { el.title = t(el.title); });
  root.querySelectorAll('[data-t-placeholder]').forEach(el => { el.placeholder = t(el.placeholder); });
  root.querySelectorAll('[data-t-aria-label]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('aria-label'))); });
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

// ── sbFetch ── every read and write to Supabase's REST API goes through here.
// Refused by the server → throws Error(server message) with .status set.
// Lost connection → fetch's own error, without .status (feed_tracker.html tells the two apart).
// Empty reply (some updates/deletes) → null.
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${_authSession.access_token}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || '',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || body.hint || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── SIGN-IN SCREEN ── one box for every page. Drawn inside the page's #common-signin if it has
// one (homepage: inline, hidden until we know nobody is signed in); otherwise as a full-page cover
// (tool pages: visible from the start so the page never flashes before sign-in).
// Returns the element startPage shows/hides.
function drawSignInBox() {
  const box = document.createElement('form');
  box.className = 'common-signin-box';
  box.innerHTML =
    '<h2>🐔 Georgasopoulos</h2>' +
    '<p>' + t('Σύνδεση') + '</p>' +
    '<input type="email" id="common-email" placeholder="Email…" autocomplete="username">' +
    '<input type="password" id="common-password" placeholder="' + t('Κωδικός…') + '" autocomplete="current-password">' +
    '<button type="submit" id="common-signin-btn">' + t('Είσοδος') + '</button>' +
    '<div class="common-signin-error" id="common-signin-error"></div>';
  box.onsubmit = e => { e.preventDefault(); signIn(); };
  // Enter in the email field moves to the password instead of signing in
  box.querySelector('#common-email').onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('common-password').focus(); }
  };
  const spot = document.getElementById('common-signin');
  if (spot) {
    spot.style.display = 'none';
    spot.appendChild(box);
    return spot;
  }
  const cover = document.createElement('div');
  cover.className = 'common-signin-cover';
  cover.appendChild(box);
  document.body.prepend(cover);
  return cover;
}

async function signIn() {
  const btn = document.getElementById('common-signin-btn');
  const errEl = document.getElementById('common-signin-error');
  btn.disabled = true; btn.textContent = t('Σύνδεση…'); errEl.textContent = '';
  const { error } = await _sb.auth.signInWithPassword({
    email: document.getElementById('common-email').value.trim(),
    password: document.getElementById('common-password').value,
  });
  btn.disabled = false; btn.textContent = t('Είσοδος');
  // 400 = the server answered "wrong email or password"; anything else = it couldn't be reached
  if (error) errEl.textContent = error.status === 400 ? t('Λάθος email ή κωδικός.') : t('Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.');
}

// ── SHARED BUTTONS ── sign-out icon · ΕΛ/EN · house icon + Αρχική, drawn into the page's <span id="common-nav">.
// Home sits last, the largest and easiest to hit (user, 2026-11-06). The homepage gets no home button.
// Sign-out and ΕΛ/EN stay hidden until someone is signed in.
function drawNav(showLanguageSwitch) {
  const nav = document.getElementById('common-nav');
  const onHomepage = /\/(index\.html)?$/.test(location.pathname);
  nav.className = 'common-nav';
  nav.innerHTML =
    `<button type="button" class="common-nav-btn" id="common-signout" title="${t('Αποσύνδεση')}" aria-label="${t('Αποσύνδεση')}" style="display:none">` +
      '<svg class="common-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2"/><path d="M9 12h12l-3-3"/><path d="M18 15l3-3"/></svg></button>' +
    (showLanguageSwitch ? `<span class="common-lang" id="common-lang" title="${t('Γλώσσα')}" style="display:none">` +
      LANGS.map(l => `<button type="button" data-lang="${l}"${l === LANG ? ' class="on"' : ''}>${l === 'el' ? 'ΕΛ' : 'EN'}</button>`).join('') +
      '</span>' : '') +
    (onHomepage ? '' : '<a class="common-nav-btn" href="index.html"><svg class="common-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12H3l9-9 9 9h-2"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/></svg>' +
      `${t('Αρχική')}</a>`);
  document.getElementById('common-signout').onclick = signOut;
}

function signOut() { if (confirm(t('Αποσύνδεση;'))) _sb.auth.signOut(); }

// text made safe to put inside HTML (same as the pages' own x())
function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── WINDOW BACKGROUND CLICKS ── windows close on a click on their dark background (onclick="if(event.target===this)…").
// Selecting text by dragging and letting go outside the window also counts as such a click, so it closed the
// window mid-edit: a background click now counts only when the press started on the background too.
let pressStartedOn = null;
document.addEventListener('mousedown', e => { pressStartedOn = e.target; }, true);
document.addEventListener('click', e => {
  const closesOnBackground = (e.target.getAttribute && e.target.getAttribute('onclick') || '').includes('event.target===this');
  if (closesOnBackground && pressStartedOn !== e.target) e.stopPropagation();
}, true);

// ── VACCINE NAMES ── used by vaccine_tracker.html and inventory.html (each page has the
// #vaccine-list datalist and the #vname-bg question window this code fills in).
// The `vaccines` table holds the one correct spelling of each name; every name saved goes
// through resolveVaccineName: a different typing of a known name is corrected silently,
// a typo asks "did you mean", a new name asks to be added to the list.
let VACCINE_OPTIONS = [];
async function loadVaccineNames() {
  VACCINE_OPTIONS = (await sbFetch('vaccines?select=name&order=name.asc')).map(v => v.name);
  fillVaccineList();
}
function fillVaccineList() {
  const dl = document.getElementById('vaccine-list');
  if (dl) dl.innerHTML = VACCINE_OPTIONS.map(v => `<option value="${escapeHtml(v)}">`).join('');
}
// skeleton used for comparing: capitals, no spaces or - / . +   ("mg 6-85" → "MG685")
const vaccineKey = s => String(s || '').toUpperCase().replace(/[\s\-\/.+]/g, '');
// edit distance between two skeletons; swapping two neighbouring characters counts as one change
function editDistance(a, b) {
  const d = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) d[i][j] = Math.min(d[i][j], d[i-2][j-2] + 1);
  }
  return d[a.length][b.length];
}
// known names closest to a typo: within 1 change (2 for names of 8+ characters); ties all returned
function nearVaccines(name) {
  const k = vaccineKey(name), max = k.length >= 8 ? 2 : 1;
  let best = max + 1, out = [];
  for (const v of VACCINE_OPTIONS) {
    const dist = editDistance(k, vaccineKey(v));
    if (dist < best) { best = dist; out = [v]; } else if (dist === best) out.push(v);
  }
  return best <= max ? out : [];
}
// one name → its correct spelling, or null if the user cancelled
async function resolveVaccineName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  const exact = VACCINE_OPTIONS.find(v => vaccineKey(v) === vaccineKey(name));
  if (exact) return exact;
  const near = nearVaccines(name);
  if (near.length) {
    const pick = await askVaccineName(`${t('Μήπως εννοείτε;')}<span class="vname-typed">${t('Γράψατε: «{name}»', { name: escapeHtml(name) })}</span>`,
      [...near.map(v => ({ label: v, value: v, primary: true })), { label: t('Όχι, κράτα «{name}»', { name }), value: '\u0000keep' }]);
    if (pick === null) return null;
    if (pick !== '\u0000keep') return pick;
  }
  const add = await askVaccineName(`${t('Το «{name}» δεν υπάρχει στη λίστα εμβολίων.', { name: escapeHtml(name) })}<span class="vname-typed">${t('Προσθήκη στη λίστα και αποθήκευση;')}</span>`,
    [{ label: t('Προσθήκη και αποθήκευση'), value: 'add', primary: true }]);
  if (add !== 'add') return null;
  // ignore-duplicates: the other user may have added the same name since this page loaded
  await sbFetch('vaccines', { method: 'POST', prefer: 'resolution=ignore-duplicates',
    body: JSON.stringify({ name, created_by: userDisplayName(_authSession.user.email) }) });   // who is signed in
  VACCINE_OPTIONS = [...VACCINE_OPTIONS, name].sort((a, b) => a.localeCompare(b));
  fillVaccineList();
  return name;
}
// small question window: resolves the clicked button's value, or null for Ακύρωση / Esc / outside click
let vnameResolve = null;
function askVaccineName(html, buttons) {
  document.getElementById('vname-msg').innerHTML = html;
  const acts = document.getElementById('vname-actions');
  acts.innerHTML = `<button class="btn-secondary" data-i="-1">${t('Ακύρωση')}</button>` +
    buttons.map((b, i) => `<button class="${b.primary ? 'btn-primary' : 'btn-secondary'}" data-i="${i}">${escapeHtml(b.label)}</button>`).join('');
  acts.querySelectorAll('button').forEach(btn => btn.onclick = () => {
    const i = +btn.dataset.i; resolveVaccineAsk(i < 0 ? null : buttons[i].value);
  });
  document.getElementById('vname-bg').style.display = 'flex';
  acts.querySelector('.btn-primary').focus();
  return new Promise(res => { vnameResolve = res; });
}
function resolveVaccineAsk(v) {
  document.getElementById('vname-bg').style.display = 'none';
  if (vnameResolve) { vnameResolve(v); vnameResolve = null; }
}

// ── VACCINE PLANNING ── used by vaccine_programme.html, vaccine_tracker_beta.html and (VAX REMINDER) index.html.
// Design: docs/superpowers/specs/2026-11-06-vaccine-planning-design.md
// customer = text before " - " in placements.customers ("Συντιχάκης - από Δεκ 2026" → "Συντιχάκης")
const customerName = s => String(s || '').split(' - ')[0].trim();
// a customer's note: the note field (2027+ tabs) or the text after " - " in the name (older tabs); parts joined with " · "
const customerNote = c => (c.note != null ? (c.note ? String(c.note).split(' - ') : []) : String(c.name || '').split(' - ').slice(1))
  .map(s => s.trim()).filter(Boolean).join(' · ');
// ΚΟΡΥΖΑ is a column of the injectables grid, not a product: one of these is picked for each hatch
const CORYZA = 'ΚΟΡΥΖΑ';
const CORYZA_PRODUCTS = ['BIONEW BI + COR', 'CORIPRAVAC'];
// Πελάτης as the tracker writes it: capitals without accents ("Βενιζέλος" → "ΒΕΝΙΖΕΛΟΣ")
const pelatisName = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
// a programme row's quantity before rounding: chicks + extra %, divided by divide_by
const planExact = (r, chicks) => chicks * (100 + Number(r.extra_pct)) / 100 / Number(r.divide_by);
// ... and after: rounded up to round_to (the 1e-9 stops 56.700,0000001 rounding past 57.000) — or the fixed amount
const planQty = (r, chicks) => r.rule === 'fixed' ? Number(r.fixed_qty)
  : Math.ceil(planExact(r, chicks) / r.round_to - 1e-9) * r.round_to;

// ── VAX REMINDER ── homepage + beta tracker: hatches whose εμβολιακό must be started or activated.
// From VAX_REMIND_DAYS before the hatch until activation; not hatches entered the old way (lines, no record), not binned ones.
const VAX_REMIND_DAYS = 35, VAX_BIN_DAYS = 126;
const BIN_USER = 'Αυτόματα (κάδος)';   // the nightly bin job's name in the history (bin_old_hatches); changes popups skip it
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

// ── LOADING RULES ── used by schedule_checker.html and index.html. Source of truth: docs/rearing_scheduler.md.
// Day 0 = hatch date. Loading doesn't depend on the house: every customer's pullets load from day LOAD_START
// for LOAD_DAYS days, except Φραγκούλης/Πτηνοτροφική, always from day PTINO_LOAD_START. placements.ptino says
// whether they're in the hatch: null = no, 'only' = only their pullets (loads 115–128),
// 'mixed' = theirs + other customers' (loads 105–128).
const LOAD_START = 105, PTINO_LOAD_START = 115;
const LOAD_DAYS  = 14;
// day since hatch the house is empty again (the flock has left; loading ended the day before), for a placement
const emptyDay = p => (p.ptino ? PTINO_LOAD_START : LOAD_START) + LOAD_DAYS;

// ── FEED RULES ── used by feed_tracker.html and index.html (the dashboard's "next feed change").
// .github/workflows/feed_notify.yml keeps its own Python copy (SCHEDULES, BREED_SCHEDULE, ADDITIVES,
// NO_ADDITIVES_HOUSES) for the reminder emails — change it too when these change.
// Real schedules — do not invent numbers for breeds that don't have a
// schedule key in BREED_SCHEDULE below.
const BREEDS = {
  'NOVOGEN':       { phases: ['0-5 Wks','6-10 Wks','11-15 Wks','16-2%'],              days: [0,35,70,105] },
  'HY-LINE':       { phases: ['0-3 Wks','4-6 Wks','7-12 Wks','13-15 Wks','16 -2%'],  days: [0,22,42,84,105] },
  'ISA':           { phases: ['0-5 Wks','6-10 Wks','11-16 Wks','17-2%'],              days: [0,35,70,119] },
  'HN_WHITE':      { phases: ['0-5 Wks','6-10 Wks','11-17 Wks','Prelay'],            days: [0,36,71,120] },
  'LOHMAN_BROWN':  { phases: ['1-3 Wks','4-8 Wks','9-17 Wks','18-5%'],                days: [0,22,57,120] }
};

// Dropdown breed name → schedule key above. null = no schedule yet (shows "—").
const BREED_SCHEDULE = {
  'Hy-Line Brown':  'HY-LINE',
  'Novogen Brown':  'NOVOGEN',
  'Novogen White':  'NOVOGEN',
  'Novogen Tinted': 'NOVOGEN',
  'ISA Brown':      'ISA',
  'Dekalb White':   null,
  'H&N Brown':      null,
  'H&N White':      'HN_WHITE',
  'H&N Coral':      null,
  'Lohman Brown':   'LOHMAN_BROWN'
};

// Products mixed into the feed, by day since hatch — same for every breed.
// Each runs until the next one starts (they switch on the same day); the last runs
// until the house is emptied (the row is cleared or gets a new hatch).
const ADDITIVES = [
  { name: 'Avidecoxx', from: 10 },
  { name: 'Robenz',    from: 31 },
];
const NO_ADDITIVES_HOUSES = ['Θ5', 'Θ7'];   // aviaries: never get Avidecoxx or Robenz — also in feed_notify.yml

// Saturday → Friday, Sunday → Monday (feed changes and additive starts); changes d in place and returns it
function toWeekday(d) {
  if (d.getDay() === 6) d.setDate(d.getDate() - 1);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

// ── LINK HIGHLIGHT ── arrived from a homepage dashboard link (?…): scroll to the item and make it
// glow (styles: .focus-glow in theme.css), then drop the parameters so a reload opens the page normally.
// find(params) returns the elements to highlight, in page order. Used by vaccine_tracker.html,
// feed_tracker.html and schedule_checker.html, each after its data has loaded and been drawn.
function focusFromLink(find) {
  const q = new URLSearchParams(location.search);
  if (![...q.keys()].length) return;
  history.replaceState(null, '', location.pathname);
  const els = find(q).filter(Boolean);
  if (!els.length) return;
  els[0].scrollIntoView({ block: 'center' });
  els.forEach(e => { e.classList.remove('focus-glow'); void e.offsetWidth; e.classList.add('focus-glow'); });
}

// ── startPage ── the one setup call each page makes, as the last line of its script:
//   startPage({ onSignedIn: name => …, onSignedOut, hasUnsavedWork, translated })   (all but onSignedIn optional)
// translated: true on pages that have an English list. Pages without one (the two truck pages —
//   Greek only, by the user's choice) show no ΕΛ/EN switch and stay Greek whatever the account says.
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
  // The account's language wins over this device's copy: save it and reload once, before any data loads
  // (only if the device can store it — otherwise it would reload forever). The saved login can be up to
  // ~1 h old, so the account is asked for its current language first; offline, the saved login's is used.
  async function startSignedIn(session) {
    let accountLang = (session.user.user_metadata || {}).lang;
    if (translated) {
      try { const { data } = await _sb.auth.getUser(); if (data && data.user) accountLang = (data.user.user_metadata || {}).lang; } catch (e) {}
      if (LANGS.includes(accountLang) && accountLang !== LANG && saveDeviceLanguage(accountLang)) { reloadPage(); return; }
    }
    onSignedIn(userDisplayName(session.user.email));
  }
  _sb.auth.onAuthStateChange((event, session) => {
    _authSession = session;
    signInArea.style.display = session ? 'none' : '';
    signOutBtn.style.display = session ? '' : 'none';
    if (langSwitch) langSwitch.style.display = session ? '' : 'none';
    if (session && session.user.id !== loadedForUser) {
      loadedForUser = session.user.id;
      // Run just after this event, not inside it: supabase-js warns that awaiting its own calls in here can stall.
      setTimeout(() => startSignedIn(session), 0);
    } else if (!session) {
      loadedForUser = null;
      if (onSignedOut) onSignedOut();
      setTimeout(() => document.getElementById('common-email').focus(), 100);
    }
  });
}
