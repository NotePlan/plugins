/* eslint-disable no-unused-vars */
/* eslint-disable prefer-template */
//--------------------------------------------------------------------------------------
// Show time ago
// Note: requires a meta tag 'startTime'
// Last updated: 17.3.2024 for v1.0.0 by @jgclark
//--------------------------------------------------------------------------------------

// Show relative time
// TODO: use MOMENT moment.duration(-1, "minutes").humanize(true);
// or https://www.jqueryscript.net/time-clock/Relative-Timestamps-Update-Plugin-timeago.html
// or https://theprogrammingexpert.com/javascript-count-up-timer/
function showTimeAgo() {
  const startTime = document.getElementsByName('startTime')[0].getAttribute('content') // Get startTime from meta tag
  const now = Date.now()
  const diff = (Math.round(now - startTime) / 1000.0 / 60.0)  // in Mins
  let output = ''
  if (diff <= 0.1) {
    output = 'just now'
  } else if (diff <= 1) {
    output = '<1 min ago'
  } else if (diff < 1.5) {
    output = '1 min ago'
  } else if (diff <= 90) {
    output = String(Math.round(diff)) + ' mins ago'
  } else if (diff <= 1440) {
    output = String(Math.round(diff / 60.0)) + ' hours ago'
  } else if (diff <= 43776) {
    output = String(Math.round(diff / 60.0 / 24.0)) + ' days ago'
  } else if (diff <= 525312) {
    output = String(Math.round(diff / 60.0 / 24.0 / 30.4)) + ' mon ago'
  } else {
    output = String(Math.round(diff / 60.0 / 24.0 / 30.4 / 365.0)) + ' yrs ago'
  }
  console.log(`showTimeAgo(): new output = ${output}`) // ✅
  // FIXME(@dwertheimer: why does this next line not work in the React version? It worked before.
  document.getElementById('timer').innerHTML = output
  setTimeout(showTimeAgo, 30000) // call again in 30s
}
