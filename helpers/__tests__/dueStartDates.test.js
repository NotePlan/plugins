/* globals describe, expect, test */

// getNPWeekData reads the Calendar global. An empty object takes the moment week fallback.
if (typeof global.Calendar === 'undefined') global.Calendar = {}

import moment from 'moment/min/moment-with-locales'
import { relativeDateFromNumber } from '../dateTime'
import { getNPWeekData } from '../NPdateTime'
import { contentWithoutDueDate, daysBeforeDueDate, daysBetweenStartAndDueDate, daysUntilWeekDue, dueDateChip, explainStartDueWindow, explainThisWeekSpan, hasDueDate, hasStartAndDueDate, replaceFarDueDatesWithChips, thisWeekIsInStartDueWeekSpan, todayIsBetweenStartAndDueDate, weekDueIsPast } from '../dueStartDates'

const isoOffset = (days) => moment().startOf('day').add(days, 'days').format('YYYY-MM-DD')

const weekSpec = (offset) => {
  const info = getNPWeekData(new Date(), offset, 'week')
  if (info == null) throw new Error(`no week data for offset ${offset}`)
  return info.weekString
}

const expectedWeekChip = (days) => {
  if (days >= -6 && days <= 6) {
    if (days === 0) return { days, label: 'today', urgent: true }
    if (days < 0) {
      const ago = Math.abs(days)
      return { days, label: `${ago} ${ago === 1 ? 'day' : 'days'} ago`, urgent: true }
    }
    return { days, label: `${days} ${days === 1 ? 'day' : 'days'}`, urgent: false }
  }
  const weeks = Math.trunc(days / 7)
  const count = Math.abs(weeks)
  const word = count === 1 ? 'week' : 'weeks'
  if (weeks < 0) return { days, label: `${count} ${word} ago`, urgent: true }
  return { days, label: `${count} ${word}`, urgent: false }
}

describe('helpers/dueStartDates', () => {
  describe('hasDueDate()', () => {
    test('true at start of line', () => {
      expect(hasDueDate('!2026-01-15')).toBe(true)
    })
    test('true with spaces around the date', () => {
      expect(hasDueDate('task !2026-01-15 next')).toBe(true)
    })
    test('true inside round, square, and curly brackets', () => {
      expect(hasDueDate('(!2026-01-15)')).toBe(true)
      expect(hasDueDate('[!2026-01-15]')).toBe(true)
      expect(hasDueDate('{!2026-01-15}')).toBe(true)
    })
    test('true when the date is at end of line after a newline', () => {
      expect(hasDueDate('task\n!2026-01-15')).toBe(true)
    })
    test('true when a non-digit is before the marker or after the date', () => {
      expect(hasDueDate('task!2026-01-15')).toBe(true)
      expect(hasDueDate('!2026-01-15next')).toBe(true)
      expect(hasDueDate('!2026-01-15.')).toBe(true)
      expect(hasDueDate('!!2026-01-15')).toBe(true)
    })
    test('false when a digit is immediately before the marker or after the date', () => {
      expect(hasDueDate('5!2026-01-15')).toBe(false)
      expect(hasDueDate('!2026-01-151')).toBe(false)
    })
    test('false for an impossible calendar date', () => {
      expect(hasDueDate('!2026-02-31')).toBe(false)
    })
    test('false when there is no due date', () => {
      expect(hasDueDate('task >2026-01-01')).toBe(false)
      expect(hasDueDate('')).toBe(false)
    })
    test('true for the !>YYYY-MM-DD form', () => {
      expect(hasDueDate('!>2026-01-15')).toBe(true)
      expect(hasDueDate('task !>2026-01-15 next')).toBe(true)
      expect(hasDueDate('(>2026-10-01) !>2026-10-10')).toBe(true)
    })
    test('true when !> follows a non-digit', () => {
      expect(hasDueDate('task!>2026-01-15')).toBe(true)
      expect(hasDueDate('!!>2026-01-15')).toBe(true)
    })
    test('false when !> follows a digit or the date is followed by a digit', () => {
      expect(hasDueDate('5!>2026-01-15')).toBe(false)
      expect(hasDueDate('!>2026-01-159')).toBe(false)
    })
    test('uses the first valid due date when an earlier one is impossible', () => {
      expect(hasDueDate('!2026-02-31 !2026-03-01')).toBe(true)
    })
  })

  describe('hasStartAndDueDate()', () => {
    test('true when both markers are present', () => {
      expect(hasStartAndDueDate('>2026-01-01 !2026-01-15')).toBe(true)
      expect(hasStartAndDueDate('>2026-10-01 !>2026-10-10')).toBe(true)
    })
    test('the > inside !> is not a start date', () => {
      expect(hasStartAndDueDate('!>2026-10-10')).toBe(false)
    })
    test('false with only a start date', () => {
      expect(hasStartAndDueDate('>2026-01-01')).toBe(false)
    })
    test('false with only a due date', () => {
      expect(hasStartAndDueDate('!2026-01-15')).toBe(false)
    })
    test('false for >today, which is not a YYYY-MM-DD start date', () => {
      expect(hasStartAndDueDate('>today !2026-01-15')).toBe(false)
    })
    test('an arrow-date link still counts as a start date', () => {
      expect(hasStartAndDueDate('>2026-01-01< !2026-01-15')).toBe(true)
    })
    test('a non-digit before > counts, and a digit does not', () => {
      expect(hasStartAndDueDate('(>2026-01-01) !2026-01-15')).toBe(true)
      expect(hasStartAndDueDate('task>2026-01-01 !2026-01-15')).toBe(true)
      expect(hasStartAndDueDate('5>2026-01-01 !2026-01-15')).toBe(false)
      expect(hasStartAndDueDate('>2026-01-011 !2026-01-15')).toBe(false)
    })
  })

  describe('daysBetweenStartAndDueDate()', () => {
    test('returns due minus start in whole days', () => {
      expect(daysBetweenStartAndDueDate('start >2026-01-01 due !2026-01-11')).toBe(10)
      expect(daysBetweenStartAndDueDate('>2026-10-01 !>2026-10-10')).toBe(9)
    })
    test('null when the only date is a !> due date', () => {
      expect(daysBetweenStartAndDueDate('!>2026-10-10')).toBe(null)
    })
    test('is zero when the dates are the same day', () => {
      expect(daysBetweenStartAndDueDate('>2026-01-01 !2026-01-01')).toBe(0)
    })
    test('is negative when the due date is before the start date', () => {
      expect(daysBetweenStartAndDueDate('!2026-01-01 >2026-01-04')).toBe(-3)
    })
    test('uses the first valid date of each kind', () => {
      expect(daysBetweenStartAndDueDate('>2026-01-01 >2026-02-01 !2026-01-03 !2026-06-01')).toBe(2)
    })
    test('null when the due date is missing', () => {
      expect(daysBetweenStartAndDueDate('>2026-01-01')).toBe(null)
    })
    test('null when the start date is missing', () => {
      expect(daysBetweenStartAndDueDate('!2026-01-15')).toBe(null)
    })
    test('null when either date is not a real calendar date', () => {
      expect(daysBetweenStartAndDueDate('>2026-02-31 !2026-03-01')).toBe(null)
      expect(daysBetweenStartAndDueDate('>2026-03-01 !2026-02-31')).toBe(null)
    })
  })

  describe('daysBeforeDueDate()', () => {
    test('null when there is no due date', () => {
      expect(daysBeforeDueDate('task >2026-01-01')).toBe(null)
      expect(daysBeforeDueDate('')).toBe(null)
    })
    test('days from today until the due date', () => {
      expect(daysBeforeDueDate(`task !${isoOffset(5)}`)).toBe(5)
    })
    test('zero when the due date is today', () => {
      expect(daysBeforeDueDate(`!${isoOffset(0)}`)).toBe(0)
    })
    test('negative when the due date is in the past', () => {
      expect(daysBeforeDueDate(`!${isoOffset(-2)}`)).toBe(-2)
    })
    test('uses the first due date', () => {
      expect(daysBeforeDueDate(`!${isoOffset(1)} !${isoOffset(9)}`)).toBe(1)
      expect(daysBeforeDueDate(`!>${isoOffset(4)} !${isoOffset(9)}`)).toBe(4)
    })
  })

  describe('todayIsBetweenStartAndDueDate()', () => {
    test('true on the start date, the due date, and a day strictly inside', () => {
      expect(todayIsBetweenStartAndDueDate(`>${isoOffset(0)} !>${isoOffset(0)}`)).toBe(true)
      expect(todayIsBetweenStartAndDueDate(`>${isoOffset(-3)} !>${isoOffset(0)}`)).toBe(true)
      expect(todayIsBetweenStartAndDueDate(`>${isoOffset(0)} !>${isoOffset(4)}`)).toBe(true)
      expect(todayIsBetweenStartAndDueDate(`>${isoOffset(-2)} !>${isoOffset(5)}`)).toBe(true)
    })
    test('false before the start date or after the due date', () => {
      expect(todayIsBetweenStartAndDueDate(`>${isoOffset(1)} !>${isoOffset(5)}`)).toBe(false)
      expect(todayIsBetweenStartAndDueDate(`>${isoOffset(-5)} !>${isoOffset(-1)}`)).toBe(false)
    })
    test('false when the !> due date or the start date is missing', () => {
      expect(todayIsBetweenStartAndDueDate(`!>${isoOffset(3)}`)).toBe(false)
      expect(todayIsBetweenStartAndDueDate(`>${isoOffset(-1)}`)).toBe(false)
    })
    test('a plain ! date plus a start date is not this window', () => {
      expect(todayIsBetweenStartAndDueDate(`>${isoOffset(-1)} !${isoOffset(3)}`)).toBe(false)
    })
    test('the > inside !> is not the start date', () => {
      expect(todayIsBetweenStartAndDueDate(`task !>${isoOffset(-1)} !>${isoOffset(2)}`)).toBe(false)
    })
    test('a week due does not open the day window', () => {
      expect(todayIsBetweenStartAndDueDate(`>${weekSpec(-1)} !>${weekSpec(1)}`)).toBe(false)
    })
    test('explainStartDueWindow matches the include decision', () => {
      const inside = `>${isoOffset(-2)} !>${isoOffset(5)}`
      const before = `>${isoOffset(1)} !>${isoOffset(5)}`
      const after = `>${isoOffset(-5)} !>${isoOffset(-1)}`
      const plainBang = `>${isoOffset(-1)} !${isoOffset(3)}`
      expect(todayIsBetweenStartAndDueDate(inside)).toBe(true)
      expect(explainStartDueWindow(inside).startsWith('in window')).toBe(true)
      expect(explainStartDueWindow(before)).toContain('before start')
      expect(explainStartDueWindow(after)).toContain('after due')
      expect(explainStartDueWindow(plainBang)).toBe('no !> due date')
      expect(explainStartDueWindow(`!>${isoOffset(2)}`)).toBe('no start date')
    })
  })

  describe('thisWeekIsInStartDueWeekSpan()', () => {
    test('true from the start week through the due week', () => {
      expect(thisWeekIsInStartDueWeekSpan(`>${weekSpec(0)} !>${weekSpec(0)}`)).toBe(true)
      expect(thisWeekIsInStartDueWeekSpan(`>${weekSpec(-1)} !>${weekSpec(0)}`)).toBe(true)
      expect(thisWeekIsInStartDueWeekSpan(`>${weekSpec(-2)} !>${weekSpec(1)}`)).toBe(true)
    })
    test('false before the start week and after the due week', () => {
      expect(thisWeekIsInStartDueWeekSpan(`>${weekSpec(1)} !>${weekSpec(2)}`)).toBe(false)
      expect(thisWeekIsInStartDueWeekSpan(`>${weekSpec(-3)} !>${weekSpec(-1)}`)).toBe(false)
    })
    test('false without a week start, and for a plain week due', () => {
      expect(thisWeekIsInStartDueWeekSpan(`!>${weekSpec(1)}`)).toBe(false)
      expect(thisWeekIsInStartDueWeekSpan(`>${weekSpec(-1)} !${weekSpec(1)}`)).toBe(false)
    })
    test('the > inside !> is not the start week, and a day start does not count', () => {
      expect(explainThisWeekSpan(`!>${weekSpec(1)}`)).toBe('no start week')
      expect(thisWeekIsInStartDueWeekSpan(`>${isoOffset(-1)} !>${weekSpec(1)}`)).toBe(false)
    })
    test('invalid week numbers do not open the span', () => {
      expect(thisWeekIsInStartDueWeekSpan('>2026-W00 !>2026-W01')).toBe(false)
      expect(thisWeekIsInStartDueWeekSpan('>2026-W01 !>2026-W54')).toBe(false)
    })
    test('explainThisWeekSpan matches the include decision', () => {
      const inside = `>${weekSpec(-1)} !>${weekSpec(1)}`
      const before = `>${weekSpec(1)} !>${weekSpec(2)}`
      const after = `>${weekSpec(-3)} !>${weekSpec(-1)}`
      expect(thisWeekIsInStartDueWeekSpan(inside)).toBe(true)
      expect(explainThisWeekSpan(inside).startsWith('in week span')).toBe(true)
      expect(explainThisWeekSpan(before)).toContain('before start week')
      expect(explainThisWeekSpan(after)).toContain('after due week')
    })
  })

  describe('week due chip', () => {
    test('uses days when the last day of the due week is within 6 days', () => {
      const spec = weekSpec(0)
      const days = daysUntilWeekDue(`!${spec}`)
      expect(days).toBeGreaterThanOrEqual(0)
      expect(days).toBeLessThanOrEqual(6)
      expect(dueDateChip(`!${spec}`)).toEqual(expectedWeekChip(days))
    })
    test('uses whole weeks outside that day range, partial week dropped', () => {
      const ahead = weekSpec(2)
      const aheadDays = daysUntilWeekDue(`!>${ahead}`)
      expect(aheadDays).toBeGreaterThan(6)
      expect(dueDateChip(`!>${ahead}`, 0)).toEqual(expectedWeekChip(aheadDays))
      const behind = weekSpec(-2)
      const behindDays = daysUntilWeekDue(`!${behind}`)
      expect(behindDays).toBeLessThan(-6)
      expect(weekDueIsPast(`!${behind}`)).toBe(true)
      expect(dueDateChip(`!${behind}`)).toEqual(expectedWeekChip(behindDays))
    })
    test('removes the week marker when the chip is shown, and does not turn it into a far day chip', () => {
      const spec = weekSpec(2)
      const line = `Plan trip !>${spec}`
      expect(contentWithoutDueDate(line, 0)).toBe('Plan trip')
      expect(replaceFarDueDatesWithChips(line, 5)).toBe(line)
    })
    test('hasDueDate sees a week due', () => {
      expect(hasDueDate(`!${weekSpec(0)}`)).toBe(true)
      expect(hasDueDate('!>2026-W00')).toBe(false)
      expect(hasDueDate('!>2026-W54')).toBe(false)
    })
  })

  describe('dueDateChip()', () => {
    test('null when there is no due date', () => {
      expect(dueDateChip('task >2026-01-01')).toBe(null)
    })
    test('null when the due date is more than 5 days away', () => {
      expect(dueDateChip(`!${isoOffset(6)}`)).toBe(null)
    })
    test('uses a caller-supplied day window', () => {
      expect(dueDateChip(`!${isoOffset(10)}`, 14)).toEqual({ days: 10, label: '10 days', urgent: false })
      expect(dueDateChip(`!${isoOffset(1)}`, 0)).toBe(null)
      expect(dueDateChip(`!${isoOffset(0)}`, 0)).toEqual({ days: 0, label: 'today', urgent: true })
      expect(dueDateChip(`!${isoOffset(-2)}`, 0)).toEqual({ days: -2, label: '2 days ago', urgent: true })
    })
    test('uses a later due date when the first one is outside the window', () => {
      expect(dueDateChip(`!${isoOffset(20)} !${isoOffset(2)}`, 5)).toEqual({ days: 2, label: '2 days', urgent: false })
    })
    test('shows N days when due within 5 days', () => {
      expect(dueDateChip(`task !${isoOffset(5)}`)).toEqual({ days: 5, label: '5 days', urgent: false })
      expect(dueDateChip(`!${isoOffset(1)}`)).toEqual({ days: 1, label: '1 day', urgent: false })
    })
    test('today is urgent', () => {
      expect(dueDateChip(`!${isoOffset(0)}`)).toEqual({ days: 0, label: 'today', urgent: true })
    })
    test('overdue is urgent and counted in days ago', () => {
      expect(dueDateChip(`!${isoOffset(-3)}`)).toEqual({ days: -3, label: '3 days ago', urgent: true })
      expect(dueDateChip(`!${isoOffset(-1)}`)).toEqual({ days: -1, label: '1 day ago', urgent: true })
    })
  })

  describe('contentWithoutDueDate()', () => {
    test('removes an in-window due date and leaves the rest of the line', () => {
      const due = isoOffset(3)
      expect(contentWithoutDueDate(`Wedding Anniversary birthday TEST >2026-10-10  !${due}`)).toBe(
        'Wedding Anniversary birthday TEST >2026-10-10',
      )
    })
    test('leaves a due date that is outside the window', () => {
      const due = isoOffset(20)
      expect(contentWithoutDueDate(`task !${due}`)).toBe(`task !${due}`)
    })
    test('removes a due date at the start of the line', () => {
      expect(contentWithoutDueDate(`!${isoOffset(1)} call`)).toBe('call')
    })
    test('skips an impossible date and removes the first in-window one', () => {
      const due = isoOffset(-2)
      expect(contentWithoutDueDate(`!2026-02-31 !${due} later`)).toBe('!2026-02-31 later')
    })
    test('removes only the first of two in-window due dates', () => {
      const first = isoOffset(-4)
      const second = isoOffset(-1)
      expect(contentWithoutDueDate(`!${first} !${second} later`)).toBe(`!${second} later`)
    })
    test('leaves text with no due date unchanged', () => {
      expect(contentWithoutDueDate('task >2026-01-01')).toBe('task >2026-01-01')
    })
    test('removes an in-window !> due date and leaves the scheduled date', () => {
      const due = isoOffset(3)
      expect(contentWithoutDueDate(`Wedding Anniversary birthday TEST >2026-10-01 !>${due}`)).toBe(
        'Wedding Anniversary birthday TEST >2026-10-01',
      )
    })
  })

  describe('replaceFarDueDatesWithChips()', () => {
    test('wraps a later due date in an inline chip and leaves an in-window date', () => {
      const near = isoOffset(1)
      const far = isoOffset(20)
      const html = replaceFarDueDatesWithChips(`task !${far} !${near}`, 5, true)
      expect(html).toContain('class="dueDateAheadChip"')
      expect(html).toContain(relativeDateFromNumber(20))
      expect(html).not.toContain(far)
      expect(html).not.toContain(`!${far}`)
      expect(html).toContain(`!${near}`)
    })
    test('leaves an in-window due date unchanged', () => {
      const near = isoOffset(2)
      expect(replaceFarDueDatesWithChips(`task !${near}`, 5)).toBe(`task !${near}`)
    })
    test('wraps a far !> due date and leaves the scheduled >date', () => {
      const far = isoOffset(20)
      const html = replaceFarDueDatesWithChips(`task >2020-01-01 !>${far}`, 5, false)
      expect(html).toContain('class="dueDateAheadChip"')
      expect(html).toContain(far)
      expect(html).not.toContain(`!>${far}`)
      expect(html).toContain('>2020-01-01')
    })
  })
})
