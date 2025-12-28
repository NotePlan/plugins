// @flow
//-------------------------------------------------------------------------------
// Version-related helper functions for NotePlan plugins
//-------------------------------------------------------------------------------

import { clo, JSP, logError, logDebug, logWarn } from './dev'
import { semverVersionToNumber } from './utils'

/**
 * Check if the user's version of NotePlan has a given feature. The check should work for both macOS, iPadOS and iOS.
 * @param {string} feature - the feature to check for (e
 * @returns {boolean} true if the user's version of NotePlan has the feature, false otherwise
 */
export function usersVersionHas(feature: string): boolean {
  logDebug('usersVersionHas', `NotePlan v${NotePlan.environment.version}`)
  // Note: this ignores any non-numeric, non-period characters (e.g., "-beta3")
  const userVersionNumber: number = semverVersionToNumber(NotePlan.environment.version) || 0
  // logDebug('usersVersionHas', `userVersionNumber: ${String(userVersionNumber)}`)

  // List of features and their minimum required versions (and dates, if known)
  const versionRequirements: { [string]: string } = {
    windowDetails: '3.8.1', // March 2023
    noteVersions: '3.9.3', // July 2023
    screenDetails: '3.9.8', // October 2023
    ai: '3.16.3', // first present in v3.15.1, but extended in v3.16.3
    teamspaceNotes: '3.17.0',
    decoratedCommandBar: '3.18.0',
    updateFrontmatterAttributes: '3.18.1', // NotePlan.frontmatterAttributes is available from v3.16.3, but extended in v3.18.1
    advancedSearch: '3.18.1',
    trashNote: '3.18.2',
    getWeather: '3.19.2', // Nov 2025
    mainSidebarControl: '3.19.2', // Nov 2025
    contentDeduplicator: '3.19.2', // Nov 2025
    settableLineIndex: '3.19.2', // Nov 2025, build 1440
    showInMainWindow: '3.20.0', // Dec 2025, macOS build 1469
    availableCalendars: '3.20.0', // Dec 2025, macOS build 1469
    availableReminderLists: '3.20.0', // Dec 2025, macOS build 1469
  }

  // Check if the user's version meets the requirement for the requested feature
  const requiredVersion = versionRequirements[feature]
  if (!requiredVersion) {
    logWarn('usersVersionHas', `Feature '${feature}' is not listed in function usersVersionHas(). Returning false.`)
    return false
  }

  const hasFeature = userVersionNumber >= semverVersionToNumber(requiredVersion)
  !hasFeature && logWarn('usersVersionHas', `NotePlan version ${NotePlan.environment.version} (${String(userVersionNumber)}) does not have requested feature: "${feature}"`)
  return hasFeature
}
