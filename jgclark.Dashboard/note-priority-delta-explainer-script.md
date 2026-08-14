# Explainer Video Script: Note Priority Delta (Dashboard v2.4)

**Length:** ~90 seconds  
**Feature:** `note-priority-delta` frontmatter attribute

## Setup checklist

- Note with several open tasks and no priority markers
- Frontmatter with `note-priority-delta: 1` (or `2`)
- Dashboard with priority filtering enabled (before → after refresh)
- Optional: same with `note-priority-delta: -1` to show demotion

---

## Hook

Jonathan Clark here with another quick explainer for a small but useful new feature in Dashboard plugin v2.4.

[UX] _Dashboard with priority filtering on; a “Taxes” note’s tasks buried or missing because they have no `!` / `!!` markers._

If everything in a note is important -- taxes, a launch, a big project -- you shouldn’t have to sprinkle priority markers on every single task.

## The problem

[UX] _Same note open in the editor; tasks look clean, but the Dashboard hides or demotes them when priority filtering is on._

Dashboard can filter by priority so you only see what matters today. That’s great -- until a whole note is high priority, and marking every line gets messy.

## The fix

[UX] _Add frontmatter to the note:_

```yaml
---
note-priority-delta: 1
---
```

Then refresh Dashboard; those tasks now sort/filter as if they had higher priority.

In Dashboard v2.4, add one frontmatter field: `note-priority-delta`, and a number. 
That number is added to the display priority of every open item in the note. Use a negative number to lower them.  
Your note stays clean -- no `!` or `!!` clutter on every task.

## [0:50–1:05] Important caveat + close

[UX] _Quick split: note content unchanged vs Dashboard showing boosted priority. End card: “Dashboard v2.4 · note-priority-delta”._

This only changes how items appear in the Dashboard -- not the tasks themselves. 
Set it once on the note, and let priority filtering do the rest. That’s `note-priority-delta` in Dashboard v2.4.
