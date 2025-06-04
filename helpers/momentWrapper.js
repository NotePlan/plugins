// @flow
/**
 * Moment.js wrapper that intercepts .format() calls to handle NotePlan's custom week numbering.
 * Uses moment-with-locales under the hood.
 *
 * NotePlan allows weeks to start on any day of the week (user preference), while moment.js
 * uses ISO weeks (Monday start). This wrapper replaces week formatting tokens with
 * Calendar.weekNumber() to ensure compatibility with NotePlan's week calculations.
 *
 * Usage Instructions:
 * ==================
 *
 * In DateModule.js or other files that need NotePlan-compatible week numbering:
 *
 * REPLACE THIS:
 *   import moment from 'moment/min/moment-with-locales'
 *
 * WITH THIS:
 *   import { momentWrapper as moment } from '@helpers/momentWrapper'
 *
 * The wrapper intercepts these format tokens:
 * - 'w' -> Simple week number (e.g., 1, 2, 52)
 * - 'ww' -> Zero-padded week number (e.g., 01, 02, 52)
 *
 * These tokens remain unchanged (use moment's ISO weeks):
 * - 'W' -> ISO week number (Monday start)
 * - 'WW' -> Zero-padded ISO week number (Monday start)
 * - 'wo' -> Ordinal week number ("1st", "2nd", etc.)
 * - 'www' -> Weekday abbreviation ("Mon", "Tue", etc.)
 * - 'wwww' -> Full weekday name ("Monday", "Tuesday", etc.)
 *
 * All other format tokens are passed through to the original moment.format().
 * All other moment methods (add, subtract, startOf, etc.) work exactly as before.
 *
 * Examples:
 * ========
 *
 * // Week number formatting - uses Calendar.weekNumber() instead of moment's ISO weeks
 * moment('2023-01-01').format('w')      // Returns NotePlan week number
 * moment('2023-01-01').format('ww')     // Returns zero-padded NotePlan week number
 * moment('2023-01-01').format('YYYY-[W]ww') // Returns "2023-W01" with NotePlan weeks
 *
 * // ISO week formatting - uses moment's standard behavior
 * moment('2023-01-01').format('W')      // Returns ISO week number (Monday start)
 * moment('2023-01-01').format('WW')     // Returns zero-padded ISO week number
 *
 * // Other week-related tokens - uses moment's standard behavior
 * moment('2023-01-01').format('wo')     // Returns "1st" (ordinal week)
 * moment('2023-01-01').format('www')    // Returns "Sun" (weekday abbreviation)
 *
 * // All other formatting works normally
 * moment('2023-01-01').format('YYYY-MM-DD') // Returns "2023-01-01"
 * moment().add(1, 'day').format('YYYY-MM-DD') // Works as expected
 *
 * @author @dwertheimer
 */

import momentLib from 'moment/min/moment-with-locales'

/**
 * Wrap Moment so that:
 *   •  w   → Calendar.weekNumber()            (no-pad)
 *   •  ww  → Calendar.weekNumber().padStart(2)
 *   •  www → Moment weekday abbreviation (maps to `ddd`)
 *   •  wwww→ Moment full weekday name   (maps to `dddd`)
 * All other behaviour is untouched.
 */
function momentWrapper(input?: mixed, format?: string | Array<string>): any /* moment instance */ {
  // Suppress deprecation warnings globally for tests
  if (typeof jest !== 'undefined') {
    momentLib.suppressDeprecationWarnings = true
  }

  const m = momentLib(input, format)

  const originalFormat = m.format.bind(m)

  m.format = function wrappedFormat(fmt?: string): string {
    if (fmt == null) return originalFormat() // vanilla default
    if (fmt === '') return '' // vanilla behaviour
    if (!fmt.includes('w')) return originalFormat(fmt) // fast path

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

    if (!replacedWeek) return originalFormat(out) // nothing to patch

    /* ------------------------------------------------------- */
    /*  Compute NotePlan week and patch placeholders           */
    /* ------------------------------------------------------- */
    // $FlowFixMe[prop-missing] Calendar will exist inside NotePlan
    const wk = Calendar.weekNumber(this.toDate())
    const wk2 = String(wk).padStart(2, '0')

    const finalFmt = out.replace(/\[\[NP_W_SINGLE]]/g, `[${wk}]`).replace(/\[\[NP_W_DOUBLE]]/g, `[${wk2}]`)

    return originalFormat(finalFmt)
  }

  return m
}

/* ------------------------------------------------------------- */
/*  Copy every static helper from the original moment factory    */
/* ------------------------------------------------------------- */

// $FlowFixMe[prop-missing]
Object.getOwnPropertyNames(momentLib).forEach((key) => {
  if (key === 'length' || key === 'name' || key === 'prototype') return
  // $FlowFixMe[prop-missing]
  const desc = Object.getOwnPropertyDescriptor(momentLib, key)
  if (desc) Object.defineProperty(momentWrapper, key, desc)
})
// Keep prototype chain so instanceof checks remain true
// $FlowFixMe[incompatible-call]
Object.setPrototypeOf(momentWrapper, momentLib)

export { momentWrapper }
export default momentWrapper
