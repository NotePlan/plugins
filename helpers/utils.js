// shared functions that can be imported and used in helpers without creating circular dependencies
// @flow

/**
 * Test whether a task is open or not (type: 'scheduled' or 'open' counts as open)
 * @param {Paragraph} t - the paragraph/task to check
 * @returns {boolean} true if open, false if any other status/type
 */
export const isOpen = (t: TParagraph): boolean => t.type === 'open' || t.type === 'scheduled'
