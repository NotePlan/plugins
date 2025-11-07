// @flow
//---------------------------------------------------------------
// Main functions for WindowSets plugin
// Jonathan Clark
// last update 2025-10-26 for v1.4.0 by @jgclark
//---------------------------------------------------------------
// ARCHITECTURE:
// - 1 local preference 'windowSets' that contains JS Array<WindowSet>
// - 1 global user-visible note (by default @WindowSets/Window Sets) with JSON version of local preference that is updated to stay in sync with the local pref
//   - onEditorWillSave() is run by trigger to decide whether to run writeWSNoteToPrefs
//   - writeWSNoteToPrefs() sends note to pref -- and can be run manually by /wnp
//   - writeWSsToNote() sends pref to note -- and can be run manually by /wpn
// - if no window sets found in pref, plugin offers to write 2 example sets
//
// Minimum NP versions:
// - 3.9.8  (generally)
// - 3.18.0 (for decorated command bar options)
// - 3.19.2 (for main sidebar width control -- macOS only)
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import * as wth from './WTHelpers'
import { checkPluginCommandNameAvailable } from '@helpers/NPConfiguration'
import {
  calcOffsetDateStr,
  getDateStringFromCalendarFilename,
  getFilenameDateStrFromDisplayDateStr,
  getTodaysDateHyphenated,
  getTodaysDateUnhyphenated,
  RE_OFFSET_DATE_CAPTURE,
  RE_OFFSET_DATE,
} from '@helpers/dateTime'
import { clo, isObjectEmpty, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { logPreference, unsetPreference } from '@helpers/NPdev'
import { displayTitle } from '@helpers/general'
import {
  getCalendarFilenameFromDateString,
  getShortOffsetDateFromDateString
} from '@helpers/NPdateTime'
import { usersVersionHas } from '@helpers/NPVersions'
import {
  applyRectToHTMLWindow,
  closeSidebar,
  closeWindowFromId,
  findEditorWindowByFilename,
  isHTMLWindowOpen,
  getNonMainWindowIds,
  logSidebarWidth,
  openSidebar,
  rectToString,
} from '@helpers/NPWindows'
import { chooseDecoratedOptionWithModifiers, chooseOption, getInputTrimmed, showMessage, showMessageYesNo, showMessageYesNoCancel } from '@helpers/userInput'

//---------------------------------------------------------------
// Constants

const SUPPORTS_DECORATED_COMMAND_BAR_OPTIONS = 1413 // v3.18.0

//---------------------------------------------------------------
// WindowSet functions

/**
 * Save detailed set of windows/panes as a set to the preference store for the current machine.
 * V3: writes to prefs
 * TODO: Support saving folder views as well as note. API support added somewhere around v3.17 it seems. Done all that's needed (I think) in OWS but will need to check once API bug is fixed, and then update this as well. 
 * Note: limitation that folder views only seem to be able to be opened in the (first) main Editor window.
 * Note: Plugin declares minimum NP version 3.9.8.
 * @author @jgclark
 */
export async function saveWindowSet(): Promise<void> {
  try {
    if (NotePlan.environment.platform !== 'macOS') {
      logInfo(pluginJson, `Window Sets commands can only run on macOS. Stopping.`)
      return
    }

    const config = await wth.getPluginSettings()
    const thisMachineName = NotePlan.environment.machineName
    const foldersList: $ReadOnlyArray<string> = DataStore.folders

    // Form this set from open windows
    // Note: needs to use a cut-down set of attributes available in the window objects
    const editorWinDetails: Array<wth.EditorWinDetails> = NotePlan.editors.map((win) => {
      const winRect = win.windowRect
      const isFolder = foldersList.includes(win.filename) // TEST: when @EM fixes win.filename being blank or null for folder views
      return {
        resourceType: isFolder ? 'Folder' : win.type,
        windowType: win.windowType,
        filename: win.filename,
        title: undefined, // gets set later
        x: winRect.x,
        y: winRect.y,
        width: winRect.width,
        height: winRect.height,
      }
    })

    const htmlWinDetails: Array<wth.HTMLWinDetails> = NotePlan.htmlWindows.map((win) => {
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
    const savedWindowSets = await wth.readWindowSetDefinitions()
    // clo(savedWindowSets, 'savedWindowSets')

    let setName: string = ''
    let isNewSet = false

    // Offer current set names and/or offer to create new one
    if (savedWindowSets.length > 0) {
      logDebug('saveWindowSet', `found ${String(savedWindowSets.length)} existing windowSets`)
      let chosenSetIndex = -1

      if (NotePlan.environment.buildVersion >= SUPPORTS_DECORATED_COMMAND_BAR_OPTIONS) { // = 3.18.0
        const decoratedSetChoices: Array<TCommandBarOptionObject> = makeDecoratedWSChoices(savedWindowSets)
        // Prepare a new window set option
        const newWSChoice = ({
          text: 'Add new Window Set',
          icon: 'plus',
          color: 'orange-500',
          shortDescription: `New`,
          alpha: 0.8,
          darkAlpha: 0.8,
        })
        const chosenOption = await chooseDecoratedOptionWithModifiers(`Select Window Set to add or update for ${thisMachineName}?`, decoratedSetChoices, newWSChoice)
        chosenSetIndex = chosenOption.index
        if (chosenSetIndex === -1) {
          isNewSet = true
          setName = chosenOption.value ?? 'New Window Set'
        } else {
          setName = savedWindowSets[chosenSetIndex - 1]?.name ?? '(error)'
          isNewSet = false
          logDebug('saveWindowSet', `chosen WS '${setName}' from chosenSetIndex = ${String(chosenSetIndex)}`)
        }
      } else {
        const simpleSetChoices = makeSimpleWSChoices(savedWindowSets, true)
        const res: number | boolean = await chooseOption(`Select Window Set to add or update for ${thisMachineName}?`, simpleSetChoices)
        if (typeof res !== 'number') {
          logInfo('saveWindowSet', `User cancelled operation.`)
          return
        }
        const WSNum: number = res
        if (WSNum === -1) {
          const newName = await getInputTrimmed('Enter name for new Window Set', 'OK', 'New Window Set name')
          if (!newName) {
            logInfo('saveWindowSet', `User cancelled operation.`)
            return
          }
          setName = String(newName) // to satisfy flow
          isNewSet = true
        } else {
          setName = savedWindowSets[WSNum]?.name ?? '(error)'
          logDebug('saveWindowSet', `User selected existing WS '${setName}' from ${String(WSNum)} to update`)
        }
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

    // Start making WS object to save (for now without mainSidebarWidth)
    let thisWSToSave: wth.WindowSet = {
      name: setName,
      closeOtherWindows: true,
      editorWindows: [],
      htmlWindows: [],
      machineName: thisMachineName,
    }

    // First process Editor windows
    let ewCount = 0
    // const firstWindow = editorWinDetails[0]
    for (const ew of editorWinDetails) {
      let tempFilename = ew.filename
      // Get note from filename, first trying Notes, then Calendar
      let thisNote = DataStore.noteByFilename(tempFilename, 'Notes')
      if (!thisNote) {
        thisNote = DataStore.noteByFilename(tempFilename, 'Calendar')
      }
      if (!thisNote) {
        logWarn('saveWindowSet', `- can't find note with filename '${tempFilename}' for WS '${setName}'. Skipping window ${String(ewCount)} of ${String(editorWinDetails.length)}.`)
        clo(ew, `editorWinDetails for the window that can't be found`)
        continue
      }
      // TODO(later): Try to support open folder as well as note. As of v3.16.3 (and still at 3.19.2) it requires EM to add support for this in the API.
      let tempTitle = ''

      // Check to see if any editor windows are calendar dates
      if (ew.resourceType === 'Calendar') {
        // Offer to make them a relative date to today/this week etc.
        // Turn this into a daily date at start of period
        const thisDateStr = getDateStringFromCalendarFilename(ew.filename, true)

        // eslint-disable-next-line prefer-const
        let [relativeDateCode, relativeDatePeriod] = getShortOffsetDateFromDateString(thisDateStr)
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
      const thisEWToSave: wth.EditorWinDetails = {
        resourceType: ew.resourceType,
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
      const thisPWAC = wth.pluginWindowsAndCommands.filter((p) => thisWindowId === p.pluginWindowId)[0]
      const thisHWPluginID = (thisPWAC?.pluginID)
        // take from a match in the lookup list
        ? thisPWAC?.pluginID
        : (thisWindowId.match(/^([^\.]+)\.([^\.]+)\.([^\.]+)/))
          // try to guess pluginID from the convention that a customID is "pluginID.window_name"
          ? thisWindowId.split('.', 2).join('.')
          : '? needs to be set from plugin'
      const thisHWPluginCommandName = thisPWAC?.pluginCommandName ?? `? needs to be set from ${thisWindowId}`
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

    // Note: As of NP 3.9.9 (b1119), main width = width of whole window (including sidebars which is a bummer). The splits all have x=0/y=0, but width/height are accurate.

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

    // TEST: If we can find out the main sidebar width, and we want to save it, then add it to the WS object
    if (usersVersionHas('mainSidebarControl') && config.saveMainSidebarWidth) {
      // FIXME(Eduard): doesn't set to 0 when sidebar is hidden! And no other way to tell.
      const mainSidebarWidth = NotePlan.getSidebarWidth()
      logSidebarWidth()
      thisWSToSave.mainSidebarWidth = mainSidebarWidth
    }

    // Check window bounds make sense
    thisWSToSave = wth.checkWindowSetBounds(thisWSToSave)
    // clo(thisWSToSave, 'saveWindowSet: after bounds check')

    // Save to preferences store
    // Add or update this WS
    const WSsToSave = savedWindowSets.slice()
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
    wth.logWindowSet(thisWSToSave, thisMachineName)
    const res = await wth.writeWSsToNote(config.folderForDefinitions, config.noteTitleForDefinitions, WSsToSave)
    logDebug('saveWindowSet', `Saved window sets to note, with result ${String(res)}`)

    // If we have htmlWindows not in our lookup list, then ask the user to update the list with the plugin command Name
    let askUserToComplete = false
    for (const thisHtmlWinDetails of htmlWinDetails) {
      const thisWindowId = thisHtmlWinDetails.customId ?? 'n/a'
      logDebug('saveWindowSet', `for thisHtmlWinDetails: ${thisWindowId}`)
      const thisPWAC = wth.pluginWindowsAndCommands.filter((p) => thisWindowId === p.pluginWindowId)[0]
      if (!thisPWAC || thisPWAC?.pluginID?.startsWith('?')) {
        askUserToComplete = true
      }
    }
    const numWindowsStr = `${String(thisWSToSave.editorWindows?.length ?? 0)} note${thisWSToSave.htmlWindows?.length > 0 ? ` + ${String(thisWSToSave.htmlWindows?.length)} plugin` : ''} windows`
    if (askUserToComplete) {
      const res = await showMessage(`Window Set '${setName}' with (${numWindowsStr}) has been ${isNewSet ? 'added' : 'updated'}.\n\nI couldn't identify some plugin windows from the ones I know about. Please complete their details in the WindowSet note before trying to open this window set.`, 'OK', 'Window Sets', false)
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
 * @param {string?} setNameArg name of WS to open; if not given, will ask user
 * @returns {boolean} success?
 */
export async function openWindowSet(setNameArg: string = ''): Promise<boolean> {
  try {
    if (NotePlan.environment.platform !== 'macOS') {
      logInfo(pluginJson, `Window Sets commands can only run on macOS. Stopping.`)
      return false
    }
    logDebug(pluginJson, `openWindowSet starting with param setNameArg '${setNameArg}'`)

    const thisMachineName = NotePlan.environment.machineName
    // let success = false
    let thisWS: wth.WindowSet
    let res: wth.WindowSet | null
    if (setNameArg !== '') {
      res = await wth.getDetailedWindowSetByName(setNameArg)
    }
    if (res) {
      // Use this one
      thisWS = res
      logDebug('openWindowSet', `Request for window set '${setNameArg}' by parameter`)
    }
    else {
      // Form list of window sets to choose from

      // Get all available windowSets for this machine
      const savedWindowSets = await wth.readWindowSetDefinitions(thisMachineName)
      if (savedWindowSets.length === 0) {
        logInfo('logWindowSets', `No saved windowSets object found for machine '${thisMachineName}', so stopping`)
        const res = await showMessage(`Sorry: you have no saved Window Sets for machine '${thisMachineName}'.`, 'OK', 'Window Sets', false)
        return false
      }

      let chosenSetIndex: number = -1
      if (NotePlan.environment.buildVersion >= SUPPORTS_DECORATED_COMMAND_BAR_OPTIONS) { // = 3.18.0
        const decoratedSetChoices: Array<TCommandBarOptionObject> = makeDecoratedWSChoices(savedWindowSets)
        const chosenOption = await chooseDecoratedOptionWithModifiers(`Select Window Set to open on ${thisMachineName}?`, decoratedSetChoices)
        chosenSetIndex = chosenOption.index
        // logDebug('openWindowSet', `chosenSetIndex = ${String(chosenSetIndex)}`)
      } else {
        const simpleSetChoices = makeSimpleWSChoices(savedWindowSets, false)
        const chosenOption = await chooseOption(`Select Window Set to open on ${thisMachineName}?`, simpleSetChoices)
        if (typeof chosenOption !== 'number') {
          logInfo('saveWindowSet', `User cancelled operation.`)
          return false
        }
        chosenSetIndex = chosenOption
      }
      thisWS = savedWindowSets[chosenSetIndex]
      // clo(thisWS, `Chosen WindowSet '${thisWS.name}'`)
    }

    // const setName = thisWS.name
    wth.logWindowSet(thisWS, thisMachineName)

    // First close other windows (if requested)
    if (thisWS.closeOtherWindows) {
      logDebug('openWindowSet', `Closing all non-main Editor windows and any HTMLView windows that aren't part of the set`)
      // Close all open non-main Editor windows
      const openEditorWindowIds = getNonMainWindowIds('Editor')
      for (const winId of openEditorWindowIds) {
        closeWindowFromId(winId)
        logDebug('openWindowSet', `- closed Editor window ID ${winId}`)
      }
      // Close all open HTMLView windows that aren't part of the set
      const openHtmlWindowIds = getNonMainWindowIds('HTMLView')
      for (const winId of openHtmlWindowIds) {
        if (thisWS.htmlWindows.some((hw) => hw.customId === winId)) {
          closeWindowFromId(winId)
          logDebug('openWindowSet', `- closed HTML window ID ${winId}`)
        } else {
          logDebug('openWindowSet', `- NOT closing HTML window ID ${winId}`)
        }
      }
    }

    // count which item we're on in the window set
    let openCount = 0

    // First open any HTMLView windows (currently just plugins: run the plugin command) if not already open
    const htmlWindowsToOpen = thisWS.htmlWindows.filter((hw) => !isHTMLWindowOpen(hw.customId ?? ''))
    if (htmlWindowsToOpen.length > 0) {
      logDebug('openWindowSet', `Attempting to open ${String(htmlWindowsToOpen.length)} plugin window(s): [${htmlWindowsToOpen.map((hw) => hw.customId).join(', ')}]`)
      for (const hw of htmlWindowsToOpen) {
        switch (hw.type) {
          case 'html': {
            logDebug('openWindowSet', `- Calling Plugin '${hw.pluginID}' with command '${hw.pluginCommandName}' ...`)
            // Be helpful and check that pluginCommandName is the right capitalization by checking all install plugin command names for this plugin
            const caseCheckedPluginCommandName: string = checkPluginCommandNameAvailable(hw.pluginCommandName, hw.pluginID)
            if (caseCheckedPluginCommandName === '') {
              logWarn('openWindowSet', `- Plugin command '${hw.pluginCommandName}' is not available for plugin '${hw.pluginID}'. Perhaps the plugin is not installed, or has changed the command name? Please correct the Window Set note.`)
              continue
            }

            if (hw.pluginCommandName !== caseCheckedPluginCommandName) {
              logWarn('openWindowSet', `- Plugin command '${hw.pluginCommandName}' is not the correct capitalization for plugin '${hw.pluginID}'. It should be '${caseCheckedPluginCommandName}', which I will use now, but please Save the Window Set again to update the note.`)
            }

            await DataStore.invokePluginCommandByName(caseCheckedPluginCommandName, hw.pluginID)
            // If x,y,w,h given, then update window position/size
            if (Number.isFinite(hw.x) && Number.isFinite(hw.y) && Number.isFinite(hw.width) && Number.isFinite(hw.height)) {
              const rect = { x: hw.x, y: hw.y, width: hw.width, height: hw.height }
              logDebug('openWindowSet', `  - applying Rect definition ${rectToString(rect)}`)
              applyRectToHTMLWindow(rect, hw.customId)
            }
            break
          }
          default: {
            logError('openWindowSet', `- WS '${thisWS.name}' has unsupported HTMLView type '${hw.type}'`)
          }
        }
      }
    } else {
      logDebug('openWindowSet', `There are no HTML windows to open in this Window Set`)
    }

    // Now open new windows/splits
    logDebug('openWindowSet', `Attempting to open ${String(thisWS.editorWindows.length)} note window(s)`)
    let mainRect: Rect // to save whatever the 'main' Editor is in this WS
    for (const ew of thisWS.editorWindows) {
      if (ew.filename === '') {
        logWarn('openWindowSet', `- WS '${thisWS.name}' has an empty Editor filename: ignoring. Please check the definitions in the Window Set note.`)
        continue
      }
      // Decide which 'resource' (project note/calendar note/plugin) to open
      let resourceFilenameToOpen = ew.filename

      if (ew.windowType === 'floating') {
        // Open in a full window pane
        switch (ew.resourceType) {
          case 'Calendar': {
            // We need to have a related dateString as well as calendar note filename:
            let resourceDateStrToOpen = resourceFilenameToOpen

            // if this is a relative date, calculate the actual date
            if (resourceFilenameToOpen.match(RE_OFFSET_DATE)) {
              const dateOffsetStrings = resourceFilenameToOpen.match(RE_OFFSET_DATE_CAPTURE) ?? ['']
              const dateOffsetString = dateOffsetStrings[1] // first capture group
              // logDebug('openWindowSet', `- calculated relative date ${dateOffsetString}`)

              resourceDateStrToOpen = calcOffsetDateStr(getTodaysDateHyphenated(), dateOffsetString, 'offset')
              // Grr, need to change back to YYYYMMDD if daily note
              resourceDateStrToOpen = getFilenameDateStrFromDisplayDateStr(resourceDateStrToOpen)
              logDebug('openWindowSet', `- resourceDateStrToOpen = ${resourceDateStrToOpen}`)
              resourceFilenameToOpen = getCalendarFilenameFromDateString(resourceDateStrToOpen)
              logDebug('openWindowSet', `  -> resourceFilenameToOpen = ${resourceFilenameToOpen}`)
            }
            logDebug('openWindowSet', `- opening Calendar '${resourceDateStrToOpen}' (${resourceFilenameToOpen}) in new floating window`)
            const res = await Editor.openNoteByDateString(resourceDateStrToOpen, (openCount > 0), 0, 0, false)

            // then move/resize window
            // need to find new window's reference to use in the next line from the filename
            const thisEditorWindow = findEditorWindowByFilename(resourceFilenameToOpen)
            if (!thisEditorWindow) {
              logWarn('openWindowSet', `  - unable to find new Editor window with filename ${resourceFilenameToOpen} so cannot set its size/position.`)
            } else {
              const thisRect = wth.formRectFromWindowDetails(ew, resourceFilenameToOpen)
              logDebug('openWindowSet', `  - applying Rect definition ${rectToString(thisRect)} to new floating Editor window`)
              thisEditorWindow.windowRect = thisRect
              // FIXME(Eduard): following shows that it doesn't seem to set correctly
              logDebug('openWindowSet', `  - ⛳️ check: this rect reports as: ${rectToString(thisEditorWindow.windowRect)}`)
            }
            openCount++
            break
          }
          case 'Folder': { // supported from ~v3.17
            logWarn('openWindowSet', `- wanting to open Folder '${resourceFilenameToOpen}' in a Floating window, but that isn't supported. So will open in first Editor window instead.`)
            const res = await Editor.openNoteByFilename(resourceFilenameToOpen, false, 0, 0, false, false)
            // FIXME(Eduard): never gets here whatever I try, and no notification in NP's own log. #waiting since 15.8.25
            if (res) {
              openCount++
              logDebug('openWindowSet', `- opened Folder ${resourceFilenameToOpen} in main Editor window. openCount -> ${openCount}`)
            } else {
              logWarn('openWindowSet', `- problem opening Folder ${resourceFilenameToOpen} in main Editor window`)
            }
            break
          }
          default: { // 'Note'
            logDebug('openWindowSet', `- opening Note '${resourceFilenameToOpen}' in new floating window`)
            const res = await Editor.openNoteByFilename(resourceFilenameToOpen, (openCount > 0), 0, 0, false, false)

            // then move/resize window
            // need to find new window's reference to use in the next line ...
            const thisEditorWindow = findEditorWindowByFilename(resourceFilenameToOpen)
            if (!thisEditorWindow) {
              logWarn('openWindowSet', `  - unable to find new Editor window with filename ${resourceFilenameToOpen} so cannot set its size/position.`)
            } else {
              const thisRect = wth.formRectFromWindowDetails(ew, resourceFilenameToOpen)
              logDebug('openWindowSet', `  - applying Rect definition ${rectToString(thisRect)} to new floating Editor window`)
              thisEditorWindow.windowRect = thisRect
              // FIXME(Eduard): following shows that it doesn't seem to set correctly
              logDebug('openWindowSet', `  - ⛳️ check: this rect reports as: ${rectToString(thisEditorWindow.windowRect)}`)
            }
            openCount++
            break
          }
        }
        logDebug('openWindowSet', `- opened '${resourceFilenameToOpen}' in float. openCount -> ${openCount}`)
      }
      else {
        // Open in a main or split window. (Main only for the first one.)
        if (ew.windowType === 'main') {
          mainRect = wth.formRectFromWindowDetails(ew, ew.filename)
        }
        // logDebug('openWindowSet', `- ew.noteType = ${ew.noteType}`)

        switch (ew.resourceType) {
          case 'Calendar': {
            // We need to have a related dateString as well as calendar note filename:
            let resourceDateStrToOpen = resourceFilenameToOpen

            // if this is a relative date, calculate the actual date
            if (resourceFilenameToOpen.match(RE_OFFSET_DATE)) {
              logDebug('openWindowSet', `  - trying note filename '${ew.filename}' with windowType ${ew.windowType}`)
              const dateOffsetStrings = resourceFilenameToOpen.match(RE_OFFSET_DATE_CAPTURE) ?? ['']
              const dateOffsetString = dateOffsetStrings[1] // first capture group
              logDebug('openWindowSet', `  - dateOffsetString = ${dateOffsetString}`)
              resourceDateStrToOpen = calcOffsetDateStr(getTodaysDateUnhyphenated(), dateOffsetString, 'offset')
              // Grr, need to change back to YYYYMMDD if daily note
              resourceDateStrToOpen = getFilenameDateStrFromDisplayDateStr(resourceDateStrToOpen)
              logDebug('openWindowSet', `  - resourceDateStrToOpen = ${resourceDateStrToOpen}`)
              resourceFilenameToOpen = getCalendarFilenameFromDateString(resourceDateStrToOpen)
              logDebug('openWindowSet', `  -> resourceFilenameToOpen = ${resourceFilenameToOpen}`)
            }
            logDebug('openWindowSet', `- opening Calendar '${resourceDateStrToOpen}' (${resourceFilenameToOpen}) in sub-window`)
            const res = await Editor.openNoteByDateString(resourceDateStrToOpen, false, 0, 0, (openCount > 0))
            if (res) {
              logDebug('openWindowSet', `- opened Calendar note ${resourceFilenameToOpen} in ${(openCount > 0) ? 'split' : 'main'}`)
              openCount++
            } else {
              logWarn('openWindowSet', `- problem opening Calendar note ${resourceFilenameToOpen} in ${(openCount > 0) ? 'split' : 'main'}`)
            }
            break
          }
          case 'Folder': { // supported from ~v3.17
            // TODO: use NPOpenFolders::openFolderView() instead? Though it will ask user questions
            const res = await Editor.openNoteByFilename(resourceFilenameToOpen, false, 0, 0, false, false)
            // logDebug('openWindowSet', `- openNoteByFilename -> ${typeof res} ${String(res)}`)
            if (res) {
              logDebug('openWindowSet', `- opened Folder ${resourceFilenameToOpen} in main Editor window. openCount -> ${openCount}`)
              openCount++
            } else {
              logWarn('openWindowSet', `- problem opening Folder ${resourceFilenameToOpen} in main Editor window`)
            }
            break
          }
          default: { // 'Note'
            const res = await Editor.openNoteByFilename(resourceFilenameToOpen, false, 0, 0, (openCount > 0), false)
            if (res) {
              logDebug('openWindowSet', `- opened Note ${resourceFilenameToOpen} in split`)
              openCount++
            } else {
              logWarn('openWindowSet', `- problem opening Note ${resourceFilenameToOpen} in split`)
            }
            break
          }
        }
        // logDebug('openWindowSet', `- [loop] openCount -> ${openCount}`)
      }
    }

    // Now set main (left) sidebar width if requested
    const requestedMainSidebarWidth = thisWS.mainSidebarWidth ?? NaN
    if (isNaN(requestedMainSidebarWidth)) {
      logDebug('openWindowSet', `- no main sidebar width requested, so will leave as is`)
    } else if (requestedMainSidebarWidth === 0) {
      logDebug('openWindowSet', `- main sidebar width requested is 0, so will hide it`)
      closeSidebar()
    } else {
      logDebug('openWindowSet', `- main sidebar width requested is ${String(requestedMainSidebarWidth)}, so will show it and set its width to ${String(requestedMainSidebarWidth)}`)
      openSidebar(requestedMainSidebarWidth)
    }

    // Now set windowRect for whole main Editor, using saved x,y,w,h from the 'main' part of this WS
      if (mainRect && !isObjectEmpty(mainRect)) {
        logDebug('openWindowSet', `- applying Rect definition ${rectToString(mainRect)} to whole main Editor window`)
        Editor.windowRect = mainRect
      } else {
        logWarn('openWindowSet', `- couldn't find rect details for main window to apply to whole Editor, so won't.`)
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
 * @param {string} setNameArg name of WS to delete
 * @returns {boolean} success?
 */
export async function deleteWindowSet(setNameArg: string): Promise<boolean> {
  try {
    let thisWSNum: number = NaN
    const windowSets = await wth.readWindowSetDefinitions()
    const allWSNames = windowSets.map((sws) => sws.name)

    if (setNameArg !== '') {
      logDebug('openWindowSet', `Request for window set '${setNameArg}' by parameter`)
      if (allWSNames.includes(setNameArg)) {
        thisWSNum = allWSNames.indexOf(setNameArg)
      }
      logDebug('openWindowSet', `-> found as WS #${thisWSNum}`)
    }

    if (isNaN(thisWSNum)) {
      logDebug(pluginJson, `deleteWindowSet: Found ${windowSets.length} window sets`)

      // Get list of window sets to choose from
      if (NotePlan.environment.buildVersion >= SUPPORTS_DECORATED_COMMAND_BAR_OPTIONS) { // = 3.18.0
        const decoratedSetChoices: Array<TCommandBarOptionObject> = makeDecoratedWSChoices(windowSets)
        const chosenOption = await chooseDecoratedOptionWithModifiers(`Select Window Set to delete?`, decoratedSetChoices)
        thisWSNum = chosenOption.index
        if (isNaN(thisWSNum)) {
          logInfo(pluginJson, `No valid set chosen, so stopping.`)
          return false
        }
      } else {
        const simpleSetChoices = makeSimpleWSChoices(windowSets, false)
        const chosenOption = await chooseOption(`Select Window Set to delete?`, simpleSetChoices)
        if (typeof chosenOption !== 'number') {
          logInfo('deleteWindowSet', `User cancelled operation.`)
          return false
        }
      }
      const setName: string = windowSets[thisWSNum]?.name ?? '(error)'
      logInfo('deleteWindowSet', `You have asked to delete window set #${String(thisWSNum)} '${setName}'`)
    }

    // Delete this window set, and save back to preferences store
    windowSets.splice(Number(thisWSNum), 1)
    DataStore.setPreference('windowSets', windowSets)
    // logDebug('deleteWindowSet', `Deleted WS '${thisWS}'`)
    const res = await wth.writeWSsToNote()

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
    const config = await wth.getPluginSettings()
    unsetPreference('windowSets')
    logInfo('deleteAllSavedWindowSets', `Deleted all Window Sets`)
    const res = await showMessage(`Deleted all saved Window Sets. Note that this doesn't delete the visible version of them in note ${config.folderForDefinitions}/${config.noteTitleForDefinitions}.`, 'OK', 'Window Sets', false)
  }
  catch (error) {
    logError('deleteAllSavedWindowSets', JSP(error))
  }
}

function makeSimpleWSChoices(savedWindowSets: Array<wth.WindowSet>, includeNewWindowSet: boolean = false): Array<{ label: string, value: number }> {
  const choices: Array<{ label: string, value: number }> = []
  if (includeNewWindowSet) {
    choices.push({ label: '🆕 Add new Window Set', value: -1 })
  }
  for (let i = 0; i < savedWindowSets.length; i++) {
    const sws = savedWindowSets[i]
    choices.push({
      label: `${sws.name} (with ${String(sws.editorWindows?.length ?? 0)} note${sws.htmlWindows?.length > 0 ? ` + ${String(sws.htmlWindows?.length)} plugin` : ''} windows)`,
      value: i,
    })
  }
  return choices
}

function makeDecoratedWSChoices(savedWindowSets: Array<wth.WindowSet>): Array<TCommandBarOptionObject> {
  const choices: Array<TCommandBarOptionObject> = savedWindowSets.map((sws) => {
    return {
      text: `${sws.name} (with ${String(sws.editorWindows?.length ?? 0)} note${sws.htmlWindows?.length > 0 ? ` + ${String(sws.htmlWindows?.length)} plugin` : ''} windows)`,
      icon: sws.icon ? sws.icon : 'window-restore',
      color: sws.iconColor ? sws.iconColor : 'teal-600',
      shortDescription: ``,
      alpha: 0.8,
      darkAlpha: 0.8,
    }
  })
  return choices
}
