// @flow

// WARNING: This code should not be used as it uses old NotePlan configuration, will aim to remove completely

import { getTagParamsFromString, stringReplace, capitalize } from '@helpers/general'
import { getOrMakeConfigurationSection } from '@templating/toolbox'

export const DEFAULT_WEATHER_CONFIG = `// configuration for weather data (used in Daily Note Template, for example)
  weather: {
    // API key for https://openweathermap.org/
    openWeatherAPIKey: '... put your API key here ...',
    // Required location for weather forecast
    latPosition: 0.0,
    longPosition: 0.0,
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

export async function getWeatherSummary(weatherParams: string): Promise<string> {
  const weatherDescText = ['showers', 'rain', 'sunny intervals', 'partly sunny', 'sunny', 'clear sky', 'cloud', 'snow ', 'thunderstorm', 'tornado']
  const weatherDescIcons = ['🌦️', '🌧️', '🌤', '⛅', '☀️', '☀️', '☁️', '🌨️', '⛈', '🌪']

  // Get config settings from Template folder _configuration note
  const weatherConfig = await getOrMakeConfigurationSection('weather', DEFAULT_WEATHER_CONFIG, MINIMUM_WEATHER_CONFIG)

  if (weatherConfig == null) {
    return `Missing 'weather' configuration in "Templates/_configuration"`
  }

  const { openWeatherAPIKey, latPosition, longPosition, openWeatherUnits } = weatherConfig
  // $FlowIgnore[incompatible-use]
  if (openWeatherAPIKey !== null && !openWeatherAPIKey?.match(/[a-f0-9]{32}/)) {
    return `Invalid Weather API in "Templates/_configuration"`
  }

  const getWeatherURL = `https://api.openweathermap.org/data/2.5/onecall?lat=${encodeURIComponent(latPosition.toString())}&lon=${encodeURIComponent(
    longPosition.toString(),
  )}&exclude=current,hourly,minutely&units=${encodeURIComponent(openWeatherUnits)}&appid=${encodeURIComponent(openWeatherAPIKey)}`

  let jsonIn, allWeatherData
  try {
    jsonIn = await fetch(getWeatherURL)
  } catch (err) {
    return `Error ${err.message} parsing Weather data lookup. Please check your _configuration note.`
  }
  if (jsonIn != null) {
    try {
      // $FlowIgnore[incompatible-call]
      allWeatherData = JSON.parse(jsonIn)
    } catch (err) {
      return `Error ${err.message} parsing Weather data lookup. Please check your _configuration note.`
    }

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

    // $FlowFixMe
    return stringReplace(template, replacements)
  } else {
    // $FlowFixMe[incompatible-type]
    return `Problem in Weather data lookup for ${latPosition}/${longPosition}. Please check your _configuration note.`
  }
}

export async function getWeather(): Promise<string> {
  const weatherConfig = await getOrMakeConfigurationSection('weather', DEFAULT_WEATHER_CONFIG)
  let weather = null

  // name sure weather config exists, and it is a vaild API key (using simple length comparison)
  if (weatherConfig?.openWeatherAPIKey && weatherConfig.openWeatherAPIKey !== '... put your API key here ...' && weatherConfig.openWeatherAPIKey.length === 32) {
    weather = await getWeatherSummary('')
    if (weather.includes('Cannot find a valid API Key')) {
      weather = await fetch('https://wttr.in?format=3')
    }
  } else {
    weather = await fetch('https://wttr.in?format=3')
  }

  // $FlowFixMe
  return weather
}
