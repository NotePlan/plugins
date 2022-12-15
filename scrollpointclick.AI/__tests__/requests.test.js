/* global jest, describe, test, expect, beforeAll */
// @flow

import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below

import * as f from '../src/NPAI'
import blackholes from './data/completions.blackholes.json'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'
import { throwError } from 'rxjs'

const baseURL = 'https://api.openai.com/v1'

const PLUGIN_NAME = `scrollpointclick.AI`
const FILENAME = `requests`

// export async function makeRequest(component: string, requestType: string = 'GET', data: any = null): any | null {

function fetchMock(url: string, options: FetchOptions) {
  const body = options.body ? JSON.parse(options.body) : null // { prompt, max_tokens, model }
  if (url === `${baseURL}/completions` && options.method === 'POST') {
    if (body && /^black holes.*/.test(body.prompt)) {
      return Promise.resolve(JSON.stringify(blackholes)) //don't forget the default!
    }
  }
  return Promise.resolve(`{"msg":"fetchMock: do not have a mock handler for call to ${url} with method ${options.method} and body...}"}`)
}

beforeAll(() => {
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging (or 'none' for none)
  DataStore.settings['apiKey'] = 'ABCDE'
  global.fetch = fetchMock
})

/* Samples:
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(result).toEqual([])
import { mockWasCalledWith } from '@mocks/mockHelpers'
      const spy = jest.spyOn(console, 'log')
      const result = mainFile.getConfig()
      expect(mockWasCalledWith(spy, /config was empty/)).toBe(true)
      spy.mockRestore()

      test('should return the command object', () => {
        const result = f.getPluginCommands({ 'plugin.commands': [{ a: 'foo' }] })
        expect(result).toEqual([{ a: 'foo' }])
      })
*/

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    /*
     * makeRequest()
     */
    describe('makeRequest()' /* function */, () => {
      test('should get a fake response from the server to completions w/ black holes prompt', async () => {
        const result = await f.makeRequest('completions', 'POST', { prompt: 'black holes' })
        expect(result).toEqual(blackholes) //this doesn't test anything too interesting, but at least we know the basic plumbing works
      })
      test('should fail if we forget to create a mock for a particular call', async () => {
        const result = await f.makeRequest('xxx', 'POST', { prompt: 'black holes' })
        expect(result.msg).toMatch(/do not have a mock handler/)
      })
    })
  })
})
