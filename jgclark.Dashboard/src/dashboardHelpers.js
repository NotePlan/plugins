// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 1.4.2024 for v1.0.0 by @jgclark
//-----------------------------------------------------------------------------

// import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
// import { showDashboard } from './HTMLGeneratorGrid'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import {
  getAPIDateStrFromDisplayDateStr,
  includesScheduledFutureDate,
} from '@helpers/dateTime'
import { createRunPluginCallbackUrl, displayTitle } from "@helpers/general"
import {
  simplifyNPEventLinksForHTML,
  simplifyInlineImagesForHTML,
  convertHashtagsToHTML,
  convertMentionsToHTML,
  convertPreformattedToHTML,
  convertStrikethroughToHTML,
  convertTimeBlockToHTML,
  convertUnderlinedToHTML,
  convertHighlightsToHTML,
  convertNPBlockIDToHTML,
  convertBoldAndItalicToHTML,
  truncateHTML
} from '@helpers/HTMLView'
import { filterOutParasInExcludeFolders } from '@helpers/note'
import { getReferencedParagraphs } from '@helpers/NPnote'
import {
  getTaskPriority,
  removeTaskPriorityIndicators,
} from '@helpers/paragraph'
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
  changeBareLinksToHTMLLink,
  changeMarkdownLinksToHTMLLink,
  stripBackwardsDateRefsFromString,
  stripThisWeeksDateRefsFromString,
  stripTodaysDateRefsFromString
} from '@helpers/stringTransforms'
import { getTimeBlockString, isTimeBlockPara } from '@helpers/timeblocks'
import { showMessage } from '@helpers/userInput'
import {
  isOpen, isOpenTask, isOpenNotScheduled, isOpenTaskNotScheduled,
  removeDuplicates
} from '@helpers/utils'

//-----------------------------------------------------------------
// Data types

// details for a section
export type Section = {
  ID: number,
  name: string, // 'Today', 'This Week', 'This Month' ... 'Projects', 'Done'
  sectionType: 'DT' | 'DY' | 'DO' | 'W' | 'M' | 'Q' | 'Y' | 'OVERDUE' | 'TAG' | 'PROJ', // where DT = today, DY = yesterday, TAG = Tag, PROJ = Projects section
  description: string,
  FAIconClass: string,
  sectionTitleClass: string,
  filename: string,
}

// an item within a section
export type SectionItem = {
  ID: string,
  content: string,
  rawContent: string,
  filename: string,
  type: ParagraphType | string,
}

// reduced paragraph definition
export type ReducedParagraph = {
  filename: string,
  changedDate: ?Date,
  title: string,
  content: string,
  rawContent: string,
  type: ParagraphType,
  priority: number
}

//-----------------------------------------------------------------
// Settings

const pluginID = 'jgclark.Dashboard'

export type dashboardConfigType = {
  dashboardTheme: string,
  separateSectionForReferencedNotes: boolean,
  ignoreTasksWithPhrase: string,
  ignoreChecklistItems: boolean,
  ignoreFolders: Array<string>,
  includeFolderName: boolean,
  includeTaskContext: boolean,
  newTaskSectionHeading: string,
  rescheduleNotMove: boolean,
  autoAddTrigger: boolean,
  excludeChecklistsWithTimeblocks: boolean,
  excludeTasksWithTimeblocks: boolean,
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
    // logDebug(pluginJson, `filter? savedValue: ${String(savedValue)}`)
    if (!savedValue) {
      DataStore.setPreference('Dashboard-filterPriorityItems', false)
    }
    // logDebug(pluginJson, `filter? -> ${String(DataStore.preference('Dashboard-filterPriorityItems'))}`)
    return config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
    return
  }
}

//-----------------------------------------------------------------

/**
 * Return a reduced set of fields for each paragraph (plus filename + computed priority)
 * @param {Array<TParagraph>} origParas 
 * @returns {Array<ReducedParagraph>}
 */
export function reduceParagraphs(origParas: Array<TParagraph>): Array<ReducedParagraph> {
  try {
    const reducedParas: Array<ReducedParagraph> = origParas.map((p) => {
      const note = p.note
      const fieldSet = {
        filename: note?.filename ?? '<error>',
        changedDate: note?.changedDate,
        title: displayTitle(note), // this isn't expensive
        content: p.content,
        rawContent: p.rawContent,
        type: p.type,
        priority: getNumericPriorityFromPara(p),
      }
      return fieldSet
    })
    return reducedParas
  }
  catch (error) {
    logError('reduceParagraphs', error.message)
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
): [Array<TParagraph>, Array<TParagraph>] {
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
    if (config.excludeTasksWithTimeblocks) {
      openParas = openParas.filter((p) => !(p.type === 'open' && isTimeBlockPara(p)))
    }
    // logDebug('getOpenItemParasForCurrent...', `- after 'exclude task timeblocks' filter: ${openParas.length} paras (after ${timer(startTime)})`)

    // Filter out checklists with timeblocks, if wanted
    if (config.excludeChecklistsWithTimeblocks) {
      openParas = openParas.filter((p) => !(p.type === 'checklist' && isTimeBlockPara(p)))
    }
    // logDebug('getOpenItemParasForCurrent...', `- after 'exclude checklist timeblocks' filter: ${openParas.length} paras (after ${timer(startTime)})`)

    // Temporarily extend TParagraph with the task's priority + start time (if present)
    openParas = addPriorityToParagraphs(openParas)
    openParas = extendParaToAddStartTime(openParas)
    logDebug('getOpenItemParasForCurrent...', `- found and extended ${String(openParas.length ?? 0)} cal items for ${timePeriodName} (after ${timer(startTime)})`)

    // -------------------------------------------------------------
    // Get list of open tasks/checklists scheduled/referenced to this period from other notes, and of the right paragraph type
    // (This is 2-3x quicker than part above)
    // Note: the getReferencedParagraphs() operation take 70-140ms
    let refParas: Array<TParagraph> = []
    if (timePeriodNote) {
      // Allow to ignore checklist items.
      refParas = (config.ignoreChecklistItems)
        ? getReferencedParagraphs(timePeriodNote, false).filter(isOpenTask)
        // try make this a single filter
        : getReferencedParagraphs(timePeriodNote, false).filter(isOpen)
    }
    logDebug('getOpenItemParasForCurrent...', `- got ${refParas.length} open referenced after ${timer(startTime)}`)

    // Remove items referenced from items in 'ignoreFolders'
    refParas = filterOutParasInExcludeFolders(refParas, config.ignoreFolders, true)
    // logDebug('getOpenItemParasForCurrent...', `- after 'ignore' filter: ${refParas.length} paras (after ${timer(startTime)})`)
    // Remove possible dupes from sync'd lines
    refParas = eliminateDuplicateSyncedParagraphs(refParas)
    // logDebug('getOpenItemParasForCurrent...', `- after 'dedupe' filter: ${refParas.length} paras (after ${timer(startTime)})`)
    // Temporarily extend TParagraph with the task's priority + start time (if present)
    refParas = addPriorityToParagraphs(refParas)
    refParas = extendParaToAddStartTime(refParas)
    logDebug('getOpenItemParasForCurrent...', `- found and extended ${String(refParas.length ?? 0)} referenced items for ${timePeriodName} (after ${timer(startTime)})`)

    // Sort the list by priority then time block, otherwise leaving order the same
    // Then decide whether to return two separate arrays, or one combined one
    // Note: This takes 100ms
    if (config.separateSectionForReferencedNotes) {
      const sortedOpenParas = sortListBy(openParas, ['-priority', 'timeStr'])
      const sortedRefParas = sortListBy(refParas, ['-priority', 'timeStr'])
      // come back to main thread
      // await CommandBar.onMainThread()
      logDebug('getOpenItemParasForCurrent...', `- sorted after ${timer(startTime)}`)
      return [sortedOpenParas, sortedRefParas]
    } else {
      const combinedParas = openParas.concat(refParas)
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
 * Alter the provided paragraph's content to display suitably in HTML to mimic NP native display of markdown (as best we can). Currently this:
 * - simplifies NP event links, and tries to colour them
 * - turns MD links -> HTML links
 * - truncates the display of raw URLs if necessary
 * - turns NP sync ids -> blue asterisk icon
 * - turns #hashtags and @mentions the colour that the theme displays them
 * - turns >date markers the colour that the theme displays them
 * - styles in bold/italic
 * Note: the actual note link is added following load by adding click handler to all items with class "sectionItemContent" (which already have a basic <a>...</a> wrapper).
 * It additionally:
 * - truncates the overall string if requested
 * - if noteTitle is supplied, then either 'append' it as a active NP note title, or make it the active NP note link for 'all' the string.
 * @author @jgclark
 * @param {SectionItem} thisItem
 * @param {string?} noteTitle
 * @param {string?} noteLinkStyle: "append" or "all"
 * @param {string?} truncateLength (optional) length of string after which to truncate. Will not truncate if set to 0.
 * @returns {string} altered string
 */
export function makeParaContentToLookLikeNPDisplayInHTML(
  thisItem: SectionItem,
  noteTitle: string = "",
  noteLinkStyle: string = "all",
  truncateLength: number = 0): string {
  try {
    // logDebug(`makeParaContent...`, `for '${thisItem.ID}' / noteTitle '${noteTitle}' / filename '${thisItem.filename}'`)
    // Start with the content of the item
    let output = thisItem.content

    // See if there's a !, !!, !!! or >> in the line, and if so set taskPriority accordingly
    const taskPriority = getTaskPriority(output)
    if (taskPriority > 0) {
      output = removeTaskPriorityIndicators(output)
    }

    if (noteTitle === '(error)') {
      logError('makeParaContent...', `starting with noteTitle '(error)' for '${thisItem.content}'`)
    }

    // Simplify NP event links of the form
    // `![📅](2023-01-13 18:00:::F9766457-9C4E-49C8-BC45-D8D821280889:::NA:::Contact X about Y:::#63DA38)` to HTML with icon
    output = simplifyNPEventLinksForHTML(output)

    // Simplify embedded images of the form ![image](...) by replacing with an icon.
    // (This also helps remove false positives for ! priority indicator)
    output = simplifyInlineImagesForHTML(output)

    // Display markdown links of the form [title](URI) as HTML links
    output = changeMarkdownLinksToHTMLLink(output)

    // Display bare URLs as HTML links
    output = changeBareLinksToHTMLLink(output)

    // Display hashtags with .hashtag style
    output = convertHashtagsToHTML(output)

    // Display mentions with .attag style
    output = convertMentionsToHTML(output)

    // Display pre-formatted with .code style
    output = convertPreformattedToHTML(output)

    // Display time blocks with .timeBlock style
    output = convertTimeBlockToHTML(output)

    // Display strikethrough with .strikethrough style
    output = convertStrikethroughToHTML(output)

    // Display highlights with .code style
    output = convertHighlightsToHTML(output)

    // Replace blockID sync indicator with icon
    // NB: needs to go after #hashtag change above, as it includes a # marker for colors.
    output = convertNPBlockIDToHTML(output)

    // Strip `>today` and scheduled dates of form `>YYYY-MM-DD` that point to today
    output = stripTodaysDateRefsFromString(output)

    // Strip refs to this week (of form `>YYYY-Www`)
    output = stripThisWeeksDateRefsFromString(output)

    // Strip all `<YYYY-MM-DD` dates
    output = stripBackwardsDateRefsFromString(output)

    // add basic ***bolditalic*** styling
    // add basic **bold** or __bold__ styling
    // add basic *italic* or _italic_ styling
    output = convertBoldAndItalicToHTML(output)

    // Display underline with .underlined style
    output = convertUnderlinedToHTML(output)

    // Add suitable colouring to 'arrow' >date< items
    // (Needs to go before match on >date dates)
    let captures = output.match(RE_ARROW_DATES_G)
    if (captures) {
      clo(captures, 'results from arrow >date< match:')
      for (const capture of captures) {
        // output = output.replace(capture, `<span style="color: var(--tint-color);">${capture}</span>`)
        logDebug('makeParaContet...', `- making arrow date with ${capture}`)
        // Replace >date< with HTML link, aware that this will interrupt the <a>...</a> that will come around the whole string, and so it needs to make <a>...</a> regions for the rest of the string before and after the capture.
        const dateFilenamePart = capture.slice(1, -1)
        const noteTitleWithOpenAction = makeNoteTitleWithOpenActionFromNPDateStr(dateFilenamePart, thisItem.ID)
        output = output.replace(capture, `</a>${noteTitleWithOpenAction}<a class="content">`)
      }
    }

    // Add suitable colouring to remaining >date items
    captures = output.match(RE_SCHEDULED_DATES_G)
    if (captures) {
      // clo(captures, 'results from >date match:')
      for (const capture of captures) {
        output = output.replace(capture, `<span style="color: var(--tint-color);">${capture}</span>`)
      }
    }

    // Replace [[notelinks]] with HTML equivalent, and coloured
    // Note: needs to go after >date section above
    captures = output.match(/\[\[(.*?)\]\]/)
    if (captures) {
      // clo(captures, 'results from [[notelinks]] match:')
      for (const capturedTitle of captures) {
        // logDebug('makeParaContet...', `- making notelink with ${thisItem.filename}, ${capturedTitle}`)
        // Replace [[notelinks]] with HTML equivalent, aware that this will interrupt the <a>...</a> that will come around the whole string, and so it needs to make <a>...</a> regions for the rest of the string before and after the capture.
        const noteTitleWithOpenAction = makeNoteTitleWithOpenActionFromTitle(capturedTitle)
        output = output.replace(`[[${capturedTitle}]]`, `</a>${noteTitleWithOpenAction}<a>`)
      }
    }

    // Truncate the HTML string if wanted (avoiding breaking in middle of HTML tags)
    // Note: Best done before the note link is added
    if (truncateLength > 0 && thisItem.content.length > truncateLength) {
      output = truncateHTML(output, truncateLength, true)
    }

    // Now include an active link to the note, if 'noteTitle' is given
    if (noteTitle) {
      // logDebug('makeParaContet...', `- before '${noteLinkStyle}' for ${noteTitle} / {${output}}`)
      switch (noteLinkStyle) {
        case 'append': {
          output = `${addNoteOpenLinkToString(thisItem, output)} ${makeNoteTitleWithOpenActionFromFilename(thisItem, noteTitle)}`
          break
        }
        case 'all': {
          output = addNoteOpenLinkToString(thisItem, output)
          break
        }
      }
      // logDebug('makeParaContet...', `- after: '${noteLinkStyle}' for ${noteTitle} / {${output}}`)
    }

    // If we already know (from above) there's a !, !!, !!! or >> in the line add priorityN styling around the whole string. Where it is "working-on", it uses priority5.
    // Note: this wrapping needs to go last.
    if (taskPriority > 0) {
      output = `<span class="priority${String(taskPriority)}">${output}</span>`
    }

    // logDebug('makeParaContet...', `\n-> ${output}`)
    return output
  }
  catch (error) {
    logError('makeParaContentToLookLikeNPDisplayInHTML', error.message)
    return ''
  }
}

/**
 * Make an HTML link showing displayStr, but with href onClick event to show open the 'item' in editor and select the given line content
 * @param {SectionItem} item's details, with raw
 * @param {string} displayStr
 * @returns {string} transformed output
 */
export function addNoteOpenLinkToString(item: SectionItem | Section, displayStr: string): string {
  try {
    // Method 2: pass request back to plugin
    // TODO: is it right that this basically does nothing?
    // const filenameEncoded = encodeURIComponent(item.filename)

    if (item.rawContent) {
      // call showLineinEditor... with the filename and rawConetnt
      // return `<a class="" onClick="onClickDashboardItem('fake','showLineInEditorFromFilename','${filenameEncoded}','${encodeRFC3986URIComponent(item.rawContent)}')">${displayStr}</a>`
      // return `<a>${displayStr}</a>`
      return `${displayStr}`
    } else {
      // call showNoteinEditor... with the filename
      // return `<a class="" onClick="onClickDashboardItem('fake','showNoteInEditorFromFilename','${filenameEncoded}','')">${displayStr}</a>`
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
    return `<a class="noteTitle sectionItem" onClick="onClickDashboardItem({itemID: '${item.ID}', type: 'showNoteInEditorFromFilename', encodedFilename: '${encodeURIComponent(item.filename)}', encodedContent: ''})"><i class="fa-regular fa-file-lines pad-right"></i> ${noteTitle}</a>`
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
    return `<a class="noteTitle sectionItem" onClick="onClickDashboardItem({itemID:'fake', type:'showNoteInEditorFromTitle', encodedFilename:'${encodeURIComponent(noteTitle)}', encodedContent:''})"><i class="fa-regular fa-file-lines pad-right"></i> ${noteTitle}</a>`
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
    return `<a class="noteTitle sectionItem" onClick="onClickDashboardItem({itemID: '${itemID}', type: 'showNoteInEditorFromFilename', encodedFilename: '${encodeURIComponent(dateFilename)}', encodedContent: ''})"><i class="fa-regular fa-file-lines pad-right"></i> ${NPDateStr}</a>`
  }
  catch (error) {
    logError('makeNoteTitleWithOpenActionFromNPDateStr', `${error.message} for input '${NPDateStr}'`)
    return '(error)'
  }
}

/**
 * Extend the paragraph object with a .timeStr property which comes from the start time of a time block, or else 'none' (which will then sort after times)
 * Note: Not fully internationalised (but then I don't think the rest of NP accepts non-Western numerals)
 * @tests in dashboardHelpers.test.js
 * @param {Array<TParagraph>} paras to extend
 * @returns {Array<TParagraph>} paras extended by .timeStr
 */
export function extendParaToAddStartTime(paras: Array<TParagraph>): Array<any> {
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
 * FIXME: Change to makePluginCommandButton(...) calls throughout, then delete
 * Make HTML for a real button that is used to call  one of this plugin's commands.
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
  // const xcallbackURL = createRunPluginCallbackUrl(pluginName, commandName, commandArgs)
  // let output = (tooltipText)
  // ? `<button class="XCBButton tooltip"><a href="${xcallbackURL}">${buttonText}</a><span class="tooltiptext">${tooltipText}</span></button>`
  // : `<button class="XCBButton"><a href="${xcallbackURL}">${buttonText}</a></button>`
  const output = (tooltipText)
    // ? `<button class="XCBButton tooltip" data-tooltip="${tooltipText}" data-plugin-id="${pluginName}" data-command="${commandName}" data-command-args="${String(commandArgs)}">${buttonText}<span class="tooltiptext">${tooltipText}</span></button>`
    ? `<button class="XCBButton tooltip" data-tooltip="${tooltipText}" data-plugin-id="${pluginName}" data-command="${commandName}" data-command-args="${String(commandArgs)}">${buttonText}</button>`
    : `<button class="XCBButton" data-plugin-id="${pluginName}" data-command="${commandName}" data-command-args="${commandArgs}" >${buttonText}</button>`
  return output
}
