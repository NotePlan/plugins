
// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin helper functions for Perspectives
// Last updated 2025-06-05 for v2.2.2
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
// import { generateProjectListsAndRenderIfOpen, renderProjectListsIfOpen } from '../../jgclark.Reviews/src/reviews.js' // produces circular dependency
import { getDashboardSettings, getOpenItemParasForTimePeriod, setPluginData } from './dashboardHelpers.js'
import { dashboardSettingsDefaults } from './react/support/settingsHelpers'
import { getTagSectionDetails, showSectionSettingItems } from './react/components/Section/sectionHelpers'
import { dashboardFilterDefs, dashboardSettingDefs } from './dashboardSettings.js'
import { getCurrentlyAllowedFolders } from './perspectivesShared'
import { parseSettings } from './shared'
import { updateTagMentionCacheDefinitionsFromAllPerspectives } from './tagMentionCache'
import type { TDashboardSettings, TDashboardPluginSettings, TPerspectiveDef } from './types'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { getPeriodOfNPDateStr } from '@helpers/dateTime'
import { clo, clof, clvt, JSP, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getFolderFromFilename, getFoldersMatching } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged, getNoteByFilename } from '@helpers/note'
import { chooseNoteV2 } from '@helpers/NPnote'
import { getSettings, saveSettings } from '@helpers/NPConfiguration'
import { isHTMLWindowOpen } from '@helpers/NPWindows'
import { chooseOption, getInputTrimmed, showMessage } from '@helpers/userInput'
export type TPerspectiveOptionObject = { isModified?: boolean, label: string, value: string }

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

- Read: through helper function getPerspectiveSettings()

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
    // $FlowFixMe[prop-missing] // an empty dashboardSettings is ok but does not match TDashboardSettings
    return [...perspectiveSettings, { name: '-', isModified: false, dashboardSettings: dashboardSettingsDefaults, isActive: false }]
  }
  return perspectiveSettings
}

//-----------------------------------------------------------------------------
// Getters
//-----------------------------------------------------------------------------

/**
 * Get all perspective settings (as array of TPerspectiveDef)
 * @param {boolean?} logAllKeys? whether to log every setting key:value or just the key ones (default: false)
 * @returns {Array<TPerspectiveDef>} all perspective settings
 */
export async function getPerspectiveSettings(logAllKeys: boolean = false): Promise<Array<TPerspectiveDef>> {
  try {
    // Note: we think following (newer API call) is unreliable.
    // So use the older way:
    let perspectiveSettings: Array<TPerspectiveDef>
    const pluginSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    const perspectiveSettingsStr = pluginSettings?.perspectiveSettings

    if (perspectiveSettingsStr && perspectiveSettingsStr !== '[]') {
      // must parse it because it is stringified JSON (an array of TPerspectiveDef)
      perspectiveSettings = parseSettings(perspectiveSettingsStr) ?? []
      // logPerspectives(perspectiveSettings, logAllKeys)
    } else {
      // No settings found, so will need to set from the defaults instead
      logWarn('getPerspectiveSettings', `No settings found: will load in the defaults:`)
      perspectiveSettings = await getPerspectiveSettingDefaults()
      const defaultPersp = getPerspectiveNamed('-', perspectiveSettings)
      if (!defaultPersp) {
        logError('getPerspectiveSettings', `getDefaultPerspectiveDef failed`)
        return []
      }
      const dashboardSettings = await getDashboardSettings()
      defaultPersp.dashboardSettings = { ...defaultPersp.dashboardSettings, ...cleanDashboardSettingsInAPerspective(dashboardSettings) }
      perspectiveSettings = replacePerspectiveDef(perspectiveSettings, defaultPersp)
      logPerspectives(perspectiveSettings)
    }
    // clo(perspectiveSettings, `getPerspectiveSettings: before ensureDefaultPerspectiveExists perspectiveSettings=`)
    const perspSettings = ensureDefaultPerspectiveExists(perspectiveSettings)
    // logDebug('getPerspectiveSettings', `After ensureDefaultPerspectiveExists():`)
    // logPerspectives(perspectiveSettings, logAllKeys)
    return perspSettings
  } catch (error) {
    logError('getPerspectiveSettings', `Error: ${error.message}`)
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
 * @returns {Array<TPerspectiveDef>}
 */
export function setActivePerspective(name: string, perspectiveSettings: Array<TPerspectiveDef>): Array<TPerspectiveDef> {
  // map over perspectiveSettings, setting isActive to true for the one with name === name, and false for all others
  return perspectiveSettings ? perspectiveSettings.map((s) => ({ ...s, isActive: s.name === name, isModified: false })) : []
}

/**
 * Set the isActive flag for the perspective with the given name (and false for all others) & reset isModified flag on all
 * @param {string} name
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @returns {Array<TPerspectiveDef>}
 */
export function renamePerspective(oldName: string, newName: string, perspectiveSettings: Array<TPerspectiveDef>): Array<TPerspectiveDef> {
  return perspectiveSettings.map((s) => ({ ...s, name: s.name === oldName ? newName : s.name }))
}

/**
 * Private function to add a new Perspective definition to the array
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @param {TPerspectiveDef} newDef
 * @returns {Array<TPerspectiveDef>}
 */
function addPerspectiveDef(perspectiveSettings: Array<TPerspectiveDef>, newDef: TPerspectiveDef): Array<TPerspectiveDef> {
  return [...perspectiveSettings, newDef]
}

/**
 * Private function to delete a Perspective definition from the array
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @param {string} name
 * @returns {Array<TPerspectiveDef>}
 */
function deletePerspectiveDef(perspectiveSettings: Array<TPerspectiveDef>, name: string): Array<TPerspectiveDef> {
  return perspectiveSettings.filter((s) => s.name !== name)
}

/**
 * Save all perspective definitions as a stringified array, to suit the forced type of the hidden setting.
 * NOTE: from this NP automatically triggers NPHooks::onSettingsUpdated()
 * @param {Array<TPerspectiveDef>} allDefs perspective definitions
 * @return {boolean} true if successful
 */
export async function savePerspectiveSettings(allDefs: Array<TPerspectiveDef>): Promise<boolean> {
  try {
    logDebug(`savePerspectiveSettings saving ${allDefs.length} perspectives in DataStore.settings`)
    // TODO(later): we need to update the tagMentionCache with the new list of wanted tags and mentions
    updateTagMentionCacheDefinitionsFromAllPerspectives(allDefs)
    const perspectiveSettingsStr = JSON.stringify(allDefs) ?? ''
    const pluginSettings = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    pluginSettings.perspectiveSettings = perspectiveSettingsStr

    // Save settings using the reliable helper ("the long way")
    const res = await saveSettings(pluginID, pluginSettings)
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
 * WARNING: This is not used any more. Test before use.
 * Get all folders that are allowed in the current Perspective.
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @returns
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
    const allPerspectiveDefs: Array<TPerspectiveDef> = await getPerspectiveSettings(false)
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
    logDebug(
      'switchToPerspective',
      `Found "${name}" Will save new perspectiveSettings: ${newPerspectiveDef.name} isModified=${String(newPerspectiveDef.isModified)} isActive=${String(
        newPerspectiveDef.isActive,
      )}`,
    )

    // SAVE IT!
    const res = await saveSettings(pluginID, { ...await getSettings('jgclark.Dashboard'), perspectiveSettings: JSON.stringify(newPerspectiveSettings) })
    if (!res) {
      throw new Error(`saveSettings failed for perspective ${name}`)
    }
    logDebug('switchToPerspective', `Saved new perspectiveSettings for ${name}`)
    // clo(
    //   newPerspectiveSettings.map((p) => ({ name: p.name, isModified: p.isModified })),
    //   'switchToPerspective: newPerspectiveSettings saved to DataStore.settings',
    // )

    // Send message to Reviews (if that window is open) to re-generate the Projects list and render it
    // TEST: Now not await-ing this, because it can take a long time and we don't want to block the main thread.
    // FIXME: Even so, is still taking a long time, and appears to be blocking the main thread.
    // logTimer('switchToPerspective', startTime, `Sending message to Reviews to regenerate the Projects List and render it.`)
    // const _promise = DataStore.invokePluginCommandByName('generateProjectListsAndRenderIfOpen', 'jgclark.Reviews', [])
    // const _promise = generateProjectListsAndRenderIfOpen()
    // logTimer('switchToPerspective', startTime, `Sending message to Reviews to regenerate the Projects List and render it.`)

    // v3: Work out whether Project list window is open, and if so, re-render it
    if (isHTMLWindowOpen('jgclark.Reviews.rich-review-list')) {
      // TEST: still not convinced that this is firing and forgetting. At least we're not doing anything if the Project List window is not open.
      logTimer('switchToPerspective', startTime, `Sending message to Reviews to render project list as it is open.`)
      const _promise = DataStore.invokePluginCommandByName('renderProjectListsIfOpen', 'jgclark.Reviews', [])
      logTimer('switchToPerspective', startTime, `Sent message to Reviews`) // Note: never seems to get here
    }

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
    const allDefs = await getPerspectiveSettings()
    const activeDef: TPerspectiveDef | null = getActivePerspectiveDef(allDefs)

    if (!activeDef) {
      logWarn('updateCurrentPerspectiveDef', `Couldn't find definition for active perspective`)
      return false
    }
    activeDef.isModified = false
    // $FlowIgnore // doesn't like the partial settings
    const dSet: Partial<TDashboardSettings> = await getDashboardSettings()
    activeDef.dashboardSettings = dSet
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
 * Clean a Dashboard settings object of properties we don't want to use or see
 * (we only want things in the perspectiveSettings object that could be set in dashboard settings or filters).
 * FIXME: some number settings arrive here as strings.
 * TODO: Is it true that sometimes this will be called with a partial object, and sometimes with a full object?
 * It can be called before doing a comparison with the active perspective settings.
 * Note: index.js::onUpdateOrInstall() does the renaming of keys in the settings object.
 * @param {TDashboardPluginSettings} settingsIn
 * @param {boolean} deleteAllShowTagSections - also clean out showTag_* settings
 * @returns {TDashboardPluginSettings}
 */
export function cleanDashboardSettingsInAPerspective(settingsIn: TDashboardPluginSettings, deleteAllShowTagSections?: boolean): Partial<TDashboardPluginSettings> {
  // Define keys to remove
  const patternsToRemove = [
    // the following shouldn't be persisted in the perspectiveSettings object, but only in the top-level dashboardSettings object
    'perspectivesEnabled',
    'usePerspectives',
    /FFlag_/,
    /_log/,
    'pluginID',
    'lastChange',
    'timeblockMustContainString',
    'defaultFileExtension',
    'doneDatesAvailable',
    'migratedSettingsFromOriginalDashboard',
    'triggerLogging',
    /separator\d/,
    /heading\d/,
    // the following were added in v2.2.0
    'searchOptions',
  ].map((pattern) => (typeof pattern === 'string' ? new RegExp(`^${pattern}`) : pattern))
  if (deleteAllShowTagSections) {
    patternsToRemove.push(/showTagSection_/)
  }

  function shouldRemoveKey(key: string): boolean {
    return patternsToRemove.some((pattern) => pattern.test(key))
  }

  try {
    if (!settingsIn || settingsIn === {}) {
      throw new Error(`No settingsIn found`)
    }

    // logDebug('cleanDashboardSettingsInAPerspective', `Starting for:`)
    // clvt(settingsIn.newTaskSectionHeadingLevel, 'cleanDashboard...  starting newTaskSectionHeadingLevel')
    // clvt(settingsIn.maxItemsToShowInSection, 'cleanDashboard...  starting maxItemsToShowInSection')

    // Filter out any showTagSection_ keys that are not used in the current perspective (i.e. not in tagsToShow)
    const perspSettingsWithoutIrrelevantTags = removeInvalidTagSections(settingsIn) // OK

    const settingsOut = Object.keys(perspSettingsWithoutIrrelevantTags).reduce((acc: Partial<TDashboardSettings>, key) => {
      if (!shouldRemoveKey(key)) {
        acc[key] = settingsIn[key]
      } else {
        logDebug('cleanDashboardSettingsInAPerspective', `- Removing key '${key}'`)
      }
      return acc
    }, {})

    return settingsOut
  } catch (error) {
    logError('cleanDashboardSettingsInAPerspective', `Error: ${error.message}`)
    return {}
  }
}

/**
 * Remove tag sections from the dashboard settings that are not relevant to the current perspective
 * (e.g. leaving only the tags included in dashboardSettings.tagsToShow)
 * @param {TDashboardSettings} settingsIn
 * @returns {TDashboardSettings} - settings without irrelevant tag sections
 */
export function removeInvalidTagSections(settingsIn: TDashboardSettings): TDashboardSettings {
  // aka validateTagSections validateTags limitTagsToShow
  const tagSectionDetails = getTagSectionDetails(settingsIn)
  const showTagSectionKeysToRemove = Object.keys(settingsIn).filter(
    (key) => key.startsWith('showTagSection_') && !tagSectionDetails.some((detail) => detail.showSettingName === key),
  )

  // Remove the keys only if they exist and are defined
  showTagSectionKeysToRemove.forEach((key) => {
    if (settingsIn[key] !== undefined && typeof settingsIn[key] === 'boolean') {
      // $FlowIgnore[incompatible-type]
      delete settingsIn[key]
    }
  })
  return settingsIn
}

/**
 * Add a new Perspective setting. User just gives it a name, and otherwise uses the currently active settings.
 */
export async function addNewPerspective(nameArg?: string): Promise<void> {
  let allDefs = await getPerspectiveSettings()
  logInfo('addPerspectiveSetting', `nameArg="${nameArg || ''}" Found ${allDefs.length} existing Perspectives ...`)

  // Get user input, if no arg passed
  let name = ''
  if (nameArg && nameArg !== '') {
    logDebug('addPerspectiveSetting', `Will use name "${nameArg}" passed from argument`)
    name = nameArg
  } else {
    const res = await getInputTrimmed('Enter name of new Perspective:', 'OK', 'Add Perspective', 'Test')
    if (typeof name === 'boolean') {
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

  const perspectiveNames = updatedPerspectives.map((p) => p.name).join(', ')
  // NOTE: make sure to use _ in front of the lastUpdate key to keep it from looping back thinking the setting had been updated by the user
  await setPluginData({ perspectiveSettings: updatedPerspectives }, `after adding Perspective ${name}; List of perspectives: [${perspectiveNames}]`)
  logDebug('addPerspectiveSetting', `- After setPluginData`)
  // DBW commenting this out because it was causing a race condition whereby window data was not updated in time for the next call
  // const res2 = await switchToPerspective(name, updatedPerspectives)
}

/**
 * Delete all Perspective settings, other than default
 */
export async function deleteAllNamedPerspectiveSettings(): Promise<void> {
  logDebug('deleteAllNamedPerspectiveSettings', `Attempting to delete all Perspective settings (other than edfault) ...`)
  // v1
  // const pluginSettings = DataStore.settings
  // pluginSettings.perspectiveSettings = "[]"
  // const dSettings = await getDashboardSettings()
  // $FlowIgnore
  // delete dSettings.perspectiveSettings
  // pluginSettings.dashboardSettings = JSON.stringify(dSettings)
  // clo(pluginSettings.perspectiveSettings, `... leaves: pluginSettings.perspectiveSettings =`)
  // DataStore.settings = pluginSettings

  // V2
  let allDefs = await getPerspectiveSettings()
  for (const p of allDefs) {
    if (p.name !== '-') {
      await deletePerspective(p.name)
    }
  }
  logDebug('deleteAllNamedPerspectiveSettings', `Deleted all named perspectives, other than default.`)

  allDefs = await getPerspectiveSettings()
  const updatedListOfPerspectives = getDisplayListOfPerspectiveNames(allDefs)
  logDebug('deleteAllNamedPerspectiveSettings', `New default list of available perspectives: [${String(updatedListOfPerspectives ?? [])}]`)

  // Set current perspective to default ("-")
  const newPerspectiveSettings = await switchToPerspective('-', allDefs)
  await setPluginData({ perspectiveSettings: newPerspectiveSettings }, `_Deleted all named perspectives`)

  // TODO: Update tagCache definition list json
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
    const existingDefs = (await getPerspectiveSettings()) || []
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
      await switchToPerspective('-', updatedDefs)
      // update/refresh PerspectiveSelector component
      await setPluginData({ perspectiveSettings: updatedDefs }, `after deleting Perspective ${nameToUse}.`)
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
  updatedSettings: any /*TDashboardSettings*/, // TODO: improve type - can be partial settings object
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
