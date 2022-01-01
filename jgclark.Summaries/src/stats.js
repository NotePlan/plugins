// @flow
//-----------------------------------------------------------------------------
// Create statistics for hasthtags and mentions for time periods
// Jonathan Clark, @jgclark
// Last updated for v0.3.0, 29.12.2021
//-----------------------------------------------------------------------------

// TODO:
// - When weekly/monthly notes are made possible in NP, then output changes there as well

//-----------------------------------------------------------------------------
// Helper functions

import {
  // DEFAULT_SUMMARIES_CONFIG,
  getConfigSettings,
  getPeriodStartEndDates,
  removeSection,
} from './summaryHelpers'
import type { SummariesConfig } from './summaryHelpers'
import {
  dateStringFromCalendarFilename,
  getWeek,
  hyphenatedDateString,
  monthNameAbbrev,
  quarterStartEnd,
  todaysDateISOString,
  toISOShortDateTimeString,
  unhyphenatedDate,
  weekStartEnd,
  withinDateRange,
} from '../../helpers/dateTime'
import {
  displayTitle,
  stringReplace,
} from '../../helpers/general'
import {
  clearNote,
  getOrMakeNote
} from '../../helpers/note'
import {
  chooseOption,
  getInput,
  showMessage,
} from '../../helpers/userInput'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//-----------------------------------------------------------------------------
// Config settings
// Globals, to be looked up later
// let pref_folderToStore: string
// let pref_headingLevel: 1 | 2 | 3 | 4 | 5
// let pref_hashtagCountsHeading: string
// let pref_mentionCountsHeading: string
// let pref_showAsHashtagOrMention: boolean = false
// let pref_includeHashtags: $ReadOnlyArray<string> = []
// let pref_excludeHashtags: $ReadOnlyArray<string> = []
// let pref_includeMentions: $ReadOnlyArray<string> = []
// let pref_excludeMentions: $ReadOnlyArray<string> = []
// let pref_weeklyStatsDuration: ?number

// export async function getPluginSettings(): Promise<void> {
//   // Get config settings from Template folder _configuration note
//   const summConfig = await getOrMakeConfigurationSection(
//     'summaries',
//     DEFAULT_SUMMARIES_CONFIG,
//     // no minimum config required, as all defaults are given below
//   )
//   if (summConfig == null) {
//     console.log("\tCouldn't find 'summaries' settings in _configuration note.")
//     return
//   }

//   console.log("\tFound 'summaries' settings in _configuration note.")
//   // now get each setting
//   pref_folderToStore =
//     summConfig.folderToStore != null
//       // $FlowIgnore[incompatible-type]
//       ? summConfig.folderToStore
//       : 'Summaries'
//   // console.log(pref_folderToStore)
//   pref_hashtagCountsHeading =
//     summConfig.hashtagCountsHeading != null
//       // $FlowIgnore[incompatible-type]
//       ? summConfig.hashtagCountsHeading
//       : '#hashtag counts'
//   // console.log(pref_hashtagCountsHeading)
//   pref_mentionCountsHeading =
//     summConfig.mentionCountsHeading != null
//       // $FlowIgnore[incompatible-type]
//       ? summConfig.mentionCountsHeading
//       : '@mention counts'
//   // console.log(pref_mentionCountsHeading)
//   pref_headingLevel =
//     summConfig.headingLevel != null
//       // $FlowIgnore[incompatible-type]
//       ? summConfig.headingLevel
//       : 2
//   // console.log(pref_headingLevel)
//   pref_showAsHashtagOrMention =
//     summConfig.showAsHashtagOrMention != null
//       // $FlowIgnore[incompatible-type]
//       ? summConfig.showAsHashtagOrMention
//       : true
//   // console.log(pref_showAsHashtagOrMention)
//   pref_includeHashtags =
//     summConfig.includeHashtags != null
//       // $FlowIgnore[incompatible-type]
//       ? summConfig.includeHashtags
//       : [] // this takes precedence over any excludes ...
//   // console.log(pref_includeHashtags)
//   pref_excludeHashtags =
//     summConfig.excludeHashtags != null
//       // $FlowIgnore[incompatible-type]
//       ? summConfig.excludeHashtags
//       : []
//   // console.log(pref_excludeHashtags)
//   pref_includeMentions =
//     summConfig.includeMentions != null
//       // $FlowIgnore[incompatible-type]
//       ? summConfig.includeMentions
//       : [] // this takes precedence over any excludes ...
//   // console.log(pref_includeMentions)
//   pref_excludeMentions =
//     summConfig.excludeMentions != null
//       // $FlowIgnore[incompatible-type]
//       ? summConfig.excludeMentions
//       : ['@done', '@repeat']
//   // console.log(pref_excludeMentions)
//   pref_weeklyStatsDuration =
//     summConfig.weeklyStatsDuration != null
//       // $FlowIgnore[incompatible-type]
//       ? summConfig.weeklyStatsDuration
//       : undefined // don't set a default
//   // console.log(pref_weeklyStatsDuration)
// }

//-------------------------------------------------------------------------------
// Ask user which period to cover, call main stats function, and present results
export async function statsPeriod(): Promise<void> {
  // Get config settings from Template folder _configuration note
  let config = await getConfigSettings()

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
  let results = await calcHashtagStatsPeriod(fromDateStr, toDateStr)
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
    const hashtagString = config.showAsHashtagOrMention ? key : key.slice(1)
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
    const hashtagString = config.showAsHashtagOrMention ? key : key.slice(1)
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
  results = await calcMentionStatsPeriod(fromDateStr, toDateStr)
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
    const mentionString = config.showAsHashtagOrMention ? key : key.slice(1)
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
    const mentionString = config.showAsHashtagOrMention ? key : key.slice(1)
    mOutputArray.push(`${mentionString}\t${value}`)
  }
  // If there's nothing to report, let's make that clear, otherwise sort output
  if (mOutputArray.length > 0) {
    mOutputArray.sort()
  } else {
    mOutputArray.push('(none)')
  }

  // Ask where to save this summary to
  const labelString = `🖊 Create/update a note in folder '${config.folderToStore}'`
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
            config.hashtagCountsHeading,
          )} for ${periodString} ${periodPartStr}`,
          'text',
        )
        currentNote.appendParagraph(hOutputArray.join('\n'), 'text')
        currentNote.appendParagraph(
          `${String(
            config.mentionCountsHeading,
          )} for ${periodString} ${periodPartStr}`,
          'empty',
        )
        currentNote.appendParagraph(mOutputArray.join('\n'), 'text')
        console.log(`\tappended results to current note`)
      }
      break
    }
    case 'note': {
      const note = await getOrMakeNote(periodString, config.folderToStore)
      if (note == null) {
        console.log(`\tError getting new note`)
        await showMessage('There was an error getting the new note ready to write')
        return
      }

      // Do we have an existing Hashtag counts section? If so, delete it.
      let insertionLineIndex = removeSection(
        note,
        config.hashtagCountsHeading,
      )
      console.log(`\tHashtag insertionLineIndex: ${String(insertionLineIndex)}`)
      // Set place to insert either after the found section heading, or at end of note
      // write in reverse order to avoid having to calculate insertion point again
      note.insertHeading(
        `${config.hashtagCountsHeading} ${periodPartStr}`,
        insertionLineIndex,
        config.headingLevel,
      )
      note.insertParagraph(
        hOutputArray.join('\n'),
        insertionLineIndex + 1,
        'text',
      )

      // Do we have an existing Mentions counts section? If so, delete it.
      insertionLineIndex = removeSection(
        note,
        config.mentionCountsHeading,
      )
      console.log(`\tMention insertionLineIndex: ${insertionLineIndex}`)
      note.insertHeading(
        `${config.mentionCountsHeading} ${periodPartStr}`,
        insertionLineIndex,
        config.headingLevel,
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
        `${config.hashtagCountsHeading} for ${periodString} ${periodPartStr}`,
      )
      console.log(hOutputArray.join('\n'))
      console.log(
        `${config.mentionCountsHeading} for ${periodString} ${periodPartStr}`,
      )
      console.log(mOutputArray.join('\n'))
      break
    }

    case 'cancel': {
      break
    }
  }
}

/** -------------------------------------------------------------------------------
 * Calculate hashtag statistics for daily notes of a given time period
 * - Map of { tag, count } for all tags included or not excluded
 * - Map of { tag, total } for the subset of all tags above that finish with a /number
 * @author @jgclark
 * 
 * @param {string} fromDateStr - YYYYMMDD string of start date
 * @param {string} toDateStr - YYYYMMDD string of start date
 * @return {[Map, Map]}
*/
export async function calcHashtagStatsPeriod(
  fromDateStr: string,
  toDateStr: string,
): Promise<?[Map<string, number>, Map<string, number>]> {
  let config = await getConfigSettings()

  // Get all daily notes that are within this time period
  const periodDailyNotes = DataStore.calendarNotes.filter((p) =>
    withinDateRange( dateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr )
  )

  if (periodDailyNotes.length === 0) {
    console.log(`  warning: no matching daily notes found between ${fromDateStr} and ${toDateStr}`)
    return
  }

  // work out what set of mentions to look for (or ignore)
  const hashtagsToLookFor = config.includeHashtags.length > 0 ? config.includeHashtags : []
  const hashtagsToIgnore = config.excludeHashtags.length > 0 ? config.excludeHashtags : []

  // For each matching date, find and store the tags in Map
  const tagCounts = new Map<string, number>() // key: tagname; value: count
  // Also define map to count and total hashtags with a final /number part.
  const tagSumTotals = new Map<string, number>() // key: tagname (except last part); value: total
  for (const n of periodDailyNotes) {
    // TODO(EduardMet): fix API bug
    // The following is a workaround to an API bug in note.hashtags where
    // #one/two/three gets reported as #one, #one/two, and #one/two/three.
    // Go backwards through the hashtag array, and then check 
    const seenTags = n.hashtags.slice().reverse()
    let lastTag = ''

    for (const t of seenTags) {
      if (lastTag.startsWith(t)) {
        // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
        continue
      }
      // check this is on inclusion, or not on exclusion list, before adding
      if (
        hashtagsToLookFor.length > 0 &&
        hashtagsToLookFor.filter((a) => t.startsWith(a)).length === 0
      ) {
        // console.log(`\tIgnoring '${t}' as not on inclusion list`)
      } else if (hashtagsToIgnore.filter((a) => t.startsWith(a)).length > 0) {
        // console.log(`\tIgnoring '${t}' as on exclusion list`)
      } else {
        // if this is tag that finishes '/number', then sum the numbers as well as count
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
      lastTag = t
    }
  }

  return [tagCounts, tagSumTotals]
}

/** -------------------------------------------------------------------------------
 * Calculate mention statistics for daily notes of a given time period.
 * If an 'include' list is set, only include things from that list.
 * If not, include all, except those on an 'exclude' list (if set).

 * @param {string} fromDateStr - YYYYMMDD string of start date
 * @param {string} toDateStr - YYYYMMDD string of start date
 * @return {Map, Map} maps of {tag, count}
*/
export async function calcMentionStatsPeriod(
  fromDateStr: string,
  toDateStr: string,
): Promise<?[Map<string, number>, Map<string, number>]> {
  let config = await getConfigSettings()

  // Get all daily notes that are within this time period
  const periodDailyNotes = DataStore.calendarNotes.filter((p) =>
    withinDateRange( dateStringFromCalendarFilename(p.filename), fromDateStr, toDateStr )
  )

  if (periodDailyNotes.length === 0) {
    console.log('  warning: no matching daily notes found')
    return
  }

  // work out what set of mentions to look for (or ignore)
  const mentionsToLookFor = config.includeMentions.length > 0 ? config.includeMentions : []
  const mentionsToIgnore = config.excludeMentions.length > 0 ? config.excludeMentions : []

  // TODO: Work out whether we want to know about zero totals, occurrences, and/or no valid data
  // Yes: @run, @work, 
  // No: @fruitveg

  // For each matching date, find and store the mentions in Map
  const mentionCounts = new Map<string, number>() // key: tagname; value: count
  // Also define map to count and total hashtags with a final /number part.
  const mentionSumTotals = new Map<string, number>() // key: mention name (except last part); value: total

  for (const n of periodDailyNotes) {
    // TODO(EduardMet): fix API bug
    // The following is a workaround to an API bug in note.mentions where
    // #one/two/three gets reported as #one, #one/two, and #one/two/three.
    // Go backwards through the mention array, and then check 
    const seenMentions = n.mentions.slice().reverse()
    let lastMention = ''

    for (const m of seenMentions) {
      if (lastMention.startsWith(m)) {
        // if this tag is starting subset of the last one, assume this is an example of the bug, so skip this tag
        continue
      }
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
      lastMention = m
    }
  }

  return [mentionCounts, mentionSumTotals]
}
