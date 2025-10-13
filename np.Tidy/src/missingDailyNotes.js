// @flow
//-----------------------------------------------------------------------------
// listMissingDailyNotes function for Tidy
// David Wertheimer
// Last updated 2025-10-13 for v1.15.0 by @jgclark
//-----------------------------------------------------------------------------

import { getSettings, type TidyConfig } from './tidyHelpers'
import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { createPrettyRunPluginLink, getTagParamsFromString } from '@helpers/general'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { noteOpenInEditor } from '@helpers/NPWindows'
import { chooseOption, chooseHeading, getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

const pluginID = 'np.Tidy'

//----------------------------------------------------------------------------

/**
 * Write out list of all missing daily notes to a note
 * @author @dwertheimer (added to plugin by @jgclark)
 * @params {string?} params
 */
export async function listMissingDailyNotes(params: string = ''): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: TidyConfig = await getSettings()

    const outputFilename = config.missingDailyNotesNoteFilename ?? 'Missing Daily Notes.md'

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug(pluginJson, `listMissingDailyNotes() starting, with runSilently = ${String(runSilently)}`)

    // Compute date range: from 365 days ago up to today (inclusive)
    const today = new Date()
    const start = new Date(today)
    start.setHours(0,0,0,0)
    start.setDate(start.getDate() - 365)

    // Helper: format Date -> 'YYYY-MM-DD'
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
    const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const missing = []
    const startTime = new Date()
    let notesChecked = 0

    CommandBar.showLoading(true, `Finding missing daily notes`)
    await CommandBar.onAsyncThread()

    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const ds = toISO(d)
      const note = DataStore.calendarNoteByDateString(ds) // returns TNote or undefined if not created
      if (!note || !note.content || note.content == '') {
        logInfo(`Missing: ${ds}`)
        missing.push(ds)
      } else {
        // logDebug(`Found: ${ds}`)
      }
      notesChecked++
    }

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    // Only continue if there are missing Notes
    const missingCount = missing.length
    if (missing.length === 0) {
      logInfo('listMissingDailyNotes', `Found ${String(notesChecked)} daily notes in last year -- none are missing 🥳! (in ${timer(startTime)})`)
      if (!runSilently) {
        await showMessage(`No missing daily notes found! 🥳`)
      }
      // remove old conflicted note list (if it exists)
      const res = DataStore.moveNote(outputFilename, '@Trash')
      if (res) {
        logDebug('listMissingDailyNotes', `Moved existing missing daily note list '${outputFilename}' to @Trash.`)
      }
      return
    } else {
      logDebug('listMissingDailyNotes', `Found ${missingCount} missing daily notes in ${timer(startTime)}:`)
    }

    // Form the contents of a note to display the details of stubs
    let numNotes = 0
    let lastNote = null
    const outputArray: Array<string> = missing

    // To the front add title and an x-callback link under the title to allow this to be refreshed easily
    const xCallbackRefreshButton = createPrettyRunPluginLink('🔄 Click to refresh', 'np.Tidy', 'List missing daily notes', [])
    const summaryLine = `Found ${missingCount} missing daily notes at ${nowLocaleShortDateTime()}. ${xCallbackRefreshButton}`
    outputArray.unshift(summaryLine)
    outputArray.unshift(`# Missing Daily Notes`)

    // If note is not open in an editor already, write to and open the note. Otherwise just update note.
    let noteToUse: ?TNote
    if (!noteOpenInEditor(outputFilename)) {
      noteToUse = await Editor.openNoteByFilename(outputFilename, false, 0, 0, true, true, outputArray.join('\n'))
    } else {
      noteToUse = DataStore.projectNoteByFilename(outputFilename)
    }
    if (!noteToUse) {
      throw new Error(`Couldn't find note '${outputFilename}' to write to`)
    }
    noteToUse.content = outputArray.join('\n')
    const noteFMAttributes = [
      { key: 'title', value: 'Missing Daily Notes' },
      { key: 'updated', value: nowLocaleShortDateTime() },
      { key: 'icon', value: 'calendar-xmark' },
      { key: 'icon-color', value: 'red-500' }
    ]
    noteToUse.updateFrontmatterAttributes(noteFMAttributes) 
  } catch (err) {
    logError('listMissingDailyNotes', JSP(err))
    return // for completeness
  }
}
