// @flow
//-----------------------------------------------------------------------------
// Jonathan Clark
// Last updated 7.11.2023 for v0.9.2 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings, percentWithTerm } from './tidyHelpers'
import {
  daysBetween,
  relativeDateFromDate,
} from '@helpers/dateTime'
import {
  nowLocaleShortDateTime,
} from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, overrideSettingsWithEncodedTypedArgs, timer } from '@helpers/dev'
import { getFilteredFolderList, getFolderFromFilename } from '@helpers/folders'
import {
  createOpenOrDeleteNoteCallbackUrl,
  createPrettyRunPluginLink,
  // createRunPluginCallbackUrl,
  displayTitle,
  getTagParamsFromString,
} from '@helpers/general'
import { getProjectNotesInFolder } from '@helpers/note'
import { noteOpenInEditor } from '@helpers/NPWindows'
import { contentRangeToString } from '@helpers/paragraph'
import { showMessage } from "@helpers/userInput"

const pluginID = 'np.Tidy'

//----------------------------------------------------------------------------

type conflictDetails = {
  note: TNote,
  url: string, // = full mac/iOS filepath and filename
  filename: string, // = just filename
  content: string
}

//----------------------------------------------------------------------------

/**
 * Private function to generate list of conflicted notes
 * NB: Only available from NP 3.9.3
 * @author @jgclark
 * @param {Array<string>} foldersToExclude
 * @returns {Array<conflictDetails>} array of strings, one for each output line
*/
async function getConflictedNotes(foldersToExclude: Array<string> = []): Promise<Array<conflictDetails>> {
  try {
    if (NotePlan.environment.buildVersion < 1053) {
      await showMessage("Command '/list conflicted notes' is only available from NP 3.9.3")
      return []
    }
    logDebug(pluginJson, `getConflictedNotes() starting`)

    const outputArray: Array<conflictDetails> = []
    let folderList = getFilteredFolderList(foldersToExclude, true, [], true)
    logDebug('getConflictedNotes', `- Found ${folderList.length} folders to check`)
    // Get all notes to check
    let notes: Array<TNote> = []
    for (const thisFolder of folderList) {
      const theseNotes = getProjectNotesInFolder(thisFolder)
      notes = notes.concat(theseNotes)
    }

    // Get all conflicts
    const conflictedNotes = notes.filter(n => (n.conflictedVersion != null))

    // Log details of each dupe
    for (const cn of conflictedNotes) {
      // logDebug('getConflictedNotes', `- ${displayTitle(cn)}`)
      const cv = cn.conflictedVersion
      if (cv) {
        // clo(cv, 'conflictedVersion = ')
        outputArray.push({
          note: cn,
          filename: cn.filename, // needs to be main note not .conflict version
          url: cn.conflictedVersion.url,
          content: cn.conflictedVersion.content
        })
      } else {
        logError('getConflictedNotes', `- ${displayTitle(cn)} appears to have no conflictedVersion`)
      }
    }
    // clo(outputArray, '->')
    return outputArray
  }
  catch (err) {
    logError(pluginJson, JSP(err))
    return [] // for completeness
  }
}

/**
 * Command to show details of conflicted notes found, and offering to delete them
 * @author @jgclark
 */
export async function listConflicts(params: string = ''): Promise<void> {
  try {
    const machineName = NotePlan.environment.machineName ?? NotePlan.environment.platform
    logDebug(pluginJson, `listConflicts: Starting with params '${params}' on ${machineName}`)
    let config = await getSettings()
    const outputFilename = config.conflictNoteFilename ?? 'Conflicted Notes.md'

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params, 'runSilently', false)
    logDebug('listConflicts', `runSilently = ${String(runSilently)}`)

    CommandBar.showLoading(true, `Finding notes with conflicts`)
    await CommandBar.onAsyncThread()
    const startTime = new Date()
    const conflictedNotes: Array<conflictDetails> = await getConflictedNotes(config.listFoldersToExclude)
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    // Only continue if there are conflictedNotes found
    if (conflictedNotes.length === 0) {
      logDebug('listConflicts', `No notes with conflicts found (in ${timer(startTime)}).`)
      if (!runSilently) {
        await showMessage(`No notes with conflicts found! 🥳`)
      }
      // remove old conflicted note list (if it exists)
      const res = DataStore.moveNote(outputFilename, '@Trash')
      if (res) {
        logDebug('listConflicts', `Moved existing conflicted note list '${outputFilename}' to @Trash.`)
      }
      return
    } else {
      logDebug('listConflicts', `Found ${conflictedNotes.length} conflictedNotes in ${timer(startTime)}:`)
    }

    // Form the contents of a note to display the details of conflictedNotes
    const outputArray = []

    // Start with an x-callback link under the title to allow this to be refreshed easily
    outputArray.push(`# Conflicted notes on ${machineName}`)
    const xCallbackRefreshButton = createPrettyRunPluginLink('🔄 Click to refresh', 'np.Tidy', 'List conflicted notes', [])
    const summaryLine = `Found ${conflictedNotes.length} conflicts on ${machineName} at ${nowLocaleShortDateTime()}. ${xCallbackRefreshButton}`
    outputArray.push(summaryLine)

    for (const cn of conflictedNotes) {
      const titleToDisplay = (cn.note.title !== '') ? displayTitle(cn.note) : '(note with no title)'
      logDebug(pluginJson, `- ${cn.filename}`)

      const thisFolder = cn.filename.includes('/') ? getFolderFromFilename(cn.filename) : '(root)'
      const mainContent = cn.note.content ?? ''
      // Make some button links for main note
      const openMe = createOpenOrDeleteNoteCallbackUrl(cn.filename, 'filename', '', 'splitView', false)
      outputArray.push(`${thisFolder}/**${titleToDisplay}**`)
      outputArray.push(`- Main note (${cn.filename}): ${String(cn.note.paragraphs?.length ?? 0)} lines, ${String(cn.content?.length ?? 0)} bytes (created ${relativeDateFromDate(cn.note.createdDate)}, updated ${relativeDateFromDate(cn.note.changedDate)}) [open note](${openMe})`)

      // Write out details for the conflicted version
      // Note: there are far fewer details for the conflicted version
      const cvContent = cn.note.conflictedVersion.content ?? ''
      outputArray.push(`- Conflicted version note: ${String(cvContent.split('\n').length)} lines, ${String(cvContent.length ?? 0)} bytes`)

      // Calculate amount of difference between them
      const greaterSize = Math.max(cn.note.content?.length ?? 0, cvContent?.length ?? 0)
      const allDiffRanges = NotePlan.stringDiff(cvContent, mainContent)
      const totalDiffBytes = allDiffRanges.reduce((a, b) => a + Math.abs(b.length), 0)
      if (totalDiffBytes > 0) {
        const percentDiff = percentWithTerm(totalDiffBytes, greaterSize, 'chars')
        outputArray.push(`- ${percentDiff} difference between them (from ${String(allDiffRanges.length)} areas)`)
        // Write allDiffRanges to debug log
        logDebug('listConflicts', 'Here are the areas of difference:')
        for (const thisDiffRange of allDiffRanges) {
          logDebug('', contentRangeToString(cn.content, thisDiffRange))
        }

      } else {
        outputArray.push(`- oddly, the conflicted version appears to be identical`)
      }
      const resolveCurrentButton = createPrettyRunPluginLink('Keep main note version', 'np.Tidy', 'resolveConflictWithCurrentVersion', [cn.filename])
      const resolveOtherButton = createPrettyRunPluginLink('Keep other note version', 'np.Tidy', 'resolveConflictWithOtherVersion', [cn.filename])
      outputArray.push(`- ${resolveCurrentButton} ${resolveOtherButton}`)
    }

    // If note is not open in an editor already, write to and open the note. Otherwise just update note.
    if (!noteOpenInEditor(outputFilename)) {
      const resultingNote = await Editor.openNoteByFilename(outputFilename, false, 0, 0, true, true, outputArray.join('\n'))
    } else {
      const noteToUse = DataStore.projectNoteByFilename(outputFilename)
      if (noteToUse) {
        noteToUse.content = outputArray.join('\n')
      } else {
        throw new Error(`Couldn't find note '${outputFilename}' to write to`)
      }
    }
  }
  catch (err) {
    logError('listConflicts', JSP(err))
  }
}

/**
 * Command to be called by x-callback to run the API function of the same name, on the given note filename
 */
export async function resolveConflictWithCurrentVersion(filename: string): Promise<void> {
  try {
    // Attempt to get spinner to appear, to show that something is happening.
    CommandBar.showLoading(true, 'Deleting other note version')
    logDebug(pluginJson, `resolveConflictWithCurrentVersion() starting for file '${filename}'`)
    if (NotePlan.environment.buildVersion < 1053) {
      logWarn(pluginJson, `resolveConflictWithOtherVersion() can't be run until NP v3.9.3`)
      return
    }
    const theNote = DataStore.projectNoteByFilename(filename) ?? null
    if (!theNote) {
      logError('resolveConflictWithCurrentVersion', `cannot find note '${filename}'`)
      return
    }
    theNote.resolveConflictWithCurrentVersion()
    CommandBar.showLoading(false)
  }
  catch (err) {
    logError(pluginJson, JSP(err))
    CommandBar.showLoading(false)
  }
}

/**
 * Command to be called by x-callback to run the API function of the same name, on the given note filename
 */
export async function resolveConflictWithOtherVersion(filename: string): Promise<void> {
  try {
    CommandBar.showLoading(true, 'Deleting main note version')
    logDebug(pluginJson, `resolveConflictWithOtherVersion() starting for file '${filename}'`)
    if (NotePlan.environment.buildVersion < 1053) {
      logWarn(pluginJson, `resolveConflictWithOtherVersion() can't be run until NP v3.9.3`)
      return
    }
    const theNote = DataStore.projectNoteByFilename(filename) ?? null
    if (!theNote) {
      logError('resolveConflictWithOtherVersion', `cannot find note '${filename}'`)
      return
    }
    theNote.resolveConflictWithOtherVersion()
    CommandBar.showLoading(false)
  }
  catch (err) {
    logError(pluginJson, JSP(err))
    CommandBar.showLoading(false)
  }
}
