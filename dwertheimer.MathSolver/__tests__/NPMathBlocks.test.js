// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, expect, test, beforeAll */
/* eslint-disable */

import * as mainFile from '../src/NPMathBlocks'
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
  describe('placeholder' /* file */, () => {
    test('should hold space for new tests', () => {
    })
  })
}) /* describe */
