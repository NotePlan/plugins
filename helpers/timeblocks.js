// @flow

// These Regexs are used by the app, but don't work in JS
// export function isTimeBlockLine(contentString: string): boolean {
//   const regex1Test = new RegExp(timeblockRegex1, 'mg').exec(contentString)
//   const regex2Test = new RegExp(timeblockRegex2, 'mg').exec(contentString)
//   return regex1Test || (regex1Test && regex2Test)
// }

// ------------------------------------------------------------------------------------
// This code copied/adapted from @jgclark.EventHelpers/src/timeblocks.js
// Regular Expressions
const RE_ISO_DATE = '\\d{4}-[01]\\d{1}-\\d{2}'
const RE_HOUR = '[0-2]?\\d'
const RE_MINUTE = '[0-5]\\d'
const RE_TIME = `${RE_HOUR}:${RE_MINUTE}`
const RE_AMPM = `(AM|PM|am|pm)`
const RE_OPT_AMPM = `${RE_AMPM}?`
// find ' 12:30[AM|PM|am|pm][-14:45[AM|PM|am|pm]]'
const RE_TIMEBLOCK_TYPE1 = `\\s*${RE_TIME}${RE_OPT_AMPM}(\\s?-\\s?${RE_TIME}${RE_OPT_AMPM})?`
// find ' at 2(AM|PM|am|pm)[-11[AM|PM|am|pm]]'
const RE_TIMEBLOCK_TYPE2 = `\\s*at\\s+${RE_HOUR}(:${RE_MINUTE}|(AM|PM|am|pm)?)(\\s?-\\s?${RE_HOUR}(:${RE_MINUTE}|AM|PM|am|pm)?)?`
// find ' at 9(AM|PM|am|pm)-11:30(AM|PM|am|pm)'
const RE_TIMEBLOCK_TYPE3 = `\\s*(at\\s+)?${RE_HOUR}${RE_OPT_AMPM}\\s?-\\s?${RE_HOUR}:${RE_MINUTE}${RE_AMPM}`
// ------------------------------------------------------------------------------------
const RE_TB_TYPES = [RE_TIMEBLOCK_TYPE1, RE_TIMEBLOCK_TYPE2, RE_TIMEBLOCK_TYPE3]

export const isTimeBlockLine = (contentString: string): boolean =>
  RE_TB_TYPES.filter((re) => contentString.match(re)).length > 0

export const findLongestStringInArray = (arr: string[]): string =>
  arr.length ? arr.reduce((a, b) => (a.length > b.length ? a : b)) : ''

export const getTimeBlockString = (contentString: string): string => {
  // const reMatches = RE_TB_TYPES.filter((re) => contentString.match(re))
  const matchedStrings = []
  if (contentString) {
    RE_TB_TYPES.forEach((re) => {
      const reMatch = contentString.match(re)
      if (contentString && reMatch && reMatch.length) {
        matchedStrings.push(reMatch[0].trim())
      }
    })
  }
  // matchedStrings could have several matches, so find the longest one
  return matchedStrings.length ? findLongestStringInArray(matchedStrings) : ''
}
