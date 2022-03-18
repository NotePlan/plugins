/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rig`hts reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

// @flow
import { datePicker, askDateInterval } from '@helpers/userInput'
import { get8601String, getWeekDates, formattedDateTimeTemplate } from '@plugins/dwertheimer.DateAutomations/src/dateFunctions'
import { getFormattedTime } from '@helpers/dateTime'
import { listDaysEvents, listMatchingDaysEvents } from '@plugins/jgclark.EventHelpers/src/eventsToNotes'
import { sweepTemplate } from '@plugins/nmn.sweep/src/sweepAll'
import DateModule from './support/modules/DateModule'
import { getAffirmation } from './support/modules/affirmation'
import { getAdvice } from './support/modules/advice'
import { getDailyQuote } from './support/modules/quote'
import { getWeather } from './support/modules/weather'
import { getDaysInMonth } from 'date-fns'
import { insertProgressUpdate } from '@plugins/jgclark.Summaries/src'
import { getWeatherSummary } from './support/modules/weatherSummary'
import { parseJSON5 } from '@helpers/general'

export async function processDate(dateParams: string, config: { [string]: ?mixed }): Promise<string> {
  // console.log(`processDate: ${dateConfig}`)
  const defaultConfig = config?.date ?? {}
  const dateParamsTrimmed = dateParams?.trim() || ''
  const paramConfig =
    dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}') ? await parseJSON5(dateParams) : dateParamsTrimmed !== '' ? await parseJSON5(`{${dateParams}}`) : {}
  // console.log(`param config: ${dateParams} as ${JSON.stringify(paramConfig)}`);
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
  // console.log(`${JSON.stringify(localeParam)}, ${JSON.stringify(secondParam)}`);

  return new Intl.DateTimeFormat(localeParam, secondParam).format(new Date())
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

  progressUpdate: async (params: any): Promise<string> => {
    // $FlowIgnore
    return await insertProgressUpdate(params)
  },

  weather: async (params: any = ''): Promise<string> => {
    return params.length === 0 ? await getWeather() : await getWeatherSummary(params)
  },

  date8601: async (): Promise<string> => {
    return await get8601String()
  },

  // NOTE: This specific method would create a collision against DateModule I believe (needs testing)
  currentDate: async (params: any): string => {
    // $FlowIgnore
    return await processDate(JSON.stringify(params))
  },

  pickDate: async (dateParams: any = '', config: { [string]: ?mixed }): Promise<string> => {
    return await datePicker(JSON.stringify(dateParams), config)
  },

  pickDateInterval: async (dateParams: any): Promise<string> => {
    return await askDateInterval(JSON.stringify(dateParams))
  },

  events: async (dateParams?: any): Promise<string> => {
    return await listDaysEvents(JSON.stringify(dateParams))
  },

  listTodaysEvents: async (params?: any = ''): Promise<string> => {
    return await listDaysEvents(JSON.stringify(params))
  },

  matchingEvents: async (params: ?any = ''): Promise<string> => {
    return await listMatchingDaysEvents(JSON.stringify(params))
  },

  listMatchingEvents: async (params: ?any = ''): Promise<string> => {
    return await listMatchingDaysEvents(JSON.stringify(params))
  },

  sweepTasks: async (params: any = ''): Promise<string> => {
    return await sweepTemplate(JSON.stringify(params))
  },

  formattedDateTime: (params: any): string => {
    let dateFormat = ''
    dateFormat = typeof params === 'object' && params.hasOwnProperty('format') ? params.format : ''
    return getFormattedTime(dateFormat)
  },

  weekDates: async (params: any): Promise<string> => {
    return await getWeekDates(JSON.stringify(params))
  },
}

// module.exports = globals
export default globals
