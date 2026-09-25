// @flow
/* globals describe, expect, test, toEqual, beforeAll */

import colors from 'chalk'
import { renameKey, renameKeys, stringListOrArrayToArray, getStringArrayValue, formatLocalizedNumber, formatWithSigFigs } from '../dataManipulation'
import { clo, logDebug } from '../dev'

const FILE = `${colors.yellow('helpers/dataManipulation')}`
// const section = colors.blue

beforeAll(() => {
  global.DataStore = {
    settings: {
      _logLevel: 'none',
    },
  }
})

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
        showFolderName: true,
        showTaskContext: false,
        includeScheduledDates: false,
        otherSetting: 'value',
        nested: {
          perspectivesEnabled: false,
          showFolderName: true,
        },
      }

      const keysMap = {
        perspectivesEnabled: 'usePerspectives',
        showFolderName: 'showFolderName',
        includeScheduledDates: 'showScheduledDates',
        showTaskContext: 'showTaskContext',
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
        showFolderName: true,
        showTaskContext: false,
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
        showFolderName: 'showFolderName',
        includeScheduledDates: 'showScheduledDates',
        showTaskContext: 'showTaskContext',
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
          newTaskSectionHeading: 'Home',
          separateSectionForReferencedNotes: '',
          showQuarterSection: false,
          FFlag_ShowSectionTimings: false,
          excludeTasksWithTimeblocks: false,
          excludeChecklistsWithTimeblocks: false,
          includeScheduledDates: true,
          parentChildMarkersEnabled: true,
          maxItemsToShowInSection: 16,
          FFlag_ShowTestingPanel: false,
          showTaskContext: true,
          showSearchSection: true,
          showFolderName: '',
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
          newTaskSectionHeading: 'Home',
          separateSectionForReferencedNotes: '',
          showQuarterSection: false,
          FFlag_ShowSectionTimings: false,
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
        showFolderName: 'showFolderName',
        includeScheduledDates: 'showScheduledDates',
        showTaskContext: 'showTaskContext',
      }
      const newObj = renameKeys(testObj, keysMap)
      clo(newObj, 'newObj:')
      expect(newObj).toEqual(expectedObj)
    })
  })

  describe('getStringArrayValue()', () => {
    test('null input -> defaultValue', () => {
      expect(getStringArrayValue(null, ['priority'])).toEqual(['priority'])
    })
    test('coerces non-string array elements', () => {
      expect(getStringArrayValue(['-priority', 1], [])).toEqual(['-priority', '1'])
    })
    test('splits comma-separated string', () => {
      expect(getStringArrayValue('-priority,content', [])).toEqual(['-priority', 'content'])
    })
  })

  describe('formatWithSigFigs()', () => {
    test('rounds integers above 4 digits to 4 significant figures', () => {
      expect(formatWithSigFigs(12345, 4, 'en-GB')).toBe('12,350')
      expect(formatWithSigFigs(10001, 4, 'en-GB')).toBe('10,000')
      expect(formatWithSigFigs(-12345, 4, 'en-GB')).toBe('-12,350')
    })
    test('leaves integers of 4 digits or fewer unrounded, with grouping', () => {
      expect(formatWithSigFigs(1234, 4, 'en-GB')).toBe('1,234')
      expect(formatWithSigFigs(9999, 4, 'en-GB')).toBe('9,999')
      expect(formatWithSigFigs(12, 4, 'en-GB')).toBe('12')
      expect(formatWithSigFigs(0, 4, 'en-GB')).toBe('0')
    })
    test('uses at most one decimal place when the absolute value is at least 1', () => {
      expect(formatWithSigFigs(12.345, 4, 'en-GB')).toBe('12.3')
      expect(formatWithSigFigs(-12.345, 4, 'en-GB')).toBe('-12.3')
    })
    test('omits a trailing decimal zero', () => {
      expect(formatWithSigFigs(1.0123, 4, 'en-GB')).toBe('1')
      expect(formatWithSigFigs(101.983, 4, 'en-GB')).toBe('102')
      expect(formatWithSigFigs(1234.04, 5, 'en-GB')).toBe('1,234')
      expect(formatWithSigFigs(-101.983, 4, 'en-GB')).toBe('-102')
    })
    test('drops the decimal when 4 significant figures are already used by the integer part', () => {
      expect(formatWithSigFigs(1234.6, 4, 'en-GB')).toBe('1,235')
    })
    test('uses 1 significant figure below 1', () => {
      expect(formatWithSigFigs(0.123, 4, 'en-GB')).toBe('0.1')
      expect(formatWithSigFigs(0.00123, 4, 'en-GB')).toBe('0.001')
      expect(formatWithSigFigs(0.0015, 4, 'en-GB')).toBe('0.002')
      expect(formatWithSigFigs(-0.00123, 4, 'en-GB')).toBe('-0.001')
    })
    test('other locales swap thousands and decimal separators', () => {
      expect(formatWithSigFigs(12345, 4, 'de-DE')).toBe('12.350')
      expect(formatWithSigFigs(101.983, 4, 'de-DE')).toBe('102')
      expect(formatWithSigFigs(0.00123, 4, 'de-DE')).toBe('0,001')
      expect(formatLocalizedNumber(12350, 'fr-FR', 0, 0)).toBe(new Intl.NumberFormat('fr-FR').format(12350))
    })
    test('non-finite input returns 0', () => {
      expect(formatWithSigFigs(NaN, 4, 'en-GB')).toBe('0')
      expect(formatWithSigFigs(Infinity, 4, 'en-GB')).toBe('0')
    })
    test('second argument sets the significant-figure cap and defaults to 4', () => {
      expect(formatWithSigFigs(12345, 3, 'en-GB')).toBe('12,300')
      expect(formatWithSigFigs(1234, 3, 'en-GB')).toBe('1,230')
      expect(formatWithSigFigs(12345, 4, 'en-GB')).toBe('12,350')
      expect(formatWithSigFigs(12345, 0, 'en-GB')).toBe('12,350')
    })
  })
})
