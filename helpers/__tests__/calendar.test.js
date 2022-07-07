/* globals describe, expect, test */
import colors from 'chalk'
import * as ch from '../calendar'

const PLUGIN_NAME = `📙 ${colors.yellow('helpers/calendar')}`
const section = colors.blue

// const config = {
//   todoChar: '*' /* character at the front of a timeblock line - can be *,-,or a heading, e.g. #### */,
//   timeBlockTag: `#🕑` /* placed at the end of the timeblock to show it was created by this plugin */,
//   timeBlockHeading: 'Time Blocks' /* if this heading exists in the note, timeblocks will be placed under it */,
//   workDayStart: '08:00' /* needs to be in 24 hour format (two digits, leading zero) */,
//   workDayEnd: '18:00' /* needs to be in 24 hour format (two digits, leading zero) */,
//   durationMarker:
//     "'" /* signifies how long a task is, e.g. apostrophe: '2h5m or use another character, e.g. tilde: ~2h5m */,
//   intervalMins: 5 /* inverval on which to calculate time blocks */,
//   removeDuration: true /* remove duration when creating timeblock text */,
//   nowStrOverride: '00:00' /* for testing */,
//   defaultDuration: 10 /* default duration of a task that has no duration/end time */,
// }

// import { isNullableTypeAnnotation } from '@babel/types'

// Jest suite
describe(`${PLUGIN_NAME}`, () => {
  describe(section('helpers/calendar.js'), () => {
    describe('getTimedEntries', () => {
      test('should return only items which are not isAllDay==true', () => {
        expect(
          ch.getTimedEntries([
            { title: 'one', isAllDay: false },
            { title: 'two', isAllDay: true },
          ]),
        ).toEqual([
          {
            title: 'one',
            isAllDay: false,
          },
        ])
      })
      test('should return empty array when there are no items isAllDay==false', () => {
        expect(
          ch.getTimedEntries([
            { title: 'one', isAllDay: true },
            { title: 'two', isAllDay: true },
          ]),
        ).toEqual([])
      })
    })
    describe('keepTodayPortionOnly', () => {
      test('should not modify items that are start/end in the same day', () => {
        const events = [
          { date: new Date(`2021-01-01 08:00`), endDate: new Date(`2021-01-01 23:59`), title: 'foo', isAllDay: false },
        ]
        expect(ch.keepTodayPortionOnly(events)).toEqual(events)
      })
      test('should modify items that are started prior to date in question and end on date in question', () => {
        const sentEvents = [
          {
            date: new Date(`2021-01-01 08:00`),
            endDate: new Date(`2021-01-02 10:00`),
            title: 'foo',
            isAllDay: false,
          },
        ]
        const expectedReturn = [
          {
            date: new Date(`2021-01-02 00:00`),
            endDate: new Date(`2021-01-02 10:00`),
            title: 'foo',
            isAllDay: false,
          },
        ]
        expect(ch.keepTodayPortionOnly(sentEvents, new Date(`2021-01-02 08:00`))).toEqual(expectedReturn)
      })
      test('should modify items that start on day in question but end after date in question', () => {
        const sentEvents = [
          {
            date: new Date(`2021-01-01 08:00`),
            endDate: new Date(`2021-01-02 10:00`),
            title: 'foo',
            isAllDay: false,
          },
        ]
        const expectedReturn = [
          {
            date: new Date(`2021-01-01 08:00`),
            endDate: new Date(`2021-01-01 23:59:59.999`),
            title: 'foo',
            isAllDay: false,
          },
        ]
        expect(ch.keepTodayPortionOnly(sentEvents, new Date(`2021-01-01 08:00`))).toEqual(expectedReturn)
      })
      test('should modify items that start before day in question and end after date in question', () => {
        const sentEvents = [
          {
            date: new Date(`2021-01-01 08:00`),
            endDate: new Date(`2021-01-03 10:00`),
            title: 'foo',
            isAllDay: false,
          },
        ]
        const expectedReturn = [
          {
            date: new Date(`2021-01-02 00:00`),
            endDate: new Date(`2021-01-02 23:59:59.999`),
            title: 'foo',
            isAllDay: false,
          },
        ]
        expect(ch.keepTodayPortionOnly(sentEvents, new Date(`2021-01-02 08:00`))).toEqual(expectedReturn)
      })
    })

    describe('getTimedEntries', () => {
      test('should return only items which are not isAllDay==true', () => {
        expect(
          ch.getTimedEntries([
            { title: 'one', isAllDay: false },
            { title: 'two', isAllDay: true },
          ]),
        ).toEqual([
          {
            title: 'one',
            isAllDay: false,
          },
        ])
      })
      test('should return empty array when there are no items isAllDay==false', () => {
        expect(
          ch.getTimedEntries([
            { title: 'one', isAllDay: true },
            { title: 'two', isAllDay: true },
          ]),
        ).toEqual([])
      })
    })

    describe('attendeesAsString', () => {
      const attendees = ['✓ [Jonathan Clark](mailto:jonathan@clarksonline.me.uk)',
        '[James Bond](mailto:007@sis.gov.uk)',
        'x [M](mailto:m@sis.gov.uk)']
      test('should return names when only one param sent (default is names)', () => {
        const r = ch.attendeesAsString(attendees)
        expect(r).toEqual('Jonathan Clark, James Bond, M')
      })
      test('should return emails when 2nd param set to email', () => {
        const r = ch.attendeesAsString(attendees, 'email')
        expect(r).toEqual('mailto:jonathan@clarksonline.me.uk, mailto:007@sis.gov.uk, mailto:m@sis.gov.uk')
      })
      test('should return empty string when no attendees', () => {
        const r = ch.attendeesAsString([], 'email')
        expect(r).toEqual('')
      })
      test('should return the name when there is no email', () => {
        const r = ch.attendeesAsString(['[text]()'], 'email')
        expect(r).toEqual('text')
      })
      test('should return the email when there is no name', () => {
        const r = ch.attendeesAsString(['[](email@gmail)'], 'name')
        expect(r).toEqual('email@gmail')
      })
      test('should return nothing if not data', () => {
        const r = ch.attendeesAsString(['[]()'], 'name')
        expect(r).toEqual('')
      })

    })
  })
})
