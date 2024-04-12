// @flow
//-----------------------------------------------------------------------------
// Demo data for Dashboard plugin (for v2.0.0+)
// Last updated 12.4.2024 for v2.0.0 by @jgclark
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
export const openTodayItems: Array<TSectionItem> = [
  {
    "itemFilename": thisFilename,
    "itemNotetitle": thisDateStr,
    "noteType": "Calendar",
    "itemType": "open",
    "para": {
      "priority": 4,
      "content": ">> #editvideo from CFL visit",
      "prefix": "* ",
    }
  },
  {
    "itemFilename": thisFilename,
    "itemNotetitle": thisDateStr,
    "noteType": "Calendar",
    "itemType": "checklist",
    "para": {
      "priority": -1,
      "content": "check ==highlights==, `formatted` and ~~strike~~ text work OK",
      "prefix": "+ ",
    }
  }
]
export const refTodayItems: Array<TSectionItem> = [
  {
    "itemFilename": "Ministry Projects/Repair Cafe.md",
    "itemNoteTitle": "Repair Cafe",
    "noteType": "Notes",
    "itemType": "open",
    "para": {
      "priority": 1,
      "prefix": "* ",
      "content": "! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht",
      "blockId": "^wazhht",
    }
  },
  {
    "itemFilename": "CCC Areas/Mission Partners.md",
    "itemNoteTitle": "Mission Partners",
    "noteType": "Notes",
    "itemType": "open",
    "para": {
      "priority": -1,
      "content": "Edit video from CFL visit https://bcfd.org.uk",
      "blockId": "^wazhht",
      "prefix": "* ",
    }
  },
]

// -------------------------------------------------------------------------
const yesterday = new moment().subtract(1, 'days').toDate()
thisDateStr = moment(yesterday).format("YYYYMMDD")
thisFilename = `${thisDateStr}.md`
export const openYesterdayParas: Array<TSectionItem> = [
  {
    "itemNoteTitle": thisDateStr,
    "itemType": "open",
    "itemFilename": thisFilename,
    "noteType": "Calendar",
    "para": {
      "priority": 0,
      "content": "film video at CFL visit",
      "prefix": "* ",
    }
  },
  {
    "itemFilename": thisFilename,
    "itemType": "checklist",
    "noteType": "Calendar",
    "itemNoteTitle": thisDateStr,
    "para": {
      "priority": -1,
      "content": "update SW contract following review comments",
      "prefix": "* ",
    }
  }
]
export const refYesterdayParas: Array<TSectionItem> = [
  {
    "itemType": "open",
    "noteType": "Notes",
    "itemNoteTitle": "Services",
    "itemFilename": "CCC Areas/Services.md",
    "para": {
      "priority": 1,
      "content": "write 5/3 sermon >2023-03-02",
      "prefix": "* ",
      "changedDate": new Date("2023-03-02T00:00:00.000Z"),
    }
  },
  {
    "priority": 1,
    "itemType": "open",
    "itemFilename": "CCC Areas/Services.md",
    "itemNoteTitle": "Services",
    "noteType": "Notes",
    "para": {
      "content": "write service leader segments plan Something Different for 5/3 >2023-03-02",
      "prefix": "* ",
      "changedDate": new Date("2023-03-02T00:00:00.000Z"),
    },
  },
  {
    "itemType": "open",
    "itemFilename": "20240213.md",
    "noteType": "Calendar",
    "itemNoteTitle": "20240213",
    "para": {
      "content": "Clear more of prayer room @staff >today ^q9jzj4",
      "prefix": "* ",
      "priority": -1,
      "blockId": "^q9jzj4",
      "changedDate": new Date("2023-03-02T00:00:00.000Z"),
    },
  },
]

// -------------------------------------------------------------------------
const weekDateStr = getNPWeekStr(today)
thisFilename = `${weekDateStr}.md`
export const openWeekParas: Array<TSectionItem> = [
  {
    "itemType": "open",
    "itemNoteTitle": weekDateStr,
    "itemFilename": thisFilename,
    "noteType": "Calendar",
    "para": { 
      "priority": 2,
      "content": "!! Arrange EV charger repair",
      "prefix": "+ ",
      "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    },
  },
  {
    "itemType": "open",
    "itemFilename": thisFilename,
    "noteType": "Calendar",
    "itemNoteTitle": weekDateStr,
    "para": { 
      "priority": -1,
      "content": " Get login for https://www.waverleyabbeyresources.org/resources-home/",
      "prefix": "* ",
      "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    },
  },
  {
    "itemType": "checklist",
    "itemFilename": thisFilename,
    "noteType": "Calendar",
    "itemNoteTitle": weekDateStr,
    "para": { 
      "priority": -1,
      "content": "Contact @PeterS again",
      "prefix": "+ ",
      "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    },
  },
  {
    "itemType": "open",
    "itemFilename": thisFilename,
    "noteType": "Calendar",
    "itemNoteTitle": weekDateStr,
    "para": { 
    "content": "@church Get iPad working on ChurchOffice-staff for Drive, Printing @church ^bzlp1z",
      "blockId": "^bzlp1z",
      "priority": -1,
      "prefix": "* ",
    "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    },
  },
]
export const refWeekParas: Array<TSectionItem> = [
  {
    "itemType": "checklist",
    "itemFilename": "CCC Areas/Pastoral.md",
    "noteType": "Notes",
    "itemNoteTitle": "Pastoral",
    "para": { 
      "priority": -1,
      "content": "Send @Linda a link to welcome presentation >2023-W09",
      "prefix": "+ ",
      "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    },
  },
  {
    "itemType": "open",
    "itemFilename": "Home 🏠 Areas/Garden.md",
    "noteType": "Notes",
    "itemNoteTitle": "Gardening",
    "para": { 
      "priority": -1,
      "content": "Re-plant two shrubs in new blue pots >2023-W09",
      "prefix": "* ",
      "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    },
  },
  {
    "itemType": "checklist",
    "itemFilename": "Home 🏠 Areas/Macs.md",
    "noteType": "Notes",
    "itemNoteTitle": "Macs",
    "para": { 
      "priority": -1,
      "content": "Backup Mac - with an arrow date >2023-W09< reference",
      "prefix": "+ ",
      "changedDate": new Date("2023-02-27T00:00:00.000Z"),
    },
  },
]

// -------------------------------------------------------------------------
const monthDateStr = getNPMonthStr(today)
thisFilename = `${monthDateStr}.md`
export const openMonthParas: Array<TSectionItem> = [
  {
    "priority": 0,
    "itemType": "open",
    "itemNoteTitle": monthDateStr,
    "noteType": "Calendar",
    "para": {
      "content": "Investigate alternative milkman",
      "prefix": "* ",
      "itemFilename": thisFilename,
    },
  },
]
export const refMonthParas: Array<TSectionItem> = [
  {
    "itemType": "open",
    "itemNoteTitle": "Tax Returns",
    "itemFilename": "Home 🏠 Areas/Tax Returns.md",
    "noteType": "Notes",
    "para": {
      "priority": 1,
      "content": "Pay tax bill",
      "prefix": "* ",
    },
  },
]

//-----------------------------------------------------------
// Demo data for TagToShow section
export const tagParasFromNote: Array<TSection> = [
  {
    "itemType": "checklist",
    "itemFilename": "TEST/DEMOs/Test Project A.md",
    "itemNoteTitle": "Test Project A",
    "para": {
    "content": "Open Deliveroo account #next",
      "prefix": "* ",
      "priority": 0,
    }
  },
  {
    "itemType": "open",
    "itemFilename": "CCC Areas/Finance.md",
    "itemNoteTitle": "Finance",
    "para": {
    "content": "Make expenses claim #next",
      "prefix": "* ",
      "priority": 0,
    }
  }
]

//-----------------------------------------------------------
// Notes to review
export const nextProjectNotesToReview: Array<TSection> = [
  {
    "itemType": "review",
    "itemFilename": "CCC Projects/Facilities/Hearing Support.md",
    "type": "Notes",
    "itemNoteTitle": "Hearing Support at CCC",
    "changedDate": "2023-02-28T13:11:30.000Z",
  },
  {
    "itemType": "review",
    "itemFilename": "Home 🏠 Projects/Streamdeck setup.md",
    "type": "Notes",
    "itemNoteTitle": "Streaming Platform",
    "changedDate": "2023-02-27T10:56:35.000Z",
  },
  {
    "itemType": "review",
    "itemFilename": "CCC Projects/Pastoral Cards.md",
    "type": "Notes",
    "itemNoteTitle": "Pastoral Cards",
    "changedDate": "2022-09-05T11:13:21.963Z",
  },
]
