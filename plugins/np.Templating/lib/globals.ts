/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rig`hts reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow
/* eslint-disable */

import pluginJson from '../plugin.json'

import { datePicker, askDateInterval } from '@np/helpers/userInput'
import { getFormattedTime } from '@np/helpers/dateTime'
import DateModule from './support/modules/DateModule'
import { now, timestamp } from './support/modules/DateModule'
import { time } from './support/modules/TimeModule'
import { getAffirmation } from './support/modules/affirmation'
import { getAdvice } from './support/modules/advice'
import { getDailyQuote } from './support/modules/quote'
import { getWOTD } from './support/modules/wotd'
import { getWeather } from './support/modules/weather'
import { getWeatherSummary } from './support/modules/weatherSummary'
import { parseJSON5 } from '@np/helpers/general'
import { getSetting } from '@np/helpers/NPConfiguration'
import { log, logError, clo } from '@np/helpers/dev'

export async function processDate(dateParams: string, config: { [k: string]: null | void | unknown }): Promise<string> {
  // @ts-expect-error
  const defaultConfig = config?.date ?? {}
  const dateParamsTrimmed = dateParams?.trim() || ''
  const paramConfig =
    dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}') ? await parseJSON5(dateParams) : dateParamsTrimmed !== '' ? await parseJSON5(`{${dateParams}}`) : {}
  // console.log(`param config: ${dateParams} as ${JSON.stringify(paramConfig)}`);
  // ... = "gather the remaining parameters into an array"
  const finalArguments: { [k: string]: unknown } = {
    ...defaultConfig,
    ...paramConfig,
  }

  // Grab just locale parameter
  const { locale, ...otherParams } = (finalArguments as any)

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
      // @ts-ignore
      let command = commands.filter((command) => {
        return command.name === pluginCommand
      })

      return Array.isArray(command) && command.length > 0
    } else {
      return false
    }
  } catch (error: any) {
    logError(pluginJson, error)
    return false
  }
}

async function invokePluginCommandByName(pluginId: string = '', pluginCommand: string = '', args: ReadonlyArray<unknown> = []) {
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
  affirmation: async (): Promise<string> => {
    return getAffirmation()
  },

  advice: async (): Promise<string> => {
    return getAdvice()
  },

  quote: async (): Promise<string> => {
    return getDailyQuote()
  },

  wotd: async (): Promise<string> => {
    return getWOTD()
  },

  legacyDate: async (params: any = ''): Promise<string> => {
    // @ts-ignore
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
    let weatherFormat = getSetting(pluginJson['plugin.id'], 'weatherFormat', '') || ''
    if (formatParam.length > 0) {
      weatherFormat = formatParam
    }
    return weatherFormat === 0 ? await getWeather() : await getWeatherSummary(weatherFormat)
  },

  date8601: async (): Promise<string> => {
    // @ts-ignore
    return await invokePluginCommandByName('dwertheimer.DateAutomations', 'date8601', null)
  },

  // NOTE: This specific method would create a collision against DateModule I believe (needs testing)
  currentDate: async (params: any): Promise<string> => {
    // @ts-ignore
    return await processDate(JSON.stringify(params))
  },

  pickDate: async (dateParams: any = '', config: { [k: string]: null | void | unknown }): Promise<string> => {
    return `**The 'pickDate' helper has been deprecated, you should modify template to use 'promptDate(...) method.**'`
  },

  pickDateInterval: async (dateParams: any): Promise<string> => {
    return `**'pickDateInterval' has been deprecated, you should modify template to use 'promptDateInterval(...) method.**'`
  },

  events: async (dateParams?: any): Promise<string> => {
    return invokePluginCommandByName('jgclark.EventHelpers', 'listDaysEvents', [JSON.stringify(dateParams)])
  },

  listTodaysEvents: async (params: unknown = ''): Promise<string> => {
    return invokePluginCommandByName('jgclark.EventHelpers', 'listDaysEvents', [JSON.stringify(params)])
  },

  matchingEvents: async (params: null | void | any = ''): Promise<string> => {
    return invokePluginCommandByName('jgclark.EventHelpers', 'listMatchingDaysEvents', [JSON.stringify(params)])
  },

  listMatchingEvents: async (params: null | void | any = ''): Promise<string> => {
    return invokePluginCommandByName('jgclark.EventHelpers', 'listMatchingDaysEvents', [JSON.stringify(params)])
  },

  sweepTasks: async (params: any = ''): Promise<string> => {
    return invokePluginCommandByName('nmn.sweep', 'sweepTemplate', [JSON.stringify(params)])
  },

  formattedDateTime: (params: any): string => {
    const dateFormat = typeof params === 'object' && params.hasOwnProperty('format') ? params.format : params
    return getFormattedTime(dateFormat)
  },

  weekDates: async (params: any): Promise<string> => {
    // @ts-ignore
    return invokePluginCommandByName('dwertheimer.DateAutomations', 'getWeekDates', [JSON.stringify(params)])
  },

  now: async (): Promise<string> => {
    return now()
  },

  timestamp: async (): Promise<string> => {
    return timestamp()
  },

  currentTime: async (): Promise<string> => {
    return time()
  },

  // currentDate: async (): Promise<string> => {
  //   return now()
  // },

  selection: async (): Promise<string> => {
    return Editor.selectedParagraphs.map((para) => para.rawContent).join('\n')
  },

  clo: (obj: any, preamble: string = '', space: string | number = 2): void => {
    clo(obj, preamble, space)
  },
}

// module.exports = globals
export default globals
