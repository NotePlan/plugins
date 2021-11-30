// @flow
//-----------------------------------------------------------------------------
// Create statistics for hasthtags and mentions for time periods
// Jonathan Clark
// v0.4.0, 3.11.2021
//-----------------------------------------------------------------------------

// TODO:
// - When weekly/monthly notes are made possible in NP, then output changes there as well

//-----------------------------------------------------------------------------
// Helper functions

import {
  displayTitle,
  stringReplace,
} from '../../helpers/general'
import {
  showMessage,
  chooseOption,
  getInput,
} from '../../helpers/userInput'
import {
  quarterStartEnd,
  todaysDateISOString,
  unhyphenatedDate,
  toISOShortDateTimeString,
  monthNameAbbrev,
  withinDateRange,
  dateStringFromCalendarFilename,
  getWeek,
  weekStartEnd,
  // toLocaleTime,
} from '../../helpers/dateTime'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import {
  getPeriodStartEndDates,
  removeSection,
  DEFAULT_SUMMARIES_OPTIONS,
} from './summaryHelpers'

//-----------------------------------------------------------------------------
// Config settings
// Globals, to be looked up later
let pref_folderToStore: string
let pref_headingLevel: 1 | 2 | 3 | 4 | 5
let pref_hashtagCountsHeading: string
let pref_mentionCountsHeading: string
let pref_showAsHashtagOrMention: boolean = false
let pref_includeHashtags: $ReadOnlyArray<string> = []
let pref_excludeHashtags: $ReadOnlyArray<string> = []
let pref_includeMentions: $ReadOnlyArray<string> = []
let pref_excludeMentions: $ReadOnlyArray<string> = []

async function getPluginSettings(): Promise<void> {
  // Get config settings from Template folder _configuration note
  const summConfig = await getOrMakeConfigurationSection(
    'summaries',
    DEFAULT_SUMMARIES_OPTIONS,
    // no minimum config required, as all defaults are given below
  )
  if (summConfig == null) {
    console.log("\tCouldn't find 'summaries' settings in _configuration note.")
    return
  }

  console.log("\tFound 'summaries' settings in _configuration note.")
  // now get each setting
  pref_folderToStore =
    summConfig.folderToStore != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.folderToStore
      : 'Summaries'
  // console.log(pref_folderToStore)
  pref_hashtagCountsHeading =
    summConfig.hashtagCountsHeading != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.hashtagCountsHeading
      : '#hashtag counts'
  // console.log(pref_hashtagCountsHeading)
  pref_mentionCountsHeading =
    summConfig.mentionCountsHeading != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.mentionCountsHeading
      : '@mention counts'
  // console.log(pref_mentionCountsHeading)
  pref_headingLevel =
    summConfig.headingLevel != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.headingLevel
      : 2
  // console.log(pref_headingLevel)
  pref_showAsHashtagOrMention =
    summConfig.showAsHashtagOrMention != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.showAsHashtagOrMention
      : true
  // console.log(pref_showAsHashtagOrMention)
  pref_includeHashtags =
    summConfig.includeHashtags != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.includeHashtags
      : [] // this takes precedence over any excludes ...
  // console.log(pref_includeHashtags)
  pref_excludeHashtags =
    summConfig.excludeHashtags != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.excludeHashtags
      : []
  // console.log(pref_excludeHashtags)
  pref_includeMentions =
    summConfig.includeMentions != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.includeMentions
      : [] // this takes precedence over any excludes ...
  // console.log(pref_includeMentions)
  pref_excludeMentions =
    summConfig.excludeMentions != null
      // $FlowIgnore[incompatible-type]
      ? summConfig.excludeMentions
      : ['@done', '@repeat']
  // console.log(pref_excludeMentions)
}

//-------------------------------------------------------------------------------
// Ask user which period to cover, call main stats function, and present results
export async function statsPeriod(): Promise<void> {
  // Get config settings from Template folder _configuration note
  await getPluginSettings()

  // Get time period
  const [fromDate, toDate, periodString, periodPartStr] = await getPeriodStartEndDates()  
  if (fromDate == null || toDate == null) {
    console.log('\nstatsPeriod: error in calculating dates for chosen time period')
    return
  }
  const fromDateStr = unhyphenatedDate(fromDate) //fromDate.toISOString().slice(0, 10).replace(/-/g, '')
  const toDateStr = unhyphenatedDate(toDate) // toDate.toISOString().slice(0, 10).replace(/-/g, '')
  console.log('')
  console.log(
    `statsPeriod: calculating for ${periodString} (${fromDateStr} - ${toDateStr}):`,
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
  const labelString = `🖊 Create/update a note in folder '${pref_folderToStore}'`
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
        label: '🖊 Append to current note',
        value: 'current',
      },
      {
        label: '📋 Write to console log',
        value: 'log',
      },
      {
        label: '❌ Cancel',
        value: 'cancel',
      },
    ],
    'note',
  )

  // Ask where to send the results
  switch (destination) {
    case 'current': {
      const currentNote = Editor.note
      if (currentNote == null) {
        console.log(`\terror: no note is open`)
      } else {
        console.log(
          `\tappending results to current note (${currentNote.filename ?? ''})`,
        )
        currentNote.appendParagraph(
          `${String(
            pref_hashtagCountsHeading,
          )} for ${periodString} ${periodPartStr}`,
          'text',
        )
        currentNote.appendParagraph(hOutputArray.join('\n'), 'text')
        currentNote.appendParagraph(
          `${String(
            pref_mentionCountsHeading,
          )} for ${periodString} ${periodPartStr}`,
          'empty',
        )
        currentNote.appendParagraph(mOutputArray.join('\n'), 'text')
        console.log(`\tappended results to current note`)
      }
      break
    }
    case 'note': {
      let note: TNote
      // first see if this note has already been created
      // (look only in active notes, not Archive or Trash)
      const existingNotes: $ReadOnlyArray<TNote> =
        DataStore.projectNoteByTitle(periodString, true, false) ?? []

      console.log(
        `\tfound ${existingNotes.length} existing summary notes for this period`,
      )

      if (existingNotes.length > 0) {
        note = existingNotes[0] // pick the first if more than one
        // console.log(`\tfilename of first matching note: ${displayTitle(note)}`)
      } else {
        // make a new note for this. NB: filename here = folder + filename
        const noteFilename = DataStore.newNote(periodString, pref_folderToStore) ?? ''
        if (!noteFilename) {
          console.log(`\tError creating new note (filename '${noteFilename}')`)
          await showMessage('There was an error creating the new note')
          return
        }
        console.log(`\tnewNote filename: ${noteFilename}`)
        // $FlowIgnore[incompatible-type]
        note = DataStore.projectNoteByFilename(noteFilename)
        if (note == null) {
          console.log(`\tError getting new note (filename '${noteFilename}')`)
          await showMessage('There was an error getting the new note ready to write')
          return
        }
        console.log(`\twriting results to the new note '${displayTitle(note)}'`)
      }

      // This is a bug in flow. Creating a temporary const is a workaround.
      // Do we have an existing Hashtag counts section? If so, delete it.
      let insertionLineIndex = removeSection(
        note,
        pref_hashtagCountsHeading,
      )
      console.log(`\tHashtag insertionLineIndex: ${String(insertionLineIndex)}`)
      // Set place to insert either after the found section heading, or at end of note
      // write in reverse order to avoid having to calculate insertion point again
      note.insertHeading(
        `${pref_hashtagCountsHeading} ${periodPartStr}`,
        insertionLineIndex,
        pref_headingLevel,
      )
      note.insertParagraph(
        hOutputArray.join('\n'),
        insertionLineIndex + 1,
        'text',
      )
      // note.insertHeading(countsHeading, insertionLineIndex, pref_headingLevel)

      // Do we have an existing Mentions counts section? If so, delete it.
      insertionLineIndex = removeSection(
        note,
        pref_mentionCountsHeading,
      )
      console.log(`\tMention insertionLineIndex: ${insertionLineIndex}`)
      note.insertHeading(
        `${pref_mentionCountsHeading} ${periodPartStr}`,
        insertionLineIndex,
        pref_headingLevel,
      )
      note.insertParagraph(
        mOutputArray.join('\n'),
        insertionLineIndex + 1,
        'text',
      )
      // open this note in the Editor
      Editor.openNoteByFilename(note.filename)

      console.log(`\twritten results to note '${periodString}'`)
      break
    }

    case 'log': {
      console.log(
        `${pref_hashtagCountsHeading} for ${periodString} ${periodPartStr}`,
      )
      console.log(hOutputArray.join('\n'))
      console.log(
        `${pref_mentionCountsHeading} for ${periodString} ${periodPartStr}`,
      )
      console.log(mOutputArray.join('\n'))
      break
    }

    case 'cancel': {
      break
    }
  }
}

//-------------------------------------------------------------------------------
// Generate stats for a period of weeks, and write as a CSV table in a note
export async function weeklyStats(): Promise<void> {
  // Get config settings from Template folder _configuration note
  await getPluginSettings()

  // Get time period
  // For now, this is simply all the current year so far
  // TODO: Decide what to do better: all time? All time up to N weeks?
  const todaysDate = new Date()
  const thisYear = todaysDate.getFullYear()
  const startWeek = 1
  const startYear = thisYear
  const endWeek = getWeek(todaysDate)
  const endYear = thisYear
  // const [fromDate, toDate, periodString, periodPartStr] = await getPeriodStartEndDates()  
  // const fromDateStr = unhyphenatedDate(fromDate) //fromDate.toISOString().slice(0, 10).replace(/-/g, '')
  // const toDateStr = unhyphenatedDate(toDate) // toDate.toISOString().slice(0, 10).replace(/-/g, '')
  console.log('')
  console.log(
    `weeklyStats: calculating for ${startYear} ${startWeek} - ${endYear} ${endWeek}`,
  )

  // For every week of interest ...
  // m1well: these arrays are empty and never changed again?
  let allHCounts = []
  let allHTotals = []
  const hOutputArray = []
  for (let i = startWeek; i <= endWeek; i++) {
    const [weekStartDate, weekEndDate] = weekStartEnd(i, thisYear)
    // Calc hashtags stats (returns two maps)
    const weekResults = calcHashtagStatsPeriod(unhyphenatedDate(weekStartDate), unhyphenatedDate(weekEndDate))
    const hCounts = weekResults?.[0]
    const hSumTotals = weekResults?.[1]
    if (hSumTotals == null || hCounts == null) {
      console.log('no hSumTotals value')
      return
    }
    // Add this week's results to larger list
    // TODO: fold next section in here
  }

  // First process more complex 'SumTotals', calculating appropriately
  // m1well: in this file a some errors - e.g. 'hSumTotals' and 'hCounts' is only defined in the for-loop ?
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
  const results = calcMentionStatsPeriod(fromDateStr, toDateStr)
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

  /** 
   * Write results out to note as a CSV ready to be charted using gnuplot
   * Format:
   * tag/mention name
   * YYYY-MM-DD,count,total,average
   * <2 blank lines>
   * <repeat>
   * ...
   */

  let note: TNote
  // first see if this note has already been created
  // (look only in active notes, not Archive or Trash)
  const existingNotes: $ReadOnlyArray<TNote> =
    DataStore.projectNoteByTitle(periodString, true, false) ?? []

  console.log(
    `\tfound ${existingNotes.length} existing summary notes for this period`,
  )

  if (existingNotes.length > 0) {
    note = existingNotes[0] // pick the first if more than one
    // console.log(`\tfilename of first matching note: ${displayTitle(note)}`)
  } else {
    // make a new note for this. NB: filename here = folder + filename
    const noteFilename = DataStore.newNote(periodString, pref_folderToStore) ?? ''
    if (!noteFilename) {
      console.log(`\tError creating new note (filename '${noteFilename}')`)
      await showMessage('There was an error creating the new note')
      return
    }
    console.log(`\tnewNote filename: ${noteFilename}`)
    // $FlowIgnore[incompatible-type]
    note = DataStore.projectNoteByFilename(noteFilename)
    if (note == null) {
      console.log(`\tError getting new note (filename '${noteFilename}')`)
      await showMessage('There was an error getting the new note ready to write')
      return
    }
    console.log(`\twriting results to the new note '${displayTitle(note)}'`)
  }

  // This is a bug in flow. Creating a temporary const is a workaround.
  // Do we have an existing Hashtag counts section? If so, delete it.
  let insertionLineIndex = removeSection(
    note,
    pref_hashtagCountsHeading,
  )
  console.log(`\tHashtag insertionLineIndex: ${String(insertionLineIndex)}`)
  // Set place to insert either after the found section heading, or at end of note
  // write in reverse order to avoid having to calculate insertion point again
  note.insertHeading(
    `${pref_hashtagCountsHeading} ${periodPartStr}`,
    insertionLineIndex,
    pref_headingLevel,
  )
  note.insertParagraph(
    hOutputArray.join('\n'),
    insertionLineIndex + 1,
    'text',
  )
  // note.insertHeading(countsHeading, insertionLineIndex, pref_headingLevel)

  // Do we have an existing Mentions counts section? If so, delete it.
  insertionLineIndex = removeSection(
    note,
    pref_mentionCountsHeading,
  )
  console.log(`\tMention insertionLineIndex: ${insertionLineIndex}`)
  note.insertHeading(
    `${pref_mentionCountsHeading} ${periodPartStr}`,
    insertionLineIndex,
    pref_headingLevel,
  )
  note.insertParagraph(
    mOutputArray.join('\n'),
    insertionLineIndex + 1,
    'text',
  )
  // open this note in the Editor
  Editor.openNoteByFilename(note.filename)

  console.log(`\twritten results to note '${periodString}'`)
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
  // } else {
  //   console.log(`  found ${periodDailyNotes.length} matching daily notes`)
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
