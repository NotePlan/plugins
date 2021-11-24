/* eslint-disable */

import {
  aggregateClusterPerMonth,
  extractExpenseRowFromCsvRow,
  extractFixExpensesArrayFromMixed,
  extractStringArrayFromMixed,
  logError,
  logMessage
} from './expensesHelpers'

const mixed: { [string]: ?mixed } = {
  clusters: [
    'Living', 'Media'
  ],
  fixExpenses: [
    {
      cluster: 'Living',
      text: 'Flat Rent',
      amount: 600,
      active: true,
    },
    {
      cluster: 'Media',
      text: 'Spotify',
      amount: 10,
      active: true,
    },
  ]
}

test('should extract string array from mixed config', () => {
  const expectedArray = [ 'Living', 'Media' ]

  const result = extractStringArrayFromMixed(mixed, 'clusters')

  expect(result).toEqual(expectedArray)
})

test('should extract FixExpenses array from mixed config', () => {
  const expectedFlatRentAmount = 600

  const result = extractFixExpensesArrayFromMixed(mixed, 'fixExpenses')

  const rent = result.filter(exp => exp.text === 'Flat Rent').pop()
  expect(rent.amount).toEqual(expectedFlatRentAmount)
})

test('should extract ExpenseRow from csv row', () => {
  const expectedExpenseRow = {
    year: 2021,
    month: 11,
    cluster: 'Living',
    text: 'Flat Rent',
    amount: 600
  }

  const result = extractExpenseRowFromCsvRow('2021;11;Living;Flat Rent;600')

  expect(result).toEqual(expectedExpenseRow)
})

test('should aggregate clusters per month', () => {
  const data = [
    { year: 2021, month: 10, cluster: 'Living', text: 'Flat Rent', amount: 670 },
    { year: 2021, month: 10, cluster: 'Living', text: 'Garage Rent', amount: 70 },
    { year: 2021, month: 10, cluster: 'Insurances', text: 'Car Insurance', amount: 44 },
    { year: 2021, month: 11, cluster: 'Living', text: 'Flat Rent', amount: 670 },
    { year: 2021, month: 11, cluster: 'Living', text: 'Garage Rent', amount: 70 },
    { year: 2021, month: 11, cluster: 'Insurances', text: 'Car Insurance', amount: 44 },
    { year: 2021, month: 11, cluster: 'Insurances', text: 'Work Insurance', amount: 30 },
  ]

  const expectedAggregates = [
    { year: 2021, month: 10, cluster: 'Living', amount: 740 },
    { year: 2021, month: 10, cluster: 'Insurances', amount: 44 },
    { year: 2021, month: 11, cluster: 'Living', amount: 740 },
    { year: 2021, month: 11, cluster: 'Insurances', amount: 74 },
  ]

  const result = aggregateClusterPerMonth(data)

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
