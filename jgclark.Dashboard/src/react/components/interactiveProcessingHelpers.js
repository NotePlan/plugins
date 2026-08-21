// @flow
//--------------------------------------------------------------------------
// Shared Interactive Processing helpers for task and reminder dialogs.
// Last updated 2026-08-21 for v2.4.1 by @CursorAI
//--------------------------------------------------------------------------

import type { TSectionItem } from '../../types'

export type TIPVisibleItem = TSectionItem & { processed?: boolean }

export type TInteractiveProcessingState = {
  sectionName?: string,
  currentIPIndex: number,
  totalTasks: number,
  visibleItems: Array<TIPVisibleItem>,
  clickPosition?: { clientX: number, clientY: number },
}

/**
 * Next unprocessed index in the IP list (forward by default), or -1 if none remain.
 * @param {?Array<TIPVisibleItem>} visibleItems
 * @param {number} currentIPIndex
 * @param {boolean} goBackwards
 * @returns {number}
 */
export function getNextIPIndex(visibleItems: ?Array<TIPVisibleItem>, currentIPIndex: number, goBackwards: boolean = false): number {
  if (!visibleItems || typeof currentIPIndex !== 'number') return -1

  const increment = goBackwards ? -1 : 1
  for (let i = currentIPIndex + increment; i >= 0 && i < visibleItems.length; i += increment) {
    if (!visibleItems[i].processed) {
      return i
    }
  }
  return -1
}

/**
 * Mark the current IP item processed (unless skipped). Optionally mark following task children.
 * Mutates visibleItems in place (same pattern as the original DialogForTaskItems IP code).
 * @param {Array<TIPVisibleItem>} visibleItems
 * @param {number} currentIPIndex
 * @param {boolean} skippedItem
 * @param {boolean} markTaskChildren - when true, mark consecutive isAChild rows after a hasChild parent
 * @returns {void}
 */
export function markCurrentIPItemProcessed(
  visibleItems: Array<TIPVisibleItem>,
  currentIPIndex: number,
  skippedItem: boolean = false,
  markTaskChildren: boolean = true,
): void {
  if (!skippedItem) visibleItems[currentIPIndex].processed = true

  if (!skippedItem && markTaskChildren && visibleItems[currentIPIndex].para?.hasChild) {
    for (let i = currentIPIndex + 1; i < visibleItems.length; i++) {
      const item = visibleItems[i]
      if (item?.para?.isAChild) {
        visibleItems[i].processed = true
      } else {
        break
      }
    }
  }
}

/**
 * Whether any earlier IP item was skipped (for showing the back-skip control).
 * @param {?Array<TIPVisibleItem>} visibleItems
 * @param {number} currentIPIndex
 * @returns {boolean}
 */
export function ipItemsHaveBeenSkipped(visibleItems: ?Array<TIPVisibleItem>, currentIPIndex: number): boolean {
  if (!visibleItems || typeof currentIPIndex !== 'number') return false
  return Boolean(visibleItems.find((item, i) => i < currentIPIndex && item.processed === false))
}

/**
 * Whether the IP back-navigate control should show (from the second item onward).
 * @param {number | void} currentIPIndex
 * @returns {boolean}
 */
export function canNavigateBackInIP(currentIPIndex: number | void): boolean {
  return typeof currentIPIndex === 'number' && currentIPIndex > 0
}

/**
 * Move IP to the previous list index (re-show that item). Does not change processed flags.
 * @param {any} prevSettings
 * @returns {any}
 */
export function buildReactSettingsForIPBackNavigate(prevSettings: any): any {
  const interactiveProcessing = prevSettings?.interactiveProcessing
  if (!interactiveProcessing) return prevSettings

  const { visibleItems, currentIPIndex } = interactiveProcessing
  if (!visibleItems || typeof currentIPIndex !== 'number' || currentIPIndex <= 0) return prevSettings

  const newIPIndex = currentIPIndex - 1
  return {
    ...prevSettings,
    interactiveProcessing: { ...interactiveProcessing, currentIPIndex: newIPIndex },
    dialogData: {
      ...prevSettings.dialogData,
      isOpen: true,
      isTask: true,
      details: { ...prevSettings.dialogData.details, item: visibleItems[newIPIndex] },
    },
    lastChange: `_Dashboard-handleIPBackNavigate to index ${String(newIPIndex)}`,
  }
}

/**
 * Build the next reactSettings patch after processing/skipping the current IP item.
 * @param {any} prevSettings - previous reactSettings
 * @param {{ skippedItem?: boolean, skipForward?: boolean, markTaskChildren?: boolean }} options
 * @returns {any} next reactSettings object
 */
export function buildReactSettingsAfterIPAdvance(
  prevSettings: any,
  options: { skippedItem?: boolean, skipForward?: boolean, markTaskChildren?: boolean } = {},
): any {
  const { skippedItem = false, skipForward = true, markTaskChildren = true } = options
  const interactiveProcessing = prevSettings?.interactiveProcessing
  if (!interactiveProcessing) return prevSettings

  const { visibleItems, currentIPIndex } = interactiveProcessing
  if (!visibleItems || typeof currentIPIndex !== 'number') return prevSettings

  markCurrentIPItemProcessed(visibleItems, currentIPIndex, skippedItem, markTaskChildren)
  const newIPIndex = getNextIPIndex(visibleItems, currentIPIndex, !skipForward)

  if (newIPIndex !== -1) {
    return {
      ...prevSettings,
      interactiveProcessing: { ...interactiveProcessing, currentIPIndex: newIPIndex, visibleItems },
      dialogData: {
        ...prevSettings.dialogData,
        isOpen: true,
        // Keep non-project dialogs in the task/reminder slot; Dialog.jsx routes by itemType
        isTask: true,
        details: { ...prevSettings.dialogData.details, item: visibleItems[newIPIndex] },
      },
      lastChange: `_Dashboard-handleIPItemProcessed more IP items to process`,
    }
  }

  return {
    ...prevSettings,
    interactiveProcessing: null,
    dialogData: {
      ...prevSettings.dialogData,
      isOpen: false,
      isTask: true,
    },
    lastChange: `_Dashboard-handleIPItemProcessed no more IP items to process`,
  }
}
