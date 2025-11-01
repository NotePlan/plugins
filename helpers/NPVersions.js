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
  
  function v(input: string): number { return semverVersionToNumber(input) }

  // List of features and their minimum required versions (and dates, if known)
  const versionHas: { [string]: boolean } = {
    windowDetails: userVersionNumber >= v("3.8.1"), // March 2023
    noteVersions: userVersionNumber >= v("3.9.3"), // July 2023
    screenDetails: userVersionNumber >= v("3.9.8"), // October 2023
    ai: userVersionNumber >= v("3.16.3"), // first present in v3.15.1, but extended in v3.16.3
    teamspaceNotes: userVersionNumber >= v("3.17.0"),
    decoratedCommandBar: userVersionNumber >= v("3.18.0"),
    updateFrontmatterAttributes: userVersionNumber >= v("3.18.1"), // NotePlan.frontmatterAttributes is available from v3.16.3, but extended in v3.18.1
    advancedSearch: userVersionNumber >= v("3.18.1"),
    trashNote: userVersionNumber >= v("3.18.2"),
    getWeather: userVersionNumber >= v("3.19.2"), // Nov 2025
    mainSidebarControl: userVersionNumber >= v("3.19.2"), // Nov 2025
    contentDeduplicator: userVersionNumber >= v("3.19.2"), // Nov 2025
  }
  !versionHas[feature] &&
    logWarn(
      'usersVersionHas',
      `NotePlan version ${NotePlan.environment.version} (${String(userVersionNumber)}) does not have requested feature: "${feature}"; ${versionHas.hasOwnProperty(feature) ? `feature *is* listed in function usersVersionHas()` : 'feature *is not* listed in function usersVersionHas()'
      }. Returning false.`)
  return versionHas[feature] ?? false
}
