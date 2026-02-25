// @flow
//-----------------------------------------------------------------------------
// Helper functions for Review plugin
// by Jonathan Clark
// Last updated 2026-02-23 for v1.4.0.b2, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import { getActivePerspectiveDef, getAllowedFoldersInCurrentPerspective, getPerspectiveSettings } from '../../jgclark.Dashboard/src/perspectiveHelpers'
import type { TPerspectiveDef } from '../../jgclark.Dashboard/src/types'
import { type Progress } from './projectClass'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import {
  calcOffsetDate,
  getDateFromYYYYMMDDString,
  getDateObjFromDateString,
  getJSDateStartOfToday,
  RE_ISO_DATE,
  RE_YYYYMMDD_DATE,
  toISODateString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getFrontmatterAttribute, noteHasFrontMatter, updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { getFieldParagraphsFromNote } from '@helpers/paragraph'
import { showMessage } from '@helpers/userInput'

//------------------------------
// Config setup

export type ReviewConfig = {
  usePerspectives: boolean,
  perspectiveName: string,
  outputStyle: string,
  reviewsTheme: string,
  folderToStore: string,
  foldersToInclude: Array<string>,
  foldersToIgnore: Array<string>,
  includedTeamspaces: Array<string>, // Array of teamspace IDs to include ('private' for Private space)
  projectTypeTags: Array<string>,
  numberDaysForFutureToIgnore: number,
  cancelledMentionStr: string,
  completedMentionStr: string,
  confirmNextReview: boolean,
  displayDates: boolean,
  displayPaused: boolean,
  dueMentionStr: string,
  displayArchivedProjects: boolean,
  displayFinished: boolean,
  displayGroupedByFolder: boolean,
  displayNextActions: boolean,
  displayOrder: string,
  displayOnlyDue: boolean,
  displayProgress: boolean,
  projectTagsInColumn?: string, // 'column2' | 'column3'; default column2
  finishedListHeading: string,
  hideTopLevelFolder: boolean,
  ignoreChecklistsInProgress: boolean,
  reviewedMentionStr: string,
  reviewIntervalMentionStr: string,
  startMentionStr: string,
  nextReviewMentionStr: string,
  width: number,
  height: number,
  archiveUsingFolderStructure: boolean,
  archiveFolder: string,
  nextActionTags: Array<string>,
  preferredWindowType: string,
  progressHeading?: string,
  progressHeadingLevel: number,
  removeDueDatesOnPause: boolean,
  sequentialTag: string,
  useDemoData: boolean,
  writeMostRecentProgressToFrontmatter?: boolean,
  _logLevel: string,
  _logTimer: boolean,
}

/**
 * Get config settings
 * @author @jgclark
 * @return {ReviewConfig} object with configuration
 */
export async function getReviewSettings(externalCall: boolean = false): Promise<ReviewConfig> {
  try {
    logDebug('getReviewSettings', `Starting${externalCall ? ' from a different plugin' : ''} ...`)
    // Get settings
    const config: ReviewConfig = await DataStore.loadJSON('../jgclark.Reviews/settings.json')

    // If an external call allow silent return of null if no settings found.
    // Otherwise complain, as there should be settings.
    if (config == null || Object.keys(config).length === 0) {
      if (!externalCall) {
        await showMessage(`Cannot find settings for the 'Projects & Reviews' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
        throw new Error(`Can't find settings file '../jgclark.Reviews/settings.json', so stopping.`)
      }
      // $FlowFixMe[incompatible-return] as we're returning null if no settings found
      return null
    }
    // clo(config, `Review settings`)

    // Need to store some things in the Preferences API mechanism, in order to pass things to the Project class
    DataStore.setPreference('startMentionStr', config.startMentionStr)
    DataStore.setPreference('completedMentionStr', config.completedMentionStr)
    DataStore.setPreference('cancelledMentionStr', config.cancelledMentionStr)
    DataStore.setPreference('dueMentionStr', config.dueMentionStr)
    DataStore.setPreference('reviewIntervalMentionStr', config.reviewIntervalMentionStr)
    DataStore.setPreference('reviewedMentionStr', config.reviewedMentionStr)
    DataStore.setPreference('nextReviewMentionStr', config.nextReviewMentionStr)
    DataStore.setPreference('numberDaysForFutureToIgnore', config.numberDaysForFutureToIgnore)
    DataStore.setPreference('ignoreChecklistsInProgress', config.ignoreChecklistsInProgress)

    // Set default for includedTeamspaces if not using Perspectives
    // Note: This value is only used when Perspectives are enabled, so the default doesn't affect filtering when Perspectives are off
    if (!config.usePerspectives) {
      config.includedTeamspaces = ['private'] // Default value (not used when Perspectives are off)
    }

    // If we want to use Perspectives, get all perspective settings
    if (config.usePerspectives) {
      const perspectiveSettings: Array<TPerspectiveDef> = await getPerspectiveSettings(false)
      // Get the current Perspective
      const currentPerspective: any = getActivePerspectiveDef(perspectiveSettings)
      // clo(currentPerspective, `currentPerspective`)
      config.perspectiveName = currentPerspective.name
      logDebug('getReviewSettings', `Will use Perspective '${config.perspectiveName}', and will override any foldersToInclude, foldersToIgnore, and includedTeamspaces settings`)
      config.foldersToInclude = stringListOrArrayToArray(currentPerspective.dashboardSettings?.includedFolders ?? '', ',')
      config.foldersToIgnore = stringListOrArrayToArray(currentPerspective.dashboardSettings?.excludedFolders ?? '', ',')
      config.includedTeamspaces = currentPerspective.dashboardSettings?.includedTeamspaces ?? ['private']
      // logDebug('getReviewSettings', `- foldersToInclude: [${String(config.foldersToInclude)}]`)
      // logDebug('getReviewSettings', `- foldersToIgnore: [${String(config.foldersToIgnore)}]`)
      logDebug('getReviewSettings', `- includedTeamspaces: [${String(config.includedTeamspaces)}]`)

      const validFolders = getAllowedFoldersInCurrentPerspective(perspectiveSettings)
      logDebug('getReviewSettings', `-> validFolders for '${config.perspectiveName}': [${String(validFolders)}]`)
    }

    // Ensure displayPaused has a sensible default if missing from settings
    if (config.displayPaused == null) {
      config.displayPaused = true
    }

    return config
  } catch (err) {
    logError('getReviewSettings', `${err.name}: ${err.message}`)
    // $FlowFixMe[incompatible-return] as we're returning null if no settings found
    return null
  }
}

//----------------------------------------------------------------

/**
 * Calculate the next date to review, based on last review date and date interval.
 * If no last review date, then the answer is today's date.
 * @author @jgclark
 * @param {string|Date} lastReviewDate - ISO date string (YYYY-MM-DD) or JS Date
 * @param {string} interval - interval specified as nn[bdwmqy]
 * @return {?string} - ISO date string (YYYY-MM-DD) or null if calculation fails
 */
export function calcNextReviewDate(lastReviewDate: string | Date, interval: string): ?string {
  const lastReviewDateStr: string = typeof lastReviewDate === 'string' ? lastReviewDate : toISODateString(lastReviewDate)
  const reviewDate: Date | null = lastReviewDate != null ? calcOffsetDate(lastReviewDateStr, interval) : getJSDateStartOfToday()
  return reviewDate != null ? toISODateString(reviewDate) : null
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
export function getNextActionLineIndex(note: CoreNoteFields, naTag: string): number {
  // logDebug('getNextActionLineIndex', `Checking for @${naTag} in ${displayTitle(note)} with ${note.paragraphs.length} paras`)
  const NAParas = note.paragraphs.filter((p) => p.content.includes(naTag)) ?? []
  logDebug('getNextActionLineIndex', `Found ${NAParas.length} matching ${naTag} paras`)
  const result = NAParas.length > 0 ? NAParas[0].lineIndex : NaN
  return result
}

/**
 * Return true if the project note is marked sequential (sequential tag in frontmatter 'project' or in the metadata line).
 * Mirrors logic in Project.generateNextActionComments.
 * @param {TNote} note - Note to check
 * @param {string} sequentialTag - Tag to look for (e.g. '#sequential')
 * @returns {boolean}
 */
export function isProjectNoteIsMarkedSequential(note: TNote, sequentialTag: string): boolean {
  if (!sequentialTag) return false
  const projectAttribute = getFrontmatterAttribute(note, 'project') ?? ''
  if (projectAttribute.includes(sequentialTag)) {
    logDebug('isProjectNoteIsMarkedSequential', `found sequential tag '${sequentialTag}' in frontmatter 'project' attribute`)
    return true
  }
  const metadataLineIndex = getOrMakeMetadataLineIndex(note)
  const paras = note.paragraphs ?? []
  const metadataLine = paras.length > metadataLineIndex ? paras[metadataLineIndex].content : ''
  const hashtags = (`${metadataLine} `).split(' ').filter((f) => f[0] === '#')
  if (hashtags.some((tag) => tag === sequentialTag)) {
    logDebug('isProjectNoteIsMarkedSequential', `found sequential tag '${sequentialTag}' in metadata line hashtags`)
    return true
  }
  if (metadataLine.includes(sequentialTag)) {
    logDebug('isProjectNoteIsMarkedSequential', `found sequential tag '${sequentialTag}' in metadata line content`)
    return true
  }
  return false
}

/**
 * Return the (paragraph index of) the most recent progress line from the array, based upon the most recent YYYYMMDD or YYYY-MM-DD date found. If it can't find any it default to the first paragraph.
 * See Project::processProgressLines() for allowed formats.
 * @param {Array<TParagraph>} progressParas
 * @returns {number} lineIndex of the most recent line
 */
export function processMostRecentProgressParagraph(progressParas: Array<TParagraph>): Progress {
  try {
    let lastDate = new Date('0000-01-01') // earliest possible YYYY-MM-DD date
    let outputProgress: Progress = {
      lineIndex: 1,
      percentComplete: NaN,
      date: new Date('0001-01-01'),
      comment: '(no comment found)',
    }

    for (const progressPara of progressParas) {
      const progressLine = progressPara.content
      // logDebug('processMostRecentProgressParagraph', progressLine)
      const isoMatch = progressLine.match(RE_ISO_DATE)
      const yyyymmddMatch = progressLine.match(RE_YYYYMMDD_DATE)
      const dateStr = isoMatch ? isoMatch[0] : yyyymmddMatch ? yyyymmddMatch[0] : null
      const thisDate: Date =
        isoMatch
          ? // $FlowIgnore
            getDateObjFromDateString(isoMatch[0])
          : yyyymmddMatch
          ? // $FlowIgnore
            getDateFromYYYYMMDDString(yyyymmddMatch[0])
          : new Date('0001-01-01')
      // Comment: support both "date: comment" and "date comment" by taking everything after the date and stripping optional colon
      let comment = ''
      if (dateStr != null) {
        const afterDate = progressLine.slice(progressLine.indexOf(dateStr) + dateStr.length).replace(/^[\s:]+/, '').trim()
        comment = afterDate
      } else {
        const tempSplitParts = progressLine.split(/[:@]/)
        comment = tempSplitParts[3] ?? ''
      }

      const tempNumberMatches = progressLine.match(/(\d{1,3})@/)
      // logDebug('processMostRecentProgressParagraph', `tempNumberMatches: ${String(tempNumberMatches)}`)
      const rawPercent = tempNumberMatches && tempNumberMatches.length > 0 ? Number(tempNumberMatches[1]) : NaN
      const percent: number = !isNaN(rawPercent) ? Math.min(100, Math.max(0, rawPercent)) : NaN
      // logDebug('processMostRecentProgressParagraph', `-> ${String(percent)}`)

      if (thisDate > lastDate) {
        // logDebug('Project::processMostRecentProgressParagraph', `Found latest datePart ${thisDatePart}`)
        outputProgress = {
          lineIndex: progressPara.lineIndex,
          percentComplete: percent,
          date: thisDate,
          comment: comment,
        }
      }
      lastDate = thisDate
    }
    // clo(outputProgress, 'processMostRecentProgressParagraph ->')
    return outputProgress
  } catch (e) {
    logError('Project::processMostRecentProgressParagraph', e.message)
    return {
      lineIndex: 1,
      percentComplete: NaN,
      date: new Date('0001-01-01'),
      comment: '(no comment found)',
    } // for completeness
  }
}

/**
 * Works out which line (if any) of the current note is project-style metadata line, defined as
 * - line starting 'project:' or 'medadata:'
 * - first line containing a @review() or @reviewed() mention
 * - first line starting with a hashtag.
 * If these can't be found, then create a new line after the title, or in the 'metadata:' field if present in the frontmatter.
 * TODO: Ideally make a version of this that only checks metadata and doesn't create a new line if it doesn't exist.
 * @author @jgclark
 *
 * @param {TNote} note to use
 * @param {string} metadataLinePlaceholder optional to use if we need to make a new metadata line
 * @returns {number} the line number for the existing or new metadata line
 */
export function getOrMakeMetadataLineIndex(note: CoreNoteFields, metadataLinePlaceholder: string = '#project @review(1w) <-- _update your tag and your review interval here_'): number {
  try {
    const lines = note.paragraphs?.map((s) => s.content) ?? []
    logDebug('getOrMakeMetadataLineIndex', `Starting with ${lines.length} lines for ${displayTitle(note)}`)

    // Belt-and-Braces: deal with empty or almost-empty notes
    if (lines.length === 0) {
      note.appendParagraph('<placeholder title>', 'title')
      note.appendParagraph(metadataLinePlaceholder, 'text')
      logInfo('getOrMakeMetadataLineIndex', `- Finishing after appending placeholder title and metadata placeholder line`)
      return 1
    } else if (lines.length === 1) {
      note.appendParagraph(metadataLinePlaceholder, 'text')
      logInfo('getOrMakeMetadataLineIndex', `- Finishing after appending metadata placeholder line`)
      return 1
    }

    let lineNumber: number = NaN
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].match(/^(project|metadata|review|reviewed):/i) || lines[i].match(/(@review|@reviewed)\(.+\)/)) {
        lineNumber = i
        break
      }
    }

    // If no metadataPara found, then insert one either after title, or in the frontmatter if present.
    if (Number.isNaN(lineNumber)) {
      if (noteHasFrontMatter(note)) {
        logWarn('getOrMakeMetadataLineIndex', `I couldn't find an existing metadata line, so have added a placeholder at the top of the note. Please review it.`)
        // $FlowIgnore[incompatible-call]
        const res = updateFrontMatterVars(note, {
          metadata: metadataLinePlaceholder,
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
        logWarn('getOrMakeMetadataLineIndex', `Warning: Can't find an existing metadata line, so will insert one after title`)
        note.insertParagraph(metadataLinePlaceholder, 1, 'text')
        lineNumber = 1
      }
    }
    // logDebug('getOrMakeMetadataLineIndex', `Metadata line = ${String(lineNumber)}`)
    return lineNumber
  } catch (error) {
    logError('getOrMakeMetadataLineIndex', error.message)
    return 0
  }
}

//-------------------------------------------------------------------------------
/**
 * Update project metadata @mentions (e.g. @reviewed(date)) in the metadata line of the note in the Editor.
 * It takes each mention in the array (e.g. '@reviewed(2023-06-23)') and all other versions of it will be removed first, before that string is appended.
 * @author @jgclark
 * @param {TEditor} thisEditor - the Editor window to update
 * @param {Array<string>} mentions to update:
 * @returns { ?TNote } current note
 */
export function updateMetadataInEditor(thisEditor: TEditor, updatedMetadataArr: Array<string>): void {
  try {
    logDebug('updateMetadataInEditor', `Starting for '${displayTitle(Editor)}' with metadata ${String(updatedMetadataArr)}`)
    
    // Only proceed if we're in a valid Project note (with at least 2 lines)
    if (thisEditor.note == null || thisEditor.note.type === 'Calendar' || thisEditor.note.paragraphs.length < 2) {
      logWarn('updateMetadataInEditor', `- We're not in a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }
    const thisNote = thisEditor // note: not thisEditor.note

    const metadataLineIndex: number = getOrMakeMetadataLineIndex(thisEditor)
    // Re-read paragraphs, as they might have changed
    const metadataPara = thisEditor.paragraphs[metadataLineIndex]
    if (!metadataPara) {
      throw new Error(`Couldn't get or make metadataPara for ${displayTitle(Editor)}`)
    }

    const origLine: string = metadataPara.content
    let updatedLine = origLine

    logDebug(
      'updateMetadataInEditor',
      `starting for '${displayTitle(thisNote)}' for new metadata ${String(updatedMetadataArr)} with metadataLineIndex ${metadataLineIndex} ('${origLine}')`,
    )

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
    thisEditor.updateParagraph(metadataPara)
    // await saveEditorToCache() // might be stopping code execution here for unknown reasons
    logDebug('updateMetadataInEditor', `- After update ${metadataPara.content}`)
  } catch (error) {
    logError('updateMetadataInEditor', error.message)
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
export function updateMetadataInNote(note: CoreNoteFields, updatedMetadataArr: Array<string>): void {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (note == null || note.type === 'Calendar' || note.paragraphs.length < 2) {
      logWarn('updateMetadataInEditor', `- We don't have a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }

    const metadataLineIndex: number = getOrMakeMetadataLineIndex(note)
    // Re-read paragraphs, as they might have changed
    const metadataPara = note.paragraphs[metadataLineIndex]
    if (!metadataPara) {
      throw new Error(`Couldn't get or make metadataPara for ${displayTitle(note)}`)
    }

    const origLine: string = metadataPara.content
    let updatedLine = origLine

    logDebug(
      'updateMetadataInNote',
      `starting for '${displayTitle(note)}' for new metadata ${String(updatedMetadataArr)} with metadataLineIndex ${metadataLineIndex} ('${origLine}')`,
    )

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

export type IntervalDueStatus = {
  color: string,
  text: string
}

/**
 * Map a review interval (days until/since due) to a display color and label.
 * @param {number} interval - days until due (negative = overdue, positive = due in future)
 * @returns {{ color: string, text: string }}
 */
export function getIntervalDueStatus(interval: number): IntervalDueStatus {
  if (interval < -90) return { color: 'red', text: 'project very overdue' }
  if (interval < -14) return { color: 'red', text: 'project overdue' }
  if (interval < 0) return { color: 'orange', text: 'project slightly overdue' }
  if (interval > 30) return { color: 'blue', text: 'project due >month' }
  return { color: 'green', text: 'due soon' }
}

/**
 * Map a review interval (days until/since next review) to a display color and label.
 * @param {number} interval - days until next review (negative = overdue, positive = due in future)
 * @returns {{ color: string, text: string }}
 */
export function getIntervalReviewStatus(interval: number): IntervalDueStatus {
  if (interval < -14) return { color: 'red', text: 'review overdue' }
  if (interval < 0) return { color: 'orange', text: 'review slightly overdue' }
  if (interval > 30) return { color: 'blue', text: 'review in >month' }
  return { color: 'green', text: 'review soon' }
}

/**
 * Update project metadata @mentions (e.g. @reviewed(date)) in the note in the Editor
 * @author @jgclark
 * @param {TEditor} thisEditor - the Editor window to update
 * @param {Array<string>} mentions to update (just the @mention name, not and bracketed date)
 * @returns { ?TNote } current note
 */
export function deleteMetadataMentionInEditor(thisEditor: TEditor, mentionsToDeleteArr: Array<string>): void {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (thisEditor.note == null || thisEditor.note.type === 'Calendar' || thisEditor.note.paragraphs.length < 2) {
      logWarn('deleteMetadataMentionInEditor', `- We're not in a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }
    const thisNote = thisEditor // note: not thisEditor.note

    const metadataLineIndex: number = getOrMakeMetadataLineIndex(thisEditor)
    // Re-read paragraphs, as they might have changed
    const metadataPara = thisEditor.paragraphs[metadataLineIndex]
    if (!metadataPara) {
      throw new Error(`Couldn't get or make metadataPara for ${displayTitle(thisEditor)}`)
    }

    const origLine: string = metadataPara.content
    let newLine = origLine

    logDebug('deleteMetadataMentionInEditor', `starting for '${displayTitle(thisEditor)}' with metadataLineIndex ${metadataLineIndex} to remove [${String(mentionsToDeleteArr)}]`)

    for (const mentionName of mentionsToDeleteArr) {
      // logDebug('deleteMetadataMentionInEditor', `Processing ${item} for ${mentionName}`)
      // Start by removing all instances of this @mention
      const RE_THIS_MENTION_ALL = new RegExp(`${mentionName}(\\([\\d\\-\\.]+\\))?`, 'gi')
      newLine = newLine.replace(RE_THIS_MENTION_ALL, '')
      logDebug('deleteMetadataMentionInEditor', `-> ${newLine}`)
    }

    // send update to Editor (removing multiple and trailing spaces)
    metadataPara.content = newLine.replace(/\s{2,}/g, ' ').trimRight()
    thisEditor.updateParagraph(metadataPara)
    // await saveEditorToCache() // seems to stop here but without error
    logDebug('deleteMetadataMentionInEditor', `- Finished`)
  } catch (error) {
    logError('deleteMetadataMentionInEditor', `${error.message}`)
  }
}

/**
 * Update project metadata @mentions (e.g. @reviewed(date)) in the note in the Editor
 * @author @jgclark
 * @param {TNote} noteToUse
 * @param {Array<string>} mentions to update (just the @mention name, not and bracketed date)
 */
export function deleteMetadataMentionInNote(noteToUse: CoreNoteFields, mentionsToDeleteArr: Array<string>): void {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (noteToUse == null || noteToUse.type === 'Calendar' || noteToUse.paragraphs.length < 2) {
      logWarn('deleteMetadataMentionInNote', `- We've not been passed a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }

    const metadataLineIndex: number = getOrMakeMetadataLineIndex(noteToUse)
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
    logDebug('deleteMetadataMentionInNote', `- Finished`)
  } catch (error) {
    logError('deleteMetadataMentionInNote', `${error.message}`)
  }
}

/**
 * Update Dashboard if it is open.
 * Note: Designed to fail silently if it isn't installed, or open.
 * It is called automatically whenever the allProjectsList is updated, regardless of which function triggers it:
 * - generateAllProjectsList → writeAllProjectsList → updateDashboardIfOpen
 * - updateProjectInAllProjectsList → writeAllProjectsList → updateDashboardIfOpen
 * - updateAllProjectsListAfterChange → writeAllProjectsList → updateDashboardIfOpen
 * @author @jgclark
 */
export async function updateDashboardIfOpen(): Promise<void> {
  // Finally, refresh Dashboard. Note: Designed to fail silently if it isn't installed, or open.
  // WARNING: Be careful of causing race conditions with Perspective changes in Dashboard.

  // v2 (internal invoke plugin command)
  logInfo('updateDashboardIfOpen', `About to run Dashboard:refreshSectionByCode(...)`)
  // Note: This covers codes from before and after Dashboard v2.4.0.b18. TODO(Later): remove the 'PROJ' code when v2.5.0 is released
  // Note: Wrap array in another array because invokePluginCommandByName spreads the array as individual arguments. This avoids only the first array item being used.
  const res = await DataStore.invokePluginCommandByName("refreshSectionsByCode", "jgclark.Dashboard", [['PROJACT', 'PROJREVIEW', 'PROJ']])
}

/**
 * Insert a fontawesome icon in given color.
 * Other styling comes from CSS for 'circle-icon' (just sets size)
 * @param {string} faClasses CSS class name(s) to use for FA icons
 * @param {string} colorStr optional, any valid CSS color value or var(...)
 * @returns HTML string to insert
 */
export function addFAIcon(faClasses: string, colorStr: string = ''): string {
  if (colorStr !== '') {
    return `<span class="${faClasses}" style="color: ${colorStr}"></span>`
  } else {
    return `<span class="${faClasses}"></span>`
  }
}
