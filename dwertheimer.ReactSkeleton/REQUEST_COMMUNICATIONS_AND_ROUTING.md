# Request Communications and Routing Guide

This document explains the complete request/response communication pattern and routing system for React-based NotePlan plugins.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [React Side Implementation](#react-side-implementation)
- [Plugin Side Implementation](#plugin-side-implementation)
- [File Structure](#file-structure)
- [Adding New Handlers](#adding-new-handlers)
- [Message Flow](#message-flow)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Complete Examples](#complete-examples)
- [Performance Optimizations](#performance-optimizations)

## Overview

The ReactSkeleton uses a **Promise-based request/response pattern with correlation IDs** to enable async/await syntax in React components. This allows React components to make async requests to the plugin and receive responses, similar to a REST API.

**Do not use raw `Promise.resolve`, `Promise.all`, or `Promise.race` in plugin code—NotePlan's JSContext may not have them. Use polyfills from `@helpers/promisePolyfill.js` (`promiseResolve`, `promiseAll`, `promiseRace`).**

### Communication Patterns

The system supports two patterns:

1. **REQUEST/RESPONSE Pattern** - For operations that need data back from the plugin
   - React calls `requestFromPlugin()` and awaits the response
   - Plugin processes the request and sends a response back
   - Uses correlation IDs to match requests with responses

2. **Action Pattern** - For fire-and-forget operations
   - React calls `sendActionToPlugin()` without awaiting
   - Plugin processes the action and may update window data
   - No response expected (backward compatible)

## Architecture

### Core Components

1. **`newCommsRouter`** (`@helpers/react/routerUtils.js`) - Factory function that creates the router
2. **Router** (`src/routeRequestsFromReact.js`) - Routes messages to handlers using `newCommsRouter`
3. **Request Handlers** (`src/requestHandlers/*.js`) - Individual handler files (one per handler)
4. **React Context** - Provides `requestFromPlugin()` and `sendActionToPlugin()` functions

### Key Features

- **Automatic REQUEST/RESPONSE handling** - Router detects request type and manages correlation IDs
- **Automatic fallback to np.Shared handlers** - Shared handlers (getFolders, getNotes, etc.) are available automatically
- **Consistent error handling** - All handlers return `{ success, data?, message? }`
- **Proper window ID management** - Automatically injects `__windowId` if not present
- **Timeout handling** - Requests timeout after 10 seconds (configurable)

## React Side Implementation

### Request Function (`requestFromPlugin`)

Located in Root.jsx (from np.Shared) and exposed via `AppContext`. This function:

- Generates unique correlation IDs: `req-${Date.now()}-${randomString}`
- Stores Promise resolve/reject callbacks in a `Map` keyed by correlation ID
- Sends requests via `sendToPlugin` with `__requestType: 'REQUEST'` and `__correlationId`
- Returns a Promise that resolves when the response arrives
- Includes timeout handling (default: 10 seconds)

### Response Handler

Root.jsx listens for `RESPONSE` messages via `window.addEventListener('message')`:

- Looks up correlation ID in pending requests Map
- Resolves or rejects the Promise based on `success` flag
- Cleans up pending requests on component unmount

### Usage in React Components

```javascript
import { useAppContext } from './AppContext'

function MyComponent() {
  const { requestFromPlugin } = useAppContext()

  const loadFolders = async () => {
    try {
      const folders = await requestFromPlugin('getFolders', { excludeTrash: true })
      setFolders(folders)
    } catch (error) {
      console.error('Failed to load folders:', error)
    }
  }

  return (
    <button onClick={loadFolders}>Load Folders</button>
  )
}
```

### Action Pattern (Fire-and-Forget)

For operations that don't need a response:

```javascript
const { sendActionToPlugin } = useAppContext()

function handleSubmit() {
  sendActionToPlugin('onSubmitClick', { index: 0 })
  // No await needed - fire and forget
}
```

**Note:** Root.jsx automatically injects `__windowId` from `globalSharedData.pluginData?.windowId` if not present.

## Plugin Side Implementation

### Router Architecture

**The router MUST use `newCommsRouter` from `@helpers/react/routerUtils.js`** - do not implement the router manually.

### Router Function

The main router function is created using `newCommsRouter`:

```javascript
import { newCommsRouter } from '@helpers/react/routerUtils'
import { addTaskToNote } from './requestHandlers/addTaskToNote'
import { WEBVIEW_WINDOW_ID } from './constants'
import pluginJson from '../plugin.json'

// Route REQUEST type actions to appropriate handlers
// IMPORTANT: Use async/await pattern - do NOT use Promise.resolve (not available in React/WebView)
// Use await to support both sync and async handlers
async function routeRequest(actionType: string, data: any): Promise<RequestResponse> {
  switch (actionType) {
    case 'addTaskToNote':
      return await addTaskToNote(data, pluginJson)
    default:
      return {
        success: false,
        message: `Unknown request type: "${actionType}"`,
        data: null,
      }
  }
}

// Handle non-REQUEST actions (using sendActionToPlugin)
async function handleNonRequestAction(actionType: string, data: any): Promise<any> {
  // Handle actions that don't need a response
  // ...
  return {}
}

export const onMessageFromHTMLView = newCommsRouter({
  routerName: 'Dashboard/routeRequestsFromReact',
  defaultWindowId: WEBVIEW_WINDOW_ID,
  routeRequest: routeRequest,              // Routes REQUEST actions
  handleNonRequestAction: handleNonRequestAction,  // Routes non-REQUEST actions
  pluginJson: pluginJson,
  useSharedHandlersFallback: true,         // Enable automatic fallback to np.Shared handlers
})
```

### What newCommsRouter Provides

The `newCommsRouter` factory function handles:

1. **Request Detection** - Checks for `data.__requestType === 'REQUEST'`
2. **Correlation ID Extraction** - Extracts `__correlationId` from request data
3. **Handler Routing** - Calls `routeRequest()` with appropriate parameters
4. **Response Sending** - Sends response via `sendToHTMLWindow` with correlation ID
5. **Fallback Handling** - Falls back to np.Shared handlers if `useSharedHandlersFallback: true`
6. **Error Handling** - Catches errors and sends proper error responses

### Request Handler Structure

**Each handler should be in its own file** in the `requestHandlers/` folder. This keeps handlers organized and makes them easy to find and maintain.

Each handler:
- Takes parameters from the request
- Returns `{ success: boolean, data?: any, message?: string }`
- Has JSDoc explaining what it does
- Handles errors gracefully

Example (`requestHandlers/getFolders.js`):

```javascript
/**
 * Get list of folders (excluding trash by default)
 * 
 * @param {Object} params - Request parameters
 * @param {boolean} params.excludeTrash - Whether to exclude trash folder (default: true)
 * @returns {Promise<RequestResponse>} - Response with folders array
 */
export async function getFolders(params: { excludeTrash?: boolean } = {}): Promise<RequestResponse> {
  try {
    const { excludeTrash = true } = params
    const folders = getFoldersMatching([], excludeTrash)
    return {
      success: true,
      data: folders,
    }
  } catch (error) {
    return {
      success: false,
      message: `Error getting folders: ${error.message}`,
      data: null,
    }
  }
}
```

### Response Format

All handlers return a `RequestResponse` object:

```javascript
type RequestResponse = {
  success: boolean,
  data?: any,
  message?: string
}
```

Plugin sends response via `sendToHTMLWindow`:

```javascript
sendToHTMLWindow(windowId, 'RESPONSE', {
  correlationId: 'req-1234567890-abc123',
  success: true,
  data: ['/', 'Projects', 'Archive', ...]
})
```

## File Structure

```
src/
  routeRequestsFromReact.js  # Main router - uses newCommsRouter from @helpers/react/routerUtils
  requestHandlers/            # Folder containing individual handler files
    addTaskToNote.js         # Example handler file
    getFolders.js            # Another handler file
    ...                      # More handlers as needed
  reactMain.js               # Window management and initialization
  index.js                   # Exports router to plugin.json
```

## Adding New Handlers

### Step 1: Create Handler File

Create a new file in `requestHandlers/` folder (e.g., `requestHandlers/yourHandler.js`):

```javascript
import { logDebug, logError } from '@helpers/dev'

/**
 * Your handler description
 * 
 * @param {Object} params - Request parameters
 * @param {any} pluginJson - Plugin JSON object
 * @returns {Promise<RequestResponse>} - Response
 */
export async function yourHandler(params: any = {}, pluginJson: any): Promise<RequestResponse> {
  try {
    logDebug('yourHandler', `Processing request with params:`, params)
    
    // Your logic here
    const result = doSomething(params)
    
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    logError('yourHandler', `Error: ${error.message}`)
    return {
      success: false,
      message: `Error: ${error.message}`,
      data: null,
    }
  }
}
```

### Step 2: Import and Add to Router

In `routeRequestsFromReact.js`, import your handler and add a case to the `routeRequest()` switch statement:

```javascript
import { yourHandler } from './requestHandlers/yourHandler'

// IMPORTANT: routeRequest must be async - do NOT use Promise.resolve
// Use await to support both sync and async handlers
async function routeRequest(actionType: string, data: any): Promise<RequestResponse> {
  switch (actionType) {
    case 'yourHandler':
      return await yourHandler(data, pluginJson)  // Use await to support both sync and async handlers
    // ... other cases
    default:
      return {
        success: false,
        message: `Unknown request type: "${actionType}"`,
        data: null,
      }
  }
}
```

**Important Notes:**
- `routeRequest` must be an `async function` (not a regular function)
- Use `await` when calling handlers - this supports both sync and async handlers
- Do NOT use `Promise.resolve()` (it's not available in React/WebView)
- The `async` keyword automatically wraps return values in a Promise
- This matches the pattern used in `np.Shared/src/sharedRequestRouter.js`

### Step 3: Use from React

Call from React using `requestFromPlugin`:

```javascript
const result = await requestFromPlugin('yourHandler', { param1: 'value' })
if (result) {
  console.log('Success:', result)
}
```

### Adding Non-REQUEST Actions

For actions that don't need a response (using `sendActionToPlugin`):

#### Step 1: Add Handler in Router

Add your handler function in `routeRequestsFromReact.js`:

```javascript
async function handleYourAction(data: any, reactWindowData: PassedData): Promise<PassedData> {
  // Your logic here
  // Update reactWindowData if needed
  return reactWindowData
}
```

#### Step 2: Add to handleNonRequestAction

```javascript
async function handleNonRequestAction(actionType: string, data: any): Promise<any> {
  switch (actionType) {
    case 'yourAction':
      return await handleYourAction(data)
    // ... other cases
    default:
      return {}
  }
}
```

#### Step 3: Use from React

```javascript
sendActionToPlugin('yourAction', { param1: 'value' })
```

## Message Flow

### REQUEST/RESPONSE Pattern

1. **React → Plugin:**
   ```
   React: requestFromPlugin('getFolders', { excludeTrash: true })
   → Generates correlationId: "req-1234567890-abc123"
   → Sends: { __requestType: 'REQUEST', __correlationId: 'req-...', excludeTrash: true }
   → Plugin receives via onMessageFromHTMLView('getFolders', data)
   ```

2. **Plugin Processing:**
   ```
   Router detects REQUEST → calls routeRequest('getFolders', data)
   → Handler executes getFolders({ excludeTrash: true })
   → Handler returns: { success: true, data: ['Folder1', 'Folder2'] }
   ```

3. **Plugin → React:**
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

### Action Pattern

1. **React → Plugin:**
   ```
   React: sendActionToPlugin('onSubmitClick', { index: 0 })
   → Root.jsx automatically injects __windowId if not present
   → Sends: { type: 'onSubmitClick', index: 0, __windowId: '...' }
   ```

2. **Plugin Processing:**
   ```
   Router detects non-REQUEST → calls handleNonRequestAction('onMessageFromHTMLView', data)
   → Router extracts actualActionType = data.type → 'onSubmitClick'
   → Router calls handleSubmitButtonClick(data, reactWindowData)
   → Handler updates reactWindowData
   ```

3. **Plugin → React (optional):**
   ```
   Router sends updated data back to React via sendToHTMLWindow
   → React re-renders with new data
   ```

## Error Handling

### Timeout Handling

Requests timeout after 10 seconds (configurable in Root.jsx):

```javascript
const timeoutId = setTimeout(() => {
  reject(new Error(`Request timeout: ${command}`))
  pendingRequests.delete(correlationId)
}, 10000) // 10 second timeout
```

### Plugin Errors

Handled in handler try/catch blocks:

```javascript
try {
  // Handler logic
  return { success: true, data: result }
} catch (error) {
  return { 
    success: false, 
    message: `Error: ${error.message}`,
    data: null 
  }
}
```

### React Errors

Caught in try/catch blocks around `requestFromPlugin` calls:

```javascript
try {
  const folders = await requestFromPlugin('getFolders', { excludeTrash: true })
  setFolders(folders)
} catch (error) {
  console.error('Failed to load folders:', error)
  // Show error message to user
}
```

## Best Practices

### Handler Organization

1. **One handler per file** - Keep handlers in separate files in `requestHandlers/` folder
2. **Use descriptive names** - Handler names should clearly indicate what they do
3. **Add JSDoc comments** - Document parameters, return values, and what the handler does
4. **Handle errors gracefully** - Always return a proper error response
5. **Keep handlers focused** - Each handler should do one thing well
6. **Use consistent return format** - Always return `{ success, data?, message? }`

### Router Organization

1. **Always use `newCommsRouter`** - Never implement the router manually
2. **Enable shared handlers fallback** - Set `useSharedHandlersFallback: true` for automatic access to common handlers
3. **Group related handlers** - Keep note operations, folder operations, etc. grouped in switch statement
4. **Use async/await** - Never use `Promise.resolve()` (not available in WebView)

### React Side

1. **Use `useCallback` for handlers** - Prevent infinite loops when passing to context
2. **Handle loading states** - Show loading indicators during async requests
3. **Handle errors gracefully** - Always catch errors and show user-friendly messages
4. **Clean up on unmount** - Root.jsx handles cleanup of pending requests

## Complete Examples

### Example 1: Loading Folders in a Component

**React Component:**

```javascript
import React, { useState, useEffect, useCallback } from 'react'
import { useAppContext } from './AppContext'

function FolderSelector() {
  const { requestFromPlugin } = useAppContext()
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadFolders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const folders = await requestFromPlugin('getFolders', { excludeTrash: true })
      setFolders(folders)
    } catch (error) {
      console.error('Failed to load folders:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }, [requestFromPlugin])

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  if (loading) return <div>Loading folders...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <select>
      {folders.map((folder) => (
        <option key={folder} value={folder}>
          {folder}
        </option>
      ))}
    </select>
  )
}
```

**Plugin Handler (`requestHandlers/getFolders.js`):**

```javascript
import { getFoldersMatching } from '@helpers/folders'
import { logDebug, logError } from '@helpers/dev'

/**
 * Get list of folders (excluding trash by default)
 * 
 * @param {Object} params - Request parameters
 * @param {boolean} params.excludeTrash - Whether to exclude trash folder (default: true)
 * @param {any} pluginJson - Plugin JSON object
 * @returns {Promise<RequestResponse>} - Response with folders array
 */
export async function getFolders(params: { excludeTrash?: boolean } = {}, pluginJson: any): Promise<RequestResponse> {
  try {
    const { excludeTrash = true } = params
    logDebug('getFolders', `excludeTrash: ${excludeTrash}`)
    
    const folders = getFoldersMatching([], excludeTrash)
    
    return {
      success: true,
      data: folders,
    }
  } catch (error) {
    logError('getFolders', `Error: ${error.message}`)
    return {
      success: false,
      message: `Error getting folders: ${error.message}`,
      data: null,
    }
  }
}
```

**Router (`routeRequestsFromReact.js`):**

```javascript
import { newCommsRouter } from '@helpers/react/routerUtils'
import { getFolders } from './requestHandlers/getFolders'
import { WEBVIEW_WINDOW_ID } from './constants'
import pluginJson from '../plugin.json'

async function routeRequest(actionType: string, data: any): Promise<RequestResponse> {
  switch (actionType) {
    case 'getFolders':
      return await getFolders(data, pluginJson)
    default:
      return {
        success: false,
        message: `Unknown request type: "${actionType}"`,
        data: null,
      }
  }
}

async function handleNonRequestAction(actionType: string, data: any): Promise<any> {
  return {}
}

export const onMessageFromHTMLView = newCommsRouter({
  routerName: 'MyPlugin/routeRequestsFromReact',
  defaultWindowId: WEBVIEW_WINDOW_ID,
  routeRequest: routeRequest,
  handleNonRequestAction: handleNonRequestAction,
  pluginJson: pluginJson,
  useSharedHandlersFallback: true,
})
```

### Example 2: Creating a New Folder

**React Component:**

```javascript
function CreateFolderButton() {
  const { requestFromPlugin } = useAppContext()

  const handleCreateFolder = async () => {
    try {
      const result = await requestFromPlugin('createFolder', {
        folderPath: 'New Project',
        parentFolder: 'Projects'
      })
      
      if (result.success) {
        console.log('Folder created:', result.folderPath)
      } else {
        console.error('Failed to create folder:', result.error)
      }
    } catch (error) {
      console.error('Error creating folder:', error)
    }
  }

  return (
    <button onClick={handleCreateFolder}>Create Folder</button>
  )
}
```

**Plugin Handler (`requestHandlers/createFolder.js`):**

```javascript
import { DataStore } from '@mocks/DataStore.mock'
import { logDebug, logError } from '@helpers/dev'

/**
 * Create a new folder
 * 
 * @param {Object} params - Request parameters
 * @param {string} params.folderPath - Name of folder to create
 * @param {string} params.parentFolder - Parent folder path (optional)
 * @param {any} pluginJson - Plugin JSON object
 * @returns {Promise<RequestResponse>} - Response with created folder path
 */
export async function createFolder(params: { folderPath: string, parentFolder?: string }, pluginJson: any): Promise<RequestResponse> {
  try {
    const { folderPath, parentFolder = '' } = params
    
    if (!folderPath) {
      return {
        success: false,
        message: 'Folder path is required',
        data: null,
      }
    }
    
    const fullPath = parentFolder ? `${parentFolder}/${folderPath}` : folderPath
    logDebug('createFolder', `Creating folder: ${fullPath}`)
    
    await DataStore.createFolder(fullPath)
    
    return {
      success: true,
      data: { folderPath: fullPath },
    }
  } catch (error) {
    logError('createFolder', `Error: ${error.message}`)
    return {
      success: false,
      message: `Error creating folder: ${error.message}`,
      data: null,
    }
  }
}
```

## Performance Optimizations

### Request Animation Frame

Uses `requestAnimationFrame` to yield to browser before resolving promises (implemented in Root.jsx):

```javascript
requestAnimationFrame(() => {
  resolve(message.data)
})
```

### Diagnostic Logging

`[DIAG]` logs track request/response timing for performance analysis (can be enabled in Root.jsx):

```javascript
console.log(`[DIAG] Request sent: ${command} at ${Date.now()}`)
console.log(`[DIAG] Response received: ${correlationId} in ${Date.now() - startTime}ms`)
```

### Cleanup

Pending requests are cleaned up on component unmount to prevent memory leaks (handled in Root.jsx):

```javascript
useEffect(() => {
  return () => {
    pendingRequests.forEach((_, id) => {
      pendingRequests.delete(id)
    })
  }
}, [])
```

## Backward Compatibility

- Existing fire-and-forget actions continue to work via `sendActionToPlugin`
- Only requests with `__requestType: 'REQUEST'` trigger the response pattern
- All other messages continue to use the existing one-way communication
- Root.jsx automatically injects `__windowId` if not present

## Available Shared Request Handlers

When `useSharedHandlersFallback: true`, these handlers are automatically available from np.Shared:

- **`getFolders`**: Returns array of folder paths
  - Params: `{ excludeTrash?: boolean }`
  - Returns: `Array<string>`

- **`getNotes`**: Returns array of note options with decoration info
  - Params: `{ includeCalendarNotes?: boolean }`
  - Returns: `Array<NoteOption>`

- **`getTeamspaces`**: Returns array of teamspace definitions
  - Params: `{}`
  - Returns: `Array<TTeamspace>`

- **`getHeadings`**: Returns array of headings from a note
  - Params: `{ noteFilename: string }`
  - Returns: `Array<{ value: string, label: string }>`

See `np.Shared/src/requestHandlers/` for complete list and implementations.

## Registering the Router

The router function must be registered in two places:

### 1. Export from `src/index.js`

```javascript
export { onMessageFromHTMLView } from './routeRequestsFromReact.js'
```

### 2. Register in `plugin.json`

```json
{
  "name": "onMessageFromHTMLView",
  "description": "React Window calling back to plugin",
  "jsFunction": "onMessageFromHTMLView",
  "hidden": true
}
```

## See Also

- [REACT_COMMUNICATION_PATTERNS.md](REACT_COMMUNICATION_PATTERNS.md) - Detailed explanation of communication patterns
- [REACT_UTILITIES.md](REACT_UTILITIES.md) - React utility functions and helpers
- `@helpers/react/routerUtils.js` - Shared router utilities (MUST use `newCommsRouter`)
- `np.Shared/src/sharedRequestRouter.js` - Example router implementation
- `np.Shared/src/requestHandlers/` - Example handler implementations
