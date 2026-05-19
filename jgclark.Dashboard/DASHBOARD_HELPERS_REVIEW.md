# Dashboard Helpers Code Review: Testability & Bugs

**Last updated:** 2026-05-17 (Dashboard v2.4.0.b36)  
**Primary file:** `src/dashboardHelpers.js` (~1440 lines)  
**Related:** `RELATIVE_DATES_CALL_CHAIN.md` (relative-date helper boundaries — Dashboard does not import `getRelativeDates` directly)

---

## Executive Summary

This document reviews `dashboardHelpers.js` for testability improvements and potential bugs. The code has several areas that make unit testing difficult, primarily due to tight coupling with global NotePlan APIs and mixed concerns (I/O operations mixed with business logic).

Since the original review, **two user-facing time-parsing bugs were fixed** (PM noon edge case, bounds-safe colon padding), **settings persistence I/O was partially extracted** to `dashboardPluginSettings.js`, and **`getOpenItemParasForTimePeriod()` was decomposed** into smaller helpers (`getMatchingCalendarNotes`, `getParagraphsFromCalendarNotes`, `filterOpenParagraphs`, `getReferencedOpenParagraphs`, `combineOrSeparateResults`, plus `getNoteFromPara()`).

---

## Status at a glance

| Item | Status |
|------|--------|
| PM time conversion (`12:00 PM` → `24:00`) | **Fixed** (~lines 1096–1100, 1145–1149) |
| `startTimeStr[1]` without length check | **Fixed** (~lines 1090, 1139) |
| Inconsistent error handling (`undefined` vs `[]`) | **Open** |
| `p.children` null-safety in `makeDashboardParas` | **Improved** (explicit check ~line 787) |
| Teamspace note resolution on referenced paras | **Improved** (`getNoteFromPara` ~lines 306–308) |
| Hard-coded `pluginID` | **Intentional** (see below) |
| Dependency injection for `DataStore` / `Editor` | **Open** |
| Jest coverage for filter/time helpers | **Partial** (see Testing strategy) |

---

## 🐛 BUGS FOUND

### 1. **PM Time Conversion Bug** — ✅ FIXED

**Location:** `extendParasToAddStartTimes()` (~lines 1096–1100), `getStartTimeFromPara()` (~lines 1145–1149)

**Was:** `12:00 PM` became `24:00`; `12:30 PM` became `24:30`.

**Fix in place:**

```javascript
if (startTimeStr.endsWith('PM')) {
  const hour = Number(startTimeStr.slice(0, 2))
  const adjustedHour = hour === 12 ? 12 : hour + 12
  startTimeStr = String(adjustedHour).padStart(2, '0') + startTimeStr.slice(2, 5)
}
```

**Test gap:** `src/__tests__/dashboardHelpers.test.js` covers `11:00 PM` → `23:00` but not **`12:00 PM` → `12:00`** or **`12:30 PM` → `12:30`**. Worth adding.

**Note:** `extendParasToAddStartTimes()` is marked *not currently used* in source; `getStartTimeFromPara()` is the active path (also duplicated in `@helpers/timeblocks.js` per JSDoc).

---

### 2. **Array Index Out of Bounds** — ✅ FIXED

**Location:** same two functions (~lines 1090, 1139)

**Was:** `startTimeStr[1] === ':'` without verifying length.

**Fix in place:**

```javascript
} else if (startTimeStr.length > 1 && startTimeStr[1] === ':') {
  startTimeStr = `0${startTimeStr}`
}
```

---

### 3. **Inconsistent Error Handling** — OPEN

**Location:** Multiple functions

**Issue:** Some functions return `undefined` on error, others return empty arrays/objects, making error handling inconsistent.

**Examples (current line refs):**

- `getDashboardSettings()` returns `undefined` on error (~line 150)
- `getLogSettings()` returns `undefined` on error (~line 249)
- `getNotePlanSettings()` returns `undefined` on error (~line 258 area)
- `makeDashboardParas()` returns `[]` on error (~line 860)
- `getOpenItemParasForTimePeriod()` returns `[[], []]` on error (~line 723)
- `getStartTimeFromPara()` returns `'(error)'` on error (~line 1156)

**Recommendation:** Standardize error handling — either throw errors or return consistent error objects / Result types.

---

### 4. **Potential Null Reference in `makeDashboardParas`** — IMPROVED

**Location:** ~line 787

**Current code:**

```javascript
const anyChildren = (typeof p.children === 'function' && p.children != null) ? (p.children() ?? []) : []
```

**Status:** More explicit than the original review; low risk. Optional: extract `safeChildren(p)` if reused elsewhere.

---

### 5. **Note lookup on referenced paragraphs** — IMPROVED

**Location:** `getReferencedOpenParagraphs()` (~lines 589–593), via `getNoteFromPara()` (~lines 306–308)

**Was:** Repeated `p.note ?? getNoteFromFilename(...)` pattern.

**Status:** Centralized in `getNoteFromPara()` with null guard before `isNoteFromAllowedTeamspace()`. No further action required unless more call sites appear.

---

## Related modules (not in `dashboardHelpers.js`)

| Module | Role |
|--------|------|
| `src/dashboardPluginSettings.js` | `loadDashboardPluginSettings` / `saveDashboardPluginSettings` — settings.json I/O used by `getDashboardSettings` / `saveDashboardSettings` |
| `src/dashboardSettingsClean.js` | Structural sanitization on save / `repairDashboardSettings` (v2.4.0.b35+) |
| `@helpers/noteChooserFilenameResolve` | Resolves `<today>`, `<thisweek>`, etc. for Add Task / `getHeadings` (uses **sync** `@helpers/NPdateTime`) |
| `@helpers/NPDateStrings` | **Async** relative-date listing for NoteChooser (via np.Shared — see `RELATIVE_DATES_CALL_CHAIN.md`) |

`dashboardHelpers.js` imports `getDueDateOrStartOfCalendarDate` from `@helpers/NPdateTime` only; it does **not** call either `getRelativeDates` implementation.

---

## 🧪 TESTABILITY ISSUES

### 1. **Direct Global Dependencies** — OPEN

**Issue:** Functions directly use global `DataStore`, `Editor`, `NotePlan` objects, making them hard to mock.

**Affected functions (representative):**

- `getDashboardSettings()` — via `loadDashboardPluginSettings()` → `DataStore`
- `saveDashboardSettings()` — same
- `getLogSettings()` — `DataStore.loadJSON()`
- `getNotePlanSettings()` — `DataStore.preference()`, `DataStore.defaultFileExtension`
- `getOpenItemParasForTimePeriod()` — `DataStore`, `Editor`, nested helpers
- `setPluginData()` — `getGlobalSharedData()`, `sendToHTMLWindow()`

**Partial mitigation:** Settings load/save paths now go through `dashboardPluginSettings.js`, which is easier to mock in isolation than the full `getDashboardSettings()` pipeline.

**Solution (unchanged):** Dependency injection for `DataStore` / `Editor` on key entry points, or extract pure processors + thin I/O wrappers.

---

### 2. **Hard-coded Plugin ID** — INTENTIONAL

**Location:** ~line 58

```javascript
const pluginID = 'jgclark.Dashboard' // normally this could come from pluginJson, but not doing so in case it causes issues with Projects plugin that calls Dashboard.
```

**Status:** Deliberate for cross-plugin stability (Projects plugin invokes Dashboard). Do **not** switch to `pluginJson['plugin.id']` without validating Projects integration.

---

### 3. **Mixed Concerns (I/O + Business Logic)** — PARTIALLY ADDRESSED

**Progress:**

- Settings I/O → `dashboardPluginSettings.js`
- `getOpenItemParasForTimePeriod()` split into focused helpers (see Executive Summary)
- `cloneDashboardSettingsBeforeSave()` is a pure-ish utility (~lines 288–298) with tests

**Still mixed:**

- `getDashboardSettings()` — load + defaults merge + migration + normalisation
- `makeDashboardParas()` — paragraph shaping + note/frontmatter access

**Solution (unchanged):** e.g. `processDashboardSettings(rawSettings)` as a pure function called after load.

---

### 4. **Side Effects in Pure Functions** — OPEN

Filter helpers (`isLineDisallowedByIgnoreTerms`, `filterParasByIgnoreTerms`, etc.) still call `logDebug` / `logTimer`. Optional logger parameter remains a reasonable refactor.

---

### 5. **Complex `getOpenItemParasForTimePeriod()`** — IMPROVED

The main export (~lines 673–725) now orchestrates smaller functions rather than holding ~186 lines of inline logic. Further extraction of `getNotePlanSettings()` / calendar note fetching would still help unit tests.

---

### 6. **Async Functions Without Proper Error Propagation** — OPEN

`getDashboardSettings()` still catches and returns `undefined`; callers must defensively handle missing settings.

---

### 7. **Mutable State in Section Builders** — OPEN

`createSectionOpenItemsFromParas()` still uses mutable indent/parent tracking (`lastIndent0ParentID`, etc.). Consider explicit state objects for easier edge-case tests.

---

## 📋 RECOMMENDATIONS FOR IMPROVEMENT

### High Priority

1. **Add Jest cases for noon PM** (`12:00 PM`, `12:30 PM`) in `getStartTimeFromPara` tests
2. **Extract pure `processDashboardSettings()`** from `getDashboardSettings()` for unit tests without mocks
3. **Standardize error returns** on settings loaders (document or use Result type)

### Medium Priority

4. **Dependency injection** for `DataStore` / `Editor` on `getOpenItemParasForTimePeriod` and settings loaders
5. **Optional logger** on filter helpers to silence logs in tests without `jest.spyOn`
6. **Further split** `makeDashboardParas()` — pure paragraph mapping vs note/frontmatter I/O

### Low Priority

7. **JSDoc examples** on complex exports
8. **Input validation** at public function boundaries
9. **Tests for `extendParasToAddStartTimes()`** if that export is ever re-enabled

---

## 🧪 TESTING STRATEGY

### Existing unit tests (`src/__tests__/dashboardHelpers.test.js`)

Last updated in file header: 2026-05-04 (v2.4.0.b31). Covered:

| Function | Tested? |
|----------|---------|
| `filterToOpenParagraphs` | ✅ |
| `filterBySchedulingRules` | ✅ |
| `filterParasByIgnoreTerms` | ✅ |
| `filterParasByIncludedCalendarSections` | ✅ |
| `filterParasByExcludedCalendarSections` | ✅ |
| `getStartTimeFromPara` | ✅ (missing noon-PM cases) |
| `cloneDashboardSettingsBeforeSave` | ✅ |
| `extendParasToAddStartTimes` | ❌ |
| `isLineDisallowedByIgnoreTerms` | ❌ |
| `isNoteFromAllowedTeamspace` | ❌ |
| `getDashboardSettings` | ❌ |
| `getOpenItemParasForTimePeriod` | ❌ |
| `makeDashboardParas` | ❌ |

Mocks: `@mocks/index` for `DataStore`, `Editor`, etc.; `jest.spyOn` on `@helpers/dev` log functions in `beforeEach`.

### Good candidates for new pure-function tests

- `isLineDisallowedByIgnoreTerms()`
- `isNoteFromAllowedTeamspace()`
- `getNoteFromPara()` (if exported or tested via `getReferencedOpenParagraphs` with mocked `getNoteFromFilename`)
- `mergeSections()`, `createSectionItemObject()`, `findSectionItems()`, `copyUpdatedSectionItemData()`

### Integration tests (with mocks)

- `getDashboardSettings()` — mock `loadDashboardPluginSettings`
- `getOpenItemParasForTimePeriod()` — mock `DataStore`, `Editor`, sub-helpers
- `makeDashboardParas()` — mock note / frontmatter helpers

### Example: noon PM regression test

```javascript
test('should return 12:00 from 12:00 PM', () => {
  const para = { content: 'Lunch 12:00 PM' }
  expect(getStartTimeFromPara(para)).toBe('12:00')
})

test('should return 12:30 from 12:30 PM', () => {
  const para = { content: 'Lunch 12:30 PM' }
  expect(getStartTimeFromPara(para)).toBe('12:30')
})
```

---

## 📝 NOTES

- `__mocks__/` and `src/__tests__/dashboardHelpers.test.js` provide the main automated coverage for this file.
- React/WebView tests live under `src/react/components/testing/` and are separate from plugin-side helpers.
- For **relative date** behaviour (Add Task NoteChooser, move handlers, perspective note picker), see **`RELATIVE_DATES_CALL_CHAIN.md`** — two different `getRelativeDates` implementations (`NPDateStrings` vs `NPdateTime`) must not be conflated.
- `getStartTimeFromPara` duplicates logic noted in `@helpers/timeblocks.js`; long-term consolidation would reduce drift risk.
