// @flow

import { format, getMonth, getYear, parse } from 'date-fns'
import type { Config, ExpenseAggregateRow, ExpenseTrackingRow, FixedExpense, ShortcutExpense } from './expensesModels'

const fullAmountConfig = {
  useGrouping: false,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}

/**
 * cast string from the config mixed
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {string} casted value
 */
export const castStringFromMixed = (val: { [string]: ?mixed }, key: string): string => {
  return val.hasOwnProperty(key) ? ((val[key]: any): string) : ''
}

/**
 * cast string array from the config mixed
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {string[]} casted array
 */
export const castStringArrayFromMixed = (val: { [string]: ?mixed }, key: string): string[] => {
  return val.hasOwnProperty(key) ? ((val[key]: any): string[]) : []
}

/**
 * cast ShortcutExpenses array from the config mixed
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {ShortcutExpense[]} casted array
 */
export const castShortcutExpensesArrayFromMixed = (val: { [string]: ?mixed }, key: string): ShortcutExpense[] => {
  return val.hasOwnProperty(key) ? ((val[key]: any): ShortcutExpense[]) : []
}

/**
 * cast FixedExpenses array from the config mixed
 *
 * @param val the config mixed
 * @param key name of the property you want to cast
 * @returns {FixedExpense[]} casted array
 */
export const castFixedExpensesArrayFromMixed = (val: { [string]: ?mixed }, key: string): FixedExpense[] => {
  return val.hasOwnProperty(key) ? ((val[key]: any): FixedExpense[]) : []
}

/**
 * extract a expense row from the string of the tracking note
 *
 * @param row string value from the tracking note
 * @param config the config
 * @returns {ExpenseTrackingRow} generated ExpenseTrackingRow
 */
export const extractExpenseRowFromCsvRow = (row: string, config: Config): ExpenseTrackingRow => {
  const splitted = row.split(config.delimiter === 'TAB' ? '\t' : config.delimiter)

  const indexDate = config.columnOrder.indexOf('date')
  const indexCategory = config.columnOrder.indexOf('category')
  const indexText = config.columnOrder.indexOf('text')
  const indexAmount = config.columnOrder.indexOf('amount')

  // if date could not be parsed we say it is year 1900 and then the aggregate quality checks will fail
  let date = new Date(1900, 0, 1)
  const parsed = parse(splitted[indexDate], config.dateFormat, new Date())
  if (!isNaN(parsed)) {
    date = parsed
  }

  let amount = 0
  if (config.amountFormat === 'full') {
    const separator = Number(0.1).toLocaleString().replace(/\d/g, '')
    amount = Number(splitted[indexAmount].replace(separator, '.'))
  } else {
    amount = Number(splitted[indexAmount])
  }

  return {
    date: date,
    category: splitted[indexCategory],
    text: splitted[indexText],
    amount: amount,
  }
}

/**
 * aggregates a tracking note by categories and month
 *
 * @param values rows from the tracking note
 * @param delimiter configured delimiter
 * @returns {ExpenseAggregateRow[]} aggregated rows for the aggregated note
 */
export const aggregateByCategoriesAndMonth = (values: ExpenseTrackingRow[],
                                              delimiter: string): ExpenseAggregateRow[] => {
  const getGroupIdentifier = (row) => `${getMonth(row.date)}${delimiter}${row.category}`

  return [ ...values.reduce((sum, row) => {
    const identifier = getGroupIdentifier(row)

    const temp = sum.get(identifier) || {
      year: getYear(row.date),
      month: leftPadWithZeros(getMonth(row.date) + 1, 2),
      category: row.category,
      amount: 0,
    }
    temp.amount += row.amount

    return sum.set(identifier, temp)
  }, new Map()).values() ]
}

/**
 * create new string tracking row with some configured properties (e.g. delimiter)
 *
 * @param row row from the user input
 * @param config the config
 * @returns {string} string row for the tracking note
 */
export const createTrackingExpenseRowWithConfig = (row: ExpenseTrackingRow, config: Config): string => {
  return config.columnOrder
    .map(col => {
      return Object.entries(row)
        .filter(entry => entry[0] === col)
        .map(entry => {
          if (entry[1] instanceof Date) {
            return format(((entry[1]: any): Date), config.dateFormat)
          }
          if (typeof entry[1] === 'number' && config.amountFormat === 'full') {
            return entry[1].toLocaleString(undefined, fullAmountConfig)
          }
          return entry[1]
        })
    })
    .join(config.delimiter === 'TAB' ? '\t' : config.delimiter)
}

/**
 * create new string aggregated row with delimiter
 *
 * @param row row from the aggregated function
 * @param config the config
 * @returns {string} string row for the aggregated note
 */
export const createAggregationExpenseRowWithDelimiter = (row: ExpenseAggregateRow, config: Config): string => {
  return [ 'year', 'month', 'category', 'amount' ]
    .map(col => {
      return Object.entries(row)
        .filter(entry => entry[0] === col)
        .map(entry => {
          if (typeof entry[1] === 'number' && entry[0] === 'amount' && config.amountFormat === 'full') {
            return entry[1].toLocaleString(undefined, fullAmountConfig)
          }
          return entry[1]
        })
    })
    .join(config.delimiter === 'TAB' ? '\t' : config.delimiter)
}

/**
 * stringify the objects from the shortcut list to show them as input options
 *
 * @param shortcuts shortcuts from the config
 * @param delimiter delimiter for the shortcuts
 * @returns {string[]} stringified shortcuts in an array
 */
export const stringifyShortcutList = (shortcuts: ShortcutExpense[], delimiter: string): string[] => {
  return shortcuts.map(sc => {
    if (sc.amount) {
      return [ sc.category, sc.text, sc.amount ].join(delimiter === 'TAB' ? '\t' : delimiter)
    } else {
      return [ sc.category, sc.text ].join(delimiter === 'TAB' ? '\t' : delimiter)
    }
  })
}

/**
 * here you can left pad your number with zeros - e.g. a '5' with 3 targetDigits is getting a '005'
 *
 * @param current the current number
 * @param targetDigits how many digits should the target number have
 * @returns {string} the left padded value as string
 */
export const leftPadWithZeros = (current: number, targetDigits: number): string => {
  if (current.toString().length >= targetDigits || targetDigits == null) {
    return current.toString()
  }
  return String(Array(Math.max(targetDigits - String(current).length + 1, 0)).join('0') + current)
}
