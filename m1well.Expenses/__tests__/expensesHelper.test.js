/* global describe, expect, test */

import {
  aggregateByCategoriesAndMonth,
  castFixedExpensesArrayFromMixed,
  castShortcutExpensesArrayFromMixed,
  castStringArrayFromMixed,
  castStringFromMixed,
  createTrackingExpenseRowWithConfig,
  extractExpenseRowFromCsvRow,
  leftPadWithZeros,
} from '../src/expensesHelper'

const simpleConfig = {
  delimiter: ';',
  dateFormat: 'yyyy-MM-dd',
  amountFormat: 'short',
  columnOrder: [
    'date', 'category', 'text', 'amount'
  ],
  categories: [
    'Living', 'Media'
  ],
  shortcutExpenses: [
    {
      category: 'Fun',
      text: 'Coffee',
      amount: 8,
    },
  ],
  fixedExpenses: [
    {
      category: 'Living',
      text: 'Flat Rent',
      amount: 600,
      active: true,
    },
    {
      category: 'Media',
      text: 'Spotify',
      amount: 10,
      active: true,
    },
  ]
}

describe('expensesHelper', () => {

  describe('expensesHelper.js', () => {

    test('should cast string array from mixed config', () => {
      const expected = 'yyyy-MM-dd'

      const result = castStringFromMixed(simpleConfig, 'dateFormat')

      expect(result).toEqual(expected)
    })

    test('should cast string array from mixed config', () => {
      const expectedArray = [ 'Living', 'Media' ]

      const result = castStringArrayFromMixed(simpleConfig, 'categories')

      expect(result).toEqual(expectedArray)
    })

    test('should cast ShortcutExpenses array from mixed config', () => {
      const expectedCofeAmount = 8

      const result = castShortcutExpensesArrayFromMixed(simpleConfig, 'shortcutExpenses')

      const coffee = result.filter(exp => exp.text === 'Coffee').pop()
      expect(coffee.amount).toEqual(expectedCofeAmount)
    })

    test('should cast FixedExpenses array from mixed config', () => {
      const expectedFlatRentAmount = 600

      const result = castFixedExpensesArrayFromMixed(simpleConfig, 'fixedExpenses')

      const rent = result.filter(exp => exp.text === 'Flat Rent').pop()
      expect(rent.amount).toEqual(expectedFlatRentAmount)
    })

    test('should extract ExpenseRow from csv row', () => {
      const expectedExpenseRow = {
        date: new Date(2021, 11, 1),
        category: 'Living',
        text: 'Flat Rent',
        amount: 600
      }

      const result = extractExpenseRowFromCsvRow('2021-12-01;Living;Flat Rent;600', simpleConfig)

      expect(result).toEqual(expectedExpenseRow)
    })

    test('should aggregate entries by category and month', () => {
      const trackingData = [
        { date: new Date(2021, 10, 1), category: 'Living', text: 'Flat Rent', amount: 670 },
        { date: new Date(2021, 10, 1), category: 'Living', text: 'Garage Rent', amount: 70 },
        { date: new Date(2021, 10, 1), category: 'Insurances', text: 'Car Insurance', amount: 44 },
        { date: new Date(2021, 11, 1), category: 'Living', text: 'Flat Rent', amount: 670 },
        { date: new Date(2021, 11, 1), category: 'Living', text: 'Garage Rent', amount: 70 },
        { date: new Date(2021, 11, 1), category: 'Insurances', text: 'Car Insurance', amount: 44 },
        { date: new Date(2021, 11, 2), category: 'Insurances', text: 'Work Insurance', amount: 30 },
      ]

      const expectedAggregates = [
        { year: 2021, month: '11', category: 'Living', amount: 740 },
        { year: 2021, month: '11', category: 'Insurances', amount: 44 },
        { year: 2021, month: '12', category: 'Living', amount: 740 },
        { year: 2021, month: '12', category: 'Insurances', amount: 74 },
      ]

      const result = aggregateByCategoriesAndMonth(trackingData)

      expect(result).toEqual(expectedAggregates)
    })

    test('should create line in given order', () => {
      const row = {
        date: new Date(2021, 10, 1),
        category: 'Living',
        text: 'Flat Rent',
        amount: 600,
      }

      const result = createTrackingExpenseRowWithConfig(row, simpleConfig)

      expect(result).toEqual('2021-11-01;Living;Flat Rent;600')
    })

    test('should create line in given order with full amount format', () => {
      const row = {
        date: new Date(2021, 10, 1),
        category: 'Living',
        text: 'Flat Rent',
        amount: 600.55,
      }

      const changedSimpleConfig = { ...simpleConfig, amountFormat: 'full' }

      const result = createTrackingExpenseRowWithConfig(row, changedSimpleConfig)

      expect(result).toEqual('2021-11-01;Living;Flat Rent;600.55')
    })

    test('should left pad with zeros', () => {
      expect(leftPadWithZeros(5, 2)).toEqual('05')
      expect(leftPadWithZeros(5, 1)).toEqual('5')
      expect(leftPadWithZeros(333, 1)).toEqual('333')
      expect(leftPadWithZeros(333, 2)).toEqual('333')
      expect(leftPadWithZeros(333, 3)).toEqual('333')
      expect(leftPadWithZeros(333, 4)).toEqual('0333')
      expect(leftPadWithZeros(333, 10)).toEqual('0000000333')
      expect(leftPadWithZeros(5, null)).toEqual('5')
    })

  })

})
