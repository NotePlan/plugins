// @flow
import { endOfDay, startOfDay, eachMinuteOfInterval, formatISO9075, addMinutes, differenceInMinutes } from 'date-fns'
import type { SortableParagraphSubset } from '../../helpers/sorting'
import { escapeRegExp } from '../../helpers/regex'
import { getTagsFromString } from '../../helpers/paragraph'
import type {
  IntervalMap,
  OpenBlock,
  TimeBlocksWithMap,
  BlockData,
  TimeBlockDefaults,
  PartialCalendarItem,
  ParagraphWithDuration,
  SplitResult,
  MatchedItems,
  Tags,
} from './timeblocking-flow-types'
import type { AutoTimeBlockingConfig } from './config'
import { processByTimeBlockTag } from './byTagMode'
import { getDateObjFromDateTimeString, getTimeStringFromDate, removeDateTagsAndToday, removeRepeats } from '@helpers/dateTime'
import { sortListBy } from '@helpers/sorting'
import { textWithoutSyncedCopyTag } from '@helpers/syncedCopies'
import { createPrettyLinkToLine, createWikiLinkToLine } from '@helpers/NPSyncedCopies'
import { logError, JSP, copyObject, clo, clof, logDebug, logWarn } from '@helpers/dev'

// import { timeblockRegex1, timeblockRegex2 } from '../../helpers/markdown-regex'

const pluginJson = `timeblocking-helpers.js`

/**
 * Create a map of the time intervals for a portion of day
 * @param {*} start
 * @param {*} end
 * @param {*} valueToSet
 * @param {*} options
 * @returns Array of objects with the following properties: [{"start":"00:00","busy":false},{"start":"00:05","busy":false}...]
 */
export function createIntervalMap(time: { start: Date, end: Date }, valueToSet: false | string = false, options: { step: number } = { step: 5 }): IntervalMap {
  const { start, end } = time
  const { step } = options
  if (step && step > 0) {
    const intervals = eachMinuteOfInterval({ start, end }, { step })
    return intervals.map((interval, i) => {
      const start = formatISO9075(interval).slice(0, -3)
      const time = start.split(' ')[1]
      return { start: time, busy: valueToSet, index: i }
    })
  }
  return []
}

export function getBlankDayMap(intervalMins: number): IntervalMap {
  return createIntervalMap({ start: startOfDay(new Date()), end: endOfDay(new Date()) }, false, { step: intervalMins })
}

export function blockTimeFor(timeMap: IntervalMap, blockdata: BlockData, config: { [key: string]: any }): { newMap: IntervalMap, itemText: string } {
  const { start, end, title } = blockdata
  const newMap = timeMap.map((t) => {
    if (t.start >= start && t.start < end) {
      t.busy = title ?? true
    }
    return t
  })
  const itemText = typeof title === 'boolean' ? '' : createTimeBlockLine({ title, start, end }, config)
  return { newMap, itemText }
}

/**
 * Clean text using an array of regexes or strings to replace
 */
export function cleanText(text: string, replacements: Array<RegExp | string>): string {
  let cleanString = text
  replacements.forEach((r) => {
    cleanString = cleanString.replace(r, ' ')
  })
  cleanString = cleanString.replace(/ {2,}/g, ' ').trim()
  return cleanString
}

/**
 * Remove all ATB-CREATED formatting from a timeblock line and return just the content (so we can do comparisons)
 * e.g. "00:01-12:22 foo bar baz" -> "foo bar baz"
 * @param {string} line
 * @param {TimeBlockDefaults} config
 * @returns {string} clean string
 */
export function cleanTimeBlockLine(line: string, config: { [key: string]: any }): string {
  const { timeBlockTag, durationMarker } = config
  // use .*? for non-greedy (match minimum chars) and make sure to use global flag for all matches
  const cleanerRegexes = [
    new RegExp(`^\\d{2}:\\d{2}-\\d{2}:\\d{2} `, 'g'),
    new RegExp(` ${escapeRegExp(timeBlockTag)}`, 'g'),
    new RegExp(`\\[\\[.*?\\]\\]`, 'g'),
    new RegExp(`\\[.*?\\]\\(.*?\\)`, 'g'),
  ]
  let clean = cleanText(line, cleanerRegexes)
  clean = removeDurationParameter(clean, durationMarker)
  clean = removeDateTagsAndToday(clean, true)
  return clean
  // cleanString = removeDateTagsAndToday(cleanString)
}

export function attachTimeblockTag(content: string, timeblockTag: string): string {
  const regEx = new RegExp(` ${escapeRegExp(timeblockTag)}`, 'g') //replace the existing tag if it's there
  return `${content.replace(regEx, '')} ${timeblockTag}`
}

export function createTimeBlockLine(blockData: BlockData, config: { [key: string]: any }): string {
  if (blockData.title && blockData.title.length > 0) {
    let newContentLine = blockData.title
    if (config.removeDuration) {
      newContentLine = removeDurationParameter(newContentLine, config.durationMarker)
    }
    newContentLine = attachTimeblockTag(newContentLine, config.timeBlockTag)
    let tbLine = `${config.todoChar} ${blockData.start}-${blockData.end} ${newContentLine || blockData.title || ''}`
    if (config.timeblockTextMustContainString?.length && !tbLine.includes(config.timeblockTextMustContainString)) {
      tbLine = `${tbLine} ${config.timeblockTextMustContainString}`
    }
    return tbLine
  }
  return ''
}

/**
 * Takes in an array of calendar items and a timeMap for the day
 * and returns the timeMap with the busy times updated to reflect the calendar items
 * @author @dwertheimer
 *
 * @param {Array<TCalendarItem>} events
 * @param {IntervalMap} timeMap
 * @param {TimeBlockDefaults} config
 * @returns {IntervalMap} - the timeMap with the busy times updated to reflect the calendar items
 */
export function blockOutEvents(events: Array<PartialCalendarItem>, timeMap: IntervalMap, config: { [key: string]: any }): IntervalMap {
  let newTimeMap = [...timeMap]
  events
    .filter((e) => e.availability !== 1)
    .forEach((event) => {
      const start = getTimeStringFromDate(event.date)
      const end = event.endDate ? getTimeStringFromDate(event.endDate) : ''
      const obj = event.endDate ? blockTimeFor(newTimeMap, { start, end, title: event.title }, config) : { newMap: newTimeMap }
      newTimeMap = obj.newMap
    })
  return newTimeMap
}

/**
 * Typically we are looking for open tasks, but it is possible that some >today items
 * might be bullets (type=='list'), so for timeblocking purposes, let's make them open tasks
 * for the purposes of this script
 * @author @dwertheimer
 *
 * @param {TParagraphs[]} paras
 * @returns TParagraphs[] - with remapped items
 */
export function makeAllItemsTodos(paras: Array<TParagraph>): Array<TParagraph> {
  const typesToRemap = ['list', 'text']
  // NOTEPLAN FRUSTRATION! YOU CANNOT SPREAD THE ...P AND GET THE
  // UNDERLYING VALUES!
  // return paras.map((p) => {p.type = ({ ...p, type: typesToRemap.indexOf(p.type) !== -1 ? 'open' : p.type }))
  return paras.map((p) => {
    p.type = typesToRemap.indexOf(p.type) !== -1 ? 'open' : p.type
    return p
  })
}

// $FlowIgnore - can't find a Flow type for RegExp
export const durationRegEx = (durationMarker: string) =>
  new RegExp(`\\s*${durationMarker}((?<hours>[0-9]+\\.?[0-9]*|\\.[0-9]+)(hours|hour|hr|h))?((?<minutes>[0-9]+\\.?[0-9]*|\\.[0-9]+)(minutes|mins|min|m))?`, 'mg')

export const removeDurationParameter = (text: string, durationMarker: string): string => text.replace(durationRegEx(durationMarker), '').trim()

export function getDurationFromLine(line: string, durationMarker: string): number {
  const regex = durationRegEx(durationMarker)
  const match = regex.exec(line)
  let mins = 0
  if (match) {
    const hours = match?.groups?.hours ? Number(match.groups.hours) : 0
    const minutes = match?.groups?.minutes ? Number(match.groups.minutes) : 0
    mins = Math.ceil(hours * 60 + minutes)
  }
  clo(match, `+++++++ getDurationFromLine match=${String(match)}, so setting mins=${mins} for "${line}"; match groups=`)
  return mins
}

/**
 * Remove >date and >today tags from a paragraphs array and return only the most important parts
 * Note: rawContent is used later for mapping sorted tasks back to paragraphs
 * @author @dwertheimer
 *
 * @param {*} paragraphsArray
 * @returns
 */
export function removeDateTagsFromArray(paragraphsArray: $ReadOnlyArray<TParagraph>): Array<TParagraph> | $ReadOnlyArray<TParagraph> {
  try {
    const newPA = paragraphsArray.map((p): any => {
      const copy = copyObject(p)
      copy.content = removeDateTagsAndToday(p.content)
      copy.rawContent = removeDateTagsAndToday(p.rawContent)
      return copy
    })
    return newPA
  } catch (error) {
    logError(`timeblocking-helppers::removeDateTagsFromArray failed. Error:`, JSP(error))
  }
  return paragraphsArray
}

export const timeIsAfterWorkHours = (nowStr: string, config: TimeBlockDefaults): boolean => {
  return nowStr >= config.workDayEnd
}

/**
 * Get the day map with only the slots that are open, after now and inside of the workday
 * @author @dwertheimer
 *
 * @param {*} timeMap
 * @param {*} config
 * @returns {IntervalMap} remaining time map
 */
export function filterTimeMapToOpenSlots(timeMap: IntervalMap, config: { [key: string]: any }): IntervalMap {
  const nowStr = config.nowStrOverride ?? getTimeStringFromDate(new Date())
  const byTagMode = config.mode === 'BY_TIMEBLOCK_TAG'
  const retVal = timeMap.filter((t) => {
    // should filter to only open slots but will also include slots that are busy but have the timeblock tag - DataStore.preference('timeblockTextMustContainString')
    const isSet = typeof t.busy === 'string'
    return (
      t.start >= nowStr &&
      t.start >= config.workDayStart &&
      t.start < config.workDayEnd &&
      (!t.busy ||
        (byTagMode &&
          ((isSet && String(t.busy).includes(config.timeBlockTag)) ||
            (config.timeblockTextMustContainString?.length && isSet && String(t.busy).includes(config.timeblockTextMustContainString)))))
    )
  })
  // logDebug(`\n\nfilterTimeMapToOpenSlots: ${JSP(retVal)}`)
  return retVal
}

export function createOpenBlockObject(block: BlockData, config: { [key: string]: any }, includeLastSlotTime: boolean = true): OpenBlock | null {
  let startTime, endTime
  try {
    startTime = getDateObjFromDateTimeString(`2021-01-01 ${block.start || '00:00'}`)
    endTime = getDateObjFromDateTimeString(`2021-01-01 ${block.end || '23:59'}`)
  } catch (error) {
    console.log(error)
    return null
  }
  endTime = endTime ? (includeLastSlotTime ? addMinutes(endTime, config.intervalMins) : endTime) : null
  endTime = endTime && endTime <= endOfDay(startTime) ? endTime : endOfDay(startTime) // deal with edge case where end time is in the next day
  if (!startTime || !endTime) return null
  return {
    start: getTimeStringFromDate(startTime),
    // $FlowIgnore
    end: getTimeStringFromDate(endTime),
    // $FlowIgnore
    minsAvailable: differenceInMinutes(endTime, startTime, { roundingMethod: 'ceil' }),
    title: block.title,
  }
}

/**
 * Given an array of open timeslots from a day's IntervalMap, sends back
 * an array of the contiguous slots (assumes busy/unavailable slots have been
 * eliminated before calling this function (eg using filterTimeMapToOpenSlots()).
 * @param {IntervalMap} timeMap
 * @param {number} intervalMins
 * @returns array of OpenBlock objects
 */
export function findTimeBlocks(timeMap: IntervalMap, config: { [key: string]: any }): Array<OpenBlock> {
  const blocks: Array<OpenBlock> = []
  if (timeMap?.length) {
    let lastSlot = timeMap[0]
    let blockStart = timeMap[0]
    for (let i = 1; i < timeMap.length; i++) {
      const slot = timeMap[i]
      // console.log(`findTimeBlocks[${i}]: slot: ${slot.start} ${slot.index} ${slot.busy}}`)
      const noBreakInContinuity = slot.index === lastSlot.index + 1 && i <= timeMap.length - 1 && lastSlot.busy === slot.busy
      if (noBreakInContinuity) {
        lastSlot = slot
        continue
      } else {
        // there was a break in continuity
        // logDebug(`findTimeBlocks: lastSlot break in continuity at ${i}: ${JSP(lastSlot)}`)
        const title =
          typeof lastSlot.busy === 'string' /* this was a named timeblock */
            ? lastSlot.busy
                // .replace(config.timeblockTextMustContainString || '', '') //if you do this, then the tb will be screened out later
                .replace(/ {2,}/g, ' ')
                .trim()
            : ''
        // logDebug(`findTimeBlocks: creating block title: ${title}`)
        const block = createOpenBlockObject({ start: blockStart.start, end: lastSlot.start, title }, config, true)
        // clo(block, `findTimeBlocks: block created`)
        if (block) blocks.push(block)
        blockStart = slot
        lastSlot = slot
      }
    }
    if (timeMap.length && lastSlot === timeMap[timeMap.length - 1]) {
      // pick up the last straggler edge case
      const title =
        typeof lastSlot.busy === 'string'
          ? lastSlot.busy
              // .replace(config.timeblockTextMustContainString || '', '') //if you do this, then the tb will be screened out later
              .replace(/ {2,}/g, ' ')
              .trim()
          : ''
      const lastBlock = createOpenBlockObject({ start: blockStart.start, end: lastSlot.start, title }, config, true)
      if (lastBlock) blocks.push(lastBlock)
    }
  } else {
    // console.log(`findTimeBlocks: timeMap array was empty`)
  }
  // console.log(`findTimeBlocks: found blocks: ${JSP(blocks)}`)

  return blocks
}

export function addMinutesToTimeText(startTimeText: string, minutesToAdd: number): string {
  try {
    const startTime = getDateObjFromDateTimeString(`2021-01-01 ${startTimeText}`)
    return startTime ? getTimeStringFromDate(addMinutes(startTime, minutesToAdd)) : ''
  } catch (error) {
    console.log(error)
    return ``
  }
}

/**
 * Blocks time for the block specified and returns a new IntervalMap, new BlockList, and new TextList of time blocks
 * @param {*} tbm
 * @param {*} block
 * @param {*} config
 * @returns TimeBlocksWithMap
 */
export function blockTimeAndCreateTimeBlockText(tbm: TimeBlocksWithMap, block: BlockData, config: { [key: string]: any }): TimeBlocksWithMap {
  const timeBlockTextList = tbm.timeBlockTextList || []
  const obj = blockTimeFor(tbm.timeMap, block, config) //returns newMap, itemText
  timeBlockTextList.push(textWithoutSyncedCopyTag(obj.itemText))
  const timeMap = filterTimeMapToOpenSlots(obj.newMap, config)
  const blockList = findTimeBlocks(timeMap, config)
  return { timeMap, blockList, timeBlockTextList }
}

/**
 * Finds a named hashtag or attag in a line of text.
 *
 * @param {string} blockName - The name of the block to search for.
 * @param {string} line - The line of text to search in.
 * @param {Object.<string, any>} config - The configuration object.
 * @return {?string} - The matched tag or null if no match is found.
 */
export function namedTagExistsInLine(blockName: string, line: string): boolean {
  // Sanitize blockName to escape RegExp special characters
  const sanitizedBlockName = escapeRegExp(blockName)
  const regex = new RegExp(sanitizedBlockName, 'gi')
  const match = regex.exec(line)
  return match ? true : false
}

/**
 * Reduce an array of objects to a single object with the same keys and the values combined into arrays
 * @param {*} arr - the array of objects to reduce
 * @param {*} propToLookAt - if you only want to look at one key in each top level object
 * @returns a single object with the same keys and the values combined into arrays
 */
function reduceArrayOfObjectsToSingleObject(arr: Array<{ [key: string]: any }>, propToLookAt? = null): { [key: string]: any } {
  return arr.reduce((acc, obj) => {
    const o = propToLookAt ? obj[propToLookAt] : obj
    Object.keys(o).forEach((key) => {
      if (acc[key]) {
        acc[key] = [...acc[key], ...o[key]]
      } else {
        acc[key] = o[key]
      }
    })
    return acc
  }, {})
}

/**
 * Splits an array of items into two categories based on matching hashtags.
 * For items with matching hashtags, it groups them under the matched tag using the tag as the key
 * NOTE: an item can be matched to multiple tags
 *
 * @param {Array<Item>} arrayOfItems - The array of items to split, where each item has a 'hashtags' property.
 * @param {Tags} tags - An object where each key represents a tag to match against the items' hashtags.
 * @returns {SplitResult} An object containing a 'matched' object with properties for each tag and their corresponding matching items, and an 'unmatched' array for items without matching tags.
 */
export function splitItemsByTags(arrayOfItems: Array<ParagraphWithDuration>, tags: Tags): SplitResult {
  const matched: MatchedItems = {}
  const unmatched: Array<ParagraphWithDuration> = []

  arrayOfItems.forEach((item) => {
    let isMatched = false
    const hashtags = getTagsFromString(item.content, false).hashtags
    hashtags.forEach((hashtag) => {
      if (tags.hasOwnProperty(hashtag)) {
        if (!matched[hashtag]) {
          matched[hashtag] = []
        }
        matched[hashtag].push(item)
        isMatched = true
      }
    })

    if (!isMatched) {
      unmatched.push(item)
    }
  })

  return { matched, unmatched }
}

/**
 * Process the tasks that have a named tag in them (e.g. @work or #work)
 * @param {*} sortedTaskList
 * @param {TimeBlocksWithMap} tmb
 * @param {*} config
 * @returns {TimeBlocksWithMap}
 */
export function ORIGINALprocessByTimeBlockTag(sortedTaskList: Array<ParagraphWithDuration>, tmb: TimeBlocksWithMap, config: { [key: string]: any }): TimeBlocksWithMap {
  const { blockList, timeMap } = tmb
  let newBlockList = blockList
  let unprocessedTasks = [...sortedTaskList]
  const results = []
  let noTimeForTasks = {}
  const { matched: timeframeMatches, unmatched: regularTasks } = splitItemsByTags(sortedTaskList, config.timeframes || {})
  const namedBlocks = getNamedTimeBlocks(newBlockList ?? [])
  clo(blockList, `processByTimeBlockTag: blockList`)
  // const namedBlocksIncludingTimeframes = getTimeframeNameBlocks(namedBlocks, timeframeMatches)
  clo(namedBlocks, `processByTimeBlockTag: namedBlocks (timeblocks that are not ATB blocks)`)

  // start
  if (namedBlocks.length === 0) {
    logWarn(`processByTimeBlockTag we are in TIMEBLOCK_TAG mode but there are no named blocks`)
  } else {
    logDebug(`processByTimeBlockTag namedBlocks(${namedBlocks.length}):${namedBlocks.reduce((acc, val) => `${acc}, ${val.title || ''}`, '')}`)
  }
  namedBlocks.forEach((block) => {
    const blockTitle = (block.title || '').replace(config.timeblockTextMustContainString, '').replace(/ {2,}/g, ' ').trim()
    //$FlowIgnore
    const tasksMatchingThisNamedTimeblock = unprocessedTasks.filter((task) => (block.title ? namedTagExistsInLine(blockTitle, task.content) : false))
    logDebug(`processByTimeBlockTag tasksMatchingThisNamedTimeblock (${blockTitle}): ${JSP(tasksMatchingThisNamedTimeblock.map((p) => p.content || ''))}`)
    tasksMatchingThisNamedTimeblock.forEach((task, i) => {
      // call matchTasksToSlots for each block as if the block all that's available
      // remove from sortedTaskList
      // $FlowIgnore
      logDebug(pluginJson, `Calling matchTasksToSlots for item[${i}]: ${task.content} duration:${task.duration}`)
      // const filteredTimeMap = timeMap.filter((t) => t.start >= block.start && t.start <= block.end)
      const filteredTimeMap = timeMap.filter((t) => typeof t.busy === 'string' && t.busy.includes(blockTitle) && t.busy.includes(config.timeblockTextMustContainString))
      // Acting as if all blocks are just this named block
      const newTimeBlockWithMap = matchTasksToSlots([task], { blockList: [block], timeMap: filteredTimeMap }, config)
      unprocessedTasks = unprocessedTasks.filter((t) => t !== task) // remove the task from the list
      const foundTimeForTask = newTimeBlockWithMap.timeBlockTextList && newTimeBlockWithMap.timeBlockTextList.length > 0
      if (foundTimeForTask) {
        results.push(newTimeBlockWithMap)
      } else {
        if (!noTimeForTasks) noTimeForTasks = {}
        if (!noTimeForTasks[blockTitle]) noTimeForTasks[blockTitle] = []
        noTimeForTasks[blockTitle].push(task)
      }
    })
    newBlockList = blockList?.filter((b) => b !== block) // remove the block from the list
  })
  //stop
  // ["IGNORE_THEM","OUTPUT_FOR_INFO (but don't schedule them)", "SCHEDULE_ELSEWHERE_LAST", "SCHEDULE_ELSEWHERE_FIRST"]
  const noTimeTasks = Object.values(noTimeForTasks || {}).reduce((acc, val) => acc.concat(val), [])
  switch (config.orphanTagggedTasks) {
    case 'IGNORE_THEM':
      noTimeForTasks = null
      break
    case "OUTPUT_FOR_INFO (but don't schedule them)":
      break
    case 'SCHEDULE_ELSEWHERE_LAST':
      unprocessedTasks = [...unprocessedTasks, ...noTimeTasks]
      break
    case 'SCHEDULE_ELSEWHERE_FIRST':
      unprocessedTasks = [...noTimeTasks, ...unprocessedTasks]
      break
  }
  // process the rest of the tasks
  newBlockList = blockList?.filter((b) => !b.title || b.title === '') || [] // remove the named blocks from the list

  config.mode = 'PRIORITY_FIRST' // now that we've processed the named blocks, we can process the rest of the tasks by priority
  // $FlowIgnore
  results.push(matchTasksToSlots(unprocessedTasks, { blockList: newBlockList, timeMap }, config))

  return {
    noTimeForTasks: reduceArrayOfObjectsToSingleObject(results, 'noTimeForTasks'),
    timeMap,
    blockList: newBlockList,
    timeBlockTextList: results.reduce((acc, currentValue) => acc.concat(currentValue.timeBlockTextList), []).sort(),
  }
}

/**
 *
 * @param {Array<ParagraphWithDuration>} sortedTaskList
 * @param {TimeBlocksWithMap} tmb
 * @param {[key: string]: any} config
 * @returns {TimeBlocksWithMap}
 */
export function matchTasksToSlots(sortedTaskList: Array<ParagraphWithDuration>, tmb: TimeBlocksWithMap, config: { [key: string]: any }): TimeBlocksWithMap {
  const { timeMap } = tmb
  let newMap = filterTimeMapToOpenSlots(timeMap, config)
  let newBlockList = findTimeBlocks(newMap, config)
  const { durationMarker } = config
  let timeBlockTextList = []
  const noTimeForTasks = {}

  clof(sortedTaskList, `matchTasksToSlots: sortedTaskList`, null, true)

  // sortedTaskList.forEach((task) => {
  for (let t = 0; t < sortedTaskList.length; t++) {
    const task = sortedTaskList[t]
    const taskTitle = removeRepeats(removeDateTagsAndToday(task.content))
    const taskDuration = task.duration || getDurationFromLine(task.content, durationMarker) || config.defaultDuration // default time is 15m
    logDebug(`== matchTasksToSlots task="${t}: ${task.content}" newBlockList.length=${newBlockList?.length || ''}`)
    if (newBlockList && newBlockList.length) {
      let scheduling = true
      let schedulingCount = 0
      let scheduledMins = 0
      // $FlowIgnore - flow doesn't like .length below but it is safe
      for (let i = 0; i < newBlockList.length && scheduling; i++) {
        if (newBlockList && newBlockList[i]) {
          let block = newBlockList[i]
          const blockDuration = block.minsAvailable
          let endTime = ''
          while (scheduling && scheduledMins < taskDuration) {
            if (taskDuration <= blockDuration) {
              endTime = addMinutesToTimeText(block.start, taskDuration)
              scheduling = false
            } else {
              if (config.allowEventSplits) {
                const minsToUse = Math.min(block.minsAvailable, taskDuration - scheduledMins)
                endTime = addMinutesToTimeText(block.start, minsToUse)
                schedulingCount++
                scheduledMins += minsToUse
              } else {
                break //look for the next block that could work
              }
            }
            endTime = endTime !== '00:00' ? endTime : '23:59' //deal with edge case where end time is technically in the next day
            const blockData = {
              start: block.start,
              end: endTime,
              title: `${taskTitle}${schedulingCount ? ` (${schedulingCount})` : ''}`,
            }
            const newTimeBlockWithMap = blockTimeAndCreateTimeBlockText({ timeMap: newMap, blockList: newBlockList, timeBlockTextList }, blockData, config)
            // Re-assign newMap, newBlockList, and timeBlockTextList for next loop run
            ;({ timeMap: newMap, blockList: newBlockList, timeBlockTextList } = newTimeBlockWithMap)
            if (newBlockList && newBlockList.length) {
              block = newBlockList[0]
            } else {
              break
            }
            if (!scheduling) break
          }
        }
      }
      if (scheduling) {
        logDebug(`matchTasksToSlots task[${t}]="${taskTitle}" scheduling:${String(scheduling)}. Pushing to noTimeForTasks array`)
        if (!noTimeForTasks['_']) noTimeForTasks['_'] = []
        noTimeForTasks['_'].push(task)
      }
    } else {
      logDebug(`matchTasksToSlots task[${t}]="${taskTitle}" no blocks. saving.`)
      if (!noTimeForTasks['_']) noTimeForTasks['_'] = []
      noTimeForTasks['_'].push(task)
    }
  }
  return { timeMap: newMap, blockList: newBlockList, timeBlockTextList, noTimeForTasks }
}

/**
 * Attach links to the underlying todo note/heading if open and is not a task in today's note and if the config calls for it
 * @param { [todos] } todos
 * @param { * } config
 * @returns
 */
export function appendLinkIfNecessary(todos: Array<TParagraph>, config: AutoTimeBlockingConfig): Array<TParagraph> {
  let todosWithLinks = []
  try {
    if (todos.length && config.includeLinks !== 'OFF') {
      todosWithLinks = []
      todos.forEach((e) => {
        const isInToday = e.note?.filename === Editor.note?.filename
        if (e.type === 'open' && !isInToday) {
          // don't create URL links for tasks in the same note
          let link = ''
          if (config.includeLinks === '[[internal#links]]') {
            // link = ` ${returnNoteLink(e.note?.title ?? '', e.heading)}`
            link = ` ${createWikiLinkToLine(e)}`
          } else {
            if (config.includeLinks === 'Pretty Links') {
              // link = ` ${createPrettyOpenNoteLink(config.linkText, e.filename ?? 'unknown', true, e.heading)}`
              link = ` ${createPrettyLinkToLine(e, config.linkText)}`
            }
          }
          e.content = `${textWithoutSyncedCopyTag(e.content).replace(link, '')}${link}`
        }
        todosWithLinks.push(e)
      })
    } else {
      todosWithLinks = todos
    }
  } catch (error) {
    logError('timeblocking-helpers::appendLinkIfNecessary ${error}', JSP(error))
  }
  return todosWithLinks
}

export const addDurationToTasks = (tasks: Array<SortableParagraphSubset>, config: { [key: string]: any }): Array<ParagraphWithDuration> => {
  const dTasks = tasks.map((t) => {
    // $FlowIgnore - Flow doesn't like spreading interfaces
    const copy = { ...t, duration: 0 }
    copy.duration = getDurationFromLine(t.content, config.durationMarker) || config.defaultDuration
    return copy
  })
  return dTasks
}

export function getTimeBlockTimesForEvents(timeMap: IntervalMap, todos: Array<SortableParagraphSubset>, config: { [key: string]: any }): TimeBlocksWithMap {
  let newInfo = { timeMap, blockList: [], timeBlockTextList: [], noTimeForTasks: {} }
  // $FlowIgnore
  const availableTimes = filterTimeMapToOpenSlots(timeMap, config) // will be different for BY_TIMEBLOCK_TAG
  if (availableTimes.length === 0) {
    timeMap.forEach((m) => console.log(`getTimeBlockTimesForEvents no more times available: ${JSON.stringify(m)}`))
  }
  const blocksAvailable = findTimeBlocks(availableTimes, config)
  if (availableTimes.length && todos?.length && blocksAvailable?.length && timeMap?.length && config.mode) {
    const todosWithDurations = addDurationToTasks(todos, config)
    switch (config.mode) {
      case 'PRIORITY_FIRST': {
        // Go down priority list and split events if necessary
        const sortedTaskList = sortListBy(todosWithDurations, ['-priority', 'duration'])
        newInfo = matchTasksToSlots(sortedTaskList, { blockList: blocksAvailable, timeMap: availableTimes }, config)
        logDebug(pluginJson, `getTimeBlockTimesForEvents newInfo.noTimeForTasks=${JSP(newInfo.noTimeForTasks)}`)
        // const { timeBlockTextList, timeMap, blockList } = newInfo
        break
      }
      case 'LARGEST_FIRST': {
        // TODO: actually need to implement this
        const sortedTaskList = sortListBy(todosWithDurations, ['-duration', '-priority'])
        // const sortedBlockList = sortListBy(blocksAvailable, ['-minsAvailable']) //won't work because blocks gets recalced
        newInfo = matchTasksToSlots(sortedTaskList, { blockList: blocksAvailable, timeMap: availableTimes }, config)
        // FIXME: HERE AND RESULT IS NOT RIGHT
        break
      }
      case 'BY_TIMEBLOCK_TAG': {
        const sortedTaskList = sortListBy(todosWithDurations, ['-priority', 'filename', '-duration'])
        // clo(blocksAvailable, `getTimeBlockTimesForEvents blocksAvailable`)
        // clo(timeMap, `getTimeBlockTimesForEvents timeMap`)
        // clo(sortedTaskList, `getTimeBlockTimesForEvents sortedTaskList`)
        newInfo = processByTimeBlockTag(sortedTaskList, { blockList: blocksAvailable, timeMap: availableTimes }, config)
        break
      }
      case 'MANUAL_ORDERING': {
        const sortedTaskList = sortListBy(todosWithDurations, ['lineIndex'])
        newInfo = matchTasksToSlots(sortedTaskList, { blockList: blocksAvailable, timeMap: availableTimes }, config)
      }
    }
  } else {
    logDebug(
      `INFO: getTimeBlockTimesForEvents nothing will be entered because todos.length=${todos.length} blocksAvailable.length=${blocksAvailable.length} timeMap.length=${timeMap.length} config.mode=${config.mode}`,
    )
  }
  return newInfo
}

/**
 * (unused)
 * Remove all the timeblock added text so as to not add it to the todo list (mostly for synced lines)
 * @param {*} line
 */
// export function isAutoTimeBlockLine(line: string, config?: { [key: string]: any }): null | string {
//   // otherwise, let's scan it for the ATB signature
//   // this is probably superfluous, but it's here for completeness
//   let re = /(?:[-|\*] \d{2}:\d{2}-\d{2}:\d{2} )(.*)(( \[.*\]\(.*\))|( \[\[.*\]\]))(?: #.*)/
//   let m = re.exec(line)
//   if (m && m[1]) {
//     return m[1]
//   }
//   return null
// }

/**
 * (unused)
 * Remove items from paragraph list that are auto-time-block lines
 * @param {*} paras
 */
// export function removeTimeBlockParas(paras: Array<TParagraph>): Array<TParagraph> {
//   return paras.filter((p) => !isAutoTimeBlockLine(p.content))
// }

// pattern could be a string or a /regex/ in a string
export function getRegExOrString(input: string | RegExp): RegExp | string {
  if (input instanceof RegExp) return input
  const str = input.trim()
  if (str.startsWith('/') && str.endsWith('/')) {
    return new RegExp(str.slice(1, -1))
  } else {
    return str
  }
}

export function includeTasksWithPatterns(tasks: $ReadOnlyArray<TParagraph>, pattern: string | $ReadOnlyArray<string>): Array<TParagraph> {
  if (Array.isArray(pattern)) {
    return tasks.filter((t) => pattern.some((p) => t.content.match(getRegExOrString(p))))
  } else if (typeof pattern === 'string') {
    const pattArr = pattern.split(',')
    return tasks.filter((t) => pattArr.some((p) => t.content.match(getRegExOrString(p))))
  } else {
    // must be a regex
    return tasks.filter((t) => t.content.match(pattern))
  }
}

export function excludeTasksWithPatterns(tasks: Array<TParagraph>, pattern: string | Array<string>): Array<TParagraph> {
  if (Array.isArray(pattern)) {
    return tasks.filter((t) => !pattern.some((p) => t.content.match(getRegExOrString(p))))
  } else if (typeof pattern === 'string') {
    const pattArr = pattern.split(',')
    return tasks.filter((t) => !pattArr.some((p) => t.content.match(getRegExOrString(p))))
  } else {
    return tasks.filter((t) => !t.content.match(pattern))
  }
}

/**
 * Take in a list of paragraphs and a sortList (not exactly paragraphs) and return an ordered list of paragraphs matching the sort list
 * This was necessary because for Synced Lines, we want the Synced Lines to match the ordering of the Time Block List but by the
 * Time we get through the sorting, we have custom Paragraphs, not paragraphs we can turn into synced lines. So we need to go back and
 * Find the source paragraphs
 * One challenge is that the sorted content has been cleaned (of dates, etc.)
 * @param {Array<TParagraph>} paragraphs
 * @param {Array<any>} sortList (FIXME: should provide a Flow type for this)
 * @returns {Array<TParagraph>} paragraphs sorted in the order of sortlist
 */
export function getFullParagraphsCorrespondingToSortList(paragraphs: Array<TParagraph>, sortList: Array<SortableParagraphSubset>): Array<TParagraph> {
  if (sortList && paragraphs) {
    const sortedParagraphs =
      sortList
        .map((s) => {
          return paragraphs.find((p) => removeDateTagsAndToday(p.rawContent) === removeDateTagsAndToday(s.raw) && p.filename === s.filename)
        })
        // Filter out nulls
        ?.filter(Boolean) ?? []
    return sortedParagraphs
  }
  return []
}
