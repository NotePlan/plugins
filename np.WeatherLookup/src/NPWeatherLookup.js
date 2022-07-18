// @flow

/*
TODO: insertWeatherCallbackURL(incoming): add ability to create link from location in template - need to look up latlong using (getLatLongForLocation) stringify the results and save/pass it on future calls
TODO: add setting for whether to add now at the top
TODO: add setting for template replacements (use https://stackoverflow.com/questions/377961/efficient-javascript-string-replacement)
*/

import * as utils from './support/weather-utils'
import { log, logError, clo, JSP } from '@helpers/dev'
import { createRunPluginCallbackUrl, createPrettyRunPluginLink } from '@helpers/general'
import { chooseOption, getInput, showMessage } from '@helpers/userInput'
import pluginJson from '../plugin.json'
import moment from 'moment'

type WeatherParams = {
  appid: string,
  lat: ?string,
  lon: ?string,
  units: ?string,
}

type LocationOption = {
  lat: string,
  lon: string,
  name: string,
  country: string,
  state: string,
  label: string,
  value: string,
}

function UTCToLocalTimeString(d, format, timeOffset) {
  let timeOffsetInHours = timeOffset / 60 / 60
  if (timeOffsetInHours == null) {
    timeOffsetInHours = (new Date().getTimezoneOffset() / 60) * -1
  }
  d.setHours(d.getUTCHours() + timeOffsetInHours)
  return moment(d).format(format)
}

async function getLatLongForLocation(searchLocationStr: string = ''): Promise<LocationOption | null> {
  if (searchLocationStr?.length > 0) {
    const params = DataStore.settings
    const results = await getLatLongListForName(searchLocationStr, params)
    if (results && results.length > 0) {
      log(pluginJson, `getLatLongForLocation: Potential Location Results: ${results?.length}`)
      const options = results.map((r, i) => ({
        lat: r.lat,
        lon: r.lon,
        name: r.name,
        country: r.country,
        state: r.state,
        label: `${r.name}, ${r.state}, ${r.country}`,
        value: i,
      }))
      let chosenIndex = 0
      if (options.length > 1) {
        // ask user which one they wanted
        chosenIndex = await chooseOption(`Which of these?`, options, 0)
      }
      const location = options[chosenIndex]
      log(pluginJson, `Chosen location: ${JSON.stringify(location)}`)
      return location
    } else {
      await showMessage(`No results found for "${searchLocationStr}"`)
      logError(pluginJson, `getLatLongForLocation: No results found for ${searchLocationStr}`)
      return null
    }
  } else {
    logError(pluginJson, `getLatLongForLocation: No location string to search for ${searchLocationStr}`)
  }
}

/**
 * Call the OpenWeatherMap API to get the weather for a particular location
 * @param {string} name
 * @param {string} params
 * @returns {Promise<Array<{}>} - array of potential locations
 */
export async function getLatLongListForName(name: string, params: WeatherParams): Promise<Array<{ [string]: any }>> {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(name)}&appid=${params.appid}&limit=5`
  log(`weather-utils::getLatLongForName`, `url: ${url}`)
  try {
    const response = await fetch(url, { timeout: 3000 })
    if (response) {
      return JSON.parse(response)
    }
  } catch (error) {
    logError(`weather-utils::getLatLongForName`, `error: ${JSP(error)}`)
  }
  return []
}

/**
 * Check for valid weather params (appid specifically)
 * @param {object} params
 * @returns {boolean}
 */
async function validateWeatherParams(params: WeatherParams): Promise<boolean> {
  if (!params?.appid || !utils.isWeatherKeyValid(params.appid)) {
    logError(pluginJson, `Missing appid`)
    await showMessage(`Invalid Weather API Key! Please enter a valid Weather API Key in settings`, `OK`, `Invalid Weather API Key`)
    return false
  }
  return true
}

function getConfigErrorText(): string {
  logError(pluginJson, 'You must set a weather lookup key in the settings')
  return `This plugin requires a (free) API key for OpenWeatherMap (the weather lookup service). Get an API key here: https://home.openweathermap.org/users/sign_up and then open up this plugin's settings in the control panel and paste the API key.`
}

/**
 * Get the weather for a lat/long
 * @param {LocationOption} location
 * @param {settings} params
 * @returns
 */
async function getWeatherForLocation(location: LocationOption, weatherParams: WeatherParams): Promise<{ [string]: any }> {
  const params = weatherParams ? weatherParams : DataStore.settings
  const url = utils.getWeatherURLLatLong(location.lat, location.lon, params.appid, params.units)
  log(`weather-utils::getWeatherForLocation`, `url: \n${url}`)
  try {
    const res = await fetch(url, { timeout: 3000 })
    if (res) {
      let weather = JSON.parse(res)
      return weather
    }
  } catch (error) {
    logError(pluginJson, `getWeatherForLocation: error: ${JSP(error)}`)
  }
  return []
}

/*
 *
 * PLUGIN ENTRY POINTS BELOW THIS LINE
 *
 */

/**
 * Get URL for retrieving weather in a particular location
 * (Plugin entry point for /Get weather XCallbackURL)
 */
export async function insertWeatherCallbackURL(incoming: string = ''): Promise<string> {
  try {
    if (!(await validateWeatherParams(DataStore.settings))) {
      Editor.insertTextAtCursor(getConfigErrorText())
      return ''
    } else {
      let locationString = incoming
      if (!locationString?.length) locationString = await CommandBar.textPrompt('Weather Lookup', 'Enter a location name to lookup weather for:', '')
      if (locationString && locationString?.length) {
        log(pluginJson, `insertWeatherCallbackURL: locationString: ${String(locationString)}`)
        const location = await getLatLongForLocation(locationString)
        log(pluginJson, `insertWeatherCallbackURL: location: ${JSON.stringify(location)}`)
        if (location) {
          let text = ''
          if (locationString.length) {
            text = createPrettyRunPluginLink(`${locationString} weather`, pluginJson['plugin.id'], pluginJson['plugin.commands'][0].name, [JSON.stringify(location), 'yes'])
            logError(pluginJson, `insertWeatherCallbackURL: No location to look for: "${locationString}"`)
          }
          if (incoming.length) {
            // this must have come from a runPlugin command
            Editor.insertTextAtCursor(text)
            return text
          } else {
            Editor.insertTextAtCursor(text)
          }
        }
      }
    }
  } catch (error) {
    logError(pluginJson, `insertWeatherCallbackURL: error: ${JSP(error)}`)
  }
  return ''
}

/**
 * Get weather for a particular location (passed through variable or via user input)
 * TODO: THIS NEEDS TO BE FINISHED SO IT WRITES WEATHER OUT FORMATTED
 * TODO: Format now weather differently
 * (Plugin entry point for /Weather by Location Name)
 * @param {*} incoming
 * @returns
 */
export async function insertWeatherByLocation(incoming: ?string = '', returnLocation: boolean = true): Promise<void> {
  // every command/plugin entry point should always be wrapped in a try/catch block
  try {
    if (!(await validateWeatherParams(DataStore.settings))) {
      Editor.insertTextAtCursor(getConfigErrorText())
      return
    } else {
      let location = incoming
      if (location?.length === 0) {
        location = await getInput(`What location do you want to lookup?`)
      }
      if (location) {
        const result = await getLatLongForLocation(location)
        Editor.insertTextAtCursor('This function is not functional yet. Please use the URL version instead.')
        return result
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
  return null
}

/**
 * Look up weather for a particular location (passed through variable in xcallback or template)
 * @param {string} incoming - the JSON stringified location object to look for ({lat, lon, label})
 * @param {string} showPopup - 'yes' to show the weather text in a popup, 'no' to just return it
 * (Plugin entry point for /Weather by Lat/Long -- hidden -- accessible by xcallback)
 */
export async function weatherByLatLong(incoming: string = '', showPopup: string = 'no'): Promise<string> {
  log(pluginJson, `weatherByLatLong: incoming: ${incoming} showPopup: ${showPopup}`)
  try {
    if (!(await validateWeatherParams(DataStore.settings))) {
      getConfigErrorText()
      return ''
    } else {
      if (incoming?.length) {
        const location = JSON.parse(incoming)
        let text = ''
        let dfd = []
        let locTime = ''
        if (location.lat && location.lon) {
          log(pluginJson, `weatherByLatLong: have lat/lon for ${location.label}`)
          const weather = await getWeatherForLocation(location, DataStore.settings)
          locTime = UTCToLocalTimeString(new Date(), 'LT', weather['timezone_offset'])
          log(pluginJson, locTime)
          const currentWeather = utils.getCurrentConditions(weather.current)
          const weatherLine = utils.getWeatherDescLine(currentWeather)
          const now = [{ label: weatherLine, value: -1 }]
          dfd = utils.extractDailyForecastData(weather)
          if (dfd && dfd.length) {
            dfd.forEach((w, i) => {
              dfd[i].label = utils.getWeatherDescLine(w)
              dfd[i].value = i
            })
          }
          dfd = [...now, ...dfd]
        }
        if (showPopup && showPopup == 'yes') {
          await chooseOption(`${location.label} as of ${locTime} (local time)`, dfd, 0)
          // Editor.insertTextAtCursor(text)
        } else {
          text = dfd.map((w) => w.label).join('\n')
          return text
        }
      } else {
        logError(pluginJson, `weatherByLatLong: No location to look for; param was: "${incoming}"`)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
  return ''
}

/**
 * Get lat/lon details for your default location
 * @param {string} incoming
 */
export async function setDefaultLocation(incoming: string = ''): Promise<void> {
  try {
    if (!(await validateWeatherParams(DataStore.settings))) {
      getConfigErrorText()
    } else {
      const location = await insertWeatherByLocation('', true)
      if (location) {
        clo(location, `setDefaultLocation: location: ${location}`)
        DataStore.settings = {
          ...DataStore.settings,
          lat: String(location.lat),
          lon: String(location.lon),
          locationName: location.label,
        }
        await showMessage(`Default location set to:\n${location.label}`)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
