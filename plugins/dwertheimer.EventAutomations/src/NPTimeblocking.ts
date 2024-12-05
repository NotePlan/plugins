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
import { addTrigger } from '../../helpers/NPFrontMatter'
import type { SortableParagraphSubset } from '../../helpers/sorting'
import type { AutoTimeBlockingConfig } from './config'
import {
  blockOutEvents,
  getBlankDayMap,
  getTimeBlockTimesForEvents,
  removeDateTagsFromArray,
  appendLinkIfNecessary,
  getFullParagraphsCorrespondingToSortList,
} from './timeblocking-helpers'
import {
  shouldRunCheckedItemChecksOriginal,
  deleteParagraphsContainingString,
  gatherAndPrepareTodos,
  getConfig,
  writeSyncedCopies,
  insertItemsIntoNote,
  getTodaysFilteredTodos,
} from './timeblocking-shared'
import { validateAutoTimeBlockingConfig } from './config'
import { getPresetOptions, setConfigForPreset } from './presets'
import type { IntervalMap, PartialCalendarItem } from './timeblocking-flow-types'
import { getTimedEntries, keepTodayPortionOnly } from '@np/helpers/calendar'
import { textWithoutSyncedCopyTag } from '@np/helpers/syncedCopies'
import { getEventsForDay } from '@np/helpers/NPCalendar'
import { getDateStringFromCalendarFilename, getTodaysDateHyphenated, getTodaysDateUnhyphenated, removeRepeats, removeDateTagsAndToday } from '@np/helpers/dateTime'
import { getTasksByType, sortListBy, isTask } from '@np/helpers/sorting'
import { showMessage, chooseOption } from '@np/helpers/userInput'
import { getTimeBlockString, isTimeBlockLine } from '@np/helpers/timeblocks'
import { JSP, clo, log, logError, logWarn, logDebug, clof } from '@np/helpers/dev'
import { checkNumber, checkWithDefault } from '@np/helpers/checkType'
import { getSyncedCopiesAsList } from '@np/helpers/NPSyncedCopies'
import { removeContentUnderHeading, removeContentUnderHeadingInAllNotes, selectedLinesIndex } from '@np/helpers/NPParagraph'
import { saveEditorIfNecessary } from '@np/helpers/editor'

export const editorIsOpenToToday = (): boolean => {
  const fileName = Editor.filename
  if (fileName == null) {
    return false
  }
  return getDateStringFromCalendarFilename(fileName) === getTodaysDateUnhyphenated()
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

/**
 * Get a time map populated with the calendar events for the day
 * @param {string} dateStr
 * @param {number} intervalMins
 * @param {AutoTimeBlockingConfig} config
 * @returns
 */
async function getPopulatedTimeMapForToday(dateStr: string, intervalMins: number, config: AutoTimeBlockingConfig): Promise<IntervalMap> {
  // const todayEvents = await Calendar.eventsToday()
  const eventsArray = await getEventsForDay(dateStr)
  const eventsWithStartAndEnd = getTimedEntries(eventsArray || [])
  let eventsScheduledForToday = keepTodayPortionOnly(eventsWithStartAndEnd)
  // remove the timebocks that NP wrote to the calendar and may not have been deleted yet due to latency
  eventsScheduledForToday = eventsScheduledForToday.filter((e) => !e.notes.startsWith('NPTB:'))
  clof(eventsScheduledForToday, `getPopulatedTimeMapForToday eventsScheduledForToday`, ['date', 'title'], true)
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
    const eventsArray = (await getEventsForDay(dateString)) || []
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
    await showMessage('deleteCalendarEventsWithTag could not delete events')
  }
}

/**
 * Main function (called by multiple entry points)
 * @param {AutoTimeBlockingConfig} config
 * @param {Array<TParagraph>} completedItems - items that were checked (we must be in the EditorWillSave hook)
 * @returns
 */
export async function DELETEMEcreateTimeBlocksForTodaysTasks(config: AutoTimeBlockingConfig = getConfig(), completedItems: Array<TParagraph> = []): Promise<?Array<string>> {
  logDebug(pluginJson, `Starting createTimeBlocksForTodaysTasks. Time is ${new Date().toLocaleTimeString()}`)
  // clof(Editor.paragraphs, 'Editor.paragraphs', ['type', 'content'], true)
  const { timeBlockTag, intervalMins, passBackResults } = config
  if (shouldRunCheckedItemChecksOriginal(config)) addTrigger(Editor, 'onEditorWillSave', pluginJson['plugin.id'], 'onEditorWillSave')
  const hypenatedDate = getTodaysDateHyphenated()
  logDebug(pluginJson, `createTimeBlocksForTodaysTasks hypenatedDate=${hypenatedDate} Editor.paras=${Editor.paragraphs.length}`)
  const date = getTodaysDateUnhyphenated()
  logDebug(pluginJson, `createTimeBlocksForTodaysTasks date=${date}`)
  const dateStr = Editor.filename ? getDateStringFromCalendarFilename(Editor.filename) : null
  logDebug(pluginJson, `createTimeBlocksForTodaysTasks dateStr=${dateStr ?? 'null'}  Editor.paras=${Editor.paragraphs.length}`)
  if (dateStr && dateStr === date) {
    logDebug(pluginJson, `createTimeBlocksForTodaysTasks dateStr=${dateStr} is today - starting  Editor.paras=${Editor.paragraphs.length}`)
    deleteParagraphsContainingString(Editor, timeBlockTag)
    logDebug(pluginJson, `createTimeBlocksForTodaysTasks after deleteParagraphsContainingString(${timeBlockTag}) Editor.paras=${Editor.paragraphs.length}`)

    const todosParagraphs = await getTodaysFilteredTodos(config).filter(
      (t) => t.filename !== Editor.filename || (t.filename === Editor.filename && !completedItems.find((c) => c.lineIndex === t.lineIndex)),
    )
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
    // clo(tasksByType, 'createTimeBlocksForTodaysTasks: tasksByType')
    logDebug(
      pluginJson,
      `After getTasksByType, ${tasksByType?.open.length ?? 0} OPEN items | ${tasksByType?.scheduled.length ?? 0} Scheduled (for today) items Editor.paras=${
        Editor.paragraphs.length
      }`,
    )
    // clo(tasksByType?.open, 'createTimeBlocksForTodaysTasks: tasksByType.open')
    const openOrScheduledForToday = [...(tasksByType?.open ?? []), ...(tasksByType?.scheduled ?? [])]
    if (openOrScheduledForToday) {
      const sortedTodos = openOrScheduledForToday.length ? sortListBy(openOrScheduledForToday, '-priority') : []
      logDebug(pluginJson, `After sortListBy, ${sortedTodos.length} open items  Editor.paras=${Editor.paragraphs.length}`)
      // @ts-ignore
      if (timeBlockTag?.length) {
        logDebug(pluginJson, `timeBlockTag: ("${timeBlockTag}"), Editor.paras=${Editor.paragraphs.length}`)
      } else {
        logError(pluginJson, `timeBlockTag was empty. That's not good. I told the user.`)
        await showMessage(
          `Your Event Automations settings have a blank field for timeBlockTag. I will continue, but the results probably won't be what you want. Please check your settings.`,
        )
      }
      const calendarMapWithEvents = await getPopulatedTimeMapForToday(dateStr, intervalMins, config)
      // clo(calendarMapWithEvents, `calendarMapWithEvents: ${calendarMapWithEvents.length} items`)
      logDebug(
        pluginJson,
        `After getPopulatedTimeMapForToday, ${calendarMapWithEvents.length} timeMap slots; last = ${JSON.stringify(
          calendarMapWithEvents[calendarMapWithEvents.length - 1],
        )} Editor.paras=${Editor.paragraphs.length}`,
      )
      // logDebug(pluginJson, `sortedTodos[0]: ${sortedTodos[0].content}  Editor.paras=${Editor.paragraphs.length}`)
      // logDebug(pluginJson, `sortedParas[0]: ${sortedParas[0].content}`)
      const eventsToTimeblock = getTimeBlockTimesForEvents(calendarMapWithEvents, sortedTodos, config)
      logDebug(`\n\n>>>>>>> after getTimeBlockTimesForEvents <<<<<<<<<<<<\n\n`)
      clo(eventsToTimeblock, `createTimeBlocksForTodaysTasks eventsToTimeblock`)
      const { blockList, noTimeForTasks } = eventsToTimeblock
      let { timeBlockTextList } = eventsToTimeblock

      clo(timeBlockTextList, `timeBlockTextList`)
      logDebug(
        pluginJson,
        `After getTimeBlockTimesForEvents, blocks:\n\tblockList.length=${String(blockList?.length)} \n\ttimeBlockTextList.length=${String(
          timeBlockTextList?.length,
        )}  Editor.paras=${Editor.paragraphs.length}`,
      )
      logDebug(pluginJson, `After getTimeBlockTimesForEvents, Editor.paras=${Editor.paragraphs.length}`)

      logDebug(pluginJson, `About to insert ${String(timeBlockTextList?.length)} timeblock items into note  Editor.paras=${Editor.paragraphs.length}`)
      if (!String(config.timeBlockHeading)?.length) {
        await showMessage(`You need to set a time block heading title in the plugin settings`)
        return
      } else {
        if (noTimeForTasks && Object.keys(noTimeForTasks).length) {
          // removeContentUnderHeading(Editor, config.timeBlockHeading, false, true) -- too dangerous, will delete stuff people write underneath
          if (!timeBlockTextList) timeBlockTextList = []
          Object.keys(noTimeForTasks).forEach((key) =>
            noTimeForTasks[key].forEach(
              (p) =>
                timeBlockTextList &&
                timeBlockTextList.push(
                  `+ No time ${key === '_' ? 'available' : `in timeblock *${key}*`} for task: **- ${textWithoutSyncedCopyTag(removeRepeats(removeDateTagsAndToday(p.content)))}** ${
                    config.timeBlockTag
                  }`,
                ),
            ),
          )
        }
        // double check that we are not creating any synced lines by accident
        timeBlockTextList = timeBlockTextList?.map((t) => textWithoutSyncedCopyTag(t)) ?? []
        clo(
          timeBlockTextList,
          `getTimeBlockTimesForEvents Before writing: Editor.paras=${Editor.paragraphs.length} Editor.note.paras=${Editor.note?.paragraphs.length || 0}; timeBlockTextList=`,
        )
        await insertItemsIntoNote(Editor, timeBlockTextList, config.timeBlockHeading, config.foldTimeBlockHeading, config)
      }

      logDebug(pluginJson, `\n\nAUTOTIMEBLOCKING SUMMARY:\n\n`)
      logDebug(pluginJson, `After cleaning, ${tasksByType?.open?.length ?? 0} open items`)
      logDebug(pluginJson, `createTimeBlocksForTodaysTasks inserted ${String(timeBlockTextList?.length)} items  Editor.paras=${Editor.paragraphs.length}`)

      if (config.createSyncedCopies && todosWithLinksMaybe?.length) {
        logDebug(
          pluginJson,
          `createSyncedCopies is true, so we will create synced copies of the todosParagraphs: ${todosParagraphs.length} timeblocks  Editor.paras=${Editor.paragraphs.length}`,
        )
        clof(todosParagraphs, `createTimeBlocksForTodaysTasks todosParagraphs`, ['rawContent', 'raw', 'filename'], true)
        clof(sortedTodos, `createTimeBlocksForTodaysTasks sortedTodos`, ['rawContent', 'raw', 'filename'], true)
        const sortedParas = getFullParagraphsCorrespondingToSortList(todosParagraphs, sortedTodos).filter((p) => p.filename !== Editor.filename)
        clof(sortedParas, `createTimeBlocksForTodaysTasks sortedParas`, ['filename', 'content'], true)
        const sortedParasExcludingCurrentNote = sortedParas.filter((p) => p.filename !== Editor.filename)
        clof(sortedParasExcludingCurrentNote, `createTimeBlocksForTodaysTasks sortedParasExcludingCurrentNote`, ['filename', 'content'], true)
        // $FlowFixMe
        await writeSyncedCopies(...sortedParasExcludingCurrentNote, { runSilently: true, ...config })
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
 * Write a list of synced copies of today items (in the references section) to the Editor
 * (entry point for /writeSyncedCopies)
 */
export async function insertSyncedCopiesOfTodayTodos(passBackResults?: string): Promise<void | string> {
  try {
    logDebug(pluginJson, `insertSyncedCopiesOfTodayTodos running, passBackResults:${String(passBackResults)}`)
    const config = await getConfig()
    clo(config, 'insertSyncedCopiesOfTodayTodos config')
    // if (!editorIsOpenToToday()) await Editor.openNoteByDate(new Date(), false) //open editor to today
    logDebug(pluginJson, `insertSyncedCopiesOfTodayTodos before saveEditorIfNecessary`)
    if (Editor) await removeContentUnderHeading(Editor, String(config.syncedCopiesTitle), true, true)
    await saveEditorIfNecessary()
    logDebug(pluginJson, `insertSyncedCopiesOfTodayTodos after saveEditorIfNecessary`)
    const start = Editor.selection?.start // try to keep it from scrolling to end of doc
    const todosParagraphs = await getTodaysFilteredTodos(config, true)
    clof(todosParagraphs, 'insertSyncedCopiesOfTodayTodos todosParagraphs', ['filename', 'type', 'content'], true)
    const sortedParasExcludingCurrentNote = sortListBy(
      todosParagraphs.filter((p) => p.filename !== Editor.filename),
      'content',
    )
    clof(sortedParasExcludingCurrentNote, 'insertSyncedCopiesOfTodayTodos sortedParasExcludingCurrentNote ${sortedParasExcludingCurrentNote.length} items', [
      'filename',
      'type',
      'content',
    ])
    if (passBackResults && /[Yy]es/.test(passBackResults)) {
      // called from a template, so send a string back
      const syncedList = getSyncedCopiesAsList(sortedParasExcludingCurrentNote)
      logDebug(`insertSyncedCopiesOfTodayTodos`, `sending ${syncedList.length} synced line items to template`)
      return syncedList.join('\n')
    }
    await writeSyncedCopies(sortedParasExcludingCurrentNote, config)
    await saveEditorIfNecessary()
    if (start) {
      Editor.select(0, 0)
    }
  } catch (error) {
    logError(pluginJson, `insertSyncedCopiesOfTodayTodos error: ${JSP(error)}`)
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
        await validateAutoTimeBlockingConfig(config) //  check to make sure the overrides were valid
      } catch (error) {
        await showMessage(error)
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

/**
 * Initializes the function execution and logs the start time. It also checks
 * and adds a trigger for checked items if necessary, and validates the time
 * block tag configuration.
 *
 * @param {AutoTimeBlockingConfig} config - The configuration object for auto time blocking.
 * @param {Object} pluginJson - Plugin metadata for logging purposes.
 */
function initializeAndLogStart(config: AutoTimeBlockingConfig): void {
  const { timeBlockTag } = config

  // Log the start of the operation with the current time
  logDebug(pluginJson, `Starting createTimeBlocksForTodaysTasks. Time is ${new Date().toLocaleTimeString()}`)

  // Validate the presence of a time block tag in the configuration
  if (!timeBlockTag || typeof timeBlockTag !== 'string' || timeBlockTag.length === 0) {
    logError(pluginJson, `timeBlockTag was empty. That's not good. I told the user.`)
    showMessage(
      `Your Event Automations settings have a blank field for timeBlockTag. I will continue, but the results probably won't be what you want. Please check your settings.`,
    )
  }
}

/**
 * Categorizes tasks by their type (open or scheduled) and sorts them by priority.
 * This organization is necessary for preparing the tasks for time block calculation.
 *
 * @param {Array<TParagraph>} todosWithLinks - The list of todo items, potentially with appended links.
 * @param {Object} pluginJson - Plugin metadata for logging purposes.
 * @returns {Array<TParagraph>} - The sorted list of todo items, ready for time block allocation.
 */
function categorizeAndSortTasks(todosWithLinks: ReadonlyArray<TParagraph>, config: AutoTimeBlockingConfig): Array<SortableParagraphSubset> {
  if (todosWithLinks.length === 0) {
    logDebug(pluginJson, `No todos to categorize and sort.`)
    return []
  }

  // Categorize tasks by type and enrich them with sorting information
  const tasksByType = getTasksByType(todosWithLinks, true)
  logDebug(pluginJson, `After getTasksByType, categorized tasks by type. Open tasks=${tasksByType.open.length} | Scheduled tasks=${tasksByType.scheduled.length}`)

  // Combine open and scheduled tasks, then sort by priority
  const openOrScheduledForToday = [...(tasksByType.open ?? []), ...(tasksByType.scheduled ?? [])]
  clof(openOrScheduledForToday, `categorizeAndSortTasks openOrScheduledForToday`, ['filename', 'type', 'content'], true)
  const sortKeys = config.mode === 'MANUAL_ORDERING' ? ['lineIndex'] : ['-priority', 'filename', '-duration']
  const sortedTodos = sortListBy(openOrScheduledForToday, sortKeys)
  clof(sortedTodos, `categorizeAndSortTasks sortedTodos`, ['priority', 'filename', 'duration', 'content'], true)
  logDebug(pluginJson, `After sortListBy, sorted ${sortedTodos.length} tasks by priority.`)

  return sortedTodos
}

/**
 * Handles scenarios where no todo items are marked for today or when specific
 * results are expected but not found. Shows messages to the user based on the
 * configuration and outcomes of the time blocking process, and returns the
 * appropriate results.
 *
 * @param {boolean} passBackResults - Flag indicating whether to pass back results.
 * @param {?Array<string>} timeBlockTextList - The list of time block text entries, if any.
 * @param {Object} pluginJson - Plugin metadata for logging and debugging.
 * @returns {Promise<?Array<string>>} - The results to be passed back, if any.
 */
function handleNoTodosOrResults(passBackResults: boolean, timeBlockTextList: ?Array<string>): Array<string> {
  // Check if there are no todos or results to pass back
  if (!passBackResults) {
    const message =
      timeBlockTextList && timeBlockTextList.length > 0
        ? `Processed ${timeBlockTextList.length} time blocks for today.`
        : 'No todos/references marked for >today or no time blocks created.'

    logDebug(pluginJson, message)
  }

  // Return the results depending on whether this is being called by a template or not
  return passBackResults ? timeBlockTextList || [] : []
}

/**
 * Inserts the prepared time block text entries into the note under a specified
 * heading, applies specified formatting options, and logs a summary of the
 * autotimeblocking operation. Optionally creates synced copies of todo items
 * if required by the configuration.
 *
 * @param {Array<string>} timeBlockTextList - The list of text entries for time blocks.
 * @param {AutoTimeBlockingConfig} config - The configuration object for auto time blocking.
 * @param {Object} pluginJson - Plugin metadata for logging and debugging.
 * @param {Array<TParagraph>} todosWithLinksMaybe - The list of todo items with potential links appended.
 * @returns {Promise<void>}
 */
async function insertAndFinalizeTimeBlocks(
  timeBlockTextList: Array<string>,
  config: AutoTimeBlockingConfig,
  pluginJson: Object,
  todosWithLinksMaybe: Array<SortableParagraphSubset>,
): Promise<void> {
  // Insert time block text entries into the note
  await insertItemsIntoNote(Editor, timeBlockTextList, config.timeBlockHeading, config.foldTimeBlockHeading, config)
  logDebug(pluginJson, `Inserted ${timeBlockTextList.length} timeblock items into note`)

  // Log autotimeblocking summary
  logDebug(pluginJson, `\n\nAUTOTIMEBLOCKING SUMMARY:\n\n`)
  logDebug(pluginJson, `Inserted ${timeBlockTextList.length} items`)

  // Create synced copies of todo items if configured
  // DELETEME: COMMENTING OUT FOR NOW (REMOVING THIS FEATURE WHICH MADE NO SENSE) DELETE THIS COMMENT AFTER A WHILE 2024-02-23
  // if (config.createSyncedCopies && todosWithLinksMaybe.length) {
  //   await createSyncedCopies(todosWithLinksMaybe, config)
  //   logDebug(pluginJson, `Created synced copies of todos`)
  // }

  // Check and add trigger for checked items if configured to do so
  if (shouldRunCheckedItemChecksOriginal(config)) {
    addTrigger(Editor, 'onEditorWillSave', pluginJson['plugin.id'], 'onEditorWillSave')
  }
}

/**
 * Generates time blocks for tasks by creating a populated time map for the day,
 * calculating time blocks for events based on this map and the sorted tasks, and
 * preparing the list of text entries for these time blocks. Special handling is
 * included for tasks that couldn't be allocated time.
 *
 * @param {Array<TParagraph>} sortedTodos - The sorted list of todo items for today.
 * @param {string} dateStr - The date string for today, used to identify relevant events.
 * @param {AutoTimeBlockingConfig} config - The configuration object for auto time blocking.
 * @param {Object} pluginJson - Plugin metadata for logging and debugging.
 * @returns {Promise<{blockList: Array<string>, noTimeForTasks: Object, timeBlockTextList: Array<string>}>}
 *          An object containing the lists of time block text entries and tasks with no allocated time.
 */
async function generateTimeBlocks(
  sortedTodos: Array<SortableParagraphSubset>,
  dateStr: string,
  config: AutoTimeBlockingConfig,
  pluginJson: Object,
): Promise<{ blockList: Array<string>, noTimeForTasks: Object, timeBlockTextList: Array<string> }> {
  // Generate a populated time map for today
  const calendarMapWithEvents = await getPopulatedTimeMapForToday(dateStr, config.intervalMins, config)
  logDebug(pluginJson, `generateTimeBlocks: After getPopulatedTimeMapForToday, ${calendarMapWithEvents.length} timeMap slots`)
  clof(sortedTodos, `generateTimeBlocks sortedTodos`, ['lineIndex', 'content'], true)
  // Calculate time blocks for events based on the populated time map and sorted todo tasks
  const eventsToTimeblock = getTimeBlockTimesForEvents(calendarMapWithEvents, sortedTodos, config)
  logDebug(
    pluginJson,
    `generateTimeBlocks after getTimeBlockTimesForEvents; eventsToTimeblock.timeMap.length=${eventsToTimeblock.timeMap.length}, eventsToTimeblock.blockList.length=${
      eventsToTimeblock.blockList.length
    } eventsToTimeblock.timeBlockTextList.length=${eventsToTimeblock?.timeBlockTextList?.toString() || ''}`,
  )
  // Prepare the list of text entries for time blocks
  const { blockList, noTimeForTasks } = eventsToTimeblock
  let { timeBlockTextList } = eventsToTimeblock

  // Handle tasks with no allocated time
  if (noTimeForTasks && Object.keys(noTimeForTasks).length) {
    if (!timeBlockTextList) timeBlockTextList = []
    Object.keys(noTimeForTasks).forEach((key) =>
      noTimeForTasks[key].forEach((task) =>
        timeBlockTextList ? timeBlockTextList.push(`+ No time ${key === '_' ? 'available' : `in timeblock *${key}*`} for task: **- ${task.content}** ${config.timeBlockTag}`) : [],
      ),
    )
  }

  // Ensure no synced lines are created by accident
  timeBlockTextList = timeBlockTextList?.map((t) => textWithoutSyncedCopyTag(t)) || []

  return { blockList: blockList ?? [], noTimeForTasks, timeBlockTextList }
}

/**
 * Main function for creating time blocks for today's tasks, utilizing modular functions
 * for improved maintainability and readability.
 *
 * @param {AutoTimeBlockingConfig} config - The configuration object for auto time blocking, with defaults provided by getConfig().
 * @param {Array<TParagraph>} completedItems - Items that were checked, typically provided in the EditorWillSave hook context.
 * @returns {Promise<?Array<string>>} - An optional array of strings to be passed back, depending on the configuration.
 */
export async function createTimeBlocksForTodaysTasks(config: AutoTimeBlockingConfig = getConfig(), completedItems: Array<TParagraph> = []): Promise<?Array<string>> {
  // Step 1: Initialize and log start
  initializeAndLogStart(config)

  // Step 2: Fetch and prepare todos
  const cleanTodayTodoParas = await gatherAndPrepareTodos(config, completedItems)

  // Step 3: Categorize and sort tasks
  const sortedTodos = categorizeAndSortTasks(cleanTodayTodoParas, config)

  // Step 4: Generate time blocks
  const dateStr = getDateStringFromCalendarFilename(Editor.filename) // Assuming this utility function exists and is accurate
  if (!dateStr) {
    return handleNoTodosOrResults(config.passBackResults || false, null)
  }

  const { blockList, noTimeForTasks, timeBlockTextList } = await generateTimeBlocks(sortedTodos, dateStr, config)

  // Check if time blocks were successfully generated
  if (blockList.length === 0 && Object.keys(noTimeForTasks).length === 0) {
    // If no blocks were created and no tasks are without time, handle accordingly
    return handleNoTodosOrResults(config.passBackResults || false, null)
  }

  // Step 5: Insert and finalize time blocks
  await insertAndFinalizeTimeBlocks(timeBlockTextList, config, pluginJson, sortedTodos)
  // Check and add trigger for checked items if configured to do so
  if (shouldRunCheckedItemChecksOriginal(config)) {
    addTrigger(Editor, 'onEditorWillSave', pluginJson['plugin.id'], 'onEditorWillSave')
  }

  // Step 6: Handle no todos or results scenario and return results
  return handleNoTodosOrResults(config.passBackResults || false, timeBlockTextList)
}
