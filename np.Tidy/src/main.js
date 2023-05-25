// @flow
//-----------------------------------------------------------------------------
// Main functions for Tidy plugin
// Jonathan Clark
// Last updated 21.4.2023 for v0.4.0, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { getSettings, type TidyConfig } from './tidyHelpers'
import pluginJson from '../plugin.json'
import { RE_DONE_DATE_TIME, RE_DONE_DATE_TIME_CAPTURES, RE_DONE_DATE_OPT_TIME } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, overrideSettingsWithEncodedTypedArgs, timer } from '@helpers/dev'
import { getFilteredFolderList } from '@helpers/folders'
import { displayTitle, getTagParamsFromString } from '@helpers/general'
import {
  allNotesSortedByChanged,
  getProjectNotesInFolder,
  pastCalendarNotes,
  removeSection
} from '@helpers/note'
import { removeFrontMatterField } from '@helpers/NPFrontMatter'
import { getNotesChangedInInterval, getNotesChangedInIntervalFromList } from '@helpers/NPnote'
import { hasFrontMatter, noteHasFrontMatter } from '@helpers/NPFrontMatter'
import { removeContentUnderHeadingInAllNotes } from '@helpers/NPParagraph'
import { appendStringToSettingArray } from '@helpers/NPSettings'
import { chooseOption, chooseHeading, getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------------------

export async function tidyUpAll(): Promise<void> {
  try {
    logDebug(pluginJson, `tidyUpAll: Starting`)

    // Show dialog to show its working
    CommandBar.showLoading(true, `Tidy Up ...`, 0)

    // Get plugin settings (config)
    const config: TidyConfig = await getSettings()
    CommandBar.showLoading(true, `Tidy Up ...`, 0.1)

    if (config.runRemoveOrphansCommand) {
      logDebug('tidyUpAll', `Starting removeOrphanedBlockIDs...`)
      await removeOrphanedBlockIDs(config.runSilently)
    }
    CommandBar.showLoading(true, `Tidy Up ...`, 0.4)

    // Following functions take params; so send runSilently as a param
    const param = config.runSilently ? '{"runSilently": true}' : ''
    if (config.runRemoveDoneMarkersCommand) {
      logDebug('tidyUpAll', `Starting removeDoneMarkers...`)
      await removeDoneMarkers(param)
    }
    CommandBar.showLoading(true, `Tidy Up ...`, 0.5)
    if (config.runRemoveDoneTimePartsCommand) {
      logDebug('tidyUpAll', `Starting removeDoneTimeParts...`)
      await removeDoneTimeParts(param)
    }
    CommandBar.showLoading(true, `Tidy Up ...`, 0.6)

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

    if (config.removeTriggersFromRecentCalendarNotes) {
      logDebug('tidyUpAll', `Starting removeDoneTimeParts...`)
      await removeTriggersFromRecentCalendarNotes(param)
    }
    CommandBar.showLoading(true, `Tidy Up ...`, 0.9)

    // stop spinner
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
    const numDays: number = await getTagParamsFromString(params ?? '', 'numDays', config.numDays)
    logDebug('removeDoneMarkers', `numDays = ${String(numDays)}`)
    // Note: can be 0 at this point, which implies process all days

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('removeDoneMarkers', `runSilently = ${String(runSilently)}`)

    // Find which notes have @done(...) tags
    let start = new Date()
    // Use multi-threaded DataStore.search() to look for "@done(", and then use regex to narrow down. This also implements foldersToExclude for us.
    // (It's twice as quick as doing a more exact regex over all notes in my testing.)
    let parasToCheck: $ReadOnlyArray<TParagraph> = await DataStore.search('@done(', ['calendar', 'notes'], [], config.foldersToExclude)
    const RE = new RegExp(RE_DONE_DATE_OPT_TIME) // @done(date) or @done(date time)
    let allMatchedParas: Array<TParagraph> = parasToCheck.filter((p) => RE.test(p.content)) ?? []

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
    let recentMatchedParas: Array<TParagraph> = allMatchedParas.filter((p) => p.note.changedDate >= jsdateToStartLooking)

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
    const numDays: number = await getTagParamsFromString(params ?? '', 'numDays', config.numDays)
    logDebug('removeDoneTimeParts', `numDays = ${String(numDays)}`)
    // Note: can be 0 at this point, which implies process all days

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('removeDoneTimeParts', `runSilently = ${String(runSilently)}`)

    // Find which notes have @done(...) tags
    let start = new Date()
    // Use multi-threaded DataStore.search() to look for "@done(", and then use regex to narrow down. This also implements foldersToExclude for us.
    // Note: It's twice as quick as doing a more exact regex over all notes in my testing.
    let parasToCheck: $ReadOnlyArray<TParagraph> = await DataStore.search('@done(', ['calendar', 'notes'], [], config.foldersToExclude)
    const RE = new RegExp(RE_DONE_DATE_TIME)
    let allMatchedParas: Array<TParagraph> = parasToCheck.filter((p) => RE.test(p.content)) ?? []

    // Get date range to use
    const todayStart = new moment().startOf('day') // use moment instead of `new Date` to ensure we get a date in the local timezone
    const momentToStartLooking = todayStart.subtract(numDays, 'days')
    const jsdateToStartLooking = momentToStartLooking.toDate()

    // $FlowFixMe(incompatible-type)
    let recentMatchedParas: Array<TParagraph> = allMatchedParas.filter((p) => p.note.changedDate >= jsdateToStartLooking)

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
 * Remove a given section from recently-changed Notes
 * Can be passed parameters to override default time interval through an x-callback call
 * @author @jgclark
 * @param {?string} params optional JSON string
 */
export async function removeSectionFromRecentNotes(params: string = ''): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: TidyConfig = await getSettings()
    // Setup main variables
    if (params) {
      logDebug(pluginJson, `removeSectionFromRecentNotes: Starting with params '${params}'`)
      config = overrideSettingsWithEncodedTypedArgs(config, params)
      clo(config, `config after overriding with params '${params}'`)
    } else {
      // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
      logDebug(pluginJson, `removeSectionFromRecentNotes: Starting with no params`)
    }

    // Get num days to process from param, or by asking user if necessary
    const numDays: number = await getTagParamsFromString(params ?? '', 'numDays', config.numDays)
    logDebug('removeSectionFromRecentNotes', `numDays = ${String(numDays)}`)
    // Note: can be 0 at this point, which implies process all days

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('removeSectionFromRecentNotes', `runSilently = ${String(runSilently)}`)

    // Decide what matching type to use
    const matchType: string = await getTagParamsFromString(params ?? '', 'matchType', config.matchType)
    logDebug('removeSectionFromRecentNotes', `matchType = ${matchType}`)
    // If not passed as a parameter already, ask for section heading to remove
    let sectionHeading: string = await getTagParamsFromString(params ?? '', 'sectionHeading', '')
    if (sectionHeading === '') {
      const res: string | boolean = await getInputTrimmed("What's the heading of the section you'd like to remove from some notes?", 'OK', 'Remove Section from Notes')
      if (res === false) {
        return
      } else {
        sectionHeading = String(res) // to help flow
      }
    }
    logDebug('removeSectionFromRecentNotes', `sectionHeading = ${sectionHeading}`)

    // Find which notes have such a section to remove
    // Find notes with matching heading (or speed, let's multi-core search the notes to find the notes that contain this string)
    let allMatchedParas: $ReadOnlyArray<TParagraph> = await DataStore.search(sectionHeading, ['calendar', 'notes'], [], config.foldersToExclude)
    // This returns all the potential matches, but some may not be headings, so now check for those
    switch (matchType) {
      case 'Exact': {
        allMatchedParas = allMatchedParas.filter((n) => n.type === 'title' && n.content === sectionHeading)
      }
      case 'Starts with': {
        allMatchedParas = allMatchedParas.filter((n) => n.type === 'title' && n.content.startsWith(sectionHeading))
      }
      case 'Contains': {
        allMatchedParas = allMatchedParas.filter((n) => n.type === 'title' && n.content.includes(sectionHeading))
      }
    }
    let numToRemove = allMatchedParas.length
    // $FlowFixMe[incompatible-call]
    const allMatchedNotes = allMatchedParas.map((p) => p.note)
    logDebug('removeSectionFromRecentNotes', `- ${String(numToRemove)} matches of '${sectionHeading}' as heading from ${String(allMatchedNotes.length)} notes`)

    // Now keep only those changed recently (or all if numDays === 0)
    // $FlowFixMe[incompatible-type]
    const notesToProcess: Array<TNote> = numDays > 0 ? getNotesChangedInIntervalFromList(allMatchedNotes, numDays) : allMatchedNotes
    numToRemove = notesToProcess.length

    if (numToRemove > 0) {
      logDebug('removeSectionFromRecentNotes', `- ${String(numToRemove)} are in the right date interval:`)
      const titlesList = notesToProcess.map((m) => displayTitle(m))
      logDebug('removeSectionFromRecentNotes', titlesList)
      // Check user wants to proceed (if not calledWithParams)
      if (!runSilently) {
        const res = await showMessageYesNo(`Do you want to remove ${String(numToRemove)} '${sectionHeading}' sections?`, ['Yes', 'No'], 'Remove Section from Notes')
        if (res === 'No') {
          logInfo('removeSectionFromRecentNotes', `User cancelled operation`)
          return
        }
      }
      // Actually remove those sections
      for (const note of notesToProcess) {
        logDebug('removeSectionFromRecentNotes', `- Removing section in note '${displayTitle(note)}'`)
        const lineNum = removeSection(note, sectionHeading)
      }
    } else {
      if (!runSilently) {
        const res = await showMessage(`No sections with heading '${sectionHeading}' were found to remove`)
      }
      logWarn('removeSectionFromRecentNotes', `No sections with heading '${sectionHeading}' were found to remove`)
    }

    return
  } catch (err) {
    logError('removeSectionFromRecentNotes', err.message)
    return // for completeness
  }
}

/**
 * WARNING: Dangerous! Remove a given section from all Notes.
 * Can be passed parameters to override default settings.
 * @author @jgclark wrapping function by @dwertheimer
 * @param {?string} params optional JSON string
 */
export async function removeSectionFromAllNotes(params: string = ''): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: TidyConfig = await getSettings()
    // Setup main variables
    if (params) {
      logDebug(pluginJson, `removeSectionFromAllNotes: Starting with params '${params}'`)
      config = overrideSettingsWithEncodedTypedArgs(config, params)
      clo(config, `config after overriding with params '${params}'`)
    } else {
      // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
      logDebug(pluginJson, `removeSectionFromAllNotes: Starting with no params`)
    }

    // Decide whether to run silently, using parameter if given
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('removeDoneMarkers', `runSilently = ${String(runSilently)}`)
    // We also need a string version of this for legacy reasons
    const runSilentlyAsString: string = runSilently ? 'yes' : 'no'

    // Decide whether to keep heading, using parameter if given
    const keepHeading: boolean = await getTagParamsFromString(params ?? '', 'keepHeading', false)

    // If not passed as a parameter already, ask for section heading to remove
    let sectionHeading: string = await getTagParamsFromString(params ?? '', 'sectionHeading', '')
    if (sectionHeading === '') {
      const res: string | boolean = await getInputTrimmed("What's the heading of the section you'd like to remove from all notes?", 'OK', 'Remove Section from Notes')
      if (res === false) {
        return
      } else {
        sectionHeading = String(res) // to help flow
      }
    }
    logDebug('removeSectionFromRecentNotes', `sectionHeading = ${sectionHeading}`)

    // TODO: Ideally work out how many this will remove, and then use this code:
    // const numToRemove = 1
    // if (numToRemove > 0) {
    //   if (!runSilently) {
    //     const res = await showMessageYesNo(`Are you sure you want to remove ${numToRemove} '${sectionHeading}' sections?`, ['Yes', 'No'], 'Remove Section from Notes')
    //     if (res === 'No') {
    //       logInfo('removeSectionFromRecentNotes', `User cancelled operation`)
    //       return
    //     }
    //   }

    // Run the powerful removal function by @dwertheimer
    removeContentUnderHeadingInAllNotes(['calendar', 'notes'], sectionHeading, keepHeading, runSilentlyAsString)
    logInfo(pluginJson, `Removed '${sectionHeading}' sections from all notes`)

    // } else {
    // if (!runSilently) {
    //   const res = await showMessage(`No sections with heading '${sectionHeading}' were found to remove`)
    //   logInfo(pluginJson, `No sections with sectionHeading '${sectionHeading}' were found to remove`)
    // } else {
    //   logDebug(pluginJson, `No sections with sectionHeading '${sectionHeading}' were found to remove`)
    // }
    // }
    return
  } catch (err) {
    logError('removeSectionFromAllNotes', JSP(err))
    return // for completeness
  }
}

/**
 * Remove Remove one or more triggers from recent (but past) calendar notes.
 * Can be passed parameters to override default time interval through an x-callback call
 * @author @jgclark
 * @param {string?} params optional JSON string
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
      // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
      logDebug(pluginJson, `removeTriggersFromRecentCalendarNotes: Starting with no params`)
    }

    // Get num days to process from param, or by asking user if necessary
    const numDays: number = await getTagParamsFromString(params ?? '', 'numDays', config.numDays)
    logDebug('removeTriggersFromRecentCalendarNotes', `numDays = ${String(numDays)}`)
    // Note: can be 0 at this point, which implies process all days

    // Decide whether to run silently
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    // logDebug('removeTriggersFromRecentCalendarNotes', `runSilently = ${String(runSilently)}`)

    // Find past calendar notes changed recently (or all if numDays === 0)
    // Earlier method:
    // const calendarParasWithTrigger = DataStore.searchCalendarNotes('triggers:', false)
    // v2 method:
    const thePastCalendarNotes = pastCalendarNotes()
    logDebug('removeTriggersFromRecentCalendarNotes', `thePastCalendarNotes.length = ${String(thePastCalendarNotes.length)}`)
    const notesToProcess: Array<TNote> = numDays > 0
      ? getNotesChangedInIntervalFromList(thePastCalendarNotes, numDays)
      : thePastCalendarNotes
    const numToProcess = notesToProcess.length

    if (numToProcess > 0) {
      let countRemoved = 0
      // logDebug('removeTriggersFromRecentCalendarNotes', `checking ${String(numToProcess)} notes in the right date interval:`)
      // For each note, try the removal
      for (const note of notesToProcess) {
        // Only proceed if the note actually has frontmatter
        if (noteHasFrontMatter(note)) {
          const result = removeFrontMatterField(note, 'triggers', '', true)
          if (result) {
            logDebug('removeTriggersFromRecentCalendarNotes', `removed frontmatter trigger field from ${displayTitle(note)}`)
            countRemoved++
          } else {
            logWarn('removeTriggersFromRecentCalendarNotes', `failed to remove frontmatter trigger field from ${displayTitle(note)} for some reason`)
          }
        }
        else {
          // logDebug('removeTriggersFromRecentCalendarNotes', `no frontmatter in ${displayTitle(note)}`)
        }
      }
      if (!runSilently) await showMessage(`Removed ${countRemoved} triggers from recent ${numToProcess} calendar notes`)
    }

    return
  } catch (err) {
    logError('removeTriggersFromRecentCalendarNotes', err.message)
    return // for completeness
  }
}

/**
 * Write a list of Log notes changed in the last interval of days to the plugin log. It will default to the 'Default Recent Time Interval' setting unless passed as a JSON parameter.
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
    const notesList = getNotesChangedInInterval(numDays)
    const titlesList = notesList.map((m) => displayTitle(m))
    logInfo(pluginJson, `${String(titlesList.length)} Notes have changed in last ${String(numDays)} days:\n${String(titlesList)}`)
  } catch (err) {
    logError('logNotesChangedInInterval', JSP(err))
    return // for completeness
  }
}

/**
 * For each root-level note, asks user which folder to move it to. (There's a setting for ones to ignore.)
 * @author @jgclark
 */
export async function fileRootNotes(): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: TidyConfig = await getSettings()

    // Get all root notes
    const rootNotes = getProjectNotesInFolder('/')
    // logDebug('rootNotes', rootNotes.map((n) => n.title))

    // Remove any listed in config.rootNotesToIgnore
    const excludedNotes = config.rootNotesToIgnore ?? []
    logDebug('excludedNotes', String(excludedNotes))
    const rootNotesToUse = rootNotes.filter((n) => !excludedNotes.includes(n.title))
    logDebug(
      'rootNotesToUse',
      rootNotesToUse.map((n) => n.title),
    )

    // Make list of all folders (other than root!)
    const allFolders = getFilteredFolderList([], true, [], false)
    logDebug('allFolders', String(allFolders))

    // Pre-pend some special items
    allFolders.unshift(`🗑️ Delete this note`)
    allFolders.unshift(`❌ Stop processing`)
    allFolders.unshift(`➡️ Ignore this note from now on`)
    allFolders.unshift(`➡️ Leave this note in root`)
    logDebug('allFolders', String(allFolders))
    const options = allFolders.map((f) => ({
      label: f,
      value: f,
    }))

    // Save currently open note in Editor
    const openEditorNote = Editor?.note

    // Loop over the rest, asking where to move to
    let numMoved = 0
    for (const n of rootNotesToUse) {
      if (n && n.title && n.title !== undefined) {
        const thisTitle = n.title // to pacify flow
        const thisFilename = n.filename // to pacify flow
        // open the note we're going to move in the Editor to help user assess what to do
        const res = await Editor.openNoteByFilename(thisFilename)

        const chosenFolder = await chooseOption(`Move '${thisTitle}' to which folder?`, options)
        switch (chosenFolder) {
          case '❌ Stop processing': {
            logInfo('fileRootNotes', `User cancelled operation.`)
            return
          }
          case '➡️ Ignore this note from now on': {
            const ignoreRes = appendStringToSettingArray("rootNotesToIgnore", thisTitle)
            if (ignoreRes) {
              logInfo('fileRootNotes', `Ignoring '${thisTitle}' from now on; this note has been appended it to the plugin's settings`)
            } else {
              logError('fileRootNotes', `Error when trying to add '${thisTitle}' to the plugin setting "rootNotesToIgnore"`)
            }
            break
          }
          case '➡️ Leave this note in root': {
            logDebug('fileRootNotes', `Leaving '${thisTitle}' note in root`)
            break
          }
          case '🗑️ Delete this note': {
            logInfo('fileRootNotes', `User has asked for '${thisTitle}' to be deleted ...`)
            const res = DataStore.moveNote(n.filename, '@Trash')
            if (res && res !== '') {
              logDebug('fileRootNotes', '... done')
              numMoved++
            } else {
              logError('fileRootNotes', `Couldn't delete it for some reason`)
            }
            break
          }
          default: {
            logDebug('fileRootNotes', `Moving '${thisTitle}' note to folder '${chosenFolder}' ...`)
            const res = DataStore.moveNote(n.filename, chosenFolder)
            if (res && res !== '') {
              logDebug('fileRootNotes', `... filename now '${res}'`)
              numMoved++
            } else {
              logError('fileRootNotes', `... Failed to move it for some reason`)
            }
          }
        }
      } else {
        logError('fileRootNotes', `Failed to get note for some reason`)
      }
    }

    // Show a completion message
    logDebug('fileRootNotes', `${String(numMoved)} notes moved from the root folder`)
    const res = await showMessage(`${String(numMoved)} notes moved from the root folder`, 'OK', 'File root-level notes', false)

    // Restore original note (if it was open)
    if (openEditorNote) {
      Editor.openNoteByFilename(openEditorNote.filename)
    }
  } catch (err) {
    logError('fileRootNotes', JSP(err))
    return // for completeness
  }
}

/**
 * Remove orphaned blockIDs in all notes.
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
      const recentMatchedNotes = getNotesChangedInIntervalFromList(allMatchedNotes, config.numDays)
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

    // // Log the singleton blockIDs
    // logDebug('removeOrphanedBlockIDs', `\nFound these '${String(numToRemove)} orphaned blockIDs:`)
    // for (const thisPara of singletonBlockIDParas) {
    //   const otherBlockIDsForThisPara = DataStore.referencedBlocks(thisPara)
    //   console.log(`'${thisPara.content}' in '${displayTitle(thisPara.note)}'`)
    // }

    if (!runSilently) {
      res = await showMessageYesNo(`Shall I proceed to remove ${String(numToRemove)} orphaned blockIDs?`, ['Yes please', 'No'], 'Remove Orphaned blockIDs', false)
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
