// @flow
//-----------------------------------------------------------------------------
// Shared "add a Reminder" dialog fields for the REM section button and the topbar.
// Last updated 2026-11-01 by @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import type { TDialogSettingItem, TSectionCode } from './types'
import { getTodaysDateHyphenated } from '@helpers/dateTime'

/**
 * Narrow section refresh after creating a Reminder, from the date/time the user chose.
 * Avoids regenerating OVERDUE (full overdue-task scan) when the new item can only land in REM/DT/TB/DO.
 * Yesterday refreshes DY and OVERDUE (yesterday reminders spill to OVERDUE when Yesterday is hidden).
 * Dates after tomorrow are not shown anywhere -- returns [].
 * @param {string} dateISO - YYYY-MM-DD or '' for undated
 * @param {string} timeHHMM - HH:MM or '' for untimed
 * @returns {Array<TSectionCode>}
 */
export function sectionCodesForNewReminder(dateISO: string, timeHHMM: string = ''): Array<TSectionCode> {
  const trimmedDate = typeof dateISO === 'string' ? dateISO.trim() : ''
  const trimmedTime = typeof timeHHMM === 'string' ? timeHHMM.trim() : ''
  if (trimmedDate === '') {
    return ['REM']
  }
  const todayISO = getTodaysDateHyphenated()
  const yesterdayISO = moment().subtract(1, 'days').format('YYYY-MM-DD')
  const tomorrowISO = moment().add(1, 'days').format('YYYY-MM-DD')
  if (trimmedDate === todayISO) {
    return trimmedTime !== '' ? ['TB'] : ['DT']
  }
  if (trimmedDate === yesterdayISO) {
    return ['DY', 'OVERDUE']
  }
  if (trimmedDate === tomorrowISO) {
    return ['DO']
  }
  if (trimmedDate > tomorrowISO) {
    return []
  }
  // Past before yesterday -> overdue reminders bucket
  return ['OVERDUE']
}

/**
 * Unique Reminder list titles, first-seen order.
 * Inexact so section items and demo rows (which carry more fields) both type-check.
 * @param {Array<{ reminder?: ?{ listname?: ?string } }>} items
 * @returns {Array<string>}
 */
export function reminderListTitlesFromSectionItems(items: $ReadOnlyArray<{ +reminder?: ?{ +listname?: ?string, ... }, ... }>): Array<string> {
  const seen: { [string]: boolean } = {}
  const titles: Array<string> = []
  for (const item of items) {
    const listTitle = item.reminder?.listname
    if (listTitle && !seen[listTitle]) {
      seen[listTitle] = true
      titles.push(listTitle)
    }
  }
  return titles
}

/**
 * Form fields for the add-Reminder dialog (CommandButton / showDialog).
 * `listTitles` is display order: the dropdown keeps that order and pre-selects the first title.
 * @param {Array<string>} listTitles
 * @param {string} prefillText - optional title copied from the topbar task field
 * @returns {Array<TDialogSettingItem>}
 */
export function buildReminderAddFormFields(listTitles: Array<string>, prefillText: string = ''): Array<TDialogSettingItem> {
  return [
    { type: 'input', label: 'Reminder:', key: 'text', focus: true, value: prefillText, gatesSubmit: true, debounceOnChange: false },
    {
      type: 'dropdown-select',
      label: 'Reminder List:',
      key: 'list',
      // Cast: TDialogSettingItem.options is Array<TOptionObject>, but dropdown-select also accepts Array<string>.
      options: (listTitles: any),
      noWrapOptions: true,
      value: listTitles[0] || '',
    },
    { type: 'calendarpicker', label: 'Date (optional):', key: 'date', dateFormat: 'YYYY-MM-DD', rowGroup: 'when' },
    { type: 'input', label: 'Time (optional, HH:MM):', key: 'time', rowGroup: 'when' },
  ]
}
