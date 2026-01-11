# Debugging Request/Response Timeout Issues

This guide explains how to debug timeout errors in the REQUEST/RESPONSE pattern used between React components and NotePlan plugins.

## Error Symptoms

```
[WebView Log] DEBUG | Component, requestFromPlugin TIMEOUT: command="getXXX", correlationId="req-..."
[WebView Error] ERROR | Component, requestFromPlugin REJECTED: command="getXXX", error="Request timeout: getXXX"
[WebView Error] ERROR | Component, Error loading data: Request timeout: getXXX
```

## Common Causes

### 1. Outdated Local routerUtils.js (MOST COMMON)

**Problem**: Plugin has a local copy of `routerUtils.js` that's out of sync with the shared version in `@helpers/react/routerUtils`.

**Symptoms**:
- Works for some users but not others
- No error logs on plugin side
- Silent failures in response sending

**Fix**:
```bash
# Delete local copy
rm src/routerUtils.js

# Update imports to use shared version
# In your router file (e.g., favoritesRouter.js):
import { newCommsRouter, type RequestResponse } from '@helpers/react/routerUtils'
import pluginJson from '../plugin.json'

export const onYourRouter = newCommsRouter({
  routerName: 'YourRouter',
  defaultWindowId: YOUR_WINDOW_ID,
  routeRequest: routeYourRequest,
  handleNonRequestAction: handleYourNonRequestAction,
  pluginJson: pluginJson,  // REQUIRED!
  useSharedHandlersFallback: false,
})
```

**Prevention**:
- ✅ Always use `@helpers/react/routerUtils` (shared version)
- ❌ Never copy routerUtils.js to your plugin
- ✅ Always pass `pluginJson` parameter to `newCommsRouter`

### 2. Handler Function Crashes

**Problem**: The handler throws an exception that's not caught properly.

**Symptoms**:
- Error logs on plugin side
- No RESPONSE sent back to React
- Timeout after 10 seconds

**Debug**:
```javascript
// In your handler (requestHandlers.js):
export async function handleGetData(requestData: Object): Promise<RequestResponse> {
  const startTime = Date.now()
  try {
    logDebug(pluginJson, `handleGetData: ENTRY`)
    
    // Your code here
    const data = await someOperation()
    
    const elapsed = Date.now() - startTime
    logDebug(pluginJson, `handleGetData: SUCCESS in ${elapsed}ms`)
    return {
      success: true,
      data: data,
    }
  } catch (error) {
    const elapsed = Date.now() - startTime
    logError(pluginJson, `handleGetData: ERROR after ${elapsed}ms: ${error.message}`)
    return {
      success: false,
      message: error.message || 'Failed to get data',
    }
  }
}
```

**Fix**:
- Always use try/catch in handlers
- Always return a RequestResponse object
- Log timing to identify slow operations

### 3. Wrong Window ID

**Problem**: Response is sent to wrong window ID, so React never receives it.

**Symptoms**:
- Plugin logs show success
- React times out
- Multiple windows open

**Debug**:
```javascript
// In your router:
export const onYourRouter = newCommsRouter({
  routerName: 'YourRouter',
  defaultWindowId: 'your-window-id',  // Must match React window ID
  routeRequest: routeYourRequest,
  pluginJson: pluginJson,
})

// In React (check what windowId is being sent):
const requestFromPlugin = useCallback(
  (command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
    const correlationId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    logDebug('Component', `requestFromPlugin: command="${command}", windowId="${windowIdRef.current}"`)
    
    // ...
  },
  [dispatch],
)
```

**Fix**:
- Ensure `defaultWindowId` in router matches window ID used when opening window
- Check `windowIdRef.current` in React component
- Verify `data.__windowId` is set correctly in requests

### 4. Router Not Registered in plugin.json

**Problem**: Router function not exported or not registered as a command.

**Symptoms**:
- No logs on plugin side
- Immediate or delayed timeout
- "Command not found" errors

**Debug**:
```json
// Check plugin.json has the router command:
{
  "plugin.commands": [
    {
      "name": "onYourRouter",
      "description": "React Window calling back to plugin",
      "jsFunction": "onYourRouter",
      "hidden": true
    }
  ]
}
```

```javascript
// Check src/index.js exports the router:
export { onYourRouter } from './yourRouter.js'
```

**Fix**:
- Ensure router is exported from index.js
- Ensure router is registered in plugin.json
- Verify `jsFunction` name matches export name

### 5. Handler Takes Too Long (> 10 seconds)

**Problem**: Operation genuinely takes longer than timeout.

**Symptoms**:
- Happens consistently for certain operations
- Logs show handler is still running when timeout occurs
- Large datasets or slow APIs

**Fix**:
```javascript
// Option 1: Increase timeout for specific requests
const data = await requestFromPlugin('slowOperation', {}, 30000) // 30 second timeout

// Option 2: Optimize the handler
export async function handleSlowOperation(requestData: Object): Promise<RequestResponse> {
  try {
    // Add early filtering/pagination
    const limit = requestData.limit || 100
    const notes = DataStore.projectNotes.slice(0, limit)
    
    // Process in chunks if needed
    // ...
    
    return { success: true, data: notes }
  } catch (error) {
    return { success: false, message: error.message }
  }
}
```

### 6. React Component Unmounted Before Response

**Problem**: React component unmounts while waiting for response.

**Symptoms**:
- Happens when rapidly switching views
- No error logs
- Memory leaks (pending requests not cleaned up)

**Fix**:
```javascript
// In React component, ensure cleanup in useEffect:
useEffect(() => {
  const handleResponse = (event: MessageEvent) => {
    // Handle response
  }
  
  window.addEventListener('message', handleResponse)
  return () => {
    window.removeEventListener('message', handleResponse)
    // Clean up pending requests
    pendingRequestsRef.current.forEach((pending) => {
      clearTimeout(pending.timeoutId)
    })
    pendingRequestsRef.current.clear()
  }
}, [])
```

## Debugging Checklist

When a user reports timeout errors:

1. ✅ Check if plugin has local `routerUtils.js` - delete it if found
2. ✅ Verify router imports from `@helpers/react/routerUtils`
3. ✅ Verify `pluginJson` parameter is passed to `newCommsRouter`
4. ✅ Check router is exported from `src/index.js`
5. ✅ Check router is registered in `plugin.json`
6. ✅ Verify window IDs match (router default vs React windowId)
7. ✅ Check handler has try/catch and returns RequestResponse
8. ✅ Check handler case is listed in router's switch statement
9. ✅ Add timing logs to handler to identify slow operations
10. ✅ Test with fresh NotePlan restart (clear any cached state)

## Testing Strategy

### Local Testing
```javascript
// Add diagnostic command to plugin:
export async function testRequestHandlers(): Promise<void> {
  const handlers = [
    { name: 'getFavoriteNotes', params: {} },
    { name: 'getFavoriteCommands', params: {} },
    // ... more handlers
  ]
  
  for (const { name, params } of handlers) {
    const startTime = Date.now()
    console.log(`Testing ${name}...`)
    try {
      const result = await handleRequest(name, params)
      const elapsed = Date.now() - startTime
      console.log(`✅ ${name}: success=${result.success}, elapsed=${elapsed}ms`)
    } catch (error) {
      const elapsed = Date.now() - startTime
      console.log(`❌ ${name}: error="${error.message}", elapsed=${elapsed}ms`)
    }
  }
}
```

### Production Debugging

Add comprehensive logging:
```javascript
// In router:
export const onYourRouter = newCommsRouter({
  routerName: 'YourRouter/DEBUG',  // Add DEBUG suffix for extra visibility
  defaultWindowId: YOUR_WINDOW_ID,
  routeRequest: async (actionType: string, data: any): Promise<RequestResponse> => {
    logDebug(pluginJson, `[ROUTER] Received request: actionType="${actionType}", correlationId="${data.__correlationId}"`)
    const result = await routeYourRequest(actionType, data)
    logDebug(pluginJson, `[ROUTER] Sending response: success=${result.success}, correlationId="${data.__correlationId}"`)
    return result
  },
  pluginJson: pluginJson,
})
```

## Performance Monitoring

Track request timing:
```javascript
// In handler:
export async function handleGetData(requestData: Object): Promise<RequestResponse> {
  const perfMarks = {
    start: Date.now(),
    dataFetch: 0,
    processing: 0,
    complete: 0,
  }
  
  try {
    // Fetch data
    const data = await fetchData()
    perfMarks.dataFetch = Date.now()
    
    // Process data
    const processed = processData(data)
    perfMarks.processing = Date.now()
    
    perfMarks.complete = Date.now()
    
    logDebug(pluginJson, 
      `handleGetData: PERF: ` +
      `fetch=${perfMarks.dataFetch - perfMarks.start}ms, ` +
      `process=${perfMarks.processing - perfMarks.dataFetch}ms, ` +
      `total=${perfMarks.complete - perfMarks.start}ms`
    )
    
    return { success: true, data: processed }
  } catch (error) {
    logError(pluginJson, `handleGetData: ERROR after ${Date.now() - perfMarks.start}ms: ${error.message}`)
    return { success: false, message: error.message }
  }
}
```

## See Also

- [ROUTER_AND_HANDLERS.md](../../dwertheimer.ReactSkeleton/ROUTER_AND_HANDLERS.md) - Router organization guide
- [COMMUNICATION_STRATEGY.md](../../dwertheimer.Forms/COMMUNICATION_STRATEGY.md) - Request/response pattern details
- `@helpers/react/routerUtils.js` - Shared router utilities (ALWAYS USE THIS)
- `np.Shared/src/sharedRequestRouter.js` - Example router implementation
