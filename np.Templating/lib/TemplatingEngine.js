// @flow
/* eslint-disable */

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import WebModule from '@templatingModules/WebModule'
import DateModule from '@templatingModules/DateModule'
import TimeModule from '@templatingModules/TimeModule'
import NoteModule from '@templatingModules/NoteModule'
import UtilityModule from '@templatingModules/UtilityModule'
import SystemModule from '@templatingModules/SystemModule'
import FrontmatterModule from '@templatingModules/FrontmatterModule'

import pluginJson from '../plugin.json'
import { clo, log } from '@helpers/dev'

// this is a customized version of `ejs` adding support for async actions (use await in template)
// review `Test (Async)` template for example`
import ejs from './support/ejs'
import { logDebug, logError } from '../../helpers/dev'

const getProperyValue = (object: any, key: string): any => {
  key.split('.').forEach((token) => {
    // $FlowIgnorew
    if (object) object = object[token]
  })

  return object
}

const dt = () => {
  const d = new Date()

  const pad = (value: number) => {
    return value < 10 ? '0' + value : value
  }

  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + d.toLocaleTimeString()
}

export default class TemplatingEngine {
  templateConfig: any
  templatePlugins: any
  templateModules: any
  constructor(config: any) {
    this.templateConfig = config || {}
    this.templatePlugins = []
    this.templateModules = []

    // override the locale based on plugin settings
    if (this.templateConfig.templateLocale === '<system>') {
      this.templateConfig.templateLocale = NotePlan.environment.languageCode
    }
  }

  _replaceDoubleDashes(templateData: string): string {
    let returnedData = templateData
    // replace double dashes at top with triple dashes
    const lines = templateData.split('\n')
    const startBlock = lines.indexOf('--')
    const endBlock = startBlock === 0 ? lines.indexOf('--', startBlock + 1) : -1
    // clo(lines, `_replaceDoubleDashes: templateData: ${templateData}`)
    if (startBlock >= 0 && endBlock > 0) {
      lines[startBlock] = '---'
      lines[endBlock] = '---'
      returnedData = lines.join('\n')
    }
    return returnedData
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
    const options = { ...{ async: true, rmWhitespace: false }, ...userOptions }

    let useClipoard = templateData.includes('system.clipboard')
    if (templateData.indexOf('system.clipboard') > 0) {
      this.templateConfig.clipboard = Clipboard.string
    }

    const helpers = {
      date: new DateModule(this.templateConfig),
      time: new TimeModule(this.templateConfig),
      utility: new UtilityModule(this.templateConfig),
      system: new SystemModule(this.templateConfig),
      note: new NoteModule(this.templateConfig),
      frontmatter: {},
      user: {
        first: this.templateConfig?.userFirstName || '',
        last: this.templateConfig?.userLastName || '',
        email: this.templateConfig?.userEmail || '',
        phone: this.templateConfig?.userPhone || '',
      },
      // expose web module as synchronous methods (each method converted )
      web: {
        advice: async () => {
          return await new WebModule().advice()
        },
        affirmation: async () => {
          return await new WebModule().affirmation()
        },
        quote: async () => {
          return await new WebModule().quote()
        },
        verse: async () => {
          return await new WebModule().verse()
        },
        weather: async (params = '') => {
          return await new WebModule().weather(this.templateConfig, params)
        },
        wotd: async (params = '') => {
          return await new WebModule().wotd(this.templateConfig, params)
        },
        services: async (url = '', key = '') => {
          return await new WebModule().service(this.templateConfig, url, key)
        },
      },
    }

    let renderData = { ...helpers, ...userData }

    renderData = userData.data ? { ...userData.data, ...renderData } : { ...renderData }
    renderData = userData.methods ? { ...userData.methods, ...renderData } : renderData
    if (userData?.data) {
      renderData.data = { ...userData.data }
    }
    if (userData?.methods) {
      renderData.methods = { ...renderData.methods, ...userData.methods }
    }

    // apply custom plugin modules
    this.templateModules.forEach((moduleItem) => {
      clo(moduleItem, `moduleItem`)
      if (this.isClass(moduleItem.module)) {
        clo(moduleItem.module, `is class`)
        const methods = Object.getOwnPropertyNames(moduleItem.module.prototype)
        log(pluginJson, `np.Templating Error: ES6 Classes are not supported [${moduleItem.moduleNamespace}]`)
      } else {
        for (const [key, method] of Object.entries(moduleItem.module)) {
          logDebug(`key: ${key} method:${typeof method}`)

          renderData[moduleItem.moduleNamespace] = {}
          for (const [moduleKey, moduleMethod] of Object.entries(moduleItem.module)) {
            logDebug(`moduleKey: ${moduleKey} moduleMethod:${typeof moduleMethod}`)
            renderData[moduleItem.moduleNamespace][moduleKey] = moduleMethod
          }
        }
      }
    })

    renderData.np = { ...renderData }

    let processedTemplateData = templateData

    // check if templateData is frontmatter
    let frontmatterBlock = new FrontmatterModule().getFrontmatterBlock(processedTemplateData)

    if (frontmatterBlock.length > 0) {
      // process template first to see if frontmatter block has template variables
      processedTemplateData = await ejs.render(processedTemplateData, renderData, {
        async: true,
        openDelimiter: '{',
        closeDelimiter: '}',
      })

      frontmatterBlock = new FrontmatterModule().getFrontmatterBlock(processedTemplateData)

      const frontmatterData = new FrontmatterModule().parse(frontmatterBlock)

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
      // logDebug(pluginJson, `\n\nrender: BEFORE render`)
      let result = await ejs.render(processedTemplateData, renderData, options)
      // logDebug(pluginJson, `\n\nrender: AFTER render`)
      result = (result && result?.replace(/undefined/g, '')) || ''

      return this._replaceDoubleDashes(result)
    } catch (error) {
      logDebug(`199 np.Templating error: ${error}`)

      const message = error.message.replace('\n', '')

      let block = ''
      if (error?.line) {
        block = `\nline: ${error.line - 7}\n`

        if (error?.column) {
          block += `column: ${error.column}\n`
        }
        block += '\n'
      }
      let result =
        '**An error occurred rendering template:**\n\n' + message.replace(/ejs:/gi, 'template line: ').replace('list.', 'list').replace('while compiling ejs', '') + block

      return result
    }
  }

  async getDefaultFormat(formatType: string = 'date'): Promise<string> {
    //FIXME
    log(pluginJson, 'FIXME: TemplatingEngine.getDefaultFormat')
    log(pluginJson, 'This method should never be called, all references have been removed but leaving for backwards compatability')
    try {
      // $FlowFixMe
      const templateConfig = await this.getTemplateConfig()
      let format = formatType === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss A'
      if (templateConfig?.templates?.defaultFormats?.[formatType]) {
        format = templateConfig?.templates?.defaultFormats?.[formatType]
      }

      format = formatType === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss A'
      logDebug(pluginJson, `230 np.Templating format: ${format}`)

      return format
    } catch (error) {
      logError(`231 np.Templating Error: ${error}`)
      return this.templateErrorMessage('TemplatingEngine.getDefaultFormat', error)
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
        log(pluginJson, `np.Templating Error: ES6 Classes are not supported [${name}]`)
        log(pluginJson, `Please refer to np.Templating Documentation [Templating Plugins]`)
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
    const isPrototypeCtorClass = obj.prototype.constructor && obj.prototype.constructor.toString && obj.prototype.constructor.toString().substring(0, 5) === 'class'
    return isCtorClass || isPrototypeCtorClass
  }
}
