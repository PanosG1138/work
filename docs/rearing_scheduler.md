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

- "Cage / aviary / barn pullets" = the system of the customer's **production** house the pullets
  are sold into, not how they are reared.
- A1 is no longer used. It has no place in the scheduler's logic.
- Θ1 and Θ2 always hatch **7–12 days** apart from each other (either order).

## Cycle timings (day 0 = hatch date)

Loading and cleaning are **planning maximums** — in practice they can finish sooner, but the
scheduler always plans with these values.

| Event | Cage houses (Θ1–Θ4) | Aviary (Θ5) |
|---|---|---|
| Vaccination 1 | day 60–66 (7 days) | same |
| Vaccination 2 | day 90–96 (7 days) | same |
| Loading | day 105 → 119 (14 days) | day 118 → 132 (14 days) |
| House empty | day 119 | day 132 |
| Cleaning | 25 days after empty | same |
| Ready for next hatch | day 144 | day 157 |

A house's next hatch should not be earlier than the previous cycle's "ready" date.

## What the tool does

- One column per house, one card per hatch; card rows line up across houses.
  Collapsed (default): house, breed, hatch, loading start (day 105 cage / day 118 aviary), ready.
  Click to expand: cycle #, rearing system, vax 1, vax 2, loading, empty, status
  (Confirmed / Requested / Not ordered, or "In house · N d old"), warnings, Edit/Del.
- Outline colour: magenta = hatched (birds in house), green = future + confirmed,
  soft orange = Requested (day-old chicks asked for, not confirmed yet), white = Not ordered.
- Arrow between cards = days from the previous cycle's ready date to this hatch
  (green `+N d`, red `−N d · not ready`).
- Dashed "Earliest possible" card in each column = earliest possible placement counting
  only Confirmed hatches plus kept ones (other Requested / Not ordered ignored): the last such cycle's ready date,
  never before today. It sits right after the last confirmed card; unconfirmed hatches follow it.
  Θ1/Θ2 stay 7–12 days apart: if one has an extra confirmed cycle, the other is placed within
  7–12 days of that hatch, and the one ahead gets its own ready date.
  "Use this date" opens the add form prefilled.
- "Keep this date" (unconfirmed cards only; `placements.keep`): plan with that hatch as if it were
  confirmed — the dashed card moves after it — without changing its order status. A too-early
  arrow into a kept hatch turns amber ("−N d · kept early") instead of red. "Undo keep" reverts.
- Warnings (never blocking): hatch before the house is ready; Θ1/Θ2 gap outside 7–12 days.
- Completed cycles (house already emptied) are always hidden; they're kept in the table and
  still count for the next cycle's arrow and suggestion.

Data: `placements` table (`id`, `house`, `doc_date` = hatch date, `breed`, `status`, `keep`).
Rearing system and all dates are derived from house + hatch date, never stored.

## Out of scope for now

- Cross-house conflict detection (vaccination/loading clashes between houses) and the old
  resolver. Parked by the user, 2026-09-23. The `resolved_conflicts` table is no longer read or
  written by the app; `backup.py` still backs it up until the table is dropped.
- Assigning customers (cage/aviary/barn) to hatches.

## Open follow-ups

- Order book ΠΑΡΑΓΓΕΛΙΕΣ.xlsx: aviary house being renamed Θ6 → Θ5 by the user.
