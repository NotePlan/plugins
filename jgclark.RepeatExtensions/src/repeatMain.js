// @flow
//-----------------------------------------------------------------------
// Repeat Extensions plugin for NotePlan
// Jonathan Clark
// last updated 2025-01-27, for v0.9.0
//-----------------------------------------------------------------------

// import moment from 'moment'
import pluginJson from "../plugin.json"
import {
  generateNewRepeatDate,
  getRepeatSettings,
  RE_EXTENDED_REPEAT,
  type RepeatConfig,
} from './repeatHelpers'
import {
  RE_ANY_DUE_DATE_TYPE,
  RE_DONE_DATE_TIME,
  RE_DONE_DATE_TIME_CAPTURES,
  RE_ISO_DATE, // find dates of form YYYY-MM-DD
  unhyphenateString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logInfo, logWarn, logError } from "@helpers/dev"
import { logAllEnvironmentSettings } from "@helpers/NPdev"
// import { displayTitle } from '@helpers/general'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { selectedLinesIndex } from '@helpers/NPParagraph'
import { showMessage } from '@helpers/userInput'

//------------------------------------------------------------------
/**
 * Respond to onEditorWillSave trigger for the currently open note. 
 * Will fire generateRepeats() if the a changed text region includes '@done(...) and @repeat(...)'
 */
export async function onEditorWillSave(): Promise<void> {
  try {
    if (Editor.content && Editor.note) {
      const latestContent = Editor.content ?? ''
      const noteReadOnly: CoreNoteFields = Editor.note
      const previousContent = noteReadOnly.versions[0].content
      const timeSinceLastEdit: number = Date.now() - noteReadOnly.versions[0].date

      // logDebug(pluginJson, `onEditorWillSave triggered for '${noteReadOnly.filename}' with ${noteReadOnly.versions.length} versions; last triggered ${String(timeSinceLastEdit)}ms ago`)
      // logDebug(pluginJson, `- previous version: ${String(noteReadOnly.versions[0].date)} [${previousContent}]`)
      // logDebug(pluginJson, `- new version: ${String(Date.now())} [${latestContent}]`)

      // first check to see if this has been called in the last 2000ms: if so don't proceed, as this could be a double call.
      if (timeSinceLastEdit <= 2000) {
        // logDebug(pluginJson, `onEditorWillSave fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the last one`)
        return
      }

      // Get changed ranges
      const ranges = NotePlan.stringDiff(previousContent, latestContent)
      if (!ranges || ranges.length === 0) {
        // logDebug('repeatExtensions/onEditorWillSave', `No ranges returned, so stopping.`)
        return
      }
      const earliestStart = ranges[0].start
      const latestEnd = ranges[ranges.length - 1].end
      const overallRange: TRange = Range.create(earliestStart, latestEnd)
      // logDebug('repeatExtensions/onEditorWillSave', `- overall changed content from ${rangeToString(overallRange)}`)

      // Get changed lineIndexes
      // earlier method for changedExtent based on character region, which didn't seem to always include all the changed parts.
      // const changedExtent = latestContent?.slice(earliestStart, latestEnd)
      // Editor.highlightByIndex(earliestStart, latestEnd - earliestStart)
      // logDebug('repeatExtensions/onEditorWillSave', `Changed content extent: <${changedExtent}>`)
      // Newer method uses changed paragraphs: this will include more than necessary, but that's more useful in this case
      let changedExtent = ''
      const [startParaIndex, endParaIndex] = selectedLinesIndex(overallRange, Editor.paragraphs)
      // logDebug('repeatExtensions/onEditorWillSave', `- changed lines ${startParaIndex}-${endParaIndex}`)
      for (let i = startParaIndex; i <= endParaIndex; i++) {
        changedExtent += Editor.paragraphs[i].content
      }
      // logDebug('repeatExtensions/onEditorWillSave', `Changed content extent:\n<${changedExtent}>`)

      // If the changed text includes @done(...) then we may have something to update, so run repeats()
      if (changedExtent.match(RE_DONE_DATE_TIME) && changedExtent.match(RE_EXTENDED_REPEAT)) {
        logDebug('repeatExtensions/onEditorWillSave', `Found @done(...) so will call generatedRepeats ...`)
        // Call main generateRepeats() function, but don't show if there are no repeats found
        // $FlowIgnore[incompatible-call]
        const res = await generateRepeats(true) // i.e. run loudly on the Editor
      }
    } else {
      throw new Error("Cannot get Editor details. Is there a note open in the Editor?")
    }
  } catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Generate a repeat task for a single paragraph that contains a completed task with extended @repeat(interval) tag.
 * When interval is of the form '+2w' it will duplicate the task for 2 weeks after the date is was completed.
 * When interval is of the form '2w' it will duplicate the task for 2 weeks after the date the task was last due. If this can't be determined, it uses the note date. If this can't be determined, then default to completed date.
 * Valid intervals are [0-9][bdwmqy].
 * To work it relies on finding @done(YYYY-MM-DD HH:MM) tags that haven't yet been shortened to @done(YYYY-MM-DD).
 * It includes cancelled tasks as well; to remove a repeat entirely, remove the @repeat tag from the task in NotePlan.
 * Note: The new repeat date is by default scheduled to a day (>YYYY-MM-DD). But if the scheduled date is a week date (YYYY-Wnn), or the repeat is in a weekly note, then the new repeat date will be a scheduled week link (>YYYY-Wnn).
 * Note: Runs on the currently open note (using Editor.* funcs) if possible, or now on noteArg too (not using Editor.* funcs)
 * Note: Could add a 'Newer' mode of operation according to GH # 351.
 * @param {TParagraph} origPara - The original paragraph containing the completed task and @repeat(interval) tag
 * @param {TNote} noteToUse - The note containing the paragraph
 * @param {boolean} noteIsOpenInEditor - Whether the note is open in the editor
 * @param {RepeatConfig} config - The repeat configuration settings
 * @returns {Promise<TParagraph | null>} The newly created paragraph, or null if no repeat was generated
 */
export async function generateRepeatForPara(
  origPara: TParagraph,
  noteToUse: TNote,
  noteIsOpenInEditor: boolean,
  config: RepeatConfig
): Promise<TParagraph | null> {
  try {
    const line = origPara.content ?? ''
    let lineWithoutDoneTime = ''
    let completedDate = ''

    // Check if line has datetime to shorten
    if (!RE_DONE_DATE_TIME.test(line)) {
      return null
    }

    // Get completed date and time
    const reReturnArray = line.match(RE_DONE_DATE_TIME_CAPTURES) ?? []
    completedDate = reReturnArray[1]
    const completedTime = reReturnArray[2]
    logDebug('generateRepeatForPara', `- found newly completed task: "${line}"`)

    // Remove time string from completed date-time
    lineWithoutDoneTime = line.replace(completedTime, '')
    origPara.content = lineWithoutDoneTime
    noteToUse.updateParagraph(origPara)

    const newParaLineIndex = origPara.lineIndex
    let newPara: TParagraph

    // Generate the new repeat date
    let newRepeatDateStr = generateNewRepeatDate(noteToUse, origPara.content, completedDate)
    if (newRepeatDateStr === completedDate) {
      logWarn(`generateRepeatForPara`, `newRepeatDateStr ${newRepeatDateStr} is same as completedDate ${completedDate}`)
    }

    // Remove any >date and @done()
    let newRepeatContent = lineWithoutDoneTime.replace(RE_ANY_DUE_DATE_TYPE, '').replace(/@done\(.*\)/, '').trim()

    // Add the new repeat based on note type
    if (noteToUse.type === 'Notes') {
      newRepeatContent += ` >${newRepeatDateStr}`
      if (noteIsOpenInEditor) {
        await Editor.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
        newPara = Editor.paragraphs[newParaLineIndex]
      } else {
        await noteToUse.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
        newPara = noteToUse.paragraphs[newParaLineIndex]
      }
    } else {
      // Handle calendar note case
      if (newRepeatDateStr.match(RE_ISO_DATE)) {
        newRepeatDateStr = unhyphenateString(newRepeatDateStr)
      }
      const futureNote = await DataStore.calendarNoteByDateString(newRepeatDateStr)
      if (futureNote != null) {
        await futureNote.appendTodo(newRepeatContent)
        newPara = futureNote.paragraphs[futureNote.paragraphs.length - 1]
      } else {
        newRepeatContent += ` >${newRepeatDateStr}`
        if (noteIsOpenInEditor) {
          await Editor.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
          newPara = Editor.paragraphs[newParaLineIndex]
        } else {
          await noteToUse.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
          newPara = noteToUse.paragraphs[newParaLineIndex]
        }
      }
    }

    // Add any indent for this new para
    if (newPara) {
      newPara.indents = origPara.indents
      noteToUse.updateParagraph(newPara)
    }

    // Handle the completed item
    Editor.skipNextRepeatDeletionCheck = true
    if (config.deleteCompletedRepeat) {
      if (noteIsOpenInEditor) {
        Editor.removeParagraphAtIndex(origPara.lineIndex + 1)
      } else {
        noteToUse.removeParagraphAtIndex(origPara.lineIndex + 1)
      }
    } else {
      origPara.content = lineWithoutDoneTime
      if (noteIsOpenInEditor) {
        Editor.updateParagraph(origPara)
      } else {
        noteToUse.updateParagraph(origPara)
      }
    }

    return newPara
  } catch (error) {
    logError(pluginJson, `generateRepeatForPara(): ${JSP(error)}`)
    return null
  }
}

/**
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
    if (config.runTaskSorter && DataStore.isPluginInstalledByID('dwertheimer.TaskSorting')) {
      if (noteIsOpenInEditor) {
        // Attempt to update the cache, so that the task sorter can find the new repeats. Note: it doesn't seem to make a difference.
        // Note: using noteToUse instead of Editor.note generates an Objective-C error.
        // $FlowIgnore[incompatible-call] checked Editor.note is not null
        const res = DataStore.updateCache(Editor.note, false)
        const sortFields = ["due", "-priority", "content"]

        logInfo('generateRepeats', `Will sort tasks according to user defaults from Task Sorting plugin`)
        // For each changed section, sort the tasks under that heading.
        // FIXME: this is running but not making any changes either.
        // for (const heading of headingList) {
        //   logInfo('generateRepeats', `Sorting tasks under heading ${heading} ...`)
        //   await DataStore.invokePluginCommandByName('Sort tasks under heading (choose)', 'dwertheimer.TaskSorting', [heading, sortFields])
        // }

        // For now, try sorting the whole note.
        // FIXME: this is running but not making any changes either.
        logInfo('generateRepeats', `Sorting tasks on the page ...`)
        await DataStore.invokePluginCommandByName('Sort tasks on the page', 'dwertheimer.TaskSorting', [false, sortFields, false, false])

      } else {
        logDebug('generateRepeats', `Task sorter plugin is installed, but we are not working in the Editor, so can't run it`)
      }
    }
    return repeatCount
  } catch (error) {
    logError(pluginJson, `generateRepeats(): ${JSP(error)}`)
    return 0
  }
}
