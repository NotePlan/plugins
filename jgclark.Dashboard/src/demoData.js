// @flow
//-----------------------------------------------------------------------------
// Demo data for Dashboard plugin v2
// Last updated 2024-09-27 for v2.0.6+ by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { Project } from '../../jgclark.Reviews/src/projectClass.js'
import type { TSectionItem } from './types'
import {
  getNPMonthStr,
  getNPWeekStr,
  getTodaysDateUnhyphenated,
  // toLocaleDateString,
} from '@helpers/dateTime'

const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone

//-----------------------------------------------------------
// Demo data for Today

let thisDateStr: string = getTodaysDateUnhyphenated()
let thisFilename: string = `${thisDateStr}.md`
export const openTodayItems: Array<TSectionItem> = [
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      noteType: 'Calendar',
      type: 'open',
      filename: thisFilename,
      title: thisDateStr,
      priority: 0,
      content: 'task with timeblock 10:00-11:30',
      rawContent: 'task with timeblock 10:00-11:30',
      prefix: '* ',
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: "open",
    para: {
      noteType: "Calendar",
      type: "open",
      filename: thisFilename,
      priority: 1,
      content: "reconcile bank statement @repeat(1m)",
      rawContent: "reconcile bank statement @repeat(1m)",
      prefix: "* ",
    }
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      noteType: 'Notes',
      type: 'open',
      filename: 'CCC Areas/Mission Partners.md',
      title: 'Mission Partners',
      priority: 0,
      content: 'Edit video from CFL visit https://bcfd.org.uk 14:30-15:30',
      rawContent: 'Edit video from CFL visit https://bcfd.org.uk 14:30-15:30',
      blockId: '^wazhht',
      prefix: '* ',
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'checklist',
    para: {
      noteType: 'Calendar',
      type: 'checklist',
      filename: thisFilename,
      priority: 0,
      content: 'check ==highlights==, `formatted` and ~~strike~~ text work OK',
      rawContent: 'check ==highlights==, `formatted` and ~~strike~~ text work OK',
      prefix: '* ',
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: "checklist",
    para: {
      noteType: "Calendar",
      type: "checklist",
      filename: thisFilename,
      priority: 0,
      content: "morning checklist 7:30AM",
      rawContent: "morning checklist 7:30AM",
      prefix: "+ ",
    }
  },
]
export const refTodayItems: Array<TSectionItem> = [
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Notes',
      filename: 'CCC Areas/Mission Partners.md',
      title: 'Mission Partners',
      priority: 0,
      content: 'Update display board 08:00-09:00',
      rawContent: 'Update display board 08:00-09:00',
      prefix: '* ',
      hasChild: true,
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: "open",
    para: {
      noteType: "Notes",
      title: 'Repair Café operation',
      filename: "Ministry Projects/Repair Café operation.md",
      type: "open",
      priority: 0,
      prefix: "* ",
      content: "Pay in cash from cafe 2:30PM",
      rawContent: "Pay in cash from cafe 2:30PM",
    }
  },
]

// -------------------------------------------------------------------------
const yesterday = new moment().subtract(1, 'days').toDate()
thisDateStr = moment(yesterday).format('YYYYMMDD')
thisFilename = `${thisDateStr}.md`
export const openYesterdayParas: Array<TSectionItem> = [
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      noteType: 'Calendar',
      type: 'open',
      filename: thisFilename,

      priority: 4,
      content: '>> #editvideo from CFL visit',
      rawContent: '>> #editvideo from CFL visit',
      prefix: '* ',
      hasChild: true,
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'checklist',
    para: {
      noteType: 'Calendar',
      type: 'checklist',
      filename: thisFilename,
      priority: 0,
      content: 'update contract for [[Staff Induction (SW)]] following review comments',
      rawContent: 'update contract for [[Staff Induction (SW)]] following review comments',
      prefix: '* ',
      hasChild: true,
    },
  },
]
export const refYesterdayParas: Array<TSectionItem> = [
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      noteType: 'Notes',
      type: 'open',
      filename: 'CCC Areas/Services.md',
      title: 'Services',
      priority: 1,
      content: 'write 5/3 sermon >2023-03-02',
      rawContent: 'write 5/3 sermon >2023-03-02',
      prefix: '* ',
      changedDate: new Date('2023-03-02T00:00:00.000Z'),
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      noteType: 'Notes',
      title: 'Repair Café operation',
      filename: "Ministry Projects/Repair Café operation.md",
      type: 'open',
      priority: 1,
      prefix: '* ',
      content: '! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht',
      rawContent: '! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht',
      blockId: '^wazhht',
      hasChild: true,
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Notes',
      filename: 'CCC Areas/Services.md',
      title: 'Services',
      content: 'write service leader segments plan Something Different for 5/3 >2023-03-02',
      rawContent: 'write service leader segments plan Something Different for 5/3 >2023-03-02',
      prefix: '* ',
      changedDate: new Date('2023-03-02T00:00:00.000Z'),
      priority: 1,
      hasChild: true,
    },
  },
]

// -------------------------------------------------------------------------
const tomorrow = new moment().add(1, 'days').toDate()
thisDateStr = moment(tomorrow).format('YYYYMMDD')
thisFilename = `${thisDateStr}.md`
export const openTomorrowParas: Array<TSectionItem> = [
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Calendar',
      filename: thisFilename,
      content: 'Clear more of prayer room @staff >today ^q9jzj4',
      rawContent: 'Clear more of prayer room @staff >today ^q9jzj4',
      prefix: '* ',
      priority: 0,
      blockId: '^q9jzj4',
      changedDate: new Date('2023-03-02T00:00:00.000Z'),
    },
  },
]
export const refTomorrowParas: Array<TSectionItem> = []

// -------------------------------------------------------------------------
const weekDateStr = getNPWeekStr(today)
thisFilename = `${weekDateStr}.md`
export const openWeekParas: Array<TSectionItem> = [
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Calendar',
      filename: thisFilename,
      priority: 2,
      content: '!! Arrange EV charger repair',
      rawContent: '!! Arrange EV charger repair',
      prefix: '+ ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Calendar',
      filename: thisFilename,
      priority: 0,
      content: ' Get login for https://www.waverleyabbeyresources.org/resources-home/',
      rawContent: ' Get login for https://www.waverleyabbeyresources.org/resources-home/',
      prefix: '* ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'checklist',
    para: {
      type: 'checklist',
      noteType: 'Calendar',
      filename: thisFilename,
      priority: 0,
      content: 'Contact @PeterS again',
      rawContent: 'Contact @PeterS again',
      prefix: '+ ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Calendar',
      filename: thisFilename,
      content: '@church Get iPad working on ChurchOffice-staff for Drive, Printing @church ^bzlp1z',
      rawContent: '@church Get iPad working on ChurchOffice-staff for Drive, Printing @church ^bzlp1z',
      blockId: '^bzlp1z',
      priority: 0,
      prefix: '* ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
      hasChild: true,
    },
  },
]
export const refWeekParas: Array<TSectionItem> = [
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'checklist',
    para: {
      type: 'checklist',
      noteType: 'Calendar',
      filename: thisFilename,
      priority: 0,
      content: 'Test multi-part hashtags: #project/companyA and #one/two/three >2023-W09',
      rawContent: 'Test multi-part hashtags: #project/companyA and #one/two/three >2023-W09',
      prefix: '+ ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Notes',
      filename: 'Home 🏠 Areas/Garden.md',
      title: 'Garden 🌿',
      priority: 0,
      content: 'Re-plant two shrubs in new blue pots >2023-W09',
      rawContent: 'Re-plant two shrubs in new blue pots >2023-W09',
      prefix: '* ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'checklist',
    para: {
      type: 'checklist',
      noteType: 'Notes',
      filename: 'Home 🏠 Areas/Macs.md',
      title: 'Macs 🖥',
      priority: 0,
      content: 'Backup Mac - with an arrow date >2023-W09< reference',
      rawContent: 'Backup Mac - with an arrow date >2023-W09< reference',
      prefix: '+ ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
    },
  },
]

// -------------------------------------------------------------------------
const monthDateStr = getNPMonthStr(today)
thisFilename = `${monthDateStr}.md`
export const openMonthParas: Array<TSectionItem> = [
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Calendar',
      filename: thisFilename,
      priority: 0,
      content: 'Investigate alternative milkman',
      rawContent: 'Investigate alternative milkman',
      prefix: '* ',
    },
  },
]
export const refMonthParas: Array<TSectionItem> = [
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Notes',
      filename: 'Home 🏠 Areas/Tax Returns.md',
      title: 'Tax Returns',
      priority: 1,
      content: 'Pay tax bill',
      rawContent: 'Pay tax bill',
      prefix: '* ',
    },
  },
]

//-----------------------------------------------------------
// Demo data for TagToShow section

export const tagParasFromNote: Array<TSectionItem> = [
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'checklist',
    para: {
      type: 'checklist',
      noteType: 'Notes',
      filename: 'TEST/DEMOs/Test Project A.md',
      content: 'Open Deliveroo account #next',
      rawContent: 'Open Deliveroo account #next',
      prefix: '+ ',
      priority: 0,
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Notes',
      filename: 'CCC Areas/Finance.md',
      content: 'Make expenses claim #next',
      rawContent: 'Make expenses claim #next',
      prefix: '* ',
      priority: 0,
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'checklist',
      noteType: 'Notes',
      filename: 'TEST/DEMOs/Test Project A.md',
      content: 'Checklist item that can be hidden #test',
      rawContent: 'Checklist item that can be hidden #test',
      prefix: '+ ',
      priority: 0,
    },
  },
]

//-----------------------------------------------------------
// Notes to review
// Note: uses newer Project-based objects now, not the earlier TNote-based demo data
export const nextProjectNoteItems: Array<Project> = [
// $FlowIgnore[incompatible-type]
  {
    filename: 'CCC Projects/Facilities/Hearing Support.md',
    title: 'Hearing Support at CCC',
    reviewInterval: "1m",
    percentComplete: 23,
    lastProgressComment: "Checked our equipment and its OK; looking for acoustician"
  },
  // $FlowIgnore[incompatible-type]
  {
    filename: 'Home 🏠 Projects/Streamdeck setup.md',
    title: 'Streaming Platform',
    reviewInterval: "1w",
    percentComplete: 82,
  },
  // $FlowIgnore[incompatible-type]
  {
    filename: 'CCC Projects/Pastoral Cards.md',
    title: 'Pastoral Cards',
    reviewInterval: "2m",
  },
]
