// @flow
//-----------------------------------------------------------------------------
// Demo data for Dashboard plugin (for v2.0.0+)
// Last updated 2024-09-20 for v2.1.0.a12 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import type { TSectionItem } from './types'
import {
  getNPMonthStr,
  getNPWeekStr,
  getTodaysDateUnhyphenated,
  // toLocaleDateString,
} from '@helpers/dateTime'
// import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { logDebug } from '@helpers/dev'

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
      content: 'before bed routine 🛌 22:00-22:30',
      rawContent: 'before bed routine 🛌 22:00-22:30',
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
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
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
    }
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
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
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
      content: "morning @home 🏠 routine 6:30AM",
      rawContent: "morning @home 🏠 routine 6:30AM",
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
    }
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: "checklist",
    para: {
      noteType: "Calendar",
      type: "checklist",
      filename: thisFilename,
      priority: 0,
      content: "morning #work checklist 7:30AM",
      rawContent: "morning #work checklist 7:30AM",
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
    }
  },
]
export const refTodayItems: Array<TSectionItem> = [
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
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
      blockId: '^wazhht',
    },
  },
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
      indentLevel: 0,
      isAChild: false,
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
      content: "Pay in cash from cafe 2:30PM",
      rawContent: "Pay in cash from cafe 2:30PM",
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
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
      content: '>> #editvideo from CFL visit @work',
      rawContent: '>> #editvideo from CFL visit @work',
      indentLevel: 0,
      isAChild: false,
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
      indentLevel: 0,
      isAChild: false,
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
      rawContent: '* write 5/3 sermon >2023-03-02',
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
      changedDate: new Date('2023-03-02T00:00:00.000Z'),
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
      content: '  create 5/3 sermon presentation >2023-03-02',
      rawContent: '  * create 5/3 sermon presentation >2023-03-02',
      indentLevel: 1,
      isAChild: true,
      hasChild: false,
      changedDate: new Date('2023-03-02T00:00:00.000Z'),
      priority: 1,
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
      content: '! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht',
      rawContent: '* ! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht',
      indentLevel: 0,
      isAChild: false,
      hasChild: true,
      blockId: '^wazhht',
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
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
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
      priority: 0,
      content: ' Get login for https://www.waverleyabbeyresources.org/resources-home/',
      rawContent: ' Get login for https://www.waverleyabbeyresources.org/resources-home/',
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
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
      indentLevel: 0,
      isAChild: false,
      hasChild: true,
      blockId: '^bzlp1z',
      priority: 0,
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
    },
  },
]
export const refWeekParas: Array<TSectionItem> = [
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Calendar',
      filename: 'Home 🏠 Areas/Car and Bike.md',
      priority: 2,
      content: '!! Arrange EV charger repair',
      rawContent: '!! Arrange EV charger repair',
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
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
      content: 'Test multi-part hashtags: #project/companyA and #one/two/three >2023-W09',
      rawContent: 'Test multi-part hashtags: #project/companyA and #one/two/three >2023-W09',
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
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
      content: 'Re-plant two shrubs in new blue pots @home >2023-W09',
      rawContent: 'Re-plant two shrubs in new blue pots @home >2023-W09',
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
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
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
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
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
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
      indentLevel: 0,
      isAChild: false,
      hasChild: false,
    },
  },
]

//-----------------------------------------------------------
// Demo data for TagToShow section

export const demoTaggedSectionDetails = [
  {
    sectionCode: 'TAG',
    sectionName: '#home',
    showSettingName: 'showTagSection_#home',
  },
  {
    sectionCode: 'TAG',
    sectionName: '@work',
    showSettingName: 'showTagSection_@work',
  },
]

export const demoTaggedParas: Array<TParagraph> = [
  // $FlowIgnore[prop-missing] ID gets added later
  {
    type: 'checklist',
    noteType: 'Notes',
    filename: 'TEST/DEMOs/Test Project A.md',
    content: 'Open Deliveroo account #next #home',
    rawContent: 'Open Deliveroo account #next  #home',
    indentLevel: 0,
    priority: 0,
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    type: 'checklist',
    noteType: 'Notes',
    filename: 'TEST/DEMOs/Test Project A.md',
    content: '#home Checklist ⛔️ that should be filtered out #waiting #next',
    rawContent: '#home Checklist ⛔️ that should be filtered out #waiting #next',
    indentLevel: 0,
    priority: 0,
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    type: 'open',
    noteType: 'Notes',
    filename: 'TEST/DEMOs/Test Project A.md',
    content: '#home Future task ⛔️ that should be filtered out #next >2099-W09',
    rawContent: '#home Future task ⛔️ that should be filtered out #next >2099-W09',
    indentLevel: 0,
    priority: 0,
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    type: 'open',
    noteType: 'Calendar',
    filename: thisFilename,
    content: '@work Get iPad working on ChurchOffice-staff for printing etc. @church ^bzlp1z',
    rawContent: '@work Get iPad working on ChurchOffice-staff for printing etc. @church ^bzlp1z',
    indentLevel: 0,
    priority: 0,
    blockId: '^bzlp1z',
    hasChild: true,
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    type: 'open',
    noteType: 'Notes',
    filename: 'CCC Areas/Finance.md',
    content: 'Make expenses claim @work',
    rawContent: 'Make expenses claim @work',
    indentLevel: 0,
    priority: 0,
  },
]

//-----------------------------------------------------------
// Project Notes to review
// Note: These are all overloaded for ease
export const nextProjectNoteItems: Array<TNote> = [
  // $FlowIgnore[prop-missing]
  {
    filename: 'CCC Projects/Facilities/Hearing Support.md',
    title: 'Hearing Support at CCC',
    reviewInterval: "1m",
    percentComplete: 23,
    lastProgressComment: "Checked our equipment and its OK; looking for acoustician",
    nextReviewDays: 10,
  },
  // $FlowIgnore[prop-missing]
  {
    filename: 'Home 🏠 Projects/Streamdeck setup.md',
    title: 'Streaming Platform',
    reviewInterval: "1w",
    percentComplete: 82,
    nextReviewDays: 6,
  },
  // $FlowIgnore[prop-missing]
  {
    filename: 'CCC Projects/Pastoral Cards.md',
    title: 'Pastoral Cards',
    reviewInterval: "2m",
    nextReviewDays: 20,
  },
]

//-----------------------------------------------------------
// Overdue Items
export function makeDummyOverdueItems(extension: string): Array<TParagraph> {
  // Note: to make the same processing as the real data, this is done only in terms of extended paras
  const outputParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
  for (let c = 1; c < 61; c++) {
    const thisType = c % 3 === 0 ? 'checklist' : 'open'
    const priorityPrefix = c % 20 === 0 ? '!!! ' : c % 10 === 0 ? '!! ' : c % 5 === 0 ? '! ' : ''
    const fakeDateMom = new moment('2023-10-01').add(c, 'days')
    const fakeIsoDateStr = fakeDateMom.format('YYYY-MM-DD')
    const fakeFilenameDateStr = fakeDateMom.format('YYYYMMDD')
    const fakeFolder = c % 2 < 1 ? 'Home Projects' : 'Work Projects'
    const filename = c % 3 < 2 ? `${fakeFilenameDateStr}.${extension}` : `${fakeFolder}/fake_note_${String(c % 7)}.${extension}`
    const noteType = c % 3 < 2 ? 'Calendar' : 'Notes'
    const content = `${priorityPrefix}test overdue item ${c}${c % 8 === 0 ? ' #waiting❗️ ' : ''} >${fakeIsoDateStr}`
    outputParas.push({
      filename: filename,
      content: content,
      rawContent: `${thisType === 'open' ? '*' : '+'} ${priorityPrefix}${content}`,
      indentLevel: 0,
      type: thisType,
      note: {
        filename: filename,
        title: `Test Note ${c % 10}`,
        type: noteType,
        changedDate: fakeDateMom.toDate(),
      },
      children: [],
    })
  }
  return outputParas
}

//-----------------------------------------------------------
// Priority Items
export function makeDummyPriorityItems(extension: string): Array<TParagraph> {
  // Note: to make the same processing as the real data, this is done only in terms of extended paras
  const outputParas: Array<any> = [] // can't be typed to TParagraph as the useDemoData code writes to what would be read-only properties
  for (let c = 1; c < 31; c++) {
    // const thisID = `${sectionNum}-${String(c)}`
    const thisType = c % 3 === 0 ? 'checklist' : 'open'
    const priorityPrefix = c % 20 === 0 ? '>> ' : c % 10 === 0 ? '!!! ' : c % 5 === 0 ? '!! ' : '! '
    const fakeDateMom = new moment('2023-10-01').add(c, 'days')
    const fakeIsoDateStr = fakeDateMom.format('YYYY-MM-DD')
    const fakeFilenameDateStr = fakeDateMom.format('YYYYMMDD')
    const filename = c % 3 < 2 ? `${fakeFilenameDateStr}.${extension}` : `fake_note_${String(c % 7)}.${extension}`
    const type = c % 3 < 2 ? 'Calendar' : 'Notes'
    const content = `${priorityPrefix}test priority item ${c}${c % 8 === 0 ? ' #waiting❗️ ' : ''}>${fakeIsoDateStr}`
    outputParas.push({
      filename: filename,
      content: content,
      rawContent: `${thisType === 'open' ? '*' : '+'} ${priorityPrefix}${content}`,
      indentLevel: 0,
      type: thisType,
      note: {
        filename: filename,
        title: `Test Note ${c % 10}`,
        type: type,
        changedDate: fakeDateMom.toDate(),
      },
      children: [],
    })
  }
  return outputParas
}
