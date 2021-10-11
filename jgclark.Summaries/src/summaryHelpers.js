// @flow
//-----------------------------------------------------------------------------
// Summary commands for notes
// Jonathan Clark
// v0.1.0, 11.10.2021
//-----------------------------------------------------------------------------

import {
  monthNameAbbrev,
  quarterStartEnd,
  todaysDateISOString,
} from '../../helpers/dateTime'

import {
  chooseOption,
  getInput
} from '../../helpers/userInput'

export const DEFAULT_SUMMARIES_OPTIONS = `  summaries: {
    folderToStore: 'Summaries',
    // settings for 'countsInPeriod':
    hashtagCountsHeading: '#hashtag counts',
    mentionCountsHeading: '@mention counts',
    countsHeadingLevel: 2, // use level 1-5 headings
    showAsHashtagOrMention: true, // or false to hide # and @ characters
    // In the following the includes (if specified) takes precedence over excludes ...
    includeHashtags: [], // e.g. ['#holiday','#jog','#commute','#webinar']
    excludeHashtags: [],
    includeMentions: [], // e.g. ['@work','@fruitveg','@words']
    excludeMentions: ['@done', '@repeat'],
    // settings for 'occurrencesInPeriod':
    occurrencesHeading: 'Occurrences',
    occurrencesHeadingLevel: 2, // use level 1-5 headings
    occurrencesToMatch: ['idea', '@review', '#question'],
    highlightOccurrences: false, // use ==highlight== of matched occurrences in output
    showEmptyOccurrences: false, // if no occurrences found of this string to match, make this clear
  },
`
export async function getPeriodStartEndDates(): [Date, Date, string, string] {
  // Ask user what time interval to do tag counts for
  const period = await chooseOption(
    'Create stats for which period?',
    [
      {
        label: 'Last Month',
        value: 'lm',
      },
      {
        label: 'This Month (to date)',
        value: 'mtd',
      },
      {
        label: 'Other Month',
        value: 'om',
      },
      {
        label: 'Last Quarter',
        value: 'lq',
      },
      {
        label: 'This Quarter (to date)',
        value: 'qtd',
      },
      {
        label: 'Other Quarter',
        value: 'oq',
      },
      {
        label: 'Last Year',
        value: 'ly',
      },
      {
        label: 'Year to date',
        value: 'ytd',
      },
      {
        label: 'Other Year',
        value: 'oy',
      },
    ],
    'mtd',
  )

  let fromDate: Date
  let toDate: Date
  let periodString = ''
  let periodPartStr = ''

  const todaysDate = new Date()
  // couldn't get const { y, m, d } = getYearMonthDate(todaysDate) to work ??
  const y = todaysDate.getFullYear()
  const m = todaysDate.getMonth() + 1
  const d = todaysDate.getDate()

  // We appear to need to take timezone offset into account in order to avoid landing
  // up crossing date boundaries.
  // I.e. when in BST (=UTC+0100) it's calculating dates which are often 1 too early.
  // Get TZOffset in minutes. If positive then behind UTC; if negative then ahead.
  const TZOffset = new Date().getTimezoneOffset()
  console.log(`TimeZone Offset = ${TZOffset}`)
  switch (period) {
    case 'lm': {
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(y, m, 1, 0, 0, 0), 'minute', -TZOffset) // go to start of this month
      fromDate = Calendar.addUnitToDate(fromDate, 'month', -1) // -1 month
      toDate = Calendar.addUnitToDate(fromDate, 'month', 1) // + 1 month
      toDate = Calendar.addUnitToDate(toDate, 'day', -1) // -1 day, to get last day of last month
      periodString = `${monthNameAbbrev(fromDate.getMonth() + 1)} ${y}`
      break
    }
    case 'mtd': {
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(y, m, 1, 0, 0, 0), 'minute', -TZOffset) // start of this month
      toDate = Calendar.dateFrom(y, m, d, 0, 0, 0)
      periodString = `${monthNameAbbrev(m)} ${y}`
      periodPartStr = `(to ${todaysDateISOString})`
      break
    }
    case 'om': {
      const theM = Number(await getInput('Choose month, (1-12)', 'OK'))
      const theY = Number(await getInput('Choose date, e.g. 2019', 'OK'))
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(theY, theM, 1, 0, 0, 0), 'minute', -TZOffset) // start of this month
      toDate = Calendar.addUnitToDate(fromDate, 'month', 1) // + 1 month
      toDate = Calendar.addUnitToDate(toDate, 'day', -1) // -1 day, to get last day of last month
      periodString = `${monthNameAbbrev(theM)} ${theY}`
      break
    }
    case 'lq': {
      const thisQ = Math.floor((m - 1) / 3) + 1 // quarter 1-4
      const theQ = thisQ > 0 ? thisQ - 1 : 4 // last quarter
      const theY = theQ === 4 ? y - 1 : y // change the year if we want Q4
      const [f, t] = quarterStartEnd(theQ, theY)
      fromDate = f
      toDate = t
      const theQStartMonth = (theQ - 1) * 3 + 1
      toDate = Calendar.addUnitToDate(fromDate, 'month', 3) // +1 quarter
      toDate = Calendar.addUnitToDate(toDate, 'day', -1) // -1 day, to get last day of last month
      periodString = `${theY} Q${theQ} (${monthNameAbbrev(
        theQStartMonth,
      )}-${monthNameAbbrev(theQStartMonth + 2)})`
      break
    }
    case 'qtd': {
      const thisQ = Math.floor((m - 1) / 3) + 1
      const thisQStartMonth = (thisQ - 1) * 3 + 1
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(y, thisQStartMonth, 1, 0, 0, 0), 'minute', -TZOffset) // start of this quarter
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(y, m, d, 0, 0, 0), 'minute', -TZOffset)
      periodString = `${y} Q${thisQ} (${monthNameAbbrev(
        thisQStartMonth,
      )}-${monthNameAbbrev(thisQStartMonth + 2)})`
      periodPartStr = `(to ${todaysDateISOString})`
      break
    }
    case 'oq': {
      const theQ = Number(await getInput('Choose quarter, (1-4)', 'OK'))
      const theY = Number(await getInput('Choose date, e.g. 2019', 'OK'))
      const theQStartMonth = (theQ - 1) * 3 + 1
      const [f, t] = quarterStartEnd(theQ, theY)
      fromDate = f
      toDate = t
      toDate = Calendar.addUnitToDate(fromDate, 'month', 3) // +1 quarter
      toDate = Calendar.addUnitToDate(toDate, 'day', -1) // -1 day, to get last day of last month
      periodString = `${theY} Q${theQ} (${monthNameAbbrev(
        theQStartMonth,
      )}-${monthNameAbbrev(theQStartMonth + 2)})`
      break
    }
    case 'ly': {
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(y - 1, 1, 1, 0, 0, 0), 'minute', -TZOffset) // start of last year
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(y - 1, 12, 31, 0, 0, 0), 'minute', -TZOffset) // end of last year
      periodString = `${y - 1}`
      break
    }
    case 'ytd': {
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(y, 1, 1, 0, 0, 0), 'minute', -TZOffset) // start of this year
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(y, m, d, 0, 0, 0), 'minute', -TZOffset)
      periodString = `${y}`
      periodPartStr = `(to ${todaysDateISOString})`
      break
    }
    case 'oy': {
      const theYear = Number(await getInput('Choose date, e.g. 2019', 'OK'))
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(theYear, 1, 1, 0, 0, 0), 'minute', -TZOffset) // start of this year
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(theYear, 12, 31, 0, 0, 0), 'minute', -TZOffset)
      periodString = `${theYear}`
      break
    }
  }
  return [fromDate, toDate, periodString, periodPartStr]
}

//------------------------------------------------------------------------------
// Remove all paragraphs in a section, given:
// - Note to use
// - Section heading line to look for (needs to match from start of line but not necessarily the end)
// A section is defined (here at least) as all the lines between the heading,
// and the next heading of that same or higher level, or the end of the file 
// if that's sooner.
//
// Returns the lineIndex of the found heading, or if not found the last line of the note
export function removeSection(note: TNote, heading: string): number {
  const ps = note.paragraphs
  let existingHeadingIndex = ps.length // start at end of file
  let sectionHeadingLevel = 2
  console.log(
    `\tremoveSection: '${heading}' from note '${note.title ?? ''}' with ${ps.length} paras:`,
  )

  for (const p of ps) {
    if (p.type === 'title' && p.content.startsWith(heading)) {
      existingHeadingIndex = p.lineIndex
      sectionHeadingLevel = p.headingLevel
    }
  }
  // console.log(`\t    heading level ${sectionHeadingLevel} at line ${existingHeadingIndex}`)

  if (existingHeadingIndex !== undefined && existingHeadingIndex < ps.length) {
    // Work out the set of paragraphs to remove
    const psToRemove = []
    note.removeParagraph(ps[existingHeadingIndex])
    let removed = 1
    for (let i = existingHeadingIndex + 1; i < ps.length; i++) {
      // stop removing when we reach heading of same or higher level
      // if (ps[i].type === 'title' || ps[i].content === '') {
      if (ps[i].type === 'title' && ps[i].headingLevel <= sectionHeadingLevel) {
        break
      }
      psToRemove.push(ps[i])
      // note.removeParagraph(ps[i])
      removed++
    }
    // console.log(`\t   Removed ${removed} paragraphs. ${existingHeadingIndex}`)

    // Delete the saved set of paragraphs
    // TODO: when NP API bug is resolved, revert to this instead of above
    note.removeParagraphs(psToRemove)
    console.log(`\t  -> removed ${psToRemove.length} paragraphs`)
    return existingHeadingIndex
  } else {
    return ps.length
  }
}
