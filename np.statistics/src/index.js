// @flow

//-----------------------------------------------------------------------------
// Statistic commands for notes and projects
// Jonathan Clark & Eduard Metzger
// v0.2.4, 1.6.2021
//-----------------------------------------------------------------------------

// TODO: IDEAS
//	- Task counts across time frames, like this week, this month, this year.
// 	- Overdue counts
//	- Upcoming counts

// import { percent } from './statsHelpers'
import showNoteCount from "./showNoteCount"
import showWordCount from "./showWordCount"
import showTaskCountProjects from "./taskProjectStats"
import showTaskCountNote from "./taskNoteStats"
import showTagCount from "./tagStats"

globalThis.showNoteCount = showNoteCount
globalThis.showWordCount = showWordCount
globalThis.showTaskCountProjects = showTaskCountProjects
globalThis.showTaskCountNote = showTaskCountNote
globalThis.showTagCount = showTagCount
