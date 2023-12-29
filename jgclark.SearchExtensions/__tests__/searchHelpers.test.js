/* global describe, expect, test, beforeAll */
// @flow
import {
  type noteAndLine,
  type resultObjectTypeV3,
  type resultOutputTypeV3,
  type SearchConfig,
  type typedSearchTerm,
  applySearchOperators,
  createFormattedResultLines,
  differenceByPropVal,
  differenceByObjectEquality,
  normaliseSearchTerms,
  noteAndLineIntersection,
  numberOfUniqueFilenames,
  reduceNoteAndLineArray,
  validateAndTypeSearchTerms,
} from '../src/searchHelpers'
import { sortListBy } from '@helpers/sorting'
import { JSP, clo } from '@helpers/dev'
import { Calendar, Clipboard, CommandBar, DataStore, Editor, NotePlan /*, Note, Paragraph */ } from '@mocks/index'

beforeAll(() => {
  global.Calendar = Calendar
  global.Clipboard = Clipboard
  global.CommandBar = CommandBar
  global.DataStore = DataStore
  global.Editor = Editor
  global.NotePlan = NotePlan
  DataStore.settings['_logLevel'] = 'DEBUG' //change this to DEBUG to get more logging
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

  describe('noteAndLineIntersection', () => {
    test('should return empty array, from [] []', () => {
      const result = noteAndLineIntersection([], [])
      expect(result).toEqual(emptyArr)
    })
    test('should return empty array, from [+TERM2] []', () => {
      const result = noteAndLineIntersection(mustArr, [])
      expect(result).toEqual(emptyArr)
    })

    test('should return results, from [+TERM2 +TERM3]', () => {
      const result = noteAndLineIntersection(notArr, mustArr)
      expect(result).toEqual(emptyArr)
    })

    const expectedArr: Array<noteAndLine> = [
      { noteFilename: 'file1', line: '1.1 includes TERM1 and TERM2', index: 0 },
      { noteFilename: 'file1', line: '1.2 includes TERM1 and TERM2 again', index: 0 },
      { noteFilename: 'file2', line: '2.1 includes TERM1 and TERM2', index: 0 },
    ]
    test('should return results, from [+TERM1 +TERM2]', () => {
      const result = noteAndLineIntersection(mayArr, notArr)
      expect(result).toEqual(expectedArr)
    })
    test('should return results, from [+TERM2 +TERM1]', () => {
      const result = noteAndLineIntersection(notArr, mayArr)
      expect(result).toEqual(expectedArr)
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

  // ----------------

  describe('applySearchOperators(termsResults: Array<resultObjectTypeV2>, operateOnWholeNote: boolean): resultObjectType', () => {
    // clo(combinedResults, 'combinedResults: ')

    test('should return no results from simple no results', () => {
      // For empty results
      const combinedResults: Array<resultObjectTypeV3> = [{ searchTerm: searchTerms[0], resultNoteAndLineArr: emptyArr, resultCount: 0 }]
      const expectedNoteBasedOutput: resultOutputTypeV3 = {
        // for no results
        searchTermsRepArr: ['TERM1'],
        resultNoteAndLineArr: [],
        resultCount: 0,
        fullResultCount: 0,
        resultNoteCount: 0,
      }
      const result = applySearchOperators(combinedResults)
      // clo(expectedNoteBasedOutput, 'expectedNoteBasedOutput = ')
      expect(result).toEqual(expectedNoteBasedOutput)
    })

    test('should return no results from [TERM2 -TERM2] search', () => {
      // For empty results
      const combinedResults: Array<resultObjectTypeV3> = [
        { searchTerm: searchTerms[4], resultNoteAndLineArr: notArr, resultCount: 6 },
        { searchTerm: searchTerms[1], resultNoteAndLineArr: notArr, resultCount: 6 },
      ]
      const expectedNoteBasedOutput: resultOutputTypeV3 = {
        // for no results
        searchTermsRepArr: ['TERM2', '-TERM2'],
        resultNoteAndLineArr: [],
        resultCount: 0,
        fullResultCount: 0,
        resultNoteCount: 0,
      }
      const result = applySearchOperators(combinedResults)
      // clo(expectedNoteBasedOutput, 'expectedNoteBasedOutput = ')
      expect(result).toEqual(expectedNoteBasedOutput)
    })

    test('should return few results from [+TERM1 +TERM2] search', () => {
      const combinedResults: Array<resultObjectTypeV3> = [
        { searchTerm: searchTerms[5], resultNoteAndLineArr: mayArr, resultCount: 10 },
        { searchTerm: searchTerms[6], resultNoteAndLineArr: notArr, resultCount: 6 },
      ]
      const expectedNoteBasedOutput: resultOutputTypeV3 = {
        searchTermsRepArr: ['+TERM1', '+TERM2'],
        resultNoteAndLineArr: [
          { noteFilename: 'file1', line: '1.1 includes TERM1 and TERM2', index: 0 },
          { noteFilename: 'file1', line: '1.2 includes TERM1 and TERM2 again', index: 0 },
          { noteFilename: 'file2', line: '2.1 includes TERM1 and TERM2', index: 0 },
        ],
        resultCount: 3,
        fullResultCount: 3,
        resultNoteCount: 2,
      }
      const result = applySearchOperators(combinedResults)
      // clo(expectedNoteBasedOutput, 'expectedNoteBasedOutput = ')
      expect(result).toEqual(expectedNoteBasedOutput)
    })

    test('should return narrower !term results', () => {
      // For TERM1, -TERM2, +TERM3
      const combinedResults: Array<resultObjectTypeV3> = [
        { searchTerm: searchTerms[0], resultNoteAndLineArr: mayArr, resultCount: 1 },
        { searchTerm: searchTerms[3], resultNoteAndLineArr: notArr, resultCount: 2 }, // the !TERM2 alternative
        { searchTerm: searchTerms[2], resultNoteAndLineArr: mustArr, resultCount: 4 },
      ]
      const expectedNoteBasedOutput: resultOutputTypeV3 = {
        // For TERM1, -TERM2, +TERM3 matching *notes*
        // TODO: ideally figure out why this returns in an unexpected order (and so the need for a sort before comparison)
        searchTermsRepArr: ['TERM1', '!TERM2', '+TERM3'],
        resultNoteAndLineArr: [
          { noteFilename: 'file5', line: '5.1 includes TERM1', index: 0 },
          { noteFilename: 'file5', line: '5.2 includes TERM3', index: 0 },
          { noteFilename: 'file7', line: '7.1 (W£%&W(*%&)) TERM1', index: 0 },
          { noteFilename: 'file7', line: '7.2 has TERM1', index: 0 },
          { noteFilename: 'file7', line: '7.3 has TERM3', index: 0 },
        ],
        resultCount: 5,
        fullResultCount: 5,
        resultNoteCount: 2,
      }
      const result = applySearchOperators(combinedResults)
      const sortedRNALArr = sortListBy(result.resultNoteAndLineArr, ['noteFilename', 'line'])
      result.resultNoteAndLineArr = sortedRNALArr
      // clo(result, "result for ['TERM1', '!TERM2', '+TERM3'] = ")
      // clo(expectedNoteBasedOutput, 'expectedNoteBasedOutput = ')
      expect(result).toEqual(expectedNoteBasedOutput)
    })

    test('should return wider -term results', () => {
      // For TERM1, -TERM2, +TERM3
      const combinedResults: Array<resultObjectTypeV3> = [
        { searchTerm: searchTerms[0], resultNoteAndLineArr: mayArr, resultCount: 1 },
        { searchTerm: searchTerms[1], resultNoteAndLineArr: notArr, resultCount: 2 },
        { searchTerm: searchTerms[2], resultNoteAndLineArr: mustArr, resultCount: 4 },
      ]
      const expectedLineBasedOutput: resultOutputTypeV3 = {
        // For TERM1, -TERM2, +TERM3 matching *lines*
        // TODO: ideally figure out why this returns in an unexpected order (and so the need for a sort before comparison)
        searchTermsRepArr: ['TERM1', '-TERM2', '+TERM3'],
        resultNoteAndLineArr: [
          { noteFilename: 'file4', line: '4.2 also has TERM3', index: 0 },
          { noteFilename: 'file4', line: '4.3 also has TERM3', index: 0 },
          { noteFilename: 'file5', line: '5.1 includes TERM1', index: 0 },
          { noteFilename: 'file5', line: '5.2 includes TERM3', index: 0 },
          { noteFilename: 'file6', line: '6.1 includes TERM1', index: 0 },
          { noteFilename: 'file6', line: '6.3 has TERM3', index: 0 },
          { noteFilename: 'file6', line: '6.4 TERM3 has gone "(*$&(*%^" and with TERM1', index: 0 },
          { noteFilename: 'file7', line: '7.1 (W£%&W(*%&)) TERM1', index: 0 },
          { noteFilename: 'file7', line: '7.2 has TERM1', index: 0 },
          { noteFilename: 'file7', line: '7.3 has TERM3', index: 0 },
        ],
        resultCount: 10,
        fullResultCount: 10,
        resultNoteCount: 4,
      }
      const result = applySearchOperators(combinedResults)
      const sortedRNALArr = sortListBy(result.resultNoteAndLineArr, ['noteFilename', 'line'])
      result.resultNoteAndLineArr = sortedRNALArr
      // clo(result, 'result for TERM1, -TERM2, +TERM3 = ')
      // clo(expectedLineBasedOutput, "expected for [TERM1, -TERM2, +TERM3]")
      expect(result).toEqual(expectedLineBasedOutput)
    })
  })

  describe('normaliseSearchTerms', () => {
    test('empty string -> empty string', () => {
      const result = normaliseSearchTerms('')
      expect(result).toEqual([''])
    })
    test('just spaces', () => {
      const result = normaliseSearchTerms('  ')
      expect(result).toEqual([])
    })
    test('free-floating operator +', () => {
      const result = normaliseSearchTerms(' - + ! ')
      expect(result).toEqual([])
    })
    test('single word term', () => {
      const result = normaliseSearchTerms('xxx')
      expect(result).toEqual(['xxx'])
    })
    test('domain twitter.com', () => {
      const result = normaliseSearchTerms('twitter.com')
      expect(result).toEqual(['twitter.com'])
    })
    test('xxx yyy', () => {
      const result = normaliseSearchTerms('xxx yyy')
      expect(result).toEqual(['xxx', 'yyy'])
    })
    test('#hashtag #hashtag/child @mention @run(5)', () => {
      const result = normaliseSearchTerms('#hashtag #hashtag/child @mention @run(5)')
      expect(result).toEqual(['#hashtag', '#hashtag/child', '@mention', '@run(5)'])
    })
    test('xxx OR yyy', () => {
      const result = normaliseSearchTerms('xxx OR yyy')
      expect(result).toEqual(['xxx', 'yyy'])
    })
    test('xxx OR yyy OR zzz', () => {
      const result = normaliseSearchTerms('xxx OR yyy OR zzz')
      expect(result).toEqual(['xxx', 'yyy', 'zzz'])
    })
    test('xxx, yyy', () => {
      const result = normaliseSearchTerms('xxx, yyy')
      expect(result).toEqual(['xxx', 'yyy'])
    })
    test('xxx,yyy, zzz', () => {
      const result = normaliseSearchTerms('xxx,yyy, zzz')
      expect(result).toEqual(['xxx', 'yyy', 'zzz'])
    })
    test('xxx AND yyy', () => {
      const result = normaliseSearchTerms('xxx AND yyy')
      expect(result).toEqual(['+xxx', '+yyy'])
    })
    test('xxx AND yyy AND z', () => {
      const result = normaliseSearchTerms('xxx AND yyy AND zzz')
      expect(result).toEqual(['+xxx', '+yyy', '+zzz'])
    })
    test('"1 John", 1Jn (do not modify)', () => {
      const result = normaliseSearchTerms('"1 John" 1Jn')
      expect(result).toEqual(['1 John', '1Jn'])
    })
    test("mix of quoted and unquoted terms (don't modify)", () => {
      const result = normaliseSearchTerms('-term1 "term two" !term3')
      expect(result).toEqual(['-term1', 'term two', '!term3'])
    })
    test("quoted terms with different must/may/cant (don't modify)", () => {
      const result = normaliseSearchTerms('-"Bob Smith" "Holy Spirit" !"ice cream cone"')
      expect(result).toEqual(['-Bob Smith', 'Holy Spirit', '!ice cream cone'])
    })
    test("terms with apostrophes in quoted terms (don't modify)", () => {
      const result = normaliseSearchTerms('-term1 "couldn\'t possibly" !term3')
      expect(result).toEqual(['-term1', "couldn't possibly", '!term3'])
    })
    test('terms with apostrophes in unquoted terms', () => {
      const result = normaliseSearchTerms("can't term2")
      expect(result).toEqual(["can't", 'term2'])
    })
    test("mix of quoted and unquoted terms (don't modify)", () => {
      const result = normaliseSearchTerms(`bob "xxx" 'yyy' "asd'sa" 'bob two' "" hello`)
      expect(result).toEqual(['bob', 'xxx', "'yyy'", "asd'sa", "'bob", "two'", 'hello'])
    })
    test("mix of quoted and unquoted terms and operators (don't modify)", () => {
      const result = normaliseSearchTerms('+bob "xxx" \'yyy\' !"asd\'sa" -"bob two" "" !hello')
      expect(result).toEqual(['+bob', 'xxx', "'yyy'", "!asd'sa", "-bob two", '!hello'])
    })
    test("test for Greek characters", () => {
      const result = normaliseSearchTerms('γιάννης')
      expect(result).toEqual(['γιάννης'])
    })
    test("mix of terms with ? and * operators (this is just normalising not validating)", () => {
      const result = normaliseSearchTerms('spirit* mo? *term mo*blues ?weird')
      expect(result).toEqual(['spirit*', 'mo?', '*term', 'mo*blues', '?weird'])
    })

    describe('skipping these tests as removed modifyQuotedTermsToAndedTerms functionality', () => {
      test.skip('"1 John", 1Jn (do modify)', () => {
        const result = normaliseSearchTerms('"1 John" 1Jn', true)
        expect(result).toEqual(['+1', '+John', '1Jn'])
      })
      test.skip('mix of quoted and unquoted terms (do modify)', () => {
        const result = normaliseSearchTerms('-term1 "term two" !term3', true)
        expect(result).toEqual(['-term1', '+term', '+two', '!term3'])
      })
      test.skip('terms with apostrophes in quoted terms (do modify)', () => {
        const result = normaliseSearchTerms('-term1 "couldn\'t possibly" !term3', true)
        expect(result).toEqual(['-term1', "+couldn't", '+possibly', '!term3'])
      })
      test.skip('mix of quoted and unquoted terms (do modify)', () => {
        const result = normaliseSearchTerms(`bob "xxx" 'yyy' "asd'sa" 'bob two' "" hello`, true)
        expect(result).toEqual(['bob', 'xxx', 'yyy', "asd'sa", '+bob', '+two', 'hello'])
      })
      test.skip('mix of quoted and unquoted terms and operators (do modify)', () => {
        const result = normaliseSearchTerms('+bob "xxx",\'yyy\', !"asd\'sa" -\'bob two\' "" !hello', true)
        expect(result).toEqual(['+bob', 'xxx', "'yyy'", "!asd'sa", '-bob', 'two', '!hello'])
      })
    })
  })

  describe('validateAndTypeSearchTerms', () => {
    test('should return empty array from empty input (empty not allowed)', () => {
      const result = validateAndTypeSearchTerms('', false)
      expect(result).toEqual([]) // and an error
    })
    test('should return empty array from empty input (empty allowed)', () => {
      const result = validateAndTypeSearchTerms('', true)
      expect(result).toEqual([
        { term: '', type: 'must', termRep: '<empty>' }
      ])
    })
    test('should return empty array from too many terms', () => {
      const result = validateAndTypeSearchTerms('abc def ghi jkl mno pqr stu vwz nine ten')
      expect(result).toEqual([])
    })
    test('should return empty array from no positive terms', () => {
      const result = validateAndTypeSearchTerms('-term1 -term2 -term3')
      expect(result).toEqual([])
    })
    test("single term string 'term1'", () => {
      const result = validateAndTypeSearchTerms('term1')
      expect(result).toEqual([
        { term: 'term1', type: 'may', termRep: 'term1' }
      ])
    })
    test("single term string 'twitter.com'", () => {
      const result = validateAndTypeSearchTerms('twitter.com')
      expect(result).toEqual([{ term: 'twitter.com', type: 'may', termRep: 'twitter.com' }])
    })
    test("quoted string with apostrophe [shouldn't matter]", () => {
      const result = validateAndTypeSearchTerms('"shouldn\'t matter"')
      expect(result).toEqual([
        { term: "shouldn't matter", type: 'may', termRep: "shouldn't matter" },
      ])
    })
    test('two term string', () => {
      const result = validateAndTypeSearchTerms('term1 "term two"')
      expect(result).toEqual([
        { term: 'term1', type: 'may', termRep: 'term1' },
        { term: 'term two', type: 'may', termRep: 'term two' },
      ])
    })
    test('three terms with [+,-,]', () => {
      const result = validateAndTypeSearchTerms('+term1 "term two" -term3')
      expect(result).toEqual([
        { term: 'term1', type: 'must', termRep: '+term1' },
        { term: 'term two', type: 'may', termRep: 'term two' },
        { term: 'term3', type: 'not-line', termRep: '-term3' },
      ])
    })
    test('three terms with [+,!,]', () => {
      const result = validateAndTypeSearchTerms('+term1 "term two" !term3')
      expect(result).toEqual([
        { term: 'term1', type: 'must', termRep: '+term1' },
        { term: 'term two', type: 'may', termRep: 'term two' },
        { term: 'term3', type: 'not-note', termRep: '!term3' },
      ])
    })
    test('+"1 John", 1Jn', () => {
      const result = validateAndTypeSearchTerms('+"1 John" 1Jn')
      expect(result).toEqual([
        { term: '1 John', type: 'must', termRep: '+1 John' },
        { term: '1Jn', type: 'may', termRep: '1Jn' },
      ])
    })
    test("quoted terms with different must/may/cant", () => {
      const result = validateAndTypeSearchTerms('-"Bob Smith" "Holy Spirit" !"ice cream cone"')
      expect(result).toEqual([
        { term: 'Bob Smith', type: 'not-line', termRep: '-Bob Smith' },
        { term: 'Holy Spirit', type: 'may', termRep: 'Holy Spirit' },
        { term: 'ice cream cone', type: 'not-note', termRep: '!ice cream cone' }])
    })
    test("mix of terms with valid ? and * operators", () => {
      const result = validateAndTypeSearchTerms('spirit* mo?t +term mo*blues we*d')
      expect(result).toEqual([
        { term: 'spirit*', type: 'may', termRep: 'spirit*' },
        { term: 'mo?t', type: 'may', termRep: 'mo?t' },
        { term: 'term', type: 'must', termRep: '+term' },
        { term: 'mo*blues', type: 'may', termRep: 'mo*blues' },
        { term: 'we*d', type: 'may', termRep: 'we*d' }])
    })
    test("mix of terms with invalid ? and * operators", () => {
      const result = validateAndTypeSearchTerms('*spirit ?moses we*d')
      expect(result).toEqual([
        { term: 'we*d', type: 'may', termRep: 'we*d' }
      ])
    })
  })

  // Just a no-result test -- rest too hard to mock up
  describe('createFormattedResultLines', () => {
    test('for empty result', () => {
      const resultSet: resultOutputTypeV3 = {
        searchTermsRepArr: ['TERM1', '-TERM2'],
        resultNoteAndLineArr: [],
        resultCount: 0,
        resultNoteCount: 0,
        fullResultCount: 0,
      }
      const config: $Shape<SearchConfig> = {
        resultStyle: 'NotePlan',
        headingLevel: 2,
        groupResultsByNote: true,
        highlightResults: true,
        resultPrefix: '- ',
        resultQuoteLength: 120,
        dateStyle: 'date',
      }
      const result = createFormattedResultLines(resultSet, config)
      expect(result).toEqual([])
    })
  })
})

// ----------------------------------
// Removed, as this is no longer used, and relied on state of file at 0.5.0-beta4
// describe('differenceByInnerArrayLine()', () => {
//   test('should return empty array, from empty input1', () => {
//     const result = differenceByInnerArrayLine([], notArr)
//     expect(result).toEqual([])
//   })
//   test('should return input array, from empty exclude', () => {
//     const result = differenceByInnerArrayLine(mayArr, [])
//     expect(result).toEqual(mayArr)
//   })

//   // Removed, as this is no longer used
//   test('should return wider (line) diff of mayArr, notArr (using noteFilename)', () => {
//     const diffArr: Array<noteAndLines> = [ // *lines* with TERM1 but not TERM2
//       { noteFilename: 'file2', lines: ['2.2 includes TERM1 only'] },
//       { noteFilename: 'file3', lines: ['3.1 boring but has TERM1'] },
//       { noteFilename: 'file5', lines: ['5.1 includes TERM1'] },
//       { noteFilename: 'file6', lines: ['6.1 includes TERM1', '6.4 TERM3 has gone "(*$&(*%^" and with TERM1'] },
//       { noteFilename: 'file7', lines: ['7.1 (W£%&W(*%&)) TERM1', '7.2 has TERM1'] },
//     ]
//     const result = differenceByInnerArrayLine(mayArr, notArr)
//     // clo(result, 'test result for TERM1 but not TERM2')
//     expect(result).toEqual(diffArr)
//   })

//   test('should return wider (line) diff of mustArr, notArr (using noteFilename)', () => {
//     const diffArr: Array<noteAndLines> = [ // *lines* with TERM3 but not TERM2
//       { noteFilename: 'file4', lines: ['4.2 includes TERM3', '4.3 also has TERM3'] },
//       { noteFilename: 'file5', lines: ['5.2 includes TERM3'] },
//       { noteFilename: 'file6', lines: ['6.3 has TERM3', '6.4 TERM3 has gone "(*$&(*%^" and with TERM1'] },
//       { noteFilename: 'file7', lines: ['7.3 has TERM3'] },
//     ]
//     const result = differenceByInnerArrayLine(mustArr, notArr)
//     // clo(result, 'test result for TERM3 but not TERM2')
//     expect(result).toEqual(diffArr)
//   })
// })
