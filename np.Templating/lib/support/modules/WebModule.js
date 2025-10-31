// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { getVerse } from './verse'
import { getWOTD } from './wotd'
import { getAdvice } from './advice'
import { getService } from './data/service'
import { getDailyQuote } from './quote'
import { getAffirmation } from './affirmation'
import { getStoicQuote } from './stoicQuotes'
import { journalingQuestion } from './journal'
import { getNotePlanWeather } from './notePlanWeather'

export default class WebModule {
  async advice(): Promise<string> {
    return await getAdvice()
  }

  async affirmation(): Promise<string> {
    return await getAffirmation()
  }

  async quote(): Promise<string> {
    return await getDailyQuote()
  }

  async stoicQuote(): Promise<string> {
    return await getStoicQuote()
  }

  async weather(templateConfig: any, params: string = '', units: string = 'metric', latitude: number = 0, longitude: number = 0): Promise<string | any> {
    let weatherFormat = params.length > 0 ? params : ''
    // eslint-disable-next-line
    weatherFormat = weatherFormat.length === 0 && templateConfig?.weatherFormat?.length > 0 ? templateConfig?.weatherFormat : weatherFormat
    // eslint-disable-next-line
    return await getNotePlanWeather(weatherFormat, units, latitude, longitude)
  }

  async verse(): Promise<string> {
    return await getVerse()
  }

  async service(templateConfig: any, serviceUrl: string = '', key: string = ''): Promise<string> {
    return await getService(templateConfig, serviceUrl, key)
  }

  async wotd(templateConfig: any, params: any = ''): Promise<string> {
    const confg = { ...templateConfig, ...params }
    return await getWOTD(confg)
  }

  async journalingQuestion(): Promise<string> {
    return await journalingQuestion()
  }

  async getRandomLine(noteTitle: string): Promise<string> {
    const noteModule = new (await import('./NoteModule')).default({})
    return await noteModule.getRandomLine(noteTitle)
  }
}
