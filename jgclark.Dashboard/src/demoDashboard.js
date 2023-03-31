// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 31.3.2023 for v0.3.x by @jgclark
//-----------------------------------------------------------------------------

import { type SectionDetails, type SectionItem } from './dashboardHelpers'
import {
  getNPWeekStr,
  getDateStringFromCalendarFilename,
  toLocaleDateString,
} from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, timer } from '@helpers/dev'

//-----------------------------------------------------------------

/**
 * Setup dummy data for the demo dashboard, using the same data structures as the main dataGeneration.js
 * @returns {Promise<void>}
 */
export function getDemoDashboardData(): [Array<SectionDetails>, Array<SectionItem>] {
  try {
    const sections: Array<SectionDetails> = []
    const sectionItems: Array<SectionItem> = []
    let sectionCount = 0
    let doneCount = 0
    const today = new Date()

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
        "filename": "20230302.md",
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
        "filename": "20230302.md",
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      }
    ]
    // make a sectionItem for each item, and then make a section too.
    let itemCount = 0
    openParas.map((p) => {
      const thisID = `${sectionCount}-${itemCount}`
      sectionItems.push({
        ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename, type: p.type
      })
      itemCount++
    })
    const todayStr = "2023-03-02"
    sections.push({ ID: sectionCount, name: 'Today', description: `from daily note for ${todayStr}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily" })
    sectionCount++

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
        "noteType": "Calendar",
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
        "filename": "CCC Areas/Services 2.md",
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
        "filename": "CCC Areas/Services 2.md",
        "noteType": "Notes",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
      {
        "priority": -1,
        "type": "open",
        "content": "Clear more of prayer room @staff @church >today ^q9jzj4",
        "blockId": "^q9jzj4",
        "rawContent": "* Clear more of prayer room @staff @church >today ^q9jzj4",
        "prefix": "* ",
        "contentRange": {},
        "lineIndex": 29,
        "date": "2023-03-02T00:00:00.000Z",
        "heading": "Staff Meeting",
        "headingRange": {},
        "headingLevel": 3,
        "isRecurring": false,
        "indents": 0,
        "filename": "20220613.md",
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [
          {},
          {}
        ],
        "note": {}
      },
    ]
    // make a sectionItem for each item, and then make a section too.
    itemCount = 0
    sortedRefParas.map((p) => {
      const thisID = `${sectionCount}-${itemCount}`
      sectionItems.push({
        ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename, type: p.type
      })
      itemCount++
    })
    sections.push({ ID: sectionCount, name: 'Today', description: `scheduled to today from other notes`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarDaily" })
    sectionCount++

    const openWeekParas = [
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
        "filename": "2023-W09.md",
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
        "filename": "2023-W09.md",
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
        "filename": "2023-W09.md",
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
        "filename": "2023-W09.md",
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
        "filename": "2023-W09.md",
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
        "filename": "2023-W09.md",
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [
          {}
        ],
        "note": {}
      },
    ]
    // make a sectionItem for each item, and then make a section too.
    itemCount = 0
    openWeekParas.map((p) => {
      const thisID = `${sectionCount}-${itemCount}`
      sectionItems.push({
        ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename, type: p.type
      })
      itemCount++
    })
    const dateStr = "2023-W09"
    sections.push({ ID: sectionCount, name: 'This Week', description: `from weekly note ${dateStr}`, FAIconClass: "fa-light fa-calendar-week", sectionTitleClass: "sidebarWeekly" })
    sectionCount++

    const sortedWeekRefParas = [
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
        "heading": "Pastoral Coordination #meeting (11:30) [Meeting Note](noteplan://x-callback-url/runPlugin?pluginID=np.MeetingNotes&command=newMeetingNoteFromEventID&arg0=14A3903A-9972-47F9-BBFC-1F94FC80DF21&arg1=)",
        "headingRange": {},
        "headingLevel": 3,
        "isRecurring": false,
        "indents": 0,
        "filename": "20230206.md",
        "noteType": "Calendar",
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
    // make a sectionItem for each item, and then make a section too.
    itemCount = 0
    sortedWeekRefParas.map((p) => {
      const thisID = `${sectionCount}-${itemCount}`
      sectionItems.push({
        ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename, type: p.type
      })
      itemCount++
    })
    sections.push({ ID: sectionCount, name: 'This week', description: `scheduled to this week`, FAIconClass: "fa-regular fa-clock", sectionTitleClass: "sidebarWeekly" })
    sectionCount++

    // Monthly note
    const openMonthParas = [
      {
        "priority": 0,
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
        "filename": "2023-03.md",
        "noteType": "Calendar",
        "linkedNoteTitles": [],
        "subItems": [],
        "referencedBlocks": [],
        "note": {}
      },
    ]
    // make a sectionItem for each item, and then make a section too.
    itemCount = 0
    openMonthParas.map((p) => {
      const thisID = `${sectionCount}-${itemCount}`
      sectionItems.push({
        ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename, type: p.type
      })
      itemCount++
    })
    const monthDateStr = "2023-03"
    sections.push({ ID: sectionCount, name: 'This Month', description: `from monthly note ${monthDateStr}`, FAIconClass: "fa-light fa-calendar-range", sectionTitleClass: "sidebarMonthly" })
    sectionCount++


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
    itemCount = 0
    nextNotesToReview.map((n) => {
      const thisID = `${sectionCount}-${itemCount}`
      sectionItems.push({
        ID: thisID, content: '', rawContent: '', filename: n.filename, type: 'review'
      })
      itemCount++
    })
    sections.push({
      ID: sectionCount,
      name: 'Projects',
      description: `next projects to review`,
      FAIconClass: 'fa-regular fa-calendar-check',
      sectionTitleClass: 'sidebarYearly',
    })
    logDebug('setDemoDashboardData', `getDataForDashboard finished, with ${String(sections.length)} sections and ${String(sectionItems.length)} items`)
    return [sections, sectionItems]
  } catch (error) {
    logError('setDemoDashboardData', error.message)
    return [[], []] // for completeness
  }

}
