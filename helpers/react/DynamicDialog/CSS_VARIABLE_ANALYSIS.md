# CSS Variable Analysis for DynamicDialog Components

## Standard Colors (from noteplan-programming-general.mdc lines 279-300)
- `--bg-main-color`
- `--fg-sidebar-color`
- `--bg-sidebar-color`
- `--divider-color`
- `--block-id-color`
- `--fg-main-color`
- `--h1-color`
- `--h2-color`
- `--h3-color`
- `--bg-alt-color`
- `--tint-color`
- `--bg-mid-color`
- `--bg-apple-input-color`
- `--bg-apple-switch-color`
- `--fg-apple-switch-color`
- `--bg-apple-button-color`
- `--item-icon-color`
- `--fg-done-color`
- `--fg-canceled-color`
- `--hashtag-color`
- `--attag-color`
- `--code-color`

---

## Non-Standard CSS Variables Found

### 1. `--fg-alt-color` ⚠️ **CRITICAL - Used Extensively**
**Usage Count:** 15+ times  
**Files:**
- `DynamicDialog.css` (lines 208, 385, 482, 500, 594, 633, 758, 759)
- `CalendarPicker.css` (line 81)
- `DropdownSelect.css` (line 26)

**Where Set:** Not set anywhere - only used with fallback values  
**Current Usage:** Used for labels, descriptions, and secondary text  
**Recommendation:** **ADD TO STANDARD LIST** - This is a critical missing color. It's used extensively for labels and secondary text throughout the dialogs. Should be defined as a standard color (likely a muted version of `--fg-main-color`).

---

### 2. `--text-color` ⚠️ **CRITICAL - Used Extensively**
**Usage Count:** 20+ times  
**Files:**
- `SearchableChooser.css` (lines 51, 99, 250, 268, 337, 380)
- `MultiSelectChooser.css` (lines 26, 56, 182)
- `ExpandableTextarea.css` (lines 29, 44)
- `MarkdownPreview.css` (lines 14, 40, 84)
- `TemplateJSBlock.css` (line 15)

**Where Set:** Not set anywhere - only used with fallback `#333`  
**Current Usage:** Primary text color for inputs, labels, and content  
**Recommendation:** **REPLACE WITH `--fg-main-color`** - This appears to be a duplicate of `--fg-main-color`. All instances should use `--fg-main-color` instead.

---

### 3. `--border-color` ⚠️ **CRITICAL - Used Extensively**
**Usage Count:** 15+ times  
**Files:**
- `SearchableChooser.css` (lines 214, 237, 249, 336, 379)
- `MultiSelectChooser.css` (lines 53, 136, 146, 181)
- `ExpandableTextarea.css` (line 36)
- `MarkdownPreview.css` (lines 24, 95)
- `TemplateJSBlock.css` (lines 19, 28, 68)
- `DropdownSelectChooser.css` (lines 30, 44)

**Where Set:** Not set anywhere - only used with fallback `#ddd` or `#f0f0f0`  
**Current Usage:** Border colors for inputs, dropdowns, and containers  
**Recommendation:** **REPLACE WITH `--divider-color`** - This appears to be a duplicate of `--divider-color`. All instances should use `--divider-color` instead.

---

### 4. `--gray-500` ⚠️ **Used Frequently**
**Usage Count:** 8+ times  
**Files:**
- `SearchableChooser.css` (lines 324, 360, 405, 425)
- `SearchableChooser.jsx` (lines 595, 655, 671)
- `EventChooser.jsx` (line 527)

**Where Set:** Not set anywhere - only used with fallback `#666`  
**Current Usage:** Muted/secondary text color for descriptions, hints, and option metadata  
**Recommendation:** **REPLACE WITH `--fg-alt-color`** (once added to standard list) or use `--fg-main-color` with opacity. The gray-500 pattern suggests a muted text color.

---

### 5. `--gray-600` ⚠️ **Used Frequently**
**Usage Count:** 5+ times  
**Files:**
- `SearchableChooser.css` (lines 163, 473)
- `SearchableChooser.jsx` (lines 470, 486)
- `MultiSelectChooser.css` (line 112)

**Where Set:** Not set anywhere - only used with fallback `#666`  
**Current Usage:** Slightly darker muted text for hints and secondary information  
**Recommendation:** **REPLACE WITH `--fg-alt-color`** (once added to standard list) or use `--fg-main-color` with opacity.

---

### 6. `--hover-bg` ⚠️ **Used Frequently**
**Usage Count:** 8+ times  
**Files:**
- `SearchableChooser.css` (line 436)
- `SearchableChooser.jsx` (lines 559, 617)
- `MultiSelectChooser.css` (line 188)
- `EventChooser.jsx` (line 517)

**Where Set:** Not set anywhere - only used with fallback `#f5f5f5`  
**Current Usage:** Background color for hovered dropdown options and list items  
**Recommendation:** **REPLACE WITH `--bg-alt-color`** - This is already a standard color and serves the same purpose.

---

### 7. `--icon-color` ⚠️ **Used Frequently**
**Usage Count:** 4+ times  
**Files:**
- `SearchableChooser.css` (lines 174, 192)
- `DropdownSelectChooser.css` (line 87)

**Where Set:** Not set anywhere - only used with fallback `#666`  
**Current Usage:** Color for icons in choosers  
**Recommendation:** **REPLACE WITH `--item-icon-color`** - This is already a standard color and serves the same purpose.

---

### 8. `--dropdown-bg` ⚠️ **Used Frequently**
**Usage Count:** 5+ times  
**Files:**
- `SearchableChooser.css` (lines 213, 236)
- `DropdownSelectChooser.css` (lines 29, 47)

**Where Set:** Not set anywhere - only used with fallback `#fff`  
**Current Usage:** Background color for dropdown menus  
**Recommendation:** **REPLACE WITH `--bg-main-color`** - This is already a standard color and serves the same purpose.

---

### 9. `--primary-color` ⚠️ **Used Occasionally**
**Usage Count:** 1 time  
**Files:**
- `SearchableChooser.css` (line 127)

**Where Set:** Not set anywhere - only used with fallback `#0066cc`  
**Current Usage:** Focus border color for inputs  
**Recommendation:** **REPLACE WITH `--tint-color`** - This is already a standard color and serves the same purpose. The fallback `#0066cc` is different from `--tint-color`'s `#dc8a78`, but `--tint-color` is the correct semantic choice.

---

### 10. `--disabled-bg` / `--bg-disabled` ⚠️ **Used Occasionally**
**Usage Count:** 3 times  
**Files:**
- `SearchableChooser.css` (line 133) - `--disabled-bg`
- `MultiSelectChooser.css` (line 75) - `--bg-disabled`
- `ExpandableTextarea.css` (line 72) - `--bg-alt-color` (already correct)

**Where Set:** Not set anywhere - only used with fallback `#f5f5f5`  
**Current Usage:** Background color for disabled inputs  
**Recommendation:** **REPLACE WITH `--bg-alt-color`** - This is already a standard color and serves the same purpose.

---

### 11. `--disabled-text` / `--text-disabled` / `--text-disabled-color` ⚠️ **Used Occasionally**
**Usage Count:** 4 times  
**Files:**
- `SearchableChooser.css` (line 134) - `--disabled-text`
- `MultiSelectChooser.css` (line 76) - `--text-disabled`
- `ExpandableTextarea.css` (line 73) - `--text-disabled-color`
- `TemplateJSBlock.css` (line 61) - `--fg-secondary-color`

**Where Set:** Not set anywhere - only used with fallback `#999`  
**Current Usage:** Text color for disabled inputs  
**Recommendation:** **REPLACE WITH `--fg-main-color` with opacity** or create `--fg-disabled-color` if needed. Alternatively, use `--fg-alt-color` (once added to standard list) with reduced opacity.

---

### 12. `--text-muted` ⚠️ **Used Occasionally**
**Usage Count:** 3 times  
**Files:**
- `SearchableChooser.css` (lines 505, 513)
- `MultiSelectChooser.css` (line 223)

**Where Set:** Not set anywhere - only used with fallback `#999`  
**Current Usage:** Muted text for empty states and secondary information  
**Recommendation:** **REPLACE WITH `--fg-alt-color`** (once added to standard list) or use `--fg-main-color` with opacity.

---

### 13. `--bg-color` ⚠️ **Used Occasionally**
**Usage Count:** 4 times  
**Files:**
- `MultiSelectChooser.css` (lines 57, 138)
- `MarkdownPreview.css` (line 27)
- `OrderingPanel.css` (line 150)

**Where Set:** Not set anywhere - only used with fallback `#fff`  
**Current Usage:** Generic background color for containers  
**Recommendation:** **REPLACE WITH `--bg-main-color`** - This is already a standard color and serves the same purpose.

---

### 14. `--tint-color-hover` ⚠️ **Used Occasionally**
**Usage Count:** 2 times  
**Files:**
- `MultiSelectChooser.css` (lines 126, 161)

**Where Set:** Not set anywhere - only used with fallback `#0052a3`  
**Current Usage:** Hover color for tint-colored links/buttons  
**Recommendation:** **USE `--tint-color` with CSS filter or opacity** - No need for a separate variable. Can use `filter: brightness(90%)` or similar on hover.

---

### 15. `--selected-bg` ⚠️ **Used Occasionally**
**Usage Count:** 1 time  
**Files:**
- `MultiSelectChooser.css` (line 192)

**Where Set:** Not set anywhere - only used with fallback `#e6f2ff`  
**Current Usage:** Background color for selected items in multi-select  
**Recommendation:** **USE `--bg-alt-color` or `--tint-color` with opacity** - Can use existing standard colors with transparency.

---

### 16. `--text-placeholder-color` ⚠️ **Used Rarely**
**Usage Count:** 1 time  
**Files:**
- `ExpandableTextarea.css` (line 78)

**Where Set:** Not set anywhere - only used with fallback `#999`  
**Current Usage:** Placeholder text color  
**Recommendation:** **REPLACE WITH `--fg-alt-color`** (once added to standard list) or use `--fg-main-color` with opacity.

---

### 17. `--text-secondary-color` ⚠️ **Used Occasionally**
**Usage Count:** 3 times  
**Files:**
- `MarkdownPreview.css` (lines 84, 116)
- `TemplateJSBlock.css` (line 36)

**Where Set:** Not set anywhere - only used with fallback `#666`  
**Current Usage:** Secondary text color for markdown preview and template blocks  
**Recommendation:** **REPLACE WITH `--fg-alt-color`** (once added to standard list) or use `--fg-main-color` with opacity.

---

### 18. `--error-color` ⚠️ **Used Rarely**
**Usage Count:** 1 time  
**Files:**
- `MarkdownPreview.css` (line 121)

**Where Set:** Not set anywhere - only used with fallback `#d32f2f`  
**Current Usage:** Error text color  
**Recommendation:** **CONSIDER ADDING TO STANDARD LIST** - Error states are important for UX. Could also use `--tint-color` if errors should match the theme accent, or keep as-is if error color should be distinct.

---

### 19. `--fg-secondary-color` ⚠️ **Used Occasionally**
**Usage Count:** 2 times  
**Files:**
- `TemplateJSBlock.css` (lines 36, 61, 73)

**Where Set:** Not set anywhere - only used with fallback `#666` or `#999`  
**Current Usage:** Secondary foreground color for template blocks  
**Recommendation:** **REPLACE WITH `--fg-alt-color`** (once added to standard list) or use `--fg-main-color` with opacity.

---

### 20. `--{calendarColor}-500` ⚠️ **Dynamic Variable**
**Usage Count:** 1 time  
**Files:**
- `EventChooser.jsx` (line 527)

**Where Set:** Not set anywhere - dynamically constructed from calendar color  
**Current Usage:** Calendar-specific icon colors  
**Recommendation:** **KEEP AS-IS** - This is a dynamic variable pattern for calendar colors. The fallback `--gray-500` should be replaced with `--fg-alt-color` (once added) or `--item-icon-color`.

---

## Non-Color Variables (Not Colors, but CSS Variables)

### 21. `--noteplan-toolbar-height` ✅ **Keep As-Is**
**Usage Count:** 2 times  
**Files:**
- `DynamicDialog.css` (lines 10, 19)

**Recommendation:** **KEEP** - This is a layout variable, not a color. It's correctly used for positioning calculations.

---

### 22. `--compact-label-width` ✅ **Keep As-Is**
**Usage Count:** 1 time  
**Files:**
- `DynamicDialog.css` (line 258)

**Recommendation:** **KEEP** - This is a layout variable, not a color. Used for consistent label widths.

---

### 23. `--dynamic-dialog-input-width` ✅ **Keep As-Is**
**Usage Count:** 20+ times  
**Files:**
- Multiple CSS files throughout DynamicDialog

**Recommendation:** **KEEP** - This is a layout variable, not a color. Used extensively for consistent input field widths.

---

## Summary of Recommendations

### High Priority (Add to Standard List)
1. **`--fg-alt-color`** - Used 15+ times, critical for labels and secondary text

### High Priority (Replace with Existing Standards)
1. **`--text-color`** → Replace with `--fg-main-color` (20+ uses)
2. **`--border-color`** → Replace with `--divider-color` (15+ uses)
3. **`--hover-bg`** → Replace with `--bg-alt-color` (8+ uses)
4. **`--icon-color`** → Replace with `--item-icon-color` (4+ uses)
5. **`--dropdown-bg`** → Replace with `--bg-main-color` (5+ uses)
6. **`--bg-color`** → Replace with `--bg-main-color` (4+ uses)

### Medium Priority (Replace with Standards)
1. **`--gray-500`** → Replace with `--fg-alt-color` (once added) or `--fg-main-color` with opacity (8+ uses)
2. **`--gray-600`** → Replace with `--fg-alt-color` (once added) or `--fg-main-color` with opacity (5+ uses)
3. **`--text-muted`** → Replace with `--fg-alt-color` (once added) (3+ uses)
4. **`--text-secondary-color`** → Replace with `--fg-alt-color` (once added) (3+ uses)
5. **`--fg-secondary-color`** → Replace with `--fg-alt-color` (once added) (2+ uses)

### Low Priority (Consider Adding or Replacing)
1. **`--error-color`** → Consider adding to standard list, or use `--tint-color` (1 use)
2. **`--primary-color`** → Replace with `--tint-color` (1 use, but note fallback difference)
3. **`--disabled-text` variants** → Standardize on one name, use `--fg-alt-color` with opacity
4. **`--tint-color-hover`** → Remove, use CSS filters/opacity instead (2 uses)
5. **`--selected-bg`** → Use `--bg-alt-color` or `--tint-color` with opacity (1 use)
6. **`--text-placeholder-color`** → Replace with `--fg-alt-color` (once added) (1 use)

### Keep As-Is
- `--{calendarColor}-500` (dynamic variable pattern)
- All non-color layout variables (`--noteplan-toolbar-height`, `--compact-label-width`, `--dynamic-dialog-input-width`)

---

## Summary Table

| Variable Name | Usage Count | Files | Where Set | Recommendation |
|--------------|-------------|-------|-----------|----------------|
| `--fg-alt-color` | 15+ | `DynamicDialog.css`, `CalendarPicker.css`, `DropdownSelect.css` | Not set (fallback only) | **ADD TO STANDARD LIST** - Critical missing color for labels and secondary text |
| `--text-color` | 20+ | `SearchableChooser.css`, `MultiSelectChooser.css`, `ExpandableTextarea.css`, `MarkdownPreview.css`, `TemplateJSBlock.css` | Not set (fallback: `#333`) | **REPLACE WITH `--fg-main-color`** - Duplicate of existing standard |
| `--border-color` | 15+ | `SearchableChooser.css`, `MultiSelectChooser.css`, `ExpandableTextarea.css`, `MarkdownPreview.css`, `TemplateJSBlock.css`, `DropdownSelectChooser.css` | Not set (fallback: `#ddd` or `#f0f0f0`) | **REPLACE WITH `--divider-color`** - Duplicate of existing standard |
| `--gray-500` | 8+ | `SearchableChooser.css`, `SearchableChooser.jsx`, `EventChooser.jsx` | Not set (fallback: `#666`) | **CREATE `--fg-muted-color`** - Standardize muted text color (used for descriptions, hints, metadata) |
| `--gray-600` | 5+ | `SearchableChooser.css`, `SearchableChooser.jsx`, `MultiSelectChooser.css` | Not set (fallback: `#666`) | **CREATE `--fg-muted-color`** - Standardize muted text color (slightly darker variant) |
| `--hover-bg` | 8+ | `SearchableChooser.css`, `SearchableChooser.jsx`, `MultiSelectChooser.css`, `EventChooser.jsx` | Not set (fallback: `#f5f5f5`) | **REPLACE WITH `--bg-alt-color`** - Already a standard color |
| `--icon-color` | 4+ | `SearchableChooser.css`, `DropdownSelectChooser.css` | Not set (fallback: `#666`) | **REPLACE WITH `--item-icon-color`** - Already a standard color |
| `--dropdown-bg` | 5+ | `SearchableChooser.css`, `DropdownSelectChooser.css` | Not set (fallback: `#fff`) | **REPLACE WITH `--bg-main-color`** - Already a standard color |
| `--primary-color` | 1 | `SearchableChooser.css` | Not set (fallback: `#0066cc`) | **REPLACE WITH `--tint-color`** - Already a standard color |
| `--disabled-bg` / `--bg-disabled` | 3 | `SearchableChooser.css`, `MultiSelectChooser.css` | Not set (fallback: `#f5f5f5`) | **REPLACE WITH `--bg-alt-color`** - Already a standard color |
| `--disabled-text` / `--text-disabled` / `--text-disabled-color` | 4 | `SearchableChooser.css`, `MultiSelectChooser.css`, `ExpandableTextarea.css`, `TemplateJSBlock.css` | Not set (fallback: `#999`) | **CREATE `--fg-disabled-color`** - Standardize disabled text color |
| `--text-muted` | 3 | `SearchableChooser.css`, `MultiSelectChooser.css` | Not set (fallback: `#999`) | **REPLACE WITH `--fg-muted-color`** (once created) or `--fg-alt-color` |
| `--bg-color` | 4 | `MultiSelectChooser.css`, `MarkdownPreview.css`, `OrderingPanel.css` | Not set (fallback: `#fff`) | **REPLACE WITH `--bg-main-color`** - Already a standard color |
| `--tint-color-hover` | 2 | `MultiSelectChooser.css` | Not set (fallback: `#0052a3`) | **REMOVE** - Use `--tint-color` with CSS `filter: brightness(90%)` on hover |
| `--selected-bg` | 1 | `MultiSelectChooser.css` | Not set (fallback: `#e6f2ff`) | **CREATE `--bg-selected-color`** - Standardize selected item background (or use `--tint-color` with opacity) |
| `--text-placeholder-color` | 1 | `ExpandableTextarea.css` | Not set (fallback: `#999`) | **REPLACE WITH `--fg-muted-color`** (once created) or `--fg-alt-color` |
| `--text-secondary-color` | 3 | `MarkdownPreview.css`, `TemplateJSBlock.css` | Not set (fallback: `#666`) | **REPLACE WITH `--fg-muted-color`** (once created) or `--fg-alt-color` |
| `--error-color` | 1 | `MarkdownPreview.css` | Not set (fallback: `#d32f2f`) | **CONSIDER ADDING TO STANDARD LIST** - Error states are important for UX |
| `--fg-secondary-color` | 2 | `TemplateJSBlock.css` | Not set (fallback: `#666` or `#999`) | **REPLACE WITH `--fg-muted-color`** (once created) or `--fg-alt-color` |
| `--{calendarColor}-500` | 1 | `EventChooser.jsx` | Not set (dynamic, fallback: `--gray-500`) | **KEEP AS-IS** - Dynamic variable pattern. Replace fallback with `--fg-muted-color` (once created) |
| `--noteplan-toolbar-height` | 2 | `DynamicDialog.css` | Not set (layout variable) | **KEEP AS-IS** - Layout variable, not a color |
| `--compact-label-width` | 1 | `DynamicDialog.css` | Set in `DynamicDialog.css:258` | **KEEP AS-IS** - Layout variable, not a color |
| `--dynamic-dialog-input-width` | 20+ | Multiple CSS files | Set in `DynamicDialog.css:260` | **KEEP AS-IS** - Layout variable, not a color |

### Recommended New Standard Colors to Add

Based on the analysis, consider adding these to your standard color list:

1. **`--fg-alt-color`** - For labels, descriptions, and secondary text (currently used 15+ times)
2. **`--fg-muted-color`** - For muted/secondary text (replaces `--gray-500`, `--gray-600`, `--text-muted`, `--text-secondary-color`, `--fg-secondary-color`, `--text-placeholder-color`)
3. **`--fg-disabled-color`** - For disabled text (replaces `--disabled-text`, `--text-disabled`, `--text-disabled-color`)
4. **`--bg-selected-color`** - For selected item backgrounds (replaces `--selected-bg`)
5. **`--error-color`** - For error states (currently used 1 time, but important for UX)

These would standardize the opacity-based colors you mentioned wanting to create as actual color variables.

