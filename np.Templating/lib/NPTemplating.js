// @flow
/*-------------------------------------------------------------------------------------------
 * Copyright (c) 2022 Mike Erickson / Codedungeon.  All rights reserved.
 * Licensed under the MIT license.  See LICENSE in the project root for license information.
 * -----------------------------------------------------------------------------------------*/
import { semverVersionToNumber } from '@helpers/general'
import pluginJson from '../plugin.json'
import FrontmatterModule from './support/modules/FrontmatterModule'
import DateModule from './support/modules/DateModule'
import { debug, helpInfo } from './helpers'

import globals from './globals'
import { chooseOption } from '@helpers/userInput'
import { clo, log, logError } from '@helpers/dev'
import { datePicker, askDateInterval } from '@helpers/userInput'

/*eslint-disable */
import TemplatingEngine from './TemplatingEngine'
import { parseISOWithOptions } from 'date-fns/fp'

const TEMPLATE_FOLDER_NAME = NotePlan.environment.templateFolder

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
  templateGroupTemplatesByFolder: false,
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
  templateGroupTemplatesByFolder?: boolean,
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

    // each setting update applied will increement
    let updatesApplied = 0
    // current settings version as number
    const settingsVersion: number = semverVersionToNumber(settingsData?.version || '')

    // changes in v1.0.3
    // if (settingsVersion < semverVersionToNumber('1.0.3')) {
    //   updatesApplied++
    //   log(pluginJson, `==> np.Templating 1.0.3 Updates Applied`)
    // }

    if (settingsVersion < semverVersionToNumber('1.1.3')) {
      log(pluginJson, `==> np.Templating 1.1.3 Updates Applied`)
      updatesApplied++
    }

    // update settings version to latest version from plugin.json
    settingsData.version = currentVersion
    if (updatesApplied > 0) {
      log(pluginJson, `==> np.Templating Settings Updated to v${currentVersion}`)

      const templateGroupTemplatesByFolder = DataStore.settings?.templateGroupTemplatesByFolder || false
      DataStore.setPreference('templateGroupTemplatesByFolder', templateGroupTemplatesByFolder)
    }

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
      await this.setup()

      const templateGroupTemplatesByFolder = this.constructor.templateConfig?.templateGroupTemplatesByFolder || false

      const templateList = await this.getTemplateList(tags)

      let options = []
      for (const template of templateList) {
        const parts = template.value.split('/')
        const filename = parts.pop()
        let label = template.value.replace(`${TEMPLATE_FOLDER_NAME}/`, '').replace(filename, template.label)
        if (!templateGroupTemplatesByFolder) {
          const parts = label.split('/')
          label = parts[parts.length - 1]
        }
        options.push({ label, value: template.value })
      }

      // $FlowIgnore
      return await chooseOption<TNote, void>(promptMessage, options)
    } catch (error) {}
  }

  static async getFilenameFromTemplate(note: string = ''): Promise<string> {
    // if nested note, we don't like it
    const parts = note.split('/')
    if (parts.length === 0) {
    }

    const notes = await DataStore.projectNoteByTitle(note, true, false)
    // You have to check that `notes` is NOT null before using it
    // to fix type errors.
    if (notes == null) {
      return 'INCOMPLETE'
    }
    const finalNotes = notes.filter((note) => note.filename.startsWith(TEMPLATE_FOLDER_NAME))
    if (finalNotes.length > 1) {
      return 'MULTIPLE NOTES FOUND'
    } else {
      return notes[0].filename
    }
  }

  static async getTemplateList(types: any = '*'): Promise<any> {
    try {
      await this.setup()
      let settings = await this.getSettings()

      const templateFolder = await getTemplateFolder()
      if (templateFolder == null) {
        await CommandBar.prompt('Templating Error', `An error occurred locating ${templateFolder} folder`)
        return
      }

      const filterTypes = Array.isArray(types) ? types : types.split(',').map((type) => type.trim())

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

      // iterate filter types
      filterTypes.forEach((type) => {
        // include all types
        matches = type === '*' ? matches.concat(allTypes) : matches
        // find matching typews
        if (type[0] !== '!' && allTypes.indexOf(type) > -1) {
          matches.push(allTypes[allTypes.indexOf(type)])
        }

        // remove excluded types
        if (type[0] === '!' && allTypes.indexOf(type.substring(1)) > -1) {
          exclude.push(allTypes[allTypes.indexOf(type.substring(1))])
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
              if (types.includes(match) || (types.includes('*') && filterTypes.includes('*'))) {
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

  static async getTemplateListByTags(tags: any = '*'): Promise<any> {
    try {
      await this.setup()
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
      let allTags = []

      // get master list of tags
      for (const template of allTemplates) {
        if (template.value.length > 0) {
          const templateData = await this.getTemplate(template.value)
          if (templateData.length > 0) {
            const attrs = await new FrontmatterModule().attributes(templateData)

            const tag = attrs?.tags || ''

            if (tag.length > 0) {
              allTags = allTags.concat(tag.split(',')).map((tag) => tag?.trim())
            }
          }
        }
      }
      // remove duplicates
      allTags = allTags.filter((v, i, a) => a.indexOf(v) === i)

      // iterate filter tags
      filterTags.forEach((tag) => {
        // include all tags
        matches = tag === '*' ? matches.concat(allTags) : matches
        // find matching tags
        if (tag[0] !== '!' && allTags.indexOf(tag) > -1) {
          matches.push(allTags[allTags.indexOf(tag)])
        }

        // remove excluded tags
        if (tag[0] === '!' && allTags.indexOf(tag.substring(1)) > -1) {
          exclude.push(allTags[allTags.indexOf(tag.substring(1))])
        }
      })

      // always ignore templates which include a `ignore` tags
      exclude.push('ignore') // np.Templating specific

      // merge the arrays together using differece
      let finalMatches = matches.filter((x) => !exclude.includes(x))

      let templateList = []
      for (const template of allTemplates) {
        if (template.value.length > 0) {
          const templateData = await this.getTemplate(template.value)
          if (templateData.length > 0) {
            const attrs = await new FrontmatterModule().attributes(templateData)

            const tag = attrs?.tags || ''
            let tags = (tag.length > 0 && tag?.split(',')) || ['*']
            tags.forEach((element, index) => {
              tags[index] = element.trim() // trim element whitespace
            })

            // log(pluginJson, `template tags tags: ${tags.length}`)
            finalMatches.every((match) => {
              if (tags.includes(match) || (tags.includes('*') && filterTags.includes('*'))) {
                // check if tags includes any excluded items
                if (tags.filter((x) => exclude.includes(x)).length === 0) {
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
    await this.setup()

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
          // templateFilename = `${templateFolderName}/${templateName}`
          templateFilename = parts.pop()

          let templates = await DataStore.projectNoteByTitle(templateFilename, true, false)
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
        await CommandBar.prompt('Template Error', `Unable to locate ${originalFilename}`)
      }

      let templateContent = selectedTemplate?.content || ''

      let isFrontmatterTemplate = templateContent.length > 0 ? new FrontmatterModule().isFrontmatterTemplate(templateContent) : false

      if (isFrontmatterTemplate) {
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
      if (tag === '<%- meetingName %>' || tag === '<%- meetingName() %>') {
        newTemplateData = newTemplateData.replace(tag, `<%- prompt('meetingName','Enter Meeting Name:') %>`)
      }
    })

    return { newTemplateData, newSettingData }
  }

  static async renderTemplate(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    const usePrompts = true
    try {
      await this.setup()

      let templateData = await this.getTemplate(templateName)
      let renderedData = await this.render(templateData, userData, userOptions)

      return this._filterTemplateResult(renderedData)
    } catch (error) {
      return this.templateErrorMessage('NPTemplating.renderTemplate', error)
    }
  }

  static async render(inTemplateData: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    const usePrompts = false

    try {
      await this.setup()

      let sessionData = { ...userData }

      // work around an issue when creating templates references on iOS (Smart Quotes Enabled)
      let templateData = inTemplateData.replace(/‘/gi, `'`).replace(/’/gi, `'`).replace(/“/gi, `'`).replace(/”/gi, `'`)

      if (typeof templateData !== 'string') {
        templateData = templateData.toString()
      }

      let globalData = {}
      Object.getOwnPropertyNames(globals).forEach((key) => {
        globalData[key] = getProperyValue(globals, key)
      })

      sessionData.methods = { ...sessionData.methods, ...globalData }

      templateData = templateData.replace(/<%@/gi, '<%- prompt')

      const isFrontmatterTemplate = new FrontmatterModule().isFrontmatterTemplate(templateData)
      if (isFrontmatterTemplate) {
        const { frontmatterAttributes, frontmatterBody } = await this.preRender(templateData, sessionData)
        templateData = frontmatterBody //.replace(/---/gi, '*****')
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
    await this.setup()

    let sectionData = { ...userData }
    if (!new FrontmatterModule().isFrontmatterTemplate(templateData)) {
      let msg = '**Invalid Template Format**\n\nThe selected template is not in supported format.\n'
      msg += helpInfo('Template Anatomy: Frontmatter')
      return { frontmatterBody: msg, frontmatterAttributes: {} }
    }

    const frontmatterData = new FrontmatterModule().parse(templateData)
    const frontmatterAttributes = frontmatterData?.attributes || {}
    const data = { frontmatter: frontmatterAttributes }
    let frontmatterBody = frontmatterData.body
    const attributeKeys = Object.keys(frontmatterAttributes)

    for (const item of attributeKeys) {
      let value = frontmatterAttributes[item]

      let attributeValue = await this.render(value, sectionData)
      sectionData[item] = attributeValue
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
            switch (options) {
              case '=now':
              case '%today%':
                options = new DateModule().now('YYYY-MM-DD')
                break
              case '%yesterday%':
                options = new DateModule().yesterday('YYYY-MM-DD')
                break
              case '%tomorrow%':
                options = new DateModule().tomorrow('YYYY-MM-DD')
                break
              case '%timestamp%':
                options = new DateModule().timestamp('YYYY-MM-DD')
                break
            }
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
      let value = ''
      if (typeof options === 'string' && options.length > 0) {
        value = await CommandBar.textPrompt('', message.replace('_', ' '), options)
      } else {
        value = await CommandBar.textPrompt('', message.replace('_', ' '), '')
      }

      return value
    }
  }

  static async promptDate(message: string, defaultValue: string): Promise<any> {
    return await datePicker(message)
  }

  static async promptDateInterval(message: string, defaultValue: string): Promise<any> {
    return await askDateInterval(message)
  }

  static async processPrompts(templateData: string, userData: any, startTag: string = '<%', endTag: string = '%>'): Promise<any> {
    const sessionData = { ...userData }
    const methods = userData.hasOwnProperty('methods') ? Object.keys(userData?.methods) : []

    let sessionTemplateData = templateData

    sessionTemplateData = sessionTemplateData.replace(/<%@/gi, '<%- prompt')
    sessionTemplateData = sessionTemplateData.replace(/system.promptDateInterval/gi, 'promptDateInterval')
    sessionTemplateData = sessionTemplateData.replace(/system.promptDate/gi, 'promptDate')
    sessionTemplateData = sessionTemplateData.replace(/<%=/gi, '<%-')

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
        // let check = !this.isVariableTag(tag) && !this.isControlBlock(tag) && !this.isTemplateModule(tag) && !isMethod
        // if (!check) {
        //   check = tag.includes('prompt')
        // }

        let check = tag.includes('prompt')

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

          // NOTE: Only templating prompt methods will be able to use placeholder variable
          // NOTE: if executing a global method, the result will not be captured as variable placeholder
          //       thus, it will be executed as many times as it is in template

          let response = ''
          if (tag.includes('promptDate(')) {
            response = await datePicker(JSON.stringify({ question: promptMessage }), {})
          } else if (tag.includes('promptDateInterval(')) {
            response = await askDateInterval(JSON.stringify({ question: promptMessage }))
          } else {
            response = await await this.prompt(promptMessage, options) // double await is correct here
          }

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
          // if this is command only (starts with <%) meanining no output, remove entry
          if (this.isVariableTag(tag)) {
            const parts = tag.split(' ')
            if (parts.length >= 2) {
              varName = parts[2]
              sessionTemplateData = sessionTemplateData.replace(`${tag}\n`, '')
              const keys = Object.keys(sessionData)
              for (let index = 0; index < keys.length; index++) {
                if (keys[index].indexOf(`=_${varName}`) >= 0) {
                  sessionData[varName] = sessionData[keys[index]]
                }
              }
            }
          }

          if (!tag.startsWith('<%-')) {
            sessionTemplateData = sessionTemplateData.replace(`${tag}\n`, '')
          } else {
            sessionTemplateData = sessionTemplateData.replace(tag, `${startTag}${outputTag} ${varName} ${endTag}`)
          }
        } else {
          sessionTemplateData = sessionTemplateData.replace(tag, `<% 'prompt' -%>`)
        }
      } else {
        // $FlowIgnore
        let { varName, promptMessage, options } = await this.getPromptParameters(tag)
      }
    }

    sessionTemplateData = sessionTemplateData.replace(/<%~/gi, '<%=')

    return { sessionTemplateData, sessionData }
  }

  static async createTemplate(title: string = '', metaData: any, content: string = ''): Promise<mixed> {
    try {
      await this.setup()

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
    await this.setup()

    const templateFolder = await getTemplateFolder()

    let templateFilename = (await getTemplateFolder()) + title.replace(/@Templates/gi, '').replace(/\/\//, '/')
    templateFilename = await NPTemplating.normalizeToNotePlanFilename(templateFilename)
    try {
      let note = undefined
      note = await DataStore.projectNoteByFilename(`${templateFilename}.md`)

      if (typeof note === 'undefined') {
        note = await DataStore.projectNoteByFilename(`${templateFilename}.txt`)
      }

      return typeof note !== 'undefined'
    } catch (error) {
      logError(pluginJson, `templateExists :: ${error}`)
    }
  }

  static async getFolder(folder: string = '', promptMessage: string = 'Select folder'): Promise<string> {
    await this.setup()

    let selectedFolder = folder
    const folders = DataStore.folders
    if (folder == '<select>' || (Editor?.type === 'Calendar' && selectedFolder.length === 0)) {
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
      if (selectedFolder.length === 0) {
        const selection = await CommandBar.showOptions(folders, promptMessage)
        selectedFolder = folders[selection.index]
      }
    }

    return selectedFolder
  }

  static isVariableTag(tag: string = ''): boolean {
    return tag.indexOf('<% const') > 0 || tag.indexOf('<% let') > 0 || tag.indexOf('<% var') > 0 || tag.indexOf('.') > 0 || tag.indexOf('{') > 0 || tag.indexOf('}') > 0
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

  static async isCommandAvailable(pluginId: string, pluginCommand: string): Promise<boolean> {
    try {
      let result = DataStore.installedPlugins().filter((plugin) => {
        return plugin.id === pluginId
      })

      let commands = typeof result !== 'undefined' && Array.isArray(result) && result.length > 0 && result[0].commands
      if (commands) {
        // $FlowIgnore
        let command = commands.filter((command) => {
          return command.name === pluginCommand
        })

        return Array.isArray(command) && command.length > 0
      } else {
        return false
      }
    } catch (error) {
      logError(pluginJson, error)
      return false
    }
  }

  static async invokePluginCommandByName(pluginId: string, pluginCommand: string, args?: $ReadOnlyArray<mixed> = []): Promise<string | void> {
    if (await this.isCommandAvailable(pluginId, pluginCommand)) {
      return (await DataStore.invokePluginCommandByName(pluginCommand, pluginId, args)) || ''
    } else {
      const info = helpInfo('Plugin Error')
      return `**Unable to locate "${pluginId} :: ${pluginCommand}".  Make sure "${pluginId}" plugin has been installed.**\n\n${info}`
    }
  }

  static async convertNoteToFrontmatter(projectNote: string): Promise<number | string> {
    return new FrontmatterModule().convertProjectNoteToFrontmatter(projectNote)
  }
}
