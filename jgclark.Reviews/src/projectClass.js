// @flow
//-----------------------------------------------------------------------------
// Project class definition for Review plugin
// by Jonathan Clark
// Last updated 2024-09-30 for v1.0.0.b1, @jgclark
//-----------------------------------------------------------------------------

// Import Helper functions
import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  addFAIcon,
  calcNextReviewDate,
  getFieldParagraphsFromNote,
  getOrMakeMetadataLine,
  getParamMentionFromList,
  getReviewSettings,
  processMostRecentProgressParagraph,
} from './reviewHelpers'
import { checkString } from '@helpers/checkType'
import {
  daysBetween,
  getDateObjFromDateString,
  includesScheduledFutureDate,
  todaysDateISOString,
  toISODateString,
} from '@helpers/dateTime'
import { localeRelativeDateFromNumber } from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { createOpenOrDeleteNoteCallbackUrl, getContentFromBrackets, getStringFromList } from '@helpers/general'
import {
  makeSVGPercentRing,
  redToGreenInterpolation,
} from '@helpers/HTMLView'
import { removeAllDueDates } from '@helpers/NPParagraph'
import { findStartOfActivePartOfNote, simplifyRawContent } from '@helpers/paragraph'
import { getLineMainContentPos } from '@helpers/search'
import { encodeRFC3986URIComponent } from '@helpers/stringTransforms'
import {
  getInputTrimmed,
  inputIntegerBounded,
} from '@helpers/userInput'
import { isDone, isOpen } from '@helpers/utils'

//-----------------------------------------------------------------------------

export type Progress = {
  lineIndex: number,
  percentComplete: number,
  date: Date,
  comment: string
}

/**
 * Define 'Project' class to use in GTD.
 * Holds title, last reviewed date, due date, review interval, completion date,
 * number of closed, open & waiting for tasks.
 *
 * @example To create a project instance for a note call 'const x = new Project(note, ...)'
 * @author @jgclark
 */
export class Project {
  // Types for the class instance properties
  note: TNote
  filename: string
  folder: string
  metadataParaLineIndex: number
  noteType: string // #project, #area, etc.
  title: string
  startDate: ?Date
  dueDate: ?Date
  dueDays: number = NaN
  reviewedDate: ?Date
  reviewInterval: string // later will default to '1w' if needed
  nextReviewDate: ?Date
  nextReviewDateStr: ?string // can be set by user (temporarily) but not otherwise populated
  nextReviewDays: number = NaN
  completedDate: ?Date
  completedDuration: ?string // string description of time to completion, or how long ago completed
  cancelledDate: ?Date
  cancelledDuration: ?string // string description of time to cancellation, or how long ago cancelled
  openTasks: number
  completedTasks: number
  waitingTasks: number
  futureTasks: number
  isCompleted: boolean = false
  isCancelled: boolean = false
  isPaused: boolean = false
  percentComplete: number = NaN
  lastProgressComment: string = '' // e.g. "Progress: 60@20220809: comment
  mostRecentProgressLineIndex: number = NaN
  nextActionRawContent: string = ''
  ID: string // required when making HTML views

  constructor(note: TNote, noteTypeTag: string = '', checkEditor: boolean = true, nextActionTag: string = '') {
    try {
      const startTime = new Date()
      if (note == null || note.title == null) {
        throw new Error('Error in constructor: invalid note passed')
      }
      this.title = note.title
      this.filename = note.filename
      // logDebug('Project', `Starting for type ${noteTypeTag}, ${this.filename}`)
      this.folder = getFolderFromFilename(note.filename)

      // Make a (nearly) unique number for this instance (needed for the addressing the SVG circles) -- I can't think of a way of doing this neatly to create one-up numbers, that doesn't create clashes when re-running over a subset of notes
      this.ID = String(Math.round((Math.random()) * 99999))

      // Sometimes we're called just after a note has been updated in the Editor. So check to see if note is open in Editor, and if so use that version, which could be newer.
      // (Unless 'checkEditor' false, to avoid triggering 'You are running this on an async thread' warnings.)
      let paras: Array<TParagraph>
      if (checkEditor && Editor && Editor.note && (Editor.note.filename === note.filename)) {
        const editorNote: CoreNoteFields = Editor.note
        paras = editorNote.paragraphs
        this.note = Editor.note // Note: not plain Editor, as otherwise it isn't the right type and will throw app run-time errors later.
        const timeSinceLastEdit: number = Date.now() - editorNote.versions[0].date
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
        // Note: If necessary, fall back to getting mentions just from the metadataline
        mentions = (`${metadataLine} `).split(' ').filter((f) => f[0] === '@')
      }
      if (hashtags.length === 0) {
        hashtags = (`${metadataLine} `).split(' ').filter((f) => f[0] === '#')
      }

      // work out noteType:
      // - if noteTypeTag given, then use that
      // - else first or second hashtag in note
      try {
        this.noteType = (noteTypeTag)
          ? noteTypeTag
          : (hashtags[0] !== '#paused')
            ? hashtags[0]
            : (hashtags[1])
              ? hashtags[1]
              : ''
      } catch (e) {
        this.noteType = ''
        logWarn('Project', `- found no noteType for '${this.title}' in folder ${this.folder}`)
      }

      // read in various metadata fields (if present)
      let tempStr = getParamMentionFromList(mentions, checkString(DataStore.preference('startMentionStr')))
      this.startDate = tempStr !== '' ? getDateObjFromDateString(tempStr) : undefined
      // read in due date (if present)
      tempStr = getParamMentionFromList(mentions, checkString(DataStore.preference('dueMentionStr')))
      this.dueDate = tempStr !== '' ? getDateObjFromDateString(tempStr) : undefined
      // read in reviewed date (if present)
      // Note: doesn't pick up reviewed() if not in metadata line
      tempStr = getParamMentionFromList(mentions, checkString(DataStore.preference('reviewedMentionStr')))
      this.reviewedDate = tempStr !== '' ? getDateObjFromDateString(tempStr) : undefined
      // read in completed date (if present)
      tempStr = getParamMentionFromList(mentions, checkString(DataStore.preference('completedMentionStr')))
      this.completedDate = tempStr !== '' ? getDateObjFromDateString(tempStr) : undefined
      // read in cancelled date (if present)
      tempStr = getParamMentionFromList(mentions, checkString(DataStore.preference('cancelledMentionStr')))
      this.cancelledDate = tempStr !== '' ? getDateObjFromDateString(tempStr) : undefined
      // read in review interval (if present)
      const tempIntervalStr = getParamMentionFromList(mentions, checkString(DataStore.preference('reviewIntervalMentionStr')))
      // $FlowIgnore[incompatible-type]
      this.reviewInterval = tempIntervalStr !== '' ? getContentFromBrackets(tempIntervalStr) : '1w'
      // read in nextReview date (if present)
      tempStr = getParamMentionFromList(mentions, checkString(DataStore.preference('nextReviewMentionStr')))
      if (tempStr !== '') {
        // v2:
        this.nextReviewDateStr = tempStr.slice(12, 22)
        this.nextReviewDate = moment(this.nextReviewDateStr, "YYYY-MM-DD").toDate()
        // v1:
        // this.nextReviewDate = getDateObjFromDateString(tempStr)
        // if (this.nextReviewDate) {
        //   this.nextReviewDateStr = toISODateString(this.nextReviewDate)
        //   logDebug('Project', `- found '@nextReview(${this.nextReviewDateStr})' = ${String(this.nextReviewDate)}`)
        // } else {
        //   logWarn('Project', `- couldn't get valid date from  '@nextReview(${tempStr})'`)
        // }
      }

      // count tasks (includes both tasks and checklists)
      // Note: excludes future tasks
      this.openTasks = paras.filter(isOpen).length
      this.completedTasks = paras.filter(isDone).length
      this.waitingTasks = paras.filter(isOpen).filter((p) => p.content.match('#waiting')).length
      this.futureTasks = paras.filter(isOpen).filter((p) => includesScheduledFutureDate(p.content)).length

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
      this.calcDurations()
      // if not finished, calculate next review dates
      if (!this.isCancelled && !this.isCompleted) {
        this.calcNextReviewDate()
      }

      // Find progress field lines (if any) and process
      this.processProgressLines()

      // If percentComplete not set via progress line, then calculate
      if (this.lastProgressComment === '') {
        const totalTasks = this.completedTasks + this.openTasks - this.futureTasks
        if (totalTasks > 0) {
          // use 'floor' not 'round' to ensure we don't get to 100% unless really everything is done
          this.percentComplete = Math.floor((this.completedTasks / totalTasks) * 100)
        } else {
          this.percentComplete = NaN
        }
      }

      // If we want to track next actions, find the first one (if any)
      if (nextActionTag !== '') {
        const nextActionParas = paras.filter(isOpen).filter((p) => p.content.match(nextActionTag))

        if (nextActionParas.length > 0) {
          this.nextActionRawContent = simplifyRawContent(nextActionParas[0].rawContent)
          // logDebug('Project', `  - found nextActionRawContent = ${this.nextActionRawContent}`)
        }
      }

      if (this.title.includes('(TEST)')) {
        logDebug('Project', `Constructed ${this.noteType} ${this.filename}:`)
        logDebug('Project', `  - folder = ${this.folder}`)
        logDebug('Project', `  - metadataLine = ${metadataLine}`)
        if (this.isCompleted) logDebug('Project', `  - isCompleted ✔️`)
        if (this.isCancelled) logDebug('Project', `  - isCancelled ✔️`)
        if (this.isPaused) logDebug('Project', `  - isPaused ✔️`)
        logDebug('Project', `  - mentions: ${String(mentions)}`)
        // logDebug('Project', `  - altMentions: ${String(altMentions)}`)
        logDebug('Project', `  - hashtags: ${String(hashtags)}`)
        // logDebug('Project', `  - altHashtags: ${String(altHashtags)}`)
        logDebug('Project', `  - open: ${String(this.openTasks)}`)
        if (this.mostRecentProgressLineIndex >= 0) logDebug('Project', `  - progress: #${String(this.mostRecentProgressLineIndex)} = ${this.lastProgressComment}`)
        logDebug('Project', `  - completed: ${String(this.completedTasks)}`)
        logDebug('Project', `  - % complete = ${String(this.percentComplete)}`)
        logDebug('Project', `  - nextAction = <${this.nextActionRawContent}>`)
      } else {
        logTimer('Project', startTime, `Constructed ${this.noteType} ${this.filename}: ${this.nextReviewDateStr ?? '-'} / ${String(this.nextReviewDays)} / ${this.isCompleted ? ' completed' : ''}${this.isCancelled ? ' cancelled' : ''}${this.isPaused ? ' paused' : ''}`)
      }
    }
    catch (error) {
      logError('Project', error.message)
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
    return !this.isPaused && this.nextReviewDays != null && !isNaN(this.nextReviewDays) && this.nextReviewDays <= 0
  }

  /**
   * From the project metadata read in, calculate due/finished durations
   */
  calcDurations(): void {
    try {
      const now = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
      // Calculate # days until due
      this.dueDays =
        this.dueDate != null
          ? daysBetween(now, this.dueDate)
          : NaN

      // Calculate durations or time since cancel/complete
      // logDebug('calcDurations', String(this.startDate ?? 'no startDate'))
      if (this.startDate) {
        const momTSD = moment(this.startDate)
        if (this.completedDate != null) {
          this.completedDuration = `after ${momTSD.to(moment(this.completedDate), true)}`
          // logDebug('calcDurations', `-> completedDuration = ${this.completedDuration}`)
        }
        else if (this.cancelledDate != null) {
          this.cancelledDuration = `after ${momTSD.to(moment(this.cancelledDate), true)}`
          // logDebug('calcDurations', `-> cancelledDuration = ${this.cancelledDuration}`)
        }
      }
      else {
        if (this.completedDate != null) {
          this.completedDuration = moment(this.completedDate).fromNow() // ...ago
          if (this.completedDuration.includes('hours')) {
            this.completedDuration = 'today' // edge case
          }
          // logDebug('calcDurations', `-> completedDuration = ${this.completedDuration}`)
        }
        else if (this.cancelledDate != null) {
          this.cancelledDuration = moment(this.cancelledDate).fromNow() // ...ago
          if (this.cancelledDuration.includes('hours')) {
            this.cancelledDuration = 'today' // edge case
          }
          // logDebug('calcDurations', `-> completedDuration = ${this.cancelledDuration}`)
        }
        else {
          // Nothing to do
          // logDebug('calcDurations', `No completed or cancelled dates.`)
        }
      }
    } catch (error) {
      logError('calcDurations', error.message)
    }
  }

  calcNextReviewDate(): ?Date {
    try {
      // Calculate next review due date, if there isn't already a nextReviewDate, and there's a review interval.
      const now = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone

      // First check to see if project start is in future: if so set nextReviewDate to project start
      if (this.startDate) {
        const momTSD = moment(this.startDate)
        if (momTSD.isAfter(now)) {
          this.nextReviewDate = this.startDate
          this.nextReviewDays = daysBetween(now, momTSD.toDate())
          logDebug('calcNextReviewDate', `project start is in future (${momTSD.format('YYYY-MM-DD')}) -> ${String(this.nextReviewDays)} interval`)
          return this.startDate
        }
      }

      // Now check to see if we have a specific nextReviewDate
      if (this.nextReviewDateStr != null) {
        this.nextReviewDays = daysBetween(now, this.nextReviewDateStr)
        logDebug('calcNextReviewDate', `already had a nextReviewDateStr ${this.nextReviewDateStr ?? '?'} -> ${String(this.nextReviewDays)} interval`)
      }
      else if (this.reviewInterval != null) {
        if (this.reviewedDate != null) {
          this.nextReviewDate = calcNextReviewDate(this.reviewedDate, this.reviewInterval)
          if (this.nextReviewDate != null) {
            // this now uses moment and truncated (not rounded) date diffs in number of days
            this.nextReviewDays = daysBetween(now, this.nextReviewDate)
            // logDebug('calcNextReviewDate', `${String(this.reviewedDate)} + ${this.reviewInterval ?? ''} -> nextReviewDate: ${this.nextReviewDateStr ?? ''} = ${String(this.nextReviewDays) ?? '-'}`)
          } else {
            throw new Error(`nextReviewDate is null; reviewedDate = ${String(this.reviewedDate)}`)
          }
        } else {
          // no next review date, so set at today
          this.nextReviewDate = now
          this.nextReviewDays = 0
        }
      }
      // logDebug('calcNextReviewDate', `-> reviewedDate = ${String(this.reviewedDate)} / nextReviewDate = ${String(this.nextReviewDate)} / nextReviewDays = ${String(this.nextReviewDays)}`)
      return this.nextReviewDate
    } catch (error) {
      logError('calcNextReviewDate', error.message)
      return null
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
      // Set insertion point for the new progress line to this paragraph,
      // or if none exist, to the line after the current metadata line
      let insertionIndex = this.mostRecentProgressLineIndex
      if (isNaN(insertionIndex)) {
        insertionIndex = findStartOfActivePartOfNote(this.note, true)
        logDebug('Project::addProgressLine', `No progress paragraphs found, so will insert new progress line after metadata at line ${String(insertionIndex)}`)
      } else {
        // insertionIndex = processMostRecentProgressParagraph(getFieldParagraphsFromNote(this.note, 'progress'))
        logDebug('Project::addProgressLine', `Will insert new progress line before most recent progress line at ${String(insertionIndex)}.`)
      }

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
      // logDebug('Project::addProgressLine', `-> line ${String(insertionIndex)}: ${this.percentComplete} / '${this.lastProgressComment}'`)
      const newProgressLine = `Progress: ${percentStr}@${todaysDateISOString}: ${comment}`

      // And write it to the Editor (if the note is open in it) ...
      if (Editor && Editor.note && Editor.note.filename === this.note.filename) {
        logDebug('Project::addProgressLine', `Writing '${newProgressLine}' to Editor at ${String(insertionIndex)}`)
        Editor.insertParagraph(newProgressLine, insertionIndex, 'text')
        // Also updateCache to make changes more quickly available elsewhere
        await DataStore.updateCache(Editor, true)
      }
      // ... or the project's note
      else {
        logDebug('Project::addProgressLine', `Writing '${newProgressLine}' to project note '${this.note.filename}' at ${String(insertionIndex)}`)
        this.note.insertParagraph(newProgressLine, insertionIndex, 'text')
        // Also updateCache
        await DataStore.updateCache(this.note, true)
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
      this.completedDate = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
      this.calcDurations()

      // re-write the note's metadata line
      logDebug('completeProject', `Completing '${this.title}' ...`)
      const newMetadataLine = this.generateMetadataOutputLine()
      logDebug('completeProject', `- metadata now '${newMetadataLine}'`)

      // send update to Editor
      // Note: Will need updating when supporting frontmatter for metadata

      const metadataPara = this.note.paragraphs[this.metadataParaLineIndex]
      metadataPara.content = newMetadataLine
      if (Editor && Editor.note && Editor.note === this.note) {
        Editor.updateParagraph(metadataPara)
        const res = DataStore.updateCache(this.note)
      } else {
        this.note.updateParagraph(metadataPara)
        DataStore.updateCache(this.note, true)
      }

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
      this.cancelledDate = new moment().toDate()  // getJSDateStartOfToday() // use moment instead of `new Date` to ensure we get a date in the local timezone
      this.calcDurations()

      // re-write the note's metadata line
      logDebug('cancelProject', `Cancelling '${this.title}' ...`)
      const newMetadataLine = this.generateMetadataOutputLine()
      logDebug('cancelProject', `- metadata now '${newMetadataLine}'`)

      // send update to Editor
      // Note: Will need updating when supporting frontmatter for metadata
      const metadataPara = this.note.paragraphs[this.metadataParaLineIndex]
      metadataPara.content = newMetadataLine
      if (Editor && Editor.note && Editor.note === this.note) {
        Editor.updateParagraph(metadataPara)
        DataStore.updateCache(this.note, true)
      } else {
        this.note.updateParagraph(metadataPara)
        DataStore.updateCache(this.note, true)
      }

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
      await this.addProgressLine(this.isPaused ? 'Comment (if wanted) as you resume' : 'Comment (if wanted) as you pause')

      // update the metadata fields
      this.isCompleted = false
      this.isCancelled = false
      this.isPaused = !this.isPaused // toggle

      // re-write the note's metadata line
      logDebug('togglePauseProject', `Paused state now toggled to ${String(this.isPaused)} for '${this.title}' ...`)
      const newMetadataLine = this.generateMetadataOutputLine()
      logDebug('togglePauseProject', `- metadata now '${newMetadataLine}'`)
      // send update to Editor (if open)
      // Note: Will need updating when supporting frontmatter for metadata
      const metadataPara = this.note.paragraphs[this.metadataParaLineIndex]
      metadataPara.content = newMetadataLine
      if (Editor && Editor.note && Editor.note === this.note) {
        Editor.updateParagraph(metadataPara)
        DataStore.updateCache(Editor.note, true)
      } else {
        this.note.updateParagraph(metadataPara)
        DataStore.updateCache(this.note, true)
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
    let output = this.noteType
    output += ' '
    output += this.isPaused ? '#paused ' : ''
    // $FlowIgnore[incompatible-call]
    output += this.startDate && this.startDate !== undefined ? `${checkString(DataStore.preference('startMentionStr'))}(${toISODateString(this.startDate)}) ` : ''
    // $FlowIgnore[incompatible-call]
    output += this.dueDate && this.startDate !== undefined ? `${checkString(DataStore.preference('dueMentionStr'))}(${toISODateString(this.dueDate)}) ` : ''
    output +=
      this.reviewInterval && this.reviewInterval !== undefined ? `${checkString(DataStore.preference('reviewIntervalMentionStr'))}(${checkString(this.reviewInterval)}) ` : ''
    // $FlowIgnore[incompatible-call]
    output += this.reviewedDate && this.reviewedDate !== undefined ? `${checkString(DataStore.preference('reviewedMentionStr'))}(${toISODateString(this.reviewedDate)}) ` : ''
    // $FlowIgnore[incompatible-call]
    output += this.completedDate && this.completedDate !== undefined ? `${checkString(DataStore.preference('completedMentionStr'))}(${toISODateString(this.completedDate)}) ` : ''
    // $FlowIgnore[incompatible-call]
    output += this.cancelledDate && this.cancelledDate !== undefined ? `${checkString(DataStore.preference('cancelledMentionStr'))}(${toISODateString(this.cancelledDate)}) ` : ''

    return output
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
      output += (this.noteType) ? `${this.noteType} ` : ''
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
 * From a Project metadata object read in, calculate updated due/finished durations, and return the updated Project object
 * @author @jgclark
 * @param {Project} thisProject
 * @returns {Project}
*/
export function calcDurationsForProject(thisProjectIn: Project): $Shape<Project> {
  try {
    const now = new moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone
    const thisProject = { ...thisProjectIn }
    // Calculate # days until due
    thisProject.dueDays =
      thisProject.dueDate != null
        ? daysBetween(now, thisProject.dueDate)
        : NaN

    // Calculate durations or time since cancel/complete
    logDebug('calcDurations', String(thisProject.startDate ?? 'no startDate'))
    if (thisProject.startDate) {
      const momTSD = moment(thisProject.startDate)
      if (thisProject.completedDate != null) {
        thisProject.completedDuration = `after ${momTSD.to(moment(thisProject.completedDate), true)}`
        logDebug('calcDurations', `-> completedDuration = ${thisProject.completedDuration}`)
      }
      else if (thisProject.cancelledDate != null) {
        thisProject.cancelledDuration = `after ${momTSD.to(moment(thisProject.cancelledDate), true)}`
        logDebug('calcDurations', `-> cancelledDuration = ${thisProject.cancelledDuration}`)
      }
    }
    else {
      if (thisProject.completedDate != null) {
        thisProject.completedDuration = moment(thisProject.completedDate).fromNow() // ...ago
        if (thisProject.completedDuration.includes('hours')) {
          thisProject.completedDuration = 'today' // edge case
        }
        logDebug('calcDurations', `-> completedDuration = ${thisProject.completedDuration ?? '?'}`)
      }
      else if (thisProject.cancelledDate != null) {
        thisProject.cancelledDuration = moment(thisProject.cancelledDate).fromNow() // ...ago
        if (thisProject.cancelledDuration.includes('hours')) {
          thisProject.cancelledDuration = 'today' // edge case
        }
        logDebug('calcDurations', `-> completedDuration = ${thisProject.cancelledDuration ?? '?'}`)
      }
      else {
        // Nothing to do
        logDebug('calcDurations', `No completed or cancelled dates.`)
      }
      return thisProject
    }
  } catch (error) {
    logError('calcDurations', error.message)
    // $FlowFixMe[incompatible-return] reason for suppression
    return null
  }
}

export function calcReviewFieldsForProject(thisProjectIn: Project): $Shape<Project> {
  try {
    // Calculate next review due date, if there isn't already a nextReviewDate, and there's a review interval.
    const now = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const thisProject = { ...thisProjectIn }

    // First check to see if project start is in future: if so set nextReviewDate to project start
    if (thisProject.startDate) {
      const momTSD = moment(thisProject.startDate)
      if (momTSD.isAfter(now)) {
        thisProject.nextReviewDate = thisProject.startDate
        thisProject.nextReviewDays = daysBetween(now, momTSD.toDate())
        logDebug('calcNextReviewDate', `project start is in future (${momTSD.format('YYYY-MM-DD')}) -> ${String(thisProject.nextReviewDays)} interval`)
        return thisProject
      }
    }

    // Now check to see if we have a specific nextReviewDate
    if (thisProject.nextReviewDateStr != null) {
      thisProject.nextReviewDays = daysBetween(now, thisProject.nextReviewDateStr)
      logDebug('calcNextReviewDate', `already had a nextReviewDateStr ${thisProject.nextReviewDateStr ?? '?'} -> ${String(thisProject.nextReviewDays)} interval`)
    }
    else if (thisProject.reviewInterval != null) {
      if (thisProject.reviewedDate != null) {
        thisProject.nextReviewDate = calcNextReviewDate(thisProject.reviewedDate, thisProject.reviewInterval)
        if (thisProject.nextReviewDate != null) {
          // this now uses moment and truncated (not rounded) date diffs in number of days
          thisProject.nextReviewDays = daysBetween(now, thisProject.nextReviewDate)
    // logDebug('calcNextReviewDate', `${String(thisProject.reviewedDate)} + ${thisProject.reviewInterval ?? ''} -> nextReviewDate: ${thisProject.nextReviewDateStr ?? ''} = ${String(thisProject.nextReviewDays) ?? '-'}`)
        } else {
          throw new Error(`nextReviewDate is null; reviewedDate = ${String(thisProject.reviewedDate)}`)
        }
      } else {
        // no next review date, so set at today
        thisProject.nextReviewDate = now
        thisProject.nextReviewDays = 0
      }
    }
    // logDebug('calcNextReviewDate', `-> reviewedDate = ${String(thisProject.reviewedDate)} / nextReviewDate = ${String(thisProject.nextReviewDate)} / nextReviewDays = ${String(thisProject.nextReviewDays)}`)
    return thisProject
  } catch (error) {
    logError('calcNextReviewDate', error.message)
    return null
  }
}

/**
   * Returns line showing more detailed summary of the project, for output in Rich (HTML) or Markdown formats or simple list format.
   * Now uses fontawesome icons for some indicators.
   * Note: this is V2, now *not* part of the Project class, so can take config etc.
   * @param {Project} thisProject
   * @param {any} config
   * @param {string} style
   * @returns {string}
   */
export function generateProjectOutputLine(
  thisProject: Project,
  config: any,
  style: string,
): string {
  let output = ''
  const thisPercent = (isNaN(thisProject.percentComplete)) ? '0%' : ` ${thisProject.percentComplete}%`
  const totalTasksStr = (thisProject.completedTasks + thisProject.openTasks).toLocaleString()
  const statsProgress = `${thisPercent} done (of ${totalTasksStr} ${(thisProject.completedTasks + thisProject.openTasks > 1) ? 'tasks' : 'task'})`

  if (style === 'Rich') {
    output = '\t<tr class="projectRow">\n\t\t'

    // Column 1: circle indicator
    if (thisProject.isCompleted) {
      output += `<td class="first-col-indicator checked">${addFAIcon('fa-solid fa-circle-check circle-icon')}</td>` // ('checked' gives colour)
    }
    else if (thisProject.isCancelled) {
      output += `<td class="first-col-indicator cancelled">${addFAIcon('fa-solid fa-circle-xmark circle-icon')}</td>` // ('cancelled' gives colour)
    }
    else if (thisProject.isPaused) {
      output += `<td class="first-col-indicator">${addFAIcon("fa-solid fa-circle-pause circle-icon", "#888888")}</td>`
    }
    else if (isNaN(thisProject.percentComplete)) {
      output += `<td class="first-col-indicator">${addFAIcon('fa-solid fa-circle circle-icon', '#888888')}</td>`
    }
    else if (thisProject.percentComplete === 0) {
      output += `<td class="first-col-indicator">${addSVGPercentRing(thisProject, 100, '#FF000088', '0')}</td>`
    }
    else {
      // output += `<td class="first-col-indicator">${addSVGPercentRing(thisProject, thisProject.percentComplete, 'multicol', String(thisProject.percentComplete))}</td>`
      output += `<td class="first-col-indicator">${addSVGPercentRing(thisProject, thisProject.percentComplete, 'multicol', String(thisProject.percentComplete))}</td>`
    }

    // Column 2a: Project name / link / edit dialog trigger button
    const editButton = `          <a class="dialogTrigger" onclick="showProjectControlDialog({encodedFilename: '${encodeRFC3986URIComponent(thisProject.filename)}'})"><i class="fa-light fa-edit pad-left"></i></a>\n`
    if (thisProject.isCompleted || thisProject.isCancelled || thisProject.isPaused) {
      output += `<td>${decoratedProjectTitle(thisProject, style, config)}&nbsp;${editButton}`
    }
    else if (thisProject.percentComplete === 0 || isNaN(thisProject.percentComplete)) {
      output += `<td>${decoratedProjectTitle(thisProject, style, config)}&nbsp;${editButton}`
    } else {
      output += `\n\t\t\t<td>${decoratedProjectTitle(thisProject, style, config)}&nbsp;${editButton}`
    }

    if (!thisProject.isCompleted && !thisProject.isCancelled) {
      // tidy up nextActionContent to show only the main content and remove the nextAction tag
      const nextActionContent = thisProject.nextActionRawContent ? thisProject.nextActionRawContent.slice(getLineMainContentPos(thisProject.nextActionRawContent)).replace(config.nextActionTag, '') : ''

      if (config.displayDates) {
      // Write column 2b/2c under title
      // Column 2b: progress information (if it exists)
        if (config.displayProgress) {
          if (thisProject.lastProgressComment !== '') {
            output += `<br /><i class="fa-solid fa-info-circle fa-sm pad-right"></i> ${thisProject.lastProgressComment}`
          } else {
            output += `<br />${statsProgress}`
          }
        }

        // Column 2c: next action (if present)
        if (config.displayNextActions && nextActionContent !== '') {
          output += `\n\t\t\t<br /><i class="fa-solid fa-right-from-line fa-sm pad-right"></i> ${nextActionContent}`
        }
        output += `</td>`
      } else {
        // write progress in next cell instead
        output += `</td>\n\t\t\t<td>`
        if (config.displayProgress) {
          if (thisProject.lastProgressComment !== '') {
            output += `<i class="fa-solid fa-info-circle fa-sm pad-right"></i> ${thisProject.lastProgressComment}`
          } else {
            output += `${statsProgress}`
          }
        }
        if (config.displayNextActions && nextActionContent !== '') {
          if (config.displayProgress) output += '<br />'
          output += `<i class="fa-solid fa-right-from-line fa-sm pad-right"></i> ${nextActionContent}`
        }
        output += `</td>`
      }
    }

    // Columns 3/4: date information
    if (config.displayDates && !thisProject.isPaused) {
      if (thisProject.isCompleted) {
    // "completed after X"
        const completionRef = (thisProject.completedDuration)
          ? thisProject.completedDuration
          : "completed"
        output += `<td colspan=2 class="checked">Completed ${completionRef}</td>`
      } else if (thisProject.isCancelled) {
        // "cancelled X ago"
        const cancellationRef = (thisProject.cancelledDuration)
          ? thisProject.cancelledDuration
          : "cancelled"
        output += `<td colspan=2 class="cancelled">Cancelled ${cancellationRef}</td>`
      }
      if (!thisProject.isCompleted && !thisProject.isCancelled) {
        output = (thisProject.nextReviewDays != null && !isNaN(thisProject.nextReviewDays))
          ? (thisProject.nextReviewDays > 0)
            ? `${output}<td>${localeRelativeDateFromNumber(thisProject.nextReviewDays)}</td>`
            : `${output}<td><p><b>${localeRelativeDateFromNumber(thisProject.nextReviewDays)}</b></p></td>` // the <p>...</p> is needed to trigger bold colouring (if set)
          : `${output}<td></td>`
        output = (thisProject.dueDays != null && !isNaN(thisProject.dueDays))
          ? (thisProject.dueDays > 0)
            ? `${output}<td>${localeRelativeDateFromNumber(thisProject.dueDays)}</td>`
            : `${output}<td><p><b>${localeRelativeDateFromNumber(thisProject.dueDays)}</b></p></td>` // the <p>...</p> is needed to trigger bold colouring (if set)
          : `${output}<td></td>`
      }
    } else {
      output += '<td></td><td></td>' // to avoid layout inconsistencies
    }
    output += '\n\t</tr>'
  }
  else if (style === 'Markdown' || style === 'list') {
    output = '- '
    output += `${decoratedProjectTitle(thisProject, style, config)}`
    // logDebug('', `${decoratedProjectTitle(thisProject, style, config
    if (config.displayDates && !thisProject.isPaused) {
      if (thisProject.isCompleted) {
    // completed after X or cancelled X ago, depending
        const completionRef = (thisProject.completedDuration)
          ? thisProject.completedDuration
          : "completed"
        output += `\t(Completed ${completionRef})`
      } else if (thisProject.isCancelled) {
        // completed after X or cancelled X ago, depending
        const cancellationRef = (thisProject.cancelledDuration)
          ? thisProject.cancelledDuration
          : "cancelled"
        output += `\t(Cancelled ${cancellationRef})`
      }
    }
    if (config.displayProgress && !thisProject.isCompleted && !thisProject.isCancelled) {
    // Show progress comment if available ...
      if (thisProject.lastProgressComment !== '' && !thisProject.isCompleted && !thisProject.isCancelled) {
        output += `\t${thisPercent} done: ${thisProject.lastProgressComment}`
      }
      // ... else show stats
      else {
        output += `\t${statsProgress}`
      }
    }
    if (config.displayDates && !thisProject.isPaused && !thisProject.isCompleted && !thisProject.isCancelled) {
      output = (thisProject.dueDays != null && !isNaN(thisProject.dueDays)) ? `${output}\tdue ${localeRelativeDateFromNumber(thisProject.dueDays)}` : output
      output =
        (thisProject.nextReviewDays != null && !isNaN(thisProject.nextReviewDays))
          ? thisProject.nextReviewDays > 0
            ? `${output}\tReview ${localeRelativeDateFromNumber(thisProject.nextReviewDays)}`
            : `${output}\tReview due **${localeRelativeDateFromNumber(thisProject.nextReviewDays)}**`
          : output
    }
    // Add nextAction output if wanted and it exists
    // logDebug('Project::generateProjectOutputLine', `nextActionRawContent: ${thisProject.nextActionRawContent}`)
    if (config.displayNextActions && thisProject.nextActionRawContent !== '' && !thisProject.isCompleted && !thisProject.isCancelled) {
      const nextActionContent = thisProject.nextActionRawContent.slice(getLineMainContentPos(thisProject.nextActionRawContent)).replace(config.nextActionTag, '')
      output += `\n\t- Next action: ${nextActionContent}`
    }
  } else {
    logWarn('Project::generateProjectOutputLine', `Unknown style '${style}'; nothing returned.`)
    output = ''
  }
  return output
}

/**
 * Returns title of note as folder name + link, also showing complete or cancelled where relevant.
 * Supports 'Markdown' or 'HTML' styling or simpler 'list' styling
 * Note: There is now a non-Class version of the function.
 * @param {Project} thisProject 'Markdown' or 'HTML' or 'list'
 * @param {string} style 'Markdown' or 'HTML' or 'list'
 * @param {any} config
 * @return {string} - title as wikilink
 */
function decoratedProjectTitle(thisProject: Project, style: string, config: any): string {
  const folderNamePart = config.includeFolderName ? `${thisProject.folder} / ` : ''
  const titlePart = thisProject.title ?? '(error, not available)'
  // const titlePartEncoded = encodeURIComponent(thisProject.title) ?? '(error, not available)'
  switch (style) {
    case 'Rich': {
      // Method 1: make [[notelinks]] via x-callbacks
      // Method 1a: x-callback using note title
      // const noteOpenActionURL = createOpenOrDeleteNoteCallbackUrl(thisProject.title, "title", "", "splitView", false)
      // Method 1b: x-callback using filename
      const noteOpenActionURL = createOpenOrDeleteNoteCallbackUrl(thisProject.filename, "filename", "", null, false)
      const noteTitleWithOpenAction = `<span class="noteTitle"><a href="${noteOpenActionURL}"><i class="fa-regular fa-file-lines pad-right"></i> ${folderNamePart}${titlePart}</a></span>`
      // TODO: if possible change to use internal links: see method in Dashboard
      // see discussion at https://discord.com/channels/763107030223290449/1007295214102269982/1016443125302034452
      // const noteTitleWithOpenAction = `<button onclick=openNote()>${folderNamePart}${titlePart}</button>`

      if (thisProject.isCompleted) {
        return `<span class="checked">${noteTitleWithOpenAction}</span>`
      } else if (thisProject.isCancelled) {
        return `<span class="cancelled">${noteTitleWithOpenAction}</span>`
      } else if (thisProject.isPaused) {
        return `<span class="paused">Paused: ${noteTitleWithOpenAction}</span>`
      } else {
        return `${noteTitleWithOpenAction}`
      }
    }

    case 'Markdown': {
      if (thisProject.isCompleted) {
        return `[x] ${folderNamePart}[[${titlePart}]]`
      } else if (thisProject.isCancelled) {
        return `[-] ${folderNamePart}[[${titlePart}]]`
      } else if (thisProject.isPaused) {
        return `⏸ **Paused**: ${folderNamePart}[[${titlePart}]]`
      } else {
        return `${folderNamePart}[[${titlePart}]]` // if this has a [ ] prefix then it of course turns it into a task, which is probably not what we want.
      }
    }

    case 'list': {
      if (thisProject.isCompleted) {
        return `${folderNamePart}[[${titlePart}]]`
      } else if (thisProject.isCancelled) {
        return `~~${folderNamePart}[[${titlePart}]]~~`
      } else if (thisProject.isPaused) {
        return `⏸ **Paused**: ${folderNamePart}[[${titlePart}]]`
      } else {
        return `${folderNamePart}[[${titlePart}]]` // if this has a [ ] prefix then it of course turns it into a task, which is probably not what we want.
      }
    }

    default:
      logWarn('Project::decoratedProjectTitle', `Unknown style '${style}'; nothing returned.`)
      return ''
  }
}

/**
 * Add SVG ready for percent ring with the number in the middle.
 * Note: this is kept in this file as it is specific to Review functionality. But it relies on the more generic 'makeSVGPercentRing' helper function.
 * Note: It needs to be followed by call to JS function setPercentRing() to set the ring's state.
 * Note: This is a non-Class version of the function.
 * @param {number} percent 0-100
 * @param {string?} color for ring and text (as colour name or #RGB), or 'multicol' to mean shading between red and green
 * @param {string?} textToShow inside ring, which can be different from just the percent, which is used by default
 * @returns {string} SVG code to insert in HTML
 */
function addSVGPercentRing(thisProject: Project, percent: number, colorIn: string = 'multicol', text: string = ''): string {
  const textToShow = (text !== '') ? text : String(percent)
  const colorToUse = (colorIn === 'multicol')
    ? redToGreenInterpolation(percent)
    : colorIn
  return makeSVGPercentRing(percent, colorToUse, textToShow, thisProject.ID)
}
