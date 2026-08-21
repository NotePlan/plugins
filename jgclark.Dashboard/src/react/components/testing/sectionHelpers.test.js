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
  describe('isInteractiveProcessingItem / getInteractiveProcessingItems / countInteractiveProcessingItems', () => {
    const openTask = { ID: '1', itemType: 'open' }
    const checklist = { ID: '2', itemType: 'checklist' }
    const reminder = { ID: '3', itemType: 'reminder' }
    const congrats = { ID: '4', itemType: 'itemCongrats' }
    const filterMsg = { ID: '5', itemType: 'filterIndicator' }

    test('isInteractiveProcessingItem is true for open, checklist, and reminder', () => {
      expect(sh.isInteractiveProcessingItem(openTask)).toBe(true)
      expect(sh.isInteractiveProcessingItem(checklist)).toBe(true)
      expect(sh.isInteractiveProcessingItem(reminder)).toBe(true)
      expect(sh.isInteractiveProcessingItem(congrats)).toBe(false)
      expect(sh.isInteractiveProcessingItem(filterMsg)).toBe(false)
    })

    test('getInteractiveProcessingItems keeps tasks and reminders; drops message rows', () => {
      const mixed = [openTask, reminder, checklist, congrats, filterMsg]
      expect(sh.getInteractiveProcessingItems(mixed)).toEqual([openTask, reminder, checklist])
    })

    test('countInteractiveProcessingItems matches filtered length (IP button N)', () => {
      const mixed = [openTask, reminder, reminder, checklist]
      expect(sh.countInteractiveProcessingItems(mixed)).toBe(4)
      expect(sh.countInteractiveProcessingItems([])).toBe(0)
      expect(sh.countInteractiveProcessingItems(null)).toBe(0)
      expect(sh.countInteractiveProcessingItems([congrats, filterMsg])).toBe(0)
    })
  })

  describe('getGeneratedDateKey', () => {
    test('returns empty string for null/undefined', () => {
      expect(sh.getGeneratedDateKey(null)).toBe('')
      expect(sh.getGeneratedDateKey(undefined)).toBe('')
    })

    test('returns string dates unchanged', () => {
      expect(sh.getGeneratedDateKey('2026-07-24T12:00:00.000Z')).toBe('2026-07-24T12:00:00.000Z')
    })

    test('converts Date via toISOString', () => {
      const d = new Date('2026-07-24T12:00:00.000Z')
      expect(sh.getGeneratedDateKey(d)).toBe('2026-07-24T12:00:00.000Z')
    })
  })

  describe('makeTagSectionID', () => {
    test('prefixes TAG: to the tag/mention name', () => {
      expect(sh.makeTagSectionID('#work')).toBe('TAG:#work')
      expect(sh.makeTagSectionID('@home')).toBe('TAG:@home')
    })
  })

  describe('selectTagSectionsToGenerate', () => {
    const tagSections = [
      { sectionCode: 'TAG', sectionName: '#work', showSettingName: 'showTagSection_#work' },
      { sectionCode: 'TAG', sectionName: '@home', showSettingName: 'showTagSection_@home' },
      { sectionCode: 'TAG', sectionName: '#later', showSettingName: 'showTagSection_#later' },
    ]

    test('returns all when tagsToGenerate is omitted or empty', () => {
      expect(sh.selectTagSectionsToGenerate(tagSections, null)).toEqual(tagSections)
      expect(sh.selectTagSectionsToGenerate(tagSections, undefined)).toEqual(tagSections)
      expect(sh.selectTagSectionsToGenerate(tagSections, [])).toEqual(tagSections)
    })

    test('filters to exact matching tag names', () => {
      expect(sh.selectTagSectionsToGenerate(tagSections, ['@home', '#later'])).toEqual([
        tagSections[1],
        tagSections[2],
      ])
    })

    test('trims filter names and ignores blanks', () => {
      expect(sh.selectTagSectionsToGenerate(tagSections, ['  #work  ', '', '  '])).toEqual([tagSections[0]])
    })
  })

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

  describe('adjustDedupPriorityForCalendarFocus', () => {
    const baseOrder = ['TB', 'REM', 'TAG', 'WINS', 'DT', 'DY', 'DO', 'LW', 'W', 'M', 'Q', 'Y', 'PRIORITY', 'OVERDUE']

    test('returns unchanged order when includedCalendarSections is unset', () => {
      expect(sh.adjustDedupPriorityForCalendarFocus(baseOrder, {})).toEqual(baseOrder)
    })

    test('returns unchanged order when includedCalendarSections is blank', () => {
      expect(sh.adjustDedupPriorityForCalendarFocus(baseOrder, { includedCalendarSections: '' })).toEqual(baseOrder)
      expect(sh.adjustDedupPriorityForCalendarFocus(baseOrder, { includedCalendarSections: '  ,  ' })).toEqual(baseOrder)
    })

    test('moves WINS, calendar period and OVERDUE before TAG when filter is set', () => {
      const result = sh.adjustDedupPriorityForCalendarFocus(baseOrder, { includedCalendarSections: 'acme' })
      const tagIndex = result.indexOf('TAG')
      expect(tagIndex).toBeGreaterThan(-1)
      ;['WINS', 'DT', 'DY', 'DO', 'LW', 'W', 'M', 'Q', 'Y', 'OVERDUE'].forEach((code) => {
        expect(result.indexOf(code)).toBeLessThan(tagIndex)
      })
      // TB / REM stay before TAG; PRIORITY stays after TAG; WINS stays before DT
      expect(result.indexOf('TB')).toBeLessThan(tagIndex)
      expect(result.indexOf('REM')).toBeLessThan(tagIndex)
      expect(result.indexOf('PRIORITY')).toBeGreaterThan(tagIndex)
      expect(result.indexOf('WINS')).toBeLessThan(result.indexOf('DT'))
    })

    test('with Hide Duplicates, keeps duplicate in DT not TAG when calendar focus is set', () => {
      const sharedPara = { filename: '2025-01-25.md', content: 'Call #acme' }
      const sections = [
        {
          sectionCode: 'TAG',
          name: '#acme',
          showSettingName: 'showTagSection_#acme',
          sectionItems: [{ ID: 'TAG-0', itemType: 'open', para: sharedPara }],
        },
        {
          sectionCode: 'DT',
          name: 'Today',
          showSettingName: 'showTodaySection',
          sectionItems: [{ ID: 'DT-0', itemType: 'open', para: sharedPara }],
        },
      ]
      const withoutFocus = sh.getSectionsWithoutDuplicateLines(
        sections,
        ['filename', 'content'],
        baseOrder,
        [],
        { showTodaySection: true, showTagSection_acme: true },
      )
      const tagWithout = withoutFocus.find((s) => s.sectionCode === 'TAG')
      const dtWithout = withoutFocus.find((s) => s.sectionCode === 'DT')
      expect(tagWithout.sectionItems).toHaveLength(1)
      expect(dtWithout.sectionItems).toHaveLength(0)

      const withFocus = sh.getSectionsWithoutDuplicateLines(
        sections,
        ['filename', 'content'],
        baseOrder,
        [],
        { includedCalendarSections: 'acme', showTodaySection: true, showTagSection_acme: true },
      )
      const tagWith = withFocus.find((s) => s.sectionCode === 'TAG')
      const dtWith = withFocus.find((s) => s.sectionCode === 'DT')
      expect(dtWith.sectionItems).toHaveLength(1)
      expect(tagWith.sectionItems).toHaveLength(0)
    })

    test('with Hide Duplicates + calendar focus, keeps >> win in WINS not DT', () => {
      const winPara = { filename: '20260724.md', content: '>> Pick up PEB again', priority: 4, type: 'open' }
      const sections = [
        {
          sectionCode: 'WINS',
          name: 'Wins',
          showSettingName: 'showWinsSection',
          sectionItems: [{ ID: 'WINS-DT-0', itemType: 'open', sectionCode: 'DT', para: winPara }],
        },
        {
          sectionCode: 'DT',
          name: 'Today',
          showSettingName: 'showTodaySection',
          sectionItems: [{ ID: 'DT-0', itemType: 'open', sectionCode: 'DT', para: winPara }],
        },
      ]
      const withFocus = sh.getSectionsWithoutDuplicateLines(
        sections,
        ['filename', 'content'],
        baseOrder,
        [],
        {
          includedCalendarSections: 'Home',
          showTodaySection: true,
          showWinsSection: true,
        },
      )
      const wins = withFocus.find((s) => s.sectionCode === 'WINS')
      const dt = withFocus.find((s) => s.sectionCode === 'DT')
      expect(wins.sectionItems).toHaveLength(1)
      expect(dt.sectionItems).toHaveLength(0)
    })

    test('reduces totalCount when Hide Duplicates removes items from OVERDUE', () => {
      const sharedPara = { filename: 'note.md', content: 'Pay bills #home' }
      const onlyOverduePara = { filename: 'old.md', content: 'Unique overdue task' }
      const sections = [
        {
          sectionCode: 'TAG',
          name: '#home',
          showSettingName: 'showTagSection_#home',
          totalCount: 1,
          sectionItems: [{ ID: 'TAG-0', itemType: 'open', para: sharedPara }],
        },
        {
          sectionCode: 'OVERDUE',
          name: 'Overdue Tasks',
          showSettingName: 'showOverdueSection',
          totalCount: 2,
          sectionItems: [
            { ID: 'OVERDUE-0', itemType: 'open', para: sharedPara },
            { ID: 'OVERDUE-1', itemType: 'open', para: onlyOverduePara },
          ],
        },
      ]
      const result = sh.getSectionsWithoutDuplicateLines(
        sections,
        ['filename', 'content'],
        baseOrder,
        [],
        { showOverdueSection: true, showTagSection_home: true, maxItemsToShowInSection: 10 },
      )
      const overdue = result.find((s) => s.sectionCode === 'OVERDUE')
      const tag = result.find((s) => s.sectionCode === 'TAG')
      expect(tag.sectionItems).toHaveLength(1)
      expect(overdue.sectionItems).toHaveLength(1)
      // Under the section limit after dedupe -- totalCount matches remaining items
      expect(overdue.totalCount).toBe(1)
    })

    test('when under maxItemsToShowInSection after dedupe, sets totalCount to remaining items', () => {
      const sharedPara = { filename: 'note.md', content: 'Shared overdue #work' }
      const onlyOverdueParas = Array.from({ length: 9 }, (_, i) => ({
        filename: `old${i}.md`,
        content: `Only in overdue ${i}`,
      }))
      const sections = [
        {
          sectionCode: 'TAG',
          name: '#work',
          showSettingName: 'showTagSection_#work',
          totalCount: 1,
          sectionItems: [{ ID: 'TAG-0', itemType: 'open', para: sharedPara }],
        },
        {
          sectionCode: 'OVERDUE',
          name: 'Overdue Tasks',
          showSettingName: 'showOverdueSection',
          // Backend passed a full page of 10; more exist beyond the slice
          totalCount: 15,
          sectionItems: [
            { ID: 'OVERDUE-0', itemType: 'open', para: sharedPara },
            ...onlyOverdueParas.map((para, i) => ({ ID: `OVERDUE-${i + 1}`, itemType: 'open', para })),
          ],
        },
      ]
      const result = sh.getSectionsWithoutDuplicateLines(
        sections,
        ['filename', 'content'],
        baseOrder,
        [],
        { showOverdueSection: true, showTagSection_work: true, maxItemsToShowInSection: 10 },
      )
      const overdue = result.find((s) => s.sectionCode === 'OVERDUE')
      // One dup removed; still 9 items -- under capacity of 10, so totalCount = remaining
      expect(overdue.sectionItems).toHaveLength(9)
      expect(overdue.totalCount).toBe(9)
    })

    test('when at capacity after dedupe, preserves headroom in totalCount', () => {
      const sharedPara = { filename: 'note.md', content: 'Shared overdue #work' }
      const onlyOverdueParas = Array.from({ length: 10 }, (_, i) => ({
        filename: `old${i}.md`,
        content: `Only in overdue ${i}`,
      }))
      const sections = [
        {
          sectionCode: 'TAG',
          name: '#work',
          showSettingName: 'showTagSection_#work',
          totalCount: 1,
          sectionItems: [{ ID: 'TAG-0', itemType: 'open', para: sharedPara }],
        },
        {
          sectionCode: 'OVERDUE',
          name: 'Overdue Tasks',
          showSettingName: 'showOverdueSection',
          totalCount: 20,
          // 11 items passed somehow (or max is 10 and we have 11 before filter - use 10 unique + 1 dup = 11 before, 10 after)
          sectionItems: [
            { ID: 'OVERDUE-0', itemType: 'open', para: sharedPara },
            ...onlyOverdueParas.map((para, i) => ({ ID: `OVERDUE-${i + 1}`, itemType: 'open', para })),
          ],
        },
      ]
      const result = sh.getSectionsWithoutDuplicateLines(
        sections,
        ['filename', 'content'],
        baseOrder,
        [],
        { showOverdueSection: true, showTagSection_work: true, maxItemsToShowInSection: 10 },
      )
      const overdue = result.find((s) => s.sectionCode === 'OVERDUE')
      // 11 -> 10 after removing dup; at capacity, totalCount reduced by 1 only
      expect(overdue.sectionItems).toHaveLength(10)
      expect(overdue.totalCount).toBe(19)
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

  describe('removeRemindersDuplicatedByLinkedTasks()', () => {
    const reminderUuid = '123e4567-e89b-12d3-a456-426614174000'

    test('drops reminder row when a task links the same reminder via @remind(UUID)', () => {
      const sections = [
        {
          sectionCode: 'REM',
          name: 'Reminders',
          sectionItems: [
            {
              ID: 'REM-0',
              itemType: 'reminder',
              reminder: { id: reminderUuid, title: 'TEST reminder', listname: 'Church' },
            },
          ],
          totalCount: 1,
        },
        {
          sectionCode: 'DT',
          name: 'Today',
          sectionItems: [
            {
              ID: 'DT-0',
              itemType: 'open',
              para: {
                filename: '20260818.md',
                content: `TEST reminder @remind(:::${reminderUuid})`,
              },
            },
          ],
        },
      ]
      const out = sh.removeRemindersDuplicatedByLinkedTasks(sections)
      expect(out.find((s) => s.sectionCode === 'REM').sectionItems).toHaveLength(0)
      expect(out.find((s) => s.sectionCode === 'DT').sectionItems).toHaveLength(1)
      expect(out.find((s) => s.sectionCode === 'REM').totalCount).toBe(0)
    })

    test('keeps reminder when no linked task exists', () => {
      const sections = [
        {
          sectionCode: 'REM',
          name: 'Reminders',
          sectionItems: [
            {
              ID: 'REM-0',
              itemType: 'reminder',
              reminder: { id: reminderUuid, title: 'Standalone', listname: 'Church' },
            },
          ],
        },
      ]
      const out = sh.removeRemindersDuplicatedByLinkedTasks(sections)
      expect(out[0].sectionItems).toHaveLength(1)
    })
  })
})
