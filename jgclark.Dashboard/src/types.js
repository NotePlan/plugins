// @flow
//-----------------------------------------------------------------------------
// Types for Dashboard code
// Last updated 2025-04-13 for v2.3.0.a1, @jgclark
//-----------------------------------------------------------------------------
// Types for Settings

// import type { TSearchOptions} from '../../jgclark.SearchExtensions/src/searchHelpers.js'
import type { TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog'
export type { TSettingItem } from '@helpers/react/DynamicDialog/DynamicDialog' // for now because it was imported in lots of places

export type TDashboardLoggingConfig = {
  _logLevel: string,
  _logTimer: boolean,
}

export type TNotePlanSettings = {
  defaultFileExtension: string,
  doneDatesAvailable: boolean,
  timeblockMustContainString: string,
}

/*
 * IMPORTANT:
 * DO NOT USE THE WORD SHOW AT THE FRONT OF ANY SETTING NAME UNLESS IT IS A SECTION
 */
export type TDashboardSettings = {
  /* "GLOBAL" SETTINGS WHICH APPLY TO ALL PERSPECTIVES */
  // Note: add all of these to the list of items in perspectiveHelpers::cleanDashboardSettingsInAPerspective() so that they do not get saved to any specific perspective
  usePerspectives: boolean,
  applyIgnoreTermsToCalendarHeadingSections: boolean,
  // searchSettings?: TSearchOptions, // an object holding a number of settings TODO: add from 2.3.0
  // DBW: TODO: Being more specific about "global" settings: save the searchSettings object to dashboardSettings

  /* FEATURE FLAGS - also globals, and automatically removed from perspectiveSettings */
  FFlag_DebugPanel?: boolean, // to show debug pane
  FFlag_ForceInitialLoadForBrowserDebugging?: boolean, // to force full load in browser
  FFlag_HardRefreshButton?: boolean,
  FFlag_ShowSearchPanel?: boolean,
  FFlag_ShowSectionTimings?: boolean,
  FFlag_ShowTestingPanel?: boolean,
  FFlag_UseTagCache?: boolean,
  FFlag_TagCacheOnlyForOpenItems?: boolean,

  /* SETTINGS THAT ARE CALCULATED AND PASSED BY THE PLUGIN */
  defaultFileExtension?: string,
  doneDatesAvailable?: boolean,
  lastChange: string, // not really a setting, but a way to track the last change made
  migratedSettingsFromOriginalDashboard?: boolean,
  pluginID?: string,
  timeblockMustContainString?: string,
  triggerLogging?: boolean,

  /* PERSPECTIVE-SPECIFIC SETTINGS */
  // autoAddTrigger: boolean, // Note: removed in v2.1
  // sharedSettings: any, // Note: no longer needed after settings refactor
  // Note: if you add a new setting, make sure to
  // - update the dashboardSettingsDefaults object in dashboardSettings.js
  // - update the getDashboardSettings() function in dashboardHelpers.js if it is type number
  // - possibly update the cleanDashboardSettingsInAPerspective() function in perspectiveHelpers.js
  // Note: if you change a setting name, make sure to update the following:
  // - the onUpdateOrInstall() function in index.js to handle most of the migration
  // - the dashboardSettingsDefaults object in dashboardSettings.js
  // - the cleanDashboardSettingsInAPerspective() function in perspectiveHelpers.js
  applyCurrentFilteringToSearch: boolean,
  autoUpdateAfterIdleTime: number,
  dashboardTheme: string,
  dontSearchFutureItems: boolean,
  displayDoneCounts: boolean,
  enableInteractiveProcessing: boolean,
  enableInteractiveProcessingTransitions: boolean,
  excludeChecklistsWithTimeblocks: boolean,
  excludedFolders: string, // Note: Run through stringListOrArrayToArray() before use
  excludeTasksWithTimeblocks: boolean,
  filterPriorityItems: boolean, // also kept in a DataStore.preference key
  hideDuplicates: boolean,
  hidePriorityMarkers: boolean,
  ignoreChecklistItems: boolean,
  ignoreItemsWithTerms: string, // Note: Run through stringListOrArrayToArray() before use
  includedFolders: string, // Note: Run through stringListOrArrayToArray() before use
  showFolderName: boolean, // Note: was includeFolderName before 2.2.0.
  showScheduledDates: boolean, // Note: was includeScheduledDates before 2.2.0.rename to show...
  showTaskContext: boolean, // Note: was includeTaskContext before 2.2.0.
  interactiveProcessingHighlightTask: boolean,
  lastModified?: string,
  lookBackDaysForOverdue: number,
  maxItemsToShowInSection: number,
  moveSubItems: boolean,
  newTaskSectionHeading: string,
  newTaskSectionHeadingLevel: number,
  overdueSortOrder: string,
  parentChildMarkersEnabled: boolean,
  rescheduleNotMove: boolean,
  separateSectionForReferencedNotes: boolean,
  settingsMigrated: boolean,
  tagsToShow: string, // Note: Run through stringListOrArrayToArray() before use
  useLiteScheduleMethod: boolean,
  useTodayDate: boolean,
  // the following turn on/off different sections: they must start with 'show' and end with 'Section'
  showLastWeekSection: boolean,
  showMonthSection: boolean,
  showOverdueSection: boolean,
  showPrioritySection: boolean,
  showProjectSection: boolean,
  showQuarterSection: boolean,
  showSavedSearchSection: boolean, // Note: the SEARCH Section doesn't need a setting. This is for future use for SAVEDSEARCH section(s).
  showTimeBlockSection: boolean,
  showTodaySection: boolean,
  showTomorrowSection: boolean,
  showWeekSection: boolean,
  showYesterdaySection: boolean,
}

export type TPerspectiveSettings = Array<TPerspectiveDef>

export type TPerspectiveDef = {
  name: string,
  dashboardSettings: Partial<TDashboardSettings>,
  isModified: boolean,
  isActive: boolean,
  lastModified?: number,
}

export type TDashboardPluginSettings = {
  ...TDashboardLoggingConfig,
  pluginID: string,
  dashboardSettings: Partial<TDashboardSettings>,
  perspectiveSettings: TPerspectiveSettings,
}

//-----------------------------------------------------------------------------
// Other types

export type TSectionCode = 'DT' | 'DY' | 'DO' | 'W' | 'LW' | 'M' | 'Q' | 'TAG' | 'PRIORITY' | 'OVERDUE' | 'PROJ' | 'TB' | 'SEARCH' | 'SAVEDSEARCH' // where DT = today, DY = yesterday, TAG = Tag, PROJ = Projects section, TB = Top Bar / TimeBlock

export type TSectionDetails = { sectionCode: TSectionCode, sectionName: string, showSettingName: string }

// details for a section
export type TSection = {
  ID: string,
  name: string, // display name 'Today', 'This Week', 'This Month' ... 'Projects', 'Done'
  showSettingName: string, // setting for whether to hide this section
  sectionCode: TSectionCode,
  isReferenced: boolean,
  description: string,
  sectionItems: Array<TSectionItem>,
  FAIconClass?: string, // CSS class to show FA Icons
  sectionTitleColorPart?: string, // `sidebarX` string to use in `var(--fg-...)` color, or if not given, will default to `var(--item-icon-color)`
  sectionFilename?: string, // filename for relevant calendar (or not given if a non-calendar section)
  actionButtons?: Array<TActionButton>,
  generatedDate?: Date, // note different from lastFullRefresh on whole project
  totalCount?: number, // for when not all possible items are passed in pluginData
  doneCounts?: TDoneCount, // number of tasks and checklists completed today etc.
  showColoredBackground?: boolean, // whether to show a colored background for the section
}

export type TItemType = 'open' | 'checklist' | 'itemCongrats' | 'project' | 'projectCongrats' | 'filterIndicator' | 'timeblock' | 'noSearchResults'

// an item within a section, with optional TParagraphForDashboard
export type TSectionItem = {
  ID: string,
  // sectionCode: TSectionCode, // might want this in future
  itemType: TItemType,
  para?: TParagraphForDashboard, // where it is a paragraph-type item (not 'project')
  project?: TProjectForDashboard,
  updated?: boolean, // used to keep deletes from confusing the dialog which is waiting for updates to the same line
  // updated will be set by the copyUpdatedSectionItemData function when content is modified
  parentID?: string, // if this is a sub-task, this holds the ID of the parent task if that is also an open item (required for displaying children properly with their parents in useSelectionSortAndFilter)
  message?: string, // for items that don't have a para or project
  settingsDialogAnchor?: string, // scroll to this element when the gear icon is clicked
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
  indentLevel: number, // indent level (i.e. children will be 1+)
  lineIndex: number, // needed for child ordering processing
  priority: number,
  blockId?: string,
  // timeStr?: string, // = used to order extended paragraphs. TEST: Can it be consolidated with .startTime?
  startTime?: string, // this is still definitely used to style time blocks
  endTime?: string,
  changedDate?: Date, // required for sorting items in display
  hasChild?: boolean, // whether it has child item(s)
  isAChild?: boolean, // whether it is a child item
  // children?: Function, // TEST: removing it as JGC can't see it being used on 2024-12-10
}

// a project item within a section
export type TProjectForDashboard = {
  filename: string /* of the note the task originally comes from (not the Calendar it might be referenced to) */,
  title: string /* of the note the task originally comes from (not the Calendar it might be referenced to) */,
  reviewInterval: string /* from the Project instance */,
  percentComplete: number /* from the Project instance */,
  lastProgressComment: string /* from the Project instance */,
  nextReviewDays: number /* from the Project instance */,
}

// details for a UI button
export type TActionButton = {
  display: string,
  actionPluginID: string,
  actionName: TActionType,
  actionParam: string /* NB: all have to be passed as a string for simplicity */,
  postActionRefresh?: Array<TSectionCode>,
  tooltip: string,
  formFields?: Array<TSettingItem>,
  submitOnEnter?: boolean,
  submitButtonText?: string,
}

export type TActionType =
  | 'addChecklist'
  | 'addProgress'
  | 'addTask'
  | 'addTaskAnywhere'
  | 'addTaskToFuture'
  | 'cancelProject'
  | 'cancelTask'
  | 'completeProject'
  | 'completeTask'
  | 'completeTaskThen'
  | 'completeChecklist'
  | 'cancelChecklist'
  | 'closeSection'
  | 'cyclePriorityStateUp'
  | 'cyclePriorityStateDown'
  | 'dashboardSettingsChanged'
  | 'deleteItem'
  | 'incrementallyRefreshSomeSections'
  | 'moveAllLastWeekThisWeek'
  | 'moveAllThisWeekNextWeek'
  | 'moveAllTodayToTomorrow'
  | 'moveAllYesterdayToToday'
  | 'moveFromCalToCal'
  | 'moveToNote'
  | 'onClickDashboardItem'
  | 'perspectiveSettingsChanged'
  | 'refreshEnabledSections'
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
  | 'startSearch'
  | '(not yet set)'
  // | 'turnOffPriorityItemsFilter'
  | 'toggleType'
  | 'togglePauseProject'
  | 'unknown'
  | 'unscheduleItem'
  | 'updateItemContent'
  | 'rescheduleItem'
  | 'addNewPerspective'
  | 'commsBridgeTest'
  | 'copyPerspective'
  | 'deletePerspective'
  | 'renamePerspective'
  | 'savePerspective'
  | 'savePerspectiveAs'
  | 'switchToPerspective'
  | 'evaluateString'
  | 'windowReload' // Used by 'Hard Refresh' button for devs
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
  newSettings?: string /* either reactSettings or dashboardSettings depending on actionType */,
  modifierKey?: any /* used when modifier key is pressed with an action */,
  sectionCodes?: Array<TSectionCode>, // needed for processActionOnReturn to be able to refresh some but not all sections
  toFilename?: string,
  newDimensions?: { width: number, height: number },
  settings?: TDashboardSettings | TPerspectiveSettings,
  perspectiveSettings?: TPerspectiveSettings,
  filename?: string /* only used when actionType = 'showNoteInEditorFromFilename', otherwise filename comes from the item */,
  logMessage?: string,
  userInputObj?: TAnyObject,
  perspectiveName?: string,
  stringToEvaluate?: string,
}

/**
 * Each called function should use this standard return object
 */

export type TActionOnReturn =
  | 'CLOSE_SECTION'
  | 'INCREMENT_DONE_COUNT'
  | 'PERSPECTIVE_CHANGED'
  | 'REMOVE_LINE_FROM_JSON'
  | 'REFRESH_SECTION_IN_JSON'
  | 'REFRESH_ALL_SECTIONS'
  | 'REFRESH_ALL_ENABLED_SECTIONS'
  | 'REFRESH_ALL_CALENDAR_SECTIONS'
  | 'START_DELAYED_REFRESH_TIMER'
  | 'UPDATE_LINE_IN_JSON'

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
  details?: MessageDataObject,
}

export type TReactSettings = {
  lastChange?: string /* settings will be sent to plugin for saving unless lastChange starts with underscore */,
  dialogData?: TDialogData,
  interactiveProcessing?: TInteractiveProcessing,
  perspectivesTableVisible?: boolean,
  settingsDialog?: {
    isOpen: boolean,
    scrollTarget?: string,
  },
}

export type TPluginData = {
  dashboardSettings: any,
  perspectiveSettings: any,
  logSettings: any /* logging settings from plugin preferences */,
  notePlanSettings: any /* for copies of some app settings */,
  refreshing?: Array<TSectionCode> | boolean /* true if all, or array of sectionCodes if some */,
  firstRun?: boolean /* true if this is the first time the data is being displayed */,
  perspectiveChanging?: boolean /* true if perspective is changing, false if not. Displays a modal spinner */,
  sections: Array<TSection>,
  lastFullRefresh: Date /* localized date string new Date().toLocaleString() */,
  themeName: string /* the theme name used when generating the dashboard */,
  platform: string /* the platform used when generating the dashboard */,
  version: string /* version of this plugin */,
  serverPush: {
    /* see below for documentation */ dashboardSettings?: boolean,
    perspectiveSettings?: boolean,
  },
  demoMode: boolean /* use fake content for demo/test purposes */,
  totalDoneCount?: number,
  startDelayedRefreshTimer?: boolean /* start the delayed refresh timer hack set in post processing commands*/,
}

/**
 * serverPush was designed especially for dashboardSettings, because dashboardSettings can change in the front-end (via user action) which then need to be noticed and sent to the back-end, or can be sent to the front end from the back-end (plugin) in which case they should just be accepted but not sent back to the plugin.
 * Initially I was doing this with the  lastChange  message, and if that message started with a "_" it meant this is coming from the plugin and should not be sent back.
 * But that seemed too non-obvious. So I added this serverPush variable which is set when the plugin wants to send updates to the front-end but does not want those updates to be sent back erroneously.
 * Specifically,
 * - the initial data send in reactMain or the clickHandlers in clickHandlers and perspectiveClickHandlers set data that is changed and then set pluginData.serverPush.dashboardData = true  and send it to the front-end using setPluginData()
 * - the change is picked up by the first useEffect in useSyncDashboardSettingsWithPlugin and then that var is set to false and stored locally in pluginData without sending it back to the plugin
 */

export type TSettingItemType = 'switch' | 'input' | 'input-readonly' | 'combo' | 'number' | 'text' | 'separator' | 'heading' | 'header' | 'hidden' | 'perspectiveList'

export type TPluginCommandSimplified = {
  commandName: string,
  pluginID: string,
  commandArgs: $ReadOnlyArray<mixed>,
}

export type TItemToProcess = {
  ...TSectionItem,
  processed?: boolean,
}

export type TInteractiveProcessing =
  | {
      sectionName: string,
      currentIPIndex: number,
      totalTasks: number,
      clickPosition: TClickPosition,
      startingUp?: boolean,
      visibleItems?: Array<TItemToProcess>,
    }
  | false

export type TDoneCount = {
  completedTasks: number,
  // completedChecklists: number,
  lastUpdated: Date,
}

export type TDoneTodayNotes = {
  filename: string,
  counts: TDoneCount,
}
