// @flow

import { getInput } from '../../nmn.sweep/src/userInput'
import { getWeatherSummary } from './weather'
import { parseJSON5 } from './configuration'

export async function processTemplate(
  content: string,
  config: { [string]: ?mixed },
): Promise<string> {
  console.log(`processTemplate: ${content}`)
  const tagStart = content.indexOf('{{')
  const tagEnd = content.indexOf('}}')
  const hasTag = tagStart !== -1 && tagEnd !== -1 && tagStart < tagEnd
  if (!hasTag) {
    return content
  }

  const beforeTag = content.slice(0, tagStart)
  const afterTag = content.slice(tagEnd + 2)
  const tag = content.slice(tagStart + 2, tagEnd)

  try {
    const tagProcessed = await processTags(tag, config)
    const restProcessed = await processTemplate(afterTag, config)
    return beforeTag + tagProcessed + restProcessed
  } catch (e) {
    console.log(e)
    return content
  }
}

// Apply any matching tag functions
export async function processTags(
  tag: string,
  config: { [string]: ?mixed },
): Promise<string> {
  console.log(`processTag: ${tag}`)
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

// Apply any matching tag values, asking user for value if not found in configuration
async function processTagValues(
  tag: string,
  config: { [string]: ?mixed },
): Promise<string> {
  const valueInConfig = tag
    // eslint-disable-next-line no-useless-escape
    .split(/[\.\[\]]/)
    .filter(Boolean)
    .reduce(
      (path, key: string) =>
        path != null && typeof path === 'object' ? path[key] : null,
      config.tagValue,
    )
  if (valueInConfig != null) {
    return String(valueInConfig)
  }
  return await getInput(`Value for ${tag}`)
}

// ----------------------------------------------------------------
// Define new tag functions here ...

async function processDate(
  dateParams: string,
  config: { [string]: ?mixed },
): Promise<string> {
  console.log(`processDate: ${dateConfig}`)
  const defaultConfig = config.date ?? {}
  const paramConfig = dateParams.trim() ? await parseJSON5(dateParams) : {}
  // console.log(`param config: ${dateParams} as ${JSON.stringify(paramConfig)}`);
  const finalArguments: { [string]: mixed } = {
    ...defaultConfig,
    ...paramConfig,
  }

  // ... = "gather the remaining parameters into an array"
  const { locale, ...otherParams } = (finalArguments: any)

  const localeParam = locale != null ? String(locale) : []
  const secondParam = {
    dateStyle: 'short',
    ...otherParams,
  }
  // console.log(`${JSON.stringify(localeParam)}, ${JSON.stringify(secondParam)}`);

  return new Intl.DateTimeFormat(localeParam, secondParam).format(new Date())
}
