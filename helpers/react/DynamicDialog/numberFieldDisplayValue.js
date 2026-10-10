// @flow
//-----------------------------------------------------------------------------
// Display string for a number input. 0 is a real value and must stay visible.
// Last updated 2026-10-10 by @CursorAI
//-----------------------------------------------------------------------------

/**
 * String for a number field. Keeps 0 (overdue look-back of 0 means every overdue task).
 * @param {mixed} value
 * @returns {string}
 */
export function numberFieldDisplayValue(value: mixed): string {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}
