# Architecture: Caches for performance (Projects + Reviews)

This note lists the caches Projects + Reviews uses so it does not scan the whole vault on every refresh. Cross-plugin refresh paths that read or write them are in `ARCHITECTURE-Comms_with_Dashboard.md`.

None of these are NotePlan's own note cache (`DataStore.updateCache`). That call only refreshes a note after a write.

## `allProjectsList.json`

**Owner:** Projects (`jgclark.Reviews`).

**Path:** `../jgclark.Reviews/allProjectsList.json` (written with a cross-plugin path so a call from the Dashboard bundle still lands in the Reviews data folder).

**What it holds:** One JSON row per project note that is in scope, without the live `note` object. Date fields are `YYYY-MM-DD`. Each row can store `noteChangedAtMs` (epoch ms of `note.changedDate` after a full parse).

**Who reads it:** `getAllProjectsFromList`, then `filterAndSortProjectsList`. The Rich list, review commands, and Dashboard PROJACT / PROJREVIEW sections all go through that filter. With `FFlag_UseCacheOfAllPerspectives` on, the file can hold every saved perspective, and the filter narrows rows to the **active** perspective before display.

**Who writes it:** `writeAllProjectsList`, from a full generate, an incremental merge, a partial folder include, a settings recalculate, or a single-note update.

**When it is reused:** `shouldRegenerateAllProjectsList` returns false when the file is a JSON array, younger than `maxAgeAllProjectsListInHours` (168 hours), and the scope stamp still matches. `getAllProjectsFromList` then maps each row through `calcReviewFieldsForProject` (review dates only) and does not construct `Project` objects.

**Scope stamp** (preferences, shared `DataStore` keys):

- `Reviews-lastAllProjectsGenerationTime` -- ms of the last successful write. This is the list age.
- `Reviews-lastAllProjectsFullScanTime` -- ms of the last full vault enumerate.
- `Reviews-lastAllProjectsPerspective` -- active perspective name, used when the union flag is off.
- `Reviews-lastAllProjectsFolderFilters` -- active folder/teamspace fingerprint when the flag is off. When the flag is on, this stores the **union** fingerprint instead.
- `Reviews-lastAllProjectsScopeChangedAt` -- JSON map of perspective name to the `changedAt` last applied from the union file.

**How a rebuild chooses work** (`generateAllProjectsList`):

- **Full enumerate** when forced, the file is missing or empty, the last full scan is older than 24 hours (`MAX_AGE_FULL_SCAN_MS`), the list is older than 168 hours, or the scope stamp changed and the list is already stale. The folder list is deduped and sorted before the scan. One generate runs at a time; a second caller waits for that run.
- **Partial include** when the union flag is on, the union fingerprint changed, the list is still fresh, and the last full scan is within `MAX_AGE_FULL_SCAN_MS`. It adds notes from folders that are new on changed scopes and not already covered by an unchanged scope. It does not delete rows. Removals wait for the next full enumerate.
- **Incremental merge** otherwise. It keeps the current rows and re-parses notes the Shared notes-changed-recently cache (plus each note's `changedDate`) says have changed since the last list write.

**Constructor hits during a full enumerate:** `buildProjectsFromPairsSync` reuses a stored row when `noteChangedAtMs` still equals the note's current `changedDate`. A miss calls `new Project(...)`.

**Missing or unreadable file:** treated as empty and fully regenerated.

## `perspectiveScopeUnion.json`

**Owner:** Dashboard. Projects only reads it.

**Path:** `../jgclark.Dashboard/perspectiveScopeUnion.json`.

**What it holds:** Version, a fingerprint, and one scope per saved perspective: `name`, resolved `folders`, `teamspaces`, and `changedAt` (ms). The fingerprint is a stable hash of names plus sorted folders and sorted teamspaces. It does not include `changedAt` or which perspective is active. The default `-` perspective is omitted, because it usually includes every folder.

A note is in the union only when **one** scope allows both its folder and its teamspace. Folder match is exact (`getFolderFromFilename`), not a prefix, so an excluded child of an included parent stays out.

**When Dashboard writes it:**

- Full rewrite when folder or teamspace **definitions** change, when the file is missing, or on plugin update. `changedAt` is kept when that scope's folders and teamspaces are unchanged.
- On perspective **switch**, only the destination scope's folders are re-resolved from `DataStore.folders`. If that list changed, that scope's `folders` and `changedAt` are updated and the fingerprint is recomputed. Other scopes are left alone. Teamspaces are not re-read on switch.

**When Projects uses it:** `FFlag_UseCacheOfAllPerspectives` and Use Perspectives are both on. `readUnionForConfig` loads the file instead of recomputing the union from perspective defs. The fingerprint is compared to `Reviews-lastAllProjectsFolderFilters`. Weekly progress uses the same file for its folder set (`foldersInPerspectiveScopeUnion`).

**Flag off:** Dashboard still maintains the file. Projects ignores it and keeps the active-perspective path.

**Missing or unreadable file:** Projects logs a warning and falls back to the active perspective.

## Shared `notesChangedRecently.json`

**Owner:** `np.Shared` (`np.Shared/src/notesChangedRecentlyCache.js`).

**Path:** `../../data/np.Shared/notesChangedRecently.json`.

**What it holds:** `generatedAt`, `lastUpdated`, `windowDays` (7), and `notes`: `{ filename, noteType: 'Notes' | 'Calendar', changedAt }`. Membership only. No tags, done counts, or project fields.

**Freshness:** Incremental update when `lastUpdated` is older than 1 hour. A full regenerate is scheduled when `generatedAt` is older than 7 days. An update newer than 5 seconds is skipped.

**Who uses it:**

- Projects incremental `allProjectsList` merge (`getFilenamesChangedSince`, note type `Notes`), with a local `note.changedDate` backstop so a note changed since the list write is not missed if the Shared cache has not caught it yet.
- `/weeklyProjectsProgress`, which scans only those recently changed notes and falls back to the full folder set if the cache cannot be loaded.

**If it is missing:** the caller generates it before continuing. If generation still fails, weekly progress scans the full folder set. The project list falls through to a full enumerate when the incremental path is not safe.

**Building `Project` objects** (`buildProjectsFromPairsSync`). A miss calls `new Project(...)`, which reads the note body. The cache has no paragraph or project fields, so it cannot skip or shorten that work. Unchanged notes are already reused from `allProjectsList.json` via `noteChangedAtMs`.

**Weekly progress** (`scanWeeklyProgressCombinedSync`). It walks done paragraphs for completion dates. The cache does not record done items or those dates. Recently changed notes are already limited by `notesChangedRecently.json`.

## In-memory Dashboard settings cache

**Owner:** Dashboard (`pluginSettingsCache` in `dashboardPluginSettings.js`).

**What it holds:** The last loaded Dashboard plugin settings object, including `perspectiveSettings`, for the current JSContext. It is not a file.

**Why it exists:** `getReviewSettings` overlays the active perspective's folders and teamspaces from those settings. `generateProjectListsAndRenderIfOpen` calls `invalidateDashboardPluginSettingsCache()` before that overlay so a just-saved definition is not hidden by a stale object.

**Not a substitute for the union file.** The settings cache is the raw defs. The union file is the resolved folder lists.

## `Reviews-lastSettingsSnapshot`

**Owner:** Projects. Preference key `Reviews-lastSettingsSnapshot`.

**What it holds:** The previous raw Reviews `settings.json`, so `onSettingsUpdated` can classify the change.

**Why it exists:** Avoids a vault scan when the change does not affect which notes are projects.

- Rebuild (`generateAllProjectsList`, forced full) when project-type tags, perspective use, `FFlag_UseCacheOfAllPerspectives`, folder filters, or metadata mention strings change.
- Recalculate (`recalculateAllProjectsListItems`) when only next-action or progress-calculation settings change. That re-parses rows already in `allProjectsList.json` and does not walk the vault.
- Redisplay only, or no list work, for display and other settings.

This snapshot does not store project rows.

---

## NOT used: Shared `tagMentionCache`

**Owner:** `np.Shared` (`np.Shared/src/tagMentionCache.js`). Projects does not read or register it.

**What it holds:** Filenames of notes that contain registered `#tags` or `@mentions`. A hit is stored only when the item is on an open, checklist, or scheduled paragraph, or in any frontmatter field. No paragraph text, done dates, next actions, or project fields.

Three long loops were considered. The cache is a poor fit for all three.

**Full discovery** (`buildMatchingProjectNoteTagPairsSync`, inside `enumerateMatchingProjectNoteTagPairs`). This is the loop that walks every in-scope note and calls `noteHasProjectTypeTag`. A cache lookup could shrink that set, but the match rules are not the same:

- Reviews treats a note as that project type only when the tag is in the `project:` frontmatter field (or the custom metadata key) or on the legacy body metadata line.
- The cache indexes the tag in any frontmatter field, and on any open task. Those notes are false hits and still need `noteHasProjectTypeTag`.
- A tag that exists only on the body metadata line is plain text, so the cache misses it. Those notes still need the existing scan, or they drop out of the list until the next full pass.

The lookup is therefore a prefilter, not a replacement. The cost of using it is worth paying only when the included folders are mostly non-projects and some other plugin is already keeping those tags fresh. In the usual case it is slower than one discovery pass.
