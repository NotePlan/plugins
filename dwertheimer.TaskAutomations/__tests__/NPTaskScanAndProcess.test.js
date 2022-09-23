/* global describe, test, expect, beforeAll */

import * as f from '../src/NPTaskScanAndProcess'
import { DataStore } from '@mocks/index'

const PLUGIN_NAME = `dwertheimer.TaskAutomations`
const FILENAME = `NPTaskScanAndProcess`

beforeAll(() => {
  global.DataStore = DataStore // so we see DEBUG logs in VSCode Jest debugs
})

/* Samples:
expect(result).toMatch(/someString/)
expect(result).not.toMatch(/someString/)
expect(result).toEqual([])
*/

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    //functions go here using jfunc command
    /*
     * processUserActionOnLine()
     */
    describe('processUserActionOnLine()' /* function */, () => {
      test('should remove date when userChoice="__remove__"', async () => {
        const origPara = { content: `foo >2020-01-01 bar !!` }
        const changedPara = { content: `foo bar !!` }
        const result = await f.processUserActionOnLine(origPara, {}, '__remove__')
        expect(result).toEqual({ action: 'set', changed: changedPara })
      })
      test('should remove >1 date when userChoice="__remove__"', async () => {
        const origPara = { content: `foo >2020-01-01 bar !! >2020-01-01` }
        const changedPara = { content: `foo bar !!` }
        const result = await f.processUserActionOnLine(origPara, {}, '__remove__')
        expect(result).toEqual({ action: 'set', changed: changedPara })
      })
      test('should remove >today when userChoice="__remove__"', async () => {
        const origPara = { content: `foo >today bar !! >2020-01-01` }
        const changedPara = { content: `foo bar !!` }
        const result = await f.processUserActionOnLine(origPara, {}, '__remove__')
        expect(result).toEqual({ action: 'set', changed: changedPara })
      })
    })
  })
})
