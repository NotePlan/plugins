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

  describe('injectSyntheticWinsSection', () => {
    const baseSettings = {
      showWinsSection: true,
      treatTopPriorityAsWins: true,
      showTodaySection: true,
      showWeekSection: true,
      showMonthSection: false,
      showQuarterSection: false,
    }

    test('returns unchanged when showWinsSection is false', () => {
      const sections = [{ sectionCode: 'DT', sectionItems: [], isReferenced: false, ID: 'DT', name: 'Today', showSettingName: 'showTodaySection', description: '' }]
      const out = sh.injectSyntheticWinsSection(sections, { ...baseSettings, showWinsSection: false })
      expect(out).toBe(sections)
    })

    test('appends WINS with priority-4 items from visible DT/W in order', () => {
      const sections = [
        {
          ID: 'DT',
          name: 'Today',
          showSettingName: 'showTodaySection',
          sectionCode: 'DT',
          isReferenced: false,
          description: '',
          sectionItems: [
            { ID: 'DT-0', itemType: 'open', sectionCode: 'DT', para: { priority: 1, type: 'open', content: 'a', filename: 'x.md' } },
            { ID: 'DT-1', itemType: 'open', sectionCode: 'DT', para: { priority: 4, type: 'open', content: 'win', filename: 'x.md' } },
          ],
        },
        {
          ID: 'W',
          name: 'Week',
          showSettingName: 'showWeekSection',
          sectionCode: 'W',
          isReferenced: false,
          description: '',
          sectionItems: [{ ID: 'W-0', itemType: 'open', sectionCode: 'W', para: { priority: 4, type: 'open', content: 'w2', filename: 'y.md' } }],
        },
      ]
      const out = sh.injectSyntheticWinsSection(sections, baseSettings)
      expect(out.length).toBe(sections.length + 1)
      const wins = out[out.length - 1]
      expect(wins.sectionCode).toBe('WINS')
      expect(wins.sectionItems.map((i) => i.para.content)).toEqual(['win', 'w2'])
      expect(wins.sectionItems[0].ID).toBe('WINS-DT-1')
      expect(wins.sectionItems[0].sectionCode).toBe('DT')
      expect(wins.totalCount).toBe(2)
    })
  })
})
