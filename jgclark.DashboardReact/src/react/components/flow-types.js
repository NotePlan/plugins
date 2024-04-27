// @flow

export type ItemRowType = {
  status: string,
  content: string,
  priority?: number /** assumes you send numeric priority with the content, use getNumericPriorityFromPara (from helpers/sorting.js) **/,
}
