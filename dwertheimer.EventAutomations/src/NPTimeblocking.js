// @flow

/**
 * WHERE AM I?
 * TODO: update docs for limittotags, presets
 *  * getTimeBlockingDefaults should read plugin.json and create the defaults
 *  * then validations should come from that file also
 *  * TODO: feedback if no items to timeblock
 * impolement limitToTags[] but make it a textfilter regex
 */
import { differenceInCalendarDays, endOfDay, startOfDay, eachMinuteOfInterval, formatISO9075, addMinutes } from 'date-fns'
import { getTimedEntries, keepTodayPortionOnly } from '../../helpers/calendar'
import { getEventsForDay, writeTimeBlocksToCalendar } from '../../helpers/NPCalendar'
import {
  getDateStringFromCalendarFilename,
  type HourMinObj,
  getDateObjFromDateTimeString,
  getTimeStringFromDate,
  getTodaysDateHyphenated,
  getTodaysDateUnhyphenated,
  removeDateTags,
  removeDateTagsAndToday,
  todaysDateISOString,
  toISODateString,
  toLocaleTime,
} from '../../helpers/dateTime'
import { getTasksByType } from '../../dwertheimer.TaskAutomations/src/taskHelpers'
import { sortListBy } from '../../helpers/sorting'
import { showMessage, chooseOption } from '../../helpers/userInput'
import { isTimeBlockLine, getTimeBlockString } from '../../helpers/timeblocks'
import { calcSmartPrependPoint } from '../../helpers/paragraph'
import { logAllPropertyNames, getAllPropertyNames, JSP, clo } from '../../helpers/dev'
import {
  attachTimeblockTag,
  blockOutEvents,
  blockTimeFor,
  createIntervalMap,
  createTimeBlockLine,
  excludeTasksWithPatterns,
  getBlankDayMap,
  getTimeBlockTimesForEvents,
  includeTasksWithPatterns,
  makeAllItemsTodos,
  removeDateTagsFromArray,
  appendLinkIfNecessary,
  findTodosInNote,
  type ExtendedParagraph,
} from './timeblocking-helpers'
import { getPresetOptions, setConfigForPreset } from './presets'
import { getTimeBlockingDefaults, validateTimeBlockConfig } from './config'
import type { IntervalMap, TimeBlockDefaults, PartialCalendarItem, EditorOrNote } from './timeblocking-flow-types'
import { checkNumber, checkObj, checkString, checkWithDefault } from '../../helpers/checkType'
import { catchError } from 'rxjs/operators'

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

export async function getConfig(): Promise<{ [string]: [mixed] }> {
  const defaultConfig = getTimeBlockingDefaults()
  const config = DataStore.settings
  if (Object.keys(config).length > 0) {
    try {
      // $FlowIgnore
      validateTimeBlockConfig(config)
      return config
    } catch (error) {
      showMessage(`Plugin Settings ${error.message}\nRunning with default settings. You should probably open the plugin configuration dialog and fix the problem(s) listed above.`)
    }
  }
  return defaultConfig
}

// $FlowIgnore
const editorOrNote: EditorOrNote = (note: EditorOrNote) => (Editor.filename === note?.filename || !note ? Editor : note)

const editorIsOpenToToday = () => {
  const fileName = Editor.filename
  if (fileName == null) {
    return false
  }
  return getDateStringFromCalendarFilename(fileName) === getTodaysDateUnhyphenated()
}

async function insertContentUnderHeading(destNote: TNote, headingToFind: string, parasAsText: string) {
  const topOfNote = destNote.type === 'Calendar' ? 0 : 1
  let insertionIndex = topOfNote // top of note by default
  //   console.log(`insertionIndex:${insertionIndex}`)
  for (let i = 0; i < destNote.paragraphs.length; i++) {
    const p = destNote.paragraphs[i]
    if (p.content.trim() === headingToFind && p.type === 'title') {
      insertionIndex = i + 1
      break
    }
  }
  const paraText = insertionIndex === topOfNote && headingToFind !== '' ? `## ${headingToFind}\n${parasAsText}\n` : parasAsText
  // $FlowIgnore
  await editorOrNote(destNote).insertParagraph(paraText, insertionIndex, 'text')
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
function getTodaysReferences(pNote: TNote | null = null, config): Array<TParagraph> {
  const note = pNote || Editor.note
  if (note == null) {
    console.log(`timeblocking could not open Note`)
    return []
  }

  const backlinks: Array<TParagraph> = [...note.backlinks] // an array of notes which link to this note

  let todayParas = []
  backlinks.forEach((link, i) => {
    const subItems = link.children()
    subItems.forEach((subItem, j) => {
      subItem.title = link.content.replace('.md', '').replace('.txt', '')
      todayParas.push(subItem)
    })
  })
  // FIX CLO to work with backlinks

  clo(todayParas, 'todayParas')
  findTodosInNote(note).forEach((link, i) => {
    clo(link, `findTodosInNote[${i}]`)
  })
  todayParas = [...todayParas, ...findTodosInNote(note)]
  // console.log(`getTodaysReferences note.filename=${note.filename} backlinks.length=${backlinks.length} todayParas.length=${todayParas.length}`)
  return todayParas
}

async function insertItemsIntoNote(note, list, config) {
  const { timeBlockHeading } = config
  if (list && list.length > 0 && note) {
    // $FlowIgnore
    await insertContentUnderHeading(note, timeBlockHeading, list.join('\n'))
  } else {
    if (!config.passBackResults) {
      await showMessage('No work hours left. Check config/presents.')
    }
  }
}

/**
 * Scan note for user-entered timeblocks and return them as an array of Calendar Items
 * @param {*} note
 * @param {*} defaultDuration
 * @returns
 */
function getExistingTimeBlocksFromNoteAsEvents(note: TEditor | TNote, defaultDuration: number): Array<PartialCalendarItem> {
  const timeBlocksAsEvents = []
  note.paragraphs.forEach((p) => {
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
  })
  return timeBlocksAsEvents
}

async function getPopulatedTimeMapForToday(dateStr: string, intervalMins: number, config: { [string]: mixed }): Promise<IntervalMap> {
  // const todayEvents = await Calendar.eventsToday()
  const eventsArray: Array<TCalendarItem> = await getEventsForDay(dateStr)
  const eventsWithStartAndEnd = getTimedEntries(eventsArray)
  let eventsScheduledForToday = keepTodayPortionOnly(eventsWithStartAndEnd)
  if (Editor) {
    let duration = checkWithDefault(checkNumber, 60)
    const userEnteredTimeblocks = getExistingTimeBlocksFromNoteAsEvents(Editor, duration)
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
    dateString = Editor.filename ? getDateStringFromCalendarFilename(Editor.filename) : null
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

type TEventConfig = {
  confirmEventCreation: boolean,
  processedTagName: string,
  calendarToWriteTo: string,
}
function getEventsConfig(atbConfig: { [string]: mixed }): TEventConfig {
  const checkedConfig: {
    eventEnteredOnCalTag: string,
    calendarToWriteTo: string,
    ...
  } = checkWithDefault(
    checkObj({
      eventEnteredOnCalTag: checkString,
      calendarToWriteTo: checkString,
    }),
    {
      eventEnteredOnCalTag: '#event_created',
      calendarToWriteTo: '',
    },
  )

  const eventsConfig = {
    confirmEventCreation: false,
    processedTagName: checkedConfig.eventEnteredOnCalTag,
    calendarToWriteTo: checkedConfig.calendarToWriteTo,
  }

  return eventsConfig
}

export async function createTimeBlocksForTodaysTasks(config: { [key: string]: mixed } = {}): Promise<?Array<string>> {
  // console.log(`Starting createTimeBlocksForTodaysTasks. Time is ${new Date().toLocaleTimeString()}`)
  // console.log(`config is: ${JSON.stringify(config, null, 2)}`)
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
  const hypenatedDate = getTodaysDateHyphenated()
  const date = getTodaysDateUnhyphenated()
  const note = Editor // placeholder. we may pass a note in future revs
  const dateStr = Editor.filename ? getDateStringFromCalendarFilename(Editor.filename) : null
  if (dateStr && dateStr === date) {
    const backlinkParas = getTodaysReferences(Editor.note, config)
    // console.log(`Found ${backlinkParas.length} backlinks+today-note items (may include completed items)`)
    let todosParagraphs: Array<TParagraph> = makeAllItemsTodos(backlinkParas) //some items may not be todos but we want to pretend they are and timeblock for them
    todosParagraphs = includeTasksWithText?.length ? includeTasksWithPatterns(todosParagraphs, includeTasksWithText) : todosParagraphs
    // console.log(`After includeTasksWithText, ${todosParagraphs.length} potential items`)
    todosParagraphs = excludeTasksWithText?.length ? excludeTasksWithPatterns(todosParagraphs, excludeTasksWithText) : todosParagraphs
    // console.log(`After excludeTasksWithText, ${todosParagraphs.length} potential items`)
    const cleanTodayTodoParas = removeDateTagsFromArray(todosParagraphs)
    // console.log(`After removeDateTagsFromArray, ${cleanTodayTodoParas.length} potential items`)
    const todosWithLinksMaybe = appendLinkIfNecessary(cleanTodayTodoParas, config)
    // console.log(`After appendLinkIfNecessary, ${todosWithLinksMaybe?.length ?? 0} potential items (may include headings or completed)`)
    const tasksByType = todosWithLinksMaybe.length ? getTasksByType(todosWithLinksMaybe, true) : null // puts in object by type of task and enriches with sort info (like priority)
    // console.log(`After getTasksByType, ${tasksByType?.open.length ?? 0} OPEN items`)
    if (deletePreviousCalendarEntries) {
      await deleteCalendarEventsWithTag(timeBlockTag, dateStr)
    }
    // console.log(`After deleteCalendarEventsWithTag, ${tasksByType?.open.length ?? 0} open items (still)`)
    if (tasksByType && tasksByType['open'].length) {
      const sortedTodos = tasksByType['open'].length ? sortListBy(tasksByType['open'], '-priority') : []
      // console.log(`After sortListBy, ${sortedTodos.length} open items`)
      // $FlowIgnore
      await deleteParagraphsContainingString(editorOrNote(note), timeBlockTag) // Delete our timeblocks before scanning note for user-entered timeblocks
      // $FlowIgnore
      await deleteParagraphsContainingString(editorOrNote(note), eventEnteredOnCalTag) // Delete @jgclark timeblocks->calendar breadcrumbs also
      const calendarMapWithEvents = await getPopulatedTimeMapForToday(dateStr, intervalMins, config)
      // console.log(`After getPopulatedTimeMapForToday, ${calendarMapWithEvents.length} timeMap slots`)
      const eventsToTimeblock = getTimeBlockTimesForEvents(calendarMapWithEvents, sortedTodos, config)
      const { timeBlockTextList, blockList } = eventsToTimeblock
      // console.log(`After getTimeBlockTimesForEvents, blocks:\n\tblockList.length=${blockList.length} \n\ttimeBlockTextList.length=${timeBlockTextList.length}`)
      if (insertIntoEditor || createCalendarEntries) {
        // console.log(`About to insert ${timeBlockTextList.length} timeblock items into note`)
        // $FlowIgnore -- Delete any previous timeblocks we created
        await insertItemsIntoNote(editorOrNote(note), timeBlockTextList, config)
        if (createCalendarEntries) {
          // console.log(`About to create calendar entries`)
          await writeTimeBlocksToCalendar(getEventsConfig(config), Editor) //using @jgclark's method for now
          if (!insertIntoEditor) {
            // If user didn't want the timeblocks inserted into the editor, then we delete them now that they're in calendar
            // $FlowIgnore
            await deleteParagraphsContainingString(editorOrNote(note), timeBlockTag)
          }
        }
      }
      return passBackResults ? timeBlockTextList : []
    } else {
      // console.log('No todos/references marked for >today')
      if (!passBackResults) {
        await showMessage(`No todos/references marked for >today`)
      }
    }
  } else {
    if (!passBackResults) {
      // console.log(`You need to be in Today's Calendar Note to use this function`)
      await showMessage(`You need to be in Today's Calendar Note to use this function`)
    }
  }
  return []
}

export async function insertTodosAsTimeblocks(note: TNote): Promise<void> {
  // console.log(`====== /atb =======\nStarting insertTodosAsTimeblocks`)
  if (!editorIsOpenToToday()) await Editor.openNoteByDate(new Date(), false) //open editor to today
  const config = await getConfig()
  if (config) {
    // console.log(`Config found. Calling createTimeBlocksForTodaysTasks`)
    await createTimeBlocksForTodaysTasks(config)
  } else {
    // console.log(`insertTodosAsTimeblocks: stopping after config create`)
  }
}

export async function insertTodosAsTimeblocksWithPresets(note: TNote): Promise<void> {
  // console.log(`====== /atbp =======\nStarting insertTodosAsTimeblocksWithPresets`)
  if (!editorIsOpenToToday()) await Editor.openNoteByDate(new Date(), false) //open editor to today
  let config = await getConfig()
  if (config) {
    // console.log(`Config found. Checking for presets`)
    if (config.presets && config.presets.length) {
      const options = getPresetOptions(config.presets)
      const presetIndex = await chooseOption('Choose an AutoTimeBlocking Preset:', options, -1)
      const overrides = config.presets[presetIndex]
      // console.log(`Utilizing preset: ${JSON.stringify(config.presets[presetIndex])}`)
      config = setConfigForPreset(config, overrides)
      try {
        validateTimeBlockConfig(config) //  check to make sure the overrides were valid
      } catch (error) {
        showMessage(error)
        // console.log(`insertTodosAsTimeblocksWithPresets: invalid config: ${error}`)
      }
      await createTimeBlocksForTodaysTasks(config)
    } else {
      await showMessage('No presets found. Please read docs.')
    }
  } else {
    // console.log(`insertTodosAsTimeblocksWithPresets: no config`)
  }
}
