# Barcode scanning for vaccine inventory (Απόθεμα)

Status: approved design, not yet implemented.

## Purpose

Απόθεμα (`inventory.html`) currently tracks vaccine stock (name + dose
quantity) with fully manual add/edit/delete. Every stock change today is
typed in by hand. This feature adds barcode/QR scanning at the two physical
moments stock actually changes — vaccines arriving, and vaccines being
pulled from the fridge to vaccinate — so those moments update Απόθεμα
directly instead of being re-entered later from memory.

**Scope boundary, explicit:** this feature touches Απόθεμα only. ΕΜΒΟΛΙΑ
(the vaccine order tracker) is not read from, written to, or linked in any
way by scanning. ΕΜΒΟΛΙΑ stays exclusively how staff place and track orders;
Απόθεμα stays exclusively how physical stock is tracked. An order row and a
scan event are never connected.

## What we confirmed about the physical barcodes

Photographed four current vaccine boxes. All four carry a **GS1 2D
DataMatrix code**. One box (Nobilis SG 9R) prints the raw GS1 Application
Identifier string next to it — `(01)08713184076144` — confirming the
DataMatrix encodes structured GS1 data, not just a bare product ID:

- `AI 01` — GTIN (product identifier)
- `AI 10` — lot/batch number (also printed human-readably as "Lot"/"Παρτίδα" on every box seen)
- `AI 17` — expiry date (also printed human-readably as "Exp"/"ΛΗΞΗ" on every box seen)

One box also carried a separate plain EAN-13 linear barcode (13411113047825)
on a different panel — this looks like a case/retail-level code, distinct
from the per-unit DataMatrix, and is not the primary scan target.

**Implication:** receiving can auto-fill GTIN, lot, and expiry straight from
the existing box code on day one. Self-printed QR labels are not required
for Phase 1 — they remain a fallback for the rare box with no code at all,
not the default path.

## Input method: kept open, not decided

The user has not decided between phone-camera scanning and a dedicated
USB/Bluetooth 2D barcode scanner. The design does not require deciding now:

- **Phone camera** (via `@zxing/browser`, see below) produces a decoded
  string in JS via a callback.
- **USB/Bluetooth scanner in "keyboard wedge" mode** produces the same
  decoded string by typing it into whatever input is focused, terminated by
  an Enter keystroke — no app-side driver integration needed.

Both paths are designed to feed the **same downstream function**:
`processScannedCode(rawString)`. `scan.html` has a hidden, always-focused
text input that keyboard-wedge input lands in automatically; the camera
path calls the same function directly from ZXing's decode callback. This
means the hardware decision can be made later, changed per-workstation, or
even used interchangeably, without touching the parsing/lookup/write logic
at all.

One wedge-scanner-specific detail to handle when that path is used: GS1
DataMatrix data contains an FNC1 separator between variable-length fields
(commonly transmitted as an ASCII GS character, though this is configurable
per scanner). The GS1 AI parser must tolerate this separator; if a specific
scanner's config strips or mangles it, that's a per-device configuration
fix, not a code change.

## Scanning library (camera path)

**`@zxing/browser`**, loaded via a CDN `<script>` tag — no build step, same
pattern as the Supabase client already used everywhere in this repo. Chosen
over the browser's native `BarcodeDetector` API because native DataMatrix
support is inconsistent on iOS Safari, and over `html5-qrcode` because its
DataMatrix support is unverified (it's primarily QR-focused).

**Not yet verified: real-world scan reliability.** Small module size, box
curvature, and fridge lighting are all real risks with a phone camera. This
should be spiked against actual boxes before the full page is built —
if ZXing can't read them reliably, that changes the recommendation and may
tip the decision toward the USB scanner sooner rather than later.

## Data model

### `scan_events` (new table)

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `vaccine_id` | FK → Απόθεμα item | required |
| `type` | `in` \| `out` | |
| `quantity` | integer | doses |
| `lot_number` | text, nullable | from GS1 AI 10, or manual entry |
| `expiry_date` | date, nullable | from GS1 AI 17, or manual entry |
| `flock_note` | text, nullable | free text, `out` scans only — NOT a link to any ΕΜΒΟΛΙΑ row, just a note for the scanning staff's own reference |
| `scanned_by` | text | derived from the signed-in user, same pattern as existing `*_history` tables |
| `scanned_at` | timestamptz | |

Same shape and purpose as the existing `emvolia_history` /
`inventory_history` audit-trail tables: append-only, never edited.

### `vaccine_barcode` (new table)

| column | type | notes |
|---|---|---|
| `barcode_value` | text, PK | the GTIN from AI 01 |
| `vaccine_id` | FK → Απόθεμα item | |

Resolves a scanned GTIN to a specific Απόθεμα row. First scan of an unknown
GTIN prompts a one-time tag (pick an existing vaccine, or create a new
Απόθεμα row); every later scan of that same GTIN — any lot, any expiry — is
recognized automatically.

### Απόθεμα quantity: additive, not a strict ledger

The existing quantity column on each vaccine keeps working exactly as it
does today — manual editing in the current modal is untouched. Scanning
adds a **delta**: an `in` scan increments quantity by the scanned amount, an
`out` scan decrements it, and each writes a `scan_events` row. Quantity is
not forced to equal `SUM(scan_events)` — that stricter model would require
migrating every existing row to an "opening balance" event and would
restrict manual editing, for a feature that hasn't been used in practice
yet. If drift between scanned and physical counts turns out to be a real
problem, the reconciliation report below is the place that would surface
it, and a move to a strict ledger could follow later as its own change.

## New page: `scan.html`

Mobile-first, separate from `inventory.html`. Reasoning: this is used
one-handed at a physical fridge, not at a desk — `inventory.html`'s dense
table layout wasn't designed for that, and keeping them separate means the
desktop review/edit experience isn't compromised to accommodate the phone
use case.

- Two large mode buttons: **Παραλαβή** (receiving) and **Ανάληψη**
  (dispensing) — selecting one sets scan type before a code is read.
- Large camera viewfinder (ZXing) plus the always-focused hidden input for
  wedge-scanner input, both feeding `processScannedCode()`.
- **Receiving flow:** scan → parse GS1 AIs → look up GTIN in
  `vaccine_barcode`. Known: confirm vaccine name + quantity, with lot/expiry
  pre-filled from the scan. Unknown: one-time vaccine-tagging prompt, then
  proceed. Submit → insert `scan_events` (`type=in`) → increment Απόθεμα
  quantity.
- **Dispensing flow:** scan → same GTIN lookup → confirm vaccine + quantity,
  optional free-text flock note. Submit → insert `scan_events` (`type=out`)
  → decrement Απόθεμα quantity.
- **Manual fallback:** if a scan fails to decode, or a box has no code at
  all, the same confirm form is reachable without a successful scan first —
  scanning is never a dead end.
- Shares `theme.css` and the existing Supabase auth pattern (same
  `sbFetch`-style calls, same sign-in gate) used by every other tool in this
  repo.

## Nice-to-have, not in this build: reconciliation report

Once `scan_events` exist, a report comparing "expected stock" (running sum
of `in` minus `out`) against a manual physical count would catch missed
scans, spoilage, or shortages early. Deferred — build it once there's
enough real scan history for it to be useful, and once it's clear whether
the additive-delta model above is holding up on its own.

## Explicitly out of scope

- Any link between `scan_events`/Απόθεμα and ΕΜΒΟΛΙΑ orders or customers.
- Auto-flipping any ΕΜΒΟΛΙΑ status flag from a scan.
- A strict ledger (quantity = `SUM(scan_events)`) and the data migration
  that would require.
- Choosing between phone-camera and USB/Bluetooth scanner hardware — both
  are supported by the design; the choice is deferred to the user.

## Testing

No framework in this repo, by design (see root `CLAUDE.md`). Verification
for this feature follows the existing convention: extract `scan.html`'s
inline `<script>` and run `node --check` against it after every edit, plus
a manual pass with real boxes and (once chosen) real scanning hardware
before it's trusted for daily use.
