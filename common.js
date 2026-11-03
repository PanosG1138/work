// ══ common.js — shared by every page of the tools site ══════════════════════════
// Load right after the Supabase library:   <script src="common.js?v=1"></script>
// Used by: index.html, vaccine_tracker.html, inventory.html, feed_tracker.html,
//          schedule_checker.html, truck_calculator_kamposos.html, truck_calculator_doukakis.html
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
  // shared sign-in box and buttons
  'Σύνδεση': 'Sign in', 'Είσοδος': 'Log in', 'Σύνδεση…': 'Logging in…', 'Κωδικός…': 'Password…',
  'Λάθος email ή κωδικός.': 'Wrong email or password.',
  'Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.': 'No connection — try again.',
  'Αρχική': 'Home', '← Έξοδος': '← Sign out', 'Αποσύνδεση': 'Sign out', 'Αποσύνδεση;': 'Sign out?',
  'Γλώσσα': 'Language',
  'Έχετε αλλαγές που δεν αποθηκεύτηκαν. Συνέχεια;': 'You have unsaved changes. Continue?',
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

function signOut() { if (confirm(t('Αποσύνδεση;'))) _sb.auth.signOut(); }

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
