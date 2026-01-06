# Analysis: Moving Chooser Request Handlers to np.Shared

## Executive Summary

**Recommendation: YES, with modifications** - Moving common chooser handlers (getFolders, getNotes, getTeamspaces, getHashtags, getMentions, getFrontmatterKeyValues, getHeadings, getEvents) to np.Shared makes sense, but requires careful design to handle edge cases and plugin-specific needs.

## Current Architecture

### Where Things Live Now
- **DynamicDialog**: `helpers/react/DynamicDialog/` (shared React component)
- **Request Handlers**: `dwertheimer.Forms/src/requestHandlers.js` (plugin-specific)
- **Routers**: Each plugin has its own router that delegates to `handleRequest()` for shared handlers

### Current Pattern
```
React Component (DynamicDialog)
  ↓ requestFromPlugin('getNotes', {...})
Plugin Router (e.g., onFormBuilderAction)
  ↓ routeRequest('getNotes', data)
Shared Handler (handleRequest in requestHandlers.js)
  ↓ getNotes(params)
Returns { success, data, message }
```

## Proposed Architecture

### Option 1: Shared Handlers in np.Shared (Recommended)
```
React Component (DynamicDialog)
  ↓ requestFromPlugin('getNotes', {...})
Plugin Router
  ↓ Check if handler exists locally OR use shared
Shared Handler (np.Shared/src/chooserHandlers.js)
  ↓ getNotes(params)
Returns { success, data, message }
```

### Option 2: Fallback Pattern with Setting
Add a field-level setting to TSettingItem:
```typescript
useSharedHandler?: boolean, // If true, route to np.Shared handlers instead of plugin handlers
```

## Benefits

### 1. **Code Reuse**
- ✅ Eliminates duplication across plugins
- ✅ Single source of truth for common operations
- ✅ Easier to maintain and update

### 2. **Faster Plugin Development**
- ✅ New plugins can use DynamicDialog immediately
- ✅ No need to implement handlers for common choosers
- ✅ Focus on plugin-specific logic

### 3. **Consistency**
- ✅ All plugins get same behavior for choosers
- ✅ Bug fixes benefit all plugins
- ✅ Performance optimizations benefit all

### 4. **Filtering Flexibility**
- ✅ Include/exclude regexes already support filtering
- ✅ Can still control results per-plugin via field options
- ✅ Space filtering, folder filtering, etc. already work

## Challenges & Edge Cases

### 1. **Plugin-Specific Customization**

**Problem**: Some plugins may need custom behavior:
- Dashboard might want to exclude certain notes
- Forms might need special note filtering
- Custom plugins might have domain-specific requirements

**Solution**: 
- Keep plugin-specific handlers as override
- Use fallback pattern: try plugin handler first, then shared
- Field-level `useSharedHandler` flag for explicit control

**Example**:
```javascript
async function routeRequest(actionType, data) {
  // Check if plugin has custom handler
  if (pluginHandlers[actionType]) {
    return await pluginHandlers[actionType](data)
  }
  // Fall back to shared handler
  return await sharedHandlers.handleRequest(actionType, data)
}
```

### 2. **Window ID Routing**

**Problem**: Responses need correct window ID. Shared handlers don't know which plugin/window called them.

**Current Solution**: Window ID is passed in `data.__windowId` or extracted from request.

**Shared Handler Solution**: Same pattern - window ID comes from request data, no change needed.

### 3. **Plugin Context**

**Problem**: Shared handlers might need plugin-specific context:
- Logging (pluginJson for log messages)
- Settings (plugin-specific configuration)
- Data access (plugin-specific data stores)

**Solution**:
- Pass `pluginJson` as parameter to shared handlers
- Use generic logging that accepts pluginJson
- Keep handlers stateless (no plugin-specific state)

**Example**:
```javascript
// In np.Shared
export function getNotes(params, pluginJson) {
  logDebug(pluginJson, 'getNotes called...')
  // ... handler logic
}
```

### 4. **Dependency Management**

**Problem**: Shared handlers use helpers from `@helpers/` which are already shared, but need to ensure compatibility.

**Solution**: 
- ✅ Helpers are already in np.Shared/helpers
- ✅ No additional dependencies needed
- ✅ Current helpers work across plugins

### 5. **Backward Compatibility**

**Problem**: Existing plugins with custom handlers need to continue working.

**Solution**:
- ✅ Keep plugin-specific handlers as override
- ✅ Default to plugin handler if exists, fallback to shared
- ✅ No breaking changes for existing plugins

### 6. **Error Handling**

**Problem**: Error messages might need plugin-specific context.

**Solution**:
- Use pluginJson in error messages
- Standardize error response format
- Allow plugin to customize error handling if needed

### 7. **Performance Considerations**

**Problem**: Shared handlers might be slower if they don't have plugin-specific optimizations.

**Solution**:
- ✅ Current handlers are already optimized
- ✅ No performance penalty expected
- ✅ Can add caching if needed (plugin-agnostic)

### 8. **Testing**

**Problem**: Need to test shared handlers work across different plugins.

**Solution**:
- Unit tests for shared handlers
- Integration tests with multiple plugins
- Test fallback pattern

### 9. **Versioning**

**Problem**: What if shared handlers change but plugin expects old behavior?

**Solution**:
- Version shared handlers API
- Allow plugins to specify handler version
- Maintain backward compatibility

### 10. **Special Cases**

**Problem**: Some handlers might have plugin-specific logic:
- `getEvents`: Calendar access might vary
- `getHeadings`: Some plugins might want different heading formats
- `createFolder/createNote`: Might need plugin-specific validation

**Solution**:
- Keep creation handlers plugin-specific (they're less common)
- Use field options for filtering/formatting
- Allow plugin override for special cases

## Implementation Plan

### Phase 1: Create Shared Handlers Module
1. Create `np.Shared/src/chooserHandlers.js`
2. Move common handlers from Forms plugin:
   - `getFolders`
   - `getNotes`
   - `getTeamspaces`
   - `getHashtags`
   - `getMentions`
   - `getFrontmatterKeyValues`
   - `getHeadings`
   - `getEvents`
   - `getAvailableCalendars`
   - `getAvailableReminderLists`
3. Update to accept `pluginJson` parameter
4. Export `handleRequest` function

### Phase 2: Update Router Pattern
1. Update `helpers/react/routerUtils.js` to support shared handler fallback
2. Add `useSharedHandlers` option to router creation
3. Implement fallback logic: plugin handler → shared handler

### Phase 3: Update DynamicDialog (Optional)
1. Add `useSharedHandler?: boolean` to TSettingItem
2. Pass flag through to router
3. Default to `true` for common choosers

### Phase 4: Update Forms Plugin
1. Remove handlers from `requestHandlers.js`
2. Update routers to use shared handlers
3. Keep plugin-specific handlers (createFolder, createNote, etc.)

### Phase 5: Update Other Plugins
1. Dashboard: Use shared handlers for new dialog
2. Favorites: Use shared handlers if applicable
3. Other plugins: Migrate as needed

## Field-Level Control (Optional Enhancement)

### TSettingItem Addition
```typescript
useSharedHandler?: boolean, // If true, use np.Shared handlers (default: true for common choosers)
customHandlerCommand?: string, // If set, use this command instead of default
```

### Usage Example
```javascript
{
  type: 'note-chooser',
  key: 'note',
  label: 'Note',
  useSharedHandler: true, // Explicitly use shared handler
  // OR
  useSharedHandler: false, // Use plugin-specific handler
  customHandlerCommand: 'getCustomNotes', // Use custom command
}
```

## Edge Cases Summary

| Edge Case | Risk Level | Solution |
|-----------|------------|----------|
| Plugin-specific filtering | Low | Field options + regex filters |
| Window ID routing | Low | Already handled via request data |
| Plugin context (logging) | Low | Pass pluginJson parameter |
| Backward compatibility | Medium | Fallback pattern |
| Performance | Low | No expected impact |
| Error handling | Low | Standardize format |
| Versioning | Medium | API versioning if needed |
| Special cases | Medium | Allow plugin override |
| Testing | Medium | Comprehensive test suite |

## Recommendation

**Proceed with Option 1 (Shared Handlers) with fallback pattern:**

1. ✅ Move common choosers to np.Shared
2. ✅ Implement fallback: plugin handler → shared handler
3. ✅ Pass pluginJson for context
4. ✅ Keep plugin-specific handlers (createFolder, createNote, etc.) in plugins
5. ⚠️ Consider field-level `useSharedHandler` flag for explicit control (optional)

**Why this works:**
- ✅ No breaking changes
- ✅ Immediate benefits for new plugins
- ✅ Existing plugins continue working
- ✅ Flexibility for special cases
- ✅ Single source of truth for common operations

**Why field-level flag is optional:**
- Most plugins will use shared handlers
- Fallback pattern handles most cases
- Flag adds complexity but provides explicit control
- Can be added later if needed

## Next Steps

1. Create shared handlers module in np.Shared
2. Update router utilities to support fallback
3. Test with Forms plugin (remove handlers, use shared)
4. Test with Dashboard plugin (new dialog)
5. Document migration path for other plugins
6. Consider field-level flag if needed based on feedback

