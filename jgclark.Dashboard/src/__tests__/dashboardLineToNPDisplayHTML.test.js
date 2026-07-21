/* globals describe, expect, test, beforeAll, beforeEach */
// Tests for dashboard line to HTML helpers. Last updated 2026-04-13 for v2.4.0.b23
// Dynamic import after global.DataStore so NPdateTime side effects at load see DataStore.

import { DataStore } from '@mocks/index'

let makeStringContentToLookLikeNPDisplayInReact
let applyDashboardSettingsToDisplayedItemHtml

beforeAll(async () => {
  global.DataStore = DataStore
  if (typeof DataStore.calendarNoteByDateString !== 'function') {
    DataStore.calendarNoteByDateString = () => null
  }
  const mod = await import('../react/dashboardLineToNPDisplayHTML.js')
  makeStringContentToLookLikeNPDisplayInReact = mod.makeStringContentToLookLikeNPDisplayInReact
  applyDashboardSettingsToDisplayedItemHtml = mod.applyDashboardSettingsToDisplayedItemHtml
})

/** Minimal settings for applyDashboardSettingsToDisplayedItemHtml (only fields the helper reads) */
const dashboardDefaults = {
  showScheduledDates: true,
  hidePriorityMarkers: false,
}

describe('jgclark.Dashboard/dashboardLineToNPDisplayHTML', () => {
  beforeEach(() => {
    DataStore.settings['_logLevel'] = 'none'
  })

  describe('makeStringContentToLookLikeNPDisplayInReact()', () => {
    test('wraps hashtags in span.hashtag', () => {
      const html = makeStringContentToLookLikeNPDisplayInReact('Do the thing #next @home', { truncateLength: 0, taskPriority: 0 })
      expect(html).toContain('class="hashtag"')
      expect(html).toContain('#next')
    })

    test('wraps mentions in span.attag', () => {
      const html = makeStringContentToLookLikeNPDisplayInReact('Discuss with @Alice soon', { truncateLength: 0, taskPriority: 0 })
      expect(html).toContain('class="attag"')
      expect(html).toContain('@Alice')
    })

    test('returns empty string for empty input', () => {
      expect(makeStringContentToLookLikeNPDisplayInReact('', { truncateLength: 0 })).toBe('')
    })

    test('truncates long content without throwing', () => {
      const long = 'x'.repeat(200)
      const html = makeStringContentToLookLikeNPDisplayInReact(long, { truncateLength: 80, taskPriority: 0 })
      expect(html.length).toBeLessThan(long.length)
    })

    test('wraps scheduled >dates in scheduledDate lozenge with calendar icon', () => {
      const html = makeStringContentToLookLikeNPDisplayInReact('Call bank >2026-08-01', { truncateLength: 0, taskPriority: 0 })
      expect(html).toContain('class="scheduledDate"')
      expect(html).toContain('fa-regular fa-calendar')
      // Date text without the leading '>' marker (calendar icon replaces it)
      expect(html).toMatch(/scheduledDate"><i class="fa-regular fa-calendar pad-right"><\/i>2026-08-01<\/span>/)
    })

    test('places timeblock label at the start using startTime/endTime, stripping original TB from content', () => {
      const html = makeStringContentToLookLikeNPDisplayInReact('Longer timeblocked task at 10:00-16:30', {
        truncateLength: 0,
        taskPriority: 0,
        startTime: '10:00',
        endTime: '16:30',
      })
      expect(html).toMatch(/^<span class="timeBlock margin-right-larger">/)
      expect(html).toContain('10:00-16:30')
      expect(html).toContain('Longer timeblocked task')
      // Original mid-line time should not remain in the rest of the text after the lozenge
      expect(html.replace(/<span class="timeBlock[\s\S]*?<\/span>/, '')).not.toContain('10:00')
    })

    test('strips NotePlan must-contain string from displayed timeblock content', () => {
      const html = makeStringContentToLookLikeNPDisplayInReact('Focus session >anytime at 14:00-15:30', {
        truncateLength: 0,
        taskPriority: 0,
        startTime: '14:00',
        endTime: '15:30',
        timeblockTextMustContainString: '>anytime',
      })
      expect(html).toContain('14:00-15:30')
      expect(html).toContain('Focus session')
      expect(html).not.toContain('>anytime')
    })

    test('does not prepend timeblock when startTime is none', () => {
      const html = makeStringContentToLookLikeNPDisplayInReact('Ordinary task with 10:00 in text', {
        truncateLength: 0,
        taskPriority: 0,
        startTime: 'none',
      })
      expect(html).not.toContain('class="timeBlock')
      expect(html).toContain('Ordinary task with 10:00 in text')
    })

    test('inline note link drops #heading and truncates long titles in display text', () => {
      const longTitle = 'A'.repeat(60)
      const html = makeStringContentToLookLikeNPDisplayInReact(`See [[${longTitle}#Heading]] today`, { truncateLength: 0, taskPriority: 0 })
      expect(html).toContain(`${'A'.repeat(50)}…`)
      expect(html).not.toContain('#Heading')
      expect(html).toContain(`encodedFilename:'${encodeURIComponent(`${longTitle}#Heading`)}'`)
    })

    test('aliased note link uses alias as display text and keeps full title for open', () => {
      const html = makeStringContentToLookLikeNPDisplayInReact('See [short]([[Very Long Note Title#Section]]) today', { truncateLength: 0, taskPriority: 0 })
      expect(html).toContain('short</a>')
      expect(html).not.toContain('Very Long Note Title#Section</a>')
      expect(html).toContain(`encodedFilename:'${encodeURIComponent('Very Long Note Title#Section')}'`)
      expect(html).not.toContain('class="externalLink"')
    })

    test('mid-task note link uses linkedNoteIcons frontmatter icon and color', () => {
      const html = makeStringContentToLookLikeNPDisplayInReact('See [[Acme Project]] today', {
        truncateLength: 0,
        taskPriority: 0,
        linkedNoteIcons: {
          'Acme Project': { icon: 'paintbrush', iconColor: 'yellow-600', filename: 'Projects/Acme.md' },
        },
      })
      expect(html).toContain('fa-paintbrush')
      expect(html).toMatch(/style="color: /)
      expect(html).not.toContain('fa-file-lines')
    })

    test('mid-task note link defaults to file-lines when linkedNoteIcons missing', () => {
      const html = makeStringContentToLookLikeNPDisplayInReact('See [[Unknown Note]] today', { truncateLength: 0, taskPriority: 0 })
      expect(html).toContain('fa-file-lines')
    })

    test('mid-task calendar note link uses calendar icon heuristic without linkedNoteIcons', () => {
      const html = makeStringContentToLookLikeNPDisplayInReact('See [[2026-07-21]] today', { truncateLength: 0, taskPriority: 0 })
      expect(html).toContain('fa-calendar-star')
    })
  })

  describe('applyDashboardSettingsToDisplayedItemHtml()', () => {
    test('strips leading priority markers inside spans when hidePriorityMarkers is true', () => {
      const inner = '!! important task'
      const html = `<span class="priority2">${inner}</span>`
      const out = applyDashboardSettingsToDisplayedItemHtml(html, {
        ...dashboardDefaults,
        hidePriorityMarkers: true,
      })
      expect(out).toContain('important task')
      expect(out).not.toContain('!! ')
    })

    test('removes scheduledDate lozenges when showScheduledDates is false', () => {
      const html = 'Call bank <span class="scheduledDate"><i class="fa-regular fa-calendar pad-right"></i>2026-08-01</span>'
      const out = applyDashboardSettingsToDisplayedItemHtml(html, {
        ...dashboardDefaults,
        showScheduledDates: false,
      })
      expect(out).not.toContain('scheduledDate')
      expect(out).not.toContain('2026-08-01')
      expect(out).toContain('Call bank')
    })
  })
})
