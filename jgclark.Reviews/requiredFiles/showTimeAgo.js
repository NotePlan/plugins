/* eslint-disable no-unused-vars */
/* eslint-disable prefer-template */
//--------------------------------------------------------------------------------------
// Show time ago
// Note: requires a meta tag 'startTime'
// Last updated: 2026-09-11 for v2.1.1 by @jgclark + @CursorAI
//--------------------------------------------------------------------------------------

/**
 * Format a past duration as compact relative time, matching Dashboard's header
 * (getTimeAgoString plus Header's min/hour compactification).
 * e.g. "just now", "<1m ago", "2m ago", "3h ago", "2 days ago".
 * @param {number} diffMins minutes since startTime (can be fractional)
 * @returns {string}
 */
function formatTimeAgo(diffMins) {
  if (diffMins <= 0.1) {
    return 'just now'
  }
  if (diffMins <= 1) {
    return '<1m ago'
  }
  if (diffMins < 1.5) {
    return '1m ago'
  }
  if (diffMins <= 90) {
    return String(Math.round(diffMins)) + 'm ago'
  }
  if (diffMins <= 1440) {
    return String(Math.round(diffMins / 60.0)) + 'h ago'
  }
  if (diffMins <= 43776) {
    return String(Math.round(diffMins / 1440.0)) + 'd ago'
  }
  if (diffMins <= 525312) {
    return String(Math.round(diffMins / 43800.0)) + ' mon ago'
  }
  return String(Math.round(diffMins / 525600.0)) + ' yrs ago'
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
