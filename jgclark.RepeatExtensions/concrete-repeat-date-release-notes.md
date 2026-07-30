# Release Notes — Concrete Base Date for `@repeat`

## Summary

Adds an optional concrete base date to `@repeat` tags, using the syntax `@repeat(interval, <date>)`. When present, the next repeat is calculated from that fixed date rather than from the task's scheduled date or completion date. After each completion or cancellation the embedded date is automatically advanced by the same interval, so the anchor rolls forward correctly for future cycles.

---

## New syntax

```
@repeat(1m, 2026-05-12)
@repeat(1w, 2026-W20)
@repeat(1m, 2026-06)
@repeat(1q, 2026-Q3)
@repeat(1y, 2027)
```

- **`interval`** — any existing interval format (e.g. `1d`, `2w`, `3m`, `1y`).
- **`<date>`** — the repeat anchor, given in any NotePlan calendar-note date-spec:
  - day: `YYYY-MM-DD`
  - week: `YYYY-Wnn`
  - month: `YYYY-MM`
  - quarter: `YYYY-Qn`
  - year: `YYYY`

  Must be a valid date for its spec (e.g. `2026-W53` is only valid in a 53-week year).

---

## Precedence rules

- `@repeat(1m, 2026-05-12)` — next repeat is calculated from the concrete date, ignoring the scheduled `>date` and completion date.
- `@repeat(+1m, 2026-05-12)` — the `+` prefix takes precedence: next repeat is calculated from the completion / cancellation date, the concrete date is ignored for scheduling, and a warning is logged.
- `@repeat(1m)` — unchanged: uses the task's scheduled `>date` (or note date for calendar notes).
- `@repeat(+1m)` — unchanged: uses the completion / cancellation date.

---

## How the anchor advances

After each completion or cancellation the date inside the tag is replaced with the next date in the sequence, **preserving its original format**. This happens for both completed **and** cancelled tasks (when "Allow repeats in cancelled paragraphs?" is enabled).

**Example — completing a monthly task (day-spec anchor):**

```
* do expenses @repeat(1m, 2026-05-12)   ← original task, completed late on 2026-05-20
* do expenses @repeat(1m, 2026-06-12) >2026-06-12   ← new task: anchor advanced, scheduled from anchor not completion date
* do expenses @repeat(1m, 2026-07-12) >2026-07-12   ← and so on
```

**Example — week-spec anchor:**

```
* review backlog @repeat(1w, 2026-W19)   ← completed during 2026-W22
* review backlog @repeat(1w, 2026-W20) >2026-W20   ← anchor advances week-by-week, not to the completion week
```

**Example — month/quarter/year-spec anchors:**

```
@repeat(1m, 2026-05) → @repeat(1m, 2026-06)
@repeat(1q, 2026-Q2) → @repeat(1q, 2026-Q3)
@repeat(1y, 2026)    → @repeat(1y, 2027)
```

The `>date` scheduled marker is always set to the same value as the new anchor date (reformatted to a daily date for day-spec anchors on daily notes, or to the matching week/month/quarter/year marker as appropriate).

---

## Year-end handling

The anchor advances correctly across year boundaries for every spec, including the 52- vs 53-week-year edge cases for week-spec anchors:

```
@repeat(1d, 2026-12-31) → @repeat(1d, 2027-01-01)
@repeat(1m, 2026-12)    → @repeat(1m, 2027-01)
@repeat(1q, 2026-Q4)    → @repeat(1q, 2027-Q1)
@repeat(1y, 2026)       → @repeat(1y, 2027)

@repeat(1w, 2026-W53) → @repeat(1w, 2027-W01)   ← last week of a 53-week year (e.g. 2026)
@repeat(1w, 2025-W52) → @repeat(1w, 2026-W01)   ← last week of a 52-week year (e.g. 2025)
```

A day-spec anchor that falls in the last week of the year also rolls over correctly when the output is a week-spec marker (e.g. `@repeat(1w, 2026-12-28)` → `>2027-W01`).

---

## Cancelled tasks

Cancelled tasks follow exactly the same logic as completed tasks, subject to the "Allow repeats in cancelled paragraphs?" plugin setting (disabled by default):

1. The trigger detects that a line transitioned from open to cancelled on save.
2. `generateRepeatForCancelledPara()` strips the `[-]` marker, any existing `>date`, and any `@done(...)` from the content.
3. Today's date is used as the cancellation date. For `@repeat(+interval, <date>)` tags (where `+` overrides the concrete date) the new scheduled date is calculated from today; for plain `@repeat(interval, <date>)` tags the new scheduled date is calculated from the anchor date, regardless of when the task was cancelled.
4. The anchor date in the tag is advanced by the interval (preserving its format), and a new open task is inserted immediately before the cancelled one.

**Example — cancelling a weekly task:**

```
* team meeting @repeat(1w, 2026-05-12)   ← cancelled on 2026-05-20 (8 days late)
* team meeting @repeat(1w, 2026-05-19) >2026-05-19   ← new task: anchor used, not cancellation date
```

---

## `+` prefix with a concrete date

When the `+` prefix is combined with a concrete date the `+` always wins. A warning is logged noting that the concrete date was immaterial, and the next repeat is scheduled from the completion or cancellation date as normal:

```
* task @repeat(+1m, 2026-05-12)   ← completed on 2026-05-20
* task @repeat(+1m, 2026-06-20)   ← scheduled from completion date; anchor still advances by one interval
```

Note: the anchor in the tag **is** still advanced even in this case, even though it had no effect on scheduling. This means a `@repeat(+1m, <date>)` tag will keep a "rolling anchor" that stays one interval behind the completion-date schedule — which may or may not be the intended behaviour.

---

## Backward compatibility

All existing `@repeat(interval)` and `@repeat(+interval)` tags are unaffected. The concrete/anchor date is purely additive — if omitted, behaviour is identical to previous versions.
