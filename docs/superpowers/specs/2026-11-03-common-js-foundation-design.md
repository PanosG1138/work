# common.js foundation — design (project A)

Date: 2026-11-03 · Status: approved in chat, awaiting spec review

## Why

Sign-in, the Supabase connection and the header's Home / Sign-out buttons are copied into all 7
pages. Fixing the refocus-reload bug (commit 1b004c2) took 7 identical edits. One shared
`common.js`, loaded like `theme.css`, holds these once.

This is project A of four, each with its own design → plan → build:

| # | Project | Depends on |
|---|---|---|
| A | Shared foundation (this spec) | — |
| B | Language system ΕΛ/EN, per account, Greek default; then translate page by page | A |
| C | Move the `focusFromLink` highlight helper into common.js | A |
| D | Move the duplicated rules (vaccine names; feed phases/additives; scheduler loading rules), one at a time | A |

Out of scope for A: the language switch (B), the highlight helper (C), the rules (D).

## Pages

`index.html`, `vaccine_tracker.html`, `inventory.html`, `feed_tracker.html`,
`schedule_checker.html`, `truck_calculator_kamposos.html`, `truck_calculator_doukakis.html`.

## How pages plug in (approach 1 — one explicit setup call)

Each page loads, after the Supabase library:

```html
<script src="common.js?v=1"></script>
```

puts `<span id="common-nav"></span>` in its header where the Home / Sign-out buttons were, and calls:

```js
startPage({ onSignedIn: name => initApp(name) });          // tool pages
startPage({ onSignedIn: showDashboard, onSignedOut: hideDashboard });   // homepage: shows/hides #dash, loads tiles
```

Rejected: automatic hook-up by an agreed function name (invisible coupling); ES modules (would
hide functions from the pages' inline `onclick` handlers).

## common.js contents

Five labelled sections, each with a short comment saying what it does and which pages use it
(code-style rule: clear names, short comments, `// ── NAME ──` banners).

| Section | Contents | Replaces |
|---|---|---|
| CONNECTION | `SB_URL`, `SB_KEY` (publishable key), the one client `_sb` | 7 copies |
| SESSION | `_authSession`; `userDisplayName(email)` (panos@ → Πάνος, eleni@ → Ελένη, else the part before @) | 7 copies; `emailToDisplayName` in 4 |
| sbFetch | `sbFetch(path, opts)` — see below | 7 slightly different copies |
| SIGN-IN SCREEN | shared box: email, password, Είσοδος, error line | 7 copies of markup + `signIn()` |
| startPage | the setup call | new |

### sbFetch(path, opts)

- Sends `apikey`, `Authorization: Bearer <session token>`, `Content-Type: application/json`,
  `Prefer: opts.prefer || ''`, plus `opts.headers`; passes the rest of `opts` to `fetch`.
- Not ok → throws `Error(message)` where message = server JSON `message` || `hint` ||
  `HTTP <status>`, and sets `err.status = res.status` (the feed tracker uses it to tell a refusal
  from a lost connection).
- Ok → returns parsed JSON, or `null` when the body is empty.
- A lost connection still throws fetch's own error (no `.status`), as today.

### startPage({ onSignedIn, onSignedOut })

- Subscribes to `_sb.auth.onAuthStateChange`; updates `_authSession` on **every** event (so
  background token renewals keep saves working).
- Not signed in → shows the sign-in box. If the page has a `<div id="common-signin"></div>`
  (homepage), the box is drawn inside it, inline; otherwise common.js adds a full-page cover, as
  the tool pages have today.
- Signed in → hides the box; calls `onSignedIn(displayName)` **once per user id**. Repeat
  SIGNED_IN events (sent after INITIAL_SESSION and on every tab refocus) are ignored.
  Signing out and in as another user loads again.
- Signed out → calls `onSignedOut()` if the page passed it.
- Draws into `#common-nav`: `⌂ Αρχική` (link to index.html; label hidden ≤600px, icon only) and
  `← Έξοδος` (visible only while signed in; asks `Αποσύνδεση;` first). The homepage gets only
  Έξοδος.

### Sign-in screen

- Heading `🐔 Εργαλεία Πτηνοτροφείου`, subline `Σύνδεση` — same on every page.
- Enter in email → focus password; Enter in password → sign in.
- Errors: status 400 → `Λάθος email ή κωδικός.`; anything else → `Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.`
- Styled in `theme.css` (classes prefixed `common-`), together with the shared nav buttons.

## What each page changes

Deletes: `SB_URL`, `SB_KEY`, `_sb`, `_authSession`, `sbFetch`, `emailToDisplayName`, `signIn`,
`signOut` / `confirmSignOut`, its `#auth-gate` markup, its Home link and `#btn-logout`, its
`onAuthStateChange` block (including the 1b004c2 guard).

Adds: the script tag, `#common-nav`, one `startPage(...)` call.

Keeps untouched: its own header (title, zoom, counts, sync badge, Print, Sync, the
vaccine↔inventory and kamposos↔doukakis links) and all its data, tables and editing.

Visible differences: one shared sign-in look; shared nav buttons may differ slightly from a
page's own buttons; feed tracker and scheduler show `Αρχική` / `Έξοδος` in Greek until project B.

## Edge cases

| Situation | Behaviour |
|---|---|
| Background token renewal | `_authSession` updated, no reload |
| Window refocus | no reload (homepage still refreshes tiles via its own `visibilitychange`) |
| Sign out → sign in as another user | loads again for the new user |
| No connection at sign-in | `Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.` |
| Save refused | error with server message + `.status` |
| Empty reply | `null` |
| Stale cached common.js | load as `common.js?v=N`; every common.js change bumps N on all pages in the same commit |
| common.js fails to load | page shows nothing usable; no fallback (same server as the page and theme.css) |
| Unsaved feed edits at sign-out | unchanged: only the `Αποσύνδεση;` question |

## Testing

Local server (`python -m http.server 8765`), `sbFetch`/auth stubbed, never live data.

1. common.js alone: box shows/hides; both error messages; INITIAL_SESSION + SIGNED_IN same user →
   one load; other user → loads again; TOKEN_REFRESHED → `_authSession` updated, no load;
   Έξοδος asks, Cancel keeps session, OK signs out; sbFetch refusal carries message + status;
   empty reply → null.
2. Each of the 7 pages: no script errors; box shows, fake sign-in loads the page once; ⌂ and
   Έξοδος in the header, label hidden at phone width; the page's main thing works with stub data
   (vaccine: changes popup + link highlight; feed: card highlight + refused save; scheduler: card
   opens and glows; inventory: table renders; trucks: layout loads; homepage: tiles render and
   refresh on refocus).
3. Grep: no page still has its own `sbFetch`, `signIn`, `onAuthStateChange` or `auth-gate`.

The check script is kept in the scratchpad (not the repo) and rerun after projects B–D.

## Docs

CLAUDE.md: describe common.js, what's in it, the `?v=N` bump rule, and the code-style rule
(clear names + short comments).
