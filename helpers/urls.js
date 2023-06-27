/* @flow */

import { logError } from '@helpers/dev'
import { findEndOfActivePartOfNote } from "@helpers/paragraph"
import { isClosed } from '@helpers/utils'

export type LinkObject = {
  url: string,
  type: 'markdown' | 'bareURL',
  lineIndex: number,
  name: ?string /* will only be set if the URL is a markdown link */,
  domain: string /* will be empty if no domain is found (e.g. MD vdeeplink/callback-url or MD link without http/https) */,
  page: string /* will be empty if no page is found */,
}

/**
 * Processes a given URL and returns a LinkObject.
 * @author @dwertheimer
 *
 * @param {string} urlStr - The URL to process.
 * @param {?string} name - The name of the markdown link. If the URL is not a markdown link, this should be null.
 * @param {number} lineIndex - The index of the line the URL was found on.
 * @param {boolean} removeSubdomain - Whether to remove the subdomain (like www) from the URL or not.
 * @returns {LinkObject} The processed LinkObject.
 */
export function processURL(urlStr: string, name: ?string, lineIndex: number, removeSubdomain: boolean): LinkObject {
  const parts = urlStr.split(/\/+/g)
  const domain = parts.length > 1 ? parts[1] : urlStr
  const page = parts.slice(2).join('/').split('?')[0]

  const finalDomain = removeSubdomain ? domain.split('.').slice(1, -1).join('.') : domain.split('.').slice(0, -1).join('.')

  return {
    url: urlStr,
    name: name,
    type: name ? 'markdown' : 'bareURL',
    lineIndex: lineIndex,
    domain: finalDomain,
    page: page,
  }
}

/**
 * Scans multiple lines of text for URLs and returns an array of LinkObjects.
 * @author @jgclark updated by @dwertheimer
 * @tests in jest file
 * @param {string} text - The text to scan for URLs.
 * @param {boolean} [removeSubdomain=false] - Whether to remove the subdomain (like www) from the URLs or not.
 * @returns {LinkObject[]} An array of LinkObjects.
 */
export function findURLsInText(
  text: string,
  removeSubdomain: boolean = false,
): Array<LinkObject> {
  try {
    const markdownURLPattern = /\[([^\]]+)\]\(([^)]+)\)/g // Match markdown URLs with or without 'http(s)://'
    const bareURLPattern = /(\w+:\/\/[^\s]+)/g

    const lines = text.split('\n')
    const links: Array<LinkObject> = []

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      let match

      // Process markdown URLs first and replace them with placeholders in the line.
      while ((match = markdownURLPattern.exec(line)) !== null) {
        // $FlowIgnore[incompatible-use]
        links.push(processURL(match[2], match[1], i, removeSubdomain))
        // $FlowIgnore[incompatible-use]
        line = line.replace(match[0], 'MARKDOWN_LINK_PLACEHOLDER')
      }

      // Process bare URLs.
      while ((match = bareURLPattern.exec(line)) !== null) {
        // $FlowIgnore[incompatible-use]
        links.push(processURL(match[1], null, i, removeSubdomain))
      }
    }

    return links
  } catch (err) {
    logError('findURLsInText', err.message)
    return []
  }
}

/**
 * Scans a note for URLs and returns an array of LinkObjects.
 * @author @jgclark
 *
 * @param {TNote} note - The note to scan for URLs.
 * @param {boolean} [removeSubdomain=false] - Whether to remove the subdomain (like www) from the URLs or not.
 * @param {boolean} [searchOnlyActivePart=true] - Whether to search the note's archive (Done and Cancelled sections) as well?
 * @param {boolean} [ignoreCompletedItems=false] - Whether to ignore URLs in done/cancelled tasks/checklist items.
 * @returns {LinkObject[]} array of LinkObjects
 */
export function findURLsInNote(
  note: TNote,
  removeSubdomain: boolean = false,
  searchOnlyActivePart: boolean = true,
  ignoreCompletedItems: boolean = false,
): Array<LinkObject> {
  try {
    const lastLineToSearch = searchOnlyActivePart ? findEndOfActivePartOfNote(note) : note.paragraphs.length - 1
    let parasToSearch = note.paragraphs.filter(p => p.lineIndex <= lastLineToSearch)
    if (ignoreCompletedItems) {
      parasToSearch = parasToSearch.filter(p => !isClosed(p))
    }
    const textToSearch = parasToSearch.map(p => p.content).join('\n') ?? []
    return findURLsInText(textToSearch, removeSubdomain)
  } catch (err) {
    logError('findURLsInNote', err.message)
    return []
  }
}
