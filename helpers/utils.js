// shared functions that can be imported and used in helpers without creating circular dependencies
// @flow
import { RE_IS_SCHEDULED } from './dateTime'
import { RE_ARROW_DATES_G } from './regex'

/**
 * Test whether a para is open or not (type: 'open' or 'checklist')
 * @param {Paragraph} t - the paragraph/task to check
 * @returns {boolean} true if open, false if any other status/type
 */
export const isOpen = (t: TParagraph): boolean => t.type === 'open' || t.type === 'checklist'

/**
 * Test whether a para is open or not (type: 'open' or 'checklist') and doesn't have a scheduled date
 * @param {Paragraph} t - the paragraph/task to check
 * @returns {boolean} true if open, false if any other status/type
 */
export function isOpenNotScheduled(t: TParagraph): boolean {
  return (t.type === 'open' || t.type === 'checklist') && !hasScheduledDate(t.content)
}

/**
 * Test whether a para is open or not (type: 'open') and doesn't have a scheduled date
 * @param {Paragraph} t - the paragraph/task to check
 * @returns {boolean} true if open, false if any other status/type
 */
export function isOpenTaskNotScheduled(t: TParagraph): boolean {
  return (t.type === 'open') && !hasScheduledDate(t.content)
}

/**
 * Test whether a task is closed or not (types: 'done', 'cancelled', 'checklistDone', 'checklistCancelled').
 * Note: not the same as isDone(), which is tighter
 * @param {Paragraph} t - the paragraph/task to check
 * @returns {boolean} true if open, false if any other status/type
 */
export const isClosed = (t: TParagraph): boolean => t.type === 'done' || t.type === 'cancelled' || t.type === 'checklistDone' || t.type === 'checklistCancelled'

/**
 * Test whether a task is closed or not (types: 'done', 'cancelled', 'checklistDone', 'checklistCancelled').
 * Note: tighter check than isClosed()
 * @param {Paragraph} t - the paragraph/task to check
 * @returns {boolean} true if open, false if any other status/type
 */
export const isDone = (t: TParagraph): boolean => t.type === 'done' || t.type === 'checklistDone'

/**
 * Test whether a string has a scheduled date (e.g. >2020-01-01, >2020-01, >2020, >2020-W1, >2020-Q1), and not an arrow date (>date<).
 * @param {string} content
 * @returns {boolean} true if has a scheduled date, false if not
 */
export const hasScheduledDate = (content: string): boolean => RE_IS_SCHEDULED.test(content) && !RE_ARROW_DATES_G.test(content)

/**
 * Test whether a paragraph/task is scheduled (type: 'scheduled' or open with a scheduled date), and not an arrow date (>date<).
 * @param {TParagraph} t
 * @returns {boolean} - true if scheduled, false if not
 */
export const isScheduled = (t: TParagraph): boolean => t.type === 'scheduled' || (t.type === 'open' && hasScheduledDate(t.content) && !RE_ARROW_DATES_G.test(t.content))

/**
 * This function removes duplicate objects from an array based on specified keys to compare
 * Useful e.g. for removing duplicate paragraphs/tasks from an array of tasks
 * If the properties compared are the same, the object is considered a duplicate and only the first one is kept
 * The order of the array is preserved *
 * tags: dedupe, unique
 *
 * @param {Array<{[string]: any}>} arr - The array of objects (e.g. Paragraphs) from which to remove duplicates.
 * @param {Array<string>} keys - The keys/property names to check for duplicates.
 * @return {Array<{[string]: any}>} An array of objects without duplicates based on the specified keys.
 */
export function removeDuplicates(arr: Array<{ [string]: any }>, keys: Array<string>): Array<{ [string]: any }> {
  const seen = new Map()

  return arr.filter((item) => {
    const keyValue = keys.map((key) => item[key]).join('|')

    if (seen.has(keyValue)) {
      return false
    } else {
      seen.set(keyValue, true)
      return true
    }
  })
}
