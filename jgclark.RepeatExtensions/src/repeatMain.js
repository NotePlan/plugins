// @flow
//-----------------------------------------------------------------------
// Main functions for Repeat Extensions plugin for NotePlan
// Jonathan Clark
// last updated 2025-09-06, for v1.0.0
//-----------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { sortTasksUnderHeading } from '../../dwertheimer.TaskSorting/src/sortTasks.js'
import {  getRepeatSettings, RE_EXTENDED_REPEAT } from './repeatHelpers'
import type { RepeatConfig} from './repeatHelpers'
import { generateRepeatForPara } from './repeatPara'
import { stringListOrArrayToArray } from "@helpers/dataManipulation"
import { clo, JSP, logDebug, logInfo, logWarn, logError } from "@helpers/dev"
import { logAllEnvironmentSettings } from "@helpers/NPdev"
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { showMessage } from '@helpers/userInput'

//------------------------------------------------------------------

/**
 * Main Command entry point for Repeat Extensions plugin.
 * Process any completed (or cancelled) tasks with my extended @repeat(..) tags, and also remove the HH:MM portion of any @done(...) tasks.
 * Runs on the currently open note (using Editor.* funcs),
 * or (since v0.7.1) on a passed TNote.
 * The actual repeat generation is done by generateRepeatForPara() -- see that function for more details of how it works.
 * TEST: fails to appendTodo to note with same stem?
 * @author @jgclark
 * @param {boolean} runSilently? [default: false]
 * @param {TNote?} noteArg optional note to process
 * @returns {number} number of generated repeats
 */
export async function generateRepeats(
  runSilently: boolean = false,
  noteArg?: TNote
): Promise<number> {
  try {
    // Get passed note details, or fall back to Editor
    let noteToUse: TNote
    let noteIsOpenInEditor = false // when true we can use a faster-to-user function
    if (noteArg) {
      noteToUse = noteArg
      logDebug(pluginJson, `generateRepeats() starting with noteArg -> ${noteToUse.filename}`)
    } else if (Editor && Editor.note) {
      noteToUse = Editor
      noteIsOpenInEditor = true
      logDebug(pluginJson, `generateRepeats() starting with EDITOR -> ${noteToUse.filename}`)
    } else {
      throw new Error(`Couldn't get either passed Note argument or Editor.note: stopping`)
    }
    const { paragraphs, filename } = noteToUse
    if (paragraphs === null) {
      // No note open, or no paragraphs (perhaps empty note), so don't do anything.
      logInfo(pluginJson, 'No note open, or empty note.')
      return 0
    }
    let lineCount = paragraphs.length

    // check if the last paragraph is undefined, and if so delete it from our copy
    if (paragraphs[lineCount] === null) {
      lineCount--
    }

    const config: RepeatConfig = await getRepeatSettings()

    // Work out where to stop looking: default to whole note, but if desired can stop where ## Done or ## Cancelled sections start, if present
    const lastLineIndexToCheck = (config.dontLookForRepeatsInDoneOrArchive)
      ? findEndOfActivePartOfNote(noteToUse) + 1
      : lineCount
    if (lastLineIndexToCheck === 0) {
      logDebug(pluginJson, `generateRepeats() starting for '${filename}' but no active lines so won't process`)
      return 0
    } else {
      logDebug(pluginJson, `generateRepeats() starting for '${filename}' for ${config.dontLookForRepeatsInDoneOrArchive ? 'ACTIVE' : 'ALL'} ${lastLineIndexToCheck} lines`)
    }

    let repeatCount = 0
    let lastHeading = ''
    const headingList: Array<string> = []

    // Go through each line in the active part of the file
    for (let n = 0; n <= lastLineIndexToCheck - 1; n++) {
      const origPara = paragraphs[n]
      const content = origPara.content
      // Test if this is a special extended repeat
      if (content.match(RE_EXTENDED_REPEAT)) {
        // $FlowIgnore[prop-missing]
        const newPara = await generateRepeatForPara(origPara, noteToUse, noteIsOpenInEditor, config)

        if (newPara) {
          repeatCount++
          // Add this para's heading to the list if it's not already there
          if (origPara.heading !== lastHeading) {
            headingList.push(origPara.heading)
          }
          lastHeading = origPara.heading
        }
      }
    }

    // Report if no repeats were found, and stop.
    if (repeatCount === 0) {
      logDebug('generateRepeats', 'No suitable completed repeats were found')
      if (!runSilently) {
        await showMessage('No suitable completed repeats were found', 'OK', 'Repeat Extensions')
      }
      return 0
    }
    logInfo('generateRepeats', `${String(repeatCount)} new repeats were generated`)

    // Run task sorter if its installed, and we want it, and we are working in the Editor
    if (config.runTaskSorter) {
      if (DataStore.isPluginInstalledByID('dwertheimer.TaskSorting')) {
        if (noteIsOpenInEditor) {
          // Attempt to update the cache, so that the task sorter can find the new repeats. Note: it doesn't seem to make a difference.
          // Note: using noteToUse instead of Editor.note generates an Objective-C error.
          // $FlowIgnore[incompatible-call] checked Editor.note is not null
          const res = DataStore.updateCache(Editor.note, false)
          const sortFields = config.taskSortingOrder
            ? stringListOrArrayToArray(config.taskSortingOrder, ',')
            : ["due", "-priority", "content"]

          logInfo('generateRepeats', `Will sort tasks according to user defaults from Task Sorting plugin`)
          // For each changed section, sort the tasks under that heading.
          for (const heading of headingList) {
            logInfo('generateRepeats', `Sorting tasks under heading ${heading} ...`)
            // await DataStore.invokePluginCommandByName('Sort tasks under heading (choose)', 'dwertheimer.TaskSorting', [heading, sortFields, noteToUse])
            await sortTasksUnderHeading(heading, sortFields, noteToUse)
          }

      
      } else {
        logDebug('generateRepeats', `Task sorter plugin is installed, but we are not working in the Editor, so can't run it`)
      }
      } else {
        logError('generateRepeats', `Task Sorting plugin is not installed, so can't run it`)
        }
    }
    return repeatCount
  } catch (error) {
    logError(pluginJson, `generateRepeats(): ${JSP(error)}`)
    return 0
  }
}
