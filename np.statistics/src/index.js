// @flow

//-----------------------------------------------------------------------------
// Statistic commands for notes and projects
// Jonathan Clark & Eduard Metzger
// v0.5.0, 9.10.2021
//-----------------------------------------------------------------------------

// TODO: IDEAS
//	- Task counts across time frames, like this week, this month, this year.
// 	- Overdue counts
//	- Upcoming counts

export { default as showNoteCount } from './showNoteCount'
export { default as showWordCount } from './showWordCount'
export { default as showTaskCountProjects } from './taskProjectStats'
export { default as showTaskCountNote } from './taskNoteStats'

import { showMessage } from '../../helpers/userInput'

export function periodStatsPlaceholder(): void {
  console.log("\nNote: This function has moved to the Summaries plugin.")
  showMessage(`Note: This function has moved to the Summaries plugin.`)
}
