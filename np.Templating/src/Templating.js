// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/

import ejs from './support/ejs'

import FrontMatterModule from './support/modules/FrontmatterModule'
import TemplatingEngine from './TemplatingEngine'
import { getOrMakeConfigurationSection, getStructuredConfiguration } from './support/configuration'

const TEMPLATE_FOLDER_NAME = '📋 Templates'
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

export async function TEMPLATE_CONFIG_BLOCK(): Promise<string> {
  const config = await getStructuredConfiguration()

  // migrate existing configuration values

  // $FlowFixMe
  const locale = config?.date?.locale || ''
  // $FlowFixMe
  const first = config?.tagValue?.me?.firstName || ''
  // $FlowFixMe
  const last = config?.tagValue?.me?.lastName || ''

  // $FlowFixMe
  const dateFormat = config?.date?.dateStyle || DEFAULT_TEMPLATE_CONFIG.defaultFormats.date

  // $FlowFixMe
  const timeFormat = config?.date?.timeStyle || DEFAULT_TEMPLATE_CONFIG.defaultFormats.time

  return `  templates: {
    locale: "${locale}",
    defaultFormats: {
      date: "${dateFormat}",
      time: "${timeFormat}",
      now: "${DEFAULT_TEMPLATE_CONFIG.defaultFormats.now}"
    },
    user: {
      first: "${first}",
      last: "${last}",
      email: "",
      phone: ""
    },
    services: {}
  },
  `
}

export function getTemplateFolder(): ?string {
  return DataStore.folders.find((f) => f.includes(TEMPLATE_FOLDER_NAME))
}

export default class Templating {
  templateConfig: any
  constructor() {
    //
  }

  async heartbeat(): Promise<string> {
    await this.setup()
    return '```\n' + JSON.stringify(this.templateConfig, null, 2) + '\n```\n'
  }

  async setup() {
    this.templateConfig = await getOrMakeConfigurationSection('templates', await TEMPLATE_CONFIG_BLOCK())
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
        templateContent.length > 0 ? new FrontMatterModule().isFrontmatterTemplate(templateContent.substring(1)) : false

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
      } else {
        templateContent = lines.splice(1).join('\n')
      }

      return templateContent
    } catch (error) {
      return this.templateErrorMessage('getTemplate', error)
    }
  }

  async getTemplateConfig(): mixed {
    return this.templateConfig
  }

  async renderTemplate(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    try {
      await this.setup()

      const templateData = await this.getTemplate(templateName)
      return await new TemplatingEngine(this.templateConfig).render(templateData, userData, userOptions)
    } catch (error) {
      return this.templateErrorMessage(error)
    }
  }

  async render(templateData: any = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    try {
      await this.setup()
      return await new TemplatingEngine(this.templateConfig).render(templateData, userData, userOptions)
    } catch (error) {
      return this.templateErrorMessage(error)
    }
  }
}

/**
 * Show alert (like modal) using CommandBar
 * @author @codedungeon
 * @param {string} message - text to display to user (parses each line as separate 'option')
 * @param {string} label - label text (appears in CommandBar filter field)
 */
export async function alert(message: any = '', label: string = 'press <return> to continue'): Promise<string> {
  const lines = Array.isArray(message) ? message : message.split('\n')
  const optionItem = await CommandBar.showOptions(lines, label)
  const result = lines[optionItem.index]
  await CommandBar.hide()
  return result
}
