// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/
import { semverVersionToNumber } from '@helpers/general'
import pluginJson from '../plugin.json'
import FrontmatterModule from './support/modules/FrontmatterModule'
import { log, logError } from '@helpers/dev'

/*eslint-disable */
import TemplatingEngine from './TemplatingEngine'

// const TEMPLATE_FOLDER_NAME = NotePlan.environment.templateFolder
const TEMPLATE_FOLDER_NAME = '📋 Templates'

// np.Templating modules (see /lib/support/modules/*Module)
// - if a new module has been added, make sure it has been added to this list
const TEMPLATE_MODULES = ['date', 'frontmatter', 'note', 'system', 'time', 'user', 'utility']

export const selection = async (): Promise<string> => {
  return Editor.selectedParagraphs.map((para) => para.rawContent).join('\n')
}

// Important: Replicate _configuration.templates object in TEMPLATE_CONFIG_BLOCK
// NOTE: When adding new properties, make sure the `plugin.json/plugin.settings` are updated
export const DEFAULT_TEMPLATE_CONFIG = {
  templateFolderName: TEMPLATE_FOLDER_NAME,
  templateLocale: 'en-US',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'h:mm A',
  nowFormat: 'YYYY-MM-DD h:mm:ss A',
  userFirstName: 'John',
  userLastName: 'Doe',
  userEmail: 'john.doe@gmail.com',
  userPhone: '(714) 555-1212',
  services: {
    affirmation: 'https://affirmations.dev',
    quote: {
      url: 'https://zenquotes.io/api/random',
      keys: ['"', '[0].q', '"', ' - ', '*', '[0].a', '*'],
    },
  },
}

type TemplateConfig = $ReadOnly<{
  templateFolderName: string,
  templateLocale?: string,
  userFirstName?: string,
  userLastName?: string,
  userEmail?: string,
  userPhone?: string,
  dateFormat?: string,
  timeFormat?: string,
  nowFormat?: boolean,
  services?: mixed,
}>

const dt = () => {
  const d = new Date()

  const pad = (value: number) => {
    return value < 10 ? '0' + value : value
  }

  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + d.toLocaleTimeString()
}

export async function getDefaultTemplateConfig(): any {
  return DEFAULT_TEMPLATE_CONFIG
}

export async function TEMPLATE_CONFIG_BLOCK(): Promise<string> {
  const config = DEFAULT_TEMPLATE_CONFIG

  // migrate existing configuration values

  // $FlowFixMe
  const locale = config?.date?.locale || ''
  // $FlowFixMe
  const first = config?.tagValue?.me?.firstName || ''
  // $FlowFixMe
  const last = config?.tagValue?.me?.lastName || ''

  // $FlowFixMe
  const dateFormat = config?.date?.dateStyle || DEFAULT_TEMPLATE_CONFIG.dateFormat

  // $FlowFixMe
  const timeFormat = config?.date?.timeStyle || DEFAULT_TEMPLATE_CONFIG.timeFormat

  // $FlowFixMe
  const timestampFormat = config?.date?.timeStyle || DEFAULT_TEMPLATE_CONFIG.timestampFormat

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
    // check https://github.com/public-apis/public-apis for other services
    services: {}
  },
  `
}

export async function getTemplateList(): Promise<any> {
  const templateFolder = await getTemplateFolder()
  if (templateFolder == null) {
    await CommandBar.prompt('Templating Error', `An error occurred locating ${templateFolder} folder`)
    return
  }

  const options = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .filter((n) => !n.title?.startsWith('_configuration'))
    .map((note) => (note.title == null ? null : { label: note.title, value: note }))
    .filter(Boolean)

  return options
}

export async function getTemplateFolder(): Promise<string> {
  // const pluginSettingData = DataStore.loadJSON('../np.Templating/settings.json')
  // return pluginSettingData.templateFolderName
  return TEMPLATE_FOLDER_NAME
}

export default class NPTemplating {
  templateConfig: any
  constructor() {
    // DON'T DELETE
    // constructor method required to access instance config (see setup method)
  }

  static async updateOrInstall(currentSettings: any, currentVersion: string): Promise<TemplateConfig> {
    const settingsData = { ...currentSettings }

    // current settings version as number
    const settingsVersion: number = semverVersionToNumber(settingsData?.version || '')

    // this will grow over time as settings are upgraded in future versions
    if (settingsVersion < semverVersionToNumber('0.0.186')) {
      log(pluginJson, `==> Updating np.Templating to version 0.0.186`)
    }

    if (settingsVersion < semverVersionToNumber('0.0.187')) {
      log(pluginJson, `==> Updating np.Templating to version 0.0.187`)
    }

    if (settingsVersion < semverVersionToNumber('0.0.188')) {
      log(pluginJson, `==> Updating np.Templating to version 0.0.188`)
    }

    if (settingsVersion < semverVersionToNumber('0.0.189')) {
      log(pluginJson, `==> Updating np.Templating to version 0.0.189`)
    }

    // update settings version to latest version from plugin.json
    settingsData.version = pluginJson['plugin.version']
    log(pluginJson, `==> np.Templating Settings Version ${currentVersion}`)

    // return new settings
    return settingsData
  }

  static async setup() {
    try {
      let data = DataStore.loadJSON('../np.Templating/settings.json')
      if (!data) {
        const result = DataStore.saveJSON(DEFAULT_TEMPLATE_CONFIG, '../np.Templating/settings.json')
        data = DataStore.loadJSON('../np.Templating/settings.json')
      }

      this.constructor.templateConfig = {
        ...data,
        ...{ selection: await selection(), clipboard: Clipboard.string },
      }
    } catch (error) {
      await CommandBar.prompt('Template Error', error)
    }
  }

  static async getSetting(key: string = '', defaultValue?: string = ''): Promise<string> {
    const data = DataStore.loadJSON('../np.Templating/settings.json')
    if (data) {
      return data.hasOwnProperty(key) ? data[key] : defaultValue
    }
    return defaultValue
  }

  static async putSetting(key: string, value: string): Promise<boolean> {
    return true
  }

  static async heartbeat(): Promise<string> {
    await this.setup()

    let userFirstName = await this.getSetting('userFirstName')

    return '```\n' + JSON.stringify(this.constructor.templateConfig, null, 2) + '\n```\n'
  }

  static async templateErrorMessage(method: string = '', message: string = ''): Promise<string> {
    const line = '*'.repeat(message.length + 30)
    console.log(line)
    console.log(`   ERROR`)
    console.log(`   Method: ${method}:`)
    console.log(`   Message: ${message}`)
    console.log(line)
    console.log('\n')
    return `**Error: ${method}**\n- **${message}**`
  }

  static async getTemplate(templateName: string = ''): Promise<string> {
    // $FlowFixMe
    let templateFolderName = await getTemplateFolder()
    let originalFilename = `${templateFolderName}/${templateName}`
    let templateFilename = `${templateFolderName}/${templateName}.md`
    let selectedTemplate = ''

    try {
      selectedTemplate = await DataStore.projectNoteByFilename(templateFilename)

      // if the template can't be found using actual filename (as it is on disk)
      // this will occur due to a bug in NotePlan which is not properly renaming files on disk to match note name
      if (!selectedTemplate) {
        const parts = templateName.split('/')
        if (parts.length > 0) {
          templateFilename = parts[parts.length - 1]
          selectedTemplate = await DataStore.projectNoteByTitle(templateFilename, true, false)?.[0]
        }
      }

      // template not found
      if (!selectedTemplate) {
        CommandBar.prompt('Template Error', `Unable to locate ${originalFilename}`)
      }

      let templateContent = selectedTemplate?.content || ''

      const isFrontmatterTemplate = templateContent.length > 0 ? new FrontmatterModule().isFrontmatterTemplate(templateContent.substring(1)) : false

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

  static async getTemplateConfig(): mixed {
    await this.setup()
    return this.constructor.templateConfig
  }

  static async renderTemplate(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    try {
      await this.setup()

      let sessionData = { ...userData }
      let templateData = (await this.getTemplate(templateName)) || ''

      if (userOptions?.usePrompts) {
        const promptData = await this.processPrompts(templateData, userData, '<%', '%>')
        templateData = promptData.sessionTemplateData
        sessionData = promptData.sessionData
      }

      const renderedData = await new TemplatingEngine(this.constructor.templateConfig).render(templateData, sessionData, userOptions)

      return renderedData
    } catch (error) {
      return this.templateErrorMessage(error)
    }
  }

  static async render(templateData: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    try {
      await this.setup()
      return await new TemplatingEngine(this.constructor.templateConfig).render(templateData, userData, userOptions)
    } catch (error) {
      return this.templateErrorMessage(error)
    }
  }

  static async postProcess(templateData: string): Promise<mixed> {
    let newTemplateData = templateData
    let pos = 0
    let startPos = 0
    let cursors = []

    do {
      let findStr = '$NP_CURSOR'
      pos = newTemplateData.indexOf(findStr, startPos)
      if (pos >= 0) {
        cursors.push({ start: pos })
        startPos = pos + 1
      }
    } while (pos >= 0)

    return {
      cursors,
    }
  }

  static async getTags(templateData: string = '', startTag: string = '<%', endTag: string = '%>'): Promise<any> {
    const TAGS_PATTERN = /\<%.*?\%>/gi

    const items = templateData.match(TAGS_PATTERN)

    return items
  }

  static async getPromptParameters(promptTag: string = ''): mixed {
    let tagValue = promptTag.replace(/prompt|[()]|<%=|<%|-%>|%>/gi, '').trim()
    let varName = ''
    let promptMessage = ''
    let options = []

    // get variable from tag (first quoted value up to comma)
    let pos = tagValue.indexOf(',')
    if (pos >= 0) {
      varName = tagValue
        .substr(0, pos - 1)
        .replace(/'/g, '')
        .trim()
      tagValue = tagValue.substr(pos + 1)
      pos = tagValue.indexOf(',')
      if (pos >= 0) {
        if (tagValue[0] !== '[') {
          promptMessage = tagValue.substr(0, pos).replace(/'/g, '').trim()
          tagValue = tagValue.substr(pos + 1).trim()
        }

        if (tagValue.length > 0) {
          const optionItems = tagValue.replace('[', '').replace(']', '').split(',')
          options = optionItems.map((item) => {
            return item.replace(/'/g, '')
          })
        }
      } else {
        promptMessage = tagValue.replace(/'/g, '')
      }
    } else {
      varName = tagValue.replace(/'/g, '')
    }

    if (promptMessage.length === 0) {
      promptMessage = options.length > 0 ? `Select ${varName}` : `Enter ${varName}`
    }

    varName = varName.replace(/ /g, '_')
    return { varName, promptMessage, options }
  }

  static async prompt(message: string, options: Array<string> = []): Promise<string> {
    if (options.length === 0) {
      return await CommandBar.showInput(message, 'OK')
    } else {
      const { index } = await CommandBar.showOptions(options, message)
      return options[index]
    }
  }

  static async processPrompts(templateData: string, userData: any, startTag: string = '<%', endTag: string = '%>'): Promise<any> {
    const sessionData = { ...userData }
    let sessionTemplateData = templateData

    for (const tag of await this.getTags(templateData)) {
      // if tag is from module, it will contain period so we need to make sure this tag is not a module
      if (!this.isVariableTag(tag) && !this.isTemplateModule(tag)) {
        // $FlowIgnore
        const { varName, promptMessage, options } = await this.getPromptParameters(tag)
        if (!sessionData.hasOwnProperty(varName)) {
          sessionData[varName] = await (await this.prompt(promptMessage, options)).trim()
        }
        if (tag.indexOf(`<%=`) >= 0) {
          sessionTemplateData = sessionTemplateData.replace(tag, `${startTag}= ${varName} ${endTag}`)
        } else {
          sessionTemplateData = sessionTemplateData.replace(tag, `<% 'prompt' -%>`)
        }
      } else {
        sessionTemplateData = sessionTemplateData.replace('user.', '')
      }
    }

    return { sessionTemplateData, sessionData }
  }

  static isVariableTag(tag: string = ''): boolean {
    return tag.indexOf('const') > 0 || tag.indexOf('let') > 0
  }

  static isTemplateModule(tag: string = ''): boolean {
    const tagValue = tag.replace('<%=', '').replace('<%-', '').replace('%>', '').trim()
    const pos = tagValue.indexOf('.')
    if (pos >= 0) {
      const moduleName = tagValue.substring(0, pos)
      return TEMPLATE_MODULES.indexOf(moduleName) >= 0
    }
    return false
  }
}
