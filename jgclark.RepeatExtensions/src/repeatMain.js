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
import { getCurrentHeading } from '@helpers/headings'
import { getOpenEditorFromFilename, saveEditorIfNecessary } from '@helpers/NPEditorBasics'
import { showMessage } from '@helpers/userInput'

//------------------------------------------------------------------

/**
 * Resolve the section heading for a paragraph (Editor.paragraphs often lack .heading until after save).
 * @param {CoreNoteFields} note - note containing the paragraph
 * @param {TParagraph} origPara - paragraph a repeat was generated from
 * @returns {string} heading text, or '' if none found
 */
export function getRepeatSectionHeading(note: CoreNoteFields, origPara: TParagraph): string {
  if (typeof origPara.heading === 'string' && origPara.heading.trim() !== '') {
    return origPara.heading.trim()
  }
  const headingPara = getCurrentHeading(note, origPara)
  return headingPara?.content?.trim() ?? ''
}

/**
 * Drop empty/duplicate heading names before sorting.
 * @param {Array<string>} headingList - raw headings collected
 * @returns {Array<string>} normalized list
 */
export function normalizeRepeatHeadingList(headingList: Array<string>): Array<string> {
  const seen = new Set<string>()
  const out: Array<string> = []
  for (const h of headingList) {
    if (typeof h === 'string' && h.trim() !== '' && !seen.has(h)) {
      const trimmed = h.trim()
      seen.add(trimmed)
      out.push(trimmed)
    }
  }
  return out
}

/**
 * Log at INFO why post-repeat task sorting cannot run (no ## section heading above the task).
 * @param {string} filename - note filename
 */
export function logTaskSortSkippedNoSectionHeading(filename: string): void {
  logInfo(
    'runTaskSorterAfterRepeats',
    `Task sort skipped for '${filename}': the completed repeat has no section heading above it. Task Sorting works on tasks under a heading, so there is nothing to sort without one.`,
  )
}

/**
 * Make global Editor the window for filename. Task Sorting uses global Editor (saveEditorIfNecessary, beginEdits, etc.), not a separate TEditor reference.
 * @param {string} filename - note filename
 * @returns {typeof Editor | false} global Editor when it matches filename, else false
 */
export function focusEditorForFilename(filename: string): typeof Editor | false {
  if (typeof Editor === 'undefined' || Editor == null || Editor.filename == null) {
    return false
  }
  if (Editor.filename === filename) {
    return Editor
  }

  const editorWin = getOpenEditorFromFilename(filename, true)
  if (editorWin === false) {
    logDebug('focusEditorForFilename', `No open Editor window for '${filename}'`)
    return false
  }

  logDebug('focusEditorForFilename', `Focusing Editor for '${filename}' (global Editor was '${Editor.filename}')`)
  if (typeof editorWin.focus === 'function') {
    editorWin.focus()
  }

  if (Editor.filename === filename) {
    return Editor
  }

  logWarn(
    'focusEditorForFilename',
    `Task sort needs global Editor on '${filename}', but Editor is still '${Editor.filename}' after focus()`,
  )
  return false
}

/**
 * Record a section heading for post-repeat task sorting (skips consecutive duplicates).
 * @param {Array<string>} headingList - headings collected so far
 * @param {string} lastHeading - heading from the previous recorded paragraph
 * @param {CoreNoteFields} note - note containing the paragraph
 * @param {TParagraph} origPara - paragraph a repeat was generated from
 * @returns {string} updated lastHeading
 */
export function recordRepeatHeading(headingList: Array<string>, lastHeading: string, note: CoreNoteFields, origPara: TParagraph): string {
  const heading = getRepeatSectionHeading(note, origPara)
  if (heading === '') {
    return lastHeading
  }
  if (heading !== lastHeading) {
    headingList.push(heading)
  }
  return heading
}

/**
 * Sort tasks under headings where repeats were just generated.
 * @param {Array<string>} headingList - section headings to sort
 * @param {CoreNoteFields} noteToUse - note being edited
 * @param {RepeatConfig} config - Repeat Extensions settings
 * @param {boolean} noteIsKnownOpenEditor - true when noteToUse came from getOpenEditorFromFilename (may not be the global Editor)
 */
async function runTaskSorterAfterRepeatsImpl(
  headingList: Array<string>,
  noteToUse: CoreNoteFields,
  config: RepeatConfig,
  noteIsKnownOpenEditor: boolean = false,
): Promise<void> {
  if (!config.runTaskSorter || headingList.length === 0) {
    return
  }
  if (DataStore.isPluginInstalledByID('dwertheimer.TaskSorting')) {
    const editorIsActiveForThisNote =
      noteIsKnownOpenEditor ||
      (typeof Editor !== 'undefined' &&
        Editor != null &&
        Editor.filename != null &&
        noteToUse.filename === Editor.filename)
    if (editorIsActiveForThisNote) {
      // Attempt to update the cache, so that the task sorter can find the new repeats. Note: it doesn't seem to make a difference.
      // Note: using noteToUse instead of Editor.note generates an Objective-C error.
      const cacheNote =
        typeof Editor !== 'undefined' && Editor != null && Editor.filename === noteToUse.filename && Editor.note != null
          ? Editor.note
          : noteToUse.note
      if (cacheNote != null) {
        // $FlowIgnore[incompatible-call]
        DataStore.updateCache(cacheNote, false)
      }
      const sortFields = config.taskSortingOrder
        ? stringListOrArrayToArray(config.taskSortingOrder, ',')
        : ['due', '-priority', 'content']

      logInfo('runTaskSorterAfterRepeats', `Will sort tasks according to user defaults from Task Sorting plugin`)
      for (const heading of headingList) {
        logInfo('runTaskSorterAfterRepeats', `- Sorting tasks under heading '${heading}'`)
        // $FlowIgnore[incompatible-call] TNote vs CoreNoteFields
        await sortTasksUnderHeading(heading, sortFields, noteToUse)
      }
    } else {
      logDebug('runTaskSorterAfterRepeats', `Task sorter plugin is installed, but we are not working in the Editor, so can't run it.`)
    }
  } else {
    logWarn('runTaskSorterAfterRepeats', `Task Sorting plugin is not installed, so can't run it. Set "Run Task Sorter after changes?" to false to disable this message.`)
  }
}

/**
 * Run task sort after onEditorWillSave returns (save must finish first; sortTasksUnderHeading calls Editor.save()).
 * Uses invokePluginCommandByName so we do not use Promise/setTimeout in the trigger handler (broken in some NotePlan builds, e.g. Beta JSPromiseConstructor).
 * @param {string} filename - note filename
 * @param {Array<string>} headingList - section headings to sort
 * @param {RepeatConfig} config - Repeat Extensions settings (unused here; re-loaded in sortRepeatsAfterSave)
 */
function deferTaskSortAfterSave(filename: string, headingList: Array<string>, config: RepeatConfig): void {
  const headings = normalizeRepeatHeadingList(headingList)
  if (headings.length === 0) {
    logTaskSortSkippedNoSectionHeading(filename)
    return
  }

  logInfo('runTaskSorterAfterRepeats', `Deferring task sort for '${filename}' under: ${headings.join(', ')}`)
  logDebug(
    'runTaskSorterAfterRepeats',
    `Queueing 'sort repeats after save' via invokePluginCommandByName (headings: ${headings.join(', ')})`,
  )

  try {
    DataStore.invokePluginCommandByName('sort repeats after save', pluginJson['plugin.id'], [filename, JSON.stringify(headings)])
  } catch (error) {
    logError(pluginJson, `deferTaskSortAfterSave invokePluginCommandByName: ${JSP(error)}`)
  }
}

export async function runTaskSorterAfterRepeats(
  headingList: Array<string>,
  noteToUse: CoreNoteFields,
  config: RepeatConfig,
  deferUntilAfterSave: boolean = false,
): Promise<void> {
  if (!config.runTaskSorter) {
    logDebug('runTaskSorterAfterRepeats', 'Task sort skipped: runTaskSorter setting is off')
    return
  }

  const headings = normalizeRepeatHeadingList(headingList)
  if (headings.length === 0) {
    logTaskSortSkippedNoSectionHeading(noteToUse.filename ?? '?')
    return
  }

  if (deferUntilAfterSave) {
    deferTaskSortAfterSave(noteToUse.filename, headings, config)
    return
  }

  await runTaskSorterAfterRepeatsImpl(headings, noteToUse, config)
}

/**
 * Hidden command: sort sections after repeats generated from onEditorWillSave (runs after save completes).
 * @param {string} filename - note filename to sort in
 * @param {string} headingsJson - JSON array of heading strings
 */
export async function sortRepeatsAfterSave(filename: string = '', headingsJson: string = '[]'): Promise<{}> {
  try {
    logInfo('sortRepeatsAfterSave', `Starting for '${filename}'`)
    let headings: Array<string> = []
    try {
      const parsed = JSON.parse(headingsJson)
      if (Array.isArray(parsed)) {
        headings = normalizeRepeatHeadingList(parsed.filter((h) => typeof h === 'string'))
      }
    } catch (parseError) {
      logError(pluginJson, `sortRepeatsAfterSave: invalid headingsJson: ${JSP(parseError)}`)
      return {}
    }
    if (filename === '') {
      logInfo('sortRepeatsAfterSave', 'Task sort skipped: no note filename supplied')
      return {}
    }
    if (headings.length === 0) {
      logTaskSortSkippedNoSectionHeading(filename)
      return {}
    }

    const config: RepeatConfig = await getRepeatSettings()
    if (config == null) {
      return {}
    }

    // Invoked commands may run off the main thread; Task Sorting must run on main thread with global Editor.
    await CommandBar.onMainThread()

    const activeEditor = focusEditorForFilename(filename)
    if (activeEditor === false) {
      logInfo('sortRepeatsAfterSave', `Deferred task sort skipped: '${filename}' is not the active Editor window`)
      return {}
    }

    await runTaskSorterAfterRepeatsImpl(headings, activeEditor, config, true)
    await saveEditorIfNecessary()
    logInfo('sortRepeatsAfterSave', `Finished deferred task sort for '${filename}'`)
  } catch (error) {
    logError(pluginJson, `sortRepeatsAfterSave: ${JSP(error)}`)
  }
  return {}
}

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
        // Defer Editor.save until all repeats are generated (mid-loop save can drop the latest repeat line; same as onEditorWillSave trigger path).
        const skipEditorSave = allowedToUseEditor
        const newPara = await generateRepeatForPara(origPara, noteToUse, config, allowedToUseEditor, skipEditorSave)
        if (newPara) {
          repeatCount++
          if (config.runTaskSorter) {
            lastHeading = recordRepeatHeading(headingList, lastHeading, noteToUse, origPara)
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

    if (allowedToUseEditor) {
      await saveEditorIfNecessary()
    }

    await runTaskSorterAfterRepeats(headingList, noteToUse, config)
    return repeatCount
  } catch (error) {
    logError(pluginJson, `generateRepeats(): ${JSP(error)}`)
    return 0
  }
}
