// @flow

//-----------------------------------------------------------------------------
// This defines a 'Project' class to use in GTD-style reviews.
// Holds title, last reviewed date, due date, review interval, completion date,
// number of closed, open & waiting for tasks etc.
// And defines the commands that create project list summaries, select next
// project to review, and update last-update-date (@reviewed(YYYYMMDD)).
// by @jgclark
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// User settings: TODO: move to proper preferences system
const pref_folderToStore = 'Summaries'
const pref_displayGroupedByFolder = true
const pref_displayOrder = 'alpha' // 'due', 'review' or 'alpha'
const pref_noteTypeTags = '#area' // or #area, #archive etc.

//-----------------------------------------------------------------------------
// Helper functions
import {
  // chooseOption,
  showMessage,
  nowLocaleDateTime,
  RE_DATE,
  toISODateString,
  calcOffsetDate,
  relativeDateFromNumber,
} from '../../helperFunctions.js'

// Return list of notes with a particular hashtag, optionally
// in the given folder.
// @param {string} - tag name to look for
// @param {?string} - optional folder to limit to
// @return {Array<TNote>}
function findNotesMatchingHashtags(
  tag: string,
  folder: ?string,
): Array<TNote> {
  let projectNotesInFolder: Array<TNote>
  // If folder given (not empty) then filter using it
  if (folder != null) {
    projectNotesInFolder = DataStore.projectNotes
      .slice()
      .filter((n) => n.filename.startsWith(`${folder}/`))
  } else {
    projectNotesInFolder = DataStore.projectNotes.slice()
  }
  // Filter by tag
  const projectNotesWithTag = projectNotesInFolder.
    filter((n) => n.hashtags.includes(tag)
  )
  return projectNotesWithTag
}

const RE_DATE_CAPTURE = `(${RE_DATE})` // capture date of form YYYY-MM-DD
const RE_MENTION_STRING_CAPTURE = '\\((.*?)\\)' // capture string inside parantheses

function calcNextReviewDate(lastReviewDate: Date, interval: string): Date {
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
function getParamMentionFromList(
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
function getStringFromList(
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
function getDateFromString(mention: string): ?Date {
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
function getStringFromMention(mention: string): ?string {
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
function daysBetween(d1: Date, d2: Date): number {
  return Math.round((d2 - d1) / 1000 / 60 / 60 / 24) // i.e. milliseconds -> days
}

//-------------------------------------------------------------------------------
// Define 'Project' class to use in GTD.
// Holds title, last reviewed date, due date, review interval, completion date,
// number of closed, open & waiting for tasks
// NOTE: @nmn says class syntax is likely not supported in Safari 11.
class Project {
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
  noteType: string // project, area, other

  constructor(note: TNote) {
    const mentions: $ReadOnlyArray<string> = note.mentions
    const hashtags: $ReadOnlyArray<string> = note.hashtags
    this.note = note
    this.title = note.title ?? '(error)'
    this.dueDate = getDateFromString(getParamMentionFromList(mentions, "@due"))
    // FIXME: Error in next API function so use my own instead
    // this.dueDays = (this.dueDate !== '') ? Calendar.unitsBetween(new Date(), this.dueDate, 'day') : undefined
    this.dueDays = (this.dueDate !== '')
      // $FlowIgnore
      ? daysBetween(new Date(), this.dueDate)
      : undefined
    this.reviewedDate = getDateFromString( getParamMentionFromList(mentions, "@reviewed") )
    this.reviewInterval = getStringFromMention( getParamMentionFromList(mentions, "@review") )
    this.nextReviewDate = (this.reviewedDate != null && this.reviewInterval != null)
      ? calcNextReviewDate(this.reviewedDate, this.reviewInterval)
      : null
    // FIXME: Error in next API function so use my own instead
    // this.nextReviewDays = (this.nextReviewDate !== '') ? Calendar.unitsBetween(new Date(), this.dueDate, 'day') : undefined
    this.nextReviewDays = (this.nextReviewDate !== '')
      // $FlowIgnore
      ? daysBetween(new Date(), this.nextReviewDate, 'day')
      : undefined
    this.completedDate = getDateFromString(getParamMentionFromList(mentions, "@completed"))
    this.completedDays = (this.completedDate !== '')
      // $FlowIgnore
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
    ) ? true : false
  }

  /* return title of note as internal link, also showing complete or cancelled where relevant
  * @return {string} - title as wikilink
  */
  get decoratedProjectTitle(): string {
    if (this.isCompleted) {
      return `[x] [[${this.title ?? ''}]]`
    } else if (this.isActive) {
      return `[[${this.title ?? ''}]]`
    } else {
      return `[-] [[${this.title ?? ''}]]`
    }
  }

  /* Returns line showing note title as a note link
   * @return {string}
  */
  basicSummaryLine(): string {
    const titleAsLink =
      this.title !== undefined ? `[[${this.title ?? ''}]]` : '(error)'
    return `- ${titleAsLink}`
  }

  /* Returns line showing more detailed summary of the note, treated as a project
   * @return {string}
  */
  detailedSummaryLine(): string {
    // const titleAsLink =
    //   this.title !== undefined ? `[[${this.title ?? ''}]]` : '(error)'
    let output = `- ${this.decoratedProjectTitle}`
    if (this.completedDate != null) {
      output += `\t(Completed ${relativeDateFromNumber(this.completedDays)})`
    } else {
      output += `\to${this.openTasks} / c${this.completedTasks} / w${this.waitingTasks}`
      output += `/ ${ relativeDateFromNumber(this.nextReviewDays) } / ${ relativeDateFromNumber(this.dueDays) }`
    }
    return output
  }
}

// Get or create the relevant Project Summmary note
export async function returnSummaryNote(tagName: string): Promise<?TNote> {
  const noteTitle = `'${tagName}' notes summary`
  let note: ?TNote
  // first see if this note has already been created (ignore Archive and Trash)
  const existingNotes: $ReadOnlyArray<TNote> =
    DataStore.projectNoteByTitle(noteTitle, true, false) ?? []
  console.log(
    `\tfound ${existingNotes.length} existing summary notes for this period`,
  )

  if (existingNotes.length > 0) {
    note = existingNotes[0] // pick the first if more than one
    console.log(`\tfilename of first matching note: ${note.filename}`)
  } else {
    // make a new note for this
    let noteFilename = await DataStore.newNote(noteTitle, pref_folderToStore)
    console.log(`\tnewNote filename: ${String(noteFilename)}`)
    noteFilename = `${pref_folderToStore}/${String(noteFilename)}` ?? '(error)'
    // NB: filename here = folder + filename
    note = await DataStore.projectNoteByFilename(noteFilename)
  }
  return note
}

//-------------------------------------------------------------------------------
// Main function to create a summary note for each tag of interest
export async function noteTypeSummaries() {
  console.log(`\nnoteTypeSummaries`)
  const tags = pref_noteTypeTags.split(',')

  for (const tag of tags) {
    // Do the main work
    const tagName = tag.slice(1) // remove leading # character
    const note: ?TNote = await returnSummaryNote(tagName)
    if (note != null) {
      // Calculate the Summary list(s)
      const outputArray = makeNoteTypeSummary(tag)
      const noteTitle = `'${tagName}' notes summary`
      outputArray.unshift(noteTitle)

      // Save the list(s) to this note
      console.log(`\twriting results to the note with filename '${note.filename}'`)
      note.content = outputArray.join('\n')
      console.log(`\twritten results to note '${noteTitle}'`)
    } else {
      showMessage('Oops: failed to find or make project summary note', 'OK')
      console.log(
        "makeNoteTypeSummary: error: shouldn't get here -- no valid note to write to",
      )
      return
    }
  }
}

//-------------------------------------------------------------------------------
// Return summary of notes that contain a particular tag, for all
// relevant folders
export function makeNoteTypeSummary(noteTag: string): Array<string> {
  console.log(`\nmakeNoteTypeSummary for ${noteTag}`)

  let noteCount = 0
  let overdue = 0
  const outputArray: Array<string> = []

  // if we want a summary broken down by folder, create list of folders
  // otherwise use a single folder
  const folderList = pref_displayGroupedByFolder ? DataStore.folders : ['/']
  console.log(`${folderList.length} folders`)
  // Iterate over the folders
  for (const folder of folderList) {
    // const notes = findMatchingTagsNotesSortedByName(noteTag, folder) // OLD WAY
    const notes = findNotesMatchingHashtags(noteTag, folder)
    // console.log(notes.length)
    if (notes.length > 0) {
      // Create array of Project class representation of each note,
      // ignoring any marked as .isArchived
      const projects = []
      for (const note of notes) {
        const np = new Project(note)
        if (!np.isArchived) {
          projects.push(np)
        }
        if (np.nextReviewDays != null && np.nextReviewDays < 0) {
          overdue += 1
        }
      }
      // sort this array by key set in pref_displayOrder
      let sortedProjects = []
      // NB: the Compare function needs to return negative, zero, or positive values. 
      switch (pref_displayOrder) {
        case 'due': {
          sortedProjects = projects.sort(
            (first, second) => (first.dueDays ?? 0) - (second.dueDays ?? 0))
          break
        }
        case 'review': {
          sortedProjects = projects.sort(
            (first, second) => (first.nextReviewDays ?? 0) - (second.nextReviewDays ?? 0))
          break
        }
        default: {
          sortedProjects = projects.sort(
            (first, second) => (first.title ?? '').localeCompare(second.title ?? ''))
          break
        }
      }
      if (pref_displayGroupedByFolder) {
        outputArray.push(`### ${folder} (${sortedProjects.length} notes)`)
      }
      // iterate over this folder's notes, using Class functions
      for (const p of sortedProjects) {
        outputArray.push(p.detailedSummaryLine())
      }
      // // iterate over this folder's notes, using Class functions
      // for (const note of notes) {
      //   // outputArray.push(noteStatus(note)) // older way
      //   const pn = new Project(note)
      //   outputArray.push(pn.detailedSummaryLine())
      // }
      noteCount += sortedProjects.length
    }
  }

  // Add summary/ies onto the start (remember: unshift adds to the very front each time)
  outputArray.unshift(`_Key:\tTitle\t# open / complete / waiting tasks / next review date / due date_`)
  outputArray.unshift(`Total: **${noteCount} active notes**.${(overdue > 0) ? ` (${overdue} are overdue review)` : ''}`)
  outputArray.unshift(`Last updated: ${nowLocaleDateTime}`)
  if (!pref_displayGroupedByFolder) {
    outputArray.unshift(`### All folders (${noteCount} notes)`)
  }
  
  return outputArray
}
