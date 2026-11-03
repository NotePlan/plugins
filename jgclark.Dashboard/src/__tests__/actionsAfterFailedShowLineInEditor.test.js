// @flow
/* globals describe, expect, test */
// Last updated 2026-11-03 for v2.6.0.b7 by @CursorAI

import { actionsAfterFailedShowLineInEditor } from '../clickHandlers'
import { REFRESH_ACTIONS_ALLOWED_ON_HANDLER_FAILURE } from '../types'

const PLUGIN_NAME = 'jgclark.Dashboard'
const FILENAME = 'actionsAfterFailedShowLineInEditor'

describe(`${PLUGIN_NAME}`, () => {
  describe(`${FILENAME}`, () => {
    test('SEARCH failure requests REFRESH_SECTION_IN_JSON (getSomeSectionsData re-runs searchTerms)', () => {
      const recovery = actionsAfterFailedShowLineInEditor('SEARCH')
      expect(recovery.actions).toEqual(['REFRESH_SECTION_IN_JSON'])
      expect(recovery.sectionCodes).toEqual(['SEARCH'])
      expect(recovery.errorMsgSuffix).toContain('refresh that section')
    })

    test('SAVEDSEARCH failure also requests REFRESH_SECTION_IN_JSON', () => {
      const recovery = actionsAfterFailedShowLineInEditor('SAVEDSEARCH')
      expect(recovery.actions).toEqual(['REFRESH_SECTION_IN_JSON'])
      expect(recovery.sectionCodes).toEqual(['SAVEDSEARCH'])
    })

    test('calendar section failure still requests REFRESH_SECTION_IN_JSON', () => {
      const recovery = actionsAfterFailedShowLineInEditor('DT')
      expect(recovery.actions).toEqual(['REFRESH_SECTION_IN_JSON'])
      expect(recovery.sectionCodes).toEqual(['DT'])
      expect(recovery.errorMsgSuffix).toContain('refresh that section')
    })

    test('missing sectionCode returns no actions', () => {
      const recovery = actionsAfterFailedShowLineInEditor(null)
      expect(recovery.actions).toEqual([])
      expect(recovery.sectionCodes).toEqual([])
      expect(recovery.errorMsgSuffix).toBe('')
    })

    test('failure-path allowlist permits REFRESH for SEARCH', () => {
      const recovery = actionsAfterFailedShowLineInEditor('SEARCH')
      recovery.actions.forEach((action) => {
        expect(REFRESH_ACTIONS_ALLOWED_ON_HANDLER_FAILURE).toContain(action)
      })
    })
  })
})
