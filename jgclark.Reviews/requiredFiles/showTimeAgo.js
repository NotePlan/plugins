/* eslint-disable no-unused-vars */
/* eslint-disable prefer-template */
//--------------------------------------------------------------------------------------
// Show time ago
// Note: requires a meta tag 'startTime'
// Last updated: 2026-08-17 for v2.0.7 by @jgclark + @CursorAI
//--------------------------------------------------------------------------------------

/**
 * Format a past duration as a relative string (e.g. "1 minute ago").
 * Uses Intl.RelativeTimeFormat when available; otherwise compact buckets (Nm/Nh/Nd).
 * @param {number} diffMins minutes since startTime (can be fractional)
 * @returns {string}
 */
function formatTimeAgo(diffMins) {
  if (diffMins <= 0.1) {
    return 'just now'
  }
  const roundedMins = Math.round(diffMins)
  const roundedHours = Math.round(diffMins / 60.0)
  const roundedDays = Math.round(diffMins / 60.0 / 24.0)
  if (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function') {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'always', style: 'long' })
    if (diffMins < 90) {
      return rtf.format(-roundedMins, 'minute')
    }
    if (diffMins < 1440) {
      return rtf.format(-roundedHours, 'hour')
    }
    return rtf.format(-roundedDays, 'day')
  }
  if (diffMins <= 1) {
    return '<1m ago'
  }
  if (diffMins < 1.5) {
    return '1m ago'
  }
  if (diffMins <= 90) {
    return String(roundedMins) + 'm ago'
  }
  if (diffMins <= 1440) {
    return String(roundedHours) + 'h ago'
  }
  return String(roundedDays) + 'd ago'
}

function showTimeAgo() {
  const startTimeMeta = document.getElementsByName('startTime')[0]
  if (!startTimeMeta) {
    return
  }
  const startTime = Number(startTimeMeta.getAttribute('content'))
  const now = Date.now()
  const diffMins = (now - startTime) / 1000.0 / 60.0
  const timerEl = document.getElementById('timer')
  if (timerEl) {
    timerEl.innerHTML = formatTimeAgo(diffMins)
  }
  setTimeout(showTimeAgo, 30000) // call again in 30s
}

// Start after DOM is ready (body onload can run before post-body scripts that define showTimeAgo) -- added by @CursorAI
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', showTimeAgo)
} else {
  showTimeAgo()
}
