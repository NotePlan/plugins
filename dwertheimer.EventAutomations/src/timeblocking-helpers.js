// @flow
import {
  differenceInCalendarDays,
  endOfDay,
  startOfDay,
  eachMinuteOfInterval,
  formatISO9075,
  addMinutes,
  differenceInMinutes,
} from 'date-fns'
import { getDateObjFromDateTimeString, getTimeStringFromDate, removeDateTagsAndToday } from '../../helpers/dateTime'
import { sortListBy } from '../../helpers/sorting'
import { removeDateTags, getTodaysDateHyphenated } from '../../helpers/dateTime'
import { createLink, createPrettyOpenNoteLink } from '../../helpers/general'
import { textWithoutSyncedCopyTag } from '../../helpers/syncedCopies'
import { clo, log, logError } from '../../helpers/dev'

// import { timeblockRegex1, timeblockRegex2 } from '../../helpers/markdown-regex'
import type {
  IntervalMap,
  OpenBlock,
  BlockArray,
  TimeBlocksWithMap,
  BlockData,
  TimeBlockDefaults,
  PartialCalendarItem,
} from './timeblocking-flow-types'

export type ExtendedParagraph = {
  ...TParagraph,
}

/**
 * Create a map of the time intervals for a portion of day
 * @param {*} start
 * @param {*} end
 * @param {*} valueToSet
 * @param {*} options
 * @returns Array of objects with the following properties: [{"start":"00:00","busy":false},{"start":"00:05","busy":false}...]
 */
export function createIntervalMap(
  time: { start: Date, end: Date },
  valueToSet: false | string = false,
  options: { step: number } = { step: 5 },
): IntervalMap {
  const { start, end } = time
  if (options?.step > 0) {
    // $FlowFixMe - incompatible with undefined
    const intervals = eachMinuteOfInterval({ start, end }, options)
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

export function blockTimeFor(
  timeMap: IntervalMap,
  blockdata: BlockData,
  config: { [key: string]: any },
): { newMap: IntervalMap, itemText: string } {
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

export function attachTimeblockTag(content: string, timeblockTag: string): string {
  const regEx = new RegExp(` ${timeblockTag}`, 'g') //replace the existing tag if it's there
  return `${content.replace(regEx, '')} ${timeblockTag}`
}

export function createTimeBlockLine(blockData: BlockData, config: { [key: string]: any }): string {
  if (blockData.title && blockData.title.length > 0) {
    let newContentLine = blockData.title
    if (config.removeDuration) {
      newContentLine = removeDurationParameter(newContentLine, config.durationMarker)
    }
    newContentLine = attachTimeblockTag(newContentLine, config.timeBlockTag)
    return `${config.todoChar} ${blockData.start}-${blockData.end} ${newContentLine || blockData.title || ''}`
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
export function blockOutEvents(
  events: Array<PartialCalendarItem>,
  timeMap: IntervalMap,
  config: { [key: string]: any },
): IntervalMap {
  let newTimeMap = [...timeMap]
  events.forEach((event) => {
    const start = getTimeStringFromDate(event.date)
    const end = event.endDate ? getTimeStringFromDate(event.endDate) : ''
    const obj = event.endDate
      ? blockTimeFor(newTimeMap, { start, end, title: event.title }, config)
      : { newMap: newTimeMap }
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
  new RegExp(`\\s*${durationMarker}(([0-9]+\\.?[0-9]*|\\.[0-9]+)h)*(([0-9]+\\.?[0-9]*|\\.[0-9]+)m)*`, 'mg')

export const removeDurationParameter = (text: string, durationMarker: string): string =>
  text.replace(durationRegEx(durationMarker), '').trim()

/**
 * Scans a line for a delimiter and a time signature, e.g. '2h5m or '2.5h
 * @author @dwertheimer
 *
 *  @param {*} line - input line
 * @returns { Int } number of minutes in duration (or zero)
 */
export function getDurationFromLine(line: string, durationMarker: string): number {
  const regex = durationRegEx(durationMarker)
  const match = regex.exec(line)
  let mins = 0
  const duration = match ? match[0] : 0
  if (match) {
    const hours = match[2] ? Number(match[2]) : 0
    const minutes = match[4] ? Number(match[4]) : 0
    mins = Math.ceil(hours * 60 + minutes)
  }
  return mins
}

/**
 * Remove >date and >today tags from a paragraphs array and return only the most important parts
 * @author @dwertheimer
 *
 * @param {*} paragraphsArray
 * @returns
 */
export function removeDateTagsFromArray(paragraphsArray: $ReadOnlyArray<TParagraph>): Array<TParagraph> {
  const newPA = paragraphsArray.map((p, i) => {
    return {
      ...p,
      title: p.title != null ? p.title : '',
      indents: p.indents,
      type: p.type,
      heading: p.heading ?? '',
      filename: p.filename ?? '',
      content: removeDateTagsAndToday(p.content),
      rawContent: removeDateTagsAndToday(p.rawContent),
    }
  })
  return newPA
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
  return timeMap.filter((t) => {
    // console.log(t.start >= nowStr, t.start >= config.workDayStart, t.start < config.workDayEnd, !t.busy)
    return t.start >= nowStr && t.start >= config.workDayStart && t.start < config.workDayEnd && !t.busy
  })
}

export function createOpenBlockObject(
  block: BlockData,
  config: { [key: string]: any },
  includeLastSlotTime: boolean = true,
): OpenBlock | null {
  let startTime, endTime
  try {
    startTime = getDateObjFromDateTimeString(`2021-01-01 ${block.start || '00:00'}`)
    endTime = getDateObjFromDateTimeString(`2021-01-01 ${block.end || '23:59'}`)
  } catch (error) {
    console.log(error)
    return null
  }
  endTime = endTime ? (includeLastSlotTime ? addMinutes(endTime, config.intervalMins) : endTime) : null
  if (!startTime || !endTime) return null
  return {
    start: getTimeStringFromDate(startTime),
    // $FlowIgnore
    end: getTimeStringFromDate(endTime),
    // $FlowIgnore
    minsAvailable: differenceInMinutes(endTime, startTime),
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
export function findTimeBlocks(timeMap: IntervalMap, config: { [key: string]: any }): BlockArray {
  const blocks: Array<OpenBlock> = []
  if (timeMap?.length) {
    let lastSlot = timeMap[0]
    let blockStart = timeMap[0]
    for (let i = 1; i < timeMap.length; i++) {
      const slot = timeMap[i]
      if (slot.index === lastSlot.index + 1 && i <= timeMap.length - 1) {
        lastSlot = slot
        continue
      } else {
        // there was a break in continuity
        const block = createOpenBlockObject({ start: blockStart.start, end: lastSlot.start }, config, true)
        if (block) blocks.push(block)
        blockStart = slot
        lastSlot = slot
      }
    }
    if (timeMap.length && lastSlot === timeMap[timeMap.length - 1]) {
      // pick up the last straggler edge case
      const lastBlock = createOpenBlockObject({ start: blockStart.start, end: lastSlot.start }, config, true)
      if (lastBlock) blocks.push(lastBlock)
    }
  } else {
    // console.log(`findTimeBlocks: timeMap array was empty`)
  }
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

export function findOptimalTimeForEvent(
  timeMap: IntervalMap,
  todo: { [string]: [mixed] },
  config: { [key: string]: any },
): any {
  const newMap = timeMap.map((t) => {})
  return newMap
  // TODO: FINISH HERE
}

/**
 * Blocks time for the block specified and returns a new IntervalMap, new BlockList, and new TextList of time blocks
 * @param {*} tbm
 * @param {*} block
 * @param {*} config
 * @returns TimeBlocksWithMap
 */
export function blockTimeAndCreateTimeBlockText(
  tbm: TimeBlocksWithMap,
  block: BlockData,
  config: { [key: string]: any },
): TimeBlocksWithMap {
  const timeBlockTextList = tbm.timeBlockTextList || []
  const obj = blockTimeFor(tbm.timeMap, block, config) //returns newMap, itemText
  timeBlockTextList.push(textWithoutSyncedCopyTag(obj.itemText))
  const timeMap = filterTimeMapToOpenSlots(obj.newMap, config)
  const blockList = findTimeBlocks(timeMap, config)
  return { timeMap, blockList, timeBlockTextList }
}

export function matchTasksToSlots(
  sortedTaskList: Array<{ ...TParagraph, duration: number }>,
  tmb: TimeBlocksWithMap,
  config: { [key: string]: any },
): TimeBlocksWithMap {
  const { timeMap, blockList: incomingBlockList } = tmb
  let newMap = filterTimeMapToOpenSlots(timeMap, config)
  let newBlockList = findTimeBlocks(newMap, config)
  const { durationMarker } = config
  let timeBlockTextList = []
  sortedTaskList.forEach((task) => {
    if (newBlockList && newBlockList.length) {
      const taskDuration = task.duration || getDurationFromLine(task.content, durationMarker) || config.defaultDuration // default time is 15m
      const taskTitle = removeDateTagsAndToday(task.content)
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
            const blockData = {
              start: block.start,
              end: endTime,
              title: `${taskTitle}${schedulingCount ? ` (${schedulingCount})` : ''}`,
            }
            const newTimeBlockWithMap = blockTimeAndCreateTimeBlockText(
              { timeMap: newMap, blockList: newBlockList, timeBlockTextList },
              blockData,
              config,
            )
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
    }
  })
  return { timeMap: newMap, blockList: newBlockList, timeBlockTextList }
}

/**
 * Attach links to the underlying todo note/heading if necessary
 * @param { [todos] } todos
 * @param { * } config
 * @returns
 */
export function appendLinkIfNecessary(todos: Array<TParagraph>, config: { [key: string]: any }): Array<TParagraph> {
  let todosWithLinks = todos
  try {
    if (todos.length && config.includeLinks !== 'OFF') {
      todosWithLinks = []
      todos.forEach((e) => {
        if (e.type !== 'title') {
          let link = ''
          if (config.includeLinks === '[[internal#links]]') {
            link = ` ${createLink(e.title ?? '', e.heading)}`
          } else {
            if (config.includeLinks === 'Pretty Links') {
              link = ` ${createPrettyOpenNoteLink(config.linkText, e.filename ?? 'unknown', true, e.heading)}`
            }
          }
          e.content = `${e.content}${link}`
          todosWithLinks.push(e)
        }
      })
    }
  } catch (error) {
    logError('timeblocking-helpers::appendLinkIfNecessary', JSON.stringify(error))
  }
  return todosWithLinks
}

/**
 * Eliminate duplicate paragraphs (especially for synced lines)
 * @param {Array<TParagraph>} todos: Array<TParagraph>
 * @returns Array<TParagraph> unduplicated paragraphs
 */
export const eliminateDuplicateParagraphs = (todos: Array<TParagraph>): Array<TParagraph> => {
  let revisedTodos = []
  if (todos?.length) {
    todos.forEach((e) => {
      if (revisedTodos.findIndex((t) => t.content === e.content) === -1) {
        revisedTodos.push(e)
      }
    })
  }
  return revisedTodos
}

export const addDurationToTasks = (
  tasks: Array<TParagraph>,
  config: { [key: string]: any },
): Array<{ [key: string]: any }> => {
  const dTasks = tasks.map((t) => {
    const copy = { ...t, duration: 0 }
    copy.duration = getDurationFromLine(t.content, config.durationMarker) || config.defaultDuration
    return copy
  })
  return dTasks
}

export function getTimeBlockTimesForEvents(
  timeMap: IntervalMap,
  todos: Array<TParagraph>,
  config: { [key: string]: any },
): TimeBlocksWithMap {
  let newInfo = { timeMap, blockList: [], timeBlockTextList: [] }
  // $FlowIgnore
  const availableTimes = filterTimeMapToOpenSlots(timeMap, config)
  console.log(`AvailableTimes: ${availableTimes.length}`)
  if (availableTimes.length == 0) {
    timeMap.forEach((m) => console.log(`getTimeBlockTimesForEvents no more times available: ${JSON.stringify(m)}`))
  }
  const blocksAvailable = findTimeBlocks(availableTimes, config)
  // console.log(`getTimeBlockTimesForEvents: ${JSON.stringify(blocksAvailable)}`) //FIXME: remove
  if (availableTimes.length && todos?.length && blocksAvailable?.length && timeMap?.length && config.mode) {
    const todosWithDurations = addDurationToTasks(todos, config)
    switch (config.mode) {
      case 'PRIORITY_FIRST': {
        // Go down priority list and split events if necessary
        const sortedTaskList = sortListBy(todosWithDurations, ['-priority', 'duration'])
        newInfo = matchTasksToSlots(sortedTaskList, { blockList: blocksAvailable, timeMap: availableTimes }, config)
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
    }
  } else {
    // console.log(
    //   `INFO: getTimeBlockTimesForEvents nothing will be entered because todos.length=${todos.length} blocksAvailable.length=${blocksAvailable.length} timeMap.length=${timeMap.length} config.mode=${config.mode}`,
    // )
  }
  return newInfo
}

/**
 * (unused)
 * Remove all the timeblock added text so as to not add it to the todo list (mostly for synced lines)
 * @param {*} line
 */
export function isAutoTimeBlockLine(line: string, config: { [key: string]: any }): null | string {
  // otherwise, let's scan it for the ATB signature
  // this is probably superfluous, but it's here for completeness
  let re = /(?:[-|\*] \d{2}:\d{2}-\d{2}:\d{2} )(.*)(( \[.*\]\(.*\))|( \[\[.*\]\]))(?: #.*)/
  let m = re.exec(line)
  if (m) clo(m, 'antiTimeBlockLine')
  if (m && m[1]) {
    return m[1]
  }
  return null
}

/**
 * (unused)
 * Remove items from paragraph list that are auto-time-block lines
 * @param {*} paras
 */
export function removeTimeBlockParas(paras: Array<TParagraph>): Array<TParagraph> {
  return paras.filter((p) => !Boolean(isAutoTimeBlockLine(p.content)))
}

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

export function includeTasksWithPatterns(tasks: Array<TParagraph>, pattern: string | Array<string>): Array<TParagraph> {
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
 * Find paragraphs in note which are open and tagged for today (either >today or hyphenated date)
 * @param {*} note
 * @param {*} config
 * @returns {array} of paragraphs
 */
export function findTodosInNote(note: TNote): Array<ExtendedParagraph> {
  const hyphDate = getTodaysDateHyphenated()
  const toDate = getDateObjFromDateTimeString(hyphDate)
  const isTodayItem = (text) => [`>${hyphDate}`, '>today'].filter((a) => text.indexOf(a) > -1).length > 0
  const todos: Array<ExtendedParagraph> = []
  if (note.paragraphs) {
    note.paragraphs.forEach((p) => {
      if (isTodayItem(p.content) && p.type !== 'done') {
        // clo(p, 'found today item')
        const newP = p
        newP.type = 'open' // Pretend it's a todo even if it's text or a listitem
        // $FlowIgnore
        newP.title = (p.filename ?? '').replace('.md', '').replace('.txt', '')
        // clo(newP, 'pushing today item')
        // console.log(`  --> findTodosInNote adding todo "${p.content}"`)
        todos.push(newP)
      }
    })
  }
  // console.log(`findTodosInNote found ${todos.length} todos - adding to list`)
  return todos
}
