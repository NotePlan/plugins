// @flow

/**
 * WHERE AM I?
 * TODO: update docs for limittotags, presets
 * impolement limitToTags[] but make it a textfilter regex
 */
import {
  differenceInCalendarDays,
  endOfDay,
  startOfDay,
  eachMinuteOfInterval,
  formatISO9075,
  addMinutes,
} from 'date-fns'
import { getEventsForDay, type HourMinObj, listDaysEvents } from '../../jgclark.EventHelpers/src/eventsToNotes'
import { timeBlocksToCalendar } from '../../jgclark.EventHelpers/src/timeblocks'
import {
  toLocaleTime,
  getTodaysDateUnhyphenated,
  dateStringFromCalendarFilename,
  removeDateTags,
  toISODateString,
  todaysDateISOString,
} from '../../helpers/dateTime'
import { getTasksByType } from '../../dwertheimer.TaskAutomations/src/taskHelpers'
import { sortListBy } from '../../helpers/sorting'
import { showMessage, chooseOption } from '../../helpers/userInput'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import { isTimeBlockLine, getTimeBlockString } from '../../helpers/timeblocks'
import { calcSmartPrependPoint } from '../../helpers/paragraph'
import { logAllPropertyNames, getAllPropertyNames, JSP } from '../../helpers/dev'
import {
  createIntervalMap,
  getBlankDayMap,
  blockTimeFor,
  removeDateTagsAndToday,
  attachTimeblockTag,
  createTimeBlockLine,
  getTimedEntries,
  getTimeStringFromDate,
  blockOutEvents,
  removeDateTagsFromArray,
  getTimeBlockTimesForEvents,
  makeAllItemsTodos,
  keepTodayPortionOnly,
  includeTasksWithPatterns,
  excludeTasksWithPatterns,
} from './timeblocking-helpers'
import { getPresetOptions, setConfigForPreset } from './presets'
import { getTimeBlockingDefaults, validateTimeBlockConfig } from './config'
import type { IntervalMap, TimeBlockDefaults, PartialCalendarItem, EditorOrNote } from './timeblocking-flow-types'

const PLUGIN_ID = 'autoTimeBlocking'

/* TCalendarItem is a type for the calendar items:
    title: string,
    date: Date,
    endDate: Date | void,
    type: CalenderItemType,
    isAllDay?: boolean,
    calendar?: string,
    isCompleted ?: boolean,
    notes ?: string,
    url?: string,
    availability?: AvailabilityType 0=busy; 1=free; 2=tentative; 3=unavailable 
    // NOTE: MIN NP VERSION NEEDS TO BE 3.3 TO USE AVAILABILITY
  ): TCalendarItem, 
*/

export async function getConfig(): Promise<{ [key: string]: any }> {
  const defaultConfig = getTimeBlockingDefaults()
  // $FlowIgnore
  const config = await getOrMakeConfigurationSection(
    PLUGIN_ID,
    `${PLUGIN_ID}: ${JSON.stringify(defaultConfig, null, 2)},\n`,
  )
  try {
    // $FlowIgnore
    validateTimeBlockConfig(config)
    // $FlowIgnore
    return config
  } catch (error) {
    showMessage(error)
    return defaultConfig
  }
}

// $FlowIgnore
const editorOrNote: EditorOrNote = (note: EditorOrNote) => (Editor.filename === note?.filename || !note ? Editor : note)

async function insertContentUnderHeading(destNote: TNote, headingToFind: string, parasAsText: string) {
  let insertionIndex = 1 // top of note by default
  //   console.log(`insertionIndex:${insertionIndex}`)
  for (let i = 0; i < destNote.paragraphs.length; i++) {
    const p = destNote.paragraphs[i]
    if (p.content.trim() === headingToFind && p.type === 'title') {
      insertionIndex = i + 1
      break
    }
  }
  // $FlowIgnore
  await editorOrNote(destNote).insertParagraph(parasAsText, insertionIndex, 'text')
}

export async function deleteParagraphsContainingString(destNote: TNote, timeBlockTag: string): Promise<void> {
  const destNoteParas = destNote.paragraphs
  const parasToDelete = []
  for (let i = 0; i < destNoteParas.length; i++) {
    const p = destNoteParas[i]
    if (new RegExp(timeBlockTag, 'gm').test(p.content)) {
      parasToDelete.push(p)
    }
  }
  if (parasToDelete.length > 0) {
    destNote.removeParagraphs(parasToDelete)
  }
}

/**
 * Get linked items from the references section (.backlinks)
 * @param { note | null} pNote
 * @returns
 * Backlinks format: {"type":"note","content":"_Testing scheduled sweeping","rawContent":"_Testing scheduled sweeping","prefix":"","lineIndex":0,"heading":"","headingLevel":0,"isRecurring":0,"indents":0,"filename":"zDELETEME/Test scheduled.md","noteType":"Notes","linkedNoteTitles":[],"subItems":[{},{},{},{}]}
 * backlinks[0].subItems[0] =JSLog: {"type":"open","content":"scheduled for 10/4 using app >today","rawContent":"* scheduled for 10/4 using app
 * ","prefix":"* ","contentRange":{},"lineIndex":2,"date":"2021-11-07T07:00:00.000Z","heading":"_Testing scheduled sweeping","headingRange":{},"headingLevel":1,"isRecurring":0,"indents":0,"filename":"zDELETEME/Test scheduled.md","noteType":"Notes","linkedNoteTitles":[],"subItems":[]}
 */
function getTodaysReferences(pNote: TNote | null = null): Array<TParagraph> {
  const note = pNote || Editor.note
  if (note) {
    const backlinks = [...(note.backlinks || {})] // an array of notes which link to this note

    const todayParas = []
    backlinks.forEach((link, i) => {
      // $FlowIgnore
      const subItems = link.subItems
      subItems.forEach((subItem, j) => {
        todayParas.push(subItem)
      })
    })
    return todayParas
  } else {
    console.log(`timeblocking could not open Note`)
    return []
  }
}

async function insertItemsIntoNote(note, list, config) {
  const { timeBlockHeading } = config
  if (list && list.length > 0 && note) {
    // $FlowIgnore
    await insertContentUnderHeading(note, timeBlockHeading, list.join('\n'))
  } else {
    await showMessage('No >today tasks or work hours left')
  }
}

/**
 * Scan note for user-entered timeblocks and return them as an array of Calendar Items
 * @param {*} note
 * @param {*} defaultDuration
 * @returns
 */
function getExistingTimeBlocksFromNoteAsEvents(note: TEditor | TNote, defaultDuration): Array<PartialCalendarItem> {
  const timeBlocksAsEvents = []
  note.paragraphs.forEach((p) => {
    const timeblockDateRangePotentials = Calendar.parseDateText(p.content)
    if (timeblockDateRangePotentials?.length) {
      const e = timeblockDateRangePotentials[0] //use Noteplan/Chrono's best guess
      const eventInfo = p.content.replace(getTimeBlockString(p.content), '').trim()
      timeBlocksAsEvents.push({
        title: eventInfo,
        date: e.start,
        endDate: e.end !== e.start ? e.end : addMinutes(e.start, defaultDuration),
        type: 'event',
        availability: 0,
      })
    }
  })
  return timeBlocksAsEvents
}

async function getPopulatedTimeMapForToday(
  dateStr: string,
  intervalMins: number,
  config: { [key: string]: any },
): Promise<IntervalMap> {
  // const todayEvents = await Calendar.eventsToday()
  const eventsArray: Array<TCalendarItem> = await getEventsForDay(dateStr)
  const eventsWithStartAndEnd = getTimedEntries(eventsArray)
  let eventsScheduledForToday = keepTodayPortionOnly(eventsWithStartAndEnd)
  if (Editor) {
    const userEnteredTimeblocks = getExistingTimeBlocksFromNoteAsEvents(Editor, config.defaultDuration)
    eventsScheduledForToday = [...userEnteredTimeblocks, ...eventsScheduledForToday]
  }
  const blankDayMap = getBlankDayMap(parseInt(intervalMins))
  // $FlowFixMe - [prop-missing] and [incompatible-variance]
  const eventMap = blockOutEvents(eventsScheduledForToday, blankDayMap, config)
  return eventMap
}

export async function deleteCalendarEventsWithTag(tag: string, dateStr: string): Promise<void> {
  let dateString = dateStr
  if (!dateStr) {
    dateString = Editor.filename ? dateStringFromCalendarFilename(Editor.filename) : null
  }
  if (dateString) {
    const eventsArray: Array<TCalendarItem> = await getEventsForDay(dateString)
    eventsArray.forEach((event) => {
      if (event.title.includes(tag)) {
        Calendar.remove(event)
      }
    })
  } else {
    showMessage('deleteCalendarEventsWithTag could not delete events')
  }
}

export async function createTimeBlocksForTodaysTasks(config: { [key: string]: any } = {}): Promise<?Array<string>> {
  const {
    timeBlockTag,
    intervalMins,
    insertIntoEditor,
    createCalendarEntries,
    passBackResults,
    deletePreviousCalendarEntries,
    eventEnteredOnCalTag,
    includeTasksWithText,
    excludeTasksWithText,
  } = config
  const date = getTodaysDateUnhyphenated()
  const note = Editor // placeholder. we may pass a note in future revs
  const dateStr = Editor.filename ? dateStringFromCalendarFilename(Editor.filename) : null

  if (dateStr && dateStr === date) {
    const backlinkParas = getTodaysReferences()
    let todosParagraphs = makeAllItemsTodos(backlinkParas) //some items may not be todos but we want to pretend they are and timeblock for them
    todosParagraphs = includeTasksWithText
      ? includeTasksWithPatterns(todosParagraphs, includeTasksWithText)
      : todosParagraphs
    todosParagraphs = excludeTasksWithText
      ? excludeTasksWithPatterns(todosParagraphs, excludeTasksWithText)
      : todosParagraphs
    const cleanTodayTodoParas = removeDateTagsFromArray(todosParagraphs)
    const tasksByType = cleanTodayTodoParas.length ? getTasksByType(cleanTodayTodoParas) : null // puts in object by type of task and enriches with sort info (like priority)
    if (deletePreviousCalendarEntries) {
      await deleteCalendarEventsWithTag(timeBlockTag, dateStr)
    }
    if (tasksByType && tasksByType['open'].length) {
      const sortedTodos = tasksByType['open'].length ? sortListBy(tasksByType['open'], '-priority') : []
      // $FlowIgnore
      await deleteParagraphsContainingString(editorOrNote(note), timeBlockTag) // Delete our timeblocks before scanning note for user-entered timeblocks
      // $FlowIgnore
      await deleteParagraphsContainingString(editorOrNote(note), eventEnteredOnCalTag) // Delete @jgclark timeblocks->calendar breadcrumbs also
      const calendarMapWithEvents = await getPopulatedTimeMapForToday(dateStr, intervalMins, config)
      const eventsToTimeblock = getTimeBlockTimesForEvents(calendarMapWithEvents, sortedTodos, config)
      const { timeBlockTextList } = eventsToTimeblock
      if (insertIntoEditor || createCalendarEntries) {
        // $FlowIgnore -- Delete any previous timeblocks we created
        await insertItemsIntoNote(editorOrNote(note), timeBlockTextList, config)
        if (createCalendarEntries) {
          await timeBlocksToCalendar() //using @jgclark's method for now
          if (!insertIntoEditor) {
            // If user didn't want the timeblocks inserted into the editor, then we delete them now that they're in calendar
            // $FlowIgnore
            await deleteParagraphsContainingString(editorOrNote(note), timeBlockTag)
          }
        }
      }
      return passBackResults ? timeBlockTextList : []
    }
  } else {
    await showMessage(`You need to be in Today's Calendar Note to use this function`)
  }
  return []
}

export async function insertTodosAsTimeblocks(note: TNote): Promise<void> {
  await Editor.openNoteByDate(new Date(), false) //open editor to today
  const config = await getConfig()
  if (config) {
    await createTimeBlocksForTodaysTasks(config)
  }
}

export async function insertTodosAsTimeblocksWithPresets(note: TNote): Promise<void> {
  await Editor.openNoteByDate(new Date(), false) //open editor to today
  let config = await getConfig()
  if (config) {
    if (config.presets && config.presets.length) {
      const options = getPresetOptions(config.presets)
      const presetIndex = await chooseOption('Choose an AutoTimeBlocking Preset:', options, -1)
      const overrides = config.presets[presetIndex]
      config = setConfigForPreset(config, overrides)
      try {
        validateTimeBlockConfig(config) //  check to make sure the overrides were valid
      } catch (error) {
        showMessage(error)
      }
      await createTimeBlocksForTodaysTasks(config)
    } else {
      await showMessage('No presets found. Please read docs.')
    }
  }
}
