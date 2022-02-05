// @flow

import { getEventsSettings } from './config'
import { writeTimeBlocksToCalendar } from '../../helpers/NPCalendar'

/**
 * Go through current Editor note, identify time blocks to turn into events,
 * and then add them as events.
 * @author @jgclark
 */
export async function timeBlocksToCalendar(): Promise<void> {
  // Get config settings from Template folder _configuration note
  const config = await getEventsSettings()
  await writeTimeBlocksToCalendar(config, Editor)
}
