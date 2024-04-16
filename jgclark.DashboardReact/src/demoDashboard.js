// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 17.7.2023 for v0.5.1 by @jgclark
// Note: to run this:noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=test%3Ademo%20dashboard
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  type dashboardConfigType,
} from './dashboardHelpers'
import type {
  TSection, SectionItem
} from './types'
import {
  getNPMonthStr,
  getNPWeekStr,
  getTodaysDateUnhyphenated,
  // toLocaleDateString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { checkForRequiredSharedFiles } from '@helpers/NPRequiredFiles'

//-----------------------------------------------------------------

/**
 * Show the dashboard HTML window, _but with some pre-configured demo data_.
 */
export async function showDemoDashboard(): Promise<void> {
  try {
    const callType: string = 'manual'
    const demoMode: boolean = true

    logDebug(pluginJson, `showDemoDashboard() starting`)

    const shouldFocus = (callType === 'manual')
    const config = await getSettings()
    // const todaysFilenameDate = getTodaysDateUnhyphenated()
    const filterPriorityItems = DataStore.preference('Dashboard-filterPriorityItems') ?? false
    await checkForRequiredSharedFiles(pluginJson)
    let JSONForDemoSections: Array<any> = []

    //---------------------------------------------------
    // Main data preparation Work

    if (demoMode) {
      JSONForDemoSections = await getDemoDataForDashboard()
    } else {
      // Get live data, indicating don't do a full generate if this has been triggered from change in daily note
      // const fullGenerate = callType !== 'trigger'
      // ;[sections, sectionItems] = await getDataForDashboard(fullGenerate)
    }

    //---------------------------------------------------
    // Log the resulting JSON
    logInfo(pluginJson, `showDemoDashboard(): resulting JSON from ${String(JSONForDemoSections.length)} sections:`)
    let sectionCount = 0
    for (const section of JSONForDemoSections) {
      console.log(`Section #${String(sectionCount)} -------------------`)
      console.log(section)
      sectionCount++
    }


  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}


/**
 * Setup dummy data for the demo dashboard, using the same data structures as the main dataGeneration.js
 * @returns {[Array<TSection>, Array<SectionItem>]}
 */
export async function getDemoDataForDashboard(): Promise<Array<any>> {
  try {
    // Get settings
    const config: dashboardConfigType = await getSettings()

    const sections: Array<TSection> = []
    let sectionItems: Array<SectionItem> = []
    let sectionCount = 0
    let doneCount = 0
    let itemCount = 0

    const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
    const todayDateLocale = toNPLocaleDateString(new Date(), "short") // uses moment's locale info from NP

    //-----------------------------------------------------------
    // Demo data for Today

    let thisFilename = `${getTodaysDateUnhyphenated()}.md`
    // Note: in following, the filenames need to be real otherwise there will be 'error' in the display
    const openTodayParas = [
      {
        "priority": "4",
        "type": "open",
        "content": ">> #editvideo from CFL visit",
        "rawContent": "* >> #editvideo from CFL visit",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 4,
        "heading": "",
        "headingLevel": -1,
        "isRecurring": false,
        "indents": 0,
        "filename": thisFilename,
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
      {
        "priority": -1,
        "type": "checklist",
        "content": "check ==highlights==, `formatted` and ~~strike~~ text work OK",
        "rawContent": "+ check ==highlights==, `formatted` and ~~strike~~ text work OK",
        "prefix": "+ ",
        "contentRange": {},
        "lineIndex": 5,
        "heading": "",
        "headingLevel": -1,
        "isRecurring": false,
        "indents": 0,
        "filename": thisFilename,
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      }
    ]
    const refTodayParas = [
      {
        "priority": 1,
        "type": "open",
        "content": "! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht",
        "blockId": "^wazhht",
        "rawContent": "* ! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 8,
        "date": "2023-03-02T00:00:00.000Z",
        "heading": "Start-up Formalities",
        "headingRange": {},
        "headingLevel": 3,
        "isRecurring": false,
        "indents": 0,
        "filename": "Ministry Projects/Repair Cafe.md",
        "noteType": "Notes",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [
          {}
        ],
        "note": {}
      },
      {
        "priority": -1,
        "type": "open",
        "content": "Edit video from CFL visit https://bcfd.org.uk",
        "blockId": "^wazhht",
        "rawContent": "* Edit video from CFL visit https://bcfd.org.uk",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 5,
        "date": "2023-03-02T00:00:00.000Z",
        "heading": "",
        "headingLevel": -1,
        "isRecurring": false,
        "indents": 0,
        "filename": "CCC Areas/Mission Partners.md",
        "noteType": "Notes",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [
          {}
        ],
        "note": {}
      },
    ]
    let combinedSortedParas = openTodayParas.concat(refTodayParas)

    // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
    if (config.separateSectionForReferencedNotes) {
      // make a sectionItem for each item, and then make a section too.
      logDebug('2', todayDateLocale)
      openTodayParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(combinedSortedParas, "daily sortedOpenTodayParas")
      logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} daily items`)
      sections.push({ ID: sectionCount, name: 'Today', sectionType: 'DT', description: `{count} from ${todayDateLocale} {addItems} {addItemsNextPeriod}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename, sectionItems: sectionItems })
      sectionCount++

      // clo(refTodayParas, "refTodayParas")
      if (refTodayParas.length > 0) {
        refTodayParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
          itemCount++
        })
        sections.push({ ID: sectionCount, name: 'Today', sectionType: 'DT', description: `{count} scheduled to ${todayDateLocale}`, FAIconClass: "fa-light fa-clock", sectionTitleClass: "sidebarDaily", filename: '', sectionItems: sectionItems })
        sectionCount++
      }
    } else {
      // write one combined section
      combinedSortedParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(refTodayParas, "refTodayParas")
      sections.push({ ID: sectionCount, name: 'Today', sectionType: 'DT', description: `{count} from ${todayDateLocale} {addItems} {addItemsNextPeriod}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename, sectionItems: sectionItems })
      sectionCount++
    }
    logDebug(pluginJson, `Got data for Today: now ${String(sectionCount)} sections, ${String(sectionItems.length)} items`)

    //-----------------------------------------------------------
    // Demo data for Yesterday

    const yesterday = new moment().subtract(1, 'days').toDate()
    const yesterdayDateLocale = toNPLocaleDateString(yesterday, "short") // uses moment's locale info from NP
    thisFilename = `${moment(yesterday).format("YYYYMMDD")}.md`
    // Note: in following, the filenames need to be real otherwise there will be 'error' in the display
    const openYesterdayParas = [
      {
        "priority": "0",
        "type": "open",
        "content": "film video at CFL visit",
        "rawContent": "* film video at CFL visit",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 4,
        "heading": "",
        "headingLevel": -1,
        "isRecurring": false,
        "indents": 0,
        "filename": thisFilename,
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
      {
        "priority": -1,
        "type": "checklist",
        "content": "update SW contract following review comments",
        "rawContent": "* update SW contract following review comments",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 5,
        "heading": "",
        "headingLevel": -1,
        "isRecurring": false,
        "indents": 0,
        "filename": thisFilename,
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      }
    ]
    const refYesterdayParas = [
      {
        "priority": 1,
        "type": "open",
        "content": "write 5/3 sermon >2023-03-02",
        "rawContent": "* write 5/3 sermon >2023-03-02",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 87,
        "date": "2023-03-02T00:00:00.000Z",
        "heading": "5/3/2023 CCC service @2023-03-05",
        "headingRange": {},
        "headingLevel": 3,
        "isRecurring": false,
        "indents": 0,
        "filename": "CCC Areas/Services.md",
        "noteType": "Notes",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
      {
        "priority": 1,
        "type": "open",
        "content": "write service leader segments plan Something Different for 5/3 >2023-03-02",
        "rawContent": "* write service leader segments plan Something Different for 5/3 >2023-03-02",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 89,
        "date": "2023-03-02T00:00:00.000Z",
        "heading": "5/3/2023 CCC service @2023-03-05",
        "headingRange": {},
        "headingLevel": 3,
        "isRecurring": false,
        "indents": 0,
        "filename": "CCC Areas/Services.md",
        "noteType": "Notes",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
      {
        "priority": -1,
        "type": "open",
        "content": "Clear more of prayer room @staff >today ^q9jzj4",
        "blockId": "^q9jzj4",
        "rawContent": "* Clear more of prayer room @staff >today ^q9jzj4",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 29,
        "date": "2023-03-02T00:00:00.000Z",
        "heading": "Staff Meeting",
        "headingRange": {},
        "headingLevel": 3,
        "isRecurring": false,
        "indents": 0,
        "filename": "20230213.md",
        "noteType": "Notes",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [
        ],
        "note": {}
      },
    ]
    const combinedYesterdaySortedParas = openYesterdayParas.concat(refYesterdayParas)
    sectionItems = []
    // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
    if (config.separateSectionForReferencedNotes) {
      // make a sectionItem for each item, and then make a section too.
      // itemCount = 0
      openYesterdayParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(combinedSortedParas, "daily sortedOpenYesterdayParas")
      logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} daily items`)
      sections.push({ ID: sectionCount, name: 'Yesterday', sectionType: 'DT', description: `{count} from ${yesterdayDateLocale} {scheduleAllYesterdayToday}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename, sectionItems: sectionItems })
      sectionCount++

      // clo(refYesterdayParas, "refYesterdayParas")
      if (refYesterdayParas.length > 0) {
        // itemCount = 0
        refYesterdayParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
          itemCount++
        })
        sections.push({ ID: sectionCount, name: 'Yesterday', sectionType: 'DT', description: `{count} scheduled to ${yesterdayDateLocale} {scheduleAllToday}`, FAIconClass: "fa-light fa-clock", sectionTitleClass: "sidebarDaily", filename: '', sectionItems: sectionItems })
        sectionCount++
      }
    } else {
      // write one combined section
      // itemCount = 0
      combinedYesterdaySortedParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(refYesterdayParas, "refYesterdayParas")
      sections.push({ ID: sectionCount, name: 'Yesterday', sectionType: 'DY', description: `{count} from ${yesterdayDateLocale} {scheduleAllYesterdayToday}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename, sectionItems: sectionItems })
      sectionCount++
    }
    logDebug(pluginJson, `Got data for Yesterday: now ${String(sectionCount)} sections, ${String(sectionItems.length)} items`)


    //-----------------------------------------------------------
    // Demo data for This Week

    const dateStr = getNPWeekStr(today)
    thisFilename = `${dateStr}.md`
    const demoOpenWeekParas: Array<TParagraph> = [
      {
        "priority": 2,
        "type": "open",
        "content": "!! Arrange EV charger repair",
        "rawContent": "* !! Arrange EV charger repair",
        "prefix": "+ ",
        "contentRange": {},
        "lineIndex": 2,
        "date": "2023-02-27T00:00:00.000Z",
        "heading": "",
        "headingRange": {},
        "headingLevel": -1,
        "isRecurring": false,
        "indents": 0,
        "filename": thisFilename,
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
      {
        "priority": -1,
        "type": "open",
        "content": " Get login for https://www.waverleyabbeyresources.org/resources-home/",
        "rawContent": "* Get login for https://www.waverleyabbeyresources.org/resources-home/",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 3,
        "date": "2023-02-27T00:00:00.000Z",
        "heading": "",
        "headingRange": {},
        "headingLevel": -1,
        "isRecurring": false,
        "indents": 0,
        "filename": thisFilename,
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
      {
        "priority": -1,
        "type": "checklist",
        "content": "Contact @PeterS again",
        "rawContent": "+ Contact @PeterS again",
        "prefix": "+ ",
        "contentRange": {},
        "lineIndex": 4,
        "date": "2023-02-27T00:00:00.000Z",
        "heading": "",
        "headingRange": {},
        "headingLevel": -1,
        "isRecurring": false,
        "indents": 0,
        "filename": thisFilename,
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
      {
        "priority": -1,
        "type": "open",
        "content": "@church Get iPad working on ChurchOffice-staff for Drive, Printing @church ^bzlp1z",
        "blockId": "^bzlp1z",
        "rawContent": "* @church Get iPad working on ChurchOffice-staff for Drive, Printing @church ^bzlp1z",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 5,
        "date": "2023-02-27T00:00:00.000Z",
        "heading": "",
        "headingRange": {},
        "headingLevel": -1,
        "isRecurring": false,
        "indents": 0,
        "filename": thisFilename,
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [
        ],
        "note": {}
      },
    ]
    const demoSortedWeekRefParas: Array<TParagraph> = [
      {
        "priority": -1,
        "type": "checklist",
        "content": "Send @Linda a link to welcome presentation >2023-W09",
        "rawContent": "+ Send @Linda a link to welcome presentation >2023-W09",
        "prefix": "+ ",
        "contentRange": {},
        "lineIndex": 18,
        "date": "2023-02-27T00:00:00.000Z",
        "heading": "Pastoral Coordination #meeting (11:30) [Meeting Note](noteplan://x-callback-url/runPlugin?pluginID=np.MeetingNotes&command=newMeetingNoteFromEventID&arg0=14A3903A-9972-47F9-BBFC-1F93FC80DF21&arg1=)",
        "headingRange": {},
        "headingLevel": 3,
        "isRecurring": false,
        "indents": 0,
        "filename": "CCC Areas/Pastoral.md",
        "noteType": "Notes",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
      {
        "priority": -1,
        "type": "open",
        "content": "Re-plant two shrubs in new blue pots >2023-W09",
        "rawContent": "* Re-plant two shrubs in new blue pots >2023-W09",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 10,
        "date": "2023-02-27T00:00:00.000Z",
        "heading": "To discuss with Andy",
        "headingRange": {},
        "headingLevel": 3,
        "isRecurring": false,
        "indents": 0,
        "filename": "Home 🏠 Areas/Garden.md",
        "noteType": "Notes",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
      {
        "priority": -1,
        "type": "checklist",
        "content": "Backup Mac - with an arrow date >2023-W09< reference",
        "rawContent": "+ Backup Mac - with an arrow date >2023-W09< reference",
        "prefix": "+ ",
        "contentRange": {},
        "lineIndex": 12,
        "date": "2023-02-27T00:00:00.000Z",
        "heading": "Backups",
        "headingRange": {},
        "headingLevel": 3,
        "isRecurring": false,
        "indents": 0,
        "filename": "Home 🏠 Areas/Macs.md",
        "noteType": "Notes",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
    ]
    combinedSortedParas = demoOpenWeekParas.concat(demoSortedWeekRefParas)
    sectionItems = []
    // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
    if (config.separateSectionForReferencedNotes) {
      // make a sectionItem for each item, and then make a section too.
      // let itemCount = 0
      demoOpenWeekParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(demoOpenWeekParas, "weekly demoOpenWeekParas")
      logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} daily items`)
      sections.push({ ID: sectionCount, name: 'This week', sectionType: 'W', description: `{count} from note ${dateStr} {addItems} {addItemsNextPeriod}`, FAIconClass: "fa-light fa-calendar-week", sectionTitleClass: "sidebarWeekly", filename: thisFilename, sectionItems: sectionItems })
      sectionCount++

      // clo(demoSortedWeekRefParas, "demoSortedWeekRefParas")
      if (demoSortedWeekRefParas.length > 0) {
        // itemCount = 0
        demoSortedWeekRefParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
          itemCount++
        })
        sections.push({ ID: sectionCount, name: 'This week', sectionType: 'W', description: `{count} scheduled to ${dateStr}`, FAIconClass: "fa-light fa-clock", sectionTitleClass: "sidebarWeekly", filename: '', sectionItems: sectionItems })
        sectionCount++
      }
    } else {
      // write one combined section
      // let itemCount = 0
      combinedSortedParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(combinedSortedParas, "combinedSortedParas")
      sections.push({ ID: sectionCount, name: 'This week', sectionType: 'W', description: `{count} from ${dateStr} {addItems} {addItemsNextPeriod}`, FAIconClass: "fa-light fa-calendar-week", sectionTitleClass: "sidebarWeekly", filename: thisFilename, sectionItems: sectionItems })
      sectionCount++
    }
    logDebug(pluginJson, `Got data for Week: now ${String(sectionCount)} sections, ${String(sectionItems.length)} items`)

    //-----------------------------------------------------------
    // Demo data for This Month

    const monthDateStr = getNPMonthStr(today)
    thisFilename = `${monthDateStr}.md`
    const openMonthParas = [
      {
        "priority": 0,
        "type": "open",
        "content": "Investigate alternative milkman",
        "rawContent": "* Investigate alternative milkman",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 0,
        "heading": "",
        "headingLevel": -1,
        "isRecurring": false,
        "indents": 0,
        "filename": thisFilename,
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
    ]
    const sortedMonthRefParas = [
      {
        "priority": 1,
        "type": "open",
        "content": "Pay tax bill",
        "rawContent": "* Pay tax bill",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 0,
        "heading": "",
        "headingLevel": -1,
        "isRecurring": false,
        "indents": 0,
        "filename": "Home 🏠 Areas/Tax Returns.md",
        "noteType": "Notes",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
    ]
    combinedSortedParas = openMonthParas.concat(sortedMonthRefParas)
    sectionItems = []
    // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
    if (config.separateSectionForReferencedNotes) {
      // make a sectionItem for each item, and then make a section too.
      // let itemCount = 0
      openMonthParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(openMonthParas, "monthly openMonthParas")
      logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} monthly items`)
      sections.push({ ID: sectionCount, name: 'This Month', sectionType: 'M', description: `{count} from ${dateStr} {addItems} {addItemsNextPeriod}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly", filename: thisFilename, sectionItems: sectionItems })
      sectionCount++

      // clo(sortedMonthRefParas, "monthly sortedMonthRefParas")
      if (sortedMonthRefParas.length > 0) {
        // itemCount = 0
        sortedMonthRefParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
          itemCount++
        })
        sections.push({ ID: sectionCount, name: 'This month', sectionType: 'M', description: `{count} scheduled to ${dateStr}`, FAIconClass: "fa-light fa-clock", sectionTitleClass: "sidebarMonthly", filename: '', sectionItems: sectionItems })
        sectionCount++
      }
    } else {
      // write one combined section
      // let itemCount = 0
      combinedSortedParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(combinedSortedParas, "monthly combinedSortedParas")
      sections.push({ ID: sectionCount, name: 'This month', sectionType: 'M', description: `{count} from ${dateStr} {addItems} {addItemsNextPeriod}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly", filename: thisFilename, sectionItems: sectionItems })
      sectionCount++
    }
    logDebug(pluginJson, `Got data for Month: now ${String(sectionCount)} sections, ${String(sectionItems.length)} items`)

    //-----------------------------------------------------------
    // Demo data for TagToShow section
    const tagToShow = '#next'
    const isHashtag: boolean = tagToShow.startsWith('#')
    const tagParasFromNote = [
      {
        "type": "checklist",
        "content": "Open Deliveroo account #next",
        "rawContent": "+ Open Deliveroo account #next",
        "title": "Test Project A",
        "filename": "TEST/DEMOs/Test Project A.md",
      },
      {
        "type": "open",
        "content": "Make expenses claim #next",
        "rawContent": "* Make expenses claim #next",
        "title": "Finance",
        "filename": "CCC Areas/Finance.md",
      }
    ]
    if (tagToShow !== '') {
      // let itemCount = 0
      sectionItems = []
      if (tagParasFromNote.length > 0) {
        for (const p of tagParasFromNote) {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename, type: p.type })
          itemCount++
        }
      }

      if (itemCount > 0) {
        sections.push({
          ID: sectionCount,
          name: `${tagToShow}`,
          description: `${String(itemCount)} open task(s)`,
          FAIconClass: (isHashtag) ? 'fa-light fa-hashtag' : 'fa-light fa-at',
          sectionTitleClass: (isHashtag) ? 'sidebarHashtag' : 'sidebarMention',
          filename: '',
          sectionItems: sectionItems
        })
        sectionCount++
      }
    }
    logDebug(pluginJson, `Got data for TAG: now ${String(sectionCount)} sections, ${String(sectionItems.length)} items`)

    //-----------------------------------------------------------
    // Get completed count too
    doneCount += 2 // made up for demo purposes

    // Send doneCount through as a special type item:
    sections.push({
      ID: doneCount,
      name: 'Done',
      description: ``,
      FAIconClass: '',
      sectionTitleClass: '',
      filename: '',
      sectionItems: []
    })

    //-----------------------------------------------------------
    // Notes to review
    const nextNotesToReview = [
      {
        "filename": "CCC Projects/Facilities/Hearing Support.md",
        "type": "Notes",
        "title": "Hearing Support at CCC",
        "changedDate": "2023-02-28T13:11:30.000Z",
        "createdDate": "2023-02-28T13:11:30.000Z",
        "hashtags": [
          "#project"
        ],
      },
      {
        "filename": "Home 🏠 Projects/Streamdeck setup.md",
        "type": "Notes",
        "title": "Streaming Platform",
        "changedDate": "2023-02-27T10:56:35.000Z",
        "createdDate": "2023-02-27T10:56:35.000Z",
        "hashtags": [
          "#project"
        ],
      },
      {
        "filename": "CCC Projects/Pastoral Cards.md",
        "type": "Notes",
        "title": "Pastoral Cards",
        "changedDate": "2022-09-05T11:13:21.963Z",
        "createdDate": "2022-04-25T22:39:42.000Z",
        "hashtags": [
          "#project"
        ],
      },
    ]
    if (nextNotesToReview) {
      // let itemCount = 0
      sectionItems = []
      nextNotesToReview.map((n) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({
          ID: thisID, content: '', rawContent: '', filename: n.filename, type: 'review'
        })
        itemCount++
      })
      // clo(nextNotesToReview, "nextNotesToReview")
      sections.push({
        ID: sectionCount,
        name: 'Projects',
        description: `next projects to review`,
        FAIconClass: 'fa-light fa-calendar-check',
        sectionTitleClass: 'sidebarYearly',
        filename: '',
        sectionItems: sectionItems
      }) // or "fa-solid fa-calendar-arrow-down" ?
      sectionCount++
    }

    //-----------------------------------------------------------
    // Return data

    // Form up the JSON for this section
    logDebug('setDemoDashboardData', `getDataForDashboard() finished, with ${String(sections.length)} sections and ${String(itemCount)} items`)
    const JSONSections: Array<any> = []
    for (const s of sections) {
      JSONSections.push(JSON.stringify(s))
    }
    return JSONSections
  }
  catch (error) {
    logError('setDemoDashboardData', error.message)
    return [] // for completeness
  }
}
