// @flow
// Plugin code goes in files like this. Can be one per command, or several in a file.
// `export async function [name of jsFunction called by Noteplan]`
// then include that function name as an export in the index.js file also
// About Flow: https://flow.org/en/docs/usage/#toc-write-flow-code
// Getting started with Flow in NotePlan: https://github.com/NotePlan/plugins/blob/main/Flow_Guide.md

// NOTE: This file is named NPPluginMain.js (you could change that name and change the reference to it in index.js)
// As a matter of convention, we use NP at the beginning of files which contain calls to NotePlan APIs (Editor, DataStore, etc.)
// Because you cannot easily write tests for code that calls NotePlan APIs, we try to keep the code in the NP files as lean as possible
// and put the majority of the work in the /support folder files which have Jest tests for each function
// support/helpers is an example of a testable file that is used by the plugin command
// REMINDER, to build this plugin as you work on it:
// From the command line:
// `noteplan-cli plugin:dev dwertheimer.EventBlocks --test --watch --coverage`

import { log, logError, clo, JSP } from '@helpers/dev'
import pluginJson from '../plugin.json'
import { chooseHeading, chooseOption } from '@helpers/userInput'
import { getParagraphBlock } from '@helpers/NPParagraph'

export function getPluginSettings() {
  const settings = DataStore.settings
  if (settings && Object.keys(settings)) {
    return settings
  } else {
    return {
      // default settings
    }
  }
}

/**
 * Find the Paragraph object associated with a string (heading)
 * @param {TNote} note
 * @param {string} heading
 * @returns {TParagraph | null} - returns the actual paragraph or null if not found
 */
export function findHeading(note: TNote, heading: string): TParagraph | null {
  if (heading) {
    const paragraphs = note.paragraphs
    const para = paragraphs.find(
      (paragraph) => paragraph.type === 'title' && paragraph.content.trim() === heading.trim(),
    )
    clo(para, `User selected paragraph`)
    if (para) return para
  }
  return null
}

export async function chooseTheHeading(note: TNote): Promise<TParagraph | null> {
  const heading = await chooseHeading(note, false, false, false)
  log(pluginJson, 'heading', heading)
  const headingPara = findHeading(note, heading)
  return headingPara
}

/**
 * Get the paragraphs beneath a title/heading in a note (optionally return the contents without the heading)
 * @param {TNote} note
 * @param {TParagraph | string} heading
 * @param {boolean} returnHeading - whether to return the heading or not with the results (default: true)
 * @returns {TParagraph | null} - returns
 */
export function getBlockUnderHeading(
  note: TNote,
  heading: TParagraph | string,
  returnHeading: boolean = true,
): Array<TParagraph> | [] {
  let headingPara = null
  if (typeof heading === 'string') {
    headingPara = findHeading(note, heading)
  } else {
    headingPara = heading
  }
  let paras = []
  if (headingPara?.lineIndex !== null) {
    paras = getParagraphBlock(note, headingPara.lineIndex)
  }
  if (paras.length && !returnHeading) {
    paras.shift() //remove the header paragraph
  }
  return paras
}

export async function confirmPotentialTimeChoice(potentials) {
  const opts = potentials.map((potential, i) => ({
    label: potential.start.toLocaleString(),
    value: i,
    start: potential.start,
    end: potential.end,
    text: potential.text,
    index: potential.index,
  }))
  clo(opts, `confirmPotentialTimeChoice opts`)
  const val = await chooseOption('Which of these looks right?', opts, opts[0].value)
  return opts[val]
}

export async function createEvent(title: string, range: { start: Date, end: Date }, config: any) {
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
  const calendarItem = await CalendarItem.create(
    title,
    range.start,
    range.end || null,
    'event',
    range.start === range.end,
  )
  clo(calendarItem, `createEvent: calendarItem`)
  const result = await Calendar.add(calendarItem)
  clo(result, `createEvent result after calendar add`)
  return result || null
}

export async function processTimeLines(block, config) {
  const timeLines = []
  try {
    for (let i = 0; i < block.length; i++) {
      const line = block[i]
      const potentials = Calendar.parseDateText(line.content) //returns {start: Date, end: Date}
      clo(potentials, `processTimeLines: potentials for "${line.content}"`)
      if (potentials.length > 0) {
        let chosen = potentials[0]
        if (potentials.length > 1) {
          if (config?.confirm) {
            chosen = await confirmPotentialTimeChoice(potentials)
          }
        }
        // Calendar.parseDateText = [{"start":"2022-06-24T13:00:00.000Z","end":"2022-06-24T13:00:00.000Z","text":"friday at 8","index":0}]
        const revisedLine = line.content
          .replace(chosen.text || '', '')
          .replace(/\s{2,}/g, ' ')
          .trim()
        let event = await createEvent(revisedLine, chosen, config)
        if (event && event.id) {
          log(pluginJson, `created event ${event.title}`)
          event = await Calendar.eventByID(event.id)
          clo(event, `processTimeLines event=`)
          const editedLink = event.calendarItemLink.replace(event.title, ``)
          line.content = `${line.content.trim()} ${editedLink || ''}`
          timeLines.push({ time: chosen, paragraph: line, event })
          log(pluginJson, `processTimeLines timeLines.length=${timeLines.length}`)
        }
      } else {
        // do nothing with this line?
        log(pluginJson, `processTimeLines no times found for "${line.content}"`)
      }
      // confirmPotentialTimeChoices()
      // CreateEvents() // + tag created events
    }
    log(pluginJson, `processTimeLines RETURNING timeLines.length=${timeLines.length}`)
    clo(timeLines, `processTimeLines: timeLines`)
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
    if (Editor?.note) {
      const config = getPluginSettings()
      config.confirm = confirm === 'yes'
      const headingPara = heading !== '' ? findHeading(Editor.note, heading) : await chooseTheHeading(Editor.note)
      clo(headingPara, 'headingPara')
      const paragraphsBlock = getBlockUnderHeading(Editor.note, headingPara)
      if (paragraphsBlock.length) {
        const timeLines = await processTimeLines(paragraphsBlock)
        if (timeLines.length) {
          const paras = timeLines.map((timeLine) => timeLine.paragraph)
          Editor.updateParagraphs(paras)
        } else {
          logError(pluginJson, `No time lines found under heading: ${heading}`)
        }
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
