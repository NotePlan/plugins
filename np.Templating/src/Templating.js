// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { getUserLocale } from 'get-user-locale'

import ejs from './support/ejs'

import WebModule from './support/modules/WebModule'
import DateModule from './support/modules/DateModule'
import TimeModule from './support/modules/TimeModule'
import NoteModule from './support/modules/NoteModule'
import UtilsModule from './support/modules/UtilsModule'

export const DEFAULT_TEMPLATE_CONFIG = {
  locale: 'en-US',
  defaultFormats: {
    date: 'YYYY-MM-DD',
    time: 'HH:mm:ss A',
    now: 'YYYY-MM-DD h:mm:ss A',
  },
  user: {
    first: '',
    last: '',
    email: '',
    phone: '',
  },
  // $FlowFixMe
  services: {},
}

export default class Templating {
  templateConfig: any
  constructor(config: any) {
    this.templateConfig = config || DEFAULT_TEMPLATE_CONFIG
  }

  async heartbeat(): Promise<string> {
    return '```\n' + JSON.stringify(this.templateConfig, null, 2) + '\n```\n'
  }

  async templateErrorMessage(method: string = '', message: string = ''): Promise<string> {
    const line = '*'.repeat(message.length + 30)
    console.log(line)
    console.log(`   ERROR`)
    console.log(`   Method: ${method}:`)
    console.log(`   Message: ${message}`)
    console.log(line)
    console.log('\n')
    return `**Error: ${method}**\n- **${message}**`
  }

  async getTemplate(templateName: string = ''): Promise<string> {
    // const result = DataStore.projectNoteByFilename('📋 Templates/Templating Samples/Test (Standard).md')
    // const result = DataStore.projectNoteByFilename('Test/Folder Name/New Note - 14.9410.md')
    // const result = DataStore.projectNoteByFilename(`📋 Templates/Templating Samples/Test (Standard).md`)
    // console.log(result)
    console.log(templateName)

    try {
      const selectedTemplate = await DataStore.projectNoteByTitle(templateName, true, false)?.[0]
      let templateContent = selectedTemplate?.content
      if (templateContent == null || templateContent.length === 0) {
        const message = `Template "${templateName}" Not Found or Empty`
        return this.templateErrorMessage('Templating.getTemplate', message)
      }

      const lines = templateContent.split('\n')

      const dividerIndex = lines.findIndex((element) => element === '---' || element === '*****')
      if (dividerIndex > 0) {
        templateContent = lines.splice(dividerIndex + 1).join('\n')
      }

      return templateContent
    } catch (error) {
      return this.templateErrorMessage('getTemplate', error)
    }
  }

  async renderTemplate(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    try {
      const templateContent = await this.getTemplate(templateName)

      const result = await this.render(templateContent, userData)

      return result
    } catch (error) {
      return this.templateErrorMessage(error)
    }
  }

  async render(templateData: any = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    const options = { ...{ extended: false, tags: [] }, ...userOptions }

    // WebModule methods are async, will be converted to synchronous methods below
    // need to handle async calls before render templates as templating method are synchronous
    const weather = templateData.includes('web.weather') ? await WebModule.weather() : ''
    const quote = templateData.includes('web.quote') ? await WebModule.quote() : ''
    const affirmation = templateData.includes('web.affirmation') ? await WebModule.affirmation() : ''
    const advice = templateData.includes('web.advice') ? await WebModule.advice() : ''
    const service = templateData.includes('web.services') ? await WebModule.service : ''

    const helpers = {
      date: new DateModule(this.templateConfig),
      time: new TimeModule(this.templateConfig),
      utils: new UtilsModule(this.templateConfig),
      note: new NoteModule(this.templateConfig),
      user: {
        first: this.templateConfig?.user?.first || '',
        last: this.templateConfig?.user?.last || '',
        email: this.templateConfig?.user?.email || '',
        phone: this.templateConfig?.user?.phone || '',
      },
      // expose web module as synchronous methods (each method converted )
      web: {
        advice: () => {
          return advice
        },
        affirmation: () => {
          return affirmation
        },
        quote: () => {
          return quote
        },
        weather: () => {
          return weather.replace('\n', '')
        },
        services: (url = '', key = '') => {
          return service(this.templateConfig, url, key)
        },
      },
    }

    let renderData = { ...helpers, ...userData }
    renderData = userData?.data ? { ...userData.data, ...renderData } : renderData
    renderData = userData?.methods ? { ...userData.methods, ...renderData } : renderData
    renderData.np = { ...renderData }

    try {
      let result = await ejs.render(templateData, renderData, { async: true })

      result = (result && result?.replace(/undefined/g, '')) || ''

      return result
    } catch (error) {
      return error
      // return this.templateErrorMessage('Templating.render', err.message)
    }
  }

  async getDefaultFormat(formatType: string = 'date'): Promise<string> {
    try {
      // $FlowFixMe
      const templateConfig = await this.getTemplateConfig()
      let format = formatType === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss A'
      if (templateConfig?.templates?.defaultFormats?.[formatType]) {
        format = templateConfig?.templates?.defaultFormats?.[formatType]
      }

      format = formatType === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss A'
      return format
    } catch (error) {
      return this.templateErrorMessage('getDefaultFormat', error)
    }
  }
}
