// @flow
//-----------------------------------------------------------------------
// Main functions for Repeat Extensions plugin for NotePlan
// Jonathan Clark
// last updated 2026-04-28, for v1.1.2
//-----------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { sortTasksUnderHeading } from '../../dwertheimer.TaskSorting/src/sortTasks.js'
import {  getRepeatSettings, RE_EXTENDED_REPEAT } from './repeatHelpers'
import type { RepeatConfig} from './repeatHelpers'
import { generateRepeatForPara } from './repeatPara'
import { stringListOrArrayToArray } from "@helpers/dataManipulation"
import { RE_DONE_DATE_TIME } from '@helpers/dateTime'
import { clo, JSP, logDebug, logInfo, logWarn, logError } from "@helpers/dev"
import { logAllEnvironmentSettings } from "@helpers/NPdev"
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { showMessage } from '@helpers/userInput'

//------------------------------------------------------------------

/**
 * Main Command entry point for Repeat Extensions plugin.
 * Process any completed (or cancelled) tasks with my extended @repeat(..) tags, and also remove the HH:MM portion of any @done(...) tasks.
 * Runs on the currently open note (using Editor.* funcs), or passed TNote (if given).
 * If using passed TNote it will *not* use Editor.* funcs, to avoid problems running onAsyncThread from Tidy Up plugin. 
 * Note: The actual repeat generation is done by generateRepeatForPara() -- see that function for more details of how it works.
 * TEST: fails to appendTodo to note with same stem?
 * @author @jgclark
 * @param {boolean} runSilently? [default: false]
 * @param {CoreNoteFields?} noteArg optional note to process
 * @param {boolean} allowedToUseEditor? [default: true] If false, never use Editor.* funcs to edit the note. This is required for running onAsyncThread from Tidy Up plugin.
 * @returns {number} number of generated repeats. Note: this is only relevant if the note is passed as an argument, not if the currently open note is used.
 */
export async function generateRepeats(
  runSilently: boolean = false,
  noteArg?: CoreNoteFields,
  allowedToUseEditor: boolean = true
): Promise<number> {
  try {
    // Get passed note details, or fall back to Editor
    let noteToUse: CoreNoteFields
    if (noteArg) {
      noteToUse = noteArg
      logDebug(pluginJson, `generateRepeats starting: noteArg '${noteToUse.filename}'`)
    } else if (Editor && Editor.note) {
      noteToUse = Editor
      logDebug(pluginJson, `generateRepeats starting: EDITOR (${noteToUse.filename})`)
    } else {
      throw new Error(`Couldn't get either passed Note argument or Editor.note: stopping`)
    }
    const { paragraphs } = noteToUse
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
    if (config == null) {
      return 0
    }

    // Work out where to stop looking: default to whole note, but if desired can stop where ## Done or ## Cancelled sections start, if present
    const lastLineIndexToCheck = (config.dontLookForRepeatsInDoneOrArchive)
      ? findEndOfActivePartOfNote(noteToUse) + 1
      : lineCount
    if (lastLineIndexToCheck === 0) {
      // logDebug(pluginJson, `generateRepeats() starting for '${filename}' but no active lines so won't process`)
      return 0
    }

    let repeatCount = 0
    let lastHeading = ''
    const headingList: Array<string> = []

    // Go through each line in the active part of the file
    for (let n = 0; n <= lastLineIndexToCheck - 1; n++) {
      const origPara = paragraphs[n]
      if (!origPara || typeof origPara.content !== 'string') {
        continue
      }
      // Test if this is a special extended repeat with a datetime to shorten
      const content = origPara.content
      if (RE_EXTENDED_REPEAT.test(content) && RE_DONE_DATE_TIME.test(content)) {
        // Do the main generation work
        const newPara = await generateRepeatForPara(origPara, noteToUse, config, allowedToUseEditor)
        if (newPara) {
          repeatCount++
          // (For later sorting use) Add this para's heading to the list if it's not already there
          if (config.runTaskSorter) {
            if (origPara.heading !== lastHeading) {
              headingList.push(origPara.heading)
            }
            lastHeading = origPara.heading
          }
        }
      }
    }

    // Report if no repeats were found, and stop.
    if (repeatCount === 0) {
      // logDebug('generateRepeats', 'No suitable completed repeats were found')
      if (!runSilently) {
        await showMessage('No suitable completed repeats were found', 'OK', 'Repeat Extensions')
      }
      return 0
    }
    logInfo('generateRepeats', `${String(repeatCount)} new repeats were generated`)

    // Run task sorter if its installed, and we want it, and the same note is open in the Editor
    // Note: This latter constraint is self-imposed, not because of the task sorter plugin.
    if (config.runTaskSorter) {
      if (DataStore.isPluginInstalledByID('dwertheimer.TaskSorting')) {
        const editorIsActiveForThisNote =
          typeof Editor !== 'undefined' &&
          Editor != null &&
          Editor.filename != null &&
          noteToUse.filename === Editor.filename
        if (editorIsActiveForThisNote) {
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
            logInfo('generateRepeats', `- Sorting tasks under heading '${heading}'`)
            // v1: indirect call via invokePluginCommandByName()
            // await DataStore.invokePluginCommandByName('Sort tasks under heading (choose)', 'dwertheimer.TaskSorting', [heading, sortFields, noteToUse])
            // v2: direct call
            // $FlowIgnore[incompatible-call] TNote vs CoreNoteFields
            await sortTasksUnderHeading(heading, sortFields, noteToUse)
          }
        } else {
          logDebug('generateRepeats', `Task sorter plugin is installed, but we are not working in the Editor, so can't run it.`)
        }
      } else {
        logWarn('generateRepeats', `Task Sorting plugin is not installed, so can't run it. Set "Run Task Sorter after changes?" to false to disable this message.`)
      }
    }
    return repeatCount
  } catch (error) {
    logError(pluginJson, `generateRepeats(): ${JSP(error)}`)
    return 0
  }
}
