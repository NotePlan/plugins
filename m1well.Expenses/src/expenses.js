// @flow

import { getYearMonthDate } from '../../helpers/dateTime'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import { leftPadWithZeros } from '../../helpers/general'
import { inputNumber } from '../../helpers/userInput'
import {
  aggregateClusterPerMonth,
  extractExpenseRowFromCsvRow,
  extractFixExpensesArrayFromMixed,
  extractStringArrayFromMixed,
  extractStringFromMixed,
  logError,
  logMessage
} from './expensesHelpers'
import type { Config } from './expensesModels'

const CONFIG_KEYS = {
  folderPath: 'folderPath',
  clusters: 'clusters',
  shortcuts: 'shortcuts',
  fixExpenses: 'fixExpenses',
}

const TRACKING_MODE = [
  'Individual', 'Shortcuts', 'Fix'
]

// if there is no config in the '_configuration' file, then provide an example config
const EXAMPLE_CONFIG = `  
  /* >> expenses plugin start <<
   * for more information please have a look at the plugins' readme
   */
  expenses: {
    // just an example folderPath - please adapt to your needs
    ${CONFIG_KEYS.folderPath}: 'finances',
    // just some example clusters - please adapt to your needs
    ${CONFIG_KEYS.clusters}: [
      'Living',
      'Groceries',
      'Insurances',
      'Mobility',
      'Media',
      'Fun',
    ],
    // just some example shortcuts - please adapt to your needs
    ${CONFIG_KEYS.shortcuts}: [
      'Mobility;Refuel',
      'Groceries;XYZ Market',
    ],
    // just some example fix expenses - please adapt to your needs
    ${CONFIG_KEYS.fixExpenses}: [
      {
        cluster: 'Living',
        text: 'Flat Rent',
        amount: 670,
        month: 0,
        active: true,
      },
      {
        cluster: 'Insurances',
        text: 'Car Insurance',
        amount: 399,
        month: 1,
        active: true,
      },
      {
        cluster: 'Media',
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
 * @description expenses tracking with three posibilities (individual, shortcuts, fix)
 * @returns {Promise<boolean>}
 */
const expensesTracking = async (): Promise<boolean> => {
  const config = await provideConfig()
  if (!config.folderPath) {
    return false
  }

  const { year, month } = getYearMonthDate(new Date())

  if (config.clusters.length < 1) {
    // if there are no clusters configured, then stop
    logError('no clusters configured')
    return false
  }

  const mode = await CommandBar.showOptions(TRACKING_MODE, 'Please choose tracking mode')

  const noteTitle = `${year} Expenses Tracking`

  if (!await provideAndCheckNote(noteTitle, config.folderPath, true)) {
    return false
  }

  switch (mode.value) {
    case TRACKING_MODE[0]:
      return individualTracking(config, year, month, noteTitle)
    case TRACKING_MODE[1]:
      return shortcutsTracking(config, year, month, noteTitle)
    case TRACKING_MODE[2]:
      return fixTracking(config, year, month, noteTitle)
    default:
      return false
  }
}

/**
 * @description aggregates expenses of given year to a new note
 * @returns {Promise<boolean>}
 */
const expensesAggregate = async (): Promise<boolean> => {
  const config = await provideConfig()
  if (!config.folderPath) {
    return false
  }

  const year = await CommandBar.showInput('Please type in the year to aggregate', 'Start aggregate')

  const noteTitleTracking = `${year} Expenses Tracking`
  if (!await provideAndCheckNote(noteTitleTracking, config.folderPath, false, year)) {
    return false
  }

  const noteTitleAggregate = `${year} Expenses Aggregate`
  if (!await provideAndCheckNote(noteTitleAggregate, config.folderPath, true)) {
    return false
  }

  await Editor.openNoteByTitle(noteTitleTracking)
  let trackingData = Editor.paragraphs
    .filter(para => !para.rawContent.startsWith('#'))
    .map(para => extractExpenseRowFromCsvRow(para.rawContent))

  trackingData = aggregateClusterPerMonth(trackingData)

  if (trackingData.length > 0) {
    await Editor.openNoteByTitle(noteTitleAggregate)
    Editor.removeParagraphs(Editor.paragraphs
      .filter(para => !para.rawContent.startsWith('#')))
    // add results
    trackingData.forEach(res => {
      if (res.year) {
        const line = `${year};${leftPadWithZeros(res.month, 2)};${res.cluster};${Math.round(res.amount)}`
        Editor.appendParagraph(line, 'text')
      }
    })

    return true
  }

  return false
}

/**
 * @private
 */
const individualTracking = async (config: Config, year: number, month: number, noteTitle: string): Promise<boolean> => {
  const cluster = await CommandBar.showOptions(config.clusters, 'Please choose cluster')
  const text = await CommandBar.showInput('Please type in some text (no semicolon)', 'Add text to expenses line')
  const amount = await inputNumber('Please type in amount (only integer numbers)')

  if (!cluster || !text || isNaN(amount)) {
    // if user missed some input, then stop
    logError('an input was missing')
    return false
  }

  await Editor.openNoteByTitle(noteTitle)
  const line = `${year};${leftPadWithZeros(month, 2)};${cluster.value};${text};${Math.round(amount)}`
  Editor.appendParagraph(line, 'text')

  return true
}

/**
 * @private
 */
const shortcutsTracking = async (config: Config, year: number, month: number, noteTitle: string): Promise<boolean> => {
  const shortcut = await CommandBar.showOptions(config.shortcuts, 'Please choose shortcut')
  const amount = await inputNumber('Please type in amount (only integer numbers)')

  const splittedShortcut = shortcut.value.split(';')

  if (!splittedShortcut[0] || !splittedShortcut[1] || isNaN(amount)) {
    // if user missed some input, then stop
    logError('an input was missing')
    return false
  }

  await Editor.openNoteByTitle(noteTitle)
  const line = `${year};${leftPadWithZeros(month, 2)};${splittedShortcut[0]};${splittedShortcut[1]};${Math.round(amount)}`
  Editor.appendParagraph(line, 'text')

  return true
}

/**
 * @private
 */
const fixTracking = async (config: Config, year: number, month: number, noteTitle: string): Promise<boolean> => {
  await Editor.openNoteByTitle(noteTitle)
  config.fixExpenses
    .filter(exp => exp.active && (exp.month === 0 || exp.month === Number(month)))
    .forEach(exp => {
      const line = `${year};${leftPadWithZeros(month, 2)};${exp.cluster};${exp.text};${Math.round(exp.amount)}`
      Editor.appendParagraph(line, 'text')
      console.log('--- aa')
    })

  return true
}

/**
 * @private
 */
const provideConfig = (): Promise<Config> => {
  return getOrMakeConfigurationSection(
    'expenses',
    EXAMPLE_CONFIG
  )
    .then(result => {
      if (result == null || Object.keys(result).length === 0) {
        logError('exptected config could not be found in the _configuration file')
        return {
          folderPath: '',
          clusters: [],
          shortcuts: [],
          fixExpenses: []
        }
      } else {
        logMessage(`loaded config >>${JSON.stringify(result)}<<`)
        const config: Config = {
          folderPath: extractStringFromMixed(result, CONFIG_KEYS.folderPath),
          clusters: extractStringArrayFromMixed(result, CONFIG_KEYS.clusters),
          shortcuts: extractStringArrayFromMixed(result, CONFIG_KEYS.shortcuts),
          fixExpenses: extractFixExpensesArrayFromMixed(result, CONFIG_KEYS.fixExpenses),
        }
        return config
      }
    })
}

/**
 * @private
 */
const provideAndCheckNote = async (noteTitle: string,
                                   folderPath: string,
                                   createNote: boolean,
                                   year?: string): Promise<boolean> => {
  const notes = DataStore.projectNoteByTitle(noteTitle)

  // create note if it de
  if (notes) {
    if (notes.length > 1) {
      // if there are multiple notes with same title
      logError('there are multiple notes with same title')
      return false
    }
    if (notes.length < 1) {
      if (createNote) {
        await DataStore.newNote(noteTitle, folderPath)
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

export { expensesTracking, expensesAggregate }
