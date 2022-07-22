// @flow

// TODO:
// - ideally find a way to get current location. It must be possible as Scriptable achieves this
//   with await Location.current() and has a
//   Location.reverseGeocode(latitude, longitude) field -> postal town etc.

import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import { getTagParamsFromString, stringReplace, capitalize } from '../../helpers/general'

//------------------------------------------------------------------------------
// Preference Settings
const DEFAULT_WEATHER_CONFIG = `// configuration for weather data (used in Daily Note Template, for example)
  weather: {
    // API key for https://openweathermap.org/
    openWeatherAPIKey: '... put your API key here ...', // !!REQUIRED!!
    // Required location for weather forecast
    latPosition: 0.0,  // !!REQUIRED!!
    longPosition: 0.0, // !!REQUIRED!!
    // Default units. Can be 'metric' (for Celsius), or 'imperial' (for Fahrenheit)
    openWeatherUnits: 'metric',
  },
`

const MINIMUM_WEATHER_CONFIG = {
  openWeatherAPIKey: 'string',
  latPosition: 'number',
  longPosition: 'number',
  openWeatherUnits: 'string',
}

//------------------------------------------------------------------------------
/**
 * Get summary of today's weather in a line, using
 * https://openweathermap.org/api/one-call-api#data, for which you can get a free API key
 * @author @jgclark, with customisation by @dwertheimer
 * @param {string} weatherParams - optional customisation for how to display the results
 */
export async function getWeatherSummary(weatherParams: string): Promise<string> {
  const weatherDescText = [
    'showers',
    'rain',
    'sunny intervals',
    'partly sunny',
    'sunny',
    'clear sky',
    'cloud',
    'snow ',
    'thunderstorm',
    'tornado',
  ]
  const weatherDescIcons = ['🌦️', '🌧️', '🌤', '⛅', '☀️', '☀️', '☁️', '🌨️', '⛈', '🌪']

  // Get config settings from Template folder _configuration note
  const weatherConfig = await getOrMakeConfigurationSection('weather', DEFAULT_WEATHER_CONFIG, MINIMUM_WEATHER_CONFIG)

  // Get config settings from Template folder _configuration note
  // $FlowIgnore[incompatible-type]
  console.log(`\tWeather settings are ${JSON.stringify(weatherConfig)}`)
  if (weatherConfig == null) {
    console.log("Cannot find 'weather' settings in Templates/_configuration note.")
    return "Error: Cannot find 'weather' settings in Templates/_configuration note."
  }

  const isWeatherKeyValid = (key) => key !== null && !key?.match(/[a-f0-9]{32}/)

  const { openWeatherAPIKey, latPosition, longPosition, openWeatherUnits } = weatherConfig
  // $FlowIgnore[incompatible-use]
  if (openWeatherAPIKey !== null && !openWeatherAPIKey?.match(/[a-f0-9]{32}/)) {
    console.log("Cannot find a valid API Key 'weather' settings in Templates/_configuration note.")
    return "Error: Cannot find a valid API Key 'weather' settings in Templates/_configuration note."
  }

  const getWeatherURLLatLong = `https://api.openweathermap.org/data/2.5/onecall?lat=${
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

  // ** The following is the more correct way, but doesn't work.
  //    So have to use a way that Flow doesn't like.
  //    See Issue 7 **
  // const response = await fetch(getWeatherURL)
  // console.log(response.status)
  // console.log(response.statusText)
  // console.log(response.type)
  // console.log(response.url)
  // let jsonIn
  // if (response.ok) { // if HTTP-status is 200-299
  //   jsonIn = await response.json()
  // } else {
  //   return `Sorry; error ${response.status} in Weather lookup`
  // }

  // console.log(getWeatherURL)
  let jsonIn, allWeatherData
  try {
    jsonIn = await fetch(getWeatherURL)
    // console.log(`  HTTP response ${jsonIn.status}`) //  .status always returns 'undefined', even when it works?!
  } catch (err) {
    console.log(`Error ${err.message} parsing Weather data lookup. Please check your _configuration note.`)
    return `Error ${err.message} parsing Weather data lookup. Please check your _configuration note.`
  }
  if (jsonIn != null) {
    try {
      // $FlowIgnore[incompatible-call]
      allWeatherData = JSON.parse(jsonIn)
    } catch (err) {
      console.log(`Error ${err.message} parsing Weather data lookup. Please check your _configuration note.`)
      return `Error ${err.message} parsing Weather data lookup. Please check your _configuration note.`
    }
    // console.log(`WeatherData: ${JSON.stringify(allWeatherData)}`)
    if (allWeatherData.cod === 401) {
      return `Weather: Invalid configuration settings. ${allWeatherData.message}`
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
    const replacements = [
      { key: '|FEELS_LIKE_LOW|', value: fMin },
      { key: '|FEELS_LIKE_HIGH|', value: fMax },
      { key: '|LOW_TEMP|', value: minTemp },
      { key: '|HIGH_TEMP|', value: maxTemp },
      { key: '|DESCRIPTION|', value: capitalize(weatherDesc) },
      { key: '|TIMEZONE|', value: timezone },
      { key: '|UNITS|', value: units },
      { key: '|WEATHER_ICON|', value: weatherIcon },
    ]

    const defaultWeatherLine = `Weather: |WEATHER_ICON| |DESCRIPTION| |LOW_TEMP||UNITS|-|HIGH_TEMP||UNITS|; Feels like: |FEELS_LIKE_LOW||UNITS|-|FEELS_LIKE_HIGH||UNITS|`

    const template = await getTagParamsFromString(weatherParams, 'template', defaultWeatherLine)
    // const template =
    //   (weatherParams !== '' && getTagParams(weatherParams, 'template') !== '')
    //     ? getTagParams(weatherParams, 'template')
    //     : defaultWeatherLine
    console.log(`\toutput template: '${template}' ; about to call stringReplace`)
    return stringReplace(template, replacements)
  } else {
    // $FlowFixMe[incompatible-type]
    return `Problem in Weather data lookup for ${latPosition}/${longPosition}. Please check your _configuration note.`
  }
}
