// @flow
/* globals describe, expect, test, toEqual */

import colors from 'chalk'
import { renameKeys, stringListOrArrayToArray } from '../dataManipulation'
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
      expect(stringListOrArrayToArray('NotePlan, Home, Something Else , and more ', ',')).toEqual(["NotePlan", "Home", "Something Else", "and more"])
    })
  })

  describe('renameKeys()', () => {
    test('rename keys from "old" to "new"', () => {
      const testObj = {
        old: 1,
        level1: {
          old: 2,
          normal: 3,
          deeper: {
            old: 4,
            array: [
              { old: 5 },
              { normal: 6 }
            ]
          }
        }
      }
      const expectedObj = {
        new: 1,
        level1: {
          new: 2,
          normal: 3,
          deeper: {
            new: 4,
            array: [
              { new: 5 },
              { normal: 6 }
            ]
          }
        }
      }
      const newObj = renameKeys(testObj, 'old', 'new')
      expect(newObj).toEqual(expectedObj)
    })

    test('if null passed, return null', () => {
      const testObj = null
      const newObj = renameKeys(testObj, 'old', 'new')
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
            array: [
              { old: 5 },
              { normal: 6 }
            ]
          }
        }
      }
      const newObj = renameKeys(testObj, 'bob', 'mary')
      expect(newObj).toEqual(newObj)
    })

    test("large dashboard test (no perspectives)", () => {
      const testObj = {
        _logTimer: false,
        _logLevel: "DEBUG",
        _logFunctionRE: "getSomeSectionsData|Search",
        pluginID: "jgclark.Dashboard",
        dashboardSettings: {
          hidePriorityMarkers: "",
          lastModified: "2025-03-07 21:00:30.460",
          useRescheduleMarker: true,
          newTaskSectionHeadingLevel: 2,
          newTaskSectionHeading: "<<carry forward>>",
          separateSectionForReferencedNotes: "",
          showQuarterSection: false,
          FFlag_UseTagCache: false,
          excludeTasksWithTimeblocks: false,
          excludeChecklistsWithTimeblocks: false,
          includeScheduledDates: true,
          parentChildMarkersEnabled: true, maxItemsToShowInSection: 16,
          FFlag_ShowTestingPanel: false,
          showTaskContext: true,
          showSearchSection: true,
          includeFolderName: "",
          autoUpdateAfterIdleTime: 15,
          includedFolders: "Home, NotePlan",
          ignoreChecklistItems: false,
          overdueSortOrder: "priority",
          showWeekSection: true,
          hideDuplicates: false,
          showYesterdaySection: false,
          FFlag_ForceInitialLoadForBrowserDebugging: true,
          enableInteractiveProcessingTransitions: "",
          moveSubItems: true,
          showFolderName: false,
          lastChange: "Dashboard Settings updated",
          FFlag_HardRefreshButton: true,
          lookBackDaysForOverdue: 7,
          showPrioritySection: false,
          interactiveProcessingHighlightTask: "",
          showMonthSection: false,
          dontSearchFutureItems: true,
          displayDoneCounts: true,
          excludedFolders: "CCC, Ministry",
          filterPriorityItems: false,
          usePerspectives: true,
          showProjectSection: false,
          showLastWeekSection: false,
          showSavedSearchSection: false,
          ignoreItemsWithTerms: "council, Ministry",
          showOverdueSection: false,
          rescheduleNotMove: "",
          useLiteScheduleMethod: "",
          tagsToShow: "",
          showTimeBlockSection: true,
          useTodayDate: true,
          showTomorrowSection: false,
          FFlag_DebugPanel: false,
          dashboardTheme: "",
          FFlag_ShowSearchPanel: true,
          enableInteractiveProcessing: true,
          applyIgnoreTermsToCalendarHeadingSections: true,
          showScheduledDates: true,
          applyCurrentFilteringToSearch: false,
          includeTaskContext: true,
          perspectivesEnabled: true,
          showTodaySection: true
        }
      }
      const expectedObj = {
        _logTimer: false,
        _logLevel: "DEBUG",
        _logFunctionRE: "getSomeSectionsData|Search",
        pluginID: "jgclark.Dashboard",
        dashboardSettings: {
          hidePriorityMarkers: "",
          lastModified: "2025-03-07 21:00:30.460",
          useRescheduleMarker: true,
          newTaskSectionHeadingLevel: 2,
          newTaskSectionHeading: "<<carry forward>>",
          separateSectionForReferencedNotes: "",
          showQuarterSection: false,
          FFlag_UseTagCache: false,
          excludeTasksWithTimeblocks: false,
          excludeChecklistsWithTimeblocks: false,
          parentChildMarkersEnabled: true, maxItemsToShowInSection: 16,
          FFlag_ShowTestingPanel: false,
          showTaskContext: true,
          showSearchSection: true,
          autoUpdateAfterIdleTime: 15,
          includedFolders: "Home, NotePlan",
          ignoreChecklistItems: false,
          overdueSortOrder: "priority",
          showWeekSection: true,
          hideDuplicates: false,
          showYesterdaySection: false,
          FFlag_ForceInitialLoadForBrowserDebugging: true,
          enableInteractiveProcessingTransitions: "",
          moveSubItems: true,
          showFolderName: false,
          lastChange: "Dashboard Settings updated",
          FFlag_HardRefreshButton: true,
          lookBackDaysForOverdue: 7,
          showPrioritySection: false,
          interactiveProcessingHighlightTask: "",
          showMonthSection: false,
          dontSearchFutureItems: true,
          displayDoneCounts: true,
          excludedFolders: "CCC, Ministry",
          filterPriorityItems: false,
          usePerspectives: true,
          showProjectSection: false,
          showLastWeekSection: false,
          showSavedSearchSection: false,
          ignoreItemsWithTerms: "council, Ministry",
          showOverdueSection: false,
          rescheduleNotMove: "",
          useLiteScheduleMethod: "",
          tagsToShow: "",
          showTimeBlockSection: true,
          useTodayDate: true,
          showTomorrowSection: false,
          FFlag_DebugPanel: false,
          dashboardTheme: "",
          FFlag_ShowSearchPanel: true,
          enableInteractiveProcessing: true,
          applyIgnoreTermsToCalendarHeadingSections: true,
          showScheduledDates: true,
          applyCurrentFilteringToSearch: false,
          showTodaySection: true
        }
      }
      let newObj = renameKeys(testObj, 'perspectivesEnabled', 'usePerspectives')
      newObj = renameKeys(newObj, 'includeFolderName', 'showFolderName')
      newObj = renameKeys(newObj, 'includeScheduledDates', 'showScheduledDates')
      newObj = renameKeys(newObj, 'includeTaskContext', 'showTaskContext')
      clo(newObj, 'newObj:')
      expect(newObj).toEqual(expectedObj)
    })
  })
})
