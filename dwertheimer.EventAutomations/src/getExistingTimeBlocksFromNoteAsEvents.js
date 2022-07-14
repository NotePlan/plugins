import { addMinutes } from 'date-fns'
import { getTimeBlockString, isTimeBlockLine } from '../../helpers/timeblocks'
import { PartialCalendarItem } from './timeblocking-flow-types'

/**
 * Scan note for user-entered timeblocks and return them as an array of Calendar Items
 * @param {*} note
 * @param {*} defaultDuration
 * @returns
 */
export function getExistingTimeBlocksFromNoteAsEvents(note: TEditor | TNote, defaultDuration: number): Array<PartialCalendarItem> {
  const timeBlocksAsEvents = []
  note.paragraphs.forEach((p) => {
    if (isTimeBlockLine(p.content)) {
      const timeblockDateRangePotentials = Calendar.parseDateText(p.content)
      if (timeblockDateRangePotentials?.length) {
        const e = timeblockDateRangePotentials[0] //use Noteplan/Chrono's best guess

        // but this may not actually be a timeblock, so keep looking
        const tbs = getTimeBlockString(p.content)
        if (tbs && tbs.length > 0) {
          const eventInfo = p.content.replace(tbs, '').trim()
          timeBlocksAsEvents.push({
            title: eventInfo,
            date: e.start,
            endDate: e.end !== e.start ? e.end : addMinutes(e.start, defaultDuration),
            type: 'event',
            availability: 0,
          })
        }
      }
    }
  })
  return timeBlocksAsEvents
}
