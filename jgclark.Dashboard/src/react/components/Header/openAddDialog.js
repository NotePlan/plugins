// @flow
// --------------------------------------------------------------------------
// Opens the single header add dialog from a section button.
// Last updated: 2026-10-30 by @CursorAI
// --------------------------------------------------------------------------

import type { TSectionCode } from '../../../types'

export type TOpenAddDialogOptions = {
  itemKind: 'task' | 'checklist' | 'reminder',
  noteFilename?: string,
  defaultHeading?: string,
  sectionCodes?: Array<TSectionCode>,
}

type Handler = (opts: TOpenAddDialogOptions) => void

let handler: ?Handler = null

/**
 * AddToAnyNote registers the live opener. Returns an unregister function.
 * @param {Handler} next
 * @returns {() => void}
 */
export function registerOpenAddDialog(next: Handler): () => void {
  handler = next
  return () => {
    if (handler === next) handler = null
  }
}

/**
 * Ask the header dialog to open. No-op until AddToAnyNote has mounted.
 * @param {TOpenAddDialogOptions} opts
 */
export function requestOpenAddDialog(opts: TOpenAddDialogOptions): void {
  if (handler) handler(opts)
}
