// @flow

/**
 * WHERE AM I?
 * TODO: update docs for limittotags, presets
 *  * getTimeBlockingDefaults should read plugin.json and create the defaults
 *  * then validations should come from that file also
 *  * TODO: feedback if no items to timeblock
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
import { getTimedEntries, keepTodayPortionOnly } from '../../helpers/calendar'
import { getEventsForDay, writeTimeBlocksToCalendar } from '../../helpers/NPCalendar'
import { getParagraphBlock } from '../../jgclark.Filer/src/fileItems'
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
import { logAllPropertyNames, getAllPropertyNames, JSP, clo, log } from '../../helpers/dev'
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
  eliminateDuplicateParagraphs,
  type ExtendedParagraph,
} from './timeblocking-helpers'
import { getPresetOptions, setConfigForPreset } from './presets'
import { getTimeBlockingDefaults, validateTimeBlockConfig } from './config'
import type { IntervalMap, TimeBlockDefaults, PartialCalendarItem, EditorOrNote } from './timeblocking-flow-types'
import { checkNumber, checkObj, checkString, checkWithDefault } from '../../helpers/checkType'
import { catchError } from 'rxjs/operators'
import pluginJson from '../plugin.json'
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
      showMessage(
        `Plugin Settings ${error.message}\nRunning with default settings. You should probably open the plugin configuration dialog and fix the problem(s) listed above.`,
      )
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
  // console.log(`insertContentUnderHeading(${headingToFind}, ${parasAsText})`)
  const topOfNote = destNote.type === 'Calendar' ? 0 : 1
  let insertionIndex = topOfNote // top of note by default
  //   console.log(`insertionIndex:${insertionIndex}`)
  for (let i = 0; i < destNote.paragraphs.length; i++) {
    const p = destNote.paragraphs[i]
    if (p.content.trim().includes(headingToFind) && p.type === 'title') {
      insertionIndex = i + 1
      break
    }
  }
  const paraText =
    insertionIndex === topOfNote && headingToFind !== '' ? `## ${headingToFind}\n${parasAsText}\n` : parasAsText
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
function getTodaysReferences(pNote: TNote | null = null, config: { [key: string]: any }): Array<TParagraph> {
  log(pluginJson, `getTodaysReferences starting`)
  const note = pNote || Editor.note
  if (note == null) {
    console.log(`timeblocking could not open Note`)
    return []
  }

  const backlinks: Array<TParagraph> = [...note.backlinks] // an array of notes which link to this note
  log(pluginJson, `backlinks.length:${backlinks.length}`)

  // clo(backlinks, 'getTodaysReferences: backlinks')
  let todayParas = []
  backlinks.forEach((link, i) => {
    // $FlowIgnore Flow(prop-missing) -- subItems is not in Flow defs but is real
    const subItems = link.subItems
    subItems.forEach((subItem, j) => {
      subItem.title = link.content.replace('.md', '').replace('.txt', '')
      todayParas.push(subItem)
    })
  })

  // clo(todayParas, 'todayParas')
  // if (config.createSyncedCopies) {
  // Do not want to pick up the same task multiple times. In the syncedCopies section,
  // tasks will not match, because they have a time at the front plus the task name plus a link
  // someday maybe do the compare this way:
  // isAutoTimeBlockLine()
  log(
    pluginJson,
    `getTodaysReferences: Cannot search today's note for >today items when config.createSyncedCopies is on, because could be recursive`,
  )
  // } else {
  let todosInNote = findTodosInNote(note)
  if (todosInNote.length > 0) {
    log(pluginJson, `getTodaysReferences: todosInNote Found ${todosInNote.length} items in today's note. Adding them.`)
    // eliminate linked lines (for synced lines on the page)
    // because these should be in the references from other pages
    clo(todosInNote[0], 'todosInNote[0]')
    todosInNote = todosInNote.filter((todo) => !/\^[a-zA-Z0-9]{6}/.test(todo.content))
    todayParas = [...todayParas, ...todosInNote]
    clo(todayParas.length, 'todayParas')
  }
  // }
  // console.log(`getTodaysReferences note.filename=${note.filename} backlinks.length=${backlinks.length} todayParas.length=${todayParas.length}`)
  return todayParas
}

async function insertItemsIntoNote(
  note: TNote | TEditor,
  list: Array<string>,
  heading: string = '',
  shouldFold: boolean = false,
  config: { [string]: any },
) {
  if (list && list.length > 0 && note) {
    // $FlowIgnore
    log(pluginJson, `insertItemsIntoNote: items.length=${list.length}`)
    log(pluginJson, `insertItemsIntoNote: items[0]=${list[0] ?? ''}`)
    await insertContentUnderHeading(note, heading, list.join('\n'))
    // Fold the heading to hide the list
    if (shouldFold && heading !== '') {
      const thePara = note.paragraphs.find((p) => p.type == 'title' && p.content.includes(heading))
      if (thePara) {
        log(pluginJson, `insertItemsIntoNote: folding "${heading}"`)
        if (Editor.isFolded) {
          // make sure this command exists
          if (!Editor.isFolded(thePara)) {
            Editor.toggleFolding(thePara)
            log(pluginJson, `insertItemsIntoNote: folded heading "${heading}"`)
          }
        } else {
          thePara.content = `${String(heading)} …` // this was the old hack for folding
          await note.updateParagraph(thePara)
          note.content = note.content //FIXME: hoping for an API to do this so we don't have to force a redraw so it will fold the heading
        }
      } else {
        log(pluginJson, `insertItemsIntoNote could not find heading: ${heading}`)
      }
    }
  } else {
    if (!config.passBackResults) {
      await showMessage(
        'No work hours left. Check config/presents. Also look for calendar events which may have blocked off the rest of the day.',
      )
    }
  }
}

/**
 * Scan note for user-entered timeblocks and return them as an array of Calendar Items
 * @param {*} note
 * @param {*} defaultDuration
 * @returns
 */
function getExistingTimeBlocksFromNoteAsEvents(
  note: TEditor | TNote,
  defaultDuration: number,
): Array<PartialCalendarItem> {
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

async function getPopulatedTimeMapForToday(
  dateStr: string,
  intervalMins: number,
  config: { [string]: mixed },
): Promise<IntervalMap> {
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

export async function deleteEntireBlock(
  note: TNote | Editor,
  para: TParagraph,
  useExtendedBlockDefinition: boolean = false,
  keepTitle: boolean = true,
) {
  const paraBlock: Array<TParagraph> = getParagraphBlock(note, para.lineIndex)
  log(pluginJson, `deleteEntireBlock: Removing ${paraBlock.length} items under ${para.content}`)
  keepTitle ? paraBlock.shift() : null
  if (paraBlock.length > 0) {
    note.removeParagraphs(paraBlock) //seems to not work if it's a note, not Editor
    // note.updateParagraphs(paraBlock)
  }
}

export async function deleteBlockUnderTitle(
  note: TNote | Editor,
  title: string,
  useExtendedBlockDefinition: boolean = false,
) {
  // log(pluginJson, `deleteBlockUnderTitle: ${note.title} Remove items under title: "${title}"`)
  const para = note.paragraphs.find((p) => p.type == 'title' && p.content.includes(title))
  let paraBlock = []
  // clo(para, `deleteBlockUnderTitle para=`)
  if (para && para.lineIndex != null) {
    deleteEntireBlock(note, para, useExtendedBlockDefinition, true)
  } else {
    console.log(`deleteBlockUnderTitle: did not find title: "${title}"`)
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

/**
 * Make copies of all OPEN task references as Synced Lines and return them as an array of strings
 * @param {*} allTodayParagraphs
 * @returns array of strings with the sync codes attached
 */
export function getSyncedCopiesAsList(allTodayParagraphs: Array<TParagraph>): Array<string> {
  // clo(allTodayParagraphs, 'getSyncedCopiesAsList::allTodayParagraphs')
  let syncedLinesList = []
  allTodayParagraphs.forEach((p) => {
    if (p.type == 'open') {
      p.note?.addBlockID(p)
      p.note?.updateParagraph(p)
      syncedLinesList.push(p.rawContent)
    }
  })
  // timeBlockTextList.forEach((line) => {
  //   syncedLinesList.push(line)
  //   console.log(`getSyncedCopiesAsList::line=${line}:`)
  //   const segments = line.split(' ')
  //   if (segments.length > 2) {
  //     let content = line.replace(`${segments[0]} ${segments[1]} `, '') // replace time at the front
  //     content = content.replace(/( \[.*\]\(.*\).*)/, '') // replace pretty link
  //     content = content.replace(/( \[\[.*\]\].*)/, '') // replace wiki link
  //     console.log(`getSyncedCopiesAsList::content=${content}:`)
  //     syncedLinesList.push(content)
  //     // search in paragraphs
  //   }
  // const content = line.slice()
  // p?.note?.addBlockID(p)
  // p?.note?.updateParagraph(p)
  // syncedLinesList.push(p.content)
  // })
  return syncedLinesList
}

function getFullParagraphsCorrespondingToSortList(
  paragraphs: Array<TParagraph>,
  sortList: Array<{ [string]: any }>,
): Array<TParagraph> {
  let retP = []
  if (sortList && paragraphs) {
    retP = sortList.map((s) => {
      const found = paragraphs.find((p, i) => {
        return removeDateTagsAndToday(p.rawContent) === s.raw
      })
      return found
    })
  }
  // $FlowIgnore
  return retP ?? []
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
  log(pluginJson, `createTimeBlocksForTodaysTasks hypenatedDate=${hypenatedDate}`)
  const date = getTodaysDateUnhyphenated()
  log(pluginJson, `createTimeBlocksForTodaysTasks date=${date}`)
  const note = Editor // placeholder. we may pass a note in future revs
  const dateStr = Editor.filename ? getDateStringFromCalendarFilename(Editor.filename) : null
  log(pluginJson, `createTimeBlocksForTodaysTasks dateStr=${dateStr}`)
  if (dateStr && dateStr === date) {
    log(pluginJson, `createTimeBlocksForTodaysTasks dateStr=${dateStr} is today - we are inside`)
    const backlinkParas = getTodaysReferences(Editor.note, config)
    console.log(`Found ${backlinkParas.length} backlinks+today-note items (may include completed items)`)
    let undupedBackLinkParas = eliminateDuplicateParagraphs(backlinkParas)
    console.log(`Found ${undupedBackLinkParas.length} undupedBackLinkParas after duplicate elimination`)
    let todosParagraphs: Array<TParagraph> = makeAllItemsTodos(undupedBackLinkParas) //some items may not be todos but we want to pretend they are and timeblock for them
    todosParagraphs = includeTasksWithText?.length
      ? includeTasksWithPatterns(todosParagraphs, includeTasksWithText)
      : todosParagraphs
    console.log(`After includeTasksWithText, ${todosParagraphs.length} potential items`)
    todosParagraphs = excludeTasksWithText?.length
      ? excludeTasksWithPatterns(todosParagraphs, excludeTasksWithText)
      : todosParagraphs
    console.log(`After excludeTasksWithText, ${todosParagraphs.length} potential items`)
    const cleanTodayTodoParas = removeDateTagsFromArray(todosParagraphs)
    console.log(`After removeDateTagsFromArray, ${cleanTodayTodoParas.length} potential items`)
    const todosWithLinksMaybe = appendLinkIfNecessary(cleanTodayTodoParas, config)
    console.log(
      `After appendLinkIfNecessary, ${
        todosWithLinksMaybe?.length ?? 0
      } potential items (may include headings or completed)`,
    )
    const tasksByType = todosWithLinksMaybe.length ? getTasksByType(todosWithLinksMaybe, true) : null // puts in object by type of task and enriches with sort info (like priority)
    console.log(`After getTasksByType, ${tasksByType?.open.length ?? 0} OPEN items`)
    if (deletePreviousCalendarEntries) {
      await deleteCalendarEventsWithTag(timeBlockTag, dateStr)
    }
    console.log(`After deleteCalendarEventsWithTag, ${tasksByType?.open.length ?? 0} open items (still)`)
    if (tasksByType && tasksByType['open'].length) {
      const sortedTodos = tasksByType['open'].length ? sortListBy(tasksByType['open'], '-priority') : []
      console.log(`After sortListBy, ${sortedTodos.length} open items`)
      // $FlowIgnore
      await deleteParagraphsContainingString(editorOrNote(note), timeBlockTag) // Delete our timeblocks before scanning note for user-entered timeblocks
      // $FlowIgnore
      await deleteParagraphsContainingString(editorOrNote(note), eventEnteredOnCalTag) // Delete @jgclark timeblocks->calendar breadcrumbs also
      const calendarMapWithEvents = await getPopulatedTimeMapForToday(dateStr, intervalMins, config)
      console.log(`After getPopulatedTimeMapForToday, ${calendarMapWithEvents.length} timeMap slots`)
      const eventsToTimeblock = getTimeBlockTimesForEvents(calendarMapWithEvents, sortedTodos, config)
      let { timeBlockTextList, blockList } = eventsToTimeblock
      console.log(
        `After getTimeBlockTimesForEvents, blocks:\n\tblockList.length=${blockList.length} \n\ttimeBlockTextList.length=${timeBlockTextList.length}`,
      )
      console.log(
        `After getTimeBlockTimesForEvents, insertIntoEditor=${insertIntoEditor} createCalendarEntries=${createCalendarEntries}`,
      )
      if (insertIntoEditor || createCalendarEntries) {
        console.log(
          `After getTimeBlockTimesForEvents, config.createSyncedCopies=${config.createSyncedCopies} todosWithLinksMaybe.length=${todosWithLinksMaybe.length}`,
        )

        console.log(`About to insert ${timeBlockTextList?.length} timeblock items into note`)
        // $FlowIgnore -- Delete any previous timeblocks we created
        await insertItemsIntoNote(
          /*  editorOrNote(note), */
          Editor,
          timeBlockTextList,
          config.timeBlockHeading,
          config.foldTimeBlockHeading,
          config,
        )
        console.log(`\n\nAUTOTIMEBLOCKING SUMMARY:\n\n`)
        console.log(`Found ${undupedBackLinkParas.length} undupedBackLinkParas after duplicate elimination`)
        console.log(`After cleaning, ${tasksByType?.open?.length ?? 0} open items`)

        log(
          pluginJson,
          `createTimeBlocksForTodaysTasks inserted ${timeBlockTextList.length} items:\n ${timeBlockTextList.join(
            '\n',
          )}`,
        )
        if (createCalendarEntries) {
          console.log(`About to create calendar entries`)
          await writeTimeBlocksToCalendar(getEventsConfig(config), Editor) //using @jgclark's method for now
          if (!insertIntoEditor) {
            // If user didn't want the timeblocks inserted into the editor, then we delete them now that they're in calendar
            // $FlowIgnore
            await deleteParagraphsContainingString(editorOrNote(note), timeBlockTag)
          }
        }

        if (config.createSyncedCopies && todosWithLinksMaybe?.length) {
          console.log(
            `createSyncedCopies is true, so we will create synced copies of the todosParagraphs: ${todosParagraphs.length} timeblocks`,
          )
          const sortedParas = getFullParagraphsCorrespondingToSortList(todosParagraphs, sortedTodos)
          const syncedList = getSyncedCopiesAsList(sortedParas)
          console.log(`Deleting previous synced list heading and content`)
          if (syncedList.length && Editor) deleteBlockUnderTitle(Editor, String(config.syncedCopiesTitle), false)
          console.log(`Inserting synced list content: ${syncedList.length} items`)
          // $FlowIgnore

          await insertItemsIntoNote(
            /* editorOrNote(note), */
            Editor,
            syncedList,
            config.syncedCopiesTitle,
            config.foldSyncedCopiesHeading,
            config,
          )
        }
      }
      return passBackResults ? timeBlockTextList : []
    } else {
      console.log('No todos/references marked for >today')
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

/**
 * Insert todos marked >today into the editor
 * (entry point for /atb)
 * @param {*} note
 */
export async function insertTodosAsTimeblocks(note: TNote): Promise<void> {
  console.log(`====== /atb =======\nStarting insertTodosAsTimeblocks`)
  if (!editorIsOpenToToday()) await Editor.openNoteByDate(new Date(), false) //open editor to today
  const config = await getConfig()
  clo(config, 'atb config')
  if (config) {
    console.log(`Config found. Calling createTimeBlocksForTodaysTasks`)
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
