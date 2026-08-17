// @flow
//-----------------------------------------------------------------------------
// Weekly per-folder area/project progress stats written to CSV in @Reviews
// Writes the weekly progress of projects and areas to a CSV in @Reviews, with a structure:
// - First table: notes-per-week (distinct notes with at least one completed task)
// - Second table: tasks-per-week (total completed tasks)
// Columns: successive week labels (e.g. 2026-W06)
// Rows: folder names in alphabetical order
//
// Last updated 2026-08-17 for v2.0.7 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getReviewSettings, type ReviewConfig } from './reviewHelpers'
import {
  RE_DONE_DATE_OPT_TIME,
  RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE,
  convertISOToYYYYMMDD,
  YYYYMMDDDateStringFromDate,
} from '@helpers/dateTime'
import { getNPWeekData, pad } from '@helpers/NPdateTime'
import { clo, JSP, logDebug, logError, logInfo, logTimer, timer } from '@helpers/dev'
import { getRegularNotesFromFilteredFolders, getFolderFromFilename } from '@helpers/folders'
import { isDone } from '@helpers/utils'
import { showHTMLV2 } from '@helpers/HTMLView'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------
// Constants
//-----------------------------------------------------------------------------

const DEFAULT_NUM_WEEKS: number = 26
const PROJECT_FOLDER_MATCHERS: Array<string> = ['area', 'project']
const PROGRESS_PER_FOLDER_FILENAME: string = 'progress-per-folder.csv'
const TASK_COMPLETION_PER_FOLDER_FILENAME: string = 'task-completion-per-folder.csv'
const PLUGIN_ID: string = 'jgclark.Reviews'

//-----------------------------------------------------------------------------
// Types

type WeekInfo = {
  label: string, // e.g. 2026-W06
  startDate: Date,
  endDate: Date,
}

type TWeeklyHeatmapChart = {
  data: Array<{ x: string, y: string, heat: number }>,
  chartTitle: string,
  containerId: string,
}

//-----------------------------------------------------------------------------
// Helpers

/**
 * Compute the last N NotePlan weeks (including the current week) using getNPWeekData().
 * Returns an array ordered from oldest to newest, each with a week label and JS start/end dates.
 * @author @cursor
 *
 * @param {number} numWeeks
 * @returns {Array<WeekInfo>}
 */
export function getLastNWeeks(numWeeks: number = DEFAULT_NUM_WEEKS): Array<WeekInfo> {
  try {
    const weeks: Array<WeekInfo> = []
    const today = new Date()

    for (let i = numWeeks - 1; i >= 0; i--) {
      const weekData = getNPWeekData(today, -i, 'week')
      if (!weekData) {
        logError(pluginJson, `getLastNWeeks: getNPWeekData() returned null for offset ${String(-i)}`)
        continue
      }
      const label = `${String(weekData.weekYear)}-W${pad(weekData.weekNumber)}`
      weeks.push({
        label,
        startDate: weekData.startDate,
        endDate: weekData.endDate,
      })
    }

    logDebug(pluginJson, `getLastNWeeks: generated ${String(weeks.length)} weeks`)
    return weeks
  } catch (error) {
    logError(pluginJson, `getLastNWeeks: ${error.message}`)
    return []
  }
}

/**
 * Does a folder name count as an Area/Project folder? (case-insensitive substring match)
 * @param {string} folderName
 * @returns {boolean}
 */
function isAreaOrProjectFolder(folderName: string): boolean {
  const lc = folderName.toLowerCase()
  return PROJECT_FOLDER_MATCHERS.some((matcher) => lc.includes(matcher))
}

/**
 * Determine which week (if any) a given ISO date string (YYYY-MM-DD) falls into.
 * Returns the week label or empty string if not in range.
 * @param {string} isoDate
 * @param {Array<WeekInfo>} weeks
 * @returns {string}
 */
function getWeekLabelForISODate(isoDate: string, weeks: Array<WeekInfo>): string {
  if (!isoDate || weeks.length === 0) return ''
  const yyyymmdd = convertISOToYYYYMMDD(isoDate)
  for (const w of weeks) {
    const startStr = YYYYMMDDDateStringFromDate(w.startDate)
    const endStr = YYYYMMDDDateStringFromDate(w.endDate)
    if (yyyymmdd >= startStr && yyyymmdd <= endStr) {
      return w.label
    }
  }
  return ''
}

/**
 * Helper to build a folder/week key for Maps.
 * @param {string} folder
 * @param {string} weekLabel
 * @returns {string}
 */
function makeFolderWeekKey(folder: string, weekLabel: string): string {
  return `${folder}::${weekLabel}`
}

/**
 * Parse a @done(YYYY-MM-DD ...) date from paragraph content.
 * Returns the ISO date part or empty string.
 * @param {string} content
 * @returns {string}
 */
function getDoneISODateFromContent(content: string): string {
  if (!content || !content.match(RE_DONE_DATE_OPT_TIME)) return ''
  const reReturnArray = content.match(RE_DONE_DATE_OR_DATE_TIME_DATE_CAPTURE) ?? []
  const doneDate = reReturnArray[1]
  return typeof doneDate === 'string' ? doneDate : ''
}

/**
 * Generate weekly Project/Area progress stats per relevant folder for the last N weeks. Returns two arrays of strings:
 * - First array: notes-per-week (distinct notes with at least one completed task)
 * - Second array: tasks-per-week (total completed tasks)
 * @author @jgclark (spec) + @cursor (implementation)
 * @returns {Promise<Array<string>>}
 */
async function generateProjectsWeeklyProgressLines(): Promise<[Array<string>, Array<string>]>
{
  try {
    logDebug(pluginJson, `generateProjectsWeeklyProgressLines: starting`)
    const startTime = new Date()
    const config: ReviewConfig | null = ((await getReviewSettings(): any): ReviewConfig)
    if (!config) {
      throw new Error('generateProjectsWeeklyProgressLines: could not load Review settings. Stopping.')
    }
    const foldersToExclude = config.foldersToIgnore ?? []

    // 1. Week range (last 12 weeks, including current)
    const weeks: Array<WeekInfo> = getLastNWeeks(DEFAULT_NUM_WEEKS)
    if (weeks.length === 0) {
      throw new Error('No week range could be calculated')
    }
    const weekLabels: Array<string> = weeks.map((w) => w.label)

    // 2. Get all regular notes from filtered folders (respecting existing Projects exclusions)
    const allNotes = getRegularNotesFromFilteredFolders(foldersToExclude, true)
    logDebug('generateProjectsWeeklyProgressLines', `considering ${String(allNotes.length)} regular notes`)

    // 3. Filter notes to those whose folder name contains 'Area' or 'Project', and doesn't start or end with 'index' or 'MOC' (case-insensitive)
    const folderSet: Set<string> = new Set()
    const notesInTargetFolders = allNotes.filter((n) => {
      const folderPath = getFolderFromFilename(n.filename)
      if (isAreaOrProjectFolder(folderPath) && !n.title?.match(/^index $/i) && !n.title?.match(/ index$/i) && !n.title?.match(/^moc $/i) && !n.title?.match(/ moc$/i)) {
        folderSet.add(folderPath)
        return true
      }
      return false
    })
    const folders: Array<string> = Array.from(folderSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    logInfo('generateProjectsWeeklyProgressLines', `found ${String(folders.length)} Area/Project folders and ${String(notesInTargetFolders.length)} notes in them`)

    if (folders.length === 0) {
      logInfo('generateProjectsWeeklyProgressLines', `no Area/Project folders found: nothing to write`)
      return [[], []]
    }

    // 4. Aggregation structures
    const notesPerWeekMap: Map<string, Set<string>> = new Map() // key: folder::week -> set of note filenames
    const tasksPerWeekMap: Map<string, number> = new Map() // key: folder::week -> task count

    // 5. Scan notes and paragraphs
    for (const note of notesInTargetFolders) {
      const folderPath = getFolderFromFilename(note.filename)
      for (const p of note.paragraphs) {
        if (!isDone(p)) continue
        const doneISO = getDoneISODateFromContent(p.content)
        if (!doneISO) continue

        const weekLabel = getWeekLabelForISODate(doneISO, weeks)
        if (!weekLabel) continue

        const key = makeFolderWeekKey(folderPath, weekLabel)

        // tasks-per-week
        const currentTasks = tasksPerWeekMap.get(key) ?? 0
        tasksPerWeekMap.set(key, currentTasks + 1)

        // notes-per-week (distinct notes)
        const noteSet = notesPerWeekMap.get(key) ?? new Set()
        noteSet.add(note.filename)
        notesPerWeekMap.set(key, noteSet)
      }
    }

    // 6. Build CSV tables
    const notesRows: Array<string> = [
      ['Folder / Notes progressed per week', ...weekLabels, 'total'].join(','),
    ]
    const tasksRows: Array<string> = [
      ['Folder / Tasks completed per week', ...weekLabels, 'total'].join(','),
    ]

    for (const folderName of folders) {
      const noteCounts: Array<string> = []
      let noteCountTotal = 0
      const taskCounts: Array<string> = []
      let taskCountTotal = 0

      for (const weekLabel of weekLabels) {
        const key = makeFolderWeekKey(folderName, weekLabel)
        const noteSet = notesPerWeekMap.get(key)
        const noteCount = noteSet ? noteSet.size : 0
        const taskCount = tasksPerWeekMap.get(key) ?? 0
        noteCounts.push(String(noteCount))
        noteCountTotal += noteCount
        taskCounts.push(String(taskCount))
        taskCountTotal += taskCount
      }

      // Note: surround folder name with quotes in case folder name contains commas
      notesRows.push([`"${folderName}"`].concat(noteCounts).concat(String(noteCountTotal)).join(','))
      tasksRows.push([`"${folderName}"`].concat(taskCounts).concat(String(taskCountTotal)).join(','))
    }

    // Add totals row (sum of each column across all folders)
    if (folders.length > 0) {
      const notesColumnTotals: Array<number> = new Array<number>(weekLabels.length + 1).fill(0)
      const tasksColumnTotals: Array<number> = new Array<number>(weekLabels.length + 1).fill(0)

      for (const folderName of folders) {
        const rowPartsNotes = notesRows.find((r) => r.startsWith(`"${folderName}"`))
        const rowPartsTasks = tasksRows.find((r) => r.startsWith(`"${folderName}"`))
        if (!rowPartsNotes || !rowPartsTasks) {
          continue
        }
        const colsNotes = rowPartsNotes.split(',').slice(1).map((v) => Number(v) || 0)
        const colsTasks = rowPartsTasks.split(',').slice(1).map((v) => Number(v) || 0)
        colsNotes.forEach((val, idx) => {
          notesColumnTotals[idx] += val
        })
        colsTasks.forEach((val, idx) => {
          tasksColumnTotals[idx] += val
        })
      }

      notesRows.push(['"TOTAL"', ...notesColumnTotals.map((n) => String(n))].join(','))
      tasksRows.push(['"TOTAL"', ...tasksColumnTotals.map((n) => String(n))].join(','))
    }
    logInfo('projectsWeeklyProgressCSV', `Generated ${String(notesRows.length)} notes rows and ${String(tasksRows.length)} tasks rows in ${timer(startTime)}`)
    return [notesRows, tasksRows]
  } catch (error) {
    logError('projectsWeeklyProgressCSV', error.message)
    throw error
  }
}

//-----------------------------------------------------------------------------
// Main command

/**
 * Generate weekly Area/Project folder progress stats for the last N weeks and write them as CSV to two fixed notes in the (hidden) plugin data folder.
 * The two notes are:
 * - First note: notes-per-week (distinct notes with at least one completed task)
 * - Second note: tasks-per-week (total completed tasks)
 *
 * @author @jgclark (spec) + @cursor (implementation)
 * @returns {Promise<void>}
 */
export async function writeProjectsWeeklyProgressToCSV(): Promise<void> {
  try {
    logDebug(pluginJson, `writeProjectsWeeklyProgressToCSV: starting`)

    const [notesRows, tasksRows] = await generateProjectsWeeklyProgressLines()

    // First prepare and write the notes-per-week CSV
    const notesCsvString = notesRows.join('\n')
    await DataStore.saveData(notesCsvString, PROGRESS_PER_FOLDER_FILENAME, true)

    // Then prepare and write the tasks-per-week CSV
    const tasksCsvString = tasksRows.join('\n')
    await DataStore.saveData(tasksCsvString, TASK_COMPLETION_PER_FOLDER_FILENAME, true)

    logInfo('writeProjectsWeeklyProgressToCSV', `Written weekly progress CSV to '${PROGRESS_PER_FOLDER_FILENAME}' and '${TASK_COMPLETION_PER_FOLDER_FILENAME}'`)
  } catch (error) {
    logError('writeProjectsWeeklyProgressToCSV', error.message)
    throw error
  }
}

//-----------------------------------------------------------------------------
// Heatmap visualisation

/**
 * Convert the CSV-style rows returned by generateProjectsWeeklyProgressLines()
 * into the data structure expected by AnyChart's heatMap chart.
 * The header row is expected to be:
 *   label,week1,week2,...,weekN,total
 * Subsequent rows are:
 *   "folder name",v1,v2,...,vN,total
 * The TOTAL row is ignored.
 * @param {Array<string>} rows
 * @returns {Array<{x: string, y: string, heat: number}>}
 */
function buildHeatmapDataFromCSVRows(rows: Array<string>): Array<{ x: string, y: string, heat: number }> {
  if (rows.length < 2) {
    return []
  }

  const headerParts = rows[0].split(',')
  if (headerParts.length < 3) {
    return []
  }

  const weekLabels = headerParts.slice(1, -1)
  const data = []

  for (let i = 1; i < rows.length; i++) {
    const line = rows[i]
    if (!line || line.trim() === '') {
      continue
    }
    const parts = line.split(',')
    if (parts.length < weekLabels.length + 2) {
      continue
    }

    const rawFolder = parts[0]
    const folderName = rawFolder.startsWith('"') && rawFolder.endsWith('"')
      ? rawFolder.slice(1, -1)
      : rawFolder

    if (folderName.toUpperCase() === 'TOTAL') {
      continue
    }

    for (let w = 0; w < weekLabels.length; w++) {
      const valStr = parts[1 + w]
      const heat = Number(valStr) || 0
      data.push({
        x: weekLabels[w],
        y: folderName,
        heat,
      })
    }
  }

  return data
}

/**
 * Render one or more weekly-progress heatmaps in a single HTML window.
 * Uses AnyChart's heatMap chart in the same way as the Summaries plugin's heatmap generator.
 * Each chart gets its own container id so two charts can draw in one document.
 * @param {Array<TWeeklyHeatmapChart>} charts
 * @param {string} windowTitle
 * @returns {Promise<void>}
 */
async function showProjectsWeeklyProgressHeatmapWindow(
  charts: Array<TWeeklyHeatmapChart>,
  windowTitle: string,
): Promise<void> {
  try {
    if (charts.length === 0) {
      logInfo('showProjectsWeeklyProgressHeatmapWindow', 'No heatmap data to display')
      return
    }

    const heatmapCSS = `html, body {
  width: 100%;
  height: 100%;
  margin: 0px;
  padding: 0px;
  color: var(--fg-main-color);
  background-color: var(--bg-main-color);
}
.heatmap-stack {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
.heatmap-container {
  width: 100%;
  flex: 1;
  min-height: 0;
}
`

    const preScript = `<!-- Load AnyChart scripts -->
<script src="https://cdn.anychart.com/releases/8.7.1/js/anychart-core.min.js"></script>
<script src="https://cdn.anychart.com/releases/8.7.1/js/anychart-heatmap.min.js"></script>
`

    const containerDivs = charts
      .map((chart) => `<div id="${chart.containerId}" class="heatmap-container"></div>`)
      .join('\n')

    const drawCalls = charts
      .map((chart) => `    drawHeatmap(${JSON.stringify(chart.data)}, ${JSON.stringify(chart.chartTitle)}, ${JSON.stringify(chart.containerId)});`)
      .join('\n')

    const body = `
<div class="heatmap-stack">
${containerDivs}
</div>
<script>
  anychart.onDocumentReady(function () {
    function formatWeekAxisLabel() {
      var v = this.value;
      if (!v || typeof v !== 'string') {
        return v;
      }
      var parts = v.split('-W');
      if (parts.length !== 2) {
        return v;
      }
      var year = parts[0];
      var week = parts[1];
      if (week === '00' || week === '01') {
        return year;
      }
      return 'W' + week;
    }

    function drawHeatmap(data, title, containerId) {
      var chart = anychart.heatMap(data);
      chart.title(title);
      var customColorScale = anychart.scales.linearColor();
      customColorScale.colors(["#F4FFF4", "#09B009"]);
      chart.colorScale(customColorScale);
      chart.container(containerId);
      chart.labels().enabled(false);
      chart.xAxis().orientation('bottom');
      // Format x-axis labels:
      // - normally drop the leading "YYYY-" and show "WNN"
      // - but on the first week of a new year (W00/W01), drop the "-WNN" part and show just "YYYY"
      chart.xAxis().labels().format(formatWeekAxisLabel);
      // Rotate x-axis labels to go (nearly) vertically upwards
      chart.xAxis().labels().rotation(290);
      var tooltip = chart.tooltip();
      tooltip.titleFormat('');
      tooltip.padding().left(20);
      tooltip.separator(false);
      tooltip.format(function () {
        if (this.heat != null && this.heat !== '' && !isNaN(this.heat)) {
          return this.heat + ' items\\nFolder: ' + this.getData("y") + '\\nWeek: ' + this.getData("x");
        } else {
          return 'No data';
        }
      });
      chart.xScroller().enabled(true);
      chart.legend(true);
      chart.draw();
    }

${drawCalls}
  });
</script>
`

    const winOpts = {
      windowTitle,
      width: 800,
      height: charts.length > 1 ? 900 : 500,
      generalCSSIn: '',
      specificCSS: heatmapCSS,
      preBodyScript: preScript,
      postBodyScript: '',
      customId: `${PLUGIN_ID}.projects-weekly-progress-heatmaps`,
      savedFilename: 'projects-weekly-progress-heatmap.html',
      makeModal: false,
      reuseUsersWindowRect: true,
      shouldFocus: true,
    }

    await showHTMLV2(body, winOpts)
    logInfo('showProjectsWeeklyProgressHeatmapWindow', `Shown window titled '${windowTitle}' with ${String(charts.length)} chart(s)`)
  } catch (error) {
    logError('showProjectsWeeklyProgressHeatmapWindow', error.message)
  }
}

/**
 * Generate weekly Area/Project folder progress stats and display them
 * as heatmaps in one HTML window:
 * - Notes progressed per week
 * - Tasks completed per week
 * This reuses the HTML heatmap pattern from the Summaries plugin.
 * @returns {Promise<void>}
 */
export async function showProjectsWeeklyProgressHeatmaps(): Promise<void> {
  try {
    logDebug(pluginJson, `showProjectsWeeklyProgressHeatmaps: starting`)

    const [notesRows, tasksRows] = await generateProjectsWeeklyProgressLines()

    const charts: Array<TWeeklyHeatmapChart> = []
    if (notesRows.length > 0) {
      const notesData = buildHeatmapDataFromCSVRows(notesRows)
      if (notesData.length > 0) {
        charts.push({
          data: notesData,
          chartTitle: 'Area/Project Notes progressed per week',
          containerId: 'notes-heatmap-container',
        })
      }
    }
    if (tasksRows.length > 0) {
      const tasksData = buildHeatmapDataFromCSVRows(tasksRows)
      if (tasksData.length > 0) {
        charts.push({
          data: tasksData,
          chartTitle: 'Area/Project Tasks completed per week',
          containerId: 'tasks-heatmap-container',
        })
      }
    }

    if (charts.length === 0) {
      logInfo('showProjectsWeeklyProgressHeatmaps', 'No weekly progress data available to visualise')
      await showMessage('No weekly progress data available to visualise', 'OK', 'Weekly Progress Heatmaps')
      return
    }

    const windowTitle = charts.length === 2
      ? 'Projects Weekly Progress'
      : (charts[0].containerId === 'notes-heatmap-container'
        ? 'Projects Weekly Progress - Notes'
        : 'Projects Weekly Progress - Tasks')

    await showProjectsWeeklyProgressHeatmapWindow(charts, windowTitle)
  } catch (error) {
    logError('showProjectsWeeklyProgressHeatmaps', error.message)
    throw error
  }
}
