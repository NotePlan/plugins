# Assessment: `getAllMatchingProjects()` and main UI blocking

**Date:** 2026-08-29  
**Scope:** jgclark.Reviews — how `getAllMatchingProjects()` runs and why it blocks NotePlan's main UI.

---

## Summary

`getAllMatchingProjects()` **does block the main UI**. That is an architectural constraint of NotePlan's single-threaded plugin JSContext combined with a synchronous, full-note parse for every cache-missed project — not an accidental bug.

The `runInForeground` parameter is a UX hint (CommandBar loading spinner), not a concurrency control. The real cost is the uncached `new Project(...)` loop.

Existing code mitigates **perceived** blocking (banner-first x-callbacks, JSON cache, coalescing) but does not **eliminate** the freeze during the scan itself.

---

## Root cause: single-threaded plugin JSContext

NotePlan plugins run on **one shared JSContext on the main thread**. There is no real background worker for plugin JavaScript. While `getAllMatchingProjects()` runs, the app cannot process UI events, paint WebViews reliably, or handle other plugin work until the function returns.

Authors measured this at **~13 seconds** with both Dashboard and the Rich Project List open. Comments in the code describe it explicitly as "beachballing the JSContext":

```javascript
// jgclark.Reviews/src/reviewsList.js (generateProjectListsAndRenderIfOpen)
// Dashboard perspective switch / definition save passes paintFirst. Show the banner and return before loading
// settings or scanning notes, so the WebView can paint. generateAllProjectsList then beachballs
// the JSContext (measured ~13s with both windows open).
```

`runInForeground` is **misleading** — it does not run work in the background. It only toggles `CommandBar.showLoading()` per folder during enumeration in `enumerateMatchingProjectNoteTagPairs()`:

```javascript
if (runInForeground) {
  CommandBar.showLoading(true, `Generating Project Review list for notes in folder ${folder}`)
}
// ... filtering work ...
if (runInForeground) {
  CommandBar.showLoading(false)
}
```

All actual computation still runs synchronously on the main thread.

### Related platform constraints

- `DataStore.invokePluginCommandByName` is **not** fire-and-forget: even without `await`, it runs the other plugin on the same JSContext before returning.
- NotePlan Beta throws `JSPromiseConstructor is not a constructor` — patterns like `delayMs()` / `new Promise` are not viable on critical paths (see `jgclark.Dashboard/src/reviewsListSync.js`).

See also: `jgclark.Dashboard/docs/ARCHITECTURE-How_Stuff_Works.md`, `jgclark.Reviews/ARCHITECTURE-Comms_with_Dashboard.md`.

---

## What `getAllMatchingProjects()` does (and why it's slow)

**Location:** `jgclark.Reviews/src/allProjectsListHelpers.js`  
**Called by:** `generateAllProjectsList()` → various entry points (see below).

The function has two phases.

### Phase 1 — Enumeration (`enumerateMatchingProjectNoteTagPairs`)

Relatively cheap:

1. Filter `DataStore.projectNotes` by folder include/exclude rules
2. Optionally filter by teamspace (Dashboard perspectives)
3. Loop folders × project-type tags to build `{ note, projectTypeTag }` pairs

This is mostly in-memory filtering over NotePlan's project-note index.

### Phase 2 — Project instantiation (the expensive part)

For each matched note/tag pair:

1. Load cached snapshot rows from `allProjectsList.json`
2. Compare `noteChangedAtMs` fingerprint for each note
3. **Cache hit** (note unchanged): clone cached row, attach live `note`, run `calcReviewFieldsForProject()` (cheap)
4. **Cache miss**: run full `new Project(n, tag, ...)` constructor

On cache miss, the `Project` constructor (`jgclark.Reviews/src/projectClass.js`) for each note:

- Reads all `note.paragraphs`
- Parses frontmatter and metadata mentions
- Counts open/closed/waiting/future tasks across every paragraph (`countTasks`)
- Scans progress lines (`processProgressLines`)
- Gathers next-action content (`gatherAnyNextActionContent`)
- May write back to frontmatter (`updateFrontMatterVars`, `DataStore.updateCache`)

The constructor comment notes roughly **1 ms per line per note** — so a vault with 200 project notes averaging 50 lines each can easily reach multi-second (or ~13s) totals, all in one unbroken synchronous loop with **no yields between notes**.

---

## Call paths that trigger the block

| Entry point | `runInForeground` | UI impact |
|---|---|---|
| `displayProjectLists` | `true` | Full block until complete |
| `onSettingsUpdated` | `true` | Full block on settings save |
| `generateProjectListsAndRenderIfOpen` (after `paintFirst` hop) | `true` | Banner visible first, then ~13s block |
| `getAllProjectsFromList` when cache stale | `false` | Silent block (no CommandBar spinner) |
| Dashboard PROJ* section refresh | varies | Can trigger inline regen |

Key call sites:

- `jgclark.Reviews/src/reviewsList.js` — `displayProjectLists`, `generateProjectListsAndRenderIfOpen`
- `jgclark.Reviews/src/index.js` — `onSettingsUpdated`
- `jgclark.Reviews/src/allProjectsListHelpers.js` — `getAllProjectsFromList` → `generateAllProjectsList`

---

## Mitigations already in place

The codebase has worked around blocking rather than eliminating it.

### 1. `allProjectsList.json` cache

`noteChangedAtMs` fingerprint avoids re-parsing unchanged notes on regen. Cache key: `makeProjectListCacheKey(filename, projectTypeTag)`.

### 2. TTL read path

`getAllProjectsFromList()` reads JSON when fresh (`maxAgeAllProjectsListInHours`) instead of regenerating. Regenerates when:

- File missing or corrupt
- File older than max age
- Dashboard perspective name changed
- Folder/teamspace filter fingerprint changed (`shouldRegenerateAllProjectsList`)

### 3. `paintFirst` / `afterBanner` x-callback

When the Rich Project List is open and Dashboard triggers a perspective switch:

1. **`paintFirst` phase:** show updating banner, queue x-callback, return immediately so WebView can paint
2. **`afterBanner` phase:** run `generateAllProjectsList` (blocks JSContext), then render

```javascript
// jgclark.Reviews/src/reviewsList.js
const url = createRunPluginCallbackUrl('jgclark.Reviews', 'generateProjectListsAndRenderIfOpen', [
  String(scrollPosNum),
  skipDash ? 'true' : 'false',
  'afterBanner',
])
NotePlan.openURL(url)
```

Dashboard uses `scheduleReviewsListAfterPerspectiveSwitch()` (`jgclark.Dashboard/src/reviewsListSync.js`) instead of `invokePluginCommandByName` for the same reason.

### 4. Coalescing

`generateProjectListsAndRenderIfOpenInFlight` and related flags prevent stacked regens during rapid perspective switches or Save+Switch edge cases.

### 5. Incremental updates

`updateAllProjectsListAfterChange` updates one project when possible (`addNewProjectToAllProjectsListIfInScope`, single `new Project` + `writeAllProjectsList`) instead of full regen.

### 6. HTML banner paint workaround

The Rich list banner avoids `requestAnimationFrame` because RAF does not fire while the JSContext is blocked:

```javascript
// jgclark.Reviews/requiredFiles/HTMLWinCommsSwitchboard.js
// Apply --visible in this turn (not requestAnimationFrame). RAF does not fire while the plugin
// JSContext is beachballing generateAllProjectsList, so the banner would stay at opacity 0 until
// the list is about to refresh.
```

`runProjectListWindowJS` calls `HTMLView.runJavaScript` directly rather than `postMessage`, for the same yield reason.

---

## Why the block feels especially bad

1. **No chunking** — the `for` loop over all pairs has no batch boundaries or yields between iterations.
2. **No async thread option** — NotePlan Beta lacks a reliable `Promise` constructor on critical paths.
3. **Full parse on cache miss** — any note edit, perspective change, or folder-filter change can force many cache misses and full `Project` constructions.
4. **Cascading callers** — Dashboard PROJ* sections, settings saves, manual list refresh, and perspective switches can all trigger the same full scan.
5. **`runInForeground=true` adds CommandBar spinner updates** but does not reduce total work.

---

## Possible directions for improvement

None of these are implemented today; each has trade-offs.

| Approach | Trade-off |
|---|---|
| **Chunked x-callback regen** (e.g. 10–20 projects per hop) | Shorter freezes per hop; total time similar; needs progress state and merge logic |
| **Stronger incremental updates** | Avoid full regen when only filtered subset changes (perspective/filter changes) |
| **Lazy field computation** | Parse only fields needed for current view (list vs detail vs Dashboard PROJ*) |
| **`ProjectFields` data type** (noted in `projectClassCalculations.js`) | Lighter cache hits without class prototype overhead |
| **Extend `paintFirst` to more entry points** | `onSettingsUpdated` and `displayProjectLists` could use same banner-yield pattern |
| **Native NotePlan APIs** | If NotePlan exposes indexed project metadata or async plugin threads, hot path could move off main context |

---

## Key source files

| File | Role |
|---|---|
| `jgclark.Reviews/src/allProjectsListHelpers.js` | `getAllMatchingProjects`, `enumerateMatchingProjectNoteTagPairs`, `generateAllProjectsList`, cache logic |
| `jgclark.Reviews/src/projectClass.js` | Expensive `Project` constructor |
| `jgclark.Reviews/src/projectClassCalculations.js` | `calcReviewFieldsForProject` (cheap cache-hit path) |
| `jgclark.Reviews/src/reviewsList.js` | `paintFirst` / `afterBanner`, coalescing, banner helpers |
| `jgclark.Dashboard/src/reviewsListSync.js` | Dashboard → Reviews x-callback scheduling |
| `jgclark.Reviews/requiredFiles/HTMLWinCommsSwitchboard.js` | Banner visibility during JSContext block |
| `jgclark.Reviews/ARCHITECTURE-Comms_with_Dashboard.md` | Cross-plugin comms and blocking notes |

---

## Related changelog entries

- **Dashboard CHANGELOG:** Perspective switch no longer awaits Reviews invoke; queues x-callback with `paintFirst` (~v2.4.x).
- **Reviews CHANGELOG / comments:** Measured ~13s `generateAllProjectsList` with both windows open.
