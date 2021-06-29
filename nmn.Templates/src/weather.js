// @flow

// import { parseJSON5 } from '../../nmn.Templates/src/configuration'
import { showMessage } from '../../nmn.sweep/src/userInput'

// Get summary of today's weather in a line
// Using https://openweathermap.org/api/one-call-api#data, for which you can get a free API key
export async function getWeatherSummary(
  weatherParams: string,
  config: { [string]: ?mixed },
): Promise<string> {
  const weatherDescText = [
    'showers',
    'rain',
    'sunny intervals',
    'partly sunny',
    'sunny',
    'cloud',
    'snow ',
    'thunderstorm',
    'tornado',
  ]
  const weatherDescIcons = ['🌦️', '🌧️', '🌤', '⛅', '☀️', '☁️', '🌨️', '⛈', '🌪']

  // Get config settings from Template folder _configuration note
  // Setting this to `any` for now.
  const weatherConfig: any = config.weather ?? null
  if (weatherConfig == null) {
    await showMessage(
      "Cannot find 'weather' settings in Templates/_configuration note",
    )
    return ''
  }
  const pref_openWeatherAPIKey = weatherConfig.openWeatherAPIKey
  const pref_latPosition = weatherConfig.latPosition
  const pref_longPosition = weatherConfig.longPosition
  const pref_openWeatherUnits = weatherConfig.openWeatherUnits

  console.log(`getWeatherSummary: Params: '${weatherParams}'`)
  // const paramConfig = weatherParams.trim()
  //   ? await parseJSON5(weatherParams)
  //   : {}
  // console.log(paramConfig)

  const getWeatherURL = `https://api.openweathermap.org/data/2.5/onecall?lat=${pref_latPosition}&lon=${pref_longPosition}&exclude=current,hourly,minutely&units=${pref_openWeatherUnits}&appid=${pref_openWeatherAPIKey}`

  const response = await fetch(getWeatherURL)
  const jsonIn = await response.json()
  if (jsonIn != null) {
    const weatherTodayAll = jsonIn.daily['0']
    const maxTemp = weatherTodayAll.feels_like.day.toFixed(0)
    const minTemp = weatherTodayAll.feels_like.night.toFixed(0)
    const weatherDesc = weatherTodayAll.weather['0'].description

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

    const summaryLine = `${maxTemp}/${minTemp} ${weatherIcon}${weatherDesc}`
    console.log(`\t${summaryLine}`)
    return summaryLine
  } else {
    await showMessage('Sorry; error in Weather lookup')
    return 'sorry; error in Weather lookup'
  }
}
