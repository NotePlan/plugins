// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { getVerse } from './verse'
import { getAdvice } from './advice'
import { getWeather } from './weather'
import { getService } from './service'
import { getDailyQuote } from './quote'
import { getAffirmation } from './affirmation'
import { getWeatherSummary } from './weatherSummary'

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

  async weather(templateConfig: any, params: string = ''): Promise<string> {
    let weatherFormat = params.length > 0 ? params : ''
    weatherFormat = weatherFormat.length === 0 && templateConfig?.weatherFormat?.length > 0 ? templateConfig?.weatherFormat : weatherFormat

    return weatherFormat.length === 0 ? await getWeather() : await getWeatherSummary(weatherFormat)
  }

  async verse(): Promise<string> {
    return await getVerse()
  }

  async service(templateConfig: any, serviceUrl: string = '', key: string = ''): Promise<string> {
    return await getService(templateConfig, serviceUrl, key)
  }
}
