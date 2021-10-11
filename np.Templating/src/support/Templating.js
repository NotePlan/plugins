// @flow

import { getUserLocale } from 'get-user-locale'
import { debug } from '../../../helpers/general'
import { getOrMakeTemplateFolder } from '../../../nmn.Templates/src/template-folder'
import { parseFirstCodeblock } from './configuration'
import eta from './eta.lib'

import WebModule from './modules/WebModule'
import DateModule from './modules/DateModule'
import TimeModule from './modules/TimeModule'
import NoteModule from './modules/NoteModule'
import UtilsModule from './modules/UtilsModule'

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
}

export default class Templating {
  // default templating config
  static async renderConfig(): Promise<any> {
    return {
      varName: 'np',
      parse: {
        exec: '*',
        interpolate: '',
        raw: '',
      },
      autoTrim: false,
      globalAwait: true,
      useWith: true,
    }
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
    const selectedTemplate = await DataStore.projectNoteByTitle(templateName, true, false)?.[0]
    let templateContent = selectedTemplate?.content
    if (templateContent == null || templateContent.length === 0) {
      const message = `Template "${templateName}" Not Found or Empty`
      return this.templateErrorMessage('Templating.getTemplate', message)
    }

    const lines = templateContent.split('\n')
    const dividerIndex = lines.indexOf('*****') || lines.indexOf('---')
    if (dividerIndex > 0) {
      templateContent = lines.splice(dividerIndex + 1).join('\n')
    }

    return templateContent
  }

  static async renderTemplate(templateName: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    console.log(templateName)
    const templateContent = await this.getTemplate(templateName)

    const result = await this.render(templateContent, userData)

    return result
  }

  static async render(templateData: string = '', userData: any = {}, userOptions: any = {}): Promise<string> {
    const s = (data: any = {}) => {
      return JSON.stringify(data, null, 4)
    }

    // $FlowFixMe
    const templateConfig = await this.getTemplateConfig()

    const options = { ...{ extended: false, tags: [] }, ...userOptions }

    // $FlowFixMe
    const renderOptions = await this.renderConfig()
    if (options.extended) {
      delete renderOptions.parse
    }

    if (options?.tags?.length > 0) {
      renderOptions.tags = options.tags
    }

    // WebModule methods are async, will be converted to synchronous methods below
    // need to handle async calls before render templates as templating method are synchronous
    const weather = templateData.includes('web.weather') ? await WebModule.weather() : ''
    const quote = templateData.includes('web.quote') ? await WebModule.quote() : ''
    const affirmation = templateData.includes('web.affirmation') ? await WebModule.affirmation() : ''
    const advice = templateData.includes('web.advice') ? await WebModule.advice() : ''

    const helpers = {
      date: new DateModule(templateConfig),
      time: new TimeModule(templateConfig),
      utils: new UtilsModule(templateConfig),
      note: new NoteModule(templateConfig),
      user: {
        first: templateConfig?.user?.first || '',
        last: templateConfig?.user?.last || '',
        email: templateConfig?.user?.email || '',
        phone: templateConfig?.user?.phone || '',
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
      },
    }

    const renderData = {
      ...helpers,
      ...userData,
    }

    try {
      let result = eta.render(templateData, renderData, renderOptions)
      result = result.replaceAll('undefined', '')

      return result
    } catch (err) {
      return this.templateErrorMessage('Templating.render', err.message)
    }
  }

  static async getTemplateConfig(): Promise<any> {
    const templateFolder = await getOrMakeTemplateFolder()
    const configFile = DataStore.projectNotes
      // $FlowIgnore[incompatible-call]
      .filter((n) => n.filename?.startsWith(templateFolder))
      .find((n) => !!n.title?.startsWith('_configuration'))

    const content: ?string = configFile?.content
    if (content == null) {
      return {}
    }

    const firstCodeblock = content.split('\n```')[1]

    const templateData = await parseFirstCodeblock(firstCodeblock)
    if (templateData && templateData.hasOwnProperty('templates')) {
      return templateData.templates
    }
    return DEFAULT_TEMPLATE_CONFIG
  }

  static async getDefaultFormat(formatType: string = 'date'): Promise<string> {
    // $FlowFixMe
    const templateConfig = await this.getTemplateConfig()
    let format = formatType === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss A'
    if (templateConfig?.templates?.defaultFormats?.[formatType]) {
      format = templateConfig?.templates?.defaultFormats?.[formatType]
    }

    format = formatType === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss A'
    return format
  }
}
