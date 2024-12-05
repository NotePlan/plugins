// @flow

/*
TODO: insertWeatherCallbackURL(incoming): add ability to create link from location in template - need to look up latlong using (getLatLongForLocation) stringify the results and save/pass it on future calls
TODO: add setting for whether to add now at the top
TODO: add setting for template replacements (use https://stackoverflow.com/questions/377961/efficient-javascript-string-replacement)
*/

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import * as utils from './support/weather-utils'
import { log, logDebug, logError, clo, JSP } from '@helpers/dev'
import { /* createRunPluginCallbackUrl, */ createPrettyRunPluginLink } from '@helpers/general'
import { chooseOption, getInput, showMessage } from '@helpers/userInput'

type WeatherParams = {
  appid: string,
  lat: ?string,
  lon: ?string,
  units: ?string,
}

type LocationOption = {
  lat: string,
  lon: string,
  label: string,
  name?: string,
  country?: string,
  state?: string,
  value?: string,
}

function UTCToLocalTimeString(d, format, timeOffset) {
  let timeOffsetInHours = timeOffset / 60 / 60
  if (timeOffsetInHours == null) {
    timeOffsetInHours = (new Date().getTimezoneOffset() / 60) * -1
  }
  d.setHours(d.getUTCHours() + timeOffsetInHours)
  return moment(d).format(format)
}

/**
 * Get the specific location (lat/long) for a city name
 * We can then use this lat/long to get weather now or store it in settings for getting weather later
 * Requires the openWeather api to be already stored in DataStore.settings
 * calls getLatLongListForName() to do the lookup
 * @param {*} searchLocationStr - the name of the city/location to look up
 * @returns {LocationOption | null} - the location details from the API lookup and maybe user
 */
async function getLatLongForLocation(searchLocationStr: string = ''): Promise<LocationOption | null> {
  if (searchLocationStr?.length > 0) {
    const params = DataStore.settings
    const results = await getLatLongListForName(searchLocationStr, params)
    if (results && results.length > 0) {
      logDebug(pluginJson, `getLatLongForLocation: Potential Location Results: ${String(results?.length)}`)
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
      logDebug(pluginJson, `Chosen location: ${JSON.stringify(location)}`)
      return location
    } else {
      await showMessage(`No results found for "${searchLocationStr}"`)
      logError(pluginJson, `getLatLongForLocation: No results found for ${searchLocationStr}`)
    }
  } else {
    logError(pluginJson, `getLatLongForLocation: No location string to search for ${searchLocationStr}`)
  }
  return null
}

/**
 * Call the OpenWeatherMap API to ask for lat/long details for a string location
 * Generally, OpenWeatherMap will return multiple choices
 * This function will return all the potential results from the API
 * (for example, there are several "Los Angeles" in the world)
 * @param {string} params - plugin settings, we only use params.appid in this function
 * @returns {Promise<Array<{}>} - array of potential locations
 */
export async function getLatLongListForName(name: string, params: WeatherParams): Promise<any> {
  if (validateWeatherParams(params)) {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(name)}&appid=${params.appid}&limit=5`
    logDebug(`weather-utils::getLatLongForName`, `url: ${url}`)
    try {
      const response: any = await fetch(url, { timeout: 3000 })
      if (response) {
        clo(response, `getLatLongListForName: response=`)
        return JSON.parse(response)
      }
    } catch (error) {
      logError(`weather-utils::getLatLongForName`, `error: ${JSP(error)}`)
    }
  } else {
    await showMessage(getConfigErrorText())
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
async function getWeatherForLocation(location: LocationOption, weatherParams: WeatherParams = null): Promise<{ [string]: any } | null> {
  const params = weatherParams ? weatherParams : DataStore.settings
  const url = utils.getWeatherURLLatLong(location.lat, location.lon, params.appid, params.units || 'metric')
  logDebug(`weather-utils::getWeatherForLocation`, `url: \n${url}`)
  try {
    const res: any = await fetch(url, { timeout: 3000 })
    if (res) {
      logDebug(pluginJson, `getWeatherForLocation received weather for location`)
      clo(res, `getWeatherForLocation result:`)
      return JSON.parse(res)
    }
  } catch (error) {
    logError(pluginJson, `getWeatherForLocation: error: ${JSP(error)}`)
  }
  return null
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
export async function insertWeatherCallbackURL(xcallbackWeatherLocation: string = ''): Promise<string> {
  try {
    if (!(await validateWeatherParams(DataStore.settings))) {
      Editor.insertTextAtCursor(getConfigErrorText())
      return ''
    } else {
      let locationString = xcallbackWeatherLocation
      if (!locationString?.length) locationString = await CommandBar.textPrompt('Weather Lookup', 'Enter a location name to lookup weather for:', '')
      if (locationString && locationString?.length) {
        logDebug(pluginJson, `insertWeatherCallbackURL: locationString: ${String(locationString)}`)
        const location = await getLatLongForLocation(locationString)
        logDebug(pluginJson, `insertWeatherCallbackURL: location: ${JSON.stringify(location)}`)
        if (location) {
          let text = ''
          if (locationString.length) {
            text = createPrettyRunPluginLink(`${locationString} weather`, pluginJson['plugin.id'], pluginJson['plugin.commands'][0].name, [JSON.stringify(location), 'yes'])
            logError(pluginJson, `insertWeatherCallbackURL: No location to look for: "${locationString}"`)
          }
          if (xcallbackWeatherLocation.length) {
            // this must have come from a runPlugin command
            // Editor.insertTextAtCursor(text)
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
 * (Plugin entry point for /Weather by Location Name)
 * Get weather for a particular location (passed through variable or via user input)
 * TODO: THIS NEEDS TO BE FINISHED SO IT WRITES WEATHER OUT FORMATTED
 * @param {*} incoming
 * @returns
 */
// eslint-disable-next-line no-unused-vars
export async function insertWeatherByLocation(incoming: ?string = '', returnLocation: boolean = true): Promise<void> {
  try {
    if (!(await validateWeatherParams(DataStore.settings))) {
      Editor.insertTextAtCursor(getConfigErrorText())
      return
    } else {
      let location = incoming
      do {
        if (location?.length === 0) {
          location = await getInput(`What city do you want to lookup? (do not include state)`, 'OK', 'Weather Lookup')
        }
        if (location) {
          const result: any = await getLatLongForLocation(location)
          if (result) {
            // {"lat":34.0536909,"lon":-118.242766,"name":"Los Angeles","country":"US","state":"California","label":"Los Angeles, California, US","value":0}
            logDebug(pluginJson, result.label)
            clo(result, `insertWeatherByLocation: result from openWeather for ${location}`)
            //TODO: Format output per user settings and output to cursor
            Editor.insertTextAtCursor('This function is not fully functional yet.\n')
            await weatherByLatLong(result, 'no') //sending as string because that's what weatherByLatLong expects
            return
          } else {
            location = ''
          }
        } else {
          logDebug(pluginJson, `insertWeatherByLocation: No location to look for: ${location}`)
        }
      } while (location !== false)
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
  return
}

/**
 * Look up weather for a particular location (passed through variable in xcallback or template)
 * @param {string} incoming - the JSON stringified location object to look for ({lat, lon, label})
 * @param {string} showPopup - 'yes' to show the weather text in a popup, 'no' to just return it
 * (Plugin entry point for /Weather by Lat/Long -- accessible directly or by xcallback)
 */
export async function weatherByLatLong(incoming: string = '', showPopup: string = 'no'): Promise<string> {
  logDebug(pluginJson, `weatherByLatLong: incoming: ${incoming} showPopup: ${showPopup}`)
  try {
    const settings = DataStore.settings
    if (!(await validateWeatherParams(settings))) {
      const msg = getConfigErrorText()
      await showMessage(msg)
    } else {
      let location
      if (incoming?.length) {
        location = JSON.parse(incoming)
      } else {
        location = { lat: settings.lat, lon: settings.lon, label: settings.locationName }
      }
      let text = ''
      let dfd = []
      let locTime = ''
      if (location.lat && location.lon && location.label) {
        logDebug(pluginJson, `weatherByLatLong: have lat/lon for ${location.label}`)
        const weather = await getWeatherForLocation(location, DataStore.settings)
        if (weather) {
          locTime = UTCToLocalTimeString(new Date(), 'LT', weather['timezone_offset'])
          logDebug(pluginJson, locTime)
          const currentWeather = utils.getCurrentConditions(weather.current)
          const weatherLine = utils.getWeatherDescLine(currentWeather, settings)
          const now = [{ label: weatherLine, value: String(-1) }]
          dfd = utils.extractDailyForecastData(weather)
          if (dfd && dfd.length) {
            dfd.forEach((w, i) => {
              // TODO: This is [WIP] - utils.getWeatherDescLine should format the weather the way the user wants
              dfd[i].label = utils.getWeatherDescLine(w, settings)
              dfd[i].value = String(i)
            })
          }
          dfd = [...now, ...dfd]
          logDebug(dfd, `Parsed weather data:`)
        }
        if (showPopup && showPopup === 'yes' && dfd.length) {
          const chosen = await chooseOption(`${location.label} as of ${locTime} (local time)`, dfd, '')
          Editor.insertTextAtCursor(chosen)
        } else {
          text = dfd.map((w) => w.label).join('\n')
          Editor.insertTextAtCursor(`*[WIP] Need to format this per user prefs:*\n${text}`)
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
// eslint-disable-next-line no-unused-vars
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
