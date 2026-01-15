# DynamicDialog New Feature Checklist

Quick checklist for adding a new feature or setting to an existing DynamicDialog field type.

## Files to Update

### 1. Type Definitions
**File:** `helpers/react/DynamicDialog/DynamicDialog.jsx`
- [ ] Add new property to `TSettingItem` type (if needed)
- [ ] Document the property with a comment

### 2. Component Implementation
**File:** `helpers/react/DynamicDialog/[ComponentName].jsx`
- [ ] Add new prop to component's props type
- [ ] Add prop to function parameters with default value
- [ ] Implement the feature logic
- [ ] **CRITICAL**: Wrap functions passed to context/children in `useCallback` to prevent infinite loops
- [ ] **CRITICAL**: Use `useMemo` for context values if passing to `AppProvider`
- [ ] **CRITICAL**: Never use dynamic imports (`require()` or dynamic `import()`) - use static imports at top of file

### 3. Dialog Element Renderer
**File:** `helpers/react/DynamicDialog/dialogElementRenderer.js`
- [ ] Import component if new component (add at top)
- [ ] Extract new property from `item` using `(item: any).propertyName` pattern
- [ ] Pass property to component as prop
- [ ] Handle value storage/formatting if needed (e.g., multi-select vs single-select)

### 4. Field Editor UI
**File:** `dwertheimer.Forms/src/components/FieldEditor.jsx`
- [ ] Find the section for your field type (e.g., `{editedField.type === 'note-chooser' && (`)
- [ ] Add UI control (checkbox, dropdown, input, etc.)
- [ ] Use `((editedField: any): { propertyName?: type }).propertyName` pattern to read value
- [ ] Update `editedField` state when value changes
- [ ] Add helpful description in `field-editor-help` div
- [ ] Show/hide related options conditionally if needed (e.g., only show when checkbox is checked)

### 5. Form Tester
**File:** `dwertheimer.Forms/src/FormFieldRenderTest.js`
- [ ] Add heading section for your feature (if creating new examples)
- [ ] Add example(s) demonstrating the new feature
- [ ] Include examples for different configurations/options
- [ ] Add descriptive `key` (e.g., `testNoteMultiSelectWikilink`)
- [ ] Add helpful `description` explaining what the example demonstrates

## Critical Notes

### ❌ Never Use Dynamic Imports
```javascript
// ❌ WRONG - Rollup won't process these correctly
const MyComponent = require('./MyComponent')
const MyComponent = await import('./MyComponent')

// ✅ CORRECT - Use static imports at top of file
import MyComponent from './MyComponent.jsx'
```

### ⚠️ Prevent Infinite Loops
**Functions passed to React Context or child components MUST be wrapped in `useCallback`:**

```javascript
// ❌ WRONG - Causes infinite loops
const handleChange = (value) => {
  onChange(value)
}

// ✅ CORRECT - Stable function reference
const handleChange = useCallback((value) => {
  onChange(value)
}, [onChange]) // Only recreate if dependencies change
```

**Context values MUST use `useMemo`:**

```javascript
// ❌ WRONG - Causes infinite loops
const contextValue = {
  handleChange,
  otherValue,
}

// ✅ CORRECT - Memoized context value
const contextValue = useMemo(() => ({
  handleChange,
  otherValue,
}), [handleChange, otherValue])
```

### 📝 Value Storage Patterns

**Single-select (stores filename):**
```javascript
onChange(noteTitle, noteFilename) // Stores noteFilename
```

**Multi-select (stores formatted string):**
```javascript
onChange(formattedString, '') // Stores formattedString, empty filename
```

**In dialogElementRenderer:**
```javascript
const valueToStore = item.allowMultiSelect ? noteTitle : noteFilename
handleFieldChange(item.key, valueToStore)
```

## Testing Checklist

- [ ] Type definitions updated
- [ ] Component accepts and uses new prop
- [ ] Renderer passes prop correctly
- [ ] Field Editor UI works (can set/get value)
- [ ] Form Tester examples added
- [ ] No linter errors
- [ ] No infinite loops (check React DevTools Profiler)
- [ ] Value storage/retrieval works correctly
- [ ] Feature works in both compact and non-compact display modes
- [ ] Feature works with value dependencies (if applicable)

## Quick Reference: Common Patterns

### Adding a Checkbox Option
```javascript
// In FieldEditor.jsx
<div className="field-editor-row">
  <label>
    <input
      type="checkbox"
      checked={((editedField: any): { newProperty?: boolean }).newProperty || false}
      onChange={(e) => {
        const updated = { ...editedField }
        ;(updated: any).newProperty = e.target.checked
        setEditedField(updated)
      }}
    />
    Enable New Feature
  </label>
  <div className="field-editor-help">Description of what this does</div>
</div>
```

### Adding a Dropdown Option
```javascript
// In FieldEditor.jsx
<div className="field-editor-row">
  <label>Output Format:</label>
  <select
    value={((editedField: any): { format?: string }).format || 'default'}
    onChange={(e) => {
      const updated = { ...editedField }
      ;(updated: any).format = e.target.value
      setEditedField(updated)
    }}
  >
    <option value="default">Default</option>
    <option value="option1">Option 1</option>
  </select>
  <div className="field-editor-help">Description</div>
</div>
```

### Conditional Options (Show Only When Checkbox is Checked)
```javascript
{((editedField: any): { allowMultiSelect?: boolean }).allowMultiSelect && (
  <>
    <div className="field-editor-row">
      {/* Additional options here */}
    </div>
  </>
)}
```

## See Also

- **Full Guide**: `CREATING_NEW_DYNAMICDIALOG_FIELD_TYPES.md` - Comprehensive guide for creating entirely new field types
- **React Patterns**: See cursor rules for memoization guidelines
- **Existing Examples**: Study `TagChooser`, `MentionChooser`, `NoteChooser` for reference implementations
