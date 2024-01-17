/* global describe, test, expect, beforeAll */
// import colors from 'chalk'
import * as n from '../src/dashboardHelpers'
import { DataStore, Calendar } from '@mocks/index'

const PLUGIN_NAME = `jgclark.Dashboard`

beforeAll(() => {
  global.DataStore = DataStore // so we see DEBUG logs in VSCode Jest debugs
  global.Calendar = Calendar
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get 
})

// Jest suite
describe(`${PLUGIN_NAME}`, () => {
  /*
   * extendParaToAddStartTime()
   */
  describe('extendParaToAddStartTime()' /* function */, () => {
    const originalParas = [
      { content: "no date or time" },
      { content: "- time1 9:00 something" },
      { content: "- time2 9:00PM something" },
      { content: "* time3 11:00-11:30 bob" },
      { content: "- time4 something before 11:45" },
      { content: "" },
    ]
    const extendedParas = [
      { content: "no date or time", timeStr: "none" },
      { content: "- time1 9:00 something", timeStr: "09:00" },
      { content: "- time2 9:00PM something", timeStr: "21:00" },
      { content: "* time3 11:00-11:30 bob", timeStr: "11:00" },
      { content: "- time4 something before 11:45", timeStr: "11:45" },
      { content: "", timeStr: "none" },
    ]
    test('should add appropriate .timeStr for each para', () => {
      const result = n.extendParaToAddStartTime(originalParas)
      expect(result).toEqual(extendedParas)
    })
  })
})
