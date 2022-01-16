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
  calcHashtagStatsPeriod,
  calcMentionStatsPeriod,
  getConfigSettings,
  getPeriodStartEndDates,
  removeSection,
} from './summaryHelpers'
import type { SummariesConfig } from './summaryHelpers'
import {
  getWeek,
  hyphenatedDateString,
  monthNameAbbrev,
  todaysDateISOString,
  toISOShortDateTimeString,
  unhyphenatedDate,
  weekStartEnd,
} from '../../helpers/dateTime'
import {
  quarterStartEnd,
} from '../../helpers/NPdateTime'
import { JSP } from '../../helpers/dev'
import {
  displayTitle,
  stringReplace,
} from '../../helpers/general'
import {
  clearNote,
  getOrMakeNote
} from '../../helpers/note'
import { logAllEnvironmentSettings } from '../../helpers/NPdev'
import {
  chooseOption,
  getInput,
  showMessage,
} from '../../helpers/userInput'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//-------------------------------------------------------------------------------

/**
 * Ask user which period to cover, call main stats function accordingly, and present results
 * @author @jgclark
*/
export async function statsPeriod(): Promise<void> {
  // console.log(`Contents of NotePlan.environment...:`)
  console.log(JSP(NotePlan.environment))
  // logAllEnvironmentSettings()

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
  // $FlowIgnore[invalid-tuple-arity]
  let results = await calcHashtagStatsPeriod(fromDateStr, toDateStr, config.includeHashtags, config.excludeHashtags)
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
  // $FlowIgnore[invalid-tuple-arity]
  results = await calcMentionStatsPeriod(fromDateStr, toDateStr, config.includeMentions, config.excludeMentions)
  const mCounts = results?.[0]
  const mSumTotals = results?.[1]
  if (mCounts == null || mSumTotals == null) {
    return
  }

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
