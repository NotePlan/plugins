// @flow
//-----------------------------------------------------------------------------
// Main functions for Tidy plugin
// Jonathan Clark
// Last updated 19.1.2023 for v0.2.0, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment'
import * as helpers from './helpers'
import pluginJson from '../plugin.json'
import { RE_DONE_DATE_TIME, RE_DONE_DATE_TIME_CAPTURES, RE_DONE_DATE_OPT_TIME } from '@helpers/dateTime'
import {
  clo, JSP, logDebug, logError, logInfo, logWarn,
  overrideSettingsWithEncodedTypedArgs, timer
} from '@helpers/dev'
import { getFilteredFolderList } from '@helpers/folders'
import { displayTitle, getTagParamsFromString } from '@helpers/general'
import { getProjectNotesInFolder, removeSection } from '@helpers/note'
import { removeContentUnderHeadingInAllNotes } from '@helpers/NPParagraph'
import { chooseOption, chooseHeading, getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

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
    let config: helpers.TidyConfig = await helpers.getSettings()
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
    const momentToStartLooking = todayStart.subtract(numDays, "days")
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
        // TODO: In time could show titlesList in HTML pop-up

        const res = await showMessageYesNo(`Do you want to remove ${String(numToRemove)} @done(...) markers?`, ['Yes', 'No'], 'Remove @done() markers')
        if (res === 'No') {
          logInfo('removeDoneMarkers', `User cancelled operation`)
          return
        }
      }
      // Actually remove the markers from the paras
      // Note: doesn't work reliably going forward through paras. Tried going backwards through paras ... but same issues.
      // TODO: Try going note by note doing updateParagraphs() instead
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
  }
  catch (err) {
    logError('removeDoneMarkers', err.message)
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
    let config: helpers.TidyConfig = await helpers.getSettings()
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
    const momentToStartLooking = todayStart.subtract(numDays, "days")
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
        // TODO: In time could show titlesList in HTML pop-up

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
  }
  catch (err) {
    logError('removeDoneTimeParts', err.message)
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
    let config: helpers.TidyConfig = await helpers.getSettings()
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
      const res: string | boolean = await getInputTrimmed("What's the heading of the section you'd like to remove from some notes?", 'OK', "Remove Section from Notes")
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
    const notesToProcess: Array<TNote> = (numDays > 0) ? helpers.getNotesChangedInIntervalFromList(allMatchedNotes, numDays) : allMatchedNotes
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
  }
  catch (err) {
    logError('removeSectionFromRecentNotes', err.message)
    return // for completeness
  }
}

/**
 * WARNING: Dangerous! Remove a given section from all Notes.
 * ??? Can be passed parameters to override default settings
 * @author @jgclark wrapping function by @dwertheimer
 * @param {?string} params optional JSON string
 */
export async function removeSectionFromAllNotes(params: string = ''): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: helpers.TidyConfig = await helpers.getSettings()
    // Setup main variables
    if (params) {
      logDebug('removeSectionFromAllNotes', `Starting with params '${params}'`)
      config = overrideSettingsWithEncodedTypedArgs(config, params)
      clo(config, `config after overriding with params '${params}'`)
    } else {
      // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
      logDebug('removeSectionFromAllNotes', `Starting with no params`)
    }

    // Decide whether to run silently, using parameter if given
    const runSilently: boolean = await getTagParamsFromString(params ?? '', 'runSilently', false)
    logDebug('removeDoneMarkers', `runSilently = ${String(runSilently)}`)
    // We also need a string version of this for legacy reasons
    const runSilentlyAsString: string = runSilently ? "yes" : "no"

    // Decide whether to keep heading, using parameter if given
    const keepHeading: boolean = await getTagParamsFromString(params ?? '', 'keepHeading', false)

    // If not passed as a parameter already, ask for section heading to remove
    let sectionHeading: string = await getTagParamsFromString(params ?? '', 'sectionHeading', '')
    if (sectionHeading === '') {
      const res: string | boolean = await getInputTrimmed("What's the heading of the section you'd like to remove from all notes?", 'OK', "Remove Section from Notes")
      if (res === false) {
        return
      } else {
        sectionHeading = String(res) // to help flow
      }
    }
    logDebug('removeSectionFromRecentNotes', `sectionHeading = ${sectionHeading}`)


    // TODO: Work out how many this will remove
    const numToRemove = 1

    if (numToRemove > 0) {
      if (!runSilently) {
        const res = await showMessageYesNo(`Are you sure you want to remove ${numToRemove} '${sectionHeading}' sections?`, ['Yes', 'No'], 'Remove Section from Notes')
        if (res === 'No') {
          logInfo('removeSectionFromRecentNotes', `User cancelled operation`)
          return
        }
      }
      // Run the powerful removal function by @dwertheimer
      removeContentUnderHeadingInAllNotes(['calendar', 'notes'], sectionHeading, keepHeading, runSilentlyAsString)
      logInfo(pluginJson, `Removed '${sectionHeading}' sections from all notes`)
    } else {
      const res = await showMessage(`No sections with heading '${sectionHeading}' were found to remove`)
      logInfo(pluginJson, `No sections with sectionHeading '${sectionHeading}' were found to remove`)
    }
    return
  }
  catch (err) {
    logError('removeSectionFromAllNotes', JSP(err))
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
    let config: helpers.TidyConfig = await helpers.getSettings()
    if (params) {
      logDebug(pluginJson, `logNotesChangedInInterval: Starting with params '${params}'`)
      config = overrideSettingsWithEncodedTypedArgs(config, params)
      clo(config, `config after overriding with params '${params}'`)
    } else {
      // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
      logDebug(pluginJson, `logNotesChangedInInterval: Starting with no params`)
    }

    const numDays = config.numDays
    const notesList = helpers.getNotesChangedInInterval(numDays)
    const titlesList = notesList.map((m) => displayTitle(m))
    logInfo(pluginJson, `${String(titlesList.length)} Notes have changed in last ${String(numDays)} days:\n${String(titlesList)}`)
  }
  catch (err) {
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
    let config: helpers.TidyConfig = await helpers.getSettings()

    // Probably not needed
    // if (params) {
    //   logDebug(pluginJson, `fileRootNotes: Starting with params '${params}'`)
    //   config = overrideSettingsWithEncodedTypedArgs(config, params)
    //   clo(config, `config after overriding with params '${params}'`)
    // } else {
    //   // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
    logDebug(pluginJson, `fileRootNotes: Starting with no params`)
    // }

    // Get all root notes
    const rootNotes = getProjectNotesInFolder('/')
    logDebug('rootNotes', rootNotes.map((n) => n.title))

    // Remove any listed in config.rootNotesToIgnore
    const excludedNotes = config.rootNotesToIgnore
    logDebug('excludedNotes', typeof excludedNotes)
    logDebug('excludedNotes', String(excludedNotes))
    const rootNotesToUse = rootNotes.filter((n) => !excludedNotes.includes(n.title))
    logDebug('rootNotesToUse', rootNotesToUse.map((n) => n.title))

    // Make list of all folders (other than root!)
    const allFolders = getFilteredFolderList(['/'], true)

    // Pre-pend some special items
    allFolders.unshift('❌ Stop processing')
    allFolders.unshift('➡️ Leave this note in root')
    // TODO: pre-pend a special one meaning 'ignore me from now on'
    logDebug('allFolders', String(allFolders))
    const options = allFolders.map((f) => ({
      label: f,
      value: f,
    }))

    // Loop over the rest, asking where to move to
    for (const n of rootNotesToUse) {
      if (n && n.title && n.title !== undefined) {
        const chosenFolder = await chooseOption(`Move ${n.title} to which folder?`, options)
        switch (chosenFolder) {
          case '❌ Stop processing': {
            logInfo('rootNotesToUse', `User cancelled operation.`)
            return
          }
          case '➡️ Leave this note in root': {
            // $FlowIgnore[incompatible-type]
            logDebug('rootNotesToUse', `Leaving '${n.title}' note in root`)
            break
          }
          default: {
            // $FlowIgnore[incompatible-type]
            logDebug('rootNotesToUse', `Moving '${n.title}' note to folder '${chosenFolder}' ...`)
            // $FlowIgnore[incompatible-call]
            const res = DataStore.moveNote(n.filename, chosenFolder)
            logDebug('rootNotesToUse', `... filename now '${res ?? '<error>'}'`)
          }
        }
      }
    }
  }
  catch (err) {
    logError('logNotesChangedInInterval', JSP(err))
    return // for completeness
  }

}

/**
 * ???
 */
export async function bob(): Promise<void> {
  try {
    // Get plugin settings (config)
    let config: helpers.TidyConfig = await helpers.getSettings()

    // Is this needed?
    // if (params) {
    //   logDebug('bob', `Starting with params '${params}'`)
    //   config = overrideSettingsWithEncodedTypedArgs(config, params)
    //   clo(config, `config after overriding with params '${params}'`)
    // } else {
    //   // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
    logDebug('bob', `Starting with no params`)
    // }

  }
  catch (err) {
    logError('bob', JSP(err))
    return // for completeness
  }

}