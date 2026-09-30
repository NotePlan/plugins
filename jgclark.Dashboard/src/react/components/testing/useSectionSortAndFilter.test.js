/* globals describe, expect, test, beforeAll */

// Test child-ordering-with-parents using the Demo data for 'DY' section, which is designed for this purpose.

// eslint-disable-next-line flowtype/no-types-missing-file-annotation
// import type { TSection, TSectionCode } from '../../../types.js'
import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'
import * as sh from '../Section/useSectionSortAndFilter.jsx'
import { openYesterdayParas, refYesterdayParas } from '../../../demoData.js'
import { clo, clof, logDebug } from '@helpers/dev'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

beforeAll(() => {
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

// tests start here

describe('useSectionSortAndFilter', () => {
  /**
   * Tests for reorderChildrenAfterParents
   */
  describe('reorderChildrenAfterParents tests', () => {
    // FIXME: only running 1 test here
    test.skip('demo data for DY', () => {
      // get the demo data
      const yesterdayItemsWithParas = openYesterdayParas.concat(refYesterdayParas)

      // now do the main sort of items
      const sortedData = sh.reorderChildrenAfterParents(yesterdayItemsWithParas)
      clof(sortedData, 'sortedData', ['ID', 'parentID', 'para.priority', 'para.indents', 'para.content'])

      // strip out .para from the demo data objects (to simplify the test)
      const sortedDataWithoutParas = sortedData.slice()
      sortedDataWithoutParas.forEach((item) => {
        delete item.para
      })

      const expectedSortedResult = [
        { ID: '2-5', itemType: 'open', parentID: '' },
        { ID: '2-0', itemType: 'open', parentID: '' },
        { ID: '2-2', itemType: 'open', parentID: '2-1' },
        { ID: '2-3', itemType: 'open', parentID: '2-0' },
        { ID: '2-9', itemType: 'open', parentID: '2-6' },
        { ID: '2-8', itemType: 'open', parentID: '2-6' },
        { ID: '2-10', itemType: 'open' },
        { ID: '2-1', itemType: 'open', parentID: '2-0' },
        { ID: '2-6', itemType: 'open', parentID: '' },
        { ID: '2-7', itemType: 'open', parentID: '2-6' },
        { ID: '2-4', itemType: 'checklist', parentID: '' },
      ]

      // now do the re-ordering of children of the sorted items
      const reorderedData = sh.reorderChildrenAfterParents(sortedDataWithoutParas)
      clof(reorderedData, 'reorderedData', ['ID', 'parentID', 'para.priority', 'para.indents', 'para.content'])

      const expectedOrderedResult = [
        { ID: '2-5', itemType: 'open', parentID: '' },
        { ID: '2-0', itemType: 'open', parentID: '' },
        { ID: '2-3', itemType: 'open', parentID: '2-0' },
        { ID: '2-1', itemType: 'open', parentID: '2-0' },
        { ID: '2-2', itemType: 'open', parentID: '2-1' },
        { ID: '2-10', itemType: 'open' },
        { ID: '2-6', itemType: 'open', parentID: '' },
        { ID: '2-9', itemType: 'open', parentID: '2-6' },
        { ID: '2-8', itemType: 'open', parentID: '2-6' },
        { ID: '2-7', itemType: 'open', parentID: '2-6' },
        { ID: '2-4', itemType: 'checklist', parentID: '' },
      ]

      expect(sortedDataWithoutParas).toEqual(expectedSortedResult)

      expect(reorderedData).toEqual(expectedOrderedResult)
    })
  })

  describe('getMaxPriorityInItems', () => {
    test('includes priority 4 when treatTopPriorityAsWins is off', () => {
      const items = [
        { itemType: 'open', para: { priority: 4 } },
        { itemType: 'open', para: { priority: 2 } },
      ]
      expect(sh.getMaxPriorityInItems(items)).toBe(4)
      expect(sh.getMaxPriorityInItems(items, {})).toBe(4)
    })

    test("ignores priority 4 '>>' wins when treatTopPriorityAsWins is on (default marker)", () => {
      const items = [
        { itemType: 'open', para: { priority: 4 } },
        { itemType: 'open', para: { priority: 2 } },
      ]
      expect(sh.getMaxPriorityInItems(items, { treatTopPriorityAsWins: true })).toBe(2)
    })

    test("ignores priority 2 '!!' wins when winsPriorityMarker is '!!'", () => {
      // With winsPriorityMarker '!!', priority-2 items should be excluded so max becomes priority 3 (!!!)
      const items = [
        { itemType: 'open', para: { priority: 2 } },
        { itemType: 'open', para: { priority: 3 } },
        { itemType: 'open', para: { priority: 1 } },
      ]
      expect(sh.getMaxPriorityInItems(items, { treatTopPriorityAsWins: true, winsPriorityMarker: '!!' })).toBe(3)
    })
  })

  describe('filterRemItemsByOwnPriority', () => {
    const unflagged = { itemType: 'reminder', reminder: { title: 'Milk', priority: 0 } }
    const flagged = { itemType: 'reminder', reminder: { title: 'Call', priority: 3 } }

    test('keeps unflagged Apple Reminders when filter is off', () => {
      expect(sh.filterRemItemsByOwnPriority([unflagged], false, false, 0)).toEqual([unflagged])
    })

    test('keeps unflagged Apple Reminders when this REM section has no flagged items (ignores NP-task global max)', () => {
      expect(sh.filterRemItemsByOwnPriority([unflagged], true, false, 0)).toEqual([unflagged])
    })

    test('hides unflagged Apple Reminders when this REM section itself has a higher reminder priority', () => {
      expect(sh.filterRemItemsByOwnPriority([unflagged, flagged], true, false, 3)).toEqual([flagged])
    })

    test('keeps all Apple Reminders when show-all is on even if this section has a high rem max', () => {
      expect(sh.filterRemItemsByOwnPriority([unflagged, flagged], true, true, 3)).toEqual([unflagged, flagged])
    })
  })

  describe('calculateMaxPriorityAcrossAllSections', () => {
    test("skips WINS section and ignores '>>' wins when treatTopPriorityAsWins is true", () => {
      const sections = [
        {
          sectionCode: 'WINS',
          sectionItems: [{ itemType: 'open', para: { priority: 4 } }],
        },
        {
          sectionCode: 'DT',
          sectionItems: [
            { itemType: 'open', para: { priority: 4 } },
            { itemType: 'open', para: { priority: 1 } },
          ],
        },
      ]
      expect(sh.calculateMaxPriorityAcrossAllSections(sections, { treatTopPriorityAsWins: true })).toBe(1)
    })
  })

  describe('buildPriorityFilterFooterItem', () => {
    test('omits the footer when items are hidden only by the display cap', () => {
      expect(sh.buildPriorityFilterFooterItem(false, true, 22, 22, 10, 10)).toBeNull()
    })

    test('omits the footer when the priority filter setting is off', () => {
      expect(sh.buildPriorityFilterFooterItem(false, false, 22, 8, 8, 10)).toBeNull()
    })

    test('omits the footer when the cap is already full, so lower-priority items would still not appear', () => {
      expect(sh.buildPriorityFilterFooterItem(false, true, 22, 12, 10, 10)).toBeNull()
    })

    test('offers to show lower priorities when that click would reveal every remaining item', () => {
      expect(sh.buildPriorityFilterFooterItem(false, true, 8, 3, 3, 10)).toEqual({
        itemType: 'filterIndicator',
        message: 'There are also 5 lower-priority items currently hidden (click to show lower priorities)',
      })
    })

    test('uses the singular when one lower-priority item is hidden', () => {
      expect(sh.buildPriorityFilterFooterItem(false, true, 4, 3, 3, 10)).toEqual({
        itemType: 'filterIndicator',
        message: 'There is also 1 lower-priority item currently hidden (click to show lower priorities)',
      })
    })

    test('says the list stays limited when a click would show more but not every item', () => {
      expect(sh.buildPriorityFilterFooterItem(false, true, 22, 4, 4, 10)).toEqual({
        itemType: 'filterIndicator',
        message: 'There are also 18 lower-priority items currently hidden (click to show lower priorities; list stays limited to 10)',
      })
    })

    test('says all items are showing when the priority filter is off and every item fits', () => {
      expect(sh.buildPriorityFilterFooterItem(true, true, 8, 8, 8, 10)).toEqual({
        itemType: 'offerToFilter',
        message: 'Showing all 8 items (click to filter by priority)',
      })
    })

    test('does not claim all items are showing when the priority filter is off but the cap still applies', () => {
      expect(sh.buildPriorityFilterFooterItem(true, true, 22, 22, 10, 10)).toEqual({
        itemType: 'offerToFilter',
        message: 'Priority filter off; showing first 10 of 22 (click to filter by priority)',
      })
    })

    test('omits the showing-all row when there are no items', () => {
      expect(sh.buildPriorityFilterFooterItem(true, true, 0, 0, 0, 10)).toBeNull()
    })
  })
})
