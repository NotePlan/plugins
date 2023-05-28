// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 31.3.2023 for v0.3.x by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { RE_EVENT_ID } from '@helpers/calendar'
import { getDateStringFromCalendarFilename, toLocaleTime } from '@helpers/dateTime'
import { prependTodoToCalendarNote } from '@helpers/NPParagraph'
import {
  RE_EVENT_LINK,
  RE_MARKDOWN_LINKS_CAPTURE_G,
  RE_SCHEDULED_DATES_G,
  RE_SYNC_MARKER
} from '@helpers/regex'
import { getLineMainContentPos } from '@helpers/search'
import { getNumericPriority } from '@helpers/sorting'
import {
  changeBareLinksToHTMLLink,
  changeMarkdownLinksToHTMLLink,
  encodeRFC3986URIComponent,
  stripBackwardsDateRefsFromString,
  stripThisWeeksDateRefsFromString,
  stripTodaysDateRefsFromString
} from '@helpers/stringTransforms'
import { showMessage } from '@helpers/userInput'
import { showMessageYesNo } from '@helpers/userInput'
import { toLocaleDateTimeString } from "../../helpers/NPdateTime";

//-----------------------------------------------------------------
// Data types

// details for a section heading
export type SectionDetails = {
  ID: number,
  name: string,
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
  separateSectionForReferencedNotes: boolean,
  ignoreTasksWithPhrase: string,
  ignoreFolders: Array<string>,
  includeFolderName: boolean,
  includeTaskContext: boolean,
  // filterPriorityItems: boolean,
  _logLevel: string,
  triggerLogging: boolean,
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
    logDebug(pluginJson, `filter? savedValue: ${String(savedValue)}`)
    if (!savedValue) {
      DataStore.setPreference('Dashboard-filterPriorityItems', false)
    }
    logDebug(pluginJson, `filter? -> ${DataStore.preference('Dashboard-filterPriorityItems')}`)
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
 * - turns NP sync ids -> blue asterisk icon
 * - turns #hashtags and @mentions the colour that the theme displays them
 * - turns >date markers the colour that the theme displays them
 * Further, if noteTitle is supplied, then either 'append' it as a active NP note title, or make it the active NP note link for 'all' the string.
 * @author @jgclark
 * @param {SectionItem} thisItem
 * @param {string?} noteTitle
 * @param {string?} noteLinkStyle: "append" or "all"
 * @returns {string} altered string
 */
export function makeParaContentToLookLikeNPDisplayInHTML(thisItem: SectionItem, noteTitle: string = "", noteLinkStyle: string = "all"): string {
  try {
    // logDebug(`makeParaCTLLNPDIH`, `for '${thisItem.ID}' / noteTitle '${noteTitle}' filename '${thisItem.filename}'`)
    // Start with the content of the item
    let output = thisItem.content

    if (noteTitle === '(error)') {
      logError('makeParaCTLLNDIH', `starting with noteTitle '(error)' for '${thisItem.content}'`)
    }

    // TODO: Simplify NP event links
    // of the form `![📅](2023-01-13 18:00:::F9766457-9C4E-49C8-BC45-D8D821280889:::NA:::Contact X about Y:::#63DA38)`
    let captures = output.match(RE_EVENT_LINK)
    if (captures) {
      clo(captures, 'results from NP event link matches:')
      // Matches come in threes (plus full match), so process four at a time
      for (let c = 0; c < captures.length; c = c + 3) {
        const eventLink = captures[c]
        const eventTitle = captures[c + 1]
        const eventColor = captures[c + 2]
        output = output.replace(eventLink, `<i class="fa-regular fa-calendar" style="color: ${eventColor}"></i> <span class="event-link">${eventTitle}</span>`)
      }
    }

    // Display markdown links of the form [title](URI) as HTML links
    output = changeMarkdownLinksToHTMLLink(output)

    // Display bare URLs as HTML links
    output = changeBareLinksToHTMLLink(output)

    // Display hashtags with .hashtag style
    // Note: need to make only one capture group, and use 'g'lobal flag
    // captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!#[\d[:punct:]]+(\s|$))(#([^[:punct:]\s]|[\-_\/])+?\(.*?\)|#([^[:punct:]\s]|[\-_\/])+)/) // regex from @EduardMe's file
    // captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!#[\d\'\"]+(\s|$))(#([^\'\"\s]|[\-_\/])+?\(.*?\)|#([^\'\"\s]|[\-_\/])+)/) // regex from @EduardMe's file without :punct:
    captures = output.match(/(?:\s|^|\"|\(|\)|\')(#[A-Za-z]\w*)/g) // my too-simple version [needs to allow starting digit, just not all digits]
    // captures = output.match(HASHTAG_STR_FOR_JS) // TODO: from EM
    if (captures) {
      // clo(captures, 'results from hashtag matches:')
      for (const capture of captures) {
        const match = capture.slice()
        output = output.replace(match, `<span class="hashtag">${match}</span>`)
      }
    }

    // Display mentions with .attag style
    // Note: need to make only one capture group, and use 'g'lobal flag
    // captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!@[\d[:punct:]]+(\s|$))(@([^[:punct:]\s]|[\-_\/])+?\(.*?\)|@([^[:punct:]\s]|[\-_\/])+)/) // regex from @EduardMe's file
    // captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!@[\d\`\"]+(\s|$))(@([^\`\"\s]|[\-_\/])+?\(.*?\)|@([^\`\"\s]|[\-_\/])+)/) // regex from @EduardMe's file, without [:punct:]
    captures = output.match(/(?:\s|^|\"|\(|\)\')(@[A-Za-z][\w\d\.\-\(\)]*)/g) // my too-simple version
    // captures = output.match(NP_RE_attag_G) // TODO: from EM
    if (captures) {
      // clo(captures, 'results from mention matches:')
      for (const capture of captures) {
        const match = capture.slice()
        output = output.replace(match, `<span class="attag">${match}</span>`)
      }
    }

    // Replace blockID sync indicator with icon
    // NB: needs to go after #hashtag change above, as it includes a # marker for colors.
    captures = output.match(RE_SYNC_MARKER)
    if (captures) {
      // clo(captures, 'results from RE_SYNC_MARKER match:')
      for (const capture of captures) {
        output = output.replace(capture, '<i class="fa-solid fa-asterisk" style="color: #71b3c0;"></i>')
      }
    }

    // Strip `>today` and scheduled dates of form `>YYYY-MM-DD` that point to today
    output = stripTodaysDateRefsFromString(output)

    // Strip refs to this week (of form `>YYYY-Www`)
    output = stripThisWeeksDateRefsFromString(output)

    // Strip all `<YYYY-MM-DD` dates
    output = stripBackwardsDateRefsFromString(output)

    // TODO: add basic ***bolditalic*** styling

    // TODO: add basic **bold** styling

    // TODO: add basic _italic_ styling

    // Add suitable colouring to remaining >date items
    // Note: This is my attempt at finding all scheduled date links
    // TODO(@EduardMe): send us his version of this
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
        // logDebug('makeParaCTLLNDIH', `- making notelink with ${thisItem.filename}, ${capture}`)
        const noteTitleWithOpenAction = makeNoteTitleWithOpenActionFromTitle(capturedTitle)
        output = output.replace('[[' + capturedTitle + ']]', noteTitleWithOpenAction)
      }
    }

    // Now include an active link to the note, if 'noteTitle' is given
    if (noteTitle) {
      // logDebug('makeParaContet...', `- before '${noteLinkStyle}' for <${noteTitle}> ${output}`)
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
      // logDebug('makeParaContet...', `- after:  ${output}`)
    }

    // If there's a ! !! or !!! add priorityN styling
    // (Simpler regex possible as the count comes later)
    // Note: this wrapping needs to go last
    const numExclamations = getTaskPriority(output)
    switch (numExclamations) {
      case 1: {
        output = '<span class="priority1">' + output + '</span>'
        break
      }
      case 2: {
        output = '<span class="priority2">' + output + '</span>'
        break
      }
      case 3: {
        output = '<span class="priority3">' + output + '</span>'
        break
      }
    }

    return output
  }
  catch (error) {
    logError('makeParaContentToLookLikeNPDisplayInHTML', `${error.name} ${error.message}`)
    return ''
  }
}

export function getTaskPriority(content: string): number {
  let numExclamations = 0
  if (content.match(/\B\!+\B/)) {
    // $FlowFixMe(incompatible-use)
    numExclamations = content.match(/\B\!+\B/)[0].length
  }
  return numExclamations
}

/**
 * v2: Make an HTML link showing displayStr, but with href onClick event to show open the 'item' in editor and select the given line content
 * v1: Used to use x-callback method to open a Note (via its 'noteTitle' parameter)
 * @param {SectionItem} item's details, with raw
 * @param {string} displayStr
 * @returns {string} transformed output
 */
export function addNoteOpenLinkToString(item: SectionItem | SectionDetails, displayStr: string): string {
  try {
    // Method 1: x-callback
    // return `<a href="noteplan://x-callback-url/openNote?noteTitle=${titleEncoded}">${displayStr}</a>`

    // Method 2: pass request back to plugin
    const filenameEncoded = encodeURIComponent(item.filename)

    if (item.rawContent) {
      // call showLineinEditor... with the filename and rawConetnt
      return `<a class="" onClick="onClickDashboardItem('fake','showLineInEditorFromFilename','${filenameEncoded}','${encodeRFC3986URIComponent(item.rawContent)}')">${displayStr}</a>`
    } else {
      // call showNoteinEditor... with the filename
      return `<a class="" onClick="onClickDashboardItem('fake','showNoteInEditorFromFilename','${filenameEncoded}','')">${displayStr}</a>`
    }
  }
  catch (error) {
    logError('addNoteOpenLinkToString', `${error.message} for input '${displayStr}'`)
    return '(error)'
  }
}

/**
 * v2: Wrap string with href onClick event to show note in editor
 * v1: Used to use x-callback method to open a Note (via ite 'noteTitle')
 * @param {SectionItem} item's details
 * @param {string} noteTitle
 * @returns {string} output
 */
export function makeNoteTitleWithOpenActionFromFilename(item: SectionItem, noteTitle: string): string {
  try {
    logDebug('makeNoteTitleWithOpenActionFromFilename', `- making notelink with ${item.filename}, ${noteTitle}`)
    // Method 1: x-callback
    // const titleEncoded = encodeURIComponent(noteTitle)
    // return `<span class="noteTitle sectionItem"><i class="fa-regular fa-file-lines"></i> <a href="noteplan://x-callback-url/openNote?noteTitle=${titleEncoded}">${noteTitle}</a></span>`

    // Method 2: pass request back to plugin
    // Note: not passing rawContent (param 4) as its not needed
    return `<a class="noteTitle sectionItem" onClick="onClickDashboardItem('${item.ID}','showNoteInEditorFromFilename','${item.filename}','')"><i class="fa-regular fa-file-lines"></i> ${noteTitle}</a>`
  }
  catch (error) {
    logError('makeNoteTitleWithOpenActionFromFilename', `${error.message} for input '${noteTitle}'`)
    return '(error)'
  }
}

/**
 * Wrap string with href onClick event to show note in editor
 * Note: based only on 'noteTitle', not a filename
 * @param {string} noteTitle
 * @returns {string} output
 */
export function makeNoteTitleWithOpenActionFromTitle(noteTitle: string): string {
  try {
    logDebug('makeNoteTitleWithOpenActionFromTitle', `- making notelink from ${noteTitle}`)
    // Pass request back to plugin
    // Note: not passing rawContent (param 4) as its not needed
    return `<a class="noteTitle sectionItem" onClick="onClickDashboardItem('fake','showNoteInEditorFromTitle','${encodeURIComponent(noteTitle)}','')"><i class="fa-regular fa-file-lines"></i> ${noteTitle}</a>`
  }
  catch (error) {
    logError('makeNoteTitleWithOpenActionFromTitle', `${error.message} for input '${noteTitle}'`)
    return '(error)'
  }
}
