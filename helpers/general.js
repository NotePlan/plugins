// @flow
//-------------------------------------------------------------------------------
// General helper functions for NotePlan plugins
//-------------------------------------------------------------------------------

// TODO: Need to remove dead code, or move to unused files
// TODO: Need to remove spurious console.log calls (or even better, move to `log`)
// TODO:  so that console.log can be disabled globally to reduce noise

import json5 from 'json5'
// import toml from 'toml'
// import { load } from 'js-yaml'
import { showMessage, showMessageYesNo } from './userInput'
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

// Pretty print range information (@EduardMe)
export function rangeToString(r: Range): string {
  if (r == null) {
    return 'Range is undefined!'
  }
  return `range: ${r.start}-${r.end}`
}

// return title of note useful for display, even for calendar notes (the YYYYMMDD)
// NB:: local copy of this in helpers/paragraph.js to avoid circular dependency
export function displayTitle(n: TNote): string {
  if (n.type === 'Calendar' && n.date != null) {
    return hyphenatedDateString(n.date)
  } else {
    return n.title ?? ''
  }
}

// Return (project) note title as a [[link]]
export function titleAsLink(note: TNote): string {
  return note.title !== undefined ? `[[${note.title ?? ''}]]` : '(error)'
}

// Get the folder name from the full NP (project) note filename
export function getFolderFromFilename(fullFilename: string): string {
  const filenameParts = fullFilename.split('/')
  // console.log(filenameParts)
  return filenameParts.slice(0, filenameParts.length - 1).join('/')
}
// Tests for gFFF function above
// console.log(`gFFF('one/two/three/four.txt') -> ${getFolderFromFilename('one/two/three/four.txt')}`)
// console.log(`gFFF('one/two/three/four and a bit.md') -> ${getFolderFromFilename('one/two/three/four and a bit.md')}`)
// console.log(`gFFF('one/two or three/fifteen.txt') -> ${getFolderFromFilename('one/two or three/fifteen.txt')}`)
// console.log(`gFFF('/sixes and sevenses/calm one.md') -> ${getFolderFromFilename('sixes and sevenses/calm one.md')}`)

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
 * @param {string} paramString - the contents of the template tag, e.g. {{weather(template:FOO)}}
 * @param {string} wantedParam - the name of the parameter to get (e.g. 'template')
 * @param {mixed | any} defaultValue - default value to use if parameter not found
 * @returns {string} the value of the desired parameter if found (e.g. 'FOO'), or defaultValue if it isn't
 */
export async function getTagParamsFromString(
  paramString: string,
  wantedParam: string,
  defaultValue: mixed | any,
): mixed {
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
 * @param {string} paramString - the string to capitalize
 * @returns {string} the string capitalized
 * @description Capitalizes the first letter of a string
 */
export function capitalize(s: string): string {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * @param {mixed} paramString - debug label
 * @param {mixed} paramString - debug label
 * @description Created formatted debug console message
 */
export function debug(label: mixed = '', msg: mixed = null): void {
  let message: string = ''

  if (msg) {
    // $FlowFixMe
    message = typeof msg === 'object' ? JSON.stringify(msg).replaceAll(':', ': ').replaceAll(',', ', ') : msg
  } else {
    // $FlowFixMe
    message = typeof label === 'object' ? JSON.stringify(label).replaceAll(':', ': ').replaceAll(',', ', ') : label
  }

  // $FlowFixMe
  let padLength = message.length / 2
  padLength = padLength < 10 ? 20 : padLength + 10

  console.log('')
  console.log('*'.repeat(padLength) + ' DEBUG ' + '*'.repeat(padLength))
  console.log('')

  // only show if msg supplied
  if (msg) {
    // $FlowFixMe
    console.log(`     ${label}:`)
  }

  // $FlowFixMe.
  console.log(`     ${message}:`)
  console.log('')
  console.log('*'.repeat(padLength) + ' DEBUG ' + '*'.repeat(padLength))
  console.log('')
}
