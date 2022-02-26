// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rig`hts reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

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
  date: (): string => {
    return new DateModule().now()
  },

  pickDate: async (dateParams: string = '', config: { [string]: ?mixed }): Promise<string> => {
    return await datePicker(dateParams, config)
  },

  pickDateInterval: async (dateParams: string): Promise<string> => {
    return await askDateInterval(dateParams)
  },

  events: async (dateParams?: string): Promise<string> => {
    return await listDaysEvents(dateParams)
  },

  listTodaysEvents: async (paramString?: string = ''): Promise<string> => {
    return await listDaysEvents(paramString)
  },

  matchingEvents: async (params: ?string = ''): Promise<string> => {
    return await listMatchingDaysEvents(params)
  },

  listMatchingEvents: async (params: ?string = ''): Promise<string> => {
    return await listMatchingDaysEvents(params)
  },

  sweepTasks: async (params: string = ''): Promise<string> => {
    return await sweepTemplate(params)
  },

  formattedDateTime: (params: any): string => {
    let dateFormat = ''
    dateFormat = typeof params === 'object' && params.hasOwnProperty('format') ? params.format : ''
    return getFormattedTime(dateFormat)
  },

  weekDates: async (params: string = ''): Promise<string> => {
    return await getWeekDates(params)
  },
}

// module.exports = globals
export default globals
