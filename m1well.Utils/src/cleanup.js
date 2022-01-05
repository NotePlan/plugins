// @flow

import { addDays, differenceInCalendarDays, startOfTomorrow } from 'date-fns'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'
import type { Config } from './utilsHelper'
import {
  castNumberFromMixed,
  castStringFromMixed,
  futureDateFromInputOrTomorrow,
  getDailyNote,
  logError,
  logMessage,
  sortByPrio,
  sortByType
} from './utilsHelper'

const CONFIG_KEYS = {
  autoArchiveTag: 'autoArchiveTag',
  autoArchiveLifeInDays: 'autoArchiveLifeInDays',
}

// if there is no config in the '_configuration' file, then provide an example config
// currently only needed for autoArchiveNotes command
const EXAMPLE_CONFIG = `  
  /* >> utils plugin start <<
   * for more information please have a look at the plugins' readme
   */
  utils: {
    // just an example autoArchiveTag - please adapt to your needs
    ${CONFIG_KEYS.autoArchiveTag}: '#scratch',
    // here you can enter the amount of days (> 0!) of the auto archive lifetime notes
    ${CONFIG_KEYS.autoArchiveLifeInDays}: 7,
  },
  /* >> utils plugin end << */
`

/**
 * sort lines
 *
 * @private
 */
const sorter = async (): Promise<boolean> => {

  const selectedParagraphs = Editor.selectedParagraphs

  if (selectedParagraphs.length > 1) {
    let firstIndex = 0

    // check at least 2 paragraphs against all paragraphs and then get the first line index
    // otherwise it gets inserted at lineIndex = 0
    for (let i = 0; i < Editor.paragraphs.length; i++) {
      if (Editor.paragraphs[i].rawContent === selectedParagraphs[0].rawContent
        && Editor.paragraphs[i + 1].rawContent === selectedParagraphs[1].rawContent) {
        firstIndex = Editor.paragraphs[i].lineIndex
      }
    }

    const selectedNonTasksAndList = selectedParagraphs.filter(para => para.type !== 'open' && para.type !== 'scheduled'
      && para.type !== 'done' && para.type !== 'cancelled' && para.type !== 'list')

    const selected = selectedParagraphs.filter(para => para.type === 'open' || para.type === 'scheduled'
      || para.type === 'done' || para.type === 'cancelled' || para.type === 'list')

    Editor.removeParagraphs(selectedParagraphs)

    selected
      .sort(sortByType())
      .sort(sortByPrio())
      .forEach((para, i) => Editor.insertParagraph(para.content, firstIndex + i, para.type))

    selectedNonTasksAndList
      .forEach((para, i) => Editor.insertParagraph(para.content, firstIndex + selected.length + i, para.type))

    return true
  }

  return false
}

/**
 * archive specific notes automatically
 *
 * @returns {Promise<boolean>}
 */
const autoArchiveNotes = async (): Promise<boolean> => {
  const config = await provideValidConfig()

  DataStore.projectNotes.forEach(note => {
    // check tag
    if (note && note.hashtags.length > 0 && note.hashtags.includes(config.autoArchiveTag) && note.title) {
      // check lifetime
      if (addDays(note.createdDate, config.autoArchiveLifeInDays) <= new Date()) {
        logMessage(`Note '${String(note.title)}' ready to archive`)
        DataStore.moveNote(note.filename, '@Archive')
      }
    }
  })

  return true
}

/**
 * clean up empty lines in future daily notes
 *
 * @returns {Promise<boolean>}
 */
const cleanUpEmptyLinesInFuture = async (): Promise<boolean> => {

  const targetDate = await futureDateFromInputOrTomorrow('Future target date? (empty for tomorrow)')

  let date = startOfTomorrow()
  const diff = differenceInCalendarDays(targetDate, date)
  for (let i = 0; i <= diff; i++) {
    const note = getDailyNote(date)
    if (note && note.paragraphs.length > 0) {
      for (let j = 0; j < note.paragraphs.length; j++) {
        if (note.paragraphs[j].rawContent === '') {
          note.removeParagraph(note.paragraphs[j])
        }
      }
    }
    date = addDays(date, 1)
  }

  return true
}

/**
 * provide config from _configuration and cast content to real objects
 *
 * @private
 */
const provideValidConfig = (): Promise<Config> => {
  const emptyConfig = {
    autoArchiveTag: '',
    autoArchiveLifeInDays: 0,
  }
  return getOrMakeConfigurationSection(
    'utils',
    EXAMPLE_CONFIG
  )
    .then(result => {
      if (result == null || Object.keys(result).length === 0) {
        logError('expected config could not be found in the _configuration file')
        return emptyConfig
      } else {
        logMessage(`loaded config\n${JSON.stringify(result)}\n`)
        const config: Config = {
          autoArchiveTag: castStringFromMixed(result, CONFIG_KEYS.autoArchiveTag),
          autoArchiveLifeInDays: castNumberFromMixed(result, CONFIG_KEYS.autoArchiveLifeInDays),
        }
        const validate = validateConfig(config)
        if (validate) {
          logError(validate)
          return emptyConfig
        }
        return config
      }
    })
}

/**
 * validade the config
 *
 * @private
 */
const validateConfig = (config: Config): string | null => {
  if (!config.autoArchiveTag.startsWith('#') || config.autoArchiveTag.length < 2) {
    return `autoArchiveTag has no '#' or is too short`
  }
  if (config.autoArchiveLifeInDays < 1) {
    return 'autoArchiveLifeInDays is too small'
  }
  return null
}

export { sorter, autoArchiveNotes, cleanUpEmptyLinesInFuture }
