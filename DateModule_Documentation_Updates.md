# Documentation Update Instructions for DateModule Week Handling Changes

## Overview
The DateModule has been enhanced to support NotePlan's user-configurable week numbering system instead of relying solely on moment.js ISO weeks. This ensures consistency between templating output and NotePlan's native week calculations.

## Required Documentation Updates

### 1. Main DateModule Documentation

#### Add New Section: "Week Numbering Behavior"

## Week Numbering Behavior

The DateModule now uses NotePlan's native week calculation system to ensure consistency with your configured week start preferences. This differs from the standard ISO week numbering used by moment.js.

### Week Token Types

| Token | Description | Calculation Method | Example |
|-------|-------------|-------------------|---------|
| `w` | NotePlan week number | Uses `NotePlan's Calendar.weekNumber()` | `25` |
| `ww` | Zero-padded NotePlan week | Uses NotePlan's `Calendar.weekNumber()` | `25` → `25`, `5` → `05` |
| `W` | ISO week number (Monday start) | Uses moment.js standard | `24` |
| `WW` | Zero-padded ISO week | Uses moment.js standard | `24` → `24`, `4` → `04` |
| `www` | Weekday abbreviation | Standard moment.js | `Thu` |
| `wwww` | Full weekday name | Standard moment.js | `Thursday` |
| `wo` | Ordinal week number | Uses moment.js ISO weeks | `24th` |

### Key Differences

**NotePlan Weeks (`w`/`ww`):**
- Respects your NotePlan week start day configuration
- Week 1 starts on your configured first day of the week
- Consistent with NotePlan's built-in week numbering

**ISO Weeks (`W`/`WW`):**
- Always start on Monday (ISO 8601 standard)
- Week 1 contains January 4th
- May differ from NotePlan's week numbering

**Pure Moment.js Formatting:**
- Use `date.moment.format()` to bypass NotePlan week intervention entirely
- All tokens use standard moment.js behavior including localized formatting
- Useful for maintaining exact moment.js compatibility

### Examples

    // Assuming NotePlan is configured with Sunday as week start
    date.format('YYYY-[W]ww', '2023-01-01')  // "2023-W01" (NotePlan week)
    date.format('YYYY-[W]WW', '2023-01-01')  // "2023-W52" (ISO week - belongs to previous year)

    // Mixed format showing both systems
    date.format('YYYY-MM-DD ([NP]w/[ISO]W)', '2023-01-01')  // "2023-01-01 (NP1/ISO52)"

    // Pure moment.js formatting (no NotePlan intervention)
    date.moment.format('YYYY-[W]ww', '2023-01-01')  // "2023-W52" (pure moment.js ISO weeks)

---

### 2. Update Existing Method Documentation

#### For `.format()` method:

### format(formatString, dateInput)

**Enhanced Week Numbering Support:**
The format method now supports NotePlan-compatible week numbering:

- Use lowercase `w`/`ww` for NotePlan week numbers
- Use uppercase `W`/`WW` for ISO week numbers  
- Other week-related tokens (`www`, `wwww`, `wo`) work as before
- Use `date.moment.format()` for pure moment.js formatting without NotePlan intervention

**Examples:**

    // NotePlan week formatting
    date.format('YYYY-[W]ww')              // "2023-W25"
    date.format('[Week] w [of] YYYY')      // "Week 25 of 2023"

    // Mixed week types
    date.format('w-W')                     // "25-24" (NotePlan vs ISO)

    // Complex formats
    date.format('wwww, [W]w/WW')          // "Thursday, W25/24"

    // Pure moment.js formatting (bypasses NotePlan week calculation)
    date.moment.format('YYYY-[W]ww')      // "2023-W24" (uses moment.js ISO weeks only)

---

### 3. Method-Specific Updates

#### Update documentation for these methods:

**`.now()`, `.today()`, `.tomorrow()`, `.yesterday()`, `.add()`, `.subtract()`, `.startOfWeek()`, `.endOfWeek()`, `.businessAdd()`, `.businessSubtract()`:**

Add note to each:

**Week Numbering:** When using week-related format tokens, this method now supports NotePlan's native week calculation. Use lowercase `w`/`ww` for NotePlan weeks, uppercase `W`/`WW` for ISO weeks.

#### `.weekNumber()` method:

### weekNumber(pivotDate)

**Updated Behavior:** Now returns NotePlan's native week number instead of ISO week number, ensuring consistency with your configured week start day.

**Returns:** Number - The week number according to NotePlan's calculation

**Example:**

    date.weekNumber('2023-01-01')  // Returns NotePlan week (e.g., 1)
    // Compare with ISO week: moment('2023-01-01').week() // Returns 52

---

### 4. Migration Guide Section

## Migration Guide: Week Numbering Changes

### What Changed
- Week formatting now uses NotePlan's native week calculation by default
- Lowercase week tokens (`w`, `ww`) use NotePlan weeks
- Uppercase week tokens (`W`, `WW`) maintain ISO week behavior
- The `.weekNumber()` method now returns NotePlan weeks

### Action Required
Most templates will continue working without changes. However:

**If you relied on ISO week numbering:**
- Change `w` to `W` and `ww` to `WW` in your format strings
- Update any hardcoded week number expectations
- Or use `date.moment.format()` for exact moment.js compatibility

**If you want NotePlan-consistent weeks:**
- No changes needed - you'll automatically get better consistency

**If you need pure moment.js behavior:**
- Use `date.moment.format()` instead of `date.format()`
- All moment.js tokens work exactly as before, including localized formatting

### Examples of Changes Needed

**Before (ISO weeks only):**

    date.format('YYYY-[W]ww')  // Used ISO weeks

**After (choose your preference):**

    date.format('YYYY-[W]ww')         // Now uses NotePlan weeks
    date.format('YYYY-[W]WW')         // For ISO weeks (same as old behavior)
    date.moment.format('YYYY-[W]ww')  // For exact moment.js behavior (ISO weeks)

---

### 5. Week Formatting Examples Section

## Week Formatting Examples

### Basic Week Formats

    const date = new DateModule()

    // NotePlan weeks (respects your week start configuration)
    date.format('w', '2023-06-15')           // "25"
    date.format('ww', '2023-06-15')          // "25" 
    date.format('YYYY-[W]ww', '2023-06-15')  // "2023-W25"

    // ISO weeks (always Monday start)
    date.format('W', '2023-06-15')           // "24"
    date.format('WW', '2023-06-15')          // "24"
    date.format('YYYY-[W]WW', '2023-06-15')  // "2023-W24"

### Complex Mixed Formats

    // Show both week numbering systems
    date.format('YYYY-MM-DD ([NP] w / [ISO] W)', '2023-06-15')  
    // "2023-06-15 (NP 25 / ISO 24)"

    // Weekly report format
    date.format('wwww, [Week] w [of] YYYY ([ISO Week] W)', '2023-06-15')
    // "Thursday, Week 25 of 2023 (ISO Week 24)"

    // Time with week information
    date.format('YYYY-[W]ww HH:mm:ss', '2023-06-15T14:30:45')
    // "2023-W25 14:30:45"

### Year Boundary Examples

    // New Year's Day - shows significant difference
    date.format('YYYY-MM-DD: [NP]w [ISO]W', '2023-01-01')
    // "2023-01-01: NP1 ISO52"

    // End of year
    date.format('[Week] w [of] YYYY ([ISO] W)', '2023-12-31')
    // "Week 53 of 2023 (ISO 52)"

### Integration with Other Methods

    // Using with .now() and offsets
    date.now('YYYY-[W]ww', '+1w')            // Next week in NotePlan format
    date.now('YYYY-[W]WW', '+1w')            // Next week in ISO format

    // Business day calculations
    date.businessAdd(5, '2023-06-15', '[W]ww/YYYY')  // "W25/2023"

    // Week range formatting
    date.weekOf('2023-06-15')                // Uses NotePlan week numbering

    // Pure moment.js formatting for any date
    date.moment.format('YYYY-[W]ww')         // Always uses moment.js ISO weeks
    date.moment.format('dddd, MMMM Do YYYY, h:mm:ss a')  // Full moment.js localization

---

### 6. Technical Implementation Notes

## Technical Implementation Notes

### Fallback Behavior
When `Calendar.weekNumber()` is not available (e.g., in test environments), the system falls back to:
- ISO week number for Monday-Saturday dates
- ISO week number + 1 for Sunday dates (approximating Sunday-start weeks)

### Performance Considerations
- Multiple week tokens in the same format string only call `Calendar.weekNumber()` once
- Fast-path optimization for formats without week tokens
- Efficient placeholder replacement system

### Compatibility
- Fully backward compatible with existing moment.js format tokens
- All non-week tokens work exactly as before
- ISO week tokens (`W`, `WW`, `wo`) maintain original behavior
- `date.moment.format()` provides direct access to unmodified moment.js formatting

---

### 7. Quick Reference Guide

## Quick Reference: Week Token Migration

| Old Usage | New NotePlan | New ISO | Notes |
|-----------|-------------|---------|-------|
| `w` | `w` | `W` | NotePlan week vs ISO week |
| `ww` | `ww` | `WW` | Zero-padded versions |
| `YYYY-Www` | `YYYY-[W]ww` | `YYYY-[W]WW` | Weekly format |
| `wo` | `wo` | `wo` | Ordinal - no change needed |
| `www` | `www` | `www` | Weekday abbrev - no change |
| `wwww` | `wwww` | `wwww` | Full weekday - no change |
| Any format | `date.format()` | `date.moment.format()` | Pure moment.js behavior |

### Common Format Patterns

| Pattern | Description | Example Output |
|---------|-------------|----------------|
| `YYYY-[W]ww` | Year with NotePlan week | "2023-W25" |
| `YYYY-[W]WW` | Year with ISO week | "2023-W24" |
| `wwww [W]w` | Weekday with NotePlan week | "Thursday W25" |
| `w/W` | Compare both systems | "25/24" |
| `[Q]Q [W]ww` | Quarter and NotePlan week | "Q2 W25" |
| `date.moment.format()` | Pure moment.js formatting | Exact moment.js behavior |

This documentation should be added to the main DateModule documentation, with particular emphasis on the migration guide for existing users. 