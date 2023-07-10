// @flow

export type IntervalMap = Array<{ start: string, busy: string | boolean, index: number }>
export type OpenBlock = { start: string, end: string, minsAvailable: number, title?: string }
export type BlockArray = Array<OpenBlock>
export type TimeBlocksWithMap = { timeMap: IntervalMap, blockList?: BlockArray, timeBlockTextList?: Array<string>, noTimeForTasks?: { [string]: Array<TParagraph> } | null }
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
  insertIntoEditor: boolean,
  passBackResults: boolean,
  createCalendarEntries: boolean,
  eventEnteredOnCalTag: string,
  deletePreviousCalendarEntries: boolean,
}
export type PartialCalendarItem = {
  title: string,
  date: Date,
  endDate: Date,
  type: string,
  availability: number,
}
