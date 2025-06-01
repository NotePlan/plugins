/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rig`hts reserved.
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
import { getWOTD } from './support/modules/wotd'
import { getWeather } from './support/modules/weather'
import { getWeatherSummary } from './support/modules/weatherSummary'
import { parseJSON5 } from '@helpers/general'
import { getSetting } from '../../helpers/NPConfiguration'
import { log, logError, clo, logDebug } from '@helpers/dev'
import { getNote } from '@helpers/note'
import { journalingQuestion } from './support/modules/journal'
import FrontmatterModule from './support/modules/FrontmatterModule'

export async function processDate(dateParams: string, config: { [string]: ?mixed }): Promise<string> {
  logDebug(`globals::processDate: ${dateParams} as ${JSON.stringify(config)}`)
  const defaultConfig = config?.date ?? {}
  const dateParamsTrimmed = dateParams?.trim() || ''
  const paramConfig =
    dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}') ? await parseJSON5(dateParams) : dateParamsTrimmed !== '' ? await parseJSON5(`{${dateParams}}`) : {}
  // logDebug(`param config: ${dateParams} as ${JSON.stringify(paramConfig)}`);
  // ... = "gather the remaining parameters into an array"
  const finalArguments: { [string]: mixed } = {
    ...defaultConfig,
    ...paramConfig,
  }

  // Grab just locale parameter
  const { locale, ...otherParams } = (finalArguments: any)

  const localeParam = locale != null ? String(locale) : []
  const secondParam = {
    dateStyle: 'short',
    ...otherParams,
  }

  return new Intl.DateTimeFormat(localeParam, secondParam).format(new Date())
}

async function isCommandAvailable(pluginId: string, pluginCommand: string): Promise<boolean> {
  try {
    let result = DataStore.installedPlugins().filter((plugin) => {
      return plugin.id === pluginId
    })

    let commands = typeof result !== 'undefined' && Array.isArray(result) && result.length > 0 && result[0].commands
    if (commands) {
      // $FlowIgnore
      let command = commands.filter((command) => {
        return command.name === pluginCommand
      })

      return Array.isArray(command) && command.length > 0
    } else {
      return false
    }
  } catch (error) {
    logError(pluginJson, error)
    return false
  }
}

async function invokePluginCommandByName(pluginId: string = '', pluginCommand: string = '', args: $ReadOnlyArray<mixed> = []) {
  if (await isCommandAvailable(pluginId, pluginCommand)) {
    return (await DataStore.invokePluginCommandByName(pluginCommand, pluginId, args)) || ''
  } else {
    // const info = helpInfo('Plugin Error')
    const info = ''
    return `**Unable to locate "${pluginId} :: ${pluginCommand}".  Make sure "${pluginId}" plugin has been installed.**\n\n${info}`
  }
}

/*
   np.Templating Global Methods
*/

const globals = {
  moment: moment,

  affirmation: async (): Promise<string> => {
    return await getAffirmation()
  },

  advice: async (): Promise<string> => {
    return await getAdvice()
  },

  quote: async (): Promise<string> => {
    return await getDailyQuote()
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
    // $FlowIgnore
    return await processDate(JSON.stringify(params))
  },

  progressUpdate: async (params: any): Promise<string> => {
    return await invokePluginCommandByName('jgclark.Summaries', 'progressUpdate', [params])
    // Note: Previously did JSON.stringify(params), but removing this means we can distinguish between template and callback triggers in the plugin code.
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
    // $FlowIgnore
    return await invokePluginCommandByName('dwertheimer.DateAutomations', 'date8601', null)
  },

  // NOTE: This specific method would create a collision against DateModule I believe (needs testing)
  currentDate: async (params: any): string => {
    // $FlowIgnore
    return await processDate(JSON.stringify(params))
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
    // $FlowIgnore
    return await invokePluginCommandByName('dwertheimer.DateAutomations', 'getWeekDates', [JSON.stringify(params)])
  },

  now: async (format?: string, offset?: string | number): Promise<string> => {
    const dateModule = new DateModule() // Use default config for global helper
    // $FlowFixMe[incompatible-call] - DateModule.now expects (string, string|number) but offset could be undefined if not passed.
    // The class method now(format = '', offset = '') handles undefined/empty string for format/offset.
    return dateModule.now(format, offset)
  },

  timestamp: async (format?: string): Promise<string> => {
    const dateModule = new DateModule()
    // $FlowFixMe[incompatible-call] - DateModule.timestamp expects (string) but format could be undefined.
    // The class method timestamp(format = '') handles undefined/empty string.
    return dateModule.timestamp(format)
  },

  currentTime: async (): Promise<string> => {
    return time()
  },

  currentDate: async (): Promise<string> => {
    // Calls the 'now' function defined within this same globals object.
    // It will use default format and no offset.
    return globals.now()
  },

  selection: async (): Promise<string> => {
    return await Editor.selectedParagraphs.map((para) => para.rawContent).join('\n')
  },

  clo: (obj: any, preamble: string = '', space: string | number = 2): void => {
    clo(obj, preamble, space)
  },

  // get all the values in frontmatter for all notes for a given key
  getValuesForKey: async (tag: string): Promise<string> => {
    try {
      // Create an instance of FrontmatterModule and use it to get values
      const frontmatterModule = new FrontmatterModule()
      const result = await frontmatterModule.getValuesForKey(tag)

      // Return the string result
      return result
    } catch (error) {
      // Log the error but don't throw it - this helps with resilience
      logError(pluginJson, `getValuesForKey error: ${error}`)

      // Return an empty array string as fallback
      return ''
    }
  },

  // get frontmatter attributes from a note
  getFrontmatterAttributes: (note: CoreNoteFields = Editor?.note || null): { [string]: string } => {
    try {
      // Defensive check: ensure the note object exists
      if (!note) {
        logError(pluginJson, `getFrontmatterAttributes: note is null or undefined`)
        return {}
      }

      const frontmatterModule = new FrontmatterModule()
      return frontmatterModule.getFrontmatterAttributes(note)
    } catch (error) {
      logError(pluginJson, `getFrontmatterAttributes error: ${error}`)
      return {}
    }
  },

  // update frontmatter attributes in a note
  updateFrontmatterVars: (note: TEditor | TNote, newAttributes: { [string]: string }, deleteMissingAttributes: boolean = false): boolean => {
    try {
      const frontmatterModule = new FrontmatterModule()
      return frontmatterModule.updateFrontMatterVars(note, newAttributes, deleteMissingAttributes)
    } catch (error) {
      logError(pluginJson, `frontmatter.updateFrontMatterVars error: ${error}`)
      return false
    }
  },

  // alias for updateFrontmatterVars
  updateFrontmatterAttributes: (note: TEditor | TNote, newAttributes: { [string]: string }, deleteMissingAttributes: boolean = false): boolean => {
    try {
      const frontmatterModule = new FrontmatterModule()
      return frontmatterModule.updateFrontmatterAttributes(note, newAttributes, deleteMissingAttributes)
    } catch (error) {
      logError(pluginJson, `frontmatter.updateFrontmatterAttributes error: ${error}`)
      return false
    }
  },

  // general purpose getNote helper
  getNote: async (...params: any): Promise<TNote | null> => {
    if (params.length === 0) return Editor.note
    return (await getNote(...params)) || null
  },
}

// module.exports = globals
export default globals

export const asyncFunctions = [
  'CommandBar.chooseOption',
  'CommandBar.prompt',
  'CommandBar.textInput',
  'DataStore.invokePluginCommandByName',
  'advice',
  'affirmation',
  'currentDate',
  'currentTime',
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
  'note.selection',
  'now',
  'processData',
  'progressUpdate',
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
  'web.verse',
  'web.weather',
  'weekDates',
  'wotd',
]

/**
 * Top-level NotePlan objects available globally in templates
 * These are the main application objects that plugins can interact with
 */
export const notePlanTopLevelObjects = ['Editor', 'DataStore', 'CommandBar', 'Calendar', 'NotePlan', 'HTMLView', 'Clipboard', 'Range', 'CalendarItem', 'fetch', 'globalThis']
