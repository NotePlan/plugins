// @flow
// ------------------------------------------------------------------------------------
// Command to turn time blocks into full calendar events
// (From 0.11.4 code mostly in helpers/NPcalendar.js)
// @jgclark
// Last updated 5.2.2022 for v0.11.4, by @jgclark
// ------------------------------------------------------------------------------------

import { getEventsSettings } from './eventsHelpers'
import { writeTimeBlocksToCalendar } from '@helpers/NPCalendar'

/**
 * Go through current Editor note, identify time blocks to turn into events,
 * and then add them as events.
 * @author @jgclark
 */
export async function timeBlocksToCalendar(): Promise<void> {
  // Get config settings
  const config = await getEventsSettings()
  await writeTimeBlocksToCalendar(config, Editor)
}
