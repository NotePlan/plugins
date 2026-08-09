# Search Extensions – Critical Fixes Plan

Status: planned (not started)  
Source: code review of `jgclark.SearchExtensions` (2026-08-09)  
Target: iterative fixes for items 1–9; after each item bump beta version and commit (do not push until asked)

## Versioning convention

| Field | Pattern |
|-------|---------|
| `plugin.version` | stay `3.0.0` or use `3.0.0.bN` to match CHANGELOG headings |
| `plugin.releaseStatus` | `beta3`, `beta4`, … through each fix |
| CHANGELOG | add `## [3.0.0.bN]` section at top for each fix commit |
| Git | one commit per fix; do not push |

Suggested sequence: **b3** (fix 1) … **b11** (fix 9). Adjust if other betas land first.

## Scope boundaries

- Fix only Search Extensions + the one shared helper for item 9 (`helpers/search.js`).
- Do not rebuild with `npm run build`; leave Rollup/`npc` to the programmer.
- Do not commit or push unless explicitly asked when executing this plan.
- Prefer minimal, focused diffs; keep existing comments/`log*` calls.
- Update the first H2 in `CHANGELOG.md` for each release bump (match `plugin.json` version style).

## Command / callback truth table (use as single source of truth)

NotePlan x-callbacks use **command `name`**, not `jsFunction`.

| Entry wrapper | `originatorCommand` today | Correct **command name** for URLs | JS args order |
|---------------|---------------------------|-----------------------------------|----------------|
| `quickSearch` | `quickSearch` | `quickSearch` | terms, noteTypes, paraTypes, dest |
| `searchOverAll` | `searchOverAll` (wrong for URL) | `search` | terms, noteTypes (ignored), paraTypes, dest |
| `searchOverCalendar` | `searchOverCalendar` | `searchOverCalendar` | terms, noteTypes (ignored), paraTypes, dest |
| `searchOverNotes` | `searchOverNotes` | `searchOverNotes` | terms, noteTypes (ignored), paraTypes, dest |
| `searchOpenTasks` | `searchOpenTasks` | `searchOpenTasks` | terms, noteTypes, paraTypes (ignored), dest |
| `searchPeriod` | `searchPeriod` (wrong for URL) | `searchInPeriod` | terms, **paraTypes**, noteTypes (ignored), dest, from, to |

Destination tokens: docs/`plugin.json` use `current` \| `newnote` \| `quick` \| `log`. Internal code often uses `searchSpecificNote`. Re-run uses `refresh` → treat as rewrite current results path (same as “current” / default writer).

---

## Fix 1 – Re-run / onOpen refresh (critical)

**Files:** `src/searchHelpers.js`, `src/searchTriggers.js`, `src/saveSearch.js` (+ README if documentation still says “Refresh”)

### Problems

1. Metadata button text is `Re-run search`; `refreshSavedSearch` only matches `/Refresh /`.
2. `createRunPluginCallbackUrl` is fed `originatorCommand` (e.g. `searchOverAll`, `searchPeriod`) which are not registered command names (`search`, `searchInPeriod`).
3. Period x-callback builds args as `[terms, noteTypes, paraTypes, dest, from, to]` but `searchPeriod` expects `[terms, paraTypes, noteTypes, dest, from, to]`.
4. Trigger switch calls search functions **without `await`**; loading spinner ends early; unhandled rejections possible.

### Implementation steps

1. **Button label detection** in `searchTriggers.js`: match both old and new labels, e.g.  
   `/(Re-run search|Refresh )/`.  
   Optionally keep emission as `Re-run search` or restore `Refresh` for consistency with docs – either way, detection must accept both.
2. **Map originator → command name** when building URLs in `saveSearch.js` (table above). Prefer a small helper, e.g. `getSearchCommandName(originatorCommand)`.
3. **Build callback args per command** with a helper, e.g. `buildRefreshCallbackArgs(...)`, so `searchInPeriod` gets paraTypes before noteTypes; others match their signatures.
4. **await** every command invocation in `refreshSavedSearch` switch; keep loading true until the awaited call finishes.
5. Smoke-check: open a results note with onOpen trigger; click Re-run link for `/search`, `/quickSearch`, `/searchInPeriod`.

### Verify

- [ ] Saved notes with old “Refresh …” and new “Re-run search” both trigger refresh.
- [ ] Generated x-callback `command=` values exist in `plugin.json`.
- [ ] Period re-run preserves date args and para filter.

**Version:** 3.0.0.b3 / releaseStatus beta3  
**Commit message idea:** `fix(SearchExtensions): restore re-run/onOpen refresh callbacks (b3)`

---

## Fix 2 – Settings defaults vs code choices

**Files:** `plugin.json`, optionally normalise in `getSearchSettings()` in `src/searchHelpers.js`

### Problems

| Setting | Bad default | Expected by code |
|---------|-------------|------------------|
| `resultStyle` | `"NotePlan-style"` | `"NotePlan"` (choices: NotePlan, Simplified) |
| `sortOrder` | `"updated (most recent first)"` | `"updated (most recent note first)"` |

Effects: `syncOpenResultItems` stays false; sort falls back outside `SORT_MAP`; Simplified never selected by accident of default mismatch.

### Implementation steps

1. Fix `plugin.json` defaults to exact choice strings.
2. In `getSearchSettings()`, normalise legacy values so existing installs recover:
   - `NotePlan-style` → `NotePlan`
   - short sort label → full `updated (most recent note first)` if present
3. Recompute `syncOpenResultItems` after normalisation (`resultStyle === 'NotePlan'`).

### Verify

- [ ] Fresh settings → NotePlan styling path and non-title default sort when intended.
- [ ] Old settings JSON with legacy strings works after load.

**Version:** 3.0.0.b4  
**Commit message idea:** `fix(SearchExtensions): align resultStyle/sortOrder defaults with SORT_MAP (b4)`

---

## Fix 3 – `/searchOpenTasks` sync on native path

**Files:** `src/NPExtendedSyntaxHelpers.js` (and/or shared post-process after native search in `saveSearch.js`)

### Problem

`makeAnySyncs` only runs in `runPluginExtendedSyntaxSearches`. With `useNativeSearch: true` (default), open-task results never get blockIDs.

### Implementation steps

1. After native search produces `resultOutputV3Type`, if `config.resultStyle === 'NotePlan' && config.syncOpenResultItems`, call `await makeAnySyncs(...)`.
2. Prefer calling from one place (end of `runNPExtendedSyntaxSearches` or single post-process used by both engines) so it cannot drift again.
3. Respect confirm UX already in `makeAnySyncs` (≥20 open tasks).

### Verify

- [ ] Native path + NotePlan result style + open tasks → sync markers on sources and result lines.
- [ ] Simplified style still does not sync.

**Version:** 3.0.0.b5  
**Commit message idea:** `fix(SearchExtensions): sync open tasks on native search path (b5)`

---

## Fix 4 – Period search legacy path ignores supplied dates

**Files:** `src/saveSearch.js`, use `getDateRangeFromSearchOptions` from `src/dateRanges.js`

### Problem

When `fromDateStr`/`toDateStr` are already on `searchOptions`, the legacy branch always re-calls `getDateRangeFromUser()`, breaking x-callback/refresh and double-prompting interactive users who already chose dates in `searchPeriod`.

### Implementation steps

1. If both (or either, per existing semantics) dates are already set and valid, map via `getDateRangeFromSearchOptions(searchOptions)` for `fromDateStr`, `toDateStr`, period strings.
2. Only call `getDateRangeFromUser()` when dates are missing (and period search needs them).
3. Keep native path’s `date:from-to` prefix behaviour unchanged unless you are intentionally consolidating later.

### Verify

- [ ] `/searchInPeriod` with args does not re-prompt on legacy path.
- [ ] Interactive SIP without args still prompts once.

**Version:** 3.0.0.b6  
**Commit message idea:** `fix(SearchExtensions): honour period dates on plugin search path (b6)`

---

## Fix 5 – flexiSearch paragraph type values

**Files:** `src/flexiSearch.js` (+ optional default preference cleanup)

### Problem

Checkbox values include non-API tokens: `taskScheduled`, `taskCancelled`, `checklistOpen` (and default string uses them). Filters expect NotePlan types: `scheduled`, `cancelled`, `checklist`, etc. `other` is not expanded; only `non-task` is handled in `getParaTypesFromString`.

### Implementation steps

1. Set checkbox `value=` attributes to real `ParagraphType` strings (+ `non-task` for “other line types”).
2. Fix default `paraTypesStr` preference fallback to valid tokens, e.g.  
   `open,done,checklist,checklistDone,non-task,`
3. Optionally migrate stored prefs containing old tokens when loading the dialog (map old → new once).

### Verify

- [ ] Selecting Scheduled / Open checklist / Cancelled filters matching paras only.
- [ ] Default dialog selection produces non-empty sensible results.

**Version:** 3.0.0.b7  
**Commit message idea:** `fix(SearchExtensions): use real ParagraphTypes in flexiSearch dialog (b7)`

---

## Fix 6 – flexiSearch case / full-word preference types

**Files:** `src/index.js` (`onSettingsUpdated`), `src/flexiSearch.js` (init + save)

### Problem

Settings write boolean prefs; HTML compares prefs to checkbox values `'casesens'` / `'fullword'`. After settings change, switches never show `true`. Dialog save path writes strings, so two systems disagree.

### Implementation steps (pick one store format and stick to it)

**Recommended:** store booleans everywhere.

1. `onSettingsUpdated` – keep booleans.
2. Dialog init: treat pref as checked if truthy (`true`, `'true'`, `'casesens'`, `'fullword'`).
3. `savePluginPreference` / dialog save: persist `'true'`/`'false'` or actual booleans consistently with how `DataStore.setPreference` is used elsewhere.
4. `flexiSearchHandler` already compares to `'casesens'`/`'fullword'` – align with whatever the form posts after step 3.

### Verify

- [ ] Toggle settings → open flexi dialog → controls match.
- [ ] Toggle controls in dialog → submit → search honours flags.

**Version:** 3.0.0.b8  
**Commit message idea:** `fix(SearchExtensions): align flexiSearch case/full-word prefs with settings (b8)`

---

## Fix 7 – Destination naming (`newnote` vs `searchSpecificNote`)

**Files:** `src/saveSearch.js`, `plugin.json` descriptions, `README.md` x-callback table if needed

### Problem

Docs/args say `newnote`; chooser and writers use `searchSpecificNote`. Unknown values fall into **default → current note**, so external callers writing `newnote` incorrectly open/append current note.

### Implementation steps

1. Introduce normalisation helper, e.g. `normaliseDestination(dest)`:
   - `newnote` | `searchSpecificNote` → `searchSpecificNote` (or rename internal to `newnote`; alias both)
   - `quick`, `current`, `log`, `cancel`, `refresh` as today
2. Apply early in `saveSearch` after reading `destinationArg` / chooser.
3. Align `plugin.json` argument help text with accepted tokens (list both aliases if keeping both).

### Verify

- [ ] x-callback with `destination=newnote` creates/updates Saved Searches note.
- [ ] `refresh` still updates in place.

**Version:** 3.0.0.b9  
**Commit message idea:** `fix(SearchExtensions): accept newnote destination alias (b9)`

---

## Fix 8 – Replace confirmation Cancel treated as Yes

**Files:** `src/replace.js`

### Problem

```js
showMessageYesNo(..., ['Yes', 'Cancel'], ...)
if (res === 'No') { return } // Cancel never matches
```

### Implementation steps

1. Cancel when `res !== 'Yes'` (or explicitly `res === 'Cancel'`).
2. Optional follow-up (same commit only if small): improve paragraph lookup if rawContent matching is known flaky – **only if already diagnosing**; otherwise leave for a later pass.

### Verify

- [ ] Cancel aborts with no `updateParagraph` work.
- [ ] Yes still replaces.

**Version:** 3.0.0.b10  
**Commit message idea:** `fix(SearchExtensions): honour Cancel on replace confirmation (b10)`

---

## Fix 9 – `isNPAdvancedSyntaxAvailable` platform operator bug

**Files:** `helpers/search.js` (shared); touch SearchExtensions only for version/changelog of the beta that depends on it. Optionally unify build gate with flexi tooltip (`1429` vs helper thresholds).

### Problem

```js
if (!NotePlan?.environment?.platform === 'macOS')
// parsed as (!platform) === 'macOS' — always false
```

iOS branch (`>= 1426`) never runs; both platforms use macOS threshold (`>= 1344`).

### Implementation steps

1. Fix to `NotePlan?.environment?.platform !== 'macOS'` (or explicit iOS/iPadOS check matching product intent).
2. Confirm build floors: macOS ~1344, iOS ~1426 (per existing comments; verify against current NotePlan if needed).
3. Consider aligning flexiSearch’s hard-coded `>= 1429` with this helper to avoid three different gates.

### Verify

- [ ] On macOS vs iOS mocks/logic: correct boolean for a given buildVersion.
- [ ] No regression: modern macOS builds still true.

**Version:** 3.0.0.b11  
**Commit message idea:** `fix(SearchExtensions): correct isNPAdvancedSyntaxAvailable platform check (b11)`

---

## Suggested execution checklist (when implementing)

For each fix N:

1. Implement code + tests if cheap (especially pure helpers).
2. Update `plugin.json` version / releaseStatus / lastUpdateInfo briefly.
3. Add CHANGELOG `## [3.0.0.bN]` bullets.
4. Commit only related files with message focused on **why**.
5. Do **not** push.
6. Mark item done in this plan (checkbox below).

### Progress

- [ ] Fix 1 – Re-run / onOpen refresh → b3
- [ ] Fix 2 – Settings defaults → b4
- [ ] Fix 3 – Native path sync open tasks → b5
- [ ] Fix 4 – Period dates on legacy path → b6
- [ ] Fix 5 – flexiSearch para types → b7
- [ ] Fix 6 – flexiSearch prefs types → b8
- [ ] Fix 7 – Destination aliases → b9
- [ ] Fix 8 – Replace Cancel → b10
- [ ] Fix 9 – isNPAdvancedSyntaxAvailable → b11

---

## Out of scope for this plan (follow-ups)

- Full native/legacy post-process pipeline merge
- Deduplicate `reduceNoteAndLineArray` / `resultCounts` across modules
- Wildcard / case-sensitive multi-term FIXMEs in native path
- Native `date:` API issues (Eduard / API-side)
- Broader replace multi-term hardening
- Deleting large commented V1/V2 blocks (cleanup PR)

---

## Open decisions (resolve when executing if still unclear)

1. Internal destination name: keep `searchSpecificNote` with aliases, or rename all to `newnote`?
2. Emitted button label: keep “Re-run search” or restore “Refresh …” for README parity?
3. Item 9 shared-helper change: commit solely under SearchExtensions beta message, or separate `helpers:` commit plus plugin bump empty of logic?

Defaults if none specified:

1. Alias both destinations; internal remains `searchSpecificNote`.
2. Keep “Re-run search”; detect both labels.
3. One commit for fix 9 including `helpers/search.js` under the SearchExtensions beta commit (note shared impact in message body).
