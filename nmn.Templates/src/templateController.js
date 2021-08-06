// @flow

import { getInput } from '../../nmn.sweep/src/userInput'
import {
  insertDaysEvents,
  insertMatchingDaysEvents,
} from '../../jgclark.EventHelpers/src/eventsToNotes'
import { sweepTemplate } from '../../nmn.sweep/src/sweepAll'
import { getWeatherSummary } from './weather'
import { getDailyQuote } from './quote'
import { parseJSON5 } from './configuration'

const tagList: Array<TagListType> = []

/*
 * Tags are added below in the form:
 * addTag(tagName, tagFunction, includeConfig)
 * the second function takes in a parameter string, and an optional configuration object,
 * and returns a string for insertion
 */
addTag('date', processDate, true)
addTag('weather', getWeatherSummary)
addTag('events', insertDaysEvents)
addTag('listTodaysEvents', insertDaysEvents)
addTag('matchingEvents', insertMatchingDaysEvents)
addTag('listMatchingEvents', insertMatchingDaysEvents)
addTag('quote', getDailyQuote, true)
addTag('sweepTasks', sweepTemplate)
// **Add other extension function calls here**

type TagListType = {
  tagName: string,
  tagFunction: Function,
  includeConfig?: boolean,
}

/**
 * @description - Add a tag and function to call from templates
 * @param {string} tagName - the string name of the tag
 * @param {Function} tagFunction - the function to call (usually an import above)
 * @param {boolean} includeConfig - whether to include the config in that function call
 */
function addTag(
  tagName: string,
  tagFunction: Function,
  includeConfig?: boolean = false,
) {
  tagList.push({ tagName, tagFunction, includeConfig })
}

async function checkForTags(
  tagString,
  enclosedString,
  config,
): Promise<string> {
  let found = false
  for (const t of tagList) {
    if (tagString.startsWith(`${t.tagName}(`) && tagString.endsWith(`)`)) {
      console.log(`** Tag matched "${t.tagName}"`)
      const params = [enclosedString]
      if (t.includeConfig) {
        params.push(config)
      }
      found = true
      const result = await t.tagFunction(...params)
      // console.log(`${t.tagName} RESULT = ${result}`)
      return result
    }
  }
  if (!found) {
    // no matching funcs, so now attempt to match defined tag values instead
    return await processTagValues(tagString, config)
  }
  return ''
}

export async function processTemplate(
  content: string,
  config: { [string]: ?mixed },
): Promise<string> {
  console.log(`processTemplate`)
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
    const tagProcessed = await processTag(tag, config)
    const restProcessed = await processTemplate(afterTag, config)
    return beforeTag + tagProcessed + restProcessed
  } catch (e) {
    console.log(e)
    return content
  }
}

function getEnclosedParameter(tagString: string): string {
  const res = tagString.match(/\((.*)\)/) ?? []
  return res[1] // may be an empty string
}

// Apply any matching functions for this tag
export async function processTag(
  tag: string,
  config: { [string]: ?mixed },
): Promise<string> {
  const enclosedString = getEnclosedParameter(tag)
  console.log(`processTag: ${tag} param:${enclosedString}`)
  return checkForTags(tag, enclosedString, config)
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

export async function processDate(
  dateParams: string,
  config: { [string]: ?mixed },
): Promise<string> {
  // console.log(`processDate: ${dateConfig}`)
  const defaultConfig = config.date ?? {}
  const dateParamsTrimmed = dateParams.trim()
  const paramConfig =
    dateParamsTrimmed.startsWith('{') && dateParamsTrimmed.endsWith('}')
      ? await parseJSON5(dateParams)
      : dateParamsTrimmed !== ''
      ? await parseJSON5(`{${dateParams}}`)
      : {}
  // console.log(`param config: ${dateParams} as ${JSON.stringify(paramConfig)}`);
  // ... = "gather the remaining parameters into an array"
  const finalArguments: { [string]: mixed } = {
    ...defaultConfig,
    ...paramConfig,
  }

  // Grab just locale parameter
  const { locale, ...otherParams } = (finalArguments: any)

  const localeParam = locale != null ? String(locale) : []
  const secondParam = {
    dateStyle: 'short',
    ...otherParams,
  }
  // console.log(`${JSON.stringify(localeParam)}, ${JSON.stringify(secondParam)}`);

  return new Intl.DateTimeFormat(localeParam, secondParam).format(new Date())
}
