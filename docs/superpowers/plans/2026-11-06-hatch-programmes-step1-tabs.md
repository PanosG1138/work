# Hatch programmes — Step 1: Tracker tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the crowded tracker header with a tab row (Εμβόλια · Προγράμματα εκκολάψεων · Παραγγελίες · Κάδος, plus Απόθεμα / Πρόγραμμα links) in `vaccine_tracker_beta.html`.

**Architecture:** A `<nav class="tabs">` at the top of `<main>`; the existing main contents are wrapped in one panel, three new panels hold the other tabs (two are "coming soon" until later steps). `showTab(name)` toggles panels, hides the entry sidebar off the Εμβόλια tab, and keeps the tab in the URL hash. No database change.

**Tech Stack:** plain HTML/CSS/JS, common.js v=14 (`t`, `addTranslations`), Supabase via `sbFetch` (untouched here).

**Spec:** `docs/superpowers/specs/2026-11-06-hatch-programmes-and-bin-design.md` (section 1).

## Global Constraints

- Beta only: `vaccine_tracker.html` is not changed in this step.
- Every visible Greek text goes through `data-t` / `t()` with an English entry in the page's `addTranslations`; "no missing translations" must hold in EN.
- Code style: clear names, short comments, `// ── NAME ──` banners.
- Test on stubbed data only, never live. Never commit or push without the user's "commit and push now".
- Edits are applied by a script that normalises CRLF, asserts each replacement matches exactly once, and writes only at the end.

---

### Task 1: Tab row, panels and `showTab`

**Files:**
- Modify: `vaccine_tracker_beta.html` (header links, CSS, `<main>` markup, sidebar button, script, translations)
- Test: `<session scratchpad>/tabs_checks.js` (served on http://localhost:8766)

**Interfaces:**
- Produces: `showTab(name)` with `name` in `TABS = ['vaccines', 'programmes', 'orders', 'bin']`; panels `#tab-vaccines`, `#tab-programmes`, `#tab-orders`, `#tab-bin`; tab buttons `.tabs .tab[data-tab]`. Steps 3 and 5 fill `#tab-programmes` and `#tab-bin`; old step 3 fills `#tab-orders`.
- Consumes: `openPlan()` (existing, step 2 of vaccine planning).

- [ ] **Step 1: Write the failing checks** — `tabs_checks.js` in the session scratchpad:

```js
// Checks for the beta's tab row — stubbed data only. Load into vaccine_tracker_beta.html, then `await runChecks()`.
(() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  window.runChecks = async () => {
    const out = [], check = (n, ok) => out.push((ok ? 'PASS ' : 'FAIL ') + n);
    window.sbFetch = async p => [];   // empty tracker
    const cb = [..._sb.auth.stateChangeEmitters.values()].pop().callback;
    cb('INITIAL_SESSION', { user: { id: 'u1', email: 'panos@internal.local', user_metadata: { lang: LANG } }, access_token: 't' });
    await wait(800);

    const header = document.querySelector('header');
    check('header has no Απόθεμα / Πρόγραμμα links', !header.querySelector('a[href="inventory.html"], a[href="vaccine_programme.html"]'));
    check('4 tabs', document.querySelectorAll('.tabs .tab[data-tab]').length === 4);
    check('links in the tab row', !!document.querySelector('.tabs a[href="inventory.html"]') && !!document.querySelector('.tabs a[href="vaccine_programme.html"]'));
    check('sidebar plan button gone', ![...document.querySelectorAll('.sidebar button')].some(b => (b.getAttribute('onclick') || '') === 'openPlan()'));

    showTab('bin');
    check('bin panel shown, vaccines hidden', !document.getElementById('tab-bin').hidden && document.getElementById('tab-vaccines').hidden);
    check('bin tab marked', document.querySelector('.tabs .tab[data-tab="bin"]').classList.contains('on'));
    check('sidebar hidden off Εμβόλια', document.querySelector('.shell').classList.contains('tab-other'));
    check('hash kept', location.hash === '#bin');

    showTab('programmes');
    check('programmes panel has the plan button', !!document.querySelector('#tab-programmes button[onclick="openPlan()"]'));
    showTab('nonsense');
    check('unknown tab → Εμβόλια', !document.getElementById('tab-vaccines').hidden && !document.querySelector('.shell').classList.contains('tab-other'));
    check('Εμβόλια clears the hash', location.hash === '');

    check('no missing translations', LANG === 'el' || window.missingTranslations.size === 0);
    return out.join('\n') + (LANG === 'en' ? '\nmissing: ' + [...window.missingTranslations].join(' | ') : '');
  };
})();
```

- [ ] **Step 2: Run them to see them fail** — serve the scratchpad on 8766 (`python -m http.server 8766`, background), open `http://localhost:8765/vaccine_tracker_beta.html?r=1` in the preview (launch config "work-repo"), inject the script with a `<script src="http://localhost:8766/tabs_checks.js?…">` tag, `await runChecks()`. Expected: `FAIL header has no …` and `ReferenceError: showTab is not defined`.

- [ ] **Step 3: Implement** — an edit script in the scratchpad applying these replacements to `vaccine_tracker_beta.html`:

(a) Header: delete the two links

```html
    <a data-t href="inventory.html" class="btn-tool" data-t-title title="Απόθεμα εμβολίων">📦 Απόθεμα</a>
    <a data-t href="vaccine_programme.html" class="btn-tool" data-t-title title="Πρόγραμμα εμβολίων και συνήθη ενέσιμα πελατών">🗓 Πρόγραμμα</a>
```

(b) Sidebar: delete

```html
    <button data-t class="btn-wizard-entry" onclick="openPlan()">🗓 Νέα εκκόλαψη από πρόγραμμα</button>
```

(c) CSS, inserted before `/* ── HEADER ── */`:

```css
/* ── TABS ── (showTab) the entry sidebar belongs to Εμβόλια only */
.shell.tab-other{--sidebar-w:0px}
.shell.tab-other .sidebar-toggle{visibility:hidden}
.tabs{display:flex;align-items:center;gap:2px;border-bottom:1px solid var(--gh-border-default);overflow-x:auto;flex-shrink:0}
.tabs .tab{padding:7px 12px;border:none;border-bottom:2px solid transparent;background:none;color:var(--gh-fg-muted);font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;white-space:nowrap}
.tabs .tab:hover{color:var(--gh-fg-default)}
.tabs .tab.on{color:var(--gh-fg-default);border-bottom-color:var(--gh-accent-fg)}
.tab-panel{display:flex;flex-direction:column;gap:10px;flex:1;min-height:0}
.tab-panel[hidden]{display:none}
.tab-soon{color:var(--gh-fg-muted);font-size:13px;padding:24px 0}
```

(d) `<main class="main">` → open the tab row and the Εμβόλια panel:

```html
<main class="main">
  <nav class="tabs">
    <button data-t class="tab on" data-tab="vaccines" onclick="showTab('vaccines')">Εμβόλια</button>
    <button data-t class="tab" data-tab="programmes" onclick="showTab('programmes')">Προγράμματα εκκολάψεων</button>
    <button data-t class="tab" data-tab="orders" onclick="showTab('orders')">Παραγγελίες</button>
    <button data-t class="tab" data-tab="bin" onclick="showTab('bin')">Κάδος</button>
    <span class="tb-spacer"></span>
    <a data-t class="tab" href="inventory.html" data-t-title title="Απόθεμα εμβολίων">📦 Απόθεμα</a>
    <a data-t class="tab" href="vaccine_programme.html" data-t-title title="Πρόγραμμα εμβολίων και συνήθη ενέσιμα πελατών">🗓 Πρόγραμμα</a>
  </nav>
  <div class="tab-panel" id="tab-vaccines">
```

(e) `  <div class="house-view" id="house-view" style="display:none"></div>\n</main>` → close the panel and add the other three:

```html
  <div class="house-view" id="house-view" style="display:none"></div>
  </div>
  <!-- filled by later steps: drafts per hatch (programmes), orders, bin -->
  <div class="tab-panel" id="tab-programmes" hidden>
    <div><button data-t class="btn-wizard-entry" style="width:auto;padding:0 16px" onclick="openPlan()">🗓 Νέα εκκόλαψη από πρόγραμμα</button></div>
  </div>
  <div class="tab-panel" id="tab-orders" hidden><p data-t class="tab-soon">Σύντομα εδώ.</p></div>
  <div class="tab-panel" id="tab-bin" hidden><p data-t class="tab-soon">Σύντομα εδώ.</p></div>
</main>
```

(f) Script, inserted before `// ── INIT ──`:

```js
// ── TABS ── one panel per tab; the tab is kept in the URL hash (#bin) so links and reloads return to it
const TABS = ['vaccines', 'programmes', 'orders', 'bin'];
function showTab(name) {
  if (!TABS.includes(name)) name = 'vaccines';
  TABS.forEach(tab => { document.getElementById('tab-' + tab).hidden = tab !== name; });
  document.querySelectorAll('.tabs .tab[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelector('.shell').classList.toggle('tab-other', name !== 'vaccines');
  history.replaceState(null, '', location.pathname + location.search + (name === 'vaccines' ? '' : '#' + name));
}
showTab(location.hash.slice(1));
```

(g) Translations — add to the beta's `addTranslations({`:

```js
  'Προγράμματα εκκολάψεων': 'Hatch programmes', 'Παραγγελίες': 'Orders', 'Κάδος': 'Bin', 'Σύντομα εδώ.': 'Coming soon.',
```

(`Εμβόλια`, `Παραγγελίες`, `📦 Απόθεμα`, `🗓 Πρόγραμμα`, both titles and `🗓 Νέα εκκόλαψη από πρόγραμμα` already exist — the EN check proves it; add any it reports missing.)

- [ ] **Step 4: Run the checks** — reload with `?r=2`, inject, `await runChecks()`. Expected: all PASS. Then `localStorage.setItem('lang','en')`, reload, run again: all PASS, `missing:` empty. Reset to `el`.

- [ ] **Step 5: Regression** — run the existing step-2 checks (`plan_checks.js`, 31) on the beta in EL and EN: all PASS (they call `openPlan()` directly). Open `vaccine_tracker_beta.html#bin` fresh: Κάδος is shown on load. Screenshot desktop and 375 px width (tabs scroll sideways, no page overflow). Confirm `vaccine_tracker.html` is unchanged (`git diff --stat` lists only the beta).

- [ ] **Step 6: Ponytail review** — run /ponytail-review on the diff; apply what holds.

- [ ] **Step 7: Stop for the user** — report, wait for "commit and push now". Then:

```bash
git add vaccine_tracker_beta.html docs/superpowers/specs/2026-11-06-hatch-programmes-and-bin-design.md docs/superpowers/plans/2026-11-06-hatch-programmes-step1-tabs.md
git commit -m "Vaccine tracker beta: tab row (Εμβόλια · Προγράμματα · Παραγγελίες · Κάδος)"
```

(commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, wait for Pages to serve `https://panosg1138.github.io/work/vaccine_tracker_beta.html` with `class="tabs"`.
