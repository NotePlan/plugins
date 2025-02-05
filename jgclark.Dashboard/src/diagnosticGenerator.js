// @flow
//-----------------------------------------------------------------------------
// Generate diagnostics file for Dashboard plugin to help with debugging
// Last updated for v2.1.8
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  getDashboardSettings,
  getListOfEnabledSections,
  getNotePlanSettings,
} from './dashboardHelpers'
import { logPerspectives, logPerspectiveNames, getActivePerspectiveName, getPerspectiveSettings } from './perspectiveHelpers'
import { getCurrentlyAllowedFolders } from './perspectivesShared'
import type { TPerspectiveDef } from './types'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'

//-----------------------------------------------------------------

const diagnosticsNoteFilename = 'diagnostics.md'

/**
 * Generate a list of all the main settings in the Dashboard plugin for the current user to help with debugging.
 * Write out to a file in the user's plugin folder.
 */
export async function generateDiagnosticsFile() {
  try {
    // do counts
    const calNotesCount = DataStore.calendarNotes.length // count all types of calendar notes
    const projNotes = DataStore.projectNotes.filter(
      (n) => !n.filename.startsWith("@Trash") && !n.filename.startsWith("@Archive")) // ignore Trash and Archive
    const templatesCount = DataStore.projectNotes.filter(
      (n) => n.filename.startsWith('@Templates')
    ).length
    const archivedCount = DataStore.projectNotes.filter(
      (n) => n.filename.startsWith('@Archive')
    ).length
    const projNotesCount = projNotes.length - templatesCount
    const total = calNotesCount + projNotes.length
    const foldersCount = DataStore.folders.length

    // Get Dashboard settings and perspectives
    const npSettings = await getNotePlanSettings()
    const ds: any = await getDashboardSettings()
    const output: Array<string> = []
    const perspectiveDefs: Array<TPerspectiveDef> = await getPerspectiveSettings(false)

    output.push(`# Dashboard Settings`)
    output.push(`- Generated at ${moment().format('YYYY-MM-DD HH:mm:ss')}`)
    output.push(`- NP v${NotePlan.environment.version} build ${NotePlan.environment.buildVersion} running on ${NotePlan.environment.platform}`)
    output.push(`- Plugin '${pluginJson['plugin.name']}' v${pluginJson['plugin.version']}`)
    output.push('')
    output.push('## Current NotePlan settings')
    output.push('```json')
    output.push(JSON.stringify(npSettings, null, 2))
    output.push('```')
    output.push('')
    output.push('## Current Dashboard settings')
    output.push('```json')
    output.push(JSON.stringify(ds, null, 2))
    output.push('```')
    output.push('')
    output.push('## Database Structure')
    output.push(`- 🔢 ${total.toLocaleString()} Total notes`)
    output.push(`- 📅 ${calNotesCount.toLocaleString()} Calendar notes (~${Math.round(calNotesCount / 36.5) / 10.0} years)`)
    output.push(`- 📝 Project notes: ${projNotesCount.toLocaleString()} Regular notes`)
    output.push(`- + 📋 Templates: ${templatesCount.toLocaleString()}`)
    output.push(`- + 📔 Archived notes: ${archivedCount.toLocaleString()}`)
    output.push(`- ${foldersCount.toLocaleString()} Folders: [${String(DataStore.folders)}]`)
    output.push('')
    output.push(`## Current Perspective = ${getActivePerspectiveName(perspectiveDefs)}`)
    output.push(`- Enabled sections: ${String(getListOfEnabledSections(ds)) || 'none?'}`)
    output.push(`- Allowed folders: [${String(getCurrentlyAllowedFolders(ds))}]`)
    output.push('')
    output.push('## Perspectives: short list')
    for (const thisP of perspectiveDefs) {
      output.push(` - ${thisP.name}: ${thisP.isModified ? ' (modified)' : ''}${thisP.isActive ? ' <isActive>' : ''}`)
    }
    output.push('')
    output.push('## Perspectives: full settings')
    output.push('```json')
    output.push(JSON.stringify(perspectiveDefs, null, 2))
    output.push('```')

    const res = DataStore.saveData(output.join('\n'), diagnosticsNoteFilename, true)
    if (res) {
      logInfo('generateDiagnosticsFile', `Diagnostics file written to Plugins/data/jgclark.Dashboard/${diagnosticsNoteFilename}`)
    } else {
      logError('generateDiagnosticsFile', `Failed to write Diagnostics file to Plugins/data/jgclark.Dashboard/${diagnosticsNoteFilename}`)
    }
  } catch (error) {
    logError('generateDiagnosticsFile', `Error: ${error.message}`)
  }
}
