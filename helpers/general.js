// @flow
//-------------------------------------------------------------------------------
// General helper functions for NotePlan plugins
//-------------------------------------------------------------------------------

import json5 from 'json5'
// import toml from 'toml'
// import { load } from 'js-yaml'
import { showMessage } from './userInput'
import { hyphenatedDateString } from './dateTime'

//-------------------------------------------------------------------------------
// Parsing structured data functions
// by @nmn

// export async function parseJSON(contents: string): Promise<?{ [string]: ?mixed }> {
//   try {
//     return JSON.parse(contents)
//   } catch (e) {
//     console.log(e)
//     await showMessage('Invalid JSON in your configuration. Please fix it to use configuration')
//     return {}
//   }
// }

// NB: There is a local copy of this fn in helpers/paragraph.js to avoid a circular dependency
export async function parseJSON5(contents: string): Promise<?{ [string]: ?mixed }> {
  try {
    const value = json5.parse(contents)
    return (value: any)
  } catch (e) {
    console.log(e)
    await showMessage('Invalid JSON5 in your configuration. Please fix it to use configuration')
    return {}
  }
}

// export async function parseYAML(contents: string): Promise<?{ [string]: ?mixed }> {
//   try {
//     const value = load(contents)
//     if (typeof value === 'object') {
//       return (value: any)
//     } else {
//       return {}
//     }
//   } catch (e) {
//     console.log(contents)
//     console.log(e)
//     await showMessage('Invalid YAML in your configuration. Please fix it to use configuration')
//     return {}
//   }
// }

// export async function parseTOML(contents: string): Promise<?{ [string]: ?mixed }> {
//   try {
//     const value = toml.parse(contents)
//     if (typeof value === 'object') {
//       return (value: any)
//     } else {
//       return {}
//     }
//   } catch (e) {
//     console.log(e)
//     await showMessage('Invalid TOML in your configuration. Please fix it to use configuration')
//     return {}
//   }
// }

//-------------------------------------------------------------------------------
// Other functions
// @jgclark except where shown

// Return string with percentage value appended
// export function percent(value, total) {
// @eduardme
export function percent(value: number, total: number): string {
  return total > 0 ? `${value.toLocaleString()} (${Math.round((value / total) * 100)}%)` : `${value.toLocaleString()}`
}

export const defaultFileExt: string = DataStore.defaultFileExtension != null ? DataStore.defaultFileExtension : 'md'

export const defaultTodoCharacter: '*' | '-' =
  DataStore.preference('defaultTodoCharacter') != null ? DataStore.preference('defaultTodoCharacter') : '*'

/**
 * Pretty print range information
 * @author @EduardMe
 */
export function rangeToString(r: Range): string {
  if (r == null) {
    return 'Range is undefined!'
  }
  return `range: ${r.start}-${r.end}`
}

/** 
 * return title of note useful for display, even for calendar notes (the YYYYMMDD)
 * NB:: local copy of this in helpers/paragraph.js to avoid circular dependency
 * @author @jgclark
 * 
 * @param {TNote} n - note to get title for
 * @return {string}
 */
export function displayTitle(n: TNote): string {
  if (n.type === 'Calendar' && n.date != null) {
    return hyphenatedDateString(n.date)
  } else {
    return n.title ?? ''
  }
}

/** 
 * Return (project) note title as a [[link]]
 * @jgclark
 * 
 * @param {TNote} note to get title for
 * @return {string} note-linked title (or an error warning)
 */
export function titleAsLink(note: TNote): string {
  return note.title !== undefined ? `[[${note.title ?? ''}]]` : '(error)'
}

/**
 * From an array of strings, return the first string that matches the wanted string.
 * @author @jgclark
 * 
 * @param {Array<string>} list - list of strings to search
 * @param {string} search - string to match
 */
export function getStringFromList(
  list: $ReadOnlyArray<string>,
  search: string,
): string {
  // console.log(`getsearchFromList for: ${search}`)
  const res = list.filter((m) => m === search)
  return res.length > 0 ? res[0] : ''
}

/**
 * Extract contents of bracketed part of a string (e.g. '@mention(something)').
 * @author @jgclark
 * 
 * @param {string} - string that contains a bracketed mention e.g. @review(2w)
 * @return {?string} - string from between the brackets, if found (e.g. '2w')
 */
export function getContentFromBrackets(mention: string): ?string {
  const RE_BRACKETS_STRING_CAPTURE = '\\((.*?)\\)' // capture string inside parantheses

  if (mention === '') {
    return // no text, so return nothing
  }
  const res = mention.match(RE_BRACKETS_STRING_CAPTURE) ?? []
  if (res[1].length > 0) {
    return res[1]
  } else {
    return
  }
}

type Replacement = { key: string, value: string }

/**
 * Replace all mentions of array key with value in inputString
 * @param {string} inputString
 * @param {array} replacementArray // array of objects with {key: stringToLookFor, value: replacementValue}
 * @returns {string} inputString with all replacements made
 */
export function stringReplace(inputString: string = '', replacementArray: Array<Replacement>): string {
  let outputString = inputString
  replacementArray.forEach((r) => {
    while (outputString.includes(r.key)) {
      outputString = outputString.replace(r.key, r.value)
    }
  })
  return outputString
}

/**
 * Get a particular parameter setting from parameter string
 * (Replaces an earlier version called getTagParams)
 * @author @dwertheimer
 * 
 * @param {string} paramString - the contents of the template tag, e.g. {{weather(template:FOO)}}
 * @param {string} wantedParam - the name of the parameter to get (e.g. 'template')
 * @param {any} defaultValue - default value to use if parameter not found
 * @returns {string} the value of the desired parameter if found (e.g. 'FOO'), or defaultValue if it isn't
 */
export async function getTagParamsFromString(paramString: string, wantedParam: string, defaultValue: any): any {
  console.log(`\tgetTagParamsFromString for '${wantedParam}' in '${paramString}'`)
  if (paramString !== '' && wantedParam !== '') {
    try {
      const paramObj: {} = await json5.parse(paramString)
      console.log(`\t--> ${String(JSON.stringify(paramObj[wantedParam]))}`)
      // eslint-disable-next-line no-prototype-builtins
      return paramObj.hasOwnProperty(wantedParam) ? paramObj[wantedParam] : defaultValue
    } catch (e) {
      console.log(`\tError parsing ${paramString} ${e}`)
    }
  }
  return defaultValue
}

/**
 * @param {string} s - the string to capitalize
 * @returns {string} the string capitalized
 * @description Capitalizes the first letter of a string
 */
export function capitalize(s: string): string {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}
