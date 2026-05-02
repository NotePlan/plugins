// @flow
// -----------------------------------------------------------------
// Extended @repeat(...) support, migrated from jgclark.RepeatExtensions plugin.
// Note: This is shared under /helpers so other plugins' bundles (e.g. Filer) do not import plugin paths.
// Note: Depends on ./NPEditorBasics only — not full NPEditor — to avoid Rollup circular dependency warnings.
// Refactored 2026-05-02, for RE plugin v1.1.3, by @Cursor & @jgclark
// -----------------------------------------------------------------

import { getOpenEditorFromFilename, saveEditorIfNecessary } from './NPEditorBasics'
import {
  isDailyNote,
  isWeeklyNote,
  isMonthlyNote,
  isQuarterlyNote,
  isYearlyNote,
  RE_DATE_INTERVAL,
  RE_SCHEDULED_DAILY_NOTE_LINK,
  RE_SCHEDULED_WEEK_NOTE_LINK,
  RE_SCHEDULED_MONTH_NOTE_LINK,
  RE_SCHEDULED_QUARTERLY_NOTE_LINK,
  RE_SCHEDULED_YEARLY_NOTE_LINK,
  hyphenatedDateString,
  convertISODateFilenameToNPDayFilename,
  getTodaysDateHyphenated,
  RE_ANY_DUE_DATE_TYPE,
  RE_DONE_DATE_TIME,
  RE_DONE_DATE_TIME_CAPTURES,
  RE_ISO_DATE,
} from '@helpers/dateTime'
import { JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { calcOffsetDateStr, getFirstDateInPeriod } from '@helpers/NPdateTime'
import { stripDoneDateTimeMentions } from '@helpers/paragraph'
import { removeDateTagsAndToday, stripTaskMarkersFromString } from '@helpers/stringTransforms'
import { textWithoutSyncedCopyTag } from '@helpers/syncedCopies'

/** Settings file path segment; must match jgclark.RepeatExtensions plugin id */
export const REPEAT_EXTENSIONS_PLUGIN_ID: string = 'jgclark.RepeatExtensions'

const LOG_CONTEXT = 'extendedRepeat'

//------------------------------------------------------------------
// Regexes + config type + settings + date math

const EXTENDED_REPEAT_STR: string = `@repeat\\(${RE_DATE_INTERVAL}\\)` // find @repeat()
export const RE_EXTENDED_REPEAT: RegExp = new RegExp(EXTENDED_REPEAT_STR) // find @repeat()
const EXTENDED_REPEAT_CAPTURE_STR: string = `@repeat\\((.*?)\\)` // find @repeat() and return part inside brackets
export const RE_EXTENDED_REPEAT_CAPTURE: RegExp = new RegExp(EXTENDED_REPEAT_CAPTURE_STR) // find @repeat() and return part inside brackets
export const RE_CANCELLED_TASK: RegExp = new RegExp(`[\\^\\n]\\s*?[\\*\\+\\-]\\s+\\[\\-\\]\\s`) // matches a task that has been cancelled, for use on rawContent, _which may be part of a multi-line string_

export type RepeatConfig = {
  deleteCompletedRepeat: boolean,
  dontLookForRepeatsInDoneOrArchive: boolean,
  allowRepeatsInCancelledParas: boolean,
  runTaskSorter: boolean,
  taskSortingOrder: string,
  _logLevel: string,
}

/**
 * Load Repeat Extensions settings from the plugin config JSON.
 */
export async function getRepeatSettings(): Promise<any> {
  try {
    const config: RepeatConfig = await DataStore.loadJSON(`../${REPEAT_EXTENSIONS_PLUGIN_ID}/settings.json`)

    if (config == null || Object.keys(config).length === 0) {
      logError(LOG_CONTEXT, `getRepeatSettings() cannot find '${REPEAT_EXTENSIONS_PLUGIN_ID}' plugin settings. Stopping.`)
      await CommandBar.prompt(
        `Repeat Error`,
        `Cannot find settings for the '${REPEAT_EXTENSIONS_PLUGIN_ID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`,
        ['OK'],
      )
      return
    } else {
      return config
    }
  } catch (err) {
    logError(LOG_CONTEXT, `GetRepeatSettings(): ${err.name}: ${err.message}`)
    await CommandBar.prompt(`Repeat Error`, `Error: ${err.message}`, ['OK'])
  }
}

/**
 * Generate the new repeat date from the completed date or due date in 'currentContent' and 'completedDate' from 'noteToUse'.
 * @tests in jest file (repeatHelpers.test.js)
 */
export function generateNewRepeatDate(noteToUse: CoreNoteFields, currentContent: string, completedDate: string): string {
  const reRepeatArray = currentContent.match(RE_EXTENDED_REPEAT_CAPTURE) ?? []
  let dateIntervalString: string = reRepeatArray.length > 0 ? reRepeatArray[1] : ''

  let outputTimeframe = 'day'
  if (currentContent.match(RE_SCHEDULED_DAILY_NOTE_LINK) || isDailyNote(noteToUse)) {
    outputTimeframe = 'day'
  } else if (currentContent.match(RE_SCHEDULED_WEEK_NOTE_LINK) || isWeeklyNote(noteToUse)) {
    outputTimeframe = 'week'
  } else if (currentContent.match(RE_SCHEDULED_MONTH_NOTE_LINK) || isMonthlyNote(noteToUse)) {
    outputTimeframe = 'month'
  } else if (currentContent.match(RE_SCHEDULED_QUARTERLY_NOTE_LINK) || isQuarterlyNote(noteToUse)) {
    outputTimeframe = 'quarter'
  } else if (currentContent.match(RE_SCHEDULED_YEARLY_NOTE_LINK) || isYearlyNote(noteToUse)) {
    outputTimeframe = 'year'
  }
  logDebug('generateNewRepeatDate', `- date interval: '${dateIntervalString}', completedDate: ${completedDate}, outputTimeframe: ${outputTimeframe}`)

  let newRepeatDateStr = ''
  const output = currentContent

  if (dateIntervalString.length === 0) {
    logError('generateNewRepeatDate', 'No @repeat(interval) found in content; cannot compute new date')
    return completedDate
  }

  if (dateIntervalString.startsWith('+')) {
    dateIntervalString = dateIntervalString.substring(1, dateIntervalString.length)
    newRepeatDateStr = calcOffsetDateStr(completedDate, dateIntervalString, outputTimeframe)
    logDebug('generateNewRepeatDate', `- adding from completed date -> ${newRepeatDateStr}`)
  } else {
    let dueDate = ''
    const dueDateArray = RE_SCHEDULED_DAILY_NOTE_LINK.test(output)
      ? output.match(RE_SCHEDULED_DAILY_NOTE_LINK)
      : RE_SCHEDULED_WEEK_NOTE_LINK.test(output)
      ? output.match(RE_SCHEDULED_WEEK_NOTE_LINK)
      : RE_SCHEDULED_MONTH_NOTE_LINK.test(output)
      ? output.match(RE_SCHEDULED_MONTH_NOTE_LINK)
      : RE_SCHEDULED_QUARTERLY_NOTE_LINK.test(output)
      ? output.match(RE_SCHEDULED_QUARTERLY_NOTE_LINK)
      : RE_SCHEDULED_YEARLY_NOTE_LINK.test(output)
      ? output.match(RE_SCHEDULED_YEARLY_NOTE_LINK)
      : []
    if (dueDateArray && dueDateArray[0] != null) {
      dueDate = dueDateArray[0].split('>')[1]
      logDebug('generateNewRepeatDate', `  due date match = ${dueDate}`)
    } else {
      dueDate = noteToUse.date ? hyphenatedDateString(noteToUse.date) : completedDate
      logDebug('generateNewRepeatDate', `- no due date match, so will use note/completed date ${dueDate}`)
    }
    newRepeatDateStr = calcOffsetDateStr(dueDate, dateIntervalString, outputTimeframe)
    logDebug('generateNewRepeatDate', `- adding from due date -> ${newRepeatDateStr}`)
  }
  return newRepeatDateStr
}

//------------------------------------------------------------------
// Generate paragraphs

/**
 * Generate a repeat task for a single paragraph that contains a completed task with extended @repeat(interval) tag.
 * @param {boolean} allowedToUseEditor - If false, never use Editor.* funcs (e.g. Tidy onAsyncThread).
 */
export async function generateRepeatForPara(
  origPara: TParagraph,
  origNote: CoreNoteFields,
  config: RepeatConfig,
  allowedToUseEditor: boolean = true,
): Promise<TParagraph | null> {
  try {
    if (!origPara) {
      throw new Error(`generateRepeatForPara: passed origPara is null`)
    }
    if (!origNote) {
      throw new Error(`generateRepeatForPara: passed origNote is null`)
    }
    const line = origPara.content ?? ''
    if (!RE_EXTENDED_REPEAT.test(line)) {
      throw new Error(`generateRepeatForPara: passed line '${line}' does not contain an extended @repeat(...)`)
    }
    if (!RE_DONE_DATE_TIME.test(line)) {
      throw new Error(`generateRepeatForPara: passed line '${line}' does not contain a datetime to shorten`)
    }

    let noteIsOpenInEditor = false
    if (allowedToUseEditor) {
      const possibleEditorNote: TEditor | false = getOpenEditorFromFilename(origNote.filename)
      noteIsOpenInEditor = possibleEditorNote !== false && possibleEditorNote.filename === origNote.filename
      logDebug('generateRepeatForPara', `Starting for "${origPara.content}" in ${origNote.filename}. noteIsOpenInEditor: ${String(noteIsOpenInEditor)}`)
    } else {
      logDebug('generateRepeatForPara', `Starting for "${origPara.content}" in ${origNote.filename}, and will NOT use Editor.* funcs.`)
    }
    let lineWithoutDoneTime = ''
    let completedDate = ''
    let noteContainingNewPara: CoreNoteFields

    const syncCopyParas: Array<TParagraph> = DataStore.referencedBlocks(origPara)
    const origParaIsSynced = syncCopyParas.length >= 1
    const syncCopiesInRegularNotes = origParaIsSynced ? syncCopyParas.filter((p) => p?.note?.type === 'Notes') : []
    logDebug('generateRepeatForPara', `- found ${syncCopiesInRegularNotes.length} syncCopiesInRegularNotes`)

    const reReturnArray = line.match(RE_DONE_DATE_TIME_CAPTURES) ?? []
    completedDate = reReturnArray[1]
    const completedTime = reReturnArray[2]
    logDebug('generateRepeatForPara', `- found newly completed task: "${line}"`)

    lineWithoutDoneTime = line.replace(completedTime, '')
    logDebug('generateRepeatForPara', `- lineWithoutDoneTime: "${lineWithoutDoneTime}"`)
    origPara.content = lineWithoutDoneTime
    if (noteIsOpenInEditor) {
      Editor.updateParagraph(origPara)
      logDebug('generateRepeatForPara', `- after change origPara.content in Editor: "${origPara.content}"`)
      await saveEditorIfNecessary()
    } else {
      origNote.updateParagraph(origPara)
    }

    const newParaLineIndex = origPara.lineIndex
    let newPara: TParagraph

    let newRepeatDateStr = generateNewRepeatDate(origNote, origPara.content, completedDate)
    if (newRepeatDateStr === completedDate) {
      logWarn(`generateRepeatForPara`, `newRepeatDateStr ${newRepeatDateStr} is same as completedDate ${completedDate}`)
    }

    let newRepeatContent = removeDateTagsAndToday(lineWithoutDoneTime, true)
    newRepeatContent = stripDoneDateTimeMentions(newRepeatContent)
    newRepeatContent = stripTaskMarkersFromString(newRepeatContent)
    newRepeatContent = textWithoutSyncedCopyTag(newRepeatContent).trim()
    logDebug('generateRepeatForPara', `- newRepeatContent: "${newRepeatContent}"`)

    if (syncCopiesInRegularNotes.length > 0) {
      const syncSourceNote: ?TNote = syncCopiesInRegularNotes[0]?.note
      if (syncSourceNote == null) {
        throw new Error(`generateRepeatForPara: Cannot get syncSourceNote for origPara: "${origPara.content}" in ${origNote.filename}`)
      }
      logDebug('generateRepeatForPara', `- adding repeat to regular note where origPara is synced (${syncSourceNote.filename})`)
      newRepeatContent += ` >${newRepeatDateStr}`
      await syncSourceNote.insertParagraphBeforeParagraph(newRepeatContent, syncCopiesInRegularNotes[0], 'open')
      newPara = syncSourceNote.paragraphs[newParaLineIndex]
      noteContainingNewPara = syncSourceNote
    } else if (origNote.type === 'Notes') {
      logDebug('generateRepeatForPara', `- adding repeat to regular note ${origNote.filename}`)
      newRepeatContent += ` >${newRepeatDateStr}`
      if (noteIsOpenInEditor) {
        noteContainingNewPara = Editor
        await Editor.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
        newPara = Editor.paragraphs[newParaLineIndex]
      } else {
        noteContainingNewPara = origNote
        await origNote.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
        newPara = origNote.paragraphs[newParaLineIndex]
      }
    } else {
      if (newRepeatDateStr.match(RE_ISO_DATE)) {
        newRepeatDateStr = convertISODateFilenameToNPDayFilename(newRepeatDateStr)
      }
      // $FlowIgnore[incompatible-type] TNote vs CoreNoteFields
      noteContainingNewPara = await DataStore.calendarNoteByDateString(newRepeatDateStr)
      if (noteContainingNewPara != null) {
        logDebug('generateRepeatForPara', `- adding repeat to FUTURE calendar note for ${newRepeatDateStr}`)
        await noteContainingNewPara.appendTodo(newRepeatContent)
        newPara = noteContainingNewPara.paragraphs[noteContainingNewPara.paragraphs.length - 1]
      } else {
        newRepeatContent += ` >${newRepeatDateStr}`
        if (noteIsOpenInEditor) {
          logDebug('generateRepeatForPara', `- adding repeat to Editor calendar note for ${newRepeatDateStr}`)
          await Editor.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
          newPara = Editor.paragraphs[newParaLineIndex]
          noteContainingNewPara = Editor
        } else {
          logDebug('generateRepeatForPara', `- adding repeat to calendar note for ${newRepeatDateStr} (not open in Editor)`)
          await origNote.insertParagraphBeforeParagraph(newRepeatContent, origPara, 'open')
          newPara = origNote.paragraphs[newParaLineIndex]
          noteContainingNewPara = origNote
        }
      }
    }

    if (!noteContainingNewPara) {
      throw new Error(`generateRepeatForPara: Couldn't get noteContainingNewPara for newRepeatContent: "${newRepeatContent}" in ${newRepeatDateStr}`)
    }

    if (newPara) {
      newPara.indents = origPara.indents
      noteContainingNewPara.updateParagraph(newPara)
    }

    Editor.skipNextRepeatDeletionCheck = true
    if (config.deleteCompletedRepeat) {
      if (noteIsOpenInEditor) {
        Editor.removeParagraphAtIndex(origPara.lineIndex + 1)
      } else {
        origNote.removeParagraphAtIndex(origPara.lineIndex + 1)
      }
    } else {
      origPara.content = lineWithoutDoneTime
      if (noteIsOpenInEditor) {
        Editor.updateParagraph(origPara)
      } else {
        origNote.updateParagraph(origPara)
      }
    }

    return newPara
  } catch (error) {
    logError(LOG_CONTEXT, `generateRepeatForPara(): ${JSP(error)}`)
    return null
  }
}

/**
 * Generate a repeat task for a cancelled paragraph that contains an extended @repeat(interval) tag.
 */
export async function generateRepeatForCancelledPara(
  origPara: TParagraph,
  noteToUse: CoreNoteFields,
  noteIsOpenInEditor: boolean,
): Promise<TParagraph | null> {
  try {
    const line = origPara.content ?? ''
    if (line === '') {
      return null
    }

    const cancelledDate = getTodaysDateHyphenated()
    const newRepeatDateStr = generateNewRepeatDate(noteToUse, line, cancelledDate)

    let newRepeatContent = line
      .replace(RE_ANY_DUE_DATE_TYPE, '')
      .replace(/@done\(.*\)/, '')
      .replace(/^\s*?\*\s\[\-\]\s/, '')
      .replace(/^\s*?\-\s\[-\]\s/, '')
      .replace(/^\s*?\+\s\[+\]\s/, '')
    newRepeatContent = textWithoutSyncedCopyTag(newRepeatContent).trim()

    let newPara: TParagraph
    if (noteIsOpenInEditor) {
      await Editor.insertParagraphBeforeParagraph(`${newRepeatContent} >${newRepeatDateStr}`, origPara, 'open')
      newPara = Editor.paragraphs[origPara.lineIndex]
    } else {
      // $FlowIgnore[prop-missing] noteToUse is a TNote when not using Editor
      await noteToUse.insertParagraphBeforeParagraph(`${newRepeatContent} >${newRepeatDateStr}`, origPara, 'open')
      // $FlowIgnore[prop-missing] noteToUse is a TNote when not using Editor
      newPara = noteToUse.paragraphs[origPara.lineIndex]
    }

    if (newPara) {
      newPara.indents = origPara.indents
      if (noteIsOpenInEditor) {
        Editor.updateParagraph(newPara)
      } else {
        // $FlowIgnore[prop-missing] noteToUse is a TNote when not using Editor
        noteToUse.updateParagraph(newPara)
      }
    }

    return newPara
  } catch (error) {
    logError(LOG_CONTEXT, `generateRepeatForCancelledPara(): ${JSP(error)}`)
    return null
  }
}

//------------------------------------------------------------------
// markComplete bridge (keeps NPParagraph free of plugin paths)

/**
 * If the paragraph has extended @repeat(...), load Repeat Extensions settings (or defaults)
 * and run generate repeat logic. No-op when there is no extended repeat tag.
 */
export async function invokeExtendedRepeatIfNeededAfterMarkComplete(para: TParagraph): Promise<void> {
  if (!RE_EXTENDED_REPEAT.test(para.content)) {
    return
  }

  let repeatConfig: RepeatConfig
  const installedPlugins = DataStore.installedPlugins()
  const repeatsIsInstalled = Boolean(Array.isArray(installedPlugins) ? installedPlugins.find((p) => p.id === REPEAT_EXTENSIONS_PLUGIN_ID) : null)
  if (!repeatsIsInstalled) {
    logWarn('markComplete', `Repeat Extensions plugin is not installed and configured, so will use safe defaults`)
    repeatConfig = {
      deleteCompletedRepeat: false,
      dontLookForRepeatsInDoneOrArchive: true,
      runTaskSorter: false,
      taskSortingOrder: '',
      allowRepeatsInCancelledParas: false,
      _logLevel: 'INFO',
    }
  } else {
    const loaded = await getRepeatSettings()
    if (loaded == null || typeof loaded !== 'object') {
      logWarn('markComplete', `getRepeatSettings() returned no config; skipping extended repeat generation.`)
      return
    }
    repeatConfig = loaded
  }

  const repeatDate = getFirstDateInPeriod(para.content)
  logInfo('markComplete', `will call Repeat Extensions plugin to fire /rpt trigger for date ${repeatDate}`)
  const res = await generateRepeatForPara(para, para.note, repeatConfig)
  if (!res) {
    logWarn('markComplete', `Call to generate repeat for para {${para.content}} failed.`)
  }
}
