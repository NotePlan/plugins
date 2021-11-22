// @flow

import { parseJSON5 } from '../../helpers/general'
import {
  getInput,
  // askForFutureISODate,
  datePicker,
  askDateInterval,
} from '../../helpers/userInput'
import { listDaysEvents, listMatchingDaysEvents } from '../../jgclark.EventHelpers/src/eventsToNotes'
import { sweepTemplate } from '../../nmn.sweep/src/sweepAll'
import {
  get8601String,
  formattedDateTimeTemplate,
  getWeekDates,
} from '../../dwertheimer.DateAutomations/src/dateFunctions'
import { sortTasksViaTemplate } from '../../dwertheimer.TaskAutomations/src/sortTasks'
import { getWeatherSummary } from './weather'
import { getDailyQuote } from './quote'
import { getAffirmation, getAdvice } from './affirmations'

const tagList: Array<TagListType> = []

/*
 * Tags are added below in the form:
 * addTag(tagName, tagFunction, includeConfig)
 * the second function takes in a parameter string, and an optional configuration object,
 * and returns a string for insertion
 */
addTag('date8601', get8601String)
addTag('date', processDate, true)
addTag('pickDate', datePicker, true)
addTag('pickDateInterval', askDateInterval, true)
addTag('weather', getWeatherSummary)
addTag('events', listDaysEvents)
addTag('listTodaysEvents', listDaysEvents)
addTag('matchingEvents', listMatchingDaysEvents)
addTag('listMatchingEvents', listMatchingDaysEvents)
addTag('quote', getDailyQuote, true)
addTag('sweepTasks', sweepTemplate)
addTag('formattedDateTime', formattedDateTimeTemplate)
addTag('weekDates', getWeekDates)
addTag('affirmation', getAffirmation)
addTag('advice', getAdvice)

// addTag('sortTasks', sortTasksViaTemplate)
// **Add other template/macro function calls here SEE COMMENTED CODE BELOW **

// Example function for processing template with or without an object value, e.g. formattedDate({format:'%Y-%m-%d %I:%M:%S %P'})
// copy and paste this code in the code where you want it processed
// add an import to your function at the top of templateController.js
// add the tag name and processor function below above using addTag(tagName,'functionToCallFromTemplates')
// tag will be `{{tagName()}}`
// export async function functionToCallFromTemplates(paramStr: string = ''): Promise<string> {
//   let retVal = ''
//   if (paramStr === '') {
//     // retVal = doSomethingHere // default
//   } else {
//     const param = await getTagParamsFromString(paramStr, 'propertyNameHere', {})
//     // doSomething with param instead
//   }
//   return retVal
// }

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
function addTag(tagName: string, tagFunction: Function, includeConfig: boolean = false) {
  tagList.push({ tagName, tagFunction, includeConfig })
}

async function execTagListFunction(tagString, enclosedString, config): Promise<string> {
  let found = false
  for (const t of tagList) {
    // console.log(`Checking for tag ${t.tagName}`)
    if (tagString.startsWith(`${t.tagName}(`) && tagString.endsWith(`)`)) {
      console.log(`execTagListFunction() Tag matched "${t.tagName}"`)
      const params = [enclosedString]
      if (t.includeConfig) {
        params.push(config)
      }
      found = true
      const result = await t.tagFunction(...params)
      console.log(`---- execTagListFunction(${t.tagName}) RESULT="${result}"\n`)
      return result || ''
    }
  }
  if (!found) {
    // no matching funcs, so now attempt to match defined tag values instead
    return (await processTagValues(tagString, config)) || `` //[no text entered for ${tagString}]
  }
  return ''
}

export async function processTemplate(content: string, config: { [string]: ?mixed }): Promise<string> {
  const tagStart = content.indexOf('{{')
  const tagEnd = content.indexOf('}}')
  const hasTag = tagStart !== -1 && tagEnd !== -1 && tagStart < tagEnd
  if (!hasTag) {
    return content
  }

  const beforeTag = content.slice(0, tagStart)
  const afterTag = content.slice(tagEnd + 2)
  const tag = content.slice(tagStart + 2, tagEnd).trim()
  console.log(`processTemplate() found tag ${tag}`)

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
// Or get user input if not found
export async function processTag(tag: string, config: { [string]: ?mixed }): Promise<string> {
  const enclosedString = getEnclosedParameter(tag)
  console.log(`processTag(${tag}) param:${enclosedString}`)
  return execTagListFunction(tag, enclosedString, config)
}

// Apply any matching tag values, asking user for value if not found in configuration
async function processTagValues(tag: string, config: { [string]: ?mixed }): Promise<string> {
  const valueInConfig = tag
    // eslint-disable-next-line no-useless-escape
    .split(/[\.\[\]]/)
    .filter(Boolean)
    .reduce((path, key: string) => (path != null && typeof path === 'object' ? path[key] : null), config.tagValue)
  if (valueInConfig != null) {
    return String(valueInConfig)
  }
  const res = await getInput(`Value for ${tag}`)
  CommandBar.hide() // TODO: understand why this is needed: without it the CommandBar hangs around after it should
  return res
}

// ----------------------------------------------------------------
// Define new tag functions here ...

export async function processDate(dateParams: string, config: { [string]: ?mixed }): Promise<string> {
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
