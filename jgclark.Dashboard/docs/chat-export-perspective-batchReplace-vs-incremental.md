# Chat export: Switch Perspective vs incremental refresh

Exported from Cursor conversation `109493f1-4dee-43a6-9ec1-15db7116de87` (2026-08-21).

---

## User (jgclark)

You explained recently why Switch Perspective needed not to use the incrementalRefresh route but the batchReplace. I still don't follow. Why can't it be the same as the Dashboard startup approach? Why do we need to keep any former Section state?

## Assistant (Cursor)

Short answer: **we do not need to keep former section state on a perspective switch.** That leftover-rows argument is outdated. Switch already wipes to `sections: []` in `doSwitchToPerspective` before regenerating.

### What "Dashboard startup approach" actually is

Incremental refresh is for two situations where the screen is **still useful while it rebuilds**:

- First launch (starts empty; sections pop in)
- User Refresh (same perspective; each section updates in place)

That path **merges** on purpose: regenerate Today, keep Yesterday, etc. Progressive display is the feature.

### Why Switch is different

On perspective switch, the spinner covers the list, so pop-in has no value. If you reused incremental after the wipe, you would get:

1. Generate section 1 → `setPluginData` → WebView has 1 section
2. Generate section 2 → `getGlobalSharedData` **pulls that growing list back into the plugin**, merge, send again
3. Repeat N times

So each step pays for serializing more of the new list **back** across the plugin ↔ WebView boundary. Batch does: wipe → generate all → **one** write (and clears `perspectiveChanging` in that same payload). The `getGlobalSharedData` inside that write still runs, but while `sections` is still `[]`, so the read is cheap.

### Bottom line

| | Refresh / first load | Perspective switch |
|---|---|---|
| Keep old sections? | Yes (merge) | No (already wiped) |
| Progressive paint useful? | Yes | No (spinner) |
| Route | `incrementallyRefreshSomeSections` | `batchReplaceSections` |

We use batch not because merge would leave ghosts (the wipe already prevents that), but because after an empty snapshot you want **one** paint without N bridge round-trips of a growing section tree.

---

## User

But why is this "N bridge round-trips of a growing section tree" not the case on Dashboard startup? It too starts from a blank screen, but paints incrementally.

## Assistant

It **is** the case on startup too. Incremental startup does the same growing-tree dance:

1. WebView starts with `sections: []`
2. After Today lands, the next `setPluginData` does `getGlobalSharedData` and pulls Today back into the plugin
3. After 5 sections, the next read pulls all 5 back, then writes 6
4. Repeat until N

Nothing about first launch makes that free. The bridge cost is accepted **because progressive paint is the product**: the user sees Today (then Yesterday, …) while the rest are still generating.

Perspective switch is the same empty starting point **after the wipe**, but the UX is different:

- `perspectiveChanging` puts a modal spinner over the list
- Pop-in is invisible under that spinner
- You would still pay N serialize-back / merge / serialize-forward cycles
- Then clear the spinner and show everything at once anyway

So batch is not "startup can't do incremental; switch must." It is: **startup wants the incremental UX and accepts the bridge tax; switch gets no incremental UX, so it skips the tax and paints once.**

If we turned off the switch spinner and used incremental, it would behave like a mid-session "restart from blank" - same growing-tree cost as launch, just without the launch-time reason for wanting it.
