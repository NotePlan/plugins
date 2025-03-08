// @flow
/* globals describe, expect, test, toEqual */

import colors from 'chalk'
import { renameKey, renameKeys, stringListOrArrayToArray } from '../dataManipulation'
import { clo, logDebug } from '../dev'

const FILE = `${colors.yellow('helpers/dataManipulation')}`
// const section = colors.blue

describe(`${FILE}`, () => {
  describe('stringListOrArrayToArray()', () => {
    test('null input -> []', () => {
      expect(stringListOrArrayToArray(null, ',')).toEqual([])
    })
    test('empty string -> []', () => {
      expect(stringListOrArrayToArray('', ',')).toEqual([])
    })
    test('plain string -> [.]', () => {
      expect(stringListOrArrayToArray('single item', ',')).toEqual(['single item'])
    })
    test('simple list -> [...]', () => {
      expect(stringListOrArrayToArray('one,two,three', ',')).toEqual(['one', 'two', 'three'])
    })
    test('quote-delim list -> [...]', () => {
      expect(stringListOrArrayToArray("'one','two','three'", ',')).toEqual(["'one'", "'two'", "'three'"])
    })
    test('whitespace around separators should be removed', () => {
      expect(stringListOrArrayToArray('NotePlan, Home, Something Else , and more ', ',')).toEqual(['NotePlan', 'Home', 'Something Else', 'and more'])
    })
  })

  describe('renameKey()', () => {
    test('rename keys from "old" to "new"', () => {
      const testObj = {
        old: 1,
        level1: {
          old: 2,
          normal: 3,
          deeper: {
            old: 4,
            array: [{ old: 5 }, { normal: 6 }],
          },
        },
      }
      const expectedObj = {
        new: 1,
        level1: {
          new: 2,
          normal: 3,
          deeper: {
            new: 4,
            array: [{ new: 5 }, { normal: 6 }],
          },
        },
      }
      const newObj = renameKey(testObj, 'old', 'new')
      expect(newObj).toEqual(expectedObj)
    })

    test('if null passed, return null', () => {
      const testObj = null
      const newObj = renameKey(testObj, 'old', 'new')
      expect(newObj).toEqual(testObj)
    })

    test('no change to object with no matching keys', () => {
      const testObj = {
        old: 1,
        level1: {
          old: 2,
          normal: 3,
          deeper: {
            old: 4,
            array: [{ old: 5 }, { normal: 6 }],
          },
        },
      }
      const newObj = renameKey(testObj, 'bob', 'mary')
      expect(newObj).toEqual(newObj)
    })
  })

  describe('renameKeys()', () => {
    test('rename multiple keys using a mapping object', () => {
      const testObj = {
        perspectivesEnabled: true,
        includeFolderName: true,
        includeTaskContext: false,
        includeScheduledDates: false,
        otherSetting: 'value',
        nested: {
          perspectivesEnabled: false,
          includeFolderName: true,
        },
      }

      const keysMap = {
        perspectivesEnabled: 'usePerspectives',
        includeFolderName: 'showFolderName',
        includeScheduledDates: 'showScheduledDates',
        includeTaskContext: 'showTaskContext',
      }

      const expectedObj = {
        usePerspectives: true,
        showFolderName: true,
        showTaskContext: false,
        showScheduledDates: false,
        otherSetting: 'value',
        nested: {
          usePerspectives: false,
          showFolderName: true,
        },
      }

      const newObj = renameKeys(testObj, keysMap)
      expect(newObj).toEqual(expectedObj)
    })

    test('sequential renaming using the old function approach still works with new plural function', () => {
      const testObj = {
        perspectivesEnabled: true,
        includeFolderName: true,
        includeTaskContext: false,
        includeScheduledDates: false,
        FFlag_ShowSearchPanel: true,
        enableInteractiveProcessing: true,
        applyIgnoreTermsToCalendarHeadingSections: true,
        showScheduledDates: true,
        applyCurrentFilteringToSearch: false,
        showTodaySection: true,
      }

      const expectedObj = {
        usePerspectives: true,
        showFolderName: true,
        showTaskContext: false,
        showScheduledDates: true,
        FFlag_ShowSearchPanel: true,
        enableInteractiveProcessing: true,
        applyIgnoreTermsToCalendarHeadingSections: true,
        applyCurrentFilteringToSearch: false,
        showTodaySection: true,
      }

      // Using the new plural version with a mapping object
      const keysMap = {
        perspectivesEnabled: 'usePerspectives',
        includeFolderName: 'showFolderName',
        includeScheduledDates: 'showScheduledDates',
        includeTaskContext: 'showTaskContext',
      }

      const newObj = renameKeys(testObj, keysMap)
      clo(newObj, 'newObj:')
      expect(newObj).toEqual(expectedObj)
    })

    test('rename keys from "old" to "new"', () => {
      const testObj = {
        old: 1,
        level1: {
          old: 2,
          normal: 3,
          deeper: {
            old: 4,
            array: [{ old: 5 }, { normal: 6 }],
          },
        },
      }
      const expectedObj = {
        new: 1,
        level1: {
          new: 2,
          normal: 3,
          deeper: {
            new: 4,
            array: [{ new: 5 }, { normal: 6 }],
          },
        },
      }
      const newObj = renameKey(testObj, 'old', 'new')
      expect(newObj).toEqual(expectedObj)
    })

    test('if null passed, return null', () => {
      const testObj = null
      const newObj = renameKey(testObj, 'old', 'new')
      expect(newObj).toEqual(testObj)
    })

    test('no change to object with no matching keys', () => {
      const testObj = {
        old: 1,
        level1: {
          old: 2,
          normal: 3,
          deeper: {
            old: 4,
            array: [{ old: 5 }, { normal: 6 }],
          },
        },
      }
      const newObj = renameKey(testObj, 'bob', 'mary')
      expect(newObj).toEqual(newObj)
    })

    test('large dashboard test (no perspectives)', () => {
      const testObj = {
        _logTimer: false,
        _logLevel: 'DEBUG',
        _logFunctionRE: 'getSomeSectionsData|Search',
        pluginID: 'jgclark.Dashboard',
        dashboardSettings: {
          hidePriorityMarkers: '',
          lastModified: '2025-03-07 21:00:30.460',
          useRescheduleMarker: true,
          newTaskSectionHeadingLevel: 2,
          newTaskSectionHeading: '<<carry forward>>',
          separateSectionForReferencedNotes: '',
          showQuarterSection: false,
          FFlag_UseTagCache: false,
          excludeTasksWithTimeblocks: false,
          excludeChecklistsWithTimeblocks: false,
          includeScheduledDates: true,
          parentChildMarkersEnabled: true,
          maxItemsToShowInSection: 16,
          FFlag_ShowTestingPanel: false,
          showTaskContext: true,
          showSearchSection: true,
          includeFolderName: '',
          autoUpdateAfterIdleTime: 15,
          includedFolders: 'Home, NotePlan',
          ignoreChecklistItems: false,
          overdueSortOrder: 'priority',
          showWeekSection: true,
          hideDuplicates: false,
          showYesterdaySection: false,
          FFlag_ForceInitialLoadForBrowserDebugging: true,
          enableInteractiveProcessingTransitions: '',
          moveSubItems: true,
          showFolderName: false,
          lastChange: 'Dashboard Settings updated',
          FFlag_HardRefreshButton: true,
          lookBackDaysForOverdue: 7,
          showPrioritySection: false,
          interactiveProcessingHighlightTask: '',
          showMonthSection: false,
          dontSearchFutureItems: true,
          displayDoneCounts: true,
          excludedFolders: 'CCC, Ministry',
          filterPriorityItems: false,
          usePerspectives: true,
          showProjectSection: false,
          showLastWeekSection: false,
          showSavedSearchSection: false,
          ignoreItemsWithTerms: 'council, Ministry',
          showOverdueSection: false,
          rescheduleNotMove: '',
          useLiteScheduleMethod: '',
          tagsToShow: '',
          showTimeBlockSection: true,
          useTodayDate: true,
          showTomorrowSection: false,
          FFlag_DebugPanel: false,
          dashboardTheme: '',
          FFlag_ShowSearchPanel: true,
          enableInteractiveProcessing: true,
          applyIgnoreTermsToCalendarHeadingSections: true,
          showScheduledDates: true,
          applyCurrentFilteringToSearch: false,
          includeTaskContext: true,
          perspectivesEnabled: true,
          showTodaySection: true,
        },
      }
      const expectedObj = {
        _logTimer: false,
        _logLevel: 'DEBUG',
        _logFunctionRE: 'getSomeSectionsData|Search',
        pluginID: 'jgclark.Dashboard',
        dashboardSettings: {
          hidePriorityMarkers: '',
          lastModified: '2025-03-07 21:00:30.460',
          useRescheduleMarker: true,
          newTaskSectionHeadingLevel: 2,
          newTaskSectionHeading: '<<carry forward>>',
          separateSectionForReferencedNotes: '',
          showQuarterSection: false,
          FFlag_UseTagCache: false,
          excludeTasksWithTimeblocks: false,
          excludeChecklistsWithTimeblocks: false,
          parentChildMarkersEnabled: true,
          maxItemsToShowInSection: 16,
          FFlag_ShowTestingPanel: false,
          showTaskContext: true,
          showSearchSection: true,
          autoUpdateAfterIdleTime: 15,
          includedFolders: 'Home, NotePlan',
          ignoreChecklistItems: false,
          overdueSortOrder: 'priority',
          showWeekSection: true,
          hideDuplicates: false,
          showYesterdaySection: false,
          FFlag_ForceInitialLoadForBrowserDebugging: true,
          enableInteractiveProcessingTransitions: '',
          moveSubItems: true,
          showFolderName: false,
          lastChange: 'Dashboard Settings updated',
          FFlag_HardRefreshButton: true,
          lookBackDaysForOverdue: 7,
          showPrioritySection: false,
          interactiveProcessingHighlightTask: '',
          showMonthSection: false,
          dontSearchFutureItems: true,
          displayDoneCounts: true,
          excludedFolders: 'CCC, Ministry',
          filterPriorityItems: false,
          usePerspectives: true,
          showProjectSection: false,
          showLastWeekSection: false,
          showSavedSearchSection: false,
          ignoreItemsWithTerms: 'council, Ministry',
          showOverdueSection: false,
          rescheduleNotMove: '',
          useLiteScheduleMethod: '',
          tagsToShow: '',
          showTimeBlockSection: true,
          useTodayDate: true,
          showTomorrowSection: false,
          FFlag_DebugPanel: false,
          dashboardTheme: '',
          FFlag_ShowSearchPanel: true,
          enableInteractiveProcessing: true,
          applyIgnoreTermsToCalendarHeadingSections: true,
          showScheduledDates: true,
          applyCurrentFilteringToSearch: false,
          showTodaySection: true,
        },
      }
      const keysMap = {
        perspectivesEnabled: 'usePerspectives',
        includeFolderName: 'showFolderName',
        includeScheduledDates: 'showScheduledDates',
        includeTaskContext: 'showTaskContext',
      }
      const newObj = renameKeys(testObj, keysMap)
      clo(newObj, 'newObj:')
      expect(newObj).toEqual(expectedObj)
    })
  })
})
