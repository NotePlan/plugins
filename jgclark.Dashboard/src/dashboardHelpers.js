// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions
// Last updated 15.1.2023 for v0.1.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { RE_DATE_TIME } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { RE_EVENT_ID } from '@helpers/calendar'
import {
  // NP_RE_attag_G,
  // NP_RE_hashtag_G,
  RE_EVENT_LINK,
  RE_MARKDOWN_LINKS_CAPTURE_G,
  RE_SCHEDULED_DATES_G,
  RE_SYNC_MARKER
} from '@helpers/regex'
import {
  changeMarkdownLinkToHTMLLink,
  stripBackwardsDateRefsFromString,
  stripThisWeeksDateRefsFromString,
  stripTodaysDateRefsFromString
} from '@helpers/stringTransforms'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------
// Settings

const pluginID = 'jgclark.Dashboard'

export type dashboardConfigType = {
  includeFolderName: boolean,
  includeTaskContext: boolean,
  _logLevel: string,
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
      await showMessage(
        `Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`,
      )
      return
    } else {
      // clo(config, `settings`)
      return config
    }
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
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
 * @author @jgclark
 * @param {string} original 
 * @returns {string} altered string
 */
export function makeParaContentToLookLikeNPDisplayInHTML(original: string): string {
  try {
    let output = original

    // TODO: Simplify NP event links
    // of the form `![📅](2023-01-13 18:00:::F9766457-9C4E-49C8-BC45-D8D821280889:::NA:::Contact X about Y:::#63DA38)`
    let captures = output.match(RE_EVENT_LINK)
    if (captures) {
      clo(captures, 'results from NP event link matches:')
      // Matches come in threes (plus full match), so process four at a time
      for (let c = 0; c < captures.length; c = c + 3) {
        const eventLink = captures[c]
        // const eventID = captures[c + 1]
        const eventTitle = captures[c + 1]
        const eventColor = captures[c + 2]
        output = output.replace(eventLink, `<i class="fa-regular fa-calendar" style="color: ${eventColor}"></i> <span class="event-link">${eventTitle}</span>`)
      }
    }

    // Simplify markdown links
    // of the form [title](URI)
    output = changeMarkdownLinkToHTMLLink(output)

    // Display hashtags with .hashtag style
    // Note: need to make only one capture group, and use 'g'lobal flag
    // captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!#[\d[:punct:]]+(\s|$))(#([^[:punct:]\s]|[\-_\/])+?\(.*?\)|#([^[:punct:]\s]|[\-_\/])+)/) // regex from @EduardMe's file
    // captures = output.match(/(\s|^|\"|\'|\(|\[|\{)(?!#[\d\'\"]+(\s|$))(#([^\'\"\s]|[\-_\/])+?\(.*?\)|#([^\'\"\s]|[\-_\/])+)/) // regex from @EduardMe's file without :punct:
    captures = output.match(/(?:\s|^|\"|\(|\)|\')(#[A-Za-z]\w*)/g) // my too-simple version [needs to allow starting digit, just not all digits]
    // captures = output.match(HASHTAG_STR_FOR_JS) // TODO: from EM
    if (captures) {
      clo(captures, 'results from hashtag matches:')
      for (const capture of captures) {
        const match = capture.slice(1)
        // logDebug('hashtag match', match)
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
      clo(captures, 'results from mention matches:')
      for (const capture of captures) {
        const match = capture.slice(1)
        // logDebug('mention match', match)
        output = output.replace(match, `<span class="attag">${match}</span>`)
      }
    }

    // Replace blockID sync indicator with icon
    // NB: needs to go after #hashtag change above, as it includes a # marker for colors.
    captures = output.match(RE_SYNC_MARKER)
    if (captures) {
      clo(captures, 'results from RE_SYNC_MARKER match:')
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
      clo(captures, 'results from [[notelinks]] match:')
      for (const capture of captures) {
        const noteTitleWithOpenAction = makeNoteTitleWithOpenAction(capture)
        output = output.replace('[[' + capture + ']]', noteTitleWithOpenAction)
      }
    }

    return output
  }
  catch (error) {
    logError(pluginJson, `${error.name} ${error.message}`)
    return ''
  }
}


/**
 * Include note titles as buttons with x-callback open action
 * @param {string} title 
 * @returns {string} output
 */
export function makeNoteTitleWithOpenAction(title: string): string {
  const titleEncoded = encodeURIComponent(title)
  return `<span class="noteTitle sectionItem"><i class="fa-regular fa-file-lines"></i> <a href="noteplan://x-callback-url/openNote?noteTitle=${titleEncoded}">${title}</a></span>`
}
