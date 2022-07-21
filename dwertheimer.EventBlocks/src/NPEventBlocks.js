// @flow

import { addMinutes } from 'date-fns'
import pluginJson from '../plugin.json'
import { log, logError, JSP, clo, logWarn } from '@helpers/dev'
import { chooseHeading, chooseOption } from '@helpers/userInput'
import { findHeading, getBlockUnderHeading } from '@helpers/NPParagraph'
import { isReallyAllDay } from '@helpers/dateTime'

export const hasCalendarLink = (line: string): boolean => /\!\[📅\]/.test(line)

export type EventBlocksConfig = {
  confirm: boolean,
  eventLength: string,
  removeDateText: boolean,
  linkText: string,
  version?: string,
}

/**
 * Replace the text of the calendar link with different text
 * @param {string} line - the line to check and replace
 * @param {string} replaceWith - the text to replace the calendar link text with
 * @returns
 */
export const replaceCalendarLinkText = (line: string, replaceWith: string): string => {
  const parts = line.split(':::')
  if (parts.length === 5) {
    parts[3] = replaceWith

    return parts.join(':::')
  } else {
    log(pluginJson, `replaceCalendarLinkText: could not split/find 4 parts for link: ${line}`)
    return line
  }
}

/**
 * This code is just here to test that the date processing does what you expect.
 */
export function parseDateTextChecker() {
  const tests = [
    'schedule something for now',
    'today',
    'today at 3',
    'today at 8',
    'ten minutes from now',
    'in 20 minutes',
    'tomorrow',
    'tomorrow at 2',
    'tomorrow at 4pm',
    'today',
    'tomorrow',
    'sunday',
    'monday',
    'tuesday',
    'wednesday at noon',
    'wednesday at 12',
    'thursday at 5',
    'friday at 8',
    'saturday at 9',
    'june 29th',
    'june 29th at 2',
    'next week',
    'next month',
    'last week',
    'last month,',
  ]
  Editor.appendParagraph(`${new Date().toISOString()} - now ISO`, 'text')
  Editor.appendParagraph(`${new Date().toString()} - now`, 'text')
  tests.forEach((element) => {
    const val = Calendar.parseDateText(element)
    Editor.appendParagraph(`${val[0].start.toString()} - "${element}" ${isReallyAllDay(val[0]) ? 'allday' : ''}`, 'text')
    // clo(val, `NPEventBlocks.parseDateTextChecker: Element`)
    console.log(JSON.stringify(val))
  })
}

/**
 * Helper to get the plugin settings or defaults
 * Doesn't do much. This may be replaced when this moves to a @jgclark plugin
 * @returns
 */
export function getPluginSettings(): EventBlocksConfig {
  const settings = DataStore.settings
  if (settings && Object.keys(settings)) {
    return settings
  } else {
    return {
      confirm: true,
      eventLength: '30',
      removeDateText: true,
      linkText: '→',
    }
  }
}

/**
 * Ask the user to choose the heading for the events, and then return the paragraph for the heading (we need it in order to find the block)
 * @param {*} note
 * @returns {TParagraph} - the paragraph object for the heading
 */
export async function chooseTheHeading(note: TNote): Promise<TParagraph | null> {
  const heading = await chooseHeading(note, false, false, false)
  const headingPara = findHeading(note, heading)
  return headingPara
}

type CalendarItemChoice = {
  label: string,
  value: number,
  start: Date,
  end: Date,
  text: string,
  index: number,
}

/**
 * NotePlan may return multiple potential time Range objects for this particular line. Ask the user to choose the right one
 * @param {*} text
 * @param {*} potentials
 * @returns {object} returns a Range++ object for the correct time range
 */
export async function confirmPotentialTimeChoice(text: string, potentials: any): Promise<CalendarItemChoice> {
  const opts = potentials.map((potential, i) => ({
    label: `${potential.start.toLocaleString()} (text: "${potential.text}")`,
    value: i,
    start: potential.start,
    end: potential.end,
    text: potential.text,
    index: potential.index,
  }))
  const val = await chooseOption(`Which of these is "${text}"?`, opts, opts[0].value)
  return opts[val]
}

/**
 *
 * @param {string} title - The title of the event
 * @param {object} range {start, end, text, etc.}
 * @param {*} config
 * @returns {Promis<void>}
 */
export async function createEvent(title: string, range: { start: Date, end: Date }, config: any): Promise<TCalendarItem | null> {
  /* NOTE: TODO: add in missing fields (eg calendar)
  create(
    title: string,
    date: Date,
    endDate: Date | void,
    type: CalenderItemType,
    isAllDay ?: boolean,
    calendar ?: string,
    isCompleted ?: boolean,
    notes ?: string,
    url ?: string,
): TCalendarItem;
*/
  const isAllDayEvent = isReallyAllDay(range) // make an educated guess about whether this was intended to be an all day event
  // log(pluginJson, `createEvent: ${title} allday:${isReallyAllDay(range)}`)
  if (!isAllDayEvent && range.start === range.end) {
    // if it's not an all day event, and the start and end are the same, then it's probably "at 12" or something, so we add time to the end to make it an event
    range.end = addMinutes(range.start, config.eventLength || '30')
  }
  const calendarItem = await CalendarItem.create(title, range.start, range.end || null, 'event', isAllDayEvent)
  const result = await Calendar.add(calendarItem)
  return result || null
}

type EventBlockLine = {
  start: Date,
  end: Date,
  text: string,
  index: number,
  paragraph: ?TParagraph,
  revisedText: ?string,
}

/**
 * Take in a array of TParagraphs (block of lines), loop through and create events for the ones that should be events
 * @param {Array<TParagraph>} block
 * @param {{[string]:any}} config
 * @returns {{paragraph:{TParagraph}, time:{Range++ object with start, end | null}}}
 */
export async function processTimeLines(block: Array<TParagraph>, config: EventBlocksConfig): Promise<Array<{ time: string, paragraph: TParagraph, event: TCalendarItem | null }>> {
  parseDateTextChecker()
  const { confirm, linkText, removeDateText } = config
  const timeLines = [],
    intermediate = []
  try {
    // First, we need to get all the data necessary to create this event, including user input
    // before we can show a status bar
    for (let i = 0; i < block.length; i++) {
      const line = block[i]
      if (hasCalendarLink(line.content)) {
        log(pluginJson, `Skipping line with calendar link: ${line.content}`)
      } else {
        const potentials = Calendar.parseDateText(line.content) //returns {start: Date, end: Date}
        if (potentials.length > 0) {
          let chosen = potentials[0]
          if (potentials.length > 1) {
            if (confirm && line.content.length) {
              chosen = await confirmPotentialTimeChoice(line.content, potentials)
            }
          }
          // Remove the timing part from the line now that we have a link
          // Calendar.parseDateText = [{"start":"2022-06-24T13:00:00.000Z","end":"2022-06-24T13:00:00.000Z","text":"friday at 8","index":0}]
          let revisedLine = line.content
            .replace(removeDateText && chosen?.text?.length ? chosen.text : '', '')
            .replace(/\s{2,}/g, ' ')
            .trim()
          if (revisedLine.length === 0) revisedLine = '...' // If the line was all a date description, we need something to show
          intermediate.push({ revisedLine, chosen, line, index: i })
        } else {
          // do nothing with this line?
          log(pluginJson, `processTimeLines no times found for "${line.content}"`)
        }
      }
    }
    // Now that we have all the info we need, we can create the events with a status bar
    CommandBar.showLoading(true, `Creating Events:\n(${0}/${intermediate.length})`)
    await CommandBar.onAsyncThread()
    for (let j = 0; j < intermediate.length; j++) {
      const item = intermediate[j]
      CommandBar.showLoading(true, `Creating Events:\n(${j}/${intermediate.length})`)
      const range = { start: item.chosen.start, end: item.chosen.end }
      let event = await createEvent(item.revisedLine, range, config)
      if (event && event.id !== null && typeof event.id === 'string') {
        log(pluginJson, `created event ${event.title}`)
        const { id, title, calendarItemLink } = event
        event = id ? await Calendar.eventByID(id) : null

        log(pluginJson, `processTimeLines event=${title} event.calendarItemLink=${calendarItemLink}`)
        const editedLink = replaceCalendarLinkText(calendarItemLink, removeDateText ? `${item.chosen.text || ''} ${linkText}` : linkText)
        item.line.content = `${item.revisedLine} ${editedLink || ''}`
        timeLines.push({ time: item.chosen, paragraph: item.line, event })
        log(pluginJson, `processTimeLines timeLines.length=${timeLines.length}`)
      } else {
        log(pluginJson, `processTimeLines no event created for "${item.revisedLine}"`)
      }
      // confirmPotentialTimeChoices()
      // CreateEvents() // + tag created events
    }
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
    log(pluginJson, `processTimeLines RETURNING ${timeLines.length} processed lines`)
  } catch (error) {
    logError(pluginJson, `processTimeLines error=${JSP(error)}`)
  }
  return timeLines
}

/**
 * Create events from text in a note
 * (plugin Entry point for "/cevt - Create Events")
 * @param {*} heading
 * @param {*} confirm
 */
export async function createEvents(heading: string = '', confirm: string = 'yes'): Promise<void> {
  try {
    const note = Editor.note
    if (note) {
      const config = getPluginSettings()
      config.confirm = confirm === 'yes'
      const headingPara = heading !== '' ? findHeading(note, heading) : await chooseTheHeading(note)
      if (headingPara) {
        const paragraphsBlock = getBlockUnderHeading(note, headingPara)
        if (paragraphsBlock.length) {
          const timeLines = await processTimeLines(paragraphsBlock, config)
          if (timeLines.length) {
            const paras = timeLines.map((timeLine) => timeLine.paragraph)
            Editor.updateParagraphs(paras)
          } else {
            logError(pluginJson, `No time lines found under heading: ${heading}`)
          }
        }
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
