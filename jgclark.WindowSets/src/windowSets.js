// @flow
//---------------------------------------------------------------
// Journalling plugin for NotePlan
// Jonathan Clark
// last update 27.4.2022 for v0.1.1 by @jgclark
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
import { showMessageYesNo } from "../../helpers/userInput";

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

/**
 * Note: from v3.9.1 we also use
 * type Rect = {
 *   x: Integer,
 *   y: Integer,
 *   width: Integer,
 *   height: integer
 * }
 */

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
      logInfo('logWindowSets', `No saved windowSets object found.`)
      return
    }
    // clo(windowSetsObject)
    const windowSets = Array(windowSetsObject)
    let c = 0
    outputLines.push(`Window Sets:`)
    for (const set of windowSets) {
      clo(set, 'WS #' + String(c))
      outputLines.push(`${set.name}:`)
      if (set.editorWindows) {
        for (const win of set.editorWindows) { // FIXME: undefined
          outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' title:'${win.title ?? ''}' filename:${win.filename ?? ''} ID:${win.id} x:${win.x} y:${win.y} w:${win.width} h:${win.height}`)
          c++
        }
      } else {
        logWarn('logWindowSets', `WindowSet #${String(c)} has no editorWindows array`)
      }
      if (set.htmlWindows) {
        for (const win of set.htmlWindows) {
          outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' title:'${win.title ?? ''}' filename:${win.filename ?? ''} ID:${win.id} x:${win.x} y:${win.y} w:${win.width} h:${win.height}`)
          c++
        }
      } else {
        logWarn('logWindowSets', `WindowSet #${String(c)} has no htmlWindows array`)
      }
    }
    logDebug('', String(outputLines))
    logInfo('logWindowSets', (outputLines.length > 0) ? outputLines.join('\n') : '**none**')
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
    const config = await getWindowSetsSettings()

    if (NotePlan.environment.buildVersion < 1020 || NotePlan.environment.platform !== 'macOS') {
      logInfo('saveWindowSet', `Window Sets needs NotePlan v3.9.1 or later on macOS. Stopping.`)
      return
    }
    // Form this set.
    // Note: needs to use a cut-down set of attributes available in the window objects
    const editorWinDetails: Array<EditorWinDetails> = NotePlan.editors.map((win) => {
      const winRect = win.windowRect
      return {
        id: win.id,
        customId: win.customId,
        // title: win.title,
        type: win.type,
        filename: win.filename,
        x: winRect.x,
        y: winRect.y,
        width: winRect.width,
        height: winRect.height,
      }
    })
    if (editorWinDetails.length < 2) {
      const answer = await showMessageYesNo("There's only 1 open window. Are you sure you want to continue to make a Window Set?")
      if (answer === 'No') {
        return
      }
    }
    const htmlWinDetails: Array<HTMLWinDetails> = NotePlan.htmlWindows.map((win) => {
      const winRect = win.windowRect
      return {
        id: win.id,
        customId: win.customId,
        // title: win.title,
        type: win.type,
        // filename: win.filename
        x: winRect.x,
        y: winRect.y,
        width: winRect.width,
        height: winRect.height,
      }
    })

    // Get current saved set names
    const savedWindowSets = DataStore.preference('windowSets')
    let choice = 0
    let setName = ''
    let isNewSet = false
    let windowSets: Array<WindowSet> = []

    // Offer current set names and/or offer to create new one
    if (savedWindowSets) {
      clo(savedWindowSets, 'savedWindowSets')
      windowSets = Array(savedWindowSets ?? [])
      logDebug('saveWindowSet', `found ${String(windowSets.length)} windowSets`)

      const nameOptions: Array<Object> = []
      nameOptions.push({ value: 0, label: "+ New window set" })
      for (let i = 0; i < windowSets.length; i++) {
        const thisWindowSet = windowSets[i]
        nameOptions.push({ value: i + 1, label: thisWindowSet.name })
      }
      const res = await chooseOption('Enter new window set name, or which one to update', nameOptions, 0)
      if (!res) {
        logInfo('saveWindowSet', `User cancelled operation.`)
        return
      }
      choice = res
      if (choice === 0) {
        const newName = await getInputTrimmed('Enter name for new Window Set', 'OK', 'New Window Set name')
        if (!newName) {
          logInfo('saveWindowSet', `User cancelled operation.`)
          return
        }
        setName = String(newName) // to satisfy flow
        isNewSet = true
      } else {
        setName = nameOptions[res]
      }
    } else {
      // No current saved window sets
      const newName = await getInputTrimmed('Enter name for new Window Set', 'OK', 'New Window Set name')
      if (!newName) {
        logInfo('saveWindowSet', `User cancelled operation.`)
        return
      }
      setName = String(newName) // to satisfy flow
      isNewSet = true
    }

    // TODO: Check to see if any editor windows are calendar dates

    // TODO: If so, offer to make them a relative date to today/this week etc.

    // TODO: Make relative calcs

    // Get type of window by looking at the second open window (the first always being 'main')
    const actionType = (editorWinDetails[1].type === 'split') ? 'split' : 'floating'
    const thisWS: WindowSet = { name: setName, editorWindows: editorWinDetails, htmlWindows: htmlWinDetails, action: actionType }
    clo(thisWS, 'thisWS')

    // Add or update this WS
    if (isNewSet) {
      // Add this one
      windowSets.push(thisWS)
    } else {
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
    }
    clo(windowSets)
    // Save to preferences store
    DataStore.setPreference('windowSets', windowSets)
    logDebug('saveWindowSet', `Saved window set '${setName}'`)
    logWindowSets()
  } catch (error) {
    logError('saveWindowSet', JSP(error))
  }
}

export async function saveWindowSetV1(): Promise<void> {
  try {
    const config = await getWindowSetsSettings()

    if (NotePlan.environment.buildVersion < 1020 || NotePlan.environment.platform !== 'macOS') {
      logInfo('saveWindowSet', `Window Sets needs NotePlan v3.9.1 or later on macOS. Stopping.`)
      return
    }
    // Form this set.
    // Note: needs to use a cut-down set of attributes available in the window objects
    const editorWinDetails: Array<EditorWinDetails> = NotePlan.editors.map((win) => {
      const winRect = win.windowRect
      return {
        id: win.id,
        customId: win.customId,
        // title: win.title,
        type: win.type,
        filename: win.filename,
        x: winRect.x,
        y: winRect.y,
        width: winRect.width,
        height: winRect.height,
      }
    })
    if (editorWinDetails.length < 2) {
      const answer = await showMessageYesNo("There's only 1 open window. Are you sure you want to continue to make a Window Set?")
      if (answer === 'No') {
        return
      }
    }
    const htmlWinDetails: Array<HTMLWinDetails> = NotePlan.htmlWindows.map((win) => {
      const winRect = win.windowRect
      return {
        id: win.id,
        customId: win.customId,
        // title: win.title,
        type: win.type,
        // filename: win.filename
        x: winRect.x,
        y: winRect.y,
        width: winRect.width,
        height: winRect.height,
      }
    })

    // Get current saved set names
    const savedWindowSets = DataStore.preference('windowSets')
    let choice = 0
    let setName = ''
    let isNewSet = false
    let windowSets: Array<WindowSet> = []
    if (savedWindowSets) {
      clo(savedWindowSets, 'savedWindowSets')
      windowSets = Array(savedWindowSets ?? [])
      logDebug('saveWindowSet', `found ${String(windowSets.length)} windowSets`)

      // Offer current set names + offer to create new one
      const nameOptions: Array<Object> = []
      nameOptions.push({ value: 0, label: "+ New window set" })
      for (let i = 0; i < windowSets.length; i++) {
        const thisWindowSet = windowSets[i]
        nameOptions.push({ value: i + 1, label: thisWindowSet.name })
      }
      const res = await chooseOption('Enter new window set name, or which one to update', nameOptions, 0)
      if (!res) {
        logInfo('saveWindowSet', `User cancelled operation.`)
        return
      }
      choice = res
      if (choice === 0) {
        const newName = await getInputTrimmed('Enter name for new Window Set', 'OK', 'New Window Set name')
        if (!newName) {
          logInfo('saveWindowSet', `User cancelled operation.`)
          return
        }
        setName = String(newName) // to satisfy flow
        isNewSet = true
      } else {
        setName = nameOptions[res]
      }
    } else {
      // No current saved window sets
      const newName = await getInputTrimmed('Enter name for new Window Set', 'OK', 'New Window Set name')
      if (!newName) {
        logInfo('saveWindowSet', `User cancelled operation.`)
        return
      }
      setName = String(newName) // to satisfy flow
      isNewSet = true
    }

    // Get type of window by looking at the second open window (the first always being 'main')
    const actionType = (editorWinDetails[1].type === 'split') ? 'split' : 'floating'
    const thisWS: WindowSet = { name: setName, editorWindows: editorWinDetails, htmlWindows: htmlWinDetails, action: actionType }
    clo(thisWS, 'thisWS')

    // Add or update this WS
    if (isNewSet) {
      // Add this one
      windowSets.push(thisWS)
    } else {
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
    }
    clo(windowSets)
    // Save to preferences store
    DataStore.setPreference('windowSets', windowSets)
    logDebug('saveWindowSet', `Saved window set '${setName}'`)
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
    if (NotePlan.environment.buildVersion < 1020 || NotePlan.environment.platform !== 'macOS') {
      throw new Error(`Window Sets needs NotePlan v3.9.1 or later on macOS. Stopping.`)
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
      return { label: `${sws.name} (with ${String(sws.editorWindows?.length ?? 0)} ${sws.action} windows)`, value: c }
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

/**
 * Delete a saved window set
 * @author @jgclark
 * @param {string} setName to open
 * @returns {boolean} success?
 */
export async function deleteWindowSet(setName: string): Promise<boolean> {
  try {
    if (NotePlan.environment.buildVersion < 1020 || NotePlan.environment.platform !== 'macOS') {
      throw new Error(`Window Sets needs NotePlan v3.9.1 or later on macOS. Stopping.`)
    }
    let success = false

    // Form list of window sets to choose from
    let c = -1
    const savedWindowSets = DataStore.preference('windowSets')
    clo(savedWindowSets, 'all savedWindowSets')
    const windowSets = Array(savedWindowSets ?? [])
    if (windowSets.length === 0) {
      logWarn(pluginJson, `deleteWindowSet: No window sets found. Stopping.`)
      return false
    }
    logDebug(pluginJson, `deleteWindowSet: Found ${windowSets.length} window sets`)

    const setChoices = windowSets.map((sws) => {
      c++
      return { label: `${sws.name} (with ${String(sws.editorWindows?.length ?? 0)} ${sws.action} windows)`, value: c }
    })
    const num = await chooseOption("Which Window Set to delete?", setChoices)
    if (isNaN(num)) {
      logInfo(pluginJson, `No valid set chosen, so stopping.`)
      return false
    }
    logInfo('deleteWindowSet', `You have asked to delete window set #${num}`)

    // Delete this window set, and save back to preferences store
    windowSets.splice(num, 1)
    DataStore.setPreference('windowSets', windowSets)
    // logDebug('deleteWindowSet', `Window set '${setName}'`)
    logWindowSets()

    return true
  }
  catch (error) {
    logError('deleteWindowSet', JSP(error))
    return false
  }
}

export function deleteAllSavedWindowSets(): void {
  try {
    // TEST: waiting for next Alpha after 1020 to test if this now works. Currently it's blocked, says EM.  See https://discord.com/channels/763107030223290449/1101882756436328578/1101924555922079805
    DataStore.setPreference('windowSets', null)
    logWarn('deleteAllSavedWindowSets', `Deleted all Window Sets`)
  }
  catch (error) {
    logError('deleteAllSavedWindowSets', JSP(error))
  }
}
