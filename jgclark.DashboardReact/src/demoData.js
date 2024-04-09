// @flow
//-----------------------------------------------------------------------------
// Demo data for Dashboard plugin (for v2.0.0+)
// Last updated 7.4.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import type { TParagraphForDashboard } from './types'
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

let thisDateStr: string = getTodaysDateUnhyphenated()
let thisFilename: string = `${thisDateStr}.md`
export const openTodayParas: Array<TParagraphForDashboard> = [
  {
    "priority": 4,
    "type": "open",
    "content": ">> #editvideo from CFL visit",
    // "rawContent": "* >> #editvideo from CFL visit",
    "prefix": "* ",
    // "lineIndex": 4,
    // "heading": "",
    // "headingLevel": -1,
    // "isRecurring": false,
    // "indents": 0,
    "filename": thisFilename,
    "noteType": "Calendar",
    // "subItems": [],
    "title": thisDateStr
  },
  {
    "priority": -1,
    "type": "checklist",
    "content": "check ==highlights==, `formatted` and ~~strike~~ text work OK",
    // "rawContent": "+ check ==highlights==, `formatted` and ~~strike~~ text work OK",
    "prefix": "+ ",
    // "lineIndex": 5,
    // "heading": "",
    // "headingLevel": -1,
    // "isRecurring": false,
    // "indents": 0,
    "filename": thisFilename,
    "noteType": "Calendar",
    // "subItems": [],
    "title": thisDateStr
  }
]
export const refTodayParas: Array<TParagraphForDashboard> = [
  {
    "priority": 1,
    "type": "open",
    "content": "! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht",
    "blockId": "^wazhht",
    // "rawContent": "* ! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht",
    "prefix": "* ",
    // "lineIndex": 8,
    // "heading": "Start-up Formalities",
    // "headingLevel": 3,
    // "isRecurring": false,
    // "indents": 0,
    "filename": "Ministry Projects/Repair Cafe.md",
    "noteType": "Notes",
    // "subItems": [],
    "title": "Repair Cafe"
  },
  {
    "priority": -1,
    "type": "open",
    "content": "Edit video from CFL visit https://bcfd.org.uk",
    "blockId": "^wazhht",
    // "rawContent": "* Edit video from CFL visit https://bcfd.org.uk",
    "prefix": "* ",
    // "lineIndex": 5,
    // "heading": "",
    // "headingLevel": -1,
    // "isRecurring": false,
    // "indents": 0,
    "filename": "CCC Areas/Mission Partners.md",
    "noteType": "Notes",
    // "subItems": [],
    "title": "Mission Partners"
  },
]

// -------------------------------------------------------------------------
const yesterday = new moment().subtract(1, 'days').toDate()
thisDateStr = moment(yesterday).format("YYYYMMDD")
thisFilename = `${thisDateStr}.md`
export const openYesterdayParas: Array<TParagraphForDashboard> = [
  {
    "priority": 0,
    "type": "open",
    "content": "film video at CFL visit",
    // "rawContent": "* film video at CFL visit",
    "prefix": "* ",
    // "lineIndex": 4,
    // "heading": "",
    // "headingLevel": -1,
    // "isRecurring": false,
    // "indents": 0,
    "filename": thisFilename,
    "noteType": "Calendar",
    // "subItems": [],
    "title": thisDateStr
  },
  {
    "priority": -1,
    "type": "checklist",
    "content": "update SW contract following review comments",
    // "rawContent": "* update SW contract following review comments",
    "prefix": "* ",
    // "lineIndex": 5,
    // "heading": "",
    // "headingLevel": -1,
    // "isRecurring": false,
    // "indents": 0,
    "filename": thisFilename,
    "noteType": "Calendar",
    // "subItems": [],
    "title": thisDateStr
  }
]
export const refYesterdayParas: Array<TParagraphForDashboard> = [
  {
    "priority": 1,
    "type": "open",
    "content": "write 5/3 sermon >2023-03-02",
    // "rawContent": "* write 5/3 sermon >2023-03-02",
    "prefix": "* ",
    // "lineIndex": 87,
    "changedDate": new Date("2023-03-02T00:00:00.000Z"),
    // "heading": "5/3/2023 CCC service @2023-03-05",
    // "headingLevel": 3,
    // "isRecurring": false,
    // "indents": 0,
    "filename": "CCC Areas/Services.md",
    "noteType": "Notes",
    // "subItems": [],
    "title": "Services"
  },
  {
    "priority": 1,
    "type": "open",
    "content": "write service leader segments plan Something Different for 5/3 >2023-03-02",
    // "rawContent": "* write service leader segments plan Something Different for 5/3 >2023-03-02",
    "prefix": "* ",
    // "lineIndex": 89,
    "changedDate": new Date("2023-03-02T00:00:00.000Z"),
    // "heading": "5/3/2023 CCC service @2023-03-05",
    // "headingLevel": 3,
    // "isRecurring": false,
    // "indents": 0,
    "filename": "CCC Areas/Services.md",
    "noteType": "Notes",
    // "subItems": [],
    "title": "Services"
  },
  {
    "priority": -1,
    "type": "open",
    "content": "Clear more of prayer room @staff >today ^q9jzj4",
    "blockId": "^q9jzj4",
    // "rawContent": "* Clear more of prayer room @staff >today ^q9jzj4",
    "prefix": "* ",
    // "lineIndex": 29,
    "changedDate": new Date("2023-03-02T00:00:00.000Z"),
    // "heading": "Staff Meeting",
    // "headingLevel": 3,
    // "isRecurring": false,
    // "indents": 0,
    "filename": "20240213.md",
    "noteType": "Calendar",
    // "subItems": [],
    "title": "20240213"
  },
]

// -------------------------------------------------------------------------
const weekDateStr = getNPWeekStr(today)
thisFilename = `${weekDateStr}.md`
export const demoOpenWeekParas: Array<TParagraphForDashboard> = [
  {
    "priority": 2,
    "type": "open",
    "content": "!! Arrange EV charger repair",
    // "rawContent": "* !! Arrange EV charger repair",
    "prefix": "+ ",
    // "lineIndex": 2,
    "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    // "heading": "",
    // "headingLevel": -1,
    // "isRecurring": false,
    // "indents": 0,
    "filename": thisFilename,
    "noteType": "Calendar",
    // "subItems": [],
    "title": weekDateStr
  },
  {
    "priority": -1,
    "type": "open",
    "content": " Get login for https://www.waverleyabbeyresources.org/resources-home/",
    // "rawContent": "* Get login for https://www.waverleyabbeyresources.org/resources-home/",
    "prefix": "* ",
    // "lineIndex": 3,
    "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    // "heading": "",
    // "headingLevel": -1,
    // "isRecurring": false,
    // "indents": 0,
    "filename": thisFilename,
    "noteType": "Calendar",
    // "subItems": [],
    "title": weekDateStr
  },
  {
    "priority": -1,
    "type": "checklist",
    "content": "Contact @PeterS again",
    // "rawContent": "+ Contact @PeterS again",
    "prefix": "+ ",
    // "lineIndex": 4,
    "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    // "heading": "",
    // "headingLevel": -1,
    // "isRecurring": false,
    // "indents": 0,
    "filename": thisFilename,
    "noteType": "Calendar",
    // "subItems": [],
    "title": weekDateStr
  },
  {
    "priority": -1,
    "type": "open",
    "content": "@church Get iPad working on ChurchOffice-staff for Drive, Printing @church ^bzlp1z",
    "blockId": "^bzlp1z",
    // "rawContent": "* @church Get iPad working on ChurchOffice-staff for Drive, Printing @church ^bzlp1z",
    "prefix": "* ",
    // "lineIndex": 5,
    "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    // "heading": "",
    // "headingLevel": -1,
    // "isRecurring": false,
    // "indents": 0,
    "filename": thisFilename,
    "noteType": "Calendar",
    // "subItems": [],
    "title": weekDateStr
  },
]
export const demoSortedWeekRefParas: Array<TParagraphForDashboard> = [
  {
    "priority": -1,
    "type": "checklist",
    "content": "Send @Linda a link to welcome presentation >2023-W09",
    // "rawContent": "+ Send @Linda a link to welcome presentation >2023-W09",
    "prefix": "+ ",
    // "lineIndex": 18,
    "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    // "heading": "Pastoral Coordination #meeting (11:30) [Meeting Note](noteplan://x-callback-url/runPlugin?pluginID=np.MeetingNotes&command=newMeetingNoteFromEventID&arg0=14A3903A-9972-47F9-BBFC-1F93FC80DF21&arg1=)",
    // "headingLevel": 3,
    // "isRecurring": false,
    // "indents": 0,
    "filename": "CCC Areas/Pastoral.md",
    "noteType": "Notes",
    // "subItems": [],
    "title": "Pastoral"
  },
  {
    "priority": -1,
    "type": "open",
    "content": "Re-plant two shrubs in new blue pots >2023-W09",
    // "rawContent": "* Re-plant two shrubs in new blue pots >2023-W09",
    "prefix": "* ",
    // "lineIndex": 10,
    "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    // "heading": "To discuss with Andy",
    // "headingLevel": 3,
    // "isRecurring": false,
    // "indents": 0,
    "filename": "Home 🏠 Areas/Garden.md",
    "noteType": "Notes",
    // "subItems": [],
    "title": "Gardening"
  },
  {
    "priority": -1,
    "type": "checklist",
    "content": "Backup Mac - with an arrow date >2023-W09< reference",
    // "rawContent": "+ Backup Mac - with an arrow date >2023-W09< reference",
    "prefix": "+ ",
    // "lineIndex": 12,
    "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    // "heading": "Backups",
    // "headingLevel": 3,
    // "isRecurring": false,
    // "indents": 0,
    "filename": "Home 🏠 Areas/Macs.md",
    "noteType": "Notes",
    // "subItems": [],
    "title": "Macs"
  },
]

// -------------------------------------------------------------------------
const monthDateStr = getNPMonthStr(today)
thisFilename = `${monthDateStr}.md`
export const openMonthParas: Array<TParagraphForDashboard> = [
  {
    "priority": 0,
    "type": "open",
    "content": "Investigate alternative milkman",
    // "rawContent": "* Investigate alternative milkman",
    "prefix": "* ",
    // "lineIndex": 0,
    // "heading": "",
    // "headingLevel": -1,
    // "isRecurring": false,
    // "indents": 0,
    "filename": thisFilename,
    "noteType": "Calendar",
    // "subItems": [],
    "title": monthDateStr
  },
]
export const sortedMonthRefParas: Array<TParagraphForDashboard> = [
  {
    "priority": 1,
    "type": "open",
    "content": "Pay tax bill",
    // "rawContent": "* Pay tax bill",
    "prefix": "* ",
    // "lineIndex": 0,
    // "heading": "",
    // "headingLevel": -1,
    // "isRecurring": false,
    // "indents": 0,
    "filename": "Home 🏠 Areas/Tax Returns.md",
    "noteType": "Notes",
    // "subItems": [],
    "title": "Tax Returns"
  },
]

//-----------------------------------------------------------
// Demo data for TagToShow section
export const tagParasFromNote = [
  {
    "type": "checklist",
    "content": "Open Deliveroo account #next",
    // "rawContent": "+ Open Deliveroo account #next",
    "title": "Test Project A",
    "filename": "TEST/DEMOs/Test Project A.md",
  },
  {
    "type": "open",
    "content": "Make expenses claim #next",
    // "rawContent": "* Make expenses claim #next",
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
