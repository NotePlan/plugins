// @flow
//-----------------------------------------------------------------------------
// Shared constants and types for Reviews list / action modules
// by @jgclark
//-----------------------------------------------------------------------------

export const pluginID = 'jgclark.Reviews'
export const RICH_PROJECT_LIST_WIN_ID = `${pluginID}.rich-review-list`
export const windowTitle = `Projects List`
export const filenameHTMLCopy = 'projects_list.html'
export const customMarkdownWinId = `markdown-review-list`

export type DisplayToggleKey = 'displayFinished' | 'displayOnlyDue' | 'displayNextActions'
