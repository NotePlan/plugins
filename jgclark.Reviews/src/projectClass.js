// @flow
//-----------------------------------------------------------------------------
// Project class definition for Review plugin
// by Jonathan Clark
// Last updated 2026-04-19 for v2.0.0.b21, @jgclark
//-----------------------------------------------------------------------------

// Import Helper functions
import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  calcNextReviewDate,
  getMetadataLineIndexFromBody,
  getProjectMetadataLineIndex,
  getParamMentionFromList,
  getReviewSettings,
  migrateProjectMetadataLineInEditor,
  migrateProjectMetadataLineInNote,
  processMostRecentProgressParagraph,
} from './reviewHelpers'
import { checkBoolean, checkNumber, checkString } from '@helpers/checkType'
import {
  daysBetween,
  RE_DATE,
  RE_DATE_INTERVAL,
  includesScheduledFurtherFutureDate,
  todaysDateISOString,
  toISODateString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getFolderDisplayName, getFolderFromFilename } from '@helpers/folders'
import { getOpenEditorFromFilename, saveEditorIfNecessary } from '@helpers/NPEditor'
import { getContentFromBrackets, getStringFromList } from '@helpers/general'
import { endOfFrontmatterLineIndex, getFrontmatterAttribute, getFrontmatterParagraphs, removeFrontMatterField, updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { removeAllDueDates } from '@helpers/NPParagraph'
import { usersVersionHas } from '@helpers/NPVersions'
import { createSectionsAndParaAfterPreamble, endOfPreambleSection, findHeading, getFieldParagraphsFromNote, simplifyRawContent } from '@helpers/paragraph'
import { getHashtagsFromString } from '@helpers/stringTransforms'
import {
  getInputTrimmed,
  inputIntegerBounded,
  isInt,
} from '@helpers/userInput'
import { isClosedTask, isClosed, isOpen, isOpenTask } from '@helpers/utils'

//-----------------------------------------------------------------------------
// Constants

const DEFAULT_REVIEW_INTERVAL = '1w'

//-----------------------------------------------------------------------------
// Types

export type Progress = {
  lineIndex: number,
  percentComplete: number,
  date: Date,
  comment: string
}

type FrontmatterFieldRead = {
  exists: boolean,
  value: ?string,
}

//-----------------------------------------------------------------------------
// Helpers

/**
 * Milliseconds since epoch for a note's `changedDate` (Date or number in some contexts).
 * @param {TNote} note
 * @returns {?number}
 */
export function getNoteChangedDateMs(note: TNote): ?number {
  const cd = note.changedDate
  if (cd == null) {
    return null
  }
  if (cd instanceof Date) {
    return cd.getTime()
  }
  // $FlowFixMe[prop-missing] runtime may expose numeric timestamps
  if (typeof cd === 'number') {
    return cd
  }
  return null
}

/**
 * Modification time for comparing against `allProjectsList` cache rows.
 * Returns null when `checkEditor` is true and this note is the focused editor note (unsaved edits must not use the fast path).
 * @param {TNote} note
 * @param {boolean} checkEditor
 * @returns {?number}
 */
export function getNoteChangeTimeMsForCache(note: TNote, checkEditor: boolean): ?number {
  if (checkEditor && typeof Editor !== 'undefined' && Editor && Editor.note && Editor.note.filename === note.filename) {
    return null
  }
  return getNoteChangedDateMs(note)
}

/**
 * Extract ISO date string (YYYY-MM-DD) from a mention string (e.g. @start(2022-03-31)).
 * @param {string} mentionStr - Full mention string
 * @returns {?string} YYYY-MM-DD or undefined if no valid match
 * @private
 */
function getISODateStringFromMention(mentionStr: string): ?string {
  const RE_DATE_CAPTURE = new RegExp(`(${RE_DATE})`)
  const match = mentionStr.match(RE_DATE_CAPTURE)
  return match && match[1] ? match[1] : undefined
}

/**
 * Parse a frontmatter value that may be plain content (e.g. '1w' / '2026-03-26')
 * or a wrapped mention value (e.g. '@review(1w)' / '@due(2026-03-26)'),
 * or a quoted value (e.g. '"1w"' / '"2026-03-26"'),
 * or empty ('').
 * Returns value trimmed and unquoted, and may be empty.
 * @param {string} rawValue
 * @returns {string}
 * @private
 */
export function parseProjectFrontmatterValue(rawValue: string): string {
  let trimmed = rawValue.trim()

  // Remove double quotes that might surround the value
  trimmed = trimmed.replace(/^"|"$/g, '')

  // Remove any mention brackets and return the content
  const mentionMatch = trimmed.match(/^@([A-Za-z0-9_-]+)\((.*)\)$/)
  if (!mentionMatch) {
    return trimmed
  }

  const mentionParam = mentionMatch[2] != null ? mentionMatch[2].trim() : ''
  return mentionParam
}

/**
 * Read a frontmatter key directly from raw frontmatter lines.
 * This distinguishes between:
 * - key missing
 * - key present but empty/invalid
 * @param {CoreNoteFields} note
 * @param {string} fieldName
 * @returns {FrontmatterFieldRead}
 * @private
 */
export function readRawFrontmatterField(note: CoreNoteFields, fieldName: string): FrontmatterFieldRead {
  const fmParas = getFrontmatterParagraphs(note, false)
  if (!fmParas || fmParas.length === 0) {
    return { exists: false, value: undefined }
  }
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escapedFieldName}:\\s*(.*)$`, 'i')
  for (const para of fmParas) {
    const match = para.content.match(re)
    if (match) {
      return { exists: true, value: match[1] != null ? match[1] : '' }
    }
  }
  return { exists: false, value: undefined }
}

/**
 * Calculate duration string for a date, optionally relative to a start date.
 * If startDate is provided, returns "after X" format. Otherwise returns relative time (e.g., "2 days ago").
 * If duration is less than 1 day then return "today".
 * @param {string|Date} date - The date to calculate duration for (ISO string or Date)
 * @param {?string|Date} startDate - Optional start date for calculating duration between dates
 * @param {boolean} roundShortDurationToToday - Whether to use round to 'today' if duration is measured in hours or less
 * @returns {string} Duration string
 * @private
 */
function formatDurationString(date: string | Date, startDate?: string | Date, roundShortDurationToToday: boolean = false): string {
  if (startDate != null) {
    return `after ${moment(startDate).to(moment(date), true)}`
  } else {
    let duration = moment(date).fromNow()
    if (roundShortDurationToToday && ['seconds', 'minutes', 'hours'].includes(duration)) {
      duration = 'today'
    }
    return duration
  }
}

/**
 * Should date mentions also be written into the combined metadata key?
 * Defaults to false so date values are written as separate frontmatter keys.
 * @returns {boolean}
 */
function shouldWriteDateMentionsInCombinedMetadata(): boolean {
  return checkBoolean(DataStore.preference('writeDateMentionsInCombinedMetadata') ?? false)
}

/** Full-line match for ISO YYYY-MM-DD (same rule as RE_DATE). */
const RE_ISO_DATE_LINE = new RegExp(`^${RE_DATE}$`)

/**
 * Normalize a date value from CommandBar.showForm (string or Date) to YYYY-MM-DD, or today's date if invalid.
 * @param {mixed} value
 * @returns {string}
 * @private
 */
function normalizeProgressDateFromForm(value: mixed): string {
  const today = todaysDateISOString
  if (value == null || value === '') {
    return today
  }
  if (value instanceof Date) {
    const iso = toISODateString(value)
    return iso !== '' && RE_ISO_DATE_LINE.test(iso) ? iso : today
  }
  const s = String(value).trim()
  if (RE_ISO_DATE_LINE.test(s)) {
    return s
  }
  logWarn('Project / normalizeProgressDateFromForm', `Bad date value '${String(value)}', using ${today}`)
  return today
}

/**
 * Interpret CommandBar.showForm() result for add-progress: comment (required), progress date, optional integer %.
 * @param {CommandBarFormResult} formResult
 * @returns {?{ comment: string, progressDateStr: string, percentStr: string }}
 * @private
 */
function parseRawProgressFormValues(formResult: CommandBarFormResult): ?{ comment: string, progressDateStr: string, percentStr: string } {
  try {
    if (formResult == null || typeof formResult !== 'object') {
      throw new Error(`formResult is null or not an object`)
    }
    if (formResult.submitted === false) {
      logWarn('parseRawProgressFormValues', `user didn't submit form: stopping.`)
      return null
    }
    const fieldMap: { [string]: mixed } = formResult.values ?? {}
    const commentRaw = fieldMap.comment
    const comment = typeof commentRaw === 'string' ? commentRaw.trim() : String(commentRaw ?? '').trim()
    if (comment === '') {
      logDebug('parseRawProgressFormValues', `Empty comment; treating as invalid`)
      return null
    }
    const dateRaw = fieldMap.progressDate ?? fieldMap.date
    const progressDateStr = normalizeProgressDateFromForm(dateRaw)
    let percentStr = ''
    const pr = fieldMap.percentComplete ?? fieldMap.percent
    if (pr != null && pr !== '') {
      const ps = String(pr).trim()
      if (ps !== '' && isInt(ps)) {
        const v = parseFloat(ps)
        if (v >= 0 && v <= 100) {
          percentStr = String(v)
        }
      }
    }
    return { comment, progressDateStr, percentStr }
  } catch (error) {
    logError('parseRawProgressFormValues', `Error parsing form result: ${error.message}`)
    return null
  }
}

/**
 * Ask for progress comment, optional % complete, and progress date.
 * Uses CommandBar.showForm when NotePlan supports commandBarForms (v3.21+); otherwise two separate prompts (date = today).
 * @param {string} projectTitle
 * @param {string} prompt - leading phrase before quoted title
 * @param {number} lastPercentComplete - for hint text (may be NaN)
 * @returns {Promise<?{ comment: string, progressDateStr: string, percentStr: string }>}
 * @private
 */
async function promptAddProgressLineInputs(
  projectTitle: string,
  prompt: string,
  lastPercentComplete: number,
): Promise<?{ comment: string, progressDateStr: string, percentStr: string }> {
  const message1 = `${prompt} '${projectTitle}'`
  const lastPercentMessage = !isNaN(lastPercentComplete)
    ? `; last was ${String(lastPercentComplete)}`
    : ``

  // $FlowFixMe[prop-missing] CommandBar.showForm (NP 3.21+) - see flow-typed/Noteplan.js
  const commandBarWithForm: any = CommandBar
  if (usersVersionHas('commandBarForms') && typeof commandBarWithForm.showForm === 'function') {
    try {
      // NotePlan 3.21+: single form with text, date (default today), and optional %.
      // Field shape matches CommandBar.showForm (commandBarForms); adjust if NotePlan's schema differs.
      const raw = await commandBarWithForm.showForm({
        title: `Add Progress for '${projectTitle}'`,
        submitText: 'Add',
        fields: [
          { type: 'string', key: 'comment', title: 'Comment', required: true },
          { type: 'date', key: 'progressDate', title: 'Date', description: 'Date of comment', default: todaysDateISOString, required: false },
          { type: 'number', key: 'percentComplete', title: `Percent Complete (optional %${lastPercentMessage})`, description: `Enter your estimate of project completion (as %${lastPercentMessage}) if wanted`, placeholder: '%', min: 0, max: 100, optional: true, required: false },
        ],
      })
      if (raw == null || raw === false) {
        logDebug('promptAddProgressLineInputs', `User cancelled CommandBar.showForm`)
        return null
      }
      const parsed = parseRawProgressFormValues(raw)
      if (parsed) {
        return parsed
      }
      logDebug('promptAddProgressLineInputs', `Invalid showForm submission`)
      return null
    } catch (error) {
      logWarn('promptAddProgressLineInputs', `CommandBar.showForm failed (${error.message}); using separate prompts`)
    }
  }

  const resText = await getInputTrimmed(message1, 'OK', `Add Progress comment`)
  if (!resText) {
    logDebug('promptAddProgressLineInputs', `No valid progress comment`)
    return null
  }
  const comment = String(resText)
  const resNum = await inputIntegerBounded('Add Progress % completion', 'Percent Complete (optional %${lastPercentMessage})', 100, 0)
  let percentStr = ''
  if (!isNaN(resNum)) {
    percentStr = String(resNum)
  }
  return { comment, progressDateStr: todaysDateISOString, percentStr }
}

/**
 * Define 'Project' class to use in GTD.
 * Holds title, last reviewed date, due date, review interval, completion date, progress information that is read from the note,
 * and other derived data.
 * @example To create a project instance for a note call 'const x = new Project(note, ...)'
 * Note: with my projects this is taking on average 1ms/line/note. 
 * @author @jgclark
 */
export class Project {
  // Types for the class instance properties
  note: TNote
  filename: string
  folder: string
  metadataParaLineIndex: number
  // projectTag: string // #project, #area, etc. Removed in b15 to now use .allProjectTags instead
  title: string
  startDate: ?string // ISO date YYYY-MM-DD
  dueDate: ?string // ISO date YYYY-MM-DD
  dueDays: number = NaN
  reviewedDate: ?string // ISO date YYYY-MM-DD
  reviewInterval: string // later will default to '1w' if needed
  nextReviewDateStr: ?string // The next review date in YYYY-MM-DD format (can be set by user or calculated)
  nextReviewDays: number = NaN
  completedDate: ?string // ISO date YYYY-MM-DD
  completedDuration: ?string // string description of time to completion, or how long ago completed
  cancelledDate: ?string // ISO date YYYY-MM-DD
  cancelledDuration: ?string // string description of time to cancellation, or how long ago cancelled
  numOpenItems: number = 0
  numCompletedItems: number = 0
  numTotalItems: number = 0
  numWaitingItems: number = 0
  numFutureItems: number = 0
  isCompleted: boolean = false
  isCancelled: boolean = false
  isPaused: boolean = false
  percentComplete: number = NaN
  lastProgressComment: string = '' // e.g. "Progress: 60@20220809: comment
  mostRecentProgressLineIndex: number = NaN
  nextActionsRawContent: Array<string> = []
  ID: string // required when making HTML views
  icon: ?string // icon from frontmatter (optional)
  iconColor: ?string // iconColor from frontmatter (optional)
  allProjectTags: Array<string> = [] // projectTag(s), #sequential if applicable, and all hashtags from metadata line and frontmatter 'project' (for column 3) **See below**
  /** Epoch ms of `note.changedDate` after a full parse; used to skip re-parsing when regenerating allProjectsList */
  noteChangedAtMs: ?number

  /**
   * allProjectTags = set/list of all relevant tags (primary tag + metadata/frontmatter tags + optional #sequential, de-duped in constructor order).
   * - Primary tag is always at index 0, retrieved via getLeadingProjectTag()
   * - Used for UI tag chips in buildProjectTagLozengeSpans() in jgclark.Reviews/src/projectsHTMLGenerator.js
   * - Used for "matches any configured project type" logic and per-tag counts in jgclark.Reviews/src/reviews.js
   *
   * Note: The constructor may need to be updated if these usages change.
   */

  constructor(note: TNote, _projectTypeTag: string = '', checkEditor: boolean = true, nextActionTags: Array<string> = [], sequentialTag: string = '') {
    try {
      const startTime = new Date()
      if (note == null || note.title == null) {
        throw new Error('Error in constructor: invalid note passed')
      }
      this.title = note.title
      this.filename = note.filename
      // logDebug('ProjectConstructor', `Starting for type ${projectTypeTag}, ${this.filename}`)
      this.folder = getFolderFromFilename(note.filename)

      // Make a (nearly) unique number for this instance (needed for the addressing the SVG circles) -- I can't think of a way of doing this neatly to create one-up numbers, that doesn't create clashes when re-running over a subset of notes
      this.ID = String(Math.round((Math.random()) * 99999))

      // Sometimes we're called just after a note has been updated in the Editor. So check to see if note is open in Editor, and if so use that version, which could be newer.
      // (Unless 'checkEditor' false, to avoid triggering 'You are running this on an async thread' warnings.)
      let paras: Array<TParagraph>
      let usingEditor = false
      if (checkEditor && Editor && Editor.note && (Editor.note.filename === note.filename)) {
        const editorNote: CoreNoteFields = Editor.note
        paras = editorNote.paragraphs
        usingEditor = true
        this.note = Editor.note // Note: not plain Editor, as otherwise it isn't the right type and will throw app run-time errors later.
        const versionDateMS = editorNote.versions && editorNote.versions.length > 0 ? new Date(editorNote.versions[0].date).getTime() : NaN
        const timeSinceLastEdit: number = isNaN(versionDateMS) ? NaN : Date.now() - versionDateMS
        logDebug('ProjectConstructor', `- using EDITOR for (${Editor.filename}), last updated ${String(timeSinceLastEdit)}ms ago.} `)
      } else {
        // read note from DataStore in the usual way
        paras = note.paragraphs
        this.note = note
        // logDebug('ProjectConstructor', `- read note from datastore `)
      }

      const singleKeyName = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
      const combinedMetadataField = readRawFrontmatterField(this.note, singleKeyName)

      const mentionFromPref = (prefKey: string): string => checkString(DataStore.preference(prefKey) || '')
      const startMentionName = mentionFromPref('startMentionStr')
      const dueMentionName = mentionFromPref('dueMentionStr')
      const reviewedMentionName = mentionFromPref('reviewedMentionStr')
      const completedMentionName = mentionFromPref('completedMentionStr')
      const cancelledMentionName = mentionFromPref('cancelledMentionStr')
      const reviewIntervalMentionName = mentionFromPref('reviewIntervalMentionStr')
      const nextReviewMentionName = mentionFromPref('nextReviewMentionStr')

      const separateFmKeyFromMentionPref = (raw: string, defaultKey: string): string => {
        const s = checkString(raw || '').replace(/^[@#]/, '')
        return s !== '' ? s : defaultKey
      }
      const fmKey = {
        start: separateFmKeyFromMentionPref(startMentionName, 'start'),
        due: separateFmKeyFromMentionPref(dueMentionName, 'due'),
        reviewed: separateFmKeyFromMentionPref(reviewedMentionName, 'reviewed'),
        completed: separateFmKeyFromMentionPref(completedMentionName, 'completed'),
        cancelled: separateFmKeyFromMentionPref(cancelledMentionName, 'cancelled'),
        reviewInterval: separateFmKeyFromMentionPref(reviewIntervalMentionName, 'review'),
        nextReview: separateFmKeyFromMentionPref(nextReviewMentionName, 'nextReview'),
      }

      const ignoreChecklistsInProgress = checkBoolean(DataStore.preference('ignoreChecklistsInProgress')) || false
      const numberDaysForFutureToIgnore = checkNumber(DataStore.preference('numberDaysForFutureToIgnore')) || 0

      const hasFrontmatterMetadata = combinedMetadataField.exists && String(combinedMetadataField.value ?? '').trim() !== ''
      const metadataBodyLineIndex = getMetadataLineIndexFromBody(this.note)
      if (hasFrontmatterMetadata && metadataBodyLineIndex !== false) {
        const bodyMetadataToRemove = paras[metadataBodyLineIndex].content
        logInfo('ProjectConstructor', `Both frontmatter and body metadata exist for '${this.title}'. Removing body metadata line '${bodyMetadataToRemove}'.`)
        this.note.removeParagraph(paras[metadataBodyLineIndex])
        DataStore.updateCache(this.note, true)
      } else if (!hasFrontmatterMetadata && metadataBodyLineIndex !== false) {
        logInfo('ProjectConstructor', `Only body metadata exists for '${this.title}'. Migrating metadata to frontmatter.`)
        if (usingEditor) {
          // $FlowFixMe[incompatible-call] this.note is Editor.note when usingEditor is true
          migrateProjectMetadataLineInEditor(Editor)
        } else {
          migrateProjectMetadataLineInNote(this.note)
        }
        DataStore.updateCache(this.note, true)
      }

      // Get the single metadata line (where it still exists; we're now trying to remove them from the note body)
      paras = this.note.paragraphs
      const metadataLineIndex = getProjectMetadataLineIndex(
        this.note,
        metadataBodyLineIndex === false ? false : undefined,
      )
      this.metadataParaLineIndex = metadataLineIndex === false ? NaN : metadataLineIndex
      let mentions: $ReadOnlyArray<string> = note.mentions ?? [] // Note: can be out of date, and I can't find a way of fixing this, even with updateCache()
      let hashtags: $ReadOnlyArray<string> = note.hashtags ?? [] // Note: can be out of date
      const metadataLine = metadataLineIndex === false ? '' : paras[metadataLineIndex].content

      if (mentions.length === 0) {
        logDebug('ProjectConstructor', `- Grr: .mentions empty: will use metadata line instead`)
        // Note: If necessary, fall back to getting mentions just from the metadataLine
        mentions = (`${metadataLine} `).split(' ').filter((f) => f[0] === '@')
      }
      if (hashtags.length === 0) {
        hashtags = (`${metadataLine} `).split(' ').filter((f) => f[0] === '#')
      }

      // Work out primary project tag:
      // - if projectTypeTag given, then use that
      // - else first or second hashtag in note
      let primaryProjectTag = ''
      try {
        const combinedValueForPrimary = combinedMetadataField.exists ? combinedMetadataField.value : getFrontmatterAttribute(this.note, singleKeyName)
        const hashtagsFromCombinedValue = getHashtagsFromString(String(combinedValueForPrimary ?? ''))
        const hashtagsFromMetadataLine = getHashtagsFromString(metadataLine)
        const hashtagsForPrimary = hashtagsFromCombinedValue.length > 0 ? hashtagsFromCombinedValue : hashtagsFromMetadataLine
        primaryProjectTag = (_projectTypeTag)
          ? _projectTypeTag
          : (hashtagsForPrimary[0] !== '#paused')
            ? hashtagsForPrimary[0]
            : (hashtagsForPrimary[1])
              ? hashtagsForPrimary[1]
              : ''
      } catch (e) {
        primaryProjectTag = ''
        logWarn('ProjectConstructor', `- found no projectTag for '${this.title}' in folder ${this.folder}`)
      }

      // read in review interval (if present) -- see special handling below as well
      const tempIntervalStr = getParamMentionFromList(mentions, reviewIntervalMentionName)
      if (tempIntervalStr !== '') {
        this.reviewInterval = getContentFromBrackets(tempIntervalStr) ?? ''
      }
      // read in various metadata fields from body of note (if present)
      this.startDate = this.parseDateMention(mentions, 'startMentionStr', startMentionName)
      this.dueDate = this.parseDateMention(mentions, 'dueMentionStr', dueMentionName)
      // read in reviewed date (if present)
      // Note: doesn't pick up reviewed() if not in metadata line
      this.reviewedDate = this.parseDateMention(mentions, 'reviewedMentionStr', reviewedMentionName)
      // read in completed date (if present)
      this.completedDate = this.parseDateMention(mentions, 'completedMentionStr', completedMentionName)
      // read in cancelled date (if present)
      this.cancelledDate = this.parseDateMention(mentions, 'cancelledMentionStr', cancelledMentionName)
      // read in nextReview date (if present)
      const nextReviewStr = getParamMentionFromList(mentions, nextReviewMentionName)
      if (nextReviewStr !== '') {
        // Extract date using regex instead of hardcoded slice indices
        const dateMatch = nextReviewStr.match(/@nextReview\((\d{4}-\d{2}-\d{2})\)/)
        if (dateMatch && dateMatch[1]) {
          this.nextReviewDateStr = dateMatch[1]
        }
      }

      // Backward-compatibility: if the combined frontmatter key still contains embedded date/interval mentions
      // (e.g. `project: #project @start(YYYY-MM-DD) @due(...) @review(1w) ...`), extract them into the separate
      // frontmatter-backed fields so they don't get dropped during subsequent writes.
      try {
        const combinedStrRaw = getFrontmatterAttribute(this.note, singleKeyName)
        const combinedStr = combinedStrRaw != null && typeof combinedStrRaw === 'string' ? combinedStrRaw : ''
        if (combinedStr !== '') {
          const reISODate = new RegExp(`^${RE_DATE}$`)
          const reInterval = new RegExp(`^${RE_DATE_INTERVAL}$`)

          const mentionRegex = /@[\w\-\.]+\([^)]*\)/g
          const embeddedMentions: Array<string> = combinedStr.match(mentionRegex) ?? []
          for (const embeddedMention of embeddedMentions) {
            const mentionName = embeddedMention.split('(', 1)[0]
            const parsed = parseProjectFrontmatterValue(embeddedMention)
            if (parsed === '') continue

            if (mentionName === startMentionName && (this.startDate == null || this.startDate === '')) {
              if (reISODate.test(parsed)) this.startDate = parsed
            } else if (mentionName === dueMentionName && (this.dueDate == null || this.dueDate === '')) {
              if (reISODate.test(parsed)) this.dueDate = parsed
            } else if (mentionName === reviewedMentionName && (this.reviewedDate == null || this.reviewedDate === '')) {
              if (reISODate.test(parsed)) this.reviewedDate = parsed
            } else if (mentionName === completedMentionName && (this.completedDate == null || this.completedDate === '')) {
              if (reISODate.test(parsed)) this.completedDate = parsed
            } else if (mentionName === cancelledMentionName && (this.cancelledDate == null || this.cancelledDate === '')) {
              if (reISODate.test(parsed)) this.cancelledDate = parsed
            } else if (mentionName === nextReviewMentionName && (this.nextReviewDateStr == null || this.nextReviewDateStr === '')) {
              if (reISODate.test(parsed)) this.nextReviewDateStr = parsed
            } else if (
              mentionName === reviewIntervalMentionName &&
              (this.reviewInterval == null || this.reviewInterval === '' || !this.reviewInterval.match(reInterval))
            ) {
              if (reInterval.test(parsed)) this.reviewInterval = parsed
            }
          }
        }
      } catch (e) {
        logWarn('ProjectConstructor', `- Failed to extract embedded date mentions from combined frontmatter for '${this.title}': ${e.message}`)
      }

      // Overlay metadata fields from separate frontmatter keys (if they exist)
      try {
        const invalidFrontmatterKeysToRemove: Set<string> = new Set()
        const reISODate = new RegExp(`^${RE_DATE}$`)
        const normalizedFrontmatterAttrs: { [string]: string } = {}

        /**
         * Helper to read and assign a date field from frontmatter.
         * @param {string} fieldKey
         * @param {function} setter
         * @returns {void}
         */
        const readAndAssignDateField = (fieldKey: string, setter: (value: string) => void): void => {
          const field = readRawFrontmatterField(this.note, fieldKey)
          if (!field.exists) {
            return
          }
          if (field.value == null || String(field.value).trim() === '') {
            logWarn('ProjectConstructor', `Found empty frontmatter '${fieldKey}' value in '${this.title}' (${this.filename}). Will remove the key.`)
            invalidFrontmatterKeysToRemove.add(fieldKey)
            return
          }
          const originalValue = String(field.value)
          const parsed = parseProjectFrontmatterValue(originalValue)
          if (parsed !== '' && reISODate.test(parsed)) {
            setter(parsed)
            if (originalValue.trim() !== parsed) {
              normalizedFrontmatterAttrs[fieldKey] = parsed
            }
          } else {
            logWarn('ProjectConstructor', `Found empty or invalid frontmatter '${fieldKey}' value '${String(field.value)}' in '${this.title}' (${this.filename}). Will remove the key.`)
            invalidFrontmatterKeysToRemove.add(fieldKey)
          }
        }

        // Get/set reviewInterval. Note: this is unlike the following metadata fields
        const fmReviewInterval = readRawFrontmatterField(this.note, fmKey.reviewInterval)
        const reInterval = new RegExp(`^${RE_DATE_INTERVAL}$`)

        let wroteReviewIntervalToFrontmatter = false
        if (fmReviewInterval.exists && fmReviewInterval.value) {
          this.reviewInterval = parseProjectFrontmatterValue(fmReviewInterval.value)
          // Now check for valid value in this.reviewInterval, and if not, then log warning and set to default
          if (!this.reviewInterval || this.reviewInterval === '' || !this.reviewInterval.match(reInterval)) {
            logWarn(
              'ProjectConstructor',
              `Found invalid frontmatter '${fmKey.reviewInterval}' value '${String(this.reviewInterval)}' in '${this.title}' (${this.filename}). Will set it to default '${DEFAULT_REVIEW_INTERVAL}'.`,
            )
            this.reviewInterval = DEFAULT_REVIEW_INTERVAL
            const newAttr: { [string]: any } = {}
            newAttr[fmKey.reviewInterval] = this.reviewInterval
            updateFrontMatterVars(this.note, newAttr)
            wroteReviewIntervalToFrontmatter = true
          }
        } else {
          // No frontmatter reviewInterval key yet. If we already have a valid in-memory value (e.g. from embedded mentions),
          // write that to frontmatter; otherwise write the DEFAULT_REVIEW_INTERVAL.
          const hasValidExistingInterval =
            this.reviewInterval != null && this.reviewInterval !== '' && this.reviewInterval.match(reInterval)
          const intervalToWrite = hasValidExistingInterval ? this.reviewInterval : DEFAULT_REVIEW_INTERVAL
          this.reviewInterval = intervalToWrite
          const newAttr: { [string]: any } = {}
          newAttr[fmKey.reviewInterval] = this.reviewInterval
          updateFrontMatterVars(this.note, newAttr)
          wroteReviewIntervalToFrontmatter = true
        }

        readAndAssignDateField(fmKey.start, (value) => {
          this.startDate = value
        })
        readAndAssignDateField(fmKey.due, (value) => {
          this.dueDate = value
        })
        readAndAssignDateField(fmKey.reviewed, (value) => {
          this.reviewedDate = value
        })
        readAndAssignDateField(fmKey.completed, (value) => {
          this.completedDate = value
        })
        readAndAssignDateField(fmKey.cancelled, (value) => {
          this.cancelledDate = value
        })
        readAndAssignDateField(fmKey.nextReview, (value) => {
          this.nextReviewDateStr = value
        })

        if (invalidFrontmatterKeysToRemove.size > 0) {
          for (const invalidKey of invalidFrontmatterKeysToRemove) {
            logInfo('ProjectConstructor', `About to remove invalid frontmatter key '${invalidKey}' from '${this.title}' (${this.filename})`)
            const removed = removeFrontMatterField(this.note, invalidKey)
            if (!removed) {
              logWarn('ProjectConstructor', `Failed to remove invalid frontmatter key '${invalidKey}' from '${this.title}' (${this.filename})`)
            }
          }
        }

        if (Object.keys(normalizedFrontmatterAttrs).length > 0) {
          updateFrontMatterVars(this.note, normalizedFrontmatterAttrs)
          logDebug('ProjectConstructor', `Normalized frontmatter date fields [${Object.keys(normalizedFrontmatterAttrs).join(', ')}] in '${this.title}'`)
        }

        if (
          invalidFrontmatterKeysToRemove.size > 0 ||
          Object.keys(normalizedFrontmatterAttrs).length > 0 ||
          wroteReviewIntervalToFrontmatter
        ) {
          DataStore.updateCache(this.note, true)
        }
      } catch (e) {
        logWarn('ProjectConstructor', `- overlay from separate frontmatter keys failed for '${this.title}': ${e.message}`)
      }

      // read in icon and iconColor from frontmatter (if present)
      const iconValue = getFrontmatterAttribute(note, 'icon')
      this.icon = iconValue != null && iconValue !== '' ? iconValue : undefined
      const iconColorValue = getFrontmatterAttribute(note, 'icon-color')
      this.iconColor = iconColorValue != null && iconColorValue !== '' ? iconColorValue : undefined

      // count tasks (includes both tasks and checklists)
      this.countTasks(paras, ignoreChecklistsInProgress, numberDaysForFutureToIgnore)

      // make project completed if @completed(date) set
      if (this.completedDate != null) {
        this.isCompleted = true
        this.nextReviewDays = NaN
      }
      // make project cancelled if @cancelled(date) set
      if (this.cancelledDate != null) {
        this.isCancelled = true
        this.nextReviewDays = NaN
      }
      // make project paused if #paused
      if (getStringFromList(hashtags, '#paused') !== '') {
        this.isPaused = true
        this.nextReviewDays = NaN
      }

      // calculate the durations from these dates
      this.calculateDueDays()
      this.calculateCompletedOrCancelledDurations()
      // if not finished, calculate next review dates
      if (!this.isCancelled && !this.isCompleted) {
        this.calcNextReviewDate()
      }

      // Find progress field lines (if any) and process
      // logDebug('ProjectConstructor', `- about to call processProgressLines() for ${this.title}`)//  ✅
      this.processProgressLines()

      // If percentComplete not set via progress line, then calculate
      if (this.lastProgressComment === '' || isNaN(this.percentComplete)) {
        this.calculatePercentComplete(numberDaysForFutureToIgnore)
      }

      // If we want to track next actions, find any tagged next actions or sequential first open task/checklist
      if (nextActionTags.length > 0 || sequentialTag !== '') {
        this.generateNextActionComments(nextActionTags, paras, sequentialTag, Array.from(hashtags ?? []), metadataLine)
      }

      // Build allProjectTags: all hashtags from metadata line and combined frontmatter metadata field, then de-duped
      this.allProjectTags = this.buildAllProjectTags(primaryProjectTag)
      // logDebug('ProjectConstructor', `  - allProjectTags = [${String(this.allProjectTags)}]`)

      if (this.title.includes('TEST')) {
        logDebug('ProjectConstructor', `Constructed ${this.getLeadingProjectTag()} ${this.filename}:`)
        logDebug('ProjectConstructor', `  - folder = ${this.folder}`)
        logDebug('ProjectConstructor', `  - folder (for display) = ${getFolderDisplayName(this.folder)}`)
        logDebug('ProjectConstructor', `  - reviewInterval = ${String(this.reviewInterval)}`)
        logDebug('ProjectConstructor', `  - metadataLine = ${metadataLine}`)
        if (this.isCompleted) logDebug('ProjectConstructor', `  - isCompleted ✔️`)
        if (this.isCancelled) logDebug('ProjectConstructor', `  - isCancelled ✔️`)
        if (this.isPaused) logDebug('ProjectConstructor', `  - isPaused ✔️`)
        logDebug('ProjectConstructor', `  - mentions: ${String(mentions)}`)
        // logDebug('ProjectConstructor', `  - altMentions: ${String(altMentions)}`)
        logDebug('ProjectConstructor', `  - hashtags: ${String(hashtags)}`)
        // logDebug('ProjectConstructor', `  - altHashtags: ${String(altHashtags)}`)
        logDebug('ProjectConstructor', `  - ${String(this.numTotalItems)} items: open:${String(this.numOpenItems)} completed:${String(this.numCompletedItems)} waiting:${String(this.numWaitingItems)} future:${String(this.numFutureItems)}`)
        logDebug('ProjectConstructor', `  - completed: ${String(this.numCompletedItems)}`)
        logDebug('ProjectConstructor', `  - progressLineIndex: #${String(this.mostRecentProgressLineIndex ?? '-')}`)
        logDebug('ProjectConstructor', `  - progress: <${String(this.lastProgressComment)}>`)
        logDebug('ProjectConstructor', `  - % complete = ${String(this.percentComplete)}`)
        logDebug('ProjectConstructor', `  - nextAction = <${String(this.nextActionsRawContent)}>`)
        logDebug('ProjectConstructor', `  - allProjectTags = <${String(this.allProjectTags)}>`)
      } else {
        logTimer('ProjectConstructor', startTime, `Constructed ${this.getLeadingProjectTag()} ${this.filename}: ${this.nextReviewDateStr ?? '-'} / ${String(this.nextReviewDays)} / ${this.isCompleted ? ' completed' : ''}${this.isCancelled ? ' cancelled' : ''}${this.isPaused ? ' paused' : ''}`)
      }

      const changedMs = getNoteChangedDateMs(this.note)
      this.noteChangedAtMs = changedMs != null ? changedMs : undefined
    }
    catch (error) {
      logError('ProjectConstructor', error.message)
      throw error // Re-throw to prevent invalid object creation
    }
  }

  /**
   * Is this project ready for review?
   * Return true if review is due and not archived or completed
   * @return {boolean}
   */
  get isReadyForReview(): boolean {
    // logDebug(pluginJson, `isReadyForReview: ${this.title}:  ${String(this.nextReviewDays)} ${String(this.isPaused)}`)
    // $FlowFixMe[invalid-compare]
    return !this.isPaused && !this.isCompleted && this.nextReviewDays != null && !isNaN(this.nextReviewDays) && this.nextReviewDays <= 0
  }

  /**
   * Parse a date mention from the mentions list; returns ISO date string (YYYY-MM-DD).
   * @param {Array<string>|$ReadOnlyArray<string>} mentions - Array of mention strings
   * @param {string} mentionKey - The preference key for the mention string (used when resolvedMentionName is omitted)
   * @param {string} [resolvedMentionName] - If provided, used instead of reading DataStore.preference(mentionKey)
   * @returns {?string} ISO date string or undefined
   * @private
   */
  parseDateMention(mentions: $ReadOnlyArray<string>, mentionKey: string, resolvedMentionName?: string): ?string {
    const mentionName =
      resolvedMentionName != null && resolvedMentionName !== '' ? checkString(resolvedMentionName) : checkString(DataStore.preference(mentionKey))
    const tempStr = getParamMentionFromList(mentions, mentionName)
    if (tempStr === '') {
      return undefined
    }

    const bracketContent = getContentFromBrackets(tempStr)
    if (bracketContent == null || bracketContent.trim() === '') {
      logWarn('ProjectConstructor', `Found empty ${mentionName}() in '${this.title}' (${this.filename}). Ignoring this value.`)
      return undefined
    }
    return getISODateStringFromMention(tempStr)
  }

  /**
   * Build allProjectTags: all hashtags from metadata line and combined frontmatter metadata field, then de-duped
   */
  buildAllProjectTags(primaryProjectTag: string = ''): Array<string> {
    const allTags: Array<string> = []
    if (primaryProjectTag !== '' && primaryProjectTag.startsWith('#') && primaryProjectTag.length > 1) {
      allTags.push(primaryProjectTag)
    }
    const metadataPara = this.note.paragraphs[this.metadataParaLineIndex]
    const metadataLineStr = metadataPara != null ? metadataPara.content ?? '' : ''
    const metadataLineHashtags = getHashtagsFromString(metadataLineStr)
    allTags.push(...metadataLineHashtags)

    const frontmatterKey = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
    const frontmatterRawField = readRawFrontmatterField(this.note, frontmatterKey)
    const frontmatterValue = frontmatterRawField.exists ? frontmatterRawField.value : getFrontmatterAttribute(this.note, frontmatterKey)
    const frontmatterStr = frontmatterValue != null && typeof frontmatterValue === 'string' ? frontmatterValue : ''
    const frontmatterHashtags = getHashtagsFromString(frontmatterStr)
    allTags.push(...frontmatterHashtags)
    return allTags.filter((t, index, self) => self.indexOf(t) === index)
  }

  /**
   * Return the primary project tag for this note.
   * Uses the first tag in allProjectTags, or falls back to '#project' if none are available.
   * @returns {string}
   */
  getLeadingProjectTag(): string {
    const firstTag = this.allProjectTags != null && this.allProjectTags.length > 0 ? checkString(this.allProjectTags[0]) : ''
    return firstTag !== '' ? firstTag : '#project'
  }

  /**
   * Count tasks/items in the note
   * @param {Array<TParagraph>} paras - Paragraphs to count
   * @param {boolean} ignoreChecklistsInProgress - Whether to ignore checklists
   * @param {number} numberDaysForFutureToIgnore - Days in future to ignore
   * @private
   */
  countTasks(paras: Array<TParagraph>, ignoreChecklistsInProgress: boolean, numberDaysForFutureToIgnore: number): void {
    const openFilter = ignoreChecklistsInProgress ? isOpenTask : isOpen
    const closedFilter = ignoreChecklistsInProgress ? isClosedTask : isClosed

    const openParas = paras.filter(openFilter)
    this.numOpenItems = openParas.length
    this.numCompletedItems = paras.filter(closedFilter).length
    this.numWaitingItems = openParas.filter((p) => p.content.match('#waiting')).length
    this.numFutureItems = openParas.filter((p) => includesScheduledFurtherFutureDate(p.content, numberDaysForFutureToIgnore)).length
  }

  /**
   * Calculate duration string for completed/cancelled date since startDate if available. If not, then do time since completion/cancellation date.
   * @param {string|Date} date - The completion or cancellation date (ISO string or Date)
   * @param {?string|Date} startDate - Optional start date
   * @returns {string} Duration string
   * @private
   */
  calculateDurationString(date: string | Date, startDate?: string | Date, roundShortDurationToToday: boolean = true): string {
    return formatDurationString(date, startDate, roundShortDurationToToday)
  }

  /**
   * Sync project metadata to the note: always writes structured YAML frontmatter from Project fields
   * (separate keys for dates/intervals + combined hashtag key), then optionally updates the body metadata
   * paragraph when it is a plain line (not a frontmatter-style `project:` / `metadata:` line).
   * @param {string} newMetadataLine - The new metadata content for body storage (without "metadata:" prefix)
   * @param {object} [options]
   * @param {boolean} [options.skipPlainBodyParagraphUpdate] - If true, only frontmatter is updated (e.g. before removing a body metadata line during migration so `getCombinedProjectTagsFrontmatterValue` can still read the old line)
   * @param {boolean} [options.preserveSeparateKeysWhenEmptyOnProject] - If true, do not remove separate frontmatter keys when the corresponding Project field is empty (avoids wiping keys not loaded on the instance). Still write non-empty Project fields and the combined key. Use with `explicitKeysToRemoveFromFrontmatter` to remove specific keys (e.g. `nextReview` when pausing).
   * @param {Array<string>} [options.explicitKeysToRemoveFromFrontmatter] - Keys to remove from frontmatter regardless of preserve mode (e.g. next review after `clearNextReviewMetadata`).
   * @private
   */
  updateProjectMetadata(
    newMetadataLine: string,
    options?: {|
      skipPlainBodyParagraphUpdate?: boolean,
    preserveSeparateKeysWhenEmptyOnProject?: boolean,
    explicitKeysToRemoveFromFrontmatter?: Array<string>,
    |},
  ): void {
  try {
    const singleKeyName = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
      const attrs: { [string]: any } = { }
const keysToRemove: Array<string> = []

logDebug('updateProjectMetadata', `Updating project metadata for '${this.title}' with newMetadataLine: '${newMetadataLine}' and options: {${JSP(options)}}`)
// Derive possible separate frontmatter key names from mention strings
const startKey = checkString(DataStore.preference('startMentionStr') || '').replace(/^[@#]/, '') || 'start'
const dueKey = checkString(DataStore.preference('dueMentionStr') || '').replace(/^[@#]/, '') || 'due'
const reviewedKey = checkString(DataStore.preference('reviewedMentionStr') || '').replace(/^[@#]/, '') || 'reviewed'
const completedKey = checkString(DataStore.preference('completedMentionStr') || '').replace(/^[@#]/, '') || 'completed'
const cancelledKey = checkString(DataStore.preference('cancelledMentionStr') || '').replace(/^[@#]/, '') || 'cancelled'
const reviewIntervalKey = checkString(DataStore.preference('reviewIntervalMentionStr') || '').replace(/^[@#]/, '') || 'review'
const nextReviewKey = checkString(DataStore.preference('nextReviewMentionStr') || '').replace(/^[@#]/, '') || 'nextReview'

const preserveEmpty = options?.preserveSeparateKeysWhenEmptyOnProject === true
const explicitRemoves = options?.explicitKeysToRemoveFromFrontmatter ?? []

if (preserveEmpty) {
  if (this.startDate != null && this.startDate !== '') attrs[startKey] = this.startDate
  if (this.dueDate != null && this.dueDate !== '') attrs[dueKey] = this.dueDate
  if (this.reviewedDate != null && this.reviewedDate !== '') attrs[reviewedKey] = this.reviewedDate
  if (this.completedDate != null && this.completedDate !== '') attrs[completedKey] = this.completedDate
  if (this.cancelledDate != null && this.cancelledDate !== '') attrs[cancelledKey] = this.cancelledDate
  if (this.reviewInterval != null && checkString(this.reviewInterval) !== '') attrs[reviewIntervalKey] = checkString(this.reviewInterval)
  if (this.nextReviewDateStr != null && this.nextReviewDateStr !== '') attrs[nextReviewKey] = this.nextReviewDateStr
  for (const key of explicitRemoves) {
    if (key !== '' && !keysToRemove.includes(key)) keysToRemove.push(key)
  }
} else {
  if (this.startDate != null && this.startDate !== '') {
    attrs[startKey] = this.startDate
  } else {
    keysToRemove.push(startKey)
  }
  if (this.dueDate != null && this.dueDate !== '') {
    attrs[dueKey] = this.dueDate
  } else {
    keysToRemove.push(dueKey)
  }
  if (this.reviewedDate != null && this.reviewedDate !== '') {
    attrs[reviewedKey] = this.reviewedDate
  } else {
    keysToRemove.push(reviewedKey)
  }
  if (this.completedDate != null && this.completedDate !== '') {
    attrs[completedKey] = this.completedDate
  } else {
    keysToRemove.push(completedKey)
  }
  if (this.cancelledDate != null && this.cancelledDate !== '') {
    attrs[cancelledKey] = this.cancelledDate
  } else {
    keysToRemove.push(cancelledKey)
  }
  if (this.reviewInterval != null && checkString(this.reviewInterval) !== '') {
    attrs[reviewIntervalKey] = checkString(this.reviewInterval)
  } else {
    keysToRemove.push(reviewIntervalKey)
  }
  if (this.nextReviewDateStr != null && this.nextReviewDateStr !== '') {
    attrs[nextReviewKey] = this.nextReviewDateStr
  } else {
    keysToRemove.push(nextReviewKey)
  }
}

// Invariant: combined frontmatter key value contains ONLY hashtags.
      attrs[singleKeyName] = this.getCombinedProjectTagsFrontmatterValue(singleKeyName)

// $FlowFixMe[incompatible-call]
      const success = updateFrontMatterVars(this.note, attrs)
if (!success) {
  logError('updateProjectMetadata', `Failed to update frontmatter metadata for '${this.title}'`)
}
// Run removals even when updateFrontMatterVars returned false (e.g. Editor merge path or race);
// otherwise explicit keys such as nextReview on pause are never stripped.
for (const keyToRemove of keysToRemove) {
  logDebug('updateProjectMetadata', `Removing frontmatter key '${keyToRemove}' from '${this.title}'`)
  removeFrontMatterField(this.note, keyToRemove)
}
DataStore.updateCache(this.note, true)
    } catch (error) {
  logError('updateProjectMetadata', error.message)
}

if (options?.skipPlainBodyParagraphUpdate === true) {
  return
}

const metadataPara = this.note.paragraphs[this.metadataParaLineIndex]
if (metadataPara == null) {
  return
}
const currentContent = metadataPara.content
const singleKeyName = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
const frontmatterPrefixRe = new RegExp(`^${singleKeyName}:\\s*`, 'i')
const isFrontmatterStyleParagraphLine =
  frontmatterPrefixRe.test(currentContent) || currentContent.match(/^metadata:\s*/i) != null

if (isFrontmatterStyleParagraphLine) {
  // Structured frontmatter step already updated the real YAML combined key; no duplicate paragraph update
  return
}

// Update regular paragraph content (plain body metadata line)
metadataPara.content = newMetadataLine
const possibleThisEditor = getOpenEditorFromFilename(this.note.filename)
if (possibleThisEditor) {
  possibleThisEditor.updateParagraph(metadataPara)
} else {
  this.note.updateParagraph(metadataPara)
}
DataStore.updateCache(this.note, true)
  }

  /**
   * Build the combined frontmatter key value.
   * Invariant: the combined key must contain ONLY project hashtags (e.g. '#project', '#area', '#sequential', and '#paused').
   * @param {string} combinedKey
   * @returns {string}
   */
  getCombinedProjectTagsFrontmatterValue(combinedKey: string): string {
    const seen: Set<string> = new Set()
    const ordered: Array<string> = []

    const addTagsFromText = (text: string): void => {
      const candidates = getHashtagsFromString(checkString(text))
      for (const tag of candidates) {
        if (!tag || !tag.startsWith('#') || tag.length <= 1) continue
        if (!seen.has(tag)) {
          seen.add(tag)
          ordered.push(tag)
        }
      }
    }

    const combinedRawField = readRawFrontmatterField(this.note, combinedKey)
    const combinedValue = combinedRawField.exists ? combinedRawField.value : getFrontmatterAttribute(this.note, combinedKey)
    const combinedStr = combinedValue != null && typeof combinedValue === 'string' ? combinedValue : ''
    addTagsFromText(combinedStr)

    const metadataPara = this.note.paragraphs[this.metadataParaLineIndex]
    const metadataLineStr = metadataPara != null ? metadataPara.content ?? '' : ''
    addTagsFromText(metadataLineStr)

    const primaryProjectTag = checkString(this.getLeadingProjectTag())
    if (primaryProjectTag && primaryProjectTag.startsWith('#') && primaryProjectTag.length > 1) {
      if (!seen.has(primaryProjectTag)) {
        seen.add(primaryProjectTag)
        ordered.push(primaryProjectTag)
      }
    }

    if (this.isPaused) {
      const pausedTag = '#paused'
      if (!seen.has(pausedTag)) {
        seen.add(pausedTag)
        ordered.push(pausedTag)
      }
    }

    return ordered.join(' ')
  }

  /**
   * Update metadata paragraph and save to Editor or note.
   * Writes to frontmatter; if metadata was in the body, removes the body line after writing to frontmatter.
   * @private
   */
  updateMetadataAndSave(): void {
    const newMetadataLine = this.generateMetadataOutputLine()
    const metadataPara = this.note.paragraphs[this.metadataParaLineIndex]
    const currentContent = metadataPara != null ? metadataPara.content : ''
    const singleKeyName = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
    const frontmatterPrefixRe = new RegExp(`^${singleKeyName}:\\s*`, 'i')
    const isFrontmatterStyleLine = currentContent.match(/^metadata:\s*/i) != null || frontmatterPrefixRe.test(currentContent)

    this.updateProjectMetadata(newMetadataLine, { skipPlainBodyParagraphUpdate: true })
    if (!isFrontmatterStyleLine && metadataPara != null) {
      // Metadata was in body; now in frontmatter, so remove the body line
      this.note.removeParagraph(metadataPara)
      DataStore.updateCache(this.note, true)
  const metadataLineIndexAfterUpdate = getProjectMetadataLineIndex(this.note)
      this.metadataParaLineIndex = metadataLineIndexAfterUpdate === false ? NaN : metadataLineIndexAfterUpdate
  logDebug('updateMetadataAndSave', `Wrote metadata to frontmatter and removed body line for '${this.title}'`)
    }
  }

  /**
  * Calculate the percentage complete for this project based on open/completed items
  * @param {number} numberDaysForFutureToIgnore - number of days in future to ignore tasks for
  */
  calculatePercentComplete(numberDaysForFutureToIgnore: number) {
    this.numTotalItems = (numberDaysForFutureToIgnore > 0)
      ? this.numCompletedItems + this.numOpenItems - this.numFutureItems
      : this.numCompletedItems + this.numOpenItems
    if (this.numTotalItems > 0) {
      // use 'floor' not 'round' to ensure we don't get to 100% unless really everything is done
      this.percentComplete = Math.floor((this.numCompletedItems / this.numTotalItems) * 100)
    } else {
      this.percentComplete = NaN
    }
  }

  calculateDueDays(): void {
    const now = moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
    this.dueDays =
      this.dueDate != null
        ? daysBetween(now, this.dueDate)
        : NaN
  }

  /**
   * From the project metadata read in, calculate due/finished durations
   */
  calculateCompletedOrCancelledDurations(): void {
    try {
      // Calculate durations or time since cancel/complete
      // logDebug('calculateCompletedOrCancelledDurations', String(this.startDate ?? 'no startDate'))
      if (this.completedDate != null) {
        this.completedDuration = this.calculateDurationString(this.completedDate, this.startDate ?? undefined)
        // logDebug('calculateCompletedOrCancelledDurations', `-> completedDuration = ${this.completedDuration}`)
      } else if (this.cancelledDate != null) {
        this.cancelledDuration = this.calculateDurationString(this.cancelledDate, this.startDate ?? undefined)
        // logDebug('calculateCompletedOrCancelledDurations', `-> cancelledDuration = ${this.cancelledDuration}`)
      }
    } catch (error) {
      logError('calculateCompletedOrCancelledDurations', error.message)
    }
  }

  calcNextReviewDate(): ?string {
    try {
      // Calculate next review due date, if there isn't already a nextReviewDateStr, and there's a review interval.
      const now = moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone

      // First check to see if project start is in future: if so set nextReviewDateStr to project start
      const startDate = this.startDate
      if (startDate != null) {
        const momTSD = moment(startDate)
        if (momTSD.isAfter(now)) {
          this.nextReviewDateStr = startDate
          this.nextReviewDays = daysBetween(now, startDate)
          logDebug('calcNextReviewDate', `project start is in future (${momTSD.format('YYYY-MM-DD')}) -> ${String(this.nextReviewDays)} interval`)
          return this.nextReviewDateStr
        }
      }

      // Now check to see if we have a specific nextReviewDateStr
      if (this.nextReviewDateStr != null) {
        this.nextReviewDays = daysBetween(now, this.nextReviewDateStr)
        // logDebug('calcNextReviewDate', `already had a nextReviewDateStr ${this.nextReviewDateStr ?? '?'} -> ${String(this.nextReviewDays)} interval`)
        return this.nextReviewDateStr
      }
      else if (this.reviewInterval != null) {
        if (this.reviewedDate != null) {
          const calculatedNextReviewDateStr = calcNextReviewDate(this.reviewedDate, this.reviewInterval)
          if (calculatedNextReviewDateStr != null) {
            this.nextReviewDateStr = calculatedNextReviewDateStr
            // this now uses moment and truncated (not rounded) date diffs in number of days
            this.nextReviewDays = daysBetween(now, this.nextReviewDateStr)
            // logDebug('calcNextReviewDate', `${String(this.reviewedDate)} + ${this.reviewInterval ?? ''} -> nextReviewDateStr: ${this.nextReviewDateStr ?? ''} = ${String(this.nextReviewDays) ?? '-'}`)
            return this.nextReviewDateStr
          } else {
            throw new Error(`calculated nextReviewDate is null; reviewedDate = ${String(this.reviewedDate)}`)
          }
        } else {
          // no next review date, so set at today
          this.nextReviewDateStr = toISODateString(now)
          this.nextReviewDays = 0
          return this.nextReviewDateStr
        }
      }
      // logDebug('calcNextReviewDate', `-> reviewedDate = ${String(this.reviewedDate)} / nextReviewDateStr = ${String(this.nextReviewDateStr)} / nextReviewDays = ${String(this.nextReviewDays)}`)
      return this.nextReviewDateStr
    } catch (error) {
      logError('calcNextReviewDate', `${error.message} for project '${this.title}'`)
      return null
    }
  }

  /**
   * Generate next action comments from tagged next actions and/or sequential first open task/checklist.
   * @param {Array<string>} nextActionTags - Array of hashtags to search for in tasks/checklists
   * @param {Array<Paragraph>} paras - Array of paragraphs from the note
   * @param {string?} sequentialTag - (optional) Hashtag to identify sequential projects (e.g., '#sequential')
   * @param {Array<string>?} hashtags - (optional) Array of hashtags from the note
   * @param {string?} metadataLine - (optional) Content of the metadata line
   * @author @jgclark
   */
  generateNextActionComments(nextActionTags: Array<string>, paras: Array<Paragraph>, sequentialTag?: string, hashtags?: Array<string>, metadataLine?: string): void {
    // Set defaults for optional parameters
    const sequentialTagValue = sequentialTag ?? ''
    const hashtagsValue = hashtags ?? []
    const metadataLineValue = metadataLine ?? ''
    // Check if sequential tag is present in frontmatter 'project' attribute or metadata line
    let hasSequentialTag = false
    if (sequentialTagValue !== '') {
      // Check combined frontmatter metadata attribute
      const combinedKey = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
      const projectAttribute = getFrontmatterAttribute(this.note, combinedKey)
      if (projectAttribute && typeof projectAttribute === 'string' && projectAttribute.includes(sequentialTagValue)) {
        hasSequentialTag = true
        logDebug('Project', `  - found sequential tag '${sequentialTagValue}' in frontmatter '${combinedKey}' attribute`)
      }
      // Check metadata line hashtags
      if (!hasSequentialTag && hashtagsValue.length > 0) {
        hasSequentialTag = hashtagsValue.some((tag) => tag === sequentialTagValue)
        if (hasSequentialTag) {
          logDebug('Project', `  - found sequential tag '${sequentialTagValue}' in metadata line hashtags`)
        }
      }
      // Check metadata line content directly (as fallback)
      if (!hasSequentialTag && metadataLineValue.includes(sequentialTagValue)) {
        hasSequentialTag = true
        logDebug('Project', `  - found sequential tag '${sequentialTagValue}' in metadata line content`)
      }
    }

    // First, look for tagged next actions - use the first one found
    for (const nextActionTag of nextActionTags) {
      const nextActionParas = paras.filter(isOpen).filter((p) => p.content.match(nextActionTag))

      if (nextActionParas.length > 0) {
        const thisNextAction = nextActionParas[0].rawContent
        this.nextActionsRawContent.push(simplifyRawContent(thisNextAction))
        logDebug('Project', `  - found nextActionRawContent = ${thisNextAction}`)
        return // Found a tagged action, so we're done (at most 1 next action)
      }
    }

    // If no tagged next actions found, and hasSequentialTag is true, use first open item
    if (hasSequentialTag) {
      const firstOpenParas = paras.filter(isOpen)
      if (firstOpenParas.length > 0) {
        const firstOpenAction = firstOpenParas[0].rawContent
        this.nextActionsRawContent.push(simplifyRawContent(firstOpenAction))
        logDebug('Project', `  - found sequential nextActionRawContent = ${firstOpenAction}`)
      }
    }
  }

  /**
   * Prompt user for the details to make a progress line:
   * - new % complete
   * - new comment
   * And add to the metadata area of the note
   * @param {string} prompt message, to which is added the note title
   */
  async addProgressLine(prompt: string = 'Enter comment about current progress for'): Promise<void> {
    try {
      const thisFilename = this.note.filename
      // Figure out if we're working in the Editor or a note
      // Now have to check all open Editors, not just the current one.
      const possibleThisEditor = getOpenEditorFromFilename(thisFilename)
      if (possibleThisEditor) {
        logDebug('Project::addProgressLine', `Working in EDITOR '${possibleThisEditor.id}' for note '${thisFilename}'`)
      } else {
        logDebug('Project::addProgressLine', `Can't find open Editor for note '${thisFilename}', so will use DATASTORE note`)
      }
        
      const inputs = await promptAddProgressLineInputs(this.title, prompt, this.percentComplete)
      if(!inputs) {
        logDebug('Project::addProgressLine', `No valid progress line given.`)
        return
      }
      const { comment, progressDateStr, percentStr } = inputs
      if(percentStr === '') {
        logDebug('Project::addProgressLine', `No percent completion given.`)
} else if (isInt(percentStr)) {
  const resNum = parseFloat(percentStr)
  if (!isNaN(resNum)) {
    this.percentComplete = resNum
  }
      }

// Update the project's metadata (label "today" when the chosen date is today)
const progressDateLabel = progressDateStr === todaysDateISOString ? 'today' : progressDateStr
this.lastProgressComment = `${comment} (${progressDateLabel})`
const newProgressLine = `Progress: ${percentStr}@${progressDateStr} ${comment}`
const newProgressLineForFrontmatter = `${percentStr}@${progressDateStr} ${comment}`

      // Get progress heading and level from config
      const config = await getReviewSettings()
      const progressHeading = config?.progressHeading?.trim() ?? ''
      const progressHeadingLevel = config?.progressHeadingLevel ?? 2
      const writeMostRecentProgressToFrontmatter = config?.writeMostRecentProgressToFrontmatter ?? false

      // Optionally mirror the most recent progress line into frontmatter
      if (writeMostRecentProgressToFrontmatter) {
        const success = updateFrontMatterVars(this.note, { progress: newProgressLineForFrontmatter })
        if (success) {
          logDebug('Project::addProgressLine', `Updated frontmatter progress OK for '${this.title}'`)
          DataStore.updateCache(this.note, true)
        } else {
          logError('Project::addProgressLine', `Failed to update frontmatter progress for '${this.title}'`)
        }
      }

      // If progress heading is configured, use heading-based insertion
      if (progressHeading !== '') {
        logDebug('Project::addProgressLine', `Using progress heading: '${progressHeading}'`)
        
        // Check if Progress lines already exist
        const existingProgressLines = getFieldParagraphsFromNote(this.note, 'progress')
        
        if (existingProgressLines.length > 0) {
          // Progress lines exist - check if heading exists
          const headingPara = findHeading(this.note, progressHeading)
          
          if (headingPara == null) {
            // Heading doesn't exist - insert it above the first Progress line
            const firstProgressLine = existingProgressLines.reduce((earliest, current) => 
              current.lineIndex < earliest.lineIndex ? current : earliest
            )
            let firstProgressLineIndex = firstProgressLine.lineIndex
            
            // Ensure we don't insert at line 0 or immediately after frontmatter (which is typically the title)
            const endOfFMIndex = endOfFrontmatterLineIndex(this.note) || 0
            const titleLineIndex = endOfFMIndex > 0 ? endOfFMIndex + 1 : 0
            
            // Check if the insertion point is at line 0 or at the title line (first line after frontmatter)
            if (firstProgressLineIndex === 0 || (endOfFMIndex > 0 && firstProgressLineIndex === titleLineIndex)) {
              // Check if the line at titleLineIndex is actually a title
              const titlePara = this.note.paragraphs[titleLineIndex]
              const isTitleLine = titlePara && titlePara.type === 'title' && titlePara.headingLevel === 1
              
              if (firstProgressLineIndex === 0) {
                logWarn('Project::addProgressLine', `First Progress line is at line 0, adjusting to avoid overwriting title`)
                // If line 0 is a title, insert after it; otherwise insert at line 1
                firstProgressLineIndex = isTitleLine ? 1 : 1
              } else if (isTitleLine) {
                logWarn('Project::addProgressLine', `First Progress line is at title line (${String(titleLineIndex)}), adjusting to avoid overwriting title`)
                // Insert after the title line
                firstProgressLineIndex = titleLineIndex + 1
              } else {
                // Not a title, but still at the first line after frontmatter - move to at least line 1
                firstProgressLineIndex = Math.max(1, firstProgressLineIndex + 1)
              }
            }
            
            logDebug('Project::addProgressLine', `Inserting heading '${progressHeading}' above first Progress line at line ${String(firstProgressLineIndex)}`)
            
            // Insert heading above first Progress line
            if (possibleThisEditor) {
              // $FlowFixMe[incompatible-call]
              possibleThisEditor.insertHeading(progressHeading, firstProgressLineIndex, progressHeadingLevel)
              await possibleThisEditor.save()
            } else {
              // $FlowFixMe[incompatible-call]
              this.note.insertHeading(progressHeading, firstProgressLineIndex, progressHeadingLevel)
              await DataStore.updateCache(this.note, true)
            }
          }
          
          // Now add the progress line under the heading (heading is guaranteed to exist)
          logDebug('Project::addProgressLine', `Adding progress line under heading '${progressHeading}'`)
          this.note.addParagraphBelowHeadingTitle(newProgressLine, 'text', progressHeading, false, false)
          
          if (possibleThisEditor) {
            await possibleThisEditor.save()
          } else {
            await DataStore.updateCache(this.note, true)
          }
        } else {
          // No Progress lines exist: add new Progress Section heading (if needed) and the first progress line
          logDebug('Project::addProgressLine', `No existing Progress lines, so creating new Section heading '${progressHeading}' if needed after preamble`)
          createSectionsAndParaAfterPreamble(this.note, newProgressLine, 'text', [progressHeading], progressHeadingLevel)
          
          if (possibleThisEditor) {
            await possibleThisEditor.save()
          } else {
            await DataStore.updateCache(this.note, true)
          }
        }
      } else {
        // No progress heading configured - use existing logic
        // Set insertion point for the new progress line to this paragraph,
        // or if none exist, to the line after the current metadata line
        let insertionIndex = this.mostRecentProgressLineIndex
        if (isNaN(insertionIndex)) {
          insertionIndex = endOfPreambleSection(this.note)
          logDebug('Project::addProgressLine', `No progress paragraphs found, so will insert new progress line after metadata at line ${String(insertionIndex)}`)
        } else {
          logDebug('Project::addProgressLine', `Will insert new progress line before most recent progress line at ${String(insertionIndex)}.`)
        }
        
        // Ensure we don't insert at line 0 (which is typically the title)
        if (insertionIndex === 0) {
          logWarn('Project::addProgressLine', `Insertion index is 0, adjusting to line 1 to avoid overwriting title`)
          insertionIndex = 1
        }

        // And write it to the Editor (if the note is open in it) ...
        if (possibleThisEditor) {
          logDebug('Project::addProgressLine', `Writing '${newProgressLine}' to Editor at line ${String(insertionIndex)}`)
          possibleThisEditor.insertParagraph(newProgressLine, insertionIndex, 'text')
          logDebug('Project::addProgressLine', `- finished thisEditor.insertParagraph`)
          await possibleThisEditor.save()
          logDebug('Project::addProgressLine', `- after Editor.save`)
        }
        // ... or the project's note
        else {
          logDebug('Project::addProgressLine', `Writing '${newProgressLine}' to project note '${this.note.filename}' at line ${String(insertionIndex)}`)
          this.note.insertParagraph(newProgressLine, insertionIndex, 'text')
          logDebug('Project::addProgressLine', `- finished this.note.insertParagraph`)
          await DataStore.updateCache(this.note, true)
          logDebug('Project::addProgressLine', `- after DataStore.updateCache`)
        }
      }

      // If we're in Editor, then need to update display
      if (possibleThisEditor) {
        await saveEditorIfNecessary()
        logDebug('Project::addProgressLine', `- Editor saved; will now re-open note in that Editor window`)
        await possibleThisEditor.openNoteByFilename(thisFilename)
        logDebug('Project::addProgressLine', `- note re-opened in Editor window`)
      }
    } catch (error) {
      logError(`Project::addProgressLine`, JSP(error))
    }
  }

/**
 * Clear next-review fields so the `nextReview` frontmatter key is removed on the next metadata write.
 * Used when pausing, completing, or cancelling a project.
 * @private
 */
clearNextReviewMetadata(): void {
  clearNextReviewMetadataFields(this)
}

  /**
   * Process the 'Progress:...' lines to retrieve metadata. Allowed forms are:
   *   Progress: n@YYYY-MM-DD message   (n = 0-100, preferred; also YYYYMMDD)
   *   Progress: n:YYYY-MM-DD message
   *   Progress: YYYY-MM-DD message     [in which case % is calculated from tasks]
   * + variations with optional ':' after the date (parsed either way)
   */
  processProgressLines(): void {
    // Get specific 'Progress' field lines
    const progressParas = getFieldParagraphsFromNote(this.note, 'Progress')
    // logDebug('Project::processProgressLines', `  - found ${String(progressParas.length)} progress lines for ${this.title}`)

    if (progressParas.length > 0) {
      // Get the most recent progressItem from these lines
      const progressItem: Progress = processMostRecentProgressParagraph(progressParas)
      this.percentComplete = progressItem.percentComplete
      this.lastProgressComment = progressItem.comment
      this.mostRecentProgressLineIndex = progressItem.lineIndex
      // logDebug('Project::processProgressLines', `  -> ${String(this.percentComplete)}% from progress line`)
      // logDebug('Project::processProgressLines', `  -> lastProgressComment: ${this.lastProgressComment}`)
    } else {
      // logDebug('Project::processProgressLines', `- no progress fields found`)
    }
  }

  /**
   * Close a Project/Area note by updating the metadata and saving it:
   * - adding @completed(<today's date>)
   * @author @jgclark
   * @returns {boolean} true if metadata was updated and saved successfully, false otherwise
   */
  completeProject(): boolean {
    try {
      // update the metadata fields
      this.isCompleted = true
      this.isCancelled = false
      this.isPaused = false
      this.completedDate = moment().format('YYYY-MM-DD') // ISO date string (local timezone)
      this.calculateDueDays()
      this.calculateCompletedOrCancelledDurations()
      this.clearNextReviewMetadata()

      // re-write the note's metadata line
      logDebug('completeProject', `Completing '${this.title}' ...`)
      this.updateMetadataAndSave()
      logDebug('completeProject', `- metadata updated and note saved`)
      return true
    }
    catch (error) {
      logError(pluginJson, `Error completing project for ${this.title}: ${error.message}`)
      return false
    }
  }

  /**
   * Cancel a Project/Area note by updating the metadata and saving it:
   * - adding @cancelled(<today's date>)
   * @author @jgclark
   * @returns {boolean} true if metadata was updated and saved successfully, false otherwise
   */
  cancelProject(): boolean {
    try {
      // update the metadata fields
      this.isCompleted = false
      this.isCancelled = true
      this.isPaused = false
      this.cancelledDate = moment().format('YYYY-MM-DD') // ISO date string (local timezone)
      this.calculateDueDays()
      this.calculateCompletedOrCancelledDurations()
      this.clearNextReviewMetadata()

      // re-write the note's metadata line
      logDebug('cancelProject', `Cancelling '${this.title}' ...`)
      this.updateMetadataAndSave()
      logDebug('cancelProject', `- metadata updated and note saved`)
      return true
    }
    catch (error) {
      logError(pluginJson, `Error cancelling project for ${this.title}: ${error.message}`)
      return false
    }
  }

  /**
   * Cancel a Project/Area note by updating the metadata and saving it:
   * - adding #paused
   * @author @jgclark
   * @returns {boolean} true if metadata was updated and saved successfully, false otherwise
   */
  async togglePauseProject(): Promise<boolean> {
    try {
      // Get progress field details (if wanted)
      logDebug('togglePauseProject', `Starting for '${this.title}' ...`)
      await this.addProgressLine(this.isPaused ? 'Comment (if wanted) as you resume' : 'Comment (if wanted) as you pause')

      // update the metadata fields
      this.isCompleted = false
      this.isCancelled = false
      this.isPaused = !this.isPaused // toggle

      // Also set the reviewed date to today
      this.reviewedDate = moment().format('YYYY-MM-DD') // ISO date string (local timezone)
      if(this.isPaused) {
  this.clearNextReviewMetadata()
}

      // re-write the note's metadata line
      logDebug('togglePauseProject', `Paused state now toggled to ${String(this.isPaused)} for '${this.title}' ...`)
      const newMetadataLine = this.generateMetadataOutputLine()
      logDebug('togglePauseProject', `- metadata now '${newMetadataLine}'`)

const nextReviewKey = checkString(DataStore.preference('nextReviewMentionStr') || '').replace(/^[@#]/, '') || 'nextReview'
this.updateProjectMetadata(newMetadataLine, {
  preserveSeparateKeysWhenEmptyOnProject: true,
  explicitKeysToRemoveFromFrontmatter: this.isPaused ? [nextReviewKey] : [],
})
      const possibleThisEditor = getOpenEditorFromFilename(this.note.filename)
      if (possibleThisEditor) {
        await possibleThisEditor.save()
      }

      // if we want to remove all due dates on pause, then do that
      if (this.isPaused) {
        const config = await getReviewSettings()
        if (config.removeDueDatesOnPause) {
          logDebug('togglePauseProject', `- project now paused, and we want to remove due dates ...`)
          const res = removeAllDueDates(this.filename)
        }
      }

      logDebug('togglePauseProject', `- metadata updated and note saved`)
      return true
    }
    catch (error) {
      logError(pluginJson, `Error pausing project for ${this.title}: ${error.message}`)
      return false
    }
  }

  /**
   * Generate a one-line tab-sep summary line ready for Markdown note
   */
  generateMetadataOutputLine(writeDateMentions: boolean = shouldWriteDateMentionsInCombinedMetadata()): string {
    const parts: Array<string> = [... this.allProjectTags]
    if (this.isPaused) parts.push('#paused')
    if (this.reviewInterval != null) {
      parts.push(`${checkString(DataStore.preference('reviewIntervalMentionStr'))}(${checkString(this.reviewInterval)})`)
    }

    // Only include date mentions if we're writing them to the combined metadata key
    if (writeDateMentions) {
      const startDate = this.startDate
      if (startDate != null) {
        parts.push(`${checkString(DataStore.preference('startMentionStr'))}(${startDate})`)
      }
      const dueDate = this.dueDate
      if (dueDate != null) {
        parts.push(`${checkString(DataStore.preference('dueMentionStr'))}(${dueDate})`)
      }
      const reviewedDate = this.reviewedDate
      if (reviewedDate != null) {
        parts.push(`${checkString(DataStore.preference('reviewedMentionStr'))}(${reviewedDate})`)
      }
      const completedDate = this.completedDate
      if (completedDate != null) {
        parts.push(`${checkString(DataStore.preference('completedMentionStr'))}(${completedDate})`)
      }
      const cancelledDate = this.cancelledDate
      if (cancelledDate != null) {
        parts.push(`${checkString(DataStore.preference('cancelledMentionStr'))}(${cancelledDate})`)
      }
    }
    return parts.join(' ')
  }

}

/**
 * Clear next-review fields on a Project instance or a plain project-like object from {@link createImmutableProjectCopy} / {@link calcReviewFieldsForProject} (those copies have no prototype methods).
 * @param {Project} project
 */
export function clearNextReviewMetadataFields(project: Project): void {
  project.nextReviewDateStr = null
  project.nextReviewDays = NaN
}

//-----------------------------------------------------------------
// Non-Class versions of the same functions
//-----------------------------------------------------------------

/**
 * Type for updatable Project fields in helper functions
 */
type ProjectUpdates = {
  dueDays?: number,
  nextReviewDateStr?: ?string,
  nextReviewDays?: number,
  completedDuration?: ?string,
  cancelledDuration?: ?string,
}

/**
 * Create an immutable copy of a Project with updated properties.
 * Returns a new object with all properties from the original plus any updates.
 * @param {Project} project - The original Project instance
 * @param {ProjectUpdates} updates - Object with properties to update
 * @returns {Project} - New immutable Project-like object
 */
function createImmutableProjectCopy(project: Project, updates: ProjectUpdates = {}): Project {
  // $FlowIgnore[incompatible-return] - Object literal has all Project properties, compatible for our use case
  return {
    note: project.note,
    filename: project.filename,
    folder: project.folder,
    metadataParaLineIndex: project.metadataParaLineIndex,
    title: project.title,
    startDate: project.startDate,
    dueDate: project.dueDate,
    dueDays: updates.dueDays !== undefined ? updates.dueDays : project.dueDays,
    reviewedDate: project.reviewedDate,
    reviewInterval: project.reviewInterval,
    nextReviewDateStr: updates.nextReviewDateStr !== undefined ? updates.nextReviewDateStr : project.nextReviewDateStr,
    nextReviewDays: updates.nextReviewDays !== undefined ? updates.nextReviewDays : project.nextReviewDays,
    completedDate: project.completedDate,
    completedDuration: updates.completedDuration !== undefined ? updates.completedDuration : project.completedDuration,
    cancelledDate: project.cancelledDate,
    cancelledDuration: updates.cancelledDuration !== undefined ? updates.cancelledDuration : project.cancelledDuration,
    numOpenItems: project.numOpenItems,
    numCompletedItems: project.numCompletedItems,
    numTotalItems: project.numTotalItems,
    numWaitingItems: project.numWaitingItems,
    numFutureItems: project.numFutureItems,
    isCompleted: project.isCompleted,
    isCancelled: project.isCancelled,
    isPaused: project.isPaused,
    percentComplete: project.percentComplete,
    lastProgressComment: project.lastProgressComment,
    mostRecentProgressLineIndex: project.mostRecentProgressLineIndex,
    nextActionsRawContent: project.nextActionsRawContent,
    ID: project.ID,
    icon: project.icon,
    iconColor: project.iconColor,
    allProjectTags: project.allProjectTags ?? [],
    noteChangedAtMs: project.noteChangedAtMs,
  }
}

/**
 * Normalise a possibly non-ISO date string to strict ISO format (YYYY-MM-DD), or null if invalid.
 * Handles legacy full ISO datetime strings (e.g. 'YYYY-MM-DDTHH:mm:ss.sssZ') by truncating to the date part.
 * @param {?string} dateStrIn
 * @param {string} context - description for logging
 * @returns {?string} normalised ISO date string or null
 * @private
 */
function normaliseISODateString(dateStrIn: ?string, context: string): ?string {
  if (typeof dateStrIn !== 'string' || dateStrIn === '') {
    return null
  }

  const reISODate = new RegExp(`^${RE_DATE}$`)
  if (reISODate.test(dateStrIn)) {
    return dateStrIn
  }

  // Handle full ISO datetime 'YYYY-MM-DDTHH:mm:ss.sssZ' by truncating to the date part
  const isoDateTimeMatch = dateStrIn.match(/^(\d{4}-\d{2}-\d{2})T/)
  if (isoDateTimeMatch && isoDateTimeMatch[1]) {
    const truncated = isoDateTimeMatch[1]
    if (reISODate.test(truncated)) {
      logWarn('normaliseISODateString', `Truncating full ISO datetime '${dateStrIn}' to '${truncated}' for ${context}`)
      return truncated
    }
  }

  logWarn('normaliseISODateString', `Invalid date string '${dateStrIn}' for ${context}; treating as null`)
  return null
}

/**
 * From a Project metadata object read in, calculate updated due/finished durations, and return an immutable updated Project object.
 * On error, returns the original Project object.
 * @author @jgclark
 * @param {Project} thisProjectIn
 * @returns {Project}
*/
export function calcDurationsForProject(thisProjectIn: Project): Project {
  try {
    const now = moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
    
    // Calculate # days until due
    const dueDays = thisProjectIn.dueDate != null
      ? daysBetween(now, thisProjectIn.dueDate)
      : NaN

    // Calculate durations or time since cancel/complete
    // logDebug('calcDurationsForProject', String(thisProjectIn.startDate ?? 'no startDate'))
    
    let completedDuration = thisProjectIn.completedDuration
    let cancelledDuration = thisProjectIn.cancelledDuration

    if (thisProjectIn.completedDate != null) {
      completedDuration = formatDurationString(thisProjectIn.completedDate, thisProjectIn.startDate ?? undefined, true)
      // logDebug('calcDurationsForProject', `-> completedDuration = ${completedDuration}`)
    } else if (thisProjectIn.cancelledDate != null) {
      cancelledDuration = formatDurationString(thisProjectIn.cancelledDate, thisProjectIn.startDate ?? undefined, true)
      // logDebug('calcDurationsForProject', `-> cancelledDuration = ${cancelledDuration}`)
    } else {
      // logDebug('calcDurationsForProject', `No completed or cancelled dates.`)
    }
    
    return createImmutableProjectCopy(thisProjectIn, {
      dueDays,
      completedDuration,
      cancelledDuration,
    })
  } catch (error) {
    logError('calcDurationsForProject', error.message)
    return thisProjectIn
  }
}

/**
 * From a Project metadata object read in, calculate updated next review date, and return an immutable updated Project object.
 * On error, returns the original Project object.
 * @author @jgclark
 * @param {Project} thisProjectIn
 * @returns {Project}
 */
export function calcReviewFieldsForProject(thisProjectIn: Project): Project {
  try {
    // logDebug('calcReviewFieldsForProject', `Starting for '${thisProjectIn.title}' ...`)
    const now = moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone

    // Calculate next review due date, if there isn't already a nextReviewDateStr, and there's a review interval.
    let nextReviewDateStr: ?string = thisProjectIn.nextReviewDateStr
    let nextReviewDays: number = thisProjectIn.nextReviewDays

    // First check to see if project start is in future: if so set nextReviewDateStr to project start
    const rawStartDateIn = thisProjectIn.startDate
    const startDateIn = normaliseISODateString(rawStartDateIn, 'startDate')
    if (startDateIn != null) {
      const momTSD = moment(startDateIn)
      if (momTSD.isAfter(now)) {
        nextReviewDateStr = startDateIn
        nextReviewDays = daysBetween(now, startDateIn)
        logDebug('calcReviewFieldsForProject', `project start is in future (${momTSD.format('YYYY-MM-DD')}) -> ${String(nextReviewDays)} interval`)
      }
    }

    // Now check to see if we have a specific nextReviewDateStr
    const rawNextReviewDateStrIn = thisProjectIn.nextReviewDateStr
    const normalisedNextReviewDateStr = normaliseISODateString(rawNextReviewDateStrIn, 'nextReviewDateStr')

    if (normalisedNextReviewDateStr != null) {
      nextReviewDateStr = normalisedNextReviewDateStr
      nextReviewDays = daysBetween(now, normalisedNextReviewDateStr)
      // logDebug('calcReviewFieldsForProject', `- already had a nextReviewDateStr ${normalisedNextReviewDateStr ?? '?'} -> ${String(nextReviewDays)} interval`)
    } else if (thisProjectIn.reviewInterval != null) {
      const reviewedDateIn = thisProjectIn.reviewedDate
      if (typeof reviewedDateIn === 'string' && reviewedDateIn !== '') {
        const calculatedNextReviewDateStr = calcNextReviewDate(reviewedDateIn, thisProjectIn.reviewInterval)
        const hasValidCalculated = calculatedNextReviewDateStr != null && calculatedNextReviewDateStr !== ''
        if (hasValidCalculated) {
          const safeCalculatedNextReviewDateStr = normaliseISODateString(calculatedNextReviewDateStr, 'calculatedNextReviewDateStr')
          if (safeCalculatedNextReviewDateStr != null) {
            nextReviewDateStr = safeCalculatedNextReviewDateStr
            // this now uses moment and truncated (not rounded) date diffs in number of days
            nextReviewDays = daysBetween(now, safeCalculatedNextReviewDateStr)
            // logDebug('calcReviewFieldsForProject', `${String(thisProjectIn.reviewedDate)} + ${thisProjectIn.reviewInterval ?? ''} -> nextReviewDateStr: ${nextReviewDateStr ?? ''} = ${String(nextReviewDays) ?? '-'}`)
          } else {
            // Fall back to today rather than throwing (e.g. if calcNextReviewDate returned an unexpected format)
            nextReviewDateStr = moment().format('YYYY-MM-DD')
            nextReviewDays = 0
            logWarn('calcReviewFieldsForProject', `Could not normalise calculated nextReviewDate '${String(calculatedNextReviewDateStr)}' for project '${thisProjectIn.title}'; using today`)
          }
        } else {
          // No valid calculated date (null or empty): treat next review as today
          nextReviewDateStr = moment().format('YYYY-MM-DD')
          nextReviewDays = 0
          logDebug('calcReviewFieldsForProject', `calcNextReviewDate returned no date for reviewedDate=${String(reviewedDateIn)}; using today`)
        }
      } else {
        // no next review date, so set at today
        nextReviewDateStr = moment().format('YYYY-MM-DD')
        nextReviewDays = 0
      }
    }
    // logDebug('calcReviewFieldsForProject', `-> reviewedDate = ${String(thisProjectIn.reviewedDate)} / nextReviewDateStr = ${String(nextReviewDateStr)} / nextReviewDays = ${String(nextReviewDays)}`)
    
    return createImmutableProjectCopy(thisProjectIn, {
      nextReviewDateStr,
      nextReviewDays,
    })
  } catch (error) {
    logError('calcReviewFieldsForProject', `${error.message} in project '${thisProjectIn.title}'`)
    return thisProjectIn
  }
}
