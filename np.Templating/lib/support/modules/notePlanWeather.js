/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

import { stringReplace } from '../../../../helpers/general'

/**
 * Note: Available from NotePlan v3.19.2
 * Fetches current weather data and forecast using OpenWeatherMap API.
 * Automatically detects location via IP geolocation or uses provided coordinates.
 * Returns formatted weather information with emojis and detailed weather data.
 *
 * @param {string} format - Custom format string with placeholders (use '' for default formatted output)
 * @param {string} units - Temperature units: "metric" (Celsius, m/s) or "imperial" (Fahrenheit, mph)
 * @param {number} latitude - Latitude coordinate (use 0 for IP-based location detection)
 * @param {number} longitude - Longitude coordinate (use 0 for IP-based location detection)
 * @return {Promise<string>} Promise that resolves to formatted weather string
 *
 * @example
 * // Get default formatted weather for current location (IP-based)
 * const weather = await getNotePlanWeather('', 'metric', 0, 0);
 * // Returns pre-formatted markdown with emoji
 *
 * @example
 * // Custom format with placeholders
 * const weather = await getNotePlanWeather(':emoji: :condition: - Temp: :temperature::temperatureUnit: (feels like :apparentTemperature:°)', 'imperial', 40.7128, -74.0060);
 * // Returns: "☀️ Clear Sky - Temp: 72°F (feels like 70°)"
 *
 * @example
 * // Compatible with old weather() format strings
 * const weather = await getNotePlanWeather('Weather: :icon: :description: :mintempC:-:maxtempC:°C (:areaName:)', 'metric', 51.5074, -0.1278);
 * // Returns: "Weather: ☀️ Clear Sky 12-18°C (London)"
 *
 * Available placeholders:
 * - :areaName: / :cityName: - City name
 * - :temperature: - Current temperature (number)
 * - :temperatureUnit: - Temperature unit (°C or °F)
 * - :apparentTemperature: - Feels-like temperature
 * - :humidity: - Humidity percentage
 * - :windSpeed: - Wind speed
 * - :windSpeedUnit: - Wind speed unit (m/s or mph)
 * - :windDirection: - Wind direction in degrees
 * - :uvIndex: - UV index
 * - :condition: / :description: - Weather condition
 * - :emoji: / :icon: - Weather emoji
 * - :visibility: - Visibility distance
 * - :highTemp: / :maxtempC: / :maxtempF: - High temperature
 * - :lowTemp: / :mintempC: / :mintempF: - Low temperature
 * - :sunrise: - Sunrise time
 * - :sunset: - Sunset time
 */
export async function getNotePlanWeather(format: string = '', units: string = 'metric', latitude: number = 0, longitude: number = 0): Promise<string | any> {
  try {
    // $FlowFixMe - NotePlan global is available at runtime
    const weather = await NotePlan.getWeather(units, latitude, longitude)

    // If no format specified, return the pre-formatted output
    if (!format || format === '') {
      return weather.formatted || '**No weather data available**'
    }

    // Special format to return raw object
    if (format === ':raw:' || format === ':object:') {
      console.log('getNotePlanWeather: Returning raw weather object:', weather)
      return weather
    }

    // Build replacements array with backward compatibility for old weather() placeholders
    const replacements = [
      // New NotePlan API fields
      { key: ':cityName:', value: String(weather.cityName || '') },
      { key: ':temperature:', value: String(weather.temperature || '') },
      { key: ':temperatureUnit:', value: String(weather.temperatureUnit || '') },
      { key: ':apparentTemperature:', value: String(weather.apparentTemperature || '') },
      { key: ':humidity:', value: String(weather.humidity || '') },
      { key: ':windSpeed:', value: String(weather.windSpeed || '') },
      { key: ':windSpeedUnit:', value: String(weather.windSpeedUnit || '') },
      { key: ':windDirection:', value: String(weather.windDirection || '') },
      { key: ':uvIndex:', value: String(weather.uvIndex || '') },
      { key: ':condition:', value: String(weather.condition || '') },
      { key: ':emoji:', value: String(weather.emoji || '') },
      { key: ':iconCode:', value: String(weather.iconCode || '') },
      { key: ':visibility:', value: String(weather.visibility || '') },
      { key: ':visibilityUnit:', value: String(weather.visibilityUnit || '') },
      { key: ':highTemp:', value: String(weather.highTemp || '') },
      { key: ':lowTemp:', value: String(weather.lowTemp || '') },
      { key: ':sunrise:', value: String(weather.sunrise || '') },
      { key: ':sunset:', value: String(weather.sunset || '') },

      // Backward compatibility with old weather() placeholders
      { key: ':areaName:', value: String(weather.cityName || '') },
      { key: ':description:', value: String(weather.condition || '') },
      { key: ':icon:', value: String(weather.emoji || '') },
      { key: ':mintempC:', value: String(weather.lowTemp || '') },
      { key: ':maxtempC:', value: String(weather.highTemp || '') },
      { key: ':mintempF:', value: String(weather.lowTemp || '') },
      { key: ':maxtempF:', value: String(weather.highTemp || '') },

      // Location fields
      { key: ':latitude:', value: String(weather.location?.latitude || '') },
      { key: ':longitude:', value: String(weather.location?.longitude || '') },
    ]

    // Perform replacements
    console.log(`getNotePlanWeather: Processing format string: "${format}"`)
    let output = stringReplace(format, replacements)
    console.log(`getNotePlanWeather: After replacements: "${output}"`)

    // Handle any remaining placeholders that might be direct property access
    // This allows for more flexible field access like the old weather API
    const matchesObj = output.matchAll(/:([\w]*?):/g)
    for (const matchedItem of matchesObj) {
      const key = matchedItem[1]
      if (weather[key] !== undefined) {
        output = output.replace(`:${key}:`, String(weather[key]))
        console.log(`getNotePlanWeather: Replaced :${key}: with ${weather[key]}`)
      }
    }

    console.log(`getNotePlanWeather: Final output: "${output}"`)
    return output
  } catch (error) {
    return `**Error fetching weather data: ${error.message || 'Unknown error'}**`
  }
}
