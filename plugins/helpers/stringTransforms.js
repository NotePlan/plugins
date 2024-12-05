// @flow
//-----------------------------------------------------------------------------
// String Manipulation functions
// by @jgclark, @dwertheimer
//-----------------------------------------------------------------------------

import {
  getNPWeekStr,
  RE_ISO_DATE,
  RE_NP_WEEK_SPEC,
  RE_NP_MONTH_SPEC,
  RE_NP_QUARTER_SPEC,
  RE_NP_YEAR_SPEC,
  todaysDateISOString,
  WEEK_NOTE_LINK,
  MONTH_NOTE_LINK,
  QUARTER_NOTE_LINK,
  YEAR_NOTE_LINK,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { RE_MARKDOWN_LINKS_CAPTURE_G, RE_SIMPLE_BARE_URI_MATCH_G, RE_SYNC_MARKER } from '@helpers/regex'

/**
 * Truncate visible part of HTML string, without removing any HTML tags, or markdown links.
 * @author @jgclark
 * @tests in jest file
 * @param {string} htmlIn
 * @param {number} maxLength of output (no change if maxLength is 0)
 * @param {boolean} dots - add ellipsis to end?
 * @returns {string} truncated HTML
 */
export function truncateHTML(htmlIn: string, maxLength: number, dots: boolean = true): string {
  if (maxLength === 0) return htmlIn

  let inHTMLTag = false
  let inMDLink = false
  let truncatedHTML = ''
  let lengthLeft = maxLength
  // Walk through the htmlIn string a character at a time
  for (let index = 0; index < htmlIn.length; index++) {
    // if (!lengthLeft || lengthLeft <= 0) {
    //   // no lengthLeft: stop processing
    //   continue
    // }
    if (htmlIn[index] === '<' && htmlIn.slice(index).includes('>')) {
      // if we've started an HTML tag (i.e. has a > later) stop counting
      // logDebug('truncateHTML', `started HTML tag at ${String(index)}`)
      inHTMLTag = true
    }
    if (htmlIn[index] === '[' && htmlIn.slice(index).match(/\]\(.*\)/)) {
      // if we've started a MD link tag stop counting
      // logDebug('truncateHTML', `started MD link at ${String(index)}`)
      inMDLink = true
    }
    if (!inHTMLTag && !inMDLink) {
      lengthLeft--
    }
    // Includes this character if its a tag or we still have length left
    if (lengthLeft >= 0 || inHTMLTag || inMDLink) {
      truncatedHTML += htmlIn[index]
    }
    if (dots && lengthLeft === 0) {
      truncatedHTML += '…'
    }
    if (htmlIn[index] === '>' && inHTMLTag) {
      // Have we closed a tag?
      // logDebug('truncateHTML', `stopped HTML tag at ${String(index)}`)
      inHTMLTag = false
    }
    if (htmlIn[index] === ')' && inMDLink) {
      // Have we closed an MD link?
      // logDebug('truncateHTML', `stopped MD link at ${String(index)}`)
      inMDLink = false
    }
  }
  // logDebug('truncateHTML', `{${htmlIn}} -> {${truncatedHTML}}`)
  return truncatedHTML
}

/**
 * Convert any type of URL in the strimg -- [md](url) or https://bareurl to HTML links
 * @param {string} original
 * @returns {string} the string with any URLs converted to HTML links
 */
export function convertAllLinksToHTMLLinks(original: string): string {
  let output = original
  output = changeBareLinksToHTMLLink(output)
  output = changeMarkdownLinksToHTMLLink(output)
  return output
}

/**
 * Convert bare URLs to display as HTML links. Truncate beyond N characters if 'truncateLength' given.
 * @author @jgclark
 * @tests in jest file
 * @param {string} original string
 * @param {boolean?} addWebIcon before the link? (default: true)
 * @param {number?} truncateLength the display of the link? (default: 0 = off)
 */
export function changeBareLinksToHTMLLink(original: string, addWebIcon: boolean = true, truncateLength: number = 0): string {
  let output = original
  const captures = Array.from(original.matchAll(RE_SIMPLE_BARE_URI_MATCH_G) ?? [])
  if (captures.length > 0) {
    logDebug('changeBareLinksToHTMLLink', `Found link in '${original}' with truncateLength ${String(truncateLength)}${addWebIcon ? ' and addWebIcon' : ''}`)
    clo(captures, `${String(captures.length)} results from bare URL matches:`)
    for (const capture of captures) {
      const linkURL = capture[3]
      const URLForDisplay = truncateLength > 0 && linkURL.length > truncateLength ? truncateHTML(linkURL, truncateLength, true) : linkURL
      if (addWebIcon) {
        // not displaying icon
        output = output.replace(linkURL, `<a class="externalLink" href="${linkURL}"><i class="fa-regular fa-globe pad-right"></i>${URLForDisplay}</a>`)
      } else {
        output = output.replace(linkURL, `<a class="externalLink" href="${linkURL}">${URLForDisplay}</a>`)
      }
    }
    logDebug('changeBareLinksToHTMLLink', `=> ${output}`)
  }
  return output
}

/**
 * Change [title](URI) markdown links to <a href="URI">title</a> HTML style
 * @author @jgclark
 * @tests in jest file
 * @param {string} original string
 * @param {boolean?} addWebIcon before the link? (default: true)
 */
export function changeMarkdownLinksToHTMLLink(original: string, addWebIcon: boolean = true): string {
  let output = original
  const captures = Array.from(original.matchAll(RE_MARKDOWN_LINKS_CAPTURE_G) ?? [])
  if (captures.length > 0) {
    // clo(captures, `${String(captures.length)} results from markdown link matches:`)
    // Matches come in pairs, so process a pair at a time
    for (const capture of captures) {
      const linkTitle = capture[1]
      const linkURL = capture[2]
      if (addWebIcon) {
        // not displaying icon
        output = output.replace(`[${linkTitle}](${linkURL})`, `<a class="externalLink" href="${linkURL}"><i class="fa-regular fa-globe pad-right"></i>${linkTitle}</a>`)
      } else {
        output = output.replace(`[${linkTitle}](${linkURL})`, `<a class="externalLink" href="${linkURL}">${linkTitle}</a>`)
      }
    }
  }
  return output
}

/**
 * Strip URLs from a string (leaves the [text] of the link intact by default)
 * @author @dwertheimer
 * @tests in jest file
 * @param {string} original
 * @param {boolean} leaveLinkText - if true, leaves the [text] of a wiki link intact
 * @returns {string} the string without any URLs
 */
export function stripLinksFromString(original: string, leaveLinkText: boolean = true): string {
  let output = original
  const captures = Array.from(original.matchAll(/(\[([^\]]+)\]\(([^\)]+)\))|(\w+:\/\/[\w\.\/\?\#\&\d\-\=%*,]+)/g) ?? [])
  if (captures.length > 0) {
    // clo(captures, `${String(captures.length)} results from markdown link matches:`)
    // Matches come in pairs, so process a pair at a time
    for (const capture of captures) {
      if (capture[2]) output = output.replace(capture[1], leaveLinkText ? `[${capture[2]}]` : '') // [text](url)
      else output = output.replace(capture[0], '') // bare url
      output = output.replace(/\s{2,}/, ' ').trimRight()
    }
  }
  return output
}

/**
 * Strip ALL date references from a string
 * @author @jgclark & @dwertheimer
 * @tests in jest file
 * @param {string} original
 * @returns {string} altered string
 */
export function stripDateRefsFromString(original: string): string {
  let output = original
  const REGEX = new RegExp(`(>|<)(${RE_ISO_DATE}|today|${RE_NP_WEEK_SPEC}|${RE_NP_MONTH_SPEC}|${RE_NP_QUARTER_SPEC}|${RE_NP_YEAR_SPEC})`, 'g')
  const captures = output.match(REGEX) ?? []
  if (captures.length > 0) {
    // clo(captures, `results from >(${todaysDateISOString}|today) match:`)
    for (const capture of captures) {
      output = output
        .replace(capture, '')
        .replace(/\s{2,}/, ' ')
        .trimRight()
    }
  }
  return output
}

/**
 * Strip `>today` and scheduled dates of form `>YYYY-MM-DD` that point to today from the input string
 * @author @jgclark
 * @tests in jest file
 * @param {string} original
 * @returns {string} altered string
 */
export function stripTodaysDateRefsFromString(original: string): string {
  let output = original
  const REGEX = new RegExp(`>(${todaysDateISOString}|today)`, 'g')
  const captures = output.match(REGEX) ?? []
  if (captures.length > 0) {
    // clo(captures, `results from >(${todaysDateISOString}|today) match:`)
    for (const capture of captures) {
      output = output
        .replace(capture, '')
        .replace(/\s{2,}/, ' ')
        .trimRight()
    }
  }
  return output
}

/**
 * Strip refs to this week (of form `>YYYY-Www`) from the input string
 * @author @jgclark
 * @tests in jest file
 * @param {string} original
 * @returns {string} altered string
 */
export function stripThisWeeksDateRefsFromString(original: string): string {
  let output = original
  const thisWeekStr = getNPWeekStr(new Date())
  const REGEX = new RegExp(`>${thisWeekStr}`, 'g')
  const captures = output.match(REGEX) ?? []
  if (captures.length > 0) {
    // clo(captures, `results from >${thisWeekStr} match:`)
    for (const capture of captures) {
      output = output
        .replace(capture, '')
        .replace(/\s{2,}/, ' ')
        .trimRight()
    }
  }
  return output
}

/**
 * Strip all `<YYYY-MM-DD` dates from the input string
 * @author @jgclark
 * @tests in jest file
 * @param {string} original
 * @returns {string} altered string
 */
export function stripBackwardsDateRefsFromString(original: string): string {
  let output = original
  const REGEX = new RegExp(`<${RE_ISO_DATE}`, 'g')
  const captures = Array.from(output.matchAll(REGEX) ?? [])
  if (captures.length > 0) {
    // clo(captures, `results from <YYYY-MM-DD match:`)
    for (const capture of captures) {
      output = output
        .replace(capture[0], '')
        .replace(/\s{2,}/, ' ')
        .trimRight()
    }
  }
  return output
}

/**
 * Strip wiki link [[...]] markers from string, leaving the note title
 * @author @jgclark
 * @tests in jest file
 * @param {string} original
 * @returns {string} altered string
 */
export function stripWikiLinksFromString(original: string): string {
  let output = original
  const captures = Array.from(original.matchAll(/\[\[(.*?)\]\]/g) ?? [])
  if (captures.length > 0) {
    // clo(captures, 'results from [[notelinks]] match:')
    for (const capture of captures) {
      output = output.replace(capture[0], capture[1])
    }
  }
  return output
}

/**
 * Strip all #hashtags from string
 * TODO: write tests
 * @author @jgclark
 * @param {string} original
 * @returns {string} changed line
 */
export function stripHashtagsFromString(original: string): string {
  let output = original
  // Note: the regex from @EduardMe's file is /(\s|^|\"|\'|\(|\[|\{)(?!#[\d[:punct:]]+(\s|$))(#([^[:punct:]\s]|[\-_\/])+?\(.*?\)|#([^[:punct:]\s]|[\-_\/])+)/ but :punct: doesn't work in JS, so here's my simplified version
  // TODO: matchAll?
  const captures = output.match(/(?:\s|^|\"|\(|\)|\')(#[A-Za-z]\w*)/g)
  if (captures) {
    clo(captures, 'results from hashtag matches:')
    for (const capture of captures) {
      const match = capture.slice(1)
      // logDebug('hashtag match', match)
      output = output
        .replace(match, '')
        .replace(/\s{2,}/, ' ')
        .trimRight()
    }
  }
  return output
}

/**
 * Strip all @mentions from string,
 * TODO: write tests
 * @author @jgclark
 * @param {string} original
 * @returns {string} changed line
 */
export function stripMentionsFromString(original: string): string {
  let output = original
  // Note: the regex from @EduardMe's file is /(\s|^|\"|\'|\(|\[|\{)(?!@[\d[:punct:]]+(\s|$))(@([^[:punct:]\s]|[\-_\/])+?\(.*?\)|@([^[:punct:]\s]|[\-_\/])+)/ but :punct: doesn't work in JS, so here's my simplified version
  const captures = output.match(/(?:\s|^|\"|\(|\)\')(@[A-Za-z][\w\d\.\-\(\)]*)/g)
  if (captures) {
    clo(captures, 'results from mention matches:')
    for (const capture of captures) {
      const match = capture.slice(1)
      // logDebug('mention match', match)
      output = output
        .replace(match, '')
        .replace(/\s{2,}/, ' ')
        .trimRight()
    }
  }
  return output
}

/**
 * Strip `^abcdef` blockIDs from string
 * @author @jgclark
 * @tests in jest file
 * @param {string} original
 * @returns {string} changed line
 */
export function stripBlockIDsFromString(original: string): string {
  let output = original
  const REGEX = new RegExp(RE_SYNC_MARKER, 'g')
  const captures = Array.from(output.matchAll(REGEX) ?? [])
  if (captures.length > 0) {
    for (const capture of captures) {
      // logDebug('stripBlockIDsFromString', `- found '${capture[0]}'`)
      output = output
        .replace(capture[0], '')
        .replace(/\s{2,}/, ' ')
        .trimRight()
    }
  }
  return output
}

/**
 * Convenience function to strip all mentions and hashtags from a string
 * @param {string} original
 * @returns
 */
export function stripAllTagssFromString(original: string): string {
  /* cleanse clean the string */
  let output = original
  output = stripHashtagsFromString(output)
  output = stripMentionsFromString(output)
  return output
}

/**
 * Convenience function to strip all internal references (date, blockID, wikilink) from a string
 * @param {string} original
 * @param {boolean} stripTags - also strip hashtags and mentions
 * @param {boolean} stripLinks - also strip links
 * @returns {string}
 */
export function stripAllMarkersFromString(original: string, stripTags: false, stripLinks: false): string {
  /* cleanse clean the string */
  let output = original
  output = stripBlockIDsFromString(output)
  output = stripDateRefsFromString(output)
  if (stripTags) output = stripAllTagssFromString(output)
  if (stripLinks) output = stripLinksFromString(output)
  return output
}

/**
 * Strip mailto links from the start of email addresses
 * @param {string} email
 * @returns {string}
 */
export function stripMailtoLinks(email: string): string {
  return email.replace(/^mailto:/, '')
}

/**
 * Convert markdown links to HTML links in 'text' string
 * @param {string} text
 * @returns {string}
 */
export function convertMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$1">$2</a>')
}

/**
 * Version of URL encode that extends encodeURIComponent()
 * (which does everything except A-Z a-z 0-9 - _ . ! ~ * ' ( ))
 * plus ! ' ( ) [ ] * required by RFC3986, and needed when passing text to JS in some settings
 * Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI#encoding_for_rfc3986
 * @tests in jest file
 * @param {string} input
 * @returns {string} URL-encoded string
 */
export function encodeRFC3986URIComponent(input: string): string {
  // special case that appears in innerHTML
  const dealWithSpecialCase = input
    .replace(/&amp;/g, '&')
    .replace(/&amp%3B/g, '&')
    .replace(/%26amp;/g, '&')
    .replace(/%26amp%3B/g, '&')
  return encodeURIComponent(dealWithSpecialCase)
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
  // .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

/**
 * Reverse of encodeRFC3986URIComponent
 * @author @jgclark
 * @tests in jest file
 * @param {string} input
 * @returns {string}
 */
export function decodeRFC3986URIComponent(input: string): string {
  const decodedSpecials = input.replace(/%5B/g, '[').replace(/%5D/g, ']').replace(/%21/g, '!').replace(/%27/g, "'").replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2A/g, '*')
  return decodeURIComponent(decodedSpecials)
}

/**
 * Remove >date and <date from a string
 * Note: this was originally in dateTime.js
 * @author @nmn
 * @param {string} input
 * @returns {string} output
 */
export function removeDateTags(content: string): string {
  return content
    .replace(/<\d{4}-\d{2}-\d{2}/g, '')
    .replace(/>\d{4}-\d{2}-\d{2}/g, '')
    .trimEnd()
}

/**
 * Remove all >date -related things from a line (and optionally >week, >month, >quarter etc. ones also)
 * Note: this was originally in dateTime.js
 * @author @dwertheimer
 * @param {string} tag - the incoming text
 * @param {boolean} removeAllSpecialNoteLinks - if true remove >week, >month, >quarter, >year references too
 * @returns
 */
export function removeDateTagsAndToday(tag: string, removeAllSpecialNoteLinks: boolean = false): string {
  let newString = tag,
    lastPass = tag
  do {
    lastPass = newString
    newString = removeDateTags(tag)
      .replace(removeAllSpecialNoteLinks ? new RegExp(WEEK_NOTE_LINK, 'g') : '', '')
      .replace(removeAllSpecialNoteLinks ? new RegExp(MONTH_NOTE_LINK, 'g') : '', '')
      .replace(removeAllSpecialNoteLinks ? new RegExp(QUARTER_NOTE_LINK, 'g') : '', '')
      .replace(removeAllSpecialNoteLinks ? new RegExp(YEAR_NOTE_LINK, 'g') : '', '')
      .replace(/>today/, '')
      .replace(/\s{2,}/g, ' ')
      .trimEnd()
  } while (newString !== lastPass)
  return newString
}

/**
 * Remove repeats from a string (e.g. @repeat(1/3) or @repeat(2/3) or @repeat(3/3) or @repeat(1/1) or @repeat(2/2) etc.)
 * because NP complains when you try to rewrite them (delete them).
 * Note: this was originally in dateTime.js
 * @author @dwertheimer
 * @param {string} content
 * @returns {string} content with repeats removed
 */
export function removeRepeats(content: string): string {
  return content
    .replace(/\@repeat\(\d{1,}\/\d{1,}\)/g, '')
    .replace(/ {2,}/g, ' ')
    .trim()
}

/**
 * Safely evaluates a string representation of an array or object.
 * It assumes the input string is a JavaScript-like array or object structure.
 * We use this to read the form data from the template and turn it into an object.
 * @param {string} str - The string to evaluate.
 * @returns {Array<Object> | Object} - The evaluated array or object.
 * @throws {Error} - Throws an error if the string cannot be evaluated.
 */
export function parseObjectString(str: string): Array<Object> | Object {
  try {
    // Ensure the string is wrapped properly and evaluated in a safe context.
    const result = new Function(`return ${str}`)()

    // Verify that the result is an array or object
    if (!Array.isArray(result) && typeof result !== 'object') {
      throw new Error('The evaluated result is neither an array nor an object.')
    }

    return result
  } catch (error) {
    logError('Failed to evaluate the string:', error.message)
    throw error
  }
}

/**
 * Validates a string representation of an array or object.
 * It attempts to parse the string and identifies any errors.
 * @param {string} str - The string to validate.
 * @returns {Array<string>} - An array of error messages, if any.
 */
export function validateObjectString(str: string): Array<string> {
  const errors: Array<string> = []
  const lines = str.split('\n')

  // Check for basic syntax errors line by line
  lines.forEach((line, index) => {
    try {
      // Attempt to parse each line individually
      new Function(`return ${line.trim()}`)()
    } catch (error) {
      errors.push(`Error on line ${index + 1}: ${error.message}`)
    }
  })

  // Check for overall structure errors
  try {
    const parsedData = parseObjectString(str)

    // Ensure parsedData is an array or object
    if (Array.isArray(parsedData)) {
      // Additional validation for JSON data types
      parsedData.forEach((item: any, index: number) => {
        if (item.type === 'json') {
          ;['default', 'value'].forEach((field) => {
            if (typeof item[field] === 'string') {
              try {
                JSON.parse(item[field])
              } catch (jsonError) {
                errors.push(`Invalid JSON in '${field}' field at item index ${index}: ${jsonError.message}`)
              }
            }
          })
        }
      })
    } else if (typeof parsedData === 'object') {
      // Handle object case if needed
      // Add specific validation logic for objects if applicable
    } else {
      throw new Error('Parsed data is neither an array nor an object.')
    }
  } catch (error) {
    errors.push(`Overall structure error: ${error.message}`)
  }

  return errors
}
