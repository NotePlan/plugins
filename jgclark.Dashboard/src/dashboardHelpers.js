// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 16.12.2023 for v0.7.4 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { RE_EVENT_ID } from '@helpers/calendar'
import { trimString } from '@helpers/dataManipulation'
import {
  // getDateStringFromCalendarFilename,
  getAPIDateStrFromDisplayDateStr,
  toLocaleTime
} from '@helpers/dateTime'
// import { toLocaleDateTimeString } from "@helpers/NPdateTime"
import {
  simplifyNPEventLinksForHTML,
  simplifyInlineImagesForHTML,
  convertHashtagsToHTML,
  convertMentionsToHTML,
  convertPreformattedToHTML,
  convertStrikethroughToHTML,
  convertUnderlinedToHTML,
  convertHighlightsToHTML,
  convertNPBlockIDToHTML,
  convertBoldAndItalicToHTML,
  truncateHTML
} from '@helpers/HTMLView'
import { prependTodoToCalendarNote } from '@helpers/NPParagraph'
import {
  getTaskPriority,
  isTermInNotelinkOrURI,
  isTermInURL,
  removeTaskPriorityIndicators,
} from '@helpers/paragraph'
import {
  RE_ARROW_DATES_G,
  RE_MARKDOWN_LINKS_CAPTURE_G,
  RE_SCHEDULED_DATES_G,
} from '@helpers/regex'
import { getNumericPriority } from '@helpers/sorting'
import {
  changeBareLinksToHTMLLink,
  changeMarkdownLinksToHTMLLink,
  encodeRFC3986URIComponent,
  stripBackwardsDateRefsFromString,
  stripThisWeeksDateRefsFromString,
  stripTodaysDateRefsFromString
} from '@helpers/stringTransforms'
import { showMessage, showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------
// Data types

// details for a section
export type Section = {
  ID: number,
  name: string, // 'Today', 'This Week', 'This Month' ... 'Projects', 'Done'
  sectionType: '' | 'DT' | 'DY' | 'W' | 'M' | 'Q' | 'Y' | 'OVERDUE' | 'TAG' | 'PROJ', // where DT = today, DY = yesterday, TAG = Tag, PROJ = Projects section
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
  autoAddTrigger: boolean,
  excludeChecklistsWithTimeblocks: boolean,
  excludeTasksWithTimeblocks: boolean,
  showYesterdaySection: boolean,
  showWeekSection: boolean,
  showMonthSection: boolean,
  showQuarterSection: boolean,
  showOverdueTaskSection: boolean,
  updateOverdueOnTrigger: boolean,
  maxTasksToShowInSection: number,
  overdueSortOrder: string,
  // showExtraButtons: boolean, // removed in 0.7.5
  tagToShow: string,
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
 * Alter the provided paragraph's content to display suitably in HTML to mimic NP native display of markdown (as best we can). Currently this:
 * - simplifies NP event links, and tries to colour them
 * - turns MD links -> HTML links
 * - truncates the display of raw URLs if necessary
 * - turns NP sync ids -> blue asterisk icon
 * - turns #hashtags and @mentions the colour that the theme displays them
 * - turns >date markers the colour that the theme displays them
 * - truncates the overall string if necessary
 * - styles in bold/italic
 * - if noteTitle is supplied, then either 'append' it as a active NP note title, or make it the active NP note link for 'all' the string.
 * Note: the actual note link is added following load by adding click handler to all items with class "sectionItemContent" (which already have a basic <a>...</a> wrapper).
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
        output = output.replace(capture, '</a>' + noteTitleWithOpenAction + '<a class="content">')
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
        output = output.replace('[[' + capturedTitle + ']]', '</a>' + noteTitleWithOpenAction + '<a>')
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
          output = addNoteOpenLinkToString(thisItem, output) + ' ' + makeNoteTitleWithOpenActionFromFilename(thisItem, noteTitle)
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
      output = '<span class="priority' + String(taskPriority) + '">' + output + '</span>'
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
    const filenameEncoded = encodeURIComponent(item.filename)

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
    return `<a class="noteTitle sectionItem" onClick="onClickDashboardItem({itemID: '${item.ID}', type: 'showNoteInEditorFromFilename', encodedFilename: '${encodeURIComponent(item.filename)}', encodedContent: ''})"><i class="fa-regular fa-file-lines"></i> ${noteTitle}</a>`
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
    return `<a class="noteTitle sectionItem" onClick="onClickDashboardItem({itemID:'fake', type:'showNoteInEditorFromTitle', encodedFilename:'${encodeURIComponent(noteTitle)}', encodedContent:''})"><i class="fa-regular fa-file-lines"></i> ${noteTitle}</a>`
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
    const dateFilename = getAPIDateStrFromDisplayDateStr(NPDateStr) + "." + DataStore.defaultFileExtension
    // logDebug('makeNoteTitleWithOpenActionFromNPDateStr', `- making notelink with ${NPDateStr} / ${dateFilename}`)
    // Pass request back to plugin, as a single object
    return `<a class="noteTitle sectionItem" onClick="onClickDashboardItem({itemID: '${itemID}', type: 'showNoteInEditorFromFilename', encodedFilename: '${encodeURIComponent(dateFilename)}', encodedContent: ''})"><i class="fa-regular fa-file-lines"></i> ${NPDateStr}</a>`
  }
  catch (error) {
    logError('makeNoteTitleWithOpenActionFromNPDateStr', `${error.message} for input '${NPDateStr}'`)
    return '(error)'
  }
}
