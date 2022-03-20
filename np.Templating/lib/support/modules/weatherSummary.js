// @flow

import pluginJson from '../../../plugin.json'
import { clo, log, logWarn, logError } from '../../../../helpers/dev'
import { stringReplace } from '../../../../helpers/general'

/**
 * Using WTTR.IN for lookups. It appears to have IP geolocation, as well as manual methods.
 * The detailed JSON structure that is returned from https://wttr.in/?format=j1 has this outline structure:
 * - current_condition [{single}]
     - FeelsLikeC: "-2",
     - FeelsLikeF: "28",
     - cloudcover: "75",
     - humidity: "100",
     - precipInches: "0.0",
     - precipMM: "0.0",
     - pressure: "1031",
     - pressureInches: "30",
     - temp_C: "1",
     - temp_F: "34",
     - uvIndex: "2",
     - visibility: "1",
     - visibilityMiles: "0",
     - weatherCode: "248",
     - weatherDesc:
       - [{value: "Fog"}]
     - winddir16Point: "SE",
     - winddirDegree: "140",
     - windspeedKmph: "6",
     - windspeedMiles: "4"
 * - nearest_area [{single}]
     - [{areaName}]
     - [{region}]
     - [{country}]
 * - request [{single}]
 * - weather [{many}] -- appears to cover today, tomorrow, next day
 *   - astronomy {}
 *   - date ("YYYY-MM-DD")
 *   - hourly [{many}]
 *   - maxtempC: "1"
 *   - maxtempF: "36"
 *   - mintempC: "-5"
 *   - mintempF: "12"
 *
 * ̃Any parts of the 'current_condition' can be specified to be returned, as well as 'areaName' and the max and min temperatures.
 * For fuller details see https://github.com/chubin/wttr.in#different-output-formats.
 */

const weatherDescTexts = ['showers', 'rain', 'sunny intervals', 'partly', 'sunny', 'clear sky', 'cloud', 'snow', 'thunderstorm', 'tornado']
const weatherDescIcons = ['🌦️', '🌧️', '🌤', '⛅', '☀️', '☀️', '☁️', '🌨️', '⛈', '🌪']

//------------------------------------------------------------------------------
/**
 * Get today's weather details returned according to the user's desired format
 * from the detailed WTTR.IN service https://wttr.in/?format=j1.
 * @author @jgclark, with customisation by @dwertheimer, adapted to np.Templating by @codedungeon
 *
 * @param {string} format - customisation for how to display the results
 * @return {string} output string
 */
export async function getWeatherSummary(format: string): Promise<string> {
  // Set a default weatherFormat if what we were supplied was empty
  const formatToUse = format === '' ? 'Weather: :icon: :description: :mintempC:-:maxtempC:°C :humidity:% :windspeedKmph:kmph from :winddir16Point: (:areaName:, :region:)' : format

  // A format was given, so do the detailed weather lookup
  const getWeatherURL = 'https://wttr.in/?format=j1'
  let jsonIn, allWeatherData
  try {
    jsonIn = await fetch(getWeatherURL)
    if (jsonIn != null) {
      try {
        // $FlowIgnore[incompatible-call]
        allWeatherData = JSON.parse(jsonIn)
      } catch (error) {
        logError(`'${error.message}' parsing Weather data lookup`)
        return `**Error '${error.message}' parsing Weather data lookup.**`
      }

      // Work out some specific values from harder-to-reach parts of the JSON
      const areaName = allWeatherData.nearest_area[0]?.areaName[0]?.value ?? '(no nearest_area returned)'
      const region = allWeatherData.nearest_area[0].region[0].value ?? '(no region returned)'
      const country = allWeatherData.nearest_area[0].country[0].value ?? '(no country returned)'
      const minTempF = allWeatherData.weather[0].mintempF
      const maxTempF = allWeatherData.weather[0].maxtempF
      const minTempC = allWeatherData.weather[0].mintempC
      const maxTempC = allWeatherData.weather[0].maxtempC
      const weatherDesc = allWeatherData.current_condition[0]?.weatherDesc[0]?.value ?? '(no weatherDesc found)'

      // see if we can fix an icon for this as well, according to returned description. Main terms are:
      // thunderstorm, drizzle, shower > rain, snow, sleet, clear sky, mist, fog, dust, tornado, overcast > clouds
      // with 'light' modifier for rain and snow
      let weatherIcon = ''
      for (let i = 0; i < weatherDescTexts.length; i++) {
        if (weatherDesc.toLowerCase().match(weatherDescTexts[i])) {
          weatherIcon = weatherDescIcons[i]
          break
        }
      }

      // substitute the values already calculated into the format
      const replacements = [
        { key: ':areaName:', value: areaName },
        { key: ':region:', value: region },
        { key: ':country:', value: country },
        { key: ':mintempC:', value: minTempC },
        { key: ':maxtempC:', value: maxTempC },
        { key: ':mintempF:', value: minTempF },
        { key: ':maxtempF:', value: maxTempF },
        { key: ':description:', value: weatherDesc },
        { key: ':icon:', value: weatherIcon },
      ]
      let output = stringReplace(format, replacements)

      // now iterate over the rest of the :fields:, looking up and substituting accordingly
      let matchesObj = output.matchAll(/:([\w]*?):/g)
      for (let matchedItem of matchesObj) {
        const key = matchedItem[1]
        const value = allWeatherData.current_condition[0][key] ?? '(missing)'
        output = output.replace(`:${key}:`, value)
      }
      return output
    } else {
      logError(pluginJson, 'Null JSON returned from Weather data lookup.')
      return `_Error: got no data back from Weather data lookup._`
    }
  } catch (error) {
    logError(pluginJson, `'${error.message}' in weather data lookup from ${getWeatherURL}`)
    return `**Error '${error.message}' occurred in weather data lookup from ${getWeatherURL}.**`
  }
}
