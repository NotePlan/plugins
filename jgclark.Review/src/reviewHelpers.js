// @flow
//-----------------------------------------------------------------------------
// @jgclark
// Helper functions for Review plugin
// v0.2.3, 1.8.2021
//-----------------------------------------------------------------------------

import {
  // chooseOption,
  showMessage,
  RE_DATE,
  toISODateString,
  calcOffsetDate,
  relativeDateFromNumber,
  getFolderFromFilename,
} from '../../helperFunctions.js'

/*
 * Get or create the relevant note in the Summary folder
 * @param {string} noteTitle - title of summary note
 * @param {string} noteFolder - folder to look in
 * @return {Promise<TNote>} - note object
 */
export async function returnSummaryNote(
  noteTitle: string,
  noteFolder: string
): Promise<?TNote> {
  // first see if this note has already been created (ignore Archive and Trash)
  const existingNotes: $ReadOnlyArray<TNote> =
    DataStore.projectNoteByTitle(noteTitle, true, false) ?? []
  console.log(
    `\tfound ${existingNotes.length} existing summary note(s)`,
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
        showMessage(`Oops: I can't make new _reviews note`, 'OK')
        console.log(`returnSummaryNote: error: can't read new _reviews note`)
        return
      }
    } else {
      showMessage(`Oops: I can't make new _reviews note`, 'OK')
      console.log(`returnSummaryNote: error: empty filename of new _reviews note`)
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
 * @return {number} line - the calculated line
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
  // $FlowIgnore
  return lineNumber
}

/*
 * Return list of notes with a particular hashtag, optionally in the given folder.
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
  console.log(`\tFound ${projectNotesWithTag.length} notes matching tag '${tag}'`)
  return projectNotesWithTag
}

export function calcNextReviewDate(lastReviewDate: Date, interval: string): Date {
  // RUBY:
  // @next_review_date = !@last_review_date.nil? ? calc_offset_date(@last_review_date, @review_interval) : TODAYS_DATE

  const reviewDate: Date =
    lastReviewDate != null
      ? calcOffsetDate(toISODateString(lastReviewDate), interval)
      : new Date() // today's date
  return reviewDate
}

export function isoDateStringFromCalendarFilename(filename: string): string {
  return `${filename.slice(0, 4)}-${filename.slice(4, 6)}-${filename.slice(6, 8)}`
}

/* From an array of strings, return the first string that matches the
*  wanted parameterised @mention, or empty String
* @param {Array<string>} mentionList - list of strings to search
* @param {string} metnion - string to match (with a following '(' to indicate start of parameter)
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

/* From an array of strings, return the first string that matches the wanted string
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

/* Turn a string that includes YYYY-MM-DD into a JS Date
* @param {string} - string that contains a date e.g. @due(2021-03-04)
* @return {?Date} - JS Date version, if valid date found
*/
export function getDateFromString(mention: string): ?Date {
  const RE_DATE_CAPTURE = `(${RE_DATE})` // capture date of form YYYY-MM-DD

  if (mention === '') {
    // console.log(`\tgetDateFromString: empty string`)
    return // no text, so return nothing
  }
  // console.log(`\tgetDateFromString: ${mention}`)
  const res = mention.match(RE_DATE_CAPTURE) ?? []
  // Use first match, if found
  if (res[1].length > 0) {
    const date = new Date(
      Number(res[1].slice(0, 4)),
      Number(res[1].slice(5, 7)) - 1, // only seems to be needed for months?!
      Number(res[1].slice(8, 10)),
    )
    // console.log(toLocaleDateTimeString(date))
    return date
  } else {
    // console.log(`\tgetDateFromString: no date found`)
    return
  }
}

/* Extract bracketed part of an '@mention(something)' string
* @param {string} - string that contains a bracketed mention e.g. @review(2w)
* @return {?string} - string from between the brackets, if found (e.g. '2w')
*/
export function getStringFromMention(mention: string): ?string {
  const RE_MENTION_STRING_CAPTURE = '\\((.*?)\\)' // capture string inside parantheses

  if (mention === '') {
    // console.log(`\tgetStringFromMention: empty string`)
    return // no text, so return nothing
  }
  // console.log(`\tgetStringFromMention: ${mention}`)
  const res = mention.match(RE_MENTION_STRING_CAPTURE) ?? []
  if (res[1].length > 0) {
    return res[1]
  } else {
    return
  }
}

/* Return difference between start and end dates
* @param {Date} d1 - start Date
* @param {Date} d2 - end Date
* @return {number} - number of days between d1 and d2 (rounded to nearest integer)
*/
export function daysBetween(d1: Date, d2: Date): number {
  return Math.round((d2 - d1) / 1000 / 60 / 60 / 24) // i.e. milliseconds -> days
}

//-------------------------------------------------------------------------------
// Define 'Project' class to use in GTD.
// Holds title, last reviewed date, due date, review interval, completion date,
// number of closed, open & waiting for tasks
// NOTE: @nmn says class syntax is likely not supported in Safari 11.
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
  isArchived: boolean // TODO: Does this make any sense to keep?
  isActive: boolean
  noteType: string // project, area, other
  folder: string

  constructor(note: TNote) {
    const mentions: $ReadOnlyArray<string> = note.mentions
    const hashtags: $ReadOnlyArray<string> = note.hashtags
    this.note = note
    this.title = note.title ?? '(error)'
    this.folder = getFolderFromFilename(note.filename)
    this.dueDate = getDateFromString(getParamMentionFromList(mentions, "@due"))
    // this.dueDate = getDateFromString(getParamMentionFromList(mentions, "@due"))
    // FIXME(Eduard): Error in next API function so use my own instead
    // this.dueDays = (this.dueDate !== '') ? Calendar.unitsBetween(new Date(), this.dueDate, 'day') : undefined
    if (this.dueDate != null && this.dueDate !== '') {
      // $FlowIgnore[incompatible-call]
      this.dueDays = daysBetween(new Date(), this.dueDate)
    }
    this.reviewedDate = getDateFromString(getParamMentionFromList(mentions, "@reviewed"))
    this.reviewInterval = getStringFromMention(getParamMentionFromList(mentions, "@review"))
    if (this.reviewInterval != null) {
      if (this.reviewedDate != null) {
        this.nextReviewDate = calcNextReviewDate(this.reviewedDate, this.reviewInterval)
        // FIXME(Eduard): Error in next API function so use my own instead
        // this.nextReviewDays = (this.nextReviewDate !== '') ? Calendar.unitsBetween(new Date(), this.dueDate, 'day') : undefined
        // $FlowIgnore[incompatible-call]
        this.nextReviewDays = daysBetween(new Date(), this.nextReviewDate)
        // console.log(`  ${this.nextReviewDate.toString()} -> ${this.nextReviewDays}`)
      } else {
        // no next review date, so set at today
        this.nextReviewDate = new Date()
        this.nextReviewDays = 0
      }
    }
    this.completedDate = getDateFromString(getParamMentionFromList(mentions, "@completed"))
    this.completedDays = (this.completedDate !== '')
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
    // @is_cancelled = true if @metadata_line =~ /(#cancelled|#someday)/

    // set note to active if #active is set or a @review date found,
    // and not completed / cancelled.
    this.isActive = (
      (getStringFromList(hashtags, '#active') !== '' || this.reviewInterval != null)
      && !this.isCompleted
      && !this.isArchived
    ) ? true : false
  }

  /* return title of note as internal link, also showing complete or cancelled where relevant
  * @return {string} - title as wikilink
  */
  get decoratedProjectTitle(): string {
    if (this.isCompleted) {
      return `[x] [[${this.title ?? ''}]]`
    } else if (this.isArchived) {
      return `[-] [[${this.title ?? ''}]]`
    } else {
      return `[[${this.title ?? ''}]]`
    }
  }

  /* return true if review is overdue and not archived or completed
  * @return {boolean} - is this ready for review?
  */
  get isReadyForReview(): boolean {
    // console.log(`isReadyForReview: ${this.title}:  ${this.nextReviewDays} ${this.isActive}`)
    return (this.nextReviewDays != null
      && this.nextReviewDays <= 0
      && this.isActive)
  }

  /* Returns CSV line showing days until next review + title
   * @return {string}
  */
  basicSummaryLine(): string {
    const numString = this.nextReviewDays?.toString() ?? ''
    return `${numString}\t${this.title}`
    // return `${numString}\t${this.title}\t${this.isActive.toString()}\t${this.completedDays?.toString() ?? ''}`
  }

  /* Returns line showing more detailed summary of the note, treated as a project
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
        ? `${output} / ${relativeDateFromNumber(this.nextReviewDays)}`
        : `${output} / -`
      output = (this.dueDays != null)
        ? `${output} / ${relativeDateFromNumber(this.dueDays)}`
        : `${output} / -`
    }
    return output
  }
}
