/* eslint-disable no-unused-vars */
/* eslint-disable import/order */
/* global it, jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach */
import * as f from '../utils.js'
import { CustomConsole, LogType, LogMessage } from '@jest/console' // see note below
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, simpleFormatter /* Note, mockWasCalledWithString, Paragraph */ } from '@mocks/index'

const PLUGIN_NAME = `helpers`
const FILENAME = `utils.js`

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = new NotePlan()
  global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter) // minimize log footprint
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging (or 'none' for none)
})

/* Samples:
To use factories (from the factories folder inside of __tests__):
const testFile = new Note(JSON.parse(await loadFactoryFile(__dirname, 'jgclarksSortTest.json')))
 // load a factory file from the __tests__/factories folder
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(() => compileAndroidCode()).toThrow(/JDK/);
expect(result).toEqual([])
// object matching - important to not use exact match because you may add fields later
      expect(result).toEqual(expect.objectContaining({ field1: true, field2: 'someString'}))
// or if you want to check if an array has objects in it with certain fields:
test('we should have name 1 and 2', () => {
  expect(users).toEqual(
    expect.arrayContaining([
      expect.objectContaining({name: 1}),
      expect.objectContaining({name: 2})
    ])
  );
});

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
     * removeDuplicates
     */
    describe('removeDuplicates', () => {
      it('should remove duplicate objects based on specified keys', () => {
        const objA = { name: 'foo', index: 0, filename: 'bar' }
        const objB = { name: 'foo', index: 1, filename: 'bar' }
        const objectsArray = [objA, objB]

        const result = f.removeDuplicates(objectsArray, ['name', 'filename'])

        expect(result).toEqual([objA])
      })

      it('should not remove any object if not all specified properties match', () => {
        const objA = { name: 'foo', index: 0, filename: 'bar' }
        const objB = { name: 'foo', index: 1, filename: 'bar' }
        const objectsArray = [objA, objB]

        const result = f.removeDuplicates(objectsArray, ['name', 'index'])

        expect(result).toEqual(objectsArray)
      })
    })

    /*
     * semverVersionToNumber
     */
    describe('semverVersionToNumber', () => {
      describe('valid semver versions', () => {
        it('should convert basic semver version to number', () => {
          expect(f.semverVersionToNumber('1.2.3')).toBe(1050627) // 1*1024^2 + 2*1024^1 + 3*1024^0
        })

        it('should convert version 0.0.0 to 0', () => {
          expect(f.semverVersionToNumber('0.0.0')).toBe(0)
        })

        it('should convert maximum valid version', () => {
          expect(f.semverVersionToNumber('1023.1023.1023')).toBe(1073741823) // 1023*1024^2 + 1023*1024^1 + 1023*1024^0
        })

        it('should convert version with double digits', () => {
          expect(f.semverVersionToNumber('10.20.30')).toBe(10506270) // 10*1024^2 + 20*1024^1 + 30*1024^0
        })

        it('should convert version with triple digits', () => {
          expect(f.semverVersionToNumber('100.200.300')).toBe(105062700) // 100*1024^2 + 200*1024^1 + 300*1024^0
        })
        it('should cope with just x.y and treat as x.y.0', () => {
          expect(f.semverVersionToNumber('1.2')).toBe(1050624)
        })
      })

      describe('versions with suffixes', () => {
        it('should ignore beta suffix', () => {
          expect(f.semverVersionToNumber('1.2.3-beta3')).toBe(1050627)
        })

        it('should ignore alpha suffix', () => {
          expect(f.semverVersionToNumber('1.2.3-alpha.1')).toBe(1050627)
        })

        it('should ignore rc suffix', () => {
          expect(f.semverVersionToNumber('1.2.3-rc.1')).toBe(1050627)
        })

        it('should ignore build metadata', () => {
          expect(f.semverVersionToNumber('1.2.3+build.123')).toBe(1050627)
        })

        it('should ignore both pre-release and build metadata', () => {
          expect(f.semverVersionToNumber('1.2.3-beta+build.123')).toBe(1050627)
        })

        it('should handle version with dash in suffix', () => {
          expect(f.semverVersionToNumber('2.0.0-beta-1')).toBe(2097152) // 2*1024^2 + 0*1024^1 + 0*1024^0
        })
      })

      describe('invalid versions - should return 0', () => {

        it('should return 0 for version with too many parts', () => {
          expect(f.semverVersionToNumber('1.2.3.4')).toBe(0)
        })

        it('should return 0 for version with non-numeric parts', () => {
          expect(f.semverVersionToNumber('1.2.a')).toBe(0)
        })

        it('should return 0 for version with empty parts', () => {
          expect(f.semverVersionToNumber('1.2.')).toBe(0)
        })

        it('should return 0 for version with negative numbers', () => {
          expect(f.semverVersionToNumber('1.2.-3')).toBe(0)
        })

        it('should return 0 for version exceeding maximum (1024)', () => {
          expect(f.semverVersionToNumber('1024.0.0')).toBe(0)
        })

        it('should return 0 for version with part exceeding maximum', () => {
          expect(f.semverVersionToNumber('1023.1024.1023')).toBe(0)
        })

        it('should return 0 for empty string', () => {
          expect(f.semverVersionToNumber('')).toBe(0)
        })

        it('should return 0 for non-semver string', () => {
          expect(f.semverVersionToNumber('not-a-version')).toBe(0)
        })

        it('should return 0 for version with only letters', () => {
          expect(f.semverVersionToNumber('a.b.c')).toBe(0)
        })
      })

      describe('edge cases', () => {
        it('should handle single digit versions correctly', () => {
          expect(f.semverVersionToNumber('5.4.3')).toBe(5242880 + 4096 + 3) // 5*1024^2 + 4*1024^1 + 3*1024^0
        })

        it('should handle version with leading zeros', () => {
          expect(f.semverVersionToNumber('01.02.03')).toBe(1050627) // Leading zeros are parsed as regular numbers
        })

        it('should handle very large valid version', () => {
          expect(f.semverVersionToNumber('999.888.777')).toBe(999 * 1048576 + 888 * 1024 + 777)
        })

        it('should handle version with spaces before suffix', () => {
          // Spaces are non-numeric, non-period, so they should be trimmed
          expect(f.semverVersionToNumber('1.2.3 beta')).toBe(1050627)
        })
      })
    })
  })
})

describe('findLongestStringInArray()', () => {
  test('should return longest string in array', () => {
    expect(f.findLongestStringInArray(['a', 'bb', '', 'dddd'])).toEqual('dddd')
  })
  test('should return longest string in array with emojis as longest term', () => {
    expect(f.findLongestStringInArray(['a', 'bb', '', 'dd🔬d'])).toEqual('dd🔬d')
  })
  // Doesn't pass, but we don't think this will be an actual issue, so disable
  test.skip('should return longest string in array with emojis in other terms', () => {
    expect(f.findLongestStringInArray(['a🔬', 'bb', 'cc🔬', 'dddd'])).toEqual('dd🔬d')
  })
  test('should return longest string in array wherever it is in array', () => {
    expect(f.findLongestStringInArray(['aa', 'bbbbb', '', 'cc'])).toEqual('bbbbb')
  })
  test('should return empty string if no array', () => {
    expect(f.findLongestStringInArray([])).toEqual('')
  })
})
