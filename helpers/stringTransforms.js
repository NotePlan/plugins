// @flow
//-----------------------------------------------------------------------------
// String Manipulation functions
// by @jgclark, @dwertheimer
//-----------------------------------------------------------------------------

import { getNPWeekStr, RE_ISO_DATE, RE_NP_WEEK_SPEC, RE_NP_MONTH_SPEC, RE_NP_QUARTER_SPEC, todaysDateISOString, RE_NP_YEAR_SPEC } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo } from '@helpers/dev'
import { RE_MARKDOWN_LINKS_CAPTURE_G, RE_SIMPLE_BARE_URI_MATCH_G, RE_SYNC_MARKER } from '@helpers/regex'

/**
 * TODO(@dwertheimer): move 'removeDateTagsAndToday' from dateTime.js to here
 */

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
 * Convert bare URLs to display as HTML links
 * @author @jgclark
 * @tests in jest file
 * @param {string} original string
 * @param {boolean?} addWebIcon before the link? (default: true)
 * @param {boolean?} truncateIfNecessary the display of the link? (default: true)
 */
export function changeBareLinksToHTMLLink(original: string, addWebIcon: boolean = true, truncateIfNecessary: boolean = true): string {
  let output = original
  const captures = Array.from(original.matchAll(RE_SIMPLE_BARE_URI_MATCH_G) ?? [])
  if (captures.length > 0) {
    // clo(captures, `${String(captures.length)} results from bare URL matches:`)
    for (const capture of captures) {
      const linkURL = capture[3]
      const URLForDisplay = (truncateIfNecessary && linkURL.length > 20)
        ? linkURL.slice(0, 50) + '...'
        : linkURL
      // logDebug('changeBareLinksToHTMLLink', `${linkURL} / ${URLForDisplay}`)
      if (addWebIcon) {
        // not displaying icon
        output = output.replace(linkURL, `<a class="externalLink" href="${linkURL}"><i class="fa-regular fa-globe pad-right"></i>${URLForDisplay}</a>`)
      } else {
        output = output.replace(linkURL, `<a class="externalLink" href="${linkURL}">${URLForDisplay}</a>`)
      }
    }
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
 * Strip ALL date references from a string <|>ANY_TYPE
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
 * TODO: write tests
 * @author @jgclark
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
 * TODO: tests
 * @author @jgclark
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
 * TODO: deal with @mention(...) cases as well
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
    // clo(captures, 'results from blockID match:')
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
    .replace(/'/g, "%27")
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
  const decodedSpecials = input
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']')
    .replace(/%21/g, '!')
    .replace(/%27/g, "'")
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%2A/g, '*')
  return decodeURIComponent(decodedSpecials)
}
