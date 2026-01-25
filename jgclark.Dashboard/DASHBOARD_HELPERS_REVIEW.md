# Dashboard Helpers Code Review: Testability & Bugs

## Executive Summary

This document reviews `dashboardHelpers.js` for testability improvements and potential bugs. The code has several areas that make unit testing difficult, primarily due to tight coupling with global NotePlan APIs and mixed concerns (I/O operations mixed with business logic).

---

## 🐛 BUGS FOUND

### 1. **PM Time Conversion Bug (Line 780)**
**Location:** `extendParasToAddStartTimes()` function
**Issue:** When converting PM times, the code adds 12 to the hour, but doesn't handle 12:00 PM correctly.

```javascript
if (startTimeStr.endsWith('PM')) {
  startTimeStr = String(Number(startTimeStr.slice(0, 2)) + 12) + startTimeStr.slice(2, 5)
}
```

**Problem:** 
- `12:00 PM` becomes `24:00` (should be `12:00`)
- `12:30 PM` becomes `24:30` (should be `12:30`)

**Fix:**
```javascript
if (startTimeStr.endsWith('PM')) {
  const hour = Number(startTimeStr.slice(0, 2))
  const adjustedHour = hour === 12 ? 12 : hour + 12
  startTimeStr = String(adjustedHour) + startTimeStr.slice(2, 5)
}
```

**Same bug exists in:** `getStartTimeFromPara()` function (line 823)

---

### 2. **Array Index Out of Bounds (Line 816)**
**Location:** `getStartTimeFromPara()` function
**Issue:** Checking `startTimeStr[1]` without verifying the string length.

```javascript
if (startTimeStr[1] === ':') {
  startTimeStr = `0${startTimeStr}`
}
```

**Problem:** If `startTimeStr` is empty or has length < 2, this will access an undefined index.

**Fix:**
```javascript
if (startTimeStr.length > 0 && startTimeStr[1] === ':') {
  startTimeStr = `0${startTimeStr}`
}
```

**Same issue exists in:** `extendParasToAddStartTimes()` function (line 773)

---

### 3. **Inconsistent Error Handling**
**Location:** Multiple functions
**Issue:** Some functions return `undefined` on error, others return empty arrays/objects, making error handling inconsistent.

**Examples:**
- `getDashboardSettings()` returns `undefined` on error (line 126)
- `getLogSettings()` returns `undefined` on error (line 169)
- `getNotePlanSettings()` returns `undefined` on error (line 191)
- `makeDashboardParas()` returns `[]` on error (line 329)

**Recommendation:** Standardize error handling - either throw errors or return consistent error objects.

---

### 4. **Potential Null Reference (Line 249)**
**Location:** `makeDashboardParas()` function
**Issue:** Type checking `p.children` but then calling it as a function without re-checking.

```javascript
const anyChildren = (typeof p.children === 'function') ? (p.children() ?? []) : []
```

**Problem:** If `p.children` is `null` or `undefined`, the type check passes but the function call could still fail in edge cases.

**Fix:** Already handled correctly, but could be more explicit:
```javascript
const anyChildren = (typeof p.children === 'function' && p.children) ? (p.children() ?? []) : []
```

---

### 5. **Missing Null Check (Line 508)**
**Location:** `getOpenItemParasForTimePeriod()` function
**Issue:** Accessing `p.note` without null check in filter.

```javascript
refOpenParas = refOpenParas.filter((p) => {
  const note = p.note ?? getNoteFromFilename(p.filename ?? '') ?? null
  if (!note) return false
  return isNoteFromAllowedTeamspace(note, allowedTeamspaceIDs)
})
```

**Status:** Actually handled correctly with null coalescing, but the pattern is repeated multiple times and could be extracted to a helper function.

---

## 🧪 TESTABILITY ISSUES

### 1. **Direct Global Dependencies**
**Issue:** Functions directly use global `DataStore`, `Editor`, `NotePlan` objects, making them hard to mock.

**Affected Functions:**
- `getDashboardSettings()` - uses `DataStore.loadJSON()`
- `saveDashboardSettings()` - uses `DataStore.loadJSON()`, `saveSettings()`
- `getLogSettings()` - uses `DataStore.loadJSON()`
- `getNotePlanSettings()` - uses `DataStore.preference()`, `DataStore.defaultFileExtension`
- `getOpenItemParasForTimePeriod()` - uses `DataStore.calendarNoteByDateString()`, `DataStore.teamspaces`, `Editor`
- `setPluginData()` - uses `getGlobalSharedData()`, `sendToHTMLWindow()`

**Solution:** Use dependency injection pattern:
```javascript
// Instead of:
export async function getDashboardSettings(): Promise<TDashboardSettings> {
  const pluginSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
  // ...
}

// Use:
export async function getDashboardSettings(
  dataStore: typeof DataStore = DataStore
): Promise<TDashboardSettings> {
  const pluginSettings = await dataStore.loadJSON(`../${pluginID}/settings.json`)
  // ...
}
```

---

### 2. **Hard-coded Plugin ID**
**Location:** Line 48
**Issue:** Plugin ID is hard-coded as a constant, but should come from `pluginJson`.

```javascript
const pluginID = 'jgclark.Dashboard' // pluginJson['plugin.id']
```

**Problem:** The comment suggests it should use `pluginJson['plugin.id']`, but it doesn't. This makes testing harder if you need to test with different plugin IDs.

**Fix:**
```javascript
const pluginID = pluginJson['plugin.id'] ?? 'jgclark.Dashboard'
```

---

### 3. **Mixed Concerns (I/O + Business Logic)**
**Issue:** Functions combine I/O operations with business logic, making them hard to test in isolation.

**Examples:**
- `getDashboardSettings()` - loads from DataStore AND processes/validates settings
- `getOpenItemParasForTimePeriod()` - fetches notes AND filters/processes paragraphs
- `makeDashboardParas()` - processes paragraphs AND accesses note properties

**Solution:** Split into pure functions and I/O functions:
```javascript
// Pure function (easy to test)
export function processDashboardSettings(rawSettings: any): TDashboardSettings {
  // All the processing logic here
}

// I/O function (can be mocked)
export async function getDashboardSettings(): Promise<TDashboardSettings> {
  const rawSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
  return processDashboardSettings(rawSettings)
}
```

---

### 4. **Side Effects in Pure Functions**
**Issue:** Functions that should be pure have logging side effects.

**Affected Functions:**
- `isLineDisallowedByIgnoreTerms()` - has `logDebug()` calls
- `filterParasByIgnoreTerms()` - has `logTimer()` calls
- Most filter functions have logging

**Solution:** Extract logging to a separate layer or make it optional:
```javascript
export function isLineDisallowedByIgnoreTerms(
  lineContent: string,
  ignoreItemsWithTerms: string,
  logger?: { debug: (msg: string) => void }
): boolean {
  // ... logic
  if (logger) {
    logger.debug(`- DID find excluding term(s)...`)
  }
  return matchFound
}
```

---

### 5. **Complex Function with Many Dependencies**
**Issue:** `getOpenItemParasForTimePeriod()` is a large function (186 lines) with many dependencies and responsibilities.

**Dependencies:**
- `DataStore.calendarNoteByDateString()`
- `DataStore.teamspaces`
- `Editor`
- `getNotePlanSettings()`
- Multiple filter functions
- `makeDashboardParas()`
- `getReferencedParagraphs()`
- `eliminateDuplicateParagraphs()`

**Solution:** Break into smaller, testable functions:
```javascript
// Extract calendar note fetching
function getCalendarNotesForDate(dateStr: string, teamspaces: Array<any>): Array<TNote> {
  // ...
}

// Extract filtering logic
function filterOpenParas(paras: Array<TParagraph>, settings: TDashboardSettings): Array<TParagraph> {
  // ...
}

// Main function composes smaller functions
export function getOpenItemParasForTimePeriod(...) {
  const notes = getCalendarNotesForDate(NPCalendarFilenameStr, DataStore.teamspaces)
  const paras = getParasFromNotes(notes, useEditorWherePossible)
  const filteredParas = filterOpenParas(paras, dashboardSettings)
  // ...
}
```

---

### 6. **Async Functions Without Proper Error Propagation**
**Issue:** Some async functions catch errors but don't propagate them properly.

**Example:** `getDashboardSettings()` catches errors and returns `undefined`, but callers might not expect this.

**Solution:** Either throw errors or return a Result type:
```javascript
type Result<T> = { success: true, data: T } | { success: false, error: Error }

export async function getDashboardSettings(): Promise<Result<TDashboardSettings>> {
  try {
    // ... logic
    return { success: true, data: parsedDashboardSettings }
  } catch (err) {
    return { success: false, error: err }
  }
}
```

---

### 7. **Functions That Are Hard to Test Due to Internal State**
**Issue:** `createSectionOpenItemsFromParas()` uses mutable state (`lastIndent0ParentID`, etc.) making it harder to test edge cases.

**Solution:** Consider making the state explicit or breaking into smaller functions.

---

## 📋 RECOMMENDATIONS FOR IMPROVEMENT

### High Priority

1. **Fix PM time conversion bug** (affects user-facing functionality)
2. **Fix array index bounds check** (prevents potential crashes)
3. **Extract pure functions** from I/O functions for `getDashboardSettings()`, `makeDashboardParas()`
4. **Add dependency injection** for `DataStore`, `Editor` in key functions

### Medium Priority

5. **Standardize error handling** across all functions
6. **Break down `getOpenItemParasForTimePeriod()`** into smaller functions
7. **Use pluginJson for plugin ID** instead of hard-coded string
8. **Extract logging** to optional parameter or separate layer

### Low Priority

9. **Add JSDoc examples** for complex functions
10. **Consider Result types** for better error handling
11. **Add input validation** at function boundaries

---

## 🧪 TESTING STRATEGY

### Unit Tests (Pure Functions)
These can be tested easily with Jest:
- `isLineDisallowedByIgnoreTerms()`
- `isNoteFromAllowedTeamspace()`
- `getStartTimeFromPara()` (after fixing bugs)
- `extendParasToAddStartTimes()` (after fixing bugs)
- `mergeSections()`
- `createSectionItemObject()` (with mocked `getNoteFromFilename()`)
- `findSectionItems()`
- `copyUpdatedSectionItemData()`

### Integration Tests (With Mocks)
These require mocking NotePlan APIs:
- `getDashboardSettings()` - mock `DataStore.loadJSON()`
- `saveDashboardSettings()` - mock `DataStore.loadJSON()`, `saveSettings()`
- `getOpenItemParasForTimePeriod()` - mock `DataStore`, `Editor`, helper functions
- `makeDashboardParas()` - mock note objects and helper functions

### Test Examples

```javascript
// Example: Testing pure function
describe('isLineDisallowedByIgnoreTerms', () => {
  test('should return true when line contains ignore term', () => {
    const result = isLineDisallowedByIgnoreTerms('Task with @ignore', '@ignore')
    expect(result).toBe(true)
  })
  
  test('should return false when line does not contain ignore term', () => {
    const result = isLineDisallowedByIgnoreTerms('Normal task', '@ignore')
    expect(result).toBe(false)
  })
})

// Example: Testing with mocked DataStore
describe('getDashboardSettings', () => {
  test('should return defaults when settings are empty', async () => {
    DataStore.loadJSON = jest.fn().mockResolvedValue({ dashboardSettings: {} })
    const settings = await getDashboardSettings()
    expect(settings.showTodaySection).toBe(true) // default value
  })
})
```

---

## 📝 NOTES

- The codebase already has some test infrastructure in place (`__mocks__/` directory)
- Some functions like `getStartTimeFromPara()` already have tests
- Consider using a testing library that supports dependency injection (like `inversify` or manual DI)
- The React components have their own testing setup, which is separate from these helper functions
