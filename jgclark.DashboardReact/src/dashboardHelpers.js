// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 14.4.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

// import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import type { TSectionItem, TParagraphForDashboard } from './types'
// import { showDashboard } from './HTMLGeneratorGrid'
import { getSettingFromAnotherPlugin } from '@helpers/NPConfiguration'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import {
  getAPIDateStrFromDisplayDateStr,
  includesScheduledFutureDate,
} from '@helpers/dateTime'
import {
  createRunPluginCallbackUrl,
  displayTitle,
} from "@helpers/general"
import { filterOutParasInExcludeFolders } from '@helpers/note'
import { getReferencedParagraphs } from '@helpers/NPnote'
import {
  findEndOfActivePartOfNote,
  findHeadingStartsWith,
  findStartOfActivePartOfNote,
  getTaskPriority,
  isTermInURL,
  removeTaskPriorityIndicators,
  smartPrependPara,
} from '@helpers/paragraph'
import { findParaFromStringAndFilename } from '@helpers/NPParagraph'
import {
  RE_ARROW_DATES_G,
  RE_SCHEDULED_DATES_G,
} from '@helpers/regex'
import {
  addPriorityToParagraphs,
  getNumericPriorityFromPara,
  sortListBy,
} from '@helpers/sorting'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import {
  getTimeBlockString,
  isTypeThatCanHaveATimeBlock,
  // isTimeBlockPara,
  RE_TIMEBLOCK_APP,
} from '@helpers/timeblocks'
import {
  displayTitleWithRelDate,
  showMessage
} from '@helpers/userInput'
import {
  isOpen, isOpenTask, isOpenNotScheduled, isOpenTaskNotScheduled,
  removeDuplicates
} from '@helpers/utils'

//-----------------------------------------------------------------

// Note: types.js now contains the Type definitions

//-----------------------------------------------------------------
// Settings

const pluginID = 'jgclark.DashboardReact'

export type dashboardConfigType = {
  dashboardTheme: string,
  separateSectionForReferencedNotes: boolean,
  ignoreTasksWithPhrase: string,
  ignoreChecklistItems: boolean,
  ignoreFolders: Array<string>,
  includeFolderName: boolean,
  includeTaskContext: boolean,
  newTaskSectionHeading: string,
  headingLevel: number,
  rescheduleNotMove: boolean,
  autoAddTrigger: boolean,
  excludeChecklistsWithTimeblocks: boolean,
  excludeTasksWithTimeblocks: boolean,
  timeblockMustContainString: string,
  showYesterdaySection: boolean,
  showTomorrowSection: boolean,
  showWeekSection: boolean,
  showMonthSection: boolean,
  showQuarterSection: boolean,
  showOverdueTaskSection: boolean,
  updateOverdueOnTrigger: boolean,
  maxTasksToShowInSection: number,
  overdueSortOrder: string,
  tagToShow: string,
  ignoreTagMentionsWithPhrase: string,
  updateTagMentionsOnTrigger: boolean,
  _logLevel: string,
  triggerLogging: boolean,
  // filterPriorityItems: boolean, // now kept in a DataStore.preference key
}

/**
 * Get config settings
 * TODO: Decide whether to make these DashboardReact instead ...
 * @author @jgclark
 */
export async function getSettings(): Promise<any> {
  // logDebug(pluginJson, `Start of getSettings()`)
  try {
    // Get plugin settings
    const config: dashboardConfigType = await DataStore.loadJSON(`../${pluginID}/settings.json`)

    if (config == null || Object.keys(config).length === 0) {
      throw new Error(
        `Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`,
      )
    }
    // clo(config, `settings`)
    // Set special pref to avoid async promises in decideWhetherToUpdateDashboard()
    DataStore.setPreference('Dashboard-triggerLogging', config.triggerLogging ?? false)

    // Set local pref Dashboard-filterPriorityItems to default false
    // if it doesn't exist already
    const savedValue = DataStore.preference('Dashboard-filterPriorityItems')
    logDebug(pluginJson, `filter? savedValue: ${String(savedValue)}`)
    if (!savedValue) {
      DataStore.setPreference('Dashboard-filterPriorityItems', false)
    }
    logDebug(pluginJson, `filter? -> ${String(DataStore.preference('Dashboard-filterPriorityItems'))}`)

    // Extend settings with a couple of values, as when we want to use this DataStore isn't available etc.
    config.timeblockMustContainString = DataStore.preference("timeblockTextMustContainString") ?? ''
    config.filterPriorityItems = DataStore.preference('Dashboard-filterPriorityItems')

    return config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
    return
  }
}

//-----------------------------------------------------------------

/**
 * Return an optimised set of fields based on each paragraph (plus filename + computed priority + title - many)
 * @param {Array<TParagraph>} origParas 
 * @returns {Array<TParagraphForDashboard>} dashboardParas
 */
export function makeDashboardParas(origParas: Array<TParagraph>): Array<TParagraphForDashboard> {
  try {
    const dashboardParas: Array<TParagraphForDashboard> = origParas.map((p) => {
      const note = p.note
      return {
        filename: note?.filename ?? '<error>',
        title: displayTitle(note), // this isn't expensive
        type: p.type,
        // rawContent: p.rawContent,
        prefix: p.rawContent.replace(p.content, ''),
        content: p.content,
        priority: getNumericPriorityFromPara(p),
        changedDate: note?.changedDate,
        timeStr: getStartTimeFromPara(p),
      }
    })
    return dashboardParas
  }
  catch (error) {
    logError('makeDashboardParas', error.message)
    return []
  }
}

//-----------------------------------------------------------------

/**
 * Return list(s) of open task/checklist paragraphs in calendar note of type 'timePeriodName', or scheduled to that same date.
 * Various config.* items are used:
 * - ignoreFolders? for folders to ignore for referenced notes
 * - separateSectionForReferencedNotes? if true, then two arrays will be returned: first from the calendar note; the second from references to that calendar note. If false, then both are included in a combined list (with the second being an empty array).
 * - ignoreTasksWithPhrase
 * - ignoreTasksScheduledToFuture
 * - excludeTasksWithTimeblocks & excludeChecklistsWithTimeblocks
 * @param {string} timePeriodName
 * @param {TNote} timePeriodNote base calendar note to process
 * @param {dashboardConfigType} config
 * @returns {[Array<TParagraph>, Array<TParagraph>]} see description above
 */
export function getOpenItemParasForCurrentTimePeriod(
  timePeriodName: string, timePeriodNote: TNote, config: dashboardConfigType
): [Array<TParagraphForDashboard>, Array<TParagraphForDashboard>] {
  try {
    let parasToUse: $ReadOnlyArray<TParagraph>

    //------------------------------------------------
    // Get paras from calendar note
    // Note: this takes 100-110ms for me
    const startTime = new Date() // for timing only
    if (Editor && (Editor?.note?.filename === timePeriodNote.filename)) {
      // If note of interest is open in editor, then use latest version available, as the DataStore is probably stale.
      parasToUse = Editor.paragraphs
      logDebug('getOpenItemParasForCurrent...', `Using EDITOR (${Editor.filename}) for the current time period: ${timePeriodName} which has ${String(Editor.paragraphs.length)} paras (after ${timer(startTime)})`)
    } else {
      // read note from DataStore in the usual way
      parasToUse = timePeriodNote.paragraphs
      logDebug('getOpenItemParasForCurrent...', `Processing ${timePeriodNote.filename} which has ${String(timePeriodNote.paragraphs.length)} paras (after ${timer(startTime)})`)
    }

    // Run following in background thread
    // NB: Has to wait until after Editor has been accessed to start this
    // Note: Now commented out, as I found it more than doubled the time taken to run this section.
    // await CommandBar.onAsyncThread()

    // Need to filter out non-open task types for following function, and any scheduled tasks (with a >date) and any blank tasks.
    // Now also allow to ignore checklist items.
    // Note: this operation is 100ms
    let openParas = (config.ignoreChecklistItems)
      ? parasToUse.filter((p) => isOpenTaskNotScheduled(p) && p.content.trim() !== '')
      : parasToUse.filter((p) => isOpenNotScheduled(p) && p.content.trim() !== '')
    logDebug('getOpenItemParasForCurrent...', `After 'isOpenTaskNotScheduled + not blank' filter: ${openParas.length} paras (after ${timer(startTime)})`)
    const tempSize = openParas.length

    // Filter out any future-scheduled tasks from this calendar note
    openParas = openParas.filter((p) => !includesScheduledFutureDate(p.content))
    if (openParas.length !== tempSize) {
      // logDebug('getOpenItemParasForCurrent...', `- removed ${tempSize - openParas.length} future scheduled tasks`)
    }
    // logDebug('getOpenItemParasForCurrent...', `- after 'future' filter: ${openParas.length} paras (after ${timer(startTime)})`)

    // Filter out anything from 'ignoreTasksWithPhrase' setting
    if (config.ignoreTasksWithPhrase) {
      openParas = openParas.filter((p) => !p.content.includes(config.ignoreTasksWithPhrase))
    }
    // logDebug('getOpenItemParasForCurrent...', `- after 'ignore' filter: ${openParas.length} paras (after ${timer(startTime)})`)

    // Filter out tasks with timeblocks, if wanted
    // FIXME: though I thought I had sorted this out with new function below
    if (config.excludeTasksWithTimeblocks) {
      openParas = openParas.filter((p) => !(p.type === 'open' && isTimeBlockPara(p, config.timeblockMustContainString)))
    }
    // logDebug('getOpenItemParasForCurrent...', `- after 'exclude task timeblocks' filter: ${openParas.length} paras (after ${timer(startTime)})`)

    // Filter out checklists with timeblocks, if wanted
    if (config.excludeChecklistsWithTimeblocks) {
      openParas = openParas.filter((p) => !(p.type === 'checklist' && isTimeBlockPara(p)))
    }
    // logDebug('getOpenItemParasForCurrent...', `- after 'exclude checklist timeblocks' filter: ${openParas.length} paras (after ${timer(startTime)})`)

    // Extend TParagraph with the task's priority + start time (if present)
    const openDashboardParas = makeDashboardParas(openParas)
    // openParas = extendParaToAddStartTime(openParas)
    logDebug('getOpenItemParasForCurrent...', `- found and extended ${String(openParas.length ?? 0)} cal items for ${timePeriodName} (after ${timer(startTime)})`)

    // -------------------------------------------------------------
    // Get list of open tasks/checklists scheduled/referenced to this period from other notes, and of the right paragraph type
    // (This is 2-3x quicker than part above)
    // Note: the getReferencedParagraphs() operation take 70-140ms
    let refOpenParas: Array<TParagraph> = []
    if (timePeriodNote) {
      // Allow to ignore checklist items.
      refOpenParas = (config.ignoreChecklistItems)
        ? getReferencedParagraphs(timePeriodNote, false).filter(isOpenTask)
        // try make this a single filter
        : getReferencedParagraphs(timePeriodNote, false).filter(isOpen)
    }
    logDebug('getOpenItemParasForCurrent...', `- got ${refOpenParas.length} open referenced after ${timer(startTime)}`)

    // Remove items referenced from items in 'ignoreFolders'
    refOpenParas = filterOutParasInExcludeFolders(refOpenParas, config.ignoreFolders, true)
    // logDebug('getOpenItemParasForCurrent...', `- after 'ignore' filter: ${refOpenParas.length} paras (after ${timer(startTime)})`)
    // Remove possible dupes from sync'd lines
    refOpenParas = eliminateDuplicateSyncedParagraphs(refOpenParas)
    // logDebug('getOpenItemParasForCurrent...', `- after 'dedupe' filter: ${refOpenParas.length} paras (after ${timer(startTime)})`)
    // Extend TParagraph with the task's priority + start time (if present)
    const refOpenDashboardParas = makeDashboardParas(refOpenParas)
    // refOpenParas = extendParaToAddStartTime(refOpenParas)
    logDebug('getOpenItemParasForCurrent...', `- found and extended ${String(refOpenParas.length ?? 0)} referenced items for ${timePeriodName} (after ${timer(startTime)})`)

    // Sort the list by priority then time block, otherwise leaving order the same
    // Then decide whether to return two separate arrays, or one combined one
    // Note: This takes 100ms
    // TODO: extend to deal with 12hr (AM/PM) time blocks
    if (config.separateSectionForReferencedNotes) {
      const sortedOpenParas = sortListBy(openDashboardParas, ['-priority', 'timeStr'])
      const sortedRefOpenParas = sortListBy(refOpenDashboardParas, ['-priority', 'timeStr'])
      // come back to main thread
      // await CommandBar.onMainThread()
      logDebug('getOpenItemParasForCurrent...', `- sorted after ${timer(startTime)}`)
      return [sortedOpenParas, sortedRefOpenParas]
    } else {
      const combinedParas = openDashboardParas.concat(refOpenDashboardParas)
      const combinedSortedParas = sortListBy(combinedParas, ['-priority', 'timeStr'])
      logDebug('getOpenItemParasForCurrent...', `- sorted after ${timer(startTime)}`)
      // come back to main thread
      // await CommandBar.onMainThread()
      return [combinedSortedParas, []]
    }
  } catch (err) {
    logError('getOpenItemParasForCurrentTimePeriod', err.message)
    return [[], []] // for completeness
  }
}

/**
 * Decide whether this line contains an active time block.
 * Note: This is a local variant of what is in timeblocks.js, that works without referring to DataStore.
 * @author @dwertheimer
 * @param {string} contentString
 * @returns {boolean}
 */
function isTimeBlockLine(contentString: string, mustContainString: string = ''): boolean {
  try {
    // Following works around a bug when the preference isn't being set at all at the start.
    if (mustContainString !== '') {
      const res1 = contentString.includes(mustContainString)
      if (!res1) {
        return false
      }
    }
    const res2 = contentString.match(RE_TIMEBLOCK_APP) ?? []
    return res2.length > 0
  }
  catch (err) {
    console.log(err)
    return false
  }
}

/**
 * Decide whether this paragraph contains an active time block.
 * Also now defeats on timeblock in middle of a [...](filename) or URL
 * Note: This is a local variant of what is in timeblocks.js, that works without referring to DataStore.
 * @author @jgclark
 * @param {TParagraph} para
 * @param {string} mustContainParaArg (optional)
 * @returns {boolean}
 */
function isTimeBlockPara(para: TParagraph, mustContainStringArg: string = ''): boolean {
  if (!isTypeThatCanHaveATimeBlock(para) || !isTimeBlockLine(para.content, mustContainStringArg)) {
    return false
  }
  const tbString = getTimeBlockString(para.content)
  return (!isTermInURL(tbString, para.content))
}


// Display time blocks with .timeBlock style
// Note: uses definition of time block syntax from plugin helpers, not directly from NP itself. So it may vary slightly.
// Note: copy from HTMLView.js to avoid React problem
function convertTimeBlockToHTML(input: string): string {
  let output = input
  if (isTimeBlockLine(input)) {
    const timeBlockPart = getTimeBlockString(input)
    logDebug(`found time block '${timeBlockPart}'`)
    output = output.replace(timeBlockPart, `<span class="timeBlock">${timeBlockPart}</span>`)
  }
  return output
}

/**
 * TODO: use me above?
 * Parses and sorts dates from items based on the content field.
 * @author @jgclark, @dwertheimer, ChatGPT
 * @param {Array<TParagraph>} items - Array of Paragraphs with a content field.
 * @returns {Array<TParagraph>} - Array of Paragraphs sorted by the computed start time represented in the text, ignoring ones that do not contain times.
 */
function parseAndSortDates(items: Array<TParagraph>): Array<ParsedTextDateRange> {
  const withDates = items
    .map(item => ({
      item,
      date: Calendar.parseDateText(item.content)[0]?.start ?? null
    })) // Map each item to an object including both the item and the parsed start date.
    .filter(({ date }) => date != null) // Filter out items without a valid start date.

  // Sort the intermediate structure by the start date and map back to the original items.
  const sortedItems = withDates.sort((a, b) => a.date - b.date)
    .map(({ item }) => item)

  return sortedItems
}

/**
 * @params {dashboardConfigType} config Settings
 * @returns {}
 */
export async function getRelevantOverdueTasks(config: dashboardConfigType, yesterdaysCombinedSortedParas: Array<TParagraph>): Promise<Array<TParagraph>> {
  try {
    const thisStartTime = new Date()
    const overdueParas: $ReadOnlyArray<TParagraph> = await DataStore.listOverdueTasks() // note: does not include open checklist items
    logInfo('getRelevantOverdueTasks', `Found ${overdueParas.length} overdue items in ${timer(thisStartTime)}`)

    // Remove items referenced from items in 'ignoreFolders' (but keep calendar note matches)
    // $FlowIgnore(incompatible-call) returns $ReadOnlyArray type
    let filteredOverdueParas: Array<TParagraph> = filterOutParasInExcludeFolders(overdueParas, config.ignoreFolders, true)
    logDebug('getRelevantOverdueTasks', `- ${filteredOverdueParas.length} paras after excluding @special + [${String(config.ignoreFolders)}] folders`)

    // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
    // Note: not fully accurate, as it doesn't check the filename is identical, but this catches sync copies, which saves a lot of time
    // Note: this is a quick operation
    // $FlowFixMe[class-object-subtyping]
    filteredOverdueParas = removeDuplicates(filteredOverdueParas, ['content'])
    logInfo('getRelevantOverdueTasksReducedParas', `- after deduping overdue -> ${filteredOverdueParas.length} in ${timer(thisStartTime)}`)

    // Remove items already in Yesterday section (if turned on)
    if (config.showYesterdaySection) {
      if (yesterdaysCombinedSortedParas.length > 0) {
        // Filter out all items in array filteredOverdueParas that also appear in array yesterdaysCombinedSortedParas
        filteredOverdueParas.map((p) => {
          if (yesterdaysCombinedSortedParas.filter((y) => y.content === p.content).length > 0) {
            logDebug('getRelevantOverdueTasksReducedParas', `- removing duplicate item {${p.content}} from overdue list`)
            filteredOverdueParas.splice(filteredOverdueParas.indexOf(p), 1)
          }
        })
      }
    }

    logInfo('getRelevantOverdueTasksReducedParas', `- after deduping with yesterday -> ${filteredOverdueParas.length} in ${timer(thisStartTime)}`)
    // $FlowFixMe[class-object-subtyping]
    return filteredOverdueParas
  } catch (error) {
    logError('getRelevantOverdueTasksReducedParas', error.message)
    return []
  }
}


/**
 * Make an HTML link showing displayStr, but with href onClick event to show open the 'item' in editor and select the given line content
 * @param {SectionItem} item's details, with raw
 * @param {string} displayStr
 * @returns {string} transformed output
 */
export function addNoteOpenLinkToString(item: SectionItem, displayStr: string): string {
  try {
    // Method 2: pass request back to plugin
    // TODO: is it right that this basically does nothing?
    // const filenameEncoded = encodeURIComponent(item.filename)

    if (item.para.content) {
      // call showLineinEditor... with the filename and rawConetnt
      // return `<a class="" {()=>onClickDashboardItem('fake','showLineInEditorFromFilename','${filenameEncoded}','${encodeRFC3986URIComponent(item.rawContent)}')}${displayStr}</a>`
      // return `<a>${displayStr}</a>`
      return `${displayStr}`
    } else {
      // call showNoteinEditor... with the filename
      // return `<a class="" {()=>onClickDashboardItem('fake','showNoteInEditorFromFilename','${filenameEncoded}','')}${displayStr}</a>`
      // return `<a>${displayStr}</a>`
      return `${displayStr}`
    }
  }
  catch (error) {
    logError('addNoteOpenLinkToString', `${error.message} for input '${displayStr}'`)
    return '(error)'
  }
}

/**
 * Wrap string with href onClick event to show note in editor,
 * using item.filename param.
 * @param {SectionItem} item's details
 * @param {string} noteTitle
 * @returns {string} output
 */
export function makeNoteTitleWithOpenActionFromFilename(item: SectionItem, noteTitle: string): string {
  try {
    // logDebug('makeNoteTitleWithOpenActionFromFilename', `- making notelink with ${item.filename}, ${noteTitle}`)
    // Pass request back to plugin, as a single object
    return `<a class="noteTitle sectionItem" {()=>onClickDashboardItem({itemID: '${item.ID}', type: 'showNoteInEditorFromFilename', encodedFilename: '${encodeURIComponent(item.para.filename)}', encodedContent: ''})}<i class="fa-regular fa-file-lines pad-right"></i> ${noteTitle}</a>`
  }
  catch (error) {
    logError('makeNoteTitleWithOpenActionFromFilename', `${error.message} for input '${noteTitle}'`)
    return '(error)'
  }
}

/**
 * Wrap string with href onClick event to show note in editor,
 * using noteTitle param.
 * Note: based only on 'noteTitle', not a filename
 * @param {string} noteTitle
 * @returns {string} output
 */
export function makeNoteTitleWithOpenActionFromTitle(noteTitle: string): string {
  try {
    // logDebug('makeNoteTitleWithOpenActionFromTitle', `- making notelink from ${noteTitle}`)
    // Pass request back to plugin
    // Note: not passing rawContent (param 4) as its not needed
    return `<a class="noteTitle sectionItem" {()=>onClickDashboardItem({itemID:'fake', type:'showNoteInEditorFromTitle', encodedFilename:'${encodeURIComponent(noteTitle)}', encodedContent:''}}><i class="fa-regular fa-file-lines pad-right"></i> ${noteTitle}</a>`
  }
  catch (error) {
    logError('makeNoteTitleWithOpenActionFromTitle', `${error.message} for input '${noteTitle}'`)
    return '(error)'
  }
}

/**
 * Wrap string with href onClick event to show note in editor,
 * using item.filename param.
 * @param {string} NPDateStr
 * @param {string} noteTitle
 * @returns {string} output
 */
export function makeNoteTitleWithOpenActionFromNPDateStr(NPDateStr: string, itemID: string): string {
  try {
    const dateFilename = `${getAPIDateStrFromDisplayDateStr(NPDateStr)}.${DataStore.defaultFileExtension}`
    // logDebug('makeNoteTitleWithOpenActionFromNPDateStr', `- making notelink with ${NPDateStr} / ${dateFilename}`)
    // Pass request back to plugin, as a single object
    return `<a class="noteTitle sectionItem" {()=>onClickDashboardItem({itemID: '${itemID}', type: 'showNoteInEditorFromFilename', encodedFilename: '${encodeURIComponent(dateFilename)}', encodedContent: ''}}><i class="fa-regular fa-file-lines pad-right"></i> ${NPDateStr}</a>`
  }
  catch (error) {
    logError('makeNoteTitleWithOpenActionFromNPDateStr', `${error.message} for input '${NPDateStr}'`)
    return '(error)'
  }
}

/**
 * FIXME: write some tests
 * FIXME: extend to allow AM/PM times as well
 * Extend the paragraph objects with a .timeStr property which comes from the start time of a time block, or else 'none' (which will then sort after times)
 * Note: Not fully internationalised (but then I don't think the rest of NP accepts non-Western numerals)
 * @tests in dashboardHelpers.test.js
 * @param {Array<TParagraph>} paras to extend
 * @returns {Array<TParagraph>} paras extended by .timeStr
 */
export function extendParasToAddStartTime(paras: Array<TParagraph>): Array<any> {
  try {
    // logDebug('extendParaToAddStartTime', `starting with ${String(paras.length)} paras`)
    const extendedParas = []
    for (const p of paras) {
      const thisTimeStr = getTimeBlockString(p.content)
      const extendedPara = p
      if (thisTimeStr !== '') {
        let startTimeStr = thisTimeStr.split('-')[0]
        if (startTimeStr[1] === ':') {
          startTimeStr = `0${startTimeStr}`
        }
        if (startTimeStr.endsWith("PM")) {
          startTimeStr = String(Number(startTimeStr.slice(0, 2)) + 12) + startTimeStr.slice(2, 5)
        }
        logDebug('extendParaToAddStartTime', `found timeStr: ${thisTimeStr} from timeblock ${thisTimeStr}`)
        // $FlowIgnore(prop-missing)
        extendedPara.timeStr = startTimeStr
      } else {
        // $FlowIgnore(prop-missing)
        extendedPara.timeStr = "none"
      }
      extendedParas.push(extendedPara)
    }

    return extendedParas
  }
  catch (error) {
    logError('dashboard / extendParaToAddTimeBlock', `${JSP(error)}`)
    return []
  }
}

/**
 * FIXME: write some tests
 * FIXME: extend to allow AM/PM times as well
 * Return the start time in a given paragraph.
 * This is from the start time of a time block, or else 'none' (which will then sort after times)
 * Note: Not fully internationalised (but then I don't think the rest of NP accepts non-Western numerals)
 * @tests in dashboardHelpers.test.js
 * @param {TParagraph} para to process
 * @returns {string} time string found
 */
export function getStartTimeFromPara(para: TParagraph): any {
  try {
    // logDebug('getStartTimeFromPara', `starting with ${String(paras.length)} paras`)
    let startTimeStr = "none"
    const thisTimeStr = getTimeBlockString(para.content)
    if (thisTimeStr !== '') {
      startTimeStr = thisTimeStr.split('-')[0]
      if (startTimeStr[1] === ':') {
        startTimeStr = `0${startTimeStr}`
      }
      if (startTimeStr.endsWith("PM")) {
        startTimeStr = String(Number(startTimeStr.slice(0, 2)) + 12) + startTimeStr.slice(2, 5)
      }
      logDebug('extendParaToAddStartTime', `found timeStr: ${startTimeStr} from timeblock ${thisTimeStr}`)
    }
    return startTimeStr
  }
  catch (error) {
    logError('dashboard / extendParaToAddTimeBlock', `${JSP(error)}`)
    return []
  }
}

/**
 * WARNING: DEPRECATED in favour of newer makePluginCommandButton() in HTMLView.js
 * Make HTML for a 'fake' button that is used to call (via x-callback) one of this plugin's commands.
 * Note: this is not a real button, bcause at the time I started this real <button> wouldn't work in NP HTML views, and Eduard didn't know why.
 * @param {string} buttonText to display on button
 * @param {string} pluginName of command to call
 * @param {string} commandName to call when button is 'clicked'
 * @param {string} commandArgs (may be empty)
 * @param {string?} tooltipText to hover display next to button
 * @returns {string}
 */
export function makeFakeCallbackButton(buttonText: string, pluginName: string, commandName: string, commandArgs: string, tooltipText: string = ''): string {
  const xcallbackURL = createRunPluginCallbackUrl(pluginName, commandName, commandArgs)
  const output = (tooltipText)
    ? `<span class="fake-button tooltip"><a class="button" href="${xcallbackURL}">${buttonText}</a><span class="tooltiptext">${tooltipText}</span></span>`
    : `<span class="fake-button"><a class="button" href="${xcallbackURL}">${buttonText}</a></span>`
  return output
}

/**
 * WARNING: DEPRECATED in favour of newer makePluginCommandButton() in HTMLView.js
 * Make HTML for a real button that is used to call one of this plugin's commands.
 * Note: this is not a real button, bcause at the time I started this real <button> wouldn't work in NP HTML views, and Eduard didn't know why.
 * V2: send params for an invokePluginCommandByName call
 * V1: send URL for x-callback
 * @param {string} buttonText to display on button
 * @param {string} pluginName of command to call
 * @param {string} commandName to call when button is 'clicked'
 * @param {string} commandArgs (may be empty)
 * @param {string?} tooltipText to hover display next to button
 * @returns {string}
 */
export function makeRealCallbackButton(buttonText: string, pluginName: string, commandName: string, commandArgs: string, tooltipText: string = ''): string {
  const xcallbackURL = createRunPluginCallbackUrl(pluginName, commandName, commandArgs)
  const output = (tooltipText)
    ? `<button class="XCBButton tooltip"><a href="${xcallbackURL}">${buttonText}</a><span class="tooltiptext">${tooltipText}</span></button>`
    : `<button class="XCBButton"><a href="${xcallbackURL}">${buttonText}</a></button>`
  return output
}

/**
 * Move a task or checklist from one calendar note to another.
 * It's designed to be used when the para itself is not available; the para will try to be identified from its filename and content, and it will throw an error if it fails.
 * If 'headingToPlaceUnder' is provided, para is added after it (with heading being created at effective top of note if necessary).
 * If 'headingToPlaceUnder' the para will be *prepended* to the effective top of the destination note.
 * @author @jgclark
 * @param {"task" | "checklist"} todoTypeName 'English' name of type of todo
 * @param {string} NPFromDateStr from date (the usual NP calendar date strings, plus YYYYMMDD)
 * @param {string} NPToDateStr to date (the usual NP calendar date strings, plus YYYYMMDD)
 * @param {string} paraContent content of the para to move.
 * @param {string?} headingToPlaceUnder which will be created if necessary
 * @returns {boolean} success?
 */
export async function moveItemBetweenCalendarNotes(NPFromDateStr: string, NPToDateStr: string, paraContent: string, headingToPlaceUnder: string = ''): Promise<boolean> {
  logDebug(pluginJson, `starting moveItemBetweenCalendarNotes for ${NPFromDateStr} to ${NPToDateStr} under heading '${headingToPlaceUnder}'`)
  try {
    // Get calendar note to use
    const fromNote = DataStore.calendarNoteByDateString(getAPIDateStrFromDisplayDateStr(NPFromDateStr))
    const toNote = DataStore.calendarNoteByDateString(getAPIDateStrFromDisplayDateStr(NPToDateStr))
    // Don't proceed unless we have valid from/to notes
    if (!fromNote || !toNote) {
      logError('moveItemBetweenCalendarNotes', `- Can't get calendar note for ${NPFromDateStr} and/or ${NPToDateStr}`)
      return false
    }

    // find para in the fromNote
    const possiblePara: TParagraph | boolean = findParaFromStringAndFilename(fromNote.filename, paraContent)
    if (typeof possiblePara === 'boolean') {
      throw new Error('moveItemBetweenCalendarNotes: no para found')
    }
    const itemType = possiblePara?.type

    // add to toNote
    if (headingToPlaceUnder === '') {
      logDebug('moveItemBetweenCalendarNotes', `- Prepending type ${itemType} '${paraContent}' to '${displayTitle(toNote)}'`)
      smartPrependPara(toNote, paraContent, itemType)
    } else {
      logDebug('moveItemBetweenCalendarNotes', `- Adding under heading '${headingToPlaceUnder}' in '${displayTitle(toNote)}'`)
      // Note: this doesn't allow setting heading level ...
      // toNote.addParagraphBelowHeadingTitle(paraContent, itemType, headingToPlaceUnder, false, true)
      // so replace with one half of /qath:
      const shouldAppend = await getSettingFromAnotherPlugin('jgclark.QuickCapture', 'shouldAppend', false)
      const matchedHeading = findHeadingStartsWith(toNote, headingToPlaceUnder)
      logDebug('addTextToNoteHeading', `Adding line '${paraContent}' to '${displayTitleWithRelDate(toNote)}' below matchedHeading '${matchedHeading}' (heading was '${headingToPlaceUnder}')`)
      if (matchedHeading !== '') {
        // Heading does exist in note already
        toNote.addParagraphBelowHeadingTitle(
          paraContent,
          itemType,
          (matchedHeading !== '') ? matchedHeading : headingToPlaceUnder,
          shouldAppend, // NB: since 0.12 treated as position for all notes, not just inbox
          true, // create heading if needed (possible if supplied via headingArg)
        )
      } else {
        const headingLevel = await getSettingFromAnotherPlugin('jgclark.QuickCapture', 'headingLevel', 2)
        const headingMarkers = '#'.repeat(headingLevel)
        const headingToUse = `${headingMarkers} ${headingToPlaceUnder}`
        const insertionIndex = shouldAppend
          ? findEndOfActivePartOfNote(toNote) + 1
          : findStartOfActivePartOfNote(toNote)
        logDebug('moveItemBetweenCalendarNotes', `- adding new heading '${headingToUse}' at line index ${insertionIndex} ${shouldAppend ? 'at end' : 'at start'}`)
        toNote.insertParagraph(headingToUse, insertionIndex, 'text') // can't use 'title' type as it doesn't allow headingLevel to be set
        logDebug('moveItemBetweenCalendarNotes', `- then adding text '${paraContent}' after `)
        toNote.insertParagraph(paraContent, insertionIndex + 1, itemType)
      }
    }

    // Assuming that's not thrown an error, now remove from fromNote
    logDebug('moveItemBetweenCalendarNotes', `- Removing line from '${displayTitle(fromNote)}'`)
    fromNote.removeParagraph(possiblePara)

    // Ask for cache refresh for these notes
    DataStore.updateCache(fromNote, false)
    DataStore.updateCache(toNote, false)

    return true
  } catch (err) {
    logError('moveItemBetweenCalendarNotes', `${err.name}: ${err.message} moving {${paraContent}} from ${NPFromDateStr} to ${NPToDateStr}`)
    return false
  }
}
