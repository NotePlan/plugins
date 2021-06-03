// @flow

//-----------------------------------------------------------------------------
// User settings: TODO: move to proper preferences system, when available in NP
const pref_folderToStore = 'Summaries'

//-----------------------------------------------------------------------------
// Helper functions
import type { Option } from './statsHelpers'

import {
  chooseOption,
  monthsAbbrev,
  todaysDateISOString,
  getYearMonthDate,
  monthNameAbbrev,
  withinDateRange,
  dateStringFromCalendarFilename,
  unhyphenateDateString,
  hyphenatedDateString,
  filenameDateString,
} from './statsHelpers'


// const todaysDateISOString = new Date().toISOString().slice(0, 10)

//-------------------------------------------------------------------------------
// Ask user which period to cover, call main stats function, and present results
export default async function tagStats() {

  const todaysDate = new Date()
  // couldn't get const { y, m, d } = getYearMonthDate(todaysDate) to work ??
  const y = todaysDate.getFullYear();
  const m = todaysDate.getMonth() + 1;
  const d = todaysDate.getDate();

  // Ask user what time interval to do tag counts for
  const period = await chooseOption("Which date interval would you like me to count hashtags for?", [{
    label: "Last Month",
    value: "lm"
  }, {
    label: "This Month (to date)",
    value: "mtd"
  }, {
    label: "Last Quarter",
    value: "lq"
  }, {
    label: "This Quarter (to date)",
    value: "qtd"
  }, {
    label: "Last Year",
    value: "ly"
  }, {
    label: "Year to date",
    value: "ytd"
    }
  ], "mtd")

  let fromDate
  let toDate
  let periodString = ""

  switch (period) {
    case "lm": {
      fromDate = Calendar.dateFrom(y,m,1,0,0,0) // go to start of this month
      fromDate = Calendar.addUnitToDate(fromDate, "month", -1) // -1 month
      toDate = Calendar.addUnitToDate(fromDate, "month", 1) // + 1 month
      toDate = Calendar.addUnitToDate(toDate, "day", -1) // -1 day, to get last day of last month
      periodString = `${monthNameAbbrev(fromDate.getMonth() + 1)} ${y}`
      break
    }
    case "mtd": {
      fromDate = Calendar.dateFrom(y,m,1,0,0,0) // start of this month
      toDate = Calendar.dateFrom(y,m,d,0,0,0)
      periodString = `${monthNameAbbrev(m)} ${y}`
      break
    }
    case "lq": {
      const quarterStartMonth = ((Math.floor((m-1)/3))*3)+1
      fromDate = Calendar.dateFrom(y,quarterStartMonth,1,0,0,0) // start of this quarter
      fromDate = Calendar.addUnitToDate(fromDate, "month", -3) // -1 quarter
      toDate = Calendar.addUnitToDate(fromDate, "month", 3) // +1 quarter
      toDate = Calendar.addUnitToDate(toDate, "day", -1) // -1 day, to get last day of last month
      periodString = `${fromDate.getFullYear()} Q${Math.floor(fromDate.getMonth()/3)+1}`
      break
    }
    case "qtd": {
      const quarterStartMonth = ((Math.floor((m-1)/3))*3)+1
      fromDate = Calendar.dateFrom(y,quarterStartMonth,1,0,0,0) // start of this quarter
      toDate = Calendar.dateFrom(y,m,d,0,0,0)
      periodString = `${y} Q${(Math.floor((m-1)/3)+1)}`
      break
    }
    case "ly": {
      fromDate = Calendar.dateFrom(y-1,1,1,0,0,0) // start of last year
      toDate = Calendar.dateFrom(y - 1, 12, 31, 0, 0, 0) // end of last year
      periodString = `${y-1}`
      break
    }
    case "ytd": {
      fromDate = Calendar.dateFrom(y,1,1,0,0,0) // start of this year
      toDate = Calendar.dateFrom(y,m,d,0,0,0)
      periodString = `${y}`
      break
    }
  }
  const fromDateStr = fromDate.toISOString().slice(0, 10).replace(/-/g, '')
  const toDateStr = toDate.toISOString().slice(0, 10).replace(/-/g, '')

  const title = `${periodString} (${fromDateStr}-${toDateStr})`
  console.log(`\ntagStats: ${title}:`)
  const results = calcTagStatsPeriod(fromDateStr, toDateStr)
  const sortedResults = new Map([...results.entries()].sort())
  let outputArray = []
  for (const elem of sortedResults.entries()) {
    outputArray.push(`${elem[1]}\t${elem[0]}`)
  }

  const labelString = `🗒 Add/update note '${periodString}' in folder '${pref_folderToStore}'`
  const destination = await chooseOption(`Where to save the summary for ${outputArray.length} hashtags?`, [{
  // TODO: When weekly/monthly notes are made possible in NP, then add options like this
  //   label: "📅 Append to today's note",
  //   value: "today"
  // }, {
    label: labelString,
    value: "note"
  }, {
    label: "🖥 Pop-up display",
    value: "show"
  }, {
    label: "🖊 Write to console log",
    value: "log"
  }, {
    label: "❌ Cancel",
    value: "cancel"
    }
  ], "show")

  // Ask where to send the results
  switch (destination) {
    case "today": {
      const todaysNote = await DataStore.calendarNoteByDate(new Date())
      if (todaysNote === null) {
        console.log(`\terror appending to today's note`)
      } else {
        console.log(`\tappending results to today's note (${todaysNote.filename})`)
        // TODO: create two different 'title' strings to use
        todaysNote.appendParagraph(`### Hashtag Counts for ${title}`)
        todaysNote.appendParagraph(outputArray.join('\n'))
        console.log(`\tappended results to today's note`)
      }
      break
    }
    case "note": {
      let note
      // TODO: first see if it's already created
      const existingNote = await DataStore.projectNoteByTitle(title)
      if (existingNote === null) {
        note = await DataStore.newNote(title, pref_folderToStore)
        console.log(`\twriting results to new note (${title})`)
      } else {
        note = existingNote
        console.log(`\twriting results to existing note (${title})`)
      }
      note.appendParagraph("")
      note.appendParagraph(`### Hashtag Counts`)
      note.appendParagraph(outputArray.join('\n'))
      console.log(`\twritten results to note (${title})`)
      break
    }
    case "log": {
      console.log(outputArray.join('\n'))
      break
    }
    case "cancel": {
      break
    }
    default: {
      const re = await CommandBar.showOptions(
        outputArray,
        "Tag counts.  (Select anything to copy)",
      )
      if (re !== null) {
        Clipboard.string = outputArray.join('\n')
      }
      break
    }
  }
    //   await showMessage('Everything is already up to date here!');

}

globalThis.tagStats = tagStats

//-------------------------------------------------------------------------------
// Calculate tag statistics for daily notes of a given time period
// Returns a Map of {tag, count}

function calcTagStatsPeriod(fromDateStr, toDateStr) {
  // Get all daily notes that are within this time period
  const periodDailyNotes = DataStore.calendarNotes.filter(
    p => withinDateRange(dateStringFromCalendarFilename(p.filename),
      fromDateStr, toDateStr)
  )

  if (periodDailyNotes.length === 0) {
    console.log('\twarning: no matching daily notes found')
    return;
  } else {
    console.log(`\tfound ${periodDailyNotes.length} matching daily notes`)
  }

  // For each matching date, find and store the tags in Map
  const tags = new Map() // key: tagname; value: count
  for (let i = 0; i < periodDailyNotes.length; i++) {
    const n = periodDailyNotes[i]
    const includedTags = n.hashtags // TODO: later .mentions too?
    // console.log(`i:${i} -> ${n.hashtags.join(' / ')}`)
    for (let j = 0; j < includedTags.length; j++) {
      if (tags.has(includedTags[j])) {
        tags.set(includedTags[j], tags.get(includedTags[j]) + 1)
        // console.log(typeof (tags.get(includedTags[j])))
        // console.log(typeof (tags.get(includedTags[j]) +1))
      } else {
        tags.set(includedTags[j], 1)
      }
      // console.log(`  j:${j} ${includedTags[j]} = ${tags.get(includedTags[j])}`)
    }
  }
  return tags
}

  // function removeDateTags(content) {
  //   return content.replace(/<\d{4}-\d{2}-\d{2}/g, '').replace(/>\d{4}-\d{2}-\d{2}/g, '').trim();
  // }

  // async function sweepFile() {
  //   const type = Editor.type;
  //   const note = Editor.note;

  //   if (note == null) {
  //     return;
  //   }

  //   if (type === 'Calendar') {
  //     const todayNoteFileName = filenameDateString(new Date()) + '.' + DataStore.defaultFileExtension;

  //     if (Editor.filename == todayNoteFileName) {
  //       await CommandBar.showInput('Open a different note than today', 'OK');
  //       return;
  //     }

  //     return await sweepCalendarNote(note);
  //   } else {
  //     return await sweepProjectNote(note);
  //   }
  // }

  // const OPTIONS = [{
  //   label: '7 days',
  //   value: {
  //     num: 7,
  //     unit: 'day'
  //   }
  // }, {
  //   label: '14 days',
  //   value: {
  //     num: 14,
  //     unit: 'day'
  //   }
  // }, {
  //   label: '21 days',
  //   value: {
  //     num: 21,
  //     unit: 'day'
  //   }
  // }, {
  //   label: '1 month',
  //   value: {
  //     num: 1,
  //     unit: 'month'
  //   }
  // }, {
  //   label: '3 months',
  //   value: {
  //     num: 3,
  //     unit: 'month'
  //   }
  // }, {
  //   label: '6 months',
  //   value: {
  //     num: 6,
  //     unit: 'month'
  //   }
  // }, {
  //   label: '1 year',
  //   value: {
  //     num: 1,
  //     unit: 'year'
  //   }
  // }, {
  //   label: '❌ Cancel',
  //   value: {
  //     num: 0,
  //     unit: 'day'
  //   }
  // }];
  // const DEFAULT_OPTION = {
  //   unit: 'day',
  //   num: 0
  // };
  // /**
  //  * TODO:
  //  * 1. Add option to move all tasks silently
  //  * 2. Add option to reschedule instead of move Calendar notes
  //  * 3. Add option to change target date from "Today" to something you can choose
  //  *  */

  // async function sweepAll() {
  //   const {
  //     unit,
  //     num
  //   } = await chooseOption('🧹 Reschedule tasks to today of the last...', OPTIONS, DEFAULT_OPTION);

  //   if (num == 0) {
  //     // User canceled, return here, so no additional messages are shown
  //     await showMessage(`Cancelled! No changes made.`);
  //     return;
  //   }

  //   const afterDate = Calendar.addUnitToDate(new Date(), unit, -num);
  //   const afterDateFileName = filenameDateString(Calendar.addUnitToDate(new Date(), unit, -num));
  //   const re1 = await CommandBar.showOptions(['✅ OK', '❌ Skip'], '📙 Processing with your Project Notes first...');

  //   if (re1.index == 0) {
  //     for (const note of DataStore.projectNotes) {
  //       await sweepProjectNote(note, true, hyphenatedDateString(afterDate), false);
  //     }
  //   }

  //   const re2 = await CommandBar.showOptions(['✅ OK', '❌ Skip'], '🗓 Now processing your Daily Notes...');

  //   if (re2.index == 0) {
  //     const todayFileName = filenameDateString(new Date());
  //     const recentCalNotes = DataStore.calendarNotes.filter(note => note.filename < todayFileName && note.filename >= afterDateFileName);

  //     for (const note of recentCalNotes) {
  //       await sweepCalendarNote(note, true, false);
  //     }
  //   }

  //   await showMessage(`All Done!`);
  // }
