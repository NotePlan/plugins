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
     * prepareUserAction()
     */
    describe('prepareUserAction()' /* function */, () => {
      test('should remove date when userChoice="__remove__"', async () => {
        const origPara = { content: `foo >2020-01-01 bar !!` }
        const changedPara = { content: `foo bar !!` }
        const result = await f.prepareUserAction(origPara, {}, '__remove__')
        expect(result).toEqual({ action: 'set', changed: changedPara })
      })
      test('should remove >1 date when userChoice="__remove__"', async () => {
        const origPara = { content: `foo >2020-01-01 bar !! >2020-01-01` }
        const changedPara = { content: `foo bar !!` }
        const result = await f.prepareUserAction(origPara, {}, '__remove__')
        expect(result).toEqual({ action: 'set', changed: changedPara })
      })
      test('should remove >today when userChoice="__remove__"', async () => {
        const origPara = { content: `foo >today bar !! >2020-01-01` }
        const changedPara = { content: `foo bar !!` }
        const result = await f.prepareUserAction(origPara, {}, '__remove__')
        expect(result).toEqual({ action: 'set', changed: changedPara })
      })
      test('should set a p1 to !', async () => {
        const origPara = { content: `foo` }
        const changedPara = { content: `! foo` }
        const result = await f.prepareUserAction(origPara, {}, '__p1__')
        expect(result).toEqual({ action: '__p1__', changed: changedPara })
      })
    })
    /*
     * updatePriority()
     */
    describe('updatePriority()' /* function */, () => {
      test('should remove the priority', () => {
        const before = { content: `foo ! bar` }
        const result = f.updatePriority(before, 'p0')
        expect(result.content).toEqual(`foo bar`)
      })
      test('should update p1 of task with no priority', () => {
        const before = { content: `foo bar` }
        const result = f.updatePriority(before, 'p1')
        expect(result.content).toEqual(`! foo bar`)
      })
      test('should update p2 of task with no priority', () => {
        const before = { content: `foo bar` }
        const result = f.updatePriority(before, 'p2')
        expect(result.content).toEqual(`!! foo bar`)
      })
      test('should update p3 of task with no priority', () => {
        const before = { content: `foo bar` }
        const result = f.updatePriority(before, 'p3')
        expect(result.content).toEqual(`!!! foo bar`)
      })
      test('should update p3 of task with prev prio at beginning', () => {
        const before = { content: `!! foo bar` }
        const result = f.updatePriority(before, 'p3')
        expect(result.content).toEqual(`!!! foo bar`)
      })
      test('should update priority of task with prev prio in middle', () => {
        const before = { content: `foo !! bar` }
        const result = f.updatePriority(before, 'p3')
        expect(result.content).toEqual(`!!! foo bar`)
      })
      test('should update priority of task with prev prio at end', () => {
        const before = { content: `foo bar !` }
        const result = f.updatePriority(before, 'p3')
        expect(result.content).toEqual(`!!! foo bar`)
      })
    })
  })
})
