// shared functions that can be imported and used in helpers without creating circular dependencies
// @flow
import { RE_IS_SCHEDULED } from './dateTime'

/**
 * Test whether a task is open or not (type: 'open' or 'checklist')
 * @param {Paragraph} t - the paragraph/task to check
 * @returns {boolean} true if open, false if any other status/type
 */
export const isOpen = (t: TParagraph): boolean => t.type === 'open' || t.type === 'checklist'

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
 * Test whether a string has a scheduled date (e.g. >2020-01-01, >2020-01, >2020, >2020-W1, >2020-Q1)
 * @param {string} content
 * @returns {boolean} true if has a scheduled date, false if not
 */
export const hasScheduledDate = (content: string): boolean => new RegExp(RE_IS_SCHEDULED).test(content)

/**
 * Test whether a paragraph/task is scheduled (type: 'scheduled' or open with a scheduled date)
 * @param {TParagraph} t
 * @returns {boolean} - true if scheduled, false if not
 */
export const isScheduled = (t: TParagraph): boolean => t.type === 'scheduled' || (t.type === 'open' && hasScheduledDate(t.content))
