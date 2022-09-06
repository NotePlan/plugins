// @flow
//-------------------------------------------------------------------------------
// General helper functions for NotePlan plugins
//-------------------------------------------------------------------------------

import json5 from 'json5'
import { logError } from './dev'
import { showMessage } from './userInput'

export type headingLevelType = 1 | 2 | 3 | 4 | 5

//-------------------------------------------------------------------------------
/**
 * Case Insensitive version of Map
 * Keeps the first seen capitalasiation of a given key in a private #keysMap
 * It will be given in preference to the lowercase version of the key in
 *     for (const [key, value] of termCounts.entries()) {...}  // Note: the .entries() is required
 * Adapted from https://stackoverflow.com/a/68882687/3238281
 * @author @nmn, @jgclark
 */
export class CaseInsensitiveMap<TVal> extends Map<string, TVal> {
  // This is how private keys work in actual Javascript now.
  #keysMap = new Map<string, string>()

  constructor(iterable?: Iterable<[string, TVal]>) {
    super()
    if (iterable) {
      for (const [key, value] of iterable) {
        this.set(key, value)
      }
    }
  }

  set(key: string, value: TVal): this {
    const keyLowerCase = typeof key === 'string' ? key.toLowerCase() : key
    if (!this.#keysMap.has(keyLowerCase)) {
      this.#keysMap.set(keyLowerCase, key) // e.g. 'test': 'TEst'
      // console.log(`new map entry: public '${keyLowerCase}' and private '${key}'`)
    }
    super.set(keyLowerCase, value) // set main Map to use 'test': value
    return this
  }

  get(key: string): TVal | void {
    return typeof key === 'string' ? super.get(key.toLowerCase()) : super.get(key)
  }

  has(key: string): boolean {
    return typeof key === 'string' ? super.has(key.toLowerCase()) : super.has(key)
  }

  delete(key: string): boolean {
    const keyLowerCase = typeof key === 'string' ? (key.toLowerCase(): string) : key
    this.#keysMap.delete(keyLowerCase)

    return super.delete(keyLowerCase)
  }

  clear(): void {
    this.#keysMap.clear()
    super.clear()
  }

  keys(): Iterator<string> {
    return this.#keysMap.values()
  }

  *entries(): Iterator<[string, TVal]> {
    for (const [keyLowerCase, value] of super.entries()) {
      const key = this.#keysMap.get(keyLowerCase) ?? keyLowerCase
      yield [key, value]
    }
  }

  forEach(callbackfn: (value: TVal, key: string, map: Map<string, TVal>) => mixed): void {
    for (const [keyLowerCase, value] of super.entries()) {
      const key = this.#keysMap.get(keyLowerCase) ?? keyLowerCase
      callbackfn(value, key, this)
    }
  }
}

//-------------------------------------------------------------------------------
// Parsing structured data functions
// by @nmn

/**
 * Parse JSON5 string and return object representation.
 * Note: There is a local copy of this fn in helpers/paragraph.js to avoid a circular dependency
 * @author @nmn
 * @param {string} contents
 * @returns { {Array<string>: ?mixed} }
 */
export async function parseJSON5(contents: string): Promise<?{ [string]: ?mixed }> {
  try {
    const value = json5.parse(contents)
    return (value: any)
  } catch (e) {
    logError('general/parseJSON5()', e)
    await showMessage('Invalid data found when parsing JSON5 data.')
    return {}
  }
}

//-------------------------------------------------------------------------------
// Other functions
// @jgclark except where shown

/**
 * Return string with percentage (rounded to ones place) value appended
 * @author @eduardme
 * @param {number} value
 * @param {number} total
 * @return {string}
 */
export function percent(value: number, total: number): string {
  return total > 0 ? `${value.toLocaleString()} (${Math.round((value / total) * 100)}%)` : `${value.toLocaleString()} (0%)`
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
 * Return range information as a string
 * Note: There is a copy of this is note.js to avoid a circular dependency.
 * @author @EduardMe
 * @param {TRange} r range to convert
 * @return {string}
 */
export function rangeToString(r: TRange): string {
  if (r == null) {
    return 'Range is undefined!'
  }
  return `range: ${r.start}-${r.end}`
}

/**
 * Return title of note useful for display, including for
 * - daily calendar notes (the YYYYMMDD)
 * - weekly notes (the YYYY-Wnn)
 * Note: local copy of this in helpers/paragraph.js to avoid circular dependency.
 * @author @jgclark
 *
 * @param {?TNote} n - note to get title for
 * @return {string}
 */
export function displayTitle(n: ?TNote): string {
  return !n
    ? 'error'
    : n.type === 'Calendar' && n.date != null
    ? n.filename.split('.')[0] // without file extension
    : n.title ?? ''
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
 * @author @dwertheimer
 * @param {string} noteTitle - title of the note
 * @param {string | null} heading - heading inside of note (optional)
 * @returns {string} the [[link#heading]]
 * @tests available
 */
export function returnNoteLink(noteTitle: string, heading: string | null = ''): string {
  return `[[${noteTitle}${heading && heading !== '' ? `#${heading}` : ''}]]`
}

/**
 * Create xcallback link text from title string (and optional heading string)
 * @author @dwertheimer
 * @param {string} titleOrFilename - title of the note or the filename
 * @param {string} paramType - 'title' | 'filename' | 'date' (default is 'title')
 * @param {string | null} heading - heading inside of note (optional)
 * @param {string} openType - 'subWindow' | 'splitView' | 'useExistingSubWindow' (default: null)
 * @param {boolean} isDeleteNote - whether this is actually a deleteNote
 * @returns {string} the x-callback-url string
 * @tests available
 */
export function createOpenOrDeleteNoteCallbackUrl(
  titleOrFilename: string,
  paramType: 'title' | 'filename' | 'date' = 'title',
  heading: string | null = null,
  openType: 'subWindow' | 'splitView' | 'useExistingSubWindow' | null = null,
  isDeleteNote: boolean = false,
): string {
  const isFilename = paramType === 'filename'
  const paramStr = isFilename ? `filename` : paramType === 'date' ? `noteDate` : `noteTitle`
  const xcb = `noteplan://x-callback-url/${isDeleteNote ? 'deleteNote' : 'openNote'}?${paramStr}=`
  // FIXME: this is working around an API bug that does not allow heading references in filename xcallbacks
  // When @eduard fixes it, this line can be removed
  const head = paramType === 'title' && heading?.length ? encodeURIComponent(heading) : ''
  console.log(`createOpenOrDeleteNoteCallbackUrl: ${xcb}${titleOrFilename}${head ? `&heading=${head}` : ''}`)
  const encoded = encodeURIComponent(titleOrFilename).replace(/\(/g, '%28').replace(/\)/g, '%29')
  const openAs = openType && ['subWindow', 'splitView', 'useExistingSubWindow'].includes(openType) ? `&${openType}=yes` : ''
  return `${xcb}${encoded}${head && head !== '' ? `#${head}` : ''}${openAs}`
}

/**
 * Create an addText callback url
 * @param {TNote | string} note (either a note object or a date-related string, e.g. today, yesterday, tomorrow)
 * @param {{ text: string, mode: string, openNote: string }} options - text to add, mode ('append', 'prepend'), and whether to open the note
 * @returns {string}
 * @tests available
 */
export function createAddTextCallbackUrl(note: TNote | string, options: { text: string, mode: string, openNote: string }): string {
  const { text, mode, openNote } = options
  if (typeof note !== 'string') {
    // this is a note
    const encoded = encodeURIComponent(note.filename).replace(/\(/g, '%28').replace(/\)/g, '%29')
    if (note && note.filename) {
      return `noteplan://x-callback-url/addText?filename=${encoded}&mode=${mode}&openNote=${openNote}&text=${encodeURIComponent(text)}`
    }
  } else {
    // this is a date type argument
    return `noteplan://x-callback-url/addText?noteDate=${note}&mode=${mode}&openNote=${openNote}&text=${encodeURIComponent(text)}`
  }
  return ''
}

/**
 * Create xcallback link text for running a plugin
 * @author @dwertheimer
 * @param {string} pluginID - ID of the plugin from plugin.json
 * @param {boolean} commandName - the "name" of the command in plugin.json
 * @param {Array<string>} args - a flat array of arguments to be sent
 * @returns {string} the x-callback-url URL string (not the pretty part)
 * @tests available
 */
export function createRunPluginCallbackUrl(pluginID: string, commandName: string, args: Array<string> = []): string {
  let xcb = `noteplan://x-callback-url/runPlugin?pluginID=${pluginID}&command=${encodeURIComponent(commandName)}`
  if (args?.length) {
    args.forEach((arg, i) => {
      xcb += `&arg${i}=${encodeURIComponent(arg)}`
    })
  }
  return xcb
}

/**
 * A generic function for creating xcallback text for running a plugin
 * @author @dwertheimer
 * @param {string} commandName - the command (e.g. "search", "addNote", etc.)
 * @param {object} paramObj - key/value pairs of parameters to be sent (all strings)
 * @returns {string} the x-callback-url URL string (not the pretty part)
 * @tests available
 */
export function createCallbackUrl(commandName: string, paramObj: { [string]: string } = {}): string {
  const params = []
  Object.keys(paramObj).forEach((key) => {
    paramObj[key] = encodeURIComponent(paramObj[key])
    params.push(`${key}=${paramObj[key]}`)
  })
  const paramStr = params.length ? `?${params.join('&')}` : ''
  const xcb = `noteplan://x-callback-url/${commandName}${paramStr}`
  return xcb
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
 * @tests available
 */
export function createPrettyOpenNoteLink(linkText: string, titleOrFilename: string, isFilename: boolean = false, heading: string | null = null): string {
  return `[${linkText}](${createOpenOrDeleteNoteCallbackUrl(titleOrFilename, isFilename ? 'filename' : 'title', heading)})`
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
 * @tests available
 */
export function createPrettyRunPluginLink(linkText: string, pluginID: string, command: string, args: Array<string> = []): string {
  return `[${linkText}](${createRunPluginCallbackUrl(pluginID, command, args)})`
}

/**
 * From an array of strings, return the first string that matches the wanted string.
 * @author @jgclark
 * @param {Array<string>} list - list of strings to search
 * @param {string} search - string to match
 * @tests available
 */
export function getStringFromList(list: $ReadOnlyArray<string>, search: string): string {
  // console.log(`getsearchFromList for: ${search}`)
  const res = list.filter((m) => m === search)
  return res.length > 0 ? res[0] : ''
}

/**
 * Extract contents of bracketed part of a string (e.g. '@mention(something)').
 * @author @jgclark
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
 * Note: Not reliable on some edge cases (of repeated copies of specified terms), so dropped from use in EventHelpers.
 * @author @m1well
 * @param {string} inputString
 * @param {array} replacementArray // array of objects with {key: stringToLookFor, value: replacementValue}
 * @returns {string} inputString with all replacements made
 */
export function stringReplace(inputString: string = '', replacementArray: Array<Replacement>): string {
  let outputString = inputString
  replacementArray.forEach((r) => {
    outputString = outputString.replace(r.key, r.value)
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
 * Capitalizes the first letter of a string
 * @param {string} s - the string to capitalize
 * @returns {string} the string capitalized
 */
export function capitalize(s: string): string {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Remove any markdown URLs from a string
 * @dwertheimer (with regex wizardry help from @jgclark)
 * @param {string} s - input string
 * @returns {string} with all the [[wikilinks]] and [links](url) removed
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

  for (let part of parts) {
    part = parseInt(part, 10)
    if (Number.isNaN(part) || part >= 1024) {
      throw new Error(`Version string invalid, ${part} is too large`)
    }
  }

  let numericVersion = 0
  // Shift all parts either 0, 10 or 20 bits to the left.
  for (let i = 0; i < 3; i++) {
    numericVersion |= parseInt(parts[i]) << (i * 10)
  }
  return numericVersion
}

export const forceLeadingSlash = (str: string): string => (str[0] === '/' ? str : `/${str}`)

/**
 * Check if a filename is in a list of folders (negate the result to get *not in folder*)
 * Folders should not have slashes at the end
 * @param {string} filename
 * @param {Array<string>} folderList
 * @param {boolean} caseSensitive - whether to do a case sensitive check (defaults to false)
 * @example filteredTasks = allTasks.filter((f) => inFolderList(f.filename, inFolders)) // filename in one of these folders
 * @example filteredTasks = allTasks.filter((f) => !inFolderList(f.filename, notInFolders)) // filename not in any of these folders
 * @author @dwertheimer
 * @returns
 */
export function inFolderList(filenameStr: string, folderListArr: Array<string>, caseSensitive: boolean = false): boolean {
  const filename = caseSensitive ? forceLeadingSlash(filenameStr) : forceLeadingSlash(filenameStr.toLowerCase())
  const folderList = caseSensitive ? folderListArr.map((f) => forceLeadingSlash(f)) : folderListArr.map((f) => forceLeadingSlash(f.toLowerCase()))
  return folderList.some((f) => filename.includes(`${f}/`) || (f === '/' && !filename.slice(1).includes('/')))
}

/**
 * Super simple template string replace function (merge field replacement)
 * Generally for user formatting of output in their preferences
 * @param {string} templateString - the template string with mustache fields for replacement (e.g. {{field1}})
 * @param {{[string]:string}} fieldValues - a map of field names to values to replace in the template string
 * Note: if you do not want a string to show, set the field to null in the fieldValues map
 * @returns {string} the resulting string
 */
export function formatWithFields(templateString: string, fieldValues: { [string]: string }): string {
  return Object.keys(fieldValues)
    .reduce((textbody, key) => textbody.replace(new RegExp(`{{${key}}}`, 'gm'), fieldValues[key] !== null ? fieldValues[key] : ''), templateString)
    .replace(/ +/g, ' ')
  // const field = textbody.replace(/{([^{}]+)}/g, function(textMatched, key) {
  //     return user[key] || "";
  // }
}
