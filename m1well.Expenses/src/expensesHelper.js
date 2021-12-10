// @flow

import { showMessage } from '../../helpers/userInput'
import type { ExpenseRow, FixedExpense } from './expensesModels'

export const extractStringFromMixed = (mixedValue: { [string]: ?mixed }, key: string): string => {
  console.log(mixedValue.hasOwnProperty(key))
  return mixedValue.hasOwnProperty(key) ? ((mixedValue[key]: any): string) : ''
}

export const extractStringArrayFromMixed = (mixedValue: { [string]: ?mixed }, key: string): string[] => {
  console.log(mixedValue.hasOwnProperty(key))
  return mixedValue.hasOwnProperty(key) ? ((mixedValue[key]: any): string[]) : []
}

export const extractFixedExpensesArrayFromMixed = (mixedValue: { [string]: ?mixed }, key: string): FixedExpense[] => {
  return mixedValue.hasOwnProperty(key) ? ((mixedValue[key]: any): FixedExpense[]) : []
}

export const extractExpenseRowFromCsvRow = (row: string): ExpenseRow => {
  const splitted = row.split(';')
  return {
    year: Number(splitted[0]),
    month: Number(splitted[1]),
    category: splitted[2],
    text: splitted[3],
    amount: Number(splitted[4]),
  }
}

export const aggregateCategoriesPerMonth = (values: ExpenseRow[]): ExpenseRow[] => {
  const getGroupIdentifier = (row) => `${row.month};${row.category}`

  return [ ...values.reduce((sum, row) => {
    const identifier = getGroupIdentifier(row)

    const temp = sum.get(identifier) || {
      year: row.year,
      month: row.month,
      category: row.category,
      amount: 0,
    }
    temp.amount += row.amount

    return sum.set(identifier, temp)
  }, new Map()).values() ]
}

export const logMessage = (msg: string): void => {
  console.log(`\texpenses log: ${msg}`)
}

export const logError = async (msg: string): Promise<void> => {
  console.log(`\texpenses error: ${msg}`)
  await showMessage(`ERROR: ${msg}`)
}
