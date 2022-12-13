// @flow

/**
 * WHERE AM I?
 * TODO: update docs for limittotags, presets
 * TODO: timeblocks need the filter DataStore.preference("timeblockTextMustContainString")
 *  * getTimeBlockingDefaults should read plugin.json and create the defaults
 *  * then validations should come from that file also
 *  * TODO: feedback if no items to timeblock
 * impolement limitToTags[] but make it a textfilter regex
 */
import { addMinutes } from 'date-fns'
import pluginJson from '../plugin.json'
import type { AutoTimeBlockingConfig } from './config'
import {
  blockOutEvents,
  excludeTasksWithPatterns,
  getBlankDayMap,
  getTimeBlockTimesForEvents,
  includeTasksWithPatterns,
  makeAllItemsTodos,
  removeDateTagsFromArray,
  appendLinkIfNecessary,
  getFullParagraphsCorrespondingToSortList,
} from './timeblocking-helpers'
import { getTimeBlockingDefaults, validateAutoTimeBlockingConfig } from './config'
import { getPresetOptions, setConfigForPreset } from './presets'
import type { IntervalMap, PartialCalendarItem } from './timeblocking-flow-types'
import { getTimedEntries, keepTodayPortionOnly } from '@helpers/calendar'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import { getEventsForDay, writeTimeBlocksToCalendar, checkOrGetCalendar } from '@helpers/NPCalendar'
import { getDateStringFromCalendarFilename, getTodaysDateHyphenated, getTodaysDateUnhyphenated } from '@helpers/dateTime'
import { getTasksByType, sortListBy, isTask } from '@helpers/sorting'
import { showMessage, chooseOption } from '@helpers/userInput'
import { getTimeBlockString, isTimeBlockLine } from '@helpers/timeblocks'
import { JSP, clo, log, logError, logWarn, logDebug } from '@helpers/dev'
import { checkNumber, checkWithDefault } from '@helpers/checkType'
import { getSyncedCopiesAsList } from '@helpers/NPSyncedCopies'
import { getTodaysReferences, findOpenTodosInNote } from '@helpers/NPnote'
import { removeContentUnderHeading, insertContentUnderHeading, removeContentUnderHeadingInAllNotes, selectedLinesIndex } from '@helpers/NPParagraph'

/**
 * Get the config for this plugin, from DataStore.settings or the defaults if settings are not valid
 * Note: augments settings with current DataStore.preference('timeblockTextMustContainString') setting
 * @returns {} config object
 */
export function getConfig(): AutoTimeBlockingConfig {
  const config = DataStore.settings || {}
  if (Object.keys(config).length) {
    try {
      // $FlowIgnore
      config.timeblockTextMustContainString = DataStore.preference('timeblockTextMustContainString') || ''
      validateAutoTimeBlockingConfig(config)
      return config
    } catch (error) {
      showMessage(`Plugin Settings ${error.message}\nRunning with default settings. You should probably open the plugin configuration dialog and fix the problem(s) listed above.`)
      logDebug(pluginJson, `Plugin Settings ${error.message} Running with default settings`)
    }
  } else {
    logDebug(pluginJson, `config was empty. will use defaults`)
  }
  const defaultConfig = getTimeBlockingDefaults()
  return defaultConfig
}

export const editorIsOpenToToday = (): boolean => {
  const fileName = Editor.filename
  if (fileName == null) {
    return false
  }
  return getDateStringFromCalendarFilename(fileName) === getTodaysDateUnhyphenated()
}

export function deleteParagraphsContainingString(destNote: CoreNoteFields, timeBlockTag: string): void {
  const destNoteParas = destNote.paragraphs
  const parasToDelete = []
  for (let i = 0; i < destNoteParas.length; i++) {
    const p = destNoteParas[i]
    if (new RegExp(timeBlockTag, 'gm').test(p.content)) {
      parasToDelete.push(p)
    }
  }
  if (parasToDelete.length > 0) {
    const deleteListByIndex = sortListBy(parasToDelete, ['lineIndex']) //NP API may give wrong results if lineIndexes are not in ASC order
    destNote.removeParagraphs(deleteListByIndex)
  }
}

export async function insertItemsIntoNote(
  note: CoreNoteFields,
  list: Array<string> | null = [],
  heading: string = '',
  shouldFold: boolean = false,
  config: AutoTimeBlockingConfig = getConfig(),
) {
  if (list && list.length > 0 && note) {
    // $FlowIgnore
    logDebug(pluginJson, `insertItemsIntoNote: items.length=${list.length}`)
    // Note: could probably use API addParagraphBelowHeadingTitle to insert
    await insertContentUnderHeading(note, heading, list.join('\n'))
    // Fold the heading to hide the list
    if (shouldFold && heading !== '') {
      const thePara = note.paragraphs.find((p) => p.type === 'title' && p.content.includes(heading))
      if (thePara) {
        logDebug(pluginJson, `insertItemsIntoNote: folding "${heading}" - isFolded=${String(Editor.isFolded(thePara))}`)
        // $FlowIgnore[method-unbinding] - the function is not being removed from the Editor object.
        if (Editor.isFolded) {
          // make sure this command exists
          if (!Editor.isFolded(thePara)) {
            Editor.toggleFolding(thePara)
            logDebug(pluginJson, `insertItemsIntoNote: folded heading "${heading}"`)
          }
        } else {
          thePara.content = `${String(heading)} …` // this was the old hack for folding
          await note.updateParagraph(thePara)
          note.content = note.content ?? ''
        }
      } else {
        logDebug(pluginJson, `insertItemsIntoNote could not find heading: ${heading}`)
      }
    }
  } else {
    if (config && !config.passBackResults) {
      await showMessage('No items to insert or work hours left. Check config/presents. Also look for calendar events which may have blocked off the rest of the day.')
    }
  }
}

/**
 * Scan note for user-entered timeblocks and return them as an array of Calendar Items
 * @param {*} note
 * @param {*} defaultDuration
 * @returns
 */
function getExistingTimeBlocksFromNoteAsEvents(note: CoreNoteFields, defaultDuration: number): Array<PartialCalendarItem> {
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

async function getPopulatedTimeMapForToday(dateStr: string, intervalMins: number, config: AutoTimeBlockingConfig): Promise<IntervalMap> {
  // const todayEvents = await Calendar.eventsToday()
  const eventsArray: Array<TCalendarItem> = await getEventsForDay(dateStr)
  const eventsWithStartAndEnd = getTimedEntries(eventsArray)
  let eventsScheduledForToday = keepTodayPortionOnly(eventsWithStartAndEnd)
  if (Editor) {
    const duration = checkWithDefault(checkNumber, 60)
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
  if (dateString && tag) {
    const eventsArray: Array<TCalendarItem> = await getEventsForDay(dateString)
    CommandBar.showLoading(true, 'Deleting Calendar Events')
    await CommandBar.onAsyncThread()
    for (let i = 0; i < eventsArray.length; i++) {
      const event = eventsArray[i]
      if (event?.title?.includes(tag)) {
        // logDebug(pluginJson, `deleteCalendarEventsWithTag: deleting event ${event.title}`)
        // clo(event, `deleteCalendarEventsWithTag; event=`)
        await Calendar.remove(event)
        CommandBar.showLoading(true, `Deleting Calendar Events\n(${i + 1}/${eventsArray.length})`, (i + 1) / eventsArray.length)
        logDebug(pluginJson, `deleteCalendarEventsWithTag: deleted event: ${event.title}`)
      }
    }
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
  } else {
    showMessage('deleteCalendarEventsWithTag could not delete events')
  }
}

type TEventConfig = {
  confirmEventCreation: boolean,
  processedTagName: string,
  calendarToWriteTo: string,
  defaultEventDuration: number,
  removeTimeBlocksWhenProcessed: boolean,
  addEventID: boolean,
}
// @nmn's checker code here was not working -- always sending back the defaults
// so I'm commenting it out for now -- I think it has something to do with atbConfig never being used!
// function getEventsConfig(atbconfig: AutoTimeBlockingConfig): TEventConfig {
//   try {
//     const checkedConfig: {
//       eventEnteredOnCalTag: string,
//       calendarToWriteTo: string,
//       defaultDuration: number,
//       ...
//     } = checkWithDefault(
//       checkObj({
//         eventEnteredOnCalTag: checkString,
//         calendarToWriteTo: checkString,
//         defaultDuration: checkNumber,
//       }),
//       {
//         eventEnteredOnCalTag: '#event_created',
//         calendarToWriteTo: '',
//         defaultDuration: 15,
//       },
//     )

//     const eventsConfig = {
//       processedTagName: checkedConfig.eventEnteredOnCalTag,
//       calendarToWriteTo: checkedConfig.calendarToWriteTo,
//       defaultEventDuration: checkedConfig.defaultDuration,
//       confirmEventCreation: false,
//       removeTimeBlocksWhenProcessed: true,
//       addEventID: false,
//     }
//     return eventsConfig
//   } catch (error) {
//     logError(pluginJson, `getEventsConfig: ${JSP(error)}`)
//   }
//   return {}
// }

function getEventsConfig(atbConfig: AutoTimeBlockingConfig): TEventConfig {
  return {
    processedTagName: String(atbConfig.eventEnteredOnCalTag) || '#event_created',
    calendarToWriteTo: String(atbConfig.calendarToWriteTo) || '',
    defaultEventDuration: Number(atbConfig.defaultDuration) || 15,
    confirmEventCreation: false,
    removeTimeBlocksWhenProcessed: true,
    addEventID: false,
  }
}

/**
 * Find all (unduplicated) todos:
 * - todo items from references list (aka "backlinks")
 * + items in the current note marked >today or with today's >date
 * + open todos in the note (if that setting is on)
 * + ...which include the include pattern (if specified in the config)
 * - ...which do not include items the exclude pattern (if specified in the config)
 * - items in the current note that are synced tasks to elsewhere (will be in references also)
 *
 * @param {*} config
 * @returns
 */
export function getTodaysFilteredTodos(config: AutoTimeBlockingConfig): Array<TParagraph> {
  const { includeTasksWithText, excludeTasksWithText, includeAllTodos, timeBlockTag } = config
  const backlinkParas = getTodaysReferences(Editor.note)
  logDebug(pluginJson, `Found ${backlinkParas.length} backlink paras`)
  let todosInNote = Editor.note ? findOpenTodosInNote(Editor.note, includeAllTodos) : []
  if (todosInNote.length > 0) {
    logDebug(pluginJson, ` getTodaysFilteredTodos: todosInNote Found ${todosInNote.length} items in today's note. Adding them.`)
    // eliminate linked lines (for synced lines on the page)
    // because these should be in the references from other pages
    todosInNote = todosInNote.filter((todo) => !/\^[a-zA-Z0-9]{6}/.test(todo.content))
    todosInNote = todosInNote.filter((todo) => !isTimeBlockLine(todo.content)) // if a user is using the todo character for timeblocks, eliminate those lines
    todosInNote = todosInNote.filter((todo) => !new RegExp(timeBlockTag).test(todo.content)) // just to be extra safe, make sure we're not adding our own timeblocks
  }
  const backLinksAndNoteTodos = [...backlinkParas, ...todosInNote]
  logDebug(pluginJson, `Found ${backLinksAndNoteTodos.length} backlinks+today-note items (may include completed items)`)
  const undupedBackLinkParas = eliminateDuplicateSyncedParagraphs(backLinksAndNoteTodos)
  logDebug(pluginJson, `Found ${undupedBackLinkParas.length} undupedBackLinkParas after duplicate elimination`)
  let todosParagraphs: Array<TParagraph> = makeAllItemsTodos(undupedBackLinkParas) //some items may not be todos but we want to pretend they are and timeblock for them
  todosParagraphs = Array.isArray(includeTasksWithText) && includeTasksWithText?.length > 0 ? includeTasksWithPatterns(todosParagraphs, includeTasksWithText) : todosParagraphs
  logDebug(pluginJson, `After includeTasksWithText, ${todosParagraphs.length} potential items`)
  todosParagraphs = Array.isArray(excludeTasksWithText) && excludeTasksWithText?.length > 0 ? excludeTasksWithPatterns(todosParagraphs, excludeTasksWithText) : todosParagraphs
  logDebug(pluginJson, `After excludeTasksWithText, ${todosParagraphs.length} potential items`)
  return todosParagraphs
}

export async function createTimeBlocksForTodaysTasks(config: AutoTimeBlockingConfig = getConfig()): Promise<?Array<string>> {
  // logDebug(pluginJson,`Starting createTimeBlocksForTodaysTasks. Time is ${new Date().toLocaleTimeString()}`)
  const { timeBlockTag, intervalMins, insertIntoEditor, createCalendarEntries, passBackResults, deletePreviousCalendarEntries, eventEnteredOnCalTag } = config
  const hypenatedDate = getTodaysDateHyphenated()
  logDebug(pluginJson, `createTimeBlocksForTodaysTasks hypenatedDate=${hypenatedDate} Editor.paras=${Editor.paragraphs.length}`)
  const date = getTodaysDateUnhyphenated()
  logDebug(pluginJson, `createTimeBlocksForTodaysTasks date=${date}`)
  const note = Editor // placeholder. we may pass a note in future revs
  const dateStr = Editor.filename ? getDateStringFromCalendarFilename(Editor.filename) : null
  logDebug(pluginJson, `createTimeBlocksForTodaysTasks dateStr=${dateStr ?? 'null'}  Editor.paras=${Editor.paragraphs.length}`)
  if (dateStr && dateStr === date) {
    logDebug(pluginJson, `createTimeBlocksForTodaysTasks dateStr=${dateStr} is today - starting  Editor.paras=${Editor.paragraphs.length}`)
    const todosParagraphs = await getTodaysFilteredTodos(config)
    logDebug(pluginJson, `Back from getTodaysFilteredTodos, ${todosParagraphs.length} potential items  Editor.paras=${Editor.paragraphs.length}`)
    // the following calls addBlockID and that must be called before any content changes are made that will not be saved
    const todosWithLinksMaybe = appendLinkIfNecessary(todosParagraphs, config)
    logDebug(
      pluginJson,
      `After appendLinkIfNecessary, ${todosWithLinksMaybe?.length ?? 0} potential items (may include headings or completed)  Editor.paras=${Editor.paragraphs.length}`,
    )
    const cleanTodayTodoParas = [...removeDateTagsFromArray(todosWithLinksMaybe)]
    logDebug(pluginJson, `After removeDateTagsFromArray, ${cleanTodayTodoParas.length} potential items  Editor.paras=${Editor.paragraphs.length}`)
    const tasksByType = todosWithLinksMaybe.length ? getTasksByType(todosWithLinksMaybe, true) : null // puts in object by type of task and enriches with sort info (like priority)
    logDebug(pluginJson, `After getTasksByType, ${tasksByType?.open.length ?? 0} OPEN items  Editor.paras=${Editor.paragraphs.length}`)
    if (deletePreviousCalendarEntries) {
      await deleteCalendarEventsWithTag(timeBlockTag, dateStr)
    }
    logDebug(pluginJson, `After deleteCalendarEventsWithTag, ${tasksByType?.open.length ?? 0} open items (still)  Editor.paras=${Editor.paragraphs.length}`)
    if (tasksByType && tasksByType['open'].length) {
      logDebug(pluginJson, `tasksByType['open'][0]: ${tasksByType['open'][0].content}  Editor.paras=${Editor.paragraphs.length}`)
      const sortedTodos = tasksByType['open'].length ? sortListBy(tasksByType['open'], '-priority') : []
      logDebug(pluginJson, `After sortListBy, ${sortedTodos.length} open items  Editor.paras=${Editor.paragraphs.length}`)
      // $FlowIgnore
      if (timeBlockTag?.length) {
        await deleteParagraphsContainingString(note, timeBlockTag) // Delete our timeblocks before scanning note for user-entered timeblocks
        logDebug(pluginJson, `After deleteParagraphsContainingString("${timeBlockTag}"), Editor.paras=${Editor.paragraphs.length}`)
      } else {
        logError(pluginJson, `timeBlockTag was empty. That's not good. I told the user.`)
        await showMessage(
          `Your Event Automations settings have a blank field for timeBlockTag. I will continue, but the results probably won't be what you want. Please check your settings.`,
        )
      }
      // $FlowIgnore
      if (eventEnteredOnCalTag?.length) {
        await deleteParagraphsContainingString(note, eventEnteredOnCalTag) // Delete @jgclark timeblocks->calendar breadcrumbs also
        logDebug(pluginJson, `After deleteParagraphsContainingString("${eventEnteredOnCalTag}"), Editor.paras=${Editor.paragraphs.length}`)
      } else {
        logError(pluginJson, `eventEnteredOnCalTag was empty. That's not good. I told the user.`)
        await showMessage(
          `Your Event Automations settings have a blank field for timeBlockTag. I will continue, but the results probably won't be what you want. Please check your settings.`,
        )
      }
      const calendarMapWithEvents = await getPopulatedTimeMapForToday(dateStr, intervalMins, config)
      logDebug(
        pluginJson,
        `After getPopulatedTimeMapForToday, ${calendarMapWithEvents.length} timeMap slots; last = ${JSON.stringify(
          calendarMapWithEvents[calendarMapWithEvents.length - 1],
        )} Editor.paras=${Editor.paragraphs.length}`,
      )
      // logDebug(pluginJson, `sortedTodos[0]: ${sortedTodos[0].content}  Editor.paras=${Editor.paragraphs.length}`)
      // logDebug(pluginJson, `sortedParas[0]: ${sortedParas[0].content}`)
      const eventsToTimeblock = getTimeBlockTimesForEvents(calendarMapWithEvents, sortedTodos, config)
      const { timeBlockTextList, blockList } = eventsToTimeblock
      clo(timeBlockTextList, `timeBlockTextList`)
      logDebug(
        pluginJson,
        `After getTimeBlockTimesForEvents, blocks:\n\tblockList.length=${String(blockList?.length)} \n\ttimeBlockTextList.length=${String(
          timeBlockTextList?.length,
        )}  Editor.paras=${Editor.paragraphs.length}`,
      )
      logDebug(
        pluginJson,
        `After getTimeBlockTimesForEvents, insertIntoEditor=${String(insertIntoEditor)} createCalendarEntries=${String(createCalendarEntries)}  Editor.paras=${
          Editor.paragraphs.length
        }`,
      )
      if (insertIntoEditor || createCalendarEntries) {
        logDebug(
          pluginJson,
          `After getTimeBlockTimesForEvents, config.createSyncedCopies=${String(config.createSyncedCopies)} todosWithLinksMaybe.length=${String(
            todosWithLinksMaybe.length,
          )}  Editor.paras=${Editor.paragraphs.length}`,
        )

        logDebug(pluginJson, `About to insert ${String(timeBlockTextList?.length)} timeblock items into note  Editor.paras=${Editor.paragraphs.length}`)
        if (!String(config.timeBlockHeading)?.length) {
          await showMessage(`You need to set a synced copies title in the plugin settings`)
          return
        } else {
          // $FlowIgnore -- Delete any previous timeblocks we created
          await insertItemsIntoNote(Editor, timeBlockTextList, config.timeBlockHeading, config.foldTimeBlockHeading, config)
        }

        logDebug(pluginJson, `\n\nAUTOTIMEBLOCKING SUMMARY:\n\n`)
        logDebug(pluginJson, `After cleaning, ${tasksByType?.open?.length ?? 0} open items,  Editor.paras=${Editor.paragraphs.length}`)

        logDebug(pluginJson, `createTimeBlocksForTodaysTasks inserted ${String(timeBlockTextList?.length)} items  Editor.paras=${Editor.paragraphs.length}`)
        if (createCalendarEntries) {
          logDebug(pluginJson, `About to create calendar entries  Editor.paras=${Editor.paragraphs.length}`)
          await selectCalendar(false) // checks the config calendar is writeable and if not, asks to set it
          const eventConfig = getEventsConfig(DataStore.settings) // pulling config again because selectCalendar may have changed it
          logDebug(pluginJson, `createTimeBlocksForTodaysTasks eventConfig=${JSON.stringify(eventConfig)}  Editor.paras=${Editor.paragraphs.length}`)
          // $FlowIgnore - we only use a subset of the events config that is in @jgclark's Flow Type
          await writeTimeBlocksToCalendar(eventConfig, Editor, true) //using @jgclark's method for now
          if (!insertIntoEditor) {
            // If user didn't want the timeblocks inserted into the editor, then we delete them now that they're in calendar
            // $Flow Ignore
            logDebug(pluginJson, `createTimeBlocksForTodaysTasks before deleteParagraphsContainingString Editor.paras=${Editor.paragraphs.length}`)
            await deleteParagraphsContainingString(note, timeBlockTag)
            logDebug(pluginJson, `createTimeBlocksForTodaysTasks after deleteParagraphsContainingString Editor.paras=${Editor.paragraphs.length}`)
          }
        }
      }
      if (config.createSyncedCopies && todosWithLinksMaybe?.length) {
        logDebug(
          pluginJson,
          `createSyncedCopies is true, so we will create synced copies of the todosParagraphs: ${todosParagraphs.length} timeblocks  Editor.paras=${Editor.paragraphs.length}`,
        )
        const sortedParas = getFullParagraphsCorrespondingToSortList(todosParagraphs, sortedTodos).filter((p) => p.filename !== Editor.filename)
        const sortedParasExcludingCurrentNote = sortedParas.filter((p) => p.filename !== Editor.filename)
        await writeSyncedCopies(sortedParasExcludingCurrentNote, { runSilently: true, ...config })
      }
      return passBackResults ? timeBlockTextList : []
    } else {
      logDebug(pluginJson, 'No todos/references marked for >today  Editor.paras=${Editor.paragraphs.length}')
      if (!passBackResults) {
        await showMessage(`No todos/references marked for >today`)
      }
    }
  } else {
    if (!passBackResults) {
      // logDebug(pluginJson,`You need to be in Today's Calendar Note to use this function  Editor.paras=${Editor.paragraphs.length}`)
      await showMessage(`You need to be in Today's Calendar Note to use this function`)
    }
  }
  return []
}

/**
 * Write synced copies of passed paragraphs to the Editor
 * @param {Array<TParagraph>} todosParagraphs - the paragraphs to write
 * @return {Promise<void}
 */
export async function writeSyncedCopies(todosParagraphs: Array<TParagraph>, config: AutoTimeBlockingConfig): Promise<void> {
  if (!todosParagraphs.length && !config.runSilently) {
    await showMessage(`No todos/references marked for this day!`, 'OK', 'Write Synced Copies')
  } else {
    logDebug(pluginJson, ``)
    const syncedList = getSyncedCopiesAsList(todosParagraphs)
    logDebug(pluginJson, `Deleting previous synced list heading and content`)
    if (!String(config.syncedCopiesTitle)?.length) {
      await showMessage(`You need to set a synced copies title in the plugin settings`)
      return
    } else {
      if (syncedList.length && Editor) await removeContentUnderHeading(Editor, String(config.syncedCopiesTitle), false)
    }
    logDebug(pluginJson, `Inserting synced list content: ${syncedList.length} items`)
    // $FlowIgnore
    await insertItemsIntoNote(Editor, syncedList, config.syncedCopiesTitle, config.foldSyncedCopiesHeading, config)
  }
}

/**
 * Write a list of synced copies of today items (in the references section) to the Editor
 * (entry point for /writeSyncedCopies)
 */
export async function insertSyncedCopiesOfTodayTodos(): Promise<void> {
  try {
    logDebug(pluginJson, `insertSyncedCopiesOfTodayTodos running`)
    // if (!editorIsOpenToToday()) await Editor.openNoteByDate(new Date(), false) //open editor to today
    const start = Editor.selection?.start
    const config = await getConfig()
    clo(config, 'insertSyncedCopiesOfTodayTodos config')
    const todosParagraphs = await getTodaysFilteredTodos(config)
    const sortedParasExcludingCurrentNote = todosParagraphs.filter((p) => p.filename !== Editor.filename)
    await writeSyncedCopies(sortedParasExcludingCurrentNote, config)
    if (start) {
      Editor.select(start, 1)
    }
  } catch (error) {
    logError(pluginJson, `insertSyncedCopiesOfTodayTodos error: ${JSP(error)}`)
  }
}

/**
 * Remove previously written synced copies of today items (written by this plugin) to the Editor
 * (entry point for /removeSyncedCopiesOfTodayTodos)
 */
export async function removeSyncedCopiesOfTodayTodos(note: TNote | null = null): Promise<void> {
  try {
    logDebug(pluginJson, `removeSyncedCopiesOfTodayTodos running`)
    await removeContentUnderHeading(note || Editor, String(DataStore.settings.syncedCopiesTitle), false, false)
  } catch (error) {
    logError(pluginJson, `removeSyncedCopiesOfTodayTodos error: ${JSP(error)}`)
  }
}

/**
 * Remove previously written Time Blocks (written by this plugin) in the Editor
 * (entry point for /removeTimeBlocks)
 */
export async function removeTimeBlocks(note: TNote | null = null): Promise<void> {
  try {
    logDebug(pluginJson, `removeTimeBlocks running`)
    await removeContentUnderHeading(note || Editor, String(DataStore.settings.timeBlockHeading), false, false)
  } catch (error) {
    logError(pluginJson, `removeTimeBlocks error: ${JSP(error)}`)
  }
}

/**
 * Remove all previously written synced copies of today items in all notes
 * (entry point for /removeAllPreviousSyncedCopies)
 * @param {boolean} runSilently - whether to show CommandBar popups - you should set it to 'yes' when running from a template
 */
export async function removePreviousSyncedCopies(runSilently: string = 'no'): Promise<void> {
  try {
    logDebug(pluginJson, `removePreviousSyncedCopies running`)
    const { syncedCopiesTitle } = DataStore.settings
    await removeContentUnderHeadingInAllNotes(['calendar'], syncedCopiesTitle, false, runSilently)
  } catch (error) {
    logError(pluginJson, `removePreviousSyncedCopies error: ${JSP(error)}`)
  }
}

/**
 * Remove all previously written synced copies of today items in all notes
 * (entry point for /removePreviousTimeBlocks)
 * @param {boolean} runSilently - whether to show CommandBar popups - you should set it to 'yes' when running from a template
 */
export async function removePreviousTimeBlocks(runSilently: string = 'no'): Promise<void> {
  try {
    logDebug(pluginJson, `removePreviousTimeBlocks running`)
    const { timeBlockHeading } = DataStore.settings
    await removeContentUnderHeadingInAllNotes(['calendar'], timeBlockHeading, false, runSilently)
  } catch (error) {
    logError(pluginJson, `removePreviousTimeBlocks error: ${JSP(error)}`)
  }
}

/**
 * Remove a section from all previous days
 * (entry point for /removePreviousSection)
 * @param {boolean} headingName - the name of the heading to remove
 */
export async function removePreviousDaysParagraphNamed(headingName: string = '', runSilently: string = 'no'): Promise<void> {
  try {
    logDebug(pluginJson, `removePreviousDaysParagraphNamed running for "${headingName}"`)
    if (headingName?.length) {
      await removeContentUnderHeadingInAllNotes(['calendar'], headingName, false, runSilently)
    }
  } catch (error) {
    logError(pluginJson, `removePreviousTimeBlocks error: ${JSP(error)}`)
  }
}

/**
 * Insert todos marked >today into the editor
 * (entry point for /atb)
 * @param {*} note
 */
export async function insertTodosAsTimeblocks(/* note: TNote */): Promise<void> {
  try {
    logDebug(pluginJson, `====== /atb =======\nStarting insertTodosAsTimeblocks`)
    if (!editorIsOpenToToday()) await Editor.openNoteByDate(new Date(), false) //open editor to today
    const config = await getConfig()
    clo(config, 'atb config')
    if (config) {
      logDebug(pluginJson, `Config found. Calling createTimeBlocksForTodaysTasks`)
      await createTimeBlocksForTodaysTasks(config)
    } else {
      logDebug(pluginJson, `insertTodosAsTimeblocks: stopping after config create`)
    }
  } catch (error) {
    logError(pluginJson, `insertTodosAsTimeblocks error: ${JSP(error)}`)
  }
}

export async function insertTodosAsTimeblocksWithPresets(/* note: TNote */): Promise<void> {
  // logDebug(pluginJson,`====== /atbp =======\nStarting insertTodosAsTimeblocksWithPresets`)
  // if (!editorIsOpenToToday()) await Editor.openNoteByDate(new Date(), false) //open editor to today
  let config = await getConfig()
  if (config) {
    // logDebug(pluginJson,`Config found. Checking for presets`)
    if (config.presets && config.presets.length) {
      const options = getPresetOptions(config.presets)
      const presetIndex = await chooseOption('Choose an AutoTimeBlocking Preset:', options, -1)
      const overrides = config.presets ? config.presets[presetIndex] : []
      // logDebug(pluginJson,`Utilizing preset: ${JSON.stringify(config.presets[presetIndex])}`)
      config = setConfigForPreset(config, overrides)
      try {
        validateAutoTimeBlockingConfig(config) //  check to make sure the overrides were valid
      } catch (error) {
        showMessage(error)
        // logDebug(pluginJson,`insertTodosAsTimeblocksWithPresets: invalid config: ${error}`)
      }
      await createTimeBlocksForTodaysTasks(config)
    } else {
      await showMessage('No presets found. Please read docs.')
    }
  } else {
    // logDebug(pluginJson,`insertTodosAsTimeblocksWithPresets: no config`)
  }
}

/**
 * Select calendar to write to and save to settings/config for this plugin
 * (plugin entry point for "/Choose Calendar for /atb to write to" command)
 * @returns {Promise<void>}
 */
export async function selectCalendar(isPluginEntry: boolean = true): Promise<void> {
  try {
    clo(Calendar.availableCalendarTitles(true), 'NPTimeblocking::selectCalendar: Calendar.availableCalendarTitles(true)')
    const calendarConfigField = 'calendarToWriteTo'
    const settings = DataStore.settings
    const calendarToWriteTo = isPluginEntry ? '' : settings[calendarConfigField] //if called from the commandbar, you are trying to set it
    const updatedCalendar = await checkOrGetCalendar(calendarToWriteTo, true)
    if (updatedCalendar) {
      settings[calendarConfigField] = updatedCalendar
      DataStore.settings = settings
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Mark task on current line done and run /atb to re-create timeblocks
 * Plugin entrypoint for command: "/mdatb"
 * @param {*} incoming
 */
export async function markDoneAndRecreateTimeblocks(incoming: string | null = null) {
  try {
    logDebug(pluginJson, `markDoneAndRecreateTimeblocks running with incoming:${String(incoming)}`)
    if (Editor?.selection && Editor?.paragraphs) {
      // const updatedParas = []
      const [startIndex, endIndex] = selectedLinesIndex(Editor.selection, Editor.paragraphs)
      if (endIndex >= startIndex) {
        for (let index = startIndex; index <= endIndex; index++) {
          const para = Editor.paragraphs[index]
          if (para) {
            // logDebug(pluginJson, `markDoneAndRecreateTimeblocks: paragraph[${index}] of ${startIndex} to ${endIndex}: "${para.content || ''}"`)
            if (para && isTask(para)) {
              // clo(para, `markDoneAndRecreateTimeblocks: before update paragraph[${index}]`)
              para.type = 'done'
              if (Editor) {
                Editor.updateParagraph(para)
                // clo(para, `markDoneAndRecreateTimeblocks: para after update paragraph[${index}]`)
                // clo(Editor?.paragraphs[para.lineIndex], `markDoneAndRecreateTimeblocks: note.paragraphs[${index}]`)
              } else {
                logError(pluginJson, `markDoneAndRecreateTimeblocks: no Editor`)
              }
            }
          }
        }
        await insertTodosAsTimeblocks()
      } else {
        logDebug(pluginJson, `markDoneAndRecreateTimeblocks: no selection`)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
