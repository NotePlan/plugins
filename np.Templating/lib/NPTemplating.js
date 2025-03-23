// @flow
/* eslint-disable */

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
import { clo, log, logError, logDebug, logWarn, timer, clof } from '@helpers/dev'
import { datePicker, askDateInterval, chooseFolder } from '@helpers/userInput'
import { getValuesForFrontmatterTag } from '@helpers/NPFrontMatter'
/*eslint-disable */
import TemplatingEngine from './TemplatingEngine'
import { processPrompts } from './support/modules/prompts'
import { getRegisteredPromptNames } from './support/modules/prompts/PromptRegistry'

// - if a new module has been added, make sure it has been added to this list
const TEMPLATE_MODULES = ['calendar', 'date', 'frontmatter', 'note', 'system', 'time', 'user', 'utility']

const CODE_BLOCK_COMMENT_TAGS = ['/* template: ignore */', '// template: ignore']

const isCommentTag = (tag: string = '') => {
  return tag.includes('<%#')
}

const codeBlockHasComment = (codeBlock: string = '') => {
  const CODE_BLOCK_COMMENT_TAGS = ['template: ignore', 'template:ignore']
  return CODE_BLOCK_COMMENT_TAGS.some((tag) => codeBlock.includes(tag))
}

const blockIsJavaScript = (codeBlock: string = '') => {
  return codeBlock.includes('```templatejs') // change from js/javascript to templatejs
}

const getCodeBlocks = (templateData: string = '') => {
  const CODE_BLOCK_TAG = '```'

  let codeBlocks = []

  let blockStart = templateData.indexOf(CODE_BLOCK_TAG)
  while (blockStart >= 0) {
    let blockEnd = templateData.indexOf(CODE_BLOCK_TAG, blockStart + CODE_BLOCK_TAG.length)
    if (blockEnd === -1) {
      blockEnd = templateData.length
    }
    const fencedCodeBlock = templateData.substring(blockStart, blockEnd + CODE_BLOCK_TAG.length)
    if (fencedCodeBlock.length > 0) {
      codeBlocks.push(fencedCodeBlock)
    }
    blockStart = templateData.indexOf(CODE_BLOCK_TAG, blockEnd + 1)
  }

  return codeBlocks
}

const getIgnoredCodeBlocks = (templateData: string = '') => {
  let ignoredCodeBlocks = []
  const codeBlocks = getCodeBlocks(templateData)
  codeBlocks.forEach((codeBlock) => {
    if (codeBlockHasComment(codeBlock)) {
      ignoredCodeBlocks.push(codeBlock)
    }
  })

  return ignoredCodeBlocks
}

const convertJavaScriptBlocksToTags = (templateData: string = '') => {
  let result = templateData
  const codeBlocks = getCodeBlocks(templateData)
  codeBlocks.forEach((codeBlock) => {
    if (!codeBlockHasComment(codeBlock) && blockIsJavaScript(codeBlock)) {
      if (!codeBlock.includes('<%')) {
        let newBlock = codeBlock.replace('```templatejs\n', '').replace('```', '')
        // newBlock = '```javascript\n' + `<% ${newBlock} %>` + '\n```'
        newBlock = `<% ${newBlock} -%>`
        result = result.replace(codeBlock, newBlock)
      }
    }
  })

  return result
}

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
export const DEFAULT_TEMPLATE_CONFIG: {
  templateFolderName: string,
  templateLocale: string,
  templateGroupTemplatesByFolder: boolean,
  dateFormat: string,
  timeFormat: string,
  defaultFormats: {
    now: string,
  },
} = {
  templateFolderName: typeof NotePlan !== 'undefined' ? NotePlan.environment.templateFolder : '@Templates',
  templateLocale: 'en-US',
  templateGroupTemplatesByFolder: false,
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'HH:mm',
  defaultFormats: {
    now: 'YYYY-MM-DD HH:mm',
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
  return NotePlan.environment.templateFolder
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

  static _removeWhitespaceFromCodeBlocks(str: string = ''): string {
    let result = str
    getCodeBlocks(str).forEach((codeBlock) => {
      let newCodeBlock = codeBlock
      logDebug(pluginJson, `_removeWhitespaceFromCodeBlocks codeBlock before: "${newCodeBlock}"`)
      newCodeBlock = newCodeBlock.replace('```javascript\n', '').replace(/```/gi, '').replace(/\n\n/gi, '').replace(/\n/gi, '')
      logDebug(pluginJson, `_removeWhitespaceFromCodeBlocks codeBlock after: "${newCodeBlock}"`)
      result = result.replace(codeBlock, newCodeBlock)
    })

    return result.replace(/\n\n\n/gi, '\n')
  }

  static _filterTemplateResult(templateResult: string = ''): string {
    // NOTE: @codedungeon originally had this filterTemplateResult to remove code blocks from final output
    // assuming the only reason someone would use code blocks was to create multi-line templating code
    // but since users actually want to use code blocks in their templates, this is no longer a valid assumption

    // let result = this_removeWhitespaceFromCodeBlocks(templateResult) // dbw removed the _removeWhitespaceFromCodeBlocks to leave code blocks intact
    let result = templateResult
    // result = result.replace('ejs', 'template') // dbw removed this to allow for users who have the letters ejs in text in their notes
    result = result.replace('If the above error is not helpful, you may want to try EJS-Lint:', '')
    // result = result.replace(/(?:https?|ftp):\/\/[\n\S]+/g, 'HTTP_REMOVED')
    result = result.replace('https://github.com/RyanZim/EJS-Lint', 'HTTP_REMOVED')
    if (result.includes('HTTP_REMOVED')) {
      result += '\nFor more information on proper template syntax, refer to:\n'
      result += 'https://noteplan.co/templates/docs\n'
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

    if (settingsVersion < semverVersionToNumber('2.0.0')) {
      log(pluginJson, `==> np.Templating 2.0.0 Updates Applied`)
      updatesApplied++
    }

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

  static async chooseTemplate(tags?: any = '*', promptMessage: string = 'Choose Template', userOptions: any = null): Promise<any> {
    try {
      await this.setup()

      let templateGroupTemplatesByFolder = this.constructor.templateConfig?.templateGroupTemplatesByFolder || false
      if (userOptions && userOptions.hasOwnProperty('templateGroupTemplatesByFolder')) {
        templateGroupTemplatesByFolder = userOptions.templateGroupTemplatesByFolder
      }

      const templateList = await this.getTemplateList(tags)

      let options = []
      for (const template of templateList) {
        const parts = template.value.split('/')
        const filename = parts.pop()
        let label = template.value.replace(`${NotePlan.environment.templateFolder}/`, '').replace(filename, template.label.replace('/', '-'))
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
    const finalNotes = notes.filter((note) => note.filename.startsWith(NotePlan.environment.templateFolder))
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

      const filterTypes = Array.isArray(types) ? types : types.split(',').map((type: string) => type.trim())

      const allTemplates = DataStore.projectNotes
        .filter((n) => n.filename?.startsWith(templateFolder))
        .filter((n) => !n.frontmatterTypes.includes('ignore'))
        .filter((n) => !n.frontmatterTypes.includes('template-helper'))
        .filter((n) => !n.title?.startsWith('_configuration'))
        .filter((n) => !n.filename?.startsWith('Delete After Release'))
        .sort((a, b) => {
          return a.filename.localeCompare(b.filename)
        })
        .map((note) => {
          return note.title == null ? null : { label: note.title, value: note.filename }
        })
        .filter(Boolean)

      let resultTemplates: Array<TNote> = []
      let matches: Array<string> = []
      let exclude: Array<string> = []
      let allTypes: Array<string> = []

      // get master list of types
      for (const template of allTemplates) {
        if (template.value.length > 0) {
          const templateData = await this.getTemplate(template.value)
          if (templateData.length > 0) {
            const attrs = await new FrontmatterModule().attributes(templateData)
            let type = attrs?.type || ''
            if (typeof type === 'string') {
              if (type.length > 0) {
                allTypes = allTypes.concat(type.split(',')).map((type) => type?.trim())
              }
            } else if (Array.isArray(type)) {
              allTypes = allTypes.concat(...type)
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
            let types = (type.length > 0 && typeof type === 'string' ? type?.split(',') : type) || ['*']
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

      const filterTags = Array.isArray(tags) ? tags : tags.split(',').map((tag: string) => tag.trim())

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
      let allTags: Array<string> = []

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

  static async getTemplate(templateName: string = '', options: any = { showChoices: true, silent: false }): Promise<string> {
    const startTime = new Date()
    const isFilename = templateName.endsWith('.md') || templateName.endsWith('.txt')
    await this.setup()
    if (templateName.length === 0) {
      return ''
    }

    const parts = templateName.split('/')
    const filename = parts.pop()

    let templateFolderName = await getTemplateFolder()
    let originalFilename = templateName
    let templateFilename = templateName
    if (!templateName.includes(templateFolderName)) {
      templateFilename = `${templateFolderName}/${templateName}`
    }
    let selectedTemplate: TNote | null = null

    try {
      if (isFilename) {
        // dbw NOTE: I don't understand why we need to do all of this rather than just use the filename directly
        // const normalizedFilename = await this.normalizeToNotePlanFilename(filename)
        // templateFilename = templateFilename.replace(filename, normalizedFilename)
        // templateFilename = templateFilename.replace(/.md|.txt/gi, '')
        // const extension = DataStore.defaultFileExtension || 'md'
        // const fullFilename = `${templateFilename}.${extension}`
        const fullFilename = templateFilename
        selectedTemplate = (await DataStore.projectNoteByFilename(fullFilename)) || null

        // if the template can't be found using actual filename (as it is on disk)
        // this will occur due to an issue in NotePlan where name on disk does not match note (or template) name
        if (!selectedTemplate) {
          const parts = templateName.split('/')
          if (parts.length > 0) {
            // templateFilename = `${templateFolderName}/${templateName}`
            templateFilename = parts.pop() || ''
          }
        }
      }

      if (!selectedTemplate) {
        // we don't have a template yet, so we need to find one using title
        let templates: Array<TNote> = []
        if (isFilename) {
          logDebug(pluginJson, `NPTemplating.getTemplate: Searching for template by title without path "${originalFilename}" isFilename=${String(isFilename)}`)
          templates = (await DataStore.projectNoteByTitle(originalFilename, true, false)) || []
        } else {
          // if it was a path+title, we need to look for just the name part without the path
          logDebug(pluginJson, `NPTemplating.getTemplate: Searching for template by title without path "${filename || ''}" isFilename=${String(isFilename)}`)
          templates = filename ? (await DataStore.projectNoteByTitle(filename, true, false)) || [] : []
          logDebug(pluginJson, `NPTemplating.getTemplate ${filename || ''}: Found ${templates.length} templates`)
          if (parts.length > 0 && templates && templates.length > 0) {
            // ensure the path part matched
            let path = parts.join('/')
            if (!path.startsWith(templateFolderName)) {
              path = templateFolderName + (path.startsWith('/') ? path : `/${path}`)
            }
            templates = templates.filter((template) => template.filename.startsWith(path)) || []
          }
        }
        if (templates && templates.length > 1) {
          logWarn(pluginJson, `NPTemplating.getTemplate: Multiple templates found for "${templateFilename || ''}"`)
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
          } else if (templatesSecondary.length === 1) {
            // $FlowIgnore
            selectedTemplate = await DataStore.projectNoteByFilename(templatesSecondary[0].value)
          } else {
            logError(pluginJson, `NPTemplating.getTemplate: No templates found for ${templateFilename}`)
          }
        } else {
          selectedTemplate = Array.isArray(templates) && templates.length > 0 ? templates[0] : null
        }
      }

      if (selectedTemplate) {
        // logDebug(pluginJson, `NPTemplating.getTemplate: Found template "${selectedTemplate.filename}" in ${timer(startTime)}`)
      }

      // template not found
      if (!selectedTemplate && !options.silent) {
        await CommandBar.prompt('Template Error', `Unable to locate "${originalFilename}"`)
        logDebug(pluginJson, `NPTemplating.getTemplate: Unable to locate ${originalFilename} ${timer(startTime)}`)
        return ''
      }

      let templateContent = selectedTemplate?.content || ''

      let isFrontmatterTemplate = templateContent.length > 0 ? new FrontmatterModule().isFrontmatterTemplate(templateContent) : false

      if (isFrontmatterTemplate) {
        return templateContent || ''
      }
      logDebug(pluginJson, `NPTemplating.getTemplate: isFrontmatterTemplate=${String(isFrontmatterTemplate)} ${timer(startTime)}`)

      if (templateContent == null || (templateContent.length === 0 && !options.silent)) {
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
      logError(pluginJson, `NPTemplating.getTemplate: Error="${error.message}" ${timer(startTime)}`)
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

  //TODO: consider using getTemplateNote
  static async getNote(notePath: string = ''): Promise<string> {
    let content: string = ''

    const noteParts = notePath.split('/')
    const noteName = noteParts.pop()
    const noteFolder = noteParts.join('/')

    if (noteName && noteName.length > 0) {
      const foundNotes = DataStore.projectNoteByTitle(noteName || '', true, noteFolder.length === 0)
      if (typeof foundNotes !== 'undefined' && Array.isArray(foundNotes)) {
        if (foundNotes.length === 1) {
          content = foundNotes[0].content || ''
        } else {
          for (const note of foundNotes) {
            const parts = note.filename.split('/')
            parts.pop()
            const folder = parts.join('/')
            if (folder === noteFolder) {
              content = note.content || ''
            }
          }
        }
      }
    }

    return content
  }

  static async preProcessNote(tag: string = ''): Promise<string> {
    if (!isCommentTag(tag)) {
      const includeInfo = tag.replace('<%-', '').replace('%>', '').replace('note', '').replace('(', '').replace(')', '')
      const parts = includeInfo.split(',')
      if (parts.length > 0) {
        const noteNamePath = parts[0].replace(/'/gi, '').trim()
        const content = await this.getNote(noteNamePath)
        if (content.length > 0) {
          // $FlowIgnore
          return content
        } else {
          return `**An error occurred loading note "${noteNamePath}"**`
        }
      } else {
        return `**An error occurred process note**`
      }
    }

    return ''
  }

  static async preProcessCalendar(tag: string = ''): Promise<string> {
    if (!isCommentTag(tag)) {
      const includeInfo = tag.replace('<%-', '').replace('%>', '').replace('calendar', '').replace('(', '').replace(')', '')
      const parts = includeInfo.split(',')
      if (parts.length > 0) {
        const noteName = parts[0].replace(/'/gi, '').trim()
        let calendarNote = await DataStore.calendarNoteByDateString(noteName)
        if (typeof calendarNote !== 'undefined') {
          // $FlowIgnore
          return calendarNote.content
        } else {
          return `**An error occurred loading note "${noteName}"**`
        }
      } else {
        return `**An error occurred process note**`
      }

      return ''
    }

    return ''
  }

  /**
   * Process a template string and prepare it for rendering
   * @param {string} templateData - The template string to process
   * @param {Object} sessionData - Data available during processing
   * @returns {Object} - Processed template data, updated session data, and any errors
   */
  static async preProcess(templateData: string, sessionData?: {} = {}): Promise<mixed> {
    // Initialize the processing context
    const context = {
      templateData: templateData || '',
      sessionData: { ...sessionData },
      jsonErrors: [],
      criticalError: false,
      override: {},
    }

    // Handle null/undefined gracefully
    if (context.templateData === null || context.templateData === undefined) {
      return {
        newTemplateData: context.templateData,
        newSettingData: context.sessionData,
        jsonErrors: context.jsonErrors,
        criticalError: context.criticalError,
      }
    }

    // Get all template tags
    const tags = (await this.getTags(context.templateData)) || []

    // Process each tag in a single pass
    for (const tag of tags) {
      logDebug(pluginJson, `preProcess tag: ${tag}`)

      // Process different tag types
      if (isCommentTag(tag)) {
        await this._processCommentTag(tag, context)
        continue
      }

      if (tag.includes('note(')) {
        await this._processNoteTag(tag, context)
        continue
      }

      if (tag.includes('calendar(')) {
        await this._processCalendarTag(tag, context)
        continue
      }

      if (tag.includes('include(') || tag.includes('template(')) {
        await this._processIncludeTag(tag, context)
        continue
      }

      if (tag.includes(':return:') || tag.toLowerCase().includes(':cr:')) {
        await this._processReturnTag(tag, context)
        continue
      }

      // Process code tags that need await prefixing
      if (this.isCode(tag) && tag.includes('(')) {
        await this._processCodeTag(tag, context)
        continue
      }

      // Extract variables
      if (tag.includes('const') || tag.includes('let') || tag.includes('var')) {
        await this._processVariableTag(tag, context)
        continue
      }
    }

    // Merge override variables into session data
    context.sessionData = { ...context.sessionData, ...context.override }

    // Fix JSON in DataStore.invokePluginCommandByName calls
    await this._processJsonInDataStoreCalls(context)

    // Return the processed data
    return {
      newTemplateData: context.templateData,
      newSettingData: context.sessionData,
      jsonErrors: context.jsonErrors,
      criticalError: context.criticalError,
    }
  }

  /**
   * Process comment tags by removing them from the template
   * @private
   */
  static async _processCommentTag(
    tag: string,
    context: { templateData: string, sessionData: Object, jsonErrors: Array<any>, criticalError: boolean, override: Object },
  ): Promise<void> {
    const regex = new RegExp(`${tag}[\\s\\r\\n]*`, 'g')
    context.templateData = context.templateData.replace(regex, '')
  }

  /**
   * Process note tags by replacing them with the note content
   * @private
   */
  static async _processNoteTag(
    tag: string,
    context: { templateData: string, sessionData: Object, jsonErrors: Array<any>, criticalError: boolean, override: Object },
  ): Promise<void> {
    context.templateData = context.templateData.replace(tag, await this.preProcessNote(tag))
  }

  /**
   * Process calendar tags by replacing them with the calendar note content
   * @private
   */
  static async _processCalendarTag(
    tag: string,
    context: { templateData: string, sessionData: Object, jsonErrors: Array<any>, criticalError: boolean, override: Object },
  ): Promise<void> {
    context.templateData = context.templateData.replace(tag, await this.preProcessCalendar(tag))
  }

  /**
   * Process return/carriage return tags by removing them
   * @private
   */
  static async _processReturnTag(
    tag: string,
    context: { templateData: string, sessionData: Object, jsonErrors: Array<any>, criticalError: boolean, override: Object },
  ): Promise<void> {
    context.templateData = context.templateData.replace(tag, '')
  }

  /**
   * Process code tags by adding await prefix to function calls
   * @private
   */
  static async _processCodeTag(
    tag: string,
    context: { templateData: string, sessionData: Object, jsonErrors: Array<any>, criticalError: boolean, override: Object },
  ): Promise<void> {
    // Extract the code content from inside the tag
    const startDelim = tag.startsWith('<%=') ? '<%=' : tag.startsWith('<%-') ? '<%-' : '<%'
    const endDelim = tag.endsWith('-%>') ? '-%>' : '%>'
    const codeContent = tag.substring(startDelim.length, tag.length - endDelim.length).trim()

    // Split by lines to process each line individually
    const lines = codeContent.split('\n')
    const processedLines: Array<string> = []

    // Process each line
    for (let line of lines) {
      line = line.trim()
      if (line.length === 0) {
        processedLines.push(line)
        continue
      }

      // Handle semicolon-separated statements on one line
      if (line.includes(';')) {
        const statements = line
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
        const processedStatements: Array<string> = []

        for (let statement of statements) {
          // Process each statement individually
          processedStatements.push(processStatementForAwait(statement))
        }

        // Keep statements on the same line with semicolons between them
        processedLines.push(processedStatements.join('; '))
      } else {
        // Process single statement
        processedLines.push(processStatementForAwait(line))
      }
    }

    // Helper function to process a single statement
    function processStatementForAwait(statement: string): string {
      // Skip if already has await
      if (statement.includes('await ')) {
        return statement
      }

      // Process variable declarations with function calls
      // Regex: matches start of line with 'const', 'let', or 'var' followed by one or more word characters,
      // optional whitespace, an equals sign, and optional whitespace
      const varDeclRegex = /^(const|let|var)\s+\w+\s*=\s*/
      if (varDeclRegex.test(statement)) {
        const match = statement.match(varDeclRegex)
        if (match) {
          const declarationPart = match[0] // e.g., "const result = "
          const restOfStatement = statement.substring(declarationPart.length)

          // Check if the right side contains a function call
          // Regex to handle object methods with dot notation
          // Matches patterns like DataStore.invoke(...) or just invoke(...)
          // \w+(?:\.\w+)* captures: word chars followed by optional dot-separated word chars
          // \s* matches any whitespace
          // \([^)]*\) matches opening paren, any chars except closing paren, then closing paren
          const correctedFunctionCallRegex = /^\s*(\w+(?:\.\w+)*)\s*\([^)]*\)/

          if (correctedFunctionCallRegex.test(restOfStatement)) {
            // Insert await before the function call portion, not the entire statement
            return declarationPart + 'await ' + restOfStatement
          }
        }
        return statement
      }

      // Skip any prompt-related function calls (they are processed separately)
      // This regex matches any prompt functions: prompt, promptDate, promptDateInterval, etc.
      // \w*prompt\w* matches any word containing "prompt"
      // \s* matches optional whitespace
      // \( matches the opening parenthesis
      if (statement.match(/\w*prompt\w*\s*\(/i)) {
        return statement
      }

      // Add await to function calls for other statements
      // Matches one or more word characters, optional dot notation segments,
      // optional whitespace, open paren, any chars except close paren, close paren
      // This regex handles both simple function calls and object method calls (with dots)
      const generalFunctionCallRegex = /(\w+(?:\.\w+)*)\s*\([^)]*\)/
      if (statement.match(generalFunctionCallRegex)) {
        return `await ${statement}`
      }

      return statement
    }

    // Rebuild the tag with processed lines
    const newCodeContent = processedLines.join('\n')
    const newTag = `${startDelim} ${newCodeContent} ${endDelim}`

    // Replace the original tag with the new one
    context.templateData = context.templateData.replace(tag, newTag)
  }

  /**
   * Process include/template tags by replacing them with the included template content
   * @private
   */
  static async _processIncludeTag(
    tag: string,
    context: { templateData: string, sessionData: Object, jsonErrors: Array<any>, criticalError: boolean, override: Object },
  ): Promise<void> {
    if (isCommentTag(tag)) return

    let includeInfo = tag
    const keywords = ['<%=', '<%-', '<%', '_%>', '-%>', '%>', 'include', 'template']
    keywords.forEach((x) => (includeInfo = includeInfo.replace(/[{()}]/g, '').replace(new RegExp(x, 'g'), '')))

    const parts = includeInfo.split(',')
    if (parts.length === 0) {
      context.templateData = context.templateData.replace(tag, '**Unable to parse include**')
      return
    }

    const templateName = parts[0].replace(/['"`]/gi, '').trim()
    const templateData = parts.length >= 1 ? parts[1] : {}

    const templateContent = await this.getTemplate(templateName, { silent: true })
    const isTemplate = new FrontmatterModule().isFrontmatterTemplate(templateContent)

    if (isTemplate) {
      const { frontmatterAttributes, frontmatterBody } = await this.preRender(templateContent, context.sessionData)
      context.sessionData = { ...frontmatterAttributes }
      logDebug(pluginJson, `preProcess tag: ${tag} frontmatterAttributes: ${JSON.stringify(frontmatterAttributes, null, 2)}`)
      const renderedTemplate = await this.render(frontmatterBody, context.sessionData)

      // Handle variable assignment
      if (tag.includes('const') || tag.includes('let')) {
        const pos = tag.indexOf('=')
        if (pos > 0) {
          let temp = tag
            .substring(0, pos - 1)
            .replace('<%', '')
            .trim()
          let varParts = temp.split(' ')
          context.override[varParts[1]] = renderedTemplate
          context.templateData = context.templateData.replace(tag, '')
        }
      } else {
        context.templateData = context.templateData.replace(tag, renderedTemplate)
      }
    } else {
      // Handle special case for calendar data
      if (templateName.length === 8 && /^\d+$/.test(templateName)) {
        const calendarData = await this.preProcessCalendar(templateName)
        context.templateData = context.templateData.replace(tag, calendarData)
      } else {
        context.templateData = context.templateData.replace(tag, await this.preProcessNote(templateName))
      }
    }
  }

  /**
   * Process variable declaration tags
   * @private
   */
  static async _processVariableTag(
    tag: string,
    context: { templateData: string, sessionData: Object, jsonErrors: Array<any>, criticalError: boolean, override: Object },
  ): Promise<void> {
    if (!context.sessionData) return

    const tempTag = tag.replace('const', '').replace('let', '').trimLeft().replace('<%', '').replace('-%>', '').replace('%>', '')
    const pos = tempTag.indexOf('=')
    if (pos <= 0) return

    let varName = tempTag.substring(0, pos - 1).trim()
    let value = tempTag.substring(pos + 1).trim()

    // Determine value type and process accordingly
    if (this._getValueType(value) === 'string') {
      value = value.replace(/^["'](.*)["']$/, '$1').trim() // Remove outer quotes only
    } else if (this._getValueType(value) === 'array' || this._getValueType(value) === 'object') {
      // For objects and arrays, preserve the exact structure including quotes
      // Just clean up any extra quotes that might be around the entire object/array
      value = value.replace(/^["'](.*)["']$/, '$1').trim()
    }

    context.sessionData[varName] = value
  }

  /**
   * Helper method to determine the type of a value
   * @private
   */
  static _getValueType(value: string): string {
    if (value.includes('[')) {
      return 'array'
    }

    if (value.includes('{')) {
      return 'object'
    }

    return 'string'
  }

  /**
   * Process and fix JSON in DataStore.invokePluginCommandByName calls
   * @private
   */
  static async _processJsonInDataStoreCalls(context: {
    templateData: string,
    sessionData: Object,
    jsonErrors: Array<any>,
    criticalError: boolean,
    override: Object,
  }): Promise<void> {
    try {
      // Fix single-quoted JSON in DataStore.invokePluginCommandByName calls
      // This pattern handles the specific format like: ['{'numDays':14, 'sectionHeading':'Test Section'}']
      context.templateData = context.templateData.replace(/\[\'\{([^\}]*)\}\'\]/g, (match, p1) => {
        try {
          // Convert single-quoted property names to double-quoted
          const fixedJson = p1.replace(/'([^']+)':/g, '"$1":')
          return `[{${fixedJson}}]`
        } catch (e) {
          context.jsonErrors.push({
            error: `Error processing JSON: ${e.message}`,
            lineNumber: this._getLineNumberForMatch(context.templateData, match),
            critical: true,
          })
          context.criticalError = true
          return match
        }
      })

      // Handle other single-quoted JSON formats that may appear in the template
      context.templateData = context.templateData.replace(/'(\{[^}]*\})'/g, (match, p1) => {
        try {
          return p1.replace(/'/g, '"')
        } catch (e) {
          context.jsonErrors.push({
            error: `Error processing JSON: ${e.message}`,
            lineNumber: this._getLineNumberForMatch(context.templateData, match),
            critical: true,
          })
          context.criticalError = true
          return match
        }
      })

      // Detect missing closing braces in JSON objects - look for patterns like: {"property":"value"
      // or {"property":14, "another":"value"
      const unclosedBracesPattern = /\{\s*"[^"]+"\s*:\s*("[^"]*"|[0-9]+)(\s*,\s*"[^"]+"\s*:\s*("[^"]*"|[0-9]+))*(?!\s*\})/g
      const unclosedBraces = context.templateData.match(unclosedBracesPattern)
      if (unclosedBraces) {
        context.jsonErrors.push({
          error: `Unclosed JSON object detected. Check for missing closing braces.`,
          lineNumber: this._getLineNumberForMatch(context.templateData, unclosedBraces[0]),
          critical: true,
        })
        context.criticalError = true
      }

      // Detect mixed quotes in JSON objects (both ' and " used as property delimiters)
      const mixedQuotePattern = /\{[^}]*(['"][^'"]*['"])\s*:\s*[^,}]*[,}]/g
      const mixedQuotes = context.templateData.match(mixedQuotePattern)
      if (mixedQuotes) {
        context.jsonErrors.push({
          error: `Mixed quote styles detected in JSON. Stick to one quote style, preferably double quotes.`,
          lineNumber: this._getLineNumberForMatch(context.templateData, mixedQuotes[0]),
          critical: true,
        })
        context.criticalError = true
      }

      // Detect unescaped quotes in JSON strings
      const unescapedQuotesPattern = /"[^"\\]*"[^"\\]*"/g
      const unescapedQuotes = context.templateData.match(unescapedQuotesPattern)
      if (unescapedQuotes) {
        context.jsonErrors.push({
          error: `Unescaped quotes in JSON string detected. Use backslash to escape quotes.`,
          lineNumber: this._getLineNumberForMatch(context.templateData, unescapedQuotes[0]),
          critical: true,
        })
        context.criticalError = true
      }
    } catch (error) {
      logError(pluginJson, `Error in _processJsonInDataStoreCalls: ${error.message}`)
    }
  }

  /**
   * Helper method to get the line number for a match
   * @private
   */
  static _getLineNumberForMatch(templateData: string, match: string): number {
    const lines = templateData.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(match)) {
        return i + 1
      }
    }
    return 0
  }

  static async renderTemplate(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    const usePrompts = true
    try {
      await this.setup()

      const templateData = await this.getTemplate(templateName)
      const { frontmatterBody, frontmatterAttributes } = await this.preRender(templateData)
      const data = { ...frontmatterAttributes, frontmatter: { ...frontmatterAttributes }, ...userData }
      logDebug(pluginJson, `renderTemplate calling render`)
      const renderedData = await this.render(templateData, data, userOptions)

      return this._filterTemplateResult(renderedData)
    } catch (error) {
      clo(error, `NPTemplating.renderTemplate found error dbw1`)
      return this.templateErrorMessage('NPTemplating.renderTemplate', error)
    }
  }

  static async render(inTemplateData: string, userData: any = {}, userOptions: any = {}): Promise<string> {
    const usePrompts = false

    try {
      await this.setup()

      let sessionData = { ...userData },
        templateData = ''

      if (inTemplateData?.replace) {
        // front-matter doesn't always return strings (e.g. "true" is turned into a boolean)
        // work around an issue when creating templates references on iOS (Smart Quotes Enabled)
        templateData = inTemplateData.replace(/'/g, `'`).replace(/'/g, `'`).replace(/"/g, `'`).replace(/"/g, `'`)
      }

      // small edge case, likey never hit
      if (typeof templateData !== 'string') {
        templateData = templateData.toString()
      }

      // load template globals
      // lib/globals.js
      let globalData: { [key: string]: any } = {}
      Object.getOwnPropertyNames(globals).forEach((key) => {
        globalData[key] = getProperyValue(globals, key)
      })

      sessionData.methods = { ...sessionData.methods, ...globalData }

      // convert template prompt tag to `prompt` command
      templateData = templateData.replace(/<%@/gi, '<%- prompt')

      // if template is frontmatter format (which should now always be the case)
      // preRender template attributes, invoking prompts, etc.
      const isFrontmatterTemplate = new FrontmatterModule().isFrontmatterTemplate(templateData)
      if (isFrontmatterTemplate) {
        const { frontmatterAttributes, frontmatterBody } = await this.preRender(templateData, sessionData)
        // templateData = frontmatterBody //.replace(/---/gi, '*****')
        sessionData.data = { ...sessionData.data, ...frontmatterAttributes }
      }

      // import templates/code snippets (if there are any)
      templateData = await this.importTemplates(templateData)
      // return templateData

      // process all template attribute prompts
      if (isFrontmatterTemplate && usePrompts) {
        const frontmatterAttributes = new FrontmatterModule().parse(templateData)?.attributes || {}
        for (const [key, value] of Object.entries(frontmatterAttributes)) {
          let frontMatterValue = value
          // $FlowIgnore
          const promptData = await this.processPrompts(value, sessionData, '<%', '%>')
          frontMatterValue = promptData.sessionTemplateData

          logDebug(pluginJson, `render calling preProcess ${key}: ${frontMatterValue}`)
          // $FlowIgnore
          const { newTemplateData, newSettingData, jsonErrors, criticalError } = await this.preProcess(frontMatterValue, sessionData)

          // If critical JSON errors are found, return an error message instead of rendering
          if (criticalError) {
            const errorLines = jsonErrors
              .filter((err) => err.critical)
              .map((err) => `**Critical JSON Error at line ${err.lineNumber}:** ${err.error}`)
              .join('\n\n')

            return `**Template has critical JSON errors that must be fixed before rendering:**\n\n${errorLines}\n\nPlease check the console log for more details.`
          }

          sessionData = { ...sessionData, ...newSettingData }
          logDebug(pluginJson, `render calling render`)
          const renderedData = await new TemplatingEngine(this.constructor.templateConfig).render(newTemplateData, promptData.sessionData, userOptions)

          // $FlowIgnore
          templateData = templateData.replace(`${key}: ${value}`, `${key}: ${renderedData}`)
        }
        if (userOptions?.qtn) {
          return templateData
        }
      }

      templateData = convertJavaScriptBlocksToTags(templateData)

      // $FlowIgnore
      const { newTemplateData, newSettingData, jsonErrors, criticalError } = await this.preProcess(templateData, sessionData)

      // If critical JSON errors are found, return an error message instead of rendering
      if (criticalError) {
        const errorLines = jsonErrors
          .filter((err) => err.critical)
          .map((err) => `**Critical JSON Error at line ${err.lineNumber}:** ${err.error}`)
          .join('\n\n')

        return `**Template has critical JSON errors that must be fixed before rendering:**\n\n${errorLines}\n\nPlease check the console log for more details.`
      }

      sessionData = { ...newSettingData }

      // perform all prompt operations in template body
      const promptData = await this.processPrompts(newTemplateData, sessionData, '<%', '%>')
      templateData = promptData.sessionTemplateData
      sessionData = promptData.sessionData

      sessionData.data = { ...sessionData.data, ...userData?.data }
      sessionData.methods = { ...sessionData.methods, ...userData?.methods }

      // disable ignored code blocks
      const ignoredCodeBlocks = getIgnoredCodeBlocks(templateData)
      for (let index = 0; index < ignoredCodeBlocks.length; index++) {
        templateData = templateData.replace(ignoredCodeBlocks[index], `__codeblock:${index}__`)
      }

      // template ready for final rendering, this is where most of the magic happens
      const renderedData = await new TemplatingEngine(this.constructor.templateConfig).render(templateData, sessionData, userOptions)

      logDebug(pluginJson, `>> renderedData after rendering:\n\t[PRE-RENDER]:${templateData}\n\t[RENDERED]: ${renderedData}`)

      let final = this._filterTemplateResult(renderedData)

      // restore code blocks
      for (let index = 0; index < ignoredCodeBlocks.length; index++) {
        final = final.replace(`__codeblock:${index}__`, ignoredCodeBlocks[index])
      }

      return final
    } catch (error) {
      clo(error, `NPTemplating.renderTemplate found error dbw2`)
      return this.templateErrorMessage('NPTemplating.renderTemplate', error)
    }
  }

  /**
   * Extracts the title from a markdown string if it starts with a markdown title pattern.
   * Otherwise, sets the title to a default value.
   * @param {string} markdown - The markdown string to process.
   * @returns {{ updatedMarkdown: string, title: string }} An object containing the updated markdown without the title line (if applicable) and the extracted or default title.
   */
  static extractTitleFromMarkdown(markdown: string): { updatedMarkdown: string, title: string } {
    let title = 'foo' // Default title
    let updatedMarkdown = markdown
    const lines = markdown.split('\n')

    // Check if the first line is a title
    if (lines[0].startsWith('# ')) {
      title = lines[0].substring(2) // Extract title, removing "# "
      lines.shift() // Remove the title line
      updatedMarkdown = lines.join('\n')
    }

    return { updatedMarkdown, title }
  }

  // preRender will render frontmatter attribute tags, return final attributes and body
  static async preRender(_templateData: string = '', userData: any = {}): Promise<any> {
    await this.setup()
    let templateData = _templateData
    let sectionData = { ...userData }
    if (!new FrontmatterModule().isFrontmatterTemplate(templateData)) {
      const extractedData = this.extractTitleFromMarkdown(templateData)
      if (!extractedData.title) extractedData.title = 'Untitled (no title found in template)'
      templateData = `---\ntitle: ${extractedData.title}\n---\n${extractedData.updatedMarkdown}`
      logDebug(pluginJson, `Template is not frontmatter, adding extracted title:"${extractedData.title}" to content:${extractedData.updatedMarkdown}`)
      // let msg = '**Invalid Template Format**\n\nThe selected template is not in supported format.\n'
      // msg += helpInfo('Template Anatomy: Frontmatter')
      // return { frontmatterBody: msg, frontmatterAttributes: {} }
    }

    const frontmatterData = new FrontmatterModule().parse(templateData)
    const frontmatterAttributes = frontmatterData?.attributes || {}
    const data = { frontmatter: frontmatterAttributes }
    let frontmatterBody = frontmatterData.body
    const attributeKeys = Object.keys(frontmatterAttributes)

    for (const item of attributeKeys) {
      let value = frontmatterAttributes[item]
      let attributeValue = typeof value === 'string' && value.includes('<%') ? await this.render(value, sectionData) : value
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
    if (!templateData) return []
    const TAGS_PATTERN = /<%.*?%>/gi
    const items = templateData.match(TAGS_PATTERN)
    return items || []
  }

  /**
   * Processes all prompt tags within a template.
   * @param {string} templateData The full template content.
   * @param {any} sessionData The session data to update.
   * @param {string} startTag The starting tag delimiter (default: '<%')
   * @param {string} endTag The ending tag delimiter (default: '%>')
   * @returns {Promise<{sessionTemplateData: string, sessionData: any}>}
   */
  static async processPrompts(templateData: string, userData: any, startTag: string = '<%', endTag: string = '%>'): Promise<any> {
    // Prepare the template data by replacing legacy syntax
    let sessionTemplateData = templateData
    sessionTemplateData = sessionTemplateData.replace(/<%@/gi, '<%- prompt')
    sessionTemplateData = sessionTemplateData.replace(/system.promptDateInterval/gi, 'promptDateInterval')
    sessionTemplateData = sessionTemplateData.replace(/system.promptDate/gi, 'promptDate')
    sessionTemplateData = sessionTemplateData.replace(/system.promptKey/gi, 'promptKey')
    sessionTemplateData = sessionTemplateData.replace(/<%=/gi, '<%-')

    // Delegate to the prompt registry system
    return processPrompts(sessionTemplateData, userData, startTag, endTag, this.getTags.bind(this))
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
      let note: TNote | null | undefined = undefined
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
      selectedFolder = await chooseFolder(promptMessage, false, true)
      // const selection = await CommandBar.showOptions(folders, promptMessage)
      // selectedFolder = folders[selection.index]
    } else if (folder == '<current>') {
      const currentFilename = Editor.note?.filename

      if (typeof currentFilename === 'undefined') {
        selectedFolder = await chooseFolder(promptMessage, false, true)
        // const selection = await CommandBar.showOptions(folders, promptMessage)
        // selectedFolder = folders[selection.index]
      } else {
        const parts = currentFilename.split('/')
        if (parts.length > 1) {
          parts.pop()
          selectedFolder = parts.join('/')
        }
      }
    } else {
      if (selectedFolder.length === 0) {
        selectedFolder = await chooseFolder(promptMessage, false, true)
        // const selection = await CommandBar.showOptions(folders, promptMessage)
        // selectedFolder = folders[selection.index]
      }
    }

    return selectedFolder
  }

  static isVariableTag(tag: string = ''): boolean {
    // @TODO: @codedungeon the following line had a search for "." in it. This was causing prompts with a period like "e.g." to fail
    // But looking at this code, wouldn't a prompt with a {question: "foo"} also fail because of the loose search for "{"?
    return tag.indexOf('<% const') > 0 || tag.indexOf('<% let') > 0 || tag.indexOf('<% var') > 0 || tag.indexOf('{') > 0 || tag.indexOf('}') > 0
  }

  static isMethod(tag: string = '', userData: any = null): boolean {
    const methods = userData?.hasOwnProperty('methods') ? Object.keys(userData?.methods) : []

    return tag.indexOf('(') > 0 || tag.indexOf('@') > 0 || tag.indexOf('prompt(') > 0
  }

  /**
   * Determines if a template tag contains executable JavaScript code that should receive an 'await' prefix
   * This includes function calls, variable declarations, and certain template-specific syntax
   * @param {string} tag - The template tag to analyze
   * @returns {boolean} - Whether the tag should be treated as code
   */
  static isCode(tag: string): boolean {
    let result = false

    // Empty or whitespace-only tags are not code
    if (!tag || tag.trim().length <= 3) {
      return false
    }

    // Check for empty tags like '<% %>' or '<%- %>' or tags with only whitespace
    if (
      tag
        .replace(/<%(-|=|~)?/, '')
        .replace(/%>/, '')
        .trim().length === 0
    ) {
      return false
    }

    // Only consider it a function call if there's a word character followed by parentheses
    // This regex handles whitespace between function name and parentheses
    if (/\w\s*\(/.test(tag) && tag.includes(')')) {
      result = true
    }

    // The original check for spacing (relevant for other basic JS, e.g. <% )
    // Only apply if the tag has more content than just whitespace
    if (
      tag.length >= 3 &&
      tag
        .replace(/<%(-|=|~)?/, '')
        .replace(/%>/, '')
        .trim().length > 0
    ) {
      if (tag[2] === ' ') {
        result = true
      }
    }

    // Exclude all prompt-related calls
    // Build regex pattern from registered prompt names
    const promptNames = getRegisteredPromptNames()
    // Escape special regex characters in prompt names
    const escapedNames = promptNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    // Join names with | for alternation in regex
    const promptPattern = escapedNames.join('|')
    const promptRegex = new RegExp(`(?:${promptPattern})\\s*\\(`, 'i')

    if (promptRegex.test(tag)) {
      result = false
    }

    // Variable declarations are code
    if (tag.includes('let ') || tag.includes('const ') || tag.includes('var ')) {
      result = true
    }

    // Template-specific syntax
    if (tag.includes('<%~')) {
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

  static async importTemplates(templateData: string = ''): Promise<string> {
    let newTemplateData = templateData
    const tags = (await this.getTags(templateData)) || []
    for (let tag of tags) {
      if (!isCommentTag(tag) && tag.includes('import(')) {
        logDebug(pluginJson, `NPTemplating.importTemplates :: ${tag}`)
        const importInfo = tag.replace('<%-', '').replace('<%', '').replace('-%>', '').replace('%>', '').replace('import', '').replace('(', '').replace(')', '')
        const parts = importInfo.split(',')
        if (parts.length > 0) {
          const noteNamePath = parts[0].replace(/['"`]/gi, '').trim()
          logDebug(pluginJson, `NPTemplating.importTemplates :: Importing: noteNamePath :: "${noteNamePath}"`)
          const content = await this.getTemplate(noteNamePath)
          const body = new FrontmatterModule().body(content)
          logDebug(pluginJson, `NPTemplating.importTemplates :: Content length: ${content.length} | Body length: ${body.length}`)
          if (body.length > 0) {
            newTemplateData = newTemplateData.replace('`' + tag + '`', body) // adjust fenced formats
            newTemplateData = newTemplateData.replace(tag, body)
          } else {
            newTemplateData = newTemplateData.replace(tag, `**An error occurred importing "${noteNamePath}"**`)
          }
        }
      }
    }

    return newTemplateData
  }

  static async execute(templateData: string = '', sessionData: any): Promise<any> {
    let processedTemplateData = templateData
    let processedSessionData = sessionData

    getCodeBlocks(templateData).forEach(async (codeBlock) => {
      if (!codeBlockHasComment(codeBlock) && blockIsJavaScript(codeBlock)) {
        const executeCodeBlock = codeBlock.replace('```templatejs\n', '').replace('```\n', '')
        try {
          // $FlowIgnore
          let result = ''

          if (executeCodeBlock.includes('<%')) {
            logDebug(pluginJson, `executeCodeBlock using EJS renderer: ${executeCodeBlock}`)
            result = await new TemplatingEngine(this.constructor.templateConfig).render(executeCodeBlock, processedSessionData)
            processedTemplateData = processedTemplateData.replace(codeBlock, result)
          } else {
            logDebug(pluginJson, `executeCodeBlock using Function.apply (does not include <%): ${executeCodeBlock}`)
            const fn = Function.apply(null, ['params', executeCodeBlock])
            result = fn(processedSessionData)

            if (typeof result === 'object') {
              processedTemplateData = processedTemplateData.replace(codeBlock, 'OBJECT').replace('OBJECT\n', '')
              processedSessionData = { ...processedSessionData, ...result }
            } else {
              processedTemplateData = processedTemplateData.replace(codeBlock, typeof result === 'string' ? result : '')
            }
          }
        } catch (error) {
          logError(pluginJson, `TemplatingEngine.execute error:${error}`)
        }
      }
    })

    debug(processedTemplateData, 'execute final')
    return { processedTemplateData, processedSessionData }
  }

  static async promptDate(message: string, defaultValue: string): Promise<any> {
    // This method is kept for backward compatibility
    // Import the PromptDateHandler to use its implementation
    return require('./support/modules/prompts/PromptDateHandler').default.promptDate(message, defaultValue)
  }

  static async promptDateInterval(message: string, defaultValue: string): Promise<any> {
    // This method is kept for backward compatibility
    // Import the PromptDateIntervalHandler to use its implementation
    return require('./support/modules/prompts/PromptDateIntervalHandler').default.promptDateInterval(message, defaultValue)
  }

  static parsePromptKeyParameters(tag: string = ''): {
    varName: string,
    tagKey: string,
    promptMessage: string,
    noteType: 'Notes' | 'Calendar' | 'All',
    caseSensitive: boolean,
    folderString: string,
    fullPathMatch: boolean,
  } {
    // This method is kept for backward compatibility
    // Import the PromptKeyHandler to use its implementation
    return require('./support/modules/prompts/PromptKeyHandler').default.parsePromptKeyParameters(tag)
  }

  static async prompt(message: string, options: any = null): Promise<any> {
    // This method is kept for backward compatibility
    // Import the StandardPromptHandler to use its implementation
    return require('./support/modules/prompts/StandardPromptHandler').default.prompt(message, options)
  }

  static async getPromptParameters(promptTag: string = ''): mixed {
    // This method is kept for backward compatibility
    // Import the BasePromptHandler to use its implementation
    return require('./support/modules/prompts/BasePromptHandler').default.getPromptParameters(promptTag)
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
