/* globals describe, expect, test */

// eslint-disable-next-line flowtype/no-types-missing-file-annotation
// import type { TSection, TSectionCode } from '../../../types.js'
import * as sh from '../Section/sectionHelpers.js'
import { injectSyntheticWinsSection } from '../../../dataGenerationPriority'
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

  // Note: used to live in sectionHelpers.js, but now in dataGenerationPriority.js
  describe('injectSyntheticWinsSection', () => {
    const baseSettings = {
      showWinsSection: true,
      treatTopPriorityAsWins: true,
      winsPriorityMarker: '>>',
      showTodaySection: true,
      showWeekSection: true,
      showMonthSection: false,
      showQuarterSection: false,
    }

    test('returns unchanged when showWinsSection is false', () => {
      const sections = [{ sectionCode: 'DT', sectionItems: [], isReferenced: false, ID: 'DT', name: 'Today', showSettingName: 'showTodaySection', description: '' }]
      const out = injectSyntheticWinsSection(sections, { ...baseSettings, showWinsSection: false })
      expect(out).toBe(sections)
    })

    test('returns unchanged when treatTopPriorityAsWins is false', () => {
      const sections = [{ sectionCode: 'DT', sectionItems: [], isReferenced: false, ID: 'DT', name: 'Today', showSettingName: 'showTodaySection', description: '' }]
      const out = injectSyntheticWinsSection(sections, { ...baseSettings, treatTopPriorityAsWins: false })
      expect(out).toBe(sections)
    })

    test('appends WINS with priority-4 `>>` items from visible DT/W in order', () => {
      const sections = [
        {
          ID: 'DT',
          name: 'Today',
          showSettingName: 'showTodaySection',
          sectionCode: 'DT',
          isReferenced: false,
          description: '',
          sectionItems: [
            { ID: 'DT-0', itemType: 'open', sectionCode: 'DT', para: { priority: 1, type: 'open', content: '! a', filename: 'x.md' } },
            { ID: 'DT-1', itemType: 'open', sectionCode: 'DT', para: { priority: 4, type: 'open', content: '>> win', filename: 'x.md' } },
          ],
        },
        {
          ID: 'W',
          name: 'Week',
          showSettingName: 'showWeekSection',
          sectionCode: 'W',
          isReferenced: false,
          description: '',
          sectionItems: [{ ID: 'W-0', itemType: 'open', sectionCode: 'W', para: { priority: 4, type: 'open', content: '>> w2', filename: 'y.md' } }],
        },
      ]
      const out = injectSyntheticWinsSection(sections, baseSettings)
      expect(out.length).toBe(sections.length + 1)
      const wins = out[out.length - 1]
      expect(wins.sectionCode).toBe('WINS')
      expect(wins.sectionItems.map((i) => i.para.content)).toEqual(['>> win', '>> w2'])
      expect(wins.sectionItems[0].ID).toBe('WINS-DT-1')
      expect(wins.sectionItems[0].sectionCode).toBe('DT')
      expect(wins.totalCount).toBe(2)
    })

    test("winsPriorityMarker = '!!' gathers priority-2 items with `!!` and not priority-4 `>>` items", () => {
      const sections = [
        {
          ID: 'DT',
          name: 'Today',
          showSettingName: 'showTodaySection',
          sectionCode: 'DT',
          isReferenced: false,
          description: '',
          sectionItems: [
            { ID: 'DT-0', itemType: 'open', sectionCode: 'DT', para: { priority: 2, type: 'open', content: '!! double-bang win', filename: 'x.md' } },
            { ID: 'DT-1', itemType: 'open', sectionCode: 'DT', para: { priority: 4, type: 'open', content: '>> not a win here', filename: 'x.md' } },
            { ID: 'DT-2', itemType: 'open', sectionCode: 'DT', para: { priority: 1, type: 'open', content: '! single bang', filename: 'x.md' } },
          ],
        },
      ]
      const out = injectSyntheticWinsSection(sections, { ...baseSettings, winsPriorityMarker: '!!' })
      const wins = out[out.length - 1]
      expect(wins.sectionCode).toBe('WINS')
      expect(wins.sectionItems.map((i) => i.para.content)).toEqual(['!! double-bang win'])
      expect(wins.totalCount).toBe(1)
    })

    test("winsPriorityMarker = '!!!' gathers priority-3 `!!!` items but NOT priority-4 `>>` items", () => {
      const sections = [
        {
          ID: 'DT',
          name: 'Today',
          showSettingName: 'showTodaySection',
          sectionCode: 'DT',
          isReferenced: false,
          description: '',
          sectionItems: [
            { ID: 'DT-0', itemType: 'open', sectionCode: 'DT', para: { priority: 3, type: 'open', content: '!!! triple win', filename: 'x.md' } },
            { ID: 'DT-1', itemType: 'open', sectionCode: 'DT', para: { priority: 4, type: 'open', content: '>> arrow only', filename: 'x.md' } },
          ],
        },
      ]
      const out = injectSyntheticWinsSection(sections, { ...baseSettings, winsPriorityMarker: '!!!' })
      const wins = out[out.length - 1]
      expect(wins.sectionCode).toBe('WINS')
      expect(wins.sectionItems.map((i) => i.para.content)).toEqual(['!!! triple win'])
      expect(wins.totalCount).toBe(1)
    })
  })
})
