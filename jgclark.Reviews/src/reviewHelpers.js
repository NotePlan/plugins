// @flow
//-----------------------------------------------------------------------------
// Helper functions for Review plugin
// by Jonathan Clark
// Last updated 2024-10-03 for v1.0.0.b1, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import { type Progress } from './projectClass'
import {
  calcOffsetDate,
  getDateFromUnhyphenatedDateString,
  getDateObjFromDateString,
  getJSDateStartOfToday,
  RE_ISO_DATE, RE_YYYYMMDD_DATE,
  toISODateString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import {
  createRunPluginCallbackUrl, displayTitle,
} from '@helpers/general'
import { noteHasFrontMatter, setFrontMatterVars } from '@helpers/NPFrontMatter'
import {
  findEndOfActivePartOfNote,
} from '@helpers/paragraph'
import {
  showMessage
} from '@helpers/userInput'

//------------------------------
// Config setup

export type ReviewConfig = {
  outputStyle: string,
  reviewsTheme: string,
  folderToStore: string,
  foldersToInclude: Array<string>,
  foldersToIgnore: Array<string>,
  noteTypeTags: Array<string>,
  displayDates: boolean,
  displayProgress: boolean,
  displayOrder: string,
  displayGroupedByFolder: boolean,
  displayFinished: boolean,
  displayOnlyDue: boolean,
  hideTopLevelFolder: boolean,
  displayArchivedProjects: boolean,
  finishedListHeading: string,
  confirmNextReview: boolean,
  startMentionStr: string,
  completedMentionStr: string,
  cancelledMentionStr: string,
  dueMentionStr: string,
  reviewIntervalMentionStr: string,
  reviewedMentionStr: string,
  nextReviewMentionStr: string,
  width: number,
  height: number,
  archiveUsingFolderStructure: boolean,
  removeDueDatesOnPause: boolean,
  nextActionTag: string,
  displayNextActions: boolean,
  _logLevel: string,
  _logTimer: boolean,
  _logLevel: string,
}

/**
 * Get config settings
 * @author @jgclark
 * @return {ReviewConfig} object with configuration
 */
export async function getReviewSettings(): Promise<ReviewConfig> {
  try {
    // logDebug('getReviewSettings', `Starting ...`)
    // Get settings
    const config: ReviewConfig = await DataStore.loadJSON('../jgclark.Reviews/settings.json')

    if (config == null || Object.keys(config).length === 0) {
      await showMessage(`Cannot find settings for the 'Reviews' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      // $FlowFixMe[incompatible-return]
      return null
    }
    // clo(config, `Review settings`)

    // Need to store some things in the Preferences API mechanism, in order to pass things to the Project class
    // Note: there was an issue in builds ?1020-1030 that stopped new prefs being added.
    DataStore.setPreference('startMentionStr', config.startMentionStr)
    DataStore.setPreference('completedMentionStr', config.completedMentionStr)
    DataStore.setPreference('cancelledMentionStr', config.cancelledMentionStr)
    DataStore.setPreference('dueMentionStr', config.dueMentionStr)
    DataStore.setPreference('reviewIntervalMentionStr', config.reviewIntervalMentionStr)
    DataStore.setPreference('reviewedMentionStr', config.reviewedMentionStr)
    DataStore.setPreference('nextReviewMentionStr', config.nextReviewMentionStr)

    return config
  } catch (err) {
    logError('getReviewSettings', `${err.name}: ${err.message}`)
    await showMessage(err.message)
    // $FlowFixMe[incompatible-return]
    return null
  }
}

//----------------------------------------------------------------

/**
 * Calculate the next date to review, based on last review date and date interval.
 * If no last review date, then the answer is today's date.
 * @author @jgclark
 * @param {Date} lastReviewDate - JS Date
 * @param {string} interval - interval specified as nn[bdwmqy]
 * @return {Date} - JS Date
 */
export function calcNextReviewDate(lastReviewDate: Date, interval: string): Date {
  const lastReviewDateStr: string = toISODateString(lastReviewDate)
  // $FlowIgnore[incompatible-type] as calcOffsetDate() will throw error rather than return null
  const reviewDate: Date = lastReviewDate != null ? calcOffsetDate(lastReviewDateStr, interval) : getJSDateStartOfToday() // today's date
  return reviewDate
}

/**
 * From an array of strings, return the first string that matches the
 * wanted parameterised @mention, or empty String.
 * @author @jgclark
 * @param {Array<string>} mentionList - list of @mentions to search
 * @param {string} mention - string to match (with a following '(' to indicate start of parameter)
 * @return {string} - JS Date version, if valid date found
 */
export function getParamMentionFromList(mentionList: $ReadOnlyArray<string>, mention: string): string {
  // logDebug(pluginJson, `getMentionFromList for: ${mention}`)
  const res = mentionList.filter((m) => m.startsWith(`${mention}(`))
  return res.length > 0 ? res[0] : ''
}

/**
 * Return lineIndex (or NaN) of first matching 'naTag' in 'note'
 * @param {TNote} note to search
 * @param {string} naTag to search for
 * @returns {number}
 */
export function getNextActionLineIndex(note: TNote, naTag: string): number {
  const NAParas = note.paragraphs.filter((p) => p.content.includes(naTag)) ?? []
  const result = (NAParas.length > 0) ? NAParas[0].lineIndex : NaN
  return result
}

/**
 * Read lines in 'note' and return any lines (as strings) that contain fields
 * (that start with 'fieldName' parameter before a colon with text after).
 * The matching is done case insensitively, and only in the active region of the note.
 * Note: see also getFieldParagraphsFromNote() variation on this
 * @param {TNote} note
 * @param {string} fieldName
 * @returns {Array<string>} lines containing fields
 */
export function getFieldsFromNote(note: TNote, fieldName: string): Array<string> {
  const paras = note.paragraphs
  const endOfActive = findEndOfActivePartOfNote(note)
  const matchArr = []
  const RE = new RegExp(`^${fieldName}:\\s*(.+)`, 'i') // case-insensitive match at start of line
  for (const p of paras) {
    const matchRE = p.content.match(RE)
    if (matchRE && p.lineIndex < endOfActive) {
      matchArr.push(matchRE[1])
    }
  }
  // logDebug('getFieldsFromNote()', `Found ${matchArr.length} fields matching '${fieldName}'`)
  return matchArr
}

/**
 * Read lines in 'note' and return any paragraphs that contain fields
 * (that start with 'fieldName' parameter before a colon with text after).
 * The matching is done case insensitively, and only in the active region of the note.
 * Note: see also getFieldsFromNote() variation on this
 * @param {TNote} note
 * @param {string} fieldName
 * @returns {Array<string>} lines containing fields
 */
export function getFieldParagraphsFromNote(note: TNote, fieldName: string): Array<TParagraph> {
  const paras = note.paragraphs
  const endOfActive = findEndOfActivePartOfNote(note)
  const matchArr = []
  const RE = new RegExp(`^${fieldName}:\\s*(.+)`, 'i') // case-insensitive match at start of line
  for (const p of paras) {
    const matchRE = p.content.match(RE)
    if (matchRE && p.lineIndex < endOfActive) {
      matchArr.push(p)
    }
  }
  // logDebug('getFieldParagraphsFromNote()', `Found ${matchArr.length} fields matching '${fieldName}'`)
  return matchArr
}

/**
 * Return the (paragraph index of) the most recent progress line from the array, based upon the most recent YYYYMMDD or YYYY-MM-DD date found. If it can't find any it default to the first paragraph.
 * @param {Array<TParagraph>} progressParas
 * @returns {number} lineIndex of the most recent line
 */
export function processMostRecentProgressParagraph(progressParas: Array<TParagraph>): Progress {
  try {
    let lastDate = new Date('0000-01-01') // earliest possible YYYY-MM-DD date
    // let lastIndex = 0 // Default to returning first line
    // let i = 0
    let outputProgress: Progress = {
      lineIndex: 1,
      percentComplete: NaN,
      date: new Date('0001-01-01'),
      comment: '(no comment found)'
    }
    for (const progressPara of progressParas) {
      // const progressParaParts = progressPara.content.split(/[:@]/)
      // if (progressParaParts.length >= 1) {
      // const thisDatePart = progressParaParts[1]
      const progressLine = progressPara.content
      // logDebug('processMostRecentProgressParagraph', progressLine)
      const thisDate: Date = (new RegExp(RE_ISO_DATE).test(progressLine))
        // $FlowIgnore
        ? getDateObjFromDateString(progressLine.match(RE_ISO_DATE)[0])
        : (new RegExp(RE_YYYYMMDD_DATE).test(progressLine))
          // $FlowIgnore
          ? getDateFromUnhyphenatedDateString(progressLine.match(RE_YYYYMMDD_DATE)[0])
          : new Date('0001-01-01')
      const tempSplitParts = progressLine.split(/[:@]/)
      // logDebug('processMostRecentProgressParagraph', `tempSplitParts: ${String(tempSplitParts)}`)
      const comment = tempSplitParts[3] ?? ''

      const tempNumberMatches = progressLine.match(/(\d{1,2})@/)
      // logDebug('processMostRecentProgressParagraph', `tempNumberMatches: ${String(tempNumberMatches)}`)
      const percent: number = (tempNumberMatches && tempNumberMatches.length > 0)
        ? Number(tempNumberMatches[1])
        : NaN
      // logDebug('processMostRecentProgressParagraph', `-> ${String(percent)}`)

      if (thisDate > lastDate) {
        // lastIndex = i // progressPara.lineIndex
        // logDebug('Project::processMostRecentProgressParagraph', `Found latest datePart ${thisDatePart}`)
        outputProgress = {
          lineIndex: progressPara.lineIndex,
          percentComplete: percent,
          date: thisDate,
          comment: comment
        }
      }
      lastDate = thisDate

      // }
      // i++
    }
    // clo(outputProgress, 'processMostRecentProgressParagraph ->')
    return outputProgress
  } catch (e) {
    logError('Project::processMostRecentProgressParagraph', e.message)
    return {
      lineIndex: 1,
      percentComplete: NaN,
      date: new Date('0001-01-01'),
      comment: '(no comment found)'
    } // for completeness
  }
}

/**
 * Works out which line (if any) of the current note is project-style metadata line, defined as
 * - line starting 'project:' or 'medadata:'
 * - first line containing a @review() or @reviewed() mention
 * - first line starting with a hashtag.
 * If these can't be found, then create a new line after the title, or in the 'metadata:' field if present in the frontmatter.
 * @author @jgclark
 *
 * @param {TNote} note to use
 * @param {string} metadataLinePlaceholder optional to use if we need to make a new metadata line
 * @returns {number} the line number for the existing or new metadata line
 */
export function getOrMakeMetadataLine(note: TNote, metadataLinePlaceholder: string = ''): number {
  try {
    const lines = note.paragraphs?.map((s) => s.content) ?? []
    // logDebug('getOrMakeMetadataLine', `Starting with ${lines.length} lines`)

    // Belt-and-Braces: deal with empty or almost-empty notes
    if (lines.length === 0) {
      note.appendParagraph('<placeholder title>', 'title')
      note.appendParagraph(metadataLinePlaceholder, 'text')
      return 1
    } else if (lines.length === 1) {
      note.appendParagraph(metadataLinePlaceholder, 'text')
      return 1
    }

    let lineNumber: number = NaN
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].match(/^project:/i) || lines[i].match(/^metadata:/i) || lines[i].match(/^#[\w]/) || lines[i].match(/(@review|@reviewed)\(.+\)/)) {
        lineNumber = i
        break
      }
    }
    // If no metadataPara found, then insert one either after title, or in the frontmatter if present.
    if (Number.isNaN(lineNumber)) {
      if (noteHasFrontMatter(note)) {
        logWarn('getOrMakeMetadataLine', `Warning: Can't find an existing metadata line, so will insert into metadata`)
        const res = setFrontMatterVars(note, {
          'metadata': metadataLinePlaceholder
        })
        const updatedLines = note.paragraphs?.map((s) => s.content) ?? []
        // Find which line that project field is on
        for (let i = 1; i < updatedLines.length; i++) {
          if (updatedLines[i].match(/^metadata:/i)) {
            lineNumber = i
            break
          }
        }
      } else {
        logWarn('getOrMakeMetadataLine', `Warning: Can't find an existing metadata line, so will insert one after title`)
        note.insertParagraph(metadataLinePlaceholder, 1, 'text')
        lineNumber = 1
      }
    }
    // logDebug('getOrMakeMetadataLine', `Metadata line = ${String(lineNumber)}`)
    return lineNumber
  } catch (error) {
    logError('getOrMakeMetadataLine', error.message)
    return 0
  }
}

/**
 * WARNING: DEPRECATED
 * Function to save changes to the Editor to the cache to be available elsewhere straight away.
 * Note: Now declared v3.9.3 as minimum version, so we can use API function for this.
 */
// eslint-disable-next-line no-unused-vars
export async function saveEditorToCache(completed: any): Promise<void> {
  logDebug('saveEditorToCache', 'waiting for Editor.save ...')
  await Editor.save()
  logDebug('saveEditorToCache', '... done')
}

//-------------------------------------------------------------------------------
/**
 * Update project metadata @mentions (e.g. @reviewed(date)) in the metadata line of the note in the Editor.
 * It takes each mention in the array (e.g. '@reviewed(2023-06-23)') and all other versions of it will be removed first, before that string is appended.
 * @author @jgclark
 * @param {Array<string>} mentions to update:
 * @returns { ?TNote } current note
 */
export function updateMetadataInEditor(updatedMetadataArr: Array<string>): ?TNote {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.note.paragraphs.length < 2) {
      logWarn('updateMetadataInEditor', `- We're not in a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }
    const thisNote = Editor // note: not Editor.note

    const metadataLineIndex: number = getOrMakeMetadataLine(Editor)
    // Re-read paragraphs, as they might have changed
    const metadataPara = Editor.paragraphs[metadataLineIndex]
    if (!metadataPara) {
      throw new Error(`Couldn't get or make metadataPara for ${displayTitle(Editor)}`)
    }

    const origLine: string = metadataPara.content
    let updatedLine = origLine

    logDebug('updateMetadataInEditor', `starting for '${displayTitle(thisNote)}' for new metadata ${String(updatedMetadataArr)} with metadataLineIndex ${metadataLineIndex} ('${origLine}')`)

    for (const item of updatedMetadataArr) {
      const mentionName = item.split('(', 1)[0]
      // logDebug('updateMetadataInEditor', `Processing ${item} for ${mentionName}`)
      // Start by removing all instances of this @mention
      const RE_THIS_MENTION_ALL = new RegExp(`${mentionName}\\([\\w\\-\\.]+\\)`, 'gi')
      updatedLine = updatedLine.replace(RE_THIS_MENTION_ALL, '')
      // Then append this @mention
      updatedLine += ` ${item}`
      // logDebug('updateMetadataInEditor', `-> ${updatedLine}`)
    }

    // send update to Editor (removing multiple and trailing spaces)
    metadataPara.content = updatedLine.replace(/\s{2,}/g, ' ').trimRight()
    Editor.updateParagraph(metadataPara)
    // await saveEditorToCache() // might be stopping code execution here for unknown reasons
    logDebug('updateMetadataInEditor', `- After update ${metadataPara.content}`)

    // update this note in the review list
    return thisNote
  } catch (error) {
    logError('updateMetadataInEditor', `${error.message}`)
    return null
  }
}

/**
 * Update project metadata @mentions (e.g. @reviewed(date)) in the metadata line of the given note.
 * It takes each mention in the array (e.g. '@reviewed(2023-06-23)') and all other versions of @reviewed will be removed first, before that string is appended.
 * Note: additional complexity as '@review' starts the same as '@reviewed'
 * @author @jgclark
 * @param {TNote} noteToUse
 * @param {Array<string>} mentions to update:
 */
export function updateMetadataInNote(note: TNote, updatedMetadataArr: Array<string>): void {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (note == null || note.type === 'Calendar' || note.paragraphs.length < 2) {
      logWarn('updateMetadataInEditor', `- We don't have a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }

    const metadataLineIndex: number = getOrMakeMetadataLine(note)
    // Re-read paragraphs, as they might have changed
    const metadataPara = note.paragraphs[metadataLineIndex]
    if (!metadataPara) {
      throw new Error(`Couldn't get or make metadataPara for ${displayTitle(note)}`)
    }

    const origLine: string = metadataPara.content
    let updatedLine = origLine

    logDebug('updateMetadataInNote', `starting for '${displayTitle(note)}' for new metadata ${String(updatedMetadataArr)} with metadataLineIndex ${metadataLineIndex} ('${origLine}')`)

    for (const item of updatedMetadataArr) {
      const mentionName = item.split('(', 1)[0]
      logDebug('updateMetadataInNote', `Processing ${item} for ${mentionName}`)
      // Start by removing all instances of this @mention
      const RE_THIS_MENTION_ALL = new RegExp(`${mentionName}\\([\\w\\-\\.]+\\)`, 'gi')
      updatedLine = updatedLine.replace(RE_THIS_MENTION_ALL, '')
      // Then append this @mention
      updatedLine += ` ${item}`
      logDebug('updateMetadataInNote', `-> ${updatedLine}`)
    }

    // update the note (removing multiple and trailing spaces)
    metadataPara.content = updatedLine.replace(/\s{2,}/g, ' ').trimRight()
    note.updateParagraph(metadataPara)
    logDebug('updateMetadataInNote', `- After update ${metadataPara.content}`)

    return
  } catch (error) {
    logError('updateMetadataInNote', `${error.message}`)
    return
  }
}

//-------------------------------------------------------------------------------
// Other helpers

/**
 * Update project metadata @mentions (e.g. @reviewed(date)) in the note in the Editor
 * @author @jgclark
 * @param {Array<string>} mentions to update (just the @mention name, not and bracketed date)
 * @returns { ?TNote } current note
 */
export function deleteMetadataMentionInEditor(mentionsToDeleteArr: Array<string>): ?TNote {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (Editor.note == null || Editor.note.type === 'Calendar' || Editor.note.paragraphs.length < 2) {
      logWarn('deleteMetadataMentionInEditor', `- We're not in a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }
    const thisNote = Editor // note: not Editor.note

    const metadataLineIndex: number = getOrMakeMetadataLine(Editor)
    // Re-read paragraphs, as they might have changed
    const metadataPara = Editor.paragraphs[metadataLineIndex]
    if (!metadataPara) {
      throw new Error(`Couldn't get or make metadataPara for ${displayTitle(Editor)}`)
    }

    const origLine: string = metadataPara.content
    let newLine = origLine

    logDebug('deleteMetadataMentionInEditor', `starting for '${displayTitle(Editor)}' with metadataLineIndex ${metadataLineIndex} to remove [${String(mentionsToDeleteArr)}]`)

    for (const mentionName of mentionsToDeleteArr) {
      // logDebug('deleteMetadataMentionInEditor', `Processing ${item} for ${mentionName}`)
      // Start by removing all instances of this @mention
      const RE_THIS_MENTION_ALL = new RegExp(`${mentionName}(\\([\\d\\-\\.]+\\))?`, 'gi')
      newLine = newLine.replace(RE_THIS_MENTION_ALL, '')
      logDebug('deleteMetadataMentionInEditor', `-> ${newLine}`)
    }

    // send update to Editor (removing multiple and trailing spaces)
    metadataPara.content = newLine.replace(/\s{2,}/g, ' ').trimRight()
    Editor.updateParagraph(metadataPara)
    // await saveEditorToCache() // seems to stop here but without error
    logDebug('deleteMetadataMentionInEditor', `- After update ${metadataPara.content}`)

    // update this note in the review list
    return thisNote
  } catch (error) {
    logError('deleteMetadataMentionInEditor', `${error.message}`)
    return null
  }
}

/**
 * Update project metadata @mentions (e.g. @reviewed(date)) in the note in the Editor
 * @author @jgclark
 * @param {TNote} noteToUse
 * @param {Array<string>} mentions to update (just the @mention name, not and bracketed date)
 */
export function deleteMetadataMentionInNote(noteToUse: TNote, mentionsToDeleteArr: Array<string>): void {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (noteToUse == null || noteToUse.type === 'Calendar' || noteToUse.paragraphs.length < 2) {
      logWarn('deleteMetadataMentionInNote', `- We've not been passed a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }

    const metadataLineIndex: number = getOrMakeMetadataLine(noteToUse)
    const metadataPara = noteToUse.paragraphs[metadataLineIndex]
    if (!metadataPara) {
      throw new Error(`Couldn't get or make metadataPara for ${displayTitle(noteToUse)}`)
    }

    const origLine: string = metadataPara.content
    let newLine = origLine

    logDebug('deleteMetadataMentionInNote', `starting for '${displayTitle(noteToUse)}' with metadataLineIndex ${metadataLineIndex} to remove [${String(mentionsToDeleteArr)}]`)

    for (const mentionName of mentionsToDeleteArr) {
      // logDebug('deleteMetadataMentionInNote', `Processing ${item} for ${mentionName}`)
      // Start by removing all instances of this @mention
      const RE_THIS_MENTION_ALL = new RegExp(`${mentionName}(\\([\\d\\-\\.]+\\))?`, 'gi')
      newLine = newLine.replace(RE_THIS_MENTION_ALL, '')
      logDebug('deleteMetadataMentionInNote', `-> ${newLine}`)
    }

    // send update to noteToUse (removing multiple and trailing spaces)
    metadataPara.content = newLine.replace(/\s{2,}/g, ' ').trimRight()
    noteToUse.updateParagraph(metadataPara)
    logDebug('deleteMetadataMentionInNote', `- After update ${metadataPara.content}`)
    return
  } catch (error) {
    logError('deleteMetadataMentionInNote', `${error.message}`)
    return
  }
}

export function updateDashboardIfOpen(): void {
  // Finally, refresh Dashboard. Note: Designed to fail silently if it isn't installed, or open.
  const refreshXCallbackURL = createRunPluginCallbackUrl('jgclark.Dashboard', 'refreshProjectSection', '')
  logDebug('updateDashboardIfOpen', `sent message to refresh 🎛 Dashboard: ${refreshXCallbackURL}`)
  NotePlan.openURL(refreshXCallbackURL) // no point in having await
}

/**
 * Insert a fontawesome icon in given color.
 * Other styling comes from CSS for 'circle-icon' (just sets size)
 * @param {string} faClasses CSS class name(s) to use for FA icons
 * @param {string} colorStr optional
 * @returns HTML string to insert
 */
export function addFAIcon(faClasses: string, colorStr: string = ''): string {
  if (colorStr !== '') {
    return `<span class="${faClasses}" style="color: ${colorStr}"></span>`
  } else {
    return `<span class="${faClasses}"></span>`
  }
}
