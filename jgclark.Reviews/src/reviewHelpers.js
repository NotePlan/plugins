// @flow
//-----------------------------------------------------------------------------
// Helper functions for Review plugin
// @jgclark
// Last updated 14.6.2022 for v0.6.5, @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Import Helper functions
import pluginJson from "../plugin.json"
import { checkString } from "@helpers/checkType"
import {
  castBooleanFromMixed,
  castHeadingLevelFromMixed,
  castNumberFromMixed,
  castStringArrayFromMixed,
  castStringFromMixed,
  trimAnyQuotes,
} from '@helpers/dataManipulation'
import {
  daysBetween,
  getDateObjFromDateString,
  includesScheduledFutureDate,
  relativeDateFromNumber,
  toISODateString,
} from '@helpers/dateTime'
import { calcOffsetDate } from '@helpers/NPdateTime'
import { clo, log, logError, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { percent } from '@helpers/general'
import { findNotesMatchingHashtags } from '@helpers/note'
import {
  getContentFromBrackets,
  getStringFromList,
} from '@helpers/general'
import {
  getOrMakeMetadataLine,
} from '@helpers/paragraph'
import { showMessage } from '@helpers/userInput'

//------------------------------
// Config setup

const configKey = "review"

export type ReviewConfig = {
  folderToStore: string,
  foldersToIgnore: Array<string>,
  noteTypeTags: Array<string>,
  displayOrder: string,
  includePercentages: boolean,
  displayGroupedByFolder: boolean,
  displayArchivedProjects: boolean,
  finishedListHeading: string,
  startMentionStr: string,
  completedMentionStr: string,
  cancelledMentionStr: string,
  dueMentionStr: string,
  reviewIntervalMentionStr: string,
  reviewedMentionStr: string,
  confirmNextReview: boolean,
}

/**
 * Get config settings using Config V2 system. (Have now removed support for Config V1.)
 * @author @jgclark
 * @return {ReviewConfig} object with configuration
 */
export async function getReviewSettings(): Promise<any> {
  // log(pluginJson, `Start of getReviewSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: ReviewConfig = await DataStore.loadJSON("../jgclark.Reviews/settings.json")

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      await showMessage(`Cannot find settings for the 'Reviews' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    }
    // $FlowIgnore[incompatible-call]
    // clo(v2Config, `${configKey} settings from V2:`)

    // Need to store some things in the Preferences API mechanism, in order to pass things to the Project class
    DataStore.setPreference('startMentionStr', v2Config.startMentionStr)
    // console.log(`written '${DataStore.preference('startMentionStr')} to startMentionStr`)
    DataStore.setPreference('completedMentionStr', v2Config.completedMentionStr)
    // console.log(`written '${DataStore.preference('completedMentionStr')} to completedMentionStr`)
    DataStore.setPreference('cancelledMentionStr', v2Config.cancelledMentionStr)
    // console.log(`written '${DataStore.preference('cancelledMentionStr')} to cancelledMentionStr`)
    DataStore.setPreference('dueMentionStr', v2Config.dueMentionStr)
    // console.log(`written '${DataStore.preference('dueMentionStr')} to dueMentionStr`)
    DataStore.setPreference('reviewIntervalMentionStr', v2Config.reviewIntervalMentionStr)
    // console.log(`written '${DataStore.preference('reviewIntervalMentionStr')} to reviewIntervalMentionStr`)
    DataStore.setPreference('reviewedMentionStr', v2Config.reviewedMentionStr)
    // console.log(`written '${DataStore.preference('reviewedMentionStr')} to reviewedMentionStr`)

    return v2Config
  }
  catch (err) {
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
  log(pluginJson, `${prefName} contents:\n${checkString(DataStore.preference(prefName))}`)
}

/**
 * Calculate the next date to review, based on last review date and date interval.
 * If no last review date, then the answer is today's date.
 * @author @jgclark
 * @param {Date} lastReviewDate - JS Date
 * @param {string} interval - interval specified as nn[bdwmqy]
 * @return {Date} - JS Date
 */
export function calcNextReviewDate(lastReviewDate: Date, interval: string): Date {
  const reviewDate: Date =
    lastReviewDate != null
      ? calcOffsetDate(toISODateString(lastReviewDate), interval)
      : new Date() // today's date
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
export  function getParamMentionFromList(
  mentionList: $ReadOnlyArray<string>,
  mention: string,
): string {
  // log(pluginJson, `getMentionFromList for: ${mention}`)
  const res = mentionList.filter((m) => m.startsWith(`${mention}(`))
  return res.length > 0 ? res[0] : ''
}

//-----------------------------------------------------------------------------

/**
 * Define 'Project' class to use in GTD.
 * Holds title, last reviewed date, due date, review interval, completion date,
 * number of closed, open & waiting for tasks.
 * To create a note call 'const x = new Project(note)'
 * @author @jgclark
*/
export class Project {
  // Types for the class instance properties
  note: TNote
  metadataPara: TParagraph
  noteType: string // project, area, other
  title: string
  startDate: ?Date
  dueDate: ?Date
  dueDays: ?number
  reviewedDate: ?Date
  reviewInterval: ?string
  nextReviewDate: ?Date
  nextReviewDays: ?number
  completedDate: ?Date
  cancelledDate: ?Date
  finishedDays: ?number // either days until completed or cancelled
  isCompleted: boolean
  openTasks: number
  completedTasks: number
  waitingTasks: number
  futureTasks: number
  isArchived: boolean
  isActive: boolean
  isCancelled: boolean
  folder: string
  
  constructor(note: TNote) {
    const mentions: $ReadOnlyArray<string> = note.mentions
    const hashtags: $ReadOnlyArray<string> = note.hashtags
    this.note = note
    const mln = getOrMakeMetadataLine(note)
    this.metadataPara = note.paragraphs[mln]
    this.title = note.title ?? '(error)'
    // log(pluginJson, `new Project: ${this.title} with metadata in line ${this.metadataPara.lineIndex}`)
    this.folder = getFolderFromFilename(note.filename)

    // work out note type (or '')
    this.noteType = (hashtags.includes('#project'))
      ? 'project'
      : (hashtags.includes('#area'))
        ? 'area'
        : ''

    // read in start date (if found)
    // now uses DataStore.preference mechanism to pick up current terms for @start, @due, @reviewed etc.
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
    this.openTasks = note.paragraphs.
      filter((p) => p.type === 'open').
      length
    this.completedTasks = note.paragraphs.
      filter((p) => p.type === 'done').
      length
    this.waitingTasks = note.paragraphs.
      filter((p) => p.type === 'open').
      filter((p) => p.content.match('#waiting')).
      length
    this.futureTasks = note.paragraphs.
      filter((p) => p.type === 'open').
      filter((p) => includesScheduledFutureDate(p.content)).
      length

    // make project completed if @completed_date set
    this.isCompleted = (this.completedDate != null) ? true : false
    // make project archived if #archive tag present
    this.isArchived = getStringFromList(hashtags, '#archive') !== ''
    // make project cancelled if #cancelled or #someday flag set or @cancelled date set
    this.isCancelled = getStringFromList(hashtags, '#cancelled') !== ''
      || getStringFromList(hashtags, '#someday') !== ''
      || (this.completedDate != null)

    // set project to active if #active is set or a @review date found,
    // and not completed / cancelled.
    this.isActive = (
      (getStringFromList(hashtags, '#active') !== '' || this.reviewInterval != null)
      && !this.isCompleted
      && !this.isCancelled
      && !this.isArchived
    ) ? true : false
    // log(pluginJson, `Project object created OK with Metadata = '${this.generateMetadataLine()}'`)
  }

  /**
   * Is this project ready for review?
   * Return true if review is overdue and not archived or completed
   * @return {boolean}
  */
  get isReadyForReview(): boolean {
    // log(pluginJson, `isReadyForReview: ${this.title}:  ${this.nextReviewDays} ${this.isActive}`)
    return (this.nextReviewDays != null
      && this.nextReviewDays <= 0
      && this.isActive)
  }

  /**
   * From the metadata read in, calculate due/review/finished durations
  */
  calcDurations(): void {
    const now = new Date()
    this.dueDays = (this.dueDate != null)
      // NB: Written while there was an error in EM's Calendar.unitsBetween() function
      ? daysBetween(now, this.dueDate)
      : undefined
    this.finishedDays = (this.completedDate != null && this.startDate != null)
      ? daysBetween(this.startDate, this.completedDate)
      : (this.cancelledDate != null && this.startDate != null)
        ? daysBetween(this.startDate, this.cancelledDate)
        : undefined
    if (this.reviewInterval != null) {
      if (this.reviewedDate != null) {
        this.nextReviewDate = calcNextReviewDate(this.reviewedDate, this.reviewInterval)
        this.nextReviewDays = daysBetween(now, this.nextReviewDate)
      } else {
        // no next review date, so set at today
        this.nextReviewDate = now
        this.nextReviewDays = 0
      }
    }
  }

  /**
  * Close a Project/Area note by updating the metadata and saving it:
  * - adding @completed(<today's date>) to the current note in the Editor
  * - add '#archive' flag to metadata line
  * @author @jgclark
  */
  completeProject(): boolean {
    // const todayStr = hyphenatedDateString(new Date())
    // const yearStr = todayStr.substring(0, 4)
    // const completedTodayString = `${completedMentionString}(${todayStr})`
    // const metadataLine = getOrMakeMetadataLine(note)

    // update the metadata fields
    this.isArchived = true
    this.isCompleted = true
    this.isCancelled = true
    this.completedDate = new Date()
    this.calcDurations()

    // re-write the note's metadata line
    log(pluginJson, `Completing ${this.title} ...`)
    const newMetadataLine = this.generateMetadataLine()
    log(pluginJson, `... metadata now '${newMetadataLine}'`)
    this.metadataPara.content = newMetadataLine

    // send update to Editor
    Editor.updateParagraph(this.metadataPara)
    return true
  }

  /**
  * Cancel a Project/Area note by updating the metadata and saving it:
  * - adding @cancelled(<today's date>)
  * - add '#archive' flag to metadata line
  * @author @jgclark
  */
  cancelProject(): boolean {
    // update the metadata fields
    this.isArchived = true
    this.isCompleted = false
    this.isCancelled = true
    this.cancelledDate = new Date()
    this.calcDurations()

    // re-write the note's metadata line
    log(pluginJson, `Cancelling ${this.title} ...`)
    const newMetadataLine = this.generateMetadataLine()
    log(pluginJson, `... metadata now '${newMetadataLine}'`)
    this.metadataPara.content = newMetadataLine

    // send update to Editor
    Editor.updateParagraph(this.metadataPara)
    return true
  }

  generateMetadataLine(): string {
    // get config settings
    // const config = await getReviewSettings()

    let output = ''
    // output = (this.isActive) ? '#active ' : ''
    // output = (this.isCancelled) ? '#cancelled ' : ''
    output = (this.isArchived) ? '#archive ' : ''
    output += (this.noteType === 'project' || this.noteType === 'area') ? `#${this.noteType} ` : ''
    // $FlowIgnore[incompatible-call]
    output += (this.startDate && this.startDate !== undefined) ? `${checkString(DataStore.preference('startMentionStr'))}(${toISODateString(this.startDate)}) ` : ''
    // $FlowIgnore[incompatible-call]
    output += (this.dueDate && this.startDate !== undefined) ? `${checkString(DataStore.preference('dueMentionStr'))}(${toISODateString(this.dueDate)}) ` : ''
    output += (this.reviewInterval && this.reviewInterval !== undefined) ? `${checkString(DataStore.preference('reviewIntervalMentionStr'))}(${checkString(this.reviewInterval)}) ` : ''
    // $FlowIgnore[incompatible-call]
    output += (this.reviewedDate && this.reviewedDate !== undefined) ? `${checkString(DataStore.preference('reviewedMentionStr'))}(${toISODateString(this.reviewedDate)}) ` : ''
    // $FlowIgnore[incompatible-call]
    output += (this.completedDate && this.completedDate !== undefined) ? `${checkString(DataStore.preference('completedMentionStr'))}(${toISODateString(this.completedDate)}) ` : ''
    // $FlowIgnore[incompatible-call]
    output += (this.cancelledDate && this.cancelledDate !== undefined) ? `${checkString(DataStore.preference('cancelledMentionStr'))}(${toISODateString(this.cancelledDate)}) ` : ''
    return output
  }

  /**
   * Returns CSV line showing days until next review + title
   * @return {string}
  */
  machineSummaryLine(): string {
    const numString = this.nextReviewDays?.toString() ?? ''
    return `${numString}\t${this.title}`
  }

  /**
   * return title of note as folder name + internal link, 
   * also showing complete or cancelled where relevant
   * @param {boolean} includeFolderName whether to include folder name at the start of the entry.
   * @return {string} - title as wikilink
  */
  decoratedProjectTitle(includeFolderName: boolean): string {
    let folderNamePart = (includeFolderName) ? (this.folder+' ') : ''
    if (this.isCompleted) {
      return `[x] ${folderNamePart}[[${this.title ?? ''}]]`
    } else if (this.isCancelled) {
      return `[-] ${folderNamePart}[[${this.title ?? ''}]]`
    } else {
      return `${folderNamePart}[[${this.title ?? ''}]]`
    }
  }

  static detailedSummaryLineHeader(): string {
    return `_Key: \tTitle\t #open / #complete / #waiting / #future tasks / next review date / due date_`
  }

  /**
   * Returns line showing more detailed summary of the project, for output to a note.
   * TODO: when tables are supported, make this write a table row.
   * @param {boolean} includeFolderName at the start of the entry
   * @param {boolean} includePercentage of completed tasks (optional; if missing defaults to true)
   * @return {string}
  */
  detailedSummaryLine(includeFolderName: boolean, includePercentage: boolean = true): string {
    let output = '- '
    output += `${this.decoratedProjectTitle(includeFolderName)}`
    if (this.completedDate != null) {
      // $FlowIgnore[incompatible-call]
      output += `\t(Completed ${relativeDateFromNumber(this.finishedDays)})`
    }
    else if (this.cancelledDate != null) {
      // $FlowIgnore[incompatible-call]
      output += `\t(Cancelled ${relativeDateFromNumber(this.finishedDays)})`
    }
    if (includePercentage) {
      output += `\tc${percent(this.completedTasks, (this.completedTasks + this.openTasks))} / o${this.openTasks} / w${this.waitingTasks} / f${this.futureTasks}`
    } else {
      output += `\tc${this.completedTasks} / o${this.openTasks} / w${this.waitingTasks} / f${this.futureTasks}`
    }
    if (!this.isCompleted && !this.isCancelled) {
      output = (this.nextReviewDays != null)
        ? ( (this.nextReviewDays > 0)
          ? `${output} / ${relativeDateFromNumber(this.nextReviewDays)}`
          : `${output} / **${relativeDateFromNumber(this.nextReviewDays)}**`) 
        : `${output} / -`
      output = (this.dueDays != null)
        ? `${output} / ${relativeDateFromNumber(this.dueDays)}`
        : `${output} / -`
    }
    return output
  }
}
