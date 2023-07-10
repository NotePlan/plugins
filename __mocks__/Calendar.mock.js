/* eslint-disable */
/*
 * Calendar mocks
 *
 * Note: nested object example data are there for reference only -- will need to be deleted or cleaned up before use (consider using a factory)
 * For functions: check whether async or not & add params & return value
 *
 */
import moment from 'moment'
import * as chrono from 'chrono-node'

export const Calendar = {
  // async add() { return null },
  // async addUnitToDate() { return null },
  availableCalendarTitles(writeOnly: boolean) {
    if (writeOnly) {
      return ['cal1']
    } else {
      return ['cal1', 'cal2']
    }
  },
  // async availableReminderListTitles() { return null },
  // async dateFrom() { return null },
  /* dateUnits: [{ return second }], */
  // async eventByID() { return null },
  // async eventsBetween() { return null },
  // async eventsToday() { return null },
  parseDateText(str) {
    if (str && str.length) {
      const chronoGuesses = chrono.parse(str)
      if (chronoGuesses && chronoGuesses.length) {
        const retObj = {
          start: chronoGuesses[0].start.date(),
          end: chronoGuesses[0].end?.date() || chronoGuesses[0].start.date(),
          text: chronoGuesses[0].text || '',
          index: 2,
        }
        return [retObj]
      }
      throw `Calendar.parseDateText() date string  (${str}) not recognized`
    }
    return { start: new Date('2022-01-01 00:00'), end: new Date('2022-01-01 03:00'), text: str, index: 2 }
  },
  // async reminderByID() { return null },
  // async remindersBetween() { return null },
  // async remindersByLists() { return null },
  // async remindersToday() { return null },
  // async remove() { return null },
  // async timeAgoSinceNow() { return null },
  // async unitOf() { return null },
  // async unitsAgoFromNow() { return null },
  // async unitsBetween() { return null },
  // async unitsUntilNow() { return null },
  // async update() { return null },
  endOfWeek(date) {
    return moment(date).endOf('week').toDate() // new Date('2022-01-07 23:59')
  },
  startOfWeek(date) {
    return moment(date).startOf('week').toDate() // new Date('2022-01-01 00:00')
  },
  weekNumber(date) {
    return moment(date).week()
  },
}

// module.exports = Calendar
