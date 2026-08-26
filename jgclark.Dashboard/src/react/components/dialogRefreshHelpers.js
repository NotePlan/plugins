// @flow
//--------------------------------------------------------------------------
// Helpers for resolving dialog button sectionCodesToRefresh lists.
// Last updated 2026-08-26 for v2.4.3 by @CursorAI
//--------------------------------------------------------------------------

import type { TSectionCode, TSectionCodeOrLogical } from '../../types'
import { logWarn } from '@helpers/dev'

/**
 * Expand logical refresh tokens (currently only ITEM_ORIG_SECTION) into real TSectionCodes,
 * then dedupe while preserving first-seen order.
 * ITEM_ORIG_SECTION -> itemSectionCode when truthy; otherwise skip and warn.
 * @param {Array<TSectionCodeOrLogical>} codes
 * @param {TSectionCode | ''} itemSectionCode - section the dialog item currently belongs to
 * @returns {Array<TSectionCode>}
 */
export function resolveSectionCodesToRefresh(
  codes: Array<TSectionCodeOrLogical>,
  itemSectionCode: TSectionCode | '',
): Array<TSectionCode> {
  const resolved: Array<TSectionCode> = []
  for (const code of codes) {
    if (code === 'ITEM_ORIG_SECTION') {
      if (itemSectionCode) {
        if (!resolved.includes(itemSectionCode)) {
          resolved.push(itemSectionCode)
        }
      } else {
        logWarn('resolveSectionCodesToRefresh', `ITEM_ORIG_SECTION requested but itemSectionCode is empty; skipping`)
      }
      continue
    }
    if (!resolved.includes(code)) {
      resolved.push(code)
    }
  }
  return resolved
}
