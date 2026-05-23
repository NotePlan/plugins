// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions for Perspectives
// Last updated 2026-05-18 for v2.4.0.b37, @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getDashboardSettings, getDashboardSettingsDefaults, getOpenItemParasForTimePeriod, setPluginData } from './dashboardHelpers.js'
import { dashboardSettingsDefaults } from './react/support/settingsHelpers'
import { cleanDashboardSettingsInAPerspective, removeInvalidTagSections } from './dashboardSettingsClean'
import { loadDashboardPluginSettings, saveDashboardPluginSettings } from './dashboardPluginSettings'
import { showSectionSettingItems } from './react/components/Section/sectionHelpers'
import { dashboardFilterDefs, dashboardSettingDefs } from './dashboardSettings.js'
import { getCurrentlyAllowedFolders } from './perspectivesShared'
import { parseSettings } from './shared'
import { updateTagMentionCacheDefinitionsFromAllPerspectives } from './tagMentionCache'
import type { TDashboardSettings, TPerspectiveDef } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { getPeriodOfNPDateStr } from '@helpers/dateTime'
import { clo, clof, clvt, compareObjects, dt, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getFolderFromFilename, getFoldersMatching } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged, getNoteByFilename } from '@helpers/note'
import { chooseNoteV2 } from '@helpers/NPnote'
import { backupSettings } from '@helpers/NPConfiguration'
import { chooseOption, getInputTrimmed, showMessage } from '@helpers/userInput'

export type TPerspectiveOptionObject = { isModified?: boolean, label: string, value: string }

// Re-export for existing importers (PerspectiveSelector, perspectiveClickHandlers, etc.)
export { cleanDashboardSettingsInAPerspective, removeInvalidTagSections } from './dashboardSettingsClean'

/* -----------------------------------------------------------------------------
   Design logic
 -------------------------------------------------------------------------------

Default perspective = "-", when no others set.
- persisted as a name, but cannot be deleted
- it's a save of the last settings you made (before you switched into a named perspective). So the way I implemented it is that it saves your changes to the "-" perspective any time you are not in a perspective and make a change. So if you switch to "Work" and then switch back to "-" it returns you to your last state before you switched to "Work"
  * [x] ensure `-` cannot be deleted @done(2024-08-20)
  * [x] ensure `-` cannot be added as a new Perspective @done(2024-08-20)
- When we make changes to `-` it doesn't become `-*` but stays at `-`.

Named perspectives
- Created: by user through /save new perspective, or through settings UI.
  - perspective.isActive holds the name of the currently-active perspective.  We no longer want the isActive flag.
    * [x] #jgcDR: remove isActive flag @done(2024-08-20)
  - Adding a new perspective is working saving-wise, but it doesn't show in the dropdown. Adding a new perspective should update the dropdown selector list and set the dropdown to the new perspective. savePerspectiveSettings() or somewhere else in the flow needs to update the data in the window using `await setPluginData()`  See other examples of where this is used to update the various objects. 

- Read: through helper function loadPerspectiveDefsFromPluginSettings()

- Applied: through calling function switchToPerspective()
  > JGC new thought: Before changing to any other perspective, I think we should check whether current one isModified, and if it is offer to update/save it first. DBW agrees.
  > dbw says: it sure would be nice if we had a dialog that opened up inside the window. It's kind of jarring to have the NP main window pop up on you. Are you up for trying to create a dialog?

  * [ ] #jgcDR ask user whether to update a modified Perspective before changing to a new one -- but try to use a native dialog not NP main window

- Altered: by setting changes(s) made by user or callback.  
  - all the changes you are making are saved to your dashboardSettings
  - At this point a "*" is appended to the display name, via an `isModified` flag
  - However, the default Perspective `-` does not get shown as `-*`
  * [x] #jgcDR: add isModified flag (to separate logic from display, which might change in the future)

- Saved: by user through /update current perspective
  - done by calling updateCurrentPerspectiveDef(), which sets isModified to false

- Deleted: through settings UI or /delete current perspective.
  - updates list of available perspectives
  - set active perspective to default

-----------------------------------------------------------------------------*/

const pluginID = 'jgclark.Dashboard' // pluginJson['plugin.id']

const standardSettings = cleanDashboardSettingsInAPerspective(
  // $FlowIgnore[incompatible-call]
  [...dashboardSettingDefs, ...dashboardFilterDefs, ...showSectionSettingItems].reduce((acc, s) => {
    if (s.key) {
      // $FlowIgnore[prop-missing]
      acc[s.key] = s.default ?? true // turns on all settings without a default = all the showSection* settings
    }
    return acc
  }, {}),
)

/**
 * Get the default perspective settings for the first time perspectives are created.
 * The "-" perspective is set to active and has the user's current dashboardSettings.
 * The Home and Work perspectives are created but not active, and have the default settings.
 * @returns {Array<TPerspectiveDef>}
 */
export async function getPerspectiveSettingDefaults(): Promise<Array<TPerspectiveDef>> {
  const dashboardSettings = await getDashboardSettings()
  const dashboardSettingsWithPerspectiveDefaults = cleanDashboardSettingsInAPerspective({ ...standardSettings, ...dashboardSettings })

  clo(dashboardSettingsWithPerspectiveDefaults, 'getPerspectiveSettingDefaults')

  return [
    // $FlowIgnore[prop-missing] rest specified later
    {
      name: '-',
      isModified: false,
      dashboardSettings: { ...dashboardSettingsWithPerspectiveDefaults },
      isActive: true,
    },
    // $FlowIgnore[prop-missing] rest specified later
    {
      name: 'Home',
      isModified: false,
      // $FlowIgnore[incompatible-call]
      dashboardSettings: {
        ...dashboardSettingsWithPerspectiveDefaults,
        includedFolders: 'Home, Family',
        excludedFolders: 'Work, Summaries, Saved Searches',
        ignoreItemsWithTerms: '@work',
      },
      isActive: false,
    },
    // $FlowIgnore[prop-missing] rest specified later
    {
      name: 'Work',
      isModified: false,
      // $FlowIgnore[incompatible-call]
      dashboardSettings: {
        ...dashboardSettingsWithPerspectiveDefaults,
        includedFolders: 'Work, Company',
        excludedFolders: 'Home, Summaries, Saved Searches',
        ignoreItemsWithTerms: '@home',
      },
      isActive: false,
    },
  ]
}

/**
 * Log out short list of Perspective names (with active/modified flags)
 * @param {Array<TPerspectiveDef>} perspectivesArray
 */
export function logPerspectiveNames(perspectivesArray: Array<TPerspectiveDef>, preamble: string = ''): void {
  for (const thisP of perspectivesArray) {
    logDebug(preamble || 'logPerspectiveNames', ` - ${thisP.name}: ${thisP.isModified ? ' (modified)' : ''}${thisP.isActive ? ' <isActive>' : ''}`)
  }
}

/**
 * Log out short list of key Perspective details
 * @param {Array<TPerspectiveDef>} perspectivesArray
 * @param {boolean?} logAllKeys? (default: false)
 */
export function logPerspectives(perspectivesArray: Array<TPerspectiveDef>, logAllKeys: boolean = false): void {
  for (const thisP of perspectivesArray) {
    const name = thisP.name === '-' ? 'Default (-)' : thisP.name
    logDebug(
      'logPerspectives',
      `- ${name}: ${thisP.isModified ? ' (modified)' : ''}${thisP.isActive ? ' <isActive>' : ''} has ${Object.keys(thisP.dashboardSettings).length} dashboardSetting keys`,
    )

    if (logAllKeys) {
      clo(thisP.dashboardSettings, `${name}'s full dashboardSettings:`)
    } else {
      // Show main settings for Perspective filtering
      clof(thisP.dashboardSettings, `${name}'s main dashboardSettings:`, [
        'includedFolders',
        'excludedFolders',
        'ignoreItemsWithTerms',
        'maxItemsToShowInSection',
        'newTaskSectionHeadingLevel',
      ])
    }
  }
}

function ensureDefaultPerspectiveExists(perspectiveSettings: Array<TPerspectiveDef>): Array<TPerspectiveDef> {
  if (perspectiveSettings.find((s) => s.name === '-') === undefined) {
    logWarn('ensureDefaultPerspectiveExists', `Default perspective '-' not found in perspectiveSettings. Adding it.`)
    return [...perspectiveSettings, { name: '-', isModified: false, dashboardSettings: dashboardSettingsDefaults, isActive: false }]
  }
  return perspectiveSettings
}

//-----------------------------------------------------------------------------
// Getters
//-----------------------------------------------------------------------------

/**
 * Get all perspective settings (as array of TPerspectiveDef)
 * @param {boolean?} _logAllKeys? whether to log every setting key:value or just the key ones (default: false)
 * @returns {Array<TPerspectiveDef>} all perspective settings
 */
export async function loadPerspectiveDefsFromPluginSettings(_logAllKeys: boolean = false): Promise<Array<TPerspectiveDef>> {
  try {
    // Note: we think newer API call is unreliable. So use the older way:
    let perspectiveSettings: Array<TPerspectiveDef>
    const pluginSettings = await loadDashboardPluginSettings()
    const perspectiveSettingsRaw = pluginSettings?.perspectiveSettings

    if (Array.isArray(perspectiveSettingsRaw) && perspectiveSettingsRaw.length > 0) {
      perspectiveSettings = perspectiveSettingsRaw
    } else if (perspectiveSettingsRaw && perspectiveSettingsRaw !== '[]') {
      // Legacy: stringified JSON array (sanitize on load normally prevents this)
      perspectiveSettings = parseSettings(perspectiveSettingsRaw) ?? []
    } else {
      // No perspective settings found, so will need to set from the defaults instead
      logWarn('loadPerspectiveDefsFromPluginSettings', `No perspective settings found, so will load in the defaults. But first, I will save a copy of the settings.json file for investigation.`)
      await backupSettings('jgclark.Dashboard', 'when_no_perspective_settings_found', true)
      perspectiveSettings = await getPerspectiveSettingDefaults()
      const defaultPersp = getPerspectiveNamed('-', perspectiveSettings)
      if (!defaultPersp) {
        logError('loadPerspectiveDefsFromPluginSettings', `Couldn't get default perspective - from getPerspectiveSettingDefaults()`)
        return []
      }
      const dashboardSettings = await getDashboardSettings()
      // $FlowFixMe[prop-missing]
      // $FlowFixMe[incompatible-call]
      defaultPersp.dashboardSettings = { ...defaultPersp.dashboardSettings, ...cleanDashboardSettingsInAPerspective(dashboardSettings, true) }
      perspectiveSettings = replacePerspectiveDef(perspectiveSettings, defaultPersp)
      await savePerspectiveSettings(perspectiveSettings)
      logPerspectives(perspectiveSettings)
    }
    // clo(perspectiveSettings, `loadPerspectiveDefsFromPluginSettings: before ensureDefaultPerspectiveExists perspectiveSettings=`)
    const perspSettings = ensureDefaultPerspectiveExists(perspectiveSettings)
    // logDebug('loadPerspectiveDefsFromPluginSettings', `After ensureDefaultPerspectiveExists():`)
    // logPerspectives(perspectiveSettings, logAllKeys)
    return perspSettings
  } catch (error) {
    logError('loadPerspectiveDefsFromPluginSettings', `Error: ${error.message}`)
    return []
  }
}

/**
 * Get named Perspective definition
 * @param {string} name to find
 * @param {TDashboardSettings} perspectiveSettings
 * @returns {TPerspectiveDef | false}
 */
export function getPerspectiveNamed(name: string, perspectiveSettings: ?Array<TPerspectiveDef>): TPerspectiveDef | null {
  if (!perspectiveSettings) {
    return null
  }
  return perspectiveSettings.find((s) => s.name === name) ?? null
}

/**
 * Get active Perspective definition
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @returns {TPerspectiveDef | null}
 */
export function getActivePerspectiveDef(perspectiveSettings: Array<TPerspectiveDef>): TPerspectiveDef | null {
  if (!perspectiveSettings) {
    logWarn('getActivePerspectiveDef', `No perspectiveSettings found. Returning null.`)
    return null
  }
  return perspectiveSettings.find((s) => s.isActive === true) || null
}

/**
 * Get active Perspective name (or '-' if none)
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @returns {string}
 */
export function getActivePerspectiveName(perspectiveSettings: Array<TPerspectiveDef>): string {
  const activeDef = getActivePerspectiveDef(perspectiveSettings)
  return activeDef ? activeDef.name : '-'
}

/**
 * Replace the perspective definition with the given name with the new definition and return the revised full array.
 * If it doesn't exist, then add it to the end of the array.
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @param {TPerspectiveDef} newDef
 * @returns {Array<TPerspectiveDef>}
 */
export function replacePerspectiveDef(perspectiveSettings: Array<TPerspectiveDef>, newDef: TPerspectiveDef): Array<TPerspectiveDef> {
  // if there is no existing definition with the same name, then add it to the end of the array
  clo(newDef, `replacePerspectiveDef: newDef =`)
  const existingIndex = perspectiveSettings.findIndex((s) => s.name === newDef.name)
  if (existingIndex === -1) {
    logDebug('replacePerspectiveDef', `Didn't find perspective ${newDef.name} to update. List is now:`)
    logPerspectives(perspectiveSettings)
    return [...perspectiveSettings, newDef]
  }
  logDebug('replacePerspectiveDef', `Found perspective to update: ${newDef.name}. List is now:`)
  logPerspectives(perspectiveSettings)

  // TODO: Update tagCache definition list json

  return perspectiveSettings.map((s) => (s.name === newDef.name ? newDef : s))
}

/**
 * Set the isActive flag for the perspective with the given name (and false for all others) & reset isModified flag on all
 * @param {string} name
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @returns {Array<TPerspectiveDef>} the revised perspectiveSettings array
 */
export function setActivePerspective(name: string, perspectiveSettings: Array<TPerspectiveDef>): Array<TPerspectiveDef> {
  // map over perspectiveSettings, setting isActive to true for the one with name === name, and false for all others
  return perspectiveSettings ? perspectiveSettings.map((s) => ({
    ...s,
    isActive: s.name === name,
    isModified: false,
  })) : []
}

/**
 * Set the isActive flag for the perspective with the given name (and false for all others) & reset isModified flag on all. The isModified flag is only reset for the renamed perspective.
 * @param {string} oldName
 * @param {string} newName - the new name for the perspective
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @returns {Array<TPerspectiveDef>} the revised perspectiveSettings array
 */
export function renamePerspective(oldName: string, newName: string, perspectiveSettings: Array<TPerspectiveDef>): Array<TPerspectiveDef> {
  return perspectiveSettings.map((s) => (
    {
      ...s,
      name: s.name === oldName ? newName : s.name,
      isModified: s.name === oldName ? false : s.isModified  // Reset isModified for renamed perspective
    }))
}

/**
 * Private function to add a new Perspective definition to the array
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @param {TPerspectiveDef} newDef
 * @returns {Array<TPerspectiveDef>} the revised perspectiveSettings array
 */
function addPerspectiveDef(perspectiveSettings: Array<TPerspectiveDef>, newDef: TPerspectiveDef): Array<TPerspectiveDef> {
  return [...perspectiveSettings, newDef]
}

/**
 * Private function to delete a Perspective definition from the array
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @param {string} name
 * @returns {Array<TPerspectiveDef>} the revised perspectiveSettings array
 */
function deletePerspectiveDef(perspectiveSettings: Array<TPerspectiveDef>, name: string): Array<TPerspectiveDef> {
  return perspectiveSettings.filter((s) => s.name !== name)
}

/** Keys omitted when comparing live dashboard settings to a saved perspective def. */
const PERSPECTIVE_LIVE_VS_SAVED_COMPARE_OMIT: Array<string> = ['lastModified', 'lastChange', 'usePerspectives']

/**
 * Diff between a named perspective's saved def and live dashboard settings (null if equivalent).
 * Same rules as `resolvePerspectivesWhenDashboardSettingsWithoutPerspectivePayload` (defaults, tag sections).
 * @param {TPerspectiveDef} perspectiveDef
 * @param {Partial<TDashboardSettings>} liveDashboardSettings
 * @returns {?{ [string]: any }}
 */
export function getPerspectiveLiveVsSavedDiff(
  perspectiveDef: TPerspectiveDef,
  liveDashboardSettings: Partial<TDashboardSettings>,
): ?{ [string]: any } {
  if (!perspectiveDef || perspectiveDef.name === '-') return null
  const dashboardSettingsDefaults = getDashboardSettingsDefaults()
  const newSettingsWithDefaults = { ...dashboardSettingsDefaults, ...liveDashboardSettings }
  const activePerspDefDashboardSettingsWithDefaults = { ...dashboardSettingsDefaults, ...perspectiveDef.dashboardSettings }
  // $FlowFixMe[incompatible-call]
  const cleanedSettings = cleanDashboardSettingsInAPerspective(newSettingsWithDefaults)
  const activePerspDefShowTagSectionKeys = Object.keys(perspectiveDef.dashboardSettings || {}).filter((k) => k.startsWith('showTagSection_'))
  // $FlowIgnore[prop-missing] - Dynamic property access for tag section keys
  const activePerspDefShowTagSectionObject = activePerspDefShowTagSectionKeys.reduce((acc, k) => {
    acc[k] = perspectiveDef.dashboardSettings[k]
    return acc
  }, ({}: { [string]: any }))
  // $FlowIgnore[cannot-spread-indexer]
  const activePerspDefDashboardSettingsWithDefaultsAndTAGs = {
    ...activePerspDefDashboardSettingsWithDefaults,
    ...activePerspDefShowTagSectionObject,
  }
  const diff = compareObjects(activePerspDefDashboardSettingsWithDefaultsAndTAGs, cleanedSettings, PERSPECTIVE_LIVE_VS_SAVED_COMPARE_OMIT)
  if (diff === null || Object.keys(diff).length === 0) return null
  return diff
}

/**
 * Whether live top-level dashboard settings differ from a named perspective's saved def.
 * @param {TPerspectiveDef} perspectiveDef
 * @param {Partial<TDashboardSettings>} liveDashboardSettings
 * @returns {boolean}
 */
export function perspectiveDefDiffersFromLiveDashboard(
  perspectiveDef: TPerspectiveDef,
  liveDashboardSettings: Partial<TDashboardSettings>,
): boolean {
  return getPerspectiveLiveVsSavedDiff(perspectiveDef, liveDashboardSettings) !== null
}

/**
 * Whether live dashboard settings differ from the baseline snapshot (after switch or Save Perspective).
 * @param {Partial<TDashboardSettings>} baselineDashboardSettings
 * @param {Partial<TDashboardSettings>} liveDashboardSettings
 * @returns {boolean}
 */
export function liveDashboardDiffersFromBaseline(
  baselineDashboardSettings: Partial<TDashboardSettings>,
  liveDashboardSettings: Partial<TDashboardSettings>,
): boolean {
  const dashboardSettingsDefaults = getDashboardSettingsDefaults()
  const cleanedLive = cleanDashboardSettingsInAPerspective({ ...dashboardSettingsDefaults, ...liveDashboardSettings })
  const cleanedBaseline = cleanDashboardSettingsInAPerspective({ ...dashboardSettingsDefaults, ...baselineDashboardSettings })
  const diff = compareObjects(cleanedBaseline, cleanedLive, PERSPECTIVE_LIVE_VS_SAVED_COMPARE_OMIT)
  return diff !== null && Object.keys(diff).length > 0
}

export type TIsNamedPerspectiveModifiedOptions = {
  /** When true, also treat live-vs-saved-def as modified (needed for Save after switch carryover). */
  forSave?: boolean,
}

/**
 * Whether a named perspective should be treated as modified (`isModified` flag, drift from baseline, or live-vs-saved def).
 * Display: prefer baseline when set (avoids false `*` after switch when merge carryover ≠ raw def).
 * Save (`forSave: true`): also allow save when live differs from the saved def even if live matches baseline.
 * @param {TPerspectiveDef} perspectiveDef
 * @param {Partial<TDashboardSettings>} liveDashboardSettings
 * @param {Partial<TDashboardSettings>} [dashboardSettingsBaseline] - from pluginData after switch/save
 * @param {TIsNamedPerspectiveModifiedOptions} [options]
 * @returns {boolean}
 */
export function isNamedPerspectiveModified(
  perspectiveDef: TPerspectiveDef,
  liveDashboardSettings: Partial<TDashboardSettings>,
  dashboardSettingsBaseline?: Partial<TDashboardSettings>,
  options?: TIsNamedPerspectiveModifiedOptions,
): boolean {
  if (!perspectiveDef || perspectiveDef.name === '-') return false
  if (perspectiveDef.isModified) return true
  const hasBaseline = Boolean(dashboardSettingsBaseline && Object.keys(dashboardSettingsBaseline).length > 0)
  const differsFromBaseline = hasBaseline && liveDashboardDiffersFromBaseline(dashboardSettingsBaseline, liveDashboardSettings)
  const differsFromDef = perspectiveDefDiffersFromLiveDashboard(perspectiveDef, liveDashboardSettings)
  if (options?.forSave) {
    return differsFromBaseline || differsFromDef
  }
  if (differsFromBaseline) return true
  if (hasBaseline) return false
  return differsFromDef
}

/**
 * Save all perspective definitions. The array will be serialized by DataStore.saveJSON().
 * NOTE: from this NP automatically triggers NPHooks::onSettingsUpdated()
 * @param {Array<TPerspectiveDef>} allDefs perspective definitions
 * @return {boolean} true if successful
 */
export async function savePerspectiveSettings(allDefs: Array<TPerspectiveDef>): Promise<boolean> {
  try {
    logDebug(`savePerspectiveSettings saving ${allDefs.length} perspectives in DataStore.settings`)
    // First, update the tagMentionCache with the list of wanted tags and mentions (in case the list has changed)
    updateTagMentionCacheDefinitionsFromAllPerspectives(allDefs)
    const pluginSettings = await loadDashboardPluginSettings()
    pluginSettings.perspectiveSettings = allDefs

    // Save settings using the reliable helper ("the long way")
    const res = await saveDashboardPluginSettings(pluginSettings)
    logDebug('savePerspectiveSettings', `Apparently saved with result ${String(res)}. BUT BEWARE OF RACE CONDITIONS. DO NOT UPDATE THE REACT WINDOW DATA QUICKLY AFTER THIS.`)
    return res
  } catch (error) {
    logError('savePerspectiveSettings', `Error: ${error.message}`)
    return false
  }
}

/**
 * Get list of all Perspective names
 * @param {Array<TPerspectiveDef>} allDefs
 * @param {boolean} includeDefaultOption? (optional; default = true)
 * @returns {Array<{ label: string, value: string, isModified: boolean }>}
 */
export function getDisplayListOfPerspectiveNames(allDefs: Array<TPerspectiveDef>, includeDefaultOption: boolean = true): Array<TPerspectiveOptionObject> {
  try {
    if (!allDefs || allDefs.length === 0) {
      throw new Error(`No existing Perspective settings found.`)
    }

    const options = allDefs.map((def) => ({
      label: def.name,
      value: def.name,
      isModified: Boolean(def.isModified || false), // Ensure isModified is always a boolean
    }))
    let sortedOptions = options.sort((a, b) => a.label.localeCompare(b.label))

    if (!includeDefaultOption) {
      sortedOptions = sortedOptions.filter((obj) => obj.label !== '-')
    } else {
      sortedOptions = [...sortedOptions.filter((obj) => obj.label === '-'), ...sortedOptions.filter((obj) => obj.label !== '-')]
    }
    // $FlowIgnore
    return sortedOptions
  } catch (err) {
    logError('getDisplayListOfPerspectiveNames', err.message)
    return [{ label: '-', value: '-', isModified: false }]
  }
}
/**
 * Get all folders that are allowed in the current Perspective.
 * Note: used only by getReviewSettings() in Projects plugin.
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @returns {Array<string>}
 */
export function getAllowedFoldersInCurrentPerspective(perspectiveSettings: Array<TPerspectiveDef>): Array<string> {
  const activeDef = getActivePerspectiveDef(perspectiveSettings)
  if (!activeDef) {
    logWarn('getAllowedFoldersInCurrentPerspective', `No active Perspective, so returning empty list.`)
    return []
  }
  // Note: can't use simple .split(',') as it does unexpected things with empty strings.
  // Note: also needed to check that whitespace is trimmed.
  const includedFolderArr = stringListOrArrayToArray(activeDef.dashboardSettings.includedFolders ?? '', ',')
  const excludedFolderArr = stringListOrArrayToArray(activeDef.dashboardSettings.excludedFolders ?? '', ',')
  const folderListToUse = getFoldersMatching(includedFolderArr, true, excludedFolderArr)
  return folderListToUse
}

/**
 * Show how current perspective filtering applies to a given note
 * @param {string?} filenameArg optional -- if not supplied, then will ask user for a note
 */
export async function logPerspectiveFiltering(filenameArg?: string): Promise<void> {
  try {
    // The following logs the most important fields for each perspective definition
    const allPerspectiveDefs: Array<TPerspectiveDef> = await loadPerspectiveDefsFromPluginSettings(false)
    const dashboardSettings: TDashboardSettings = await getDashboardSettings()
    const activePerspectiveName = getActivePerspectiveName(allPerspectiveDefs)
    // Get list of allowed folders
    const allowedFolders1: Array<string> = getAllowedFoldersInCurrentPerspective(allPerspectiveDefs)
    logInfo('logPerspectiveFiltering', `${String(allowedFolders1.length)} allowedFolders for '${activePerspectiveName}': [${String(allowedFolders1)}]`)
    const allowedFolders2 = getCurrentlyAllowedFolders(dashboardSettings)
    logInfo('logPerspectiveFiltering', `${String(allowedFolders2.length)} currentlyAllowedFolders for '${activePerspectiveName}': [${String(allowedFolders2)}]`)

    // Get note to test against -- from param or user
    let filename = ''
    let note: ?TNote

    if (filenameArg && filenameArg !== '') {
      note = getNoteByFilename(filenameArg) // need helper that does both Calendar and Notes type
      // filename = filenameArg
    } else {
      // Ask user
      note = await chooseNoteV2('Choose note to test', allNotesSortedByChanged(), true, false, true)
    }
    if (!note) {
      throw new Error(`User cancelled, or otherwise couldn't get note for filename '${filename}'. Stopping.`)
    }
    filename = note.filename
    const folder = getFolderFromFilename(filename)
    console.log('')
    logInfo('logPerspectiveFiltering', `Starting for active perspective **${activePerspectiveName}**:`)
    logInfo('logPerspectiveFiltering', `for filename: '${filename}', folder: '${folder}', note: '${displayTitle(note)}'`)

    // Find open items if this is a Calendar Note
    if (note.type === 'Calendar') {
      // Force generation of separate lists for testing purposes
      dashboardSettings.separateSectionForReferencedNotes = true
      const [openDashboardParas, refOpenDashboardParas] = getOpenItemParasForTimePeriod(note.filename, getPeriodOfNPDateStr(note.filename), dashboardSettings, false)
      logInfo('', `There are ${String(openDashboardParas.length)} lines valid for this perspective in this note:`)
      openDashboardParas.forEach((p) => {
        console.log(`  - ${p.lineIndex}: ${p.type}: ${p.content}`)
      })
      logInfo('', `There are ${String(refOpenDashboardParas.length)} lines valid for this perspective, referenced to this note:`)
      refOpenDashboardParas.forEach((p) => {
        console.log(`  - ${p.lineIndex}: ${p.type}: filename ${p.filename}: ${p.content}`)
      })
    } else {
      // Not so obvious what to show for regular notes
    }
  } catch (error) {
    logError('logPerspectiveFiltering', error.message)
  }
}

//-----------------------------------------------------------------------------
// Setters
//-----------------------------------------------------------------------------

/**
 * Merge previous/live dashboard settings with a perspective def's saved settings.
 * Same rules as `doSwitchToPerspective` (strip tag sections / includedTeamspaces from previous, apply defaults, validate tags).
 * @param {TPerspectiveDef} perspectiveDef - perspective whose `dashboardSettings` are applied
 * @param {TDashboardSettings} prevDashboardSettings - current top-level dashboard settings before merge
 * @param {TDashboardSettings} dashboardSettingsDefaults - defaults for any keys missing from the def
 * @param {string} [lastChange] - optional `lastChange` value for the merged object
 * @returns {TDashboardSettings}
 */
export function mergeDashboardSettingsForPerspectiveDef(
  perspectiveDef: TPerspectiveDef,
  prevDashboardSettings: TDashboardSettings,
  dashboardSettingsDefaults: TDashboardSettings,
  lastChange?: string,
): TDashboardSettings {
  const prevWithoutTagSections: Partial<TDashboardSettings> = (Object.fromEntries(
    Object.entries(prevDashboardSettings).filter(([k]) => !k.startsWith('showTagSection_') && k !== 'includedTeamspaces'),
  ): any)
  let newDashboardSettings: TDashboardSettings = {
    ...dashboardSettingsDefaults,
    ...prevWithoutTagSections,
    ...(perspectiveDef.dashboardSettings || {}),
  }
  newDashboardSettings = removeInvalidTagSections(newDashboardSettings)
  if (lastChange) {
    newDashboardSettings.lastChange = lastChange
  }
  return newDashboardSettings
}

/**
 * Switch to the perspective with the given name (updates isActive flag on that one)
 * Saves perspectiveSettings to DataStore.settings but does not update dashboardSettings or anything else
 * Does not send the new PerspectiveSettings to the front end. Returns the new PerspectiveSettings or false if not found.
 * @param {string} name
 * @param {Array<TPerspectiveDef>} allDefs
 * @returns {boolean}
 */
export async function switchToPerspective(name: string, allDefs: Array<TPerspectiveDef>): Promise<Array<TPerspectiveDef> | false> {
  try {
    const startTime = new Date()
    // Check if perspective exists
    logDebug('switchToPerspective', `Starting looking for name ${name} in ...`)
    // logPerspectives(allDefs)

    const newPerspectiveSettings = setActivePerspective(name, allDefs).map((p) => ({
      ...p,
      isModified: false,
      // the following is a little bit inefficient, but given that people can change tags in numerous ways
      // we need to clean the dashboardSettings for each perspective just to be sure
      dashboardSettings: cleanDashboardSettingsInAPerspective(p.dashboardSettings),
    }))

    // logDebug('switchToPerspective', `New perspectiveSettings:`)
    // logPerspectives(newPerspectiveSettings)
    const newPerspectiveDef = getPerspectiveNamed(name, newPerspectiveSettings)
    if (!newPerspectiveDef) {
      logError('switchToPerspective', `Couldn't find definition for perspective "${name}"`)
      return false
    }
    logDebug('switchToPerspective', `Found '${name}'. Will save new perspectiveSettings: ${newPerspectiveDef.name} isModified=${String(newPerspectiveDef.isModified)} isActive=${String(newPerspectiveDef.isActive)}`)

    // SAVE IT!
    const res = await saveDashboardPluginSettings({
      ...(await loadDashboardPluginSettings()),
      perspectiveSettings: newPerspectiveSettings,
    })
    if (!res) {
      throw new Error(`saveDashboardPluginSettings failed for perspective ${name}`)
    }
    logDebug('switchToPerspective', `Saved new perspectiveSettings for ${name}`)

    // Note: Reviews list refresh is now invoked from doSwitchToPerspective after merged dashboardSettings are saved, not here.

    logTimer('switchToPerspective', startTime, `End of switchToPerspective`) // Note: never seems to get here?

    return newPerspectiveSettings
  } catch (error) {
    logError('switchToPerspective', `Error: ${error.message}`)
    return false
  }
}

/**
 * Update the current perspective settings (as a TPerspectiveDef) and persist.
 * Clear the isModified flag for the current perspective.
 * Note: Always called by user; never an automatic operation.
 * @returns {boolean} success
 */
export async function updateCurrentPerspectiveDef(): Promise<boolean> {
  try {
    const allDefs = await loadPerspectiveDefsFromPluginSettings()
    const activeDef: TPerspectiveDef | null = getActivePerspectiveDef(allDefs)

    if (!activeDef) {
      logWarn('updateCurrentPerspectiveDef', `Couldn't find definition for active perspective`)
      return false
    }
    activeDef.isModified = false
    const dSet: Partial<TDashboardSettings> = await getDashboardSettings()
    activeDef.dashboardSettings = cleanDashboardSettingsInAPerspective(dSet)
    const newDefs = replacePerspectiveDef(allDefs, activeDef)
    logDebug('updateCurrentPerspectiveDef', `Will update def '${activeDef.name}'`)
    const res = await savePerspectiveSettings(newDefs)
    return res
  } catch (error) {
    logError('updateCurrentPerspectiveDef', `Error: ${error.message}`)
    return false
  }
}

/**
 * Add a new Perspective setting. User just gives it a name, and otherwise uses the currently active settings.
 */
export async function addNewPerspective(nameArg?: string): Promise<void> {
  let allDefs = await loadPerspectiveDefsFromPluginSettings()
  logInfo('addPerspectiveSetting', `nameArg="${nameArg || ''}" Found ${allDefs.length} existing Perspectives ...`)

  // Get user input, if no arg passed
  let name = ''
  if (nameArg && nameArg !== '') {
    logDebug('addPerspectiveSetting', `Will use name "${nameArg}" passed from argument`)
    name = nameArg
  } else {
    const res = await getInputTrimmed('Enter name of new Perspective:', 'OK', 'Add Perspective', 'Test')
    if (typeof res === 'boolean' && !res) {
      logWarn('addPerspectiveSetting', `Cancelled adding new Perspective`)
      return
    }
    name = String(res)
  }
  if (name === '-') {
    logWarn('addPerspectiveSetting', `Cannot add default Perspective '-'.`)
    await showMessage(`Cannot add Perspective name '-' as that is the default name.`, 'Oh. I will try again', 'Perspectives')
    return
  }
  if (name[name.length - 1] === '*') {
    logWarn('addPerspectiveSetting', `Cannot add name a Perspective ending with a '*'.`)
    await showMessage(`Cannot add Perspective name '${name}' as it cannot end with a '*' character.`, 'Oh. I will try again', 'Perspectives')
    return
  }

  // Check we don't have this name in use already
  const existsAlready = allDefs.find((d) => d.name === name)
  if (existsAlready) {
    logWarn('addPerspectiveSetting', `Cannot add Perspective name '${name}' as it exists already.`)
    await showMessage(`Cannot add Perspective name '${name}' as it exists already.`, 'Oops', 'Perspectives')
    return
  }

  const currentDashboardSettings = await getDashboardSettings()
  const newDef: TPerspectiveDef = {
    name: name,
    isActive: true,
    isModified: false,
    dashboardSettings: {
      ...cleanDashboardSettingsInAPerspective(currentDashboardSettings),
    },
  }
  logInfo('addPerspectiveSetting', `... adding Perspective #${String(allDefs.length)}:\n${JSON.stringify(newDef, null, 2)}`) // ✅
  allDefs = allDefs.map((d) => ({ ...d, isModified: false, isActive: false }))

  // persist the updated Perpsective settings
  const updatedPerspectives = addPerspectiveDef(allDefs, newDef)

  // saves the perspective settings to DataStore.settings
  const res = await savePerspectiveSettings(updatedPerspectives)
  logDebug('addPerspectiveSetting', `- Saved '${name}': now ${String(updatedPerspectives.length)} perspectives (with the new one (${name}) active). Result: ${String(res)}`)

  const newActiveDef = getPerspectiveNamed(name, updatedPerspectives)
  if (newActiveDef) {
    const dashboardSettingsDefaults = getDashboardSettingsDefaults()
    const newDashboardSettings = mergeDashboardSettingsForPerspectiveDef(
      newActiveDef,
      currentDashboardSettings,
      dashboardSettingsDefaults,
      `_Added perspective ${name} ${dt()} changed from plugin`,
    )
    const saveBoth = await saveDashboardPluginSettings({
      ...(await loadDashboardPluginSettings()),
      perspectiveSettings: updatedPerspectives,
      dashboardSettings: newDashboardSettings,
    })
    logDebug('addPerspectiveSetting', `- Synced top-level dashboardSettings for new active perspective: ${String(saveBoth)}`)
    const perspectiveNames = updatedPerspectives.map((p) => p.name).join(', ')
    await setPluginData(
      {
        perspectiveSettings: updatedPerspectives,
        dashboardSettings: newDashboardSettings,
        pushFromServer: { dashboardSettings: true, perspectiveSettings: true },
      },
      `after adding Perspective ${name}; List of perspectives: [${perspectiveNames}]`,
    )
  } else {
    const perspectiveNames = updatedPerspectives.map((p) => p.name).join(', ')
    await setPluginData({ perspectiveSettings: updatedPerspectives }, `after adding Perspective ${name}; List of perspectives: [${perspectiveNames}]`)
  }
  logDebug('addPerspectiveSetting', `- After setPluginData`)
}

/**
 * Delete all Perspective settings, other than default
 */
export async function deleteAllNamedPerspectiveSettings(): Promise<void> {
  logDebug('deleteAllNamedPerspectiveSettings', `Attempting to delete all Perspective settings (other than default) ...`)
  let allDefs = await loadPerspectiveDefsFromPluginSettings()
  for (const p of allDefs) {
    if (p.name !== '-') {
      await deletePerspective(p.name)
    }
  }
  logDebug('deleteAllNamedPerspectiveSettings', `Deleted all named perspectives, other than default.`)

  const onlyDefaultPerspectiveDef: Array<TPerspectiveDef> = await loadPerspectiveDefsFromPluginSettings()
  const updatedListOfPerspectives = getDisplayListOfPerspectiveNames(onlyDefaultPerspectiveDef)
  logDebug('deleteAllNamedPerspectiveSettings', `New default list of available perspectives: [${String(updatedListOfPerspectives ?? [])}]`)

  // Set current perspective to default ("-")
  const newPerspectiveSettings = await switchToPerspective('-', onlyDefaultPerspectiveDef)
  if (newPerspectiveSettings) {
    await setPluginData({ perspectiveSettings: newPerspectiveSettings }, `_Deleted all named perspectives`)
  } else {
    logWarn('deleteAllNamedPerspectiveSettings', `switchToPerspective("-") failed; not updating React window`)
  }

  // Update tagCache definition list json
  updateTagMentionCacheDefinitionsFromAllPerspectives(onlyDefaultPerspectiveDef)
  logDebug('deleteAllNamedPerspectiveSettings', `Result of switchToPerspective("-"): ${String(newPerspectiveSettings)}`)
}

/**
 * Delete a Perspective definition from dashboardSettings.
 * Can be called from callback: noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=Delete%20Perspective&arg0=Test
 * @param {string} nameIn
 */
export async function deletePerspective(nameIn: string = ''): Promise<void> {
  try {
    let nameToUse = nameIn || ''
    // const dashboardSettings = (await getDashboardSettings()) || {}
    const existingDefs = (await loadPerspectiveDefsFromPluginSettings()) || []
    if (existingDefs.length === 0) {
      throw new Error(`No perspective settings found. Stopping.`)
    }
    if (nameIn === '-') {
      logWarn('deletePerspective', `Cannot delete default Perspective '-'.`)
      return
    }

    logInfo('deletePerspective', `Starting with param '${nameIn}' and perspectives:`)
    logPerspectives(existingDefs)
    const defToDelete = getPerspectiveNamed(nameIn, existingDefs)
    if (nameIn !== '' && defToDelete) {
      nameToUse = nameIn
      logInfo('deletePerspective', `Will delete perspective '${nameToUse}' passed as parameter`)
    } else {
      logInfo('deletePerspective', `Asking user to pick perspective to delete (apart from default)`)
      const options = getDisplayListOfPerspectiveNames(existingDefs, false).map((o) => ({ label: o.label, value: o.value }))
      const res = await chooseOption('Please pick the Perspective to delete', options)
      if (!res) {
        logInfo('deletePerspective', `User cancelled operation.`)
        return
      }
      nameToUse = String(res)
      logInfo('deletePerspective', `Will delete perspective '${nameToUse}' selected by user`)
    }

    // if this is the active perspective, then set the activePerspectiveName to default
    const activeDef = getActivePerspectiveDef(existingDefs)
    if (activeDef && nameToUse === activeDef.name) {
      // delete and then switch
      logDebug('deletePerspective', `Deleting active perspective, so will need to switch to default Perspective ("-")`)
      const updatedDefs = deletePerspectiveDef(existingDefs, nameToUse)
      const res = await savePerspectiveSettings(updatedDefs)
      const switchedDefs = await switchToPerspective('-', updatedDefs)
      const perspForPlugin = switchedDefs || updatedDefs
      // update/refresh PerspectiveSelector component (must use post-switch defs so isActive is correct)
      await setPluginData({ perspectiveSettings: perspForPlugin }, `after deleting active Perspective ${nameToUse}.`)
    } else {
      // just delete
      const updatedDefs = deletePerspectiveDef(existingDefs, nameToUse)
      const res = await savePerspectiveSettings(updatedDefs)
      // update/refresh PerspectiveSelector component
      await setPluginData({ perspectiveSettings: updatedDefs }, `after deleting Perspective ${nameToUse}.`)
    }

    // TODO: Update tagCache definition list json

    clof(DataStore.settings, `deletePerspective at end DataStore.settings =`, ['name', 'isActive'], true) // ✅
  } catch (error) {
    logError('deletePerspective', error.message)
  }
}

//-----------------------------------------------------------------------------
// Other Helpers
//-----------------------------------------------------------------------------

/**
 * Is the filename from the given list of folders?
 * @param {TNote} note
 * @param {Array<string>} folderList
 * @param {boolean} allowAllCalendarNotes (optional, defaults to true)
 * @returns {boolean}
 */
export function isNoteInAllowedFolderList(note: TNote, folderList: Array<string>, allowAllCalendarNotes: boolean = true): boolean {
  // Is note a Calendar note or is in folderList?
  const matchFound = (allowAllCalendarNotes && note.type === 'Calendar') || folderList.some((f) => note.filename.includes(f))
  // logDebug('isFilenameIn...FolderList', `- ${matchFound ? 'match' : 'NO match'} to ${note.filename} from ${String(folderList.length)} folders`)
  return matchFound
}

export const endsWithStar = (input: string): boolean => /\*$/.test(input)

/**
 * Set (in React) perspectiveSettings if it has changed via the JSON editor in the Dashboard Settings panel
 * Return the updated settings object without the perspectiveSettings to be saved as dashboardSettings
 * @param {TDashboardSettings} updatedSettings
 * @param {TDashboardSettings} dashboardSettings
 * @param {Function} sendActionToPlugin
 * @param {string} logMessage
 * @returns {TDashboardSettings}
 */
export function setPerspectivesIfJSONChanged(
  updatedSettings: Partial<TDashboardSettings>,
  dashboardSettings: TDashboardSettings,
  sendActionToPlugin: Function,
  logMessage: string,
): TDashboardSettings {
  logDebug('setPerspectivesIfJSONChanged', `🥷 starting reason "${logMessage}"`)
  const settingsToSave = { ...dashboardSettings, ...updatedSettings }
  if (settingsToSave.perspectiveSettings) {
    // this should only be true if we are coming from the settings panel with the JSON editor
    // TODO(dwertheimer): I don't understand this log comment
    logDebug(pluginJson, `BEWARE: adjustSettingsAndSave perspectiveSettings was set. this should only be true if we are coming from the settings panel with the JSON editor!`)
    sendActionToPlugin(
      'perspectiveSettingsChanged',
      { settings: settingsToSave.perspectiveSettings, actionType: 'perspectiveSettingsChanged', logMessage: `JSON editor: ${logMessage}` },
      `Perspectives updated`,
      true,
    )
    delete settingsToSave.perspectiveSettings
  }
  return settingsToSave
}
