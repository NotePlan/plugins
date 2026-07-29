/* globals describe, expect, test */
// Last updated 2026-07-29 for v2.4.0.b57 by @CursorAI

import { filterSettingsItems } from '../react/components/settingsDialogFilter.js'

const PLUGIN_NAME = 'jgclark.Dashboard'
const FILENAME = 'settingsDialogFilter'

const sampleItems = [
  { type: 'heading', label: 'Appearance' },
  { type: 'switch', key: 'showTodaySection', label: 'Show Today', description: 'Open items from today' },
  { type: 'switch', key: 'showYesterdaySection', label: 'Show Yesterday', description: 'Open items from yesterday' },
  { type: 'separator' },
  { type: 'heading', label: 'Filtering' },
  {
    type: 'input',
    key: 'ignoreItemsWithTerms',
    label: 'Ignore Items with Terms',
    description: 'Comma-separated terms to hide',
    controlsOtherKeys: ['applyIgnoreTermsToCalendarHeadingSections'],
  },
  {
    type: 'switch',
    key: 'applyIgnoreTermsToCalendarHeadingSections',
    label: 'Also apply to calendar headings',
    description: 'Extend ignore terms to calendar note headings',
    dependsOnKey: 'ignoreItemsWithTerms',
  },
  { type: 'heading', label: 'Reminders' },
  { type: 'switch', key: 'showCurrentReminders', label: 'Show Current Reminders', description: 'Today yesterday tomorrow' },
]

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    test('returns all items when query is shorter than 3 characters', () => {
      expect(filterSettingsItems(sampleItems, '')).toEqual(sampleItems)
      expect(filterSettingsItems(sampleItems, 'ab')).toEqual(sampleItems)
      expect(filterSettingsItems(sampleItems, '  xy  ')).toEqual(sampleItems)
    })

    test('matches label case-insensitively and keeps preceding heading', () => {
      const result = filterSettingsItems(sampleItems, 'show today')
      expect(result.map((i) => i.key || i.label || i.type)).toEqual(['Appearance', 'showTodaySection'])
    })

    test('matches description text', () => {
      const result = filterSettingsItems(sampleItems, 'open items from yesterday')
      expect(result.some((i) => i.key === 'showYesterdaySection')).toBe(true)
      expect(result.some((i) => i.type === 'heading' && i.label === 'Appearance')).toBe(true)
    })

    test('keeps dependsOn dependents of a matched parent', () => {
      const result = filterSettingsItems(sampleItems, 'ignore items')
      const keys = result.map((i) => i.key).filter(Boolean)
      expect(keys).toContain('ignoreItemsWithTerms')
      expect(keys).toContain('applyIgnoreTermsToCalendarHeadingSections')
      expect(result.some((i) => i.type === 'heading' && i.label === 'Filtering')).toBe(true)
    })

    test('keeps parent when only a dependent matches', () => {
      const result = filterSettingsItems(sampleItems, 'calendar headings')
      const keys = result.map((i) => i.key).filter(Boolean)
      expect(keys).toContain('applyIgnoreTermsToCalendarHeadingSections')
      expect(keys).toContain('ignoreItemsWithTerms')
    })

    test('returns empty array (no content) when nothing matches', () => {
      const result = filterSettingsItems(sampleItems, 'zzzznotfound')
      expect(result).toEqual([])
    })
  })
})
