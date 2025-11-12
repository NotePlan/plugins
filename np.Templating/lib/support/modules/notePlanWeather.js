/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow

import { stringReplace } from '../../../../helpers/general'
import { logDebug } from '@helpers/dev'

const safeString = (value: any): string => {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
}

const toNumber = (value: any): ?number => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const formatNumber = (value: ?number, decimals: number = 0): string => {
  if (value === null || value === undefined) {
    return ''
  }
  if (!Number.isFinite(value)) {
    return ''
  }
  const factor = Math.pow(10, decimals)
  const rounded = Math.round(value * factor) / factor
  return decimals > 0 ? rounded.toFixed(decimals) : String(Math.round(rounded))
}

const convertTemperature = (value: ?number, fromUnit: string = '', targetUnit: string): ?number => {
  if (value === null || value === undefined) {
    return null
  }
  const normalizedFrom = fromUnit.trim()
  if (normalizedFrom === targetUnit) {
    return value
  }
  if (normalizedFrom === '°C' && targetUnit === '°F') {
    return value * (9 / 5) + 32
  }
  if (normalizedFrom === '°F' && targetUnit === '°C') {
    return (value - 32) * (5 / 9)
  }
  return value
}

const normalizeSpeedUnit = (unit: ?string): string => {
  if (!unit) {
    return ''
  }
  const normalized = unit.toLowerCase()
  if (normalized === 'mph') {
    return 'mph'
  }
  if (normalized === 'kph' || normalized === 'kmh' || normalized === 'km/h') {
    return 'km/h'
  }
  if (normalized === 'm/s' || normalized === 'mps') {
    return 'm/s'
  }
  return normalized
}

const convertSpeed = (value: ?number, fromUnit: ?string, targetUnit: string): ?number => {
  if (value === null || value === undefined) {
    return null
  }
  const from = normalizeSpeedUnit(fromUnit)
  if (from === targetUnit) {
    return value
  }
  if (from === 'm/s') {
    if (targetUnit === 'km/h') {
      return value * 3.6
    }
    if (targetUnit === 'mph') {
      return value * 2.23693629
    }
  }
  if (from === 'km/h') {
    if (targetUnit === 'mph') {
      return value * 0.621371
    }
    if (targetUnit === 'm/s') {
      return value / 3.6
    }
  }
  if (from === 'mph') {
    if (targetUnit === 'km/h') {
      return value * 1.60934
    }
    if (targetUnit === 'm/s') {
      return value * 0.44704
    }
  }
  return value
}

const convertDistance = (value: ?number, fromUnit: ?string, targetUnit: string): ?number => {
  if (value === null || value === undefined) {
    return null
  }
  const normalizedFrom = (fromUnit || '').toLowerCase()
  if (normalizedFrom === targetUnit) {
    return value
  }
  if (normalizedFrom === 'km' && targetUnit === 'miles') {
    return value * 0.621371
  }
  if (normalizedFrom === 'miles' && targetUnit === 'km') {
    return value * 1.60934
  }
  return value
}

const degreesToCompass = (degrees: ?number): string => {
  const value = toNumber(degrees)
  if (value === null || value === undefined) {
    return ''
  }
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const numericValue: number = value
  const index = Math.round(numericValue / 22.5) % 16
  return directions[index]
}

const determineTemperatureUnits = (unitsParam: ?string, temperatureUnit: ?string): string => {
  if (unitsParam && unitsParam.toLowerCase() === 'imperial') {
    return 'imperial'
  }
  if (unitsParam && unitsParam.toLowerCase() === 'metric') {
    return 'metric'
  }
  if (temperatureUnit === '°F') {
    return 'imperial'
  }
  return 'metric'
}

const buildLegacyPlaceholderReplacements = (weather: any, unitsParam: ?string, windSpeedUnit: ?string, visibilityUnit: ?string): Array<{ key: string, value: string }> => {
  const temperatureUnits = determineTemperatureUnits(unitsParam, weather?.temperatureUnit)
  const temperatureSymbol = weather?.temperatureUnit || (temperatureUnits === 'imperial' ? '°F' : '°C')

  const apparentTemp = toNumber(weather?.apparentTemperature)
  const feelsLikeF = convertTemperature(apparentTemp, temperatureSymbol, '°F')
  const feelsLikeC = convertTemperature(apparentTemp, temperatureSymbol, '°C')

  const windSpeedValue = toNumber(weather?.windSpeed)
  const windSpeedMiles = convertSpeed(windSpeedValue, windSpeedUnit, 'mph')
  const windSpeedKmph = convertSpeed(windSpeedValue, windSpeedUnit, 'km/h')

  const windDirectionDegrees = toNumber(weather?.windDirection)
  const windCompass = degreesToCompass(windDirectionDegrees)

  const visibilityValue = toNumber(weather?.visibility)
  const visibilityMiles = convertDistance(visibilityValue, visibilityUnit || 'km', 'miles')

  const location = weather?.location ?? {}

  const regionName = location?.region ?? location?.regionName ?? location?.state ?? location?.administrativeArea ?? weather?.region ?? weather?.state ?? ''

  const countryName = location?.country ?? weather?.country ?? ''

  return [
    { key: ':FeelsLikeF:', value: formatNumber(feelsLikeF) },
    { key: ':FeelsLikeC:', value: formatNumber(feelsLikeC) },
    { key: ':winddir16Point:', value: windCompass },
    { key: ':winddirDegree:', value: formatNumber(windDirectionDegrees) },
    { key: ':windspeedMiles:', value: formatNumber(windSpeedMiles) },
    { key: ':windspeedKmph:', value: formatNumber(windSpeedKmph) },
    { key: ':visibilityMiles:', value: formatNumber(visibilityMiles) },
    { key: ':region:', value: safeString(regionName) },
    { key: ':country:', value: safeString(countryName) },
  ]
}

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
 * - :countryCode: - ISO country code
 * - :postalCode: - Postal/ZIP code
 * - :state: - State or administrative area
 * - :city: - City name (alias for :cityName:)
 * - :subLocality: - Sub-locality information
 * - :thoroughfare: - Street address or thoroughfare
 * - :ipAddress: - Detected IP address (IP lookup only)
 * - :ipVersion: - IP version (IP lookup only)
 * - :capital: - Country capital (IP lookup only)
 * - :phoneCodes: - Phone country codes (IP lookup only)
 * - :timeZones: - Time zones (IP lookup only)
 * - :continent: - Continent name (IP lookup only)
 * - :continentCode: - Continent code (IP lookup only)
 * - :currencies: - Currency codes (IP lookup only)
 * - :languages: - Language codes (IP lookup only)
 * - :asn: - Autonomous system number (IP lookup only)
 * - :asnOrganization: - ASN organization (IP lookup only)
 * - :isProxy: - Whether IP is a proxy (IP lookup only)
 */
export async function getNotePlanWeather(
  format: string = ':cityName:, :region: :icon: :temperature::temperatureUnit:',
  units: string | null = null,
  latitude: number | null = null,
  longitude: number | null = null,
): Promise<string | any> {
  try {
    // $FlowFixMe - NotePlan global is available at runtime
    // work around NotePlan api bug where 0 was not doing a lookup, so sending nulls instead
    const _latitude = !latitude && !longitude ? undefined : latitude
    const _longitude = !latitude && !longitude ? undefined : longitude
    const _units = !units ? undefined : units
    const unitsLabel: string = _units ?? 'default'
    const latitudeLabel: string = _latitude === null || _latitude === undefined ? 'auto' : String(_latitude)
    const longitudeLabel: string = _longitude === null || _longitude === undefined ? 'auto' : String(_longitude)
    logDebug('getNotePlanWeather', `Calling NotePlan.getWeather with units: "${unitsLabel}", latitude: "${latitudeLabel}", longitude: "${longitudeLabel}" format: "${format}"`)
    // $FlowFixMe[incompatible-call] - NotePlan.getWeather accepts undefined/null values for auto-detection
    const weather = await NotePlan.getWeather(_units, _latitude, _longitude)
    const location = weather?.location ?? {}
    const cityName = weather?.cityName ?? location?.cityName ?? location?.locality ?? ''
    const regionName = location?.region ?? location?.regionName ?? location?.state ?? location?.administrativeArea ?? weather?.region ?? weather?.state ?? ''
    const countryName = location?.country ?? weather?.country ?? ''

    // If no format specified, return the pre-formatted output
    if (!format || format === '') {
      return weather.formatted || '**No weather data available**'
    }

    // Special format to return raw object
    if (format === ':raw:' || format === ':object:') {
      logDebug('getNotePlanWeather', 'Returning raw weather object')
      return weather
    }

    // Build replacements array with backward compatibility for old weather() placeholders
    const replacements = [
      // New NotePlan API fields
      { key: ':cityName:', value: safeString(cityName) },
      { key: ':temperature:', value: safeString(weather.temperature) },
      { key: ':temperatureUnit:', value: safeString(weather.temperatureUnit) },
      { key: ':apparentTemperature:', value: safeString(weather.apparentTemperature) },
      { key: ':humidity:', value: safeString(weather.humidity) },
      { key: ':windSpeed:', value: safeString(weather.windSpeed) },
      { key: ':windSpeedUnit:', value: safeString(weather.windSpeedUnit) },
      { key: ':windDirection:', value: safeString(weather.windDirection) },
      { key: ':uvIndex:', value: safeString(weather.uvIndex) },
      { key: ':condition:', value: safeString(weather.condition) },
      { key: ':emoji:', value: safeString(weather.emoji) },
      { key: ':iconCode:', value: safeString(weather.iconCode) },
      { key: ':visibility:', value: safeString(weather.visibility) },
      { key: ':visibilityUnit:', value: safeString(weather.visibilityUnit) },
      { key: ':highTemp:', value: safeString(weather.highTemp) },
      { key: ':lowTemp:', value: safeString(weather.lowTemp) },
      { key: ':sunrise:', value: safeString(weather.sunrise) },
      { key: ':sunset:', value: safeString(weather.sunset) },

      // Backward compatibility with old weather() placeholders
      { key: ':areaName:', value: safeString(cityName) },
      { key: ':description:', value: safeString(weather.condition) },
      { key: ':icon:', value: safeString(weather.emoji) },
      { key: ':mintempC:', value: safeString(weather.lowTemp) },
      { key: ':maxtempC:', value: safeString(weather.highTemp) },
      { key: ':mintempF:', value: safeString(weather.lowTemp) },
      { key: ':maxtempF:', value: safeString(weather.highTemp) },

      // Location fields
      { key: ':latitude:', value: safeString(location?.latitude ?? weather?.latitude) },
      { key: ':longitude:', value: safeString(location?.longitude ?? weather?.longitude) },
      { key: ':region:', value: safeString(regionName) },
      { key: ':country:', value: safeString(countryName) },
      { key: ':countryCode:', value: safeString(location?.countryCode) },
      { key: ':postalCode:', value: safeString(location?.postalCode) },
      { key: ':state:', value: safeString(location?.state ?? location?.administrativeArea) },
      { key: ':city:', value: safeString(cityName) },
      { key: ':subLocality:', value: safeString(location?.subLocality) },
      { key: ':thoroughfare:', value: safeString(location?.thoroughfare) },
      { key: ':ipAddress:', value: safeString(location?.ipAddress) },
      { key: ':ipVersion:', value: safeString(location?.ipVersion) },
      { key: ':capital:', value: safeString(location?.capital) },
      {
        key: ':phoneCodes:',
        value: safeString(Array.isArray(location?.phoneCodes) ? location?.phoneCodes.join(', ') : location?.phoneCodes),
      },
      {
        key: ':timeZones:',
        value: safeString(Array.isArray(location?.timeZones) ? location?.timeZones.join(', ') : location?.timeZones),
      },
      { key: ':continent:', value: safeString(location?.continent) },
      { key: ':continentCode:', value: safeString(location?.continentCode) },
      {
        key: ':currencies:',
        value: safeString(Array.isArray(location?.currencies) ? location?.currencies.join(', ') : location?.currencies),
      },
      {
        key: ':languages:',
        value: safeString(Array.isArray(location?.languages) ? location?.languages.join(', ') : location?.languages),
      },
      { key: ':asn:', value: safeString(location?.asn) },
      { key: ':asnOrganization:', value: safeString(location?.asnOrganization) },
      { key: ':isProxy:', value: safeString(location?.isProxy) },
      { key: ':formatted:', value: safeString(weather.formatted) },
    ]

    const computedReplacements = buildLegacyPlaceholderReplacements(weather, _units, weather.windSpeedUnit, weather.visibilityUnit)
    replacements.push(...computedReplacements)

    // Perform replacements
    logDebug('getNotePlanWeather', `Processing format string: "${format}"`)
    let output = stringReplace(format, replacements)
    logDebug('getNotePlanWeather', `After replacements: "${output}"`)

    // Handle any remaining placeholders that might be direct property access
    // This allows for more flexible field access like the old weather API
    const matchesObj = output.matchAll(/:([\w]*?):/g)
    for (const matchedItem of matchesObj) {
      const key = matchedItem[1]
      if (weather[key] !== undefined) {
        output = output.replace(`:${key}:`, String(weather[key]))
        logDebug('getNotePlanWeather', `Replaced :${key}: with ${weather[key]}`)
      }
    }

    logDebug('getNotePlanWeather', `Final output: "${output}"`)
    return output
  } catch (error) {
    return `**Error fetching weather data: ${error.message || 'Unknown error'}**`
  }
}
