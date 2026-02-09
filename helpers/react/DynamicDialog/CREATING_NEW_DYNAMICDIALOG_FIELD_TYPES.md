# Creating New Field Types for DynamicDialog

This guide explains how to add a new field type to the DynamicDialog system, including all the necessary integration points.

**Do not use raw `Promise.resolve`, `Promise.all`, or `Promise.race` in plugin code—NotePlan's JSContext may not have them. Use polyfills from `@helpers/promisePolyfill.js` (`promiseResolve`, `promiseAll`, `promiseRace`).**

## Overview

Adding a new field type requires changes in multiple places:

1. **DynamicDialog Type Definitions** (`DynamicDialog.jsx`)
2. **Component Implementation** (new React component)
3. **Renderer Integration** (`dialogElementRenderer.js`)
4. **Request Handlers** (if loading dynamic data via REQUEST)
5. **Form Builder** (`fieldTypes.js` for Form Builder integration)
6. **Form Item Editor** (if field needs custom editor options)
7. **Test/Examples** (`FormFieldRenderTest.js`)

## Step-by-Step Guide

### 1. DynamicDialog Type Definitions

**File:** `helpers/react/DynamicDialog/DynamicDialog.jsx`

Add your new field type to the `TSettingItemType` union type:

```typescript
export type TSettingItemType =
  | 'input'
  | 'textarea'
  // ... other types ...
  | 'your-new-type'  // Add here
```

Then add any new properties to the `TSettingItem` type if your field needs custom properties:

```typescript
export type TSettingItem = {
  type: TSettingItemType,
  key?: string,
  label?: string,
  // ... common properties ...
  // Add your custom properties here:
  yourCustomProperty?: string,
  yourOtherProperty?: boolean,
  // ...
}
```

**Example:** For `tag-chooser`, we added:

- `includePattern?: string`
- `excludePattern?: string`
- `returnAsArray?: boolean`
- `valueSeparator?: 'comma' | 'commaSpace' | 'space'` (for string output: comma, comma+space, or space-separated)
- `defaultChecked?: boolean`
- `maxHeight?: string`

### 2. Component Implementation

**File:** `helpers/react/DynamicDialog/YourNewChooser.jsx`

Create your React component. If you're creating a chooser that loads data dynamically, follow this pattern:

```typescript
// @flow
import React, { useState, useEffect, useCallback } from 'react'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import './YourNewChooser.css'

export type YourNewChooserProps = {
  label?: string,
  value?: string | Array<string>,
  onChange: (value: string | Array<string>) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>,
  // Add your custom props here
}

export function YourNewChooser({
  label,
  value,
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search...',
  requestFromPlugin,
  // ... your custom props
}: YourNewChooserProps): React$Node {
  const [items, setItems] = useState<Array<string>>([])
  const [loaded, setLoaded] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)

  // Load data from plugin via REQUEST (if needed)
  useEffect(() => {
    if (requestFromPlugin && !loaded && !loading) {
      setLoading(true)
      logDebug('YourNewChooser', 'Loading items from plugin')
      requestFromPlugin('getYourItems', {})
        .then((itemsData: Array<string>) => {
          if (Array.isArray(itemsData)) {
            setItems(itemsData)
            setLoaded(true)
            logDebug('YourNewChooser', `Loaded ${itemsData.length} items`)
          } else {
            logError('YourNewChooser', 'Invalid response format from getYourItems')
            setItems([])
            setLoaded(true)
          }
        })
        .catch((error) => {
          logError('YourNewChooser', `Failed to load items: ${error.message}`)
          setItems([])
          setLoaded(true)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [requestFromPlugin, loaded, loading])

  // Your component implementation...
  return (
    <div className="your-new-chooser-wrapper" data-field-type="your-new-type">
      {/* Your component JSX */}
    </div>
  )
}

export default YourNewChooser
```

**Important Notes:**

- **Memoization**: If you pass functions to child components or use them in dependencies, wrap them in `useCallback`
  - **CRITICAL**: `requestFromPlugin` is already memoized in parent components (FormView, FormBuilderView, etc.) via `useCallback`
  - You don't need to memoize `requestFromPlugin` in your component - it's passed as a prop and should be stable
  - However, any functions you create that use `requestFromPlugin` in `useEffect` dependencies should handle it correctly
  - If you create helper functions that are passed to child components, wrap them in `useCallback`
- **Loading State**: Show a loading indicator while data is being fetched
- **Error Handling**: Handle errors gracefully and log them
- **Empty State**: Show a helpful message when no items are available

### 3. Renderer Integration

**File:** `helpers/react/DynamicDialog/dialogElementRenderer.js`

Add a case in the `renderItem` function's switch statement:

```typescript
import YourNewChooser from './YourNewChooser.jsx'  // Add import at top

// In the renderItem function, add a case:
case 'your-new-type': {
  const label = item.label || ''
  const compactDisplay = item.compactDisplay || false
  const currentValue = item.value || item.default || ''
  // Extract your custom properties
  const yourCustomProperty = (item: any).yourCustomProperty || ''

  const handleChange = (newValue: string | Array<string>) => {
    if (item.key) {
      handleFieldChange(item.key, newValue)
    }
  }

  return (
    <div data-field-type="your-new-type">
      <YourNewChooser
        key={`your-new-type${index}`}
        label={label}
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        compactDisplay={compactDisplay}
        placeholder={item.placeholder || 'Type to search...'}
        requestFromPlugin={requestFromPlugin}  // Pass if needed
        yourCustomProperty={yourCustomProperty}
        // ... other props
      />
    </div>
  )
}
```

**Important Notes:**

- Always wrap your component in a `<div data-field-type="...">` for debugging
- Pass `requestFromPlugin` if your component needs to load data dynamically
- Extract custom properties from `item: any` using the `(item: any).propertyName` pattern
- Use `item.value || item.default || ''` for current value to support both controlled and default values

### 4. Request Handlers (For Dynamic Data)

**File:** `dwertheimer.Forms/src/requestHandlers.js` (or your plugin's request handlers)

If your component loads data dynamically, add a request handler:

```typescript
/**
 * Get items for YourNewChooser
 * @param {Object} _params - Not used, kept for consistency
 * @returns {RequestResponse} Array of items
 */
export function getYourItems(_params: Object = {}): RequestResponse {
  try {
    // Get data from DataStore or other source
    const items = DataStore.yourItems || []
    logDebug(pluginJson, `getYourItems: returning ${items.length} items`)
    return {
      success: true,
      data: items,
    }
  } catch (error) {
    logError(pluginJson, `getYourItems error: ${error.message}`)
    return {
      success: false,
      message: error.message,
      data: [],
    }
  }
}

// Add to handleRequest switch statement:
case 'getYourItems':
  return getYourItems(params)
```

**Pattern:**

- Handler function returns `RequestResponse` type: `{ success: boolean, data?: any, message?: string }`
- Get data from `DataStore` or other source
- Log debug/error messages
- Return standardized response object
- Add case to `handleRequest` switch statement

### 5. Form Builder Integration

**File:** `dwertheimer.Forms/src/components/fieldTypes.js`

Add your field type to the `FIELD_TYPES` array:

```typescript
export const FIELD_TYPES: Array<FieldTypeOption> = [
  // ... existing types ...
  { 
    value: 'your-new-type', 
    label: 'Your New Chooser', 
    description: 'Description of what this field does' 
  },
]
```

This makes the field type available in the Form Builder's field type selector.

### 6. Form Item Editor (Optional)

**File:** `dwertheimer.Forms/src/components/FieldEditor.jsx`

If your field has custom properties that need to be edited in the Form Builder, add editor UI in the `FieldEditor` component:

```typescript
// Find the section for your field type and add editor rows:
{editedField.type === 'your-new-type' ? (
  <>
    <div className="field-editor-row">
      <label>Your Custom Property:</label>
      <input 
        type="text" 
        value={editedField.yourCustomProperty || ''} 
        onChange={(e) => updateField({ yourCustomProperty: e.target.value })} 
        placeholder="Enter value"
      />
      <div className="field-editor-help">Help text explaining this property</div>
    </div>
  </>
) : null}
```

For `frontmatter-key-chooser`, the Form Item Editor includes a **Value Separator** dropdown (when not returning as array): Comma (no space), Comma with space, or Space. Look for similar patterns in the file for other field types to see how to add editor UI.

### 7. Test/Examples

**File:** `dwertheimer.Forms/src/FormFieldRenderTest.js`

Add examples to the `testFormFields` array. Create a new heading/section for your field type and add examples for each important parameter:

```typescript
{
  type: 'heading',
  label: 'Your New Field Type',
  underline: true,
},
{
  type: 'your-new-type',
  label: 'Your New Chooser (Basic)',
  key: 'testYourNewChooser',
  placeholder: 'Type to search...',
  description: 'Basic example of your new chooser',
},
{
  type: 'your-new-type',
  label: 'Your New Chooser (With Custom Property)',
  key: 'testYourNewChooserCustom',
  placeholder: 'Type to search...',
  description: 'Example with custom property set',
  yourCustomProperty: 'custom-value',
},
{
  type: 'your-new-type',
  label: 'Your New Chooser (Array Format)',
  key: 'testYourNewChooserArray',
  placeholder: 'Type to search...',
  description: 'Example returning array format',
  returnAsArray: true,
},
{
  type: 'your-new-type',
  label: 'Your New Chooser (Comma+space string)',
  key: 'testYourNewChooserCommaSpace',
  placeholder: 'Type to search...',
  description: 'Example with valueSeparator: commaSpace (e.g. "a, b, c")',
  returnAsArray: false,
  valueSeparator: 'commaSpace',
},
// ... add more examples for each important parameter
```

**Best Practices:**

- Create a heading section for your field type
- Include examples for:
  - Basic usage
  - Each custom property/parameter
- Different return formats (string vs array, if applicable) and string separator options (`valueSeparator`: comma, commaSpace, space) for choosers that support it (e.g. `frontmatter-key-chooser`)
- Different states (default checked, with filters, etc.)
- Use descriptive keys like `testYourNewChooser`, `testYourNewChooserCustom`, etc.
- Include helpful descriptions explaining what each example demonstrates

## Complete Example: TagChooser and MentionChooser

The `tag-chooser` and `mention-chooser` field types serve as complete reference examples. Study these implementations to understand the full pattern:

### Files to Review

- **Type Definitions:** `helpers/react/DynamicDialog/DynamicDialog.jsx` (lines ~65, ~95-100)
- **Components:**
  - `helpers/react/DynamicDialog/TagChooser.jsx`
  - `helpers/react/DynamicDialog/MentionChooser.jsx`
  - `helpers/react/DynamicDialog/ContainedMultiSelectChooser.jsx` (base component)
- **Renderer:** `helpers/react/DynamicDialog/dialogElementRenderer.js` (lines ~859-928)
- **Request Handlers:** `dwertheimer.Forms/src/requestHandlers.js` (getHashtags, getMentions)
- **Form Builder:** `dwertheimer.Forms/src/components/fieldTypes.js` (lines 30-31)
- **Examples:** `dwertheimer.Forms/src/FormFieldRenderTest.js` (lines ~916-973)

### Key Patterns from TagChooser/MentionChooser

1. **Base Component Reuse**: Both use `ContainedMultiSelectChooser` as a base component
2. **Dynamic Data Loading**: Both load data via `requestFromPlugin('getHashtags')` / `requestFromPlugin('getMentions')`
3. **Memoization**: `getItemDisplayLabel` functions are wrapped in `useCallback`
4. **Prefix Handling**: Components handle adding/removing prefixes (`#` for tags, `@` for mentions)
5. **Return Formats**: Support both string and array return formats via `returnAsArray` prop. When returning a string, `valueSeparator` controls how multiple values are joined: `'comma'` (no space), `'commaSpace'` (comma + space for readability), or `'space'` (space-separated).
6. **Default State**: Support `defaultChecked` to pre-select all items
7. **Filtering**: Support `includePattern` and `excludePattern` for regex-based filtering

## Common Patterns

### Pattern 1: Simple Static Component

If your component doesn't need dynamic data and is simple:

1. Create component file
2. Add type to `TSettingItemType`
3. Add renderer case
4. Add to Form Builder field types
5. Add examples

### Pattern 2: Dynamic Data Component

If your component needs to load data from the plugin:

1. Create component file (with `requestFromPlugin` prop)
2. Add type to `TSettingItemType` (with custom properties if needed)
3. Add renderer case (pass `requestFromPlugin`)
4. Add request handler in plugin
5. Add to Form Builder field types
6. Add examples

### Pattern 3: Complex Component with Base

If your component shares functionality with others:

1. Create base component (e.g., `ContainedMultiSelectChooser`)
2. Create specific component that uses base (e.g., `TagChooser` uses `ContainedMultiSelectChooser`)
3. Follow Pattern 2 for integration

## Testing Checklist

After creating your new field type, verify:

- [ ] Type is added to `TSettingItemType`
- [ ] Custom properties are added to `TSettingItem` (if needed)
- [ ] Component is created and exported
- [ ] Component imports are added to `dialogElementRenderer.js`
- [ ] Renderer case is added to switch statement
- [ ] Request handler is added (if needed)
- [ ] Request handler is added to `handleRequest` switch (if needed)
- [ ] Field type is added to `FIELD_TYPES` array
- [ ] Editor UI is added to `FieldEditor` (if custom properties)
- [ ] Examples are added to `FormFieldRenderTest.js` (including valueSeparator variants if the field returns a string of multiple values)
- [ ] Component handles loading/error/empty states
- [ ] Component properly memoizes functions (if needed) - note: `requestFromPlugin` is already memoized in parent
- [ ] Component passes `requestFromPlugin` if needed
- [ ] Component handles value prop changes correctly
- [ ] CSS classes are properly namespaced
- [ ] Component includes `data-field-type` attribute for debugging
- [ ] Forms README is updated with new field type or feature documentation

## Troubleshooting

### Form Submit Freezes After "getTemplatingContext: Getting..."

If the form freezes when submitting and logs show `getTemplatingContext: Getting templating render context...` but nothing after:

1. **Where it hangs:** The hang is at `DataStore.invokePluginCommandByName('getRenderContext', 'np.Templating', [formValues])` (Forms plugin calling np.Templating). Either the NotePlan plugin bridge never invokes np.Templating, or np.Templating's `getRenderContext` runs but blocks inside (e.g. in `NPTemplating.setup` or `getRenderDataWithMethods`).
2. **Check np.Templating logs:** If you see `np.Templating getRenderContext: ENTRY` in logs, the bridge reached np.Templating and the hang is inside `getRenderContext` (setup, engine, or globals). If you never see that line, the hang is in the bridge before np.Templating runs.
3. **Timeout:** Forms applies a 20s timeout in `getTemplatingContext` (see `formSubmission.js`). If you get a timeout error, the invoke did not return in time—check np.Templating's `getRenderContext` and the plugin bridge. This does not fix the root cause but prevents indefinite freeze and surfaces a clear error.

### Component Not Showing

- Check that type is in `TSettingItemType`
- Check that renderer case matches type string exactly
- Check browser console for errors

### requestFromPlugin Memoization

**IMPORTANT**: The `requestFromPlugin` function is already memoized in parent components (FormView, FormBuilderView, FormBrowserView) using `useCallback`.

- **You do NOT need to memoize `requestFromPlugin`** in your component - it's passed as a prop and should already have a stable reference
- If `requestFromPlugin` is included in `useEffect` dependencies, it should work correctly because it's memoized upstream
- If you create functions that use `requestFromPlugin` and pass them to child components or use them in context, wrap those functions in `useCallback`
- See `.cursor/rules/noteplan-programming-general.mdc` for detailed memoization guidelines

**Example pattern (already done in parent):**

```typescript
// In FormView/FormBuilderView (parent component)
const requestFromPlugin = useCallback(
  (command: string, dataToSend: any = {}, timeout: number = 10000): Promise<any> => {
    // ... implementation
  },
  [dispatch] // Only depend on dispatch, which should be stable
)
```

**In your component (child):**

```typescript
// requestFromPlugin is already memoized - use it directly
useEffect(() => {
  if (requestFromPlugin && !loaded && !loading) {
    requestFromPlugin('getYourItems', {})
      // ...
  }
}, [requestFromPlugin, loaded, loading]) // Safe to include in dependencies
```

### Data Not Loading

- Verify request handler is implemented
- Verify request handler is in `handleRequest` switch
- Check that `requestFromPlugin` is passed in renderer
- Check browser console for error messages
- Verify handler returns correct `RequestResponse` format

### Selection Not Working

- Check `useEffect` dependencies - don't include `filteredItems` if it causes resets
- Verify `onChange` handler is called correctly
- Check that `handleFieldChange` is called with correct key

### Frequent Re-renders

- Wrap functions passed as props in `useCallback`
- Check `useEffect` dependencies - only include what's necessary
- Verify `useMemo` is used for computed values

## 8. Form Tester Integration

**File:** `dwertheimer.Forms/src/FormFieldRenderTest.js`

Add examples to the `testFormFields` array to demonstrate your new field type or feature. This ensures the feature works correctly and helps catch regressions.

### Adding Examples

Create a new heading section for your field type and add examples for each important configuration:

```typescript
{
  type: 'heading',
  label: 'Your New Field Type',
  underline: true,
},
{
  type: 'your-new-type',
  label: 'Your New Field (Basic)',
  key: 'testYourNewField',
  placeholder: 'Type to search...',
  description: 'Basic example of your new field',
},
{
  type: 'your-new-type',
  label: 'Your New Field (With Custom Property)',
  key: 'testYourNewFieldCustom',
  placeholder: 'Type to search...',
  description: 'Example with custom property set',
  yourCustomProperty: 'custom-value',
},
// ... add more examples for each important parameter
```

### Best Practices

- Create a heading section for your field type
- Include examples for:
  - Basic usage
  - Each custom property/parameter
  - Different return formats (string vs array, if applicable)
  - Different states (default checked, with filters, etc.)
  - Compact vs non-compact display
  - Any value dependencies (dependsOnKey, sourceKey, etc.)
- Use descriptive keys like `testYourNewField`, `testYourNewFieldCustom`, etc.
- Include helpful descriptions explaining what each example demonstrates

### Example: Multi-Select Note Chooser

```typescript
{
  type: 'heading',
  label: 'Note Chooser: Multi-Select',
  underline: true,
},
{
  type: 'note-chooser',
  label: 'Note Chooser (Multi-Select, Wikilink, Space)',
  key: 'testNoteMultiSelectWikilink',
  allowMultiSelect: true,
  noteOutputFormat: 'wikilink',
  noteSeparator: 'space',
  includePersonalNotes: true,
  showValue: true,
  description: 'Multi-select note chooser with wikilink format ([[Note Title]]) separated by spaces',
},
```

## 9. Forms README Documentation

**File:** `dwertheimer.Forms/README.md`

Document your new field type or feature in the Forms plugin README to help users understand and use it.

### Where to Add Documentation

1. **"Available Field Types" Section** (around line 174)
   - If adding a new field type, add it to the appropriate category (Basic, Selection, Display, Advanced)
   - Include a brief description of what it does
   - For significant features on existing types, update the description

2. **Field Type JSON Reference Section** (around line 497+)
   - Add or update the JSON example for your field type
   - Document all new properties and options
   - Include examples showing different configurations

3. **Tips and Best Practices** (around line 246)
   - Add any relevant tips for using your new feature effectively

### Example: Adding Multi-Select NoteChooser Documentation

**In "Available Field Types" section:**
```markdown
- **Note Chooser** - Search and select a note (supports single or multi-select with configurable output format)
```

**In JSON Reference section:**
```markdown
**`note-chooser`** - Searchable note selector
```javascript
{
  key: 'targetNote',
  label: 'Select Note',
  type: 'note-chooser',
  allowMultiSelect: true, // Enable multi-select mode
  noteOutputFormat: 'wikilink', // 'wikilink' | 'pretty-link' | 'raw-url'
  noteSeparator: 'space', // 'space' | 'comma' | 'newline'
  // ... other options
}
```
```

## Additional Resources

- **DynamicDialog Documentation**: See `_README.md` in this directory
- **CSS Variables**: See `CSS_VARIABLE_ANALYSIS.md` for available theme colors
- **React Patterns**: See cursor rules for memoization and React best practices
- **Existing Examples**: Study `TagChooser`, `MentionChooser`, `NoteChooser`, `FolderChooser`, etc.
- **Quick Checklist**: See `DD_NEW_FEATURE_CHECKLIST.md` for a concise checklist when adding new features