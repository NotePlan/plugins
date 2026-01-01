# Plan: Separating Today (DT) and Timeblock (TB) Section Generation

## Current Implementation

Currently, both the **Today (DT)** and **Timeblock (TB)** sections are generated together in `getTodaySectionData()`:

1. **Location**: `src/dataGenerationDays.js` lines 35-293
2. **Call Site**: `src/dataGeneration.js` line 88 - both sections generated together:
   ```javascript
   if (sectionCodesToGet.includes('DT') || sectionCodesToGet.includes('TB')) 
     sections.push(...getTodaySectionData(config, useDemoData, useEditorWherePossible))
   ```
3. **Shared Data**: Both sections use the same paragraph data:
   - `sortedOrCombinedParas` - paragraphs from today's note
   - `sortedRefParas` - referenced paragraphs scheduled to today
   - Both collected via `getOpenItemParasForTimePeriod()` with `alsoReturnTimeblockLines: true`

4. **TB Generation**: Lines 247-286 in `getTodaySectionData()`:
   - Filters the combined paras to find timeblocks using `isActiveOrFutureTimeBlockPara()`
   - Creates TB section items from those timeblocks
   - Only generated if `config.showTimeBlockSection` is true

## Required Changes

### 1. Create New Function: `getTimeBlockSectionData()`

**File**: `src/dataGenerationDays.js`

**Purpose**: Extract TB section generation into its own function, independent of DT section.

**Key Requirements**:
- Must call `getOpenItemParasForTimePeriod()` independently (not rely on DT's data)
- Should accept same parameters as `getTodaySectionData()`: `(config, useDemoData, useEditorWherePossible)`
- Should return `Array<TSection>` (single TB section, or empty array)
- Must handle demo data mode (check `demoData.js` for TB demo data structure)
- Should use same date logic (today's date) as DT section

**Implementation Notes**:
- Call `getOpenItemParasForTimePeriod()` with `alsoReturnTimeblockLines: true` to get timeblock paragraphs
- Filter combined paras using `isActiveOrFutureTimeBlockPara(p, mustContainString)`
- Use `createSectionItemObject()` to create section items (similar to current implementation)
- Return section with code 'TB', name 'Current time block', etc.

### 2. Modify `getTodaySectionData()` 

**File**: `src/dataGenerationDays.js`

**Changes Needed**:
- **Remove** lines 247-286 (TB section generation block)
- **Optionally**: Change `getOpenItemParasForTimePeriod()` call to use `alsoReturnTimeblockLines: false` if DT section doesn't need timeblocks (but check if DT section items themselves can have timeblocks - they might need them for display)
- **Keep** the DT section generation logic intact
- Return only DT section(s) - no longer return TB section

**Note**: If DT section items need timeblock information for display/sorting purposes, keep `alsoReturnTimeblockLines: true` but don't create a separate TB section.

### 3. Update Main Data Generation Logic

**File**: `src/dataGeneration.js`

**Current Code** (line 88):
```javascript
if (sectionCodesToGet.includes('DT') || sectionCodesToGet.includes('TB')) 
  sections.push(...getTodaySectionData(config, useDemoData, useEditorWherePossible))
```

**New Code**:
```javascript
if (sectionCodesToGet.includes('DT')) 
  sections.push(...getTodaySectionData(config, useDemoData, useEditorWherePossible))
if (sectionCodesToGet.includes('TB') && config.showTimeBlockSection) 
  sections.push(...getTimeBlockSectionData(config, useDemoData, useEditorWherePossible))
```

**Benefits**:
- DT and TB can be generated independently
- TB can be generated without DT if needed
- Clearer separation of concerns

### 4. Update Refresh Logic

**Files to Check**:
- `src/dashboardHooks.js` - `makeFilenameToSectionCodeList()` may need to handle TB separately
- `src/refreshClickHandlers.js` - Should already work since it uses section codes
- Any action handlers that refresh sections

**Key Consideration**: When actions modify today's note, both DT and TB sections may need refreshing. Check:
- `postActionRefresh` arrays in action buttons (currently only refresh 'DT')
- Whether TB should also refresh when tasks are added/modified in today's note

**Current Action Refresh Points** (in `dataGenerationDays.js`):
- Line 145, 156: `postActionRefresh: ['DT']` - may need to add 'TB' if TB should refresh
- Line 192: `postActionRefresh: ['DT', 'DO']` - may need to add 'TB'

### 5. Demo Data Support

**File**: `src/demoData.js`

**Check**: Does demo data include TB section items? If not, may need to add demo timeblock paragraphs.

**Current**: Demo data has `openTodayItems` and `refTodayItems` - check if these include timeblocks or if separate demo data is needed for TB section.

### 6. Type Definitions

**File**: `src/types.js`

**Status**: Already supports separate section codes:
- Line 141: `TSectionCode` includes both 'DT' and 'TB'
- Line 112: `showTimeBlockSection: boolean` setting exists

**No changes needed** - types already support separation.

### 7. Constants and Settings

**File**: `src/constants.js`

**Check**: 
- Line 15: Section details array - verify TB is listed separately
- Line 41: `defaultSectionDisplayOrder` - verify TB is in correct position
- Line 44: `sectionPriority` - verify TB priority is correct

**File**: `src/dashboardHelpers.js`

**Check**:
- Line 197: `getListOfEnabledSections()` - already handles TB separately (line 197)
- Should already work correctly

### 8. React Component Handling

**Files**: 
- `src/react/components/Section/Section.jsx`
- `src/react/components/Section/useSectionSortAndFilter.jsx`

**Current**: Line 98-114 in `useSectionSortAndFilter.jsx` shows TB section has special filtering logic (only shows current timeblock).

**Status**: Should continue to work - TB section code 'TB' is already handled separately in React components.

### 9. Testing Considerations

**Scenarios to Test**:
1. **DT only**: `showTodaySection: true, showTimeBlockSection: false` - should generate only DT
2. **TB only**: `showTodaySection: false, showTimeBlockSection: true` - should generate only TB
3. **Both**: `showTodaySection: true, showTimeBlockSection: true` - should generate both independently
4. **Refresh**: When today's note changes, verify both sections refresh correctly (if both enabled)
5. **Demo mode**: Verify both sections work in demo mode
6. **Performance**: Verify no performance regression from calling `getOpenItemParasForTimePeriod()` twice

### 10. Potential Optimizations

**Consider**: If both DT and TB are enabled, they both call `getOpenItemParasForTimePeriod()` with the same parameters. This could be optimized by:
- Option A: Cache the result and pass it to both functions
- Option B: Accept that the small performance cost is worth the cleaner separation
- Option C: Create a shared helper that both functions call, but keep generation separate

**Recommendation**: Start with Option B (simple separation), optimize later if needed.

## Implementation Order

1. ✅ **Create `getTimeBlockSectionData()` function** - Extract TB logic from `getTodaySectionData()`
2. ✅ **Modify `getTodaySectionData()`** - Remove TB generation, keep DT logic
3. ✅ **Update `dataGeneration.js`** - Call both functions separately
4. ✅ **Test basic functionality** - Verify both sections generate correctly
5. ✅ **Update refresh logic** - Ensure both sections refresh when needed
6. ✅ **Test refresh scenarios** - Verify actions refresh correct sections
7. ✅ **Performance testing** - Ensure no significant slowdown

## Files That Need Changes

1. **`src/dataGenerationDays.js`**
   - Extract TB generation into `getTimeBlockSectionData()`
   - Remove TB generation from `getTodaySectionData()`
   - Export new function

2. **`src/dataGeneration.js`**
   - Import `getTimeBlockSectionData`
   - Update section generation logic to call functions separately

3. **`src/dataGenerationDays.js`** (action buttons)
   - Consider adding 'TB' to `postActionRefresh` arrays if TB should refresh when tasks change

4. **`src/demoData.js`** (if needed)
   - Add TB demo data if not already present

## Benefits of Separation

1. **Independence**: DT and TB can be generated/refreshed independently
2. **Clarity**: Clearer code organization and responsibility
3. **Flexibility**: Can enable/disable TB without affecting DT generation
4. **Maintainability**: Easier to modify TB logic without touching DT logic
5. **Performance**: Can optimize each section independently

## Potential Issues to Watch For

1. **Double Data Fetching**: Both functions calling `getOpenItemParasForTimePeriod()` - acceptable trade-off for separation
2. **Refresh Coordination**: Ensuring both sections refresh when needed - may need to update `postActionRefresh` arrays
3. **Demo Data**: Ensuring demo mode works for both sections independently
4. **Edge Cases**: What happens if only TB is enabled? Should it still work correctly?

