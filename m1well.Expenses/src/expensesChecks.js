// @flow

import { format } from 'date-fns'
import { showMessage } from '../../helpers/userInput'
import type { Config } from './expensesModels'

/**
 * @description check if the amount is smaller than 1_000_000 and greater than -1_000_000 and is not 0 or null or NaN
 *
 * @param amount amount from user input
 * @returns {boolean} true/false
 */
export const amountOk = (amount: number): boolean => {
  return (amount == null || amount === 0 || isNaN(amount)) ? false : amount < 1000000 && amount > -1000000
}

/**
 * @description check if the category is in the array in the configuration
 *
 * @param category category from user input
 * @param categories categories from config
 * @returns {boolean} true/false
 */
export const categoryOk = (category: string, categories: string[]): boolean => {
  return category ? categories.findIndex(cat => cat === category) !== -1 : false
}

/**
 * @description just do some checks on the privided config and e.g. add a default delimiter if none is set
 *
 * @param config casted config from _configuration
 * @param currentDate current date - to have always the same
 * @param defaultDelimiter default delimiter from code
 * @param allowedDelimiter allowed delimiter from code
 * @returns {Config|null} return the config if everything is ok, otherwise null
 */
export const validateConfig = (config: Config,
                               currentDate: Date,
                               defaultDelimiter: string,
                               allowedDelimiter: string[]): Config => {

  const emptyConfig = {
    folderPath: '',
    delimiter: '',
    dateFormat: '',
    columnOrder: [],
    categories: [],
    shortcutExpenses: [],
    fixedExpenses: []
  }

  if (!config.folderPath) {
    // if there is no folder path configured, then stop
    logError('no folder path configured')
    return emptyConfig
  }

  if (!config.delimiter) {
    // if there is no delimiter configured, then set default
    logMessage(`no delimiter configured - set default to '${defaultDelimiter}'`)
    config.delimiter = defaultDelimiter
  } else {
    if (!allowedDelimiter.includes(config.delimiter)) {
      // if wrong delimiter configured, then stop
      logError(`wrong delimiter configured (${config.delimiter})`)
      return emptyConfig
    }
  }

  const minimalColumns = [ 'date', 'category', 'amount' ]
  if (config.columnOrder.every(col => minimalColumns.includes(col))) {
    // if minimal columns config is not provided, then stop
    logError('minimal columns config not provided (at least date, category, amount)')
    return emptyConfig
  }

  if (config.categories.length < 1) {
    // if there are no categories configured, then stop
    logError('no categories configured')
    return emptyConfig
  }

  if (config.shortcutExpenses.length < 1) {
    // if there are no shortcuts configured, then stop
    logError('no shortcuts configured')
    return emptyConfig
  }

  try {
    // check if given format has valid identifiers
    format(currentDate, config.dateFormat)
  } catch (e) {
    logError(e)
    return emptyConfig
  }

  return config
}

export const logMessage = (msg: string): void => {
  console.log(`\texpenses log: ${msg}`)
}

export const logError = async (msg: string): Promise<void> => {
  console.log(`\texpenses error: ${msg}`)
  await showMessage(`ERROR: ${msg}`)
}
