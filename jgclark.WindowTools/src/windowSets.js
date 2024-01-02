// @flow
//---------------------------------------------------------------
// Main functions for WindowSets plugin
// Jonathan Clark
// last update 2.1.2024 for v1.0.0 by @jgclark
//---------------------------------------------------------------
// ARCHITECTURE:
// - 1 local preference 'windowSets' that contains JS Array<WindowSet>
// - 1 global user-visible note (by default @WindowSets/Window Sets) that is updated to stay in sync with the local pref
//   - writeWSNoteToPrefs() sends note to pref -- and can be run manually by /wnp
//   - syncWSNoteToPrefs() is run by trigger to decide whether to run writeWSNoteToPrefs
//   - writeWSsToNote() sends pref to note -- and can be run manually by /wpn
// - if no window sets found in pref, plugin offers to write 2 example sets
//
// Minimum version 3.9.8
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import * as wsh from './WTHelpers'
import { addCodeBlock, getCodeBlocksOfType } from '@helpers/codeBlocks'
import {
  calcOffsetDateStr,
  daysBetween,
  getDateStrForStartofPeriodFromCalendarFilename,
  getDateStringFromCalendarFilename,
  getFilenameDateStrFromDisplayDateStr,
  getISODateStringFromYYYYMMDD,
  getTodaysDateHyphenated,
  getTodaysDateUnhyphenated,
  isValidCalendarNoteFilename,
  RE_OFFSET_DATE_CAPTURE,
  RE_OFFSET_DATE,
  toLocaleDateTimeString,
  unhyphenateString,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { logPreference, unsetPreference } from '@helpers/NPdev'
import { displayTitle } from '@helpers/general'
import { getOrMakeNote, getProjectNotesInFolder } from '@helpers/note'
import { relativeDateFromDateString } from '@helpers/NPdateTime'
import { getNoteFilenameFromTitle } from '@helpers/NPnote'
import {
  applyRectToWindow,
  closeWindowFromId,
  getNonMainWindowIds,
  rectToString
} from '@helpers/NPWindows'
// import {
//   openNoteInNewSplit,
//   openNoteInNewWindow
// } from "@helpers/NPWindows";
import { chooseOption, getInputTrimmed, showMessage, showMessageYesNo, showMessageYesNoCancel } from '@helpers/userInput'

//-----------------------------------------------------------------

const pluginID = 'jgclark.WindowSets'

//---------------------------------------------------------------
// WindowSet functions

/**
 * Save detailed set of windows/panes as a set to the preference store for the current machine.
 * V3: writes to prefs
 * @author @jgclark
 */
export async function saveWindowSet(): Promise<void> {
  try {
    if (NotePlan.environment.platform !== 'macOS' || NotePlan.environment.buildVersion < 1100) {
      logInfo(pluginJson, `Window Sets needs NotePlan v3.9.8 or later on macOS. Stopping.`)
      return
    }

    const config = await wsh.getPluginSettings()
    const thisMachineName = NotePlan.environment.machineName

    // Form this set from open windows
    // Note: needs to use a cut-down set of attributes available in the window objects
    const editorWinDetails: Array<wsh.EditorWinDetails> = NotePlan.editors.map((win) => {
      const winRect = win.windowRect
      return {
        noteType: win.type,
        windowType: win.windowType,
        filename: win.filename,
        title: undefined, // gets set later
        x: winRect.x,
        y: winRect.y,
        width: winRect.width,
        height: winRect.height,
      }
    })

    const htmlWinDetails: Array<wsh.HTMLWinDetails> = NotePlan.htmlWindows.map((win) => {
      const winRect = win.windowRect
      return {
        type: win.type,
        pluginID: '?', // gets set later
        pluginCommandName: '?', // gets set later
        customId: win.customId,
        x: winRect.x,
        y: winRect.y,
        width: winRect.width,
        height: winRect.height,
      }
    })
    logDebug(pluginJson, `saveWindowSet starting with ${String(editorWinDetails.length)} editor +  ${String(htmlWinDetails.length)} HTML windows`)

    if ((editorWinDetails.length + htmlWinDetails.length) < 2) {
      const answer = await showMessageYesNo("There's only 1 open window. Are you sure you want to continue to make a Window Set?")
      if (answer === 'No') {
        return
      }
    }

    // Get current saved set names
    let savedWindowSets = await wsh.readWindowSetDefinitions()
    // clo(savedWindowSets, 'savedWindowSets')
    let choice = 0
    let setName = ''
    let isNewSet = false

    // Offer current set names and/or offer to create new one
    if (savedWindowSets.length > 0) {
      logDebug('saveWindowSet', `found ${String(savedWindowSets.length)} existing windowSets`)
      const nameOptions: Array<Object> = []
      nameOptions.push({ value: 0, label: "+ New window set" })
      for (let i = 0; i < savedWindowSets.length; i++) {
        const thisWindowSet = savedWindowSets[i]
        nameOptions.push({ value: i + 1, label: thisWindowSet.name ?? '(error)' })
      }
      const res = await chooseOption('Enter new window set name, or which one to update', nameOptions, 0)
      if (typeof res === 'boolean' && !res) {
        logInfo('saveWindowSet', `User cancelled operation: ${String(res)}.`)
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
        setName = nameOptions[res].label
        logDebug('saveWindowSet', `User selected existing WS '${setName}' from ${String(res)} to update`)
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

    // Start making WS object to save
    let thisWSToSave: wsh.WindowSet = {
      name: setName,
      closeOtherWindows: true,
      editorWindows: [],
      htmlWindows: [],
      machineName: thisMachineName
    }

    // First process Editor windows
    let ewCount = 0
    const firstWindow = editorWinDetails[0]
    for (const ew of editorWinDetails) {
      // clo(ew, String(ewCount))
      let tempFilename = ew.filename
      const thisNote = DataStore.projectNoteByFilename(tempFilename)
      let tempTitle = ''

      // Check to see if any editor windows are calendar dates
      if (ew.noteType === 'Calendar') {
        // Offer to make them a relative date to today/this week etc.
        // Turn this into a daily date at start of period
        const thisDateStr = getDateStringFromCalendarFilename(ew.filename, true)

        let [relativeDateCode, relativeDatePeriod] = relativeDateFromDateString(thisDateStr)
        relativeDateCode = `{${relativeDateCode}}`
        const res = await showMessageYesNoCancel(`Open window '${thisDateStr}' is a calendar note. Do you want to make it a relative date "${relativeDatePeriod}"?`)
        if (res === 'Yes') {
          tempFilename = relativeDateCode
          tempTitle = relativeDatePeriod
        } else if (res === 'No') {
          tempFilename = ew.filename
          // title from calendar note already set
        } else if (res === 'Cancel') {
          logInfo('saveWindowSet', `User cancelled operation.`)
          return
        }
      } else {
        tempTitle = displayTitle(thisNote)
      }
      if (tempFilename === '') {
        logWarn('saveWindowSet', `blank filename for WS '${setName}' title '${tempTitle}'`)
      }
      // Get type of window (ensuring the first will always be 'main')
      const windowType = (ewCount === 0)
        ? 'main'
        : editorWinDetails[ewCount].windowType

      // Create EW object to save with the other details
      let thisEWToSave: wsh.EditorWinDetails = {
        noteType: ew.noteType,
        filename: tempFilename ?? '?',
        title: tempTitle ?? '?',
        windowType: windowType,
        x: ew.x,
        y: ew.y,
        width: ew.width,
        height: ew.height,
      }
      thisWSToSave.editorWindows.push(thisEWToSave)
      ewCount++
    }

    // Now process HTML windows
    // Currently works from lookup list defined at top
    for (const thisHtmlWinDetails of htmlWinDetails) {
      const thisWindowId = thisHtmlWinDetails.customId ?? '?'
      logDebug('saveWindowSet', `- plugin: ${thisWindowId}`)
      const thisPWAC = wsh.pluginWindowsAndCommands.filter((p) => thisWindowId === p.pluginWindowId)[0]
      const thisHWPluginID = (thisPWAC?.pluginID)
        // take from a match in the lookup list
        ? thisPWAC?.pluginID
        : (thisWindowId.match(/^([^\.]+)\.([^\.]+)\.([^\.]+)/))
          // try to guess pluginID from the convention that a customID is "pluginID.window_name"
          ? thisWindowId.split('.', 2).join('.')
          : '? needs to be set from plugin'
      const thisHWPluginCommandName = thisPWAC?.pluginCommandName ?? '? needs to be set from ' + thisWindowId
      const thisHWToSave = {
        type: thisHtmlWinDetails.type,
        pluginID: thisHWPluginID,
        pluginCommandName: thisHWPluginCommandName,
        customId: thisHtmlWinDetails.customId,
        x: thisHtmlWinDetails.x,
        y: thisHtmlWinDetails.y,
        width: thisHtmlWinDetails.width,
        height: thisHtmlWinDetails.height,
      }
      thisWSToSave.htmlWindows.push(thisHWToSave)
      clo(thisWSToSave, `thisHWToSave in set ${setName}`)
    }
    clo(thisWSToSave, `saveWindowSet: thisWSToSave after EWs and HWs (${isNewSet ? 'new set' : 'updated'})`)

    // If we're on NP 3.9.9+ then split window Rects are reported differently than before, so take account of this.
    // As of NP 3.9.9 (b1119), main width = width of whole window (including sidebars which is a bummer). The splits all have x=0/y=0, but width/height are accurate.
    if (NotePlan.environment.buildVersion >= 1121) {
      // Go through main + splits, summing as we go
      const mainX = thisWSToSave.editorWindows[0].x
      const mainY = thisWSToSave.editorWindows[0].y
      // We can't get width of just the first split; it reports the width of all splits together. So calculate
      let mainW = thisWSToSave.editorWindows[0].width
      for (const thisEW of thisWSToSave.editorWindows) {
        if (thisEW.windowType === 'split') {
          mainW -= thisEW.width
        }
      }
      const mainH = thisWSToSave.editorWindows[0].height
      let cumulativeWidth = 0
      logDebug('saveWindowSet', `- mainRect X=${mainX}, mainY=${mainY}, mainW=${mainW}, mainH=${mainH}`)
      for (let i = 0; i < thisWSToSave.editorWindows.length; i++) {
        const thisEW = thisWSToSave.editorWindows[i]
        if (thisEW.windowType === 'main') {
          thisEW.width = mainW
        } else if (thisEW.windowType === 'split') {
          thisEW.x = mainX + cumulativeWidth
          cumulativeWidth += thisEW.width
        } else {
          // do nothing for 'floating' windows
        }
      }
      clo(thisWSToSave, `saveWindowSet: thisWSToSave after dealing with EW splits`)
    }

    // Check window bounds make sense
    thisWSToSave = wsh.checkWindowSetBounds(thisWSToSave)
    // clo(thisWSToSave, 'saveWindowSet: after bounds check')

    // Save to preferences store
    // Add or update this WS
    let WSsToSave = savedWindowSets.slice()
    if (isNewSet) {
      // Add this one
      WSsToSave.push(thisWSToSave)
      logDebug('saveWindowSet', `Added window set '${setName}'. Number WSs now = ${String(WSsToSave.length)}`)
    } else {
      // Find the right one to update
      let c = 0
      let found = false
      for (const set of WSsToSave) {
        // clo(set, 'set')
        if (set.name === setName) {
          logDebug('saveWindowSet', `Updating window set ${String(c)}: ${setName}`)
          WSsToSave[c] = thisWSToSave
          found = true
          break
        }
        c++
      }
      if (!found) {
        logError('saveWindowSet', `Couldn't find window set '${setName}' to update.`)
      }
    }

    DataStore.setPreference('windowSets', WSsToSave)
    logDebug('saveWindowSet', `Saved window sets to local pref`)
    await wsh.logWindowSets()
    const res = wsh.writeWSsToNote(config.folderForDefinitions, config.noteTitleForDefinitions, WSsToSave)
    logDebug('saveWindowSet', `Saved window sets to note`)

    // If we have htmlWindows not in our lookup list, then tell user to update the list with the plugin command Name
    let askUserToComplete = false
    for (const thisHtmlWinDetails of htmlWinDetails) {
      const thisWindowId = thisHtmlWinDetails.customId ?? 'n/a'
      logDebug('saveWindowSet', `for thisHtmlWinDetails: ${thisWindowId}`)
      const thisPWAC = wsh.pluginWindowsAndCommands.filter((p) => thisWindowId === p.pluginWindowId)[0]
      if (!thisPWAC || thisPWAC?.pluginID?.startsWith('?')) {
        askUserToComplete = true
      }
    }
    const numWindowsStr = `${String(thisWSToSave.editorWindows?.length ?? 0)} note${thisWSToSave.htmlWindows?.length > 0 ? ' + ' + String(thisWSToSave.htmlWindows?.length) + ' plugin' : ''} windows`
    if (askUserToComplete) {
      const res = await showMessage(`Window Set '${setName}' with (${numWindowsStr}) has been ${isNewSet ? 'added' : 'updated'}.\n\nI couldn't identify some HTML (plugin) window commands from the ones I know about. Please complete their details in the WindowSet note before trying to open this window set.`, 'OK', 'Window Sets', false)
    } else {
      const res = await showMessage(`Window Set '${setName}' with (${numWindowsStr}) has been ${isNewSet ? 'added' : 'updated'}.`, 'OK', 'Window Sets', false)
    }
  }
  catch (error) {
    logError('saveWindowSet', JSP(error))
  }
}

/**
 * Open the saved window set named 'setName' (if given) or ask user to select from list from this machine.
 * V3: reads from local preferences
 * @author @jgclark
 * @param {string?} setName to open; if not given, will ask user
 * @returns {boolean} success?
 */
export async function openWindowSet(setName: string = ''): Promise<boolean> {
  try {
    if (NotePlan.environment.platform !== 'macOS' || NotePlan.environment.buildVersion < 1100) {
      logInfo(pluginJson, `Window Sets needs NotePlan v3.9.8 or later on macOS. Stopping.`)
      return false
    }
    logDebug(pluginJson, `openWindowSet starting with param setName '${setName}'`)

    const config = await wsh.getPluginSettings()
    const thisMachineName = NotePlan.environment.machineName
    let success = false
    let thisWS: wsh.WindowSet
    let res: wsh.WindowSet | null
    if (setName !== '') {
      res = wsh.getDetailedWindowSetByName(setName)
    }
    if (res) {
      // Use this one
      thisWS = res
      logDebug('openWindowSet', `Request for window set '${setName}' by parameter`)
    }
    else {
      // Form list of window sets to choose from
      // Get all available windowSets for this machine
      const savedWindowSets = await wsh.readWindowSetDefinitions(thisMachineName)
      // if (savedWindowSets.length === 0) {
      //   logInfo('logWindowSets', `No saved windowSets object found for machine '${thisMachineName}'.`)

      let c = -1
      const setChoices = savedWindowSets.map((sws) => {
        c++
        return {
          label: `${sws.name} (with ${String(sws.editorWindows?.length ?? 0)} note${sws.htmlWindows?.length > 0 ? ' + ' + String(sws.htmlWindows?.length) + ' plugin' : ''} windows)`, value: c
        }
      })
      const num = await chooseOption("Which Window Set to open?", setChoices)
      if (isNaN(num)) {
        logInfo(pluginJson, `No valid set chosen, so stopping.`)
        return false
      }
      thisWS = savedWindowSets[Number(num)]
      const setName = thisWS.name
      // logDebug('openWindowSet', `User requests window set '${setName}'`)
    }

    clo(thisWS, 'WindowSet to open')

    // First close other windows (if requested)
    if (thisWS.closeOtherWindows) {
      logDebug('openWindowSet', `Attempting to close any other windows that aren't part of the set`)

      // Get list of currently open non-main windows
      const openWindowIds = getNonMainWindowIds()
      for (const winId of openWindowIds) {
        closeWindowFromId(winId)
        logDebug('openWindowSet', `- closed window ID ${winId}`)
      }
    }

    // Now open new windows/splits
    let openCount = 0
    // First any HTMLView windows (currently just plugins)
    if (thisWS.htmlWindows.length > 0) logDebug('openWindowSet', `Attempting to open ${String(thisWS.htmlWindows.length)} plugin window(s)`)
    for (const hw of thisWS.htmlWindows) {
      switch (hw.type) {
        case 'html': {
          logDebug('openWindowSet', `- Calling Plugin '${hw.pluginID}::${hw.pluginCommandName}' ...`)
          await DataStore.invokePluginCommandByName(hw.pluginCommandName, hw.pluginID)
          // If x,y,w,h given the override now
          if (hw.x && hw.y && hw.width && hw.height) {
            const rect = { x: hw.x, y: hw.y, width: hw.width, height: hw.height }
            logDebug('openWindowSet', `  - applying Rect definition ${rectToString(rect)} to ${thisWS.name}`)
            applyRectToWindow(rect, hw.customId)
          }
          break
        }
        default: {
          logError('openWindowSet', `- WS '${thisWS.name}' has unsupported HTMLView type '${hw.type}'`)
        }
      }
    }

    logDebug('openWindowSet', `Attempting to open ${String(thisWS.editorWindows.length)} note window(s)`)
    for (const ew of thisWS.editorWindows) {
      if (ew.filename === '') {
        logWarn('openWindowSet', `- WS '${thisWS.name}' has an empty Editor filename: ignoring. Please check the definitions in the Window Set note.`)
        continue
      }

      // Decide which 'resource' (project note/calendar note/plugin) to open
      let resourceToOpen = ew.filename
      if (ew.windowType === 'floating') {
        // Open in a full window pane
        switch (ew.noteType) {
          case 'Calendar': {
            // if this is a relative date, calculate the actual date
            if (resourceToOpen.match(RE_OFFSET_DATE)) {
              const dateOffsetStrings = resourceToOpen.match(RE_OFFSET_DATE_CAPTURE) ?? ['']
              logDebug('dateOffsetStrings', String(dateOffsetStrings))
              const dateOffsetString = dateOffsetStrings[1] // first capture group
              logDebug('dateOffsetStrings', `- calculated relative date ${dateOffsetString}`)
              resourceToOpen = calcOffsetDateStr(getTodaysDateHyphenated(), dateOffsetString, 'offset')
              // Grr, need to change back to YYYYMMDD if daily note
              resourceToOpen = getFilenameDateStrFromDisplayDateStr(resourceToOpen)
              logDebug('dateOffsetStrings', `- resourceToOpen = ${resourceToOpen}`)
            }
            logDebug('openWindowSet', `- will open Calendar '${resourceToOpen}' in split`)
            const res = await Editor.openNoteByDateString(resourceToOpen, (openCount > 0), 0, 0, false)
            openCount++
            break
          }
          default: { // 'Note'
            const res = await Editor.openNoteByFilename(resourceToOpen, (openCount > 0), 0, 0, false, false)
            openCount++
            break
          }
        }
        logDebug('openWindowSet', `- opened '${resourceToOpen}' in float`)
      }
      else {
        // Open in a main or split window. (Main only for the first one.)
        switch (ew.noteType) {
          case 'Calendar': {
            // if this is a relative date, calculate the actual date
            if (resourceToOpen.match(RE_OFFSET_DATE)) {
              logDebug('openWindowSet', `  - trying note filename '${ew.filename}' with windowType ${ew.windowType}`)
              const dateOffsetStrings = resourceToOpen.match(RE_OFFSET_DATE_CAPTURE) ?? ['']
              const dateOffsetString = dateOffsetStrings[1] // first capture group
              logDebug('dateOffsetStrings', `  - dateOffsetString = ${dateOffsetString}`)
              resourceToOpen = calcOffsetDateStr(getTodaysDateUnhyphenated(), dateOffsetString, 'offset')
              logDebug('dateOffsetStrings', `  - resourceToOpen = ${resourceToOpen}`)
            }
            const res = await Editor.openNoteByDateString(resourceToOpen, false, 0, 0, (openCount > 0))
            if (res) {
              openCount++
              logDebug('openWindowSet', `- opened Calendar note ${resourceToOpen} in ${(openCount > 0) ? 'split' : 'main'}`)
            } else {
              logWarn('openWindowSet', `- problem opening Calendar note ${resourceToOpen} in ${(openCount > 0) ? 'split' : 'main'}`)
            }
            break
          }
          default: { // 'Note'
            const res = await Editor.openNoteByFilename(resourceToOpen, false, 0, 0, (openCount > 0), false)
            if (res) {
              openCount++
              logDebug('openWindowSet', `- opened Note ${resourceToOpen} in split`)
            } else {
              logError('openWindowSet', `- problem opening Note ${resourceToOpen} in split`)
            }
            break
          }
        }
      }
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
 * V1: reads from/writes to DataStore.preference('windowSets')
 * @author @jgclark
 * @param {string} setName to open
 * @returns {boolean} success?
 */
export async function deleteWindowSet(setName: string): Promise<boolean> {
  try {
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
    logInfo('deleteWindowSet', `You have asked to delete window set #${String(num)}`)

    // Delete this window set, and save back to preferences store
    windowSets.splice(Number(num), 1)
    DataStore.setPreference('windowSets', windowSets)
    logDebug('deleteWindowSet', `Window set '${setName}'`)
    wsh.logWindowSets()

    return true
  }
  catch (error) {
    logError('deleteWindowSet', JSP(error))
    return false
  }
}

/**
 * Delete all saved window sets
 * V1: writes to DataStore.preference('windowSets')
 */
export async function deleteAllSavedWindowSets(): Promise<void> {
  try {
    unsetPreference('windowSets')
    logInfo('deleteAllSavedWindowSets', `Deleted all Window Sets`)
  }
  catch (error) {
    logError('deleteAllSavedWindowSets', JSP(error))
  }
}
