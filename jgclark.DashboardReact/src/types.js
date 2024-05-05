// @flow
//-----------------------------------------------------------------------------
// Types for Dashboard code
// Last updated 5.5.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

// This is just here for reference to keep track of what fields are used in the local reactSettings
export type TReactSettings = {
  filterPriorityItems: boolean,
  timeblockMustContainString: String,
}

export type TSectionCode = 'DT' | 'DY' | 'DO' | 'W' | 'M' | 'Q' | 'Y' | 'OVERDUE' | 'TAG' | 'PROJ' | 'COUNT' // where DT = today, DY = yesterday, TAG = Tag, PROJ = Projects section

export const allSectionCodes = ['DT', 'DY', 'DO', 'W', 'M', 'Q', 'Y',
  'OVERDUE', 'TAG', 'PROJ', 'COUNT']

// details for a section
export type TSection = {
  ID: number,
  name: string, // 'Today', 'This Week', 'This Month' ... 'Projects', 'Done'
  sectionType: TSectionCode,
  description: string,
  sectionItems: Array<TSectionItem>,
  FAIconClass: string, // CSS class to show FA Icons
  sectionTitleClass: string, // CSS class
  sectionFilename?: string, // filename for relevant calendar (or not given if a non-calendar section)
  actionButtons?: Array<TActionButton>,
  generatedDate?: Date, // note different from lastFullRefresh on whole project
  totalCount?: number, // for when not all possible items are passed in pluginData
}

export type TItemType = 'open' | 'checklist' | 'congrats' | 'project' | 'filterIndicator'

// an item within a section, with optional TParagraphForDashboard
export type TSectionItem = {
  ID: string,
  itemType: TItemType,
  para?: TParagraphForDashboard, /* where it is a paragraph-type item (not 'project') */
  project?: TProjectForDashboard
  // itemFilename: string /* of the note the task originally comes from (not the Calendar it might be referenced to) */,
  // itemNoteTitle?: string /* of the note the task originally comes from (not the Calendar it might be referenced to) */,
  // noteType: NoteType /* Notes | Calendar */,
}

// reduced paragraph definition
export type TParagraphForDashboard = {
  filename: string,
  noteType: NoteType /* Notes | Calendar */,
  title?: string, // not present for Calendar notes
  type: ParagraphType, // paragraph type
  prefix?: string,
  content: string,
  rawContent: string,
  priority: number,
  blockId?: string,
  timeStr?: string, // = timeblock
  startTime?: string,
  endTime?: string,
  changedDate?: Date, // required for sorting items in display
}

// a project item within a section
export type TProjectForDashboard = {
  // ID: string,
  // itemType: string /* open | checklist | congrats | review -- not paragraphType */,
  filename: string /* of the note the task originally comes from (not the Calendar it might be referenced to) */,
  title: string /* of the note the task originally comes from (not the Calendar it might be referenced to) */,
}

// details for a UI button
export type TActionButton = {
  display: string,
  actionPluginID: string,
  actionFunctionName: string,
  actionFunctionParam: string /* NB: all have to be passed as a string for simplicity */,
  tooltip: string,
}

export type TActionType = 'onClickDashboardItem' | 'refresh' | 'completeTask' | 'completeTaskThen' | 'cancelTask' | 'completeChecklist' | 'cancelChecklist' | 'unscheduleItem' | 'updateItemContent' | 'toggleType' | 'cyclePriorityStateUp' | 'cyclePriorityStateDown' | 'setNextReviewDate' | 'reviewFinished' | 'showNoteInEditorFromFilename' | 'showNoteInEditorFromTitle' | 'showLineInEditorFromFilename' | 'showLineInEditorFromTitle' | 'moveToNote' | 'moveFromCalToCal' | 'updateTaskDate' // 'windowResized'

export type TControlString = 't' | '+1d' | '+1b' | '+2d' | '+0w' | '+1w' | '+2w' | '+0m' | '+0q' | 'canceltask' | 'movetonote' | 'priup' | 'pridown' | 'tog' | 'ct' | 'unsched' | 'finish' | 'nr+1w' | 'nr+2w' | 'nr+1m' | 'nr+1q'

// for passing messages from React Window to plugin
export type MessageDataObject = {
  item?: TSectionItem, // optional because REFRESH doesn't need anything else
  // itemID?: string, // we think this isn't needed
  actionType: TActionType, // main verb (was .type)
  controlStr: TControlString, // further detail on actionType
  updatedContent?: string, // where we have made an update in React window
  // filename: string, // now in item
  // encodedFilename?: string, // now in item
  // content: string, // now in item
  // encodedContent?: string, // now in item
  // itemType?: string, // now in item
  // encodedUpdatedContent?: string,
}

/**
 * Each called function should use this standard return object
 */

export type TActionOnReturn = 'UPDATE_LINE_IN_JSON' | 'REMOVE_LINE_FROM_JSON' | 'REFRESH_SECTION_IN_JSON' | 'REFRESH_ALL_SECTIONS' | 'REFRESH_ALL_CALENDAR_SECTIONS'

export type TBridgeClickHandlerResult = {
  success: boolean,
  updatedParagraph?: TParagraph,
  actionsOnSuccess?: Array<TActionOnReturn>, // actions to perform after return
  sectionTypes?: Array<TSectionCode>, // needed for processActionOnReturn to be able to refresh some but not all sections
  errorMsg?: string,
}
