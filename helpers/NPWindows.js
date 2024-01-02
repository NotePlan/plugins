// @flow
// ----------------------------------------------------------------------------
// Helpers for window management
// See also HTMLView for specifics of working in HTML
// ----------------------------------------------------------------------------

import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { caseInsensitiveMatch, caseInsensitiveStartsWith } from '@helpers/search'
import { inputIntegerBounded } from '@helpers/userInput'

/**
 * Return string version of Rect's x/y/width/height attributes
 * @param {Rect} rect
 * @returns {string}
 */
export function rectToString(rect: Rect): string {
  return `X${String(rect.x)},Y${String(rect.y)},w${String(rect.width)},h${String(rect.height)}`
}

/**
 * List all open windows to the plugin console log.
 * Uses API introduced in NP 3.8.1, and extended in 3.9.1 to add .rect.
 * @author @jgclark
 */
/* eslint-disable-next-line require-await */
export async function logWindowsList(): Promise<void> {
  const outputLines = []
  const numWindows = NotePlan.htmlWindows.length + NotePlan.editors.length
  if (NotePlan.environment.buildVersion >= 1100) { // v3.9.8a
    outputLines.push(`${String(numWindows)} Windows on ${NotePlan.environment.machineName}:`)
  } else {
    outputLines.push(`${String(numWindows)} Windows:`)
  }

  if (NotePlan.environment.buildVersion >= 1020) {
    let c = 0
    for (const win of NotePlan.editors) {
      outputLines.push(`- ${String(c)}: ${win.windowType}: customId:'${win.customId ?? ''}' filename:${win.filename ?? ''} ID:${win.id} Rect:${rectToString(win.windowRect)}`)
      c++
    }
    c = 0
    for (const win of NotePlan.htmlWindows) {
      // clo(win)
      outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' ID:${win.id} Rect:${rectToString(win.windowRect)}`)
      c++
    }
    logInfo('logWindowsList', outputLines.join('\n'))
  } else if (NotePlan.environment.buildVersion >= 973) {
    let c = 0
    for (const win of NotePlan.editors) {
      outputLines.push(`- ${String(c)}: ${win.windowType}: customId:'${win.customId ?? ''}' filename:${win.filename ?? ''} ID:${win.id}`)
      c++
    }
    c = 0
    for (const win of NotePlan.htmlWindows) {
      outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' ID:${win.id}`)
      c++
    }
    outputLines.unshift(`${outputLines.length} Windows:`)
    logInfo('logWindowsList', outputLines.join('\n'))
  } else {
    logInfo('logWindowsList', `(Cannot list windows: needs NP v3.8.1+)`)
  }
}

/**
 * Return list of all open window IDs (other than main Editor).
 * Uses API introduced in NP 3.8.1, and extended in 3.9.1 to add .rect.
 * @author @jgclark
 */
export function getNonMainWindowIds(): Array<string> {
  const outputIDs = []
  if (NotePlan.environment.buildVersion >= 973) {
    let c = 0
    for (const win of NotePlan.editors) {
      if (c > 0) outputIDs.push(win.id)
      c++
    }
    for (const win of NotePlan.htmlWindows) {
      outputIDs.push(win.id)
    }
    logInfo('logWindowsList', outputIDs.join('\n'))
    return outputIDs
  } else {
    logWarn('logWindowsList', `(Cannot list windows: needs NP v3.8.1+)`)
    return []
  }
}

/**
 * Set customId for the (single) HTML window
 * Note: for NP v3.8.1-3.9.5 only.
 * Note: from 3.9.6 (build 1087) it is included in the .showWindowWithOptions() API
 * @author @jgclark
 * @param {string} customId
 */
export async function setHTMLWindowId(customId: string): Promise<void> {
  if (NotePlan.environment.buildVersion >= 1087) {
    logDebug('setHTMLWindowId', `Won't set customId '${customId}' for HTML window as not necessary from 3.9.6.`)
  } else if (NotePlan.environment.buildVersion >= 973) {
    const allHTMLWindows = NotePlan.htmlWindows
    logDebug('setHTMLWindowId', `Starting with ${String(allHTMLWindows.length)} HTML windows`)
    const thisWindow = allHTMLWindows[0]
    if (thisWindow) {
      thisWindow.customId = customId
      await logWindowsList()
    } else {
      logError('setHTMLWindowId', `Couldn't set customId '${customId}' for HTML window`)
    }
  } else {
    logInfo('setHTMLWindowId', `(Cannot set window title: needs NP v3.8.1+)`)
  }
}

/**
 * Search open HTML windows and return the window object that matches a given customId (if available).
 * Matches are case-insensitive, and either an exact match or a starts-with-match.
 * @param {string} customId - to look for
 * @returns {string} the matching open HTML window's ID or false if not found
 */
export function getWindowIdFromCustomId(customId: string): string | false {
  if (NotePlan.environment.buildVersion < 973) {
    logDebug('isHTMLWindowOpen', `Could not run: needs NP v3.8.1+`)
    return false
  }

  const allHTMLWindows = NotePlan.htmlWindows
  for (const thisWin of allHTMLWindows) {
    // clo(thisWin, `getWindowIdFromCustomId(): thisWin=`)
    if (caseInsensitiveMatch(customId, thisWin.customId) || caseInsensitiveStartsWith(customId, thisWin.customId)) {
      thisWin.customId = customId
      logDebug('isHTMLWindowOpen', `Found window '${thisWin.customId}' matching requested customID '${customId}'`)
      return thisWin.id
    } else {
      logDebug('isHTMLWindowOpen', `Found window '${thisWin.customId}' *NOT* matching requested customID '${customId}'`)
    }
  }
  return false
}

/**
 * Is a given HTML window open? Matches are case-insensitive, and either an exact match or a starts-with-match on the supplied customId.
 * @author @jgclark
 * @param {string} customId to look for
 * @returns {boolean}
 */
export function isHTMLWindowOpen(customId: string): boolean {
  return !!getWindowIdFromCustomId(customId)
}

/**
 * Set customId for the given Editor window
 * Note: Hopefully in time, this will be removed, when @EduardMe rolls it into an API call
 * @author @jgclark
 * @param {string} openNoteFilename, i.e. note that is open in an Editor that we're trying to set customID for
 * @param {string} customId
 */
export function setEditorWindowId(openNoteFilename: string, customId: string): void {
  if (NotePlan.environment.buildVersion >= 973) {
    const allEditorWindows = NotePlan.editors
    for (const thisEditorWindow of allEditorWindows) {
      if (thisEditorWindow.filename === openNoteFilename) {
        thisEditorWindow.customId = customId
        logDebug('setEditorWindowId', `Set customId '${customId}' for filename ${openNoteFilename}`)
        // logWindowsList()
        return
      }
    }
    logError('setEditorWindowId', `Couldn't match '${openNoteFilename}' to an Editor window, so can't set customId '${customId}' for Editor`)
  } else {
    logInfo('setEditorWindowId', `Cannot set window title: needs NP v3.8.1+`)
  }
}

/**
 * Tests whether the provided filename is open in an Editor window.
 * @author @jgclark
 * @param {string} openNoteFilename
 * @returns {boolean}
 */
export function noteOpenInEditor(openNoteFilename: string): boolean {
  if (NotePlan.environment.buildVersion >= 973) {
    const allEditorWindows = NotePlan.editors
    for (const thisEditorWindow of allEditorWindows) {
      if (thisEditorWindow.filename === openNoteFilename) {
        return true
      }
    }
    return false
  } else {
    logInfo('noteNotOpenInEditor', `Cannot test if note is open in Editor as not running v3.8.1 or later`)
    return false
  }
}

/**
 * Returns the Editor object that matches a given filename (if available)
 * @author @jgclark
 * @param {string} openNoteFilename to find in list of open Editor windows
 * @returns {TEditor} the matching open Editor window
 */
export function getOpenEditorFromFilename(openNoteFilename: string): TEditor | false {
  if (NotePlan.environment.buildVersion >= 973) {
    const allEditorWindows = NotePlan.editors
    for (const thisEditorWindow of allEditorWindows) {
      if (thisEditorWindow.filename === openNoteFilename) {
        return thisEditorWindow
      }
    }
  } else {
    logInfo('getOpenEditorFromFilename', `Cannot test if note is open in Editor as not running v3.8.1 or later`)
  }
  return false
}

/**
 * If the customId matches an open HTML window, then simply focus it, and return true.
 * @param {string} customID
 * @returns {boolean} true if we have given focus to an existing window
 */
export function focusHTMLWindowIfAvailable(customId: string): boolean {
  if (NotePlan.environment.buildVersion >= 973) {
    const allHTMLWindows = NotePlan.htmlWindows
    for (const thisWindow of allHTMLWindows) {
      if (thisWindow.customId === customId) {
        thisWindow.focus()
        logInfo('focusHTMLWindowIfAvailable', `Focused HTML window '${thisWindow.customId}'`)
        return true
      }
    }
    logInfo('focusHTMLWindowIfAvailable', `No HTML window with '${customId}' is open`)
  } else {
    logInfo('focusHTMLWindowIfAvailable', `(Cannot find window Ids as not running v3.8.1 or later)`)
  }
  return false
}

export async function openNoteInNewWindowIfNeeded(filename: string): Promise<boolean> {
  const res = await Editor.openNoteByFilename(filename, true, 0, 0, false, true) // create new floating (and the note if needed)
  if (res) {
    logDebug('openWindowSet', `Opened floating window pane '${filename}'`)
  } else {
    logWarn('openWindowSet', `Failed to open floating window '${filename}'`)
  }
  return !!res
}

export async function openNoteInNewSplitIfNeeded(filename: string): Promise<boolean> {
  const res = await Editor.openNoteByFilename(filename, false, 0, 0, true, true) // create new split (and the note if needed) // TODO(@EduardMe): this doesn't create an empty note if needed for Calendar notes
  if (res) {
    logDebug('openWindowSet', `Opened split window '${filename}'`)
  } else {
    logWarn('openWindowSet', `Failed to open split window '${filename}'`)
  }
  return !!res
}

export function getWindowFromId(windowId: string): TEditor | HTMLView | false {
  // First loop over all Editor windows
  const allEditorWindows = NotePlan.editors
  for (const thisWindow of allEditorWindows) {
    if (thisWindow.id === windowId) {
      return thisWindow
    }
  }
  // And if not found so far, then all HTML windows
  const allHTMLWindows = NotePlan.htmlWindows
  for (const thisWindow of allHTMLWindows) {
    if (thisWindow.id === windowId) {
      return thisWindow
    }
  }
  logWarn('getWindowFromId', `Couldn't find window matching id '${windowId}'`)
  return false
}

export function getWindowFromCustomId(windowCustomId: string): TEditor | HTMLView | false {
  // First loop over all Editor windows
  const allEditorWindows = NotePlan.editors
  for (const thisWindow of allEditorWindows) {
    if (thisWindow.customId === windowCustomId) {
      return thisWindow
    }
  }
  // And if not found so far, then all HTML windows
  const allHTMLWindows = NotePlan.htmlWindows
  for (const thisWindow of allHTMLWindows) {
    if (thisWindow.customId === windowCustomId) {
      return thisWindow
    }
  }
  logWarn('getWindowFromCustomId', `Couldn't find window matching customId '${windowCustomId}'`)
  return false
}

/**
 * Close an Editor or HTML window given its CustomId
 * @param {string} windowCustomId
 */
export function closeWindowFromCustomId(windowCustomId: string): void {
  // First loop over all Editor windows
  let thisWin: TEditor | HTMLView
  const allEditorWindows = NotePlan.editors
  for (const thisWindow of allEditorWindows) {
    if (thisWindow.customId === windowCustomId) {
      thisWin = thisWindow
    }
  }
  // And if not found so far, then all HTML windows
  const allHTMLWindows = NotePlan.htmlWindows
  for (const thisWindow of allHTMLWindows) {
    if (thisWindow.customId === windowCustomId) {
      thisWin = thisWindow
    }
  }
  if (thisWin) {
    thisWin.close()
    // logDebug('closeWindowFromCustomId', `Closed window '${windowCustomId}'`)
  } else {
    logWarn('closeWindowFromCustomId', `Couldn't find window to close matching customId '${windowCustomId}'`)
  }
}

/**
 * Close an Editor or HTML window given its window Id
 * @param {string} windowId
 */
export function closeWindowFromId(windowId: string): void {
  // First loop over all Editor windows
  let thisWin: TEditor | HTMLView
  const allEditorWindows = NotePlan.editors
  for (const thisWindow of allEditorWindows) {
    if (thisWindow.id === windowId) {
      thisWin = thisWindow
    }
  }
  // And if not found so far, then all HTML windows
  const allHTMLWindows = NotePlan.htmlWindows
  for (const thisWindow of allHTMLWindows) {
    if (thisWindow.id === windowId) {
      thisWin = thisWindow
    }
  }
  if (thisWin) {
    thisWin.close()
    // logDebug('closeWindowFromId', `Closed window '${windowId}'`)
  } else {
    logWarn('closeWindowFromId', `Couldn't find window to close matching Id '${windowId}'`)
  }
}

/**
 * Save the Rect (x/y/w/h) of the given window, given by its ID, to the local device's NP preferences store.
 * @param {string} customId
 */
export function storeWindowRect(customId: string): void {
  if (NotePlan.environment.buildVersion < 1020) {
    logDebug('storeWindowRect', `Cannot save window rect as not running v3.9.1 or later.`)
    return
  }
  // Find the window by its customId
  const thisWindow = getWindowFromCustomId(customId)
  if (thisWindow) {
    // Get its Rect from the live window
    const windowRect: Rect = thisWindow.windowRect
    const prefName = `WinRect_${customId}`
    DataStore.setPreference(prefName, windowRect)
    logDebug('storeWindowRect', `Saved Rect ${rectToString(windowRect)} to ${prefName}`)
  } else {
    logWarn('storeWindowRect', `Couldn't save Rect for '${customId}'`)
  }
}

/**
 * Get the Rect (x/y/w/h) of the given window, given by its ID, from the local device's NP preferences store
 * @param {string} customId
 * @returns {Rect} the Rect (x/y/w/h)
 */
export function getStoredWindowRect(customId: string): Rect | false {
  try {
    if (NotePlan.environment.buildVersion < 1020) {
      logWarn('getWindowRect', `Cannot get window rect as not running v3.9.1 or later.`)
      return false
    }
    const prefName = `WinRect_${customId}`
    // $FlowFixMe[incompatible-type]
    const windowRect: Rect = DataStore.preference(prefName)
    if (!windowRect) {
      logWarn('getWindowRect', `Couldn't retrieve Rect from saved pref ${prefName}`)
      return false
    }
    logDebug('getWindowRect', `Retrieved Rect ${rectToString(windowRect)} from saved ${prefName}`)
    return windowRect
  } catch (error) {
    logError('getStoredWindowRect', error.message)
    return false
  }
}

/**
 * Get the Rect (x/y/w/h) of the given live window, given by its 'id' (or if 'id' is blank, from the first HTML Window)
 * @param {string} windowId
 * @returns {Rect} the Rect (x/y/w/h)
 */
export function getLiveWindowRect(windowId: string): Rect | false {
  if (NotePlan.environment.buildVersion < 1020) {
    logWarn('getLiveWindowRect', `Cannot get window rect as not running v3.9.1 or later.`)
    return false
  }
  const windowToUse = windowId !== '' ? getWindowFromId(windowId) : NotePlan.htmlWindows[0]
  if (windowToUse) {
    const windowRect: Rect = windowToUse.windowRect
    clo(windowRect, `getLiveWindowRect(): Retrieved ${rectToString(windowRect)} from win id '${windowId}'`)
    return windowRect
  } else {
    logWarn('getLiveWindowRect', `Couldn't retrieve windowRect from win id '${windowId}'`)
    return false
  }
}

/**
 * Get the Rect (x/y/w/h) of the given live window, given the Window's reference (available from showWindowWithOptions() call)
 * Note: this is a long-winded way of saying 'thisWindow.windowRect' in simple cases.
 * @param {Window} win
 * @returns {Rect} the Rect (x/y/w/h)
 */
export function getLiveWindowRectFromWin(win: Window): Rect | false {
  if (NotePlan.environment.buildVersion < 1020) {
    logWarn('getLiveWindowRectFromWin', `Cannot get window rect as not running v3.9.1 or later.`)
    return false
  }
  if (win) {
    const windowRect: Rect = win.windowRect
    // clo(windowRect, `getLiveWindowRectFromWin(): Retrieved Rect ${rectToString(windowRect)}:`)
    return windowRect
  } else {
    logWarn('getLiveWindowRectFromWin', `Invalid window parameter`)
    return false
  }
}

/**
 * Sets the x/y/w/h of the passed HTMLWindow ref, or if not given the first HTMLWindow.
 * @param {Rect} rect - {x,y,w,h} to set the window
 * @param {HTMLView?} thisWinId (optional) window reference
 */
export function applyRectToWindow(rect: Rect, customId?: string): void {
  const winToUse = customId ? getWindowFromCustomId(customId) : NotePlan.htmlWindows[0]
  // logDebug('applyRectToWindow', `Trying to set Rect for window '${customId ?? 'HTML[0]'}'`)
  if (winToUse) {
    winToUse.windowRect = rect
    logDebug('applyRectToWindow', `Set Rect for window '${customId ?? 'HTML[0]'}' -> ${rectToString(winToUse.windowRect)}`)
  } else {
    logWarn('applyRectToWindow', `Can't get valid window from ${customId ?? 'HTML[0]'}`)
  }
}

/**
 * TODO: Currently not working as hoped. Waiting for @EduardMe to fix things.
 * @author @jgclark
 * @param {number?} editorWinIn index into open .editors array
 * @param {number?} width to set
 */
export async function setEditorWindowWidth(editorWinIn?: number, widthIn?: number): Promise<void> {
  try {
    if (NotePlan.environment.buildVersion <= 1119) {
      logWarn('setEditorWindowWidth', `Cannot set editor split window width.`)
      return
    }
    const editorWinIndex = editorWinIn ? editorWinIn : await inputIntegerBounded('Set Width', 'Which open Editor number to set width for? (0-${String(NotePlan.editors.length - 1)})', NotePlan.editors.length - 1, 0)
    const editorWin = NotePlan.editors[editorWinIndex]
    logDebug('setEditorWindowWidth', `- Rect: ${rectToString(editorWin.windowRect)}`)

    const width = widthIn ? widthIn : await inputIntegerBounded('Set Width', `Width? (300-${String(NotePlan.environment.screenWidth)})`, NotePlan.environment.screenWidth, 300)

    const thisWindowRect = getLiveWindowRectFromWin(editorWin)
    if (!thisWindowRect) {
      logError('setEditorWindowWidth', `Can't get window rect for editor ${String(editorWinIn)}`)
      return
    }
    // FIXME(EduardMe): this part doesn't seem to work in practice
    const existingWidth = thisWindowRect.width
    logDebug('setEditorWindowWidth', `Attempting to set width for editor #${String(editorWinIndex)} from ${existingWidth} to ${width}`)
    thisWindowRect.width = width
    editorWin.windowRect = thisWindowRect
    const newWidth = thisWindowRect.width
    logDebug('setEditorWindowWidth', `- now width = ${newWidth}`)
  } catch (error) {
    logError('getStoredWindowRect', error.message)
    return
  }
}


/**
 * Constrain the Window Size and Position to what will fit on the current screen.
 * The debug log explains what is being done if it doesn't all fit in the current screen area. It will first move up/down/l/r, and only then reduce in w/h.
 * @author @jgclark
 * @param {EditorWinDetails | HTMLWinDetails} winDetails
 * @returns {EditorWinDetails | HTMLWinDetails} constrained winDetails
 */
// $FlowFixMe[incompatible-return]
// export function constrainWindowSizeAndPosition(winDetails: EditorWinDetails | HTMLWinDetails): EditorWinDetails | HTMLWinDetails {
export function constrainWindowSizeAndPosition<T: { x: number, y: number, width: number, height: number, ... }> (winDetails: T): T {
  try {
    const screenHeight = NotePlan.environment.screenHeight // remember bottom edge is y=0
    const screenWidth = NotePlan.environment.screenWidth
    const left = winDetails.x
    const right = winDetails.x + winDetails.width
    const top = winDetails.y + winDetails.height
    const bottom = winDetails.y
    // $FlowIgnore[prop-missing]
    const title = winDetails.title ?? 'n/a'
    if (winDetails.x < 0) {
      logDebug('constrainWS+P', `  - window '${title}' has left edge at ${String(left)}px; moving right to 0px`)
      winDetails.x = 0
      if (winDetails.width > screenWidth) {
        winDetails.width = screenWidth
      }
    }
    if (bottom < 0) {
      logDebug('constrainWS+P', `  - window '${title}' has bottom edge at ${String(winDetails.y)}px; moving up to 0px`)
      winDetails.y = 0
      if (winDetails.height > screenHeight) {
        winDetails.height = screenHeight
      }
    }
    if (right > screenWidth) {
      // Change, by moving left edge in (if possible), or else narrowing
      const overhang = right - screenWidth
      if (winDetails.x > overhang) {
        logDebug('constrainWS+P', `  - window '${title}' has right edge at ${String(right)}px but screen width is ${String(screenWidth)}px. Moving left by ${String(overhang)}px`)
        winDetails.x -= overhang
      } else {
        logDebug('constrainWS+P', `  - window '${title}' has right edge at ${String(right)}px but screen width is ${String(screenWidth)}px. Changing to fill width.`)
        winDetails.x = 0
        winDetails.width = screenWidth
      }
    }
    if (top > screenHeight) {
      const overhang = top - screenHeight
      if (winDetails.y > overhang) {
        logDebug('constrainWS+P', `  - window '${title}' has top edge at ${String(top)}px but screen height is ${String(screenHeight)}px. Moving down by ${String(overhang)}px`)
        winDetails.y -= overhang
      } else {
        logDebug('constrainWS+P', `  - window '${title}' has top edge at ${String(top)}px but screen height is ${String(screenHeight)}px. Changing to fill height.`)
        winDetails.y = 0
        winDetails.height = screenHeight
      }
    }
    return winDetails
  } catch (error) {
    logError('constrainWindowSizeAndPosition', `constrainWindowSizeAndPosition(): ${error.name}: ${error.message}. Returning original window details.`)
    return winDetails
  }
}


/**
 * Constrain main window, so it actually all shows on the screen
 * @author @jgclark
 */
// eslint-disable-next-line require-await
export async function constrainMainWindow(): Promise<void> {
  try {
    // Get current editor window details
    const mainWindowRect: Rect = NotePlan.editors[0].windowRect
    logDebug('constrainMainWindow', `- mainWindowRect: ${rectToString(mainWindowRect)}`)

    // Constrain into the screen area
    const updatedRect = constrainWindowSizeAndPosition(mainWindowRect)
    logDebug('constrainMainWindow', `- updatedRect: ${rectToString(updatedRect)}`)

    NotePlan.editors[0].windowRect = updatedRect
    return
  } catch (err) {
    logError('constrainMainWindow', err.message)
    return
  }
}
