// @flow

//-----------------------------------------------------------------------------
// Statistic commands for notes and projects
// Jonathan Clark & Eduard Metzger
// v0.2.5, 11.6.2021
//-----------------------------------------------------------------------------

// TODO: IDEAS
//	- Task counts across time frames, like this week, this month, this year.
// 	- Overdue counts
//	- Upcoming counts

// import { percent } from './statsHelpers'
export { default as showNoteCount } from './showNoteCount'
export { default as showWordCount } from './showWordCount'
export { default as showTaskCountProjects } from './taskProjectStats'
export { default as showTaskCountNote } from './taskNoteStats'
export { default as showTagCount } from './tagStats'
