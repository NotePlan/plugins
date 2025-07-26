// @flow

import { parseJSON5 } from '@helpers/general'
import { logDebug } from '@helpers/dev'

/**
 * Transforms date parameters and configuration to format a date using Intl.DateTimeFormat
 * @param {string} dateParams - JSON string or object-like string containing date formatting parameters
 * @param {Object.<string, ?mixed>} config - Configuration object containing default date settings
 * @returns {Promise<string>} Formatted date string
 */
export async function transformInternationalDateFormat(dateParams: string, config: { [string]: ?mixed }): Promise<string> {
  logDebug(`dateHelpers::transformInternationalDateFormat: ${dateParams} as ${JSON.stringify(config)}`)

  // Handle default config more safely to avoid Flow exponential spread error
  const defaultConfig: { [string]: mixed } = config?.date && typeof config.date === 'object' ? (config.date: any) : {}
  const dateParamsTrimmed = dateParams?.trim() || ''

  // Fix Flow type error by ensuring paramConfig is always an object
  let paramConfig: { [string]: mixed } = {}
  if (dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}')) {
    const parsed = await parseJSON5(dateParams)
    paramConfig = parsed || {}
  } else if (dateParamsTrimmed !== '') {
    const parsed = await parseJSON5(`{${dateParams}}`)
    paramConfig = parsed || {}
  }

  const finalArguments: { [string]: mixed } = {
    ...defaultConfig,
    ...paramConfig,
  }

  // Grab just locale parameter
  const { locale, ...otherParams } = (finalArguments: any)

  // Fix Flow type error by ensuring localeParam is always string or undefined
  const localeParam = locale != null ? String(locale) : undefined
  const secondParam = {
    dateStyle: 'short',
    ...otherParams,
  }

  return new Intl.DateTimeFormat(localeParam, secondParam).format(new Date())
}
