// @flow

//-----------------------------------------------------------------------------
// User settings: TODO: move to proper preferences system, when available in NP
const pref_noteTypeTags = '#project' //,#area,#archive'
const pref_groupedByFolder = true
const pref_folderToStore = 'Summaries'

//-----------------------------------------------------------------------------
// Helper functions
import {
  // chooseOption,
  // monthsAbbrev,
  // todaysDateISOString,
  // unhyphenateDateString,
  // hyphenatedDateString,
  // filenameDateString,
  nowShortDateTime,
  RE_DATE,
  toISODateString,
  toISOShortDateTimeString,
  calcOffsetDate,
  relativeDateFromNumber,
} from '../../helperFunctions.js'

// Return list of notes in a folder with a particular hashtag
function findMatchingTagsNotesSortedByName(
  tag: string,
  folder: string,
): Array<TNote> {
  let projectNotesInFolder: Array<TNote>
  // If folder given (not empty) then filter using it
  if (folder !== '') {
    projectNotesInFolder = DataStore.projectNotes
      .slice()
      .filter((n) => n.filename.startsWith(`${folder}/`))
  } else {
    projectNotesInFolder = DataStore.projectNotes.slice()
  }
  // Filter by tag
  const projectNotesWithTag = projectNotesInFolder.filter((n) =>
    n.hashtags.includes(tag),
  )
  // Sort alphabetically on note's title
  const projectNotesSortedByName = projectNotesWithTag.sort((first, second) =>
    (first.title ?? '').localeCompare(second.title ?? ''),
  )
  return projectNotesSortedByName
}

// Return line summarising a project note's status:
// - title
// TODO:
// - # open tasks
// - time until due
// - time until next review
function noteStatus(note: TNote): string {
  const titleAsLink = note.title !== undefined ? `[[${note.title}]]` : '(error)'
  return `- ${titleAsLink}` // due ... last reviewed ...
}

function calcNextReviewDate(lastReviewDate: Date, interval: string): Date {
  // RUBY:
  // @next_review_date = !@last_review_date.nil? ? calc_offset_date(@last_review_date, @review_interval) : TODAYS_DATE

  let reviewDate: Date =
    lastReviewDate != null
      ? calcOffsetDate(toISODateString(lastReviewDate), interval)
      : new Date() // today's date
  return reviewDate
}

const RE_MENTION_DATE_CAPTURE = `\\((${RE_DATE})\\)` // capture date of form YYYY-MM-DD from enclosing parenthesis
const RE_MENTION_STRING_CAPTURE = '\\((.*?)\\)' // capture string inside parantheses

// From an array of mentions, return the first string that matches the
<<<<<<< Updated upstream
// starting string
function getMentionFromList(
  mentionList: $ReadOnlyArray<string>,
  mention: string,
): string {
  console.log(`getMentionFromList for: ${mention}`)
=======
// starting string, or empty string
function getMentionFromList(mentionList: $ReadOnlyArray<string>, mention: string): string {
  console.log(`\tgetMentionFromList for: ${mention}`)
>>>>>>> Stashed changes
  const res = mentionList.filter((m) => m.startsWith(`${mention}(`))
  return res.length > 0 ? res[0] : ''
}

// Turn e.g. @due(2021-03-04) into a JS Date
function getDateFromMention(mention: string): ?Date {
  if (mention === '') {
    return // no text, so return nothing
  }
  console.log(`\tgetDateFromMention: ${mention}`)
  // TODO: TEST
  const res = mention.match(RE_MENTION_DATE_CAPTURE) ?? []
  if (res[1].length > 0) {
    // NB: Strings are correct, but FIXME: date construction isn't
    const date = new Date(
      Number(res[1].slice(0, 4)),
      Number(res[1].slice(5, 7)),
      Number(res[1].slice(8, 10)),
    )
    console.log(toISOShortDateTimeString(date))
    return date
  } else {
    return
  }
}

// Turn e.g. @due(2021-03-04) into a JS Date
function getStringFromMention(mention: string): ?string {
  if (mention === '') {
    return // no text, so return nothing
  }
  console.log(`\tgetStringFromMention: ${mention}`)
  const res = mention.match(RE_MENTION_STRING_CAPTURE) ?? []
  if (res[1].length > 0) {
    return res[1]
  } else {
    return
  }
}

//-------------------------------------------------------------------------------
// Define 'Project' class to use in GTD.
// Holds title, last reviewed date, due date, review interval, completion date,
// number of closed, open & waiting for tasks
// NOTE: class syntax is likely not supported in Safari 11.
class Project {
  // Types for the class properties
  note: TNote
  title: string
  dueDate: ?Date
  reviewedDate: ?Date
  reviewInterval: ?string
  nextReviewDate: ?Date
  completedDate: ?Date
  openTasks: number
  completedTasks: number
  waitingTasks: number
  active: boolean

  constructor(note: TNote) {
    this.note = note
    this.title = note.title ?? '(error)'

    // RUBY CODE:
    // # Now process line 2 (rest of metadata)
    // # the following regex matches returns an array with one item, so make a string (by join), and then parse as a date
    // @metadata_line.scan(/@start\(#{RE_DATES_FLEX_MATCH}\)/) { |m|  @start_date = Date.parse(m.join) }
    // @metadata_line.scan(/(@end|@due)\(#{RE_DATES_FLEX_MATCH}\)/) { |m| @due_date = Date.parse(m.join) } # allow alternate form '@end(...)'
    // @metadata_line.scan(/(@completed|@finished)\(#{RE_DATES_FLEX_MATCH}\)/) { |m| @completed_date = Date.parse(m.join) }
    // @metadata_line.scan(/@reviewed\(#{RE_DATES_FLEX_MATCH}\)/) { |m| @last_review_date = Date.parse(m.join) }
    // @metadata_line.scan(/#{RE_REVIEW_WITH_INTERVALS_MATCH}/) { |m| @review_interval = m.join.downcase }
<<<<<<< Updated upstream
=======
    
    const mentions: $ReadOnlyArray<string> = note.mentions
    this.dueDate = getDateFromMention( getMentionFromList(mentions, "@due") )
    this.reviewedDate = getDateFromMention( getMentionFromList(mentions, "@reviewed") )
    this.reviewInterval = getStringFromMention( getMentionFromList(mentions, "@review") )
    this.nextReviewDate = (this.reviewedDate != null && this.reviewInterval != null)
      ? calcNextReviewDate(this.reviewedDate, this.reviewInterval)
      : null
    this.completedDate = getDateFromMention( getMentionFromList(mentions, "@completed") )
    this.openTasks = note.paragraphs.filter((p) => p.type === 'open').length
    this.completedTasks = note.paragraphs.filter((p) => p.type === 'done').length
    this.waitingTasks = 0 // TODO:
>>>>>>> Stashed changes

    // # make completed if @completed_date set
    // @is_completed = true unless @completed_date.nil?
    // # make cancelled if #cancelled or #someday flag set
    // @is_cancelled = true if @metadata_line =~ /(#cancelled|#someday)/

    // # OLDER LOGIC:
    // # set note to non-active if #archive is set, or cancelled, completed.
    // # @is_active = false if @metadata_line == /#archive/ || @is_completed || @is_cancelled
    // # NEWER LOGIC:
    // # set note to active if #active is set or a @review date found, and not complete/cancelled
    // @is_active = true if (@metadata_line =~ /#active/ || !@review_interval.nil?) && !@is_cancelled && !@is_completed
<<<<<<< Updated upstream

    const mentions: $ReadOnlyArray<string> = note.mentions
    this.dueDate = getDateFromMention(getMentionFromList(mentions, '@due'))
    this.reviewedDate = getDateFromMention(
      getMentionFromList(mentions, '@reviewed'),
    )
    this.reviewInterval = getStringFromMention(
      getMentionFromList(mentions, '@review'),
    )
    this.nextReviewDate =
      this.reviewedDate != null && this.reviewInterval != null
        ? calcNextReviewDate(this.reviewedDate, this.reviewInterval)
        : null
    this.completedDate = getDateFromMention(
      getMentionFromList(mentions, '@completed'),
    )
    this.openTasks = 0 // TODO:
    this.completedTasks = 0 // TODO:
    this.waitingTasks = 0 // TODO:
  }

  timeUntilDue(): string {
    // ensure this.dueDate is not null before passing to function
    const diffDays = Calendar.unitsBetween(new Date(), this.dueDate, 'day')
    return `${diffDays}d`
  }

  timeUntilReview(): string {
    // ensure this.nextReviewDate is not null before passing to function
    const diffDays = Calendar.unitsBetween(
      new Date(),
      this.nextReviewDate,
      'day',
    )
    return `${diffDays}d`
=======
    this.active = true // TODO:
    console.log(`Finished constructor for ${this.title}`)
  }

  timeUntilDue(): string {
    // Class properties must always be used with `this.`
    if (this.dueDate != null) {
      // $FlowIgnore[incompatible-call]
      const diffDays = Calendar.unitsBetween(new Date(), this.dueDate, 'day')
      const diffStr = relativeDateFromNumber(diffDays)
      return diffStr
    } else {
      return '-'
    }
  }

  timeUntilReview(): string {
    if (this.nextReviewDate != null) {
      console.log(`tUR: ${this.nextReviewDate.toString()}`)
      // $FlowIgnore[incompatible-call]
      const diffDays = Calendar.unitsBetween(new Date(), this.nextReviewDate, 'day') // FIXME:
      const diffStr = relativeDateFromNumber(diffDays)
      console.log(diffStr)
      return diffStr
    } else {
      return '-'
    }
>>>>>>> Stashed changes
  }

  basicSummaryLine(): string {
    const titleAsLink =
      this.title !== undefined ? `[[${this.title ?? ''}]]` : '(error)'
    return `- ${titleAsLink}`
  }

  detailedSummaryLine(): string {
    const titleAsLink =
      this.title !== undefined ? `[[${this.title ?? ''}]]` : '(error)'
    let output = `- ${titleAsLink}\t${this.timeUntilDue()}\t${this.timeUntilReview()}`
    console.log(output)
    output += `\t${this.openTasks}/${this.completedTasks}/${this.waitingTasks}`
    console.log(output)
    if (this.completedDate != null) {
      output += `\t[Completed ${toISODateString(this.completedDate)}]`
    }
    console.log(output)
    return output
  }
}

//-------------------------------------------------------------------------------
// Main function to create a summary note for each tag of interest
export async function noteTypeSummaries() {
  console.log(`\ntesting class Project`)
  const note = Editor.note
  if (!note) {
    return
  }
  const p1 = new Project(note)
  const lline = p1.detailedSummaryLine() // FIXME:
  console.log(`For open note:\n\t${lline}`)

  console.log(`\nnoteTypeSummaries`)
  const destination = 'note' // or 'show' or 'log'
  const tags = pref_noteTypeTags.split(',')

  for (const tag of tags) {
    // Do the main work
    const outputArray = makeNoteTypeSummary(tag)
    const tagName = tag.slice(1)
    const noteTitle = `'${tagName}' notes summary`
    outputArray.unshift(`# ${noteTitle}`) // add note title to start

    // Save or show the results
    switch (destination) {
      case 'note': {
        let note: ?TNote
        // first see if this note has already been created
        // (look only in active notes, not Archive or Trash)
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
          let noteFilename = await DataStore.newNote(
            noteTitle,
            pref_folderToStore,
          )
          console.log(`\tnewNote filename: ${String(noteFilename)}`)
          noteFilename =
            `${pref_folderToStore}/${String(noteFilename)}` ?? '(error)'
          // NB: filename here = folder + filename
          note = await DataStore.projectNoteByFilename(noteFilename)
          console.log(`\twriting results to the new note '${noteFilename}'`)
        }

        if (note != null) {
          // $FlowIgnore[incompatible-use]
          note.content = outputArray.join('\n')
        } else {
          console.log(
            "makeNoteTypeSummary: error: shouldn't get here -- no valid note to write to",
          )
          return
        }

        console.log(`\twritten results to note '${noteTitle}'`)
        break
      }

      case 'log': {
        console.log(outputArray.join('\n'))
        break
      }

      default: {
        const re = await CommandBar.showOptions(
          outputArray,
          // you had noteTag here. But that variable is not defined
          `Summary for ${String(tag)} notes.  (Select anything to copy)`,
        )
        if (re !== null) {
          Clipboard.string = outputArray.join('\n')
        }
        break
      }
    }
  }
}

//-------------------------------------------------------------------------------
// Return summary of notes that contain a particular tag, for all
// relevant folders
export function makeNoteTypeSummary(noteTag: string): Array<string> {
  console.log(`\nmakeNoteTypeSummary for ${noteTag}`)

  let noteCount = 0
  const outputArray: Array<string> = []

  // if we want a summary broken down by folder, create list of folders
  // otherwise use a single folder
  const folderList = pref_groupedByFolder ? DataStore.folders : ['/']
  console.log(`${folderList.length} folders`)
  // Iterate over the folders
  let notesLength = 0
  // A for-of loop is cleaner and less error prone than a regular for-loop
  for (const folder of folderList) {
    const notes = findMatchingTagsNotesSortedByName(noteTag, folder)
    // console.log(notes.length)
    if (notes.length > 0) {
      if (pref_groupedByFolder) {
        outputArray.push(`### ${folder} (${notes.length} notes)`)
      }
      // iterate over this folder's notes
      for (const note of notes) {
        outputArray.push(noteStatus(note)) // TODO: use Class function
      }
      noteCount += notes.length
    }
    notesLength = notes.length
  }
  // Add a summary/ies onto the start
  if (!pref_groupedByFolder) {
    // NOTE: notes wasn't defined here
    // Do you want the last value of `notes` from within the for loop?
    // That's what I made it use for now.
    outputArray.unshift(`### All folders (${notesLength} notes)`)
  }
  outputArray.unshift(
    `Total: ${noteCount} notes. (Last updated: ${nowShortDateTime})`,
  )
  return outputArray
}
