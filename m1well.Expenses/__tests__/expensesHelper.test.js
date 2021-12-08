/* global describe, expect, test, jest */

import {
  aggregateCategoriesPerMonth,
  extractExpenseRowFromCsvRow,
  extractFixedExpensesArrayFromMixed,
  extractStringArrayFromMixed,
  logError,
  logMessage
} from '../src/expensesHelper'
import 'jest'

const mixed = {
  categories: [
    'Living', 'Media'
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

describe('expenses', () => {

  describe('expensesHelper.js', () => {
    test('should extract string array from mixed config', () => {
      const expectedArray = [ 'Living', 'Media' ]

      const result = extractStringArrayFromMixed(mixed, 'categories')

      expect(result).toEqual(expectedArray)
    })

    test('should extract FixedExpenses array from mixed config', () => {
      const expectedFlatRentAmount = 600

      const result = extractFixedExpensesArrayFromMixed(mixed, 'fixedExpenses')

      const rent = result.filter(exp => exp.text === 'Flat Rent').pop()
      expect(rent.amount).toEqual(expectedFlatRentAmount)
    })

    test('should extract ExpenseRow from csv row', () => {
      const expectedExpenseRow = {
        year: 2021,
        month: 11,
        category: 'Living',
        text: 'Flat Rent',
        amount: 600
      }

      const result = extractExpenseRowFromCsvRow('2021;11;Living;Flat Rent;600')

      expect(result).toEqual(expectedExpenseRow)
    })

    test('should aggregate categories per month', () => {
      const data = [
        { year: 2021, month: 10, category: 'Living', text: 'Flat Rent', amount: 670 },
        { year: 2021, month: 10, category: 'Living', text: 'Garage Rent', amount: 70 },
        { year: 2021, month: 10, category: 'Insurances', text: 'Car Insurance', amount: 44 },
        { year: 2021, month: 11, category: 'Living', text: 'Flat Rent', amount: 670 },
        { year: 2021, month: 11, category: 'Living', text: 'Garage Rent', amount: 70 },
        { year: 2021, month: 11, category: 'Insurances', text: 'Car Insurance', amount: 44 },
        { year: 2021, month: 11, category: 'Insurances', text: 'Work Insurance', amount: 30 },
      ]

      const expectedAggregates = [
        { year: 2021, month: 10, category: 'Living', amount: 740 },
        { year: 2021, month: 10, category: 'Insurances', amount: 44 },
        { year: 2021, month: 11, category: 'Living', amount: 740 },
        { year: 2021, month: 11, category: 'Insurances', amount: 74 },
      ]

      const result = aggregateCategoriesPerMonth(data)

      expect(result).toEqual(expectedAggregates)
    })

    test(`should log message '\texpenses log: hello world'`, () => {
      const consoleSpy = jest.spyOn(console, 'log')

      logMessage('hello world')

      expect(consoleSpy).toHaveBeenCalledWith('\texpenses log: hello world')
    })

    test(`should log error message '\texpenses error: could not parse string'`, () => {
      const consoleSpy = jest.spyOn(console, 'log')

      logError('could not parse string')
        .then(() => {
          expect(consoleSpy).toHaveBeenCalledWith('\texpenses error: could not parse string')
        })
        .catch(console.log)
    })
  })

})
