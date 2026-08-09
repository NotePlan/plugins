/* global describe, expect, test, beforeAll */
// @flow
// import {
//   type noteAndLine,
//   type resultObjectType,
//   type resultOutputV3Type,
//   type SearchConfig,
//   type typedSearchTerm,
//   createFormattedResultLines,
//   numberOfUniqueFilenames,
//   reduceNoteAndLineArray,
// } from '../src/searchHelpers'
import * as s from '../src/NPExtendedSyntaxHelpers'
import { JSP, clo } from '@helpers/dev'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

describe('NPExtendedSyntaxHelpers.js tests', () => {
  describe('getNonNegativeSearchTermsFromNPExtendedSyntax', () => {
    test('should return empty array from empty string', () => {
      const result = s.getNonNegativeSearchTermsFromNPExtendedSyntax('')
      expect(result).toEqual([])
    })
    test('should return empty array from only operators', () => {
      const result = s.getNonNegativeSearchTermsFromNPExtendedSyntax('is:open')
      expect(result).toEqual([])
    })
    test('should return positive terms from mixed input 1', () => {
      const result = s.getNonNegativeSearchTermsFromNPExtendedSyntax('Holy Spirit -odd -is:open')
      expect(result).toEqual(['Holy','Spirit'])
    })
    test('should return array with all terms from mixed input 2 with joint OR', () => {
      const result = s.getNonNegativeSearchTermsFromNPExtendedSyntax('Holy Spirit (odd OR even)')
      expect(result).toEqual(['Holy','Spirit', 'odd', 'even'])
    })
    test('should return empty array from mixed input 3 with joint negation', () => {
      const result = s.getNonNegativeSearchTermsFromNPExtendedSyntax('Holy Spirit -(odd OR even)')
      expect(result).toEqual(['Holy','Spirit'])
    })
  })
})
