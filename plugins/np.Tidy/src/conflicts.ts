// @flow
//-----------------------------------------------------------------------------
// Jonathan Clark
// Last updated 3.6.2024 for v0.13.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getSettings, percentWithTerm } from './tidyHelpers'
import {
  daysBetween,
  getDateStringFromCalendarFilename,
  relativeDateFromDate,
} from '@np/helpers/dateTime'
import {
  nowLocaleShortDateTime,
} from '@np/helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, overrideSettingsWithEncodedTypedArgs, timer } from '@np/helpers/dev'
import {
  getFolderListMinusExclusions,
  getFolderFromFilename,
  getFoldersMatching,
  getJustFilenameFromFullFilename,
  getSubFolders,
} from '@np/helpers/folders'
import {
  createOpenOrDeleteNoteCallbackUrl,
  createPrettyRunPluginLink,
  // createRunPluginCallbackUrl,
  displayTitle,
  getTagParamsFromString,
} from '@np/helpers/general'
import {
  allNotesSortedByTitle,
  getProjectNotesInFolder,
  notesInFolderSortedByTitle,
} from '@np/helpers/note'
import { noteOpenInEditor, openNoteInNewSplitIfNeeded } from '@np/helpers/NPWindows'
import { contentRangeToString } from '@np/helpers/paragraph'
import { showMessage } from "@helpers/userInput"

const pluginID = 'np.Tidy'

//----------------------------------------------------------------------------

const enoughDifference = 100 // 100 bytes
const conflictedCopiesBaseFolder = '@Conflicted Copies' // folder to use

type conflictDetails = {
  note: TNote,
  type: NoteType,
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
    // let relevantFolderList = getFolderListMinusExclusions(foldersToExclude, true, true)
    // logDebug('getConflictedNotes', `- Found ${relevantFolderList.length} folders to check`)
    // Get all notes to check
    // let notes: Array<TNote> = []
    // for (const thisFolder of relevantFolderList) {
    //   const theseNotes = getProjectNotesInFolder(thisFolder)
    //   notes = notes.concat(theseNotes)
    // }
    let notes = allNotesSortedByTitle(foldersToExclude)
    logDebug('getConflictedNotes', `- Will check all ${notes.length} notes`)

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
          type: cn.type,
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
    let copiesMade = 0

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params, 'runSilently', false)
    logDebug('listConflicts', `runSilently = ${String(runSilently)}`)

    CommandBar.showLoading(true, `Finding notes with conflicts`)
    await CommandBar.onAsyncThread()
    const startTime = new Date()
    const conflictedNotes: Array<conflictDetails> = await getConflictedNotes(config.listFoldersToExclude)
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    // Now also try to remove (Trash) the copies made on any previous run of this command
    // Note: now try by removing the whole '@Conflicted Copies' folder
    DataStore.moveNote(conflictedCopiesBaseFolder, '@Trash')

    // Only continue if there are conflictedNotes found
    if (conflictedNotes.length === 0) {
      logDebug('listConflicts', `No notes with conflicts found (in ${timer(startTime)}).`)
      // remove old conflicted note list (if it exists)
      const res = DataStore.moveNote(outputFilename, '@Trash')
      if (res) {
        logDebug('listConflicts', `Moved existing conflicted note list '${outputFilename}' to @Trash.`)
      }
      if (!runSilently) {
        await showMessage(`No notes with conflicts found! 🥳\nI have removed any previous Conflict List note, and copies.`)
      }      
      return
    } else {
      logInfo('listConflicts', `Found ${conflictedNotes.length} conflictedNotes in ${timer(startTime)}:`)
    }

    // Form the contents of a note to display the details of conflictedNotes
    const outputArray = []

    // Start with an x-callback link under the title to allow this to be refreshed easily
    outputArray.push(`# ⚠️ ${machineName}'s Conflicted notes`)
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
      if (cn.type === 'Calendar') {
        outputArray.push(`**${titleToDisplay}**`)
      } else {
        outputArray.push(`${thisFolder}/**${titleToDisplay}**`)
      }
      outputArray.push(`- Main note (${cn.filename}): ${String(cn.note.paragraphs?.length ?? 0)} lines, ${String(cn.content?.length ?? 0)} bytes (created ${relativeDateFromDate(cn.note.createdDate)}, updated ${relativeDateFromDate(cn.note.changedDate)}) [open note](${openMe})`)

      // Write out details for the previous version
      // Note: there are far fewer details for the previous version
      const pvContent = cn.note.conflictedVersion.content ?? ''
      outputArray.push(`- Previous version note: ${String(pvContent.split('\n').length)} lines, ${String(pvContent.length ?? 0)} bytes`)

      // Calculate amount of difference between them
      const greaterSize = Math.max(cn.note.content?.length ?? 0, pvContent?.length ?? 0)
      const allDiffRanges = NotePlan.stringDiff(pvContent, mainContent)
      const totalDiffBytes = allDiffRanges.reduce((a, b) => a + Math.abs(b.length), 0)
      if (totalDiffBytes > 0) {
        const percentDiffStr = percentWithTerm(totalDiffBytes, greaterSize, 'chars')
        outputArray.push(`- ${percentDiffStr} difference between them (from ${String(allDiffRanges.length)} areas)`)
        // Write allDiffRanges to debug log
        // logDebug('listConflicts', 'Here are the areas of difference:')
        // for (const thisDiffRange of allDiffRanges) {
        //   logDebug('', contentRangeToString(cn.content, thisDiffRange))
        // }

      } else {
        outputArray.push(`- oddly, the previous version appears to be identical`)
      }
      const resolveCurrentButton = createPrettyRunPluginLink('Keep main note version', 'np.Tidy', 'resolveConflictWithCurrentVersion', [cn.type, cn.filename])
      const resolveOtherButton = createPrettyRunPluginLink('Keep other note version', 'np.Tidy', 'resolveConflictWithOtherVersion', [cn.type, cn.filename])
      outputArray.push(`- ${resolveCurrentButton} ${resolveOtherButton}`)

      // Make a copy of the previous version in a special folder (if a regular note)
      if (cn.type === 'Notes' && config.savePreviousVersion) {
        // Copy previous version to '@Previous Copies' folder
        const previousCopiesFolderToUse = conflictedCopiesBaseFolder + '/' + getFolderFromFilename(cn.filename)
        const filenamePartWithoutExtension = getJustFilenameFromFullFilename(cn.filename, true)
        const copyFilename = `${filenamePartWithoutExtension}.conflict-from-${machineName}.${DataStore.defaultFileExtension}`
        const copyResultingFilename = DataStore.newNoteWithContent(pvContent, previousCopiesFolderToUse, copyFilename)
        const openSideBySideButton = createPrettyRunPluginLink('Open side by side', 'np.Tidy', 'openConflictSideBySide', [encodeURIComponent(cn.filename), encodeURIComponent(copyResultingFilename)])
        logDebug('listConflicts', `Saved previous version to ${copyResultingFilename}`)
        outputArray.push(`- Saved previous version to '${copyResultingFilename}'. ${openSideBySideButton}`)
        copiesMade++
      }
    }

    // If conflict list note is not open in an editor already, write to and open the note. Otherwise just update note.
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

    if (!runSilently) {
      if (copiesMade > 0) {
        await showMessage(`List of ${String(conflictedNotes.length)} conflicted notes written to '${outputFilename}' and ${copiesMade} conflicted copies of Project notes saved to '${conflictedCopiesBaseFolder}' folder`)
      } else {
        await showMessage(`List of ${String(conflictedNotes.length)} conflicted notes written to '${outputFilename}'`)
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
export async function resolveConflictWithCurrentVersion(noteType: NoteType, filename: string): Promise<void> {
  try {
    // Attempt to get spinner to appear, to show that something is happening.
    CommandBar.showLoading(true, 'Deleting other note version')
    logDebug('resolveConflictWithCurrentVersion', `starting for file '${filename}'`)
    if (NotePlan.environment.buildVersion < 1053) {
      logWarn('resolveConflictWithCurrentVersion', `can't be run until NP v3.9.3`)
      return
    }
    // Need to handle Calendar and project notes differently
    const calendarDateStr = (noteType === 'Calendar') ? getDateStringFromCalendarFilename(filename, true) : ''
    logDebug('resolveConflictWithCurrentVersion', `- calendarDateStr = ${calendarDateStr ?? 'n/a'}`)
    const theNote = (noteType === 'Calendar')
      ? DataStore.calendarNoteByDateString(calendarDateStr)
      : DataStore.projectNoteByFilename(filename)
    if (!theNote) {
      throw new Error(`- cannot find note '${filename}. Stopping.'`)
    }
    theNote.resolveConflictWithCurrentVersion()
    CommandBar.showLoading(false)
  }
  catch (err) {
    logError('resolveConflictWithCurrentVersion', JSP(err))
    CommandBar.showLoading(false)
  }
}

/**
 * Command to be called by x-callback to run the API function of the same name, on the given note filename
 */
export async function resolveConflictWithOtherVersion(noteType: NoteType, filename: string): Promise<void> {
  try {
    CommandBar.showLoading(true, 'Deleting main note version')
    logDebug('resolveConflictWithOtherVersion', `starting for file '${filename}'`)
    if (NotePlan.environment.buildVersion < 1053) {
      logWarn('resolveConflictWithOtherVersion', `can't be run until NP v3.9.3`)
      return
    }
    // Need to handle Calendar and project notes differently
    const calendarDateStr = (noteType === 'Calendar') ? getDateStringFromCalendarFilename(filename, true) : ''
    logDebug('resolveConflictWithOtherVersion', `- calendarDateStr = ${calendarDateStr ?? 'n/a'}`)
    const theNote = (noteType === 'Calendar')
      ? DataStore.calendarNoteByDateString(calendarDateStr)
      : DataStore.projectNoteByFilename(filename)
    if (!theNote) {
      throw new Error(`- cannot find note '${filename}'. Stopping.`)
    }
    theNote.resolveConflictWithOtherVersion()
    CommandBar.showLoading(false)
  }
  catch (err) {
    logError('resolveConflictWithOtherVersion', JSP(err))
    CommandBar.showLoading(false)
  }
}

/**
 * Command to be called by x-callback to run the API function of the same name, on the given note filename
 * @param {string} encodedNoteFilename
 * @param {string} encodedCopyFilename
 */
export async function openConflictSideBySide(encodedNoteFilename: string, encodedCopyFilename: string): Promise<void> {
  try {
    if (NotePlan.environment.platform === 'iOS') {
      logDebug('openConflictSideBySide', `cannot run on iPhone, sorry`)
      return
    }
    const noteFilename = decodeURIComponent(encodedNoteFilename)
    const copyFilename = decodeURIComponent(encodedCopyFilename)
    CommandBar.showLoading(true, 'Opening notes to compare')
    logDebug(pluginJson, `openConflictSideBySide() starting for file '${noteFilename}' / '${copyFilename}'`)
    let res = null
    // const mainNote = DataStore.projectNoteByFilename(noteFilename) ?? null
    if (NotePlan.environment.platform === 'macOS') {
      res = openNoteInNewSplitIfNeeded(noteFilename)
    } else if (NotePlan.environment.platform === 'iPadOS') {
      // Need to open this in the current window (as I think there can be at most 2 open editors)
      res = Editor.openNoteByFilename(noteFilename)
    }
    if (!res) {
      logError('openConflictSideBySide', `cannot open main note '${noteFilename}'`)
    }
    // Now open the other one as well in a split
    res = openNoteInNewSplitIfNeeded(copyFilename)
    if (!res) {
      logError('openConflictSideBySide', `cannot open copy note '${copyFilename}'`)
    }
    CommandBar.showLoading(false)
  }
  catch (err) {
    logError('openConflictSideBySide', JSP(err))
    CommandBar.showLoading(false)
  }
}
