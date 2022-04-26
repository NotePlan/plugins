// @flow

import pluginJson from '../plugin.json'
import { getMonth, getYear } from 'date-fns'
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
import { amountOk, categoryOk, validateConfig } from './expensesChecks'
import { clo, log, logError } from '../../helpers/dev'
import { getInputTrimmed, inputNumber } from '../../helpers/userInput'

const CONFIG_KEYS = {
  folderPath: 'folderPath',
  delimiter: 'delimiter',
  dateFormat: 'dateFormat',
  amountFormat: 'amountFormat',
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
    ${CONFIG_KEYS.delimiter}: ';',
    // please choose date format before first tracking!
    // there is no eventlistener in the config - to change existing data after changing the order here
    // custom date format - e.g. one date '2021-12-08', or only year and month as columns '2021;12'
    // so the format should be like 'yyyy-MM-dd' or 'yyyy-MM' - ATTENTION: don't use your chosen delimiter here
    ${CONFIG_KEYS.dateFormat}: 'yyyy-MM-dd',
    // please choose amount format before first tracking!
    // there is no eventlistener in the config - to change existing data after changing the order here
    // choose 'full' to have always 2 fraction digits with localized separator
    // or choose 'short' to have no fraction digits and always rounded amounts!
    ${CONFIG_KEYS.amountFormat}: 'short',
    // please choose your column order before first tracking!
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
        amount: 9.99,
        month: 0,
        active: false,
      },
    ],
  },
  /* >> expenses plugin end << */
`

/**
 * expenses tracking with three possibilities (individual, shortcuts, fixed)
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
 * aggregates expenses of given year to a new note
 *
 * @returns {Promise<boolean>}
 */
const expensesAggregate = async (): Promise<boolean> => {
  let config = await provideConfig()
  config = validateConfig(config, new Date())

  if (!config.folderPath) {
    return false
  }

  const year = Number(await CommandBar.showInput('Please type in the year to aggregate', 'Start aggregate'))

  const noteTitleTracking = `${year} Expenses Tracking`
  if (!await provideAndCheckNote(noteTitleTracking, config.folderPath, false, year)) {
    return false
  }

  const trackingNote = DataStore.projectNoteByTitle(noteTitleTracking)?.[0]

  if (trackingNote) {
    const trackedData = trackingNote.paragraphs
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

    const lines: string[] = []

    if (aggregatedData.length > 0) {
      await Editor.openNoteByTitle(noteTitleAggregate)
      const note = Editor.note
      if (note) {
        note.removeParagraphs(note.paragraphs.filter(para => !para.rawContent.startsWith('#')))
        // add results
        aggregatedData.forEach(aggregated => {
          if (aggregated.year) {
            lines.push(createAggregationExpenseRowWithDelimiter(aggregated, config))
          }
        })
        note.appendParagraph(lines.join('\n'), 'text')
        return true
      }
    }
  }

  return false
}

/**
 * tracking of individual expenses
 *
 * @returns {Promise<boolean>}
 */
const individualTracking = async (): Promise<boolean> => {
  const currentDate = new Date()
  let config = await provideConfig()
  config = validateConfig(config, currentDate)

  if (!config.folderPath) {
    return false
  }

  const title = `${getYear(currentDate)} Expenses Tracking`

  if (!await provideAndCheckNote(title, config.folderPath, true)) {
    return false
  }

  const category = await CommandBar.showOptions(config.categories, 'Please choose category')
  const text = await getInputTrimmed('Please type in some text (no semicolon)', 'Add text to expenses line')
  let amount = await inputNumber('Please type in amount')

  let amountCheck = amountOk(amount)
  while (!amountCheck) {
    logError(pluginJson, 'amount too big or not a number')
    amount = await inputNumber('Please type in correct amount')
    amountCheck = amountOk(amount)
  }

  if (!category || !text) {
    // if user missed some input, then stop
    logError(pluginJson, 'an input was missing')
    return false
  }

  const note = DataStore.projectNoteByTitle(title)?.[0]
  const expenseRow: ExpenseTrackingRow = {
    date: currentDate,
    category: category.value,
    text: text ? ((text: any): string) : '', // this is stupid, but now we have to do this cast ...
    amount: config.amountFormat === 'full' ? amount : Math.round(amount),
  }
  if (note) {
    note.appendParagraph(createTrackingExpenseRowWithConfig(expenseRow, config), 'text')
    await CommandBar.showOptions([ 'OK' ], 'Individual Expenses saved')
  }

  return true
}

/**
 * tracking of shortcut expenses
 *
 * @returns {Promise<boolean>}
 */
const shortcutsTracking = async (): Promise<boolean> => {
  const currentDate = new Date()
  let config = await provideConfig()
  config = validateConfig(config, currentDate)

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
    logError(pluginJson, 'amount not in range or not a number')
    return false
  }

  if (!categoryOk(selected.category, config.categories)) {
    logError(pluginJson, 'category not configured')
    return false
  }

  if (!selected.text) {
    // if there was no text in the shortcut, then stop
    logError(pluginJson, 'text was missing')
    return false
  }

  const note = DataStore.projectNoteByTitle(title)?.[0]
  const expenseRow = {
    date: currentDate,
    category: selected.category,
    text: selected.text,
    amount: config.amountFormat === 'full' ? amount : Math.round(amount),
  }
  if (note) {
    note.appendParagraph(createTrackingExpenseRowWithConfig(expenseRow, config), 'text')
    await CommandBar.showOptions([ 'OK' ], 'Shortcut Expenses saved')
  }

  return true
}

/**
 * tracking of fixed expenses
 *
 * @returns {Promise<boolean>}
 */
const fixedTracking = async (): Promise<boolean> => {
  const currentDate = new Date()
  let config = await provideConfig()
  config = validateConfig(config, currentDate)

  if (!config.folderPath) {
    return false
  }

  const title = `${getYear(currentDate)} Expenses Tracking`

  if (!await provideAndCheckNote(title, config.folderPath, true)) {
    return false
  }

  const month = getMonth(currentDate) + 1

  const lines: string[] = []

  const note = DataStore.projectNoteByTitle(title)?.[0]
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
        amount: config.amountFormat === 'full' ? exp.amount : Math.round(exp.amount),
      }
      lines.push(createTrackingExpenseRowWithConfig(expenseRow, config))
    })

  if (note) {
    note.appendParagraph(lines.join('\n'), 'text')
    await CommandBar.showOptions([ 'OK' ], 'Fixed Expenses saved')
  }

  return true
}

/**
 * provide config from new plugin settings section or the old _configuration file and cast content to real objects
 *
 * @private
 */
const provideConfig = async (): Promise<any> => {
  try {
    const fromSettings: Config = DataStore.settings

    if (fromSettings) {
      // $FlowIgnoreMe[incompatible-call]
      clo(fromSettings, `loaded config from settings:`)
    } else {
      throw new Error(`Cannot find settings for Expenses plugin`)
    }
    return fromSettings
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return null // for completeness
  }

}

/**
 * check if one note exists by name, if mulitple exists - throw error, of none extist -> create it
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
      logError(pluginJson, 'there are multiple notes with same title')
      return false
    }
    if (notes.length < 1) {
      if (createNote) {
        await DataStore.newNote(title, folderPath)
        return true
      } else {
        // if there is no note to aggregate
        logError(pluginJson, `no note found for year ${year ?? '-'}`)
        return false
      }
    }
    // if there is one note, all good
    return true
  }

  // internal error with notes
  logError(pluginJson, 'internal error with notes')
  return false
}

/**
 * check data quality of tracked data before we aggregate it
 *
 * @private
 */
const checkDataQualityBeforeAggregate = (rows: ExpenseTrackingRow[], year: number, config: Config): boolean => {
  for (const row of rows) {
    const rowYear = getYear(row.date)

    if (rowYear !== year) {
      logError(pluginJson, `year at: ${createTrackingExpenseRowWithConfig(row, config)}`)
      return false
    }
    if (!categoryOk(row.category, config.categories)) {
      logError(pluginJson, `category not found at: ${createTrackingExpenseRowWithConfig(row, config)}`)
      return false
    }
    if (!amountOk(row.amount)) {
      logError(pluginJson, `amount at: ${createTrackingExpenseRowWithConfig(row, config)}`)
      return false
    }

  }

  return true
}

export { expensesTracking, expensesAggregate, individualTracking, shortcutsTracking, fixedTracking }
