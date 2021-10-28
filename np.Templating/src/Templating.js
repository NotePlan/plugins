// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import { getUserLocale } from 'get-user-locale'

// this is a customized versioin of `ejs` adding support for async actions (use await in template)
// review `Test (Async)` template for example`
import ejs from './support/ejs'

import WebModule from './support/modules/WebModule'
import DateModule from './support/modules/DateModule'
import TimeModule from './support/modules/TimeModule'
import NoteModule from './support/modules/NoteModule'
import UtilsModule from './support/modules/UtilsModule'
import FrontmatterModule from './support/modules/FrontmatterModule'

export function objectToCode(obj: any): string {
  return JSON.stringify(obj, null, 2)
    .replace(/\\/g, ' ')
    .replace(/, /g, ',\n   ')
    .replace(/"{/g, '{\n  ')
    .replace(/}"/g, '\n}')
    .replace(/ ",/g, '",')
    .replace(/ ":/g, '":')
}

export const DEFAULT_TEMPLATE_CONFIG = {
  locale: 'en-US',
  defaultFormats: {
    date: 'YYYY-MM-DD',
    time: 'h:mm A',
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

const TEMPLATE_FOLDER_NAME = '📋 Templates'

export function getTemplateFolder(): ?string {
  return DataStore.folders.find((f) => f.includes(TEMPLATE_FOLDER_NAME))
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

  async isFrontmatter(templateData: string): Promise<boolean> {
    return templateData.length > 0 ? new FrontmatterModule().isFrontmatterTemplate(templateData.substring(1)) : false
  }

  async getTemplate(templateName: string = ''): Promise<string> {
    // $FlowFixMe
    let templateFilename = `${getTemplateFolder()}/${templateName}.md`
    try {
      let selectedTemplate = await DataStore.projectNoteByFilename(templateFilename)

      // if the template can't be found using actual filename (as it is on disk)
      // this will occur due to a bug in NotePlan which is not properly renaming files on disk to match note name
      if (!selectedTemplate) {
        const parts = templateName.split('/')
        if (parts.length > 0) {
          templateFilename = parts[parts.length - 1]
          selectedTemplate = await DataStore.projectNoteByTitle(templateFilename, true, false)?.[0]
        }
      }

      let templateContent = selectedTemplate?.content || ''

      const isFrontmatterTemplate =
        templateContent.length > 0 ? new FrontmatterModule().isFrontmatterTemplate(templateContent.substring(1)) : false

      if (isFrontmatterTemplate) {
        return templateContent || ''
      }
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
      const result = await this.render(templateContent, userData, userOptions)

      return result
    } catch (error) {
      return this.templateErrorMessage(error)
    }
  }

  async render(templateData: any = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    const options = { ...{ async: true }, ...userOptions }

    // WebModule methods are async, will be converted to synchronous methods below
    // need to handle async calls before render templates as templating method are synchronous
    const weather = templateData.includes('web.weather') ? await new WebModule().weather() : ''
    const quote = templateData.includes('web.quote') ? await new WebModule().quote() : ''
    const affirmation = templateData.includes('web.affirmation') ? await new WebModule().affirmation() : ''
    const advice = templateData.includes('web.advice') ? await new WebModule().advice() : ''
    const service = templateData.includes('web.services') ? await new WebModule().service : ''

    const helpers = {
      date: new DateModule(this.templateConfig),
      time: new TimeModule(this.templateConfig),
      utils: new UtilsModule(this.templateConfig),
      note: new NoteModule(this.templateConfig),
      frontmatter: {},
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
          // $FlowFixMe
          return service(this.templateConfig, url, key)
        },
      },
    }

    let renderData = { ...helpers, ...userData }
    renderData = userData?.data ? { ...userData.data, ...renderData } : renderData
    renderData = userData?.methods ? { ...userData.methods, ...renderData } : renderData
    renderData.np = { ...renderData }

    let processedTemplateData = templateData

    // check if templateData is frontmatter
    let frontmatterBlock = new FrontmatterModule().getFrontmatterBlock(processedTemplateData).replace(/--/g, '---')
    if (frontmatterBlock.length > 0) {
      // process template first to see if frontmatter block has template variables
      processedTemplateData = await ejs.render(processedTemplateData, renderData, {
        async: true,
        openDelimiter: '{',
        closeDelimiter: '}',
      })

      frontmatterBlock = new FrontmatterModule().getFrontmatterBlock(processedTemplateData).replace(/--/g, '---')
      const frontmatterData = new FrontmatterModule().render(frontmatterBlock)
      if (frontmatterData.hasOwnProperty('attributes') && frontmatterData.hasOwnProperty('body')) {
        if (Object.keys(frontmatterData.attributes).length > 0) {
          renderData.frontmatter = { ...frontmatterData.attributes }
        }
        if (frontmatterData.body.length > 0) {
          processedTemplateData = frontmatterData.body
        }
      }
    }

    try {
      let result = await ejs.render(processedTemplateData, renderData, options)

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
