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
    '<p>Σύνδεση</p>' +
    '<input type="email" id="common-email" placeholder="Email…" autocomplete="username">' +
    '<input type="password" id="common-password" placeholder="Κωδικός…" autocomplete="current-password">' +
    '<button type="submit" id="common-signin-btn">Είσοδος</button>' +
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
  btn.disabled = true; btn.textContent = 'Σύνδεση…'; errEl.textContent = '';
  const { error } = await _sb.auth.signInWithPassword({
    email: document.getElementById('common-email').value.trim(),
    password: document.getElementById('common-password').value,
  });
  btn.disabled = false; btn.textContent = 'Είσοδος';
  // 400 = the server answered "wrong email or password"; anything else = it couldn't be reached
  if (error) errEl.textContent = error.status === 400 ? 'Λάθος email ή κωδικός.' : 'Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.';
}

// ── SHARED BUTTONS ── ⌂ Αρχική · ← Έξοδος, drawn into the page's <span id="common-nav">.
// The homepage gets only Έξοδος. Έξοδος stays hidden until someone is signed in.
function drawNav() {
  const nav = document.getElementById('common-nav');
  const onHomepage = /\/(index\.html)?$/.test(location.pathname);
  nav.className = 'common-nav';
  nav.innerHTML =
    (onHomepage ? '' : '<a class="common-nav-btn" href="index.html" title="Αρχική">⌂<span class="common-nav-label"> Αρχική</span></a>') +
    '<button type="button" class="common-nav-btn" id="common-signout" title="Αποσύνδεση" style="display:none">← Έξοδος</button>';
  document.getElementById('common-signout').onclick = signOut;
}

function signOut() { if (confirm('Αποσύνδεση;')) _sb.auth.signOut(); }

// ── startPage ── the one setup call each page makes, as the last line of its script:
//   startPage({ onSignedIn: name => …, onSignedOut: () => … })      (onSignedOut is optional)
// onSignedIn(displayName) runs ONCE per signed-in user: supabase re-sends SIGNED_IN right after
// INITIAL_SESSION and on every tab refocus, and reloading then wiped highlights and reopened
// popups (commit 1b004c2). _authSession is still updated on every event, so the hourly
// background token renewal keeps saves working.
function startPage({ onSignedIn, onSignedOut }) {
  drawNav();
  const signInArea = drawSignInBox();
  const signOutBtn = document.getElementById('common-signout');
  let loadedForUser = null;
  _sb.auth.onAuthStateChange((event, session) => {
    _authSession = session;
    signInArea.style.display = session ? 'none' : '';
    signOutBtn.style.display = session ? '' : 'none';
    if (session && session.user.id !== loadedForUser) {
      loadedForUser = session.user.id;
      onSignedIn(userDisplayName(session.user.email));
    } else if (!session) {
      loadedForUser = null;
      if (onSignedOut) onSignedOut();
      setTimeout(() => document.getElementById('common-email').focus(), 100);
    }
  });
}
