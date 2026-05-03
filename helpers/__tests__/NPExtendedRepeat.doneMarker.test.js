/* global describe, expect, test */
import { RE_DONE_DATE_TIME_CAPTURES } from '@helpers/dateTime'

/**
 * Regression: generateRepeatForPara must shorten @done(date time) by replacing the full @done match,
 * not the first substring equal to " " + time (which can appear in task text before @done).
 */
describe('NPExtendedRepeat @done shortening', () => {
  test('replaces @done datetime without stripping same time earlier in line', () => {
    const line = '* [x] Call at 09:45 AM today @done(2026-05-03 09:45 AM) @repeat(+1d)'
    const doneMatch = line.match(RE_DONE_DATE_TIME_CAPTURES)
    expect(doneMatch).not.toBeNull()
    expect(doneMatch[1]).toBe('2026-05-03')
    const lineWithoutDoneTime = line.replace(RE_DONE_DATE_TIME_CAPTURES, `@done(${doneMatch[1]})`)
    expect(lineWithoutDoneTime).toContain('at 09:45 AM')
    expect(lineWithoutDoneTime).toContain('@done(2026-05-03)')
    expect(lineWithoutDoneTime).not.toMatch(/@done\(2026-05-03 09:45/)
  })

  test('naive replace of time substring would wrongly leave @done with time', () => {
    const line = '* [x] Call at 09:45 AM today @done(2026-05-03 09:45 AM) @repeat(+1d)'
    const doneMatch = line.match(RE_DONE_DATE_TIME_CAPTURES)
    const completedTime = doneMatch[2]
    const naive = line.replace(completedTime, '')
    expect(naive).toMatch(/@done\(2026-05-03 09:45/) // bug: @done still has time
    expect(naive).not.toContain('at 09:45 AM') // bug: body was damaged
  })
})
