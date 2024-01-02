// @flow
//---------------------------------------------------------------
// Helper functions for WindowTools plugin
// Jonathan Clark
// last update 27.12.2023 for v1.0.0 by @jgclark
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getCodeBlocks, getCodeBlocksOfType } from '@helpers/codeBlocks'
import { toLocaleDateTimeString } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getOrMakeNote } from '@helpers/note'
import { addTrigger } from '@helpers/NPFrontMatter'
import { constrainWindowSizeAndPosition } from '@helpers/NPWindows'
import { showMessage, showMessageYesNo } from '@helpers/userInput'


//-----------------------------------------------------------------

const pluginID = 'jgclark.WindowSets'

// Plugin lookup list
export type PluginWindowCommand = {
  pluginWindowId: string,
  pluginID: string,
  pluginCommandName: string
}

// Plugin command name lookup list (note: all values are case sensitive!)
export const pluginWindowsAndCommands: Array<PluginWindowCommand> = [
  { pluginWindowId: 'jgclark.Dashboard.main', pluginID: 'jgclark.Dashboard', pluginCommandName: 'show dashboard' },
  { pluginWindowId: 'jgclark.Reviews.rich-review-list', pluginID: 'jgclark.Reviews', pluginCommandName: 'project lists' },
  { pluginWindowId: 'rich-review-list', pluginID: 'jgclark.Reviews', pluginCommandName: 'project lists' },
  { pluginWindowId: 'jgclark.Summaries.heatmap', pluginID: 'jgclark.Summaries', pluginCommandName: 'heatmap for task completion' },
]

//-----------------------------------------------------------------
// Data types
// Note: x/y/w/h are available on all window types since v3.9.1 build 1020
export type EditorWinDetails = {
  noteType: string, // NP NoteType "Calendar" | "Notes"
  filename: string,
  windowType: string, // "main" | "floating" | "split"
  title?: string, // optional, but persist it where used
  id?: string, // optional, but persist it where used
  x: number,
  y: number,
  width: number,
  height: number,
}

export type HTMLWinDetails = {
  type: string, // "Plugin" is the only type supported so far
  pluginID: string,
  pluginCommandName: string,
  customId?: string, // If set to the same as the plugin sets, then you can override the last-stored x/y/width/height of the window
  x: number,
  y: number,
  width: number,
  height: number,
  // filename, customID are set by the plugin command itself so aren't needed here
}

export type WindowSet = {
  name: string,
  closeOtherWindows: boolean,
  editorWindows: Array<EditorWinDetails>, // really 'editorWinDetails'
  htmlWindows: Array<HTMLWinDetails>,// really 'htmlWinDetails'
  machineName: string
}

//---------------------------------------------------------------
// Settings

export type WindowSetsConfig = {
  folderForDefinitions: string,
  noteTitleForDefinitions: string,
  _logDebug: String,
}

/**
 * Get general config settings for this plugin
 * TODO: Specialise to get or make note for this plugin
 * @return {any} object with configuration
 */
export async function getPluginSettings(): Promise<any> {
  try {
    // Get settings
    const config: WindowSetsConfig = await DataStore.loadJSON(`../${pluginID}/settings.json`)
    // clo(config, `${pluginID} settings:`)

    if (config == null || Object.keys(config).length === 0) {
      throw new Error(`Cannot find settings for '${pluginID}' plugin`)
    }

    return config
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return null // for completeness
  }
}

//---------------------------------------------------------------
/**
 * Write the supplied WindowSets to the specified NP note, replacing previous content
 * @param {string} noteFolder to write to
 * @param {string} noteTitle to write to
 * @param {Array<WindowSet>} windowSets
 * @returns
 */
export async function writeWSsToNote(noteFolderArg: string = '', noteTitleArg: string = '', windowSetsArg: Array<WindowSet> = []): Promise<boolean> {
  try {
    const config = await getPluginSettings()
    const noteFolder = (noteFolderArg !== '') ? noteFolderArg : config.folderForDefinitions
    const noteTitle = (noteTitleArg !== '') ? noteTitleArg : config.noteTitleForDefinitions
    const windowSets = (windowSetsArg.length > 0) ? windowSetsArg : readWindowSetDefinitions()
    logDebug(pluginJson, `writeWSsToNote() starting for folder '${noteFolder}' title '${noteTitle}'`)
    const WSNote: ?TNote = await getOrMakeNote(noteTitle, noteFolder)
    if (!WSNote) {
      throw new Error(`writeWSsToNote() no note found for '${noteTitle}' in folder '${noteFolder}'`)
    }
    // logDebug('writeWSsToNote', `- ${displayTitle(WSNote)} / ${noteTitle}`)

    // Make string from WindowSet object
    const windowSetsStr = JSON.stringify(windowSets, null, 2)
    // logDebug('writeWSsToNote', `writeWSsToNote() windowSetsStr:\n${windowSetsStr}`)
    // Make note lines
    const outputLines = []
    const currentDateTime = toLocaleDateTimeString(new Date())
    outputLines.push(`---`)
    outputLines.push(`title: ${noteTitle}`)
    // outputLines.push(`Last updated at ${currentDateTime} by WindowSets plugin`)
    outputLines.push(`triggers: onEditorWillSave => jgclark.WindowSets.sync window set note to pref`)
    outputLines.push(`---`)
    outputLines.push(`These are the definitions of your currently available **Window Sets**, for use with the Window Sets plugin. You can update the settings if you wish.`)
    outputLines.push(`They are specified in JSON, which has to be well-formatted to be usable. In particular check that there aren't any extra commas after the final item of any section.`)
    outputLines.push(`Note: please leave trigger in the frontmatter above, or changes will not be saved behind the scenes.`)
    outputLines.push(``)
    outputLines.push('```json')
    outputLines.push('{')
    outputLines.push(`"date": "${currentDateTime}",`)
    outputLines.push('"WS":')
    outputLines.push(windowSetsStr)
    outputLines.push('}')
    outputLines.push('```')

    // Write out to note
    WSNote.content = outputLines.join('\n')

    // Add trigger for update pref when note is updated
    // Note: commented out for now, as addTrigger doesn't always seem to work on the right note. Instead it's included in the above.
    // let res = await addTrigger(Editor, "onEditorWillSave", "jgclark.WindowSets", "syncWSNoteToPrefs")
    // if (!res) {
    //   logWarn('writeWSPrefsToNote', `addTrigger failed`)
    // }

    return true
  } catch (error) {
    logError(pluginJson, `writeWSPrefsToNote: ${error.message}`)
    return false
  }
}

/**
 * Write WindowSet definitions from WS note to local Pref,
 * having first checked their screen bounds.
 */
export async function writeWSNoteToPrefs(calledFromSaveTrigger: boolean = false): Promise<void> {
  try {
    // Check to stop it running on iOS
    if (NotePlan.environment.platform !== 'macOS') {
      logDebug('writeWSNoteToPrefs', `Designed only to run on macOS. Stopping.`)
      return
    }
    const config = await getPluginSettings()
    logDebug(pluginJson, `writeWSNoteToPrefs() starting ${(calledFromSaveTrigger ? 'triggered by save ' : '')}for folder '${config.folderForDefinitions}' title '${config.noteTitleForDefinitions}'`)
    // Get note from config, or if triggered, then need to get it directly from Editor, to ensure we can get the latest version
    let noteForWS: TNote
    if (calledFromSaveTrigger && Editor) {
      noteForWS = Editor
      logDebug(pluginJson, `got Editor`)
    }
    else {
      const noteForWSs = DataStore.projectNoteByTitle(config.noteTitleForDefinitions) // TODO: look in the correct folder too
      if (noteForWSs) {
        noteForWS = noteForWSs[0]
      } else {
        logWarn('writeWSNoteToPrefs', `No note found with title '${config.noteTitleForDefinitions}'`)
        throw new Error(`Can't find Window Set note from Editor or '${config.noteTitleForDefinitions}'`)
      }
    }

    // Get just the codeblock
    logDebug('getCodeBlocks', `Reading from note '${displayTitle(noteForWS)}' for code blocks`)
    const noteCBs = getCodeBlocksOfType(noteForWS, ['json'])
    if (noteCBs.length === 0) {
      throw new Error(`No JSON code blocks found in note '${config.noteTitleForDefinitions}'`)
    }
    if (noteCBs.length > 1) {
      logWarn(pluginJson, `There's more than 1 JSON code block in note '${config.noteTitleForDefinitions}'. Only the first is used for WindowSet definitions.`)
    }
    const firstCBStr = noteCBs[0].code

    // Get object from this JSON string
    let WSs: Array<WindowSet> = JSON.parse(firstCBStr).WS

    // check bounds for each WS
    // for (const ws of WSs) {
    for (let i = 0; i < WSs.length; i++) {
      const ws = WSs[i]
      WSs[i] = checkWindowSetBounds(ws)
    }

    // Get list of WS names from this JSON
    // TODO: update to just for this machine?
    const WSNames = WSs.map((w) => w.name)

    // Send the resulting WS definitions to the preferences store as an object
    DataStore.setPreference('windowSets', WSs)
    logDebug('writeWSNoteToPrefs', `Set windowSets pref from note '${config.noteTitleForDefinitions}' with set names [${String(WSNames)}]`)

  } catch (error) {
    logError(pluginJson, `writeWSNoteToPrefs: ${error.name}: ${error.message}`)
  }
}

/**
 * Decide whether to sync the WindowSet note to Prefs.
 */
export async function syncWSNoteToPrefs(): Promise<void> {
  try {
    // Check to stop it running on iOS
    if (NotePlan.environment.platform !== 'macOS') {
      logDebug('syncWSNoteToPrefs', `Designed only to run on macOS. Stopping.`)
      return
    }

    // Do we have the Editor open? If not, stop
    if (!(Editor.content && Editor.note)) {
      logWarn('syncWSNoteToPrefs', `Cannot get Editor details. Please open a note.`)
      return
    }

    // first check to see if this has been called in the last 3secs: if so don't proceed, as this could be a double call.
    const noteReadOnly: CoreNoteFields = Editor.note
    const timeSinceLastEdit: number = Date.now() - noteReadOnly.versions[0].date
    if (timeSinceLastEdit <= 3000) {
      logDebug('syncWSNoteToPrefs', `syncWSNoteToPrefs fired, but ignored, as it was called only ${String(timeSinceLastEdit)}ms after the last one`)
      return
    }
    // write from note to local preference, indicating that this is from a trigger, so work around stale data problem
    logDebug('syncWSNoteToPrefs', `Will write note to local pref`)
    await writeWSNoteToPrefs(true)

  } catch (error) {
    logError(pluginJson, `syncWSNoteToPrefs: ${error.name}: ${error.message}`)
  }
}

/**
 * Read current WindowSet definitions
 * V3: read JSON from local preferences
 * @returns {Array<WindowSet>} JSON configuration object for all window sets
 * @param {string?} machineName to match
 * @return {Promise<Array<WindowSet>>} window sets
 */
export async function readWindowSetDefinitions(forMachineName: string = ''): Promise<Array<WindowSet>> {
  try {
    // Read from local preferences
    const windowSetsObject: any = DataStore.preference('windowSets')
    const thisMachineName = NotePlan.environment.machineName
    if (!windowSetsObject) {
      logWarn('readWindowSetDefinitions V3', `No saved windowSet objects found in local pref for ${thisMachineName}`)

      // Offer to make two default sets
      await offerToAddExampleWSs()

      return []
    }

    let windowSets: Array<WindowSet> = windowSetsObject
    let machineDisplayName = ''
    if (forMachineName !== '') {
      windowSets = windowSets.filter((ws) => ws.machineName === forMachineName)
      machineDisplayName = `(for ${forMachineName})`
    }
    logDebug('readWindowSetDefinitions V3', `Read ${String(windowSets.length)} window sets  ${machineDisplayName}`)
    return windowSets
  } catch (err) {
    logError('readWindowSetDefinitions V3', `${err.name}: ${err.message} `)
    return [] // for completeness
  }
}

/**
 * List user's available saved windows sets to console
 * V3: reads from local preference
 * @author @jgclark
 */
export async function logWindowSets(): Promise<void> {
  try {
    if (NotePlan.environment.platform !== 'macOS') {
      logWarn('logWindowSets', `Window Sets only runs on macOS. Stopping.`)
      return
    }
    const config = await getPluginSettings()
    const thisMachineName = NotePlan.environment.machineName

    const windowSets: Array<WindowSet> = await readWindowSetDefinitions()
    if (windowSets.length === 0) {
      logInfo('logWindowSets', `No saved windowSets object found in local pref.`)
      return
    }
    logInfo('logWindowSets', `${String(windowSets.length)} saved windowSets found in local pref.`)
    const outputLines = []
    outputLines.push(`Window Sets:`)
    for (const set of windowSets) {
      let c = 0
      // Format editorWindows details
      outputLines.push(`${set.name} (for ${thisMachineName}):`)
      if (set.editorWindows && set.editorWindows.length > 0) {
        for (const ew of set.editorWindows) {
          outputLines.push(`- EW${String(c)}: ${ew.noteType}, ${ew.windowType}: title:'${ew.title ?? ''}' filename:${ew.filename ?? ''} x:${ew.x ?? '-'} y:${ew.y ?? '-'} w:${ew.width ?? '-'} h:${ew.height ?? '-'}`)
          c++
        }
      } else {
        logDebug('logWindowSets', `windowSet '${set.name}' has no editorWindows array`)
      }

      // Format htmlWindows details
      c = 0
      if (set.htmlWindows && set.htmlWindows.length > 0) {
        for (const hw of set.htmlWindows) {
          outputLines.push(`- HW${String(c)}: ${hw.type}: customId:'${hw.customId ?? ''}' pluginID:${hw.pluginID ?? '?'} pluginCommandName:${hw.pluginCommandName ?? '?'} x:${hw.x ?? '-'} y:${hw.y ?? '-'} w:${hw.width ?? '-'} h:${hw.height ?? '-'}`)
          c++
        }
      } else {
        logDebug('logWindowSets', `windowSet '${set.name}' has no htmlWindows array`)
      }
    }
    logInfo('logWindowSets', (outputLines.length > 0) ? outputLines.join('\n') : 'Window Sets: **none**')
  }
  catch (error) {
    logError('logWindowSets', JSP(error))
  }
}

/**
 * Get the detailed Window Set object for the passed window set name.
 * V1: reads from DataStore.preference('windowSets')
 * @author @jgclark
 * @param {string} name of window set to look up
 * @returns {WindowSet | null} window set, if found, otherwise null
 */
export function getDetailedWindowSetByName(name: string): WindowSet | null {
  try {
    const savedWindowSets = DataStore.preference('windowSets')
    if (!savedWindowSets) {
      logWarn(pluginJson, 'No saved detailed windowSet objects found')
      return null
    }
    const windowSets = Array(savedWindowSets ?? [])
    for (const set of windowSets) {
      if (set.name === name) {
        return set
      }
    }
    logWarn(pluginJson, `getDetailedWindowSetByName('${name}'): no such detailed windowSet object found`)
    return null
  } catch (error) {
    logError(pluginJson, `${error.name}: ${error.message}`)
    return null
  }
}

/**
 * Returns the same WindowSet array as passed, but with the X/Y/Width/Height attributes changed if:
 * - it is created for the current machineName
 * - AND a window falls outside the bounds of the screen dimensions for the current machineName
 * @param {Array<WindowSet} setToCheck
 * @returns {Array<WindowSet>} checkedSet
 */
export function checkWindowSetBounds(setToCheck: WindowSet): WindowSet {
  try {
    logDebug('checkWindowSetBounds', `Starting check for window set '${setToCheck.name}' against screen dimensions for ${NotePlan.environment.machineName}: ${NotePlan.environment.screenWidth}x${NotePlan.environment.screenHeight}`)
    let checkedSet = setToCheck

    // check bounds for each WS in turn
    // for (let thisWS of checkedSet) {
    //   logDebug('checkWindowSetBounds', `- checking WS '${thisWS.name}' ...`)
    //   for (let ew of thisWS.editorWindows) {
    //     ew = constrainWindowSizeAndPosition(ew)
    //   }
    //   for (let hw of thisWS.htmlWindows) {
    //     hw = constrainWindowSizeAndPosition(hw)
    //   }
    // }

    // check bounds for WS
    // for (let ew of setToCheck.editorWindows) {
    for (let i = 0; i < setToCheck.editorWindows.length; i++) {
      const ew: EditorWinDetails = setToCheck.editorWindows[i]
      checkedSet.editorWindows[i] = constrainWindowSizeAndPosition(ew)
    }
    for (let i = 0; i < setToCheck.htmlWindows.length; i++) {
      const hw: HTMLWinDetails = setToCheck.htmlWindows[i]
      checkedSet.htmlWindows[i] = constrainWindowSizeAndPosition(hw)
    }

    return checkedSet
  } catch (error) {
    logError(pluginJson, `checkWindowSetBounds(): ${error.name}: ${error.message}`)
    return setToCheck
  }
}

export async function offerToAddExampleWSs(): Promise<void> {
  try {
    const config = await getPluginSettings()

    // Offer to make two default sets
    let res = await showMessageYesNo(`There are no Window Set definitions in folder '${config.folderForDefinitions}'. Shall I add some example ones?`, ['Yes please', 'No thanks'], "Window Sets")
    if (res === 'Yes please') {
      // create two default sets
      const newWindowSets: Array<WindowSet> = exampleWSs
      DataStore.setPreference('windowSets', newWindowSets)
      logDebug('onUpdateOrInstall', `Saved window sets to local pref`)
      logWindowSets()
      const res = writeWSsToNote(config.folderForDefinitions, config.noteTitleForDefinitions, newWindowSets)
      logDebug('saveWindowSet', `Saved window sets to note`)
      await showMessage(`I've added 2 example Window Sets, which are saved in note ${config.folderForDefinitions}/${config.noteTitleForDefinitions}. Please run the command again to try them out.`)
      logInfo(pluginID, `- added 2 `)
    }
    return // Placeholder only to try to stop error in logs
  }
  catch (error) {
    logError(pluginID, `onUpdateOrInstall: ${error.message}`)
  }
}

const exampleWSs: Array<WindowSet> = [
  {
    "name": "Days (Yesterday+Today+Tomorrow)",
    "closeOtherWindows": true,
    "editorWindows": [
      {
        "noteType": "Calendar",
        "windowType": "main",
        "filename": "{-1d}",
        "title": "yesterday",
        "x": 0,
        "y": 0,
        "width": 700,
        "height": 600
      },
      {
        "noteType": "Calendar",
        "windowType": "split",
        "filename": "{0d}",
        "title": "today",
        "x": 0,
        "y": 0,
        "width": 700,
        "height": 600
      },
      {
        "noteType": "Calendar",
        "windowType": "split",
        "filename": "{+1d}",
        "title": "tomorrow",
        "x": 0,
        "y": 0,
        "width": 700,
        "height": 600
      }
    ],
    "htmlWindows": [
      {
        "type": "Plugin",
        "pluginID": "jgclark.Dashboard",
        "pluginCommandName": "show dashboard",
        "customId": "Dashboard",
        "x": 416, "y": 515, "width": 990, "height": 360
      }
    ],
    "machineName": "Desktop"
  },
  {
    "name": "Weeks (Last+This+Next)",
    "closeOtherWindows": true,
    "editorWindows": [
      {
        "noteType": "Calendar",
        "windowType": "main",
        "filename": "{-1w}",
        "title": "last week",
        "x": 0,
        "y": 0,
        "width": 700,
        "height": 600
      },
      {
        "noteType": "Calendar",
        "windowType": "split",
        "filename": "{0w}",
        "title": "this week",
        "x": 0,
        "y": 0,
        "width": 700,
        "height": 600
      },
      {
        "noteType": "Calendar",
        "windowType": "split",
        "filename": "{+1w}",
        "title": "next week",
        "x": 0,
        "y": 0,
        "width": 700,
        "height": 600
      }
    ],
    "htmlWindows": [],
    "machineName": "Desktop"
  }
]
