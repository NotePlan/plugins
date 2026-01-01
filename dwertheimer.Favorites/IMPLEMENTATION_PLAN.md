# Favorites Browser Implementation Plan

## Overview
This plan outlines the implementation of a React-based Favorites Browser for the dwertheimer.Favorites plugin, using reusable FilterableList and List components with NotePlan sidebar-style display.

## Components to Create

### 1. Reusable Components (in helpers/react/)

#### 1.1 List Component (`helpers/react/List.jsx`)
- **Purpose**: Core list rendering component that can work with different filter mechanisms
- **Props**:
  - `items: Array<any>` - Array of items to display
  - `displayType: 'noteplan-sidebar' | 'chips'` - Display style
  - `renderItem: (item: any, index: number) => React$Node` - Custom render function for each item
  - `onItemClick: (item: any, event: MouseEvent) => void` - Click handler
  - `selectedIndex: ?number` - Currently selected item index
  - `itemActions?: Array<{icon: string, onClick: (item: any, event: MouseEvent) => void, title?: string}>` - Actions to show on right side
  - `emptyMessage?: string` - Message when list is empty
  - `loading?: boolean` - Loading state
- **Features**:
  - Two display styles:
    - `noteplan-sidebar`: Hierarchical folder/file style (like NotePlan sidebar)
    - `chips`: Card/chip style (like FormBrowser left side)
  - Support for action buttons on the right side of each item
  - Keyboard navigation support
  - Selected/active states

#### 1.2 FilterableList Component (`helpers/react/FilterableList.jsx`)
- **Purpose**: Wrapper component that adds filtering capability to List
- **Props**:
  - All List props
  - `filterText: string` - Current filter text
  - `onFilterChange: (text: string) => void` - Filter change handler
  - `filterPlaceholder?: string` - Placeholder for filter input
  - `renderFilter?: () => React$Node` - Custom filter component (optional)
- **Features**:
  - Text input for filtering
  - Filters items based on filterText
  - Can be replaced with custom filter mechanism

#### 1.3 CSS Files
- `helpers/react/List.css` - Styles for List component
- `helpers/react/FilterableList.css` - Styles for FilterableList component

### 2. Favorites Plugin React Components

#### 2.1 FavoritesView Component (`dwertheimer.Favorites/src/components/FavoritesView.jsx`)
- **Purpose**: Main React component for the Favorites Browser
- **Features**:
  - Uses FilterableList with noteplan-sidebar display style
  - Toggle switch to switch between favorite notes and favorite commands
  - Displays list of favorites (notes or commands)
  - Handles click events (normal, opt-click, cmd-click)
  - Uses AppContext for communication with plugin

#### 2.2 AppContext (`dwertheimer.Favorites/src/components/AppContext.jsx`)
- **Purpose**: React Context for plugin communication (copy from Forms plugin)
- **Features**:
  - `sendActionToPlugin` - Send actions to plugin
  - `sendToPlugin` - Send to plugin without saving scroll
  - `requestFromPlugin` - Request/response pattern
  - `dispatch` - Dispatch messages
  - `pluginData` - Data from plugin
  - `reactSettings` - Local React settings
  - `setReactSettings` - Update React settings

#### 2.3 CSS Files
- `dwertheimer.Favorites/src/components/FavoritesView.css` - Styles for FavoritesView

### 3. Plugin Backend Files

#### 3.1 Window Management (`dwertheimer.Favorites/src/windowManagement.js`)
- **Purpose**: Handle opening React windows
- **Functions**:
  - `openFavoritesBrowser()` - Opens the Favorites Browser window
  - `createWindowInitData()` - Creates initial data for React window
  - `getPluginData()` - Gathers data to pass to React window

#### 3.2 Request Handlers (`dwertheimer.Favorites/src/requestHandlers.js`)
- **Purpose**: Handle requests from React components
- **Functions**:
  - `handleGetFavoriteNotes()` - Returns list of favorite notes
  - `handleGetFavoriteCommands()` - Returns list of favorite commands
  - `handleOpenNote()` - Opens a note (handles normal, opt-click, cmd-click)

#### 3.3 Main Handler (`dwertheimer.Favorites/src/index.js`)
- **Purpose**: Plugin entry point
- **Functions**:
  - `openFavoritesBrowser()` - Command to open Favorites Browser
  - `onFavoritesBrowserAction()` - Handler for actions from React window

### 4. Rollup Configuration

#### 4.1 Rollup Entry File (`dwertheimer.Favorites/src/support/rollup.FavoritesView.entry.js`)
- **Purpose**: Entry point for Rollup bundling
- **Content**: Exports FavoritesView as WebView

#### 4.2 Rollup Script (`dwertheimer.Favorites/src/support/performRollup.node.js`)
- **Purpose**: Rollup build script (similar to Forms plugin)
- **Features**:
  - Builds FavoritesView bundle
  - Development mode
  - Watch mode support

### 5. Required Files Structure

```
dwertheimer.Favorites/
├── src/
│   ├── components/
│   │   ├── FavoritesView.jsx
│   │   ├── FavoritesView.css
│   │   └── AppContext.jsx
│   ├── support/
│   │   ├── rollup.FavoritesView.entry.js
│   │   └── performRollup.node.js
│   ├── windowManagement.js
│   ├── requestHandlers.js
│   ├── favorites.js (existing)
│   ├── NPFavorites.js (existing)
│   ├── NPFavoritePresets.js (existing)
│   └── index.js (existing - needs updates)
├── requiredFiles/
│   └── react.c.FavoritesView.bundle.dev.js (generated by rollup)
└── plugin.json (existing - needs new command)

helpers/react/
├── List.jsx (new)
├── List.css (new)
├── FilterableList.jsx (new)
└── FilterableList.css (new)
```

## Implementation Details

### 1. List Component Display Styles

#### NotePlan Sidebar Style
- Hierarchical display with folder/file icons
- Indentation for nested items
- Folder expansion/collapse (if needed)
- Similar to NotePlan's sidebar appearance
- Uses NotePlan theme variables

#### Chips Style
- Card/chip appearance
- Rounded corners
- Border and background
- Similar to FormBrowser left side
- Hover effects
- Selected state highlighting

### 2. Favorite Notes Display
- Show note title
- Show folder path (if applicable)
- Show favorite icon (⭐️)
- Use note decoration (icon, color) from `getNoteDecoration()`
- Display in NotePlan sidebar style

### 3. Favorite Commands Display
- Show command name
- Show command description (if available)
- Display in NotePlan sidebar style
- Icon for command type

### 4. Click Handling
- **Normal click**: `Editor.openNoteByFilename(filename, false, 0, 0, false)`
- **Option-click (Alt)**: `Editor.openNoteByFilename(filename, false, 0, 0, true)` - split view
- **Cmd-click (Meta)**: `Editor.openNoteByFilename(filename, true, 0, 0, false)` - floating window

### 5. Toggle Switch
- Located at top of FilterableList
- Switches between "Favorite Notes" and "Favorite Commands"
- Updates list when toggled
- Persists selection in reactSettings

### 6. Filtering
- Text input at top of FilterableList
- Filters items based on:
  - For notes: title, folder path
  - For commands: command name, description
- Case-insensitive search
- Updates as user types

### 7. Request/Response Pattern
- React components use `requestFromPlugin()` to request data
- Plugin handlers respond with data
- Uses correlation IDs for request matching
- Timeout handling (default 10 seconds)

### 8. Window Opening
- Uses `DataStore.invokePluginCommandByName('showInMainWindow', 'np.Shared', [data, windowOptions])`
- Opens in main window (not floating)
- Uses NotePlan theme CSS
- Includes FontAwesome icons

## Data Flow

1. User runs `/favorites-browser` command
2. Plugin calls `openFavoritesBrowser()`
3. `windowManagement.js` creates window data and calls `showInMainWindow`
4. React window loads `FavoritesView` component
5. `FavoritesView` requests favorite notes/commands via `requestFromPlugin`
6. Plugin handlers return data
7. `FavoritesView` displays data in FilterableList
8. User clicks item → React sends action → Plugin opens note

## Testing Checklist

- [ ] List component renders correctly in both display styles
- [ ] FilterableList filters items correctly
- [ ] Toggle switch switches between notes and commands
- [ ] Normal click opens note in Editor
- [ ] Option-click opens note in split view
- [ ] Cmd-click opens note in floating window
- [ ] Filtering works for both notes and commands
- [ ] Request/response pattern works correctly
- [ ] Window opens in main window
- [ ] NotePlan theme styling applied correctly
- [ ] Keyboard navigation works
- [ ] Action buttons work (if implemented)

## Next Steps

1. Create reusable List and FilterableList components
2. Set up React framework in Favorites plugin
3. Create FavoritesView component
4. Implement window management
5. Implement request handlers
6. Add command to plugin.json
7. Test and refine

