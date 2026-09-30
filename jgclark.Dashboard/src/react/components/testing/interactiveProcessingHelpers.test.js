/* globals describe, expect, test */
//--------------------------------------------------------------------------
// Tests for interactiveProcessingHelpers.js (#779)
//--------------------------------------------------------------------------

import {
  buildReactSettingsAfterIPAdvance,
  buildReactSettingsForIPBackNavigate,
  canNavigateBackInIP,
  getNextIPIndex,
  ipItemsHaveBeenSkipped,
  isTaskDialogItem,
  markCurrentIPItemProcessed,
} from '../interactiveProcessingHelpers.js'

describe('interactiveProcessingHelpers', () => {
  describe('getNextIPIndex', () => {
    test('finds next unprocessed forward and backward', () => {
      const items = [{ ID: 'a', processed: true }, { ID: 'b' }, { ID: 'c', processed: true }, { ID: 'd' }]
      expect(getNextIPIndex(items, 0, false)).toBe(1)
      expect(getNextIPIndex(items, 1, false)).toBe(3)
      expect(getNextIPIndex(items, 3, true)).toBe(1)
      expect(getNextIPIndex(items, 1, true)).toBe(-1)
    })

    test('returns -1 for empty or finished lists', () => {
      expect(getNextIPIndex([], 0)).toBe(-1)
      expect(getNextIPIndex(null, 0)).toBe(-1)
      const allDone = [{ ID: 'a', processed: true }, { ID: 'b', processed: true }]
      expect(getNextIPIndex(allDone, 0)).toBe(-1)
    })
  })

  describe('markCurrentIPItemProcessed', () => {
    test('marks current item and consecutive children', () => {
      const items = [
        { ID: 'p', para: { hasChild: true } },
        { ID: 'c1', para: { isAChild: true } },
        { ID: 'c2', para: { isAChild: true } },
        { ID: 'n', para: { isAChild: false } },
      ]
      markCurrentIPItemProcessed(items, 0, false, true)
      expect(items[0].processed).toBe(true)
      expect(items[1].processed).toBe(true)
      expect(items[2].processed).toBe(true)
      expect(items[3].processed).toBeUndefined()
    })

    test('skip does not mark processed; markTaskChildren false skips children', () => {
      const items = [{ ID: 'p', para: { hasChild: true } }, { ID: 'c1', para: { isAChild: true } }]
      markCurrentIPItemProcessed(items, 0, true, true)
      expect(items[0].processed).toBeUndefined()
      markCurrentIPItemProcessed(items, 0, false, false)
      expect(items[0].processed).toBe(true)
      expect(items[1].processed).toBeUndefined()
    })
  })

  describe('ipItemsHaveBeenSkipped', () => {
    test('detects earlier unprocessed items', () => {
      const items = [{ ID: 'a', processed: false }, { ID: 'b', processed: true }, { ID: 'c' }]
      expect(ipItemsHaveBeenSkipped(items, 2)).toBe(true)
      expect(ipItemsHaveBeenSkipped(items, 0)).toBe(false)
    })
  })

  describe('isTaskDialogItem', () => {
    test('is false only for project rows', () => {
      expect(isTaskDialogItem({ ID: 'p', itemType: 'project' })).toBe(false)
      expect(isTaskDialogItem({ ID: 't', itemType: 'open' })).toBe(true)
      expect(isTaskDialogItem({ ID: 'r', itemType: 'reminder' })).toBe(true)
      expect(isTaskDialogItem(null)).toBe(true)
    })
  })

  describe('canNavigateBackInIP / buildReactSettingsForIPBackNavigate', () => {
    test('canNavigateBackInIP is true from the second item', () => {
      expect(canNavigateBackInIP(0)).toBe(false)
      expect(canNavigateBackInIP(1)).toBe(true)
      expect(canNavigateBackInIP(undefined)).toBe(false)
    })

    test('buildReactSettingsForIPBackNavigate moves to previous index', () => {
      const a = { ID: 'a', itemType: 'reminder' }
      const b = { ID: 'b', itemType: 'reminder' }
      const prev = {
        interactiveProcessing: { currentIPIndex: 1, totalTasks: 2, visibleItems: [a, b] },
        dialogData: { isOpen: true, isTask: true, details: { item: b } },
      }
      const next = buildReactSettingsForIPBackNavigate(prev)
      expect(next.interactiveProcessing.currentIPIndex).toBe(0)
      expect(next.dialogData.details.item).toEqual(a)
      expect(next.dialogData.isTask).toBe(true)

      const atStart = { ...prev, interactiveProcessing: { ...prev.interactiveProcessing, currentIPIndex: 0 } }
      expect(buildReactSettingsForIPBackNavigate(atStart)).toBe(atStart)
    })

    test('buildReactSettingsForIPBackNavigate sets isTask false for projects', () => {
      const a = { ID: 'a', itemType: 'project' }
      const b = { ID: 'b', itemType: 'project' }
      const prev = {
        interactiveProcessing: { currentIPIndex: 1, totalTasks: 2, visibleItems: [a, b] },
        dialogData: { isOpen: true, isTask: false, details: { item: b } },
      }
      const next = buildReactSettingsForIPBackNavigate(prev)
      expect(next.dialogData.isTask).toBe(false)
      expect(next.dialogData.details.item).toEqual(a)
    })
  })

  describe('buildReactSettingsAfterIPAdvance', () => {
    test('advances to next item and closes when finished', () => {
      const task = { ID: 't1', itemType: 'open' }
      const reminder = { ID: 'r1', itemType: 'reminder' }
      const prev = {
        interactiveProcessing: {
          currentIPIndex: 0,
          totalTasks: 2,
          visibleItems: [task, reminder],
        },
        dialogData: { isOpen: true, isTask: true, details: { item: task } },
      }
      const mid = buildReactSettingsAfterIPAdvance(prev, { skippedItem: false, skipForward: true })
      expect(mid.interactiveProcessing.currentIPIndex).toBe(1)
      expect(mid.dialogData.details.item).toEqual(reminder)
      expect(mid.dialogData.isOpen).toBe(true)
      expect(mid.dialogData.isTask).toBe(true)

      const end = buildReactSettingsAfterIPAdvance(mid, { skippedItem: false, skipForward: true })
      expect(end.interactiveProcessing).toBeNull()
      expect(end.dialogData.isOpen).toBe(false)
    })

    test('keeps isTask false when advancing between project rows', () => {
      const p1 = { ID: 'p1', itemType: 'project' }
      const p2 = { ID: 'p2', itemType: 'project' }
      const prev = {
        interactiveProcessing: {
          currentIPIndex: 0,
          totalTasks: 2,
          visibleItems: [p1, p2],
        },
        dialogData: { isOpen: true, isTask: false, details: { item: p1 } },
      }
      const mid = buildReactSettingsAfterIPAdvance(prev, { skippedItem: false, skipForward: true, markTaskChildren: false })
      expect(mid.interactiveProcessing.currentIPIndex).toBe(1)
      expect(mid.dialogData.isTask).toBe(false)
      expect(mid.dialogData.details.item).toEqual(p2)
    })
  })
})
