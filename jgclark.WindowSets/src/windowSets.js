// @flow
//---------------------------------------------------------------
// Journalling plugin for NotePlan
// Jonathan Clark
// last update 11.3.2022 for v0.1.0 by @jgclark
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import strftime from 'strftime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getInputTrimmed, showMessage, showMessageYesNoCancel } from '@helpers/userInput'
import { setEditorWindowID } from "../../helpers/NPWindows";

//-----------------------------------------------------------------
// Data types
type EditorWinDetails = {
  id: string,
  type: string,
  customId: string,
  title?: string,
  x?: number,
  y?: number,
  width?: number,
  height?: number,
  filename: string
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
  htmlWindows: Array<HTMLWinDetails>
}

//---------------------------------------------------------------

/**
 * List user's available windows sets to console
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
 * Save current set of windows/panes as a set to the preference store for the current device.
 * @author @jgclark
 */
export function saveWindowSet(): void {
  try {
    if (NotePlan.environment.buildVersion < 983 || NotePlan.environment.platform !== 'macOS') { // TODO: check v
      logInfo('saveWindowSet', `Window Sets needs NotePlan v3.8.1 or later on macOS. Stopping.`)
      return
    }
    // Form this set.
    // Note: needs to use a cut-down set of attributes available in the window objects
    const setName = 'test'
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
    const thisWindowSet: WindowSet = { name: setName, editorWindows: editorWinDetails, htmlWindows: htmlWinDetails }
    clo(thisWindowSet, 'thisWindowSet')
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
        windowSets[c] = thisWindowSet
        found = true
        break
      }
      c++
    }
    if (!found) {
      // Add this one
      windowSets.push(thisWindowSet)
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
export function openWindowSet(setName: string): boolean {
  try {
    if (NotePlan.environment.buildVersion < 983 || NotePlan.environment.platform !== 'macOS') { // TODO: check v
      throw new Error(`Window Sets needs NotePlan v3.8.1 or later on macOS. Stopping.`)
    }
    let success = false




    return success
  }
  catch (error) {
    logError('logWindowsList', JSP(error))
    return false
  }
}
