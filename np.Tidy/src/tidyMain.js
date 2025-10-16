// @flow
//-----------------------------------------------------------------------------
// Main functions for Tidy plugin
// Jonathan Clark
// Last updated 2025-08-30 for v0.14.9, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { listConflicts } from './conflicts'
import { listDuplicates } from './duplicates'
import { generateRepeatsFromRecentNotes } from './repeats.js'
import { moveTopLevelTasksInNote } from './topLevelTasks'
import { getSettings, type TidyConfig } from './tidyHelpers'
import { RE_DONE_DATE_TIME, RE_DONE_DATE_TIME_CAPTURES, RE_DONE_DATE_OPT_TIME } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, overrideSettingsWithEncodedTypedArgs, timer } from '@helpers/dev'
import { displayTitle, getTagParamsFromString } from '@helpers/general'
import { allNotesSortedByChanged, pastCalendarNotes, removeSection } from '@helpers/note'
import { removeFrontMatterField, noteHasFrontMatter } from '@helpers/NPFrontMatter'
import { getNotesChangedInInterval, getNotesChangedInIntervalFromList, getTodaysReferences } from '@helpers/NPnote'
import { removeContentUnderHeadingInAllNotes } from '@helpers/NPParagraph'
import { isTeamspaceNoteFromFilename } from '@helpers/teamspace'
import { getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------------------

export async function tidyUpAll(): Promise<void> {
  try {
    const config: TidyConfig = await getSettings()
    logDebug(pluginJson, `tidyUpAll: Starting, with runSilently=${String(config.runSilently)}`)

    // Show spinner dialog
    CommandBar.showLoading(true, `Tidying up ...`, 0)
    await CommandBar.onAsyncThread()

    if (config.runRemoveBlankNotes) {
      CommandBar.showLoading(true, `Tidying up blank notes ...`, 0.1)
      logDebug('tidyUpAll', `Starting removeOrphanedBlockIDs...`)
      await removeBlankNotes(config.runSilently)
    }

    if (config.runRemoveOrphansCommand) {
      CommandBar.showLoading(true, `Tidying up orphaned blockIDs ...`, 0.2)
      logDebug('tidyUpAll', `Starting removeOrphanedBlockIDs...`)
      await removeOrphanedBlockIDs(config.runSilently)
    }

    if (config.removeTodayTagsFromCompletedTodos) {
      CommandBar.showLoading(true, `Tidying up completed >today items...`, 0.3)
      logDebug('tidyUpAll', `Starting Tidying up completed >today items...`)
      await removeTodayTagsFromCompletedTodos(config.runSilently)
    }

    // Following functions take params; so send runSilently as a param

    const param = config.runSilently ? '{"runSilently": true}' : ''
    if (config.runRemoveDoneMarkersCommand) {
      CommandBar.showLoading(true, `Tidying up @done markers...`, 0.4)
      logDebug('tidyUpAll', `Starting removeDoneMarkers...`)
      await removeDoneMarkers(param)
    }
    if (config.runRemoveDoneTimePartsCommand) {
      CommandBar.showLoading(true, `Tidying up @done time parts...`, 0.5)
      logDebug('tidyUpAll', `Starting removeDoneTimeParts...`)
      await removeDoneTimeParts(param)
    }

    // Note: Disabling this one as it can't be run silently
    // if (config.runFileRootNotesCommand) {
    //   logDebug('tidyUpAll', `Starting fileRootNotes...`)
    //   await fileRootNotes()
    // }
    
    // Note: Disabling this one as it can't be run silently
    // if (config.runRemoveSectionFromNotesCommand) {
    //   logDebug('tidyUpAll', `Starting removeSectionFromRecentNotes...`)
    //   await removeSectionFromRecentNotes()
    // }

    if (config.runDuplicateFinderCommand) {
      CommandBar.showLoading(true, `Making list of Conflicted notes ...`, 0.6)
      logDebug('tidyUpAll', `Starting listConflicts ...`)
      await listConflicts(param)
    }

    if (config.runConflictFinderCommand) {
      CommandBar.showLoading(true, `Making list of Duplicate notes  ...`, 0.7)
      logDebug('tidyUpAll', `Starting listDuplicates ...`)
      await listDuplicates(param)
    }

    if (config.removeTriggersFromRecentCalendarNotes) {
      CommandBar.showLoading(true, `Tidying up old triggers ...`, 0.8)
      logDebug('tidyUpAll', `Starting removeDoneTimeParts...`)
      await removeTriggersFromRecentCalendarNotes(param)
    }

    if (config.moveTopLevelTasksInEditor) {
      const heading = config.moveTopLevelTasksHeading.length ? config.moveTopLevelTasksHeading : null
      await moveTopLevelTasksInNote(Editor, heading, config.runSilently)
    }

    if (config.runGenerateRepeatsCommand) {
      CommandBar.showLoading(true, `Generating any needed new @repeats ...`, 0.9)
      logDebug('tidyUpAll', `Starting generateRepeatsFromRecentNotes...`)
      await generateRepeatsFromRecentNotes(param)
    }

    // stop spinner
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)
  } catch (error) {
    logError('tidyUpAll', JSP(error))
  }
}

/**
 * Remove @done(...) markers from recently-updated notes,
 * including option justRemoveFromChecklists.
 * Can be passed parameters to override default time interval through an x-callback call
 * @author @jgclark
 * @param {string?} params optional JSON string
 */
export async function removeDoneMarkers(params: string = ''): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: TidyConfig = await getSettings()
    // Setup main variables
    if (params) {
      logDebug(pluginJson, `removeDoneMarkers: Starting with params '${params}'`)
      config = overrideSettingsWithEncodedTypedArgs(config, params)
      clo(config, `config after overriding with params '${params}'`)
    } else {
      // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
      logDebug(pluginJson, `removeDoneMarkers: Starting with no params`)
    }

    // Get num days to process from param, or by asking user if necessary
    const numDays: number = await getTagParamsFromString(params ?? '', 'numDays', config.numDays ?? 0)
    logDebug('removeDoneMarkers', `numDays = ${String(numDays)}`)
    // Note: can be 0 at this point, which implies process all days

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('removeDoneMarkers', `runSilently = ${String(runSilently)}`)

    // Find which notes have @done(...) tags
    const start = new Date()
    // Use multi-threaded DataStore.search() to look for "@done(", and then use regex to narrow down. This also implements foldersToExclude for us.
    // (It's twice as quick as doing a more exact regex over all notes in my testing.)
    const parasToCheck: $ReadOnlyArray<TParagraph> = await DataStore.search('@done(', ['calendar', 'notes'], [], config.removeFoldersToExclude)
    // const RE = new RegExp(RE_DONE_DATE_OPT_TIME) // @done(date) or @done(date time)
    let allMatchedParas: Array<TParagraph> = parasToCheck.filter((p) => RE_DONE_DATE_OPT_TIME.test(p.content)) ?? []

    // if justRemoveFromChecklists set, filter out non-checklists (i.e. tasks)
    if (config.justRemoveFromChecklists) {
      allMatchedParas = allMatchedParas.filter((p) => p.type === 'checklistDone')
      logDebug('removeDoneMarkers', `- filtered out done tasks`)
    }

    // Get date range to use
    const todayStart = new moment().startOf('day') // use moment instead of `new Date` to ensure we get a date in the local timezone
    const momentToStartLooking = todayStart.subtract(numDays, 'days')
    const jsdateToStartLooking = momentToStartLooking.toDate()

    // $FlowFixMe(incompatible-type)
    const recentMatchedParas: Array<TParagraph> = allMatchedParas.filter((p) => p.note.changedDate >= jsdateToStartLooking)

    // Now map from paras -> notes and dedupe
    let numToRemove = allMatchedParas.length
    // $FlowFixMe[incompatible-call]
    const recentMatchedNotes = recentMatchedParas.map((p) => p.note)
    // Dedupe this list
    const dedupedMatchedNotes = [...new Set(recentMatchedNotes)]
    numToRemove = dedupedMatchedNotes.length
    logDebug('removeDoneMarkers', `- ${String(numToRemove)} @done(...) matches from ${String(dedupedMatchedNotes.length)} recent notes`)
    logDebug('removeDoneMarkers', `Search took ${timer(start)}s`)

    if (numToRemove > 0) {
      logDebug('removeDoneMarkers', `- ${String(numToRemove)} are in the right date interval:`)
      // Check user wants to proceed (if not runSilently)
      if (!runSilently) {
        // const titlesList = notesToProcess.map((m) => displayTitle(m))
        // logDebug('removeDoneMarkers', titlesList)
        const res = await showMessageYesNo(`Do you want to remove ${String(numToRemove)} @done(...) markers?`, ['Yes', 'No'], 'Remove @done() markers')
        if (res === 'No') {
          logInfo('removeDoneMarkers', `User cancelled operation`)
          return
        }
      }
      // Actually remove the markers from the paras
      // Note: doesn't work reliably going forward through paras. Tried going backwards through paras ... but same issues.
      // Instead go note by note doing updateParagraphs().
      for (const p of recentMatchedParas) {
        const origRawContent = p.rawContent
        const origContent = p.content
        const matches = origContent.match(RE_DONE_DATE_OPT_TIME) ?? []
        const thisDoneMarker = matches[0] ?? ''
        const newContent = origContent.replace(thisDoneMarker, '')
        const thisNote = p.note
        if (thisDoneMarker && thisNote) {
          p.content = newContent
          thisNote.updateParagraph(p)
          logDebug('removeDoneMarkers', `- Removed ${thisDoneMarker} from '${origRawContent}' (in ${displayTitle(thisNote)})`)
        } else {
          logWarn('removeDoneMarkers', `- Couldn't remove @done() marker from '${origContent}' as couldn't find it`)
        }
      }
    } else {
      if (!runSilently) {
        const res = await showMessage(`No @done(...) markers were found to remove`)
      }
      logInfo('removeDoneMarkers', `No @done(...) markers were found to remove`)
    }
    return
  } catch (error) {
    logError('removeDoneMarkers', JSP(error))
    return // for completeness
  }
}

/**
 * Remove time parts of @done(date time) from recently-updated notes
 * Can be passed parameters to override default time interval through an x-callback call
 * @author @jgclark
 * @param {string?} params optional JSON string
 */
export async function removeDoneTimeParts(params: string = ''): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: TidyConfig = await getSettings()
    // Setup main variables
    if (params) {
      logDebug(pluginJson, `removeDoneTimeParts: Starting with params '${params}'`)
      config = overrideSettingsWithEncodedTypedArgs(config, params)
      clo(config, `config after overriding with params '${params}'`)
    } else {
      // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
      logDebug(pluginJson, `removeDoneTimeParts: Starting with no params`)
    }

    // Get num days to process from param, or by asking user if necessary
    const numDays: number = await getTagParamsFromString(params ?? '', 'numDays', config.numDays ?? 0)
    logDebug('removeDoneTimeParts', `numDays = ${String(numDays)}`)
    // Note: can be 0 at this point, which implies process all days

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('removeDoneTimeParts', `runSilently = ${String(runSilently)}`)

    // Find which notes have @done(...) tags
    const start = new Date()
    // Use multi-threaded DataStore.search() to look for "@done(", and then use regex to narrow down. This also implements foldersToExclude for us.
    // Note: It's twice as quick as doing a more exact regex over all notes in my testing.
    const parasToCheck: $ReadOnlyArray<TParagraph> = await DataStore.search('@done(', ['calendar', 'notes'], [], config.removeFoldersToExclude)
    // const RE = new RegExp(RE_DONE_DATE_TIME)
    const allMatchedParas: Array<TParagraph> = parasToCheck.filter((p) => RE_DONE_DATE_TIME.test(p.content)) ?? []

    // Get date range to use
    const todayStart = new moment().startOf('day') // use moment instead of `new Date` to ensure we get a date in the local timezone
    const momentToStartLooking = todayStart.subtract(numDays, 'days')
    const jsdateToStartLooking = momentToStartLooking.toDate()

    // $FlowFixMe(incompatible-type)
    const recentMatchedParas: Array<TParagraph> = allMatchedParas.filter((p) => p.note.changedDate >= jsdateToStartLooking)

    // Now map from paras -> notes and dedupe
    let numToRemove = allMatchedParas.length
    // $FlowFixMe[incompatible-call]
    const recentMatchedNotes = recentMatchedParas.map((p) => p.note)
    // Dedupe this list
    const dedupedMatchedNotes = [...new Set(recentMatchedNotes)]
    numToRemove = dedupedMatchedNotes.length
    logDebug('removeDoneTimeParts', `- ${String(numToRemove)} @done(...) matches from ${String(dedupedMatchedNotes.length)} recent notes`)

    // // Now keep only those changed recently (or all if numDays === 0)
    // // $FlowFixMe[incompatible-type]
    // const notesToProcess: Array<TNote> = (numDays > 0) ? helpers.getNotesChangedInIntervalFromList(dedupedMatchedNotes, numDays) : dedupedMatchedNotes
    // numToRemove = notesToProcess.length
    logDebug('removeDoneTimeParts', `Search took ${timer(start)}s`)

    if (numToRemove > 0) {
      logDebug('removeDoneTimeParts', `- ${String(numToRemove)} are in the right date interval:`)
      // Check user wants to proceed (if not calledWithParams)
      if (!runSilently) {
        // const titlesList = notesToProcess.map((m) => displayTitle(m))
        // logDebug('removeDoneTimeParts', titlesList)

        const res = await showMessageYesNo(`Do you want to remove ${String(numToRemove)} @done(... time) parts?`, ['Yes', 'No'], 'Remove Time Parts')
        if (res === 'No') {
          logInfo('removeDoneTimeParts', `User cancelled operation`)
          return
        }
      }
      // Actually remove the times from the paras
      for (const p of recentMatchedParas) {
        const origContent = p.content
        const captureParts = origContent.match(RE_DONE_DATE_TIME_CAPTURES) ?? []
        const timePart = captureParts[2] ?? ''
        const thisNote = p.note
        if (timePart && thisNote) {
          const newContent = origContent.replace(timePart, '')
          p.content = newContent
          thisNote.updateParagraph(p)
          logDebug('removeDoneTimeParts', `- Removed time${timePart} from '${origContent}' (in ${displayTitle(thisNote)})`)
        } else {
          logWarn('removeDoneTimeParts', `- Couldn't remove time from '${origContent}' as couldn't find time part`)
        }
      }
    } else {
      if (!runSilently) {
        const res = await showMessage(`No @done(...time) tags were found to remove`)
      }
      logInfo('removeDoneTimeParts', `No @done(...time) tags were found to remove`)
    }

    return
  } catch (err) {
    logError('removeDoneTimeParts', JSP(err))
    return // for completeness
  }
}

/**
 * Remove Remove one or more triggers from recently changed (but past) calendar notes.
 * Can be passed parameters to override default time interval through an x-callback call
 * @author @jgclark
 * @param {string?} params optional JSON string that overrides user's normal settings for this plugin
 */
export async function removeTriggersFromRecentCalendarNotes(params: string = ''): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: TidyConfig = await getSettings()
    // Setup main variables
    if (params) {
      logDebug(pluginJson, `removeTriggersFromRecentCalendarNotes: Starting with params '${params}'`)
      config = overrideSettingsWithEncodedTypedArgs(config, params)
      clo(config, `config after overriding with params '${params}'`)
    } else {
      // If no params are passed, then we've been called by a plugin command (and so use defaults from user'sconfig).
      logDebug(pluginJson, `removeTriggersFromRecentCalendarNotes: Starting with no params`)
    }

    // Get num days to process from param, or by asking user if necessary
    const numDays: number = await getTagParamsFromString(params ?? '', 'numDays', config.numDays ?? 0)
    logDebug('removeTriggersFromRecentCalendarNotes', `numDays = ${String(numDays)}`)
    // Note: can be 0 at this point, which implies process all days

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    // logDebug('removeTriggersFromRecentCalendarNotes', `runSilently = ${String(runSilently)}`)

    // Find past calendar notes changed in the last numDays (or all if numDays === 0)
    // v2 method:
    const thePastCalendarNotes = pastCalendarNotes()
    logDebug('removeTriggersFromRecentCalendarNotes', `there are ${String(thePastCalendarNotes.length)} past calendar notes`)
    const notesToProcess: Array<TNote> = numDays > 0 ? getNotesChangedInIntervalFromList(thePastCalendarNotes, numDays) : thePastCalendarNotes
    const numToProcess = notesToProcess.length

    if (numToProcess > 0) {
      let countRemoved = 0
      logDebug('removeTriggersFromRecentCalendarNotes', `checking ${String(numToProcess)} notes last changed in the last ${numDays} days:`)
      // For each note, try the removal
      for (const note of notesToProcess) {
        // Only proceed if the note actually has frontmatter
        if (noteHasFrontMatter(note)) {
          const result = removeFrontMatterField(note, 'triggers', '', true)
          if (result) {
            logDebug('removeTriggersFromRecentCalendarNotes', `removed frontmatter trigger field from ${displayTitle(note)}`)
            countRemoved++
          } else {
            logDebug('removeTriggersFromRecentCalendarNotes', `failed to remove frontmatter trigger field from ${displayTitle(note)} for some reason`)
          }
        }
      }
      if (!runSilently) await showMessage(`Removed ${countRemoved} triggers from ${numToProcess} recently-changed calendar notes`)
    } else {
      if (!runSilently) await showMessage(`There were no recently-changed calendar notes to process`)
    }

    return
  } catch (err) {
    logError('removeTriggersFromRecentCalendarNotes', err.message)
    return // for completeness
  }
}

/**
 * Write a list of notes changed in the last interval of days to the plugin log. It will default to the 'Default Recent Time Interval' setting unless passed as a JSON parameter.
 * TODO: Extend to make a full command, responding to GH request.
 * @author @jgclark
 * @param {string} params as JSON
 */
export async function logNotesChangedInInterval(params: string = ''): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: TidyConfig = await getSettings()
    if (params) {
      logDebug(pluginJson, `logNotesChangedInInterval: Starting with params '${params}'`)
      config = overrideSettingsWithEncodedTypedArgs(config, params)
      clo(config, `config after overriding with params '${params}'`)
    } else {
      // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
      logDebug(pluginJson, `logNotesChangedInInterval: Starting with no params`)
    }

    const numDays = config.numDays
    if (numDays === 0) { throw new Error('numDays is 0, so stopping, as it is nonsensical to ask for a list of all notes.') }
    const notesList = getNotesChangedInInterval(numDays)
    const titlesList = notesList.map((m) => displayTitle(m))
    logInfo(pluginJson, `${String(titlesList.length)} Notes have changed in last ${String(numDays)} days:\n${String(titlesList)}`)
  } catch (err) {
    logError('logNotesChangedInInterval', JSP(err))
    return // for completeness
  }
}

/**
 * Remove orphaned blockIDs in all notes.
 * @author @jgclark
 * @param {boolean} runSilently?
 */
export async function removeOrphanedBlockIDs(runSilently: boolean = false): Promise<void> {
  try {
    // Get plugin settings (config)
    const config: TidyConfig = await getSettings()

    // Find blockIDs in all notes, and save the details of it in a data structure that tracks the first found copy only, and the number of copies.
    let parasWithBlockID = DataStore.referencedBlocks()
    logDebug('removeOrphanedBlockIDs', `Starting with ${String(parasWithBlockID.length)} total blockIDs. runSilently? ${String(runSilently)}`)

    // Use numDays to limit to recent notes, if > 0
    if (config.numDays > 0) {
      // $FlowFixMe[incompatible-call]
      const allMatchedNotes = parasWithBlockID.map((p) => p.note)
      // logDebug('allMatchedNotes', String(allMatchedNotes.length))
      const recentMatchedNotes = getNotesChangedInIntervalFromList(allMatchedNotes.filter(Boolean), config.numDays ?? 0)
      const recentMatchedNoteFilenames = recentMatchedNotes.map((n) => n.filename)
      // logDebug('recentMatchedNotes', String(recentMatchedNotes.length))
      parasWithBlockID = parasWithBlockID.filter((p) => recentMatchedNoteFilenames.includes(p.note?.filename))
      logDebug('removeOrphanedBlockIDs', `Current total: ${String(parasWithBlockID.length)} blockIDs in notes from last ${config.numDays} days`)
    }
    const singletonBlockIDParas: Array<TParagraph> = []
    let numToRemove = 0
    let res = ''

    // Work out which paras have the singleton blockIDs
    for (const thisPara of parasWithBlockID) {
      // logDebug('removeOrphanedBlockIDs', `- For '${thisPara.content}':`)
      const otherBlockIDsForThisPara = DataStore.referencedBlocks(thisPara)
      // logDebug('removeOrphanedBlockIDs', `  - Found same blockID in '${String(otherBlockIDsForThisPara.length)}' paras:`)
      // logDebug('removeOrphanedBlockIDs', otherBlockIDsForThisPara.map((m) => m.content))
      if (otherBlockIDsForThisPara.length === 0) {
        // logDebug('', `  - This is a singleton, so will remove blockID from '${thisPara.content}'`)
        numToRemove++
        singletonBlockIDParas.push(thisPara)
      }
    }
    if (numToRemove === 0) {
      if (!runSilently) {
        logDebug('removeOrphanedBlockIDs', `No orphaned blockIDs were found in syncd lines`)
        await showMessage(`No orphaned blockIDs were found in syncd lines.`, 'OK, great!', 'Remove Orphaned blockIDs')
      } else {
        logInfo('removeOrphanedBlockIDs', `No orphaned blockIDs were found in syncd lines`)
      }
      return
    }
    logDebug('removeOrphanedBlockIDs', `Found ${String(numToRemove)} orphaned blockIDs`)

    // Log their details
    // logDebug('removeOrphanedBlockIDs', `\nFound these '${String(numToRemove)} orphaned blockIDs:`)
    // for (const thisPara of singletonBlockIDParas) {
    //   const otherBlockIDsForThisPara = DataStore.referencedBlocks(thisPara)
    //   console.log(`'${thisPara.content}' in '${displayTitle(thisPara.note)}'`)
    // }

    if (!runSilently) {
      res = await showMessageYesNo(`Shall I remove ${String(numToRemove)} orphaned blockIDs?`, ['Yes please', 'No'], 'Remove Orphaned blockIDs', false)
      if (res === 'No') {
        return
      }
    }

    // If we get this far, then remove all blockID with only 1 instance
    let numRemoved = 0
    logDebug('removeOrphanedBlockIDs', `Will delete all singleton blockIDs`)
    for (const thisPara of singletonBlockIDParas) {
      const thisNote = thisPara.note
      // $FlowFixMe[incompatible-use]
      thisNote.removeBlockID(thisPara)
      logDebug('removeOrphanedBlockIDs', `- Removed singleton blockID from '${thisPara.content}'`)
      // $FlowFixMe[incompatible-use]
      thisNote.updateParagraph(thisPara)
      numRemoved++
      // }
    }

    // As a double-check re-count total number of blockIDs
    parasWithBlockID = DataStore.referencedBlocks()
    logDebug('removeOrphanedBlockIDs', `${String(numRemoved)} orphaned blockIDs removed from syncd lines`)
    logDebug('removeOrphanedBlockIDs', `(New total: ${String(DataStore.referencedBlocks().length)} blockIDs)`)

    // Show a completion message
    if (!runSilently) {
      await showMessage(`${String(numRemoved)} orphaned blockIDs removed from syncd lines`, 'OK', 'Remove Orphaned blockIDs', false)
    } else {
      logInfo('removeOrphanedBlockIDs', `${String(numRemoved)} orphaned blockIDs removed from syncd lines`)
    }
  } catch (err) {
    logError('removeOrphanedBlockIDs', JSP(err))
    return // for completeness
  }
}

/**
 * Remove blank notes
 * Note: blank means 2 bytes or fewer (which therefore includes ones with only "# ")
 * Note: API doesn't allow deletion of Teamspace notes, as of v3.18.1, so don't try.
 * @author @jgclark
 * @param {boolean} runSilently?
 */
export async function removeBlankNotes(runSilently: boolean = false): Promise<void> {
  try {
    // Get plugin settings (config)
    // const config: TidyConfig = await getSettings()
    logDebug(pluginJson, `removeBlankNotes() with runSilently? '${String(runSilently)}'`)

    // Find all notes with 2 or fewer bytes' length.
    // Show spinner dialog
    CommandBar.showLoading(true, `Finding blank notes ...`)
    await CommandBar.onAsyncThread()
    const start = new Date()

    // Note: PDF and other non-notes are contained in the directories, and returned as 'notes' by allNotesSortedByChanged(). Some appear to have 'undefined' content length, but I had to find a different way to distinguish them.
    const blankNotes = allNotesSortedByChanged()
      .filter((n) => n.filename.match(/(.txt|.md)$/))
      // $FlowFixMe[incompatible-type]
      .filter((n) => n.content !== 'undefined' && n.content.length !== 'undefined' && n.content.length <= 2)
    
    const nonTeamspaceNotes = blankNotes.filter((n) => !isTeamspaceNoteFromFilename(n.filename))
    const teamspaceNotes = blankNotes.filter((n) => isTeamspaceNoteFromFilename(n.filename))
    
    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    // Now count the notes found
    const numNonTeamspaceNotes = nonTeamspaceNotes.length
    const numTeamspaceNotes = teamspaceNotes.length
    logDebug('removeBlankNotes', `Found ${String(numTeamspaceNotes+numNonTeamspaceNotes)} blank notes in ${timer(start)}.`)

    if ((numNonTeamspaceNotes + numTeamspaceNotes) === 0) {
      if (!runSilently) {
        logDebug('removeBlankNotes', `No blank notes found`)
        await showMessage(`No blanks notes found.`, 'OK, great!', 'Remove Blank Notes')
      } else {
        logInfo('removeBlankNotes', `No blank notes found`)
      }
      return
    }

    // Log the details of all the Teamspace notes found
    if (numTeamspaceNotes > 0) {
      logInfo('removeBlankNotes',`- Found ${String(numTeamspaceNotes)} blank Teamspace notes. NOTE: These cannot be removed. Here are their filenames:`)
      for (const thisNote of teamspaceNotes) {
        console.log(`- ${thisNote.filename} (${String(thisNote.content?.length)} bytes)`)
      }
    }

    // If there are no non-Teamspace notes, then log and stop
    if (numNonTeamspaceNotes === 0) {
      logInfo('removeBlankNotes', `No blank non-Teamspace notes found`)
      if (!runSilently) {
        await showMessage(`No blank non-Teamspace notes found to remove. (I can't remove any blank Teamspace notes.)`, 'OK, great!', 'Remove Blank Notes', false)
      }
      return
    }

    // Log the details of all the non-Teamspace notes found, and then proceed to remove them
    logInfo('removeBlankNotes', `- Found ${String(numNonTeamspaceNotes)} blank non-Teamspace notes. Here are their filenames:`)
    for (const thisNote of nonTeamspaceNotes) {
      console.log(`- ${thisNote.filename} (${String(thisNote.content?.length)} bytes)`)
    }
    const numToRemove = numNonTeamspaceNotes

    // Check user wants to proceed
    if (!runSilently) {
      const res = await showMessageYesNo(
        `Shall I move ${String(numToRemove)} blank notes to the NotePlan Trash? (The details are in the Plugin Console.)`,
        ['Yes please', 'No'],
        'Remove Blank Notes',
        false,
      )
      if (res === 'No') {
        return
      }
    }
    if (NotePlan.environment.buildVersion > 1053) {
      logDebug('removeBlankNotes', `Will move all blank notes to the NotePlan Trash`)
    } else {
      logDebug('removeBlankNotes', `Will move all blank regular notes to the NotePlan Trash`)
    }

    // If we get this far, then remove the non-Teamspace notes
    let numRemoved = 0
    for (const thisNote of nonTeamspaceNotes) {
      const filenameForTrash = `@Trash`
      // Deal with a calendar note
      if (thisNote.type === 'Calendar') {
        // Note: before v3.9.3 we can't move Calendar notes, so don't try
        if (NotePlan.environment.buildVersion > 1053) {
          // logDebug('removeBlankNotes', `running DataStore.moveNote("${thisNote.filename}", "${filenameForTrash}", 'calendar')`)
          const res = DataStore.moveNote(thisNote.filename, filenameForTrash, 'Calendar')
          if (res) {
            logDebug('removeBlankNotes', `- moved '${thisNote.filename}' to '${res}'`)
            numRemoved++
          } else {
            logWarn('removeBlankNotes', `- couldn't move '${thisNote.filename}' to '${filenameForTrash}' for some unknown reason.`)
          }
        } else {
          logInfo('removeBlankNotes', `- couldn't move '${thisNote.filename}' to '${filenameForTrash}'; because before v3.9.3, you can't move Calendar notes.`)
        }
        continue // next item in loop
      }
      // Deal differently with a regular note ...
      const res = DataStore.moveNote(thisNote.filename, filenameForTrash)
      // logDebug('removeBlankNotes', `running DataStore.moveNote("${thisNote.filename}", "${filenameForTrash}")`)
      if (res) {
        logDebug('removeBlankNotes', `- moved '${thisNote.filename}' to '${res}'`)
        numRemoved++
      } else {
        logWarn('removeBlankNotes', `- couldn't move '${thisNote.filename}' to '${filenameForTrash}' for some unknown reason.`)
      }
    }

    // Show a completion message
    if (!runSilently) {
      await showMessage(`${String(numRemoved)} blank notes moved to the NotePlan Trash`, 'OK', 'Remove Blank Notes', false)
    } else {
      logInfo('removeBlankNotes', `${String(numRemoved)} blank notes moved to the NotePlan Trash`)
    }
    if (numToRemove !== numRemoved) {
      logWarn('removeBlankNotes', `Note: number removed (${String(numRemoved)}) !== number to remove (${String(numToRemove)}).`)
    }
  } catch (err) {
    logError('removeBlankNotes', JSP(err))
    return // for completeness
  }
}

/**
 * Remove >today tags from completed/canceled todos
 * Plugin entrypoint for command: "/Remove >today tags from completed todos"
 * @author @dwertheimer
 */
export async function removeTodayTagsFromCompletedTodos(runSilently: boolean = false): Promise<void> {
  try {
    // Decide whether to run silently
    logDebug(pluginJson, `removeTodayTagsFromCompletedTodos running ${runSilently ? 'silently' : 'with UI messaging enabled'}`)
    const todayNote = DataStore.calendarNoteByDate(new Date())
    const refs = await getTodaysReferences(todayNote).filter((ref) => ref.content.includes('>today'))
    logDebug(pluginJson, `removeTodayTagsFromCompletedTodos: Found ${refs.length} tasks with >today tags`)
    const itemsToRemove = refs.filter((ref) => ['done', 'cancelled', 'checklistDone', 'checklistCancelled'].includes(ref.type))
    logDebug(pluginJson, `removeTodayTagsFromCompletedTodos: Found ${itemsToRemove.length} COMPLETED tasks with >today tags`)
    clo(itemsToRemove, 'removeTodayTagsFromCompletedTodos, itemsToRemove')
    if (itemsToRemove.length === 0) {
      if (runSilently) {
        logInfo(pluginJson, `No completed tasks with >today tags found`)
      } else {
        await showMessage('No completed tasks with >today tags found')
      }
      return
    } else {
      itemsToRemove.forEach((item) => {
        item.content = item.content.replace(/ ?\>today ?/g, ' ').trim()
        item.note?.updateParagraph(item)
      })
      if (runSilently) {
        logInfo(pluginJson, `Removed >today tags from ${itemsToRemove.length} completed items`)
      } else {
        await showMessage(`Removed >today tags from ${itemsToRemove.length} completed items`)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
