# common.js foundation (project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Supabase connection, `sbFetch`, sign-in screen, load-once guard and the ⌂ / Έξοδος buttons out of 7 pages into one shared `common.js`.

**Architecture:** A classic (non-module) script `common.js`, loaded right after the Supabase library, declares the shared globals (`SB_URL`, `SB_KEY`, `_sb`, `_authSession`, `sbFetch`, `userDisplayName`) and a `startPage({ onSignedIn, onSignedOut })` setup call. Each page deletes its own copies, adds a `<span id="common-nav">` placeholder and calls `startPage` as the last line of its script. Styles for the shared box and buttons go in the already-shared `theme.css`.

**Tech Stack:** plain HTML/CSS/JS, supabase-js 2.117.1 (UMD from jsDelivr), GitHub Pages, no build step.

**Spec:** `docs/superpowers/specs/2026-11-03-common-js-foundation-design.md`

## Global Constraints

- No build step, no new dependencies, no ES modules (pages use inline `onclick` handlers).
- Files use CRLF line endings — keep them CRLF. Edit with the Edit tool, or Python scripts written with the Write tool that normalise CRLF before matching and restore it after (Bash heredocs collapse `\\`).
- Load as `<script src="common.js?v=1"></script>`; every later change to common.js bumps `v` on all 7 pages in the same commit.
- Code style rule (user): clear names, short comments saying what a block does and who uses it, `// ── NAME ──` section banners.
- Shared texts, exact: `🐔 Georgasopoulos`, `Σύνδεση`, `Είσοδος`, `Σύνδεση…`, `Λάθος email ή κωδικός.`, `Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.`, `⌂ Αρχική`, `← Έξοδος`, `Αποσύνδεση;`.
- Never test on live data: stub `sbFetch` / the Supabase client. Never handle real credentials.
- Never add anon/public RLS policies (none needed here — no database change).
- **Never commit or push without the user's explicit "commit and push now"** (or "commit"). Each task ends at a checkpoint: show results, wait.
- Commit attribution line: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run `/ponytail-review` before each commit (CLAUDE.md).

## Files

| File | Change |
|---|---|
| `common.js` | **Create** — CONNECTION, SESSION, sbFetch, SIGN-IN SCREEN, SHARED BUTTONS, startPage |
| `theme.css` | Modify — append the `common-` styles |
| `schedule_checker.html` | Modify — pilot page |
| `feed_tracker.html` | Modify |
| `vaccine_tracker.html` | Modify |
| `inventory.html` | Modify |
| `truck_calculator_kamposos.html`, `truck_calculator_doukakis.html` | Modify (also pin supabase-js to 2.117.1 like the others) |
| `index.html` | Modify — inline sign-in spot, no ⌂ |
| `CLAUDE.md` | Modify — document common.js, the `?v=N` rule, the code-style rule |
| scratchpad `common_test.html`, `page_check.js` | Create — checks, not committed |

Scratchpad = `C:\Users\georg\AppData\Local\Temp\claude\C--Users-georg-Claude-Code\471487d4-325a-4b0e-8654-01c5ce72ae3e\scratchpad` (below: `$SP`).

Servers for testing (start with `run_in_background`, stop at the end with Stop-Process on the port):
- repo: `cd C:\Users\georg\projects\work && python -m http.server 8765`
- checks: `cd $SP && python -m http.server 8766`

---

### Task 1: common.js + shared styles, checked on their own

**Files:**
- Create: `common.js`
- Modify: `theme.css` (append at end)
- Test: `$SP/common_test.html`

**Interfaces:**
- Produces (globals every page relies on): `SB_URL`, `SB_KEY`, `_sb`, `_authSession` (session or null), `userDisplayName(email) → string`, `sbFetch(path, opts) → Promise<json|null>` (throws `Error` with `.status` on refusal), `signIn()`, `signOut()`, `startPage({ onSignedIn(name), onSignedOut? })`.
- DOM ids used by common.js: `common-nav` (page provides), `common-signin` (homepage provides, optional), `common-email`, `common-password`, `common-signin-btn`, `common-signin-error`, `common-signout` (common.js creates).

- [ ] **Step 1: Write the check page (fails: common.js doesn't exist yet)**

`$SP/common_test.html` — a fake Supabase client lets the checks fire auth events by hand:

```html
<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="http://localhost:8765/theme.css">
<header><span id="common-nav"></span></header>
<script>
// fake supabase: records the auth callback so checks can send events; sign-in result is set per check
let authCallback = null, nextSignInError = null, signedOut = 0;
window.supabase = { createClient: () => ({ auth: {
  onAuthStateChange: cb => { authCallback = cb; },
  signInWithPassword: async () => ({ error: nextSignInError }),
  signOut: async () => { signedOut++; authCallback('SIGNED_OUT', null); },
} }) };
</script>
<script src="http://localhost:8765/common.js?v=test"></script>
<script>
const results = [];
const check = (name, ok) => results.push((ok ? 'PASS ' : 'FAIL ') + name);
const wait = ms => new Promise(r => setTimeout(r, ms));
const userA = { user: { id: 'a', email: 'panos@internal.local' }, access_token: 'tA' };
const userB = { user: { id: 'b', email: 'eleni@internal.local' }, access_token: 'tB' };
let loads = [], signedOutCalls = 0;

window.runChecks = async () => {
  startPage({ onSignedIn: name => loads.push(name), onSignedOut: () => signedOutCalls++ });
  const cover = document.querySelector('.common-signin-cover');
  const signout = document.getElementById('common-signout');

  check('cover shows before any session', cover && getComputedStyle(cover).display !== 'none');
  check('nav has home link', !!document.querySelector('#common-nav a[href="index.html"]'));

  authCallback('INITIAL_SESSION', null);
  check('no session: cover visible', getComputedStyle(cover).display !== 'none');
  check('no session: Έξοδος hidden', signout.style.display === 'none');
  check('no session: onSignedOut called', signedOutCalls === 1);

  authCallback('INITIAL_SESSION', userA);
  authCallback('SIGNED_IN', userA);            // supabase re-sends this right after, and on refocus
  check('same user twice: loaded once', loads.length === 1 && loads[0] === 'Πάνος');
  check('signed in: cover hidden', getComputedStyle(cover).display === 'none');
  check('signed in: Έξοδος visible', signout.style.display === '');

  authCallback('TOKEN_REFRESHED', { ...userA, access_token: 'tA2' });
  check('token renewal: session updated, no reload', _authSession.access_token === 'tA2' && loads.length === 1);

  window.confirm = () => false; signout.click(); await wait(0);
  check('Έξοδος + Cancel: still signed in', signedOut === 0);
  window.confirm = () => true; signout.click(); await wait(0);
  check('Έξοδος + OK: signed out, cover back', signedOut === 1 && getComputedStyle(cover).display !== 'none');

  authCallback('SIGNED_IN', userB);
  check('other user: loads again', loads.length === 2 && loads[1] === 'Ελένη');

  const err = document.getElementById('common-signin-error');
  nextSignInError = { status: 400 }; await signIn();
  check('wrong password message', err.textContent === 'Λάθος email ή κωδικός.');
  nextSignInError = { status: 0 }; await signIn();
  check('no connection message', err.textContent === 'Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.');

  const realFetch = window.fetch;
  window.fetch = async () => new Response(JSON.stringify({ message: 'refused' }), { status: 403 });
  try { await sbFetch('x'); check('refusal throws', false); }
  catch (e) { check('refusal carries message + status', e.message === 'refused' && e.status === 403); }
  window.fetch = async () => new Response('', { status: 204 });
  check('empty reply → null', (await sbFetch('x', { method: 'PATCH' })) === null);
  window.fetch = async (url, o) => new Response(JSON.stringify([{ ok: o.headers.Authorization }]), { status: 200 });
  check('sends the session token', (await sbFetch('x'))[0].ok === 'Bearer tB');
  window.fetch = realFetch;

  check('userDisplayName fallback', userDisplayName('nikos@x.gr') === 'nikos');
  return results;
};
</script>
```

- [ ] **Step 2: Run it to see it fail**

Start both servers. In the Browser pane: navigate `http://localhost:8766/common_test.html`, then javascript_tool `await runChecks()`.
Expected: error `startPage is not defined` (common.js 404).

- [ ] **Step 3: Write `common.js`**

```js
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
```

- [ ] **Step 4: Append the shared styles to `theme.css`**

```css

/* ── SHARED SIGN-IN + BUTTONS — drawn by common.js on every page ── */
.common-signin-cover{position:fixed;inset:0;z-index:9999;background:var(--gh-canvas-default);display:flex;align-items:center;justify-content:center}
.common-signin-box{background:var(--gh-canvas-subtle);border:1px solid var(--gh-border-default);border-radius:var(--gh-r-lg);padding:32px;width:360px;max-width:92vw;margin:0 auto;display:flex;flex-direction:column;gap:10px;text-align:center;font-family:'Inter',system-ui,sans-serif;box-sizing:border-box}
#common-signin{margin-bottom:44px}
.common-signin-box h2{font-size:20px;font-weight:700;color:var(--gh-fg-default);margin:0}
.common-signin-box p{font-size:13px;color:var(--gh-fg-muted);margin:0 0 10px}
.common-signin-box input{background:var(--gh-canvas-default);border:1px solid var(--gh-border-default);border-radius:6px;color:var(--gh-fg-default);font-family:inherit;font-size:14px;padding:8px 10px;outline:none;text-align:center}
.common-signin-box input:focus{border-color:var(--gh-accent-emphasis)}
.common-signin-box button{padding:8px 16px;background:var(--gh-accent-emphasis);color:#fff;border:none;border-radius:6px;font-family:inherit;font-weight:500;font-size:14px;cursor:pointer}
.common-signin-box button:disabled{opacity:0.6;cursor:default}
.common-signin-error{font-size:12px;color:var(--gh-danger-fg);min-height:18px}
.common-nav{display:inline-flex;align-items:center;gap:6px}
.common-nav-btn{display:inline-flex;align-items:center;height:28px;padding:0 10px;border:1px solid var(--gh-border-default);border-radius:var(--rs);background:var(--gh-canvas-subtle);color:var(--gh-fg-muted);font-family:'Inter',system-ui,sans-serif;font-size:12px;font-weight:500;text-decoration:none;cursor:pointer;white-space:nowrap}
.common-nav-btn:hover{background:var(--gh-hover-bg);color:var(--gh-fg-default)}
@media (max-width:600px){.common-nav-label{display:none}}   /* phones: Home shows only ⌂ */
```

- [ ] **Step 5: Run the checks — all pass**

Reload `http://localhost:8766/common_test.html`, javascript_tool `await runChecks()`.
Expected: 18 lines, all starting `PASS`. Then screenshot: the cover with the box is centred.

- [ ] **Step 6: Checkpoint** — report results; no commit yet (commits happen once pages use it, Task 6).

---

### Task 2: Pilot page — schedule_checker.html

**Files:**
- Modify: `schedule_checker.html` (head ~line 8, auth-gate markup ~201–217, header ~224–225, CSS line ~189, auth script ~316–350, sbFetch ~379–391, end of script)
- Test: `$SP/page_check.js`

**Interfaces:**
- Consumes: `startPage`, `sbFetch`, `_sb`, `_authSession` from Task 1.
- Page's loader stays `load()`.

- [ ] **Step 1: Write the per-page check (reused by Tasks 2–5)**

`$SP/page_check.js` — paste into javascript_tool on a page opened from `http://localhost:8765/<page>`:

```js
// Per-page check: fires fake auth events at the page's real common.js and reports what happened.
// Before running: set window.PAGE_LOADER to the page's onSignedIn target name, e.g. 'load'.
(async () => {
  const out = [];
  const check = (name, ok) => out.push((ok ? 'PASS ' : 'FAIL ') + name);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  window.sbFetch = async () => [];                              // never touch live data
  let loads = 0;
  const realLoader = window[window.PAGE_LOADER];
  window[window.PAGE_LOADER] = (...a) => { loads++; return realLoader(...a); };
  const cb = [..._sb.auth.stateChangeEmitters.values()].pop().callback;
  const user = { user: { id: 'u1', email: 'panos@internal.local' }, access_token: 't' };
  const cover = document.querySelector('.common-signin-cover') || document.getElementById('common-signin');
  cb('INITIAL_SESSION', null); await wait(50);
  check('signed out: sign-in box visible', getComputedStyle(cover).display !== 'none');
  cb('INITIAL_SESSION', user); cb('SIGNED_IN', user); await wait(400);
  check('signed in once: page loaded once', loads === 1);
  check('signed in: box hidden', getComputedStyle(cover).display === 'none');
  check('Έξοδος visible', document.getElementById('common-signout').style.display === '');
  check('no old auth-gate left', !document.getElementById('auth-gate'));
  check('no old btn-logout left', !document.getElementById('btn-logout'));
  return out;
})()
```

Note: `onSignedIn` closes over the page function by name only if the page passes `name => load()` (an arrow that looks the name up at call time) — Tasks 2–6 always pass arrows for this reason.

- [ ] **Step 2: Run it on the unchanged page — fails**

Open `http://localhost:8765/schedule_checker.html`, javascript_tool: `window.PAGE_LOADER='load'` then the page_check.js text.
Expected: throws / FAILs (no `.common-signin-cover`, old `auth-gate` present).

- [ ] **Step 3: Edit the page**

a) Head — after the supabase-js `<script>` line add:
```html
<script src="common.js?v=1"></script>
```
b) Delete the whole `<!-- AUTH GATE -->` block: from `<!-- AUTH GATE -->` through its closing `</div>` (the outer `<div id="auth-gate" …>` and everything inside, 16 lines).
c) Header — replace these two lines:
```html
    <a class="theme-toggle" href="index.html" style="text-decoration:none" title="Home">⌂<span class="home-txt"> Home</span></a>
    <button class="theme-toggle" id="btn-logout" onclick="signOut()" style="display:none" title="Sign out">← Sign out</button>
```
with:
```html
    <span id="common-nav"></span>
```
d) CSS — delete the now-unused line:
```css
@media (max-width:600px){.home-txt{display:none}}   /* phones: Home link shows only ⌂ */
```
e) Script — delete `const SB_URL …`, `const SB_KEY …` (keep `TABLE` and `RESOLVED_TABLE`), and the whole `// ── AUTH ──` block from `const _sb = …` through the end of the `_sb.auth.onAuthStateChange(…);` block (including `signIn`, `signOut`, `_loadedFor` and its comment).
f) Script — delete the page's `async function sbFetch(path, opts={}){ … }` (the 13 lines before `const sbSelect`).
g) Script — just before the closing `</script>` of the main script add:
```js
// shared sign-in, load-once guard and ⌂/Έξοδος buttons: common.js
startPage({ onSignedIn: () => load() });
```

- [ ] **Step 4: Run the check — passes; then the page's own behaviour**

Reload, run page_check.js with `PAGE_LOADER='load'`. Expected: 6 PASS.
Then with stubbed data: `window.sbFetch = async p => p.startsWith('placements') ? [{id:1,house:'Θ1',doc_date:'2026-09-01',breed:'LOHMANN BROWN',status:'hatched'}] : []`, call `load()`; confirm a card renders; navigate to `schedule_checker.html?card=1`, fire the fake sign-in again (`cb('INITIAL_SESSION', user)`) and confirm `#card-1` has `open` and `focus-glow`. Resize to mobile preset: ⌂ shows without the label; reset to desktop. Check the console: no errors.

- [ ] **Step 5: Checkpoint** — report; no commit.

---

### Task 3: feed_tracker.html

**Files:**
- Modify: `feed_tracker.html` (head line 8, auth-gate ~140–156, header ~188–189, CSS line ~134, script ~221–256, sbFetch ~326–345, end of script)

**Interfaces:** Consumes Task 1 globals; loader `loadFromSupabase()`; `persistRow` keeps using `e.status` (still set by the shared sbFetch).

- [ ] **Step 1: Run page_check.js on the unchanged page — fails** (`PAGE_LOADER='loadFromSupabase'`).

- [ ] **Step 2: Edit the page**

a) Head: add `<script src="common.js?v=1"></script>` after the supabase-js line.
b) Delete the `<!-- AUTH GATE -->` block (comment + `<div id="auth-gate" …>` … its closing `</div>`, 17 lines).
c) Header: replace
```html
    <a class="theme-toggle" href="index.html" style="text-decoration:none" title="Home">⌂<span class="home-txt"> Home</span></a>
    <button class="theme-toggle" id="btn-logout" onclick="signOut()" style="display:none" title="Sign out">← Sign out</button>
```
with `    <span id="common-nav"></span>`.
d) CSS: delete the `.home-txt` media line.
e) Script: delete `const SB_URL`, `const SB_KEY`, and the `// ── AUTH ──` block through the end of `_sb.auth.onAuthStateChange(…);`.
f) Script: delete the page's `async function sbFetch(path, options = {}) { … }`.
g) Script: replace the line
```js
// Data load triggered by onAuthStateChange after sign-in
```
with
```js
// shared sign-in, load-once guard and ⌂/Έξοδος buttons: common.js
startPage({ onSignedIn: () => loadFromSupabase() });
```
(keep the `visibilitychange` line after it — move the `startPage` call below it so it is the last line.)

- [ ] **Step 3: Run the check — passes; then the page's own behaviour**

page_check.js: 6 PASS. Then with stub rows (`[{id:1,row_index:0,house:'Θ1',breed:'LOHMANN BROWN',hatch:'2026-09-01',rearing_type:'Cage'}]`) open `feed_tracker.html?house=%CE%981`, fire the fake sign-in: Θ1 card has `focus-glow`. Refused save: `window.sbFetch = async () => { const e = new Error('no'); e.status = 403; throw e; }`, edit a cell → toast `Save refused by the database (403) — reloaded`. Console clean.

- [ ] **Step 4: Checkpoint** — report; no commit.

---

### Task 4: vaccine_tracker.html and inventory.html

**Files:**
- Modify: `vaccine_tracker.html` (head line 11; CSS `.name-gate…`/`.gate-error` lines ~424–433 and `.home-txt` line ~650; auth-gate ~656–669; header ~695–696; script ~1125–1195; last comment line before `</script>`)
- Modify: `inventory.html` (head line 11; CSS ~165–173 and ~205; auth-gate ~211–224; header ~299–300; script ~344–425; last comment line)

**Interfaces:** Consumes Task 1 globals. Both pages keep `initApp(name)`; `emailToDisplayName` is replaced by common.js's `userDisplayName` (the name arrives as `initApp`'s argument, so no other caller needs it — verify with Grep `emailToDisplayName` → 0 hits after the edit).

- [ ] **Step 1: Run page_check.js on both unchanged pages — fails** (`PAGE_LOADER='initApp'`).

- [ ] **Step 2: Edit vaccine_tracker.html**

a) Head: add `<script src="common.js?v=1"></script>` after the supabase-js line.
b) CSS: delete the `.name-gate{…}` rule (multi-line) through `.gate-error{…}`, and the `.home-txt` media line.
c) Delete the `<!-- AUTH GATE -->` block (comment + `<div id="auth-gate" …>` … closing `</div>`, 13 lines).
d) Header: replace
```html
    <a class="theme-toggle" href="index.html" style="text-decoration:none" title="Αρχική">⌂<span class="home-txt"> Αρχική</span></a>
    <button class="theme-toggle" id="btn-logout" onclick="confirmSignOut()" style="display:none" title="Αποσύνδεση">← Έξοδος</button>
```
with `    <span id="common-nav"></span>`.
e) Script: delete `const SB_URL`, `const SB_KEY` (keep `TABLE`, `HTABLE` and other constants), and from `// ── AUTH ──` / `const _sb = …` through the end of `_sb.auth.onAuthStateChange(…);` — this removes `_authSession`, `emailToDisplayName`, `signIn`, `signOut`, `confirmSignOut`, `_loadedFor`. Keep `function initApp(name) { … }`.
f) Script: delete `async function sbFetch(path, opts = {}) { … }` (keep `sbSelect`, `sbInsert`, `ROW_GONE`, etc.).
g) Script: replace the last line
```js
// Auth is handled by onAuthStateChange above; no manual session restore needed.
```
with
```js
// shared sign-in, load-once guard and ⌂/Έξοδος buttons: common.js
startPage({ onSignedIn: name => initApp(name) });
```

- [ ] **Step 3: Edit inventory.html** — same a)–g) with these exact differences:
 - CSS: `.name-gate{` … `.gate-error{…}` at ~165–173; `.home-txt` line ~205.
 - Header lines to replace:
```html
    <a class="theme-toggle" href="index.html" style="text-decoration:none" title="Αρχική">⌂<span class="home-txt"> Αρχική</span></a>
    <button class="theme-toggle" id="btn-logout" onclick="signOut()" style="display:none" title="Αποσύνδεση">← Έξοδος</button>
```
 - The `// ── SUPABASE ──` sbFetch sits before `sbSelect`; the AUTH block sits after `// ── STATE ──` — delete both; keep the `user-chip` markup and `initApp`.

- [ ] **Step 4: Run the checks — pass; then each page's own behaviour**

Both pages: page_check.js 6 PASS; `Grep emailToDisplayName` in the repo → 0 hits.
Vaccine tracker with stubs (rows + `emvolia_history` returning one change + `vaccines` list): normal open → changes popup opens; open `vaccine_tracker.html?house=%CE%981&hatch=2026-09-01&date=2026-11-05` → no popup, 📋 Αλλαγές button shown, row glows. Inventory: table renders with stub rows, `#user-name` shows `Πάνος`. Console clean.

- [ ] **Step 5: Checkpoint** — report; no commit.

---

### Task 5: the two truck pages

**Files:**
- Modify: `truck_calculator_kamposos.html`, `truck_calculator_doukakis.html` (head line 8; CSS `.name-gate…`/`.gate-error` ~67–76 and `.home-txt` ~329; auth-gate ~335–348; top-actions ~362–363; script ~379–450)

**Interfaces:** Consumes Task 1 globals. Loader is `loadState()`; `currentUser` stays a page variable, set in the onSignedIn arrow.

- [ ] **Step 1: Run page_check.js on both unchanged pages — fails** (`PAGE_LOADER='loadState'`).

- [ ] **Step 2: Edit each truck page**

a) Head: replace
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```
with (pinned like the other pages) 
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/dist/umd/supabase.min.js"></script>
<script src="common.js?v=1"></script>
```
b) CSS: delete the `.name-gate…` rules and `.gate-error{…}` (the lines starting `  .name-gate` / `  .gate-error`; if lines 73–74 between them style `.name-gate .btn-primary`, delete those too — grep `name-gate` → 0 hits after), and the `.home-txt` media line.
c) Delete the `<!-- AUTH GATE -->` block (comment + `<div id="auth-gate" class="modal-bg">` … closing `</div>`, 13 lines).
d) top-actions: replace
```html
      <a class="btn-tool" href="index.html" style="text-decoration:none" title="Αρχική">⌂<span class="home-txt"> Αρχική</span></a>
      <button class="btn-tool" id="btn-logout" onclick="signOut()" style="display:none">← Έξοδος</button>
```
with `      <span id="common-nav"></span>`.
e) Script: delete `const SB_URL`, `const SB_KEY` (keep `TABLE`), and the `// ── AUTH ──` block from `const _sb = …` through the end of `_sb.auth.onAuthStateChange(…);` **but keep** `let currentUser = '';` (move it under `TABLE`).
f) Script: delete `async function sbFetch(path, opts = {}) { … }` under `// ── SUPABASE ──`.
g) Script: before the closing `</script>` add
```js
// shared sign-in, load-once guard and ⌂/Έξοδος buttons: common.js
startPage({ onSignedIn: name => { currentUser = name; loadState(); } });
```

- [ ] **Step 3: Run the checks — pass; then each page's own behaviour**

page_check.js 6 PASS on both. With `sbFetch` stubbed to return `[]`, the truck layout renders (default state) and Print button opens without errors (stub `window.open` to return a fake window). Console clean.

- [ ] **Step 4: Checkpoint** — report; no commit.

---

### Task 6: index.html, final sweep, docs — then commit when the user says

**Files:**
- Modify: `index.html` (head line 9; CSS `.login` lines 65–70; header line 115; `<form class="login" …>` 126–132; script 159–186; sbFetch 189–195)
- Modify: `CLAUDE.md`

**Interfaces:** Consumes Task 1 globals. New page functions `showDashboard()` / `hideDashboard()`; `loadDashboard()` and its `visibilitychange` refresh stay.

- [ ] **Step 1: Run page_check.js on the unchanged homepage — fails** (`PAGE_LOADER='showDashboard'` — doesn't exist yet).

- [ ] **Step 2: Edit index.html**

a) Head: add `<script src="common.js?v=1"></script>` after the supabase-js line.
b) CSS: delete the six `.login…` lines (65–70).
c) Header: replace
```html
  <button class="hbtn" id="btn-logout" onclick="if(confirm('Αποσύνδεση;'))_sb.auth.signOut()" style="display:none" title="Αποσύνδεση">← Έξοδος</button>
```
with `  <span id="common-nav"></span>`.
d) Replace the whole `<form class="login" id="login" …>` … `</form>` (7 lines) with:
```html
  <!-- shared sign-in box, drawn here by common.js when nobody is signed in -->
  <div id="common-signin"></div>
```
e) Script: delete `const SB_URL`, `const SB_KEY`, the `// ── AUTH ──` block (`_sb`, `_authSession`, `signIn`, `_loadedFor` comment+var, the `onAuthStateChange` block), and `async function sbFetch(path) { … }`. Put in their place:
```js
// ── SIGN-IN ── shared sign-in, load-once guard and Έξοδος button: common.js
// signed in: show the house tiles and load them; signed out: hide them (common.js shows the box)
function showDashboard() { document.getElementById('dash').style.display = ''; loadDashboard(); }
function hideDashboard() { document.getElementById('dash').style.display = 'none'; }
```
f) Script: after the `visibilitychange` line (last line before `</script>`) add
```js
startPage({ onSignedIn: () => showDashboard(), onSignedOut: () => hideDashboard() });
```

- [ ] **Step 3: Run the check — passes; then the homepage's own behaviour**

page_check.js with `PAGE_LOADER='showDashboard'`: 6 PASS (`.common-signin-cover` absent, so the check uses `#common-signin`). Also: no `⌂` link in `#common-nav` (homepage); tiles render with stub data (`placements`, `emvolia`, `feed_hatches` → stub rows from the earlier dashboard tests); `visibilitychange` (dispatch `document.dispatchEvent(new Event('visibilitychange'))`) reloads tiles; signed-out state shows the inline box in place of the dashboard. Console clean.

- [ ] **Step 4: Final sweep**

Grep the repo `*.html` for each of: `async function sbFetch`, `function signIn`, `onAuthStateChange`, `auth-gate`, `btn-logout`, `emailToDisplayName`, `home-txt`, `const SB_URL`, `createClient`.
Expected: 0 hits each. Grep `common.js?v=1` → 7 hits.
Rerun `common_test.html` checks: 18 PASS.

- [ ] **Step 5: Update CLAUDE.md**

Add a section (place it near the existing notes on duplicated rules):
```markdown
## common.js — shared by all 7 pages
- Holds the Supabase connection (`SB_URL`, `SB_KEY`, `_sb`), `_authSession`, `sbFetch`,
  `userDisplayName`, the shared sign-in box and the ⌂ Αρχική · ← Έξοδος buttons.
- Each page loads `<script src="common.js?v=N"></script>` after supabase-js, has
  `<span id="common-nav"></span>` in its header, and calls `startPage({ onSignedIn, onSignedOut })`
  as the last line of its script. onSignedIn runs once per signed-in user (supabase re-sends
  SIGNED_IN on every tab refocus).
- **Bump `?v=N` on all 7 pages in the same commit whenever common.js changes** (GitHub Pages caches ~10 min).
- One bug there breaks every page: test every page after changing it.
- feed_notify.yml and backup.py (Python) can't use it — their copies of rules stay duplicated.
- Design: docs/superpowers/specs/2026-11-03-common-js-foundation-design.md

## Code style
Clear names, a short comment on what each block does and who uses it, `// ── NAME ──` banners,
so code is easy to find by search and reference.
```
Also update any existing CLAUDE.md lines that describe per-page sign-in/sbFetch copies or the load-once guard as living in each page.

- [ ] **Step 6: Ponytail review, then report and wait**

Run `/ponytail-review` on the diff, fix anything real, report results (checks, grep, screenshots) to the user and wait for "commit and push now". Then:

```bash
git add common.js theme.css index.html vaccine_tracker.html inventory.html feed_tracker.html schedule_checker.html truck_calculator_kamposos.html truck_calculator_doukakis.html CLAUDE.md docs/superpowers/plans/2026-11-03-common-js-foundation.md
git commit -m "Shared common.js: one sign-in, sbFetch, load-once guard and ⌂/Έξοδος for all pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 7: Stop both test servers** (Stop-Process on ports 8765 and 8766).
