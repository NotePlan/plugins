// @flow

import pluginJson from '@plugins/np.Templating/plugin.json'
import { capitalize } from '@helpers/general'
import { logError } from '@helpers/dev'

//------------------------------------------------------------------------------
// Preference Settings
// API key for https://openweathermap.org/

const defaultWeatherConfig = {
  openWeatherAPIKey: '19a11168bcc123dc86c1b92682bfb74f',
  latPosition: 0,
  longPosition: 0,
  openWeatherUnits: 'Celcius',
}

//------------------------------------------------------------------------------
/**
 * Get summary of today's weather in a line, using
 * https://openweathermap.org/api/one-call-api#data, for which you can get a free API key
 * @author @jgclark, with customisation by @dwertheimer, adapted to np.Templating by @codedungeon
 * @param {string} weatherParams - optional customisation for how to display the results
 */
export async function getWeatherSummary(weatherParams: string): Promise<string> {
  const weatherDescText = ['showers', 'rain', 'sunny intervals', 'partly sunny', 'sunny', 'clear sky', 'cloud', 'snow ', 'thunderstorm', 'tornado']
  const weatherDescIcons = ['🌦️', '🌧️', '🌤', '⛅', '☀️', '☀️', '☁️', '🌨️', '⛈', '🌪']

  // Get config settings from Template folder _configuration note
  const weatherConfig = { ...defaultWeatherConfig }

  let { openWeatherAPIKey, latPosition, longPosition, openWeatherUnits } = weatherConfig
  openWeatherUnits = openWeatherUnits === 'Fahrenheit' ? 'imperial' : 'metric'

  // $FlowIgnore[incompatible-use]
  if (openWeatherAPIKey !== null && !openWeatherAPIKey?.match(/[a-f0-9]{32}/)) {
    logError('Invalid Open Weather API Key')
    await CommandBar.prompt('Weather Lookup', 'Invalid Open Weather API Key')
  }

  const getWeatherURL = `https://api.openweathermap.org/data/2.5/onecall?lat=${
    encodeURIComponent(
      // $FlowFixMe
      latPosition.toString(),
    )
    // $FlowFixMe
  }&lon=${
    encodeURIComponent(longPosition.toString())
    // $FlowFixMe
  }&exclude=current,hourly,minutely&units=${
    encodeURIComponent(openWeatherUnits)
    // $FlowFixMe
  }&appid=${encodeURIComponent(openWeatherAPIKey)}`

  let jsonIn, allWeatherData
  try {
    jsonIn = await fetch(getWeatherURL)
  } catch (err) {
    return logError(pluginJson, 'An error occurred getting weather')
  }

  if (jsonIn != null) {
    try {
      // $FlowIgnore[incompatible-call]
      allWeatherData = JSON.parse(jsonIn)
    } catch (err) {
      await CommandBar.prompt('Weather Lookup', `${err.message} parsing Weather data. Please check weather settings`)
      return logError(pluginJson, `${err.message} parsing Weather data. Please check weather settings`)
    }
    if (allWeatherData.cod === 401) {
      await CommandBar.prompt('Weather Lookup', `Weather: Invalid configuration settings. ${allWeatherData.message}`)
      return logError(`Weather: Invalid configuration settings. ${allWeatherData.message}`)
    }

    const weatherTodayAll = allWeatherData?.daily['0']
    const fMax = weatherTodayAll.feels_like.day.toFixed(0)
    const fMin = weatherTodayAll.feels_like.night.toFixed(0)
    const minTemp = weatherTodayAll.temp.min.toFixed(0)
    const maxTemp = weatherTodayAll.temp.max.toFixed(0)
    const weatherDesc = weatherTodayAll.weather['0'].description ?? ''
    const units = openWeatherUnits === 'imperial' ? '°F' : '°C'
    const timezone = allWeatherData.timezone
    // see if we can fix an icon for this as well, according to returned description. Main terms are:
    // thunderstorm, drizzle, shower > rain, snow, sleet, clear sky, mist, fog, dust, tornado, overcast > clouds
    // with 'light' modifier for rain and snow
    let weatherIcon = ''
    for (let i = 0; i < weatherDescText.length; i++) {
      if (weatherDesc.match(weatherDescText[i])) {
        weatherIcon = weatherDescIcons[i]
        break
      }
    }

    let WEATHER_ICON = weatherIcon
    let DESCRIPTION = capitalize(weatherDesc)
    let LOW_TEMP = minTemp
    let HIGH_TEMP = maxTemp
    let UNITS = units
    let FEELS_LIKE_LOW = fMin
    let FEELS_LIKE_HIGH = fMax

    const defaultWeatherLine = `Weather: ${WEATHER_ICON} ${DESCRIPTION} ${LOW_TEMP}${UNITS}-${HIGH_TEMP}${UNITS}; Feels like: ${FEELS_LIKE_LOW}${UNITS}-${FEELS_LIKE_HIGH}${UNITS}`
    // $FlowIgnore
    return weatherParams.length > 0 ? Function('`' + weatherParams + '`') : defaultWeatherLine
  } else {
    // $FlowFixMe[incompatible-type]
    await CommandBar.prompt('Weather Lookup', `An error occurred in data lookup for ${latPosition}/${longPosition}. Please review settings.`)
    return logError(pluginJson, `An error occurred in data lookup for ${latPosition}/${longPosition}. Please review settings.`)
  }
}
