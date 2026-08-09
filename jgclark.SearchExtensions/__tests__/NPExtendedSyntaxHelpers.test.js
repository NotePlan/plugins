/* global describe, expect, test, beforeAll */
// @flow
import * as s from '../src/NPExtendedSyntaxHelpers'
import type { reducedFieldSet } from '../src/searchHelpers'
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

  describe('prepareNativeSearchString', () => {
    test('keeps terms separate from operators without full-word quoting', () => {
      const prep = s.prepareNativeSearchString('is:open hello world', false)
      expect(prep.searchOperators).toEqual(expect.arrayContaining(['is:open']))
      expect(prep.searchTerms).toEqual(expect.arrayContaining(['hello', 'world']))
      expect(prep.searchString).toEqual('is:open hello world')
      expect(prep.searchTermsToHighlight).toEqual(['hello', 'world'])
    })
  })

  describe('filterReducedSearchResults + reducedFieldSetsToNoteAndLines', () => {
    const sample: Array<reducedFieldSet> = [
      // $FlowFixMe[prop-missing]
      { filename: 'a.md', type: 'open', content: 'findme here', rawContent: '* findme here', lineIndex: 1, noteType: 'Notes', title: 'A' },
      // $FlowFixMe[prop-missing]
      { filename: 'b.md', type: 'done', content: 'findme done', rawContent: '* [x] findme done', lineIndex: 2, noteType: 'Calendar', title: 'B' },
      // $FlowFixMe[prop-missing]
      { filename: 'c.md', type: 'open', content: 'only in http://example.com/findme', rawContent: 'only in http://example.com/findme', lineIndex: 3, noteType: 'Notes', title: 'C' },
    ]

    test('filters by para type open only (and may drop URL-only hits depending on helpers)', () => {
      const filtered = s.filterReducedSearchResults(sample, {
        noteTypesToInclude: ['notes', 'calendar'],
        // $FlowFixMe[incompatible-type]
        paraTypesToInclude: ['open'],
        caseSensitive: false,
        searchStringIn: 'findme',
        searchStringForUrlFilter: 'findme',
        searchTermsToHighlight: ['findme'],
        userLocale: 'en',
      })
      // URL-only hits are removed; open type remains for a.md
      expect(filtered.map((p) => p.filename)).toEqual(['a.md'])
    })

    test('confirmatory note type notes-only', () => {
      const filtered = s.filterReducedSearchResults(sample, {
        noteTypesToInclude: ['notes'],
        // $FlowFixMe[incompatible-type]
        paraTypesToInclude: [],
        caseSensitive: false,
        searchStringIn: 'findme',
        searchStringForUrlFilter: 'findme',
        searchTermsToHighlight: ['findme'],
        userLocale: 'en',
      })
      expect(filtered.every((p) => (p.noteType || '').toLowerCase() === 'notes')).toEqual(true)
      // c.md URL-only dropped; a.md remains
      expect(filtered.map((p) => p.filename)).toEqual(['a.md'])
    })

    test('reducedFieldSetsToNoteAndLines maps filename, index, line', () => {
      const nals = s.reducedFieldSetsToNoteAndLines([sample[0]])
      expect(nals).toEqual([{ noteFilename: 'a.md', index: 1, line: '* findme here' }])
    })
  })
})
