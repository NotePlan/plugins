/* globals describe, expect, test */
import { DataStore, Editor, CommandBar, NotePlan } from '@mocks/index'
import * as p from '../src/presets'

// Make DataStore and Editor available globally for the source code
global.DataStore = DataStore
global.Editor = Editor
global.CommandBar = CommandBar
global.NotePlan = NotePlan

describe('dwertheimer.EventAutomations AutoTimeBlocking', () => {
  describe('presets', () => {
    // getPresetOptions
    describe('getPresetOptions', () => {
      test('should create proper options', () => {
        expect(p.getPresetOptions([{ label: 'foo' }])).toEqual([{ label: 'foo', value: 0 }])
      })
    })
    describe('setConfigForPreset', () => {
      test('should overwrite config value with preset value and leave the rest', () => {
        const preset = { label: 'foo', todoChar: 'x' }
        const config = { todoChar: 'y', value: 'untouched' }
        expect(p.setConfigForPreset(config, preset)).toEqual({ todoChar: 'x', value: 'untouched' })
      })
    })
  })
})
