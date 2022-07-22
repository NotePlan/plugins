// @flow
/* global describe, expect, test */
import {
  type noteAndLines,
  type resultObjectTypeV2,
  type resultOutputType,
  type typedSearchTerm,
  applySearchOperators,
  differenceByPropVal,
  differenceByInnerArrayLine,
} from '../src/searchHelpers'
import { JSP, clo } from '../../helpers/dev'

const searchTerms: Array<typedSearchTerm> = [
  { term: 'TERM1', type: 'may', termRep: 'TERM1' },
  { term: 'TERM2', type: 'not-line', termRep: '-TERM2' },
  { term: 'TERM3', type: 'must', termRep: '+TERM3' },
  { term: 'TERM2', type: 'not-note', termRep: '!TERM2' }, // alternative of 2nd one that is more restrictive
]

const mayArr: Array<noteAndLines> = [ // lines with TERM1
  { noteFilename: 'file1', lines: ['1.1 includes TERM1 and TERM2', '1.2 includes TERM1 and TERM2 again'] },
  { noteFilename: 'file2', lines: ['2.1 includes TERM1 and TERM2', '2.2 includes TERM1 only'] },
  { noteFilename: 'file3', lines: ['3.1 boring but has TERM1'] },
  { noteFilename: 'file5', lines: ['5.1 includes TERM1'] },
  { noteFilename: 'file6', lines: ['6.1 includes TERM1', '6.4 TERM3 has gone "(*$&(*%^" and with TERM1'] },
  { noteFilename: 'file7', lines: ['7.1 (W£%&W(*%&)) TERM1', '7.2 has TERM1'] },
]
// clo(mayArr, 'mayArr:')

const notArr: Array<noteAndLines> = [ // lines with TERM2
  { noteFilename: 'file1', lines: ['1.1 includes TERM1 and TERM2', '1.2 includes TERM1 and TERM2 again'] },
  { noteFilename: 'file2', lines: ['2.1 includes TERM1 and TERM2', '2.3 just TERM2 to avoid'] },
  { noteFilename: 'file4', lines: ['4.1 includes TERM2'] },
  { noteFilename: 'file6', lines: ['6.2 has TERM2'] },
]
// clo(notArr, 'notArr:')

const mustArr: Array<noteAndLines> = [ // lines with TERM3
  { noteFilename: 'file4', lines: ['4.2 includes TERM3', '4.3 also has TERM3'] },
  { noteFilename: 'file5', lines: ['5.2 includes TERM3'] },
  { noteFilename: 'file6', lines: ['6.3 has TERM3', '6.4 TERM3 has gone "(*$&(*%^" and with TERM1'] },
  { noteFilename: 'file7', lines: ['7.3 has TERM3'] },
]
// clo(mustArr, 'mustArr:')

describe('searchHelpers.js tests', () => {

  describe('differenceByInnerArrayLine()', () => {
    test('should return empty array, from empty input1', () => {
      const result = differenceByInnerArrayLine([], notArr)
      expect(result).toEqual([])
    })
    test('should return input array, from empty exclude', () => {
      const result = differenceByInnerArrayLine(mayArr, [])
      expect(result).toEqual(mayArr)
    })

    test('should return wider (line) diff of mayArr, notArr (using noteFilename)', () => {
      const diffArr: Array<noteAndLines> = [ // *lines* with TERM1 but not TERM2
        { noteFilename: 'file2', lines: ['2.2 includes TERM1 only'] },
        { noteFilename: 'file3', lines: ['3.1 boring but has TERM1'] },
        { noteFilename: 'file5', lines: ['5.1 includes TERM1'] },
        { noteFilename: 'file6', lines: ['6.1 includes TERM1', '6.4 TERM3 has gone "(*$&(*%^" and with TERM1'] },
        { noteFilename: 'file7', lines: ['7.1 (W£%&W(*%&)) TERM1', '7.2 has TERM1'] },
      ]
      const result = differenceByInnerArrayLine(mayArr, notArr)
      // clo(result, 'test result for TERM1 but not TERM2')
      expect(result).toEqual(diffArr)
    })

    test('should return wider (line) diff of mustArr, notArr (using noteFilename)', () => {
      const diffArr: Array<noteAndLines> = [ // *lines* with TERM3 but not TERM2
        { noteFilename: 'file4', lines: ['4.2 includes TERM3', '4.3 also has TERM3'] },
        { noteFilename: 'file5', lines: ['5.2 includes TERM3'] },
        { noteFilename: 'file6', lines: ['6.3 has TERM3', '6.4 TERM3 has gone "(*$&(*%^" and with TERM1'] },
        { noteFilename: 'file7', lines: ['7.3 has TERM3'] },
      ]
      const result = differenceByInnerArrayLine(mustArr, notArr)
      // clo(result, 'test result for TERM3 but not TERM2')
      expect(result).toEqual(diffArr)
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
      const diffArr: Array<noteAndLines> = [ // *notes* with TERM1 but not TERM2
        { noteFilename: 'file3', lines: ['3.1 boring but has TERM1'] },
        { noteFilename: 'file5', lines: ['5.1 includes TERM1'] },
        { noteFilename: 'file7', lines: ['7.1 (W£%&W(*%&)) TERM1', '7.2 has TERM1'] },
      ]
      const result = differenceByPropVal(mayArr, notArr, 'noteFilename')
      // clo(result, 'test result for TERM1 but not TERM2')
      expect(result).toEqual(diffArr)
    })
    test('should return narrower (note) diff of mustArr, notArr (using noteFilename)', () => {
      const diffArr: Array<noteAndLines> = [ // *notes* with TERM3 but not TERM2
        { noteFilename: 'file5', lines: ['5.2 includes TERM3'] },
        { noteFilename: 'file7', lines: ['7.3 has TERM3'] },
      ]
      const result = differenceByPropVal(mustArr, notArr, 'noteFilename')
      // clo(result, 'test result for TERM3 but not TERM2')
      expect(result).toEqual(diffArr)
    })
  })

  describe('applySearchOperators(termsResults: Array<resultObjectTypeV2>, operateOnWholeNote: boolean): resultObjectType', () => {
    // clo(combinedResults, 'combinedResults: ')

    test('should return narrower !term results', () => {
      // For TERM1, -TERM2, +TERM3
      const combinedResults: Array<resultObjectTypeV2> = [
        { searchTerm: searchTerms[0], resultNoteAndLines: mayArr, resultCount: 1 },
        { searchTerm: searchTerms[3], resultNoteAndLines: notArr, resultCount: 2 }, // the !TERM2 alternative
        { searchTerm: searchTerms[2], resultNoteAndLines: mustArr, resultCount: 4 },
      ]
      const expectedNoteBasedOutput: resultOutputType = { // For TERM1, -TERM2, +TERM3 matching *notes*
        searchTermsRep: "TERM1 !TERM2 +TERM3",
        resultNoteAndLines: [
          { noteFilename: 'file5', lines: ['5.1 includes TERM1', '5.2 includes TERM3'] },
          { noteFilename: 'file7', lines: ['7.1 (W£%&W(*%&)) TERM1', '7.2 has TERM1', '7.3 has TERM3'] },
        ],
        resultCount: 4,
      }
      const result = applySearchOperators(combinedResults)
      clo(result, 'note-based test result for TERM1, -TERM2, +TERM3')
      expect(result).toEqual(expectedNoteBasedOutput)
    })

    test('should return wider -term results', () => {
      // For TERM1, -TERM2, +TERM3
      const combinedResults: Array<resultObjectTypeV2> = [
        { searchTerm: searchTerms[0], resultNoteAndLines: mayArr, resultCount: 1 },
        { searchTerm: searchTerms[1], resultNoteAndLines: notArr, resultCount: 2 },
        { searchTerm: searchTerms[2], resultNoteAndLines: mustArr, resultCount: 4 },
      ]
      const expectedLineBasedOutput: resultOutputType = { // For TERM1, -TERM2, +TERM3 matching *lines*
        searchTermsRep: "TERM1 -TERM2 +TERM3",
        resultNoteAndLines: [
          { noteFilename: 'file4', lines: ['4.2 includes TERM3', '4.3 also has TERM3'] },
          { noteFilename: 'file5', lines: ['5.1 includes TERM1', '5.2 includes TERM3'] },
          { noteFilename: 'file6', lines: ['6.1 includes TERM1', '6.3 has TERM3', '6.4 TERM3 has gone "(*$&(*%^" and with TERM1'] },
          { noteFilename: 'file7', lines: ['7.1 (W£%&W(*%&)) TERM1', '7.2 has TERM1', '7.3 has TERM3'] }
        ],
        resultCount: 10,
      }
      const result = applySearchOperators(combinedResults)
      clo(result, 'line-based test result for TERM1, -TERM2, +TERM3')
      expect(result).toEqual(expectedLineBasedOutput)
    })
  })

})
