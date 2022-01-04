// @flow
// ------------------------------------------------------------------------------------
// Timeblocking support constants and functions
// ------------------------------------------------------------------------------------

// Regular Expressions -- the easy ones!
export const RE_ISO_DATE = '\\d{4}-[01]\\d{1}-\\d{2}'
export const RE_HOURS = '[0-2]?\\d'
export const RE_HOURS_EXT = `(${RE_HOURS}|noon|midnight)`
export const RE_MINUTES = '[0-5]\\d'
export const RE_TIME = `${RE_HOURS}:${RE_MINUTES}`
export const RE_AMPM = `(AM?|PM?|am?|pm?)`
export const RE_AMPM_OPT = `${RE_AMPM}?`
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
// These are much more extensive that the brief documentation implies.
// NB: my version ignores seconds in time strings, and assumes there's no @done() date-time to confuse
// export const RE_TIMEBLOCK_START = `(^|\\s|T)(?:(?:at|from)\\s*)?(?:(?:${RE_MINUTES}|noon|midnight)(:${RE_MINUTES})?|(?:${RE_MINUTES}|noon|midnight))(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?(?=\\W|$)`
// export const RE_TIMEBLOCK_END = `(?<!\\d{4}(-[01]\\d)?)\\s*(?:\\-|\\–|\\~|\\〜|to|\\?)\\s*(?:${RE_MINUTES})(?::${RE_MINUTES})?(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?(?=\\W|$)`

// To make it possible to identify matching lines in a single operation, 
// I have now combined the two regex into one.
// NB: These use few non-capturing groups to be shorter and easier to understand.
// export const RE_TIMEBLOCK = `(^|\\s|T)((at|from)\\s*)?((${RE_MINUTES}|noon|midnight)(:${RE_MINUTES})?|(?:${RE_MINUTES}|noon|midnight))(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?(\\s*(\\-|\\–|\\~|\\〜|to|\\?)\\s*(${RE_HOURS})(:${RE_MINUTES})?(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?|$)`
// This version removes false positive on terminal single digit
// export const RE_TIMEBLOCK =`${RE_ISO_DATE_NOT_IN_DONE}(^|\\s|T)((at|from)\\s*(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})?|(${RE_HOURS}|noon|midnight)(:${RE_MINUTES}))(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?(\\s*(\\-|\\–|\\~|\\〜|to|\\?)\\s*(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})?(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?)?`
// This version adds support for '2-3PM' etc.
// And can be used to capture the whole time block as the first result of the regex match
export const RE_TIMEBLOCK = `((?:${RE_ISO_DATE})?(?:(at|from)\\s*([0-2]?\\d|noon|midnight)(:${RE_MINUTES})?${RE_AMPM_OPT}|(${RE_HOURS})(:${RE_MINUTES})?(${RE_AMPM}|(?=\\s*(\\-|\\–|\\~|\\〜|to|\\?)))|(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})${RE_AMPM_OPT})(?:\\s*(\\-|\\–|\\~|\\〜|to|\\?)\\s*(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})?${RE_AMPM_OPT})?)`
// TODO: Currently failing on '>2021-06-02 at 2am-3A.M.' and the below
// This latest version adds support for '6.30 AM - 9:00 PM' style, and tidies up the 
// line endings
// And can be used to capture the whole time block as the first result of the regex match
// export const RE_TIMEBLOCK = `((?:${RE_ISO_DATE})?(?:(at|from)\\s*${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT})|\\h+(${RE_HOURS})(:${RE_MINUTES})?(\\s?${RE_AMPM}|(?=\\s*(\\-|\\–|\\~|\\〜|to|\\?)))|\\h+${RE_HOURS_EXT}(:${RE_MINUTES})\\s?${RE_AMPM_OPT})(?:\\s*(\\-|\\–|\\~|\\〜|to|\\?)\\s*${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT}))?(?=\\h|$))`
// TODO: The \\h+ aren't helping above. 
const RE_TIMEBLOCK_TYPES = [RE_TIMEBLOCK]

// NB: According to @EduardMe in Discord 3.1.2022, the time blocks now work on 
// paragraph types [.title, .open, .done, .list].
// These can more easily be tested for by API calls than in the regex, so that's
// what this now does.

//-----------------------------------------------------------------------------
// The logic required in NotePlan **themes** is slightly more complex, as it 
// must work out whether it's the correct line type, as it has no access to the API.
export const RE_OPEN_TASK = `(?:^\\h*[\\*\\-]\\h+)(?:(?!\\[[x\\-\\>]\\] ))(?:\\[\\s\\]\\h+)?.*?`
export const RE_ALLOWED_TIME_BLOCK_LINE_START = `(?:^\h*(?:\*(?!\h+\[[\-\>]\])|\-(?!\h+\[[\-\>]\] )|[\d+]\.|\#{1,5})\h+)(?:\[\s\]\h+)?.*?`
export const RE_TIMEBLOCK_FOR_THEMES = `${RE_ALLOWED_TIME_BLOCK_LINE_START}${RE_TIMEBLOCK}`


//-----------------------------------------------------------------------------
// FIXME(@Eduard):
// The following cases **don't work fully or break** the API:
// printDateRange(Calendar.parseDateText("2021-06-02 2.15PM-3.45PM")[0]) -> 11AM on that day
// printDateRange(Calendar.parseDateText("2021-06-02 at 2PM")[0]) // -> 1PM on that day
// printDateRange(Calendar.parseDateText("something at 2to3 ok")[0]) // -> crashes NP!

// ------------------------------------------------------------------------------------

/**
 * Decide whether this line contains an active time block.
 * @tests available for jest
 * @author @dwertheimer
 * 
 * @param {string} contentString
 * @returns {boolean}
 */
export const isTimeBlockLine = (contentString: string): boolean =>
  RE_TIMEBLOCK_TYPES.filter((re) => contentString.match(re)).length > 0

/**
 * Decide whether this paragraph contains an active time block.
 * TODO: Ideally also explicitly defeat on timeblock in middle of a ![image](filename)
 * @tests not available as uses NP function. But most of it is tested via isTimeBlockLine above.
 * @author @jgclark
 * 
 * @param {TParagraph} para 
 * @returns {boolean}
 */
export function isTimeBlockPara(para: TParagraph): boolean {
  const contentString = para.content
  return isTimeBlockLine(contentString) && isTypeThatCanHaveATimeBlock(para)
}

/**
 * Decide whether this paragraph contains an open task
 * v2, following news about earlier change of definition (Discord, 3.1.2022)
 * @author @jgclark
 * 
 * @param {TParagraph} para
 * @returns {boolean}
 */
export function isTypeThatCanHaveATimeBlock(para: TParagraph): boolean {
  return (para.type === 'open' ||
    para.type === 'done' ||
    para.type === 'title' ||
    para.type === 'list')
}

/**
 * @author @dwertheimer
 * @tests available for jest

 * @param {String[]} arr 
 * @returns {string}
 */
export const findLongestStringInArray = (arr: string[]): string =>
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
    RE_TIMEBLOCK_TYPES.forEach((re) => {
      const reMatch:string[] = contentString.match(re) ?? []
      if (contentString && reMatch && reMatch.length) {
        matchedStrings.push(reMatch[0].trim())
      }
    })
  }
  // matchedStrings could have several matches, so find the longest one
  return matchedStrings.length ? findLongestStringInArray(matchedStrings) : ''
}
