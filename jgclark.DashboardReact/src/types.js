// @flow
//-----------------------------------------------------------------------------
// Types for Dashboard code
// Last updated 8.4.2024 for v2.0.0 by @jgclark
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
  FAIconClass: string,
  sectionTitleClass: string,
  filename: string,
  actionButtons?: Array<ActionButton>,
  sectionItems: Array<TSectionItem>,
}

// an item within a section
export type TSectionItem = {
  ID: string,
  // sectionType: string, // TODO: remove me later -- see https://discord.com/channels/@me/863719873175093259/1227356943266484234
  para: TParagraphForDashboard
}

// reduced paragraph definition
export type TParagraphForDashboard = {
  filename: string,
  type: string, /* open | checklist | congrats | review -- not paragraphType */
  title: string,
  content: string,
  noteType: NoteType, /* Notes | Calendar */
  changedDate?: Date,
  prefix?: string,
  priority?: number,
  blockId?: string,
}

export type ActionButton = {
  actionFunctionName: string,
  actionFuntionPluginID: string,
  tooltip: string,
  display: string,
}
