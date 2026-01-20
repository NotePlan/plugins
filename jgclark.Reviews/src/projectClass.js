// @flow
//-----------------------------------------------------------------------------
// Project class definition for Review plugin
// by Jonathan Clark
// Last updated 2026-01-20 for v1.3.0.b5, @jgclark
//-----------------------------------------------------------------------------

// Import Helper functions
import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  calcNextReviewDate,
  getFieldParagraphsFromNote,
  getOrMakeMetadataLine,
  getParamMentionFromList,
  getReviewSettings,
  processMostRecentProgressParagraph,
} from './reviewHelpers'
import { checkBoolean, checkNumber, checkString } from '@helpers/checkType'
import {
  daysBetween,
  getDateObjFromDateString,
  includesScheduledFurtherFutureDate,
  todaysDateISOString,
  toISODateString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { saveEditorIfNecessary } from '@helpers/NPEditor'
import { getFolderFromFilename } from '@helpers/folders'
import { getContentFromBrackets, getStringFromList } from '@helpers/general'
import { getFrontmatterAttribute, updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { removeAllDueDates } from '@helpers/NPParagraph'
import { findHeading, findStartOfActivePartOfNote, simplifyRawContent, smartCreateSectionsAndPara } from '@helpers/paragraph'
import {
  getInputTrimmed,
  inputIntegerBounded,
} from '@helpers/userInput'
import { isClosedTask, isClosed, isOpen, isOpenTask } from '@helpers/utils'

//-----------------------------------------------------------------------------
// Types

export type Progress = {
  lineIndex: number,
  percentComplete: number,
  date: Date,
  comment: string
}

//-----------------------------------------------------------------------------
// Helpers

/**
 * Calculate duration string for a date, optionally relative to a start date.
 * If startDate is provided, returns "after X" format. Otherwise returns relative time (e.g., "2 days ago", "today").
 * @param {Date} date - The date to calculate duration for
 * @param {?Date} startDate - Optional start date for calculating duration between dates
 * @returns {string} Duration string
 * @private
 */
function formatDurationString(date: Date, startDate?: Date): string {
  if (startDate != null && startDate instanceof Date) {
    return `after ${moment(startDate).to(moment(date), true)}`
  } else {
    let duration = moment(date).fromNow()
    if (duration.includes('hours')) {
      duration = 'today'
    }
    return duration
  }
}

/**
 * Define 'Project' class to use in GTD.
 * Holds title, last reviewed date, due date, review interval, completion date, progress information that is read from the note,
 * and other derived data.
 * @example To create a project instance for a note call 'const x = new Project(note, ...)'
 * @author @jgclark
 */
export class Project {
  // Types for the class instance properties
  note: TNote
  filename: string
  folder: string
  metadataParaLineIndex: number
  projectTag: string // #project, #area, etc.
  title: string
  startDate: ?Date
  dueDate: ?Date
  dueDays: number = NaN
  reviewedDate: ?Date
  reviewInterval: string // later will default to '1w' if needed
  nextReviewDateStr: ?string // The next review date in YYYY-MM-DD format (can be set by user or calculated)
  nextReviewDays: number = NaN
  completedDate: ?Date
  completedDuration: ?string // string description of time to completion, or how long ago completed
  cancelledDate: ?Date
  cancelledDuration: ?string // string description of time to cancellation, or how long ago cancelled
  numOpenItems: number
  numCompletedItems: number
  numTotalItems: number
  numWaitingItems: number
  numFutureItems: number
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

  constructor(note: TNote, projectTypeTag: string = '', checkEditor: boolean = true, nextActionTags: Array<string> = [], sequentialTag: string = '') {
    try {
      const startTime = new Date()
      if (note == null || note.title == null) {
        throw new Error('Error in constructor: invalid note passed')
      }
      this.title = note.title
      this.filename = note.filename
      // logDebug('Project', `Starting for type ${projectTypeTag}, ${this.filename}`)
      this.folder = getFolderFromFilename(note.filename)

      // Make a (nearly) unique number for this instance (needed for the addressing the SVG circles) -- I can't think of a way of doing this neatly to create one-up numbers, that doesn't create clashes when re-running over a subset of notes
      this.ID = String(Math.round((Math.random()) * 99999))
      // TODO: Cursor suggests a more robust approach, instead of random number:
      // this.ID = `${this.filename}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Sometimes we're called just after a note has been updated in the Editor. So check to see if note is open in Editor, and if so use that version, which could be newer.
      // (Unless 'checkEditor' false, to avoid triggering 'You are running this on an async thread' warnings.)
      let paras: Array<TParagraph>
      if (checkEditor && Editor && Editor.note && (Editor.note.filename === note.filename)) {
        const editorNote: CoreNoteFields = Editor.note
        paras = editorNote.paragraphs
        this.note = Editor.note // Note: not plain Editor, as otherwise it isn't the right type and will throw app run-time errors later.
        const versionDateMS = editorNote.versions && editorNote.versions.length > 0 ? new Date(editorNote.versions[0].date).getTime() : NaN
        const timeSinceLastEdit: number = isNaN(versionDateMS) ? NaN : Date.now() - versionDateMS
        logDebug('Project', `- using EDITOR for (${Editor.filename}), last updated ${String(timeSinceLastEdit)}ms ago.} `)
      } else {
        // read note from DataStore in the usual way
        paras = note.paragraphs
        this.note = note
        // logDebug('Project', `- read note from datastore `)
      }

      const metadataLineIndex = getOrMakeMetadataLine(note)
      // this.metadataPara = paras[metadataLineIndex]
      this.metadataParaLineIndex = metadataLineIndex
      let mentions: $ReadOnlyArray<string> = note.mentions ?? [] // Note: can be out of date, and I can't find a way of fixing this, even with updateCache()
      let hashtags: $ReadOnlyArray<string> = note.hashtags ?? [] // Note: can be out of date
      const metadataLine = paras[metadataLineIndex].content
      if (mentions.length === 0) {
        logDebug('Project', `- Grr: .mentions empty: will use metadata line instead`)
        // Note: If necessary, fall back to getting mentions just from the metadataLine
        mentions = (`${metadataLine} `).split(' ').filter((f) => f[0] === '@')
      }
      if (hashtags.length === 0) {
        hashtags = (`${metadataLine} `).split(' ').filter((f) => f[0] === '#')
      }

      // work out projectTag:
      // - if projectTypeTag given, then use that
      // - else first or second hashtag in note
      try {
        this.projectTag = (projectTypeTag)
          ? projectTypeTag
          : (hashtags[0] !== '#paused')
            ? hashtags[0]
            : (hashtags[1])
              ? hashtags[1]
              : ''
      } catch (e) {
        this.projectTag = ''
        logWarn('Project', `- found no projectTag for '${this.title}' in folder ${this.folder}`)
      }

      // read in various metadata fields (if present)
      this.startDate = this.parseDateMention(mentions, 'startMentionStr')
      this.dueDate = this.parseDateMention(mentions, 'dueMentionStr')
      // read in reviewed date (if present)
      // Note: doesn't pick up reviewed() if not in metadata line
      this.reviewedDate = this.parseDateMention(mentions, 'reviewedMentionStr')
      // read in completed date (if present)
      this.completedDate = this.parseDateMention(mentions, 'completedMentionStr')
      // read in cancelled date (if present)
      this.cancelledDate = this.parseDateMention(mentions, 'cancelledMentionStr')
      // read in review interval (if present)
      const tempIntervalStr = getParamMentionFromList(mentions, checkString(DataStore.preference('reviewIntervalMentionStr')))
      // $FlowIgnore[incompatible-type]
      this.reviewInterval = tempIntervalStr !== '' ? getContentFromBrackets(tempIntervalStr) : '1w'
      // read in nextReview date (if present)
      const nextReviewStr = getParamMentionFromList(mentions, checkString(DataStore.preference('nextReviewMentionStr')))
      if (nextReviewStr !== '') {
        // Extract date using regex instead of hardcoded slice indices
        const dateMatch = nextReviewStr.match(/@nextReview\((\d{4}-\d{2}-\d{2})\)/)
        if (dateMatch && dateMatch[1]) {
          this.nextReviewDateStr = dateMatch[1]
        }
      }

      // read in icon and iconColor from frontmatter (if present)
      const iconValue = getFrontmatterAttribute(note, 'icon')
      this.icon = iconValue != null && iconValue !== '' ? iconValue : undefined
      const iconColorValue = getFrontmatterAttribute(note, 'icon-color')
      this.iconColor = iconColorValue != null && iconColorValue !== '' ? iconColorValue : undefined

      // count tasks (includes both tasks and checklists)
      const ignoreChecklistsInProgress = checkBoolean(DataStore.preference('ignoreChecklistsInProgress')) || false
      const numberDaysForFutureToIgnore = checkNumber(DataStore.preference('numberDaysForFutureToIgnore')) || 0
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
      this.processProgressLines()

      // If percentComplete not set via progress line, then calculate
      if (this.lastProgressComment === '' || isNaN(this.percentComplete)) {
        this.calculatePercentComplete(numberDaysForFutureToIgnore)
      }

      // If we want to track next actions, find any tagged next actions or sequential first open task/checklist
      if (nextActionTags.length > 0 || sequentialTag !== '') {
        this.generateNextActionComments(nextActionTags, paras, sequentialTag, Array.from(hashtags ?? []), metadataLine)
      }

      if (this.title.includes('TEST')) {
        logDebug('Project', `Constructed ${this.projectTag} ${this.filename}:`)
        logDebug('Project', `  - folder = ${this.folder}`)
        logDebug('Project', `  - metadataLine = ${metadataLine}`)
        if (this.isCompleted) logDebug('Project', `  - isCompleted ✔️`)
        if (this.isCancelled) logDebug('Project', `  - isCancelled ✔️`)
        if (this.isPaused) logDebug('Project', `  - isPaused ✔️`)
        logDebug('Project', `  - mentions: ${String(mentions)}`)
        // logDebug('Project', `  - altMentions: ${String(altMentions)}`)
        logDebug('Project', `  - hashtags: ${String(hashtags)}`)
        // logDebug('Project', `  - altHashtags: ${String(altHashtags)}`)
        logDebug('Project', `  - ${String(this.numTotalItems)} items: open:${String(this.numOpenItems)} completed:${String(this.numCompletedItems)} waiting:${String(this.numWaitingItems)} future:${String(this.numFutureItems)}`)
        logDebug('Project', `  - completed: ${String(this.numCompletedItems)}`)
        if (this.mostRecentProgressLineIndex >= 0) logDebug('Project', `  - progress: #${String(this.mostRecentProgressLineIndex)} = ${this.lastProgressComment}`)
        logDebug('Project', `  - % complete = ${String(this.percentComplete)}`)
        logDebug('Project', `  - nextAction = <${String(this.nextActionsRawContent)}>`)
      } else {
        logTimer('Project', startTime, `Constructed ${this.projectTag} ${this.filename}: ${this.nextReviewDateStr ?? '-'} / ${String(this.nextReviewDays)} / ${this.isCompleted ? ' completed' : ''}${this.isCancelled ? ' cancelled' : ''}${this.isPaused ? ' paused' : ''}`)
      }
    }
    catch (error) {
      logError('Project', error.message)
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
   * Parse a date mention from the mentions list
   * @param {Array<string>|$ReadOnlyArray<string>} mentions - Array of mention strings
   * @param {string} mentionKey - The preference key for the mention string
   * @returns {?Date} Parsed date or undefined
   * @private
   */
  parseDateMention(mentions: $ReadOnlyArray<string>, mentionKey: string): ?Date {
    const tempStr = getParamMentionFromList(mentions, checkString(DataStore.preference(mentionKey)))
    return tempStr !== '' ? getDateObjFromDateString(tempStr) : undefined
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
   * @param {Date} date - The completion or cancellation date
   * @param {?Date} startDate - Optional start date
   * @returns {string} Duration string
   * @private
   */
  calculateDurationString(date: Date, startDate?: Date): string {
    return formatDurationString(date, startDate)
  }

  /**
   * Update metadata line, handling both frontmatter and regular paragraph storage
   * @param {string} newMetadataLine - The new metadata line content (without "metadata:" prefix)
   * @private
   */
  updateMetadataLine(newMetadataLine: string): void {
    const metadataPara = this.note.paragraphs[this.metadataParaLineIndex]
    const currentContent = metadataPara.content

    // Check if metadata is stored in frontmatter (content starts with "metadata:")
    const isInFrontmatter = currentContent.match(/^metadata:\s*/i) != null

    if (isInFrontmatter) {
      // Update using frontmatter helper to preserve the "metadata:" key
      logDebug('updateMetadataLine', `Updating frontmatter metadata for '${this.title}'`)
      const success = updateFrontMatterVars(this.note, { metadata: newMetadataLine })
      if (success) {
        DataStore.updateCache(this.note, true)
      } else {
        logError('updateMetadataLine', `Failed to update frontmatter metadata for '${this.title}'`)
      }
    } else {
      // Update regular paragraph content (existing behavior)
      metadataPara.content = newMetadataLine
      if (Editor && Editor.note && Editor.note === this.note) {
        Editor.updateParagraph(metadataPara)
        DataStore.updateCache(this.note, true)
      } else {
        this.note.updateParagraph(metadataPara)
        DataStore.updateCache(this.note, true)
      }
    }
  }

  /**
   * Update metadata paragraph and save to Editor or note
   * @private
   */
  updateMetadataAndSave(): void {
    const newMetadataLine = this.generateMetadataOutputLine()
    this.updateMetadataLine(newMetadataLine)
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
      if (this.startDate != null && this.startDate instanceof Date) {
        const thisStartDate: Date = this.startDate // to satisfy flow
        const momTSD = moment(thisStartDate)
        if (momTSD.isAfter(now)) {
          this.nextReviewDateStr = toISODateString(thisStartDate)
          this.nextReviewDays = daysBetween(now, thisStartDate)
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
          const calculatedNextReviewDate = calcNextReviewDate(this.reviewedDate, this.reviewInterval)
          if (calculatedNextReviewDate != null) {
            // Convert Date to ISO date string (YYYY-MM-DD)
            this.nextReviewDateStr = toISODateString(calculatedNextReviewDate)
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
      logError('calcNextReviewDate', error.message)
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
      // Check frontmatter 'project' attribute
      const projectAttribute = getFrontmatterAttribute(this.note, 'project')
      if (projectAttribute && typeof projectAttribute === 'string' && projectAttribute.includes(sequentialTagValue)) {
        hasSequentialTag = true
        logDebug('Project', `  - found sequential tag '${sequentialTagValue}' in frontmatter 'project' attribute`)
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

    // If sequential tag found, add first open task/checklist
    if (hasSequentialTag) {
      const firstOpenParas = paras.filter(isOpen)
      if (firstOpenParas.length > 0) {
        const firstOpenAction = firstOpenParas[0].rawContent
        this.nextActionsRawContent.push(simplifyRawContent(firstOpenAction))
        logDebug('Project', `  - found sequential nextActionRawContent = ${firstOpenAction}`)
      }
    }

  // Process tagged next actions
    for (const nextActionTag of nextActionTags) {
      const nextActionParas = paras.filter(isOpen).filter((p) => p.content.match(nextActionTag))

      if (nextActionParas.length > 0) {
        const thisNextAction = nextActionParas[0].rawContent
        this.nextActionsRawContent.push(simplifyRawContent(thisNextAction))
        logDebug('Project', `  - found nextActionRawContent = ${thisNextAction}`)
      }
    }
    // If we have more than one next action, then its rare but possible to get valid duplicates, so dedupe them to make it look more sensible
    if (this.nextActionsRawContent.length > 1) {
      this.nextActionsRawContent = this.nextActionsRawContent.filter((na, index, self) => self.indexOf(na) === index)
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
      // Figure out if we're working in the Editor or a note
      const isInEditor = Editor && Editor.note && Editor.note.filename === this.note.filename
      if (isInEditor) {
        logDebug('Project::addProgressLine', `Working in EDITOR for note '${this.note.filename}'`)
      } else {
        logDebug('Project::addProgressLine', `Working on DATASTORE note '${this.note.filename}'`)
      }
      // Get progress heading from config
      const message1 = `${prompt} '${this.title}'`
      const resText = await getInputTrimmed(message1, 'OK', `Add Progress comment`)
      if (!resText) {
        logDebug('Project::addProgressLine', `No valid progress line given.`)
        return
      }
      const comment = String(resText) // to keep flow happy

      const message2 = (!isNaN(this.percentComplete)) ? `Enter project completion (as %; last was ${String(this.percentComplete)}%) if wanted` : `Enter project completion (as %) if wanted`
      const resNum = await inputIntegerBounded('Add Progress % completion', message2, 100, 0)
      let percentStr = ''
      if (isNaN(resNum)) {
        logDebug('Project::addProgressLine', `No percent completion given.`)
      } else {
        this.percentComplete = resNum
        percentStr = String(resNum)
      }

      // Update the project's metadata
      this.lastProgressComment = `${comment} (today)`
      const newProgressLine = `Progress: ${percentStr}@${todaysDateISOString}: ${comment}`

      // Get progress heading and level from config
      const config = await getReviewSettings()
      const progressHeading = config?.progressHeading?.trim() ?? ''
      const progressHeadingLevel = config?.progressHeadingLevel ?? 2

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
            const firstProgressLineIndex = firstProgressLine.lineIndex
            
            logDebug('Project::addProgressLine', `Inserting heading '${progressHeading}' above first Progress line at line ${String(firstProgressLineIndex)}`)
            
            // Insert heading above first Progress line
            if (Editor && Editor.note && Editor.note.filename === this.note.filename) {
              // $FlowFixMe[incompatible-call]
              Editor.insertHeading(progressHeading, firstProgressLineIndex, progressHeadingLevel)
              await Editor.save()
            } else {
              // $FlowFixMe[incompatible-call]
              this.note.insertHeading(progressHeading, firstProgressLineIndex, progressHeadingLevel)
              await DataStore.updateCache(this.note, true)
            }
          }
          
          // Now add the progress line under the heading (heading is guaranteed to exist)
          logDebug('Project::addProgressLine', `Adding progress line under heading '${progressHeading}'`)
          this.note.addParagraphBelowHeadingTitle(newProgressLine, 'text', progressHeading, false, false)
          
          if (Editor && Editor.note && Editor.note.filename === this.note.filename) {
            await Editor.save()
          } else {
            await DataStore.updateCache(this.note, true)
          }
        } else {
          // No Progress lines exist: add new Progress Section heading (if needed) and the first progress line
          logDebug('Project::addProgressLine', `No existing Progress lines, so creating new Section heading '${progressHeading}' if needed`)
          smartCreateSectionsAndPara(this.note, newProgressLine, 'text', [progressHeading], progressHeadingLevel, false)
          
          if (Editor && Editor.note && Editor.note.filename === this.note.filename) {
            await Editor.save()
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
          insertionIndex = findStartOfActivePartOfNote(this.note, true)
          logDebug('Project::addProgressLine', `No progress paragraphs found, so will insert new progress line after metadata at line ${String(insertionIndex)}`)
        } else {
          logDebug('Project::addProgressLine', `Will insert new progress line before most recent progress line at ${String(insertionIndex)}.`)
        }

        // And write it to the Editor (if the note is open in it) ...
        if (Editor && Editor.note && Editor.note.filename === this.note.filename) {
          logDebug('Project::addProgressLine', `Writing '${newProgressLine}' to Editor at line ${String(insertionIndex)}`)
          Editor.insertParagraph(newProgressLine, insertionIndex, 'text')
          logDebug('Project::addProgressLine', `- finished Editor.insertParagraph`)
          await Editor.save()
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
      if (isInEditor) {
        await saveEditorIfNecessary()
        logDebug('Project::addProgressLine', `- Editor saved; will now re-open note in that Editor window`)
        await Editor.openNoteByFilename(this.note.filename)
        logDebug('Project::addProgressLine', `- note re-opened in Editor window`)
      }
    } catch (error) {
      logError(`Project::addProgressLine`, JSP(error))
    }
  }

  /**
   * Process the 'Progress:...' lines to retrieve metadata. Allowed forms are:
   *   Progress: n@YYYYMMDD: progress messsage
   *   Progress: n:YYYYMMDD: progress messsage
   *   Progress: n:YYYY-MM-DD: progress messsage
   *   Progress: n:YYYY-MM-DD: progress messsage
   *   Progress: YYYYMMDD: progress messsage  [in which case % is calculated]
   *   Progress: YYYY-MM-DD: progress messsage  [in which case % is calculated]
   */
  processProgressLines(): void {
    // Get specific 'Progress' field lines
    const progressParas = getFieldParagraphsFromNote(this.note, 'progress')

    if (progressParas.length > 0) {
      // Get the most recent progressItem from these lines
      const progressItem: Progress = processMostRecentProgressParagraph(progressParas)
      this.percentComplete = progressItem.percentComplete
      this.lastProgressComment = progressItem.comment
      this.mostRecentProgressLineIndex = progressItem.lineIndex
      // logDebug('Project::processProgressLines', `  -> ${String(this.percentComplete)}% from progress line`)
    } else {
      // logDebug('Project::processProgressLines', `- no progress fields found`)
    }
  }

  /**
   * Close a Project/Area note by updating the metadata and saving it:
   * - adding @completed(<today's date>)
   * @author @jgclark
   * @returns {string} new TSVSummaryLine or empty on failure
   */
  completeProject(): string {
    try {
      // update the metadata fields
      // this.isActive = false
      this.isCompleted = true
      this.isCancelled = false
      this.isPaused = false
      this.completedDate = moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
      this.calculateDueDays()
      this.calculateCompletedOrCancelledDurations()

      // re-write the note's metadata line
      logDebug('completeProject', `Completing '${this.title}' ...`)
      this.updateMetadataAndSave()

      const newMSL = this.TSVSummaryLine()
      logDebug('completeProject', `- returning mSL '${newMSL}'`)
      return newMSL
    }
    catch (error) {
      logError(pluginJson, `Error completing project for ${this.title}: ${error.message}`)
      return ''
    }
  }

  /**
   * Cancel a Project/Area note by updating the metadata and saving it:
   * - adding @cancelled(<today's date>)
   * @author @jgclark
   * @returns {string} new TSVSummaryLine or empty on failure
   */
  cancelProject(): string {
    try {
      // update the metadata fields
      // this.isActive = false
      this.isCompleted = false
      this.isCancelled = true
      this.isPaused = false
      this.cancelledDate = moment().toDate()  // getJSDateStartOfToday() // use moment instead of `new Date` to ensure we get a date in the local timezone
      this.calculateDueDays()
      this.calculateCompletedOrCancelledDurations()

      // re-write the note's metadata line
      logDebug('cancelProject', `Cancelling '${this.title}' ...`)
      this.updateMetadataAndSave()

      const newMSL = this.TSVSummaryLine()
      logDebug('cancelProject', `- returning mSL '${newMSL}'`)
      return newMSL
    }
    catch (error) {
      logError(pluginJson, `Error cancelling project for ${this.title}: ${error.message}`)
      return ''
    }
  }

  /**
   * Cancel a Project/Area note by updating the metadata and saving it:
   * - adding #paused
   * @author @jgclark
   * @returns {string} new TSVSummaryLine or empty on failure
   */
  async togglePauseProject(): Promise<string> {
    try {
      // Get progress field details (if wanted)
      logDebug('togglePauseProject', `Starting for '${this.title}' ...`)
      await this.addProgressLine(this.isPaused ? 'Comment (if wanted) as you resume' : 'Comment (if wanted) as you pause')

      // update the metadata fields
      this.isCompleted = false
      this.isCancelled = false
      this.isPaused = !this.isPaused // toggle

      // re-write the note's metadata line
      logDebug('togglePauseProject', `Paused state now toggled to ${String(this.isPaused)} for '${this.title}' ...`)
      const newMetadataLine = this.generateMetadataOutputLine()
      logDebug('togglePauseProject', `- metadata now '${newMetadataLine}'`)
      // Update metadata using helper that handles both frontmatter and regular paragraphs
      this.updateMetadataLine(newMetadataLine)
      if (Editor && Editor.note && Editor.note === this.note) {
        await Editor.save()
      }

      // if we want to remove all due dates on pause, then do that
      if (this.isPaused) {
        const config = await getReviewSettings()
        if (config.removeDueDatesOnPause) {
          logDebug('togglePauseProject', `- project now paused, and we want to remove due dates ...`)
          const res = removeAllDueDates(this.filename)
        }
      }

      const newMSL = this.TSVSummaryLine()
      logDebug('togglePauseProject', `- returning newMSL '${newMSL}'`)
      return newMSL
    }
    catch (error) {
      logError(pluginJson, `Error pausing project for ${this.title}: ${error.message}`)
      return ''
    }
  }

  /**
   * Generate a one-line tab-sep summary line ready for Markdown note
   */
  generateMetadataOutputLine(): string {
    const parts: Array<string> = []
    parts.push(this.projectTag)
    if (this.isPaused) parts.push('#paused')
    if (this.startDate != null && this.startDate instanceof Date) {
      const thisStartDate: Date = this.startDate // to satisfy flow
      parts.push(`${checkString(DataStore.preference('startMentionStr'))}(${toISODateString(thisStartDate)})`)
    }
    if (this.dueDate != null && this.dueDate instanceof Date) {
      const thisDueDate: Date = this.dueDate // to satisfy flow
      parts.push(`${checkString(DataStore.preference('dueMentionStr'))}(${toISODateString(thisDueDate)})`)
    }
    if (this.reviewInterval != null) {
      parts.push(`${checkString(DataStore.preference('reviewIntervalMentionStr'))}(${checkString(this.reviewInterval)})`)
    }
    if (this.reviewedDate != null && this.reviewedDate instanceof Date) {
      const thisReviewedDate: Date = this.reviewedDate // to satisfy flow
      parts.push(`${checkString(DataStore.preference('reviewedMentionStr'))}(${toISODateString(thisReviewedDate)})`)
    }
    if (this.completedDate != null && this.completedDate instanceof Date) {
      const thisCompletedDate: Date = this.completedDate // to satisfy flow
      parts.push(`${checkString(DataStore.preference('completedMentionStr'))}(${toISODateString(thisCompletedDate)})`)
    }
    if (this.cancelledDate != null && this.cancelledDate instanceof Date) {
      const thisCancelledDate: Date = this.cancelledDate // to satisfy flow
      parts.push(`${checkString(DataStore.preference('cancelledMentionStr'))}(${toISODateString(thisCancelledDate)})`)
    }
    return parts.join(' ')
  }

  /**
   * v2: Returns TSV line to go in full-review-list with just the data needed to filter output lists
   * @return {string}
   */
  TSVSummaryLine(): string {
    try {
      // next review in days
      let output = (!this.isPaused && this.nextReviewDays != null && !isNaN(this.nextReviewDays)) ? String(this.nextReviewDays) : 'NaN'
      output += '\t'
      // due date in days
      output += (!this.isPaused && this.dueDays != null && !isNaN(this.dueDays)) ? String(this.dueDays) : 'NaN'
      // title
      output += `\t${this.title}\t`
      // folder
      output += this.folder && this.folder !== undefined ? `${this.folder}\t` : '\t'
      // note type, then other pseudo-tags
      output += (this.projectTag) ? `${this.projectTag} ` : ''
      output += this.isPaused ? '#paused' : ''
      output += '\t'
      output += (this.isCompleted)
        ? 'finished'
        : (this.isCancelled)
          ? 'finished-cancelled'
          : 'active'
      return output
    }
    catch (error) {
      logError('TSVSummaryLine', error.message)
      return '<error>' // for completeness
    }
  }
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
    projectTag: project.projectTag,
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
  }
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
      completedDuration = formatDurationString(thisProjectIn.completedDate, thisProjectIn.startDate ?? undefined)
      // logDebug('calcDurationsForProject', `-> completedDuration = ${completedDuration}`)
    } else if (thisProjectIn.cancelledDate != null) {
      cancelledDuration = formatDurationString(thisProjectIn.cancelledDate, thisProjectIn.startDate ?? undefined)
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
    const now = moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone

    // Calculate next review due date, if there isn't already a nextReviewDateStr, and there's a review interval.
    let nextReviewDateStr: ?string = thisProjectIn.nextReviewDateStr
    let nextReviewDays: number = thisProjectIn.nextReviewDays

    // First check to see if project start is in future: if so set nextReviewDateStr to project start
    if (thisProjectIn.startDate != null && thisProjectIn.startDate instanceof Date) {
      const thisStartDate: Date = thisProjectIn.startDate // to satisfy flow
      const momTSD = moment(thisProjectIn.startDate)
      if (momTSD.isAfter(now)) {
        nextReviewDateStr = toISODateString(thisStartDate)
        nextReviewDays = daysBetween(now, thisStartDate)
        logDebug('calcReviewFieldsForProject', `project start is in future (${momTSD.format('YYYY-MM-DD')}) -> ${String(nextReviewDays)} interval`)
      }
    }

    // Now check to see if we have a specific nextReviewDateStr
    if (thisProjectIn.nextReviewDateStr != null) {
      nextReviewDays = daysBetween(now, thisProjectIn.nextReviewDateStr)
      logDebug('calcReviewFieldsForProject', `- already had a nextReviewDateStr ${thisProjectIn.nextReviewDateStr ?? '?'} -> ${String(nextReviewDays)} interval`)
    }
    else if (thisProjectIn.reviewInterval != null) {
      if (thisProjectIn.reviewedDate != null) {
        const calculatedNextReviewDate = calcNextReviewDate(thisProjectIn.reviewedDate, thisProjectIn.reviewInterval)
        if (calculatedNextReviewDate != null) {
          // Convert Date to ISO date string (YYYY-MM-DD)
          nextReviewDateStr = toISODateString(calculatedNextReviewDate)
          // this now uses moment and truncated (not rounded) date diffs in number of days
          nextReviewDays = daysBetween(now, nextReviewDateStr)
          // logDebug('calcReviewFieldsForProject', `${String(thisProjectIn.reviewedDate)} + ${thisProjectIn.reviewInterval ?? ''} -> nextReviewDateStr: ${nextReviewDateStr ?? ''} = ${String(nextReviewDays) ?? '-'}`)
        } else {
          throw new Error(`calculated nextReviewDate is null; reviewedDate = ${String(thisProjectIn.reviewedDate)}`)
        }
      } else {
        // no next review date, so set at today
        nextReviewDateStr = toISODateString(now)
        nextReviewDays = 0
      }
    }
    // logDebug('calcReviewFieldsForProject', `-> reviewedDate = ${String(thisProjectIn.reviewedDate)} / nextReviewDateStr = ${String(nextReviewDateStr)} / nextReviewDays = ${String(nextReviewDays)}`)
    
    return createImmutableProjectCopy(thisProjectIn, {
      nextReviewDateStr,
      nextReviewDays,
    })
  } catch (error) {
    logError('calcReviewFieldsForProject', error.message)
    return thisProjectIn
  }
}

// HTML generation functions have been moved to htmlGenerators.js
// Import generateProjectOutputLine directly from htmlGenerators.js instead
