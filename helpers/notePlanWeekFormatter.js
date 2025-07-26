// @flow
/**
 * NotePlan-compatible week formatting utilities for moment.js
 *
 * This module provides utility functions for formatting dates with NotePlan's week numbering
 * instead of moment's ISO weeks. Use this when you need week formatting that matches
 * NotePlan's user-configurable week start day preferences.
 *
 * Usage Instructions:
 * ==================
 *
 * Primary Usage: Use directly with date strings (most convenient)
 *   import { formatWithNotePlanWeeks } from '@helpers/notePlanWeekFormatter'
 *
 *   const result = formatWithNotePlanWeeks('2023-01-01', 'YYYY-[W]ww')
 *   // Returns: "2023-W01" (using NotePlan's week calculation)
 *
 *   const weekNum = formatWithNotePlanWeeks('2023-01-01', 'w')
 *   // Returns: "1" (NotePlan week number)
 *
 *   const today = formatWithNotePlanWeeks(null, 'YYYY-[W]ww')
 *   // Returns: Current date with NotePlan week, e.g., "2024-W15"
 *
 * Alternative Usage: With moment instances (for compatibility)
 *   import moment from 'moment/min/moment-with-locales'
 *
 *   const result = formatWithNotePlanWeeks(moment('2023-01-01'), 'YYYY-[W]ww')
 *   // Returns: "2023-W01" (using NotePlan's week calculation)
 *
 * The utility handles these format tokens:
 * - 'w' -> Simple week number using Calendar.weekNumber()
 * - 'ww' -> Zero-padded week number using Calendar.weekNumber()
 * - 'www' -> Weekday abbreviation ("Mon", "Tue", etc.) - converted to 'ddd'
 * - 'wwww' -> Full weekday name ("Monday", "Tuesday", etc.) - converted to 'dddd'
 *
 * These tokens remain unchanged (use moment's ISO weeks):
 * - 'W' -> ISO week number (Monday start)
 * - 'WW' -> Zero-padded ISO week number (Monday start)
 * - 'wo' -> Ordinal week number ("1st", "2nd", etc.)
 *
 * @author @dwertheimer
 */

import momentLib from 'moment/min/moment-with-locales'

// Suppress deprecation warnings globally for better test output and cleaner logs
momentLib.suppressDeprecationWarnings = true

/**
 * Formats a date with NotePlan-compatible week numbering
 *
 * @param {string|Object|null|undefined} dateInput - Date input: moment instance, date string (YYYY-MM-DD), or null/empty for today
 * @param {string} fmt - Format string with moment tokens
 * @returns {string} Formatted date string with NotePlan week numbers
 */
export function formatWithNotePlanWeeks(dateInput?: mixed, format?: string): string {
  // Handle the format parameter
  const fmt = format != null ? String(format) : 'YYYY-MM-DD' // default format when no format provided
  if (fmt === '') return '' // vanilla behaviour
  if (!fmt.includes('w')) {
    // Fast path - no week tokens, just format normally
    let momentInstance
    if (dateInput && typeof dateInput === 'object' && dateInput.format) {
      // Already a moment instance
      momentInstance = dateInput
    } else if (dateInput && typeof dateInput === 'string' && dateInput.trim().length > 0) {
      // Date string provided
      momentInstance = momentLib(dateInput.trim())
    } else {
      // null, undefined, or empty/whitespace string - use today
      momentInstance = momentLib()
    }
    // $FlowFixMe[not-a-function] momentInstance is a moment object
    return momentInstance.format(fmt)
  }

  // Create moment instance from various input types
  let momentInstance
  if (dateInput && typeof dateInput === 'object' && dateInput.format) {
    // Already a moment instance - use as is
    momentInstance = dateInput
  } else if (dateInput && typeof dateInput === 'string' && dateInput.trim().length > 0) {
    // Date string provided
    momentInstance = momentLib(dateInput.trim())
  } else {
    // null, undefined, or empty string - use today
    momentInstance = momentLib()
  }

  /* ------------------------------------------------------- */
  /*  Scan pattern, respecting [literal] blocks              */
  /* ------------------------------------------------------- */
  let out = ''
  let inLiteral = false
  let replacedWeek = false

  for (let i = 0; i < fmt.length; ) {
    const ch = fmt[i]

    /* Handle literal brackets --------------------------------- */
    if (ch === '[') {
      inLiteral = true
      out += ch
      i += 1
      continue
    }
    if (ch === ']') {
      inLiteral = false
      out += ch
      i += 1
      continue
    }

    /* Handle runs of 'w' outside literals --------------------- */
    if (!inLiteral && ch === 'w') {
      /* count consecutive w's */
      let run = 1
      while (fmt[i + run] === 'w') run += 1
      const nextChar = fmt[i + run] ?? ''

      /* --- weekday tokens (www / wwww) ---------------------- */
      if (run === 3) {
        // www  → weekday abbrev
        out += 'ddd'
        i += 3
        continue
      }
      if (run === 4) {
        // wwww → weekday full
        out += 'dddd'
        i += 4
        continue
      }

      /* --- NotePlan week tokens (w / ww) -------------------- */
      if ((run === 1 || run === 2) && nextChar !== 'o') {
        out += run === 1 ? '[[NP_W_SINGLE]]' : '[[NP_W_DOUBLE]]'
        replacedWeek = true
        i += run
        continue
      }

      /* --- Any other run (wwo, wwwww, etc.) – pass through -- */
      out += fmt.slice(i, i + run)
      i += run
      continue
    }

    /* default: copy char ------------------------------------- */
    out += ch
    i += 1
  }

  if (!replacedWeek) {
    // $FlowFixMe[not-a-function] momentInstance is a moment object
    return momentInstance.format(out) // nothing to patch
  }

  /* ------------------------------------------------------- */
  /*  Compute NotePlan week and patch placeholders           */
  /* ------------------------------------------------------- */
  // $FlowFixMe[prop-missing] Calendar will exist inside NotePlan
  // For test environment, fall back to moment's ISO week calculation with Sunday adjustment
  let wk
  if (typeof Calendar !== 'undefined' && Calendar.weekNumber) {
    // $FlowFixMe[not-a-function] momentInstance is a moment object
    wk = Calendar.weekNumber(momentInstance.toDate())
  } else {
    // Fallback for test environment: use moment's ISO week with adjustment for Sunday start
    // $FlowFixMe[not-a-function] momentInstance is a moment object
    wk = parseInt(momentInstance.format('W'))
    // $FlowFixMe[not-a-function] momentInstance is a moment object
    if (momentInstance.day() === 0) {
      wk++
    }
  }

  const wk2 = String(wk).padStart(2, '0')

  const finalFmt = out.replace(/\[\[NP_W_SINGLE]]/g, `[${wk}]`).replace(/\[\[NP_W_DOUBLE]]/g, `[${wk2}]`)

  // $FlowFixMe[not-a-function] momentInstance is a moment object
  return momentInstance.format(finalFmt)
}

export default formatWithNotePlanWeeks
