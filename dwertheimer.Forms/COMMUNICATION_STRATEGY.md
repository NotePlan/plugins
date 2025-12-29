# Bidirectional Communication Implementation for Forms Plugin

## Overview

This document describes the request/response communication pattern implemented between React components and the NotePlan plugin. This enables React components to make async requests to the plugin and receive responses, similar to a REST API.

## Implementation

### Architecture

The implementation uses a **Promise-based request/response pattern with correlation IDs** to enable async/await syntax in React components.

### React Side (FormView.jsx)

**1. Request Function (`requestFromPlugin`)**
- Located in `FormView.jsx` and exposed via `AppContext`
- Generates unique correlation IDs: `req-${Date.now()}-${randomString}`
- Stores Promise resolve/reject callbacks in a `Map` keyed by correlation ID
- Sends requests via `sendToPlugin` with `__requestType: 'REQUEST'` and `__correlationId`
- Returns a Promise that resolves when the response arrives
- Includes timeout handling (default: 10 seconds)

**2. Response Handler**
- Listens for `RESPONSE` messages via `window.addEventListener('message')`
- Looks up correlation ID in pending requests Map
- Resolves or rejects the Promise based on `success` flag
- Cleans up pending requests on component unmount

**Code Example:**
```javascript
const { requestFromPlugin } = useAppContext()

const loadFolders = async () => {
  try {
    const folders = await requestFromPlugin('getFolders', { excludeTrash: true })
    setFolders(folders)
  } catch (error) {
    console.error('Failed to load folders:', error)
  }
}
```

### Plugin Side (requestHandlers.js)

**1. Request Detection**
- `onFormSubmitFromHTMLView` checks for `data.__requestType === 'REQUEST'`
- Extracts `__correlationId` from request data
- Routes to appropriate handler based on `actionType`

**2. Handler Functions**
- Each handler (e.g., `getFolders`, `getNotes`, `getTeamspaces`, `createFolder`) returns a `RequestResponse` object:
  ```javascript
  {
    success: boolean,
    message?: string,
    data?: any
  }
  ```

**3. Response Sending**
- Plugin sends response via `sendToHTMLWindow(windowId, 'RESPONSE', {...})`
- Response includes:
  - `correlationId`: Matches the request correlation ID
  - `success`: Boolean indicating success/failure
  - `data`: Response data (on success)
  - `error`: Error message (on failure)

**Code Example:**
```javascript
export function getFolders(params: { excludeTrash?: boolean } = {}): RequestResponse {
  try {
    const folders = getFoldersMatching([], false, exclusions, false, true)
    return {
      success: true,
      data: folders
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to get folders: ${error.message}`,
      data: null
    }
  }
}
```

### Message Flow

1. **React → Plugin:**
   ```
   React: requestFromPlugin('getFolders', { excludeTrash: true })
   → Generates correlationId: "req-1234567890-abc123"
   → Sends: { __requestType: 'REQUEST', __correlationId: 'req-...', excludeTrash: true }
   → Plugin receives via onFormSubmitFromHTMLView('getFolders', data)
   ```

2. **Plugin → React:**
   ```
   Plugin: sendToHTMLWindow(windowId, 'RESPONSE', {
     correlationId: 'req-1234567890-abc123',
     success: true,
     data: ['/', 'Projects', 'Archive', ...]
   })
   → React receives via window message event
   → Looks up correlationId in pendingRequests Map
   → Resolves Promise with data
   ```

### Available Request Handlers

- **`getFolders`**: Returns array of folder paths
  - Params: `{ excludeTrash?: boolean }`
  - Returns: `Array<string>`

- **`getNotes`**: Returns array of note options with decoration info
  - Params: `{ includeCalendarNotes?: boolean }`
  - Returns: `Array<NoteOption>`

- **`getTeamspaces`**: Returns array of teamspace definitions
  - Params: `{}`
  - Returns: `Array<TTeamspace>`

- **`createFolder`**: Creates a new folder
  - Params: `{ folderPath: string, parentFolder?: string }`
  - Returns: `{ success: boolean, folderPath?: string, error?: string }`

### Error Handling

- **Timeouts**: Requests timeout after 10 seconds (configurable)
- **Plugin Errors**: Handled in `handleRequest` catch block, sends error response
- **React Errors**: Caught in try/catch blocks around `requestFromPlugin` calls

### Performance Optimizations

- **Request Animation Frame**: Uses `requestAnimationFrame` to yield to browser before resolving promises
- **Diagnostic Logging**: `[DIAG]` logs track request/response timing for performance analysis
- **Cleanup**: Pending requests are cleaned up on component unmount to prevent memory leaks

### Backward Compatibility

- Existing fire-and-forget actions continue to work via `sendActionToPlugin`
- Only requests with `__requestType: 'REQUEST'` trigger the response pattern
- All other messages continue to use the existing one-way communication

### Usage in Components

**FormBuilder.jsx:**
- Loads folders and notes dynamically when form contains `folder-chooser` or `note-chooser` fields
- Uses `useCallback` and `useEffect` to prevent infinite loops

**FormView.jsx:**
- Loads folders and notes dynamically when form contains chooser fields
- Passes `requestFromPlugin` to `DynamicDialog` for use by chooser components

**FolderChooser.jsx:**
- Uses `requestFromPlugin` to load teamspaces for decoration
- Uses `requestFromPlugin` to create new folders

### Testing

- **`testRequestHandlers`**: Command to test all request handlers directly (no React)
- **`testFormFieldRender`**: Opens a test form with all field types to verify rendering

## Future Enhancements

- Add retry logic for failed requests
- Add request cancellation support
- Add request queuing for rate limiting
- Add middleware for request/response transformation