// @flow
// Show relative time
// TODO: use MOMENT moment.duration(-1, "minutes").humanize(true);
// or https://www.jqueryscript.net/time-clock/Relative-Timestamps-Update-Plugin-timeago.html
// or https://theprogrammingexpert.com/javascript-count-up-timer/

// import { logDebug } from '@helpers/react/reactDev.js'

/**
 * Calculates how long ago a given timestamp occurred.
 * @param {string} timestamp - Timestamp of the past time to evaluate.
 * @returns {string} - A human-readable string indicating time elapsed.
 */
export function getTimeAgo(timestamp: Date): string {
  // const startTime = Date.parse(timestamp)
  const startTime: Date = timestamp
  const now: Date = Date.now()
  const diff: number = Math.round((now - startTime) / 1000.0) / 60.0 // Convert to minutes

  let output = ''
  if (diff <= 0.1) {
    output = 'just now'
  } else if (diff <= 1) {
    output = '<1 min ago'
  } else if (diff < 1.5) {
    output = '1 min ago'
  } else if (diff <= 90) {
    output = `${Math.round(diff)} mins ago`
  } else if (diff <= 1440) {
    output = `${Math.round(diff / 60.0)} hours ago`
  } else if (diff <= 43776) {
    output = `${Math.round(diff / 1440.0)} days ago`
  } else if (diff <= 525312) {
    output = `${Math.round(diff / 43800.0)} mon ago`
  } else {
    output = `${Math.round(diff / 525600.0)} yrs ago`
  }

  return output
}
