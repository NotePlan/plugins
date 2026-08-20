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
      // Note: this date must stay in the past. stripTodaysDateRefsFromString() runs before the lozenge is applied
      // and deletes any >date that happens to be *today*, so a date that can become today makes this test fail on
      // exactly that one day. (It previously used >2026-08-01 and duly failed on 2026-08-01.)
      const html = makeStringContentToLookLikeNPDisplayInReact('Call bank >2020-01-01', { truncateLength: 0, taskPriority: 0 })
      expect(html).toContain('class="scheduledDate"')
      expect(html).toContain('fa-regular fa-calendar')
      // Date text without the leading '>' marker (calendar icon replaces it)
      expect(html).toMatch(/scheduledDate"><i class="fa-regular fa-calendar pad-right"><\/i>2020-01-01<\/span>/)
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

    test('renders NP calendar event links as calendar icon + title (not raw path / hashtag chips)', () => {
      const content = '![📅](2025-08-02 14:00:::814B23B7-2DAB-4C1A-A365-FCA6B97C6556:::NA:::Call @PeterS:::#D06B64)'
      const html = makeStringContentToLookLikeNPDisplayInReact(content, {
        truncateLength: 0,
        taskPriority: 0,
        startTime: 'none',
      })
      expect(html).toContain('fa-light fa-calendar')
      expect(html).toContain('event-link')
      expect(html).toContain('Call ')
      expect(html).toContain('@PeterS')
      expect(html).not.toContain('814B23B7')
      expect(html).not.toContain('class="hashtag"')
      expect(html).not.toContain('class="timeBlock')
      expect(html).toContain('style="color: #D06B64"')
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

    test('replaces @remind(UUID) token with bell icon HTML', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000'
      const html = makeStringContentToLookLikeNPDisplayInReact(`Finish report @remind(:::${uuid})`, { truncateLength: 0, taskPriority: 0 })
      expect(html).toContain('fa-bell')
      expect(html).toContain('class="reminderMarker"')
      expect(html).not.toContain(`@remind(:::${uuid})`)
    })

    test('replaces @remind(UUID) with list colour and time when lookup provided', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000'
      const html = makeStringContentToLookLikeNPDisplayInReact(`Finish report @remind(:::${uuid})`, {
        truncateLength: 0,
        taskPriority: 0,
        reminderDisplayById: { [uuid]: { color: '#34C759', time: '09:00' } },
      })
      expect(html).toContain('#34C759')
      expect(html).toContain('09:00')
      expect(html).not.toContain('class="hashtag"')
    })

    test('replaces @remind(UUID) without breaking marker HTML when no list colour (theme fallback hex)', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000'
      const html = makeStringContentToLookLikeNPDisplayInReact(`TEST reminder @remind(:::${uuid})`, {
        truncateLength: 0,
        taskPriority: 0,
      })
      expect(html).toContain('TEST reminder')
      expect(html).toContain('class="reminderMarker"')
      expect(html).toContain('fa-bell')
      expect(html).not.toContain('class="hashtag"')
      expect(html).not.toContain('class="attag"')
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
