// @flow
//-----------------------------------------------------------------------------
// Shared "add a Reminder" dialog fields for the REM section button and the topbar.
// Last updated 2026-10-31 by @CursorAI
//-----------------------------------------------------------------------------

import type { TDialogSettingItem, TSectionCode } from './types'

/** Sections the REM heading button refreshes after a new Reminder is created. */
export const REMINDER_ADD_REFRESH_SECTIONS: Array<TSectionCode> = ['REM', 'DT', 'TB', 'DO', 'DY', 'OVERDUE']

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
