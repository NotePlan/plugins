// @flow

/* eslint-disable max-len */
import { hyphenatedDateString } from './dateHelpers'
import { clo, logDebug } from '@helpers/dev'

// returns a date object if it exists, and null if there is no forward date
const hasTypedDate = (t) => (/>\d{4}-\d{2}-\d{2}/g.test(t.content) ? t.date : null)

// Note: nmn.sweep limits how far back you look with: && hyphenatedDateString(p.date) >= afterHyphenatedDate,
// For now, we are assuming that sweep was already done, and we're just looking at this one note
export const isOverdue = (t: TParagraph): boolean => {
  let theDate = null
  if (t.type === 'scheduled') theDate = t.date
  if (t.type === 'open') theDate = hasTypedDate(t)
  return theDate == null ? false : hyphenatedDateString(theDate) < hyphenatedDateString(new Date())
}

/*
 * @param paragraphs array
 * @return filtered list of overdue tasks
 */
export const getOverdueTasks = (paras: Array<TParagraph>): Array<TParagraph> => paras.filter((p) => isOverdue(p))
