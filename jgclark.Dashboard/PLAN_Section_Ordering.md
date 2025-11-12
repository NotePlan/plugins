# Plan: Visual Section Ordering for Dashboard Plugin

## Overview
This plan outlines how to extend the `jgclark.Dashboard` plugin to allow users to visually reorder sections and persist that order in settings.

## Current Implementation

### Section Ordering
- Sections are currently ordered using a hardcoded constant `sectionDisplayOrder` in `src/constants.js`:
  ```javascript
  export const sectionDisplayOrder = ['INFO', 'SEARCH', 'SAVEDSEARCH', 'TB', 'DT', 'DY', 'DO', 'LW', 'W', 'M', 'Q', 'TAG', 'OVERDUE', 'PRIORITY', 'PROJ']
  ```
- The `sortSections()` function in `src/react/components/Section/sectionHelpers.js` uses this order to sort sections before rendering
- The Dashboard component applies this sorting in `Dashboard.jsx` line 125:
  ```javascript
  sections = useMemo(() => sortSections(sections, sectionDisplayOrder), [sections, sectionDisplayOrder])
  ```

### Settings Persistence
- Settings are stored in `DataStore.settings.dashboardSettings` as stringified JSON
- Settings are defined in `src/dashboardSettings.js` using `TSettingItem` type
- Settings can be edited via:
  - `SettingsDialog` component (gear icon in header)
  - `PerspectivesTable` component (for bulk editing across perspectives)
  - Dropdown menus in the Header

## Implementation Plan

### Phase 1: Add Setting for Custom Section Order

#### 1.1 Add Setting Definition
**File**: `src/dashboardSettings.js`

Add a new hidden setting to store the custom section order:
```javascript
{
  key: 'customSectionDisplayOrder',
  label: 'Custom Section Display Order',
  type: 'hidden',
  default: null, // null means use default order
}
```

**Rationale**: 
- Hidden type because users won't edit this directly via text input
- Stored as an array of section codes (e.g., `['DT', 'W', 'M', ...]`)
- `null` or empty array means use the default `sectionDisplayOrder`

#### 1.2 Update Types
**File**: `src/types.js`

Ensure `TDashboardSettings` type includes:
```javascript
customSectionDisplayOrder?: ?Array<TSectionCode>
```

### Phase 2: Create Visual Reorder Component

#### 2.1 Create SectionOrderDialog Component
**New File**: `src/react/components/SectionOrderDialog.jsx`

A modal dialog component that:
- Displays all visible sections in a draggable list
- Shows section names (e.g., "Today", "Week", "Month") with icons if available
- Allows drag-and-drop reordering
- Shows a "Reset to Default" button
- Has "Save" and "Cancel" buttons

**Implementation Note**: 
- Use `DynamicDialog` from `@helpers/react/DynamicDialog/DynamicDialog.jsx` as the base (similar to `PerspectivesTable.jsx`)
- Or use `Modal` component (like `SettingsDialog.jsx` does)
- The dialog should be modal and centered on screen

**Key Features**:
- Only shows sections that are currently visible (based on `show*Section` settings)
- Uses HTML5 drag-and-drop API or a lightweight library
- Visual feedback during dragging (highlight, ghost image)
- Disabled sections (those with `show*Section: false`) should still be shown but grayed out, with option to include/exclude from ordering

**Component Structure**:
```javascript
type SectionOrderDialogProps = {
  sections: Array<TSection>,
  currentOrder: ?Array<TSectionCode>,
  defaultOrder: Array<TSectionCode>,
  onSave: (newOrder: Array<TSectionCode>) => void,
  onCancel: () => void,
}
```

#### 2.2 Drag-and-Drop Implementation Options

**Option A: Native HTML5 Drag-and-Drop**
- Pros: No dependencies, lightweight
- Cons: More code to write, less polished UX
- Implementation: Use `onDragStart`, `onDragOver`, `onDrop` events

**Option B: React DnD Kit (or similar)**
- Pros: Better UX, handles edge cases, accessible
- Cons: Additional dependency
- Recommendation: Start with native HTML5, upgrade if needed

**Option C: Simple Up/Down Arrow Buttons**
- Pros: Simplest implementation, works on all devices
- Cons: Less visual/intuitive
- Could be a fallback for mobile or as an alternative UI

**Recommendation**: Start with **Option A** (native HTML5) for simplicity, with **Option C** as a fallback/alternative.

### Phase 3: Integrate into Settings UI

#### 3.1 Add Button to Settings Dialog
**File**: `src/react/components/SettingsDialog.jsx` or `src/dashboardSettings.js`

Add a button or menu item in the settings dialog that opens the `SectionOrderDialog`.

**Location Options**:
1. **In Settings Dialog**: Add a button in the "Display settings" section
2. **In Header Dropdown**: Add to the Filters dropdown menu
3. **Separate Menu Item**: Add a new icon/button in the Header

**Recommendation**: Add to Settings Dialog under "Display settings" heading, as it's a display-related setting.

#### 3.2 Update Settings Dialog
**File**: `src/react/components/SettingsDialog.jsx`

- Add state to track if `SectionOrderDialog` is open
- Add handler to open/close the dialog
- Pass current `customSectionDisplayOrder` setting (or `null` if not set)
- On save, update `dashboardSettings.customSectionDisplayOrder`

### Phase 4: Apply Custom Order to Section Rendering

#### 4.1 Update sortSections Function
**File**: `src/react/components/Section/sectionHelpers.js`

Modify `sortSections()` to accept an optional custom order:
```javascript
export function sortSections(
  sections: Array<TSection>, 
  predefinedOrder: Array<TSectionCode>,
  customOrder?: ?Array<TSectionCode>
): Array<TSection> {
  const orderToUse = customOrder && customOrder.length > 0 ? customOrder : predefinedOrder
  // ... rest of implementation
}
```

#### 4.2 Update Dashboard Component
**File**: `src/react/components/Dashboard.jsx`

Update line 125 to pass custom order:
```javascript
sections = useMemo(() => 
  sortSections(
    sections, 
    sectionDisplayOrder, 
    dashboardSettings?.customSectionDisplayOrder
  ), 
  [sections, sectionDisplayOrder, dashboardSettings?.customSectionDisplayOrder]
)
```

### Phase 5: Handle Edge Cases

#### 5.1 Missing Sections in Custom Order
- If a section code exists in sections but not in custom order, append it to the end
- If a section code is in custom order but doesn't exist, ignore it

#### 5.2 New Sections Added
- When new section types are added to the plugin, they should appear at the end if not in custom order
- Consider a "Reset to Default" option that includes new sections

#### 5.3 TAG Sections
- TAG sections are dynamic (one per tag in `tagsToShow` setting)
- All TAG sections should be grouped together in the order
- Custom order should specify where the TAG group appears, not individual tags

**Implementation**: 
- In `sortSections()`, treat all TAG sections as a group
- Sort TAG sections alphabetically within the group
- Place the group at the position specified in custom order (or default position)

#### 5.4 Perspectives
- Each perspective can have its own section order
- Store `customSectionDisplayOrder` per perspective in `perspectiveSettings`
- When switching perspectives, apply that perspective's custom order

**Implementation**:
- Store order in `TPerspectiveDef.dashboardSettings.customSectionDisplayOrder`
- When applying a perspective, use its custom order
- Default perspective uses global `dashboardSettings.customSectionDisplayOrder`

### Phase 6: UI/UX Considerations

#### 6.1 Visual Design
- Use clear drag handles (e.g., `::before` with grip icon)
- Show section icons/colors if available
- Highlight the drag target area
- Smooth animations for reordering

#### 6.2 Accessibility
- Keyboard navigation (arrow keys to move items up/down)
- Screen reader support
- Focus management

#### 6.3 Mobile Support
- On mobile, use up/down arrow buttons instead of drag-and-drop
- Or use a simpler tap-to-move interface

### Phase 7: Testing

#### 7.1 Test Cases
1. **Basic Reordering**: Drag sections to new positions, save, verify order persists
2. **Reset to Default**: Click reset, verify default order is restored
3. **Missing Sections**: Add a section that's not in custom order, verify it appears at end
4. **Hidden Sections**: Test with sections that are hidden (show*Section: false)
5. **Perspectives**: Test that different perspectives can have different orders
6. **TAG Sections**: Verify TAG sections are grouped correctly
7. **Empty Custom Order**: Test with `null` or empty array (should use default)

#### 7.2 Edge Cases
- All sections hidden
- Only one section visible
- Custom order with invalid section codes
- Rapid drag-and-drop operations

## File Changes Summary

### New Files
1. `src/react/components/SectionOrderDialog.jsx` - Main reorder dialog component
2. `src/react/css/SectionOrderDialog.css` - Styles for the dialog (optional, may reuse existing dialog styles)

### Modified Files
1. `src/constants.js` - (No changes, but referenced)
2. `src/dashboardSettings.js` - Add `customSectionDisplayOrder` setting definition
3. `src/types.js` - Add type for custom order in `TDashboardSettings`
4. `src/react/components/Section/sectionHelpers.js` - Update `sortSections()` to use custom order
5. `src/react/components/Dashboard.jsx` - Pass custom order to `sortSections()`
6. `src/react/components/SettingsDialog.jsx` - Add button to open SectionOrderDialog
7. `src/perspectiveHelpers.js` - (If needed) Handle custom order in perspectives

## Implementation Order

1. **Phase 1**: Add setting definition and types
2. **Phase 4**: Update sorting logic to use custom order (with default initially)
3. **Phase 2**: Create SectionOrderDialog component
4. **Phase 3**: Integrate dialog into settings UI
5. **Phase 5**: Handle edge cases (TAG sections, missing sections, etc.)
6. **Phase 6**: Polish UI/UX
7. **Phase 7**: Testing

## Future Enhancements (Out of Scope)

- Per-section visibility toggle in the reorder dialog
- Drag sections between different dashboard views
- Export/import section orders
- Section grouping/collapsing
- Keyboard shortcuts for reordering

## Notes

- The default `sectionDisplayOrder` should remain as a fallback
- Consider backward compatibility: if `customSectionDisplayOrder` is not set, use default
- The setting should be optional - users who don't customize should see no change
- Consider adding a visual indicator in the settings dialog showing that custom ordering is active

