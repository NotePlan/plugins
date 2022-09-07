// @flow

import { format } from 'date-fns'
import { showMessage } from '../../helpers/userInput'
import type { Config } from './expensesModels'
import { logDebug, logError } from '@helpers/dev'

const DEFAULT_DELIMITER = ';'
const ALLOWED_DELIMTER = [';', '%', 'TAB']
const MINIMAL_COLUMNS = ['date', 'category', 'amount']
const ALLOWED_AMOUNT_FORMATS = ['full', 'short']
const pluginJson = 'm1well.Expenses/expensesChecks'

/**
 * check if the amount is smaller than 1_000_000 and greater than -1_000_000 and is not 0 or null or NaN
 *
 * @param amount amount from user input
 * @returns {boolean} true/false
 */
export const amountOk = (amount: number): boolean => {
  return amount == null || amount === 0 || isNaN(amount) ? false : amount < 1000000 && amount > -1000000
}

/**
 * check if the category is in the array in the configuration
 *
 * @param category category from user input
 * @param categories categories from config
 * @returns {boolean} true/false
 */
export const categoryOk = (category: string, categories: Array<string>): boolean => {
  return category ? categories.findIndex((cat) => cat === category) !== -1 : false
}

/**
 * just do some checks on the privided config and e.g. add a default delimiter if none is set
 *
 * @param config casted config from _configuration
 * @param currentDate current date - example of date to check if configured date format is valid
 * @returns {Config} return the config if everything is ok, otherwise an empty config
 */
export const validateConfig = (config: Config, currentDate: Date): Config => {
  const emptyConfig: Config = {
    folderPath: '',
    delimiter: '',
    dateFormat: '',
    amountFormat: '',
    columnOrder: [],
    categories: [],
    shortcutExpenses: [],
    fixedExpenses: [],
  }

  if (!config.folderPath) {
    // if there is no folder path configured, then stop
    logError('no folder path configured')
    return emptyConfig
  }

  if (!config.delimiter) {
    // if there is no delimiter configured, then set default
    logDebug(pluginJson, `no delimiter configured - set default to '${DEFAULT_DELIMITER}'`)
    config.delimiter = DEFAULT_DELIMITER
  } else {
    if (!ALLOWED_DELIMTER.includes(config.delimiter)) {
      // if wrong delimiter configured, then stop
      logError(`wrong delimiter configured (${config.delimiter})`)
      return emptyConfig
    }
  }

  if (config.columnOrder.every((col) => MINIMAL_COLUMNS.includes(col))) {
    // if minimal columns config is not provided, then stop
    logError('minimal columns config not provided (at least date, category, amount)')
    return emptyConfig
  }

  if (!config.amountFormat || !ALLOWED_AMOUNT_FORMATS.includes(config.amountFormat)) {
    // if no amount format or wrong amount format, then stop
    logError('no or wrong amount format provided')
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

// export const logError = async (msg: string): Promise<void> => {
//   logError(pluginJson, `\texpenses error: ${msg}`)
//   if (global.CommandBar && global.CommandBar.prompt) {
//     await showMessage(`ERROR: ${msg}`)
//   }
// }
