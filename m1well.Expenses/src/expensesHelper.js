// @flow

import { showMessage } from '../../helpers/userInput'
import type { ExpenseRow, FixExpenses } from './expensesModels'

export const extractStringFromMixed = (mixedValue: { [string]: ?mixed }, key: string): string => {
  console.log(mixedValue.hasOwnProperty(key))
  return mixedValue.hasOwnProperty(key) ? ((mixedValue[key]: any): string) : ''
}

export const extractStringArrayFromMixed = (mixedValue: { [string]: ?mixed }, key: string): string[] => {
  console.log(mixedValue.hasOwnProperty(key))
  return mixedValue.hasOwnProperty(key) ? ((mixedValue[key]: any): string[]) : []
}

export const extractFixExpensesArrayFromMixed = (mixedValue: { [string]: ?mixed }, key: string): FixExpenses[] => {
  return mixedValue.hasOwnProperty(key) ? ((mixedValue[key]: any): FixExpenses[]) : []
}

export const extractExpenseRowFromCsvRow = (row: string): ExpenseRow => {
  const splitted = row.split(';')
  return {
    year: Number(splitted[0]),
    month: Number(splitted[1]),
    cluster: splitted[2],
    text: splitted[3],
    amount: Number(splitted[4]),
  }
}

export const aggregateClustersPerMonth = (values: ExpenseRow[]): ExpenseRow[] => {
  const getGroupIdentifier = (row) => `${row.month};${row.cluster}`

  return [ ...values.reduce((sum, row) => {
    const identifier = getGroupIdentifier(row)

    const temp = sum.get(identifier) || {
      year: row.year,
      month: row.month,
      cluster: row.cluster,
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
