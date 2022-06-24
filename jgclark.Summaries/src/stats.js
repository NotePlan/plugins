// @flow
//-----------------------------------------------------------------------------
// Create statistics for hasthtags and mentions for time periods
// Jonathan Clark, @jgclark
// Last updated 21.6.2022 for v0.9.0
//-----------------------------------------------------------------------------

// TODO:
// - When weekly/monthly notes are made possible in NP, then output changes there as well

//-----------------------------------------------------------------------------
// Helper functions

import pluginJson from '../plugin.json'
import {
  calcHashtagStatsPeriod,
  calcMentionStatsPeriod,
  getSummariesSettings,
  getPeriodStartEndDates,
  // type SummariesConfig,
} from './summaryHelpers'
import {
  // getWeek,
  // hyphenatedDateString,
  // monthNameAbbrev,
  unhyphenatedDate,
  // weekStartEnd,
} from '@helpers/dateTime'
import { log, logError } from '@helpers/dev'
import { CaseInsensitiveMap } from '@helpers/general'
import {
  // clearNote,
  getOrMakeNote
} from '@helpers/note'
import { removeSection } from '@helpers/paragraph'
// import { logAllEnvironmentSettings } from '@helpers/NPdev'
import { caseInsensitiveCompare } from '@helpers/sorting'
import {
  chooseOption,
  // getInput,
  showMessage,
} from '@helpers/userInput'

//-------------------------------------------------------------------------------

/**
 * Ask user which period to cover, call main stats function accordingly, and present results
 * @author @jgclark
*/
export async function statsPeriod(): Promise<void> {
  // log(pluginJson, `Contents of NotePlan.environment...:`)
  // logAllEnvironmentSettings()

  // Get config settings from Template folder _configuration note
  const config = await getSummariesSettings()

  // Get time period
  const [fromDate, toDate, periodString, periodPartStr] = await getPeriodStartEndDates()  
  if (fromDate == null || toDate == null) {
    log(pluginJson, 'statsPeriod: error in calculating dates for chosen time period')
    return
  }
  const fromDateStr = unhyphenatedDate(fromDate) //fromDate.toISOString().slice(0, 10).replace(/-/g, '')
  const toDateStr = unhyphenatedDate(toDate) // toDate.toISOString().slice(0, 10).replace(/-/g, '')
  log(pluginJson, `statsPeriod: calculating for ${periodString} (${fromDateStr} - ${toDateStr}):`)

  // Calc hashtags stats (returns two maps)
  const hOutputArray = []
  let results = await calcHashtagStatsPeriod(fromDateStr, toDateStr, config.includeHashtags, config.excludeHashtags)
  const hCounts: CaseInsensitiveMap<number> = results?.[0] ?? new CaseInsensitiveMap < number >
  const hSumTotals: CaseInsensitiveMap<number> = results?.[1] ?? new CaseInsensitiveMap < number >
  if (hSumTotals == null || hCounts == null) {
    log(pluginJson, `no matching hashtags found in ${periodString}`)
    return
  }

  // First process more complex 'SumTotals', calculating appropriately
  for (const [key, value] of hSumTotals.entries()) {
    const hashtagString = config.showAsHashtagOrMention ? key : key.slice(1)
    const count = hSumTotals.get(key) ?? NaN
    if (isNaN(count)) {
      // console.log(`  no totals for ${key}`)
    } else {
      const count = hCounts.get(key) ?? NaN
      const totalStr: string = value.toLocaleString()
      const avgStr: string = (value / count).toLocaleString([], { maximumSignificantDigits: 2 })
      hOutputArray.push(`${hashtagString}\t${count}\t(total ${totalStr}\taverage ${avgStr})`)
      hCounts.delete(key) // remove the entry from the next map, as no longer needed
    }
  }
  // Then process simpler 'Counts'
  for (const [key, value] of hCounts.entries()) {
    const hashtagString = config.showAsHashtagOrMention ? key : key.slice(1)
    hOutputArray.push(`${hashtagString}\t${value}`)
  }
  // If there's nothing to report, let's make that clear, otherwise sort output
  if (hOutputArray.length > 0) {
    hOutputArray.sort(caseInsensitiveCompare)
  } else {
    hOutputArray.push('(none)')
  }

  // --------------------------------------------------------------------------
  // Calc mentions stats (returns two maps)
  const mOutputArray = []
  results = await calcMentionStatsPeriod(fromDateStr, toDateStr, config.includeMentions, config.excludeMentions)
  const mCounts: CaseInsensitiveMap<number> = results?.[0] ?? new CaseInsensitiveMap < number >
  const mSumTotals: CaseInsensitiveMap<number> = results?.[1] ?? new CaseInsensitiveMap < number >
  if (mCounts == null || mSumTotals == null) {
    log(pluginJson, `no matching mentions found in ${periodString}`)
    return
  }

  // First process more complex 'SumTotals', calculating appropriately
  for (const [key, value] of mSumTotals.entries()) {
    const mentionString = config.showAsHashtagOrMention ? key : key.slice(1)
    const total = mSumTotals.get(key) ?? NaN
    if (isNaN(total)) {
      // console.log(`  no totals for ${key}`)
    } else {
      const count = mCounts.get(key) ?? NaN
      const totalStr: string = value.toLocaleString()
      const avgStr: string = (value / count).toLocaleString([], { maximumSignificantDigits: 2 })
      mOutputArray.push(`${mentionString}\t${count}\t(total ${totalStr}\taverage ${avgStr})`)
      mCounts.delete(key) // remove the entry from the next map, as not longer needed
    }
  }
  // Then process simpler 'Counts'
  for (const [key, value] of mCounts.entries()) {
    const mentionString = config.showAsHashtagOrMention ? key : key.slice(1)
    mOutputArray.push(`${mentionString}\t${value}`)
  }
  // If there's nothing to report, let's make that clear, otherwise sort output
  if (mOutputArray.length > 0) {
    mOutputArray.sort(caseInsensitiveCompare)
  } else {
    mOutputArray.push('(none)')
  }

  // --------------------------------------------------------------------------
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
        logError(pluginJson, `no note is open`)
      } else {
        log(pluginJson, `appending results to current note (${currentNote.filename ?? ''})`)
        currentNote.appendParagraph(
          `${config.hashtagCountsHeading} for ${periodString} at ${periodPartStr}`,
          'text',
        )
        currentNote.appendParagraph(hOutputArray.join('\n'), 'text')
        currentNote.appendParagraph(
          `${config.mentionCountsHeading} for ${periodString} at ${periodPartStr}`,
          'empty',
        )
        currentNote.appendParagraph(mOutputArray.join('\n'), 'text')
        log(pluginJson, `appended results to current note`)
      }
      break
    }
    case 'note': {
      const note = await getOrMakeNote(periodString, config.folderToStore)
      if (note == null) {
        logError(pluginJson, `cannot get new note`)
        await showMessage('There was an error getting the new note ready to write')
        return
      }

      // Do we have an existing Hashtag counts section? If so, delete it.
      let insertionLineIndex = removeSection(
        note,
        config.hashtagCountsHeading,
      )
      // log(pluginJson, `  Hashtag insertionLineIndex: ${String(insertionLineIndex)}`)
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
      // log(pluginJson, `  Mention insertionLineIndex: ${insertionLineIndex}`)
      // Set place to insert either after the found section heading, or at end of note
      // write in reverse order to avoid having to calculate insertion point again
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

      log(pluginJson, `Written results to note '${periodString}'`)
      break
    }

    case 'log': {
      log(pluginJson, `${config.hashtagCountsHeading} for ${periodString} at ${periodPartStr}`)
      log(pluginJson, hOutputArray.join('\n'))
      log(pluginJson, `${config.mentionCountsHeading} for ${periodString} at ${periodPartStr}`)
      log(pluginJson, mOutputArray.join('\n'))
      break
    }

    case 'cancel': {
      break
    }
  }
}
