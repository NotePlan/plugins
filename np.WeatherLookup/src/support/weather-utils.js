import { log, logError, clo, JSP, timer } from '@helpers/dev'

export const isWeatherKeyValid = (key) => key !== null && /[a-f0-9]{32}/.test(key)

export const getWeatherURLLatLong = (lat, lon, appid, units) => `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&appid=${appid}&units=${units}`
// NOTE: There is a version 3.0, but it sends back a 401 error

export const getCurrentConditions = (currentWeather: { [string]: any }): Array<{}> => {
  let { sunrise, sunset, temp, feels_like, pressure, humidity, dew_point, uvi, clouds, visibility, wind_speed, wind_deg, weather } = currentWeather
  temp = Math.round(temp)
  return {
    sunrise,
    sunset,
    temp,
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

export const extractDailyForecastData = (weather: { [string]: any }): Array<{}> => {
  let dailyForecast = []
  if (weather && weather.daily?.length > 0) {
    dailyForecast = weather.daily.map((dy) => {
      let { sunrise, sunset, temp, uvi, humidity, feels_like } = dy
      let weather = dy.weather[0]
      let { description, main } = weather
      let icon = getWeatherIcon(description)
      let { min, max } = temp
      let { day, night } = feels_like //day/night = feels like
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
    logError(pluginJson, `extractDailyForecastData: No weather data to extract for ${JSP(weather)}`)
  }
  return dailyForecast
}

export const getWeatherIcon = (description) => {
  const weatherDescText = ['showers', 'rain', 'sunny intervals', 'partly sunny', 'sunny', 'clear sky', 'cloud', 'snow ', 'thunderstorm', 'tornado']
  const weatherDescIcons = ['🌦️', '🌧️', '🌤', '⛅', '☀️', '☀️', '☁️', '🌨️', '⛈', '🌪']
  let weatherIcon = ''
  for (let i = 0; i < weatherDescText.length; i++) {
    if (description.match(weatherDescText[i])) {
      weatherIcon = weatherDescIcons[i]
      break
    }
  }
  if (weatherIcon === '') {
    logError(pluginJson, `****** getWeatherIcon: No weather icon found for ${description}`)
  }
  return weatherIcon
}

export const getWeatherDescLine = (weather: { [string]: any }, unitsParam: string) => {
  const units = unitsParam === 'metric' ? 'C' : 'F'
  const { sunrise, sunset, temp, uvi, humidity, feels_like, description, main, icon, min, max, day, night, date } = weather
  return `${date}: ${icon} ${description} ${min}°${units} - ${max}°${units} uvi: ${uvi}`
}
