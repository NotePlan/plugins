# Temporary Encoding Debug Logging - TO REMOVE

This file tracks all temporary logging code added to debug emoji encoding corruption. Remove all of these once the issue is fixed.

## Files with Temporary Logging:

### 1. `helpers/HTMLView.js`
- **Function**: `sendToHTMLWindow`
- **Lines**: ~723-770
- **What to remove**: 
  - Logging block BEFORE JSON.stringify (checks data object)
  - Logging block AFTER JSON.stringify (checks stringified payload)

### 2. `helpers/HTMLView.js`
- **Function**: `getGlobalSharedData`
- **Lines**: ~772-788
- **What to remove**: Logging block that checks for emoji/corruption in data read from React

### 3. `jgclark.Dashboard/src/dashboardHelpers.js`
- **Function**: `makeDashboardParas`
- **Lines**: ~268-272
- **What to remove**: Logging block that checks for emoji/corruption in noteTitle

### 4. `jgclark.Dashboard/src/dashboardHelpers.js`
- **Function**: `setPluginData`
- **Lines**: ~823-836
- **What to remove**: Logging block that checks for emoji/corruption before sendToHTMLWindow

### 5. `jgclark.Dashboard/src/dashboardHelpers.js`
- **Function**: `mergeSections`
- **Lines**: ~850-875
- **What to remove**: Logging blocks before and after merge

### 6. `jgclark.Dashboard/src/refreshClickHandlers.js`
- **Function**: `refreshSomeSections`
- **Lines**: ~151-152, ~176-195
- **What to remove**: All `[ENCODING DEBUG]` logging statements

### 7. `np.Shared/src/requestHandlers/noteHelpers.js`
- **Function**: `convertNoteToOption`
- **Lines**: ~44-50
- **What to remove**: Logging block that checks for emoji/corruption in note title

### 8. `jgclark.Dashboard/src/react/components/ItemNoteLink.jsx`
- **Function**: `ItemNoteLink` component
- **Lines**: ~36-42
- **What to remove**: Logging block that checks for emoji/corruption when React receives title

### 9. `helpers/HTMLView.js`
- **Function**: `getGlobalSharedData`
- **Lines**: ~770-780
- **What to remove**: Logging block that checks for emoji/corruption when data is read back from React

### 10. `np.Shared/src/react/Root.jsx`
- **Function**: `onMessageReceived` (at the start, before parsing)
- **Lines**: ~270-290
- **What to remove**: Logging blocks that check raw event.data (stringified) before parsing

### 11. `np.Shared/src/react/Root.jsx`
- **Function**: `onMessageReceived` (UPDATE_DATA case)
- **Lines**: ~300-320
- **What to remove**: Logging blocks that check payload before processing, and when data is received and stored

### 12. `jgclark.Dashboard/src/dashboardHelpers.js`
- **Function**: `createSectionOpenItemsFromParas`
- **Lines**: ~936-950, ~950-960
- **What to remove**: Logging blocks before and after creating sectionItem objects

### 12. `jgclark.Dashboard/src/dataGenerationDays.js`
- **Function**: `getTodaySectionData`
- **Lines**: ~175-180, ~254-262, ~310-318
- **What to remove**: Logging blocks before creating section, after pushing section, and before return

### 13. `jgclark.Dashboard/src/dataGeneration.js`
- **Function**: `getSomeSectionsData`
- **Lines**: ~88-110, ~145-155
- **What to remove**: Logging blocks after getTodaySectionData returns, after pushing today sections, and before return

### 14. `helpers/HTMLView.js`
- **Function**: `sendToHTMLWindow` (JavaScript code execution)
- **Lines**: ~786-796, ~798-809, ~814-822
- **What to remove**: Logging blocks in the JavaScript code that executes in WebView (payloadDataString BEFORE JSON.parse, payloadData AFTER JSON.parse, messageObj BEFORE postMessage)

## Search Pattern to Find All:
Search for: `[ENCODING DEBUG]`

