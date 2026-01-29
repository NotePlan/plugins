/* globals describe, expect, test */

// eslint-disable-next-line flowtype/no-types-missing-file-annotation
// import type { TSection, TSectionCode } from '../../../types.js'
import * as sh from '../Section/sectionHelpers.js'
import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'
import { clo, logDebug } from '@helpers/dev'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

// tests start here

describe('sectionHelpers', () => {
  /**
   * Tests for sortSections
   */
  describe('sortSections tests', () => {
    // FIXME: This is weird. The function runs fine in the Dashboard, but here it returns TAGs in the reverse order than it should.
    test.skip('test 1', () => {
      const predefinedOrder = ['DO', 'W', 'M', 'TAG', 'PROJACT', 'PROJREVIEW']
      const sections = [
        { sectionCode: 'W' },
        { sectionCode: 'M' },
        { sectionCode: 'DO' },
        { sectionCode: 'TAG', name: '@home' },
        { sectionCode: 'TAG', name: '@church' },
        { sectionCode: 'TAG', name: '#waiting' },
        { sectionCode: 'PROJACT' },
        { sectionCode: 'PROJREVIEW' },
        { sectionCode: 'TAG', name: '#next' },
      ]
      const expectedSections = [
        { sectionCode: 'DO' },
        { sectionCode: 'W' },
        { sectionCode: 'M' },
        { sectionCode: 'TAG', name: '#next' },
        { sectionCode: 'TAG', name: '#waiting' },
        { sectionCode: 'TAG', name: '@church' },
        { sectionCode: 'TAG', name: '@home' },
        { sectionCode: 'PROJACT' },
        { sectionCode: 'PROJREVIEW' },
      ]
      const orderedSections = sh.sortSections(sections, predefinedOrder)
      expect(orderedSections).toEqual(expectedSections)
    })
  })
})
