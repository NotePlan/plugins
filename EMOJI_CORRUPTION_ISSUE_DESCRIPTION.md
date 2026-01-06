# Emoji Corruption Issue - Root Cause Analysis

## Summary

The emoji corruption issue (`🧩` → `ðŸ§©`) occurs during the transmission of data from the plugin's JavaScript context to the WebView's JavaScript context via `HTMLView.runJavaScript`. Once corrupted data is stored in the WebView, it propagates through all subsequent data operations, creating a self-perpetuating cycle of corruption.

## Evidence from Logs

### 1. Data Generation is Correct ✅

All logs from the plugin's data generation pipeline show the emoji is **correct**:
- `makeDashboardParas`: `"Dashboard Plugin 🧩"` (charCodes=55358,56809) ✅
- `createSectionOpenItemsFromParas`: `"Dashboard Plugin 🧩"` (charCodes=55358,56809) ✅
- `getTodaySectionData`: `"Dashboard Plugin 🧩"` (charCodes=55358,56809) ✅
- `getSomeSectionsData`: `"Dashboard Plugin 🧩"` (charCodes=55358,56809) ✅

**Conclusion**: The plugin's JavaScript context correctly handles Unicode emojis as UTF-16 surrogate pairs.

### 2. Corruption Occurs During Transmission ❌

The first appearance of corrupted data is in the WebView's JavaScript context:
- `Root/onMessageReceived`: `"Dashboard Plugin ðŸ§©"` (charCodes=240,376,167,169) ❌

**Timeline**:
1. Plugin generates correct data: `🧩` (UTF-16: 55358,56809)
2. Plugin calls `sendToHTMLWindow` → `HTMLView.runJavaScript`
3. JavaScript string is transmitted from plugin's JavaScriptCore to WebView's JavaScriptCore
4. **Corruption occurs during this transmission**
5. WebView receives corrupted data: `ðŸ§©` (Latin-1: 240,376,167,169)

**Conclusion**: The corruption happens in the `HTMLView.runJavaScript` bridge mechanism itself.

### 3. Corruption Propagates Through System 🔄

Once corrupted data is stored in the WebView's `globalSharedData`:
- Every subsequent `getGlobalSharedData` call returns corrupted data
- `setPluginData` reads corrupted data from WebView and merges it with new correct data
- The merge operation (`mergeSections`) combines corrupted existing data with correct new data
- The corrupted data "wins" because it's already in the WebView's storage
- This creates a self-perpetuating cycle: corrupted data → stored in WebView → read back → merged with new data → sent again → corrupted again

**Conclusion**: The corruption is not just a one-time issue, but a systemic problem that propagates through all data operations.

## Root Cause

The corruption occurs in the **`HTMLView.runJavaScript` bridge** when transmitting JavaScript strings from the plugin's JavaScriptCore environment to the WebView's JavaScriptCore environment.

### Technical Details

1. **Correct State (Plugin JavaScript Context)**:
   - Emoji: `🧩`
   - UTF-16 surrogate pair: `55358, 56809` (0xD83E, 0xDDE9)
   - JavaScript string representation: Correct UTF-16

2. **Transmission (HTMLView.runJavaScript)**:
   - The JavaScript string containing the JSON payload is transmitted
   - During transmission, the UTF-16 surrogate pair is incorrectly converted
   - The emoji bytes are misinterpreted as Latin-1 characters

3. **Corrupted State (WebView JavaScript Context)**:
   - Emoji: `ðŸ§©`
   - Latin-1 bytes: `240, 376, 167, 169` (0xF0, 0xF8, 0xA7, 0xA9)
   - These are the UTF-8 bytes `240, 159, 167, 169` (0xF0, 0x9F, 0xA7, 0xA9) interpreted as Latin-1

### Why This Happens

The `HTMLView.runJavaScript` mechanism appears to:
1. Convert the JavaScript string to a byte sequence (likely UTF-8)
2. Transmit those bytes to the WebView
3. Reconstruct the string in the WebView's JavaScript context
4. **But somewhere in this process, the byte encoding is misinterpreted**

The UTF-8 bytes for the emoji (`240, 159, 167, 169`) are being interpreted as Latin-1 characters (`240, 376, 167, 169`), where:
- `159` (0x9F) becomes `376` (0xF8) - this is the key corruption
- The other bytes remain the same but are now interpreted as Latin-1

## Impact

1. **Initial Corruption**: First `sendToHTMLWindow` call corrupts the emoji during transmission
2. **Storage**: Corrupted data is stored in WebView's `globalSharedData`
3. **Propagation**: All subsequent operations read corrupted data and merge it with new correct data
4. **Persistence**: The corruption persists across all data refresh cycles

## Solution Required

The fix must be implemented in the **`HTMLView.runJavaScript` bridge mechanism** (likely in Swift/Objective-C code that we don't have access to). The bridge needs to:

1. Properly handle Unicode characters when transmitting JavaScript strings
2. Ensure UTF-8 encoding is correctly interpreted on both sides
3. Preserve UTF-16 surrogate pairs through the transmission

## Workaround Attempts (Unsuccessful)

We attempted several workarounds in JavaScript:
- Manual Unicode escaping
- Double JSON.stringify
- Manual emoji encoding/decoding

None of these worked because the corruption occurs **during the transmission itself**, before the JavaScript code in the WebView even executes.

## Next Steps

1. **Report to Eduard**: This is a bug in the `HTMLView.runJavaScript` mechanism that requires a fix in the native Swift/Objective-C code
2. **Temporary Mitigation**: Consider avoiding emojis in note titles or implementing a workaround at the data source level (not recommended, as it limits functionality)
3. **Investigation**: Eduard needs to investigate how `HTMLView.runJavaScript` handles Unicode strings when bridging between JavaScriptCore environments

## Files Involved

- `helpers/HTMLView.js` - Contains `sendToHTMLWindow` which calls `HTMLView.runJavaScript`
- `np.Shared/src/react/Root.jsx` - Receives the corrupted data via `postMessage`
- `jgclark.Dashboard/src/dashboardHelpers.js` - `setPluginData` and `mergeSections` propagate the corruption
- `jgclark.Dashboard/src/refreshClickHandlers.js` - `refreshSomeSections` merges corrupted and correct data

## Logging Evidence

All logging shows:
- ✅ Plugin context: Correct emoji (charCodes=55358,56809)
- ❌ WebView context: Corrupted emoji (charCodes=240,376,167,169)
- 🔄 Propagation: Corrupted data from WebView merges with correct new data

The corruption is **definitively** occurring in the `HTMLView.runJavaScript` transmission bridge.

---

## Succinct Version for Discord

**Emoji Corruption Bug in `HTMLView.runJavaScript`**

Emojis in note titles (e.g., `🧩`) are being corrupted (`ðŸ§©`) when transmitted from plugin JS to WebView JS via `HTMLView.runJavaScript`.

**Evidence:**
- Plugin side: Emoji is correct `🧩` (UTF-16: 55358,56809)
- After `HTMLView.runJavaScript`: Corrupted `ðŸ§©` (Latin-1: 240,376,167,169)
- The UTF-8 bytes `240,159,167,169` are being misinterpreted as Latin-1 `240,376,167,169` (byte `159` → `376`)

**Root Cause:**
The corruption occurs in the native bridge code during string transmission between JavaScriptCore environments. The UTF-8 encoding is being incorrectly interpreted as Latin-1.

**Impact:**
Once corrupted, the data propagates through all operations because it's stored in WebView's `globalSharedData` and merged with new correct data.

**Fix Required:**
The `HTMLView.runJavaScript` bridge needs to properly handle Unicode/UTF-8 encoding when transmitting JavaScript strings. This requires a fix in the native Swift/Objective-C code.

**Logs show the corruption happens between:**
- Plugin: `sendToHTMLWindow` → `HTMLView.runJavaScript` (correct)
- WebView: `Root/onMessageReceived` (corrupted)

JavaScript workarounds don't work because the corruption occurs during the native bridge transmission itself.
