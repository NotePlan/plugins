// @flow

import { getDailyQuote } from './quote'
import { getWeather } from './weather'
import { getAffirmation } from './affirmation'
import { getAdvice } from './advice'
import { getService } from './service'

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

  async weather(): Promise<string> {
    return await getWeather()
  }

  async service(templateConfig: any, serviceUrl: string = '', key: string = ''): Promise<string> {
    return await getService(templateConfig, serviceUrl, key)
  }
}
