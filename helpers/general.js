// @flow
//-------------------------------------------------------------------------------
// General helper functions for NotePlan plugins
//-------------------------------------------------------------------------------

import json5 from 'json5'
// import toml from 'toml'
// import { load } from 'js-yaml'
import { hyphenatedDateString } from './dateTime'
import { log, logWarn, logError } from './dev'
import { showMessage } from './userInput'

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
    logError('general/parseJSON5()', e)
    await showMessage('Invalid JSON5 in your configuration. Please fix it to use configuration')
    return {}
  }
}

//-------------------------------------------------------------------------------
// Other functions
// @jgclark except where shown

// Return string with percentage value appended
// @eduardme
export function percent(value: number, total: number): string {
  return total > 0 ? `${value.toLocaleString()} (${Math.round((value / total) * 100)}%)` : `${value.toLocaleString()}`
}

// Deprecated: more trouble than they're worth ...
// export const defaultFileExt: () => any = () =>
//   DataStore.defaultFileExtension != null
//     ? DataStore.defaultFileExtension.toString()
//     : 'md'

// export const defaultTodoCharacter: () => any = () =>
//   DataStore.preference('defaultTodoCharacter') != null
//     ? DataStore.preference('defaultTodoCharacter').toString()
//     : '*'

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
 * @param {?TNote} n - note to get title for
 * @return {string}
 */
export function displayTitle(n: ?TNote): string {
  return !n ? 'error' : n.type === 'Calendar' && n.date != null ? hyphenatedDateString(n.date) : n.title ?? ''
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
 * Create internal link from title string (and optional heading string)
 * @dwertheimer
 * @param {string} noteTitle - title of the note
 * @param {string | null} heading - heading inside of note (optional)
 * @returns {string} the [[link#heading]]
 */
export function createLink(noteTitle: string, heading: string | null = ''): string {
  return `[[${noteTitle}${heading && heading !== '' ? `#${heading}` : ''}]]`
}

/**
 * Create xcallback link text from title string (and optional heading string)
 * @dwertheimer
 * @param {string} titleOrFilename - title of the note or the filename
 * @param {boolean} isFilename - true if title is a filename instead of note title
 * @param {string | null} heading - heading inside of note (optional)
 * @returns {string} the x-callback-url string
 */
export function createOpenNoteCallbackUrl(
  titleOrFilename: string,
  isFilename: boolean = false,
  heading: string | null = null,
): string {
  const xcb = `noteplan://x-callback-url/openNote?${isFilename ? `filename` : `noteTitle`}=`
  // FIXME: this is working around an API bug that does not allow heading references in filename xcallbacks
  // When @eduard fixes it, this line can be removed
  const head = isFilename ? '' : heading
  const encoded = encodeURIComponent(titleOrFilename).replace(/\(/g, '%28').replace(/\)/g, '%29')
  return `${xcb}${encoded}${head && head !== '' ? `#${head}` : ''}`
}

/**
 * Create xcallback link text for running a plugin
 * @dwertheimer
 * @param {string} pluginID - ID of the plugin from plugin.json
 * @param {boolean} command - the "name" of the command in plugin.json
 * @param {Array<string>} args - a flat array of arguments to be sent
 * @returns {string} the x-callback-url URL string (not the pretty part)
 */
export function createRunPluginCallbackUrl(pluginID: string, command: string, args: Array<string> = []): string {
  let xcb = `noteplan://x-callback-url/runPlugin?pluginID=${pluginID}&command=${encodeURIComponent(command)}`
  if (args?.length) {
    args.forEach((arg, i) => {
      xcb += `&arg${i}=${encodeURIComponent(arg)}`
    })
  }
  return xcb
}

/**
 * Create a pretty/short link hiding an xcallback link text from title string (and optional heading string)
 * e.g. [linkText](x-callback-url)
 * @dwertheimer
 * @param {string} linkText - the text to display for the link
 * @param {string} pluginID - ID of the plugin from plugin.json
 * @param {boolean} command - the "name" of the command in plugin.json
 * @param {Array<string>} args - a flat array of arguments to be sent
 * @returns {string} the pretty x-callback-url string: [linkText](x-callback-url)
 */
export function createPrettyLink(
  linkText: string,
  titleOrFilename: string,
  isFilename: boolean = false,
  heading: string | null = null,
): string {
  return `[${linkText}](${createOpenNoteCallbackUrl(titleOrFilename, isFilename, heading)})`
}

/**
 * Create a pretty/short link to open a note, hiding an xcallback link text from title string (and optional heading string)
 * e.g. [linkText](x-callback-url)
 * @dwertheimer
 * @param {string} linkText - the text to display for the link
 * @param {string} pluginID - ID of the plugin from plugin.json
 * @param {boolean} command - the "name" of the command in plugin.json
 * @param {Array<string>} args - a flat array of arguments to be sent
 * @returns {string} the pretty x-callback-url string: [linkText](x-callback-url)
 */
export function createPrettyOpenNoteLink(
  linkText: string,
  titleOrFilename: string,
  isFilename: boolean = false,
  heading: string | null = null,
): string {
  return `[${linkText}](${createOpenNoteCallbackUrl(titleOrFilename, isFilename, heading)})`
}

/**
 * Create a pretty/short link hiding an xcallback link text for running a plugin
 * e.g. [linkText](x-callback-url)
 * @dwertheimer
 * @param {string} linkText - the text to display for the link
 * @param {string} titleOrFilename - title of the note or the filename
 * @param {boolean} isFilename - true if title is a filename instead of note title
 * @param {string | null} heading - heading inside of note (optional)
 * @returns {string} the x-callback-url string
 */
export function createPrettyRunPluginLink(
  linkText: string,
  pluginID: string,
  command: string,
  args: Array<string> = [],
): string {
  return `[${linkText}](${createRunPluginCallbackUrl(pluginID, command, args)})`
}

/**
 * From an array of strings, return the first string that matches the wanted string.
 * @author @jgclark
 *
 * @param {Array<string>} list - list of strings to search
 * @param {string} search - string to match
 */
export function getStringFromList(list: $ReadOnlyArray<string>, search: string): string {
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
 * Note: Not reliable, so dropped from use in EventHelpers.
 * @author @m1well
 * @param {string} inputString
 * @param {array} replacementArray // array of objects with {key: stringToLookFor, value: replacementValue}
 * @returns {string} inputString with all replacements made
 */
export function stringReplace(inputString: string = '', replacementArray: Array<Replacement>): string {
  let outputString = inputString
  replacementArray.forEach((r) => {
    // if (outputString.includes(r.key)) {
    outputString = outputString.replace(r.key, r.value)
    // }
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
  // log('general/getTagParamsFromString', `for '${wantedParam}' in '${paramString}'`)
  if (paramString !== '' && wantedParam !== '') {
    try {
      // $FlowFixMe(incompatible-type)
      const paramObj: {} = await json5.parse(paramString)
      const output = paramObj.hasOwnProperty(wantedParam) ? paramObj[wantedParam] : defaultValue
      // log('general/getTagParamsFromString', `--> ${output}`)
      return output
    } catch (e) {
      logError('general/getTagParamsFromString', `Can't parse ${paramString} ${e}`)
    }
  }
  // log('general/getTagParamsFromString', `--> ${defaultValue} (default)`)
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

/**
 * Remove any markdown URLs from a string
 * @dwertheimer (with regex wizardry help from @jgclark)
 * @param {string} s - input string
 * @returns {string} with all the [[wikilinks] and [links](url) removed
 */
export function stripLinkFromString(s: string): string {
  // strip markdown URL
  return s.replace(/\s\[([^\[\]]*)\]\((.*?)\)/g, '').replace(/\s\[\[.*?\]\]/g, '')
}

/**
 * Convert semver string to number
 * @author @codedungeon
 * @param {string} semver - semver version
 * @return return long version number
 */
export function semverVersionToNumber(version: string): number {
  const parts = version.split('.')
  if (parts.length < 3) {
    parts.push('0')
    if (parts.length < 3) {
      parts.push('0')
    }
  }

  // $FlowIgnore
  parts.forEach((part: number) => {
    if (part >= 1024) {
      throw new Error(`Version string invalid, ${part} is too large`)
    }
  })

  let numericVersion = 0
  // Shift all parts either 0, 10 or 20 bits to the left.
  for (let i = 0; i < 3; i++) {
    numericVersion |= parseInt(parts[i]) << (i * 10)
  }
  return numericVersion
}
