// @flow
//-----------------------------------------------------------------------------
// Helper functions for Review plugin
// @jgclark
// Last updated for v0.5.0, 28.12.2021
//-----------------------------------------------------------------------------

import {
  calcOffsetDate,
  daysBetween,
  getDateFromString,
  relativeDateFromNumber,
  toISODateString,
} from '../../helpers/dateTime'
import {
  getFolderFromFilename,
} from '../../helpers/folders'
import {
  showMessage,
} from '../../helpers/userInput'

//-----------------------------------------------------------------------------
/**
 * Get or create the relevant note in the Summary folder
 * @author @jgclark
 * @param {string} noteTitle - title of summary note
 * @param {string} noteFolder - folder to look in
 * @return {Promise<TNote>} - note object
 */
export async function getOrMakeNote(
  noteTitle: string,
  noteFolder: string
): Promise<?TNote> {
  // first see if this note has already been created (ignore Archive and Trash)
  const existingNotes: $ReadOnlyArray<TNote> =
    DataStore.projectNoteByTitle(noteTitle, true, false) ?? []
  console.log(
    `\tfound ${existingNotes.length} existing '${noteTitle}' note(s)`,
  )

  if (existingNotes.length > 0) {
    // console.log(`\t${existingNotes[0].filename}`)
    return existingNotes[0] // return the only or first match (if more than one)
  } else {
    // make a new note for this
    const noteFilename = await DataStore.newNote(noteTitle, noteFolder)
    // NB: filename here = folder + filename
    if (noteFilename != null && noteFilename !== '') {
      console.log(`\tnewNote filename: ${String(noteFilename)}`)
      const note = await DataStore.projectNoteByFilename(noteFilename)
      if (note != null) {
        return note
      } else {
        showMessage(`Oops: I can't make new ${noteTitle} note`, 'OK')
        console.log(`returnSummaryNote: error: can't read new ${noteTitle} note`)
        return
      }
    } else {
      showMessage(`Oops: I can't make new ${noteTitle} note`, 'OK')
      console.log(`returnSummaryNote: error: empty filename of new ${noteTitle} note`)
      return
    }
  }
}

/**
 * Works out which line (if any) of the current note is a metadata line, defined as
 * - line starting 'project:' or 'medadata:'
 * - first line containing a @review() mention
 * - first line starting with a hashtag
 * If these can't be found, then create a new line for this after the title
 * Only to be called when Editor known to have an open note.
 * @author @jgclark
 * @return {number} the line number for the metadata line
 */
export function getOrMakeMetadataLine(): number {
  let lineNumber
  // $FlowIgnore[incompatible-use] as we know Editor.content != null
  const lines = Editor.content.split('\n') ?? ['']
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].match(/^project:/i)
      || lines[i].match(/^metadata:/i)
      || lines[i].match(/^#[\w]/)
      || lines[i].match(/@review\(.+\)/))
    {
      lineNumber = i
      break
    }
  }
  if (lineNumber === undefined) {
    // If no metadataPara found, then insert one straight after the title
    console.log(
    `\tCan't find an existing metadata line, so will insert a new second line for it`,
    )
    Editor.insertParagraph('', 1, 'empty')
    lineNumber = 1
  }
  // console.log(`Metadata line = ${lineNumber}`)
  return lineNumber
}

/**
 * Return list of notes with a particular hashtag, optionally in the given folder.
 * @author @jgclark
 * @param {string} tag - tag name to look for (or blank, in which case no filtering by tag)
 * @param {?string} folder - optional folder to limit to
 * @param {?boolean} includeSubfolders - if folder given, whether to look in subfolders of this folder or not (optional, defaults to false)
 * @return {Array<TNote>}
 */
export function findNotesMatchingHashtags(
  tag: string,
  folder: ?string,
  includeSubfolders: ?boolean = false
): Array<TNote> {
  let projectNotesInFolder: Array<TNote>
  // If folder given (not empty) then filter using it
  if (folder != null) {
    if (includeSubfolders) {
      // use startsWith as filter to include subfolders
      // FIXME: not working for root-level notes
      projectNotesInFolder = DataStore.projectNotes
        .slice()
        .filter((n) => n.filename.startsWith(`${folder}/`))
    } else {
      // use match as filter to exclude subfolders
      projectNotesInFolder = DataStore.projectNotes
        .slice()
        .filter((n) => (getFolderFromFilename(n.filename) === folder))
    }
  } else {
    // no folder specified, so grab all notes from DataStore
    projectNotesInFolder = DataStore.projectNotes.slice()
  }
  // Filter by tag (if one has been given)
  const projectNotesWithTag = (tag !== '')
    ? projectNotesInFolder.filter((n) => n.hashtags.includes(tag))
    : projectNotesInFolder
  console.log(`\tIn folder '${folder ?? "<all>"}' found ${projectNotesWithTag.length} notes matching '${tag}'`)
  return projectNotesWithTag
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
  // console.log(`getMentionFromList for: ${mention}`)
  const res = mentionList.filter((m) => m.startsWith(`${mention}(`))
  return res.length > 0 ? res[0] : ''
}

/**
 * From an array of strings, return the first string that matches the wanted string.
 * @author @jgclark
 * @param {Array<string>} list - list of strings to search
 * @param {string} search - string to match
 */
export function getStringFromList(
  list: $ReadOnlyArray<string>,
  search: string,
): string {
  // console.log(`getsearchFromList for: ${search}`)
  const res = list.filter((m) => m === search)
  return res.length > 0 ? res[0] : ''
}

/**
 * Extract bracketed part of an '@mention(something)' string.
 * @author @jgclark
 * @param {string} - string that contains a bracketed mention e.g. @review(2w)
 * @return {?string} - string from between the brackets, if found (e.g. '2w')
 */
export function getStringFromMention(mention: string): ?string {
  const RE_MENTION_STRING_CAPTURE = '\\((.*?)\\)' // capture string inside parantheses

  if (mention === '') {
    return // no text, so return nothing
  }
  const res = mention.match(RE_MENTION_STRING_CAPTURE) ?? []
  if (res[1].length > 0) {
    return res[1]
  } else {
    return
  }
}

//-------------------------------------------------------------------------------

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
    this.reviewInterval = getStringFromMention(getParamMentionFromList(mentions, "@review")) ?? undefined
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
