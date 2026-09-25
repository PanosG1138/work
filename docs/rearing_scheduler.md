# Rearing scheduler

Source of truth for the rearing-house scheduler (`schedule_checker.html`).
Purpose: find the ideal hatch dates for future placements in each rearing house.

## Houses

| House | Rearing system | Can rear pullets for | Notes |
|---|---|---|---|
| Θ1 | Cage | Cage customers only | Linked pair with Θ2 |
| Θ2 | Cage | Cage customers only | Linked pair with Θ1 |
| Θ3 | Cage | Cage customers only | |
| Θ4 | Cage | Cage customers only | |
| Θ5 | Aviary | Aviary, barn, cage | Avoid cage pullets here whenever possible |
| Θ7 | Aviary | Aviary, barn | New house (planned): capacity 70.000, first hatch possible 25/08/2027 |

- "Cage / aviary / barn pullets" = the system of the customer's **production** house the pullets
  are sold into, not how they are reared.
- A1 is no longer used. It has no place in the scheduler's logic.
- Θ1 and Θ2 always hatch **7–12 days** apart from each other (either order).

## Cycle timings (day 0 = hatch date)

Loading and cleaning are **planning maximums** — in practice they can finish sooner, but the
scheduler always plans with these values.

| Event | Cage houses (Θ1–Θ4) | Aviary (Θ5, Θ7) |
|---|---|---|
| Vaccination 1 | day 60–66 (7 days) | same |
| Vaccination 2 | day 90–96 (7 days) | same |
| Loading | day 105–118 (14 days) | day 118–131 (14 days) |
| House empty | day 119 | day 132 |
| Cleaning | 25 days after empty | same |
| Ready for next hatch | day 144 | day 157 |

A house's next hatch should not be earlier than the previous cycle's "ready" date.

## Clashes between houses

Per hatch the scheduler looks at four events: chick placement, Vaccination 1, Vaccination 2 and
Loading (the 14 loading days in the table above; Θ5 and Θ7 follow the same rules as the cage
houses, with their own loading days).

- **Chick placement** = hatch **+2 days** for ISA, Hy-Line (Pluriton) and H&N, **+1 day** for
  Novogen. No breed chosen yet = either day. Two placements clash **only on the same day**.
- **Vaccination / loading**: vax–vax, vax–loading and loading–loading of two houses clash only
  when they **share at least one day** — no buffer before or after. Placements never clash with
  vaccinations or loading.
- **Θ1 and Θ2 never clash with each other** (they run as a pair); they clash with every other house.
- Events already over are ignored.

In the tool: a "⚠ N clashes" line on each affected card, a collapsible list of every clash above
the houses, and clash warnings in the add/edit form. An expanded card lists its clashes, each with
a ✓ (mark resolved). Clicking a clash there highlights the clashing rows on both cards (opening the
other card and scrolling to it); clicking it again clears the highlight.
- **Suggest move**: the smallest shift (up to ±120 days) of one of the two hatches that clears the
  clash and leaves fewer open clashes overall, without putting a hatch in the past, before its house
  exists, on a taken date, before its house is ready (or making the house's next hatch not ready),
  or breaking the Θ1/Θ2 7–12 day gap. Only "Not ordered" hatches that haven't hatched can move
  (kept ones included); a movable Θ1/Θ2 partner moves the same number of days. **Apply** saves it.
- **Mark resolved** hides a clash you accept (table `resolved_conflicts`, `conflict_key`).
  The key includes both events' dates, so the mark stops applying if either hatch moves.
  Resolved clashes stay listed under "Resolved", with **Unresolve**.

## What the tool does

- One column per house, one card per hatch; card rows line up across houses.
  Collapsed (default): house, breed, hatch, loading start (day 105 cage / day 118 aviary), ready.
  Click to expand: cycle #, rearing system, chick placement, vax 1, vax 2, loading, empty, status
  (Confirmed / Requested / Not ordered, or "In house · N d old"), warnings, Edit/Del.
- Outline colour: magenta = hatched (birds in house), green = future + confirmed,
  soft orange = Requested (day-old chicks asked for, not confirmed yet), white = Not ordered.
- Arrow between cards = days from the previous cycle's ready date to this hatch
  (green `+N d`, red `−N d · not ready`).
- Dashed "Earliest possible" card in each column = earliest possible placement: the last planned
  cycle's ready date, never before today. Planned = Confirmed, kept ("Keep this date"), or already
  hatched (birds in the house, whatever the status). Other Requested / Not ordered hatches are ignored.
  The card sits right after the last planned card; the other hatches follow it.
  Θ1/Θ2: if their latest planned hatches are ≤ 12 days apart they're a pair and the next two are
  suggested together 7–12 days apart. Otherwise the house with the later latest hatch is ahead: the
  other is placed within 7–12 days of that hatch where possible, the one ahead gets its own ready date.
  "Use this date" opens the add form prefilled.
- "Keep this date" (unconfirmed cards only; `placements.keep`): plan with that hatch as if it were
  confirmed — the dashed card moves after it — without changing its order status. A too-early
  arrow into a kept hatch turns amber ("−N d · kept early") instead of red. "Undo keep" reverts.
  Setting a hatch to Confirmed clears its keep flag.
- One placement per house + hatch date (unique constraint `placements_house_doc_date_key`); the
  add/edit form blocks Save and says so when the date is already taken.
- Warnings (never blocking): hatch before the house is ready; Θ1/Θ2 gap outside 7–12 days.
- Completed cycles (house already emptied) are always hidden; they're kept in the table and
  still count for the next cycle's arrow and suggestion.

Data: `placements` table (`id`, `house`, `doc_date` = hatch date, `breed`, `status`, `keep`); unique (`house`, `doc_date`).
Rearing system and all dates are derived from house + hatch date, never stored.

## Out of scope for now

- Assigning customers (cage/aviary/barn) to hatches.

## Open follow-ups

- Order book ΠΑΡΑΓΓΕΛΙΕΣ.xlsx: aviary house being renamed Θ6 → Θ5 by the user.
