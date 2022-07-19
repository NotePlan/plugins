// @flow
//-----------------------------------------------------------------------------
// Create statistics for hasthtags and mentions for time periods
// Jonathan Clark, @jgclark
// Last updated 30.6.2022 for v0.9.1+
//-----------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Helper functions

import pluginJson from '../plugin.json'
import { calcHashtagStatsPeriod, calcMentionStatsPeriod, getSummariesSettings } from './summaryHelpers'
import { getWeek, unhyphenatedDate } from '@helpers/dateTime'
import { getPeriodStartEndDates } from '@helpers/NPDateTime'
import { log, logError } from '@helpers/dev'
import { CaseInsensitiveMap, displayTitle } from '@helpers/general'
import { getOrMakeNote, printNote, replaceSection } from '@helpers/note'
// import { logAllEnvironmentSettings } from '@helpers/NPDev'
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

  // Get config settings
  const config = await getSummariesSettings()

  // Get time period
  const [fromDate, toDate, periodType, periodString, periodPartStr] = await getPeriodStartEndDates()
  if (fromDate == null || toDate == null) {
    log(pluginJson, 'statsPeriod: error in calculating dates for chosen time period')
    return
  }
  const fromDateStr = unhyphenatedDate(fromDate)
  const toDateStr = unhyphenatedDate(toDate)
  log(pluginJson, `statsPeriod: calculating for ${periodString} (${fromDateStr} - ${toDateStr}):`)

  // Calc hashtags stats (returns two maps)
  const hOutputArray = []
  let results = await calcHashtagStatsPeriod(fromDateStr, toDateStr, config.includeHashtags, config.excludeHashtags)
  const hCounts: CaseInsensitiveMap<number> = results?.[0] ?? new CaseInsensitiveMap<number>()
  const hSumTotals: CaseInsensitiveMap<number> = results?.[1] ?? new CaseInsensitiveMap<number>()
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
  const mCounts: CaseInsensitiveMap<number> = results?.[0] ?? new CaseInsensitiveMap<number>()
  const mSumTotals: CaseInsensitiveMap<number> = results?.[1] ?? new CaseInsensitiveMap<number>()
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
  const outputOptions = [
    { label: `🖊 Create/update a note in folder '${config.folderToStore}'`, value: 'note' },
    { label: '🖊 Append to your current note', value: 'current' },
    { label: '📋 Write to plugin console log', value: 'log' },
    { label: '❌ Cancel', value: 'cancel' },
  ]
  switch (periodType) {
    case 'userwtd': {
      outputOptions.unshift({ label: `📅 Add/Update your current Weekly note`, value: 'weekly' })
      break
    }
    // TODO: When monthly notes are made possible in NP, add this option
    // case 'mtd': {
    //   outputOptions.unshift({ label: `📅 Add/Update your Monthly note`, value: 'monthly' })
    //   break
    // }
  }
  const destination = await chooseOption(`Where to save the summary for ${periodString}?`, outputOptions, 'note')

  // Ask where to send the results
  switch (destination) {
    case 'current': {
      const currentNote = Editor.note
      if (currentNote == null) {
        logError(pluginJson, `No note is open. Stopping.`)
      } else {
        log(pluginJson, `appending results to current note (${currentNote.filename ?? ''})`)
        currentNote.appendParagraph(`${config.hashtagCountsHeading} for ${periodString} at ${periodPartStr}`, 'text')
        currentNote.appendParagraph(hOutputArray.join('\n'), 'text')
        currentNote.appendParagraph(`${config.mentionCountsHeading} for ${periodString} at ${periodPartStr}`, 'empty')
        currentNote.appendParagraph(mOutputArray.join('\n'), 'text')
        log(pluginJson, `appended results to current note`)
      }
      break
    }

    case 'note': {
      // Summaries note
      const note = await getOrMakeNote(periodString, config.folderToStore)
      if (note == null) {
        logError(pluginJson, `Cannot get new note`)
        await showMessage('There was an error getting the new note ready to write')
        return
      }

      // Replace or add Hashtag counts section
      replaceSection(note, config.hashtagCountsHeading, `${config.hashtagCountsHeading} ${periodPartStr}`, config.headingLevel, hOutputArray.join('\n'))

      // Replace or add Mentions counts section
      replaceSection(note, config.mentionCountsHeading, `${config.mentionCountsHeading} ${periodPartStr}`, config.headingLevel, mOutputArray.join('\n'))
      // open this note in the Editor
      Editor.openNoteByFilename(note.filename)

      log(pluginJson, `Written results to note '${periodString}'`)
      break
    }

    case 'weekly': {
      // Weekly note (from v3.6)
      const todaysDate = new Date()
      const y = todaysDate.getFullYear()
      const w = getWeek(todaysDate)

      log(pluginJson, `Opening weekly note for ${y} / ${w}`)
      await Editor.openWeeklyNote(y, w)
      const { note } = Editor
      if (note == null) {
        logError(pluginJson, `cannot get Weekly note`)
        await showMessage('There was an error getting the Weekly ready to write')
        return
      }
      printNote(note)

      // Replace or add Hashtag counts section
      replaceSection(note, config.hashtagCountsHeading, `${config.hashtagCountsHeading} ${periodPartStr}`, config.headingLevel, hOutputArray.join('\n'))
      // Replace or add Mentions counts section
      replaceSection(note, config.mentionCountsHeading, `${config.mentionCountsHeading} ${periodPartStr}`, config.headingLevel, mOutputArray.join('\n'))

      // open this note in the Editor
      // Editor.openNoteByFilename(note.filename)
      log(pluginJson, `Written results to note '${displayTitle(note)}'`)
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
