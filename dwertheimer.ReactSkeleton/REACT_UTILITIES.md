# React Utilities

This document describes utility functions available for React components in NotePlan plugins.

## Location

Utility functions are located in `@helpers/react/reactUtils.js` and can be imported in any React component.

## Available Functions

### `truncatePath(path: string, maxLength?: number): string`

Truncates a folder or file path to show the beginning and end when it's too long, with ellipsis in the middle.

**Parameters:**
- `path` (string) - The path to truncate
- `maxLength` (number, optional) - Maximum length of the truncated path (default: 50)

**Returns:** (string) - The truncated path

**Examples:**

```javascript
import { truncatePath } from '@helpers/react/reactUtils'

// Short path - no truncation
truncatePath('Folder1/Subfolder', 50)
// Returns: 'Folder1/Subfolder'

// Long path - shows first and last parts
truncatePath('very/long/path/to/some/folder', 30)
// Returns: 'very/.../folder'

// Very long path - truncates parts themselves
truncatePath('very/long/path/to/some/folder', 15)
// Returns: 'ver/…/der'
```

**Use Cases:**
- Displaying folder paths in dropdowns or lists
- Showing file paths in UI where space is limited
- Breadcrumb navigation

### `truncateText(text: string, maxLength?: number): string`

Truncates a note title or any string, showing start and end when too long.

**Parameters:**
- `text` (string) - The text to truncate
- `maxLength` (number, optional) - Maximum length (default: 50)

**Returns:** (string) - The truncated text

**Examples:**

```javascript
import { truncateText } from '@helpers/react/reactUtils'

// Short text - no truncation
truncateText('Short title', 50)
// Returns: 'Short title'

// Long text - shows start and end
truncateText('This is a very long note title that needs to be truncated', 30)
// Returns: 'This is a ver…truncated'

// Very long text - shows more end than start
truncateText('This is a very long note title that needs to be truncated', 15)
// Returns: '…truncated'
```

**Use Cases:**
- Displaying note titles in lists
- Showing long text in table cells
- Truncating user input previews

## Usage in React Components

```javascript
import React from 'react'
import { truncatePath, truncateText } from '@helpers/react/reactUtils'

export function MyComponent({ note, folderPath }) {
  return (
    <div>
      <div>Note: {truncateText(note.title, 40)}</div>
      <div>Path: {truncatePath(folderPath, 30)}</div>
    </div>
  )
}
```

## Implementation Details

### `truncatePath`

- Handles root folder (`/`) specially
- Splits path by `/` and filters empty parts
- For single-part paths, uses `truncateText` logic
- For multi-part paths, shows first part + middle parts (if space) + last part
- Intelligently truncates parts themselves if even minimal version is too long

### `truncateText`

- Ensures at least 30% of start and 30% of end are shown
- Uses single character ellipsis (`…`) for better space efficiency
- Falls back to showing only end if text is very short relative to maxLength

## Best Practices

1. **Choose appropriate maxLength** - Consider your UI constraints and typical content length
2. **Test with various lengths** - Ensure truncation works well for both short and very long content
3. **Provide full text on hover** - Consider adding `title` attribute with full text for accessibility
4. **Be consistent** - Use the same maxLength for similar UI elements

## See Also

- `@helpers/react/reactUtils.js` - Source code for these utilities
- [REACT_COMMUNICATION_PATTERNS.md](REACT_COMMUNICATION_PATTERNS.md) - Communication patterns guide








