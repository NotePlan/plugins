// @flow

import { getMonth, getYear } from 'date-fns'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import { getInputTrimmed, inputNumber } from '../../helpers/userInput'
import {
  aggregateByCategoriesAndMonth,
  castFixedExpensesArrayFromMixed,
  castShortcutExpensesArrayFromMixed,
  castStringArrayFromMixed,
  castStringFromMixed,
  createAggregationExpenseRowWithDelimiter,
  createTrackingExpenseRowWithConfig,
  extractExpenseRowFromCsvRow,
  stringifyShortcutList
} from './expensesHelper'
import type { Config, ExpenseTrackingRow } from './expensesModels'
import { amountOk, categoryOk, logError, logMessage, validateConfig } from './expensesChecks'

const DEFAULT_DELIMITER = ';'
const ALLOWED_DELIMTER = [ ';', '%', 'TAB' ]

const CONFIG_KEYS = {
  folderPath: 'folderPath',
  delimiter: 'delimiter',
  dateFormat: 'dateFormat',
  columnOrder: 'columnOrder',
  categories: 'categories',
  shortcutExpenses: 'shortcutExpenses',
  fixedExpenses: 'fixedExpenses',
}

const TRACKING_MODE = [
  'Individual', 'Shortcuts', 'Fixed'
]

// if there is no config in the '_configuration' file, then provide an example config
const EXAMPLE_CONFIG = `  
  /* >> expenses plugin start <<
   * for more information please have a look at the plugins' readme
   */
  expenses: {
    // just an example folderPath - please adapt to your needs
    ${CONFIG_KEYS.folderPath}: 'finances',
    // just an example delimiter - you can use ';', '%' or 'TAB'
    ${CONFIG_KEYS.delimiter}: '${DEFAULT_DELIMITER}',
    // custom date format - e.g. one date '2021-12-08', or only year and month as columns '2021;12'
    // so the format should be like 'yyyy-MM-dd' or 'yyyy-MM' - ATTENTION: don't use your chosen delimiter here
    ${CONFIG_KEYS.dateFormat}: 'yyyy-MM-dd',
    // please choose your column order before first tracking
    // there is no eventlistener in the config - to change existing data after changing the order here
    ${CONFIG_KEYS.columnOrder}: [
      'date',
      'category',
      'text',
      'amount',
    ],
    // just some example categories - please adapt to your needs
    // and set order to your best experience
    ${CONFIG_KEYS.categories}: [
      'Living',
      'Groceries',
      'Insurances',
      'Mobility',
      'Media',
      'Fun',
    ],
    // just some example shortcut expenses - please adapt to your needs
    // you can also add an amount, then you can insert the shortcut without any question
    ${CONFIG_KEYS.shortcutExpenses}: [
      {
        category: 'Mobility',
        text: 'Refuel',
        amount: null,
      },
      {
        category: 'Groceries',
        text: 'XYZ Market',
        amount: null,
      },
      {
        category: 'Fun',
        text: 'Cofe at Starbucks',
        amount: 8,
      },
    ],
    // just some example fixed expenses - please adapt to your needs
    ${CONFIG_KEYS.fixedExpenses}: [
      {
        category: 'Living',
        text: 'Flat Rent',
        amount: 670,
        month: 0,
        active: true,
      },
      {
        category: 'Insurances',
        text: 'Car Insurance',
        amount: 399,
        month: 1,
        active: true,
      },
      {
        category: 'Media',
        text: 'Spotify',
        amount: 10,
        month: 0,
        active: false,
      },
    ],
  },
  /* >> expenses plugin end << */
`

/**
 * @description expenses tracking with three possibilities (individual, shortcuts, fixed)
 *
 * @returns {Promise<boolean>}
 */
const expensesTracking = async (): Promise<boolean> => {
  const mode = await CommandBar.showOptions(TRACKING_MODE, 'Please choose tracking mode')

  switch (mode.value) {
    case 'Individual':
      return await individualTracking()
    case 'Shortcuts':
      return await shortcutsTracking()
    case 'Fixed':
      return await fixedTracking()
    default:
      return false
  }
}

/**
 * @description aggregates expenses of given year to a new note
 *
 * @returns {Promise<boolean>}
 */
const expensesAggregate = async (): Promise<boolean> => {
  let config = await provideConfig()
  config = validateConfig(config, new Date(), DEFAULT_DELIMITER, ALLOWED_DELIMTER)

  if (!config.folderPath) {
    return false
  }

  const year = Number(await CommandBar.showInput('Please type in the year to aggregate', 'Start aggregate'))

  const noteTitleTracking = `${year} Expenses Tracking`
  if (!await provideAndCheckNote(noteTitleTracking, config.folderPath, false, year)) {
    return false
  }

  await Editor.openNoteByTitle(noteTitleTracking)
  const trackedData = Editor.paragraphs
    .filter(para => !para.rawContent.startsWith('#'))
    .map(para => extractExpenseRowFromCsvRow(para.rawContent, config))

  if (!checkDataQualityBeforeAggregate(trackedData, year, config)) {
    return false
  }

  const aggregatedData = aggregateByCategoriesAndMonth(trackedData, config.delimiter)

  const noteTitleAggregate = `${year} Expenses Aggregate`
  if (!await provideAndCheckNote(noteTitleAggregate, config.folderPath, true)) {
    return false
  }

  if (aggregatedData.length > 0) {
    await Editor.openNoteByTitle(noteTitleAggregate)
    Editor.removeParagraphs(Editor.paragraphs
      .filter(para => !para.rawContent.startsWith('#')))
    // add results
    aggregatedData.forEach(aggregated => {
      if (aggregated.year) {
        const line = createAggregationExpenseRowWithDelimiter(aggregated, config.delimiter)
        Editor.appendParagraph(line, 'text')
      }
    })

    return true
  }

  return false
}

/**
 * @description tracking of individual expenses
 *
 * @returns {Promise<boolean>}
 */
const individualTracking = async (): Promise<boolean> => {
  const currentDate = new Date()
  let config = await provideConfig()
  config = validateConfig(config, currentDate, DEFAULT_DELIMITER, ALLOWED_DELIMTER)

  if (!config.folderPath) {
    return false
  }

  const title = `${getYear(currentDate)} Expenses Tracking`

  if (!await provideAndCheckNote(title, config.folderPath, true)) {
    return false
  }

  const category = await CommandBar.showOptions(config.categories, 'Please choose category')
  const text = await getInputTrimmed('Please type in some text (no semicolon)', 'Add text to expenses line')
  const amount = await inputNumber('Please type in amount (only integer numbers)')

  if (!amountOk(amount)) {
    logError('amount too big or not a number')
    return false
  }

  if (!category || !text) {
    // if user missed some input, then stop
    logError('an input was missing')
    return false
  }

  await Editor.openNoteByTitle(title)
  const expenseRow = {
    date: currentDate,
    category: category.value,
    text: text,
    amount: Math.round(amount),
  }
  const line = createTrackingExpenseRowWithConfig(expenseRow, config)
  Editor.appendParagraph(line, 'text')

  return true
}

/**
 * @description tracking of shortcut expenses
 *
 * @returns {Promise<boolean>}
 */
const shortcutsTracking = async (): Promise<boolean> => {
  const currentDate = new Date()
  let config = await provideConfig()
  config = validateConfig(config, currentDate, DEFAULT_DELIMITER, ALLOWED_DELIMTER)

  if (!config.folderPath) {
    return false
  }

  const title = `${getYear(currentDate)} Expenses Tracking`

  if (!await provideAndCheckNote(title, config.folderPath, true)) {
    return false
  }

  const shortcut = await CommandBar.showOptions(stringifyShortcutList(config.shortcutExpenses, config.delimiter), 'Please choose shortcut')
  const selected = config.shortcutExpenses[shortcut.index]

  let amount = 0
  if (!selected.amount) {
    amount = await inputNumber('Please type in amount (only integer numbers)')
  } else {
    amount = selected.amount
  }

  if (!amountOk(amount)) {
    logError('amount not in range or not a number')
    return false
  }

  if (!categoryOk(selected.category, config.categories)) {
    logError('category not configured')
    return false
  }

  if (!selected.text) {
    // if there was no text in the shortcut, then stop
    logError('text was missing')
    return false
  }

  await Editor.openNoteByTitle(title)
  const expenseRow = {
    date: currentDate,
    category: selected.category,
    text: selected.text,
    amount: Math.round(amount),
  }
  const line = createTrackingExpenseRowWithConfig(expenseRow, config)
  Editor.appendParagraph(line, 'text')

  return true
}

/**
 * @description tracking of fixed expenses
 *
 * @returns {Promise<boolean>}
 */
const fixedTracking = async (): Promise<boolean> => {
  const currentDate = new Date()
  let config = await provideConfig()
  config = validateConfig(config, currentDate, DEFAULT_DELIMITER, ALLOWED_DELIMTER)

  if (!config.folderPath) {
    return false
  }

  const title = `${getYear(currentDate)} Expenses Tracking`

  if (!await provideAndCheckNote(title, config.folderPath, true)) {
    return false
  }

  const month = getMonth(currentDate) - 1

  await Editor.openNoteByTitle(title)
  config.fixedExpenses
    .filter(exp => exp.active && (exp.month === 0 || exp.month === month))
    .map(exp => {
      if (!categoryOk(exp.category, config.categories)) {
        exp.category = `>>WRONG CATEGORY (${exp.category})<<`
      }
      return exp
    })
    .forEach(exp => {
      const expenseRow = {
        date: currentDate,
        category: exp.category,
        text: exp.text,
        amount: Math.round(exp.amount),
      }
      const line = createTrackingExpenseRowWithConfig(expenseRow, config)
      Editor.appendParagraph(line, 'text')
    })

  return true
}

/**
 * @description provide config from _configuration and cast content to real objects
 *
 * @private
 */
const provideConfig = (): Promise<Config> => {
  return getOrMakeConfigurationSection(
    'expenses',
    EXAMPLE_CONFIG
  )
    .then(result => {
      if (result == null || Object.keys(result).length === 0) {
        logError('expected config could not be found in the _configuration file')
        return {
          folderPath: '',
          delimiter: '',
          dateFormat: '',
          columnOrder: [],
          categories: [],
          shortcutExpenses: [],
          fixedExpenses: []
        }
      } else {
        logMessage(`loaded config\n${JSON.stringify(result)}\n`)
        const config: Config = {
          folderPath: castStringFromMixed(result, CONFIG_KEYS.folderPath),
          delimiter: castStringFromMixed(result, CONFIG_KEYS.delimiter),
          dateFormat: castStringFromMixed(result, CONFIG_KEYS.dateFormat),
          columnOrder: castStringArrayFromMixed(result, CONFIG_KEYS.columnOrder),
          categories: castStringArrayFromMixed(result, CONFIG_KEYS.categories),
          shortcutExpenses: castShortcutExpensesArrayFromMixed(result, CONFIG_KEYS.shortcutExpenses),
          fixedExpenses: castFixedExpensesArrayFromMixed(result, CONFIG_KEYS.fixedExpenses),
        }
        return config
      }
    })
}

/**
 * @description check if one note exists by name, if mulitple exists - throw error, of none extist -> create it
 *
 * @private
 */
const provideAndCheckNote = async (title: string,
                                   folderPath: string,
                                   createNote: boolean,
                                   year?: number): Promise<boolean> => {
  const notes = DataStore.projectNoteByTitle(title)

  // create note if it de
  if (notes) {
    if (notes.length > 1) {
      // if there are multiple notes with same title
      logError('there are multiple notes with same title')
      return false
    }
    if (notes.length < 1) {
      if (createNote) {
        await DataStore.newNote(title, folderPath)
        return true
      } else {
        // if there is no note to aggregate
        logError(`no note found for year ${year ?? '-'}`)
        return false
      }
    }
    // if there is one note, all good
    return true
  }

  // internal error with notes
  logError('internal error with notes')
  return false
}

/**
 * @description check data quality of tracked data before we aggregate it
 *
 * @private
 */
const checkDataQualityBeforeAggregate = (rows: ExpenseTrackingRow[], year: number, config: Config): boolean => {
  for (const row of rows) {
    const rowYear = getYear(row.date)

    if (rowYear !== year) {
      logError(`year at: ${createTrackingExpenseRowWithConfig(row, config)}`)
      return false
    }
    if (!categoryOk(row.category, config.categories)) {
      logError(`category not found at: ${createTrackingExpenseRowWithConfig(row, config)}`)
      return false
    }
    if (!amountOk(row.amount)) {
      logError(`amount at: ${createTrackingExpenseRowWithConfig(row, config)}`)
      return false
    }

  }

  return true
}

export { expensesTracking, expensesAggregate, individualTracking, shortcutsTracking, fixedTracking }
