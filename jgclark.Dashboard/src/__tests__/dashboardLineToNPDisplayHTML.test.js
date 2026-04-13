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
  })
})
