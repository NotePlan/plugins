// @flow
//-----------------------------------------------------------------------------
// Types for Dashboard code
// Last updated 12.4.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

// This is just here for reference to keep track of what fields are used in the local reactSettings
export type TReactSettings = {
  filterPriorityItems: boolean,
  timeblockMustContainString: String,
}

export type SectionCode = 'DT' | 'DY' | 'DO' | 'W' | 'M' | 'Q' | 'Y' | 'OVERDUE' | 'TAG' | 'PROJ' | 'COUNT' // where DT = today, DY = yesterday, TAG = Tag, PROJ = Projects section

// details for a section
export type TSection = {
  ID: number,
  name: string, // 'Today', 'This Week', 'This Month' ... 'Projects', 'Done'
  sectionType: SectionCode,
  description: string,
  sectionItems: Array<TSectionItem>,
  FAIconClass: string, // CSS class to show FA Icons
  sectionTitleClass: string, // CSS class
  sectionFilename?: string, // filename for relevant calendar (or not given if a non-calendar section)
  actionButtons?: Array<TActionButton>,
  generated?: Date,
}

// an item within a section, with optional TParagraphForDashboard
export type TSectionItem = {
  ID: string,
  itemType: string, /* open | checklist | congrats | review -- not paragraphType */
  itemFilename: string, /* of the note the task originally comes from (note the Calendar it might be referenced to) */
  itemNoteTitle?: string, /* ditto */
  noteType: NoteType, /* Notes | Calendar */
  para?: TParagraphForDashboard /* where it is a paragraph-type item (not 'review') */
  // sectionType: string, // TEST: removal -- see https://discord.com/channels/@me/863719873175093259/1227356943266484234
}

// reduced paragraph definition
export type TParagraphForDashboard = {
  filename: string,
  title?: string, // not present for Calendar notes
  type: ParagraphType, // paragraph type
  prefix?: string,
  content: string,
  priority?: number,
  blockId?: string,
  timeStr?: String,
  changedDate?: Date,
}

export type TActionButton = {
  display: string,
  actionPluginID: string,
  actionFunctionName: string,
  actionFunctionParam: string, /* NB: all have to be passed as a string for simplicity */
  tooltip: string,
}
