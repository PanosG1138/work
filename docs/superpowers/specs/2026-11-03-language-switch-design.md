# Language switch ΕΛ/EN — design (project B)

Date: 2026-11-03 · Status: approved in chat, awaiting spec review
Builds on: project A, `docs/superpowers/specs/2026-11-03-common-js-foundation-design.md`

## Decisions (user)

- Greek and English only. Greek is the default.
- The choice is saved **per account**, and follows the login to any device.
- Covers screens, **printouts** and **pop-up questions / messages**. Not the reminder emails.
- Values stored in Greek (ΝΑΙ/ΟΧΙ, `Αυτόματα`) are translated **on screen only**; the database
  and backups stay as they are. People names (Πάνος/Ελένη) are not translated.
- Pressing ΕΛ/EN **saves and reloads** the page in the other language (no in-place swap).
- Saved on the Supabase account's own user data (approach 1), not a new table.
- The Greek text is its own translation key (approach A).

## Language state — in common.js

- `LANG` = `'el'` | `'en'`. On page load: the device copy (`localStorage` key `lang`) or `'el'`.
  `document.documentElement.lang = LANG`.
- Saved on the account as `user_metadata.lang` via `_sb.auth.updateUser({ data: { lang } })`.
  No table, no RLS change.
- After sign-in, before `onSignedIn` runs: if `session.user.user_metadata.lang` is set and differs
  from `LANG`, write it to the device and reload once. If the account has none, nothing happens
  (Greek, or whatever the device has).
- `localStorage` reads/writes are wrapped in try/catch; if storage is blocked, `LANG` is `'el'`
  until the account's choice is applied (which then reloads every time — acceptable, rare).

## The switch

- In the shared buttons: `⌂ Αρχική · ΕΛ/EN · ← Έξοδος` (homepage: `ΕΛ/EN · ← Έξοδος`). The current
  language is highlighted; only the other one is clickable.
- Click:
  1. If the page passed `hasUnsavedWork` to `startPage` and it returns true →
     `confirm(t('Έχετε αλλαγές που δεν αποθηκεύτηκαν. Συνέχεια;'))`; Cancel → stop.
  2. `await _sb.auth.updateUser({ data: { lang: other } })`. Error →
     `alert(t('Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.'))` and stop, so device and account never disagree.
  3. Device copy = other; `location.reload()`.
- Before sign-in the switch is hidden (the sign-in box uses the device language).
- `startPage({ onSignedIn, onSignedOut, hasUnsavedWork })` — `hasUnsavedWork` optional.
  Feed tracker passes `() => unsaved.size > 0`. Other pages pass it where they hold unsaved
  edits (open edit window / wizard with changes) — decided per page in its plan task.

## Translating

- `t(greek, values)` → in `'el'` returns `greek`; in `'en'` returns the English from the lists,
  or `greek` unchanged if missing. `{name}` placeholders are filled from `values` in both
  languages: `t('εκκόλαψη σε {n} ημέρες', { n: 24 })` → `hatch in 24 days`.
- Missing English (in `'en'` only) is recorded once per text in `window.missingTranslations`
  (a Set). Used by the checks; never shown to users.
- Fixed page texts are tagged: `data-t` (the element's own text is the key),
  `data-t-title`, `data-t-placeholder` (the attribute's Greek is the key). `startPage` translates
  all tagged elements before calling `onSignedIn`, and the shared sign-in box / buttons are
  drawn already translated. Elements mixing an icon and text tag only the text span.
- Lists: `addTranslations({ 'Ελληνικά': 'English', … })`. common.js holds the shared list
  (sign-in box, shared buttons, ΝΑΙ/ΟΧΙ, weekdays and months, `Αυτόματα`, the shared messages
  above). Each page adds its own list in a `// ── TRANSLATIONS ──` block at the top of its
  script, before it calls `startPage`.
- Stored Greek values go through the same `t()` when displayed (`t(row.paragelia)`).

## Pages, in order — one commit each

| # | Page | Notes |
|---|---|---|
| 1 | index.html | tiles, pills, plural/day texts, tool cards |
| 2 | vaccine_tracker.html | table, wizard, edit window, history, changes popup, «Μήπως εννοείτε;», batch edit, prints |
| 3 | inventory.html | table, edit window, history |
| 4 | feed_tracker.html | **rewritten in Greek first** — today's English becomes its English list |
| 5 | schedule_checker.html | **rewritten in Greek first**, same way |
| 6 | truck_calculator_kamposos.html, truck_calculator_doukakis.html | layout labels, printed load sheet |

For pages 4–5: a table of every text (current English → Greek draft) goes to the user first; farm
terms the draft is unsure of are marked, never guessed. Built only after the user corrects it.

Never translated, in either language: vaccine names, breeds, houses (Θ1…), feed phase names
(Starter, Grower…), additive names, people names, anything the user typed, database error
messages. Dates keep dd/mm/yyyy; only weekday and month names translate. The vaccine tracker's
month search keeps working with both Greek and English month names (it already does).

## Edge cases

| Situation | Behaviour |
|---|---|
| No internet when switching | `Δεν υπάρχει σύνδεση — δοκιμάστε ξανά.`; no switch |
| Unsaved work when switching | asks first; Cancel keeps everything |
| First visit on a new device | sign-in box in Greek; after sign-in, account's language applied with one reload before any data loads |
| Two devices, switch on one | the other changes only when reloaded |
| Text with no English | stays Greek; recorded in `missingTranslations` |
| Greek wording changed later | its English must be updated too (CLAUDE.md rule); the check flags it |
| History rows | field labels follow the reader's language; stored values as stored, except ΝΑΙ/ΟΧΙ and `Αυτόματα` |
| Printouts | in the language of whoever presses Print |
| Caching | first commit bumps to `common.js?v=2` / `theme.css?v=2` on all 7 pages; bump again on every later change |

## Testing

Local servers, stubbed data, never live data.

1. `common_test.html` new checks: `t()` in both languages, `{n}` filling, missing text stays
   Greek and is recorded; `data-t` / `data-t-title` / `data-t-placeholder` translated; switch
   saves to account → device → reloads (stub `updateUser`, `location.reload`); no internet →
   message, no switch; unsaved work → asks, Cancel stays; account language ≠ device → one
   reload before `onSignedIn`; same → no reload. Project A's 18 checks still pass.
2. Each page before its commit, in both languages: open every part (tables, cards, each
   form/window, wizard steps, history, changes popup, «Μήπως εννοείτε;», batch edit, print),
   trigger every `confirm()` and toast; in English `missingTranslations` must be empty; in Greek
   the visible text must match today's (except pages 4–5); EL and EN screenshots; project A's page
   check still passes; dashboard-link highlights still work.
3. After the last page: grep for `confirm(`, `alert(`, `toast(`/`showToast(` calls with a literal
   text not passed through `t()`; rerun everything on all 7 pages in both languages.

Before each page's commit the user gets: its translation table (pages 4–5: the Greek draft first),
EL/EN screenshots, check results. Commit only on the user's "commit and push now".

## Docs

CLAUDE.md: the language system, `t()` / `data-t`, the per-page `TRANSLATIONS` block, and the rule
"changing a Greek text means updating its English line".
