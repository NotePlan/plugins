// @flow
// ------------------------------------------------------------------------------------
// Timeblocking support constants and functions
// ------------------------------------------------------------------------------------

// Regular Expressions -- the easy ones!
export const RE_ISO_DATE = '\\d{4}-[01]\\d{1}-\\d{2}'
export const RE_HOURS = '[0-2]?\\d'
export const RE_HOURS_EXT = `(${RE_HOURS}|NOON|noon|MIDNIGHT|midnight)`
export const RE_MINUTES = '[0-5]\\d'
export const RE_TIME = `${RE_HOURS}:${RE_MINUTES}`
// export const RE_AMPM = `(A\\.M\\.|P\\.M\\.|AM?|PM?)`
export const RE_AMPM = `(AM|am|PM|pm)` // logic changed in v3.4
export const RE_AMPM_OPT = `${RE_AMPM}?`
export const RE_TIME_TO = `\\s*(\\-|\\–|\\~|\\〜|to)\\s*`
export const RE_DONE_DATETIME = `@done\\(${RE_ISO_DATE} ${RE_TIME}${RE_AMPM}?\\)`
export const RE_DONE_DATE_OPT_TIME = `@done\\(${RE_ISO_DATE}( ${RE_TIME}${RE_AMPM}?)?\\)`

// ------------------------------------------------------------------------------------
// Regular Expressions -- published by @EduardMe on 10.11.2021.
// The FIRST... one is for start time, and
// the SECOND ... is for optional end time.
// These are much more extensive that the brief online help guide to time blocks implies.

// private let FIRST_REG_PATTERN = "(^|\\s|T)" +
//     "(?:(?:at|from)\\s*)?" +
//     "(\\d{1,2}|noon|midnight)" +
//     "(?:" +
//         "(?:\\:|\\：)(\\d{1,2})" +
//         "(?:" +
//             "(?:\\:|\\：)(\\d{2})" +
//         ")?" +
//     ")?" +
//     "(?:\\s*(A\\.M\\.|P\\.M\\.|AM?|PM?))?" +
//     "(?=\\W|$)"
// private let SECOND_REG_PATTERN = "^\\s*" +
//     "(\\-|\\–|\\~|\\〜|to|\\?)\\s*" +
//     "(\\d{1,4})" +
//     "(?:" +
//         "(?:\\:|\\：)(\\d{1,2})" +
//         "(?:" +
//             "(?:\\:|\\：)(\\d{1,2})" +
//         ")?" +
//     ")?" +
//     "(?:\\s*(A\\.M\\.|P\\.M\\.|AM?|PM?))?" +
//   "(?=\\W|$)"


// ------------------------------------------------------------------------------------
// @jgclark's newer pair of regex to find time blocks, based on those regex.
// These are much more extensive that the brief documentation implies, or now
// the more extensive documentation at https://help.noteplan.co/article/121-time-blocking.
//
// NB: my version ignores seconds in time strings, and assumes there's no @done() date-time to confuse
// export const RE_TIMEBLOCK_START = `(^|\\s|T)(?:(?:at|from)\\s*)?(?:(?:${RE_MINUTES}|noon|midnight)(:${RE_MINUTES})?|(?:${RE_MINUTES}|noon|midnight))(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?(?=\\W|$)`
// export const RE_TIMEBLOCK_END = `(?<!\\d{4}(-[01]\\d)?)\\s*(?:\\-|\\–|\\~|\\〜|to|\\?)\\s*(?:${RE_MINUTES})(?::${RE_MINUTES})?(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?(?=\\W|$)`

// To make it possible to identify matching lines in a single operation, 
// I have now combined the two regex into one.
// NB: These use few non-capturing groups to be shorter and easier to understand.
// export const RE_TIMEBLOCK = `(^|\\s|T)((at|from)\\s*)?((${RE_MINUTES}|noon|midnight)(:${RE_MINUTES})?|(?:${RE_MINUTES}|noon|midnight))(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?(${RE_TIME_TO}(${RE_HOURS})(:${RE_MINUTES})?(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?|$)`
// This version removes false positive on terminal single digit
// export const RE_TIMEBLOCK =`${RE_ISO_DATE_NOT_IN_DONE}(^|\\s|T)((at|from)\\s*(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})?|(${RE_HOURS}|noon|midnight)(:${RE_MINUTES}))(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?(${RE_TIME_TO}(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})?(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?)?`
// This version adds support for '2-3PM' etc.
// And can be used to capture the whole time block as the first result of the regex match
// export const RE_TIMEBLOCK = `((?:${RE_ISO_DATE})?(?:(at|from)\\s*(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})?${RE_AMPM_OPT}|(${RE_HOURS})(:${RE_MINUTES})?(${RE_AMPM}|(?=\\s*(\\-|\\–|\\~|\\〜|to|\\?)))|(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})${RE_AMPM_OPT})(?:${RE_TIME_TO}(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})?${RE_AMPM_OPT})?)`
// This latest version adds support for '6.30 AM - 9:00 PM' style, and tidies up the 
// line endings
// And can be used to capture the whole time block as the first result of the regex match
// BUT still fails on 9 tests
// export const RE_TIMEBLOCK = `(?:(at|from)\\s*${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT})|\\h+(${RE_HOURS})(:${RE_MINUTES})?(\\s?${RE_AMPM}|(?=${RE_TIME_TO}))|\\h+${RE_HOURS_EXT}(:${RE_MINUTES})\\s?${RE_AMPM_OPT})(?:${RE_TIME_TO}${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT}))?(?=\\h|$)`

// Following version with \s instead of \h -- Works for all tests!
// export const RE_TIMEBLOCK = `(?:(at|from)\\s*${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT})|\\s+(${RE_HOURS})(:${RE_MINUTES})?(\\s?${RE_AMPM}|(?=${RE_TIME_TO}))|\\s+${RE_HOURS_EXT}(:${RE_MINUTES})\\s?${RE_AMPM_OPT})(?:${RE_TIME_TO}${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT}))?(?=\\s|$)`

// But then, grr, don't all work in the actual app.
// Eventually I realised this is probably because of the start of line context, which
// is often different in a regex tester. So tweaking the start of line logic -- but
// means greater divergence between this and how the theme regex needs to work.
// const RE_START_APP_LINE = `(?<=^|\\s)`
// export const RE_TIMEBLOCK = `((at|from)\\s*${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT})|(${RE_HOURS})(:${RE_MINUTES})?(\\s?${RE_AMPM}|(?=${RE_TIME_TO}))|\\s+${RE_HOURS_EXT}(:${RE_MINUTES})\\s?${RE_AMPM_OPT})(?:${RE_TIME_TO}${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT}))?(?=\\s|$)`
// export const RE_TIMEBLOCK_APP = `${RE_START_APP_LINE}${RE_TIMEBLOCK}`

// But the, grrr, it still doesn't work in the app, despite passing all the tests.
// Turns out the new look-behind test is erroring silently in the app with "Invalid regular expression: invalid group specifier name".
// Problem is addition of a look behind assertion.
// So trying yet another way ...
// ... and ensuring (from theme, below) that both UPPER and lower case versions are included.
const RE_START_APP_LINE = `(?:^|\\s)`
export const RE_TIMEBLOCK = `(((at|from)\\s+${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s*${RE_AMPM_OPT})(${RE_TIME_TO}(${RE_HOURS})(:${RE_MINUTES})?(\\s*${RE_AMPM_OPT}))?|${RE_HOURS_EXT}(:${RE_MINUTES})\\s*${RE_AMPM_OPT}(${RE_TIME_TO}${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s*${RE_AMPM_OPT})?)?))(?=\\s|$)`
export const RE_TIMEBLOCK_APP = `${RE_START_APP_LINE}${RE_TIMEBLOCK}`

// case-insensitive version of regex match by using flag "i"
const RE_TIMEBLOCK_APP_CI = new RegExp(RE_TIMEBLOCK_APP, "i")

//-----------------------------------------------------------------------------
// NB: According to @EduardMe in Discord 29.1.2022, the detection is tightened in v3.4
// to require 'am' or 'pm' not just 'a' or 'p'. Changed here 30.1.22.

//-----------------------------------------------------------------------------
// FIXME(@Eduard):
// The following cases **don't work fully or break** the API:
// printDateRange(Calendar.parseDateText("2021-06-02 2.15PM-3.45PM")[0]) -> 11AM on that day
// printDateRange(Calendar.parseDateText("2021-06-02 at 2PM")[0]) // -> 1PM on that day
// printDateRange(Calendar.parseDateText("something at 2to3 ok")[0]) // -> crashes NP!
// '- The temp is 17-18' gets detected when it shouldn't

//-----------------------------------------------------------------------------
// NB: According to @EduardMe in Discord 3.1.2022, the time blocks now work on 
// paragraph types [.title, .open, .done, .list].
// These can more easily be tested for by API calls than in the regex, so that's
// what this now does.
export const TIMEBLOCK_TASK_TYPES = ['title', 'open', 'done', 'list']

//-----------------------------------------------------------------------------
// THEMES
// NB: The logic required in NotePlan **themes** is slightly more complex, as it 
// must work out whether it's the correct line type, as it has no access to the API.
// It also appears to match case sensitively, which therefore requires the
// main regex to include both versions after all :-(
export const RE_ALLOWED_TIME_BLOCK_LINE_START = `(^\\s*(?:\\*(?!\\s+\\[[\\-\\>]\\])|\\-(?!\\h+\\[[\\-\\>]\\])|[\\d+]\\.|\\#{1,5}))(\\[\\s\\])?(?=\\s).*?\\s`
export const RE_TIMEBLOCK_FOR_THEMES = `${RE_ALLOWED_TIME_BLOCK_LINE_START}${RE_TIMEBLOCK}`

// ------------------------------------------------------------------------------------

/**
 * Decide whether this line contains an active time block.
 * @tests available for jest
 * @author @dwertheimer
 * 
 * @param {string} contentString
 * @returns {boolean}
 */
export function isTimeBlockLine(contentString: string): boolean {
  try {
    const mustContainString = DataStore.preference("timeblockTextMustContainString") ?? ''
    if (mustContainString !== '') {
      const res1 = contentString.match(mustContainString) ?? []
      if (res1.length === 0) {
        return false
      }
    }
    const res2 = contentString.match(RE_TIMEBLOCK_APP_CI) ?? []
    return res2.length > 0
  }
  catch (err) {
    console.log(err)
    return false
  }
}

/**
 * Decide whether this paragraph contains an open task
 * v2, following news about earlier change of definition (Discord, 3.1.2022)
 * @tests available for jest
 * @author @jgclark
 * 
 * @param {TParagraph} para
 * @returns {boolean}
 */
export function isTypeThatCanHaveATimeBlock(para: TParagraph): boolean {
  return TIMEBLOCK_TASK_TYPES.indexOf(para.type) > -1 // ugly but neater
}

/**
 * Decide whether this paragraph contains an active time block.
 * TODO: Ideally also explicitly defeat on timeblock in middle of a ![image](filename)
 * @tests see tests for the two functions this calls
 * @author @jgclark
 * 
 * @param {TParagraph} para
 * @returns {boolean}
 */
export function isTimeBlockPara(para: TParagraph): boolean {
  return isTimeBlockLine(para.content) && isTypeThatCanHaveATimeBlock(para)
}

/**
 * @author @dwertheimer
 * @tests available for jest

 * @param {Array<string>} arr 
 * @returns {string}
 */
export const findLongestStringInArray = (arr: Array<string>): string =>
  arr.length ? arr.reduce((a, b) => (a.length > b.length ? a : b)) : ''

/**
 * Get the time portion of a timeblock line (also is a way to check if it's a timeblock line)
 * Does not return the text after the timeblock (you can use isTimeBlockLine to check if it's a timeblock line)
 * @author @dwertheimer
 * @tests available for jest
 * 
 * @param {string} contentString
 * @returns {string} the time portion of the timeblock line
 */
export const getTimeBlockString = (contentString: string): string => {
  const matchedStrings = []
  if (contentString) {
    const reMatch: Array<string> = contentString.match(RE_TIMEBLOCK_APP_CI) ?? []
    if (contentString && reMatch && reMatch.length) {
      matchedStrings.push(reMatch[0].trim())
    }
  }
  // matchedStrings could have several matches, so find the longest one
  return matchedStrings.length ? findLongestStringInArray(matchedStrings) : ''
}
