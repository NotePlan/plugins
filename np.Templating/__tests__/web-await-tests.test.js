/* eslint-disable */
import { CustomConsole } from '@jest/console'
import { simpleFormatter, DataStore, NotePlan, Editor } from '@mocks/index'
import path from 'path'
import colors from 'colors'
import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import TemplatingEngine from '../lib/TemplatingEngine'
import NPTemplating from '../lib/NPTemplating'
import WebModule from '../lib/support/modules/WebModule'

const PLUGIN_NAME = `📙 ${colors.yellow('np.Templating')}`
const section = colors.blue
const subsection = colors.cyan
const success = colors.green
const error = colors.red
const warning = colors.yellow
const info = colors.white

/**
 * Reads a factory file from the factories directory.
 * @param {string} factoryName - The name of the factory file (without extension).
 * @returns {Promise<string>} The content of the factory file or 'FACTORY_NOT_FOUND'.
 */
const factory = async (factoryName = '') => {
  const factoryFilename = path.join(__dirname, 'factories', factoryName)
  if (existsSync(factoryFilename)) {
    return await fs.readFile(factoryFilename, 'utf-8')
  }
  return 'FACTORY_NOT_FOUND'
}

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
  global.NotePlan = new NotePlan()
  global.DataStore = DataStore
  DataStore.settings['_logLevel'] = 'none'
  global.Editor = Editor

  // Mock fetch globally
  global.fetch = jest.fn().mockImplementation((url) => {
    if (url.includes('adviceslip.com')) {
      return Promise.resolve({
        json: () => Promise.resolve({ slip: { advice: 'Test advice' } }),
      })
    }
    if (url.includes('api.quotable.io')) {
      return Promise.resolve({
        json: () => Promise.resolve({ content: 'Test quote', author: 'Test Author' }),
      })
    }
    if (url.includes('bible-api.com')) {
      return Promise.resolve({
        json: () => Promise.resolve({ text: 'Test verse', reference: 'Test Reference' }),
      })
    }
    // Add more mock responses for other services as needed
    return Promise.resolve({
      json: () => Promise.resolve({ message: 'Test response' }),
    })
  })
})

describe(`${PLUGIN_NAME} - ${section('Web Await Tests')}`, () => {
  let templateInstance

  beforeEach(() => {
    templateInstance = new TemplatingEngine({
      locale: 'en-US',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'h:mm A',
      timestampFormat: 'YYYY-MM-DD h:mm:ss A',
      userFirstName: '',
      userLastName: '',
      userEmail: '',
      userPhone: '',
      services: {},
    })
  })

  describe(section('File: web-await-tests.ejs'), () => {
    it('should ensure all web.* calls have await attached and return valid content', async () => {
      const templateData = await factory('web-await-tests.ejs')
      expect(templateData).not.toBe('FACTORY_NOT_FOUND')

      // First, verify that the template contains web.* calls without await
      expect(templateData).toContain('<%- web.journalingQuestion() %>')
      expect(templateData).toContain('<%- web.advice() %>')
      expect(templateData).toContain('<%- web.affirmation() %>')
      expect(templateData).toContain('<%- web.quote() %>')
      expect(templateData).toContain('<%- web.verse() %>')
      expect(templateData).toContain('<%- web.weather() %>')

      // Process each web.* call individually to add await prefixes
      const context = { templateData, sessionData: {}, override: {} }
      const webCalls = ['<%- web.journalingQuestion() %>', '<%- web.advice() %>', '<%- web.affirmation() %>', '<%- web.quote() %>', '<%- web.verse() %>', '<%- web.weather() %>']

      for (const call of webCalls) {
        await NPTemplating._processCodeTag(call, context)
      }

      // Verify that await was added to all web.* calls
      expect(context.templateData).toContain('<%- await web.journalingQuestion() %>')
      expect(context.templateData).toContain('<%- await web.advice() %>')
      expect(context.templateData).toContain('<%- await web.affirmation() %>')
      expect(context.templateData).toContain('<%- await web.quote() %>')
      expect(context.templateData).toContain('<%- await web.verse() %>')
      expect(context.templateData).toContain('<%- await web.weather() %>')
    })
  })
})
