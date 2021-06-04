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
import _showNoteCount from './showNoteCount'
import _showWordCount from './showWordCount'
import _showTaskCountProjects from './taskProjectStats'
import _showTaskCountNote from './taskNoteStats'
import _showTagCount from './tagStats'

export const showNoteCount = _showNoteCount
export const showWordCount = _showWordCount
export const showTaskCountProjects = _showTaskCountProjects
export const showTaskCountNote = _showTaskCountNote
export const showTagCount = _showTagCount
