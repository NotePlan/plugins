/* globals describe, expect, test, beforeAll */

// Test child-ordering-with-parents using the Demo data for 'DY' section, which is designed for this purpose.

// eslint-disable-next-line flowtype/no-types-missing-file-annotation
// import type { TSection, TSectionCode } from '../../../types.js'
import * as sh from '../Section/useSectionSortAndFilter.jsx'
import { openYesterdayParas, refYesterdayParas } from '../../../demoData.js'
import { clo, clof, logDebug } from '@helpers/dev'
import { DataStore } from '@mocks/index'

beforeAll(() => {
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging (or 'none' for none)
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
      clof(sortedData, 'sortedData', ['ID', 'parentID', 'para.priority', 'para.indentLevel', 'para.content'])

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
      clof(reorderedData, 'reorderedData', ['ID', 'parentID', 'para.priority', 'para.indentLevel', 'para.content'])

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
})
