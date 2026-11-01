/* globals describe, expect, test */
// @flow
// Last updated 2026-10-31 by @CursorAI

import moment from 'moment/min/moment-with-locales'
import { buildReminderAddFormFields, reminderListTitlesFromSectionItems, sectionCodesForNewReminder } from '../reminderAddForm.js'

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
  })

  test('sectionCodesForNewReminder picks only the destination section(s)', () => {
    const today = moment().format('YYYY-MM-DD')
    const yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD')
    const tomorrow = moment().add(1, 'days').format('YYYY-MM-DD')
    const past = moment().subtract(5, 'days').format('YYYY-MM-DD')
    const future = moment().add(5, 'days').format('YYYY-MM-DD')
    expect(sectionCodesForNewReminder('')).toEqual(['REM'])
    expect(sectionCodesForNewReminder(today)).toEqual(['DT'])
    expect(sectionCodesForNewReminder(today, '09:30')).toEqual(['TB'])
    expect(sectionCodesForNewReminder(tomorrow)).toEqual(['DO'])
    expect(sectionCodesForNewReminder(yesterday)).toEqual(['DY', 'OVERDUE'])
    expect(sectionCodesForNewReminder(past)).toEqual(['OVERDUE'])
    expect(sectionCodesForNewReminder(future)).toEqual([])
  })
})
