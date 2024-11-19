// @flow
// ------------------------------------------------------------------------------------
// Timeblocking support constants and functions
// ------------------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import { clo, JSP, logDebug, logInfo, logError } from './dev'
import { isTermInMarkdownPath, isTermInURL } from './paragraph'
import { findLongestStringInArray } from './utils'

// import { getTime } from "date-fns";

// Regular Expressions -- the easy ones!
export const RE_ISO_DATE = '\\d{4}-[01]\\d{1}-\\d{2}' // this is now a near dupe of helpers/dateTime
export const RE_HOURS = '[0-2]?\\d'
export const RE_HOURS_EXT = `(${RE_HOURS}|NOON|noon|MIDNIGHT|midnight)`
export const RE_MINUTES = '[0-5]\\d'
export const RE_TIME = `${RE_HOURS}:${RE_MINUTES}`
export const RE_TIME_EXT = `${RE_HOURS_EXT}:${RE_MINUTES}`
// export const RE_AMPM = `(A\\.M\\.|P\\.M\\.|AM?|PM?)`
export const RE_AMPM = `\\s?(AM|am|PM|pm)` // logic changed in v3.4
export const RE_AMPM_OPT = `${RE_AMPM}?`
export const RE_TIME_TO = `\\s?(\\-|\\–|\\~)\\s?`
// export const RE_DONE_DATETIME = `@done\\(${RE_ISO_DATE} ${RE_TIME}${RE_AMPM}?\\)` // this is now a near dupe of helpers/dateTime
// export const RE_DONE_DATE_OPT_TIME = `@done\\(${RE_ISO_DATE}( ${RE_TIME}${RE_AMPM}?)?\\)` // this is now a dupe of helpers/dateTime
const RE_START_OF_LINE = `(?:^|\\s)`
const RE_END_OF_LINE = `(?=\\s|$)`

//-----------------------------------------------------------------------------
// NB: According to @EduardMe in Discord 29.1.2022, the detection is tightened in v3.4
// to require 'am' or 'pm' not just 'a' or 'p'. Changed here 30.1.22.

//-----------------------------------------------------------------------------
// FIXME(@Eduard):
// TODO: test again after EM made changes for 3.6.0 >b797
// The following cases **don't work fully or break** the API:
// printDateRange(Calendar.parseDateText("2021-06-02 2.15PM-3.45PM")[0]) -> 11AM on that day
// printDateRange(Calendar.parseDateText("2021-06-02 at 2PM")[0]) // -> 1PM on that day
// printDateRange(Calendar.parseDateText("something at 2to3 ok")[0]) // -> crashes NP!
// - The time is 2pm-3 // produces timeblock 2pm to midnight

//-----------------------------------------------------------------------------
// Note: According to @EduardMe in Discord 3.1.2022, the time blocks now work on
// paragraph types [.title, .open, .done, .list].
// These can more easily be tested for by API calls than in the regex, so that's what this now does.
// Note: added 'checklist' and 'checklistDone' types ready for NP 3.8 release
export const TIMEBLOCK_TASK_TYPES = ['title', 'open', 'done', 'list', 'checklist', 'checklistDone']

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
// @jgclark's newer regex to find time blocks, based on those original ones.
// These are much more extensive that the brief documentation implies, or now
// the more extensive documentation at https://help.noteplan.co/article/121-time-blocking.
//
// Note: my version ignores seconds in time strings, and assumes there's no @done() date-time to confuse
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
// This latest version adds support for '6.30 AM - 9:00 PM' style, and tidies up the line endings
// And can be used to capture the whole time block as the first result of the regex match
// BUT still fails on 9 tests
// export const RE_TIMEBLOCK = `(?:(at|from)\\s*${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT})|\\h+(${RE_HOURS})(:${RE_MINUTES})?(\\s?${RE_AMPM}|(?=${RE_TIME_TO}))|\\h+${RE_HOURS_EXT}(:${RE_MINUTES})\\s?${RE_AMPM_OPT})(?:${RE_TIME_TO}${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT}))?(?=\\h|$)`

// Following version with \s instead of \h -- Works for all tests!
// export const RE_TIMEBLOCK = `(?:(at|from)\\s*${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT})|\\s+(${RE_HOURS})(:${RE_MINUTES})?(\\s?${RE_AMPM}|(?=${RE_TIME_TO}))|\\s+${RE_HOURS_EXT}(:${RE_MINUTES})\\s?${RE_AMPM_OPT})(?:${RE_TIME_TO}${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT}))?(?=\\s|$)`

// But then, grr, doesn't all work in the actual app.
// Eventually I realised this is probably because of the start of line context, which
// is often different in a regex tester. So tweaking the start of line logic -- but
// means greater divergence between this and how the theme regex needs to work.
// const RE_START_APP_LINE = `(?<=^|\\s)`
// export const RE_TIMEBLOCK = `((at|from)\\s*${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT})|(${RE_HOURS})(:${RE_MINUTES})?(\\s?${RE_AMPM}|(?=${RE_TIME_TO}))|\\s+${RE_HOURS_EXT}(:${RE_MINUTES})\\s?${RE_AMPM_OPT})(?:${RE_TIME_TO}${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s?${RE_AMPM_OPT}))?(?=\\s|$)`
// export const RE_TIMEBLOCK_APP = `${RE_START_APP_LINE}${RE_TIMEBLOCK}`

// But major grrr! it still doesn't work in the app, despite passing all the tests.
// Turns out the new look-behind assertion is erroring silently in the app with "Invalid regular expression: invalid group specifier name".
// Problem is addition of a look behind assertion.
// const RE_START_APP_LINE = `(?:^|\\s)`
// (code not captured)

// So trying yet another way ... basically a big (A|B):
// - A = more lax match following 'at' or 'from'
// - B = tighter match requiring some form of X-Y
// const RE_START_APP_LINE = `(?:^|\\s)`
// export const RE_TIMEBLOCK = `(((at|from)\\s+${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s*${RE_AMPM_OPT})(${RE_TIME_TO}(${RE_HOURS})(:${RE_MINUTES})?(\\s*${RE_AMPM_OPT}))?|${RE_HOURS_EXT}:${RE_MINUTES}?\\s*${RE_AMPM_OPT}(${RE_TIME_TO}${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s*${RE_AMPM_OPT})?)?))(?=\\s|$)`
// export const RE_TIMEBLOCK_APP = `${RE_START_APP_LINE}${RE_TIMEBLOCK}`

// But need to cope with '12:30' and '2[am]-3PM' case: now a big (A|B|C):
// - A = more lax match following 'at' or 'from'
// - B = tighter match requiring some form of X-YPM
// - C = tight match requiring HH:MM[-HH:MM]
// const RE_START_OF_LINE = `(?:^|\\s)`
// const RE_END_OF_LINE = `(?=\\s|$)`
// export const RE_TIMEBLOCK_PART_A = `(at|from)\\s+${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s*${RE_AMPM_OPT})(${RE_TIME_TO}(${RE_HOURS})(:${RE_MINUTES})?(\\s*${RE_AMPM_OPT}))?`
// export const RE_TIMEBLOCK_PART_B = `(${RE_HOURS_EXT}(:${RE_MINUTES})?\\s*${RE_AMPM_OPT}(${RE_TIME_TO}${RE_HOURS_EXT}(:${RE_MINUTES})?(\\s*${RE_AMPM})))`
// export const RE_TIMEBLOCK_PART_C = `(${RE_TIME_EXT}\\s*${RE_AMPM_OPT})(${RE_TIME_TO}${RE_TIME_EXT})?`
// export const RE_TIMEBLOCK = `(${RE_TIMEBLOCK_PART_A}|${RE_TIMEBLOCK_PART_B}|${RE_TIMEBLOCK_PART_C})`
// // Put all together
// export const RE_TIMEBLOCK_IN_LINE = `${RE_START_OF_LINE}${RE_TIMEBLOCK}${RE_END_OF_LINE}`
// // console.log(RE_TIMEBLOCK_IN_LINE)

//-----------------------------------------------------------------------------

// In late 2024 got round to updating all this with the much tighter TB detection in NP. Now just:
// - tight match requiring HH:MM[A][-HH:MM[A]] with possible spaces before the am/pm
export const RE_TIMEBLOCK = `${RE_TIME}${RE_AMPM_OPT}(${RE_TIME_TO}${RE_TIME}${RE_AMPM_OPT})?`
export const RE_TIMEBLOCK_IN_LINE = `${RE_START_OF_LINE}${RE_TIMEBLOCK}`

// console.log(RE_TIMEBLOCK_IN_LINE)

//-----------------------------------------------------------------------------
// THEMES
// This section is now removed, as NP handles theming of TBs itself now.

// ------------------------------------------------------------------------------------

/**
 * Decide whether this line contains an active time block.
 * WARNING: can only be used from HTMLWindow if the second parameter is given (which can be the empty string), as otherwise it calls DataStore.preference("timeblockTextMustContainString").
 * Also now defeats on timeblock in middle of a [...](filename) or URL.
 * @tests available for jest
 * @author @dwertheimer
 *
 * @param {string} contentString
 * @param {string?} mustContainStringArg? if not given, then will read from NP app setting instead
 * @returns {boolean}
 */
export function isTimeBlockLine(contentString: string, mustContainStringArg: string = ''): boolean {
  try {
    // Get the setting from arg or from NP setting
    // FIXME: this goes wrong, and the mustContainString is undefined
    // const mustContainString = (mustContainStringArg && typeof mustContainStringArg === "string") ? mustContainStringArg : DataStore.preference("timeblockTextMustContainString") ?? ''
    const mustContainString = 'at'
    logDebug('isTimeBlockLine', `🕰️ isTimeBlockLine: for {${contentString}} mustContainString = ${String(mustContainString)}`)
    // Following works around a bug when the preference isn't being set at all at the start.
    if (typeof mustContainString === "string" && mustContainString !== '') {
      const res1 = contentString.includes(mustContainString)
      if (!res1) {
        logDebug('isTimeBlockLine', `🕰️ isTimeBlockLine: not found must string`)
        return false
      }
    }
    const tbString = getTimeBlockString(contentString)
    if (isTermInMarkdownPath(tbString, contentString) || isTermInURL(tbString, contentString)) {
      return false
    }
    const res2 = contentString.match(RE_TIMEBLOCK_IN_LINE) ?? []
    return res2.length > 0
  }
  catch (err) {
    console.log(err)
    return false
  }
}

/**
 * Decide whether this paragraph contains an open task.
 * v2, following news about earlier change of definition (Discord, 3.1.2022)
 * @tests available for jest
 * @author @jgclark
 *
 * @param {TParagraph} para
 * @returns {boolean}
 */
export function isTypeThatCanHaveATimeBlock(para: TParagraph): boolean {
  return TIMEBLOCK_TASK_TYPES.indexOf(para.type) > -1 // ugly but neat
}

/**
 * Decide whether this paragraph contains an active time block.
 * Note: Needs 'timeblockTextMustContainString' (which may be empty), to avoid calling DataStore function.
 * @tests available for jest
 * @author @jgclark
 *
 * @param {TParagraph} para
 * @param {string} timeblockTextMustContainString which may be empty.
 * @returns {boolean}
 */
export function isTimeBlockPara(para: TParagraph, timeblockTextMustContainString: string = ''): boolean {
  // To keep the code simpler, this now just calls a very similar function
  return isTimeBlockLine(para.content, timeblockTextMustContainString)
}

/**
 * Get the timeblock portion of a timeblock line (also is a way to check if it's a timeblock line).
 * Does not return the text after the timeblock (you can use isTimeBlockLine to check if it's a timeblock line).
 * @tests available for jest
 * @author @dwertheimer
 *
 * @param {string} contentString
 * @returns {string} the time portion of the timeblock line
 */
export const getTimeBlockString = (contentString: string): string => {
  const matchedStrings = []
  if (contentString) {
    const reMatch: Array<string> = contentString.match(RE_TIMEBLOCK_IN_LINE) ?? []
    // logDebug('getTimeBlockString', `reMatch: ${String(reMatch)} for '${contentString}'`)
    if (contentString && reMatch && reMatch.length) {
      matchedStrings.push(reMatch[0].trim())
    }
  }
  // matchedStrings could have several matches, so find the longest one
  // logDebug('getTimeBlockString', `matchedStrings: ${String(matchedStrings)}`)
  return matchedStrings.length ? findLongestStringInArray(matchedStrings) : ''
}

/**
 * Return the start time of a time block in a given paragraph, or else 'none' (which will then sort after times).
 * @param {string} content to process
 * @returns {string} e.g. 3:45PM (or 'none' or 'error')
 */
export function getStartTimeStrFromParaContent(content: string): string {
  try {
    let startTimeStr = 'none'
    const thisTimeStr = getTimeBlockString(content)
    startTimeStr = thisTimeStr.split('-')[0]
    return startTimeStr
  } catch (error) {
    logError('getStartTimeStrFromParaContent', `${JSP(error)}`)
    return 'error'
  }
}

/**
 * Return the end time (if present) of a time block in a given paragraph, or else ''.
 * @param {string} content to process
 * @returns {string} e.g. 3:45PM (or '' or 'error')
 */
export function getEndTimeStrFromParaContent(content: string): string {
  try {
    let endTimeStr = ''
    const thisTimeStr = getTimeBlockString(content)
    endTimeStr = thisTimeStr.split('-')[1]
    return endTimeStr
  } catch (error) {
    logError('getEndTimeStrFromParaContent', `${JSP(error)}`)
    return 'error'
  }
}

/**
 * Return the start time of a time block in a given paragraph, or else 'none' (which will then sort after times)
 * Copes with 'AM' and 'PM' suffixes. Note: Not fully internationalised (but then I don't think the rest of NP accepts non-Western numerals)
 * @param {string} content to process
 * @returns {?{number, number}} {hours, minutes} in 24 hour clock, or null
 */
export function getStartTimeObjFromParaContent(content: string): ?{ hours: number, mins: number } {
  try {
    let startTimeStr = 'none'
    let hours = NaN
    let mins = NaN
    if (content !== '') {
      const thisTimeStr = getTimeBlockString(content)
      if (thisTimeStr !== '') {
        startTimeStr = thisTimeStr.split('-')[0]
        const [timeStr, ampm] = startTimeStr.split(RE_AMPM_OPT)
        if (timeStr.includes(":")) {
          [hours, mins] = timeStr.split(':').map(Number)
        } else {
          hours = Number(timeStr)
        }
        if (ampm && ampm.toLowerCase() === 'pm' && hours !== 12) {
          hours += 12
        } else if (ampm && ampm.toLowerCase() === 'am' && hours === 12) {
          hours = 0
        }
        logDebug('getStartTimeObjFromParaContent', `timeStr = ${startTimeStr} from timeblock ${thisTimeStr}`)
      } else {
        return
      }
    }
    const startTime = { hours: hours, mins: mins }
    return startTime
  } catch (error) {
    logError('getStartTimeObjFromParaContent', `${JSP(error)}`)
    return //{ hours: NaN, mins: NaN }
  }
}

/**
 * Return the end time of time block in a given paragraph, or else 'none' (which will then sort after times)
 * Copes with 'AM' and 'PM' suffixes. Note: Not fully internationalised (but then I don't think the rest of NP accepts non-Western numerals)
 * @param {string} content to process
 * @returns {{number, number}} {hours, minutes} in 24 hour clock
 */
export function getEndTimeObjFromParaContent(content: string): { hours: number, mins: number } {
  try {
    let endTimeStr = 'none'
    let hours = NaN
    let mins = NaN
    if (content !== '') {
      const thisTimeStr = getTimeBlockString(content)
      if (thisTimeStr !== '') {
        endTimeStr = thisTimeStr.split('-')[1]
        const [timeStr, ampm] = endTimeStr.split(RE_AMPM_OPT)
        if (timeStr.includes(":")) {
          [hours, mins] = timeStr.split(':').map(Number)
        } else {
          hours = Number(timeStr)
        }
        if (ampm.toLowerCase() === 'pm' && hours !== 12) {
          hours += 12
        } else if (ampm.toLowerCase() === 'am' && hours === 12) {
          hours = 0
        }
        logDebug('getEndTimeObjFromParaContent', `timeStr = ${endTimeStr} from timeblock ${thisTimeStr}`)
      }
    }
    const startTime = { hours: hours, mins: mins }
    return startTime
  } catch (error) {
    logError('getEndTimeObjFromParaContent', `${JSP(error)}`)
    return { hours: NaN, mins: NaN }
  }
}

/**
 * Retrieves the first para in the note that has a timeblock that covers the current time. It ignores done/cancelled tasks or checklist lines.
 * Note: Dates are ignored in the check.
 * 
 * @param {TNote} note - The note object containing paragraphs to search for time blocks.
 * @param {boolean?} excludeClosedParas? (default: false)
 * @returns {?TParagraph}
 */
export function getCurrentTimeBlockPara(note: TNote, excludeClosedParas: boolean = false, mustContainString: string = ''): ?TParagraph {
  try {
    const currentTimeMom = moment()
    // logDebug('getCurrentTimeBlock', `currentTimeMom: ${currentTimeMom.format('HH:mm:ss')}`)

    for (const para of note.paragraphs) {
      // Ignore completed and text paras 
      if (excludeClosedParas && ['done', 'cancelled', 'checklistDone', 'checklistCancelled', 'text'].includes(para.type)) {
        // logDebug('getCurrentTimeBlock', `- ignored {${para.content}} as its of type ${para.type}`)
        continue
      }
      if (isTimeBlockLine(para.content, mustContainString)) {
        // const timeBlockString = getTimeBlockString(para.content)

        // V3 using Moment
        const startTimeStr = getStartTimeStrFromParaContent(para.content)
        const endTimeStr = getEndTimeStrFromParaContent(para.content)
        const startTimeMom = moment(startTimeStr, ['HH:mmA', 'HHA', 'HH:mm', 'HH'])
        const endTimeMom = moment(endTimeStr, ['HH:mmA', 'HHA', 'HH:mm', 'HH'])
        // logDebug('getCurrentTimeBlock', `${startTimeMom.format('HH:mm')} - ${endTimeMom.format('HH:mm')} from ${timeBlockString}`)

        // See if this is between those times (including start time but excluding end time)
        if (currentTimeMom.isBetween(startTimeMom, endTimeMom, undefined, '[)')) {
          // logDebug('getCurrentTimeBlock', `Found current timeblock ${timeBlockString} in para {${para.content}}`)
          return para
        }
      } else {
        // logDebug('getCurrentTimeBlock', `- ignored line {${para.content}} as it is not a timeblock line`)
      }
    }
    // None found
    return null
  } catch (err) {
    logError('getCurrentTimeBlock', err.message)
    return null
  }
}

/**
 * Retrieves the details of the current active time block from a note.
 * See getCurrentTimeBlockPara() above for details of how it works.
 * If a matching time block is found, it returns the time block string and the content of the paragraph without the time block.
 * 
 * @param {TNote} note - The note object containing paragraphs to search for time blocks
 * @param {string} timeblockTextMustContainString which may be empty
 * @returns {[string, string]} A tuple of the time block string, and the paragraph content without the time block (and any mustContainString). Returns an empty tuple if no current time block is found.
 */
export function getCurrentTimeBlockDetails(note: TNote, timeblockTextMustContainString: string = ''): [string, string] {
  try {
    const matchingPara = getCurrentTimeBlockPara(note, true, timeblockTextMustContainString)

    if (matchingPara) {
      const timeBlockParaContent = matchingPara.content
      const [timeBlockString, contentWithoutTimeBlock] = getTimeBlockDetails(timeBlockParaContent, timeblockTextMustContainString)
      return [timeBlockString, contentWithoutTimeBlock]
    } else {
      return ['', ''] // Return an empty tuple if no current time block is found
    }
  } catch (err) {
    logError('getCurrentTimeBlockDetails', err.message)
    return ['', ''] // Return an empty tuple as a fallback
  }
}

/**
 * Retrieves the details of the time block in the given content string.
 * See getCurrentTimeBlockPara() above for details of how it works.
 * If a matching time block is found, it returns the time block string and the content of the paragraph without the time block.
 * 
 * @param {string} content - The found timeblock
 * @param {string} timeblockTextMustContainString which may be empty
 * @returns {[string, string]} A tuple of the time block string, and the paragraph content without the time block (and any mustContainString). Returns an empty tuple if no current time block is found.
 */
export function getTimeBlockDetails(content: string, timeblockTextMustContainString: string = ''): [string, string] {
  try {
    const timeBlockString = getTimeBlockString(content)
    const contentWithoutTimeBlock = content.replace(timeBlockString, '').replace(timeblockTextMustContainString, '').trim()
    logDebug('getTimeBlockDetails', `${timeBlockString} / ${timeblockTextMustContainString} / ${contentWithoutTimeBlock}`)
    return [timeBlockString, contentWithoutTimeBlock]
  } catch (err) {
    logError('getTimeBlockDetails', err.message)
    return ['', ''] // Return an empty tuple as a fallback
  }
}
