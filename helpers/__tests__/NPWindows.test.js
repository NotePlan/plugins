/* global describe, expect, test, beforeAll */

import colors from 'chalk'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan } from '@mocks/index'
import { getWindowEmbedType, isEmbeddedWindow } from '../NPWindows'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none'
})

const FILE = `${colors.yellow('helpers/NPWindows')}`

describe(`${FILE}`, () => {
  describe('getWindowEmbedType()', () => {
    test('should prefer windowType over type', () => {
      expect(getWindowEmbedType({ type: 'html', windowType: 'main' })).toBe('main')
    })
    test('should ignore HTMLView.type of html (view kind, not embed location)', () => {
      expect(getWindowEmbedType({ type: 'html' })).toBe('')
    })
    test('should read HTMLView.type when it is an embed location', () => {
      expect(getWindowEmbedType({ type: 'floating' })).toBe('floating')
    })
    test('should read TEditor.windowType when type is missing', () => {
      expect(getWindowEmbedType({ windowType: 'split' })).toBe('split')
    })
    test('should return empty string when neither is set', () => {
      expect(getWindowEmbedType({})).toBe('')
    })
  })

  describe('isEmbeddedWindow()', () => {
    test('should be true for main and split panes', () => {
      expect(isEmbeddedWindow({ windowType: 'main' })).toBe(true)
      expect(isEmbeddedWindow({ windowType: 'split' })).toBe(true)
      expect(isEmbeddedWindow({ type: 'main' })).toBe(true)
    })
    test('should be false for floating windows', () => {
      expect(isEmbeddedWindow({ type: 'floating' })).toBe(false)
      expect(isEmbeddedWindow({ windowType: 'floating' })).toBe(false)
    })
    test('should be false for unsupported (iOS) and html view-kind', () => {
      expect(isEmbeddedWindow({ type: 'unsupported' })).toBe(false)
      expect(isEmbeddedWindow({ type: 'html' })).toBe(false)
    })
  })
})
