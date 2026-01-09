# Changes Since Last Commit (9dec5c9b)

This document lists all changes made since the last commit to help re-apply them incrementally.

## Core Functionality Changes (Should Keep)

### 1. **New File: `helpers/react/DynamicDialog/useRequestWithRetry.js`**
   - **Purpose**: Reusable hook for managing request/retry logic with retry limiting
   - **Used by**: HeadingChooser, NoteChooser, FolderChooser
   - **Key features**:
     - Automatic retry with max retry limit
     - AbortController support (with availability check)
     - Request deduplication via identifier tracking
     - Response validation
   - **Status**: ✅ Safe to keep - core functionality

### 2. **`helpers/react/reactUtils.js` - `calculatePortalPosition` function**
   - **Purpose**: Reusable utility for positioning portaled elements within viewport
   - **Used by**: NoteChooser, SearchableChooser, ToolTipOnModifierPress (noted for future)
   - **Key features**:
     - Calculates position to keep dropdown/portal on screen
     - Handles viewport boundaries
     - Returns `{ top, left }` with `position: fixed`
   - **Status**: ✅ Safe to keep - core functionality

### 3. **`helpers/NPdateTime.js` - React/WebView environment checks**
   - **Purpose**: Prevent direct calls to NotePlan APIs (DataStore, Calendar) from React/WebView
   - **Key changes**:
     - `getRelativeDates`: Early return for React environment, uses `moment` instead of `DataStore.calendarNoteByDateString`
     - `getNPWeekData`: Uses `moment` if `Calendar` API not available
     - Lazy evaluation: Converted module-level constants (`relativeDatesISO`, `relativeDatesNP`) to functions
     - `getDateStrFromRelativeDateString` and `displayTitleWithRelDate`: Call `computeRelativeDatesIfNeeded`
   - **Status**: ✅ Safe to keep - prevents crashes

### 4. **`helpers/react/DynamicDialog/NoteChooser.jsx` - Calendar picker and date formatting**
   - **Purpose**: Add calendar icon button and DayPicker integration
   - **Key changes**:
     - Import `DayPicker` from `react-day-picker`
     - Import `calculatePortalPosition` from `reactUtils.js`
     - `getCalendarNoteDisplay`: Helper to format calendar note titles/descriptions
     - Calendar chooser icon button with `showCalendarChooserIcon` prop
     - `DayPicker` component portaled with `calculatePortalPosition`
     - Date formatting for `value` prop: `isDateString` and `formatDateStringForDisplay` for "pretty dates"
     - Strip `note` property from `relativeDates` for serialization safety
   - **Status**: ✅ Safe to keep - core functionality

### 5. **`helpers/react/DynamicDialog/SearchableChooser.jsx` - Portal positioning**
   - **Purpose**: Use `calculatePortalPosition` helper
   - **Key changes**:
     - Import `calculatePortalPosition` from `reactUtils.js`
     - Refactor `calculateDropdownPosition` to use `calculatePortalPosition`
   - **Status**: ✅ Safe to keep - core functionality

### 6. **`jgclark.Dashboard/src/react/components/Header/AddToAnyNote.jsx` - Request/response pattern and error handling**
   - **Purpose**: Convert submit to request/response pattern, add error banner, improve date handling
   - **Key changes**:
     - `handleSave`: Convert to `async`, use `requestFromPlugin('addTaskToNote', ...)` with request/response
     - Success/error banner display using `sendActionToPlugin('SHOW_BANNER', ...)`
     - `setErrorMessage` integration for validation errors
     - Date to calendar filename conversion if date selected but no note
     - Data sanitization in `requestFromPlugin` and `handleSave` (may need review - could be debug)
   - **Status**: ⚠️ Mostly safe, but data sanitization might be debug/defense

### 7. **`jgclark.Dashboard/src/reactMain.js` - `addTaskToNote` handler**
   - **Purpose**: Backend handler for `addTaskToNote` command
   - **Key changes**:
     - New case in `routeDashboardRequest` for `addTaskToNote`
     - Sends success `MessageBanner` with JSON stringify of content and note to `@jgclark`
   - **Status**: ✅ Safe to keep - core functionality

### 8. **`np.Shared/src/requestHandlers/noteHelpers.js` - Relative date formatting**
   - **Purpose**: Use helper functions for relative date display
   - **Key changes**:
     - `relNameToTemplateRunnerFormat`: Maps relative date names to TemplateRunner format
     - `getRelativeNotesAsOptions`: Uses `rd.relName` for `title` and `rd.dateStr` for `option.decoration.shortDescription`
   - **Status**: ✅ Safe to keep - core functionality

### 9. **`helpers/react/DynamicDialog/DynamicDialog.jsx` - Error banner and async onSave**
   - **Purpose**: Support error message display and async `onSave` handlers
   - **Key changes**:
     - `onSave` prop type updated to allow `Promise<void>` return
     - `errorMessage?: ?string` prop added
     - Error banner rendering
   - **Status**: ✅ Safe to keep - core functionality

### 10. **Tooltip component notes**
   - **Files**: `jgclark.Dashboard/src/react/components/ToolTipOnModifierPress.jsx`, `jgclark.Dashboard/src/react/components/Tooltip.jsx`
   - **Purpose**: Notes suggesting future utility for mouse-related portals
   - **Status**: ✅ Safe to keep - documentation only

### 11. **`np.Shared/src/react/Root.jsx` - Remove emoji encoding debug code**
   - **Purpose**: Cleanup - removed emoji encoding debug logging
   - **Key changes**: Removed `[ENCODING DEBUG]` logging blocks
   - **Status**: ✅ Safe to keep - cleanup of debug code

### 12. **`jgclark.Dashboard/src/react/components/ItemNoteLink.jsx` - Remove emoji encoding debug code**
   - **Purpose**: Cleanup - removed emoji encoding debug logging
   - **Key changes**: Removed `[ENCODING DEBUG]` logging and commented out verbose logDebug
   - **Status**: ✅ Safe to keep - cleanup of debug code

### 13. **`helpers/react/DynamicDialog/dialogElementRenderer.js` - Calendar icon prop**
   - **Purpose**: Support calendar chooser icon in NoteChooser
   - **Key changes**: Added `showCalendarChooserIcon={item.showCalendarChooserIcon ?? true}` prop
   - **Status**: ✅ Safe to keep - core functionality

### 12. **Misc file deletions/cleanup**
   - `jgclark.Dashboard/src/dataGeneration.js` - deleted (moved logic elsewhere?)
   - `jgclark.Dashboard/src/dataGenerationDays.js` - deleted (moved logic elsewhere?)
   - `jgclark.Dashboard/src/refreshClickHandlers.js` - deleted (moved logic elsewhere?)
   - `jgclark.Dashboard/src/react/components/ItemNoteLink.jsx` - modified (need to check)
   - **Status**: ⚠️ Need to verify - might be cleanup or might be related to crash

---

## Debug/Defense Code (Should Move to Branch)

### 1. **`helpers/dev.js` - Log padding**
   - **Purpose**: Force buffer flushing during crashes
   - **Change**: Added `PADDING = 'P'.repeat(1000)` and `console.log(PADDING)` calls
   - **Status**: ❌ Debug code - move to branch

### 2. **`helpers/react/reactDev.js` - Log padding**
   - **Purpose**: Force buffer flushing during crashes
   - **Change**: Added `LOG_PADDING = 'P'.repeat(1000)` and `console.log(LOG_PADDING)` calls
   - **Status**: ❌ Debug code - move to branch

### 3. **`np.Shared/requiredFiles/pluginToHTMLCommsBridge.js` - Aggressive sanitization and logging**
   - **Purpose**: Prevent `NSJSONSerialization` crashes by sanitizing data before sending to Swift
   - **Key changes**:
     - Enhanced `normalizeStringEncoding`: Handles `undefined`, `NaN`, `Infinity`, functions, symbols, `RegExp`, `Error` objects, circular references, NotePlan `TNote` objects
     - `safeReplacer` function for `JSON.stringify`
     - Try-catch around `JSON.stringify` and `postMessage`
     - Extensive logging (entry point logging, pre-postMessage logging)
     - `PADDING` constant for buffer flushing
   - **Status**: ⚠️ Core sanitization needed, but extensive logging is debug - needs review

### 4. **`np.Shared/requiredFiles/pluginToHTMLErrorBridge.js` - Console method overrides**
   - **Purpose**: Route React `console.log` calls to NotePlan console
   - **Key changes**:
     - Initial load logging
     - Override `console.log`, `console.error`, `console.warn`, `console.info`, `console.debug`
     - Route to `window.webkit.messageHandlers.error.postMessage`
   - **Status**: ⚠️ Might be needed for React logs - need to verify if it's causing crash

### 5. **`np.Shared/src/NPReactLocal.js` - Window.webkit access and logging**
   - **Purpose**: Logging during initial data preparation (but `window` doesn't exist in plugin JSContext)
   - **Key changes**:
     - Try-catch around `JSON.stringify(globalSharedData)` with logging
     - Embedded script logging (should be fine - that's in HTML context)
     - Attempted `window.webkit` access during plugin-side execution (REMOVED - this was the crash)
   - **Status**: ⚠️ Embedded script logging is fine, but plugin-side `window` access was problematic (now fixed)

---

## Summary

### Safe to Commit (Core Functionality):
1. `useRequestWithRetry.js` (new file)
2. `calculatePortalPosition` in `reactUtils.js`
3. `NPdateTime.js` environment checks
4. `NoteChooser.jsx` calendar picker changes
5. `SearchableChooser.jsx` portal positioning
6. `AddToAnyNote.jsx` request/response pattern (review sanitization)
7. `reactMain.js` `addTaskToNote` handler
8. `noteHelpers.js` relative date formatting
9. `DynamicDialog.jsx` error banner support
10. Tooltip component notes

### Move to Branch (Debug/Defense):
1. Log padding in `dev.js` and `reactDev.js`
2. Extensive logging in `pluginToHTMLCommsBridge.js` (but keep core sanitization)
3. Console method overrides in `pluginToHTMLErrorBridge.js` (might be needed - test)
4. Problematic `window` access in `NPReactLocal.js` (already fixed)

### Needs Review:
1. `Root.jsx` changes
2. Deleted files - were they needed?
3. `ItemNoteLink.jsx` changes
4. Data sanitization in `AddToAnyNote.jsx` - is it debug or needed?

