/* globals describe, expect, test */
// @flow
// Last updated 2026-10-31 by @CursorAI

import { buildReminderAddFormFields, reminderListTitlesFromSectionItems, REMINDER_ADD_REFRESH_SECTIONS } from '../reminderAddForm.js'

describe('reminderAddForm', () => {
  test('reminderListTitlesFromSectionItems keeps first-seen order and drops blanks', () => {
    const titles = reminderListTitlesFromSectionItems([
      { reminder: { listname: 'Grocery' } },
      { reminder: { listname: 'Grocery' } },
      { reminder: { listname: '' } },
      {},
      { reminder: { listname: 'Errands' } },
    ])
    expect(titles).toEqual(['Grocery', 'Errands'])
  })

  test('buildReminderAddFormFields uses the shared Reminder dialog shape and optional prefill', () => {
    const fields = buildReminderAddFormFields(['Zebra', 'Apple', 'Mango'], 'Buy milk')
    expect(fields.map((field) => field.key)).toEqual(['text', 'list', 'date', 'time'])
    expect(fields[0].value).toBe('Buy milk')
    expect(fields[0].gatesSubmit).toBe(true)
    expect(fields[1].value).toBe('Zebra')
    expect(fields[1].options).toEqual(['Zebra', 'Apple', 'Mango'])
    expect(fields[2].rowGroup).toBe('when')
    expect(fields[3].rowGroup).toBe('when')
    expect(REMINDER_ADD_REFRESH_SECTIONS).toEqual(['REM', 'DT', 'TB', 'DO', 'DY', 'OVERDUE'])
  })
})
