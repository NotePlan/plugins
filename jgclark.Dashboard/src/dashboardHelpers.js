// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 2.8.2023 for v0.6.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { RE_EVENT_ID } from '@helpers/calendar'
import { trimString } from '@helpers/dataManipulation'
import { getDateStringFromCalendarFilename, toLocaleTime } from '@helpers/dateTime'
import { prependTodoToCalendarNote } from '@helpers/NPParagraph'
import { isTermInURL } from '@helpers/paragraph'
import {
  RE_EVENT_LINK,
  RE_MARKDOWN_LINKS_CAPTURE_G,
  RE_NOTELINK_G,
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

// details for a section
export type Section = {
  ID: number,
  name: string, // 'Today', 'This Week', 'This Month' ... 'Projects', 'Done'
  dateType: '' | 'D' | 'W' | 'M' | 'Q' | 'Y',
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
  autoAddTrigger: boolean,
  excludeTasksWithTimeblocks: boolean,
  excludeChecklistsWithTimeblocks: boolean,
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
 * - turns NP sync ids -> blue asterisk icon
 * - turns #hashtags and @mentions the colour that the theme displays them
 * - turns >date markers the colour that the theme displays them
 * Further, if noteTitle is supplied, then either 'append' it as a active NP note title, or make it the active NP note link for 'all' the string.
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
    logDebug(`makeParaContent...`, `for '${thisItem.ID}' / noteTitle '${noteTitle}' / filename '${thisItem.filename}'`)
    // Start with the content of the item
    let output = thisItem.content

    if (noteTitle === '(error)') {
      logError('makeParaContent...', `starting with noteTitle '(error)' for '${thisItem.content}'`)
    }

    // Simplify NP event links
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

    // Simplify embedded images of the form ![image](...) by replacing with an icon.
    // (This also helps remove false positives for ! priority indicator)
    captures = output.match(/!\[image\]\([^\)]+\)/g)
    if (captures) {
      clo(captures, 'results from embedded image match:')
      for (const capture of captures) {
        output = output.replace(capture, `<i class="fa-regular fa-image"></i> `)
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
    captures = output.match(/\B(?:#|＃)((?![\p{N}_]+(?:$|\b|\s))(?:[\p{L}\p{M}\p{N}_]{1,60}))/ug) // copes with Unicode characters, with help from https://stackoverflow.com/a/74926188/3238281
    // captures = output.match(HASHTAG_STR_FOR_JS) // TODO: from EM
    if (captures) {
      // clo(captures, 'results from hashtag matches:')
      for (const capture of captures) {
        logDebug('makeParaContet...', `capture: ${capture}`)
        if (!isTermInNotelinkOrURI(output, capture)) {
          output = output.replace(capture, `<span class="hashtag">${capture}</span>`)
        }
      }
    }

    // Display mentions with .attag style
    // Note: need to make only one capture group, and use 'g'lobal flag
    // captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!@[\d[:punct:]]+(\s|$))(@([^[:punct:]\s]|[\-_\/])+?\(.*?\)|@([^[:punct:]\s]|[\-_\/])+)/) // regex from @EduardMe's file
    // captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!@[\d\`\"]+(\s|$))(@([^\`\"\s]|[\-_\/])+?\(.*?\)|@([^\`\"\s]|[\-_\/])+)/) // regex from @EduardMe's file, without [:punct:]
    captures = output.match(/\B@((?![\p{N}_]+(?:$|\b|\s))(?:[\p{L}\p{M}\p{N}_]{1,60}))/ug) // copes with Unicode characters, with help from https://stackoverflow.com/a/74926188/3238281
    // captures = output.match(NP_RE_attag_G) // TODO: from EM
    if (captures) {
      clo(captures, 'results from mention matches:')
      for (const capture of captures) {
        const match = capture//[2] // part from @
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

    // add basic ***bolditalic*** styling
    const RE_BOLD_ITALIC_PHRASE = new RegExp(/\*\*\*\b(.*?)\b\*\*\*/, "g")
    captures = output.matchAll(RE_BOLD_ITALIC_PHRASE)
    if (captures) {
      for (const capture of captures) {
        // logDebug('makeParaContet...', `- making bold-italic with [${String(capture)}]`)
        output = output.replace(capture[0], `<b><i>${capture[1]}</i></b>`)
      }
    }

    // add basic **bold** or __bold__ styling
    const RE_BOLD_PHRASE = new RegExp(/([_\*]{2})([^_*]+?)\1/, "g")
    captures = output.matchAll(RE_BOLD_PHRASE)
    if (captures) {
      for (const capture of captures) {
        // logDebug('makeParaContet...', `- making bold with [${String(capture)}]`)
        output = output.replace(capture[0], `<b>${capture[2]}</b>`)
      }
    }

    // add basic *italic* or _italic_ styling
    // Note: uses a simplified regex that needs to come after bold above
    const RE_ITALIC_PHRASE = new RegExp(/([_\*])([^*]+?)\1/, "g")
    captures = output.matchAll(RE_ITALIC_PHRASE)
    if (captures) {
      for (const capture of captures) {
        // logDebug('makeParaContet...', `- making italic with [${String(capture)}]`)
        output = output.replace(capture[0], `<i>${capture[2]}</i>`)
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
      for (let capturedTitle of captures) {
        logDebug('makeParaContet...', `- making notelink with ${thisItem.filename}, ${capturedTitle}`)
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
      logDebug('makeParaContet...', `- after: '${noteLinkStyle}' for ${noteTitle} / {${output}}`)
    }

    // If there's a ! !! or !!! add priorityN styling around the whole string. Note: this wrapping needs to go last.
    // (Simpler regex possible as the count comes later)
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
      default: {
        // Don't do anything
        break
      }
    }

    // logDebug('makeParaContet...', `\n-> ${output}`)
    return output
  }
  catch (error) {
    logError('makeParaContentToLookLikeNPDisplayInHTML', error.message)
    return ''
  }
}

function truncateHTML(html: string, maxLength: number, dots: boolean = true): string {
  let holdCounter = false
  let truncatedHTML = ''
  let limit = maxLength
  for (let index = 0; index < html.length; index++) {
    if (!limit || limit === 0) {
      break
    }
    if (html[index] == '<') {
      holdCounter = true
    }
    if (!holdCounter) {
      limit--
    }
    if (html[index] == '>') {
      holdCounter = false
    }
    truncatedHTML += html[index]
  }
  if (dots) {
    truncatedHTML = truncatedHTML + ' …'
  }
  // logDebug('truncateHTML', `{${html}} -> {${truncatedHTML}}`)
  return truncatedHTML
}


/**
 * Get number of consecutive '!' in 'content' that aren't at the start/end/middle of a word, or preceding a '['
 * @param {string} content
 * @returns number of !
 */
export function getTaskPriority(content: string): number {
  let numExclamations = 0
  if (content.match(/\B\!+\B(?!\[)/)) {
    // $FlowFixMe(incompatible-use)
    numExclamations = content.match(/\B\!+\B/)[0].length
  }
  return numExclamations
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
      return `<a>${displayStr}</a>`
    } else {
      // call showNoteinEditor... with the filename
      // return `<a class="" onClick="onClickDashboardItem('fake','showNoteInEditorFromFilename','${filenameEncoded}','')">${displayStr}</a>`
      return `<a>${displayStr}</a>`
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
    logDebug('makeNoteTitleWithOpenActionFromFilename', `- making notelink with ${item.filename}, ${noteTitle}`)
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
    logDebug('makeNoteTitleWithOpenActionFromTitle', `- making notelink from ${noteTitle}`)
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
 * Is 'term' (typically a #tag) found in [[...]] or a URL in a string which may contain 0 or more notelinks and URLs?
 * @param {string} input
 * @param {string} term
 * @returns {boolean} true if found
 */
export function isTermInNotelinkOrURI(input: string, term: sting): boolean {
  if (term === '') {
    logDebug(`isTermInNotelinkOrURI`, `empty search term`)
    return false
  }
  if (input === '') {
    logDebug(`isTermInNotelinkOrURI`, `empty input string to search`)
    return false
  }
  // Where is the term in the input?
  const index = input.indexOf(term)
  if (index < 0) {
    logDebug(`isTermInNotelinkOrURI`, `term ${term} not found in'${input}'`)
    return false
  }
  // Find any [[...]] ranges
  let matches = input.matchAll(RE_NOTELINK_G)
  if (matches) {
    for (const match of matches) {
      clo(match)
      let rangeStart = match.index
      let rangeEnd = match.index + match[0].length
      logDebug(`isTermInNotelinkOrURI`, `[[...]] range: ${String(rangeStart)}-${String(rangeEnd)}`)
      if (index >= rangeStart && index <= rangeEnd) {
        return true
      }
    }
  }
  // Check for URL ranges. Following isn't perfect, but close enough for URLs on their own or in a [markdown](link).
  return isTermInURL(term, input)
}

/** tests for above function */
function testTermInNotelinkOrURI() {
  logDebug('test1 -> false', String(isTermInNotelinkOrURI('[[link with#tag]] but empty search term', '')))
  logDebug('test2 -> true', String(isTermInNotelinkOrURI('[[link with#tag]]', '#tag')))
  logDebug('test3 -> false', String(isTermInNotelinkOrURI('[[link without that tag]]', '#tag')))
  logDebug('test4 -> false', String(isTermInNotelinkOrURI('string has #tag [[but link without]]', '#tag')))
  logDebug('test5 -> false', String(isTermInNotelinkOrURI('string has [[but link without]] and  #tag after', '#tag')))
  logDebug('test6 -> true', String(isTermInNotelinkOrURI('term is in URL http://bob.com/page#tag', '#tag')))
  logDebug('test7 -> false', String(isTermInNotelinkOrURI('string has http://bob.com/page #tag', '#tag')))
  logDebug('test8 -> false', String(isTermInNotelinkOrURI('string has #tag before not in http://bob.com/URL', '#tag')))
}
