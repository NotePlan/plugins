// @flow
//-----------------------------------------------------------------------------
// Demo data for Dashboard plugin (for v2.0.0+)
// Last updated 7.4.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import {
  getNPMonthStr,
  getNPWeekStr,
  getTodaysDateUnhyphenated,
  // toLocaleDateString,
} from '@helpers/dateTime'
// import { toNPLocaleDateString } from '@helpers/NPdateTime'

const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone

//-----------------------------------------------------------
// Demo data for Today

let thisFilename: string = `${getTodaysDateUnhyphenated()}.md`
export const openTodayParas: Array<TParagraph> = [
  // $FlowIgnore[prop-missing]
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
  // $FlowIgnore[prop-missing]
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
export const refTodayParas: Array<TParagraph> = [
  // $FlowIgnore[prop-missing]
  {
    "priority": 1,
    "type": "open",
    "content": "! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht",
    "blockId": "^wazhht",
    "rawContent": "* ! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht",
    "prefix": "* ",
    "contentRange": {},
    "lineIndex": 8,
    "heading": "Start-up Formalities",
    "headingRange": {},
    "headingLevel": 3,
    "isRecurring": false,
    "indents": 0,
    "filename": "Ministry Projects/Repair Cafe.md",
    "noteType": "Notes",
    "linkedNoteTitles": [],
    "subItems": [],
    "referencedBlocks": [],
    "note": {}
  },
  // $FlowIgnore[prop-missing]
  {
    "priority": -1,
    "type": "open",
    "content": "Edit video from CFL visit https://bcfd.org.uk",
    "blockId": "^wazhht",
    "rawContent": "* Edit video from CFL visit https://bcfd.org.uk",
    "prefix": "* ",
    "contentRange": {},
    "lineIndex": 5,
    "heading": "",
    "headingLevel": -1,
    "isRecurring": false,
    "indents": 0,
    "filename": "CCC Areas/Mission Partners.md",
    "noteType": "Notes",
    "linkedNoteTitles": [],
    "subItems": [],
    "referencedBlocks": [],
    "note": {}
  },
]

// -------------------------------------------------------------------------
const yesterday = new moment().subtract(1, 'days').toDate()
thisFilename = `${moment(yesterday).format("YYYYMMDD")}.md`
export const openYesterdayParas: Array<TParagraph> = [
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
export const refYesterdayParas: Array<TParagraph> = [
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
    "referencedBlocks": [],
    "note": {}
  },
]

// -------------------------------------------------------------------------
const weekDateStr = getNPWeekStr(today)
thisFilename = `${weekDateStr}.md`
export const demoOpenWeekParas: Array<TParagraph> = [
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
    "referencedBlocks": [],
    "note": {}
  },
]
export const demoSortedWeekRefParas: Array<TParagraph> = [
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

// -------------------------------------------------------------------------
const monthDateStr = getNPMonthStr(today)
thisFilename = `${monthDateStr}.md`
export const openMonthParas: Array<TParagraph> = [
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
export const sortedMonthRefParas: Array<TParagraph> = [
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

//-----------------------------------------------------------
// Demo data for TagToShow section
export const tagParasFromNote = [
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

//-----------------------------------------------------------
// Notes to review
export const nextNotesToReview = [
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
