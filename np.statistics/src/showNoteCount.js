// @flow
// Last updated 2026-09-24 for v1.0.0 by @jgclark

import moment from 'moment/min/moment-with-locales'
import { isDailyNote } from '@helpers/dateTime'
import { logDebug, logError } from '@helpers/dev'
import { createPrettyRunPluginLink, percent } from '@helpers/general'
import { nowLocaleShortDateTime } from '@helpers/NPdateTime'
import { isNoteOpenInEditor } from '@helpers/NPEditor'
import { getAllTeamspaceIDsAndTitles } from '@helpers/NPTeamspace'

const PLUGIN_ID = 'np.statistics'
const DEFAULT_NOTE_STATS_FILENAME = 'Note Stats.md'

//-----------------------------------------------------------------------------

/**
 * Filepath for the /note stats results note.
 * Uses the plugin setting when it is set, otherwise `Note Stats.md`.
 * @returns {Promise<string>}
 */
async function getNoteStatsFilename(): Promise<string> {
  try {
    const config: any = await DataStore.loadJSON(`../${PLUGIN_ID}/settings.json`)
    const filename = config?.noteStatsFilename
    if (typeof filename === 'string' && filename.trim() !== '') {
      return filename.trim()
    }
  } catch (err) {
    logDebug('showNoteCount', `Settings not available, using default filename (${String(err)})`)
  }
  return DEFAULT_NOTE_STATS_FILENAME
}

/**
 * Years from the earliest daily note until today, to 1 decimal place.
 * Returns null when there is no daily note to measure from.
 * @param {$ReadOnlyArray<TNote>} calendarNotes
 * @returns {?number}
 */
function yearsSinceFirstDailyNote(calendarNotes: $ReadOnlyArray<TNote>): ?number {
  const dailyNotes = calendarNotes.filter((n) => isDailyNote(n))
  if (dailyNotes.length === 0) {
    return null
  }
  const sorted = dailyNotes.slice().sort((a, b) => Number(a.createdDate) - Number(b.createdDate))
  const first = sorted[0]
  if (first == null || first.createdDate == null) {
    return null
  }
  const days = moment().diff(moment(first.createdDate), 'days')
  return Math.round(days / 36.5) / 10.0
}

/**
 * Created/updated lines. The percentage base is `notes` (for Private, that includes Templates, as in v0.7.0).
 * @param {$ReadOnlyArray<TNote>} notes
 * @returns {Array<string>}
 */
function activityLines(notes: $ReadOnlyArray<TNote>): Array<string> {
  const createdLastMonth = notes.filter((n) => Calendar.unitsAgoFromNow(n.createdDate, 'month') < 1).length
  const createdLastQuarter = notes.filter((n) => Calendar.unitsAgoFromNow(n.createdDate, 'month') < 3).length
  const updatedLastMonth = notes.filter((n) => Calendar.unitsAgoFromNow(n.changedDate, 'month') < 1).length
  const updatedLastQuarter = notes.filter((n) => Calendar.unitsAgoFromNow(n.changedDate, 'month') < 3).length
  return [
    `  - created in last month: ${percent(createdLastMonth, notes.length)}`,
    `  - created in last quarter: ${percent(createdLastQuarter, notes.length)}`,
    `  - updated in last month: ${percent(updatedLastMonth, notes.length)}`,
    `  - updated in last quarter: ${percent(updatedLastQuarter, notes.length)}`,
  ]
}

/**
 * Create or update the results note, then open it if it is not already open.
 * @param {string} outputFilename
 * @param {Array<string>} outputLines
 * @returns {Promise<void>}
 */
async function writeStatsNote(outputFilename: string, outputLines: Array<string>): Promise<void> {
  const content = outputLines.join('\n')
  let noteToUse: ?TNote
  if (!isNoteOpenInEditor(outputFilename)) {
    noteToUse = await Editor.openNoteByFilename(outputFilename, false, 0, 0, true, true, content)
  } else {
    noteToUse = DataStore.projectNoteByFilename(outputFilename)
  }
  if (!noteToUse) {
    throw new Error(`Couldn't find note '${outputFilename}' to write to`)
  }
  noteToUse.content = content
  const noteFMAttributes = [
    { key: 'title', value: 'Note Stats' },
    { key: 'updated', value: nowLocaleShortDateTime() },
    { key: 'icon', value: 'chart-column' },
    { key: 'icon-color', value: 'blue-500' },
  ]
  noteToUse.updateFrontmatterAttributes(noteFMAttributes)
}

//-----------------------------------------------------------------------------
// Show note counts
export async function showNoteCount(): Promise<void> {
  try {
    const outputFilename = await getNoteStatsFilename()
    logDebug('showNoteCount', `Writing note stats to '${outputFilename}'`)

    // do counts
    const allProjectNotes = DataStore.projectNotes.filter((n) => n.filename !== outputFilename) // ignore the results note itself
    const allCalendarNotes = DataStore.calendarNotes // all calendar durations

    // ignore Trash and Archive
    const privateProjectBase = allProjectNotes.filter((n) => !n.isTeamspaceNote && !n.filename.startsWith('@Trash') && !n.filename.startsWith('@Archive'))
    const privateTemplates = allProjectNotes.filter((n) => !n.isTeamspaceNote && n.filename.startsWith('@Templates'))
    const privateArchived = allProjectNotes.filter((n) => !n.isTeamspaceNote && n.filename.startsWith('@Archive'))
    const privateCalendar = allCalendarNotes.filter((n) => !n.isTeamspaceNote)
    const privateRegularCount = privateProjectBase.length - privateTemplates.length
    const privateTotal = privateCalendar.length + privateProjectBase.length
    const yearsAgo = yearsSinceFirstDailyNote(privateCalendar)
    const privateCalendarLine = yearsAgo == null
      ? `- Calendar notes: ${privateCalendar.length.toLocaleString()}`
      : `- Calendar notes: ${privateCalendar.length.toLocaleString()} (starting ${yearsAgo} years ago)`

    const display = [
      '## Private Notes',
      '',
      `- Total: ${privateTotal.toLocaleString()}`,
      privateCalendarLine,
      `- Regular notes: ${privateRegularCount.toLocaleString()}`,
      ...activityLines(privateProjectBase),
      `- Templates: ${privateTemplates.length.toLocaleString()}`,
      `- Archived notes: ${privateArchived.length.toLocaleString()}`,
    ]

    let teamspaceCalendarTotal = 0
    let teamspaceRegularTotal = 0
    const teamspaces = getAllTeamspaceIDsAndTitles()
    for (const teamspace of teamspaces) {
      const projectBase = allProjectNotes.filter((n) => n.teamspaceID === teamspace.id && !n.filename.startsWith('@Trash') && !n.filename.startsWith('@Archive'))
      const templatesCount = projectBase.filter((n) => n.filename.startsWith('@Templates')).length
      const calendarNotes = allCalendarNotes.filter((n) => n.teamspaceID === teamspace.id)
      const regularCount = projectBase.length - templatesCount
      teamspaceCalendarTotal += calendarNotes.length
      teamspaceRegularTotal += regularCount

      display.push('')
      display.push(`## Teamspace: '${teamspace.title}'`)
      display.push('')
      display.push(`- Calendar notes: ${calendarNotes.length.toLocaleString()}`)
      display.push(`- Regular notes: ${regularCount.toLocaleString()}`)
      display.push(...activityLines(projectBase))
    }

    const combinedCalendar = privateCalendar.length + teamspaceCalendarTotal
    const combinedRegular = privateRegularCount + teamspaceRegularTotal
    const combinedTotal = combinedCalendar + combinedRegular
    display.push('')
    display.push('## Combined')
    display.push('')
    display.push(`- Total: ${combinedTotal.toLocaleString()}`)
    display.push(`- Calendar notes: ${combinedCalendar.toLocaleString()}`)
    display.push(`- Regular notes: ${combinedRegular.toLocaleString()}`)

    const xCallbackRefreshButton = createPrettyRunPluginLink('🔄 Click to refresh', PLUGIN_ID, 'note stats', [])
    const summaryLine = `Updated at ${nowLocaleShortDateTime()}. ${xCallbackRefreshButton}`
    const outputLines = ['# Note Stats', '', summaryLine, '', ...display]
    console.log(`# Note Stats:\n${outputLines.join('\n')}`)

    await writeStatsNote(outputFilename, outputLines)
  } catch (error) {
    logError('showNoteCount', error)
  }
}
