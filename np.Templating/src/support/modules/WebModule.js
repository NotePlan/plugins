// @flow

import { getOrMakeConfigurationSection } from '../configuration'

import { getDailyQuote } from './quote'
import { getWeather } from './weather'
import { getAffirmation } from './affirmation'
import { getAdvice } from './advice'
import { getService } from './service'

export default class WebModule {
  constructor(config: any = {}) {
    // $FlowFixMe
    this.config = config
  }

  static async advice(): Promise<string> {
    return await getAdvice()
  }

  static async affirmation(): Promise<string> {
    return await getAffirmation()
  }

  static async quote(): Promise<string> {
    const quoteConfig = await getOrMakeConfigurationSection('quote')

    return await getDailyQuote(null, { quote: quoteConfig })
  }

  static async weather(): Promise<string> {
    return await getWeather()
  }

  static async service(serviceUrl: string = '', key: string = ''): Promise<string> {
    return await getService(serviceUrl, key)
  }
}
