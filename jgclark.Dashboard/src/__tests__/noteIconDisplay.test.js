/* globals describe, expect, test */
// Tests for noteIconDisplay helpers. Last updated 2026-07-21 for v2.4.0.b53

import { getNoteIconDisplayProps } from '../noteIconDisplay'

describe('jgclark.Dashboard/noteIconDisplay', () => {
  describe('getNoteIconDisplayProps()', () => {
    test('uses frontmatter icon name when present', () => {
      const result = getNoteIconDisplayProps({ icon: 'paintbrush', filenameOrTitle: 'Some Note.md' })
      expect(result.iconClassName).toBe('fa-light fa-fw fa-paintbrush')
    })

    test('applies iconColor via tailwindToHsl when present', () => {
      const result = getNoteIconDisplayProps({ icon: 'paintbrush', iconColor: 'yellow-600' })
      expect(result.iconClassName).toContain('fa-paintbrush')
      expect(result.iconStyleAttr).toMatch(/^color: /)
      expect(result.iconStyle.color).toBeTruthy()
    })

    test('uses daily calendar icon for daily date string', () => {
      const result = getNoteIconDisplayProps({ filenameOrTitle: '2026-07-21' })
      expect(result.iconClassName).toBe('fa-light fa-fw fa-calendar-star')
    })

    test('uses weekly calendar icon for week string', () => {
      const result = getNoteIconDisplayProps({ filenameOrTitle: '2026-W30' })
      expect(result.iconClassName).toBe('fa-light fa-fw fa-calendar-week')
    })

    test('uses monthly calendar icon for month string', () => {
      const result = getNoteIconDisplayProps({ filenameOrTitle: '2026-07' })
      expect(result.iconClassName).toBe('fa-light fa-fw fa-calendar-days')
    })

    test('uses quarterly calendar icon for quarter string', () => {
      const result = getNoteIconDisplayProps({ filenameOrTitle: '2026-Q3' })
      expect(result.iconClassName).toBe('fa-light fa-fw fa-calendar-range')
    })

    test('defaults to file-lines for ordinary titles', () => {
      const result = getNoteIconDisplayProps({ filenameOrTitle: 'Acme Project' })
      expect(result.iconClassName).toBe('fa-light fa-fw fa-file-lines')
      expect(result.iconStyleAttr).toBe('')
    })

    test('defaultIcon overrides calendar/file heuristics when no FM icon', () => {
      const result = getNoteIconDisplayProps({
        filenameOrTitle: '2026-07-21',
        defaultIcon: 'fa-regular fa-folder',
      })
      expect(result.iconClassName).toBe('fa-regular fa-folder')
    })

    test('FM icon wins over defaultIcon and calendar heuristics', () => {
      const result = getNoteIconDisplayProps({
        icon: 'star',
        filenameOrTitle: '2026-07-21',
        defaultIcon: 'fa-regular fa-folder',
      })
      expect(result.iconClassName).toBe('fa-light fa-fw fa-star')
    })
  })
})
