# Emoji Encoding Corruption Bug Report

**Date**: 2026-01-06  
**Reported by**: @dwertheimer  
**Issue**: Emoji characters (specifically 🧩) are being corrupted when data is transmitted from the plugin's JavaScript context to the React WebView's JavaScript context via `HTMLView.runJavaScript`.

## Summary

When a note title contains an emoji (e.g., "Dashboard Plugin 🧩"), the emoji is correctly preserved throughout the plugin's JavaScript context but becomes corrupted (e.g., "Dashboard Plugin ðŸ§©") when the data is transmitted to the React WebView via `HTMLView.runJavaScript` and `postMessage`.

## Evidence

### Correct Encoding (Plugin Context)
- **Location**: `sendToHTMLWindow :: JavaScript code to execute`
- **Title**: "Dashboard Plugin 🧩" (length=19, charCodes=68,97,115,104,98,111,97,114,100,32,80,108,117,103,105,110,32,55358,56809)
- **Status**: ✅ Correct UTF-16 surrogate pair (55358,56809 = U+1F9E9)

### Corrupted Encoding (WebView Context)
- **Location**: `[ENCODING DEBUG] In WebView JS - payloadData BEFORE postMessage`
- **Title**: "Dashboard Plugin ðŸ§©" (length=21, charCodes=68,97,115,104,98,111,97,114,100,32,80,108,117,103,105,110,32,240,376,167,169)
- **Status**: ❌ Corrupted - UTF-8 bytes (240,376,167,169) interpreted as Latin-1 characters

## Root Cause Analysis

The corruption occurs **between**:
1. Creating the JavaScript code string in the plugin context (correct emoji)
2. Executing that JavaScript code in the WebView context (corrupted emoji)

**Critical Finding**: The corruption happens **BEFORE** `postMessage` is called in the WebView. This means the issue is in how `HTMLView.runJavaScript` transmits/executes the JavaScript string from the plugin's JavaScript context to the WebView's JavaScript context.

## Technical Details

### Current Implementation
```javascript
// In helpers/HTMLView.js
const stringifiedPayload = JSON.stringify(dataWithUpdated) // Correct emoji here
const jsCodeToExecute = `
  (function() {
    const payloadDataString = ${JSON.stringify(stringifiedPayload)};
    const payloadData = JSON.parse(payloadDataString); // Corrupted emoji here
    window.postMessage({ type: '${actionType}', payload: payloadData }, '*');
  })();
`
await HTMLView.runJavaScript(jsCodeToExecute, windowIdToSend)
```

### The Problem
When `HTMLView.runJavaScript` executes the JavaScript string:
- The JavaScript string itself contains the correct emoji when created
- But when the string is transmitted/executed in the WebView, the emoji is already corrupted
- This suggests the issue is in how NotePlan's `HTMLView.runJavaScript` handles Unicode characters when transmitting JavaScript strings between contexts

## Logging Evidence

We've added extensive logging throughout the data flow:

1. ✅ **Plugin Context** - All logs show correct emoji (55358,56809)
   - `makeDashboardParas`
   - `createSectionOpenItemsFromParas`
   - `getTodaySectionData`
   - `getSomeSectionsData`
   - `sendToHTMLWindow :: BEFORE JSON.stringify`
   - `sendToHTMLWindow :: AFTER JSON.stringify`
   - `sendToHTMLWindow :: JavaScript code to execute`

2. ❌ **WebView Context** - All logs show corrupted emoji (240,376,167,169)
   - `[ENCODING DEBUG] In WebView JS - payloadDataString BEFORE JSON.parse` (if logged)
   - `[ENCODING DEBUG] In WebView JS - payloadData BEFORE postMessage`
   - `Root/onMessageReceived :: Raw event.data (stringified)`
   - `Root/onMessageReceived :: Payload BEFORE processing`

## Request for Investigation

**Eduard**, could you please investigate:

1. **How does `HTMLView.runJavaScript` transmit JavaScript strings?**
   - Does it use a specific encoding (UTF-8, UTF-16, etc.)?
   - Is there any string conversion/encoding happening during transmission?
   - Could there be a bug in how Unicode characters are handled?

2. **Is there a known issue with Unicode/emoji in `HTMLView.runJavaScript`?**
   - Have other plugins reported similar issues?
   - Is there a workaround or best practice for sending Unicode data?

3. **Potential Solutions**:
   - Should we use a different method to send data to the WebView?
   - Should we base64-encode the JSON string before embedding it?
   - Is there a way to ensure UTF-8 encoding is preserved?

## Workaround Attempts (Unsuccessful)

We've tried:
- ✅ Using `JSON.stringify()` to escape the JSON string before embedding (still corrupted)
- ✅ Using `JSON.parse()` in the WebView instead of direct embedding (still corrupted)
- ❌ The corruption happens during `HTMLView.runJavaScript` execution, not in our code

## Impact

- **Severity**: Medium - Affects display of note titles with emojis
- **Scope**: Any plugin using `HTMLView.runJavaScript` to send Unicode data to React WebViews
- **User Impact**: Note titles with emojis display incorrectly (e.g., "🧩" becomes "ðŸ§©")

## Next Steps

1. Wait for Eduard's investigation of `HTMLView.runJavaScript` Unicode handling
2. Consider alternative data transmission methods if `HTMLView.runJavaScript` has a known limitation
3. Document this limitation if it's a known issue with NotePlan's JavaScript bridge

---

**Note**: All temporary logging code has been documented in `ENCODING_DEBUG_LOGGING_TO_REMOVE.md` for cleanup once the issue is resolved.

