// @flow
//-----------------------------------------------------------------------------
// Helper functions for Review plugin
// @jgclark
// Last updated 27.2.2023 for v0.9.2, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import pluginJson from '../plugin.json'
import moment from 'moment/min/moment-with-locales'
import { checkString } from '@helpers/checkType'
import {
  calcOffsetDate, calcOffsetDateStr, daysBetween, getDateObjFromDateString, getDateFromUnhyphenatedDateString, includesScheduledFutureDate, relativeDateFromDate,
  // relativeDateFromNumber,
  toISODateString, unhyphenateString
} from '@helpers/dateTime'
import { localeRelativeDateFromNumber } from '@helpers/NPdateTime'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { createOpenOrDeleteNoteCallbackUrl, createRunPluginCallbackUrl, getContentFromBrackets, getStringFromList } from '@helpers/general'
import {
  getCallbackCodeString,
  makeSVGPauseIcon,
  makeSVGPercentRing,
  redToGreenInterpolation,
  rgbToHex
} from '@helpers/HTMLView'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { getOrMakeMetadataLine } from '@helpers/NPparagraph'
import { showMessage } from '@helpers/userInput'
import { isDone, isOpen } from '@helpers/utils'

//------------------------------
// Config setup

export type ReviewConfig = {
  outputStyle: string,
  folderToStore: string,
  foldersToIgnore: Array<string>,
  noteTypeTags: Array<string>,
  displayDates: boolean,
  displayProgress: boolean,
  displayOrder: string,
  displayGroupedByFolder: boolean,
  hideTopLevelFolder: boolean,
  displayArchivedProjects: boolean,
  finishedListHeading: string,
  startMentionStr: string,
  completedMentionStr: string,
  cancelledMentionStr: string,
  dueMentionStr: string,
  reviewIntervalMentionStr: string,
  reviewedMentionStr: string,
  confirmNextReview: boolean,
  _logLevel: string
}

/**
 * Get config settings
 * @author @jgclark
 * @return {ReviewConfig} object with configuration
 */
export async function getReviewSettings(): Promise<any> {
  // logDebug(pluginJson, `Start of getReviewSettings()`)
  try {
    // Get settings
    const config: ReviewConfig = await DataStore.loadJSON('../jgclark.Reviews/settings.json')

    if (config == null || Object.keys(config).length === 0) {
      await showMessage(`Cannot find settings for the 'Reviews' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    }
    // clo(config, `Review settings:`)

    // Need to store some things in the Preferences API mechanism, in order to pass things to the Project class
    DataStore.setPreference('startMentionStr', config.startMentionStr)
    DataStore.setPreference('completedMentionStr', config.completedMentionStr)
    DataStore.setPreference('cancelledMentionStr', config.cancelledMentionStr)
    DataStore.setPreference('dueMentionStr', config.dueMentionStr)
    DataStore.setPreference('reviewIntervalMentionStr', config.reviewIntervalMentionStr)
    DataStore.setPreference('reviewedMentionStr', config.reviewedMentionStr)

    return config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
    return
  }
}

//----------------------------------------------------------------

/**
 * Write the contents of a given preference to the log
 * @author @jgclark
 * @param {string} prefName
 */
export function logPreference(prefName: string): void {
  logDebug(pluginJson, `${prefName} contents:\n${checkString(DataStore.preference(prefName))}`)
}

/**
 * Calculate the next date to review, based on last review date and date interval.
 * TODO: change from new Date()
 * If no last review date, then the answer is today's date.
 * @author @jgclark
 * @param {Date} lastReviewDate - JS Date
 * @param {string} interval - interval specified as nn[bdwmqy]
 * @return {Date} - JS Date
 */
export function calcNextReviewDate(lastReviewDate: Date, interval: string): Date {
  const lastReviewDateStr: string = toISODateString(lastReviewDate)
  // $FlowIgnore[incompatible-type] as calcOffsetDate() will throw error rather than return null
  const reviewDate: Date = lastReviewDate != null ? calcOffsetDate(lastReviewDateStr, interval) : new Date() // today's date
  // TODO: simplify to const reviewDate: Date = lastReviewDate != null ? calcOffsetDate(toISODateString(lastReviewDate), interval) : new Date() // today's date ??
  return reviewDate
}

/**
 * From an array of strings, return the first string that matches the
 * wanted parameterised @mention, or empty String.
 * @author @jgclark
 * @param {Array<string>} mentionList - list of strings to search
 * @param {string} mention - string to match (with a following '(' to indicate start of parameter)
 * @return {?Date} - JS Date version, if valid date found
 */
export function getParamMentionFromList(mentionList: $ReadOnlyArray<string>, mention: string): string {
  // logDebug(pluginJson, `getMentionFromList for: ${mention}`)
  const res = mentionList.filter((m) => m.startsWith(`${mention}(`))
  return res.length > 0 ? res[0] : ''
}

/**
 * Read lines in 'note' and return any lines that contain fields
 * (that start with 'fieldName' parameter before a colon with text after).
 * The matching is done case insensitively, and only in the active region of the note.
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

function mostRecentProgressLine(progressLines: Array<string>): string {
  // Default to returning first line
  let outputLine = progressLines[0]
  // Then check each line to see if its newer
  let lastDatePart = '1000-01-01' // earliest possible YYYY-MM-DD date
  for (const progressLine of progressLines) {
    const progressLineParts = progressLine.split(/[:@]/)
    if (progressLineParts.length >= 3) {
      const thisDatePart = progressLineParts[1]
      if (thisDatePart > lastDatePart) {
        outputLine = progressLine
        // logDebug('Project::mostRecentProgressLine', `Found latest datePart ${thisDatePart}`)
      }
      lastDatePart = thisDatePart
    }
  }
  return outputLine
}

//-----------------------------------------------------------------------------

/**
 * Define 'Project' class to use in GTD.
 * Holds title, last reviewed date, due date, review interval, completion date,
 * number of closed, open & waiting for tasks.
 * 
 * @example To create a project instance for a note call 'const x = new Project(note)'
 * @author @jgclark
 */
export class Project {
  // Types for the class instance properties
  note: TNote
  metadataPara: TParagraph
  noteType: string // #project, #area, etc.
  title: string
  startDate: ?Date
  dueDate: ?Date
  dueDays: number = NaN
  reviewedDate: ?Date
  reviewInterval: ?string
  nextReviewDate: ?Date
  nextReviewDateStr: ?string
  nextReviewDays: number = NaN
  completedDate: ?Date
  completedDuration: ?string // string description of time to completion, or how long ago completed
  cancelledDate: ?Date
  cancelledDuration: ?string // string description of time to cancellation, or how long ago cancelled
  // finishedDays: number = NaN // days until project was completed or cancelled
  isCompleted: boolean = false
  openTasks: number
  completedTasks: number
  waitingTasks: number
  futureTasks: number
  isCancelled: boolean = false
  isPaused: boolean = false
  folder: string
  percentComplete: number = NaN
  lastProgressComment: string = '' // e.g. "Progress: 60@20220809: comment
  ID: string // required when making HTML views

  constructor(note: TNote) {
    try {
      // Make a (nearly) unique number for this instance (needed for the addressing the SVG circles) -- I can't think of a way of doing this neatly to create one-up numbers, that doesn't create clashes when re-running over a subset of notes
      this.ID = String(Math.round((Math.random()) * 99999))
      if (note == null || note.title == null) {
        throw new Error('Error in constructor: invalid note passed')
      }
      this.note = note
      this.title = note.title
      this.folder = getFolderFromFilename(note.filename)
      const paras = note.paragraphs
      const metadataLineIndex = getOrMakeMetadataLine(note)
      this.metadataPara = paras[metadataLineIndex]
      const mentions: $ReadOnlyArray<string> = note.mentions
      // This line returns some items out of date. TEST: EM says this has now  been fixed
      // Note: Here's an alternate that just gets mentions from the metadataline
      const altMentions = (paras[metadataLineIndex].content + ' ').split(' ').filter((f) => f[0] === '@')
      const hashtags: $ReadOnlyArray<string> = note.hashtags
      const altHashtags = (paras[metadataLineIndex].content + ' ').split(' ').filter((f) => f[0] === '#')

      // work out noteType -- first or second hashtag in note
      // const firstHashtag = hashtags[0]
      this.noteType = (hashtags[0] !== '#paused') ? hashtags[0] :
        (hashtags[1]) ? hashtags[1] : ''
      if (this.noteType === '') {
        logInfo('Project constructor', `- found no noteType for '${this.title}' in folder ${this.folder}`)
      }

      // read in various metadata fields (if present)
      // FIXME: doesn't pick up reviewed() if not in metadata line
      // (now uses DataStore.preference mechanism to pick up current terms for @start, @due, @reviewed etc.)
      let tempDateStr = getParamMentionFromList(mentions, checkString(DataStore.preference('startMentionStr')))
      this.startDate = tempDateStr !== '' ? getDateObjFromDateString(tempDateStr) : undefined
      // read in due date (if found)
      tempDateStr = getParamMentionFromList(mentions, checkString(DataStore.preference('dueMentionStr')))
      this.dueDate = tempDateStr !== '' ? getDateObjFromDateString(tempDateStr) : undefined
      // read in reviewed date (if found)
      tempDateStr = getParamMentionFromList(mentions, checkString(DataStore.preference('reviewedMentionStr')))
      this.reviewedDate = tempDateStr !== '' ? getDateObjFromDateString(tempDateStr) : undefined
      // read in completed date (if found)
      tempDateStr = getParamMentionFromList(mentions, checkString(DataStore.preference('completedMentionStr')))
      this.completedDate = tempDateStr !== '' ? getDateObjFromDateString(tempDateStr) : undefined
      // read in cancelled date (if found)
      tempDateStr = getParamMentionFromList(mentions, checkString(DataStore.preference('cancelledMentionStr')))
      this.cancelledDate = tempDateStr !== '' ? getDateObjFromDateString(tempDateStr) : undefined
      // read in review interval (if found)
      const tempIntervalStr = getParamMentionFromList(mentions, checkString(DataStore.preference('reviewIntervalMentionStr')))
      this.reviewInterval = tempIntervalStr !== '' ? getContentFromBrackets(tempIntervalStr) : undefined
      // calculate the durations from these dates
      this.calcDurations()

      // count tasks
      this.openTasks = paras.filter(isOpen).length // TEST: me replacing line below
      // this.openTasks = paras.filter((p) => p.type === 'open').length
      this.completedTasks = paras.filter(isDone).length
      this.waitingTasks = paras.filter(isOpen).filter((p) => p.content.match('#waiting')).length // TEST: me replacing line below
      // this.waitingTasks = paras.filter((p) => p.type === 'open').filter((p) => p.content.match('#waiting')).length
      this.futureTasks = paras.filter(isOpen).filter((p) => includesScheduledFutureDate(p.content)).length // TEST: me replacing line below
      this.futureTasks = paras.filter((p) => p.type === 'open').filter((p) => includesScheduledFutureDate(p.content)).length

      if (this.folder.startsWith('TEST') || this.title.startsWith('Annual') || this.title.includes('Test')) {
        logDebug('Project constructor', `- for '${this.title}'`)
        logDebug('Project constructor', `  - metadataLine = ${paras[metadataLineIndex].content}`)
        logDebug('Project constructor', `  - noteType: ${this.noteType}`)
        logDebug('Project constructor', `  - mentions: ${String(mentions)}`)
        logDebug('Project constructor', `  - altMentions: ${String(altMentions)}`)
        logDebug('Project constructor', `  - hashtags: ${String(hashtags)}`)
        logDebug('Project constructor', `  - altHashtags: ${String(altHashtags)}`)
        logDebug('Project constructor', `  - reviewedDate: ${this.reviewedDate ? String(this.reviewedDate) : '-'}`)
        logDebug('Project constructor', `  - reviewInterval: ${this.reviewInterval ?? '-'}`)
        logDebug('Project constructor', `  - open: ${String(this.openTasks)} / completed: ${String(this.completedTasks)} / waiting: ${String(this.waitingTasks)} / future: ${String(this.futureTasks)}`)
      }

      // Track percentComplete: either through calculation from counts ...
      const totalTasks = this.completedTasks + this.openTasks - this.futureTasks
      if (totalTasks > 0) {
        this.percentComplete = Math.round((this.completedTasks / totalTasks) * 100)
        // logDebug('Project constructor', `- ${this.title}: % complete = ${this.percentComplete}`)
      } else {
        this.percentComplete = NaN
        // logDebug('Project constructor', `- ${this.title}: % complete = NaN`)
      }
      // ... or through specific 'Progress' field
      const progressLines = getFieldsFromNote(this.note, 'progress')

      if (progressLines.length > 0) {
        // Get the most recent line to use
        const progressLine = mostRecentProgressLine(progressLines)

        // Get the first part of the value of the Progress field: nn@YYYYMMDD ...
        const progressLineParts = progressLine.split(/[:@]/)
        if (progressLineParts.length >= 3) {
          this.percentComplete = Number(progressLineParts[0])
          const datePart = unhyphenateString(progressLineParts[1])
          // $FlowFixMe
          this.lastProgressComment = `${progressLineParts[2].trim()} (${relativeDateFromDate(getDateFromUnhyphenatedDateString(datePart))})`
          // logDebug('Project constructor', `- progress field -> ${this.percentComplete} / '${this.lastProgressComment}' from <${progressLine}>`)
        } else {
          logWarn('Project constructor', `- cannot properly parse progress field <${progressLine}> in project '${this.title}'`)
        }
      }

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
      // logDebug('Project constructor', `- created ID ${this.ID} for '${this.title}': ${this.nextReviewDateStr ?? '-'} / ${String(this.nextReviewDays)} / ${String(this.isCompleted)} / ${String(this.isCancelled)} / ${String(this.isPaused)}`)
    }
    catch (error) {
      logError('Project constructor', error.message)
    }
  }

  /**
   * Is this project ready for review?
   * Return true if review is overdue and not archived or completed
   * @return {boolean}
   */
  get isReadyForReview(): boolean {
    // logDebug(pluginJson, `isReadyForReview: ${this.title}:  ${String(this.nextReviewDays)} ${String(this.isPaused)}`)
    // $FlowFixMe[invalid-compare]
    return !this.isPaused && this.nextReviewDays != null && !isNaN(this.nextReviewDays) && this.nextReviewDays <= 0
  }

  /**
   * From the metadata read in, calculate due/review/finished durations
   */
  calcDurations(): void {
    try {
      // TODO: change from new Date()
      const now = new Date()
      this.dueDays =
        this.dueDate != null
          ? // NB: Written while there was an error in EM's Calendar.unitsBetween() function
          daysBetween(now, this.dueDate)
        : NaN

      // Calculate durations or time since cancel/complete
      if (this.startDate != null) {
        const momTSD = moment(this.startDate)
        if (this.completedDate != null) {
          this.completedDuration = 'after ' + momTSD.to(moment(this.completedDate), true)
          // logDebug(`-> completedDuration = ${this.completedDuration}`)
        }
        else if (this.cancelledDate != null) {
          this.cancelledDuration = 'after ' + momTSD.to(moment(this.cancelledDate), true)
          // logDebug(`-> cancelledDuration = ${this.cancelledDuration}`)
        }
      }
      else {
        if (this.completedDate != null) {
          this.completedDuration = 'after ' + moment(this.completedDate).toNow(true)
          // logDebug(`-> completedDuration = ${this.completedDuration}`)
        }
        else if (this.cancelledDate != null) {
          this.cancelledDuration = 'after ' + moment(this.cancelledDate).toNow(true)
          // logDebug(`-> completedDuration = ${this.completedDuration}`)
        }
        else {
          // Nothing to do
          // logDebug('calcDurations', `No completed or cancelled dates.`)
        }
      }

      // Calculate next review due date
      if (this.reviewInterval != null) {
        if (this.reviewedDate != null) {
          this.nextReviewDate = calcNextReviewDate(this.reviewedDate, this.reviewInterval)
          if (this.nextReviewDate != null) {
            // this now uses moment and truncated (not rounded) date diffs in number of days
            this.nextReviewDays = daysBetween(now, this.nextReviewDate)
            // logDebug('calcDurations', `${String(this.reviewedDate)} + ${this.reviewInterval} -> nextReviewDate: ${this.nextReviewDateStr} = ${String(this.nextReviewDays) ?? '-'}`)
          } else {
            throw new Error(`nextReviewDate is null; reviewedDate = ${String(this.reviewedDate)}`)
          }
        } else {
          // no next review date, so set at today
          this.nextReviewDate = now
          this.nextReviewDays = 0
        }
      }
      // logDebug('calcDurations', `-> reviewedDate = ${String(this.reviewedDate)} / dueDays = ${String(this.dueDays)} / nextReviewDate = ${String(this.nextReviewDate)} / nextReviewDays = ${String(this.nextReviewDays)}`)
    } catch (error) {
      logError('calcDurations', error.message)
    }
  }

  /**
   * Close a Project/Area note by updating the metadata and saving it:
   * - adding @completed(<today's date>)
   * @author @jgclark
   * @returns {string} new machineSummaryLine or empty on failure
   */
  completeProject(): string {
    try {
      // update the metadata fields
      // this.isActive = false
      this.isCompleted = true
      this.isCancelled = false
      this.isPaused = false
      this.completedDate = new Date() // TODO: change from new Date()
      this.calcDurations()

      // re-write the note's metadata line
      logDebug('completeProject', `Completing '${this.title}' ...`)
      const newMetadataLine = this.generateMetadataLine()
      logDebug('completeProject', `- metadata now '${newMetadataLine}'`)

      // send update to Editor
      // TODO: Will need updating when supporting frontmatter for metadata
      this.metadataPara.content = newMetadataLine
      Editor.updateParagraph(this.metadataPara)
      // Now need to update the Cache 
      const updatedNote = DataStore.updateCache(Editor.note, true)
      logDebug('completeProject', `- called updateCache(Editor.note, true) -> ???`)
      // and now reload the note into this Project instance
      // TODO: somehow!

      const newMSL = this.machineSummaryLine()
      logDebug('completeProject', `- returning mSL '${newMSL}'`)
      return newMSL
    }
    catch (error) {
      logError(pluginJson, `Error completing project for for ${this.title}: ${error.message}`)
      return ''
    }
  }

  /**
   * Cancel a Project/Area note by updating the metadata and saving it:
   * - adding @cancelled(<today's date>)
   * @author @jgclark
   * @returns {boolean} success or not 
   */
  cancelProject(): boolean {
    try {
      // update the metadata fields
      // this.isActive = false
      this.isCompleted = false
      this.isCancelled = true
      this.isPaused = false
      this.cancelledDate = new Date() // TODO: change from new Date()
      this.calcDurations()

      // re-write the note's metadata line
      logDebug('cancelProject', `Cancelling '${this.title}' ...`)
      const newMetadataLine = this.generateMetadataLine()
      logDebug('cancelProject', `- metadata now '${newMetadataLine}'`)

      // send update to Editor TODO: Will need updating when supporting frontmatter for metadata
      this.metadataPara.content = newMetadataLine
      Editor.updateParagraph(this.metadataPara)
      // Now need to update the Cache 
      const updatedNote = DataStore.updateCache(Editor.note, true)
      logDebug('cancelProject', `- called updateCache(Editor.note, true) -> ???`)
      // and now reload the note into this Project instance
      // TODO: somehow!

      logDebug('cancelProject', `- mSL should -> ${this.machineSummaryLine()}`)
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
   * @returns {string} new machineSummaryLine or empty on failure
   */
  togglePauseProject(): string {
    try {
      // update the metadata fields
      this.isCompleted = false
      this.isCancelled = false
      this.isPaused = !this.isPaused // toggle

      // re-write the note's metadata line
      logDebug('togglePauseProject', `Paused state now toggled to ${String(this.isPaused)} for '${this.title}' ...`)
      const newMetadataLine = this.generateMetadataLine()
      logDebug('togglePauseProject', `- metadata now '${newMetadataLine}'`)

      // send update to Editor TODO: Will need updating when supporting frontmatter for metadata
      this.metadataPara.content = newMetadataLine
      Editor.updateParagraph(this.metadataPara)
      // Now need to update the Cache 
      const updatedNote = DataStore.updateCache(Editor.note, true)
      logDebug('togglePauseProject', `- called updateCache(Editor.note, true) -> ???`)
      // and now reload the note into this Project instance
      // TODO: somehow!

      const newMSL = this.machineSummaryLine()
      logDebug('togglePauseProject', `- returning mSL '${newMSL}'`)
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
  generateMetadataLine(): string {
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
   * v2: Returns TSV line with just the data needed to filter output lists
   * @return {string}
   */
  machineSummaryLine(): string {
    try {
      let output = (!this.isPaused && this.nextReviewDays != null && !isNaN(this.nextReviewDays)) ? String(this.nextReviewDays) : 'NaN'
      output += '\t'
      output += (!this.isPaused && this.dueDays != null && !isNaN(this.dueDays)) ? String(this.dueDays) : 'NaN'
      output += `\t${this.title}\t`
      output += this.folder && this.folder !== undefined ? `${this.folder}\t` : '\t'
      output += (this.noteType) ? `${this.noteType} ` : ''
      output += this.isPaused ? '#paused ' : ''
      return output
    }
    catch (error) {
      logError('machineSummaryLine', error.message)
      return '<error>' // for completeness
    }
  } 

  /**
   * Returns title of note as folder name + link, also showing complete or cancelled where relevant.
   * Now also supports 'Markdown' or 'HTML' styling.
   * @param {string} style 'Markdown' or 'HTML'
   * @param {boolean} includeFolderName whether to include folder name at the start of the entry.
   * @return {string} - title as wikilink
   */
  decoratedProjectTitle(style: string, includeFolderName: boolean): string {
    const folderNamePart = includeFolderName ? this.folder + ' ' : ''
    const titlePart = this.title ?? '(error, not available)'
    const titlePartEncoded = encodeURIComponent(this.title) ?? '(error, not available)'
    switch (style) {
      case 'Rich':
        // Method 1: make [[notelinks]] via x-callbacks
        const noteOpenActionURL = createOpenOrDeleteNoteCallbackUrl(this.title, "title", "", "splitView", false)
        const noteTitleWithOpenAction = `<span class="noteTitle"><a href=${noteOpenActionURL}"><i class="fa-regular fa-file-lines"></i> ${folderNamePart}${titlePart}</a></span>`
        // TODO: change to use Method 2: internal links
        // see discussion at https://discord.com/channels/763107030223290449/1007295214102269982/1016443125302034452
        // const noteTitleWithOpenAction = `<button onclick=openNote()>${folderNamePart}${titlePart}</button>`

        if (this.isCompleted) {
          return `<span class="checked">${noteTitleWithOpenAction}</span>`
        } else if (this.isCancelled) {
          return `<span class="cancelled">${noteTitleWithOpenAction}</span>`
        } else if (this.isPaused) {
          return `<span class="paused">Paused: ${noteTitleWithOpenAction}</span>`
        } else {
          return `${noteTitleWithOpenAction}`
        }

      case 'Markdown':
        if (this.isCompleted) {
          return `[x] ${folderNamePart}[[${titlePart}]]`
        } else if (this.isCancelled) {
          return `[-] ${folderNamePart}[[${titlePart}]]`
        } else if (this.isPaused) {
          return `⏸ **Paused**: ${folderNamePart}[[${titlePart}]]`
        } else {
          return `${folderNamePart}[[${titlePart}]]` // if this has a [ ] prefix then it of course turns it into a task, which is probably not what we want.
        }

      default:
        logWarn('Project::decoratedProjectTitle', `Unknown style '${style}'; nothing returned.`)
        return ''
    }
  }

  /**
   * Returns line showing more detailed summary of the project, for output in Rich (HTML) or Markdown formats.
   * Now uses fontawesome icons for some indicators.
   * @param {string} style
   * @param {boolean} includeFolderName
   * @param {boolean?} displayDates
   * @param {boolean?} displayProgress
   * @returns {string}
   */
  detailedSummaryLine(style: string, includeFolderName: boolean, displayDates: boolean = true, displayProgress: boolean = true): string {
    let output = ''
    const thisPercent = (isNaN(this.percentComplete)) ? '0%' : ` ${this.percentComplete}%`
    const totalTasksStr = (this.completedTasks + this.openTasks).toLocaleString()
    const statsProgress = `${thisPercent} done (of ${totalTasksStr} ${(this.completedTasks + this.openTasks > 1) ? 'tasks' : 'task'})`

    switch (style) {
      case 'Rich':
        output = '\t<tr>\n\t\t'

        // Column 1: circle indicator + Column 2a: Project name/link
        if (this.isCompleted) {
          output += '<td class="checked">' + this.addFAIcon('fa-solid fa-circle-check') + '</td>' // ('checked' gives colour)
          output += `<td>${this.decoratedProjectTitle(style, includeFolderName)}`
        }
        else if (this.isCancelled) {
          output += '<td class="cancelled">' + this.addFAIcon('fa-solid fa-circle-xmark') + '</td>' // ('cancelled' gives colour)
          output += `<td>${this.decoratedProjectTitle(style, includeFolderName)}`
        }
        else if (this.isPaused) {
          output += '<td>' + this.addFAIcon("fa-solid fa-circle-pause", "#888888") + '</td>'
          output += `<td>${this.decoratedProjectTitle(style, includeFolderName)}`
        }
        else if (isNaN(this.percentComplete)) { // NaN
          // output += '<td>' + this.addSVGPercentRing(100, 'grey', '0') + '</td>'
          output += '<td>' + this.addFAIcon("fa-solid fa-circle-question", "#888888") + '</td>'
          output += `\n\t\t\t<td>${this.decoratedProjectTitle(style, includeFolderName)}`
        }
        else if (this.percentComplete === 0) {
          output += '<td>' + this.addSVGPercentRing(100, '#FF000088', '0') + '</td>'
          output += `<td>${this.decoratedProjectTitle(style, includeFolderName)}`
        }
        else {
          output += '<td>' + this.addSVGPercentRing(this.percentComplete, 'multicol', String(this.percentComplete)) + '</td>'
          output += `\n\t\t\t<td>${this.decoratedProjectTitle(style, includeFolderName)}`
        }

        // Column 2b: progress information
        if (displayProgress && !this.isCompleted && !this.isCancelled) {
          // Add this.lastProgressComment (if it exists) on line under title (and project is still open)
          if (displayDates) {
            if (this.lastProgressComment !== '') {
              output = `${output}<br />${this.lastProgressComment}</td>`
            } else {
              output = `${output}<br />${statsProgress}</td>`
            }
          } else {
            // write progress in next cell instead
            if (this.lastProgressComment !== '') {
              output += `</td>\n\t\t\t<td>${this.lastProgressComment}</td>`
            } else {
              output += `</td>\n\t\t\t<td>${statsProgress}</td>`
            }
          }
        }

        // Columns 3/4: date information
        if (displayDates && !this.isPaused /** && !this.isCompleted && !this.isCancelled */) { // TODO: Why the former check? (also see MD version below)
          if (this.completedDate != null) {
            // "completed after X" or "cancelled X ago", depending
            const completionRef = (this.completedDuration) ? this.completedDuration : relativeDateFromDate(this.completedDate)
            output += `<td colspan=2 class="checked">Completed ${completionRef}</td><td></td>`
          } else if (this.cancelledDate != null) {
            // 'cancelled after X' or 'cancelled X ago', depending
            const cancellationRef = (this.cancelledDuration) ? this.cancelledDuration : relativeDateFromDate(this.cancelledDate)
            output += `<td colspan=2 class="cancelled">Cancelled ${cancellationRef}</td><td></td>`
          }
          if (!this.isCompleted && !this.isCancelled) {
            output = (this.nextReviewDays != null && !isNaN(this.nextReviewDays))
              ? (this.nextReviewDays > 0)
                ? `${output}<td>${localeRelativeDateFromNumber(this.nextReviewDays)}</td>`
                : `${output}<td><p><b>${localeRelativeDateFromNumber(this.nextReviewDays)}</b></p></td>` // the <p>...</p> is needed to trigger bold colouring (if set)
              : `${output}<td></td>`
            output = (this.dueDays != null && !isNaN(this.dueDays))
              ? (this.dueDays > 0)
                ? `${output}<td>${localeRelativeDateFromNumber(this.dueDays)}`
                : `${output}<td><p><b>${localeRelativeDateFromNumber(this.dueDays)}</b></p></td>` // the <p>...</p> is needed to trigger bold colouring (if set)
              : `${output}<td></td>`
          }
        } else {
          output += '<td></td><td></td>' // to avoid layout inconsistencies
        }
        output += '</tr>'
        break

      case 'Markdown':
        output = '- '
        output += `${this.decoratedProjectTitle(style, includeFolderName)}`
        // logDebug('', `${this.decoratedProjectTitle(style, includeFolderName)}`)
        if (displayDates) {
          if (this.completedDate != null) {
            // TODO: completed after X or cancelled X ago, depending
            // Drop finishedDays, but create mini funcs to return ^^^ text instead
            // output += `\t(Completed ${relativeDateFromNumber(this.finishedDays)})`
            output += `\t(Completed ${this.completedDuration ?? ''})`
          } else if (this.cancelledDate != null) {
            // TODO: completed after X or cancelled X ago, depending
            // output += `\t(Cancelled ${relativeDateFromNumber(this.finishedDays)})`
            output += `\t(Cancelled ${this.cancelledDuration ?? ''})`
          }
        }
        if (displayProgress && !this.isCompleted && !this.isCancelled) {
          // const thisPercent = (isNaN(this.percentComplete)) ? '' : ` (${this.percentComplete}%)`
          // Show progress comment if available ...
          if (this.lastProgressComment !== '' && !this.isCompleted && !this.isCancelled) {
            output += `\t${thisPercent} done: ${this.lastProgressComment}`
          }
          // ... else show stats
          else {
            output += `\t${statsProgress}`
            // Older more detailed stats:
            // output += `\tc${this.completedTasks.toLocaleString()}${thisPercent} / o${this.openTasks} / w${this.waitingTasks} / f${this.futureTasks}`
          }
        }
        if (displayDates && !this.isPaused && !this.isCompleted && !this.isCancelled) {
          output = (this.dueDays != null && !isNaN(this.dueDays)) ? `${output}\tdue ${localeRelativeDateFromNumber(this.dueDays)}` : output
          output =
            (this.nextReviewDays != null && !isNaN(this.nextReviewDays))
              ? this.nextReviewDays > 0
              ? `${output}\tReview ${localeRelativeDateFromNumber(this.nextReviewDays)}`
              : `${output}\tReview due **${localeRelativeDateFromNumber(this.nextReviewDays)}**`
            : output
        }
        break

      default:
        logWarn('Project::detailedSummaryLine', `Unknown style '${style}'; nothing returned.`)
        output = ''
    }
    return output
  }

  /**
   * Add SVG ready for percent ring with the number in the middle.
   * Note: this is kept in this file as it is specific to Review functionality. But it relies on the more generic 'makeSVGPercentRing' helper function.
   * Note: It needs to be followed by call to JS function setPercentRing() to set the ring's state.
   * @param {number} percent 0-100
   * @param {string?} color for ring and text (as colour name or #RGB), or 'multicol' to mean shading between red and green
   * @param {string?} textToShow inside ring, which can be different from just the percent, which is used by default
   * @returns {string} SVG code to insert in HTML
   */
  addSVGPercentRing(percent: number, colorIn: string = 'multicol', text: string = ''): string {
    const textToShow = (text !== '') ? text : String(percent)
    const colorToUse = (colorIn === 'multicol')
      ? redToGreenInterpolation(percent)
      : colorIn
    return makeSVGPercentRing(percent, colorToUse, textToShow, this.ID)
  }

  /**
   * Note: deprecated in favour of addFAIcon().
   * Insert one of NP's state icons in given color.
   * Other styling comes from CSS for 'circle-char-text'
   * @param {string} char to display (normally just 1 character)
   * @param {string} colorStr 
   * @returns HTML string to insert
   */
  // addNPStateIcon(char: string, colorStr: string = ''): string {
  //   if (colorStr !== '') {
  //     return `<span class="circle-char-text" style="color: ${colorStr}">${char}</span>`
  //   } else {
  //     return `<span class="circle-char-text">${char}</span>`
  //   }
  // }

  /**
   * Insert a fontawesome icon in given color.
   * Other styling comes from CSS for 'circle-icon' (just sets size)
   * Note: it doesn't put item in a filled circle; just so far I've picked icons that look like that.
   * @param {string} faClasses CSS class name(s) to use for FA icons
   * @param {string} colorStr optional
   * @returns HTML string to insert
   */
  addFAIcon(faClasses: string, colorStr: string = ''): string {
    if (colorStr !== '') {
      return `<span class="${faClasses} circle-icon" style="color: ${colorStr}"></span>`
    } else {
      return `<span class="${faClasses} circle-icon"></span>`
    }
  }
}

/**
 * Form HTML for a 'fake' button that is used to call (via x-callback) one of this plugin's commands.
 * Note: this is not a real button, bcause at the time I started this real <button> wouldn't work in NP HTML views, and Eduard didn't know why.
 * @param {string} buttonText to display on button
 * @param {string} commandName to call when button is 'clicked'
 * @param {string?} tooltipText to hover display next to button
 * @returns {string}
 */
export function makeFakeButton(buttonText: string, commandName: string, commandArgs: string, tooltipText: string = ''): string {
  const xcallbackURL = createRunPluginCallbackUrl('jgclark.Reviews', commandName, commandArgs)
  let output = (tooltipText)
    ? `<span class="fake-button tooltip"><a class="button" href="${xcallbackURL}">${buttonText}</a><span class="tooltiptext">${tooltipText}</span></span>`
    : `<span class="fake-button"><a class="button" href="${xcallbackURL}">${buttonText}</span>`
  return output
}
