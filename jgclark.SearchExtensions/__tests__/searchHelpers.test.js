/* global describe, expect, test, beforeAll */
// @flow
import {
  type noteAndLine,
  type resultOutputV3Type,
  type SearchConfig,
  type typedSearchTerm,
  createFormattedResultLines,
  numberOfUniqueFilenames,
  reduceNoteAndLineArray,
} from '../src/searchHelpers'
import { sortListBy } from '@helpers/sorting'
import { differenceByPropVal, differenceByObjectEquality } from '@helpers/dataManipulation'
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
