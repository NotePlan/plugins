// @flow

// These Regexs are used by the app, but don't work in JS
// export function isTimeBlockLine(contentString: string): boolean {
//   const regex1Test = new RegExp(timeblockRegex1, 'mg').exec(contentString)
//   const regex2Test = new RegExp(timeblockRegex2, 'mg').exec(contentString)
//   return regex1Test || (regex1Test && regex2Test)
// }

// ------------------------------------------------------------------------------------
// Regular Expressions -- the easy ones!
export const RE_ISO_DATE = '\\d{4}-[01]\\d{1}-\\d{2}'
export const RE_HOURS = '[0-2]?\\d'
export const RE_HOURS_EXT = `(${RE_HOURS}|noon|midnight)`
export const RE_MINUTES = '[0-5]\\d'
export const RE_TIME = `${RE_HOURS}:${RE_MINUTES}`
export const RE_AMPM = `(AM?|PM?|am?|pm?)`
export const RE_AMPM_OPT = `${RE_AMPM}?`
export const RE_OPEN_TASK = `(?:^\\h*[\\*\\-]\\h+)(?:(?!\\[[x\\-\\>]\\] ))(?:\\[\\s\\]\\h+)?.*?`
export const RE_DONE_DATETIME = `@done\\(${RE_ISO_DATE} ${RE_TIME}${RE_AMPM}?\\)`
export const RE_DONE_DATE_OPT_TIME = `@done\\(${RE_ISO_DATE}( ${RE_TIME}${RE_AMPM}?)?\\)`

// ------------------------------------------------------------------------------------
// Regular Expressions -- the hard ones, to find all the many possible variations 
// of time blocks.  These are based on the following pair of regex he uses in timeblock
// code, published on 10.11.2021.
// The FIRST... one is for start time, and
// the second SECOND is for optional end time.

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


// @jgclark's newer pair of regex to find time blocks, based on those regex.
// These are much more extensive that the brief documentation quoted above.
// NB: my version ignores seconds in time strings, and assumes there's no @done() date-time to confuse
export const RE_TIMEBLOCK_START = `(^|\\s|T)(?:(?:at|from)\\s*)?(?:(?:${RE_MINUTES}|noon|midnight)(:${RE_MINUTES})?|(?:${RE_MINUTES}|noon|midnight))(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?(?=\\W|$)`
export const RE_TIMEBLOCK_END = `(?<!\\d{4}(-[01]\\d)?)\\s*(?:\\-|\\–|\\~|\\〜|to|\\?)\\s*(?:${RE_MINUTES})(?::${RE_MINUTES})?(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?(?=\\W|$)`

// To make it possible to identify matching lines in a single operation, 
// I have combined the two regex into one.
// NB: These use few non-capturing groups to be shorter and easier to understand.
// export const RE_TIMEBLOCK = `(^|\\s|T)((at|from)\\s*)?((${RE_MINUTES}|noon|midnight)(:${RE_MINUTES})?|(?:${RE_MINUTES}|noon|midnight))(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?(\\s*(\\-|\\–|\\~|\\〜|to|\\?)\\s*(${RE_HOURS})(:${RE_MINUTES})?(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?|$)`
// This version removes false positive on terminal single digit
// export const RE_TIMEBLOCK =`${RE_ISO_DATE_NOT_IN_DONE}(^|\\s|T)((at|from)\\s*(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})?|(${RE_HOURS}|noon|midnight)(:${RE_MINUTES}))(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?(\\s*(\\-|\\–|\\~|\\〜|to|\\?)\\s*(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})?(A\\.M\\.|P\\.M\\.|AM?|PM?|am?|pm?)?)?`
// This version adds support for '2-3PM' etc.
// And can be used to capture the whole time block as the first result of the regex match
export const RE_TIMEBLOCK = `(?:^|\\s)((?:${RE_ISO_DATE})?(?:(at|from)\\s*([0-2]?\\d|noon|midnight)(:${RE_MINUTES})?${RE_AMPM_OPT}|(${RE_HOURS})(:${RE_MINUTES})?(${RE_AMPM}|(?=\\s*(\\-|\\–|\\~|\\〜|to|\\?)))|(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})${RE_AMPM_OPT})(?:\\s*(\\-|\\–|\\~|\\〜|to|\\?)\\s*(${RE_HOURS}|noon|midnight)(:${RE_MINUTES})?${RE_AMPM_OPT})?)`
// TODO: Currently failing on '>2021-06-02 at 2am-3A.M.' and the below
// This latest version adds support for '6.30 AM - 9:00 PM' style, and tidies up the 
// line endings
// And can be used to capture the whole time block as the first result of the regex match
// export const RE_TIMEBLOCK = `(?:^|\\s)((?:${RE_ISO_DATE})?(?:(at|from)\\s*${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT})|\\h+(${RE_HOURS})(:${RE_MINUTES})?(\\s?${RE_AMPM}|(?=\\s*(\\-|\\–|\\~|\\〜|to|\\?)))|\\h+${RE_HOURS_EXT}(:${RE_MINUTES})\\s?${RE_AMPM_OPT})(?:\\s*(\\-|\\–|\\~|\\〜|to|\\?)\\s*${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT}))?(?=\\h|$))`
// TODO: The \\h+ aren't helping above. 
// The logic required in NotePlan **themes** is slightly more complex, as it 
// needs to ignore lines that are completed todos.
export const RE_TIMEBLOCK_FOR_THEMES = `${RE_OPEN_TASK}${RE_TIMEBLOCK}`

//----------------------------------------------------------------------
// FIXME(@Eduard):
// The following cases **don't work fully or break** the API:
// printDateRange(Calendar.parseDateText("2021-06-02 2.15PM-3.45PM")[0]) -> 11AM on that day
// printDateRange(Calendar.parseDateText("2021-06-02 at 2PM")[0]) // -> 1PM on that day
// printDateRange(Calendar.parseDateText("something at 2to3 ok")[0]) // -> crashes NP!

// ------------------------------------------------------------------------------------
// const RE_TIMEBLOCK_TYPES = [RE_TIMEBLOCK_TYPE1, RE_TIMEBLOCK_TYPE2, RE_TIMEBLOCK_TYPE3]
const RE_TIMEBLOCK_TYPES = [RE_TIMEBLOCK]

/**
 * Decide whether this line contains an active time block.
 * @author @dwertheimer
 * @tests available for jest
 * @param {string} contentString
 * @returns {boolean}
 */
export const isTimeBlockLine = (contentString: string): boolean =>
  RE_TIMEBLOCK_TYPES.filter((re) => contentString.match(re)).length > 0

/**
 * Decide whether this paragraph contains an active time block. V2
 * JGC/DW decide that this means it must be part of an open/active todo/task line.
 * TODO: Ideally also explicitly defeat on timeblock in middle of a ![image](filename),
 * but the chances of that being part of an active task line feel extremely low.
 * @author @jgclark
 * @tests not available as uses NP function. But most of it is tested via isTimeBlockLine above.
 * @param {TParagraph} para 
 * @returns {boolean}
 */
export function isTimeBlockPara(para: TParagraph): boolean {
  const contentString = para.content
  return !!contentString.match(RE_TIMEBLOCK) && isOpenTaskPara(para)
}

/**
 * Decide whether this paragraph contains an open task
 * @author @jgclark
 * @param {TParagraph} para
 * @returns {boolean}
 */
export function isOpenTaskPara(para: TParagraph): boolean {
  return (para.type === 'open' || para.type === 'scheduled')
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
