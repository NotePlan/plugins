// @flow
//-----------------------------------------------------------------------------
// Types for Dashboard code
// Last updated 8.4.2024 for v2.0.0 by @jgclark
//-----------------------------------------------------------------------------

// This is just here for reference to keep track of what fields are used in the local reactSettings
export type ReactSettingsType = {
  filterPriorityItems: boolean,
}

// details for a section
export type TSection = {
  ID: number,
  name: string, // 'Today', 'This Week', 'This Month' ... 'Projects', 'Done'
  sectionType: 'DT' | 'DY' | 'DO' | 'W' | 'M' | 'Q' | 'Y' | 'OVERDUE' | 'TAG' | 'PROJ' | 'COUNT', // where DT = today, DY = yesterday, TAG = Tag, PROJ = Projects section
  description: string,
  FAIconClass: string,
  sectionTitleClass: string,
  filename: string,
  sectionItems: Array<SectionItem>,
}

// an item within a section
export type SectionItem = {
  ID: string,
  sectionType: string, // TODO: how to get this?
  content: string,
  rawContent: string,
  filename?: string,
  priority?: Number, /** assumes you send numeric priority with the content, use getNumericPriorityFromPara (from helpers/sorting.js) **/
  type: ParagraphType | string,
  noteType: string, /* Notes | Calendar */
}

// reduced paragraph definition
export type ReducedParagraph = {
  filename: string,
  changedDate?: Date,
  title: string,
  content: string,
  rawContent: string,
  type: ParagraphType,
  priority: number,
}
