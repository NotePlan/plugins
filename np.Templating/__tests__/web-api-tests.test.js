/* eslint-disable */
import { CustomConsole } from '@jest/console'
import { simpleFormatter, DataStore, NotePlan, Editor } from '@mocks/index'
import path from 'path'
import colors from 'colors'
import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import nodeFetch from 'node-fetch'
import WebModule from '../lib/support/modules/WebModule'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue
const subsection = colors.cyan
const success = colors.green
const error = colors.red
const warning = colors.yellow
const info = colors.white

// Array of web API calls to test
const webCalls = [{ name: 'journalingQuestion' }, { name: 'advice' }, { name: 'affirmation' }, { name: 'quote' }, { name: 'verse' }, { name: 'weather' }]

/**
 * Checks for internet connectivity by pinging a reliable API.
 * @returns {Promise<boolean>}
 */
async function checkInternet() {
  try {
    const res = await nodeFetch('https://www.google.com', { timeout: 3000 })
    const isConnected = res.ok
    !isConnected && console.log(`Internet check result: ${isConnected ? 'Connected' : 'Not connected'}`)
    return isConnected
  } catch (e) {
    console.error('Internet check failed:', e.message)
    return false
  }
}

describe(`${PLUGIN_NAME} - ${section('Web API Tests')}`, () => {
  let web
  let hasInternet = false

  beforeAll(async () => {
    global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
    global.NotePlan = new NotePlan()
    global.DataStore = DataStore
    DataStore.settings['_logLevel'] = 'none'
    global.Editor = Editor

    // Set up global fetch to use node-fetch
    global.fetch = async (url) => {
      try {
        const response = await nodeFetch(url)
        const text = await response.text()
        return text
      } catch (err) {
        console.error(`Error fetching ${url}:`, err)
        throw err
      }
    }
    hasInternet = await checkInternet()
    !hasInternet && console.log(`Internet connection status: ${hasInternet ? 'Connected' : 'Not connected'}`)
  })

  beforeEach(() => {
    web = new WebModule()
  })

  describe(section('Check Templating API Endpoints'), () => {
    webCalls.forEach(({ name }) => {
      it(`should return valid content from ${name} API`, async () => {
        if (!hasInternet) {
          console.log(`Skipping test of ${name} API due to no internet connection`)
          return
        }
        try {
          const result = await web[name]() // use the actual web module to call the function

          expect(result).toBeTruthy()
          expect(typeof result).toBe('string')
          expect(result.length).toBeGreaterThan(0)
          expect(result).not.toContain('error')
          expect(result).not.toContain('Error')
          expect(result).not.toContain('ERROR')
        } catch (err) {
          console.error(`Error in ${name} API test:`, err)
          // Only fail if it's not a network error
          if (!err.message.includes('network') && !err.message.includes('ECONNREFUSED')) {
            throw err
          }
          console.warn(`Network error for ${name}:`, err.message)
        }
      })
    })
  })
})
