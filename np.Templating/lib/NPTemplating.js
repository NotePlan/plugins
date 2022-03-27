// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/
import { semverVersionToNumber } from '@helpers/general'
import pluginJson from '../plugin.json'
import FrontmatterModule from './support/modules/FrontmatterModule'
import { log, logError, dump, clo } from '@helpers/dev'
import globals from './globals'

/*eslint-disable */
import TemplatingEngine from './TemplatingEngine'
import { formatDistanceToNow } from 'date-fns'

const TEMPLATE_FOLDER_NAME = NotePlan.environment.templateFolder
// const TEMPLATE_FOLDER_NAME = '📋 Templates'
// const TEMPLATE_FOLDER_NAME = '@Templates'

// np.Templating modules (see /lib/support/modules/*Module)
// - if a new module has been added, make sure it has been added to this list
const TEMPLATE_MODULES = ['date', 'frontmatter', 'note', 'system', 'time', 'user', 'utility']

const getProperyValue = (object: any, key: string): any => {
  key.split('.').forEach((token) => {
    // $FlowIgnorew
    if (object) object = object[token]
  })

  return object
}

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
  weatherFormat: '',
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
  weatherFormat?: string,
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

export async function getTemplateList(folderName: string = ''): Promise<any> {
  let templateFolder = await getTemplateFolder()
  if (folderName.length > 0) {
    templateFolder = `${templateFolder}/${folderName}`
  }

  if (templateFolder == null) {
    await CommandBar.prompt('Templating Error', `An error occurred locating ${templateFolder} folder`)
    return
  }

  let quickNoteTemplatesFolder: string = DataStore.settings?.quickNotesFolder || 'Quick Notes'
  quickNoteTemplatesFolder = `${templateFolder}/${quickNoteTemplatesFolder}`

  const options = DataStore.projectNotes
    .filter((n) => n.filename?.startsWith(templateFolder))
    .filter((n) => !n.title?.startsWith('_configuration'))
    .filter((n) => !n.title?.startsWith('_config'))
    .map((note) => {
      if (note.filename.indexOf(quickNoteTemplatesFolder)) {
        return note.title == null ? null : { label: note.title, value: note.filename }
      }
    })
    .filter(Boolean)

  return options
}

export async function getTemplateFolder(): Promise<string> {
  return TEMPLATE_FOLDER_NAME
}

export default class NPTemplating {
  templateConfig: any
  constructor() {
    // DON'T DELETE
    // constructor method required to access instance config (see setup method)
  }

  static _frontmatterError(error: any): string {
    if (error.reason === 'missed comma between flow collection entries') {
      return `**Frontmatter Template Parsing Error**\n\nWhen using template tags in frontmatter attributes, the entire block must be wrapped in quotes\n${error.mark}`
    }
    return error
  }

  static _filterTemplateResult(templateResult: string = ''): string {
    let result = templateResult

    result = result.replace('ejs', 'template')
    result = result.replace('If the above error is not helpful, you may want to try EJS-Lint:', '')
    // result = result.replace(/(?:https?|ftp):\/\/[\n\S]+/g, 'HTTP_REMOVED')
    result = result.replace('https://github.com/RyanZim/EJS-Lint', 'HTTP_REMOVED')
    if (result.includes('HTTP_REMOVED')) {
      result += 'For more information on proper template syntax, refer to:\n'
      result += 'https://nptemplating-docs.netlify.app/'
      result = result.replace('HTTP_REMOVED', '')
    }
    // result = result.replace('\n\n', '\n')

    return result
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
      const data = DataStore.settings

      this.constructor.templateConfig = {
        ...data,
        ...{ selection: await selection(), clipboard: Clipboard.string },
      }
    } catch (error) {
      await CommandBar.prompt('Template Error', error)
    }
  }

  static async getSetting(key: string = '', defaultValue?: string = ''): Promise<string> {
    const data = DataStore.settings
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

  static async normalizeToNotePlanFilename(filename: string = ''): Promise<string> {
    return filename.replace(/[#()?%*|"<>:]/gi, '')
  }

  static templateErrorMessage(method: string = '', message: any = ''): string {
    if (message?.name?.indexOf('YAMLException') >= 0) {
      const frontMatterErrorMessage = this._frontmatterError(message)
      return frontMatterErrorMessage
    }

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
    const parts = templateName.split('/')
    const filename = parts.pop()

    let templateFolderName = await getTemplateFolder()
    let originalFilename = templateName
    let templateFilename = templateName
    if (!templateName.includes(templateFolderName)) {
      templateFilename = `${templateFolderName}/${templateName}`
    }

    if (!templateFilename.includes('.md')) {
      templateFilename = `${templateFolderName}/${templateName}.md`
    }
    let selectedTemplate = ''
    const normalizedFilename = await this.normalizeToNotePlanFilename(filename)
    templateFilename = templateFilename.replace(filename, normalizedFilename)

    try {
      selectedTemplate = await DataStore.projectNoteByFilename(templateFilename)
      // if the template can't be found using actual filename (as it is on disk)
      // this will occur due to a bug in NotePlan which is not properly renaming files on disk to match note name
      if (!selectedTemplate) {
        const parts = templateName.split('/')
        if (parts.length > 0) {
          templateFilename = `${templateFolderName}/${templateName}`
          let templates = await DataStore.projectNoteByTitle(templateFilename, true, false)
          selectedTemplate = Array.isArray(templates) && templates.length > 0 ? templates[0] : null
        }
      }

      // template not found
      if (!selectedTemplate) {
        CommandBar.prompt('Template Error', `Unable to locate ${originalFilename}`)
      }

      let templateContent = selectedTemplate?.content || ''

      let isFrontmatterTemplate = templateContent.length > 0 ? new FrontmatterModule().isFrontmatterTemplate(templateContent) : false

      if (isFrontmatterTemplate) {
        // templateContent = new FrontmatterModule().getFrontmatterBlock(templateContent)
        return templateContent || ''
      }

      if (templateContent == null || templateContent.length === 0) {
        const message = `Template "${templateName}" Not Found or Empty`
        return this.templateErrorMessage('NPTemplating.getTemplate', message)
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
      return this.templateErrorMessage('NPTemplating.getTemplate', error)
    }
  }

  static async getTemplateConfig(): mixed {
    await this.setup()
    return this.constructor.templateConfig
  }

  static async renderTemplate(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    const usePrompts = true
    try {
      await this.setup()

      let sessionData = { ...userData }
      let templateData = (await this.getTemplate(templateName)) || ''

      let globalData = {}
      Object.getOwnPropertyNames(globals).forEach((key) => {
        globalData[key] = getProperyValue(globals, key)
      })

      sessionData.methods = { ...sessionData.methods, ...globalData }

      templateData = templateData.replace('<%@', '<%= prompt')

      const isFrontmatterTemplate = new FrontmatterModule().isFrontmatterTemplate(templateData)
      if (isFrontmatterTemplate && usePrompts) {
        const frontmatterAttributes = new FrontmatterModule().render(templateData)?.attributes || {}
        for (const [key, value] of Object.entries(frontmatterAttributes)) {
          let frontMatterValue = value
          // $FlowIgnore
          const promptData = await this.processPrompts(value, sessionData, '<%', '%>')
          frontMatterValue = promptData.sessionTemplateData
          // $FlowIgnore
          const { newTemplateData, newSettingData } = await this.preProcess(frontMatterValue, sessionData)
          sessionData = { ...sessionData, ...newSettingData }

          const renderedData = await new TemplatingEngine(this.constructor.templateConfig).render(newTemplateData, promptData.sessionData, userOptions)

          // $FlowIgnore
          templateData = templateData.replace(`${key}: ${value}`, `${key}: ${renderedData}`)
        }
        if (userOptions?.qtn) {
          return templateData
        }
      }

      // $FlowIgnore
      const { newTemplateData, newSettingData } = await this.preProcess(templateData, sessionData)
      sessionData = { ...sessionData, ...newSettingData }

      const promptData = await this.processPrompts(newTemplateData, sessionData, '<%', '%>')
      templateData = promptData.sessionTemplateData
      sessionData = promptData.sessionData

      // return templateData

      const renderedData = await new TemplatingEngine(this.constructor.templateConfig).render(templateData, sessionData, userOptions)

      return this._filterTemplateResult(renderedData)
    } catch (error) {
      return this.templateErrorMessage('NPTemplating.renderTemplate', error)
    }
  }

  static async preProcess(templateData: string, sessionData?: {}): Promise<mixed> {
    let newTemplateData = templateData
    let newSettingData = {}
    const tags = (await this.getTags(templateData)) || []
    tags.forEach((tag) => {
      if (!tag.includes('await') && tag.includes('(') && !tag.includes('prompt')) {
        let tempTag = tag.replace('<%-', '<%- await')
        newTemplateData = newTemplateData.replace(tag, tempTag)

        tempTag = tag.replace('<%=', '<%- await')
        newTemplateData = newTemplateData.replace(tag, tempTag)
      }

      const getType = (value: any) => {
        if (value.includes('[')) {
          return 'array'
        }

        if (value.includes('{')) {
          return 'object'
        }

        return 'string'
      }

      // extract variables
      if (tag.includes('const') || tag.includes('let') || tag.includes('var')) {
        if (sessionData) {
          const tempTag = tag.replace('const', '').replace('let', '').trimLeft().replace('<%', '').replace('-%>', '').replace('%>', '')
          let pos = tempTag.indexOf('=')
          if (pos > 0) {
            let varName = tempTag.substring(0, pos - 1).trim()
            let value = tempTag.substring(pos + 1)

            if (getType(value) === 'string') {
              value = value.replace(/['"]+/g, '').trim()
            }

            if (getType(value) === 'array' || getType(value) === 'object') {
              value = value.replace('" ', '').replace(' "', '').trim()
            }

            newSettingData[varName] = value
          }
        }
      }
    })
    return { newTemplateData, newSettingData }
  }

  static async render(templateData: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    try {
      await this.setup()
      return await new TemplatingEngine(this.constructor.templateConfig).render(templateData, userData, userOptions)
    } catch (error) {
      return this.templateErrorMessage('NPTemplating.render', error)
    }
  }

  static async postProcess(templateData: string): Promise<mixed> {
    //TODO: Finish implementation cursor support
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

    return items || []
  }

  static async getPromptParameters(promptTag: string = ''): mixed {
    let tagValue = ''
    tagValue = promptTag.replace(/\bask\b|prompt|[()]|<%-|<%=|<%|-%>|%>/gi, '').trim()
    // tagValue = promptTag.replace(/ask|[()]|<%=|<%|-%>|%>/gi, '').trim()
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

  static async prompt(message: string, options: Array<string> = []): Promise<any> {
    if (options.length === 0) {
      return await CommandBar.textPrompt('', message.replace('_', ' '), '')
    } else {
      const { index } = await CommandBar.showOptions(options, message)
      return options[index]
    }
  }

  static async processPrompts(templateData: string, userData: any, startTag: string = '<%', endTag: string = '%>'): Promise<any> {
    const sessionData = { ...userData }
    const methods = userData.hasOwnProperty('methods') ? Object.keys(userData?.methods) : []

    let sessionTemplateData = templateData.replace('<%@', '%<= prompt')
    const tags = await this.getTags(sessionTemplateData)

    for (const tag of tags) {
      // if tag is from module, it will contain period so we need to make sure this tag is not a module
      let isMethod = false
      for (const method of methods) {
        if (tag.includes(method)) {
          isMethod = true
        }
      }
      if (!this.isVariableTag(tag) && !this.isTemplateModule(tag) && !isMethod) {
        // $FlowIgnore
        let { varName, promptMessage, options } = await this.getPromptParameters(tag)

        const varExists = (varName) => {
          let result = true
          if (!sessionData.hasOwnProperty(varName)) {
            result = false
            if (sessionData.hasOwnProperty('data') && sessionData.data.hasOwnProperty(varName)) {
              result = true
            }
          }

          return result
        }
        if (!varExists(varName)) {
          promptMessage = promptMessage.replace('await', '').replace(/  /g, ' ')
          let response = await await this.prompt(promptMessage, options) // double await is correct here
          if (response) {
            if (typeof response === 'string') {
              response = response.trim()
            }
            sessionData[varName] = response
          } else {
            sessionData[varName] = ''
          }
        }
        if (tag.indexOf(`<%=`) >= 0 || tag.indexOf(`<%-`) >= 0 || tag.indexOf(`<%`) >= 0) {
          sessionTemplateData = sessionTemplateData.replace(tag, `${startTag}= ${varName} ${endTag}`)
        } else {
          sessionTemplateData = sessionTemplateData.replace(tag, `<% 'prompt' -%>`)
        }
      } else {
        // sessionTemplateData = sessionTemplateData.replace('user.', '')
      }
    }

    return { sessionTemplateData, sessionData }
  }

  static async createTemplate(title: string = '', metaData: any, content: string = ''): Promise<mixed> {
    try {
      const parts = title.split('/')
      const noteName = parts.pop()
      const folder = (await getTemplateFolder()) + '/' + parts.join('/')
      const templateFilename = (await getTemplateFolder()) + '/' + title
      if (!(await this.templateExists(templateFilename))) {
        const filename: any = await DataStore.newNote(noteName, folder)
        const note = DataStore.projectNoteByFilename(filename)

        let metaTagData = []
        for (const [key, value] of Object.entries(metaData)) {
          // $FlowIgnore
          metaTagData.push(`${key}: ${value}`)
        }
        let templateContent = `---\ntitle: ${noteName}\n${metaTagData.join('\n')}\n---\n`
        templateContent += content
        // $FlowIgnore
        note.content = templateContent
        return true
      } else {
        return false
      }
      // note.insertParagraph(contentLines.join('\n'), 1, 'text')
    } catch (error) {
      logError(pluginJson, `createTemplate :: ${error}`)
    }
  }

  static async templateExists(title: string = ''): Promise<mixed> {
    let templateFilename = (await getTemplateFolder()) + title
    templateFilename = templateFilename.replace('@Templates@Templates', '@Templates')
    try {
      const note = DataStore.projectNoteByFilename(`${templateFilename}.md`)
      return note ? true : false
    } catch (error) {
      logError(pluginJson, `templateExists :: ${error}`)
    }
  }

  static isVariableTag(tag: string = ''): boolean {
    return tag.indexOf('const') > 0 || tag.indexOf('let') > 0 || tag.indexOf('var') > 0 || tag.indexOf('.') > 0 || tag.indexOf('{') > 0 || tag.indexOf('}') > 0
  }

  static isMethod(tag: string = ''): boolean {
    return tag.indexOf('(') > 0 || tag.indexOf('@') > 0 || tag.indexOf('prompt') > 0
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
