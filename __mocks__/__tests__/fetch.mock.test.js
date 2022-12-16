/* global jest, describe, test, expect, beforeAll */
import { CustomConsole } from '@jest/console' // see note below
import { FetchMock } from '../Fetch.mock'
import { simpleFormatter } from '@mocks/index'

const PLUGIN_NAME = `Fetch.mock`
const FILENAME = ``

beforeAll(() => {
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
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
    //functions go here using jfunc command
    /*
     * constructor()
     */
    describe('constructor()' /* function */, () => {
      test('should create fetch with default response', () => {
        const f = new FetchMock()
        expect(f.responses.length).toEqual(1)
        expect(f.responses[0].response).toMatch(/did not match/)
      })
      test('should create fetch with supplied response', () => {
        const f = new FetchMock([{ match: { url: 'foo', optionsBody: 'bar' }, response: 'baz' }])
        expect(f.responses.length).toEqual(2)
        expect(f.responses[0].response).toMatch(/baz/)
        expect(f.responses[1].response).toMatch(/did not match/)
      })
      test('should return default response with no match', async () => {
        const f = new FetchMock()
        const result = await f.fetch()
        expect(result).toMatch(/did not match/)
      })
      test('should return match if both url and body match', async () => {
        const f = new FetchMock([{ match: { url: 'foo', optionsBody: 'bar' }, response: 'baz' }])
        const result = await f.fetch('http://foo', { body: 'does it include bar' })
        expect(result).toMatch(/baz/)
      })
      test('should return match if both url and body match (case insensitive)', async () => {
        const f = new FetchMock([{ match: { url: 'FOO', optionsBody: 'Bar' }, response: 'baz' }])
        const result = await f.fetch('http://foo', { body: 'does it include bar' })
        expect(result).toMatch(/baz/)
      })
      test('should return default if url matches but not body', async () => {
        const f = new FetchMock([{ match: { url: 'foo', optionsBody: 'bar' }, response: 'baz' }])
        const result = await f.fetch('http://foo', { body: 'does it include xxx' })
        expect(result).toMatch(/did not match/)
      })
      test('should return default if body matches but not url', async () => {
        const f = new FetchMock([{ match: { url: 'fun', optionsBody: 'bar' }, response: 'baz' }])
        const result = await f.fetch('http://foo', { body: 'does it include bar' })
        expect(result).toMatch(/did not match/)
      })
      test('should return match if url matches and body is blank', async () => {
        const f = new FetchMock([{ match: { url: 'foo', optionsBody: '' }, response: 'baz' }])
        const result = await f.fetch('http://foo', { body: 'does it include bar' })
        expect(result).toMatch(/baz/)
      })
      test('should return match if url matches and body is not passed', async () => {
        const f = new FetchMock([{ match: { url: 'foo' }, response: 'baz' }])
        const result = await f.fetch('http://foo', { body: 'does it include bar' })
        expect(result).toMatch(/baz/)
      })
    })
  })
})
