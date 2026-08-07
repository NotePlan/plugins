// @flow

import type { SortableParagraphSubset } from '@helpers/sorting'

export type IntervalMap = Array<{ start: string, busy: string | boolean, index: number }>
export type OpenBlock = { start: string, end: string, minsAvailable: number, title?: string }
export type BlockArray = Array<OpenBlock>
// Note: `blockList` is required. Every producer (matchTasksToSlots, processByTimeBlockTag,
// blockTimeAndCreateTimeBlockText, getTimeBlockTimesForEvents) always sets it — including on the
// early-return path, where it is `[]`. Declaring it optional meant consumers such as
// NPTimeblocking's `eventsToTimeblock.blockList.length` were reading a possibly-undefined value.
export type TimeBlocksWithMap = { timeMap: IntervalMap, blockList: BlockArray, timeBlockTextList?: Array<string>, noTimeForTasks?: { [string]: Array<TParagraph> } | null }
export type TimeBlockTextList = Array<string>
export type BlockTimeOptions = { mode: string }
export type BlockData = { start: string, end: string, title?: string }
export type TimeBlockDefaults = {
  todoChar: string,
  timeBlockTag: string,
  timeBlockHeading: string,
  workDayStart: string,
  workDayEnd: string,
  durationMarker: string,
  intervalMins: number,
  removeDuration: boolean,
  defaultDuration: number,
  nowStrOverride?: string /* for testing */,
  mode: string,
  allowEventSplits: boolean,
  passBackResults: boolean,
}
export type PartialCalendarItem = {
  title: string,
  date: Date,
  endDate: Date,
  type: string,
  availability: number,
}

// Note: built by addDurationToTasks() (timeblocking-helpers.js) by spreading a
// SortableParagraphSubset and adding `duration` -- NOT from a TParagraph. It previously declared
// `extends TParagraph`, which was untrue: the objects have no `constructor` and none of
// Paragraph's methods. That lie was invisible only because the spread was suppressed with
// a `cannot-spread-interface` suppression, which degraded the result to `any`.
export type ParagraphWithDuration = {
  ...SortableParagraphSubset,
  duration: number,
  ...
}

export type Tags = {
  [key: string]: Array<string>,
}

export type MatchedItems = {
  [key: string]: Array<ParagraphWithDuration>,
}

export type SplitResult = {
  matched: MatchedItems,
  unmatched: Array<ParagraphWithDuration>,
}
