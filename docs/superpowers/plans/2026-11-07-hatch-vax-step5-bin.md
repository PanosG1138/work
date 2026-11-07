# Hatch εμβολιακά — Step 5: the bin (Κάδος) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every night the database moves the lines of hatches older than 18 weeks (126 days) to the bin and deletes lines that have been in the bin for 30 days (history kept). Binned lines disappear from every page and suggestion; the beta's Κάδος tab shows them, view-only.

**Architecture:** Column `emvolia.binned_at`; plpgsql `bin_old_hatches()` run nightly by pg_cron (02:15 UTC = 04:15 Greece). Every normal read adds `binned_at=is.null` (beta, normal tracker, homepage). The Κάδος tab reads `binned_at=not.is.null`. Deletions are written to `emvolia_history` exactly like a hand delete, by user "Αυτόματα (κάδος)"; the changes popups skip that user (no 30-line noise each night).

**Spec:** `docs/superpowers/specs/2026-11-06-hatch-programmes-and-bin-design.md` §5. User decisions: automatic only, no restore, view-only tab; the 4 hatches already older than 18 weeks (Θ1 26/03, Θ2 08/04, Θ4 01/06, Θ3 24/06 — 125 lines, all marked vaccinated) go to the bin on the first night and are deleted 30 days later with **no extra copy** (option B, 2026-11-07).

## Global Constraints

- 126 days = `VAX_BIN_DAYS` (common.js); 30 days in the bin.
- No restore, no hand binning; Κάδος tab view-only.
- History: one `deleted` entry per line with its last values (same shape as `logDeleted` / `buildChanges(r, emptied)`: `{field: {label, from, to: null}}` for every non-empty tracked field).
- The bin job is not callable by the pages (execute revoked from anon/authenticated).
- Stubbed data only for the pages; the database function is tested in a rolled-back transaction after asking the user.
- Every visible Greek text through `t()` with English. Code style as before. No commit/push without "commit and push now"; /ponytail-review first. Edits by a checking script.

---

### Task 1: Database (SQL for the user)

```sql
-- lines in the bin: binned_at set; deleted 30 days later
alter table emvolia add column binned_at timestamptz;

create extension if not exists pg_cron;

-- nightly: hatches older than 126 days → bin; 30 days in the bin → deleted (history like a hand delete)
create or replace function bin_old_hatches() returns void language plpgsql set search_path = public as $$
begin
  update emvolia set binned_at = now() where binned_at is null and hm_ekk <= current_date - 126;
  insert into emvolia_history (row_id, action, user_name, ts, changes_json)
  select e.id, 'deleted', 'Αυτόματα (κάδος)', now(),
    (select jsonb_object_agg(f.key, jsonb_build_object('label', f.label, 'from', f.val, 'to', null))
       from (values ('emvolio', 'Εμβόλιο', e.emvolio), ('hm_ekk', 'Ημ. Εκκόλαψης', e.hm_ekk::text),
                    ('hm_emv', 'Ημ. Εμβολιασμού', e.hm_emv::text), ('hm_par', 'Ημ. Καταχώρησης', e.hm_par::text),
                    ('anath', 'Αναθρεπτήριο', e.anath), ('pelatis', 'Πελάτης', e.pelatis), ('posotita', 'Ποσότητα', e.posotita),
                    ('paragelia', 'Παραγγελία', e.paragelia), ('psygeio', 'Ψυγείο', e.psygeio), ('emvoliasmos', 'Εμβολιασμός', e.emvoliasmos),
                    ('promitheutis', 'Προμηθευτής', e.promitheutis), ('sxolia_panos', 'Σχόλια Πάνος', e.sxolia_panos),
                    ('sxolia_eleni', 'Σχόλια Ελένη', e.sxolia_eleni), ('hm_paragelia', 'Ημ. Παραγγελίας', e.hm_paragelia::text)) f(key, label, val)
      where f.val is not null)::text
  from emvolia e where e.binned_at <= now() - interval '30 days';
  delete from emvolia where binned_at <= now() - interval '30 days';
end $$;
revoke execute on function bin_old_hatches() from public, anon, authenticated;

select cron.schedule('bin-old-hatches', '15 2 * * *', 'select bin_old_hatches()');
```

- [ ] Verify: column exists; `select jobname, schedule, active from cron.job` shows `bin-old-hatches`; nothing binned yet (`count(*) where binned_at is not null` = 0 until the first night).
- [ ] With the user's OK, a rolled-back test: one `do $$ … $$` that inserts a made-up hatch (Θ1, 2020-01-01, 2 lines), runs `bin_old_hatches()`, checks the 2 lines got `binned_at`, sets their `binned_at` to 31 days ago, runs it again, checks they're gone and 2 `deleted` history entries by "Αυτόματα (κάδος)" exist with the right fields, then `raise exception 'ROLLBACK OK: …'`; afterwards confirm no 2020 rows and no new history remain, and nothing real changed (`count(*) where binned_at is not null` = 0).

### Task 2: Checks — `<session scratchpad>/bin_checks.js`

```js
// Checks for the bin (Κάδος) — stubbed data only. Load into vaccine_tracker_beta.html, then `await runChecks()`.
(() => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  window.runChecks = async () => {
    const out = [], check = (n, ok) => out.push((ok ? 'PASS ' : 'FAIL ') + n), paths = [];
    const T = todayIso(), ago = n => new Date(Date.now() - n * 864e5).toISOString();
    const BIN = [
      { id: 1, anath: 'Θ1', hm_ekk: '2026-03-26', hm_emv: '2026-04-03', emvolio: 'SALMOVAC', posotita: '50000', pelatis: null, binned_at: ago(10) },
      { id: 2, anath: 'Θ1', hm_ekk: '2026-03-26', hm_emv: '2026-05-25', emvolio: 'SG-9R', posotita: '10000', pelatis: 'ΚΟΚΟΣ', binned_at: ago(10) },
      { id: 3, anath: 'Θ2', hm_ekk: '2026-04-08', hm_emv: '2026-04-16', emvolio: 'SALMOVAC', posotita: '40000', pelatis: null, binned_at: ago(29) },
    ];
    window.sbFetch = async (p, o = {}) => {
      paths.push((o.method || 'GET') + ' ' + p);
      if (o.method) return null;
      if (p.startsWith('emvolia_history')) return [
        { id: 9, row_id: 1, action: 'deleted', user_name: 'Αυτόματα (κάδος)', ts: ago(0), changes_json: '{"emvolio":{"label":"Εμβόλιο","from":"X","to":null}}' },
        { id: 8, row_id: 77, action: 'deleted', user_name: 'Ελένη', ts: ago(0), changes_json: '{"emvolio":{"label":"Εμβόλιο","from":"MG 6/85","to":null}}' }];
      if (p.includes('binned_at=not.is.null')) return JSON.parse(JSON.stringify(BIN));
      return [];
    };
    const cb = [..._sb.auth.stateChangeEmitters.values()].pop().callback;
    cb('INITIAL_SESSION', { user: { id: 'u1', email: 'panos@internal.local', user_metadata: { lang: LANG } }, access_token: 't' });
    await wait(1200);
    check('tracker reads only lines not in the bin', paths.some(p => p.startsWith('GET emvolia?binned_at=is.null')));
    check('changes popup skips the nightly bin', document.getElementById('changelog-list').textContent.includes('MG 6/85') && !document.getElementById('changelog-list').textContent.includes('X'));
    showTab('bin'); await wait(300);
    const panel = document.getElementById('tab-bin');
    check('bin: one entry per hatch', panel.querySelectorAll('.bin-hatch').length === 2);
    check('bin: lines + days left', panel.textContent.includes(t('{n} γραμμές', { n: 2 })) && panel.textContent.includes(t('διαγραφή σε {n} ημέρες', { n: 20 })) && panel.textContent.includes(t('διαγραφή σε {n} ημέρα', { n: 1 })) && panel.textContent.includes(t('{n} γραμμή', { n: 1 })));
    check('bin: lines listed inside', panel.querySelector('.bin-hatch details') && panel.textContent.includes('SG-9R'));
    check('bin: view only', !panel.querySelector('button'));
    check('no missing translations', LANG === 'el' || window.missingTranslations.size === 0);
    return out.join('\n') + (LANG === 'en' ? '\nmissing: ' + [...window.missingTranslations].join(' | ') : '');
  };
})();
```
Plus: normal tracker reads `emvolia?draft=is.false&binned_at=is.null…`; homepage's two emvolia reads carry `binned_at=is.null`. Earlier suites stay green: `vax3c_checks.js` (35), `vax_checks.js` (44), `tabs_checks.js` (12 — its bin-tab check still finds `#tab-bin`), `remind_checks.js` (14).

- [ ] Run on the beta: FAIL (no `binned_at` filter, "Σύντομα εδώ.").

### Task 3: Pages

- [ ] **Beta** `const sbSelect  = ()        => sbFetch(\`${TABLE}?order=hm_emv.asc\`);` → `sbFetch(\`${TABLE}?binned_at=is.null&order=hm_emv.asc\`);   // lines in the bin (Κάδος tab) are not loaded`.
- [ ] **Normal tracker** `?draft=is.false&order=` → `?draft=is.false&binned_at=is.null&order=`.
- [ ] **Homepage** both emvolia reads get `&binned_at=is.null`.
- [ ] **Both trackers' changes popup**: `.filter(h => h.action === 'deleted' || data.some(r => r.id === h.row_id))` → `.filter(h => h.user_name !== BIN_USER && (h.action === 'deleted' || data.some(r => r.id === h.row_id)))` with, in common.js VAX REMINDER block: `const BIN_USER = 'Αυτόματα (κάδος)';   // the nightly bin job's name in the history (bin_old_hatches)`.
- [ ] **Beta Κάδος tab** — panel `<div class="tab-panel" id="tab-bin" hidden><p data-t class="tab-soon">Σύντομα εδώ.</p></div>` → `<div class="tab-panel" id="tab-bin" hidden><div id="bin-list"></div></div>`; in `showTab` after the vax hook: `if (name === 'bin' && currentUser) openBin();`; `initApp` after the vax line: `if (!document.getElementById('tab-bin').hidden) openBin();`; script after the HATCH ΕΜΒΟΛΙΑΚΑ block:

```js
// ── BIN ── (Κάδος tab, view only) lines of hatches older than VAX_BIN_DAYS, moved here every night by the database
// (bin_old_hatches) and deleted 30 days later; history kept. No restore.
const BIN_KEEP_DAYS = 30;
async function openBin() {
  const box = document.getElementById('bin-list');
  let rows;
  try { rows = await sbFetch(`${TABLE}?binned_at=not.is.null&select=id,anath,hm_ekk,hm_emv,emvolio,posotita,pelatis,binned_at&order=hm_ekk.asc,hm_emv.asc`); }
  catch (e) { box.innerHTML = `<p class="tab-soon">${x(t('Σφάλμα φόρτωσης: {msg}', { msg: e.message }))}</p>`; return; }
  const hatches = new Map();
  rows.forEach(r => { const k = r.anath + '|' + r.hm_ekk; if (!hatches.has(k)) hatches.set(k, []); hatches.get(k).push(r); });
  box.innerHTML = `<p class="muted bin-note">${t('Εκκολάψεις άνω των 18 εβδομάδων. Διαγράφονται οριστικά 30 ημέρες μετά — μένει μόνο το ιστορικό.')}</p>` +
    ([...hatches.values()].map(lines => {
      const left = Math.max(0, BIN_KEEP_DAYS - Math.floor((Date.now() - Date.parse(lines[0].binned_at)) / 864e5));
      return `<div class="bin-hatch"><details><summary><b>${x(lines[0].anath)}</b> · ${t('Εκκόλαψη')} ${fmt(lines[0].hm_ekk)} · ` +
        `${t('{n} γραμμές', { n: lines.length })} · <span class="bin-left">${t('διαγραφή σε {n} ημέρες', { n: left })}</span></summary>` +
        `<table class="vax-table"><tbody>${lines.map(r => `<tr><td>${fmt(r.hm_emv)}</td><td>${x(vaccineLabel(r.emvolio))}</td><td>${fmtPosotita(r.posotita)}</td><td>${x(r.pelatis || '—')}</td></tr>`).join('')}</tbody></table></details></div>`;
    }).join('') || `<p class="tab-soon">${t('Ο κάδος είναι άδειος.')}</p>`);
}
```
CSS (Εμβολιακά block): `.bin-note{font-size:12px;margin:0 0 10px}` `.bin-hatch{background:var(--gh-canvas-subtle);border:1px solid var(--gh-border-default);border-radius:var(--gh-r-md);padding:8px 12px;margin-bottom:8px;max-width:820px}` `.bin-hatch summary{cursor:pointer;font-size:13px}` `.bin-left{color:var(--gh-attention-fg)}` `#tab-bin{overflow:auto}`.
Translations: `'{n} γραμμές': '{n} lines'`, `'διαγραφή σε {n} ημέρες': 'deleted in {n} days'`, `'Ο κάδος είναι άδειος.': 'The bin is empty.'`, `'Εκκολάψεις άνω των 18 εβδομάδων. Διαγράφονται οριστικά 30 ημέρες μετά — μένει μόνο το ιστορικό.': 'Hatches older than 18 weeks. Deleted for good 30 days later — only the history stays.'`; remove `'Σύντομα εδώ.'` only if Παραγγελίες no longer uses it (it still does — keep).
- [ ] **backup.py**: DATA_COLUMNS `"emvoliasmos",` → `"emvoliasmos", "binned_at",`; DATA_HEADERS `"ΕΜΒΟΛΙΑΣΜΟΣ",` → `"ΕΜΒΟΛΙΑΣΜΟΣ", "ΚΑΔΟΣ",`; py_compile.
- [ ] common.js changed → `?v=16` → `?v=17` on all 9 pages. CLAUDE.md: bin (column, nightly job, Κάδος tab, filters, BIN_USER).

### Task 4: SQL, verify, commit

- [ ] Run all checks EL + EN; screenshot the Κάδος tab (stubbed).
- [ ] The page code must go live **before** the user runs the SQL? No — the filters `binned_at=is.null` fail until the column exists. Order: user runs the SQL first, then "commit and push" right away (between the two only the nightly job exists; it first runs at 02:15 UTC). Give the SQL with that note; verify; ask, then the rolled-back function test.
- [ ] /ponytail-review; on "commit and push now": all 9 pages, common.js, backup.py, CLAUDE.md, this plan; message `Vaccine tracker: the bin — hatches older than 18 weeks binned nightly, deleted 30 days later` + Co-Authored-By; push; confirm Pages serves `bin-list`.
