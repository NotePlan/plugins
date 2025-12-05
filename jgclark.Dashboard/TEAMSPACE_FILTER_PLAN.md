# Teamspace Filter Feature - Implementation Plan

## Overview
Add a new filter setting to Dashboard that allows users to filter sections by which Teamspaces to include. This will be a multi-select component in the Settings Dialog, saved per perspective.

## Requirements
1. New setting `includedTeamspaces` (array of teamspace IDs) in dashboardSettings
2. Multi-select component in SettingsDialog before "Folders to Include"
3. Must always have at least one selected (enforce minimum selection)
4. Show only titles, not IDs, and prefix with the Teamspace icon
5. First item should be "Private space" (for notes not in a Teamspace)
6. If no Teamspaces available, show message instead of multi-select
7. Saved separately per perspective
8. Applied to all sections when filtering notes

## Implementation Steps

### 1. Type Definitions (`src/types.js`)
- [ ] Add `includedTeamspaces: Array<string>` to `TDashboardSettings` type (line ~80, near `includedFolders`)
- [ ] Note: This should be perspective-specific (not in `cleanDashboardSettingsInAPerspective` exclusion list)

### 2. Settings Definition (`src/dashboardSettings.js`)
- [ ] Add new setting definition BEFORE `includedFolders` (around line 87):
  ```javascript
  {
    key: 'includedTeamspaces',
    label: 'Teamspaces to Include',
    description: 'Select which Spaces to include when searching for tasks and items. "Private space" includes all notes not in a Teamspace. At least one must be selected.',
    type: 'teamspace-multiselect',
    default: ['private'], // Default to Private space only
    compactDisplay: true,
  },
  ```
- [ ] Update the heading description (line 85) to mention Teamspaces filtering

### 3. Default Values (`src/react/support/settingsHelpers.js` or `src/dashboardHelpers.js`)
- [ ] Ensure `includedTeamspaces` defaults to `['private']` in `dashboardSettingsDefaults`
- [ ] The `getDashboardSettingsDefaults()` function should handle this automatically via the setting definition

### 4. Multi-Select Component (`src/react/components/MultiSelectSpaces.jsx`)
- [ ] Create new component `MultiSelectSpaces.jsx`
- [ ] Props:
  - `value: Array<string>` - array of selected teamspace IDs (including 'private')
  - `onChange: (Array<string>) => void` - callback when selection changes
  - `disabled?: boolean`
  - `label: string`
  - `description?: string`
- [ ] Features:
  - Get teamspaces from `pluginData.notePlanSettings.currentTeamspaces`
  - Display "Private space" as first option (value: 'private')
  - Show teamspace titles (not IDs) for all other options
  - Prefix each teamspace title with the teamspace icon (already defined in top-level CSS) - but not the Private space title
  - Use checkboxes for multi-select
  - Enforce at least one selection (disable last checkbox if only one selected)
  - Show message "You are not a member of any Spaces." if no teamspaces available

### 5. Render Helper (`src/react/support/uiElementRenderHelpers.js`)
- [ ] Add case for `'teamspace-multiselect'` type in `renderItem()` function
- [ ] Import `MultiSelectSpaces` component
- [ ] Pass appropriate props including `value` (array), `onChange` handler

### 6. Settings Dialog (`src/react/components/SettingsDialog.jsx`)
- [ ] Ensure `MultiSelectSpaces` component is available in context
- [ ] Handle the case where `currentTeamspaces` might be empty
- [ ] The component should handle empty teamspaces case internally

### 7. Filter Logic (`src/dashboardHelpers.js` and `src/perspectivesShared.js`)
- [ ] Create helper function `isNoteFromAllowedTeamspace(note: TNote, allowedTeamspaceIDs: Array<string>): boolean`
  - Check if note is teamspace note (`note.isTeamspaceNote`)
  - If teamspace note: check if `note.teamspaceID` is in `allowedTeamspaceIDs`
  - If private note: check if 'private' is in `allowedTeamspaceIDs`
- [ ] Update `getCurrentlyAllowedFolders()` or create `getCurrentlyAllowedTeamspaces()` function
- [ ] Update `filterParasByRelevantFolders()` or create `filterParasByRelevantTeamspaces()` function
- [ ] Apply teamspace filtering in:
  - `getOpenItemParasForTimePeriod()` - filter matchingNotes and refOpenParas
  - `getTaggedSectionData()` - filter notesWithTag
  - Other data generation functions that fetch notes

### 8. Data Generation Functions
- [ ] Update `getOpenItemParasForTimePeriod()` in `dashboardHelpers.js`:
  - Filter `matchingNotes` by teamspace before processing paragraphs
  - Filter `refOpenParas` by teamspace (check `p.note?.teamspaceID` or if private)
- [ ] Update `getTaggedSectionData()` in `dataGenerationTags.js`:
  - Filter `notesWithTag` by teamspace before processing
- [ ] Check other data generation functions in `src/dataGeneration*.js` files

### 9. Perspective Settings (`src/perspectiveHelpers.js`)
- [ ] Verify `includedTeamspaces` is NOT in the exclusion list in `cleanDashboardSettingsInAPerspective()`
- [ ] This ensures it's saved per perspective (which is correct)

### 10. Plugin Data (`src/reactMain.js` or wherever pluginData is created)
- [ ] Ensure `notePlanSettings.currentTeamspaces` is passed to React window
- [ ] This is already done in `getNotePlanSettings()` which calls `getAllTeamspaceIDsAndTitles()`

## Technical Details

### Teamspace ID Representation
- Use `'private'` as a special ID for Private space (notes not in any Teamspace)
- Use actual teamspace IDs (UUIDs) for Teamspace notes
- Check `note.isTeamspaceNote` to determine if note is in a teamspace
- Use `note.teamspaceID` to get the teamspace ID

### Filtering Logic
```javascript
function isNoteFromAllowedTeamspace(note: TNote, allowedTeamspaceIDs: Array<string>): boolean {
  if (note.isTeamspaceNote) {
    return allowedTeamspaceIDs.includes(note.teamspaceID)
  } else {
    // Private note
    return allowedTeamspaceIDs.includes('private')
  }
}
```

### Default Behavior
- Default: `['private']` - only show Private space notes
- If user has teamspaces, they can add them to the selection
- At least one must always be selected

## Testing Checklist
- [ ] Test with no teamspaces (should show message)
- [ ] Test with one teamspace (should show multi-select)
- [ ] Test with multiple teamspaces (should show all)
- [ ] Test selecting/deselecting teamspaces
- [ ] Test that at least one must always be selected
- [ ] Test that "Private space" is always first
- [ ] Test filtering works in calendar sections
- [ ] Test filtering works in Tag/Mention sections
- [ ] Test filtering works in Project sections
- [ ] Test that setting is saved per perspective
- [ ] Test that switching perspectives applies correct filter

## Files to Modify
1. `src/types.js` - Add type definition
2. `src/dashboardSettings.js` - Add setting definition
3. `src/react/components/MultiSelectSpaces.jsx` - NEW FILE - Create component
4. `src/react/support/uiElementRenderHelpers.js` - Add render case
5. `src/dashboardHelpers.js` - Add filtering functions
6. `src/perspectivesShared.js` - Possibly add helper function
7. `src/dataGenerationTags.js` - Apply filtering
8. Any other data generation files that fetch notes

## Notes
- The `getAllTeamspaceIDsAndTitles()` function is already available from `@helpers/NPTeamspace`
- Teamspace notes have `note.isTeamspaceNote === true` and `note.teamspaceID` property
- Private notes have `note.isTeamspaceNote === false` or `note.teamspaceID === undefined`
- The setting should be applied early in the data fetching pipeline, similar to folder filtering

