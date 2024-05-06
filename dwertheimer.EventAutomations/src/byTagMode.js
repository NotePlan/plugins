// @flow

// import pluginJson from '../plugin.json'
import { sortListBy } from '../../helpers/sorting'
import type { AutoTimeBlockingConfig } from './config'
import type { OpenBlock, ParagraphWithDuration, TimeBlocksWithMap } from './timeblocking-flow-types'
import { filterTimeMapToOpenSlots, findTimeBlocks, matchTasksToSlots, namedTagExistsInLine, splitItemsByTags } from './timeblocking-helpers'

import { JSP, clo, log, logError, logWarn, logDebug, clof, deepCopy } from '@helpers/dev'
/**
 * Processes the tasks that have a named tag in them (e.g., @work or #work)
 * and schedules them within the specified time blocks.
 *
 * @param {Array<ParagraphWithDuration>} sortedTaskList - The list of tasks sorted by some criteria.
 * @param {TimeBlockWithMap} tmb - The current time block with map.
 * @param {Config} config - Configuration options for processing.
 * @returns {TimeBlockWithMap} - The updated time block with map after processing.
 */
export function processByTimeBlockTag(sortedTaskList: Array<ParagraphWithDuration>, tmb: TimeBlocksWithMap, config: AutoTimeBlockingConfig): TimeBlocksWithMap {
  // Destructure the initial time block with map structure
  const { blockList, timeMap } = tmb

  // Process tasks by matching them to named time blocks based on tags
  const { newBlockList, unprocessedTasks, results, noTimeForTasks } = processTasksByTimeBlockTag(sortedTaskList, blockList || [], timeMap, config)

  // Handle the unprocessed tasks according to the specified orphanTaggedTasks strategy
  const unprocessedTasksResult = handleUnprocessedTasks(unprocessedTasks, noTimeForTasks, config, newBlockList, timeMap)

  // Combine results from named blocks processing and final processing
  const combinedResults = [...results, unprocessedTasksResult]
  const combinedNoTimeForTasks = { ...noTimeForTasks, ...unprocessedTasksResult.noTimeForTasks }

  // Prepare the final return structure
  return {
    noTimeForTasks: combinedNoTimeForTasks,
    timeMap,
    blockList: newBlockList,
    timeBlockTextList: combinedResults.reduce((acc, currentValue) => acc.concat(currentValue.timeBlockTextList), []).sort(),
  }
}

/**
 * Handles the rest of the non-named-block/unprocessed tasks according to the specified orphanTaggedTasks strategy in the config.
 *
 * @param {Array<ParagraphWithDuration>} unprocessedTasks - List of tasks that remain unprocessed.
 * @param { [key: string]: Array<ParagraphWithDuration> } noTimeForTasks - Object containing tasks for which no time could be found, keyed by block title.
 * @param {AutoTimeBlockingConfig} config - Configuration options for processing.
 * @param {Array<TimeBlock>} newBlockList - The list of new blocks after processing.
 * @param {Array<any>} timeMap - The current time map.
 * @returns {Object} - Returns the final result of matching tasks to slots, including unprocessed tasks handled as per config.
 */
export function handleUnprocessedTasks(
  unprocessedTasks: Array<ParagraphWithDuration>,
  noTimeForTasks: { [key: string]: Array<ParagraphWithDuration> },
  config: AutoTimeBlockingConfig,
  newBlockList: Array<OpenBlock>,
  timeMap: Array<any>,
): TimeBlocksWithMap {
  let finalUnprocessedTasks = unprocessedTasks || []
  const noTimeTasks = Object.values(noTimeForTasks)?.flat() || []
  clof(noTimeTasks, `handleUnprocessedTasks noTimeTasks=`, ['content', 'duration'], true)

  switch (config.orphanTagggedTasks) {
    case 'IGNORE_THEM':
      // If ignoring, do nothing further with noTimeTasks
      break
    case "OUTPUT_FOR_INFO (but don't schedule them)":
      // If outputting for info, log or store these tasks separately (not shown here)
      break
    case 'SCHEDULE_ELSEWHERE_LAST':
      finalUnprocessedTasks = [...finalUnprocessedTasks, ...noTimeTasks]
      break
    case 'SCHEDULE_ELSEWHERE_FIRST':
      finalUnprocessedTasks = [...noTimeTasks, ...finalUnprocessedTasks]
      break
  }

  config.mode = 'PRIORITY_FIRST'
  clof(finalUnprocessedTasks, `handleUnprocessedTasks finalUnprocessedTasks=`)

  return matchTasksToSlots(finalUnprocessedTasks, { blockList: newBlockList, timeMap }, config)
}

/**
 * Processes tasks by matching them to named time blocks based on tags.
 *
 * @param {Array<ParagraphWithDuration>} sortedTaskList - The list of tasks sorted by some criteria.
 * @param {Array<TimeBlock>} blockList - The current list of time blocks.
 * @param {Array<any>} timeMap - The current time map.
 * @param {Config} config - Configuration options for processing.
 * @returns {Object} - Returns an object containing the updated block list, unprocessed tasks, results, and no time for tasks.
 */
export function processTasksByTimeBlockTag(sortedTaskList: Array<ParagraphWithDuration>, blockList: Array<OpenBlock>, timeMap: Array<any>, config: AutoTimeBlockingConfig): Object {
  let newBlockList = [...(blockList || [])]
  let results = []
  let timeBlockTextList: any = []
  const noTimeForTasks = {}

  // MOVE THIS TO ITS OWN FUNCTION
  // Split tasks into matched and unmatched based on tags
  clo(config.timeframes, `processTasksByTimeBlockTag config.timeframes=`)
  clo(blockList, `processTasksByTimeBlockTag blockList=`)
  const { matched, unmatched } = splitItemsByTags(sortedTaskList, config.timeframes || {})
  let unprocessedTasks = unmatched || [] // tasks that do not match a timeframe will flow through to the next processing step
  clof(matched, `processTasksByTimeBlockTag matched=`, null, true)
  clof(unmatched, `processTasksByTimeBlockTag unmatched=`, ['content'], true)
  const keys = Object.keys(matched)
  if (keys.length) {
    logDebug(`"STARTING TIMEFRAME PROCESSING": ${keys.length} timeframes matched in tasks`)
    let newTimeMapWithBlocks = { timeBlockTextList: [], timeMap: [], blockList: [] }
    // process tasks by timeframe key
    keys.forEach((key) => {
      const tasksMatchingThisTimeframe = matched[key]
      const [start, end] = config.timeframes[key]
      let timeMapCopy = deepCopy(timeMap) // timeMap.slice()
      // process one task in the timeframe at a time
      const sortedTasksMatchingTimeframe = sortListBy(tasksMatchingThisTimeframe, ['-priority', '-duration'])
      sortedTasksMatchingTimeframe.forEach((task) => {
        logDebug(`processTasksByTimeBlockTag TIMEFRAME:"${key}": start=${start} end=${end}`)
        // blank out all slots that are not in the timeframe in question
        timeMapCopy.forEach((t, i) => {
          if (t.start < start || t.start >= end) {
            timeMapCopy[i].busy = true // remove times from consideration that are not in the timeframe in question
          }
        })
        // filter the map to only open slots and then find open timeblocks
        const openTimesForTimeframe = filterTimeMapToOpenSlots(timeMapCopy, config)
        const blocksForTimeframe = findTimeBlocks(openTimesForTimeframe, config)
        clof(blocksForTimeframe, `processTasksByTimeBlockTag blocksForTimeframe ${key} =`, ['start', 'minsAvailable'], true)
        newTimeMapWithBlocks = matchTasksToSlots([task], { blockList: blocksForTimeframe, timeMap: openTimesForTimeframe }, config)
        results.push(newTimeMapWithBlocks)

        const { timeMap: timeMapAfterTimeframePlacement, noTimeForTasks: nTftAfterTimeframePlacement, timeBlockTextList: timeBlockTextListAfterPlacement } = newTimeMapWithBlocks
        timeMapCopy = timeMapAfterTimeframePlacement
        // update the master timeMap with the changes that were made
        // timemap slots that were used will be missing in the result, so we will just mark them as busy in the master timeMap
        // function: updateMasterTimeMapWithTimeMapChanges
        openTimesForTimeframe.forEach((t, i) => {
          if (!timeMapAfterTimeframePlacement.find((nt) => nt.start === t.start)) {
            ;(timeMap.find((tm) => tm.start === t.start) ?? {}).busy = true
          }
        })
        // save no time for tasks
        if (nTftAfterTimeframePlacement) {
          Object.keys(nTftAfterTimeframePlacement).forEach((key) => {
            if (!noTimeForTasks[key]) noTimeForTasks[key] = []
            noTimeForTasks[key] = noTimeForTasks[key].concat(nTftAfterTimeframePlacement[key])
          })
        }
        // save timeblocktextlist
        if (timeBlockTextListAfterPlacement.length) {
          timeBlockTextList = timeBlockTextList.concat(timeBlockTextListAfterPlacement)
        }
        //FIXME: I am here -- need to fix the circular dependency oy vey
      })
    })
  }
  clof(timeBlockTextList, `processTasksByTimeBlockTag timeBlockTextList=`, null, false)
  clof(noTimeForTasks, `processTasksByTimeBlockTag noTimeForTasks=`, ['_', 'content'], true)
  // end split

  logDebug(`"STARTING BY TIMEBLOCK TAG PROCESSING": ${unprocessedTasks.length} unprocessedTasks`)
  clof(unprocessedTasks, `processTasksByTimeBlockTag unprocessedTasks=`, ['content'], true)
  const filteredMap = filterTimeMapToOpenSlots(timeMap, config)
  newBlockList = findTimeBlocks(filteredMap, config)
  const namedBlocks = getNamedTimeBlocks(newBlockList ?? [])
  namedBlocks.forEach((block) => {
    const blockName = block.title || ''
    logDebug(`PROCESSING BLOCK: "${blockName}" (tasks will be limited to this tag): ${unprocessedTasks.length} unprocessedTasks`)
    const {
      unprocessedTasks: updatedUnprocessedTasks,
      results: blockResults,
      noTimeForTasks: blockNoTimeForTasks,
    } = processTasksForNamedTimeBlock(block, unprocessedTasks, timeMap, config)
    clof(updatedUnprocessedTasks, `processTasksByTimeBlockTag updatedUnprocessedTasks after looking for block "${blockName}"`, null, true)
    unprocessedTasks = updatedUnprocessedTasks
    results = results.concat(blockResults)
    Object.keys(blockNoTimeForTasks).forEach((key) => {
      if (!noTimeForTasks[key]) noTimeForTasks[key] = []
      noTimeForTasks[key] = noTimeForTasks[key].concat(blockNoTimeForTasks[key])
    })

    newBlockList = newBlockList.filter((b) => b !== block)
  })

  return { newBlockList, unprocessedTasks, results, noTimeForTasks }
}

/**
 * Get the timeblocks that have names/titles (e.g. a user set them up "Work" or "Home" or whatever)
 * @param {Array<OpenBlock>} blockList
 * @param {*} config
 * @returns {Array<OpenBlock>} the filtered blockList
 */
export function getNamedTimeBlocks(blockList: Array<OpenBlock>): Array<OpenBlock> {
  return blockList.filter((b) => b.title && b.title !== '')
}

/**
 * Processes tasks for a single named time block, updating tasks and no time for tasks accordingly.
 *
 * @param {TimeBlock} block - The current time block being processed.
 * @param {Array<ParagraphWithDuration>} unprocessedTasks - List of tasks that have not been processed yet.
 * @param {Array<any>} timeMap - The current time map.
 * @param {Config} config - Configuration options for processing.
 * @returns {Object} - Returns an object containing the updated list of unprocessed tasks, results, and no time for tasks for this block.
 */
export function processTasksForNamedTimeBlock(
  block: OpenBlock,
  incomingUnprocessedTasks: Array<ParagraphWithDuration>,
  timeMap: Array<any>,
  config: AutoTimeBlockingConfig,
): Object {
  const results = []
  const noTimeForTasks = {}
  const blockTitle = (block.title || '').replace(config.timeblockTextMustContainString, '').replace(/ {2,}/g, ' ').trim()
  let unprocessedTasks = incomingUnprocessedTasks
  const tasksMatchingThisNamedTimeblock = unprocessedTasks.filter((task) => block.title && namedTagExistsInLine(blockTitle, task.content))
  tasksMatchingThisNamedTimeblock.forEach((task, i) => {
    const filteredTimeMap = timeMap.filter((t) => typeof t.busy === 'string' && t.busy.includes(blockTitle) && t.busy.includes(config.timeblockTextMustContainString))
    const newTimeBlockWithMap = matchTasksToSlots([task], { blockList: [block], timeMap: filteredTimeMap }, config)
    unprocessedTasks = unprocessedTasks.filter((t) => t !== task)
    const foundTimeForTask = newTimeBlockWithMap.timeBlockTextList && newTimeBlockWithMap.timeBlockTextList.length > 0
    if (foundTimeForTask) {
      results.push(newTimeBlockWithMap)
    } else {
      if (!noTimeForTasks[blockTitle]) noTimeForTasks[blockTitle] = []
      noTimeForTasks[blockTitle].push(task)
    }
  })
  clof(unprocessedTasks, `processTasksForNamedTimeBlock newUnprocessedTasks after looking for block "${blockTitle}"`, null, true)
  return { unprocessedTasks, results, noTimeForTasks }
}
