// @flow

import { getWeatherSummary } from '../../jgclark.DailyJournal/src/weather'
import { processTagValues } from './interpolation.js'
import { parseJSON5 } from './configuration'

// Apply any matching tag functions
export async function processTags(
  tag: string,
  config: { [string]: ?mixed },
): Promise<string> {
  if (tag.startsWith('date(') && tag.endsWith(')')) {
    return await processDate(tag.slice(5, tag.length - 1), config)
  }
  else if (tag.startsWith('weather(') && tag.endsWith(')')) {
    return await getWeatherSummary(tag.slice(8, tag.length - 1), config)
  }

  // **Add other extension function calls here**
  // Can call functions defined in other plugins, by appropriate use
  // of imports at top of file (e.g. getWeatherSummary)
  // Or declare below (e.g. processDate)
  
  else { // no matching funcs, so now attempt to match defined tag values instead
    return processTagValues(tag, config)
  }
}

async function processDate(
  dateParams: string,
  config: { [string]: ?mixed },
): Promise<string> {
  const defaultConfig = config.date ?? {}
  const paramConfig = dateParams.trim() ? await parseJSON5(dateParams) : {}
  // console.log(`param config: ${dateParams} as ${JSON.stringify(paramConfig)}`);
  const finalArguments: { [string]: mixed } = {
    ...defaultConfig,
    ...paramConfig,
  }

  const { locale, ...otherParams } = (finalArguments: any)

  const localeParam = locale != null ? String(locale) : []
  const secondParam = {
    dateStyle: 'short',
    ...otherParams,
  }
  // console.log(`${JSON.stringify(localeParam)}, ${JSON.stringify(secondParam)}`);

  return new Intl.DateTimeFormat(localeParam, secondParam).format(new Date())
}
