// @flow
//-----------------------------------------------------------------------------
// Cancel incomplete tasks and checklists in calendar notes for a given past year
// Jonathan Clark
// Last updated 2026-03-26 for v1.19.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { JSP, clo, logDebug, logError, logInfo } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getCalendarNoteTimeframe, getDateStringFromCalendarFilename } from '@helpers/dateTime'
import { pastCalendarNotes } from '@helpers/note'
import { getTeamspaceTitleFromID } from '@helpers/NPTeamspace'
import { parseTeamspaceFilename } from '@helpers/teamspace'
import { getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

type IncompleteCounts = {
  tasks: number,
  checklists: number,
}

type Timeframe = 'day' | 'week' | 'month' | 'quarter' | 'year'

type TimeframeKey = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Unknown'

type TimeframeCounts = {
  [key: TimeframeKey]: {
    notes: number,
    tasks: number,
    checklists: number,
  },
}

type TeamspaceKey = string // 'local' or teamspaceID

type TeamspaceStats = {
  teamspaceID: string,
  teamspaceTitle: string,
  timeframeCounts: TimeframeCounts,
  totalTasks: number,
  totalChecklists: number,
  totalNotes: number,
}

type TeamspaceStatsMap = {
  [key: TeamspaceKey]: TeamspaceStats,
}

const TIMEFRAME_LABELS: { [Timeframe | 'unknown']: TimeframeKey } = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  quarter: 'Quarterly',
  year: 'Yearly',
  unknown: 'Unknown',
}

/**
 * Count incomplete tasks and checklists in a note.
 * Incomplete = open/scheduled tasks or checklists.
 * @author @jgclark
 * @param {TNote} note
 * @returns {IncompleteCounts}
 */
export function countIncompleteTasksAndChecklistsInNote(note: TNote): IncompleteCounts {
  try {
    const paras = note.paragraphs ?? []
    let tasks = 0
    let checklists = 0

    for (const p of paras) {
      if (!p) continue
      if (p.type === 'open' || p.type === 'scheduled') {
        tasks += 1
      } else if (p.type === 'checklist' || p.type === 'checklistScheduled') {
        checklists += 1
      }
    }

    return { tasks, checklists }
  } catch (error) {
    logError('countIncompleteTasksAndChecklistsInNote', JSP(error))
    return { tasks: 0, checklists: 0 }
  }
}

/**
 * Cancel incomplete tasks and checklists in a note.
 * - open/scheduled -> cancelled
 * - checklist/checklistScheduled -> checklistCancelled
 * Returns the number of paragraphs changed.
 * @author @jgclark
 * @param {TNote} note
 * @returns {number} count of changed paragraphs
 */
export function cancelIncompleteTasksAndChecklistsInNote(note: TNote): number {
  try {
    const paras = note.paragraphs ?? []
    let changed = 0

    for (let i = 0; i < paras.length; i += 1) {
      const p = paras[i]
      if (!p) continue
      const origType = p.type
      if (origType === 'open' || origType === 'scheduled') {
        p.type = 'cancelled'
        note.updateParagraph(p)
        changed += 1
        // logDebug('cancelIncompleteTasksAndChecklistsInNote', `Cancelled task in '${displayTitle(note)}': ${p.content}`)
      } else if (origType === 'checklist' || origType === 'checklistScheduled') {
        p.type = 'checklistCancelled'
        note.updateParagraph(p)
        changed += 1
        // logDebug('cancelIncompleteTasksAndChecklistsInNote', `Cancelled checklist in '${displayTitle(note)}': ${p.content}`)
      }
    }

    return changed
  } catch (error) {
    logError('cancelIncompleteTasksAndChecklistsInNote', JSP(error))
    return 0
  }
}

/**
 * Get or create TeamspaceStats entry for a given teamspace key.
 * @param {TeamspaceStatsMap} statsMap
 * @param {string} teamspaceKey
 * @param {string} teamspaceTitle
 * @returns {TeamspaceStats}
 */
function getOrCreateTeamspaceStats(statsMap: TeamspaceStatsMap, teamspaceKey: string, teamspaceTitle: string): TeamspaceStats {
  if (!statsMap[teamspaceKey]) {
    const timeframeCounts: TimeframeCounts = {
      Daily: { notes: 0, tasks: 0, checklists: 0 },
      Weekly: { notes: 0, tasks: 0, checklists: 0 },
      Monthly: { notes: 0, tasks: 0, checklists: 0 },
      Quarterly: { notes: 0, tasks: 0, checklists: 0 },
      Yearly: { notes: 0, tasks: 0, checklists: 0 },
      Unknown: { notes: 0, tasks: 0, checklists: 0 },
    }
    statsMap[teamspaceKey] = {
      teamspaceID: teamspaceKey,
      teamspaceTitle,
      timeframeCounts,
      totalTasks: 0,
      totalChecklists: 0,
      totalNotes: 0,
    }
  }
  return statsMap[teamspaceKey]
}

/**
 * Main command: Cancel incomplete tasks and checklists in calendar notes for a given past year.
 * @author @jgclark
 * @param {string} yearIn - The year to process (as YYYY string), or empty to prompt user for year.
 */
export async function cancelIncompleteTasksInPastYear(yearIn: string = ''): Promise<void> {
  try {
    // If yearIn is provided (as string or number), use it, otherwise ask user for year
    let yearStr = yearIn
    if (typeof yearIn === 'string') {
      yearStr = yearIn
    } else if (typeof yearIn === 'number') {
      yearStr = String(yearIn)
    }
    if (!yearStr) {
      yearStr = await getInputTrimmed('Which calendar year of past notes do you want to process? (e.g. 2024)', 'OK', 'Cancel incomplete tasks in a past year')
      if (yearStr === false) {
        logInfo('cancelIncompleteTasksInPastYear', 'User cancelled at year prompt')
        return
      }
    }
    const year = Number(yearStr)
    if (Number.isNaN(year) || year < 1000 || year > 9999) {
      await showMessage(`Sorry: '${yearStr}' is not a valid 4-digit year.`, 'OK', 'Cancel incomplete tasks in a past year')
      return
    }

    logInfo(pluginJson, `cancelIncompleteTasksInPastYear: starting for year ${yearStr}`)

    // Find past calendar notes
    const allPastCalendarNotes = pastCalendarNotes()
    if (allPastCalendarNotes.length === 0) {
      await showMessage('There are no past calendar notes to process.', 'OK', 'Cancel incomplete tasks in a past year')
      return
    }

    // Filter notes by year from filename
    const notesToProcess: Array<TNote> = []
    const targetYearStr = yearStr

    CommandBar.showLoading(true, `Scanning calendar notes for year ${targetYearStr} ...`, 0)
    await CommandBar.onAsyncThread()

    const totalPast = allPastCalendarNotes.length
    for (let i = 0; i < totalPast; i += 1) {
      const n = allPastCalendarNotes[i]
      const dateStr = getDateStringFromCalendarFilename(n.filename)
      if (!dateStr || dateStr === '(invalid date)') {
        continue
      }
      const thisYear = dateStr.slice(0, 4)
      if (thisYear === targetYearStr) {
        notesToProcess.push(n)
      }
      if (i % 50 === 0) {
        const progress = i / totalPast
        CommandBar.showLoading(true, `Scanning calendar notes for year ${targetYearStr} ...`, progress)
      }
    }

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    if (notesToProcess.length === 0) {
      await showMessage(`No past calendar notes were found for the year ${targetYearStr}.`, 'OK', 'Cancel incomplete tasks in a past year')
      return
    }

    // Aggregate counts per Teamspace and timeframe
    const statsMap: TeamspaceStatsMap = {}
    let grandTotalTasks = 0
    let grandTotalChecklists = 0
    let grandTotalNotes = 0

    CommandBar.showLoading(true, `Counting incomplete items for year ${targetYearStr} ...`, 0)
    logInfo(pluginJson, `Listing incomplete items for year ${targetYearStr} ...`)
    await CommandBar.onAsyncThread()

    const numNotes = notesToProcess.length
    for (let i = 0; i < numNotes; i += 1) {
      const note = notesToProcess[i]
      const counts = countIncompleteTasksAndChecklistsInNote(note)
      if (counts.tasks === 0 && counts.checklists === 0) {
        continue
      }

      const timeframe: Timeframe | false = getCalendarNoteTimeframe(note)
      const tfLabel: TimeframeKey = timeframe ? TIMEFRAME_LABELS[timeframe] : TIMEFRAME_LABELS.unknown

      const { teamspaceID, isTeamspace } = parseTeamspaceFilename(note.filename)
      const teamspaceKey: string = isTeamspace && teamspaceID ? teamspaceID : 'local'
      const teamspaceTitle: string = isTeamspace && teamspaceID ? getTeamspaceTitleFromID(teamspaceID) : 'Local notes'

      const tsStats = getOrCreateTeamspaceStats(statsMap, teamspaceKey, teamspaceTitle)

      const tfCounts = tsStats.timeframeCounts[tfLabel]
      tfCounts.notes += 1
      tfCounts.tasks += counts.tasks
      tfCounts.checklists += counts.checklists

      tsStats.totalNotes += 1
      tsStats.totalTasks += counts.tasks
      tsStats.totalChecklists += counts.checklists

      grandTotalNotes += 1
      grandTotalTasks += counts.tasks
      grandTotalChecklists += counts.checklists

      // Log each matching paragraph for traceability
      const titleForLog = displayTitle(note)
      for (const p of note.paragraphs ?? []) {
        if (!p) continue
        if (p.type === 'open' || p.type === 'scheduled' || p.type === 'checklist' || p.type === 'checklistScheduled') {
          console.log(`- ${note.filename} line ${String(p.lineIndex)} [${p.type}] {${p.content}}`)
        }
      }

      if (i % 50 === 0) {
        const progress = i / numNotes
        CommandBar.showLoading(true, `Counting incomplete items for year ${targetYearStr} ...`, progress)
      }
    }

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    if (grandTotalTasks === 0 && grandTotalChecklists === 0) {
      logInfo('cancelIncompleteTasksInPastYear', `🎉 No incomplete tasks or checklists were found in past calendar notes for ${targetYearStr}.`)
      await showMessage(`No incomplete tasks or checklists were found in past calendar notes for ${targetYearStr}.`, 'OK', 'Cancel incomplete tasks in a past year')
      return
    }

    // Build confirmation message
    const lines = []
    lines.push(`In calendar notes for ${targetYearStr}, I found:`)
    lines.push('')
    lines.push(`Total notes with incomplete items: ${grandTotalNotes.toLocaleString()}`)
    lines.push(`Total incomplete tasks: ${grandTotalTasks.toLocaleString()}`)
    lines.push(`Total incomplete checklists: ${grandTotalChecklists.toLocaleString()}`)
    lines.push('')

    const teamspaceKeys = Object.keys(statsMap)
    for (const key of teamspaceKeys) {
      const ts = statsMap[key]
      lines.push(`Teamspace: ${ts.teamspaceTitle}`)
      const tfLabels: Array<TimeframeKey> = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Unknown']
      for (const tfLabel of tfLabels) {
        const tfCounts = ts.timeframeCounts[tfLabel]
        if (tfCounts.notes === 0) {
          continue
        }
        lines.push(
          `  ${tfLabel}: ${tfCounts.notes.toLocaleString()} notes, ${tfCounts.tasks.toLocaleString()} tasks, ${tfCounts.checklists.toLocaleString()} checklists`,
        )
      }
      lines.push('')
    }
    logInfo('cancelIncompleteTasksInPastYear', lines.join('\n'))

    lines.push(
      'If you proceed, ALL open or scheduled tasks will be set to cancelled, and ALL open or scheduled checklists will be set to cancelled checklists.',
    )
    lines.push('This is a bulk change and is very difficult to undo quickly. You may wish to make a backup first.')

    const confirmMessage = lines.join('\n')

    const res = await showMessageYesNo(
      `${confirmMessage}\n\nDo you want to proceed and cancel these incomplete items?`,
      ['Yes, cancel them', 'No'],
      `Cancel incomplete tasks in ${targetYearStr}`,
    )
    if (res !== 'Yes, cancel them') {
      logInfo('cancelIncompleteTasksInPastYear', 'User cancelled after seeing counts')
      return
    }

    // Apply cancellations
    CommandBar.showLoading(true, `Cancelling incomplete items for ${targetYearStr} ...`, 0)
    await CommandBar.onAsyncThread()

    let changedTotal = 0
    const numNotesToProcess = notesToProcess.length
    for (let i = 0; i < numNotesToProcess; i += 1) {
      const note = notesToProcess[i]
      const changedForNote = cancelIncompleteTasksAndChecklistsInNote(note)
      changedTotal += changedForNote
      if (i % 50 === 0) {
        const progress = i / numNotesToProcess
        CommandBar.showLoading(true, `Cancelling incomplete items for ${targetYearStr} ...`, progress)
      }
    }

    await CommandBar.onMainThread()
    CommandBar.showLoading(false)

    const completedMsg = `Cancelled ${changedTotal.toLocaleString()} incomplete tasks/checklists in ${grandTotalNotes.toLocaleString()} calendar notes from ${targetYearStr}.`
    await showMessage(completedMsg, 'OK', 'Cancel incomplete tasks in a past year')
    logInfo('cancelIncompleteTasksInPastYear', completedMsg)
  } catch (error) {
    logError('cancelIncompleteTasksInPastYear', JSP(error))
    await showMessage('There was an error while cancelling incomplete tasks. See the Plugin Console for details.', 'OK', 'Cancel incomplete tasks in a past year')
  }
}

