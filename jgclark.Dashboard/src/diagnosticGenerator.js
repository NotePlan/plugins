// @flow
//-----------------------------------------------------------------------------
// Generate diagnostics file for Dashboard plugin to help with debugging
// Last updated 2025-05-23 for v2.3.0
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
import { getTagMentionCacheSummary } from './tagMentionCache'
import type { TPerspectiveDef } from './types'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getOrMakeNote } from '@helpers/note'
import { showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------

const diagnosticsNoteFilename = 'diagnostics-for-dashboard.md'
const diagnosticsNoteTitle = 'Diagnostics for Dashboard'

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

    output.push('---')
    output.push(`title: ${diagnosticsNoteTitle}`)
    output.push(`generated: ${moment().format('YYYY-MM-DD HH:mm:ss')}`)
    output.push('icon: circle-info')
    output.push('icon-style: solid')
    output.push('icon-color: blue-400')
    output.push('---')
    output.push(`- NP v${NotePlan.environment.version} build ${NotePlan.environment.buildVersion} running on ${NotePlan.environment.platform}`)
    output.push(`- Screen dimensions: ${String(NotePlan.environment.screenWidth)}w x ${String(NotePlan.environment.screenHeight)}h`)
    output.push(`- Plugin '${pluginJson['plugin.name']}' v${pluginJson['plugin.version']}`)
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
    if (ds.FFlag_UseTagCache) {
      output.push('')
      output.push(getTagMentionCacheSummary())
    }
    output.push('')
    output.push('## Current NotePlan settings for Dashboard')
    output.push('```json')
    output.push(JSON.stringify(npSettings, null, 2))
    output.push('```')
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

    // Get existing note by start-of-string match on titleToMatch, if that is supplied, or requestedTitle if not.
    const outputNote = await getOrMakeNote(diagnosticsNoteTitle, '')
    outputNote.content = output.join('\n')
    const res = await showMessageYesNo(`Diagnostics for Dashboard written to note '${diagnosticsNoteTitle}' in your root folder. Use 'Show in Finder' from the note '...' menu to find it and send it to plugin authors. Would you like me to open this note now?`)
    logInfo('generateDiagnosticsFile', `Diagnostics written to note ${diagnosticsNoteTitle} (hopefully)`)
    if (res === 'Yes') {
      await Editor.openNoteByFilename(outputNote.filename, false, 0, 0, false, false)
    }
  } catch (error) {
    logError('generateDiagnosticsFile', `Error: ${error.message}`)
  }
}
