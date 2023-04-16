// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 12.4.2023 for v0.4.1 by @jgclark
//-----------------------------------------------------------------------------

import {
  getSettings,
  type dashboardConfigType,
  type SectionDetails, type SectionItem
} from './dashboardHelpers'
import {
  getNPMonthStr,
  getNPWeekStr,
  getDateStringFromCalendarFilename,
  getTodaysDateUnhyphenated,
  todaysDateISOString,
  toLocaleDateString,
} from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, timer } from '@helpers/dev'

//-----------------------------------------------------------------

/**
 * Setup dummy data for the demo dashboard, using the same data structures as the main dataGeneration.js
 * @returns {[Array<SectionDetails>, Array<SectionItem>]}
 */
export async function getDemoDataForDashboard(): Promise<[Array<SectionDetails>, Array<SectionItem>]> {
  try {
    // Get settings
    const config: dashboardConfigType = await getSettings()

    const sections: Array<SectionDetails> = []
    const sectionItems: Array<SectionItem> = []
    let sectionCount = 0
    let doneCount = 0
    let itemCount = 0
    const today = new Date()

    //-----------------------------------------------------------
    // Demo data for Today

    let todayStr = todaysDateISOString
    let thisFilename = getTodaysDateUnhyphenated() + ".md"
    // Note: in following, the filenames need to be real otherwise there will be 'error' in the display
    const openParas = [
      {
        "priority": -1,
        "type": "open",
        "content": "#editvideo from CFL visit",
        "rawContent": "* #editvideo from CFL visit",
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
        "content": "do solar reading",
        "rawContent": "+ do solar reading",
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
    const sortedRefParas = [
      {
        "priority": 1,
        "type": "open",
        "content": "! Respond on Repair Cafe things from last 2 meetings (and file notes) >today #win ^wazhht",
        "blockId": "^wazhht",
        "rawContent": "* ! Respond on Repair Cafe things from last 2 meetings (and file notes) >today #win ^wazhht",
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
          {},
          {}
        ],
        "note": {}
      },
    ]
    let combinedSortedParas = openParas.concat(sortedRefParas)

    // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
    if (config.separateSectionForReferencedNotes) {
      // make a sectionItem for each item, and then make a section too.
      itemCount = 0
      openParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(combinedSortedParas, "daily sortedOpenParas")
      logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} daily items`)
      sections.push({ ID: sectionCount, name: 'Today', description: `from daily note ${toLocaleDateString(today)}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename })
      sectionCount++

      clo(sortedRefParas, "sortedRefParas")
      if (sortedRefParas.length > 0) {
        itemCount = 0
        sortedRefParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
          itemCount++
        })
        sections.push({ ID: sectionCount, name: 'Today', description: `scheduled to today`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarDaily", filename: '' })
        sectionCount++
      }
    } else {
      // write one combined section
      itemCount = 0
      combinedSortedParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(sortedRefParas, "sortedRefParas")
      sections.push({ ID: sectionCount, name: 'Today', description: `from daily note or scheduled to ${toLocaleDateString(today)}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename })
      sectionCount++
    }
    // Make up count of tasks/checklists done today
    doneCount += 4

    //-----------------------------------------------------------
    // Demo data for This Week

    let dateStr = getNPWeekStr(today)
    thisFilename = dateStr + ".md"
    const demoOpenWeekParas: Array<TParagraph> = [
      {
        "priority": 2,
        "type": "open",
        "content": "!! Arrange EV charger repair",
        "rawContent": "* !! Arrange EV charger repair",
        "prefix": "+ ",
        "contentRange": {},
        "lineIndex": 2,
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
        "type": "open",
        "content": "Attempt method in [Automating podcast transcripts on my Mac with OpenAI Whisper – Six Colors](https://sixcolors.com/post/2023/02/automating-podcast-transcripts-on-my-mac-with-openai-whisper/) [[Information Capture#Capture of listening]]",
        "rawContent": "* Attempt method in [Automating podcast transcripts on my Mac with OpenAI Whisper – Six Colors](https://sixcolors.com/post/2023/02/automating-podcast-transcripts-on-my-mac-with-openai-whisper/) [[Information Capture#Capture of listening]]",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 0,
        "heading": "",
        "headingLevel": -1,
        "isRecurring": false,
        "indents": 0,
        "filename": thisFilename,
        "noteType": "Calendar",
        "linkedNoteTitles": [
          "Information Capture"
        ],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
      {
        "priority": -1,
        "type": "checklist",
        "content": "Idea: Last listened NTW on authority",
        "rawContent": "+ Idea: Last listened NTW on authority",
        "prefix": "+ ",
        "contentRange": {},
        "lineIndex": 1,
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
        "type": "open",
        "content": " Get login for https://www.waverleyabbeyresources.org/resources-home/",
        "rawContent": "* Get login for https://www.waverleyabbeyresources.org/resources-home/",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 3,
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
        "content": "Contact @PeterS again",
        "rawContent": "+ Contact @PeterS again",
        "prefix": "+ ",
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
        "type": "open",
        "content": "@church Get iPad working on ChurchOffice-staff for Drive, Printing @church ^bzlp1z",
        "blockId": "^bzlp1z",
        "rawContent": "* @church Get iPad working on ChurchOffice-staff for Drive, Printing @church ^bzlp1z",
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
        "referencedBlocks": [
          {}
        ],
        "note": {}
      },
    ]
    const demoSortedWeekRefParas: Array<TParagraph> = [
      {
        "priority": -1,
        "type": "open",
        "content": "Methodist HC sheet fix typo → @RP for printing ^l7flz7 >2023-W09",
        "blockId": "^l7flz7",
        "rawContent": "* Methodist HC sheet fix typo → @RP for printing ^l7flz7 >2023-W09",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 13,
        "date": "2023-02-27T00:00:00.000Z",
        "heading": "Staff #meeting on Service Pattern",
        "headingRange": {},
        "headingLevel": 3,
        "isRecurring": false,
        "indents": 0,
        "filename": "20230216.md",
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [
          {}
        ],
        "note": {}
      },
      {
        "priority": -1,
        "type": "checklist",
        "content": "Send Linda a link to welcome presentation >2023-W09",
        "rawContent": "+ Send Linda a link to welcome presentation >2023-W09",
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
    ]
    combinedSortedParas = demoOpenWeekParas.concat(demoSortedWeekRefParas)

    // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
    if (config.separateSectionForReferencedNotes) {
      // make a sectionItem for each item, and then make a section too.
      let itemCount = 0
      demoOpenWeekParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(demoOpenWeekParas, "weekly demoOpenWeekParas")
      logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} daily items`)
      sections.push({ ID: sectionCount, name: 'This week', description: `from weekly note ${dateStr}`, FAIconClass: "fa-light fa-calendar-week", sectionTitleClass: "sidebarWeekly", filename: thisFilename })
      sectionCount++

      // clo(demoSortedWeekRefParas, "demoSortedWeekRefParas")
      if (demoSortedWeekRefParas.length > 0) {
        itemCount = 0
        demoSortedWeekRefParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
          itemCount++
        })
        sections.push({ ID: sectionCount, name: 'This week', description: `scheduled to this week`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarWeekly", filename: '' })
        sectionCount++
      }
    } else {
      // write one combined section
      let itemCount = 0
      combinedSortedParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(combinedSortedParas, "combinedSortedParas")
      sections.push({ ID: sectionCount, name: 'This week', description: `from weekly note or scheduled to ${dateStr}`, FAIconClass: "fa-light fa-calendar-week", sectionTitleClass: "sidebarWeekly", filename: thisFilename })
      sectionCount++
    }
    // Get count of tasks/checklists done today
    doneCount += 5 // made up for demo purposes

    //-----------------------------------------------------------
    // Demo data for This Month

    const monthDateStr = getNPMonthStr(today)
    thisFilename = monthDateStr + ".md"
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
    // If we want this separated from the referenced items, then form its section (otherwise hold over to the next section formation)
    if (config.separateSectionForReferencedNotes) {
      // make a sectionItem for each item, and then make a section too.
      let itemCount = 0
      openMonthParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(openMonthParas, "monthly openMonthParas")
      logDebug('getDataForDashboard', `-> ${String(sectionItems.length)} monthly items`)
      sections.push({ ID: sectionCount, name: 'This Month', description: `from monthly note ${dateStr}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly", filename: thisFilename })
      sectionCount++

      // clo(sortedMonthRefParas, "monthly sortedMonthRefParas")
      if (sortedMonthRefParas.length > 0) {
        itemCount = 0
        sortedMonthRefParas.map((p) => {
          const thisID = `${sectionCount}-${itemCount}`
          sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
          itemCount++
        })
        sections.push({ ID: sectionCount, name: 'This month', description: `scheduled to this month`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarMonthly", filename: '' })
        sectionCount++
      }
    } else {
      // write one combined section
      let itemCount = 0
      combinedSortedParas.map((p) => {
        const thisID = `${sectionCount}-${itemCount}`
        sectionItems.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type })
        itemCount++
      })
      // clo(combinedSortedParas, "monthly combinedSortedParas")
      sections.push({ ID: sectionCount, name: 'This month', description: `from monthly note or scheduled to ${dateStr}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly", filename: thisFilename })
      sectionCount++
    }

    // Get completed count too
    doneCount += 2 // made up for demo purposes

    // Send doneCount through as a special type item:
    sections.push({
      ID: doneCount,
      name: 'Done',
      description: ``,
      FAIconClass: '',
      sectionTitleClass: '',
      filename: ''
    })

    //-----------------------------------------------------------
    // Notes to review
    const nextNotesToReview = [
      {
        "filename": "CCC Areas/Staff/Staff Induction JM.md",
        "type": "Notes",
        "title": "Staff Induction (JW)",
        "changedDate": "2023-02-28T13:11:30.000Z",
        "createdDate": "2023-02-28T13:11:30.000Z",
        "hashtags": [
          "#project"
        ],
      },
      {
        "filename": "CCC Projects/Streaming Platform.md",
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
      let itemCount = 0
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
        FAIconClass: 'fa-regular fa-calendar-check',
        sectionTitleClass: 'sidebarYearly',
        filename: ''
      }) // or "fa-solid fa-calendar-arrow-down" ?
      sectionCount++
    }

    //-----------------------------------------------------------
    // Return data

    logDebug('setDemoDashboardData', `getDataForDashboard finished, with ${String(sections.length)} sections and ${String(sectionItems.length)} items`)
    return [sections, sectionItems]
  }
  catch (error) {
    logError('setDemoDashboardData', error.message)
    return [[], []] // for completeness
  }
}
