// @flow
//-----------------------------------------------------------------------------
// Helper functions for Review plugin
// by Jonathan Clark
// Last updated 2026-03-26 for v1.4.0.b13, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import { getActivePerspectiveDef, getAllowedFoldersInCurrentPerspective, getPerspectiveSettings } from '../../jgclark.Dashboard/src/perspectiveHelpers'
import type { TPerspectiveDef } from '../../jgclark.Dashboard/src/types'
import { type Progress } from './projectClass'
import { checkBoolean, checkString } from '@helpers/checkType'
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
import { endOfFrontmatterLineIndex, ensureFrontmatter, getFrontmatterAttribute, noteHasFrontMatter, removeFrontMatterField, updateFrontMatterVars } from '@helpers/NPFrontMatter'
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
  finishedListHeading: string,
  hideTopLevelFolder: boolean,
  ignoreChecklistsInProgress: boolean,
  reviewedMentionStr: string,
  reviewIntervalMentionStr: string,
  sequentialTag: string,
  showFolderName: boolean,
  startMentionStr: string,
  nextReviewMentionStr: string,
  width: number,
  height: number,
  archiveUsingFolderStructure: boolean,
  archiveFolder: string,
  removeDueDatesOnPause?: boolean,
  nextActionTags: Array<string>,
  preferredWindowType: string,
  autoUpdateAfterIdleTime?: number,
  progressHeading?: string,
  progressHeadingLevel: number,
  writeMostRecentProgressToFrontmatter?: boolean,
  projectMetadataFrontmatterKey?: string,
  writeDateMentionsInCombinedMetadata?: boolean,
  _logLevel: string,
  _logTimer: boolean,
}

/**
 * Convert mention preference string into a frontmatter key name.
 * @param {string} prefName
 * @param {string} defaultKey
 * @returns {string}
 */
function getFrontmatterFieldKeyFromMentionPreference(prefName: string, defaultKey: string): string {
  return checkString(DataStore.preference(prefName) || '').replace(/^[@#]/, '') || defaultKey
}

/**
 * Map date mention names (e.g. '@reviewed') to separate frontmatter keys (e.g. 'reviewed'), taking account that user may localise the mention strings.
 * @returns {{ [string]: string }}
 */
function getDateMentionNameToFrontmatterKeyMap(): { [string]: string } {
  const map: { [string]: string } = {}
  map[checkString(DataStore.preference('startMentionStr') || '@start')] = getFrontmatterFieldKeyFromMentionPreference('startMentionStr', 'start')
  map[checkString(DataStore.preference('dueMentionStr') || '@due')] = getFrontmatterFieldKeyFromMentionPreference('dueMentionStr', 'due')
  map[checkString(DataStore.preference('reviewedMentionStr') || '@reviewed')] = getFrontmatterFieldKeyFromMentionPreference('reviewedMentionStr', 'reviewed')
  map[checkString(DataStore.preference('completedMentionStr') || '@completed')] = getFrontmatterFieldKeyFromMentionPreference('completedMentionStr', 'completed')
  map[checkString(DataStore.preference('cancelledMentionStr') || '@cancelled')] = getFrontmatterFieldKeyFromMentionPreference('cancelledMentionStr', 'cancelled')
  map[checkString(DataStore.preference('nextReviewMentionStr') || '@nextReview')] = getFrontmatterFieldKeyFromMentionPreference('nextReviewMentionStr', 'nextReview')
  map[checkString(DataStore.preference('reviewIntervalMentionStr') || '@review')] = getFrontmatterFieldKeyFromMentionPreference('reviewIntervalMentionStr', 'review')
  return map
}

/**
 * Normalize hashtag tokens for display/storage.
 * Removes trailing punctuation like commas, but not '/' or '-' which can be part of a hashtag.
 * @param {string} hashtag
 * @returns {string}
 */
function normalizeHashtagForDisplay(hashtag: string): string {
  return checkString(hashtag).trim().replace(/[,:;.!?]+$/g, '')
}

/**
 * Extract only hashtags from a string, normalize, and de-duplicate (preserving first-seen order).
 * Invariant: combined frontmatter key values must contain ONLY hashtags.
 * @param {string} text
 * @returns {string}
 */
function extractTagsOnly(text: string): string {
  const seen = new Set < string > ()
  const ordered: Array<string> = []
  const candidates = text != null ? text.match(/#[^\s]+/g) ?? [] : []
  for (const rawTag of candidates) {
    const normalized = normalizeHashtagForDisplay(rawTag)
    if (!normalized || !normalized.startsWith('#') || normalized.length <= 1) continue
    if (!seen.has(normalized)) {
      seen.add(normalized)
      ordered.push(normalized)
    }
  }
  return ordered.join(' ')
}

/**
 * Populate separate frontmatter keys from embedded mentions inside the combined metadata value.
 * This prevents losing embedded `@start(...)`, `@due(...)`, `@review(...)`, etc. when the combined key
 * is rewritten tags-only.
 * @param {string} combinedValueOnly - value-only part of the combined key (no `project:` prefix)
 * @param {{ [string]: any }} fmAttrs - attributes bag to update
 * @param {Array<string>} keysToRemove - keys to remove if the embedded mention param is empty/invalid
 * @returns {void}
 */
function populateSeparateDateKeysFromCombinedValue(
  combinedValueOnly: string,
  fmAttrs: { [string]: any },
  keysToRemove: Array<string>,
): void {
  const mentionToFrontmatterKeyMap = getDateMentionNameToFrontmatterKeyMap()
  const intervalMentionName = checkString(DataStore.preference('reviewIntervalMentionStr') || '@review')

  const reISODate = new RegExp(`^${RE_ISO_DATE}$`)
  const reInterval = /^[+\-]?\d+[BbDdWwMmQqYy]$/

  const embeddedMentions = combinedValueOnly != null ? combinedValueOnly.match(/@[\w\-\.]+\([^)]*\)/g) ?? [] : []

  for (const embeddedMention of embeddedMentions) {
    const mentionName = embeddedMention.split('(', 1)[0]
    const frontmatterKeyName = mentionToFrontmatterKeyMap[mentionName]
    if (!frontmatterKeyName) continue

    const mentionParamMatch = embeddedMention.match(/\(([^)]*)\)\s*$/)
    const mentionParam = mentionParamMatch && mentionParamMatch[1] != null ? mentionParamMatch[1].trim() : ''
    if (mentionParam === '') {
      keysToRemove.push(frontmatterKeyName)
      continue
    }

    if (mentionName === intervalMentionName) {
      if (reInterval.test(mentionParam)) fmAttrs[frontmatterKeyName] = mentionParam
      else keysToRemove.push(frontmatterKeyName)
    } else {
      if (reISODate.test(mentionParam)) fmAttrs[frontmatterKeyName] = mentionParam
      else keysToRemove.push(frontmatterKeyName)
    }
  }
}

/**
 * Resolve a note-like object into a CoreNoteFields for frontmatter removals.
 * @param {CoreNoteFields | TEditor} noteLike
 * @returns {CoreNoteFields}
 */
function getNoteFromNoteLike(noteLike: CoreNoteFields | TEditor): CoreNoteFields {
  // Note: TEditor in tests includes a `.note`, but we treat it generically here.
  const maybeAny: any = (noteLike: any)
  if (maybeAny.note != null) return maybeAny.note
  return (noteLike: any)
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

    // Frontmatter metadata preferences
    // Allow any frontmatter key name, defaulting to 'project'
    const rawSingleMetadataKeyName: string =
      config.projectMetadataFrontmatterKey && typeof config.projectMetadataFrontmatterKey === 'string'
        ? config.projectMetadataFrontmatterKey.trim()
        : ''
    const singleMetadataKeyName: string = rawSingleMetadataKeyName !== '' ? rawSingleMetadataKeyName : 'project'
    config.projectMetadataFrontmatterKey = singleMetadataKeyName
    DataStore.setPreference('projectMetadataFrontmatterKey', singleMetadataKeyName)
    config.writeDateMentionsInCombinedMetadata = checkBoolean(config.writeDateMentionsInCombinedMetadata ?? false)
    DataStore.setPreference('writeDateMentionsInCombinedMetadata', config.writeDateMentionsInCombinedMetadata)

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
      config.perspectiveName = currentPerspective.name
      logInfo('getReviewSettings', `Will use Perspective '${config.perspectiveName}', and its folder & teamspace settings`)
      config.foldersToInclude = stringListOrArrayToArray(currentPerspective.dashboardSettings?.includedFolders ?? '', ',')
      // logDebug('getReviewSettings', `- foldersToInclude: [${String(config.foldersToInclude)}]`)
      config.foldersToIgnore = stringListOrArrayToArray(currentPerspective.dashboardSettings?.excludedFolders ?? '', ',')
      // logDebug('getReviewSettings', `- foldersToIgnore: [${String(config.foldersToIgnore)}]`)
      config.includedTeamspaces = currentPerspective.dashboardSettings?.includedTeamspaces ?? ['private']
      // logDebug('getReviewSettings', `- includedTeamspaces: [${String(config.includedTeamspaces)}]`)

      const validFolders = getAllowedFoldersInCurrentPerspective(perspectiveSettings)
      logDebug('getReviewSettings', `-> validFolders for '${config.perspectiveName}': [${String(validFolders)}]`)
    }

    // Ensure displayPaused has a sensible default if missing from settings
    if (config.displayPaused == null) {
      config.displayPaused = true
    }

    // Ensure autoUpdateAfterIdleTime has a sensible default if missing from settings
    if (config.autoUpdateAfterIdleTime == null) {
      config.autoUpdateAfterIdleTime = 0
    }

    // Ensure reviewsTheme has a default if missing (e.g. before 'Theme to use for Project Lists' setting existed)
    if (config.reviewsTheme == null || config.reviewsTheme === undefined) {
      config.reviewsTheme = ''
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
  const combinedKey = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
  const projectAttribute = getFrontmatterAttribute(note, combinedKey) ?? ''
  if (projectAttribute.includes(sequentialTag)) {
    logDebug('isProjectNoteIsMarkedSequential', `found sequential tag '${sequentialTag}' in frontmatter '${combinedKey}' attribute`)
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
 * NOTE: Ideally make a version of this that only checks metadata and doesn't create a new line if it doesn't exist.
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
    const singleMetadataKeyName: string = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
    const scanInFrontmatter = noteHasFrontMatter(note)
    const endFMIndex = scanInFrontmatter ? (endOfFrontmatterLineIndex(note) ?? -1) : -1

    // Invariant mode: when frontmatter exists, only treat the configured combined key line as the metadata line.
    const combinedFrontmatterLineRE = new RegExp(`^${singleMetadataKeyName}:\\s*`, 'i')
    const bodyMetadataLineRE = /^(project|metadata):/i
    for (let i = 1; i < lines.length; i++) {
      if (scanInFrontmatter) {
        if (i <= endFMIndex && lines[i].match(combinedFrontmatterLineRE)) {
          lineNumber = i
          break
        }
      } else {
        if (
          lines[i].match(bodyMetadataLineRE) ||
          lines[i].match(/(@review|@reviewed)\(.+\)/) ||
          lines[i].match(/^#\S/)
        ) {
        lineNumber = i
        break
      }
      }
    }

    // If no metadataPara found, then insert one either after title, or in the frontmatter if present.
    if (Number.isNaN(lineNumber)) {
      if (noteHasFrontMatter(note)) {
        logWarn('getOrMakeMetadataLineIndex', `I couldn't find an existing metadata line, so have added a placeholder at the top of the note. Please review it.`)
        const fmAttrs: { [string]: any } = {}
        // Invariant: combined key must be tags-only (project tags). Dates/intervals live in their own keys.
        fmAttrs[singleMetadataKeyName] = extractTagsOnly(metadataLinePlaceholder)
        // $FlowFixMe[incompatible-call]
        const res = updateFrontMatterVars(note, fmAttrs)
        const updatedLines = note.paragraphs?.map((s) => s.content) ?? []
        // Find which line that project field is on
        for (let i = 1; i < updatedLines.length; i++) {
          const re = new RegExp(`^${singleMetadataKeyName}:`, 'i')
          if (updatedLines[i].match(re)) {
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

//------------------------------
// Migration message when body metadata has been moved to frontmatter

export const PROJECT_METADATA_MIGRATED_MESSAGE = '_Project metadata has been migrated to frontmatter._'

/**
 * Find the first body line that looks like project metadata, and return its index and content.
 * Metadata-style lines are defined as lines that:
 * - start with 'project:', 'metadata:', 'review:', or 'reviewed:'
 * - or contain an '@review(...)' / '@reviewed(...)' mention
 * - or start with a hashtag.
 * @param {Array<TParagraph>} paras - all paragraphs in the note/editor
 * @param {number} startIndex - index to start scanning from (usually after frontmatter)
 * @returns {?{ index: number, content: string }} first matching line info, or null if none found
 */
function findFirstMetadataBodyLine(paras: Array<TParagraph>, startIndex: number): ?{ index: number, content: string } {
  for (let i = startIndex; i < paras.length; i++) {
    const p = paras[i]
    const content = p.content ?? ''
    const isMetadataStyleLine =
      content.match(/^(project|metadata|review|reviewed):/i) != null ||
      content.match(/(@review|@reviewed)\(.+\)/) != null ||
      content.match(/^#\S/) != null

    if (isMetadataStyleLine) {
      return { index: i, content }
    }
  }
  return null
}

/**
 * If project metadata is now stored in frontmatter, then:
 * - replace any existing project metadata line in the body with a short migration message, or
 * - remove that migration message if it already exists.
 * NOTE: This helper does not save/update the Editor; callers must handle persistence.
 * @author @jgclark
 * @param {TEditor} thisEditor - the Editor window to update
 */
export function migrateProjectMetadataLineInEditor(thisEditor: TEditor): void {
  try {
    // Bail if this isn't a valid project note (Notes type, at least 2 paragraphs).
    if (thisEditor.note == null || thisEditor.note.type === 'Calendar' || thisEditor.paragraphs.length < 2) {
      logWarn('migrateProjectMetadataLineInEditor', `- We're not in a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }
    const noteForFM = thisEditor.note
    logDebug('migrateProjectMetadataLineInEditor', `Starting for '${displayTitle(noteForFM)}'`)

    // Check that project metadata is actually stored in frontmatter (configurable key or 'metadata').
    const singleMetadataKeyName = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
    const metadataAttr = getFrontmatterAttribute(noteForFM, singleMetadataKeyName)
    const metadataStrSavedFromBodyOfNote = typeof metadataAttr === 'string' ? metadataAttr.trim() : ''

    // Scan the body only (after the closing ---). Find either the migration message or the first metadata-style line.
    const paras = thisEditor.paragraphs
    // const initialLineCount: number = paras.length
    const endFMIndex = endOfFrontmatterLineIndex(noteForFM) ?? -1

    // First pass: handle migration message line (if present)
    for (let i = endFMIndex + 1; i < paras.length; i++) {
      const p = paras[i]
      const content = p.content ?? ''

      // If we already left the migration message on a previous run, clear that line and we're done.
      if (content === PROJECT_METADATA_MIGRATED_MESSAGE) {
        logDebug('migrateProjectMetadataLineInEditor', `- Found existing migration message at line ${String(i)}; removing.`)
        // v1: not working, and I can't see why
        // thisEditor.removeParagraph(p)
        // v2: also not working
        // thisEditor.removeParagraphAtIndex(p.lineIndex)
        // if (Editor.paragraphs.length === initialLineCount) {
        //   logWarn('migrateProjectMetadataLineInEditor', `- Line count didn't change from ${String(initialLineCount)} after removing migration message. This shouldn't happen.`)
        // }
        // v3: just clear the message instead TEST:
        p.content = ''
        thisEditor.updateParagraph(p)
        return
      }
    }

    // Second pass: find the first metadata-style line in the body (if any).
    const metadataInfo = findFirstMetadataBodyLine(paras, endFMIndex + 1)

    // If we found an old metadata line in the body, first merge its contents into frontmatter (to avoid dropping mentions),
    // then replace it with the migration message.
    if (metadataInfo != null) {
      // Decide which frontmatter key we are using (always use the configured combined-metadata key here)
      const existingFMValue = metadataStrSavedFromBodyOfNote

      // Strip any leading "project:" / "metadata:" / "review:" / "reviewed:" prefix from the body line
      const bodyValue = metadataInfo.content.replace(/^(project|metadata|review|reviewed)\s*:\s*/i, '').trim()

      if (bodyValue !== '') {
        const fmAttrs: { [string]: any } = {}

        // Invariant: combined key must contain ONLY hashtags.
        fmAttrs[singleMetadataKeyName] = extractTagsOnly(`${existingFMValue !== '' ? `${existingFMValue} ` : ''}${bodyValue}`)

        // Parse date/interval mention tokens from the body line into separate frontmatter keys.
        const mentionTokens = (`${bodyValue} `)
          .split(' ')
          .filter((f) => f[0] === '@')
          .map((t) => t.replace(/[,:;.!?]+$/g, ''))

        const reISODate = new RegExp(`^${RE_ISO_DATE}$`)
        const reInterval = /^[+\-]?\d+[BbDdWwMmQqYy]$/

        const readBracketContent = (mentionTokenStr: string): string => {
          const match = mentionTokenStr.match(/\(([^)]*)\)$/)
          return match && match[1] != null ? match[1].trim() : ''
        }

        // Dates (including nextReview) are ISO dates.
        const dateMentionToFrontmatterKeyMap = getDateMentionNameToFrontmatterKeyMap()
        for (const mentionName of Object.keys(dateMentionToFrontmatterKeyMap)) {
          const frontmatterKeyName = dateMentionToFrontmatterKeyMap[mentionName]
          const mentionTokenStr = getParamMentionFromList(mentionTokens, mentionName)
          if (!mentionTokenStr) continue
          const bracketContent = readBracketContent(mentionTokenStr)
          if (bracketContent !== '' && reISODate.test(bracketContent)) {
            fmAttrs[frontmatterKeyName] = bracketContent
          }
        }

        // Review interval: separate key, interval string (e.g. '1w')
        const reviewIntervalMentionName = checkString(DataStore.preference('reviewIntervalMentionStr'))
        const reviewIntervalTokenStr = reviewIntervalMentionName ? getParamMentionFromList(mentionTokens, reviewIntervalMentionName) : ''
        const intervalBracketContent = reviewIntervalTokenStr ? readBracketContent(reviewIntervalTokenStr) : ''
        const reviewIntervalKey = checkString(DataStore.preference('reviewIntervalMentionStr') || '').replace(/^[@#]/, '') || 'review'
        if (intervalBracketContent !== '' && reInterval.test(intervalBracketContent)) {
          fmAttrs[reviewIntervalKey] = intervalBracketContent
        }

        // $FlowFixMe[incompatible-call]
        const mergedOK = updateFrontMatterVars(noteForFM, fmAttrs)
        if (!mergedOK) {
          logError(
            'migrateProjectMetadataLineInEditor',
            `Failed to merge body metadata line into frontmatter key '${singleMetadataKeyName}' for '${displayTitle(noteForFM)}'`,
          )
        } else {
          logDebug(
            'migrateProjectMetadataLineInEditor',
            `- Merged body metadata into frontmatter key '${singleMetadataKeyName}' for '${displayTitle(noteForFM)}'`,
          )
        }
      }

      const metadataPara = paras[metadataInfo.index]
      logDebug('migrateProjectMetadataLineInEditor', `- Replacing body metadata line at ${String(metadataInfo.index)} with migration message.`)
      metadataPara.content = PROJECT_METADATA_MIGRATED_MESSAGE
      thisEditor.updateParagraph(metadataPara)
    }
  } catch (error) {
    logError('migrateProjectMetadataLineInEditor', error.message)
  }
}

/**
/**
 * Migrates any old-style single-line project metadata remaining in the note body into the appropriate frontmatter key, and, if migrated,
 * replaces that body metadata line with a short migration message. 
 * If the migration message already exists, it is removed.
 * NOTE: This helper does not update the cache.
 * @author @jgclark
 * @param {CoreNoteFields} noteToUse - the note to update
 */
export function migrateProjectMetadataLineInNote(noteToUse: CoreNoteFields): void {
  try {
    // Bail if this isn't a valid project note (Notes type, at least 2 paragraphs).
    if (noteToUse == null || noteToUse.type === 'Calendar' || noteToUse.paragraphs.length < 2) {
      logWarn('migrateProjectMetadataLineInNote', `- We've not been passed a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }
    logDebug('migrateProjectMetadataLineInNote', `Starting for '${displayTitle(noteToUse)}'`)

    // Ensure we have a frontmatter section to write to. TEST: Is this needed?
    if (!noteHasFrontMatter(noteToUse)) {
      ensureFrontmatter(noteToUse)
    }

    // Check that project metadata is actually stored in frontmatter (configurable key or 'metadata').
    const singleMetadataKeyName = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
    const metadataAttr = getFrontmatterAttribute((noteToUse: any), singleMetadataKeyName)
    const metadataStrSavedFromBodyOfNote = typeof metadataAttr === 'string' ? metadataAttr.trim() : ''

    // Scan the body only (after the closing ---). Find either the migration message or the first metadata-style line.
    const paras = noteToUse.paragraphs
    const endFMIndex = endOfFrontmatterLineIndex(noteToUse) ?? -1

    // First pass: handle migration message line (if present)
    for (let i = endFMIndex + 1; i < paras.length; i++) {
      const p = paras[i]
      const content = p.content ?? ''

      // If we already left the migration message on a previous run, clear that line and we're done.
      if (content === PROJECT_METADATA_MIGRATED_MESSAGE) {
        logDebug('migrateProjectMetadataLineInNote', `- Found existing migration message at line ${String(i)}; clearing its content.`)
        p.content = ''
        noteToUse.updateParagraph(p)
        return
      }
    }

    // Second pass: find the first metadata-style line in the body (if any).
    const metadataInfo = findFirstMetadataBodyLine(paras, endFMIndex + 1)

    // If we found an old metadata line in the body, first merge its contents into frontmatter (to avoid dropping mentions),
    // then replace it with the migration message.
    if (metadataInfo != null) {
      // Decide which frontmatter key we are using
      const primaryKey = singleMetadataKeyName ?? 'metadata'
      const existingFMValue = metadataStrSavedFromBodyOfNote

      // Strip any leading "project:" / "metadata:" / "review:" / "reviewed:" prefix from the body line
      const bodyValue = metadataInfo.content.replace(/^(project|metadata|review|reviewed)\s*:\s*/i, '').trim()

      if (bodyValue !== '') {
        logDebug('migrateProjectMetadataLineInNote', `- Merging body metadata into frontmatter key '${primaryKey}' with bodyValue '${bodyValue}'`)
        const fmAttrs: { [string]: any } = {}

        // Invariant: combined key must contain ONLY hashtags.
        fmAttrs[primaryKey] = extractTagsOnly(`${existingFMValue !== '' ? `${existingFMValue} ` : ''}${bodyValue}`)

        // Parse date/interval mention tokens from the body metadata line into separate frontmatter keys.
        const mentionTokens = (`${bodyValue} `)
          .split(' ')
          .filter((f) => f[0] === '@')
          .map((t) => t.replace(/[,:;.!?]+$/g, ''))

        const reISODate = new RegExp(`^${RE_ISO_DATE}$`)
        const reInterval = /^[+\-]?\d+[BbDdWwMmQqYy]$/

        const readBracketContent = (mentionTokenStr: string): string => {
          const match = mentionTokenStr.match(/\(([^)]*)\)$/)
          return match && match[1] != null ? match[1].trim() : ''
        }

        const dateMentionToFrontmatterKeyMap = getDateMentionNameToFrontmatterKeyMap()
        for (const mentionName of Object.keys(dateMentionToFrontmatterKeyMap)) {
          const frontmatterKeyName = dateMentionToFrontmatterKeyMap[mentionName]
          const mentionTokenStr = getParamMentionFromList(mentionTokens, mentionName)
          if (!mentionTokenStr) continue
          const bracketContent = readBracketContent(mentionTokenStr)
          if (bracketContent !== '' && reISODate.test(bracketContent)) {
            fmAttrs[frontmatterKeyName] = bracketContent
          }
        }

        const reviewIntervalMentionName = checkString(DataStore.preference('reviewIntervalMentionStr'))
        const reviewIntervalTokenStr = reviewIntervalMentionName ? getParamMentionFromList(mentionTokens, reviewIntervalMentionName) : ''
        const intervalBracketContent = reviewIntervalTokenStr ? readBracketContent(reviewIntervalTokenStr) : ''
        const reviewIntervalKey = checkString(DataStore.preference('reviewIntervalMentionStr') || '').replace(/^[@#]/, '') || 'review'
        if (intervalBracketContent !== '' && reInterval.test(intervalBracketContent)) {
          fmAttrs[reviewIntervalKey] = intervalBracketContent
        }

        // $FlowFixMe[incompatible-call]
        const mergedOK = updateFrontMatterVars((noteToUse: any), fmAttrs)
        if (!mergedOK) {
          logError('migrateProjectMetadataLineInNote',`Failed to merge body metadata line into frontmatter key '${primaryKey}' for '${displayTitle(noteToUse)}'`,)
        } else {
          logDebug('migrateProjectMetadataLineInNote',`- Merged body metadata into frontmatter key '${primaryKey}' for '${displayTitle(noteToUse)}'`,)
        }
      }

      const metadataPara = paras[metadataInfo.index]
      logDebug('migrateProjectMetadataLineInNote', `- Replacing body metadata line at ${String(metadataInfo.index)} with migration message.`)
      metadataPara.content = PROJECT_METADATA_MIGRATED_MESSAGE
      noteToUse.updateParagraph(metadataPara)
    }
  } catch (error) {
    logError('migrateProjectMetadataLineInNote', error.message)
  }
}

//-------------------------------------------------------------------------------
// Other helpers (metadata mutation + delete)

/**
 * Core helper to update project metadata @mentions in a metadata line.
 * Shared by updateMetadataInEditor and updateMetadataInNote.
 * @param {CoreNoteFields | TEditor} noteLike - the note/editor to update
 * @param {number} metadataLineIndex - index of the metadata line to use
 * @param {Array<string>} updatedMetadataArr - full @mention strings to apply (e.g. '@reviewed(2023-06-23)')
 * @param {string} logContext - name to use in log messages
 */
function updateMetadataCore(
  noteLike: CoreNoteFields | TEditor,
  metadataLineIndex: number,
  updatedMetadataArr: Array<string>,
  logContext: string,
): void {
  const metadataPara = noteLike.paragraphs[metadataLineIndex]
  if (!metadataPara) {
    throw new Error(`Couldn't get metadata line ${metadataLineIndex} from ${displayTitle(noteLike)}`)
  }

  const origLine: string = metadataPara.content
  let updatedLine = origLine

  const endFMIndex = endOfFrontmatterLineIndex(noteLike) ?? -1
  const singleMetadataKeyName = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
  const frontmatterPrefixRe = new RegExp(`^${singleMetadataKeyName}:\\s*`, 'i')
  const isFrontmatterLine = metadataLineIndex <= endFMIndex

  logDebug(
    logContext,
    `starting for '${displayTitle(noteLike)}' for new metadata ${String(updatedMetadataArr)} with metadataLineIndex ${metadataLineIndex} ('${origLine}')`,
  )

  if (isFrontmatterLine) {
    let valueOnly = origLine.replace(frontmatterPrefixRe, '')
    const dateMentionToFrontmatterKeyMap = getDateMentionNameToFrontmatterKeyMap()
    const fmAttrs: { [string]: any } = {}
    const keysToRemove: Array<string> = []

    // Move any embedded date/interval mentions from the combined key into their separate keys.
    // This ensures they aren't lost when we rewrite the combined key tags-only.
    populateSeparateDateKeysFromCombinedValue(valueOnly, fmAttrs, keysToRemove)

    for (const item of updatedMetadataArr) {
      const mentionName = item.split('(', 1)[0]
      const mentionParamMatch = item.match(/\(([^)]*)\)$/)
      const mentionParam = mentionParamMatch && mentionParamMatch[1] != null ? mentionParamMatch[1].trim() : ''
      const RE_THIS_MENTION_ALL = new RegExp(`${mentionName}\\([\\w\\-\\.]+\\)`, 'gi')
      valueOnly = valueOnly.replace(RE_THIS_MENTION_ALL, '')
      const separateDateKey = dateMentionToFrontmatterKeyMap[mentionName]
      if (separateDateKey) {
        if (mentionParam !== '') {
          fmAttrs[separateDateKey] = mentionParam
        } else {
          keysToRemove.push(separateDateKey)
        }
      } else {
        valueOnly += ` ${item}`
      }
    }
    fmAttrs[singleMetadataKeyName] = extractTagsOnly(valueOnly)
    // $FlowFixMe[incompatible-call]
    const success = updateFrontMatterVars(noteLike, fmAttrs)
    if (!success) {
      logError(logContext, `Failed to update frontmatter ${singleMetadataKeyName} for '${displayTitle(noteLike)}'`)
    } else {
      const noteForRemoval = getNoteFromNoteLike(noteLike)
      for (const keyToRemove of keysToRemove) {
        removeFrontMatterField(noteForRemoval, keyToRemove)
      }
      logDebug(logContext, `- After update frontmatter ${singleMetadataKeyName}='${fmAttrs[singleMetadataKeyName]}'`)
    }
  } else {
    for (const item of updatedMetadataArr) {
      const mentionName = item.split('(', 1)[0]
      const RE_THIS_MENTION_ALL = new RegExp(`${mentionName}\\([\\w\\-\\.]+\\)`, 'gi')
      updatedLine = updatedLine.replace(RE_THIS_MENTION_ALL, '')
      updatedLine += ` ${item}`
    }
    metadataPara.content = updatedLine.replace(/\s{2,}/g, ' ').trimRight()
    noteLike.updateParagraph(metadataPara)
    logDebug(logContext, `- After update ${metadataPara.content}`)
  }
}

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

    const metadataLineIndex: number = getOrMakeMetadataLineIndex(thisEditor)
    updateMetadataCore(thisEditor, metadataLineIndex, updatedMetadataArr, 'updateMetadataInEditor')
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
    updateMetadataCore(note, metadataLineIndex, updatedMetadataArr, 'updateMetadataInNote')
  } catch (error) {
    logError('updateMetadataInNote', `${error.message}`)
  }
}


/**
 * Internal helper to delete specific metadata mentions from a metadata line in a note-like object.
 * Shared by deleteMetadataMentionInEditor and deleteMetadataMentionInNote.
 * @param {CoreNoteFields | TEditor} noteLike - the note or editor to update
 * @param {number} metadataLineIndex - index of the metadata line to use
 * @param {Array<string>} mentionsToDeleteArr - mentions to delete (just the @mention name, not any bracketed date)
 * @param {string} logContext - name to use in log messages
 */
function deleteMetadataMentionCore(
  noteLike: CoreNoteFields | TEditor,
  metadataLineIndex: number,
  mentionsToDeleteArr: Array<string>,
  logContext: string,
): void {
  const metadataPara = noteLike.paragraphs[metadataLineIndex]
  if (!metadataPara) {
    throw new Error(`Couldn't get metadata line ${metadataLineIndex} from ${displayTitle(noteLike)}`)
  }
  const origLine: string = metadataPara.content
  let newLine = origLine

  const endOfFrontmatterIndex = endOfFrontmatterLineIndex(noteLike) ?? -1
  const singleMetadataKeyName = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
  const frontmatterPrefixRe = new RegExp(`^${singleMetadataKeyName}:\\s*`, 'i')
  const isFrontmatterLine = metadataLineIndex <= endOfFrontmatterIndex

  logDebug(logContext, `starting for '${displayTitle(noteLike)}' with metadataLineIndex ${metadataLineIndex} to remove [${String(mentionsToDeleteArr)}]`)

  if (isFrontmatterLine) {
    let valueOnly = origLine.replace(frontmatterPrefixRe, '')
    const dateMentionToFrontmatterKeyMap = getDateMentionNameToFrontmatterKeyMap()
    const fmAttrs: { [string]: any } = {}
    const keysToRemove: Array<string> = []

    // Move any embedded date/interval mentions from the combined key into their separate keys
    // before rewriting the combined key tags-only.
    populateSeparateDateKeysFromCombinedValue(valueOnly, fmAttrs, keysToRemove)

    for (const mentionName of mentionsToDeleteArr) {
      const RE_THIS_MENTION_ALL = new RegExp(`${mentionName}(\\([\\d\\-\\.]+\\))?`, 'gi')
      valueOnly = valueOnly.replace(RE_THIS_MENTION_ALL, '')
      const separateDateKey = dateMentionToFrontmatterKeyMap[mentionName]
      if (separateDateKey) {
        keysToRemove.push(separateDateKey)
      }
      logDebug(logContext, `-> ${valueOnly}`)
    }
    fmAttrs[singleMetadataKeyName] = extractTagsOnly(valueOnly)
    // $FlowFixMe[incompatible-call]
    const success = updateFrontMatterVars(noteLike, fmAttrs)
    if (!success) {
      logError(logContext, `Failed to update frontmatter ${singleMetadataKeyName} for '${displayTitle(noteLike)}'`)
    } else {
      const noteForRemoval = getNoteFromNoteLike(noteLike)
      for (const keyToRemove of keysToRemove) {
        removeFrontMatterField(noteForRemoval, keyToRemove)
      }
      logDebug(logContext, `- Finished frontmatter ${singleMetadataKeyName}='${fmAttrs[singleMetadataKeyName]}'`)
    }
  } else {
    for (const mentionName of mentionsToDeleteArr) {
      const RE_THIS_MENTION_ALL = new RegExp(`${mentionName}(\\([\\d\\-\\.]+\\))?`, 'gi')
      newLine = newLine.replace(RE_THIS_MENTION_ALL, '')
      logDebug(logContext, `-> ${newLine}`)
    }
    metadataPara.content = newLine.replace(/\s{2,}/g, ' ').trimRight()
    noteLike.updateParagraph(metadataPara)
    logDebug(logContext, `- Finished`)
  }
}

/**
 * Delete specific metadata @mentions (e.g. @reviewed(date)) from the metadata line of the note in the Editor
 * @author @jgclark
 * @param {TEditor} thisEditor - the Editor window to update
 * @param {number} metadataLineIndex - index of the metadata line to use
 * @param {Array<string>} mentions to update (just the @mention name, not and bracketed date)
 * @returns { ?TNote } current note
 */
export function deleteMetadataMentionInEditor(thisEditor: TEditor, metadataLineIndex: number, mentionsToDeleteArr: Array<string>): void {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (thisEditor.note == null || thisEditor.note.type === 'Calendar' || thisEditor.note.paragraphs.length < 2) {
      logWarn('deleteMetadataMentionInEditor', `- We're not in a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }
    deleteMetadataMentionCore(thisEditor, metadataLineIndex, mentionsToDeleteArr, 'deleteMetadataMentionInEditor')
  } catch (error) {
    logError('deleteMetadataMentionInEditor', `${error.message}`)
  }
}

/**
 * Update project metadata @mentions (e.g. @reviewed(date)) in the note in the Editor
 * @author @jgclark
 * @param {TNote} noteToUse
 * @param {number} metadataLineIndex - index of the metadata line to use
 * @param {Array<string>} mentions to update (just the @mention name, not and bracketed date)
 */
export function deleteMetadataMentionInNote(noteToUse: CoreNoteFields, metadataLineIndex: number, mentionsToDeleteArr: Array<string>): void {
  try {
    // only proceed if we're in a valid Project note (with at least 2 lines)
    if (noteToUse == null || noteToUse.type === 'Calendar' || noteToUse.paragraphs.length < 2) {
      logWarn('deleteMetadataMentionInNote', `- We've not been passed a valid Project note (and with at least 2 lines). Stopping.`)
      return
    }
    deleteMetadataMentionCore(noteToUse, metadataLineIndex, mentionsToDeleteArr, 'deleteMetadataMentionInNote')
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
    return `<i class="${faClasses}" style="color: ${colorStr}"></i>`
  } else {
    return `<i class="${faClasses}"></i>`
  }
}
