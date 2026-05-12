// @flow

// -----------------------------------------------------------------------------
// Shared Resources plugin for NotePlan
// Jonathan Clark
// last updated 15.7.2023 for v0.4.4, @jgclark
// -----------------------------------------------------------------------------

const sharedPluginID = 'np.Shared'
import pluginJson from '../plugin.json'
import { handleSharedRequest } from './sharedRequestRouter'
import { getPluginJson, updateSettingData } from '@helpers/NPConfiguration'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

export { openReactWindow, showInMainWindow, onMessageFromHTMLView } from './NPReactLocal'
export { handleSharedRequest }

/**
 * Log the list of resource files that should currently be available by this plugin (i.e. at run-time, not compile-time).
 * @author @jgclark
 */
export async function logProvidedSharedResources(): Promise<void> {
  try {
    const liveSharedPluginJson = await getPluginJson(sharedPluginID)
    const requiredFiles = liveSharedPluginJson['plugin.requiredFiles']
    logInfo(sharedPluginID, `Resources Provided by np.Shared according to its plugin.json file:\n- ${requiredFiles.join('\n- ')}`)
  } catch (error) {
    logError(sharedPluginID, JSP(error))
  }
}

/** Log the the list of resource files that are actually available to client plugins from np.Shared (i.e. at run-time, not compile-time).
 * @author @jgclark
 */
export async function logAvailableSharedResources(_pluginID: string): Promise<void> {
  try {
    const liveSharedPluginJson = await getPluginJson(sharedPluginID)
    const requiredFiles = liveSharedPluginJson['plugin.requiredFiles']
    for (const rf of requiredFiles) {
      const relativePathToRF = `../../${sharedPluginID}/${rf}`
      logInfo(sharedPluginID, `- ${relativePathToRF} ${DataStore.fileExists(relativePathToRF) ? 'is' : "isn't"} available from np.Shared`)
    }
  } catch (error) {
    logError(sharedPluginID, JSP(error))
  }
}

/**
 * Temporary diagnostic command to call shared chooser handlers directly inside np.Shared.
 * This bypasses Dashboard, the WebView bridge, and REQUEST/RESPONSE correlation handling.
 * @param {string} space - Optional space filter: empty string for Private, teamspace UUID for one teamspace, or '__all__' for all spaces
 * @param {string} debugStopAfter - Optional getNotes checkpoint to stop after (e.g. after-project-raw, after-calendar-convert)
 * @param {string} debugOption - Optional diagnostic option: 'no-decoration', '<limit>', or '<start>:<limit>' for calendar conversion slicing
 * @returns {Promise<void>}
 */
export async function debugGetNotesDirect(space: string = '', debugStopAfter: string = '', debugOption: string = ''): Promise<void> {
  const startedAt = Date.now()
  const normalizedSpace = typeof space === 'string' ? space : ''
  const normalizedDebugStopAfter = typeof debugStopAfter === 'string' ? debugStopAfter : ''
  const normalizedDebugOption = typeof debugOption === 'string' ? debugOption : ''
  const includeDecorationForCheckpoint = normalizedDebugOption !== 'no-decoration'
  const calendarSliceParts = normalizedDebugOption.match(/^(\d+)(?::(\d+))?$/)
  const debugCalendarConvertStart = calendarSliceParts && calendarSliceParts[2] ? Number(calendarSliceParts[1]) : 0
  const debugCalendarConvertLimit = calendarSliceParts ? Number(calendarSliceParts[2] || calendarSliceParts[1]) : null
  const dashboardParams = {
    includeCalendarNotes: true,
    includePersonalNotes: true,
    includeRelativeNotes: true,
    includeTeamspaceNotes: true,
    space: normalizedSpace,
  }
  const probes = normalizedDebugStopAfter
    ? [
        {
          label: `checkpoint-${normalizedDebugStopAfter}`,
          params: {
            ...dashboardParams,
            includeDecoration: includeDecorationForCheckpoint,
            debugStopAfter: normalizedDebugStopAfter,
            ...(debugCalendarConvertLimit != null ? { debugCalendarConvertStart, debugCalendarConvertLimit } : {}),
          },
        },
      ]
    : [
        {
          label: 'project-only-no-decoration',
          params: { ...dashboardParams, includeCalendarNotes: false, includeRelativeNotes: false, includeDecoration: false },
        },
        {
          label: 'dashboard-shape-no-decoration',
          params: { ...dashboardParams, includeDecoration: false },
        },
        {
          label: 'dashboard-shape-with-decoration',
          params: { ...dashboardParams, includeDecoration: true },
        },
      ]

  try {
    logInfo(
      sharedPluginID,
      `[DIAG][debugGetNotesDirect] START space="${normalizedSpace || 'Private'}", debugStopAfter="${normalizedDebugStopAfter}", debugOption="${normalizedDebugOption}", dashboardParams=${JSP(
        dashboardParams,
      )}`,
    )
    const teamspacesStartedAt = Date.now()
    const teamspacesResult = await handleSharedRequest('getTeamspaces', {}, pluginJson)
    const teamspacesElapsed = Date.now() - teamspacesStartedAt
    const teamspaceCount = Array.isArray(teamspacesResult?.data) ? teamspacesResult.data.length : 0
    logInfo(
      sharedPluginID,
      `[DIAG][debugGetNotesDirect] getTeamspaces COMPLETE elapsed=${teamspacesElapsed}ms, success=${String(teamspacesResult?.success)}, count=${teamspaceCount}`,
    )

    let finalNoteCount = 0
    for (const probe of probes) {
      const notesStartedAt = Date.now()
      logInfo(sharedPluginID, `[DIAG][debugGetNotesDirect] getNotes PROBE START label="${probe.label}", params=${JSP(probe.params)}`)
      const notesResult = await handleSharedRequest('getNotes', probe.params, pluginJson)
      const notesElapsed = Date.now() - notesStartedAt
      const noteCount = Array.isArray(notesResult?.data) ? notesResult.data.length : 0
      const debugStopped = notesResult?.data?.debugStopped === true
      const checkpoint = notesResult?.data?.checkpoint || ''
      finalNoteCount = noteCount
      logInfo(
        sharedPluginID,
        `[DIAG][debugGetNotesDirect] getNotes PROBE COMPLETE label="${probe.label}", elapsed=${notesElapsed}ms, success=${String(notesResult?.success)}, count=${noteCount}, debugStopped=${String(
          debugStopped,
        )}, checkpoint="${checkpoint}", message="${String(notesResult?.message || '')}"`,
      )
    }

    const totalElapsed = Date.now() - startedAt
    logInfo(sharedPluginID, `[DIAG][debugGetNotesDirect] COMPLETE totalElapsed=${totalElapsed}ms`)
    await showMessage(
      normalizedDebugStopAfter
        ? `np.Shared debugGetNotesDirect reached checkpoint "${normalizedDebugStopAfter}" (${normalizedDebugOption || 'full'}) in ${totalElapsed}ms`
        : `np.Shared debugGetNotesDirect complete: final probe returned ${finalNoteCount} notes in ${totalElapsed}ms`,
    )
  } catch (error) {
    const totalElapsed = Date.now() - startedAt
    logError(sharedPluginID, `[DIAG][debugGetNotesDirect] ERROR elapsed=${totalElapsed}ms, error=${JSP(error)}`)
    await showMessage(`np.Shared debugGetNotesDirect failed after ${totalElapsed}ms: ${error.message}`)
  }
}

/**
 * Test to see if np.Shared is installed, and if filenames are passed, then check that they are available too. In the latter case, return the number of 'filesToCheck' that are found.
 * @author @jgclark
 * @param {string} clientPluginID - pluginID for the client plugin
 * @param {Array<string>} files - optional list of filenames to check
 * @results {boolean | number} simple or more complex results of check
 */
export async function checkForWantedResources(pluginID: string, filesToCheck?: Array<string>): Promise<boolean | number> {
  try {
    // logDebug('checkForWantedResources', `Starting with buildVersion ${Number(NotePlan.environment.buildVersion)}`)
    // First test to see if np.Shared is installed
    if (!DataStore.isPluginInstalledByID(sharedPluginID)) {
      logInfo('checkForWantedResources', `${sharedPluginID} is not installed.`)
      return false
    }

    // It is installed.
    // If we don't want to check whether file(s) can be accessed then return
    if (!filesToCheck) {
      return true
    }

    // We want to check, so read this plugin's requiredSharedFiles
    const livePluginJson = await getPluginJson(pluginID)
    const requiredSharedFiles = livePluginJson['plugin.requiredSharedFiles'] ?? []
    // $FlowFixMe
    logDebug(`${pluginID}/init/checkForWantedResources`, `plugin np.Shared is loaded 😄 and provides ${String(requiredSharedFiles.length)} files:`)

    // Double-check that the requiredSharedFiles can be accessed
    let numFound = 0
    for (const rf of filesToCheck) {
      const filename = `../../${sharedPluginID}/${rf}`
      if (NotePlan.environment.buildVersion >= 973) {
        // If we can, use newer method that doesn't have to load the data
        if (DataStore.fileExists(filename)) {
          // logDebug(`checkForWantedResources`, `- ${filename} exists`)
          numFound++
        } else {
          logWarn(`checkForWantedResources`, `- ${filename} not found`)
        }
      } else {
        const data = DataStore.loadData(filename, false)
        if (data) {
          // logDebug(`checkForWantedResources`, `- found ${filename}, length ${String(data.length)}`)
          numFound++
        } else {
          logWarn(`checkForWantedResources`, `- ${filename} not found`)
        }
      }
    }
    return numFound
  } catch (error) {
    logError(pluginID, error.message)
    return false
  }
}

export function init(): void {
  // In the background, see if there is an update to the plugin to install, and if so let user know
  DataStore.installOrUpdatePluginsByID([pluginJson['plugin.id']], false, false, false)
}

export function onSettingsUpdated(): void {
  // Placeholder only to stop error in logs
}

export async function onUpdateOrInstall(): Promise<void> {
  try {
    logDebug(sharedPluginID, `onUpdateOrInstall: Starting`)
    // Try updating settings data
    const updateSettings = updateSettingData(sharedPluginID)
    logDebug(sharedPluginID, `onUpdateOrInstall: UpdateSettingData code: ${updateSettings}`)

    // Tell user the plugin has been updated
    if (pluginJson['plugin.lastUpdateInfo'] !== undefined) {
      await showMessage(pluginJson['plugin.lastUpdateInfo'], 'OK, thanks', `Plugin ${pluginJson['plugin.name']}\nupdated to v${pluginJson['plugin.version']}`)
    }
  } catch (error) {
    logError(sharedPluginID, error)
  }
  logDebug(sharedPluginID, `onUpdateOrInstall: Finished`)
}
