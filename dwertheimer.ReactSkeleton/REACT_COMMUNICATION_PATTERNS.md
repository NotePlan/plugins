# React Communication Patterns for NotePlan Plugins

This document explains the communication patterns between React components and the NotePlan plugin backend, and how to implement them correctly to avoid infinite loops and other common issues.

## Table of Contents

1. [Overview](#overview)
2. [Communication Patterns](#communication-patterns)
3. [Critical: Function Memoization](#critical-function-memoization)
4. [Request/Response Pattern](#requestresponse-pattern)
5. [Action Pattern](#action-pattern)
6. [AppContext Pattern](#appcontext-pattern)
7. [Common Pitfalls](#common-pitfalls)
8. [Best Practices](#best-practices)

## Overview

NotePlan plugins use React components running in HTML windows that communicate with the plugin backend (JavaScript running in NotePlan's JSContext). There are two main communication patterns:

1. **Request/Response Pattern**: React requests data from the plugin and waits for a response (like an API call)
2. **Action Pattern**: React sends an action to the plugin (fire-and-forget, or the plugin updates the React window)

Both patterns require careful handling of function references to prevent infinite render loops.

## Communication Patterns

### Request/Response Pattern

The Request/Response pattern is used when React needs to fetch data from the plugin and wait for a response. This is similar to making an API call.

**React Side (WebView component):**

```javascript
import React, { useCallback, useRef } from 'react'

export function WebView({ data, dispatch }: Props): Node {
  const pendingRequestsRef = useRef<Map<string, { resolve, reject, timeoutId }>>(new Map())
  
  // CRITICAL: Must use useCallback to prevent infinite loops
  const requestFromPlugin = useCallback((command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
    if (!command) throw new Error('requestFromPlugin: command must be called with a string')

    const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const pending = pendingRequestsRef.current.get(correlationId)
        if (pending) {
          pendingRequestsRef.current.delete(correlationId)
          reject(new Error(`Request timeout: ${command}`))
        }
      }, timeout)

      pendingRequestsRef.current.set(correlationId, { resolve, reject, timeoutId })

      const requestData = {
        ...dataToSend,
        __correlationId: correlationId,
        __requestType: 'REQUEST',
        // NOTE: __windowId is automatically injected by Root.jsx if not present
        // No need to manually add it - Root.jsx extracts it from globalSharedData.pluginData?.windowId
      }

      dispatch('SEND_TO_PLUGIN', [command, requestData], `WebView: requestFromPlugin: ${String(command)}`)
    })
      .then((result) => {
        return result
      })
      .catch((error) => {
        throw error
      })
  }, [dispatch]) // Minimal dependencies - __windowId is handled automatically by Root.jsx

  // Listen for RESPONSE messages
  useEffect(() => {
    const handleResponse = (event: MessageEvent) => {
      const { data: eventData } = event
      if (eventData && typeof eventData === 'object' && eventData.type === 'RESPONSE' && eventData.payload) {
        const payload = eventData.payload
        if (payload && typeof payload === 'object') {
          const correlationId = (payload: any).correlationId
          const success = (payload: any).success
          if (correlationId && typeof correlationId === 'string') {
            const { data: responseData, error } = (payload: any)
            const pending = pendingRequestsRef.current.get(correlationId)
            if (pending) {
              pendingRequestsRef.current.delete(correlationId)
              clearTimeout(pending.timeoutId)
              if (success) {
                pending.resolve(responseData)
              } else {
                pending.reject(new Error(error || 'Request failed'))
              }
            }
          }
        }
      }
    }

    window.addEventListener('message', handleResponse)
    return () => {
      window.removeEventListener('message', handleResponse)
      // Clean up any pending requests on unmount
      pendingRequestsRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutId)
      })
      pendingRequestsRef.current.clear()
    }
  }, [])

  // Usage example
  const loadData = async () => {
    try {
      const result = await requestFromPlugin('getData', { someParam: 'value' })
      // Use result
    } catch (error) {
      // Handle error
    }
  }
}
```

**Plugin Side (router/handler):**

```javascript
// In your router function (e.g., onMessageFromHTMLView)
export async function onMessageFromHTMLView(actionType: string, data: any = null): Promise<any> {
  // Check if this is a REQUEST that needs a response
  if (data?.__requestType === 'REQUEST' && data?.__correlationId) {
    const windowId = data?.__windowId || WEBVIEW_WINDOW_ID
    
    try {
      // Route to appropriate handler
      const result = await handleRequest(actionType, data)
      
      // Send response back to React
      sendToHTMLWindow(windowId, 'RESPONSE', {
        correlationId: data.__correlationId,
        success: result.success,
        data: result.data,
        error: result.message,
      })
    } catch (error) {
      sendToHTMLWindow(windowId, 'RESPONSE', {
        correlationId: data.__correlationId,
        success: false,
        data: null,
        error: error.message || String(error),
      })
    }
    return {}
  }
  
  // Handle non-REQUEST actions (see Action Pattern below)
  // ...
}
```

### Action Pattern

The Action pattern is used when React sends an action to the plugin without waiting for a response. The plugin may update the React window's data, causing a re-render.

**React Side:**

```javascript
const sendActionToPlugin = useCallback((command: string, dataToSend: any) => {
  // Save scroll position or other passthrough data
  const newData = addPassthroughVars(data)
  dispatch('UPDATE_DATA', newData)
  // NOTE: __windowId is automatically injected by Root.jsx if not present
  // You don't need to manually add it to dataToSend
  dispatch('SEND_TO_PLUGIN', [command, dataToSend], `WebView: ${command}`)
}, [dispatch, data]) // Include data if addPassthroughVars uses it
```

**Plugin Side:**

```javascript
export async function onMessageFromHTMLView(actionType: string, data: any = null): Promise<any> {
  // Skip REQUEST types (handled above)
  if (data?.__requestType === 'REQUEST') {
    // Already handled
    return {}
  }

  let reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  
  switch (actionType) {
    case 'onSubmitClick':
      reactWindowData = await handleSubmitButtonClick(data, reactWindowData)
      break
    // ... other cases
  }
  
  if (reactWindowData) {
    sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'SET_DATA', reactWindowData, 'Data updated')
  }
  
  return {}
}
```

## Critical: Function Memoization

**THIS IS THE MOST IMPORTANT SECTION. READ THIS CAREFULLY.**

### The Problem

Functions created in React components are recreated on every render. If these functions are:
- Passed to `AppContext` (via `AppProvider`)
- Used as dependencies in `useEffect` hooks
- Passed as props to child components

They will cause infinite loops because:
1. Function reference changes → Context value changes → All consumers re-render
2. Re-render creates new function → Function reference changes → Loop continues
3. App becomes unresponsive and may crash

### The Solution: Always Use `useCallback`

**Every function passed to `AppProvider` MUST be wrapped in `useCallback`:**

```javascript
// ❌ WRONG - Causes infinite loops
const requestFromPlugin = (command: string, dataToSend: any = {}) => {
  // ... implementation
}

// ✅ CORRECT - Stable function reference
const requestFromPlugin = useCallback((command: string, dataToSend: any = {}) => {
  // ... implementation
}, [dispatch]) // Minimal dependencies - __windowId is handled automatically by Root.jsx
```

### Functions That MUST Be Memoized

- `requestFromPlugin` - Request/response pattern function
- `sendActionToPlugin` - Action sender function
- `sendToPlugin` - Direct sender function
- Any function passed to `AppProvider` props
- Any function used in `useEffect` dependency arrays

### Dependency Array Best Practices

Keep dependencies minimal - only include values that:
1. Are actually used inside the function
2. Can change and would require the function to be recreated

**Good dependencies:**
- `dispatch` (usually stable, from props)
- Stable refs (not state/props that change frequently)
- **Note**: `__windowId` is automatically injected by Root.jsx, so you don't need `pluginData?.windowId` in dependencies

**Bad dependencies:**
- `pluginData` (entire object - use specific properties instead)
- State that changes frequently
- Functions that aren't memoized themselves

### AppContext Memoization

`AppContext` should use `useMemo` to memoize the context value:

```javascript
export const AppProvider = ({ children, sendActionToPlugin, sendToPlugin, requestFromPlugin, dispatch, pluginData, ... }: Props): Node => {
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue: AppContextType = useMemo(() => ({
    sendActionToPlugin,
    sendToPlugin,
    requestFromPlugin,
    dispatch,
    pluginData,
    reactSettings,
    setReactSettings,
    updatePluginData,
  }), [sendActionToPlugin, sendToPlugin, requestFromPlugin, dispatch, pluginData, reactSettings, setReactSettings, updatePluginData])

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}
```

**This ensures the context value only changes when the actual props change, not on every render.**

## AppContext Pattern

`AppContext` provides a way to pass functions and data to any component without prop drilling.

**AppContext.jsx:**

```javascript
import React, { createContext, useContext, useMemo, type Node } from 'react'

export type AppContextType = {
  sendActionToPlugin: (command: string, dataToSend: any) => void,
  sendToPlugin: (command: string, dataToSend: any) => void,
  requestFromPlugin: (command: string, dataToSend: any, timeout?: number) => Promise<any>,
  dispatch: (command: string, dataToSend: any, message?: string) => void,
  pluginData: Object,
  reactSettings: Object,
  setReactSettings: (newSettings: Object) => void,
  updatePluginData: (newData: Object, messageForLog?: string) => void,
}

const AppContext = createContext<AppContextType>(defaultContextValue)

export const AppProvider = ({ children, sendActionToPlugin, sendToPlugin, requestFromPlugin, dispatch, pluginData, ... }: Props): Node => {
  // CRITICAL: Memoize context value
  const contextValue: AppContextType = useMemo(() => ({
    sendActionToPlugin,
    sendToPlugin,
    requestFromPlugin,
    dispatch,
    pluginData,
    // ...
  }), [sendActionToPlugin, sendToPlugin, requestFromPlugin, dispatch, pluginData, ...])

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}

export const useAppContext = (): AppContextType => useContext(AppContext)
```

**Usage in child components:**

```javascript
import { useAppContext } from './AppContext.jsx'

export function MyComponent(): Node {
  const { requestFromPlugin, pluginData } = useAppContext()
  
  useEffect(() => {
    const loadData = async () => {
      const data = await requestFromPlugin('getData', {})
      // Use data
    }
    loadData()
  }, [requestFromPlugin]) // Safe to include because it's memoized
}
```

## Common Pitfalls

### 1. Forgetting `useCallback`

**Symptom:** Infinite render loops, app becomes unresponsive

**Fix:** Always wrap functions in `useCallback` before passing to context

### 2. Including Too Many Dependencies

**Symptom:** Function recreates too often, causing unnecessary re-renders

**Fix:** Only include dependencies that are actually used and can change

### 3. Not Memoizing Context Value

**Symptom:** All context consumers re-render on every parent render

**Fix:** Use `useMemo` in `AppProvider` to memoize the context value

### 4. Using State in Dependency Arrays

**Symptom:** Function recreates on every state change

**Fix:** Use refs for values that don't need to trigger re-renders, or be selective about which state properties you depend on

### 5. Passing Entire Objects as Dependencies

**Symptom:** Function recreates when any property of the object changes

**Fix:** Use specific properties only if needed. Note: `__windowId` is automatically injected by Root.jsx, so you don't need `pluginData?.windowId` in dependencies

## Automatic __windowId Injection

**Root.jsx automatically injects `__windowId`** into all `SEND_TO_PLUGIN` dispatches if not already present.

- **Source**: Extracted from `globalSharedData.pluginData?.windowId`
- **When**: Automatically added by Root.jsx's `sendToPlugin` function
- **Applies to**: All `SEND_TO_PLUGIN` dispatches, including:
  - `sendActionToPlugin()` calls
  - `sendToPlugin()` calls
  - `requestFromPlugin()` calls (via `dispatch('SEND_TO_PLUGIN', ...)`)

**Benefits:**
- Less boilerplate - no need to manually add `__windowId` to every action
- Consistency - all actions automatically include windowId
- Safety net - if someone forgets, it's automatically added
- Backward compatible - if `__windowId` is already present, it's not overwritten

**Example:**

```javascript
// ❌ OLD WAY (still works, but unnecessary)
sendActionToPlugin('onSubmitClick', { index: 0, __windowId: pluginData?.windowId })
requestFromPlugin('getFolders', { excludeTrash: true, __windowId: pluginData?.windowId })

// ✅ NEW WAY (__windowId automatically injected by Root.jsx)
sendActionToPlugin('onSubmitClick', { index: 0 })
requestFromPlugin('getFolders', { excludeTrash: true })
```

## Best Practices

1. **Always use `useCallback`** for functions passed to context or used as dependencies
2. **Always use `useMemo`** in `AppProvider` to memoize the context value
3. **Keep dependency arrays minimal** - only include what's necessary
4. **Use refs** for values that don't need to trigger re-renders (e.g., `windowIdRef.current`)
5. **Test for infinite loops** - if the app becomes unresponsive, check function memoization first
6. **Document dependencies** - add comments explaining why each dependency is needed
7. **Use TypeScript/Flow** - helps catch missing dependencies
8. **Don't manually add `__windowId`** - Root.jsx handles it automatically for all `SEND_TO_PLUGIN` dispatches

## Router and Handler Organization

The ReactSkeleton includes a well-organized router and handler system with automatic fallback to shared handlers:

### File Structure

```
src/
  router.js              # Main router function (handles both REQUEST and non-REQUEST)
  requestHandlers.js     # Request handlers (for request/response pattern)
  reactMain.js          # Window management and initialization
  index.js              # Exports router function to plugin.json
```

### Router (`src/router.js`)

The router uses `newCommsRouter` from `@helpers/react/routerUtils` to handle:
- **REQUEST actions**: Routes to `routeRequest()` which calls handlers in `requestHandlers.js`
- **Automatic fallback**: If plugin doesn't have a handler, automatically tries np.Shared handlers
- **Non-REQUEST actions**: Routes to `handleNonRequestAction()` for fire-and-forget actions

**Key functions:**
- `routeRequest()` - Routes REQUEST type actions to handlers
- `handleNonRequestAction()` - Handles action-based pattern (sendActionToPlugin)
- `onMessageFromHTMLView` - Main router function exported to plugin.json

### Request Handlers (`src/requestHandlers.js`)

Contains handlers for request/response pattern. Each handler:
- Returns `{ success: boolean, data?: any, message?: string }`
- Has JSDoc explaining what it does
- Is organized by functionality

**Example handlers included:**
- `getFolders()` - Get list of folders
- `getTeamspaces()` - Get list of teamspaces
- `getSampleData()` - Example handler (replace with your own)

**Adding new handlers:**
1. Add handler function to `requestHandlers.js` with JSDoc
2. Add case to `handleRequest()` switch statement
3. Use from React: `await requestFromPlugin('yourHandler', { params })`

### Shared Handlers (np.Shared)

Common chooser handlers are available in `np.Shared/src/chooserHandlers.js` and are automatically used as a fallback when plugins don't implement their own handlers.

**How it works:**
1. Plugin's `routeRequest()` is called first
2. If plugin handler returns `success: false` with message indicating "unknown" or "not found", the router automatically tries np.Shared handlers
3. np.Shared handlers are called via `DataStore.invokePluginCommandByName('handleSharedRequest', 'np.Shared', ...)`

**Available shared handlers:**
- `getTeamspaces` - Get list of teamspaces for space-chooser
- More handlers will be added (getFolders, getNotes, getHashtags, etc.)

**Benefits:**
- ✅ Plugins can use common choosers without implementing handlers
- ✅ Single source of truth for common operations
- ✅ Automatic fallback - no code changes needed
- ✅ Plugin-specific handlers take precedence when they exist

**Example:**
```javascript
// In your plugin's routeRequest function:
async function routeRequest(actionType: string, data: any): Promise<RequestResponse> {
  switch (actionType) {
    case 'myCustomHandler':
      return myCustomHandler(data)
    default:
      // Return "not found" to trigger shared handler fallback
      return {
        success: false,
        message: `Unknown request type: "${actionType}"`,
        data: null,
      }
  }
}
```

The router will automatically try np.Shared handlers for any request that returns "unknown" or "not found".

### Registering the Router

The router function must be:
1. **Exported from `src/index.js`**: `export { onMessageFromHTMLView } from './router.js'`
2. **Registered in `plugin.json`**: 
   ```json
   {
     "name": "onMessageFromHTMLView",
     "jsFunction": "onMessageFromHTMLView",
     "hidden": true
   }
   ```

## Example: Complete WebView Implementation

See `src/react/components/WebView.jsx` in this plugin for a complete, working example that follows all these patterns correctly.

## Additional Resources

- React Hooks documentation: https://react.dev/reference/react
- `useCallback` reference: https://react.dev/reference/react/useCallback
- `useMemo` reference: https://react.dev/reference/react/useMemo
- See `.cursor/rules/noteplan-programming-general.mdc` for NotePlan-specific patterns

