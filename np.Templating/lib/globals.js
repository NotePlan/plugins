// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rig`hts reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { datePicker, askDateInterval } from '@helpers/userInput'
import {
  get8601String,
  getWeekDates,
  formattedDateTimeTemplate,
} from '@plugins/dwertheimer.DateAutomations/src/dateFunctions'
import { listDaysEvents, listMatchingDaysEvents } from '@plugins/jgclark.EventHelpers/src/eventsToNotes'
import { sweepTemplate } from '@plugins/nmn.sweep/src/sweepAll'
import DateModule from './support/modules/DateModule'

/*
   np.Templating Global Methods
*/

module.exports = {
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
    return await sweepTemplate()
  },
  formattedDateTime: async (params: string = ''): Promise<string> => {
    return await formattedDateTimeTemplate(params)
  },
  weekDates: async (params: string = ''): Promise<string> => {
    return await getWeekDates(params)
  },
}
