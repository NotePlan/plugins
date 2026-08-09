// @flow
//-----------------------------------------------------------------------------
// Refresh saved search on note open (and via Re-run link parsing).
// Jonathan Clark
// Last updated 2026-08-09 for v3.0.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  quickSearch,
  searchOverAll,
  searchOverCalendar,
  searchOverNotes,
  searchOpenTasks,
  searchPeriod
} from './saveSearch'
import { getSearchCommandName, isKnownSearchCommand } from './searchCommandRegistry'
import { clo, logDebug, logInfo, logError, logWarn } from '@helpers/dev'

// Match both current "Re-run search" label and older "Refresh ..." links
const REFRESH_BUTTON_LABEL_RE = /(Re-run search|Refresh )/

/**
 * Dispatch re-run by plugin command name (or legacy originator/js name).
 * Handlers take the same arg order as x-callback / registry layouts.
 * @param {string} commandOrOriginator
 * @param {Array<string>} args unpacked arg0..argN
 * @returns {Promise<void>}
 */
async function dispatchSearchCommand(commandOrOriginator: string, args: Array<string>): Promise<void> {
  const commandName = getSearchCommandName(commandOrOriginator)
  const [arg0 = '', arg1 = '', arg2 = '', arg3 = '', arg4 = '', arg5 = ''] = args

  // Map official command names (and any unknown fallthroughs after normalize)
  switch (commandName) {
    case 'search':
      await searchOverAll(arg0, arg1, arg2, arg3)
      return
    case 'searchOverCalendar':
      await searchOverCalendar(arg0, arg1, arg2, arg3)
      return
    case 'searchOverNotes':
      await searchOverNotes(arg0, arg1, arg2, arg3)
      return
    case 'searchOpenTasks':
      await searchOpenTasks(arg0, arg1, arg2, arg3)
      return
    case 'searchInPeriod':
      await searchPeriod(arg0, arg1, arg2, arg3, arg4, arg5)
      return
    case 'quickSearch':
      await quickSearch(arg0, arg1, arg2, arg3)
      return
    default:
      throw new Error(`Unknown search command for re-run: '${commandOrOriginator}' (resolved '${commandName}')`)
  }
}

/**
 * Parses a URL string and returns an object of key-value pairs of the URL parameters.
 * @param {string} query - The URL string to parse.
 * @returns {Object<string, string>} An object containing the key-value pairs from the URL parameters.
 */
function getUrlParams(query: string): { [key: string]: string } {
  const search = /([^&=]+)=?([^&]*)/g
  let match: RegExp$matchResult | null
  const decode = function (s: string) {
    return decodeURIComponent(s.replace(/\+/g, " "))
  }
  const urlParams: { [key: string]: string } = {}
  while ((match = search.exec(query)) !== null) {
    if (match != null && match.length >= 3) {
      urlParams[decode(match[1])] = decode(match[2])
      console.log(`Found param: ${decode(match[1])} / ${decode(match[2])}`)
    }
  }
  clo(urlParams)
  return urlParams
}

/**
 * Refresh the saved search results in the note, if the note has a suitable x-callback re-run/refresh button.
 * Designed to be called by an onOpen trigger.
 */
export async function refreshSavedSearch(): Promise<void> {
  try {
    if (!(Editor.content && Editor.note)) {
      logWarn(pluginJson, `Cannot get Editor details. Please open a note.`)
      return
    }
    const noteReadOnly: CoreNoteFields = Editor.note

    // Check to see if this has been called in the last 5000ms: if so don't proceed, as this could be a double call, which could lead to an infinite loop
    const timeSinceLastEdit: number = Number(Date.now()) - Number(noteReadOnly.versions[0].date)
    if (timeSinceLastEdit <= 5000) {
      logDebug(pluginJson, `refreshSavedSearch fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the note was last updated`)
      return
    }

    logDebug(pluginJson, `refreshSavedSearch triggered for '${noteReadOnly.filename}'`)
    const refreshButtonLines = noteReadOnly.paragraphs.filter(p =>
      REFRESH_BUTTON_LABEL_RE.test(p.content)
      && /noteplan:\/\/x\-callback\-url\/runPlugin\?pluginID=jgclark\.SearchExtensions&/.test(p.content)
    )
    if (refreshButtonLines?.length === 0) {
      logInfo(pluginJson, 'Note has no suitable Re-run/Refresh button')
      return
    }

    const firstLine = refreshButtonLines[0].content
    logDebug(pluginJson, `Note has a suitable Re-run/Refresh button line: {${firstLine}}`)

    const matchArr = firstLine.match(/noteplan:\/\/[^\s\)]*/)
    if (!matchArr || matchArr.length === 0) {
      logWarn(pluginJson, 'No noteplan callback URL found in the Re-run/Refresh button line.')
      return
    }
    const firstNPCallbackURLInLine = matchArr[0]
    logDebug(pluginJson, `firstNPCallbackURLInLine: {${firstNPCallbackURLInLine}}`)
    const params = getUrlParams(firstNPCallbackURLInLine)
    const cmdName = params.command ?? ''
    const args = [
      params.arg0 ?? '',
      params.arg1 ?? '',
      params.arg2 ?? '',
      params.arg3 ?? '',
      params.arg4 ?? '',
      params.arg5 ?? '',
    ]

    if (!isKnownSearchCommand(cmdName) && !isKnownSearchCommand(getSearchCommandName(cmdName))) {
      logWarn(pluginJson, `refreshSavedSearch: unrecognised command '${String(cmdName)}'`)
      return
    }

    await CommandBar.showLoading(true, 'Refreshing search results ...')
    try {
      await CommandBar.onAsyncThread()
      await dispatchSearchCommand(cmdName, args)
    } finally {
      await CommandBar.onMainThread()
      await CommandBar.showLoading(false)
    }
  }
  catch (error) {
    logError(pluginJson, `${error.name}: ${error.message}`)
  }
}
