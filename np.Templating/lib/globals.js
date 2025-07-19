/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow
/* eslint-disable */

import moment from 'moment/min/moment-with-locales'

import pluginJson from '../plugin.json'

import { datePicker, askDateInterval } from '@helpers/userInput'
import { getFormattedTime } from '@helpers/dateTime'
import DateModule from './support/modules/DateModule'
import { format } from './support/modules/DateModule'
import { time } from './support/modules/TimeModule'
import { getAffirmation } from './support/modules/affirmation'
import { getAdvice } from './support/modules/advice'
import { getDailyQuote } from './support/modules/quote'
import { getStoicQuote } from './support/modules/stoicQuotes'
import { getVerse } from './support/modules/verse'
import { getWOTD } from './support/modules/wotd'
import { getWeather } from './support/modules/weather'
import { getWeatherSummary } from './support/modules/weatherSummary'
import { parseJSON5 } from '@helpers/general'
import { getSetting } from '../../helpers/NPConfiguration'
import { log, logError, clo, logDebug } from '@helpers/dev'
import { getNote } from '@helpers/note'
import { journalingQuestion } from './support/modules/journal'
import FrontmatterModule from './support/modules/FrontmatterModule'
import { isCommandAvailable, invokePluginCommandByName, transformInternationalDateFormat } from './utils'

/**
 * Collection of global methods available in NotePlan Templating
 */
const globals = {
  moment: moment,

  affirmation: async (): Promise<string> => {
    return await getAffirmation()
  },

  stoicQuote: async (): Promise<string> => {
    return await getStoicQuote()
  },

  advice: async (): Promise<string> => {
    return await getAdvice()
  },

  datePicker: async (params: ?string, config: any): Promise<string | false> => {
    return await datePicker(params, config)
  },

  quote: async (): Promise<string> => {
    return await getDailyQuote()
  },

  verse: async (): Promise<string> => {
    return await getVerse()
  },

  format: async (formatstr: string = '%Y-%m-%d %I:%M:%S %P'): Promise<string> => {
    return await format(formatstr)
  },

  wotd: async (): Promise<string> => {
    return await getWOTD()
  },

  journalingQuestion: async (): Promise<string> => {
    return await journalingQuestion()
  },

  legacyDate: async (params: any = ''): Promise<string> => {
    return await transformInternationalDateFormat(JSON.stringify(params), {})
  },

  progressUpdate: async (params: any): Promise<string> => {
    return await invokePluginCommandByName('jgclark.Summaries', 'progressUpdate', [params])
  },

  todayProgressFromTemplate: async (params: any): Promise<string> => {
    return await invokePluginCommandByName('jgclark.Summaries', 'todayProgressFromTemplate', [JSON.stringify(params)])
  },

  weather: async (formatParam: string = ''): Promise<string> => {
    let weatherFormat = (await getSetting(pluginJson['plugin.id'], 'weatherFormat', '')) || ''
    if (formatParam.length > 0) {
      weatherFormat = formatParam
    }
    logDebug(`weather format: "${weatherFormat}", will call ${weatherFormat.length === 0 ? 'getWeather' : 'getWeatherSummary'}`)
    return weatherFormat.length === 0 ? await getWeather() : await getWeatherSummary(weatherFormat)
  },

  date8601: async (): Promise<string> => {
    return await invokePluginCommandByName('dwertheimer.DateAutomations', 'date8601', null)
  },

  currentDate: async (params: any): Promise<string> => {
    return await transformInternationalDateFormat(JSON.stringify(params), {})
  },

  pickDate: async (dateParams: any = '', config: { [string]: ?mixed }): Promise<string> => {
    return `**The 'pickDate' helper has been deprecated, you should modify template to use 'promptDate(...) method.**'`
  },

  pickDateInterval: async (dateParams: any): Promise<string> => {
    return `**'pickDateInterval' has been deprecated, you should modify template to use 'promptDateInterval(...) method.**'`
  },

  events: async (dateParams?: any): Promise<string> => {
    return await invokePluginCommandByName('jgclark.EventHelpers', 'listDaysEvents', [JSON.stringify(dateParams)])
  },

  listTodaysEvents: async (params?: any = ''): Promise<string> => {
    return await invokePluginCommandByName('jgclark.EventHelpers', 'listDaysEvents', [JSON.stringify(params)])
  },

  matchingEvents: async (params: ?any = ''): Promise<string> => {
    return await invokePluginCommandByName('jgclark.EventHelpers', 'listMatchingDaysEvents', [JSON.stringify(params)])
  },

  listMatchingEvents: async (params: ?any = ''): Promise<string> => {
    return await invokePluginCommandByName('jgclark.EventHelpers', 'listMatchingDaysEvents', [JSON.stringify(params)])
  },

  formattedDateTime: (params: any): string => {
    const dateFormat = typeof params === 'object' && params.hasOwnProperty('format') ? params.format : params
    return getFormattedTime(dateFormat)
  },

  weekDates: async (params: any): Promise<string> => {
    return await invokePluginCommandByName('dwertheimer.DateAutomations', 'getWeekDates', [JSON.stringify(params)])
  },

  now: async (format?: string, offset?: string | number): Promise<string> => {
    const dateModule = new DateModule()
    return dateModule.now(format, offset)
  },

  timestamp: async (format?: string): Promise<string> => {
    const dateModule = new DateModule()
    return dateModule.timestamp(format)
  },

  currentTime: async (): Promise<string> => {
    return time()
  },

  currentDate: async (): Promise<string> => {
    return globals.now()
  },

  selection: async (): Promise<string> => {
    return await Editor.selectedParagraphs.map((para) => para.rawContent).join('\n')
  },

  getRandomLine: async (noteTitle: string): Promise<string> => {
    const noteModule = new (await import('./support/modules/NoteModule')).default({})
    return await noteModule.getRandomLine(noteTitle)
  },

  clo: (obj: any, preamble: string = '', space: string | number = 2): void => {
    clo(obj, preamble, space)
  },

  getValuesForKey: async (tag: string): Promise<string> => {
    try {
      const frontmatterModule = new FrontmatterModule()
      const result = await frontmatterModule.getValuesForKey(tag)
      return result
    } catch (error) {
      logError(pluginJson, `getValuesForKey error: ${error}`)
      return ''
    }
  },

  // Fix Flow type error by making parameter optional and handling null case
  getFrontmatterAttributes: (note?: CoreNoteFields): { [string]: string } => {
    try {
      const targetNote = note || Editor?.note
      if (!targetNote) {
        logError(pluginJson, `getFrontmatterAttributes: note is null or undefined`)
        return {}
      }

      const frontmatterModule = new FrontmatterModule()
      return frontmatterModule.getFrontmatterAttributes(targetNote)
    } catch (error) {
      logError(pluginJson, `getFrontmatterAttributes error: ${error}`)
      return {}
    }
  },

  updateFrontmatterVars: (note: TEditor | TNote, newAttributes: { [string]: string }, deleteMissingAttributes: boolean = false): boolean => {
    try {
      const frontmatterModule = new FrontmatterModule()
      return frontmatterModule.updateFrontMatterVars(note, newAttributes, deleteMissingAttributes)
    } catch (error) {
      logError(pluginJson, `frontmatter.updateFrontMatterVars error: ${error}`)
      return false
    }
  },

  updateFrontmatterAttributes: (note: TEditor | TNote, newAttributes: { [string]: string }, deleteMissingAttributes: boolean = false): boolean => {
    try {
      const frontmatterModule = new FrontmatterModule()
      return frontmatterModule.updateFrontmatterAttributes(note, newAttributes, deleteMissingAttributes)
    } catch (error) {
      logError(pluginJson, `frontmatter.updateFrontmatterAttributes error: ${error}`)
      return false
    }
  },

  // Fix Flow type error by being more explicit about return type
  getNote: async (...params: any): Promise<TNote | null> => {
    if (params.length === 0) {
      return Editor.note || null
    }
    return (await getNote(...params)) || null
  },
}

export default globals

/**
 * List of async functions that should be awaited when called in templates
 */
export const asyncFunctions = [
  'CommandBar.chooseOption',
  'CommandBar.prompt',
  'CommandBar.textInput',
  'DataStore.invokePluginCommandByName',
  'advice',
  'affirmation',
  'currentDate',
  'currentTime',
  'datePicker',
  'date8601',
  'doSomethingElse',
  'events',
  'existingAwait',
  'format',
  'frontmatter.getValuesForKey',
  'frontmatter.getFrontmatterAttributes',
  'frontmatter.updateFrontmatterVars',
  'frontmatter.updateFrontmatterAttributes',
  'frontmatter.properties',
  'frontmatter.getFrontmatterAttributes',
  'frontmatter.updateFrontMatterVars',
  'frontmatter.updateFrontMatterAttributes',
  'getFrontmatterAttributes',
  'getNote',
  'getValuesForKey',
  'invokePluginCommandByName',
  'journalingQuestion',
  'listEvents',
  'listMatchingEvents',
  'listTodaysEvents',
  'logError',
  'matchingEvents',
  'note.content',
  'note.getRandomLine',
  'note.selection',
  'np.weather',
  'now',
  'processData',
  'progressUpdate',
  'stoicQuote',
  'todayProgressFromTemplate',
  'quote',
  'selection',
  'tasks.getSyncedOpenTasksFrom',
  'timestamp',
  'updateFrontmatterVars',
  'updateFrontmatterAttributes',
  'verse',
  'weather',
  'web.advice',
  'web.affirmation',
  'web.journalingQuestion',
  'web.quote',
  'web.services',
  'web.stoicQuote',
  'web.verse',
  'web.weather',
  'weekDates',
  'wotd',
]

/**
 * Top-level NotePlan objects available globally in templates
 */
export const notePlanTopLevelObjects = ['Editor', 'DataStore', 'CommandBar', 'Calendar', 'NotePlan', 'HTMLView', 'Clipboard', 'Range', 'CalendarItem', 'fetch', 'globalThis']
