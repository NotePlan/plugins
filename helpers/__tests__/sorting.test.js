/* globals describe, expect, it, test */
import { _ } from 'lodash'
import * as s from '../sorting'

// Jest suite
describe('paragraphDetail', () => {
  test('dwertheimer.sorting - firstValue ', () => {
    expect(s.firstValue('string')).toEqual('string')
  })
  test('dwertheimer.sorting - firstValue ', () => {
    expect(s.firstValue('StrinG')).toEqual('string')
  })
  test('dwertheimer.sorting - firstValue ', () => {
    expect(s.firstValue(['StrinG', 'foo'])).toEqual('string')
  })
  test('dwertheimer.sorting - firstValue ', () => {
    expect(s.firstValue(99)).toEqual(99)
  })

  // indirectly testing fieldSorter which is hard to
  // test because it returns a function
  test('dwertheimer.sorting - sortListBy ', () => {
    const list = [
      { propA: 10, propB: 0 },
      { propA: 0, propB: 4 },
      { propA: 5, propB: 10 },
      { propA: 0, propB: 0 },
      { propA: 6 },
      { propB: 7 },
    ]
    const immutableOrigList = _.cloneDeep(list)
    // sort by propA (string, not array)
    let sorted = s.sortListBy(list, 'propA')
    expect(sorted[0]).toEqual(immutableOrigList[1])
    expect(sorted[2]).toEqual(immutableOrigList[2])
    // sort by propA (array)
    sorted = s.sortListBy(list, ['propA'])
    expect(sorted[0]).toEqual(immutableOrigList[1])
    expect(sorted[2]).toEqual(immutableOrigList[2])
    // sort by propB
    sorted = s.sortListBy(list, ['propB', 'propA'])
    expect(sorted[0].propB).toEqual(0)
    expect(sorted[3]).toEqual(immutableOrigList[5])
    expect(sorted[0]).toEqual(immutableOrigList[3])
    // undefined should be last
    expect(sorted[5]).toEqual(immutableOrigList[4])
    // sort in reverse/DESC by propB
    sorted = s.sortListBy(list, '-propB')
    expect(sorted[0]).toEqual(immutableOrigList[2])
    expect(sorted[1]).toEqual(immutableOrigList[5])
    // undefined should be last in DESC sort also
    expect(sorted[5]).toEqual(immutableOrigList[4])
  })
})
