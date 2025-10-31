/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

/**
 * DEPRECATED: 2025-10-31
 *
 * This file is kept for historical reference only.
 * The wttr.in weather service was unreliable (frequent timeouts and service outages),
 * so we switched to using NotePlan's built-in OpenWeatherMap API via NotePlan.getWeather().
 *
 * The weather() function now calls getNotePlanWeather() from notePlanWeather.js
 * All functionality has been consolidated into the weather() function.
 *
 * See: np.Templating/lib/support/modules/notePlanWeather.js
 */

export const WEATHER_API_FALLBACK_MESSAGE =
  '; The external weather service has been having issues lately. You may want to try the new API: ` <%- NotePlan.getWeather(units, latitude, longitude) %> `'

export async function getWeather(): Promise<string> {
  try {
    // $FlowFixMe
    let response: any = await fetch(`https://wttr.in?format=3`, { timeout: 3000 })
    if (response) {
      response = response.startsWith('not found:')
        ? `**The weather service could not automatically determine your location from your IP address**${WEATHER_API_FALLBACK_MESSAGE}`
        : response
    }
    return response ? response : `**weather() web service did not respond**${WEATHER_API_FALLBACK_MESSAGE}`
  } catch (error) {
    return `**An error occurred accessing weather service**${WEATHER_API_FALLBACK_MESSAGE}`
  }
}
