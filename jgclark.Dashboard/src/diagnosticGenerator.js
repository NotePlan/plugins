// @flow
//-----------------------------------------------------------------------------
// Generate diagnostics file for Dashboard plugin to help with debugging
// Last updated 2026-05-28 for v2.4.0.b45 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  getDashboardSettings,
  getListOfEnabledSections,
  getNotePlanSettings,
} from './dashboardHelpers'
import { logPerspectives, logPerspectiveNames, getActivePerspectiveName, loadPerspectiveDefsFromPluginSettings } from './perspectiveHelpers'
import { getCurrentlyAllowedFolders } from './perspectivesShared'
import { getTagMentionCacheDiagnosticsLines } from './tagMentionCache'
import type { TPerspectiveDef } from './types'
import { clo, JSP, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { createPrettyRunPluginLink } from '@helpers/general'
import { getFolderDisplayName } from '@helpers/folders'
import { getOrMakeRegularNoteInFolder } from '@helpers/NPnote'
import { showMessageYesNo } from '@helpers/userInput'

//-----------------------------------------------------------------

const diagnosticsNoteTitle = 'Diagnostics for Dashboard'

/**
 * Generate a list of all the main settings in the Dashboard plugin for the current user to help with debugging.
 * Write out to a file in the user's plugin folder.
 * @param {string} refreshArg - pass 'refresh' from the in-note pseudo-button to skip the open-note prompt
 */
export async function generateDiagnosticsFile(refreshArg: string = '') {
  const isInNoteRefresh = refreshArg === 'refresh'
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
    const perspectiveDefs: Array<TPerspectiveDef> = await loadPerspectiveDefsFromPluginSettings(false)

    output.push('---')
    output.push(`title: ${diagnosticsNoteTitle}`)
    output.push(`generated: ${moment().format('YYYY-MM-DD HH:mm:ss')}`)
    output.push('icon: circle-info')
    output.push('icon-style: solid')
    output.push('icon-color: blue-400')
    output.push('---')
    output.push('')
    output.push(`# ${diagnosticsNoteTitle}`)
    const refreshButton = createPrettyRunPluginLink('🔄 Refresh', 'jgclark.Dashboard', 'Generate Diagnostics file', ['refresh'])
    output.push(`Last generated ${moment().format('YYYY-MM-DD HH:mm:ss')}. ${refreshButton}`)
    output.push('')
    output.push('## Environment')
    output.push(`- NP v${NotePlan.environment.version} build ${NotePlan.environment.buildVersion} running on ${NotePlan.environment.platform} ${NotePlan.environment.osVersion ?? ''}`)
    output.push(`- Screen dimensions: ${String(NotePlan.environment.screenWidth)}w x ${String(NotePlan.environment.screenHeight)}h`)
    output.push(`- Plugin '${pluginJson['plugin.name']}' v${pluginJson['plugin.version']}`)
    output.push('')
    output.push('## Database Structure')
    output.push(`- 🔢 ${total.toLocaleString()} Total notes`)
    output.push(`- 📅 ${calNotesCount.toLocaleString()} Calendar notes (~${Math.round(calNotesCount / 36.5) / 10.0} years)`)
    output.push(`- 📝 Project notes: ${projNotesCount.toLocaleString()} Regular notes`)
    output.push(`- + 📋 Templates: ${templatesCount.toLocaleString()}`)
    output.push(`- + 📔 Archived notes: ${archivedCount.toLocaleString()}`)
    output.push(`- ${foldersCount.toLocaleString()} Folders: [${DataStore.folders.map((f) => getFolderDisplayName(f)).join(', ')}]`)
    output.push('')
    output.push('## Current NotePlan settings for Dashboard')
    output.push('```json')
    output.push(JSON.stringify(npSettings, null, 2))
    output.push('```')
    output.push('')
    output.push('## Current Dashboard settings')
    output.push('```json')
    output.push(JSON.stringify(ds, null, 2))
    output.push('```')
    output.push('')
    output.push('## Tag/Mention Cache')
    output.push(...getTagMentionCacheDiagnosticsLines(ds))
    output.push('')
    output.push(`## Perspectives`)
    output.push(`Current Perspective = **${getActivePerspectiveName(perspectiveDefs)}**`)
    output.push(`- Enabled sections: ${String(getListOfEnabledSections(ds)) || 'none?'}`)
    output.push(`- Allowed folders: [${String(getCurrentlyAllowedFolders(ds))}]`)
    output.push('')
    output.push('### Perspectives: short list')
    for (const thisP of perspectiveDefs) {
      output.push(` - ${thisP.name}${thisP.isModified ? ' _(isModified)_' : ''}${thisP.isActive ? ' **<isActive>**' : ''}`)
    }
    output.push('')
    output.push('### Perspectives: full settings …')
    output.push('```json')
    output.push(JSON.stringify(perspectiveDefs, null, 2))
    output.push('```')
    output.push('')
    output.push('## Tools')
    output.push(
      `If settings.json looks corrupt: ${createPrettyRunPluginLink('Repair Dashboard settings file', 'jgclark.Dashboard', 'repairDashboardSettings')}.`,
    )
    output.push('')
    output.push('To show the Feature Flags menu outside DEV logging mode, set `"showFeatureFlagMenu": true` in top-level `dashboardSettings` in settings.json.')
    output.push('')

    // Get existing note by start-of-string match on titleToMatch, if that is supplied, or requestedTitle if not.
    const outputNote = await getOrMakeRegularNoteInFolder(diagnosticsNoteTitle, '')
    if (!outputNote) {
      throw new Error(`Failed to create output note '${diagnosticsNoteTitle}'`)
    }
    outputNote.content = output.join('\n')
    logInfo('generateDiagnosticsFile', `Diagnostics written to note ${diagnosticsNoteTitle} (hopefully)`)
    if (isInNoteRefresh) {
      return
    }
    await Editor.openNoteByFilename(outputNote.filename, false, 0, 0, false, false)
    const res = await showMessageYesNo(`Diagnostics for Dashboard written to note '${diagnosticsNoteTitle}' in your root folder. Use 'Show in Finder' from the note '...' menu to find it and send it to plugin authors.`)
  } catch (error) {
    logError('generateDiagnosticsFile', `Error: ${error.message}`)
  }
}
