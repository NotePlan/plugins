// @flow
//-----------------------------------------------------------------------------
// Helper functions for Review plugin
// @jgclark
// Last updated for v0.5.2, 21.1.2022
//-----------------------------------------------------------------------------

import {
  daysBetween,
  getDateFromString,
  relativeDateFromNumber,
  toISODateString,
} from '../../helpers/dateTime'
import {
  calcOffsetDate,
} from '../../helpers/NPdateTime'
import {
  getFolderFromFilename,
} from '../../helpers/folders'
import {
  findNotesMatchingHashtags,
} from '../../helpers/note'
import {
  getContentFromBrackets,
  getStringFromList,
} from '../../helpers/general'
import {
  showMessage,
} from '../../helpers/userInput'


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
  // console.log(`getMentionFromList for: ${mention}`)
  const res = mentionList.filter((m) => m.startsWith(`${mention}(`))
  return res.length > 0 ? res[0] : ''
}

//-----------------------------------------------------------------------------

/**
 * Define 'Project' class to use in GTD.
 * Holds title, last reviewed date, due date, review interval, completion date,
 * number of closed, open & waiting for tasks.
 * @author @jgclark
*/
export class Project {
  // Types for the class properties
  note: TNote
  title: string
  dueDate: ?Date
  dueDays: ?number
  reviewedDate: ?Date
  reviewInterval: ?string
  nextReviewDate: ?Date
  nextReviewDays: ?number
  completedDate: ?Date
  completedDays: ?number
  isCompleted: boolean
  openTasks: number
  completedTasks: number
  waitingTasks: number
  isArchived: boolean
  isActive: boolean
  isCancelled: boolean
  noteType: string // project, area, other
  folder: string
  
  constructor(note: TNote) {
    const mentions: $ReadOnlyArray<string> = note.mentions
    const hashtags: $ReadOnlyArray<string> = note.hashtags
    this.note = note
    this.title = note.title ?? '(error)'
    console.log(`\tnew Project: ${this.title}`)
    this.folder = getFolderFromFilename(note.filename)
    const tempDueDateStr = getParamMentionFromList(mentions, "@due")
    this.dueDate = tempDueDateStr !== '' ? getDateFromString(tempDueDateStr) : undefined
    if (this.dueDate != null) { // && this.dueDate !== undefined) {
      // NB: Written while there was an error in EM's Calendar.unitsBetween() function
      // $FlowIgnore[incompatible-call]
      this.dueDays = daysBetween(new Date(), this.dueDate)
    }
    // this.reviewedDate = getDateFromString(getParamMentionFromList(mentions, "@reviewed")) ?? undefined
    const tempReviewedDateStr = getParamMentionFromList(mentions, "@reviewed")
    this.reviewedDate = tempReviewedDateStr !== '' ? getDateFromString(tempReviewedDateStr) : undefined
    this.reviewInterval = getContentFromBrackets(getParamMentionFromList(mentions, "@review")) ?? undefined
    if (this.reviewInterval != null) {
      if (this.reviewedDate != null) {
        this.nextReviewDate = calcNextReviewDate(this.reviewedDate, this.reviewInterval)
        // NB: Written while there was an error in EM's Calendar.unitsBetween() function
        // $FlowIgnore[incompatible-call]
        this.nextReviewDays = daysBetween(new Date(), this.nextReviewDate)
        // console.log(`  ${this.nextReviewDate.toString()} -> ${this.nextReviewDays}`)
      } else {
        // no next review date, so set at today
        this.nextReviewDate = new Date()
        this.nextReviewDays = 0
      }
    }
    // this.completedDate = getDateFromString(getParamMentionFromList(mentions, "@completed")) ?? undefined
    const tempCompletedDateStr = getParamMentionFromList(mentions, "@completed")
    this.completedDate = tempCompletedDateStr !== '' ? getDateFromString(tempCompletedDateStr) : undefined
    this.completedDays = (this.completedDate != null)
      // $FlowIgnore[incompatible-call]
      ? daysBetween(new Date(), this.completedDate)
      : undefined
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

    // make completed if @completed_date set
    this.isCompleted = (this.completedDate != null) ? true : false
    // make archived if #archive tag present
    this.isArchived = getStringFromList(hashtags, '#archive') !== ''
    // make cancelled if #cancelled or #someday flag set
    this.isCancelled = getStringFromList(hashtags, '#cancelled') !== ''
                    || getStringFromList(hashtags, '#someday') !== ''

    // set note to active if #active is set or a @review date found,
    // and not completed / cancelled.
    this.isActive = (
      (getStringFromList(hashtags, '#active') !== '' || this.reviewInterval != null)
      && !this.isCompleted
      && !this.isCancelled
      && !this.isArchived
    ) ? true : false
    // console.log(`\t  created OK`)
  }

  /*
   * return title of note as internal link, also showing complete or cancelled where relevant
   * @return {string} - title as wikilink
  */
  get decoratedProjectTitle(): string {
    if (this.isCompleted) {
      return `[x] [[${this.title ?? ''}]]`
    } else if (this.isArchived) {
      return `[-] [[${this.title ?? ''}]]`
    } else if (this.isCancelled) {
      return `[-] (cancelled) [[${this.title ?? ''}]]`
    } else {
      return `[[${this.title ?? ''}]]`
    }
  }

  /*
   * Is this project ready for review?
   * Return true if review is overdue and not archived or completed
   * @return {boolean}
  */
  get isReadyForReview(): boolean {
    // console.log(`isReadyForReview: ${this.title}:  ${this.nextReviewDays} ${this.isActive}`)
    return (this.nextReviewDays != null
      && this.nextReviewDays <= 0
      && this.isActive)
  }

  /*
   * Returns CSV line showing days until next review + title
   * @return {string}
  */
  machineSummaryLine(): string {
    const numString = this.nextReviewDays?.toString() ?? ''
    return `${numString}\t${this.title}`
    // return `${numString}\t${this.title}\t${this.isActive.toString()}\t${this.completedDays?.toString() ?? ''}`
  }

  /* 
   * Returns line showing more detailed summary of the project, for output to a note.
   * TODO: when tables are supported, make this write a table row.
   * @return {string}
  */
  detailedSummaryLine(): string {
    let output = `- ${this.decoratedProjectTitle}`
    if (this.completedDate != null) {
      // $FlowIgnore[incompatible-call]
      output += `\t(Completed ${relativeDateFromNumber(this.completedDays)})`
    } else {
      output += `\to${this.openTasks} / c${this.completedTasks} / w${this.waitingTasks}`
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
