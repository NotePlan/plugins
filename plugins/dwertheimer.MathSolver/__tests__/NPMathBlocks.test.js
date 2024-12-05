// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, expect, test, beforeAll */
/* eslint-disable */

import * as f from '../src/NPMathBlocks'

import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan, Note, Paragraph } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
})

describe('dwertheimer.MathSolver' /* pluginID */, () => {
  describe('NPMathBlocks' /* file */, () => {
    /*
     * findBlockToCalculate()
     */
    describe('findBlockToCalculate()' /* function */, () => {
      const paras = [{ lineIndex: 0 }, { lineIndex: 1 }, { lineIndex: 2 }, { lineIndex: 3 }]
      const blocks = [{ type: 'math', code: '', paragraphs: paras }]
      test('should find first para', () => {
        const result = f.findBlockToCalculate(blocks, 4)
        expect(result).toEqual(0)
      })
      test('should find first code block if there are multiple code blocks', () => {
        const paras2 = [{ lineIndex: 5 }, { lineIndex: 6 }, { lineIndex: 7 }, { lineIndex: 8 }]
        const blocks2 = [
          { type: 'math', code: '', paragraphs: paras },
          { type: 'math', code: '', paragraphs: paras2 },
        ]
        const result = f.findBlockToCalculate(blocks2, 4)
        expect(result).toEqual(0)
      })
      test('should find second code block if there are multiple code blocks', () => {
        const paras2 = [{ lineIndex: 5 }, { lineIndex: 6 }, { lineIndex: 7 }, { lineIndex: 8 }]
        const blocks2 = [
          { type: 'math', code: '', paragraphs: paras },
          { type: 'math', code: '', paragraphs: paras2 },
        ]
        const result = f.findBlockToCalculate(blocks2, 9)
        expect(result).toEqual(1)
      })
    })
  })
}) /* describe */
