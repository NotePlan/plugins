// @flow
//-----------------------------------------------------------------------------
// Demo data for Dashboard plugin
// Last updated 2025-07-18 for v2.3.0.b6 by @jgclark
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
// Demo Teamspace definitions

export const demoTeamspaces: Array<TTeamspace> = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Repair Café',
  },
]

//-----------------------------------------------------------
// Demo data for Today

let thisDateStr: string = getTodaysDateUnhyphenated()
let thisFilename: string = `${thisDateStr}.md`
export const openTodayItems: Array<TSectionItem> = [
  {
    ID: '0-0',
    itemType: 'open',
    para: {
      noteType: 'Calendar',
      type: 'open',
      filename: thisFilename,
      lineIndex: 0,
      title: thisDateStr,
      priority: 0,
      content: 'silly long timeblocked task at 10:00-23:30',
      rawContent: 'silly long timeblocked task at 10:00-11:30',
      prefix: '* ',
      indents: 0,
    },
  },
  {
    ID: '0-1',
    itemType: 'open',
    para: {
      noteType: 'Calendar',
      type: 'open',
      filename: thisFilename,
      lineIndex: 2,
      priority: 1,
      content: 'reconcile bank statement @repeat(1m) at 20:00-23:00',
      rawContent: 'reconcile bank statement @repeat(1m) at 20:00-23:00',
      prefix: '* ',
      indents: 0,
    },
  },
  {
    ID: '0-2',
    itemType: 'checklist',
    para: {
      noteType: 'Calendar',
      type: 'checklist',
      filename: thisFilename,
      lineIndex: 3,
      priority: 0,
      content: 'check ==highlights==, `formatted` and ~~strike~~ text work OK',
      rawContent: 'check ==highlights==, `formatted` and ~~strike~~ text work OK',
      prefix: '* ',
      indents: 0,
    },
  },
  {
    ID: '0-3',
    itemType: 'checklist',
    para: {
      noteType: 'Calendar',
      type: 'checklist',
      filename: thisFilename,
      lineIndex: 4,
      priority: 0,
      content: 'morning checklist 7:30AM',
      rawContent: 'morning checklist 7:30AM',
      prefix: '+ ',
      indents: 0,
    },
  },
  {
    ID: '0-4',
    itemType: 'checklist',
    para: {
      noteType: 'Calendar',
      type: 'list', // Note: this is a list, not an open item
      filename: thisFilename,
      lineIndex: 5,
      priority: 0,
      content: 'bullet with a time block at 11:30-12:30',
      rawContent: 'bullet with a time block at 11:30-12:30',
      prefix: '- ',
      indents: 0,
    },
  },
  {
    ID: '0-5',
    itemType: 'open',
    teamspaceTitle: 'Repair Café',
    para: {
      noteType: 'Calendar',
      type: 'open',
      filename: `%%NotePlanCloud%%/${demoTeamspaces[0].id}/${thisFilename}`,
      lineIndex: 5,
      priority: 0,
      content: 'Order printing of new leaflets',
      rawContent: 'Order printing of new leaflets',
      prefix: '* ',
      indents: 0,
    },
  },
]
export const refTodayItems: Array<TSectionItem> = [
  {
    ID: '1-0',
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Notes',
      filename: 'CCC Areas/Mission Partners.md',
      lineIndex: 5,
      title: 'Mission Partners',
      priority: 0,
      content: 'Update display board with CFL visit https://bcfd.org.uk/ at 08:00-10:00',
      rawContent: 'Update display board with CFL visit https://bcfd.org.uk/ at 08:00-10:00',
      prefix: '* ',
      hasChild: true,
      indents: 0,
    },
  },
  {
    ID: '1-1',
    itemType: 'open',
    teamspaceTitle: 'Repair Café',
    para: {
      noteType: 'Notes',
      title: 'Repair Café operation',
      filename: `%%NotePlanCloud%%/${demoTeamspaces[0].id}/bd119556-9244-4012-ba5d-16c22ac5746c`,
      lineIndex: 10,
      type: 'open',
      priority: 0,
      prefix: '* ',
      content: 'Pay in cash from cafe 2:30PM',
      rawContent: 'Pay in cash from cafe 2:30PM',
      indents: 0,
    },
  },
  {
    ID: '1-2',
    teamspaceTitle: 'Repair Café',
    itemType: 'open',
    para: {
      noteType: 'Notes',
      title: 'Repair Café operation',
      filename: `%%NotePlanCloud%%/${demoTeamspaces[0].id}/abcdef321-9244-4012-ba5d-16c22ac57654`,
      lineIndex: 5,
      type: 'open',
      priority: 2,
      prefix: '* ',
      content: '!! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht',
      rawContent: '!! Respond on Repair Cafe things from last 2 meetings >today #win ^wazhht',
      blockId: '^wazhht',
      hasChild: true,
      indents: 0,
    },
  },
]

// -------------------------------------------------------------------------
const yesterday = new moment().subtract(1, 'days').toDate()
thisDateStr = moment(yesterday).format('YYYYMMDD')
thisFilename = `${thisDateStr}.md`
export const openYesterdayParas: Array<TSectionItem> = [
  {
    ID: '2-0',
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Calendar',
      filename: thisFilename,
      lineIndex: 8,
      priority: 4,
      content: '>> Arrange EV charger repair',
      rawContent: '>> Arrange EV charger repair',
      prefix: '+ ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
      indents: 0,
    },
  },
  {
    ID: '2-1',
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Calendar',
      filename: thisFilename,
      lineIndex: 14,
      priority: 0,
      content: ' Get login for https://www.waverleyabbeyresources.org/resources-home/',
      rawContent: ' Get login for https://www.waverleyabbeyresources.org/resources-home/',
      prefix: '* ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
      indents: 0,
    },
  },
  {
    ID: '2-2',
    itemType: 'checklist',
    para: {
      type: 'checklist',
      noteType: 'Calendar',
      filename: thisFilename,
      lineIndex: 20,
      priority: 0,
      content: '![📅](2025-08-02 14:00:::814B23B7-2DAB-4C1A-A365-FCA6B97C6556:::NA:::Visit @PeterS again:::#D06B64)',
      rawContent: '![📅](2025-08-02 14:00:::814B23B7-2DAB-4C1A-A365-FCA6B97C6556:::NA:::Visit @PeterS again:::#D06B64)',
      prefix: '+ ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
      indents: 0,
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    ID: '2-3',
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Calendar',
      filename: thisFilename,
      lineIndex: 22,
      content: '@church Get iPad working on staff wifi for printing ^bzlp1z',
      rawContent: '@church Get iPad working on staff wifi for printing ^bzlp1z',
      blockId: '^bzlp1z',
      priority: 0,
      prefix: '* ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
      hasChild: true,
      children: () => [{ content: 'install printer drivers', indents: 1 }],
      indents: 0,
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    ID: '2-4',
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Calendar',
      filename: thisFilename,
      lineIndex: 23,
      content: 'Test of repeated weekly task @repeat(+1w)',
      rawContent: 'Test of repeated weekly task @repeat(+1w)',
      blockId: '^bzlp1z',
      priority: 0,
      prefix: '* ',
      changedDate: new Date('2024-02-27T00:00:00.000Z'),
      hasChild: false,
      indents: 0,
    },
  },

]
export const refYesterdayParas: Array<TSectionItem> = [
  {
    ID: '2-6',
    itemType: 'open',
    para: {
      noteType: 'Notes',
      type: 'open',
      filename: 'CCC Areas/Services.md',
      lineIndex: 40,
      title: 'Services',
      priority: 1,
      content: 'test child without a selected parent',
      rawContent: 'test child without a selected parent',
      prefix: '* ',
      changedDate: new Date('2023-07-06T00:00:00.000Z'),
      indents: 1,
    },
  },
  // $FlowFixMe[prop-missing] children function is extra
  // {
  //   ID: '2-7',
  //   parentID: '',
  //   itemType: 'open',
  //   para: {
  //     type: 'open',
  //     noteType: 'Notes',
  //     filename: 'CCC Areas/Services.md',
  //     lineIndex: 6,
  //     title: 'Services',
  //     content: 'prepare service for 5/3 >2023-03-02',
  //     rawContent: 'prepare service for 5/3 >2023-03-02',
  //     prefix: '* ',
  //     changedDate: new Date('2023-03-02T00:00:00.000Z'),
  //     priority: 0,
  //     hasChild: true,
  //     children: () => [{ content: 'plan Something Different for 5/3', indents: 1 }],
  //     indents: 0,
  //   },
  // },
  // {
  //   ID: '2-8',
  //   itemType: 'open',
  //   para: {
  //     type: 'open',
  //     noteType: 'Notes',
  //     filename: 'CCC Areas/Services.md',
  //     lineIndex: 7,
  //     title: 'Services',
  //     content: 'plan Something Different for 5/3',
  //     rawContent: 'plan Something Different for 5/3',
  //     prefix: '* ',
  //     changedDate: new Date('2023-03-02T00:00:00.000Z'),
  //     priority: 0,
  //     hasChild: false,
  //     indents: 1,
  //   },
  //   parentID: '2-7',
  // },
  // {
  //   ID: '2-9',
  //   parentID: '2-7',
  //   itemType: 'open',
  //   para: {
  //     noteType: 'Notes',
  //     type: 'open',
  //     filename: 'CCC Areas/Services.md',
  //     lineIndex: 18,
  //     title: 'Services',
  //     priority: 1,
  //     content: '! write 5/3 sermon >2023-03-02',
  //     rawContent: '! write 5/3 sermon >2023-03-02',
  //     prefix: '* ',
  //     changedDate: new Date('2023-03-02T00:00:00.000Z'),
  //     indents: 1,
  //   },
  // },
  {
    ID: '2-10',
    parentID: '2-7',
    itemType: 'open',
    para: {
      noteType: 'Notes',
      type: 'open',
      filename: 'CCC Areas/Services.md',
      lineIndex: 20,
      title: 'Services',
      priority: 1,
      content: ' ! test leading space before priority marker',
      rawContent: ' ! test leading space before priority marker',
      prefix: '* ',
      changedDate: new Date('2023-07-06T00:00:00.000Z'),
      indents: 1,
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
      lineIndex: 5,
      content: 'Prepare prayer room for Easter @staff >today ^q9jzj4',
      rawContent: 'Prepare prayer room for Easter @staff >today ^q9jzj4',
      prefix: '* ',
      priority: 0,
      blockId: '^q9jzj4',
      changedDate: new Date('2023-03-02T00:00:00.000Z'),
      indents: 0,
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
    ID: '6-0',
    parentID: '',
    itemType: 'open',
    para: {
      noteType: 'Calendar',
      type: 'open',
      filename: thisFilename,
      lineIndex: 0,
      priority: 1,
      content: '! #editvideo from CFL visit',
      rawContent: '! #editvideo from CFL visit',
      prefix: '* ',
      hasChild: true,
      children: () => [{ content: 'child of #editvideo', indents: 1 }],
      changedDate: new Date('2023-07-06T00:00:00.000Z'),
      indents: 0,
    },
  },
  {
    ID: '6-1',
    parentID: '6-0',
    itemType: 'open',
    para: {
      noteType: 'Calendar',
      type: 'open',
      filename: thisFilename,
      lineIndex: 1,
      priority: 0,
      content: '! trim and order shots',
      rawContent: '! trim and order shots',
      prefix: '* ',
      hasChild: false,
      changedDate: new Date('2023-07-06T00:00:00.000Z'),
      indents: 1,
    },
  },
  {
    ID: '6-2',
    itemType: 'open',
    parentID: '6-1',
    para: {
      noteType: 'Calendar',
      type: 'open',
      filename: thisFilename,
      lineIndex: 2,
      priority: 1,
      content: 'fix and level audio',
      rawContent: 'fix and level audio',
      prefix: '* ',
      hasChild: false,
      changedDate: new Date('2023-07-06T00:00:00.000Z'),
      indents: 2,
    },
  },
  {
    ID: '6-3',
    parentID: '6-0',
    itemType: 'open',
    para: {
      noteType: 'Calendar',
      type: 'open',
      filename: thisFilename,
      lineIndex: 3,
      priority: 1,
      content: '! add titles',
      rawContent: '! add titles',
      prefix: '* ',
      hasChild: false,
      changedDate: new Date('2023-07-06T00:00:00.000Z'),
      indents: 1,
    },
  },
  // $FlowFixMe[prop-missing] children function is extra
  {
    ID: '6-4',
    parentID: '',
    itemType: 'checklist',
    para: {
      noteType: 'Calendar',
      type: 'checklist',
      filename: thisFilename,
      lineIndex: 4,
      priority: 0,
      content: 'Prepare contract for [[Staff Induction (SW)]] following review comments',
      rawContent: 'Prepare contract for [[Staff Induction (SW)]] following review comments',
      prefix: '* ',
      hasChild: true,
      children: () => [{ content: 'check contract with Bev', indents: 1 }],
      changedDate: new Date('2023-07-06T00:00:00.000Z'),
      indents: 0,
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
      lineIndex: 8,
      priority: 0,
      content: 'Test multi-part hashtags with hyphens: #project/company-A and #one/two/three >2023-W09',
      rawContent: 'Test multi-part hashtags with hyphens: #project/company-A and #one/two/three >2023-W09',
      prefix: '+ ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
      indents: 0,
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Notes',
      filename: 'Home 🏠 Areas/Garden.md',
      lineIndex: 23,
      title: 'Garden 🌿',
      priority: 0,
      content: 'Re-plant two shrubs in new blue pots >2023-W09',
      rawContent: 'Re-plant two shrubs in new blue pots >2023-W09',
      prefix: '* ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
      indents: 0,
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'checklist',
    para: {
      type: 'checklist',
      noteType: 'Notes',
      filename: 'Home 🏠 Areas/Macs.md',
      lineIndex: 14,
      title: 'Macs 🖥',
      priority: 0,
      content: 'Backup Mac - with an arrow date >2023-W09< reference',
      rawContent: 'Backup Mac - with an arrow date >2023-W09< reference',
      prefix: '+ ',
      changedDate: new Date('2023-02-27T00:00:00.000Z'),
      indents: 0,
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
      lineIndex: 5,
      priority: 0,
      content: 'Check tag #test_for_some_underscores',
      rawContent: 'Check tag #test_for_some_underscores',
      prefix: '* ',
      indents: 0,
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
      lineIndex: 18,
      title: 'Tax Returns',
      priority: 1,
      content: 'Pay tax bill',
      rawContent: 'Pay tax bill',
      prefix: '* ',
      indents: 0,
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
      lineIndex: 38,
      content: 'Open Deliveroo account #next',
      rawContent: 'Open Deliveroo account #next',
      prefix: '+ ',
      priority: 0,
      indents: 0,
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'open',
      noteType: 'Notes',
      filename: 'CCC Areas/Finance.md',
      lineIndex: 48,
      content: 'Make expenses claim #next',
      rawContent: 'Make expenses claim #next',
      prefix: '* ',
      priority: 0,
      indents: 0,
    },
  },
  // $FlowIgnore[prop-missing] ID gets added later
  {
    itemType: 'open',
    para: {
      type: 'checklist',
      noteType: 'Notes',
      filename: 'TEST/DEMOs/Test Project A.md',
      lineIndex: 8,
      content: 'Checklist item that can be hidden #test',
      rawContent: 'Checklist item that can be hidden #test',
      prefix: '+ ',
      priority: 0,
      indents: 0,
    },
  },
]

//-----------------------------------------------------------
// Demo data for Saved Search section

// $FlowIgnore[prop-missing] demo data
export const savedSearch1 = {
  name: "'Prepare' Saved Search",
  rep: 'prepare',
  items: [
    // $FlowIgnore[prop-missing] ID gets added later
    {
      itemType: 'open',
      ID: '22-0',
      para: {
        type: 'open',
        noteType: 'Calendar',
        filename: thisFilename,
        lineIndex: 5,
        content: 'Prepare prayer room for Easter @staff >today ^q9jzj4',
        rawContent: 'Prepare prayer room for Easter @staff >today ^q9jzj4',
        prefix: '* ',
        priority: 0,
        blockId: '^q9jzj4',
        // changedDate: new Date('2023-03-02T00:00:00.000Z'),
        indents: 0,
      },
    },
    // $FlowIgnore[prop-missing] ID gets added later
    {
      itemType: 'open',
      ID: '22-1',
      para: {
        noteType: 'Calendar',
        type: 'open',
        filename: thisFilename,
        lineIndex: 4,
        priority: 0,
        content: 'Prepare contract for [[Staff Induction (SW)]] following review comments',
        rawContent: 'Prepare contract for [[Staff Induction (SW)]] following review comments',
        prefix: '* ',
        hasChild: true,
        children: () => [{ content: 'check contract with Bev', indents: 1 }],
        indents: 0,
      },
    },
    // $FlowIgnore[prop-missing] ID gets added later
    {
      itemType: 'open',
      ID: '22-2',
      para: {
        type: 'open',
        noteType: 'Notes',
        filename: 'CCC Areas/Services.md',
        lineIndex: 6,
        title: 'Services',
        content: 'prepare service for 5/3 >2023-03-02',
        rawContent: 'prepare service for 5/3 >2023-03-02',
        prefix: '* ',
        // changedDate: new Date('2023-03-02T00:00:00.000Z'),
        priority: 0,
        hasChild: true,
        children: () => [{ content: 'plan Something Different for 5/3', indents: 1 }],
        indents: 0,
      },
    },
  ]
}
//-----------------------------------------------------------
// Project Notes to review
// Note: uses newer Project-based objects now, not the earlier TNote-based demo data
export const nextProjectNoteItems: Array<Project> = [
  // $FlowIgnore[incompatible-type]
  {
    filename: 'CCC Projects/Facilities/Hearing Support.md',
    title: 'Hearing Support at CCC',
    reviewInterval: '1m',
    percentComplete: 23,
    lastProgressComment: 'Checked our equipment and its OK; looking for acoustician',
  },
  // $FlowIgnore[incompatible-type]
  {
    filename: 'Home 🏠 Projects/Streamdeck setup.md',
    title: 'Streaming Platform',
    reviewInterval: '1w',
    percentComplete: 82,
  },
  // $FlowIgnore[incompatible-type]
  {
    filename: 'CCC Projects/Pastoral Cards.md',
    title: 'Pastoral Cards',
    reviewInterval: '2m',
  },
]
