/* global describe, expect, test, beforeAll */
// @flow
import {
  type noteAndLine,
  type resultOutputV3Type,
  type SearchConfig,
  type typedSearchTerm,
  buildRefreshCallbackArgs,
  createFormattedResultLines,
  findFirstSectionHeadingParagraphIndex,
  finaliseSpecificSearchResultNote,
  getSearchCommandName,
  insertOrReplaceMetadataLine,
  isBodyH1Paragraph,
  isSearchResultsMetadataLine,
  numberOfUniqueFilenames,
  reduceNoteAndLineArray,
} from '../src/searchHelpers'
import { sortListBy } from '@helpers/sorting'
import { differenceByPropVal, differenceByObjectEquality } from '@helpers/dataManipulation'
import { JSP, clo } from '@helpers/dev'
import { stringToTailwindColorName } from '@helpers/colors'
import { setIconForNote } from '@helpers/note'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan } from '@mocks/index'
import { Note } from '@mocks/Note.mock'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'none' //change this to DEBUG to get more logging
})

const searchTerms: Array<typedSearchTerm> = [
  { term: 'TERM1', type: 'may', termRep: 'TERM1' },
  { term: 'TERM2', type: 'not-line', termRep: '-TERM2' },
  { term: 'TERM3', type: 'must', termRep: '+TERM3' },
  { term: 'TERM2', type: 'not-note', termRep: '!TERM2' }, // alternative of 2nd one that is more restrictive
  { term: 'TERM2', type: 'may', termRep: 'TERM2' }, // inverse of searchTerms[1]
  { term: 'TERM1', type: 'must', termRep: '+TERM1' }, // alternative of 1st one for ++ test
  { term: 'TERM2', type: 'must', termRep: '+TERM2' }, // alternative for ++ test
]

const emptyArr: Array<noteAndLine> = []

const mayArr: Array<noteAndLine> = [
  // lines with TERM1, ordered by filename
  // Note: tests will ignore 'index' term, so set to be all the same
  { noteFilename: 'file1', line: '1.1 includes TERM1 and TERM2', index: 0 },
  { noteFilename: 'file1', line: '1.2 includes TERM1 and TERM2 again', index: 0 },
  { noteFilename: 'file2', line: '2.1 includes TERM1 and TERM2', index: 0 },
  { noteFilename: 'file2', line: '2.2 includes TERM1 only', index: 0 },
  { noteFilename: 'file3', line: '3.1 boring but has TERM1', index: 0 },
  { noteFilename: 'file5', line: '5.1 includes TERM1', index: 0 },
  { noteFilename: 'file6', line: '6.1 includes TERM1', index: 0 },
  { noteFilename: 'file6', line: '6.4 TERM3 has gone "(*$&(*%^" and with TERM1', index: 0 },
  { noteFilename: 'file7', line: '7.1 (W£%&W(*%&)) TERM1', index: 0 },
  { noteFilename: 'file7', line: '7.2 has TERM1', index: 0 },
]
// clo(mayArr, 'mayArr:')

const notArr: Array<noteAndLine> = [
  // lines with TERM2, ordered by filename
  // Note: tests will ignore 'index' term, so set to be all the same
  { noteFilename: 'file1', line: '1.1 includes TERM1 and TERM2', index: 0 },
  { noteFilename: 'file1', line: '1.2 includes TERM1 and TERM2 again', index: 0 },
  { noteFilename: 'file2', line: '2.1 includes TERM1 and TERM2', index: 0 },
  { noteFilename: 'file2', line: '2.3 just TERM2 to avoid', index: 0 },
  { noteFilename: 'file4', line: '4.1 includes TERM2', index: 0 },
  { noteFilename: 'file6', line: '6.2 has TERM2', index: 0 },
]
// clo(notArr, 'notArr:')

const mustArr: Array<noteAndLine> = [
  // lines with TERM3, ordered by filename
  // Note: tests will ignore 'index' term, so set to be all the same
  { noteFilename: 'file4', line: '4.2 also has TERM3', index: 0 },
  { noteFilename: 'file4', line: '4.3 also has TERM3', index: 0 },
  { noteFilename: 'file5', line: '5.2 includes TERM3', index: 0 },
  { noteFilename: 'file6', line: '6.3 has TERM3', index: 0 },
  { noteFilename: 'file6', line: '6.4 TERM3 has gone "(*$&(*%^" and with TERM1', index: 0 },
  { noteFilename: 'file7', line: '7.3 has TERM3', index: 0 },
]
// clo(mustArr, 'mustArr:')

describe('searchHelpers.js tests', () => {
  describe('getSearchCommandName()', () => {
    test('maps originator commands to plugin.json command names', () => {
      expect(getSearchCommandName('searchOverAll')).toEqual('search')
      expect(getSearchCommandName('searchPeriod')).toEqual('searchInPeriod')
      expect(getSearchCommandName('quickSearch')).toEqual('quickSearch')
    })
  })

  describe('buildRefreshCallbackArgs()', () => {
    test('puts paraTypes before noteTypes for period search', () => {
      expect(buildRefreshCallbackArgs('searchPeriod', 'term', 'both', 'open,done', '20250101', '20250301'))
        .toEqual(['term', 'open,done', 'both', 'refresh', '20250101', '20250301'])
    })
    test('uses noteTypes before paraTypes for standard searches', () => {
      expect(buildRefreshCallbackArgs('searchOverAll', 'term', 'both', 'open,done'))
        .toEqual(['term', 'both', 'open,done', 'refresh'])
    })
    test('uses noteTypes before paraTypes for open tasks', () => {
      expect(buildRefreshCallbackArgs('searchOpenTasks', 'term', 'both', 'open,done'))
        .toEqual(['term', 'both', 'open,done', 'refresh'])
    })
  })

  describe('numberOfUniqueFilenames()', () => {
    test('should return 6', () => {
      const result = numberOfUniqueFilenames(mayArr)
      expect(result).toEqual(6)
    })
    test('should return 4', () => {
      const result = numberOfUniqueFilenames(notArr)
      expect(result).toEqual(4)
    })
  })

  describe('reduceNoteAndLineArray()', () => {
    test('should return same as mustArr', () => {
      const dupedMustArr: Array<noteAndLine> = [
        // Note: tests will ignore 'index' term, so set to be all the same
        { noteFilename: 'file4', line: '4.2 also has TERM3', index: 0 },
        { noteFilename: 'file4', line: '4.3 also has TERM3', index: 0 },
        { noteFilename: 'file5', line: '5.2 includes TERM3', index: 0 },
        { noteFilename: 'file6', line: '6.3 has TERM3', index: 0 },
        { noteFilename: 'file4', line: '4.3 also has TERM3', index: 0 },
        { noteFilename: 'file6', line: '6.3 has TERM3', index: 0 },
        { noteFilename: 'file6', line: '6.4 TERM3 has gone "(*$&(*%^" and with TERM1', index: 0 },
        { noteFilename: 'file5', line: '5.2 includes TERM3', index: 0 },
        { noteFilename: 'file7', line: '7.3 has TERM3', index: 0 },
        { noteFilename: 'file7', line: '7.3 has TERM3', index: 0 },
      ]
      const result = reduceNoteAndLineArray(dupedMustArr)
      expect(result).toEqual(mustArr)
    })
    test('as above, but reversed', () => {
      const dupedReversedMustArr: Array<noteAndLine> = [
        { noteFilename: 'file7', line: '7.3 has TERM3', index: 0 },
        { noteFilename: 'file7', line: '7.3 has TERM3', index: 0 },
        { noteFilename: 'file6', line: '6.4 TERM3 has gone "(*$&(*%^" and with TERM1', index: 0 },
        { noteFilename: 'file6', line: '6.3 has TERM3', index: 0 },
        { noteFilename: 'file5', line: '5.2 includes TERM3', index: 0 },
        { noteFilename: 'file6', line: '6.3 has TERM3', index: 0 },
        { noteFilename: 'file4', line: '4.3 also has TERM3', index: 0 },
        { noteFilename: 'file5', line: '5.2 includes TERM3', index: 0 },
        { noteFilename: 'file4', line: '4.3 also has TERM3', index: 0 },
        { noteFilename: 'file4', line: '4.2 also has TERM3', index: 0 },
      ]
      const result = reduceNoteAndLineArray(dupedReversedMustArr)
      expect(result).toEqual(mustArr.reverse())
    })
  })

  describe('differenceByPropVal() with noteFilename as match term', () => {
    test('should return empty array, from empty input1', () => {
      const result = differenceByPropVal([], notArr, 'noteFilename')
      expect(result).toEqual([])
    })
    test('should return input array, from empty exclude', () => {
      const result = differenceByPropVal(mayArr, [], 'noteFilename')
      expect(result).toEqual(mayArr)
    })

    test('should return narrower (note) diff of mayArr, notArr (using noteFilename)', () => {
      const diffArr: Array<noteAndLine> = [
        // *notes* with TERM1 but not TERM2
        { noteFilename: 'file3', line: '3.1 boring but has TERM1', index: 0 },
        { noteFilename: 'file5', line: '5.1 includes TERM1', index: 0 },
        { noteFilename: 'file7', line: '7.1 (W£%&W(*%&)) TERM1', index: 0 },
        { noteFilename: 'file7', line: '7.2 has TERM1', index: 0 },
      ]
      const result = differenceByPropVal(mayArr, notArr, 'noteFilename')
      // clo(result, 'test result for TERM1 but not TERM2')
      expect(result).toEqual(diffArr)
    })
    test('should return narrower (note) diff of mustArr, notArr (using noteFilename)', () => {
      const diffArr: Array<noteAndLine> = [
        // *notes* with TERM3 but not TERM2
        // TODO: ideally figure out why this returns in an unexpected order (and so the need for a sort before comparison)
        { noteFilename: 'file5', line: '5.2 includes TERM3', index: 0 },
        { noteFilename: 'file7', line: '7.3 has TERM3', index: 0 },
      ]
      const result = sortListBy(differenceByPropVal(mustArr, notArr, 'noteFilename'), ['noteFilename', 'line'])
      clo(result, 'test result for TERM3 but not TERM2')
      expect(result).toEqual(diffArr)
    })
  })

  describe('differenceByObjectEquality()', () => {
    test('should return empty array, from empty input1', () => {
      const result = differenceByObjectEquality([], notArr)
      expect(result).toEqual([])
    })
    test('should return input array, from empty exclude', () => {
      const result = differenceByObjectEquality(mayArr, [])
      expect(result).toEqual(mayArr)
    })

    test('should return wider (line) diff of mayArr, notArr', () => {
      const diffArr: Array<noteAndLine> = [
        { noteFilename: 'file2', line: '2.2 includes TERM1 only', index: 0 },
        { noteFilename: 'file3', line: '3.1 boring but has TERM1', index: 0 },
        { noteFilename: 'file5', line: '5.1 includes TERM1', index: 0 },
        { noteFilename: 'file6', line: '6.1 includes TERM1', index: 0 },
        { noteFilename: 'file6', line: '6.4 TERM3 has gone "(*$&(*%^" and with TERM1', index: 0 },
        { noteFilename: 'file7', line: '7.1 (W£%&W(*%&)) TERM1', index: 0 },
        { noteFilename: 'file7', line: '7.2 has TERM1', index: 0 },
      ]
      const result = differenceByObjectEquality(mayArr, notArr)
      // clo(result, 'test result for TERM1 but not TERM2')
      expect(result).toEqual(diffArr)
    })
    test('should return wider (line) diff of modifiedMustArr, notArr', () => {
      const modifiedMustArr: Array<noteAndLine> = [
        { noteFilename: 'file1', line: '1.1 includes TERM1 and TERM2', index: 0 },
        { noteFilename: 'file4', line: '4.1 includes TERM2', index: 0 },
        { noteFilename: 'file4', line: '4.2 also has TERM3', index: 0 },
        { noteFilename: 'file4', line: '4.3 also has TERM3', index: 0 },
        { noteFilename: 'file5', line: '5.2 includes TERM3', index: 0 },
        { noteFilename: 'file6', line: '6.2 has TERM2', index: 0 },
        { noteFilename: 'file6', line: '6.4 TERM3 has gone "(*$&(*%^" and with TERM1', index: 0 },
        { noteFilename: 'file7', line: '7.3 has TERM3', index: 0 },
      ]
      const diffArr: Array<noteAndLine> = [
        // *lines* with TERM3 but not TERM2
        { noteFilename: 'file4', line: '4.2 also has TERM3', index: 0 },
        { noteFilename: 'file4', line: '4.3 also has TERM3', index: 0 },
        { noteFilename: 'file5', line: '5.2 includes TERM3', index: 0 },
        { noteFilename: 'file6', line: '6.4 TERM3 has gone "(*$&(*%^" and with TERM1', index: 0 },
        { noteFilename: 'file7', line: '7.3 has TERM3', index: 0 },
      ]
      const result = differenceByObjectEquality(modifiedMustArr, notArr)
      // clo(result, 'test result for TERM3 but not TERM2')
      expect(result).toEqual(diffArr)
    })
  })

  describe('isSearchResultsMetadataLine()', () => {
    test('recognises current metadata format', () => {
      const line = '**6 results** from 4 notes at 31/08/2026, 20:00 [🔄 Re-run search](noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions)'
      expect(isSearchResultsMetadataLine(line)).toEqual(true)
    })
    test('recognises legacy Refresh label', () => {
      const line = '(6 results from 4 notes) at 31/08/2026 [🔄 Refresh \'KeyChanges\' search](noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions)'
      expect(isSearchResultsMetadataLine(line)).toEqual(true)
    })
    test('rejects ordinary result lines', () => {
      expect(isSearchResultsMetadataLine('- some note line with results from 4 notes mentioned')).toEqual(false)
    })
  })

  describe('insertOrReplaceMetadataLine()', () => {
    const config: Partial<SearchConfig> = { headingLevel: 2 }
    const oldMetadata = '**6 results** from 4 notes at 31/08/2026, 20:00 [🔄 Re-run search](noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions)'
    const newMetadata = '**15 results** from 12 notes at 31/08/2026, 21:49 [🔄 Re-run search](noteplan://x-callback-url/runPlugin?pluginID=jgclark.SearchExtensions)'

    test('replaces the metadata paragraph before the first section heading', () => {
      const note = new Note({ filename: 'Search Results/Test.md' })
      note.paragraphs = [
        { content: '---', type: 'separator', lineIndex: 0, headingLevel: 0 },
        { content: 'triggers: onOpen -> jgclark.SearchExtensions.refreshSavedSearch', type: 'text', lineIndex: 1, headingLevel: 0 },
        { content: '---', type: 'separator', lineIndex: 2, headingLevel: 0 },
        { content: oldMetadata, type: 'text', lineIndex: 3, headingLevel: 0 },
        { content: '[KeyChanges]', type: 'title', lineIndex: 4, headingLevel: 2 },
        { content: '- old result', type: 'list', lineIndex: 5, headingLevel: 2 },
      ]
      note._content = 'mock content'
      const updateParagraphSpy = jest.spyOn(note, 'updateParagraph')
      insertOrReplaceMetadataLine(note, config, newMetadata)
      expect(note.paragraphs[3].content).toEqual(newMetadata)
      expect(note.paragraphs.filter((p) => p.content === oldMetadata).length).toEqual(0)
      expect(updateParagraphSpy).toHaveBeenCalled()
    })
  })

  describe('findFirstSectionHeadingParagraphIndex()', () => {
    test('returns paragraph index of first section heading after frontmatter', () => {
      const note = new Note({ filename: 'Search Results/Test3.md' })
      note.paragraphs = [
        { content: '---', type: 'separator', lineIndex: 0, headingLevel: 0 },
        { content: '---', type: 'separator', lineIndex: 1, headingLevel: 0 },
        { content: 'metadata', type: 'text', lineIndex: 2, headingLevel: 0 },
        { content: '[KeyChanges]', type: 'title', lineIndex: 3, headingLevel: 2 },
      ]
      note._content = 'mock content'
      expect(findFirstSectionHeadingParagraphIndex(note, 2)).toEqual(3)
    })
  })

  describe('finaliseSpecificSearchResultNote()', () => {
    test('sets frontmatter title and removes H1', () => {
      const note = new Note({ filename: 'Search Results/TheSacred.md' })
      note.paragraphs = [
        { content: '[TheSacred] Search results', type: 'title', lineIndex: 0, headingLevel: 1 },
        { content: 'metadata', type: 'text', lineIndex: 1, headingLevel: 0 },
        { content: '[TheSacred]', type: 'title', lineIndex: 2, headingLevel: 2 },
      ]
      note._content = '# [TheSacred] Search results\nmetadata\n## [TheSacred]\n'
      note.frontmatterAttributes = {}

      finaliseSpecificSearchResultNote(note, '[TheSacred] Search results')

      expect(note.frontmatterAttributes.title).toEqual('[TheSacred] Search results')
      expect(note.paragraphs.some((p) => p.headingLevel === 1)).toEqual(false)
    })

    test('keeps title in FM block when removing legacy H1 above existing YAML', () => {
      const note = new Note({ filename: 'Search Results/TheSacred.md' })
      note.paragraphs = [
        { content: '---', type: 'separator', lineIndex: 0, headingLevel: 0 },
        { content: 'triggers: onOpen -> foo', type: 'text', lineIndex: 1, headingLevel: 0 },
        { content: '---', type: 'separator', lineIndex: 2, headingLevel: 0 },
        { content: '[TheSacred] Search results', type: 'title', lineIndex: 3, headingLevel: 1 },
        { content: '6 results from 4 notes', type: 'text', lineIndex: 4, headingLevel: 0 },
        { content: '[TheSacred]', type: 'title', lineIndex: 5, headingLevel: 2 },
      ]
      note._content = '---\ntriggers: onOpen -> foo\n---\n# [TheSacred] Search results\n6 results from 4 notes\n## [TheSacred]\n'
      note.frontmatterAttributes = { triggers: 'onOpen -> foo' }

      finaliseSpecificSearchResultNote(note, '[TheSacred] Search results')

      expect(note.frontmatterAttributes.title).toEqual('[TheSacred] Search results')
      expect(note.paragraphs.some((p) => p.content.startsWith('title:'))).toEqual(true)
      expect(note.paragraphs.some((p) => p.headingLevel === 1)).toEqual(false)
    })
  })

  describe('re-run pipeline (metadata → finalise → icon)', () => {
    test('keeps frontmatter title when note has YAML block but no title line', () => {
      const requestedTitle = '[TheSacred] Search results'
      const note = new Note({ filename: 'Search Results/TheSacred.md' })
      note.paragraphs = [
        { content: '---', type: 'separator', lineIndex: 0, headingLevel: 0 },
        { content: 'triggers: onOpen -> jgclark.SearchExtensions.searchOnOpen', type: 'text', lineIndex: 1, headingLevel: 0 },
        { content: '---', type: 'separator', lineIndex: 2, headingLevel: 0 },
        { content: '6 results from 4 notes at 1 Jan 2025', type: 'text', lineIndex: 3, headingLevel: 0 },
        { content: '[TheSacred]', type: 'title', lineIndex: 4, headingLevel: 2 },
        { content: '- old result', type: 'text', lineIndex: 5, headingLevel: 0 },
      ]
      note._content = '---\ntriggers: onOpen -> jgclark.SearchExtensions.searchOnOpen\n---\n6 results from 4 notes at 1 Jan 2025\n## [TheSacred]\n- old result\n'
      note.frontmatterAttributes = { triggers: 'onOpen -> jgclark.SearchExtensions.searchOnOpen' }
      Editor.note = note

      const config: Partial<SearchConfig> = { headingLevel: 2 }
      const newMetadata = '15 results from 12 notes at 31 Aug 2026 [🔄 Re-run search](noteplan://x-callback-url/runPlugin)'

      insertOrReplaceMetadataLine(note, config, newMetadata)
      finaliseSpecificSearchResultNote(note, requestedTitle)
      setIconForNote(note, 'magnifying-glass', stringToTailwindColorName(requestedTitle))

      expect(note.frontmatterAttributes.title).toEqual(requestedTitle)
      expect(note.frontmatterAttributes.triggers).toEqual('onOpen -> jgclark.SearchExtensions.searchOnOpen')
      expect(note.frontmatterAttributes.icon).toEqual('magnifying-glass')
      expect(note.paragraphs.some((p) => p.content.startsWith('title:'))).toEqual(true)
      expect(note.paragraphs.some((p) => p.headingLevel === 1)).toEqual(false)
      expect(note.paragraphs.some((p) => p.content === newMetadata)).toEqual(true)
    })
  })

  // Just a no-result test -- rest too hard to mock up
  describe('createFormattedResultLines', () => {
    test('for empty result', () => {
      const resultSet: resultOutputV3Type = {
        searchTermsStr: 'TERM1 -TERM2',
        searchOperatorsStr: '',
        searchTermsToHighlight: ['TERM1', '-TERM2'],
        resultNoteAndLineArr: [],
        resultCount: 0,
        resultNoteCount: 0,
        fullResultCount: 0,
      }
      const config: Partial<SearchConfig> = {
        resultStyle: 'NotePlan',
        headingLevel: 2,
        groupResultsByNote: true,
        highlightResults: true,
        resultPrefix: '- ',
        resultQuoteLength: 120,
        dateStyle: 'date',
      }
      // $FlowFixMe[incompatible-call]
      const result = createFormattedResultLines(resultSet, config)
      expect(result).toEqual([])
    })
  })
})
