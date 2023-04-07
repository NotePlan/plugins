// @flow
//---------------------------------------------------------------
// Journalling plugin for NotePlan
// Jonathan Clark
// last update 5.2.2022 for v0.1.0 by @jgclark
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import strftime from 'strftime'
import { isValidCalendarNoteFilename } from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getNoteFilenameFromTitle } from '@helpers/NPnote'
import {
  openNoteInNewSplitIfNeeded,
  openNoteInNewWindowIfNeeded,
  setEditorWindowID
} from "@helpers/NPWindows";
import { chooseOption, getInputTrimmed, showMessage, showMessageYesNoCancel } from '@helpers/userInput'

//-----------------------------------------------------------------
// Data types
type EditorWinDetails = {
  id?: string, // TODO: make mandatory again in time
  type?: string, // make mandatory again in time
  customId?: string, // make mandatory again in time
  title?: string,
  x?: number,
  y?: number,
  width?: number,
  height?: number,
  filename?: string // make mandatory again in time
}

type HTMLWinDetails = {
  id: string,
  type: string,
  customId: string,
  title?: string,
  x?: number,
  y?: number,
  width?: number,
  height?: number,
  filename?: string
}

type WindowSet = {
  name: string,
  editorWindows: Array<EditorWinDetails>,
  htmlWindows: Array<HTMLWinDetails>,
  action: string
}

//---------------------------------------------------------------
// Settings

export type WindowSetsConfig = {
  windowSet1: Array<string>,
  windowSet1Name: string,
  windowSet1Action: string,
  windowSet2: Array<string>,
  windowSet2Name: string,
  windowSet2Action: string,
  windowSet3: Array<string>,
  windowSet3Name: string,
  windowSet3Action: string,
  windowSet4: Array<string>,
  windowSet4Name: string,
  windowSet4Action: string,
  windowSet5: Array<string>,
  windowSet5Name: string,
  windowSet5Action: string,
  _logDebug: String,
}

const pluginID = 'jgclark.WindowSets'

/**
 * Get config settings
 * @return {WindowSetsConfig} object with configuration
 */
export async function getWindowSetsSettings(): Promise<any> {
  // logDebug(pluginJson, `Start of getWindowSetsSettings()`)
  try {
    // Get settings using ConfigV2
    const config: WindowSetsConfig = await DataStore.loadJSON('../jgclark.WindowSets/settings.json')
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
 * Get the detailed Window Set object for the passed window set name.
 * @author @jgclark
 * @param {string} name of window set to look up
 * @returns {WindowSet | null} window set, if found, otherwise null
 */
function getDetailedWindowSetByName(name: string): WindowSet | null {
  try {
    const windowSetsObject = DataStore.preference('windowSets')
    if (!windowSetsObject) {
      logWarn(pluginJson, 'No saved detailed windowSet objects found')
      return null
    }
    const windowSets = Array(windowSetsObject)
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
 * List user's available saved windows sets to console
 * @author @jgclark
 */
export function logWindowSets(): void {
  try {
    if (NotePlan.environment.buildVersion < 983 || NotePlan.environment.platform !== 'macOS') { // TODO: check v
      logInfo('logWindowSets', `Window Sets needs NotePlan v3.8.1 or later on macOS. Stopping.`)
      return
    }
    const outputLines = []
    const windowSetsObject = DataStore.preference('windowSets')
    if (!windowSetsObject) {
      logInfo('logWindowSets', `No saved windowSets object found. Stopping.`)
      return
    }
    clo(windowSetsObject)
    logDebug('logWindowSets', typeof windowSetsObject)
    const windowSets = Array(windowSetsObject)
    let c = 0
    outputLines.push(`Window Sets:`)
    for (const set of windowSets) {
      outputLines.push(`${set.name}:`)
      for (const win of set.editorWindows) {
        outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' title:'${win.title ?? ''}' filename:${win.filename ?? ''} ID:${win.id}`)
        c++
      }
      for (const win of set.htmlWindows) {
        outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' title:'${win.title ?? ''}' filename:${win.filename ?? ''} ID:${win.id}`)
        c++
      }
    }
    logInfo('logWindowSets', outputLines.join('\n'))
  }
  catch (error) {
    logError('logWindowSets', JSP(error))
  }
}

/**
 * Save detailed set of windows/panes as a set to the preference store for the current device.
 * TODO: finish. (change to save parts to settings file?)
 * @author @jgclark
 */
export async function saveWindowSet(): Promise<void> {
  try {
    if (NotePlan.environment.buildVersion < 983 || NotePlan.environment.platform !== 'macOS') { // TODO: check v
      logInfo('saveWindowSet', `Window Sets needs NotePlan v3.8.1 or later on macOS. Stopping.`)
      return
    }
    // Form this set.
    // Note: needs to use a cut-down set of attributes available in the window objects
    const editorWinDetails: Array<EditorWinDetails> = NotePlan.editors.map((win) => {
      return {
        id: win.id,
        customId: win.customId,
        // title: win.title,
        type: win.type,
        filename: win.filename
        // x: win.x,
        // y: win.y,
        // width: win.width,
        // height: win.height,
      }
    })
    const htmlWinDetails: Array<HTMLWinDetails> = NotePlan.htmlWindows.map((win) => {
      return {
        id: win.id,
        customId: win.customId,
        // title: win.title,
        type: win.type,
        // filename: win.filename
        // x: win.x,
        // y: win.y,
        // width: win.width,
        // height: win.height,
      }
    })
    // TODO: Offer current set names (+ offer to create new one)
    const res = await getInputTrimmed('Enter window set name', 'OK', 'Save Window Set Details')
    if (!res) {
      logInfo('saveWindowSet', `User canceled operation.`)
      return
    }
    const setName = String(res)
    const actionType = (editorWinDetails[1].type === 'split') ? 'split' : 'floating'
    const thisWS: WindowSet = { name: setName, editorWindows: editorWinDetails, htmlWindows: htmlWinDetails, action: actionType }
    clo(thisWS, 'thisWS')

    // Get all current saved windowSets objects
    const savedWindowSets = DataStore.preference('windowSets')
    clo(savedWindowSets, 'savedWindowSets')
    const windowSets = Array(savedWindowSets) ?? []
    logDebug('saveWindowSet', `found ${String(windowSets.length)} windowSets`)
    // Add or update this one
    let c = 0
    let found = false
    for (const set of windowSets) {
      clo(set, 'set')
      if (set.name === setName) {
        // Update this one
        windowSets[c] = thisWS
        found = true
        break
      }
      c++
    }
    if (!found) {
      // Add this one
      windowSets.push(thisWS)
    }
    clo(windowSets)
    // Save to preferences store
    // DataStore.setPreference('windowSets', windowSets)
    // logDebug('saveWindowSet', `Saved window set '${setName}'`)
    logWindowSets()
  } catch (error) {
    logError('saveWindowSet', JSP(error))
  }
}

/**
 * Open a saved window set
 * @author @jgclark
 * @param {string} setName to open
 * @returns {boolean} success?
 */
export async function openWindowSet(setName: string): Promise<boolean> {
  try {
    if (NotePlan.environment.buildVersion < 983 || NotePlan.environment.platform !== 'macOS') { // TODO: check v
      throw new Error(`Window Sets needs NotePlan v3.8.1 or later on macOS. Stopping.`)
    }
    let success = false
    const config = await getWindowSetsSettings()

    // Get all available windowSets
    const savedWindowSets: Array<WindowSet> = []
    if (config.windowSet1.length > 0) {
      const res = getDetailedWindowSetByName(config.windowSet1Name)
      if (res) {
        const detailedWS: WindowSet = res
        savedWindowSets.push({ name: config.windowSet1Name, editorWindows: detailedWS.editorWindows, htmlWindows: [], action: config.windowSet1Action })
        clo(detailedWS, 'detailedWS found from windowSet1')
      } else {
        let c = 0
        const edWindows = []
        for (const title of config.windowSet1) {
          const thisFilename = getNoteFilenameFromTitle(title) // get filename from the supplied title
          if (thisFilename) {
            edWindows.push({
              title: (isValidCalendarNoteFilename(thisFilename)) ? '' : title, // only include title if it's a project note
              type: (c === 0) ? 'main' : config.windowSet1Action, // set action type by type of _second_ window in the set (the first is always the 'main' app window)
              filename: thisFilename
            })
          }
          c++
        }
        // $FlowFixMe[incompatible-call]
        savedWindowSets.push({ name: config.windowSet1Name, editorWindows: edWindows, htmlWindows: [], action: config.windowSet1Action })
        // clo(edWindows, 'just edWindows found from windowSet1')
      }
    }
    if (config.windowSet2.length > 0) {
      const res = getDetailedWindowSetByName(config.windowSet2Name)
      if (res) {
        const detailedWS: WindowSet = res
        savedWindowSets.push({ name: config.windowSet2Name, editorWindows: detailedWS.editorWindows, htmlWindows: [], action: config.windowSet2Action })
        clo(detailedWS, 'detailedWS found from windowSet2')
      } else {
        let c = 0
        const edWindows = []
        for (const title of config.windowSet2) {
          const thisFilename = getNoteFilenameFromTitle(title) // get filename from the supplied title
          if (thisFilename) {
            edWindows.push({
              title: (isValidCalendarNoteFilename(thisFilename)) ? '' : title, // only include title if it's a project note
              type: (c === 0) ? 'main' : config.windowSet2Action, // set action type by type of _second_ window in the set (the first is always the 'main' app window)
              filename: thisFilename
            })
          }
          c++
        }
        // $FlowFixMe[incompatible-call]
        savedWindowSets.push({ name: config.windowSet2Name, editorWindows: edWindows, htmlWindows: [], action: config.windowSet2Action })
        // clo(edWindows, 'just edWindows found from windowSet2')
      }
    }
    if (config.windowSet3.length > 0) {
      const res = getDetailedWindowSetByName(config.windowSet1Name)
      if (res) {
        const detailedWS: WindowSet = res
        savedWindowSets.push({ name: config.windowSet3Name, editorWindows: detailedWS.editorWindows, htmlWindows: [], action: config.windowSet3Action })
        clo(detailedWS, 'detailedWS found from windowSet3')
      } else {
        let c = 0
        const edWindows = []
        for (const title of config.windowSet3) {
          const thisFilename = getNoteFilenameFromTitle(title) // get filename from the supplied title
          if (thisFilename) {
            edWindows.push({
              title: (isValidCalendarNoteFilename(thisFilename)) ? '' : title, // only include title if it's a project note
              type: (c === 0) ? 'main' : config.windowSet3Action, // set action type by type of _second_ window in the set (the first is always the 'main' app window)
              filename: thisFilename
            })
          }
          c++
        }
        // $FlowFixMe[incompatible-call]
        savedWindowSets.push({ name: config.windowSet3Name, editorWindows: edWindows, htmlWindows: [], action: config.windowSet3Action })
        // clo(edWindows, 'just edWindows found from windowSet3')
      }
    }
    if (config.windowSet4.length > 0) {
      const res = getDetailedWindowSetByName(config.windowSet4Name)
      if (res) {
        const detailedWS: WindowSet = res
        savedWindowSets.push({ name: config.windowSet4Name, editorWindows: detailedWS.editorWindows, htmlWindows: [], action: config.windowSet4Action })
        clo(detailedWS, 'detailedWS found from windowSet4')
      } else {
        let c = 0
        const edWindows = []
        for (const title of config.windowSet4) {
          const thisFilename = getNoteFilenameFromTitle(title) // get filename from the supplied title
          if (thisFilename) {
            edWindows.push({
              title: (isValidCalendarNoteFilename(thisFilename)) ? '' : title, // only include title if it's a project note
              type: (c === 0) ? 'main' : config.windowSet4Action, // set action type by type of _second_ window in the set (the first is always the 'main' app window)
              filename: thisFilename
            })
          }
          c++
        }
        // $FlowFixMe[incompatible-call]
        savedWindowSets.push({ name: config.windowSet4Name, editorWindows: edWindows, htmlWindows: [], action: config.windowSet4Action })
        // clo(edWindows, 'just edWindows found from windowSet4')
      }
    }
    if (config.windowSet5.length > 0) {
      const res = getDetailedWindowSetByName(config.windowSet1Name)
      if (res) {
        const detailedWS: WindowSet = res
        savedWindowSets.push({ name: config.windowSet5Name, editorWindows: detailedWS.editorWindows, htmlWindows: [], action: config.windowSet5Action })
        clo(detailedWS, 'detailedWS found from windowSet5')
      } else {
        let c = 0
        const edWindows = []
        for (const title of config.windowSet5) {
          const thisFilename = getNoteFilenameFromTitle(title) // get filename from the supplied title
          if (thisFilename) {
            edWindows.push({
              title: (isValidCalendarNoteFilename(thisFilename)) ? '' : title, // only include title if it's a project note
              type: (c === 0) ? 'main' : config.windowSet5Action, // set action type by type of _second_ window in the set (the first is always the 'main' app window)
              filename: thisFilename
            })
          }
          c++
        }
        // $FlowFixMe[incompatible-call]
        savedWindowSets.push({ name: config.windowSet5Name, editorWindows: edWindows, htmlWindows: [], action: config.windowSet5Action })
        // clo(edWindows, 'just edWindows found from windowSet5')
      }
    }

    clo(savedWindowSets, 'savedWindowSets')
    // Form list of window sets to choose from
    let c = -1
    const setChoices = savedWindowSets.map((sws) => {
      c++
      return { label: `${sws.name} (with ${String(sws.editorWindows.length)} windows)`, value: c }
    })
    if (setChoices.length === 0) {
      throw new Error(`No window sets found.`)
    }
    const num = await chooseOption("Which Window Set to open?", setChoices)
    logDebug(pluginJson, `${String(num)}, ${typeof num}`)
    if (isNaN(num)) {
      logInfo(pluginJson, `No valid set chosen, so stopping.`)
      return false
    }

    const thisWS = savedWindowSets[num]
    clo(thisWS)
    const setName = thisWS.name
    logDebug('openWindowSet', `User requests window set '${setName}'`)

    // Open the window set
    const openAction = savedWindowSets[num].action
    for (const ew of savedWindowSets[num].editorWindows) {
      if (ew.filename) {
        logDebug('openWindowSet', `- trying note filename '${ew.filename}' with openAction ${openAction}`)
        if (openAction === 'floating') {
          // Open the window pane
          // TODO: if first listed, then open in main editor
          // $FlowFixMe(incompatible-call)
          const res = await openNoteInNewWindowIfNeeded(ew.filename)
        } else if (openAction === 'split') {
          // Open the split window
          // TODO: if first listed, then open in main editor
          // $FlowFixMe(incompatible-call)
          const res = await openNoteInNewSplitIfNeeded(ew.filename)
        }
      } else {
        logError('openWindowSet', `- note filename is empty`)
      }
    }

    // Now close other windows (if necessary)
    if (config.closeOtherWindows) {
      // TODO:
      // logDebug('openWindowSet', `Attempting to close any other windows that aren't part of the set`)
    }

    return true
  }
  catch (error) {
    logError('openWindowSet', JSP(error))
    return false
  }
}
