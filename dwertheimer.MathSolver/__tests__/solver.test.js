// Jest testing docs: https://jestjs.io/docs/using-matchers
/* global describe, expect, test  */

import * as s from '../src/support/solver'

describe('dwertheimer.MathSolver' /* pluginID */, () => {
  describe('support/solver' /* file */, () => {
    /*
     * parse()
     */
    describe('parse' /* function */, () => {
      // Note s.parse() returns CurrentData types (see solver.js)
      test('should ignore full line # comments', () => {
        const str = '# comment'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.expressions).toEqual(['0'])
        expect(result.variables).toEqual({ R0: 0 })
        expect(result.info[0].typeOfResult).toEqual('H')
      })
      test('should ignore comments in a line', () => {
        const str = '3+2 # comment'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.expressions).toEqual(['3+2'])
        expect(result.variables).toEqual({ R0: 5 })
        expect(result.info[0].typeOfResult).toEqual('N')
      })
      test('should remove comment text after //', () => {
        const str = '4+5 // comment'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.expressions).toEqual(['4+5'])
        //FIXME: relations comes back (4) ['', '', '', ''] -- is this correct?
      })
      test('should set a single number', () => {
        const str = '4'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables).toEqual({ R0: 4 })
      })
      test('should parse one row of basic addition', () => {
        const str = '4 + 2'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables).toEqual({ R0: 6 })
      })
      test('should parse one row of basic subtraction', () => {
        const str = '4 - 2'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables).toEqual({ R0: 2 })
      })
      test('should parse one row of basic multiplication', () => {
        const str = '33*3'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables).toEqual({ R0: 99 })
      })
      test('should parse one row of basic division', () => {
        const str = '4 / 2'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables).toEqual({ R0: 2 })
      })
      test('should work for k (=1000)', () => {
        const str = '4k'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables['R0']).toEqual(4000)
      })
      test('should work for M (=1000000)', () => {
        const str = '4M'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables['R0']).toEqual(4 * 1000000)
      })
      test.skip('should understand dollars (math.js doesnt appear to)', () => {
        const str = '$4'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result?.variables['R0']).toEqual(4)
      })
      test.skip('math addition should work for dollars', () => {
        const str = '$4 + $20.20'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables['R0']).toEqual(24.2)
      })
      test('should work for percentages 10%', () => {
        const str = '10%'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables['R0']).toEqual(0.1)
      })
      test('should work for +10%', () => {
        const str = '10 + 10%'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables['R0']).toEqual(11)
      })
      test('should work for -10%', () => {
        const str = '10 - 10%'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables['R0']).toEqual(9)
      })
      test('should work for x as % of a number', () => {
        const str = '20 as a % of 1000'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables['R0']).toEqual(0.02)
      })
      test('should work for x as % of a number', () => {
        const str = '20 as % of 1000'
        const currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const result = s.parse(str, 0, currentData)
        expect(result.variables['R0']).toEqual(0.02)
      })
      test('should assign variable', () => {
        const str = 'varname = 4 + 2'
        const currentData = {
          info: [],
          variables: {},
          relations: [],
          expressions: [],
          rows: 1,
        }
        const result = s.parse(str, 0, currentData)
        //     Received: {"expressions": ["varname = 4 + 2"], "info": [{"row": 0, "typeOfResult": "A", "typeOfResultFormat": "N"}], "relations": [["varname"]], "variables": {"R0": 6, "varname": 6},rows:1}
        expect(result.expressions).toEqual([str])
        expect(result.variables).toEqual({ R0: 6, varname: 6 })
        expect(result.info[0].typeOfResult).toEqual('A')
      })
      test('should ignore an assignment without two sides', () => {
        const str = 'varname = '
        const currentData = {
          info: [],
          variables: {},
          relations: [],
          expressions: [],
          rows: 1,
        }
        const result = s.parse(str, 0, currentData)
        //     Received: {"expressions": ["varname = 4 + 2"], "info": [{"row": 0, "typeOfResult": "A", "typeOfResultFormat": "N"}], "relations": [["varname"]], "variables": {"R0": 6, "varname": 6},rows:1}
        expect(result.expressions).toEqual(['0'])
        expect(result.variables).toEqual({ R0: 0 })
        expect(result.info[0].typeOfResult).toEqual('H')
      })
      test('should assign a subtotal to a variable', () => {
        const str = 'myVar = subtotal'
        const currentData = { expressions: ['2+2'], info: [{ row: 0, typeOfResult: 'N', typeOfResultFormat: 'N' }], relations: [[null]], variables: { R0: 4 }, rows: 2 }
        const result = s.parse(str, 1, currentData)
        expect(result.variables).toEqual({ R0: 4, R1: 4, myVar: 4 })
      })
      test('should assign a subtotal to a variable and not double count it', () => {
        const str = 'myVar = subtotal'
        let currentData = { expressions: ['2+2'], info: [{ row: 0, typeOfResult: 'N', typeOfResultFormat: 'N' }], relations: [[null]], variables: { R0: 4 }, rows: 2 }
        currentData = s.parse(str, 1, currentData)
        const result = s.parse('total', 2, currentData)
        expect(result.variables).toEqual({ R0: 4, R1: 4, R2: 4, myVar: 4 })
      })
      test('should work as expected for someone who mistakenly inputs total=a+b', () => {
        const str = 'total = temp'
        let currentData = { expressions: ['temp = 2'], info: [{ row: 0, typeOfResult: 'N', typeOfResultFormat: 'N' }], relations: [[null]], variables: { R0: 2, temp: 2 }, rows: 2 }
        currentData = s.parse(str, 1, currentData)
        expect(currentData.variables).toEqual({ R0: 2, R1: 2, temp: 2, total: 2 })
      })
      test('should work as expected for someone who mistakenly inputs total=a+b', () => {
        const str = 'total = temp + 2'
        let currentData = { expressions: ['temp = 2'], info: [{ row: 0, typeOfResult: 'N', typeOfResultFormat: 'N' }], relations: [[null]], variables: { R0: 2, temp: 2 }, rows: 2 }
        currentData = s.parse(str, 1, currentData)
        expect(currentData.variables).toEqual({ R0: 2, R1: 4, temp: 2, total: 4 })
      })
      test('should add two lines properly', () => {
        const str = 'varname + 99'
        const currentData = {
          expressions: ['varname = 4 + 2'],
          info: [{ row: 0, typeOfResult: 'A', typeOfResultFormat: 'N' }],
          relations: [['varname']],
          variables: { R0: 6, varname: 6 },
          rows: 2,
        }
        const result = s.parse(str, 1, currentData)
        expect(result.expressions).toEqual(['varname = 4 + 2', 'varname + 99'])
        expect(result.variables).toEqual({ R0: 6, R1: 105, varname: 6 })
        expect(result.relations).toEqual([['varname'], ['varname']])
      })
      test('should subtotal', () => {
        const str = 'subtotal'
        const currentData = {
          expressions: ['varname = 4 + 2'],
          info: [{ row: 0, typeOfResult: 'A', typeOfResultFormat: 'N' }],
          relations: [['varname']],
          variables: { R0: 6, varname: 6 },
          rows: 2,
        }
        const result = s.parse(str, 1, currentData)
        expect(result.expressions).toEqual(['varname = 4 + 2', '0'])
        expect(result.variables).toEqual({ R0: 6, R1: 0, varname: 6 })
        expect(result.info[1].typeOfResult).toEqual('S')
        expect(result.relations).toEqual([['varname'], null])
      })
      test('should subtotal in caps (case insensitive)', () => {
        const str = 'SubTotal'
        const currentData = {
          expressions: ['varname = 4 + 2'],
          info: [{ row: 0, typeOfResult: 'A', typeOfResultFormat: 'N' }],
          relations: [['varname']],
          variables: { R0: 6, varname: 6 },
          rows: 2,
        }
        const result = s.parse(str, 1, currentData)
        expect(result.expressions).toEqual(['varname = 4 + 2', '0'])
        expect(result.variables).toEqual({ R0: 6, R1: 0, varname: 6 })
        expect(result.info[1].typeOfResult).toEqual('S')
        expect(result.relations).toEqual([['varname'], null])
      })
      test('should total in caps (case insensitive)', () => {
        const str = 'TOTAL:'
        const currentData = {
          expressions: ['varname = 4 + 2'],
          info: [{ row: 0, typeOfResult: 'A', typeOfResultFormat: 'N' }],
          relations: [['varname']],
          variables: { R0: 6, varname: 6 },
          rows: 2,
        }
        const result = s.parse(str, 1, currentData)
        expect(result.expressions).toEqual(['varname = 4 + 2', '0'])
        expect(result.variables).toEqual({ R0: 6, R1: 0, varname: 6 })
        expect(result.info[1].typeOfResult).toEqual('T')
        expect(result.relations).toEqual([['varname'], null])
      })
      test('should create relations of dependent variables (assignment)', () => {
        const str = 'secondVar = varname + 99'
        const currentData = {
          expressions: ['varname = 4 + 2'],
          info: [{ row: 0, typeOfResult: 'A', typeOfResultFormat: 'N' }],
          relations: [['varname']],
          variables: { R0: 6, varname: 6 },
          rows: 2,
        }
        const result = s.parse(str, 1, currentData)
        expect(result.expressions).toEqual([currentData.expressions[0], str])
        expect(result.variables).toEqual({ R0: 6, R1: 105, secondVar: 105, varname: 6 })
        expect(result.relations).toEqual([['varname'], ['secondVar', 'varname']])
      })
      test('should create relations of dependent variables (assignment)', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const severalLines = ['foo = 2', 'bar = 5', '3', 'subtotal', 'foo + bar + 16', 'sam = 9', 'total']
        for (let i = 0; i < severalLines.length; i++) {
          const line = severalLines[i]
          currentData.rows = i + 1
          currentData = s.parse(line, i, currentData)
        }
        expect(currentData.variables['R6']).toEqual(26)
      })
      test('should add all rows with no assignments', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const severalLines = ['1', '2', '3', '4', '5', 'total']
        for (let i = 0; i < severalLines.length; i++) {
          const line = severalLines[i]
          currentData.rows = i + 1
          currentData = s.parse(line, i, currentData)
        }
        expect(currentData.variables['R5']).toEqual(15)
      })
      test('subtotal and total should both work', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const severalLines = ['1', '2', 'subtotal', '4', '5', 'total']
        for (let i = 0; i < severalLines.length; i++) {
          const line = severalLines[i]
          currentData.rows = i + 1
          currentData = s.parse(line, i, currentData)
        }
        expect(currentData.variables['R2']).toEqual(3)
        expect(currentData.variables['R5']).toEqual(12)
      })
      test('should remove all irrelevant text', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [], rows: 1 }
        const string = '4 for books + 6 for bees'
        currentData = s.parse(string, 0, currentData)
        expect(currentData.info[0].expression).toEqual('4 + 6')
        expect(currentData.variables['R0']).toEqual(10)
      })
      test('should not produce error on colon text', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [], rows: 1 }
        const string = 'books:'
        currentData = s.parse(string, 0, currentData)
        expect(currentData.info[0].error.length).toEqual(0)
      })
      test('should do the right thing for multi-line with bad data in the middle', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const severalLines = ['1', '2', 'bogus text', '4', '5', 'total']
        for (let i = 0; i < severalLines.length; i++) {
          const line = severalLines[i]
          currentData.rows = i + 1
          currentData = s.parse(line, i, currentData)
        }
        expect(currentData.variables['R5']).toEqual(12)
      })
      test('should work with multiple subtotals', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const severalLines = ['1', '2', 'subtotal', '4', '5', 'subtotal', 'total']
        for (let i = 0; i < severalLines.length; i++) {
          const line = severalLines[i]
          currentData.rows = i + 1
          currentData = s.parse(line, i, currentData)
        }
        expect(currentData.variables['R2']).toEqual(3)
        expect(currentData.variables['R5']).toEqual(9)
        expect(currentData.variables['R6']).toEqual(12)
      })
      test('should work with total in the middle - total basically works like a subtotal in the same block', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const severalLines = ['1', '2', 'total', '4', '5', 'subtotal', 'total']
        for (let i = 0; i < severalLines.length; i++) {
          const line = severalLines[i]
          currentData.rows = i + 1
          currentData = s.parse(line, i, currentData)
        }
        expect(currentData.variables['R2']).toEqual(3)
        expect(currentData.variables['R5']).toEqual(9)
        expect(currentData.variables['R6']).toEqual(12)
      })
      test('comment in the middle does not stop the count', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const severalLines = ['a=1', '2', '# comment', '4+a', '5', 'subtotal', 'total']
        for (let i = 0; i < severalLines.length; i++) {
          const line = severalLines[i]
          currentData.rows = i + 1
          currentData = s.parse(line, i, currentData)
        }
        expect(currentData.variables['R2']).toEqual(0)
        expect(currentData.variables['R5']).toEqual(12)
        expect(currentData.variables['R6']).toEqual(12)
      })
      test('basic multi-line addition should total', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const severalLines = ['1', '2', 'text something: 3', '4', '5', 'total']
        for (let i = 0; i < severalLines.length; i++) {
          const line = severalLines[i]
          currentData.rows = i + 1
          currentData = s.parse(line, i, currentData)
        }
        expect(currentData.variables['R5']).toEqual(15)
      })
      test('medium complex math from math.js docs should work', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const severalLines = ['a = 1.2 * (2 + 4.5)', 'a / 2', '5.08 cm in inch', 'sin(45 deg) ^ 2', '9 / 3 + 2i', 'b = [-1, 2; 3, 1]', 'det(b)']
        for (let i = 0; i < severalLines.length; i++) {
          const line = severalLines[i]
          currentData.rows = i + 1
          currentData = s.parse(line, i, currentData)
        }
        expect(currentData.variables['R5'].size()).toEqual([2, 2])
      })
      test('should produce syntax error on nonsense statement', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const severalLines = ['2 4 6']
        for (let i = 0; i < severalLines.length; i++) {
          const line = severalLines[i]
          currentData.rows = i + 1
          currentData = s.parse(line, i, currentData)
        }
        expect(currentData.info[0].error).toMatch(/Syntax/)
      })
      test('should subtotal properly when there are subtotal assignments', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const severalLines = ['Quickbooks: 300','myVar = subtotal','subtotal','Frogs = 22','subtotal','stuff = 2 + Frogs','1*1','total','stuff']
        for (let i = 0; i < severalLines.length; i++) {
          const line = severalLines[i]
          currentData.rows = i + 1
          currentData = s.parse(line, i, currentData)
        }
        expect(currentData.info[2].lineValue).toEqual(0) //'subtotal' there was just a subtotal assignment, so an immediate following subtotal should be zero
        expect(currentData.info[4].lineValue).toEqual(0) //'subtotal' subtotal should only count from the previous subtotal
        expect(currentData.info[5].lineValue).toEqual(24) //'stuff = 2 + Frogs' variable addition/assign should not affect total
        expect(currentData.info[7].lineValue).toEqual(301) //'total' total should single-count the numbers
        expect(currentData.info[8].lineValue).toEqual(24) //'stuff' previous assignment should still be true
      })
      test('should ignore nonsense statements and continue processing', () => {
        let currentData = { info: [], variables: {}, relations: [], expressions: [] }
        const severalLines = ['2 4 6', '2+2']
        for (let i = 0; i < severalLines.length; i++) {
          const line = severalLines[i]
          currentData.rows = i + 1
          currentData = s.parse(line, i, currentData)
        }
        expect(currentData.info[1].error).toEqual("")
      })
    })

    /*
     * removeTextPlusColon()
     */
    describe('removeTextPlusColon()' /* function */, () => {
      test('should do nothing if no colon', () => {
        const result = s.removeTextPlusColon(`should do nothing here`)
        expect(result).toEqual(`should do nothing here`)
      })
      test('should remove basic word:', () => {
        const result = s.removeTextPlusColon(`should:`)
        expect(result).toEqual(``)
      })
      test('should remove multiple words:', () => {
        const result = s.removeTextPlusColon(` should remove all this:`)
        expect(result).toEqual(``)
      })
      test('should leave the rest:', () => {
        const result = s.removeTextPlusColon(`should remove all this:2`)
        expect(result).toEqual(`2`)
      })
      test('should ignore subtotal:', () => {
        const result = s.removeTextPlusColon(`subtotal:`)
        expect(result).toEqual(`subtotal:`)
      })
      test('should ignore total:', () => {
        const result = s.removeTextPlusColon(`total:`)
        expect(result).toEqual(`total:`)
      })
    })
    /*
     * removeParentheticals()
     */
    describe('removeParentheticals()' /* function */, () => {
      test('should find and remove quoted in middle', () => {
        const input = 'this is "quoted" string'
        const result = s.removeParentheticals(input)[1]
        expect(result).toEqual('this is string')
      })
      test('should find and remove bracketed in middle', () => {
        const input = 'this is {quoted} string'
        const result = s.removeParentheticals(input)[1]
        expect(result).toEqual('this is string')
      })
      test('should find and remove multiple items in a line', () => {
        const input = 'this is {quoted} string and "quoted"'
        const result = s.removeParentheticals(input)[1]
        expect(result).toEqual('this is string and')
      })
      test('should remove spaces at front and end', () => {
        const input = ' {this} is string and "quoted" '
        const result = s.removeParentheticals(input)[1]
        expect(result).toEqual('is string and')
      })
      test('should return the found part(s) as the first var in the tuple (type Array)', () => {
        const input = ' {this} is string and "quoted"'
        const result = s.removeParentheticals(input)[0]
        expect(result[0]).toEqual('this')
        expect(result[1]).toEqual('quoted')
      })
    })
  })
})
