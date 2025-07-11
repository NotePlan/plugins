// @flow
//-----------------------------------------------------------------------------
// Main functions for Tidy plugin
// Jonathan Clark
// Last updated 2025-06-24 for v0.14.8, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { moveTopLevelTasksInNote } from './topLevelTasks'
import { getSettings, type TidyConfig } from './tidyHelpers'
import { clo, JSP, logDebug, logError, logInfo, logWarn, overrideSettingsWithEncodedTypedArgs, timer } from '@helpers/dev'
import { displayTitle, getTagParamsFromString } from '@helpers/general'
import { allNotesSortedByChanged, pastCalendarNotes, removeSection } from '@helpers/note'
import { getNotesChangedInIntervalFromList } from '@helpers/NPnote'
import { findHeading, findHeadingInNotes, removeContentUnderHeadingInAllNotes } from '@helpers/NPParagraph'
import { getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------------------

/**
 * Remove a given section (by matching on their section heading) from recently-changed Notes. Note: does not match on note title.
 * Can be passed parameters to override default time interval through an x-callback call.
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
    const numDays: number = await getTagParamsFromString(params ?? '', 'numDays', config.numDays || 0)
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
      const res: string | boolean = await getInputTrimmed(`What's the heading of the section you'd like to remove from ${numDays > 0 ? 'some' : 'all'} notes?`, 'OK', 'Remove Section from Notes')
      if (res === false) {
        return
      } else {
        sectionHeading = String(res) // to help flow
      }
    }
    logDebug('removeSectionFromRecentNotes', `sectionHeading = ${sectionHeading}`)

    // Find which notes have such a section to remove
    // Find notes with matching heading (or speed, let's multi-core search the notes to find the notes that contain this string)
    let allMatchedParas: $ReadOnlyArray<TParagraph> = await DataStore.search(sectionHeading, ['calendar', 'notes'], [], config.removeFoldersToExclude)
    // This returns all the potential matches, but some may not be headings, so now check for those
    switch (matchType) {
      case 'Exact':
        allMatchedParas = allMatchedParas.filter((n) => n.type === 'title' && n.content === sectionHeading && n.headingLevel !== 1)
        break
      case 'Starts with':
        allMatchedParas = allMatchedParas.filter((n) => n.type === 'title' && n.content.startsWith(sectionHeading) && n.headingLevel !== 1)
        break
      case 'Contains':
        allMatchedParas = allMatchedParas.filter((n) => n.type === 'title' && n.content.includes(sectionHeading) && n.headingLevel !== 1)
    }
    let numToRemove = allMatchedParas.length
    const allMatchedNotes = allMatchedParas.map((p) => p.note)
    logDebug('removeSectionFromRecentNotes', `- ${String(numToRemove)} matches of '${sectionHeading}' as heading from ${String(allMatchedNotes.length)} notes`)

    // Now keep only those changed recently (or all if numDays === 0)
    // $FlowFixMe[incompatible-type]
    const notesToProcess: Array<TNote> = numDays > 0 ? getNotesChangedInIntervalFromList(allMatchedNotes.filter(Boolean), numDays) : allMatchedNotes
    numToRemove = notesToProcess.length

    if (numToRemove > 0) {
      logDebug('removeSectionFromRecentNotes', `- ${String(numToRemove)} are in the right date interval:`)
      const titlesList = notesToProcess.map((m) => displayTitle(m))
      logDebug('removeSectionFromRecentNotes', titlesList)
      // Check user wants to proceed (if not calledWithParams)
      if (!runSilently) {
        const res = await showMessageYesNo(`Do you want to remove ${String(numToRemove)} '${sectionHeading}' sections?`, ['Yes', 'No'], 'Remove Section from Notes')
        if (res !== 'Yes') {
          logInfo('removeSectionFromRecentNotes', `User cancelled operation`)
          return
        }
      }
      // Actually remove those sections
      for (const note of notesToProcess) {
        logDebug('removeSectionFromRecentNotes', `- Removing section in note '${displayTitle(note)}'`)
        // const lineNum =
        removeSection(note, sectionHeading)
      }
    } else {
      if (!runSilently) {
        const res = await showMessage(`No sections with heading '${sectionHeading}' were found to remove`)
      }
      logInfo('removeSectionFromRecentNotes', `No sections with heading '${sectionHeading}' were found to remove`)
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
    logDebug('removeDoneMarkers', `runSilently: ${String(runSilently)}`)
    // We also need a string version of this for legacy reasons
    const runSilentlyAsString: string = runSilently ? 'yes' : 'no'

    // Decide whether to keep heading, using parameter if given
    const keepHeading: boolean = await getTagParamsFromString(params ?? '', 'keepHeading', false)

    // If not passed as a parameter already, ask for section heading to remove
    let sectionHeading: string = await getTagParamsFromString(params ?? '', 'sectionHeading', '')
    if (sectionHeading === '') {
      const res: string | boolean = await getInputTrimmed("What's the heading of the section you'd like to remove from ALL notes?", 'OK', 'Remove Section from Notes')
      if (res === false) {
        return
      } else {
        sectionHeading = String(res) // to help flow
      }
    }
    logDebug('removeSectionFromAllNotes', `sectionHeading: '${sectionHeading}'`)
    logDebug('removeSectionFromAllNotes', `matchType: '${config.matchType}'`)
    logDebug('removeSectionFromAllNotes', `removeFoldersToExclude: '${String(config.removeFoldersToExclude)}'`)

    // Now see how many matching headings there are
    let parasToRemove = await findHeadingInNotes(sectionHeading, config.matchType, config.removeFoldersToExclude, true)
    // Ideally work out how many this will remove, and then use this code:
    if (parasToRemove.length > 0) {
      if (!runSilently) {
        const res = await showMessageYesNo(`Are you sure you want to remove ${String(parasToRemove.length)} '${sectionHeading}' sections? (See Plugin Console for full list)`, ['Yes', 'No'], 'Remove Section from Notes')
        if (res === 'No') {
          logInfo('removeSectionFromAllNotes', `User cancelled operation`)
          return
        }
      }

      // Run the powerful removal function by @dwertheimer
      removeContentUnderHeadingInAllNotes(['Calendar', 'Notes'], sectionHeading, keepHeading, runSilentlyAsString)
      logInfo(pluginJson, `Removed '${sectionHeading}' sections from all notes`)

    } else {
      if (!runSilently) {
        logInfo(pluginJson, `No sections with sectionHeading '${sectionHeading}' were found to remove`)
        const res = await showMessage(`No sections with heading '${sectionHeading}' were found to remove`)
      } else {
        logDebug(pluginJson, `No sections with sectionHeading '${sectionHeading}' were found to remove`)
      }
    }
    return
  } catch (err) {
    logError('removeSectionFromAllNotes', JSP(err))
    return // for completeness
  }
}
