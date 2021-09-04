// @flow

//-----------------------------------------------------------------------------
// Create statistics for hasthtags and mentions for time periods
// Jonathan Clark
// v0.3.3, 2.7.2021 - unreleased
//-----------------------------------------------------------------------------

// TODO:
// - When weekly/monthly notes are made possible in NP, then output changes there as well

//-----------------------------------------------------------------------------
// Config settings
const DEFAULT_STATS_OPTIONS = `  statistics: {
    folderToStore: 'Summaries',
    hashtagCountsHeading: '#hashtag counts',
    mentionCountsHeading: '@mention counts',
    countsHeadingLevel: 3, // headings use H3 (or ...)
    showAsHashtagOrMention: true, // or false to hide # and @ characters
    // In the following the includes (if specified) takes precedence over excludes ...
    includeHashtags: [], // e.g. ['#holiday','#jog','#commute','#webinar']
    excludeHashtags: [],
    includeMentions: [], // e.g. ['@work','@fruitveg','@words']
    excludeMentions: ['@done'],
  },
`

// Globals, to be looked up later
let pref_folderToStore: string
let pref_countsHeadingLevel: 1 | 2 | 3 | 4 | 5
let pref_hashtagCountsHeading: string
let pref_mentionCountsHeading: string
let pref_showAsHashtagOrMention: boolean = false
let pref_includeHashtags: $ReadOnlyArray<string> = []
let pref_excludeHashtags: $ReadOnlyArray<string> = []
let pref_includeMentions: $ReadOnlyArray<string> = []
let pref_excludeMentions: $ReadOnlyArray<string> = []

//-----------------------------------------------------------------------------
// Helper functions

import {
  displayTitle,
  stringReplace,
  getTagParams,
} from '../../helpers/general'
import {
  showMessage,
  chooseOption,
  getInput,
} from '../../helpers/userInput'
import {
  todaysDateISOString,
  unhyphenatedDate,
  toISOShortDateTimeString,
  monthNameAbbrev,
  withinDateRange,
  dateStringFromCalendarFilename,
  toLocaleShortTime,
} from '../../helpers/dateTime'


import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

// Return quarter start and end dates for a given quarter
function quarterStartEnd(qtr: number, year: number): [Date, Date] {
  // Default values are needed to account for the
  // default case of the switch statement below.
  // Otherwise, these variables will never get initialized before
  // being used.
  let fromDate: Date = new Date()
  let toDate: Date = new Date()

  // Because this seems to use ISO dates, we appear to need to take timezone
  // offset into account in order to avoid landing up crossing date boundaries.
  // I.e. when in BST (=UTC+0100) it's calculating dates which are often 1 too early.
  // Get TZOffset in minutes. If positive then behind UTC; if negative then ahead.
  const TZOffset = new Date().getTimezoneOffset()

  switch (qtr) {
    case 1: {
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 1, 1, 0, 0, 0), 'minute', -TZOffset)
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 3, 31, 0, 0, 0), 'minute', -TZOffset)
      break
    }
    case 2: {
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 4, 1, 0, 0, 0), 'minute', -TZOffset)
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 6, 30, 0, 0, 0), 'minute', -TZOffset)
      break
    }
    case 3: {
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 7, 1, 0, 0, 0), 'minute', -TZOffset)
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 9, 30, 0, 0, 0), 'minute', -TZOffset)
      break
    }
    case 4: {
      fromDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 10, 1, 0, 0, 0), 'minute', -TZOffset)
      toDate = Calendar.addUnitToDate(Calendar.dateFrom(year, 12, 31, 0, 0, 0), 'minute', -TZOffset)
      break
    }
    default: {
      console.log(`error: invalid quarter given: ${qtr}`)
      break
    }
  }
  return [fromDate, toDate]
}

//-------------------------------------------------------------------------------
// Ask user which period to cover, call main stats function, and present results
export async function periodStats(): Promise<void> {
  // Get config settings from Template folder _configuration note
  const statsConfig = await getOrMakeConfigurationSection(
    'statistics',
    DEFAULT_STATS_OPTIONS,
    // no minimum config required, as all defaults are given below
  )
  if (statsConfig == null) {
    console.log("\tCouldn't find 'statistics' settings in _configuration note.")
    return
  }

  console.log("\tFound 'statistics' settings in _configuration note.")
  // now get each setting
  pref_folderToStore =
    statsConfig.folderToStore != null
      // $FlowIgnore[incompatible-type]
      ? statsConfig.folderToStore
      : 'Summaries'
  // console.log(pref_folderToStore)
  pref_hashtagCountsHeading =
    statsConfig.hashtagCountsHeading != null
      // $FlowIgnore[incompatible-type]
      ? statsConfig.hashtagCountsHeading
      : '#hashtag counts'
  // console.log(pref_hashtagCountsHeading)
  pref_mentionCountsHeading =
    statsConfig.mentionCountsHeading != null
      // $FlowIgnore[incompatible-type]
      ? statsConfig.mentionCountsHeading
      : '@mention counts'
  // console.log(pref_mentionCountsHeading)
  pref_countsHeadingLevel =
    statsConfig.countsHeadingLevel != null
      // $FlowIgnore[incompatible-type]
      ? statsConfig.countsHeadingLevel
      : 2
  // console.log(pref_countsHeadingLevel)
  pref_showAsHashtagOrMention =
    statsConfig.showAsHashtagOrMention != null
      // $FlowIgnore[incompatible-type]
      ? statsConfig.showAsHashtagOrMention
      : true
  // console.log(pref_showAsHashtagOrMention)
  pref_includeHashtags =
    statsConfig.includeHashtags != null
      // $FlowIgnore[incompatible-type]
      ? statsConfig.includeHashtags
      : [] // this takes precedence over any excludes ...
  // console.log(pref_includeHashtags)
  pref_excludeHashtags =
    statsConfig.excludeHashtags != null
      // $FlowIgnore[incompatible-type]
      ? statsConfig.excludeHashtags
      : []
  // console.log(pref_excludeHashtags)
  pref_includeMentions =
    statsConfig.includeMentions != null
      // $FlowIgnore[incompatible-type]
      ? statsConfig.includeMentions
      : [] // this takes precedence over any excludes ...
  // console.log(pref_includeMentions)
  pref_excludeMentions =
    statsConfig.excludeMentions != null
      // $FlowIgnore[incompatible-type]
      ? statsConfig.excludeMentions
      : ['@done', '@repeat']
  // console.log(pref_excludeMentions)

  const todaysDate = new Date()
  // couldn't get const { y, m, d } = getYearMonthDate(todaysDate) to work ??
  const y = todaysDate.getFullYear()
  const m = todaysDate.getMonth() + 1
  const d = todaysDate.getDate()

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

  let fromDate
  let toDate
  let periodString = ''
  let countsHeadingAdd = ''

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
      countsHeadingAdd = `(to ${todaysDateISOString})`
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
      countsHeadingAdd = `(to ${todaysDateISOString})`
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
      countsHeadingAdd = `(to ${todaysDateISOString})`
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
  if (fromDate == null || toDate == null) {
    console.log('dates could not be parsed')
    return
  }

  console.log(
    `periodStats: calculating for ${periodString} (${toISOShortDateTimeString(fromDate)}-${toISOShortDateTimeString(toDate)})`,
  )

  const fromDateStr = unhyphenatedDate(fromDate) //fromDate.toISOString().slice(0, 10).replace(/-/g, '')
  const toDateStr = unhyphenatedDate(toDate) // toDate.toISOString().slice(0, 10).replace(/-/g, '')
  console.log(
    `\nperiodStats: calculating for ${periodString} (${fromDateStr}-${toDateStr}):`,
  )

  // Calc hashtags stats (returns two maps)
  const hOutputArray = []
  let results = calcHashtagStatsPeriod(fromDateStr, toDateStr)
  const hCounts = results?.[0]
  const hSumTotals = results?.[1]
  if (hSumTotals == null || hCounts == null) {
    console.log('no hSumTotals value')
    return
  }

  // Custom sort method to sort arrays of two values each
  // const sortedHCounts = new Map(
  //   [...(hCounts?.entries() ?? [])].sort(([key1, _v1], [key2, _v2]) =>
  //     key1.localeCompare(key2),
  //   ),
  // )

  // First process more complex 'SumTotals', calculating appropriately
  for (const [key, value] of hSumTotals) {
    // .entries() implied
    const hashtagString = pref_showAsHashtagOrMention ? key : key.slice(1)
    const count = hCounts.get(key)
    if (count != null) {
      const total: string = value.toFixed(0)
      const average: string = (value / count).toFixed(1)
      hOutputArray.push(
        `${hashtagString}\t${count}\t(total ${total}\taverage ${average})`,
      )
      hCounts.delete(key) // remove the entry from the next map, as not longer needed
    }
  }
  // Then process simpler 'Counts'
  for (const [key, value] of hCounts) {
    // .entries() implied
    const hashtagString = pref_showAsHashtagOrMention ? key : key.slice(1)
    hOutputArray.push(`${hashtagString}\t${value}`)
  }
  // If there's nothing to report, let's make that clear, otherwise sort output
  if (hOutputArray.length > 0) {
    hOutputArray.sort()
  } else {
    hOutputArray.push('(none)')
  }

  // Calc mentions stats (returns two maps)
  const mOutputArray = []
  results = calcMentionStatsPeriod(fromDateStr, toDateStr)
  const mCounts = results?.[0]
  const mSumTotals = results?.[1]
  if (mCounts == null || mSumTotals == null) {
    return
  }

  // Custom sort method to sort arrays of two values each
  // const sortedMResults = new Map(
  //   [...(mCounts?.entries() ?? [])].sort(([key1, _v1], [key2, _v2]) =>
  //     key1.localeCompare(key2),
  //   ),
  // )

  // First process more complex 'SumTotals', calculating appropriately
  for (const [key, value] of mSumTotals) {
    // .entries() implied
    const mentionString = pref_showAsHashtagOrMention ? key : key.slice(1)
    const count = mCounts.get(key)
    if (count != null) {
      const total = value.toFixed(0)
      const average = (value / count).toFixed(1)
      mOutputArray.push(
        `${mentionString}\t${count}\t(total ${total}\taverage ${average})`,
      )
      mCounts.delete(key) // remove the entry from the next map, as not longer needed
    }
  }
  // Then process simpler 'Counts'
  for (const [key, value] of mCounts) {
    const mentionString = pref_showAsHashtagOrMention ? key : key.slice(1)
    mOutputArray.push(`${mentionString}\t${value}`)
  }
  // If there's nothing to report, let's make that clear, otherwise sort output
  if (mOutputArray.length > 0) {
    mOutputArray.sort()
  } else {
    mOutputArray.push('(none)')
  }

  // Ask where to save this summary to
  const labelString = `🗒 Add/update note '${periodString}' in folder '${String(
    pref_folderToStore,
  )}'`
  const destination = await chooseOption(
    `Where to save the summary for ${periodString}?`,
    [
      {
        // TODO: When weekly/monthly notes are made possible in NP, then add options like this
        //   label: "📅 Append to this month's note",
        //   value: "today"
        // }, {
        label: labelString,
        value: 'note',
      },
      {
        label: '🖥 Pop-up display',
        value: 'show',
      },
      {
        label: '🖊 Write to console log',
        value: 'log',
      },
      {
        label: '❌ Cancel',
        value: 'cancel',
      },
    ],
    'show',
  )

  // Ask where to send the results
  switch (destination) {
    case 'today': {
      const todaysNote = await DataStore.calendarNoteByDate(new Date())
      if (todaysNote == null) {
        console.log(`\terror appending to today's note`)
      } else {
        console.log(
          `\tappending results to today's note (${todaysNote.filename ?? ''})`,
        )
        todaysNote.appendParagraph(
          `${String(
            pref_hashtagCountsHeading,
          )} for ${periodString} ${countsHeadingAdd}`,
          'text',
        )
        todaysNote.appendParagraph(hOutputArray.join('\n'), 'text')
        todaysNote.appendParagraph(
          `${String(
            pref_mentionCountsHeading,
          )} for ${periodString} ${countsHeadingAdd}`,
          'empty',
        )
        todaysNote.appendParagraph(mOutputArray.join('\n'), 'text')
        console.log(`\tappended results to today's note`)
      }
      break
    }
    case 'note': {
      let note: ?TNote
      // first see if this note has already been created
      // (look only in active notes, not Archive or Trash)
      const existingNotes: $ReadOnlyArray<TNote> =
        DataStore.projectNoteByTitle(periodString, true, false) ?? []

      console.log(
        `\tfound ${existingNotes.length} existing summary notes for this period`,
      )

      if (existingNotes.length > 0) {
        note = existingNotes[0] // pick the first if more than one
        console.log(`\tfilename of first matching note: ${displayTitle(note)}`)
      } else {
        // make a new note for this. NB: filename here = folder + filename
        const noteFilename = DataStore.newNote(periodString, pref_folderToStore)
        if (!noteFilename) {
          await showMessage('There was an error creating the new note')
          return
        }
        console.log(`\tnewNote filename: ${noteFilename}`)
        note = DataStore.projectNoteByFilename(noteFilename)
        if (note == null) {
          await showMessage('There was an error getting the new note ready to write')
          return
        }
        console.log(`\twriting results to the new note '${displayTitle(note)}'`)
      }

      if (note != null) {
        // This is a bug in flow. Creating a temporary const is a workaround.
        const nonNullNote = note
        // Do we have an existing Hashtag counts section? If so, delete it.
        let insertionLineIndex = removeSection(
          nonNullNote,
          pref_hashtagCountsHeading,
        )
        console.log(`\tHashtag insertionLineIndex: ${String(insertionLineIndex)}`)
        // Set place to insert either after the found section heading, or at end of note
        // write in reverse order to avoid having to calculate insertion point again
        nonNullNote.insertHeading(
          `${pref_hashtagCountsHeading} ${countsHeadingAdd}`,
          insertionLineIndex,
          pref_countsHeadingLevel,
        )
        nonNullNote.insertParagraph(
          hOutputArray.join('\n'),
          insertionLineIndex + 1,
          'text',
        )
        // nonNullNote.insertHeading(countsHeading, insertionLineIndex, pref_countsHeadingLevel)

        // Do we have an existing Mentions counts section? If so, delete it.
        insertionLineIndex = removeSection(
          nonNullNote,
          pref_mentionCountsHeading,
        )
        console.log(`\tMention insertionLineIndex: ${insertionLineIndex}`)
        nonNullNote.insertHeading(
          `${pref_mentionCountsHeading} ${countsHeadingAdd}`,
          insertionLineIndex,
          pref_countsHeadingLevel,
        )
        nonNullNote.insertParagraph(
          mOutputArray.join('\n'),
          insertionLineIndex + 1,
          'text',
        )
      } else {
        // Shouldn't get here, but will because of a bug in <=r635
        console.log(
          "tagStats: error: shouldn't get here -- no valid note to write to",
        )
        await showMessage('Please re-run this command (NP bug before release 636')
        return
      }

      console.log(`\twritten results to note '${periodString}'`)
      break
    }

    case 'log': {
      console.log(
        `${pref_hashtagCountsHeading} for ${periodString} ${countsHeadingAdd}`,
      )
      console.log(hOutputArray.join('\n'))
      console.log(
        `${pref_mentionCountsHeading} for ${periodString} ${countsHeadingAdd}`,
      )
      console.log(mOutputArray.join('\n'))
      break
    }

    case 'cancel': {
      break
    }

    default: {
      const outputs = hOutputArray.concat(mOutputArray)
      const re = await CommandBar.showOptions(
        outputs,
        '(Select anything to copy)',
      )
      if (re !== null) {
        Clipboard.string = `${hOutputArray.join('\n')}\n\n${mOutputArray.join(
          '\n',
        )}`
      }
      break
    }
  }
}

//------------------------------------------------------------------------------
// remove all paragraphs in a section, given:
// - Section heading line to look for (needs to match from start but not end)
// - Array of paragraphs
// Returns the lineIndex of the found heading, or if not found the last line of the note
function removeSection(note: TNote, heading: string): number {
  const ps = note.paragraphs
  let existingHeadingIndex = ps.length
  const thisTitle = note.title ?? ''
  console.log(
    `\t  removeSection '${heading}' from note '${thisTitle}' with ${ps.length} paras:`,
  )

  for (const p of ps) {
    if (p.type === 'title' && p.content.startsWith(heading)) {
      existingHeadingIndex = p.lineIndex
    }
  }
  console.log(`\t    heading at: ${existingHeadingIndex}`)

  if (existingHeadingIndex !== undefined && existingHeadingIndex < ps.length) {
    // Work out the set of paragraphs to remove
    // let psToRemove = []
    note.removeParagraph(ps[existingHeadingIndex])
    let removed = 1
    for (let i = existingHeadingIndex + 1; i < ps.length; i++) {
      if (ps[i].type === 'title' || ps[i].content === '') {
        break
      }
      // psToRemove.push(ps[i])
      note.removeParagraph(ps[i])
      removed++
    }
    console.log(`\t   Removed ${removed} paragraphs. ${existingHeadingIndex}`)

    // Delete the saved set of paragraphs
    // TODO: when NP API bug is resolved, revert to this instead of above
    // console.log(`About to remove ${psToRemove.length} paragraphs`)
    // note.removeParagraphs(psToRemove)
    // console.log(`Removed ${psToRemove.length} paragraphs`);
    return existingHeadingIndex
  } else {
    return ps.length
  }
}

//-------------------------------------------------------------------------------
// Calculate hashtag statistics for daily notes of a given time period
// @param {string} fromDateStr - YYYYMMDD string of start date
// @param {string} toDateStr - YYYYMMDD string of start date
// @return {Map, Map}
// - Map of { tag, count } for all tags included or not excluded
// - Map of { tag, total } for the subset of all tags above that finish with a /number
function calcHashtagStatsPeriod(
  fromDateStr,
  toDateStr,
): ?[Map<string, number>, Map<string, number>] {
  // Get all daily notes that are within this time period
  const periodDailyNotes = DataStore.calendarNotes.filter((p) =>
    withinDateRange(
      dateStringFromCalendarFilename(p.filename),
      fromDateStr,
      toDateStr,
    ),
  )

  if (periodDailyNotes.length === 0) {
    console.log('  warning: no matching daily notes found')
    return
  } else {
    console.log(`  found ${periodDailyNotes.length} matching daily notes`)
  }

  // work out what set of mentions to look for (or ignore)
  const hashtagsToLookFor =
    pref_includeHashtags.length > 0 ? pref_includeHashtags : []
  // console.log(JSON.stringify({ hashtagsToLookFor }, null, 2))
  const hashtagsToIgnore =
    pref_excludeHashtags.length > 0 ? pref_excludeHashtags : []
  // console.log(JSON.stringify({ hashtagsToIgnore }, null, 2))

  // For each matching date, find and store the tags in Map
  const tagCounts = new Map<string, number>() // key: tagname; value: count
  // Also define map to count and total hashtags with a final /number part.
  const tagSumTotals = new Map<string, number>() // key: tagname (except last part); value: total
  for (const n of periodDailyNotes) {
    const seenTags = n.hashtags
    // console.log(`${n.date} -> ${n.hashtags.join(' / ')}`)
    for (const t of seenTags) {
      // check this is on inclusion, or not on exclusion list, before adding
      if (
        hashtagsToLookFor.length > 0 &&
        hashtagsToLookFor.filter((a) => t.startsWith(a)).length === 0
      ) {
        // console.log(`\tIgnoring '${t}' as not on inclusion list`)
      } else if (hashtagsToIgnore.filter((a) => t.startsWith(a)).length > 0) {
        // console.log(`\tIgnoring '${t}' as on exclusion list`)
      } else {
        // if this is tag that finishes /number, then
        if (t.match(/\/\d+(\.\d+)?$/)) {
          const tagParts = t.split('/')
          const k = tagParts[0]
          const v = Number(tagParts[1])
          // console.log(`found tagParts ${k} / ${v}`)
          tagCounts.set(k, (tagCounts.get(k) ?? 0) + 1)
          tagSumTotals.set(k, (tagSumTotals.get(k) ?? 0) + v)
          // console.log(`  ${k} -> ${tagSumTotals.get(k)} from ${tagCounts.get(k)}`)
        } else {
          // just save this to the main map
          tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
          // console.log(`  ${t} -> ${tagCounts.get(t)}`)
        }
      }
    }
  }

  // Test output of totals arithmetic
  // for (let k of tagSumTotals.keys()) {
  //   const count = tagCounts.get(k)
  //   const average = tagSumTotals.get(k) / count
  //   console.log(`${k}: count ${count.toString()} average ${average.toString()}`)
  // }

  return [tagCounts, tagSumTotals]
}

//-------------------------------------------------------------------------------
// Calculate mention statistics for daily notes of a given time period.
// If an 'include' list is set, only include things from that list.
// If not, include all, except those on an 'exclude' list (if set).
// Returns a Map of {tag, count}

function calcMentionStatsPeriod(
  fromDateStr,
  toDateStr,
): ?[Map<string, number>, Map<string, number>] {
  // Get all daily notes that are within this time period
  const periodDailyNotes = DataStore.calendarNotes.filter((p) =>
    withinDateRange(
      dateStringFromCalendarFilename(p.filename),
      fromDateStr,
      toDateStr,
    ),
  )

  if (periodDailyNotes.length === 0) {
    console.log('  warning: no matching daily notes found')
    return
  } else {
    console.log(`  found ${periodDailyNotes.length} matching daily notes`)
  }

  // work out what set of mentions to look for (or ignore)
  const mentionsToLookFor =
    pref_includeMentions.length > 0 ? pref_includeMentions : []
  // console.log(JSON.stringify({ mentionsToLookFor }, null, 2))

  const mentionsToIgnore =
    pref_excludeMentions.length > 0 ? pref_excludeMentions : []
  // console.log(JSON.stringify({ mentionsToIgnore }, null, 2))

  // For each matching date, find and store the mentions in Map
  const mentionCounts = new Map<string, number>() // key: tagname; value: count
  // Also define map to count and total hashtags with a final /number part.
  const mentionSumTotals = new Map<string, number>() // key: mention name (except last part); value: total

  for (const n of periodDailyNotes) {
    const seenMentions = n.mentions
    // console.log(`${n.date} -> ${n.mentions.join(' / ')}`)
    for (const m of seenMentions) {
      // check this is on inclusion, or not on exclusion list, before adding
      if (
        mentionsToLookFor.length > 0 &&
        mentionsToLookFor.filter((a) => m.startsWith(a)).length === 0
      ) {
        // console.log(`\tIgnoring '${m}' as not on inclusion list`)
      } else if (mentionsToIgnore.filter((a) => m.startsWith(a)).length > 0) {
        // console.log(`\tIgnoring '${m} as on exclusion list`)
      } else {
        // if this is menion that finishes (number), then
        if (m.match(/\(\d+(\.\d+)?\)$/)) {
          const mentionParts = m.split('(')
          const k = mentionParts[0]
          const v = Number(mentionParts[1].slice(0, -1)) // chop off final ')' character
          // console.log(`found mentionParts ${k} / ${v}`)
          mentionCounts.set(k, (mentionCounts.get(k) ?? 0) + 1)
          mentionSumTotals.set(k, (mentionSumTotals.get(k) ?? 0) + v)
          // console.log(`  ${k} -> ${mentionSumTotals.get(k)} from ${mentionCounts.get(k)}`)
        } else {
          // just save this to the main map
          mentionCounts.set(m, (mentionCounts.get(m) ?? 0) + 1)
          // console.log(`  -> ${m} = ${mentionCounts.get(m)}`)
        }
      }
    }
  }

  return [mentionCounts, mentionSumTotals]
}
