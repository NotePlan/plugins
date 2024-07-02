// @flow
import { createFilterDropdownItems } from '../filterDropdownItems'
import {dashboardFilters } from "../../../constants.js"
import type { TDropdownItem, TSharedSettings } from "../../../types.js"
import { getShowTagSettingName } from "../sectionHelpers"

describe('helpers', () => {
  describe('NPNote', () => {

    test('should create dropdown items correctly for a single tag', () => {
      const sharedSettings: TSharedSettings = {
        tagToShow: 'Tag1,Tag2',
        showTag1: true,
        showTag2: false,
      }

      const pluginSettings = {
        tagToShow: 'Tag3',
        showTag3: true,
        someOtherSetting: false,
      }

      const expectedDropdownItems = [
        // Expected items for dashboardFilters
        ...dashboardFilters.map(s => ({
          label: s.label,
          key: s.key,
          type: 'switch',
          checked: pluginSettings[s.key] ?? s.default,
        })),
        // Expected items for sections
        {
          label: 'Show Tag1',
          key: 'showTag1',
          type: 'switch',
          checked: true,
        },
        {
          label: 'Show Tag2',
          key: 'showTag2',
          type: 'switch',
          checked: false,
        },
      ]

      const result: Array<TDropdownItem> = createFilterDropdownItems(sharedSettings, 'TAG', pluginSettings)

      expect(result).toEqual(expect.arrayContaining(expectedDropdownItems))
      expect(result.length).toBe(expectedDropdownItems.length)
    })

    test('should create dropdown items correctly for multiple tags', () => {
      const sharedSettings: TSharedSettings = {
        tagToShow: 'Tag1,Tag2',
        showTag1: true,
        showTag2: false,
        showTag3: true,
      }

      const pluginSettings = {
        tagToShow: '',
        someOtherSetting: true,
      }

      const expectedDropdownItems = [
        // Expected items for dashboardFilters
        ...dashboardFilters.map(s => ({
          label: s.label,
          key: s.key,
          type: 'switch',
          checked: pluginSettings[s.key] ?? s.default,
        })),
        // Expected items for sections
        {
          label: 'Show Tag1',
          key: 'showTag1',
          type: 'switch',
          checked: true,
        },
        {
          label: 'Show Tag2',
          key: 'showTag2',
          type: 'switch',
          checked: false,
        },
      ]

      const result: Array<TDropdownItem> = createFilterDropdownItems(sharedSettings, 'TAG', pluginSettings)

      expect(result).toEqual(expect.arrayContaining(expectedDropdownItems))
      expect(result.length).toBe(expectedDropdownItems.length)
    })

    test('should create dropdown items correctly when tags are in pluginSettings', () => {
      const sharedSettings: TSharedSettings = {
        tagToShow: '',
      }

      const pluginSettings = {
        tagToShow: 'Tag3,Tag4',
        showTag3: true,
        showTag4: false,
        someOtherSetting: true,
      }

      const expectedDropdownItems = [
        // Expected items for dashboardFilters
        ...dashboardFilters.map(s => ({
          label: s.label,
          key: s.key,
          type: 'switch',
          checked: pluginSettings[s.key] ?? s.default,
        })),
        // Expected items for sections
        {
          label: 'Show Tag3',
          key: 'showTag3',
          type: 'switch',
          checked: true,
        },
        {
          label: 'Show Tag4',
          key: 'showTag4',
          type: 'switch',
          checked: false,
        },
      ]

      const result: Array<TDropdownItem> = createFilterDropdownItems(sharedSettings, 'TAG', pluginSettings)

      expect(result).toEqual(expect.arrayContaining(expectedDropdownItems))
      expect(result.length).toBe(expectedDropdownItems.length)
    })

  })
})
