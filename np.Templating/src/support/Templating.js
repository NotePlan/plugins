// @flow

import { getUserLocale } from 'get-user-locale'
import { debug } from '../../../helpers/general'
import { getOrMakeTemplateFolder } from '../../../nmn.Templates/src/template-folder'
import { parseFirstCodeblock } from './configuration'
import eta from './eta.lib'

import UtilsHelpers from './UtilsHelpers'
import DateModule from './modules/DateModule'
import TimeModule from './modules/TimeModule'

const DEFAULT_TEMPLATE_CONFIG = {
  locale: 'en-US',
  defaultFormats: {
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss A',
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
  static async renderConfig(): Promise<mixed> {
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
    if (lines.length >= 1) {
      if (lines.length >= 2 && lines[1] === '---') {
        templateContent = lines.splice(2).join('\n')
      } else {
        templateContent = lines.splice(1).join('\n')
      }
    }

    return templateContent
  }

  static async render(templateData: string = '', userData: mixed = {}, userOptions: mixed = {}): Promise<string> {
    const s = (data: mixed = {}) => {
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

    const weather = templateData.includes('web.weather') ? await UtilsHelpers.weather() : ''
    const quote = templateData.includes('web.quote') ? await UtilsHelpers.quote() : ''

    // let osLocale = getUserLocale()
    // if (templateConfig?.templates?.locale.length > 0) {
    //   osLocale = templateConfig?.templates?.locale
    // }

    const dateInstance = new DateModule(templateConfig)
    const timeInstance = new TimeModule(templateConfig)

    const helpers = {
      date: dateInstance,
      time: timeInstance,
      utils: UtilsHelpers,
      note: {},
      user: {
        first: templateConfig?.user?.first || '',
        last: templateConfig?.user?.last || '',
        email: templateConfig?.user?.email || '',
        phone: templateConfig?.user?.phone || '',
      },
      web: {
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

  static async getTemplateConfig(): Promise<mixed> {
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
    const templateConfig = await this.getTemplateConfig()
    let format = formatType === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss A'
    if (templateConfig?.templates?.defaultFormats?.[formatType]) {
      format = templateConfig?.templates?.defaultFormats?.[formatType]
    }

    format = formatType === 'date' ? 'YYYY-MM-DD' : 'HH:mm:ss A'
    return format
  }
}
