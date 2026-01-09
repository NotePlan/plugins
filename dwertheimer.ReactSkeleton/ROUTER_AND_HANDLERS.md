# Router and Handler Organization Guide

This document explains how the router and handler system works in ReactSkeleton and how to organize your code.

## Overview

The ReactSkeleton uses a two-file system for handling communication from React to the plugin:

1. **`router.js`** - Routes actions to appropriate handlers
2. **`requestHandlers.js`** - Contains the actual handler functions

This separation keeps your code organized and makes it easy to find and maintain handlers.

## File Structure

```
src/
  routeRequestsFromReact.js  # Main router - routes to handlers (uses newCommsRouter from @helpers/react/routerUtils)
  requestHandlers/            # Folder containing individual handler files
    addTaskToNote.js         # Example handler file
    getFolders.js            # Another handler file
    ...                      # More handlers as needed
  reactMain.js               # Window management and initialization
  index.js                   # Exports router to plugin.json
```

**Important**: The router file should be named `routeRequestsFromReact.js` (or similar) and should use `newCommsRouter` from `@helpers/react/routerUtils.js`. Each handler should be in its own file in the `requestHandlers/` folder, following the pattern used in `np.Shared`.

## Router (`src/routeRequestsFromReact.js`)

**The router MUST use `newCommsRouter` from `@helpers/react/routerUtils.js`** - do not implement the router manually. This provides:
- Automatic REQUEST/RESPONSE handling
- Automatic fallback to np.Shared handlers
- Consistent error handling
- Proper window ID management

The router is the entry point for all communication from React. It handles two patterns:

### 1. REQUEST/RESPONSE Pattern

When React calls `requestFromPlugin()`:

```javascript
// React side
const folders = await requestFromPlugin('getFolders', { excludeTrash: true })
```

The router:
1. Detects `__requestType === 'REQUEST'` in the data
2. Calls `routeRequest()` which routes to handlers in `requestHandlers.js`
3. Sends a RESPONSE message back to React with the result

### 2. Action Pattern

When React calls `sendActionToPlugin()`:

```javascript
// React side
sendActionToPlugin('onSubmitClick', { index: 0 })
```

The router:
1. Detects this is NOT a REQUEST (no `__requestType`)
2. Calls `handleNonRequestAction()` which handles the action
3. May update window data and send it back to React

### Router Function

The main router function is created using `newCommsRouter` from `@helpers/react/routerUtils`:

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

## Request Handlers (`src/requestHandlers/`)

**Each handler should be in its own file** in the `requestHandlers/` folder, following the pattern used in `np.Shared`. This keeps handlers organized and makes them easy to find and maintain.

### Handler Structure

Each handler:
- Takes parameters from the request
- Returns `{ success: boolean, data?: any, message?: string }`
- Has JSDoc explaining what it does
- Handles errors gracefully

Example:

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

### Routing Function

The `handleRequest()` function routes requests to the appropriate handler:

```javascript
export async function handleRequest(requestType: string, params: any): Promise<RequestResponse> {
  switch (requestType) {
    case 'getFolders':
      return await getFolders(params)
    case 'getTeamspaces':
      return await getTeamspaces(params)
    // Add more cases as needed
    default:
      return {
        success: false,
        message: `Unknown request type: "${requestType}"`,
        data: null,
      }
  }
}
```

## Adding New Handlers

### Step 1: Create Handler File

Create a new file in `requestHandlers/` folder (e.g., `requestHandlers/yourHandler.js`):

```javascript
/**
 * Your handler description
 * 
 * @param {Object} params - Request parameters
 * @returns {Promise<RequestResponse>} - Response
 */
export async function yourHandler(params: any = {}): Promise<RequestResponse> {
  try {
    // Your logic here
    return {
      success: true,
      data: result,
    }
  } catch (error) {
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
```

## Adding Non-REQUEST Actions

For actions that don't need a response (using `sendActionToPlugin`):

### Step 1: Add Handler in Router

Add your handler function in `routeRequestsFromReact.js`:

```javascript
async function handleYourAction(data: any, reactWindowData: PassedData): Promise<PassedData> {
  // Your logic here
  // Update reactWindowData if needed
  return reactWindowData
}
```

### Step 2: Add to Switch Statement

Add a case in `handleNonRequestAction()`:

```javascript
case 'yourAction':
  reactWindowData = await handleYourAction(data, reactWindowData)
  break
```

### Step 3: Use from React

Call from React using `sendActionToPlugin`:

```javascript
sendActionToPlugin('yourAction', { param1: 'value' })
```

## Organization Best Practices

1. **Group related handlers together** - Keep note operations, folder operations, etc. grouped
2. **Use descriptive names** - Handler names should clearly indicate what they do
3. **Add JSDoc comments** - Document parameters, return values, and what the handler does
4. **Handle errors gracefully** - Always return a proper error response
5. **Keep handlers focused** - Each handler should do one thing well
6. **Use consistent return format** - Always return `{ success, data?, message? }`

## Example: Complete Flow

### REQUEST/RESPONSE Pattern

**React:**
```javascript
const folders = await requestFromPlugin('getFolders', { excludeTrash: true })
console.log(folders) // ['Folder1', 'Folder2', ...]
```

**Flow:**
1. React sends: `{ __requestType: 'REQUEST', __correlationId: '...', excludeTrash: true }`
2. Router detects REQUEST → calls `routeRequest('getFolders', data)`
3. Router calls `handleRequest('getFolders', params)` in requestHandlers.js
4. Handler executes `getFolders({ excludeTrash: true })`
5. Handler returns: `{ success: true, data: ['Folder1', 'Folder2'] }`
6. Router sends RESPONSE message to React
7. React's promise resolves with the data

### Action Pattern

**React:**
```javascript
sendActionToPlugin('onSubmitClick', { index: 0 })
// NOTE: __windowId is automatically injected by Root.jsx if not present
```

**Flow:**
1. React sends: `{ type: 'onSubmitClick', index: 0 }` (no __requestType)
2. Root.jsx automatically injects `__windowId` from `globalSharedData.pluginData?.windowId` if not present
3. Router detects non-REQUEST → calls `handleNonRequestAction('onMessageFromHTMLView', data)`
4. Router extracts `actualActionType = data.type` → 'onSubmitClick'
5. Router calls `handleSubmitButtonClick(data, reactWindowData)`
6. Handler updates `reactWindowData`
7. Router sends updated data back to React via `sendToHTMLWindow`
8. React re-renders with new data

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
- `@helpers/react/routerUtils.js` - Shared router utilities (MUST use `newCommsRouter`)
- `np.Shared/src/sharedRequestRouter.js` - Example router implementation
- `np.Shared/src/requestHandlers/` - Example handler implementations
- `src/routeRequestsFromReact.js` - Router implementation (uses newCommsRouter)
- `src/requestHandlers/` - Handler implementations (one file per handler)

