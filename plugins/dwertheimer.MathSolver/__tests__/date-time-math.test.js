// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, expect, test, beforeAll */
/* eslint-disable */

import * as d from '../src/support/date-time-math'
import { copyObject } from '@helpers/dev'

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
})

describe.skip('dwertheimer.MathSolver' /* pluginID */, () => {
  describe('date-time-math' /* file */, () => {
    describe('checkForTime' /* file */, () => {
        test('should find time in a line and return it', () => {
            const res = d.checkForTime("03:00-04:00 yo",{})
            expect(res.strToBeParsed).toEqual("")
        })
  })
})
}) /* describe */
