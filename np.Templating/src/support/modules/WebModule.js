// @flow

import { getDailyQuote } from './quote'
import { getWeather } from './weather'
import { getAffirmation } from './affirmation'
import { getAdvice } from './advice'
import { getService } from './service'

export default class WebModule {
  static async advice(): Promise<string> {
    return await getAdvice()
  }

  static async affirmation(): Promise<string> {
    return await getAffirmation()
  }

  static async quote(): Promise<string> {
    return await getDailyQuote()
  }

  static async weather(): Promise<string> {
    return await getWeather()
  }

  static async service(templateConfig: any, serviceUrl: string = '', key: string = ''): Promise<string> {
    return await getService(templateConfig, serviceUrl, key)
  }
}
