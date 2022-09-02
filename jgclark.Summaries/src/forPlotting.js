// @flow
//-----------------------------------------------------------------------------
// Create weekly stats for a number of weeks, and format ready to use by gnuplot
// Jonathan Clark, @jgclark
// Last updated 2.9.2022 for v0.13.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { calcHashtagStatsPeriod, calcMentionStatsPeriod, getSummariesSettings } from './summaryHelpers'
import type { SummariesConfig } from './summaryHelpers'
import { calcWeekOffset, getWeek, hyphenatedDateString, unhyphenatedDate, weekStartEnd } from '@helpers/dateTime'
import { logError, logDebug, logInfo, logWarn } from '@helpers/dev'
import { clearNote, getOrMakeNote } from '@helpers/note'
import { chooseOption, getInput, showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------

/**
 * Transform CSV format into a CSV ready to be charted using gnuplot
 *
 * Input Format:
 *   tag/mention name,YYYY-MM-DD,count[,total][,average]
 *
 * Output Format:
 *   tag/mention name
 *   YYYY-MM-DD,count,total,average
 *   <2 blank lines>
 *   <repeat>
 *
 * TODO: also add single blank line to notate missing data point(s)
 * @author @jgclark
 *
 * @param {[string]} inArray - array of CSV strings
 * @return {[string]} - output array ready for gnuplot
 */
function formatForGnuplot(inArray): Array<string> {
  const outArray = []
  let lastKey = ''
  let thisKey = ''
  let firstKey = true
  for (const line of inArray) {
    const lineParts = line.split(',')
    thisKey = lineParts[0].replace('@', '\\\\@') // in gnuplot '@' is a special character that needs to be double-escaped
    const CSV = lineParts.slice(1).join(',') // all the other items, rejoined with commas
    if (thisKey !== lastKey) {
      if (!firstKey) {
        // if not the first time, write out two blank lines that mark a new 'index' dataset to gnuplot
        outArray.push('')
        outArray.push('')
      } else {
        firstKey = false
      }
      outArray.push(thisKey)
    }
    outArray.push(CSV)
    lastKey = thisKey
  }
  return outArray
}

/**
 * Generate stats for the specified mentions and hashtags over a period of consecutive
 * weeks, and write as a CSV table, ready for charting by gnuplot.
 * Only the specifically 'included' hashtags or mentions are included, as given by those settings.
 * @author @jgclark
 */
export async function weeklyStats(): Promise<void> {
  let config = await getSummariesSettings()

  let period: number
  let startWeek: number
  let startYear: number
  let endWeek: number
  let endYear: number
  const todaysDate = new Date()
  const thisWeek = getWeek(todaysDate)
  let thisYear = todaysDate.getFullYear()

  // If preference for weekly stats duration is not given,
  // ask user what time interval to do tag counts for
  if (config.weeklyStatsDuration === undefined) {
    period = await chooseOption<number>(
      'Select which time period to cover',
      [
        {
          label: 'This week so far',
          value: 0,
        },
        {
          label: 'Last Week to now',
          value: 1,
        },
        {
          label: 'Last Month',
          value: 4,
        },
        {
          label: 'Last 3 Months',
          value: 13,
        },
        {
          label: 'Last 6 Months',
          value: 26,
        },
        {
          label: 'Last 12 Months',
          value: 52,
        },
        {
          label: 'Other Interval',
          value: NaN,
        },
      ],
      52,
    )
  } else {
    // but use pref if given
    period = config.weeklyStatsDuration ?? 23 // should never need this fallback
  }
  endYear = thisYear
  if (period === NaN) {
    // Ask for more detailed week range, and calculate start/end dates
    startYear = Number(await getInput('Choose starting year, e.g. 2021', 'OK'))
    startWeek = Number(await getInput('Choose starting week number, 1-53', 'OK'))
    endYear = Number(await getInput('Choose ending year, e.g. 2021', 'OK'))
    endWeek = Number(await getInput('Choose ending week number, 1-53', 'OK'))
    period = (endYear - startYear) * 52 + (endWeek - startWeek) // in weeks
  } else {
    // Calculate week range from answer, asking for date offset _before_ current week
    const currentWeekNum = getWeek(todaysDate)
    // First deal with edge case: after start of ordinal year but before first week starts
    if (
      currentWeekNum === 52 && // i.e. last week of the year AND
      todaysDate.getMonth() == 0
    ) {
      // i.e. first month of the year (counting from 0)
      thisYear -= 1
    }
    let answer = calcWeekOffset(thisWeek, thisYear, Number(-period))
    startYear = answer.year
    startWeek = answer.week
    endYear = thisYear
    endWeek = thisWeek
  }
  const periodString = `${startYear}W${startWeek} - ${endYear}W${endWeek}`
  logInfo(pluginJson, `weeklyStats: calculating for ${periodString} (${period} weeks)`)

  // Pop up UI wait dialog as this can be a long-running process
  CommandBar.showLoading(true, `Calculating weekly stats over ${period} weeks`)
  await CommandBar.onAsyncThread()

  const hResultsArray = []
  const mResultsArray = []

  // For every week of interest calculate stats and add to the two output arrays
  let w = startWeek
  let y = startYear
  let counter = 0
  while (counter < period) {
    // increment which week/year we're looking at, and get the actual dates to use
    let answer = calcWeekOffset(w, y, +1)
    w = answer.week
    y = answer.year
    counter++
    logDebug(pluginJson, `${counter}: w ${w} y ${y}`)
    const [weekStartDate, weekEndDate] = weekStartEnd(w, y)

    // Calc hashtags stats (returns two maps)
    let weekResults = await calcHashtagStatsPeriod(unhyphenatedDate(weekStartDate), unhyphenatedDate(weekEndDate), config.includeHashtags, [])
    const hCounts = weekResults?.[0]
    const hSumTotals = weekResults?.[1]
    if (hSumTotals == null || hCounts == null) {
      logWarn(pluginJson, 'no hSumTotals / hCounts values')
      continue
    }

    // First process more complex 'SumTotals', calculating appropriately
    for (const [key, value] of hSumTotals) {
      // .entries() implied
      const hashtagString = key
      const count = hCounts.get(key)
      if (count != null) {
        const total: string = value.toFixed(0)
        const average: string = (value / count).toFixed(1)
        hResultsArray.push(`${hashtagString},${hyphenatedDateString(weekStartDate)},${average},${count},${total}`)
        hCounts.delete(key) // remove the entry from the next map, as not longer needed
      }
    }
    // Then process simpler 'Counts'
    for (const [key, value] of hCounts) {
      // .entries() implied
      const hashtagString = key
      hResultsArray.push(`${hashtagString},${hyphenatedDateString(weekStartDate)},${value}`)
    }

    // Calc mentions stats (returns two maps)
    weekResults = await calcMentionStatsPeriod(
      unhyphenatedDate(weekStartDate),
      unhyphenatedDate(weekEndDate),
      // $FlowIgnore[invalid-tuple-arity]
      config.includeMentions,
      [],
    )
    const mCounts = weekResults?.[0]
    const mSumTotals = weekResults?.[1]
    if (mCounts == null || mSumTotals == null) {
      continue
    }

    // First process more complex 'SumTotals', calculating appropriately
    for (const [key, value] of mSumTotals) {
      // .entries() implied
      const mentionString = key
      const count = mCounts.get(key)
      if (count != null) {
        const total = value.toFixed(0)
        const average = (value / count).toFixed(1)
        mResultsArray.push(`${mentionString},${hyphenatedDateString(weekStartDate)},${average},${count},${total}`)
        mCounts.delete(key) // remove the entry from the next map, as not longer needed
      }
    }
    // Then process simpler 'Counts'
    for (const [key, value] of mCounts) {
      const mentionString = key
      mResultsArray.push(`${mentionString},${hyphenatedDateString(weekStartDate)},${value}`)
    }

    // Update UI wait dialog
    CommandBar.showLoading(true, `Calculating weekly stats over ${period} weeks`, counter / period)
  }
  await CommandBar.onMainThread()
  CommandBar.showLoading(false)

  let hOutputArray = []
  // If there are no Hashtags results, log warning, otherwise process ready for output
  if (hResultsArray.length > 0) {
    hResultsArray.sort()
    // Now go through this array tweaking output to suit gnuplot
    hOutputArray = formatForGnuplot(hResultsArray)
  } else {
    logInfo(pluginJson, `no Hashtags found in weekly summaries`)
  }

  let mOutputArray = []
  // If there are no Mentions results, log warning, otherwise process ready for output
  if (mResultsArray.length > 0) {
    mResultsArray.sort()
    // Now go through this array tweaking output to suit gnuplot
    mOutputArray = formatForGnuplot(mResultsArray)
  } else {
    logInfo(pluginJson, `no Mentions found in weekly summaries`)
  }

  // Get note to write out to
  const thisTitle = `Weekly stats ${periodString}`
  const noteTitle = 'weekly_stats'
  const note = await getOrMakeNote(noteTitle, config.folderToStore)
  if (note == null) {
    logError(pluginJson, `Can't get new note`)
    await showMessage('There was an error getting the new note ready to write')
    return
  }

  // Unlike other Summary-type commands, just empty any previous note contents
  clearNote(note)
  const insertionLineIndex = 1
  note.insertParagraph(mOutputArray.join('\n'), 1, 'text')

  // open this note in the Editor
  Editor.openNoteByFilename(note.filename)

  logInfo(pluginJson, `  written results to note '${noteTitle}'`)
}
