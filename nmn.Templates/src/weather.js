// @flow

// TODO:
// - ideally find a way to get current location. It must be possible as Scriptable achieves this
//   with await Location.current()
//   and has a Location.reverseGeocode(latitude, longitude) field -> postal town etc.

// import { showMessage } from '../../helperFunctions'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

// Get summary of today's weather in a line
// Using https://openweathermap.org/api/one-call-api#data, for which you can get a free API key
export async function getWeatherSummary(
  // eslint-disable-next-line no-unused-vars
  weatherParams: string,
): Promise<string> {
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
    // eslint-disable-next-line comma-dangle
    'tornado',
  ]
  //$FlowIgnore
  const weatherDescIcons = [
    '🌦️',
    '🌧️',
    '🌤',
    '⛅',
    '☀️',
    '☀️',
    '☁️',
    '🌨️',
    '⛈',
    '🌪',
  ]

  const minimumConfig = {
    openWeatherAPIKey: 'string',
    latPosition: 'number',
    longPosition: 'number',
    openWeatherUnits: 'string',
  }

  // Get config settings from Template folder _configuration note
  const weatherConfig = await getOrMakeConfigurationSection(
    'weather',
    DEFAULT_WEATHER_CONFIG,
    minimumConfig,
  )

  // Get config settings from Template folder _configuration note
  // $FlowIgnore[incompatible-type]
  console.log(`\tSettings are ${JSON.stringify(weatherConfig)}`)
  if (weatherConfig == null) {
    console.log(
      "Cannot find 'weather' settings in Templates/_configuration note.",
    )
    return "Error: Cannot find 'weather' settings in Templates/_configuration note."
  }

  const {
    openWeatherAPIKey,
    latPosition,
    longPosition,
    openWeatherUnits,
    showFeelsLike,
    includeTimezone,
  } = weatherConfig

  if (
    openWeatherAPIKey == null ||
    typeof openWeatherAPIKey !== 'string' ||
    latPosition == null ||
    typeof latPosition !== 'number' ||
    longPosition == null ||
    typeof longPosition !== 'number' ||
    openWeatherUnits == null ||
    typeof openWeatherUnits !== 'string'
  ) {
    return `Invalid configuration provided`
  }

  const getWeatherURL = `https://api.openweathermap.org/data/2.5/onecall?lat=${encodeURIComponent(
    latPosition.toString(),
  )}&lon=${encodeURIComponent(
    longPosition.toString(),
  )}&exclude=current,hourly,minutely&units=${encodeURIComponent(
    openWeatherUnits,
  )}&appid=${encodeURIComponent(openWeatherAPIKey)}`

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
    console.log(
      `Error ${err.message} parsing Weather data lookup. Please check your _configuration note.`,
    )
    return `Error ${err.message} parsing Weather data lookup. Please check your _configuration note.`
  }
  if (jsonIn != null) {
    try {
      // $FlowIgnore[incompatible-call]
      allWeatherData = JSON.parse(jsonIn)
    } catch (err) {
      console.log(
        `Error ${err.message} parsing Weather data lookup. Please check your _configuration note.`,
      )
      return `Error ${err.message} parsing Weather data lookup. Please check your _configuration note.`
    }
    console.log(`WeatherData: ${JSON.stringify(allWeatherData)}`)
    if (allWeatherData.cod === 401)
      return `Weather: Invalid configuration settings. ${allWeatherData.message}`

    // const weatherTodayAll = jsonIn.daily['0']
    const weatherTodayAll = allWeatherData?.daily['0']
    const fMax = weatherTodayAll.feels_like.day.toFixed(0)
    const fMin = weatherTodayAll.feels_like.night.toFixed(0)
    const minTemp = weatherTodayAll.temp.min.toFixed(0)
    const maxTemp = weatherTodayAll.temp.max.toFixed(0)
    const weatherDesc = weatherTodayAll.weather['0'].description ?? ''
    const units = openWeatherUnits === 'imperial' ? '°F' : '°C'
    const feelsLine = `${
      showFeelsLike ? `, Feels like ${fMin}${units}-${fMax}${units} ` : ''
    }`
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

    // TODO: Allow for more customisation of what is pulled out from the API's data structure
    // using weatherParams
    // Future use, if we want to do more customisation with parameters
    // console.log(`getWeatherSummary: Params: '${weatherParams}'`)
    // const paramConfig = weatherParams.trim()
    //   ? await parseJSON5(weatherParams)
    //   : {}
    // console.log(paramConfig)

    let summaryLine = `Weather: ${weatherIcon}${weatherDesc} ${minTemp}${units}-${maxTemp}${units}${feelsLine}`
    if (includeTimezone) {
      summaryLine += ` in ${timezone}`
    }
    console.log(`\t${summaryLine}`)
    return summaryLine
  } else {
    // $FlowFixMe[incompatible-type]
    return `Problem in Weather data lookup for ${latPosition}/${longPosition}. Please check your _configuration note.`
  }
}

const DEFAULT_WEATHER_CONFIG = `
  // configuration for weather data (used in Daily Note Template, for example)
  weather: {
    // API key for https://openweathermap.org/
    // !!REQUIRED!!
    openWeatherAPIKey: '... put your API key here ...',
    // Required location for weather forecast
    latPosition: 0.0,
    longPosition: 0.0,
    // Default units. Can be 'metric' (for Celsius), or 'imperial' (for Fahrenheit)
    openWeatherUnits: 'metric',
    // prefer feels_like over actual temperature
    showFeelsLike: false,
    includeTimezone: false,
  },
`
