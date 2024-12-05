// @flow
import { log, logError, clo, JSP, timer } from '@helpers/dev'

export const isWeatherKeyValid = (key: string): boolean => key !== null && /[a-f0-9]{32}/.test(key)

export const getWeatherURLLatLong = (lat: string, lon: string, appid: string, units: string): string =>
  `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&appid=${appid}&units=${units}`
// NOTE: There is a version 3.0, but it sends back a 401 error

export const getCurrentConditions = (currentWeather: { [string]: any }): any => {
  // eslint-disable-next-line no-unused-vars
  const { sunrise, sunset, temp, feels_like, pressure, humidity, dew_point, uvi, clouds, visibility, wind_speed, wind_deg, weather } = currentWeather
  const tempRounded = Math.round(temp)
  return {
    sunrise,
    sunset,
    temp: tempRounded,
    uvi,
    humidity,
    feels_like,
    description: weather[0].description,
    main: weather[0].main,
    icon: getWeatherIcon(weather[0].description),
    min: temp,
    max: temp,
    day: feels_like,
    night: feels_like,
    date: 'now',
  }
}

export const extractDailyForecastData = (weather: { [string]: any }): Array<any> => {
  let dailyForecast = []
  if (weather && weather.daily?.length > 0) {
    dailyForecast = weather.daily.map((dy) => {
      const { sunrise, sunset, temp, uvi, humidity, feels_like } = dy
      const weather = dy.weather[0]
      const { description, main } = weather
      const icon = getWeatherIcon(description)
      const { min, max } = temp
      const { day, night } = feels_like //day/night = feels like
      const date = new Date(dy.dt * 1000).toDateString().split(' ')[0]
      const itemsToRound = ['min', 'max', 'day', 'night', 'uvi']
      const returnVal = {
        sunrise,
        sunset,
        temp,
        uvi,
        humidity,
        feels_like,
        description,
        main,
        icon,
        min,
        max,
        day,
        night,
        date,
      }
      itemsToRound.forEach((item) => {
        returnVal[item] = Math.floor(returnVal[item])
      })
      return returnVal
    })
  } else {
    logError(`weather-utils::extractDailyForecastData`, `extractDailyForecastData: No weather data to extract for ${JSP(weather)}`)
  }
  return dailyForecast
}

export const getWeatherIcon = (description: string): string => {
  const weatherDescText = ['showers', 'rain', 'sunny intervals', 'partly sunny', 'sunny', 'clear sky', 'cloud', 'snow ', 'thunderstorm', 'tornado', 'smoke']
  const weatherDescIcons = ['🌦️', '🌧️', '🌤', '⛅', '☀️', '☀️', '☁️', '🌨️', '⛈', '🌪', `💨`]
  let weatherIcon = ''
  for (let i = 0; i < weatherDescText.length; i++) {
    if (description.match(weatherDescText[i])) {
      weatherIcon = weatherDescIcons[i]
      break
    }
  }
  if (weatherIcon === '') {
    logError(`weather-utils::getWeatherIcon`, `****** getWeatherIcon: No weather icon found for ${description}`)
  }
  return weatherIcon
}

export const getWeatherDescLine = (weather: { [string]: any }, settings: any): string => {
  const units = settings.units === 'metric' ? 'C' : 'F'
  // eslint-disable-next-line no-unused-vars
  const { sunrise, sunset, temp, uvi, humidity, feels_like, description, main, icon, min, max, day, night, date } = weather
  // TODO: should get the actual formatting desired by user from settings instead of hard-coding it like this:
  return `${date}: ${icon} ${description} ${min}°${units} - ${max}°${units} uvi: ${uvi}`
}
