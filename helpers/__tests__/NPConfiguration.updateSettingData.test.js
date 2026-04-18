/* eslint-disable import/order */
/* global jest, describe, it, expect, beforeAll, beforeEach */
/**
 * @jest-environment node
 */

import { CustomConsole, simpleFormatter } from '@jest/console'
import { DataStore, NotePlan } from '@mocks/index'
import { logWarn, logDebug, logError } from '@helpers/dev'
import { updateSettingData } from '../NPConfiguration.js'

jest.mock('@helpers/dev', () => ({
  ...jest.requireActual('@helpers/dev'),
  logWarn: jest.fn(),
  logDebug: jest.fn(),
  logError: jest.fn(),
}))

const PLUGIN_ID = 'test.plugin'

/**
 * @param {Array<any>} settingsEntries
 * @returns {any}
 */
function makePluginJson(settingsEntries) {
  return {
    'plugin.id': PLUGIN_ID,
    'plugin.settings': settingsEntries,
  }
}

describe('NPConfiguration', () => {
  describe('updateSettingData', () => {
    beforeAll(() => {
      global.DataStore = DataStore
      global.NotePlan = new NotePlan()
      global.console = new CustomConsole(process.stdout, process.stderr, simpleFormatter)
    })

    beforeEach(() => {
      jest.clearAllMocks()
      DataStore.settings = {
        _logLevel: 'none',
      }
    })

    it('returns -1 and logs when pluginJsonData is null', () => {
      expect(updateSettingData(null)).toBe(-1)
      expect(logWarn).toHaveBeenCalledWith(
        'NPConfiguration/updateSettingData',
        'Invalid pluginJsonData: expected a non-null object (not an array). Skipping settings migration.',
      )
    })

    it('returns -1 when pluginJsonData is undefined', () => {
      expect(updateSettingData(undefined)).toBe(-1)
      expect(logWarn).toHaveBeenCalled()
    })

    it('returns -1 when pluginJsonData is an array', () => {
      expect(updateSettingData([])).toBe(-1)
      expect(logWarn).toHaveBeenCalled()
    })

    it('returns -1 when pluginJsonData is a string', () => {
      expect(updateSettingData('np.Shared')).toBe(-1)
      expect(logWarn).toHaveBeenCalled()
    })

    it('returns 0 and does not replace DataStore.settings when no new keys are required', () => {
      DataStore.settings = { _logLevel: 'none', existing: 'kept' }
      const beforeRef = DataStore.settings
      const result = updateSettingData(
        makePluginJson([{ key: 'existing', default: 'ignored', title: 'Existing' }]),
      )
      expect(result).toBe(0)
      expect(DataStore.settings).toBe(beforeRef)
      expect(DataStore.settings.existing).toBe('kept')
    })

    it('adds missing keys with string defaults and preserves existing values', () => {
      DataStore.settings = { _logLevel: 'none', keep: 'K' }
      const result = updateSettingData(
        makePluginJson([
          { key: 'keep', default: 'shouldNotApply', title: 'Keep' },
          { key: 'brandNew', default: 'NEW', title: 'New' },
        ]),
      )
      expect(result).toBe(1)
      expect(DataStore.settings).toEqual({
        keep: 'K',
        brandNew: 'NEW',
      })
    })

    it('uses empty string when default is null or undefined', () => {
      const result = updateSettingData(
        makePluginJson([
          { key: 'fromNull', default: null, title: 'A' },
          { key: 'fromUndef', title: 'B' },
        ]),
      )
      expect(result).toBe(1)
      expect(DataStore.settings.fromNull).toBe('')
      expect(DataStore.settings.fromUndef).toBe('')
    })

    it('preserves boolean false and numeric 0 as defaults for new keys', () => {
      const result = updateSettingData(
        makePluginJson([
          { key: 'flag', default: false, type: 'bool' },
          { key: 'count', default: 0, type: 'number' },
        ]),
      )
      expect(result).toBe(1)
      expect(DataStore.settings.flag).toBe(false)
      expect(DataStore.settings.count).toBe(0)
    })

    it('logs a warning for plugin.settings entries that are objects but lack a valid key', () => {
      const result = updateSettingData(
        makePluginJson([{ title: 'missing key', type: 'string' }, { key: 'ok', default: 'yes', title: 'Ok' }]),
      )
      expect(result).toBe(1)
      expect(logWarn).toHaveBeenCalledWith(
        'NPConfiguration/updateSettingData',
        `plugin.settings[0] has no valid key; skipping. plugin.id=${PLUGIN_ID}`,
      )
    })

    it('logs a warning when key is an empty string', () => {
      updateSettingData(makePluginJson([{ key: '', default: 'x', title: 'Bad' }]))
      expect(logWarn).toHaveBeenCalledWith(
        'NPConfiguration/updateSettingData',
        expect.stringMatching(/plugin\.settings\[0\].*plugin\.id=/),
      )
    })

    it('does not warn for null or non-object entries in plugin.settings', () => {
      const result = updateSettingData(
        makePluginJson([null, { key: 'onlyValid', default: '1', title: 'T' }]),
      )
      expect(result).toBe(1)
      expect(logWarn).not.toHaveBeenCalled()
    })

    it('returns -1 and calls logError when assigning DataStore.settings throws', () => {
      const fakeStore = {}
      Object.defineProperty(fakeStore, 'settings', {
        configurable: true,
        enumerable: true,
        get() {
          return { _logLevel: 'none' }
        },
        set() {
          throw new Error('simulated write failure')
        },
      })
      global.DataStore = fakeStore

      const result = updateSettingData(makePluginJson([{ key: 'fresh', default: 'v', title: 'Fresh' }]))

      global.DataStore = DataStore
      DataStore.settings = { _logLevel: 'none' }

      expect(result).toBe(-1)
      expect(logError).toHaveBeenCalledWith(
        'updateSettingData',
        expect.stringContaining('Plugin Settings Migration Failed'),
      )
    })

    it('calls logDebug when migration writes settings', () => {
      updateSettingData(makePluginJson([{ key: 'x', default: '1', title: 'X' }]))
      expect(logDebug).toHaveBeenCalled()
    })
  })
})
