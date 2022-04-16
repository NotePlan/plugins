// @flow

/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/
import { semverVersionToNumber } from '@helpers/general'
import pluginJson from '../plugin.json'
import FrontmatterModule from './support/modules/FrontmatterModule'

import globals from './globals'
import { chooseOption } from '@helpers/userInput'
import { clo, log, logError } from '@helpers/dev'

/*eslint-disable */
import TemplatingEngine from './TemplatingEngine'
import { formatDistanceToNow } from 'date-fns'

const TEMPLATE_FOLDER_NAME = NotePlan.environment.templateFolder
// const TEMPLATE_FOLDER_NAME = '📋 Templates'

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

export async function getTemplateFolder(): Promise<string> {
  return TEMPLATE_FOLDER_NAME
}

export default class NPTemplating {
  templateConfig: any
  templateGlobals: []
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

  /**
   * Initializes the instance with `templateConfig` from settings, and list of global methods (as defined in `globals.js`)
   */
  static async setup() {
    try {
      const data = await this.getSettings()

      this.constructor.templateConfig = {
        ...data,
        ...{ clipboard: '' },
      }

      let globalData = []
      Object.getOwnPropertyNames(globals).forEach((key) => {
        globalData.push(key)
      })

      this.constructor.templateGlobals = globalData
    } catch (error) {
      await CommandBar.prompt('Template Error', error)
    }
  }

  static async getSettings(): any {
    let data = DataStore.loadJSON('../np.Templating/settings.json')
    if (!data) {
      const result = DataStore.saveJSON(DEFAULT_TEMPLATE_CONFIG, '../np.Templating/settings.json')
      data = DataStore.loadJSON('../np.Templating/settings.json')
    }

    return data
  }

  static async getSetting(key: string = '', defaultValue?: string = ''): Promise<string> {
    const data = this.getSettings()
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

  static async chooseTemplate(tags?: any = '*', promptMessage: string = 'Choose Template'): Promise<any> {
    try {
      const templateList = await this.getTemplateList(tags)
      let options = []
      for (const template of templateList) {
        const parts = template.value.split('/')
        const filename = parts.pop()
        const label = template.value.replace(`${TEMPLATE_FOLDER_NAME}/`, '').replace(filename, template.label)
        options.push({ label, value: template.value })
      }

      // $FlowIgnore
      return await chooseOption<TNote, void>(promptMessage, options)
    } catch (error) {}
  }

  static async getFilenameFromNote(note: string = ''): Promise<string> {
    // if nested note, we don't like it
    const parts = note.split('/')
    if (parts.length === 0) {
    }

    const notes = await DataStore.projectNoteByTitle(note, true, false)
    const finalNotes = notes.filter((note) => note.filename.startsWith(TEMPLATE_FOLDER_NAME))
    if (finalNotes.length > 1) {
      return 'MULTIPLE NOTES FOUND'
    } else {
      return notes[0].filename
    }
    return 'INCOMPLETE'
  }

  static async getTemplateList(tags: any = '*'): Promise<any> {
    try {
      const templateFolder = await getTemplateFolder()
      if (templateFolder == null) {
        await CommandBar.prompt('Templating Error', `An error occurred locating ${templateFolder} folder`)
        return
      }

      const filterTags = Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim())

      const allTemplates = DataStore.projectNotes
        .filter((n) => n.filename?.startsWith(templateFolder))
        .filter((n) => !n.title?.startsWith('_configuration'))
        .filter((n) => !n.filename?.startsWith('Delete After Release'))
        .sort((a, b) => {
          return a.filename.localeCompare(b.filename)
        })
        .map((note) => {
          return note.title == null ? null : { label: note.title, value: note.filename }
        })
        .filter(Boolean)

      let resultTemplates = []
      let matches = []
      let exclude = []
      let allTypes = []

      // get master list of types
      for (const template of allTemplates) {
        if (template.value.length > 0) {
          const templateData = await this.getTemplate(template.value)
          if (templateData.length > 0) {
            const attrs = await new FrontmatterModule().attributes(templateData)

            const type = attrs?.type || ''

            if (type.length > 0) {
              allTypes = allTypes.concat(type.split(',')).map((type) => type?.trim())
            }
          }
        }
      }
      // remove duplicates
      allTypes = allTypes.filter((v, i, a) => a.indexOf(v) === i)

      // iterate filter tags
      filterTags.forEach((tag) => {
        // include all types
        matches = tag === '*' ? matches.concat(allTypes) : matches
        // find matching tags
        if (tag[0] !== '!' && allTypes.indexOf(tag) > -1) {
          matches.push(allTypes[allTypes.indexOf(tag)])
        }

        // remove excluded tags
        if (tag[0] === '!' && allTypes.indexOf(tag.substring(1)) > -1) {
          exclude.push(allTypes[allTypes.indexOf(tag.substring(1))])
        }
      })

      // always ignore templates which include a `ignore` type
      exclude.push('ignore') // np.Templating specific

      // merge the arrays together using differece
      let finalMatches = matches.filter((x) => !exclude.includes(x))

      let templateList = []
      for (const template of allTemplates) {
        if (template.value.length > 0) {
          const templateData = await this.getTemplate(template.value)
          if (templateData.length > 0) {
            const attrs = await new FrontmatterModule().attributes(templateData)

            const type = attrs?.type || ''
            let types = (type.length > 0 && type?.split(',')) || ['*']
            types.forEach((element, index) => {
              types[index] = element.trim() // trim element whitespace
            })

            finalMatches.every((match) => {
              if (types.includes(match) || (types.includes('*') && filterTags.includes('*'))) {
                // check if types includes any excluded items
                if (types.filter((x) => exclude.includes(x)).length === 0) {
                  templateList.push(template)
                  return false
                }
              }
              return true
            })
          }
        }
      }

      return templateList
    } catch (error) {
      logError(pluginJson, error)
    }
  }

  static async getTemplate(templateName: string = '', options: any = { showChoices: true }): Promise<string> {
    const parts = templateName.split('/')
    const filename = parts.pop()

    let templateFolderName = await getTemplateFolder()
    let originalFilename = templateName
    let templateFilename = templateName
    if (!templateName.includes(templateFolderName)) {
      templateFilename = `${templateFolderName}/${templateName}`
    }

    let selectedTemplate = ''
    const normalizedFilename = await this.normalizeToNotePlanFilename(filename)
    templateFilename = templateFilename.replace(filename, normalizedFilename)

    try {
      templateFilename = templateFilename.replace(/.md|.txt/gi, '')
      selectedTemplate = await DataStore.projectNoteByFilename(`${templateFilename}.md`)
      if (!selectedTemplate) {
        selectedTemplate = await DataStore.projectNoteByFilename(`${templateFilename}.txt`)
      }
      // if the template can't be found using actual filename (as it is on disk)
      // this will occur due to an issue in NotePlan where name on disk does not match note (or template) name
      if (!selectedTemplate) {
        const parts = templateName.split('/')
        if (parts.length > 0) {
          templateFilename = `${templateFolderName}/${templateName}`
          let templates = (await DataStore.projectNoteByTitle(templateName, true, false)) || []
          if (templates.length > 1) {
            let templatesSecondary = []
            for (const template of templates) {
              if (template && template.filename.startsWith(templateFolderName)) {
                const parts = template.filename.split('/')
                parts.pop()
                // $FlowIgnore
                templatesSecondary.push({ value: template.filename, label: `${parts.join('/')}/${template.title}`, title: template.title })
              }
            }

            if (templatesSecondary.length > 1) {
              // $FlowIgnore
              let selectedItem = (await chooseOption<TNote, void>('Choose Template', templatesSecondary)) || null
              if (selectedItem) {
                // $FlowIgnore
                selectedTemplate = await DataStore.projectNoteByFilename(selectedItem)
              }
            } else {
              // $FlowIgnore
              selectedTemplate = await DataStore.projectNoteByFilename(templatesSecondary[0].value)
            }
          } else {
            selectedTemplate = Array.isArray(templates) && templates.length > 0 ? templates[0] : null
          }
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

  static async getTemplateAttributes(templateData: string = ''): Promise<any> {
    return await new FrontmatterModule().attributes(templateData)
  }

  static async getTemplateConfig(): mixed {
    await this.setup()
    return this.constructor.templateConfig
  }

  static async renderTemplateX(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    const usePrompts = true
    try {
      await this.setup()

      let sessionData = { ...userData }
      // $FlowIgnore
      let templateData = (await this.getTemplate(templateName)) || ''

      let globalData = {}
      Object.getOwnPropertyNames(globals).forEach((key) => {
        globalData[key] = getProperyValue(globals, key)
      })

      sessionData.methods = { ...sessionData.methods, ...globalData }

      templateData = templateData.replace('<%@', '<%- prompt')

      const isFrontmatterTemplate = new FrontmatterModule().isFrontmatterTemplate(templateData)
      if (isFrontmatterTemplate) {
        const { frontmatterAttributes, frontmatterBody } = await this.preRender(templateData, sessionData)
        templateData = frontmatterBody
        sessionData.data = { ...sessionData.data, ...frontmatterAttributes }
      }

      if (isFrontmatterTemplate && usePrompts) {
        const frontmatterAttributes = new FrontmatterModule().parse(templateData)?.attributes || {}
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

      const renderedData = await new TemplatingEngine(this.constructor.templateConfig).render(templateData, sessionData, userOptions)

      return this._filterTemplateResult(renderedData)
    } catch (error) {
      return this.templateErrorMessage('NPTemplating.renderTemplate', error)
    }
  }

  static async preProcess(templateData: string, sessionData?: {}): Promise<mixed> {
    let newTemplateData = templateData
    let newSettingData = { ...sessionData }
    const tags = (await this.getTags(templateData)) || []
    tags.forEach((tag) => {
      if (!tag.includes('await') && !this.isControlBlock(tag) && tag.includes('(') && !tag.includes('prompt')) {
        let tempTag = tag.replace('<%-', '<%- await')
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

      // TODO: This needs to be refactored, hardcoded for initial release
      if (tag === '<%- aim %>' || tag === '<%- aim() %>') {
        newTemplateData = newTemplateData.replace(tag, `<%- prompt('aim') %>`)
      }
      if (tag === '<%- context %>' || tag === '<%- context() %>') {
        newTemplateData = newTemplateData.replace(tag, `<%- prompt('context') %>`)
      }
      if (tag === '<%- discuss %>' || tag === '<%- discuss() %>') {
        newTemplateData = newTemplateData.replace(tag, `<%- prompt('discuss') %>`)
      }
      if (tag === '<%- meetingName %>' || tag === '<%- meetingName() %>') {
        newTemplateData = newTemplateData.replace(tag, `<%- prompt('meetingName','Enter Meeting Name:') %>`)
      }
    })

    return { newTemplateData, newSettingData }
  }

  static async renderTemplate(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    const usePrompts = true
    try {
      let templateData = (await this.getTemplate(templateName)) || ''

      let renderedData = await this.render(templateData, userData, userOptions)

      return this._filterTemplateResult(renderedData)
    } catch (error) {
      return this.templateErrorMessage('NPTemplating.renderTemplate', error)
    }
  }

  static async render(inTemplateData: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    const usePrompts = true
    try {
      await this.setup()

      let sessionData = { ...userData }
      let templateData = inTemplateData

      let globalData = {}
      Object.getOwnPropertyNames(globals).forEach((key) => {
        globalData[key] = getProperyValue(globals, key)
      })

      sessionData.methods = { ...sessionData.methods, ...globalData }
      templateData = templateData.replace(/<%@/gi, '<%- prompt')

      const isFrontmatterTemplate = new FrontmatterModule().isFrontmatterTemplate(templateData)
      if (isFrontmatterTemplate) {
        const { frontmatterAttributes, frontmatterBody } = await this.preRender(templateData, sessionData)
        templateData = frontmatterBody
        sessionData.data = { ...sessionData.data, ...frontmatterAttributes }
      }

      if (isFrontmatterTemplate && usePrompts) {
        const frontmatterAttributes = new FrontmatterModule().parse(templateData)?.attributes || {}
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
      sessionData = { ...newSettingData }

      const promptData = await this.processPrompts(newTemplateData, sessionData, '<%', '%>')

      templateData = promptData.sessionTemplateData
      sessionData = promptData.sessionData

      sessionData.data = { ...sessionData.data, ...userData?.data }
      sessionData.methods = { ...sessionData.methods, ...userData?.methods }

      const renderedData = await new TemplatingEngine(this.constructor.templateConfig).render(templateData, sessionData, userOptions)
      return this._filterTemplateResult(renderedData)
    } catch (error) {
      return this.templateErrorMessage('NPTemplating.renderTemplate', error)
    }
  }

  // preRender will render frontmatter attribute tags, return final attributes and body
  static async preRender(templateData: string = '', userData: any = {}): Promise<any> {
    if (!new FrontmatterModule().isFrontmatterTemplate(templateData)) {
      return { frontmatterBody: 'INVALID TEMPLATE', frontmatterAttributes: {} }
    }

    const frontmatterData = new FrontmatterModule().parse(templateData)
    const frontmatterAttributes = frontmatterData?.attributes || {}
    const data = { frontmatter: frontmatterAttributes }
    let frontmatterBody = frontmatterData.body
    const attributeKeys = Object.keys(frontmatterAttributes)

    for (const item of attributeKeys) {
      let value = frontmatterAttributes[item]
      // $FlowIgnore
      let attributeValue = await this.render(value, userData)
      frontmatterAttributes[item] = attributeValue
    }

    return { frontmatterBody, frontmatterAttributes: { ...userData, ...frontmatterAttributes } }
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
    let options = ''

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
          // check if options is an array
          if (tagValue.includes('[')) {
            const optionItems = tagValue.replace('[', '').replace(']', '').split(',')
            options = optionItems.map((item) => {
              return item.replace(/'/g, '')
            })
          } else {
            options = tagValue.replace(/(^"|"$)/g, '').replace(/(^'|'$)/g, '')
          }
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
    varName = varName.replace(/ /gi, '_')
    varName = varName.replace(/\?/gi, '')

    return { varName, promptMessage, options }
  }

  static async prompt(message: string, options: any = null): Promise<any> {
    if (Array.isArray(options)) {
      const { index } = await CommandBar.showOptions(options, message)
      return options[index]
    } else {
      if (typeof options === 'string' && options.length > 0) {
        // $FlowIgnore
        return await CommandBar.textPrompt(options, message.replace('_', ' '), '')
      } else {
        return await CommandBar.textPrompt('', message.replace('_', ' '), '')
      }
    }
  }

  static async processPrompts(templateData: string, userData: any, startTag: string = '<%', endTag: string = '%>'): Promise<any> {
    const sessionData = { ...userData }
    const methods = userData.hasOwnProperty('methods') ? Object.keys(userData?.methods) : []

    let sessionTemplateData = templateData.replace(/<%@/gi, '<%- prompt')
    let tags = await this.getTags(sessionTemplateData)
    for (let tag of tags) {
      // if tag is from module, it will contain period so we need to make sure this tag is not a module
      let isMethod = false
      for (const method of methods) {
        if (tag.includes(method)) {
          isMethod = true
        }
      }

      const result = this.constructor.templateGlobals.some((element) => tag.includes(element))
      if (result) {
        isMethod = true
      }

      const doPrompt = (tag) => {
        let check = !this.isVariableTag(tag) && !this.isControlBlock(tag) && !this.isTemplateModule(tag) && !isMethod
        if (!check) {
          check = tag.includes('prompt')
        }

        return check
      }

      if (doPrompt(tag)) {
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
          const outputTag = tag.startsWith('<%=') ? '=' : '-'
          sessionTemplateData = sessionTemplateData.replace(tag, `${startTag}${outputTag} ${varName} ${endTag}`)
        } else {
          sessionTemplateData = sessionTemplateData.replace(tag, `<% 'prompt' -%>`)
        }
      } else {
        // $FlowIgnore
        let { varName, promptMessage, options } = await this.getPromptParameters(tag)
      }
    }

    //.turn control output to standard output
    sessionTemplateData = sessionTemplateData.replace(/<%~/gi, '<%=')

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
    const templateFolder = await getTemplateFolder()

    let templateFilename = (await getTemplateFolder()) + title
    templateFilename = templateFilename.replace('${templateFolder}${templateFolder}', templateFolder)
    try {
      let note = DataStore.projectNoteByFilename(`${templateFilename}.md`)
      if (!note) {
        let note = DataStore.projectNoteByFilename(`${templateFilename}.txt`)
      }
      return note ? true : false
    } catch (error) {
      logError(pluginJson, `templateExists :: ${error}`)
    }
  }

  static async getFolder(folder: string = '', promptMessage: string = 'Select folder'): Promise<string> {
    let selectedFolder = folder
    const folders = DataStore.folders
    if (folder == '<select>' || Editor?.type === 'Calendar') {
      const selection = await CommandBar.showOptions(folders, promptMessage)
      selectedFolder = folders[selection.index]
    } else if (folder == '<current>') {
      const currentFilename = Editor.note?.filename

      if (typeof currentFilename === 'undefined') {
        const selection = await CommandBar.showOptions(folders, promptMessage)
        selectedFolder = folders[selection.index]
      } else {
        const parts = currentFilename.split('/')
        if (parts.length > 1) {
          parts.pop()
          selectedFolder = parts.join('/')
        }
      }
    } else {
      const selection = await CommandBar.showOptions(folders, promptMessage)
      selectedFolder = folders[selection.index]
    }

    return selectedFolder
  }

  static isVariableTag(tag: string = ''): boolean {
    return tag.indexOf('const') > 0 || tag.indexOf('let') > 0 || tag.indexOf('var') > 0 || tag.indexOf('.') > 0 || tag.indexOf('{') > 0 || tag.indexOf('}') > 0
  }

  static isMethod(tag: string = '', userData: any = null): boolean {
    const methods = userData?.hasOwnProperty('methods') ? Object.keys(userData?.methods) : []

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

  static isControlBlock(tag: string): boolean {
    let result = false
    if (tag.length >= 3) {
      if (tag[2] === ' ') {
        result = true
      }
    }

    if (tag.includes('prompt')) {
      result = false
    }

    if (tag.includes('let') || tag.includes('const') || tag.includes('var')) {
      result = true
    }

    if (tag.includes('~')) {
      result = true
    }

    return result
  }
}
