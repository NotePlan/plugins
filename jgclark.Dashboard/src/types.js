// @flow
//-----------------------------------------------------------------------------
// Types for Dashboard code
// Last updated 2024-09-13 for v2.1.0.a10 by @jgclark
//-----------------------------------------------------------------------------
// Types for Settings

export type TDashboardLoggingConfig = {
  _logLevel: string,
  _logTimer: boolean,
}

export type TNotePlanSettings = {
  defaultFileExtension: string,
  doneDatesAvailable: boolean,
  timeblockMustContainString: string,
}

export type TDashboardSettings = {
  showPerspectives: boolean,
  activePerspectiveName: string,
  // perspectives: Array<TPerspectiveDef>,
  separateSectionForReferencedNotes: boolean,
  filterPriorityItems: boolean, // also kept in a DataStore.preference key
  dashboardTheme: string,
  hideDuplicates: boolean,
  hidePriorityMarkers: boolean,
  showParentChildMarkers: boolean,
  ignoreItemsWithTerms: string, // Note: Run through stringListOrArrayToArray() before use // was 'ignoreTagMentionsWithPhrase'
  ignoreChecklistItems: boolean,
  excludedFolders: string, // Note: Run through stringListOrArrayToArray() before use
  includedFolders: string, // Note: Run through stringListOrArrayToArray() before use
  includeFolderName: boolean, // TODO(later): ideally rename to show...
  includeScheduledDates: boolean, // TODO(later): ideally rename to show...
  includeTaskContext: boolean, // TODO(later): ideally rename to show...
  rescheduleNotMove: boolean,
  useRescheduleMarker: boolean,
  newTaskSectionHeading: string,
  newTaskSectionHeadingLevel: number,
  // autoAddTrigger: boolean, // Note: removed in v2.1
  excludeChecklistsWithTimeblocks: boolean,
  excludeTasksWithTimeblocks: boolean,
  showYesterdaySection: boolean,
  showTomorrowSection: boolean,
  showWeekSection: boolean,
  showMonthSection: boolean,
  showQuarterSection: boolean,
  showOverdueSection: boolean,
  showPrioritySection: boolean,
  showProjectSection: boolean,
  maxItemsToShowInSection: number,
  overdueSortOrder: string,
  tagsToShow: string, // Note: Run through stringListOrArrayToArray() before use
  updateTagMentionsOnTrigger: boolean, // TODO(later): now marked as deprecated
  useTodayDate: boolean,
  FFlag_ForceInitialLoadForBrowserDebugging: boolean, // to 
  lookBackDaysForOverdue: number,
  FFlag_HardRefreshButton: boolean,
  autoUpdateAfterIdleTime: number,
  moveSubItems: boolean,
  enableInteractiveProcessing: boolean,
  interactiveProcessingHighlightTask: boolean,
  enableInteractiveProcessingTransitions: boolean,
  settingsMigrated: boolean,
  // sharedSettings: any, // Note: no longer needed after settings refactor
  lastChange: string, // not really a setting, but a way to track the last change made
}

export type TDashboardPluginSettings = {
  ...TDashboardLoggingConfig,
  pluginID: string,
  dashboardSettings: string,
  perspectiveSettings: string,
}

export type TPerspectiveDef = {
  name: string,
  dashboardSettings: TDashboardSettings,
  isModified: boolean,
}

//-----------------------------------------------------------------------------
// Other types

export type TSectionCode = 'DT' | 'DY' | 'DO' | 'W' | 'M' | 'Q' | 'TAG' | 'PRIORITY' | 'OVERDUE' | 'PROJ' // where DT = today, DY = yesterday, TAG = Tag, PROJ = Projects section

export type TSectionDetails = { sectionCode: TSectionCode, sectionName: string, showSettingName: string }

// details for a section
export type TSection = {
  ID: string,
  name: string, // display name 'Today', 'This Week', 'This Month' ... 'Projects', 'Done'
  showSettingName: string, // setting for whether to hide this section
  sectionCode: TSectionCode,
  description: string,
  sectionItems: Array<TSectionItem>,
  FAIconClass?: string, // CSS class to show FA Icons
  sectionTitleClass: string, // CSS class
  sectionFilename?: string, // filename for relevant calendar (or not given if a non-calendar section)
  actionButtons?: Array<TActionButton>,
  generatedDate?: Date, // note different from lastFullRefresh on whole project
  totalCount?: number, // for when not all possible items are passed in pluginData
  doneCounts?: TDoneCount, // number of tasks and checklists completed today etc.
}

export type TItemType = 'open' | 'checklist' | 'itemCongrats' | 'project' | 'projectCongrats' | 'filterIndicator'

// an item within a section, with optional TParagraphForDashboard
export type TSectionItem = {
  ID: string,
  // sectionCode: TSectionCode, // might want this in future
  itemType: TItemType,
  para?: TParagraphForDashboard /* where it is a paragraph-type item (not 'project') */,
  project?: TProjectForDashboard,
  updated?: boolean, // used to keep deletes from confusing the dialog which is waiting for updates to the same line
  // updated will be set by the copyUpdatedSectionItemData function when content is modified
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
  // timeStr?: string, // = timeblock. TEST: commenting this out doesn't break anything I can see
  startTime?: string, // this is still definitely used to style time blocks
  endTime?: string,
  changedDate?: Date, // required for sorting items in display
  hasChild?: boolean, // whether it has child item(s)
  isAChild?: boolean, // whether it is a child item
}

// a project item within a section
export type TProjectForDashboard = {
  filename: string /* of the note the task originally comes from (not the Calendar it might be referenced to) */,
  title: string /* of the note the task originally comes from (not the Calendar it might be referenced to) */,
  reviewInterval: string, /* from the Project instance */
  percentComplete: number, /* from the Project instance */
  lastProgressComment: string, /* from the Project instance */
}

// details for a UI button
export type TActionButton = {
  display: string,
  actionPluginID: string,
  actionName: TActionType,
  actionParam: string /* NB: all have to be passed as a string for simplicity */,
  postActionRefresh?: Array<TSectionCode>,
  tooltip: string,
}

export type TActionType =
  | 'addChecklist'
  | 'addProgress'
  | 'addTask'
  | 'cancelProject'
  | 'cancelTask'
  | 'completeProject'
  | 'completeTask'
  | 'completeTaskThen'
  | 'completeChecklist'
  | 'cancelChecklist'
  | 'cyclePriorityStateUp'
  | 'cyclePriorityStateDown'
  | 'dashboardSettingsChanged'
  | 'deleteItem'
  | 'incrementallyRefreshSections'
  | 'moveAllTodayToTomorrow'
  | 'moveAllYesterdayToToday'
  | 'moveFromCalToCal'
  | 'moveToNote'
  | 'onClickDashboardItem'
  | 'perspectiveSettingsChanged'
  | 'refresh'
  | 'refreshSomeSections'
  | 'reviewFinished'
  | 'scheduleAllOverdueToday'
  | 'setNewReviewInterval'
  | 'setNextReviewDate'
  | 'showNoteInEditorFromFilename'
  | 'showNoteInEditorFromTitle'
  | 'showLineInEditorFromFilename'
  | 'showLineInEditorFromTitle'
  // | 'setSpecificDate'
  | 'startReviews'
  | '(not yet set)'
  // | 'turnOffPriorityItemsFilter'
  | 'toggleType'
  | 'togglePauseProject'
  | 'unknown'
  | 'unscheduleItem'
  | 'updateItemContent'
  | 'rescheduleItem'
  | 'windowWasResized'
  | 'windowReload'
  | 'windowResized'

export type TControlString =
  | 't'
  | '+1d'
  | '+1b'
  | '+2d'
  | '+0w'
  | '+1w'
  | '+2w'
  | '+0m'
  | '+0q'
  | 'canceltask'
  | 'movetonote'
  | 'priup'
  | 'pridown'
  | 'tog'
  | 'commpletethen'
  | 'unsched'
  | 'finish'
  | 'nr+1w'
  | 'nr+2w'
  | 'nr+1m'
  | 'nr+1q'

// for passing messages from React Window to plugin
export type MessageDataObject = {
  item?: TSectionItem, // optional because REFRESH doesn't need anything else
  // itemID?: string, // we think this isn't needed
  actionType: TActionType, // main verb (was .type)
  controlStr?: TControlString, // further detail on actionType
  updatedContent?: string, // where we have made an update in React window
  newSettings?: string, /* either reactSettings or dashboardSettings depending on actionType */
  modifierKey?: any, /* used when modifier key is pressed with an action */
  sectionCodes?: Array<TSectionCode>, // needed for processActionOnReturn to be able to refresh some but not all sections
  toFilename?: string,
  newDimensions?: { width: number, height: number },
  settings?: TAnyObject,
  filename?: string, /* only used when actionType = 'showNoteInEditorFromFilename', otherwise filename comes from the item */
  logMessage?: string,
}

/**
 * Each called function should use this standard return object
 */

export type TActionOnReturn = 'UPDATE_LINE_IN_JSON' | 'REMOVE_LINE_FROM_JSON' | 'REFRESH_SECTION_IN_JSON' | 'REFRESH_ALL_SECTIONS' | 'REFRESH_ALL_CALENDAR_SECTIONS' | 'START_DELAYED_REFRESH_TIMER'

export type TBridgeClickHandlerResult = {
  success: boolean,
  updatedParagraph?: TParagraph,
  actionsOnSuccess?: Array<TActionOnReturn>, // actions to perform after return
  sectionCodes?: Array<TSectionCode>, // needed for processActionOnReturn to be able to refresh some but not all sections
  errorMsg?: string,
}

export type TClickPosition = {
  clientX: number,
  clientY: number,
}

export type TDialogData = {
  isOpen: boolean,
  isTask?: boolean,
  clickPosition?: TClickPosition,
  details?: MessageDataObject
}

export type TReactSettings = {
  lastChange?: string /* settings will be sent to plugin for saving unless lastChange starts with underscore */,
  dialogData?: TDialogData,
  interactiveProcessing?: TInteractiveProcessing,
}

export type TPluginData = {
  dashboardSettings: any,
  perspectiveSettings: any,
  logSettings: any, /* logging settings from plugin preferences */
  notePlanSettings: any, /* for copies of some app settings */
  refreshing?: Array<TSectionCode> | boolean, /* true if all, or array of sectionCodes if some */
  sections: Array<TSection>,
  lastFullRefresh: Date, /* localized date string new Date().toLocaleString() */
  themeName: string, /* the theme name used when generating the dashboard */
  platform: string, /* the platform used when generating the dashboard */
  demoMode: boolean, /* use fake content for demo purposes */
  totalDoneCounts?: TDoneCount,
  startDelayedRefreshTimer?: boolean, /* start the delayed refresh timer hack set in post processing commands*/
}

export type TSettingItemType = 'switch' | 'input' | 'input-readonly' | 'combo' | 'number' | 'text' | 'separator' | 'heading' | 'header' | 'hidden' | 'perspectiveList' 

export type TSettingItem = {
  type: TSettingItemType,
  key?: string, // Note: annoyingly we can have setting items which are just 'separator' with no key, so this is optional
  value?: string,
  label?: string,
  checked?: boolean,
  options?: Array<string>,
  textType?: 'title' | 'description' | 'separator',
  description?: string,
  default?: any,
  refreshAllOnChange?: boolean,
  compactDisplay?: boolean,
  controlsOtherKeys?: Array<string>,
  dependsOnKey?: string,
}

export type TPluginCommandSimplified = {
  commandName: string,
  pluginID: string,
  commandArgs: $ReadOnlyArray<mixed>,
}

export type TInteractiveProcessing = {
  sectionName: string,
  currentIPIndex: number,
  totalTasks: number,
  clickPosition: TClickPosition,
  startingUp?: boolean,
} | false

export type TDoneCount = {
  completedTasks: number,
  // completedChecklists: number,
  lastUpdated: Date
}

export type TDoneTodayNotes = {
  filename: string,
  counts: TDoneCount,
}
