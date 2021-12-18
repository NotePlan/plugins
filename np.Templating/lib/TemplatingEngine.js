/* eslint-disable no-case-declarations */
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
import { showError } from '../../codedungeon.Tester/src/lib/testerUtils'

export default class TemplatingEngine {
  templateConfig: any
  templatePlugins: any
  templateModules: any
  constructor(config: any) {
    this.templateConfig = config || {}
    this.templatePlugins = []
    this.templateModules = []
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

  async render(templateData: any = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    const options = { ...{ async: true }, ...userOptions }

    // WebModule methods are async, will be converted to synchronous methods below
    // need to handle async calls before render templates as templating method are synchronous
    const weather = templateData.includes('web.weather') ? await new WebModule().weather() : ''
    const quote = templateData.includes('web.quote') ? await new WebModule().quote() : ''
    const affirmation = templateData.includes('web.affirmation') ? await new WebModule().affirmation() : ''
    const advice = templateData.includes('web.advice') ? await new WebModule().advice() : ''
    const verse = templateData.includes('web.verse') ? await new WebModule().verse() : ''
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
        verse: () => {
          return verse
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

    // apply custom plugin modules
    this.templateModules.forEach((moduleItem) => {
      if (this.isClass(moduleItem.module)) {
        const methods = Object.getOwnPropertyNames(moduleItem.module.prototype)
        console.log(`np.Templating Error: ES6 Classes are not supported [${moduleItem.moduleNamespace}]`)
      } else {
        for (const [key, method] of Object.entries(moduleItem.module)) {
          renderData[moduleItem.moduleNamespace] = {}
          for (const [moduleKey, moduleMethod] of Object.entries(moduleItem.module)) {
            renderData[moduleItem.moduleNamespace][moduleKey] = moduleMethod
          }
        }
      }
    })

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

    // include any custom plugins
    this.templatePlugins.forEach((item) => {
      renderData[item.name] = item.method
    })

    try {
      let result = await ejs.render(processedTemplateData, renderData, options)

      result = (result && result?.replace(/undefined/g, '')) || ''

      return result
    } catch (error) {
      const message = error.message
      return message.replace(/ejs:/g, '**Template Error:** ')
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

  async register(name: string = '', methodOrModule: any): Promise<void> {
    let methodOrModuleType = typeof methodOrModule
    if (this.isClass(methodOrModule)) {
      methodOrModuleType = 'class'
    }

    switch (methodOrModuleType) {
      case 'function':
        const result = this.templatePlugins.find((item) => {
          return item.name === name
        })
        if (!result) {
          this.templatePlugins.push({ name, method: methodOrModule })
        }
        break
      case 'class':
        console.log(`np.Templating Error: ES6 Classes are not supported [${name}]`)
        console.log(`Please refer to np.Templating Documentation [Templating Plugins]`)
        break
      case 'object':
        const moduleNmae = this.templateModules.find((item) => {
          return item.moduleNamespace === name
        })
        if (!moduleNmae) {
          this.templateModules.push({ moduleNamespace: name, module: methodOrModule })
        }
        break
      default:
        // what happens if we get here
        break
    }
  }

  // $FlowFixMe
  isClass(obj) {
    const isCtorClass = obj.constructor && obj.constructor.toString().substring(0, 5) === 'class'
    if (obj.prototype === undefined) {
      return isCtorClass
    }
    const isPrototypeCtorClass =
      obj.prototype.constructor &&
      obj.prototype.constructor.toString &&
      obj.prototype.constructor.toString().substring(0, 5) === 'class'
    return isCtorClass || isPrototypeCtorClass
  }
}
