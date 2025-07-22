// @flow
//-----------------------------------------------------------------------------
// Create list of occurrences of note paragraphs with specified strings, which
// can include #hashtags or @mentions, or other arbitrary strings (but not regex).
// Jonathan Clark
// Last updated 2025-03-21 for v2.0.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { quickSearch, searchOverAll, searchOverCalendar, searchOverNotes, searchOpenTasks, searchPeriod } from './saveSearch'
// import { searchPeriod } from './saveSearchPeriod'
import { clo, logDebug, logInfo, logError, logWarn } from '@helpers/dev'

/**
 * Parses a URL string and returns an object of key-value pairs of the URL parameters.
 *
 * @param {string} query - The URL string to parse.
 * @returns {Object<string, string>} An object containing the key-value pairs from the URL parameters.
 */
function getUrlParams(query: string): { [key: string]: string } {
  const search = /([^&=]+)=?([^&]*)/g
  let match
  const decode = function (s: string) {
    // Regex for replacing addition symbol with a space
    return decodeURIComponent(s.replace(/\+/g, ' '))
  }
  const urlParams: { [key: string]: string } = {}
  while ((match = search.exec(query)) !== null) {
    urlParams[decode(match[1])] = decode(match[2])
    console.log(`Found param: ${decode(match[1])} / ${decode(match[2])}`)
  }
  clo(urlParams)
  return urlParams
}

// Note: AI suggests a cleaner way to do it:
// function getQueryParameters(url) {
// const urlObj = new URL(url)
// const params = new URLSearchParams(urlObj.search)
// const paramList = []
// for (const [key, value] of params.entries()) {
//   paramList.push({ key, value })
// }
// return paramList
// }

// Example usage
// const url = 'https://example.com/page?name=John&age=30&city=NewYork'
// const parameters = getQueryParameters(url)

// Output: [{ key: 'name', value: 'John' }, { key: 'age', value: '30' }, { key: 'city', value: 'NewYork' }]

/**
 * Refresh the saved search results in the note, if the note has a suitable x-callback 'Refresh button' in it.
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
    const timeSinceLastEdit: number = Date.now() - noteReadOnly.versions[0].date
    if (timeSinceLastEdit <= 5000) {
      logDebug(pluginJson, `refreshSavedSearch fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the note was last updated`)
      return
    }

    logDebug(pluginJson, `refreshSavedSearch triggered for '${noteReadOnly.filename}'`)
    // Does this note have a Refresh button from the Search Extensions plugin?
    const refreshButtonLines = noteReadOnly.paragraphs.filter(
      (p) => /Refresh /.test(p.content) && /noteplan:\/\/x\-callback\-url\/runPlugin\?pluginID=jgclark\.SearchExtensions&/.test(p.content),
    )
    // Only proceed if we have a refresh button
    if (refreshButtonLines?.length === 0) {
      logDebug(pluginJson, 'Note has no suitable Refresh button')
      return
    }

    const firstLine = refreshButtonLines[0].content
    logDebug(pluginJson, `Note has a suitable Refresh button line: {${firstLine}}`)

    // V2: attempt to reconstruct the parameters to call the plugin's command directly.
    const firstUrlInLine = firstLine.match(/noteplan:\/\/[^\s\)]*/)[0]
    logDebug(pluginJson, `firstUrlInLine: {${firstUrlInLine}}`)
    const params = getUrlParams(firstUrlInLine)
    const cmdName = params.command
    const arg0 = params.arg0 ?? ''
    const arg1 = params.arg1 ?? ''
    const arg2 = params.arg2 ?? ''
    const arg3 = params.arg3 ?? ''
    const arg4 = params.arg4 ?? ''
    const arg5 = params.arg5 ?? ''

    await CommandBar.showLoading(true, 'Refreshing search results ...')
    await CommandBar.onAsyncThread()
    switch (cmdName) {
      case 'search': {
        // -> searchOverAll()
        searchOverAll(arg0, arg1, arg2, arg3)
        break
      }
      case 'searchOverCalendar': {
        searchOverCalendar(arg0, arg1, arg2, arg3)
        break
      }
      case 'searchOverNotes': {
        searchOverNotes(arg0, arg1, arg2, arg3)
        break
      }
      case 'searchOpenTasks': {
        searchOpenTasks(arg0, arg1, arg2)
        break
      }
      case 'searchInPeriod': {
        // -> searchPeriod()
        searchPeriod(arg0, arg1, arg2, arg3, arg4, arg5)
        break
      }
      case 'quickSearch': {
        quickSearch(arg0, arg1, arg2, arg3)
        break
      }
    }
    await CommandBar.onMainThread()
    await CommandBar.showLoading(false)

    // V1: use the callback URL from the note directly
    // Note: as it triggers a note open, need to stop it creating infinite loops
    // const urlMatches = firstLine.match(/\((noteplan:\/\/x\-callback\-url\/runPlugin\?pluginID=jgclark\.SearchExtensions&.*?)\)/)
    // noteplan:\/\/[^\s\)]*
    // if (urlMatches) {
    //   const firstURL = urlMatches[1] // first capture group
    //   logDebug(pluginJson, `First matching URL:  {${firstURL}}`)

    //   // If we get this far, then we can call this callback to refresh the note
    //   // Put up a progress indicator first, though
    //   await CommandBar.showLoading(true, 'Refreshing search results ...')
    //   await CommandBar.onAsyncThread()
    //   NotePlan.openURL(firstURL)
    //   await CommandBar.onMainThread()
    //   await CommandBar.showLoading(false)
    // }
  } catch (error) {
    logError(pluginJson, `${error.name}: ${error.message}`)
  }
}
