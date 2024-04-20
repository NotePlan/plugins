// @flow
// This is just here for reference to keep track of what fields are used in the local reactSettings
export type ReactSettingsType = {
  filterPriorityItems: boolean,
}

export type ItemRowType = {
  status: string,
  content: string,
  priority?: number /** assumes you send numeric priority with the content, use getNumericPriorityFromPara (from helpers/sorting.js) **/,
}
