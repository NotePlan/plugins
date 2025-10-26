// @flow
// ----------------------------------------------------------------------------
// Helpers for window management
// See also HTMLView for specifics of working in HTML
// ----------------------------------------------------------------------------

import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { caseInsensitiveMatch, caseInsensitiveStartsWith } from '@helpers/search'
import { inputIntegerBounded } from '@helpers/userInput'

// ----------------------------------------------------------------------------
// CONSTANTS

export const MAIN_SIDEBAR_CONTROL_BUILD_VERSION = 1440 // v3.19.2
export const FOLDER_VIEWS_CONTROL_BUILD_VERSION = 1340 // v3.18???

// ----------------------------------------------------------------------------
// TYPES

export type TWindowType = 'Editor' | 'HTMLView' | 'FolderView'

// ----------------------------------------------------------------------------
// FUNCTIONS

/**
 * Return string version of Rect's x/y/width/height attributes
 * @param {Rect} rect
 * @returns {string}
 */
export function rectToString(rect: Rect): string {
  return `X${String(rect.x)},Y${String(rect.y)}, w${String(rect.width)},h${String(rect.height)}`
}

/**
 * List all open windows to the plugin console log.
 * Uses API introduced in NP 3.8.1, and extended in 3.9.1 to add .rect.
 * @author @jgclark
 */
export function logWindowsList(): void {
  const outputLines = []
  const numWindows = NotePlan.htmlWindows.length + NotePlan.editors.length
  outputLines.push(`${String(numWindows)} Windows on ${NotePlan.environment.machineName}:`)

  let c = 0
  for (const win of NotePlan.editors) {
    outputLines.push(`- ${String(c)}: ${win.windowType}: customId:'${win.customId ?? ''}' filename:${win.filename ?? ''} ID:${win.id} Rect:${rectToString(win.windowRect)}`)
    c++
  }
  c = 0
  for (const win of NotePlan.htmlWindows) {
    outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? ''}' ID:${win.id} Rect:${rectToString(win.windowRect)}`)
    c++
  }
  logInfo('logWindowsList', outputLines.join('\n'))
}

/**
 * TEST: me
 * Set the width of the main Editor window (including the main sidebar and all other split windows.)
 * If mainSidebarWidth is provided, then it will also set the width of the main sidebar. Pass 0 to hide the sidebar.
 * @author @jgclark
 * 
 * @param {number?} widthIn - width to set for the main Editor window (including the main sidebar and all other split windows)
 * @param {number?} mainSidebarWidth - width to set for the main sidebar (or 0 to hide it)
 */
export async function setEditorWidth(widthIn?: number, mainSidebarWidth?: number): Promise<void> {
  try {
    if (NotePlan.environment.platform !== 'macOS') {
      throw new Error(`Platform is ${NotePlan.environment.platform}, so will stop.`)
    }

    const width = widthIn
      ? widthIn
      : await inputIntegerBounded('Set Width for main NP Window', `Width? (300-${String(NotePlan.environment.screenWidth)})`, NotePlan.environment.screenWidth, 300)
    if (isNaN(width)) {
      logWarn('setEditorWidth', `User didn't provide a width, so will stop.`)
      return
    }

    logDebug('setEditorWidth', `Attempting to set width for main NP Window to ${String(width)}`)
    if (NotePlan.environment.buildVersion >= MAIN_SIDEBAR_CONTROL_BUILD_VERSION && mainSidebarWidth && !isNaN(mainSidebarWidth)) {
      if (mainSidebarWidth === 0) {
        logDebug('setEditorWidth', `- will hide main sidebar`)
        NotePlan.toggleSidebar(true, false, true)
      } else {
        logDebug('setEditorWidth', `- will show main sidebar and set its width to ${String(mainSidebarWidth)}`)
        NotePlan.toggleSidebar(false, true, true)
        NotePlan.setSidebarWidth(mainSidebarWidth)
        logDebug('setEditorWidth', `- now main sidebar width = ${String(mainSidebarWidth)}`)
      }
    }

    const mainWindowRect = NotePlan.editors[0].windowRect
    mainWindowRect.width = width
    NotePlan.editors[0].windowRect = mainWindowRect
    logDebug('setEditorWidth', `- now width = ${String(mainWindowRect.width)}`)
  } catch (error) {
    logError('setEditorWidth', `'setEditorWidth(): ${error.message}`)
    return
  }
}

/**
 * WARNING: this doesn't seem to work in practice. Only works for the main Editor window, and not for split windows.
 * Set the width of an open Editor split window.
 * @author @jgclark

 * @param {number?} editorWinIn - index into open .editors array
 * @param {number?} widthIn - width to set
 */
export async function setEditorSplitWidth(editorWinIn?: number, widthIn?: number): Promise<void> {
  try {
    const editorWinIndex = editorWinIn
      ? editorWinIn
      : await inputIntegerBounded('Set Width', `Which open Editor number to set width for? (0-${String(NotePlan.editors.length - 1)})`, NotePlan.editors.length - 1, 0)
    const editorWin = NotePlan.editors[editorWinIndex]
    logDebug('setEditorSplitWidth', `- Rect: ${rectToString(editorWin.windowRect)}`)
    const thisWindowRect = getLiveWindowRectFromWin(editorWin)
    if (!thisWindowRect) {
      logError('setEditorSplitWidth', `Can't get window rect for editor ${String(editorWinIn)}`)
      return
    }

    const width = widthIn
      ? widthIn
      : await inputIntegerBounded('Set Width', `Width? (300-${String(NotePlan.environment.screenWidth)})`, NotePlan.environment.screenWidth, 300)
    if (isNaN(width)) {
      logWarn('setEditorSplitWidth', `User didn't provide a width, so will stop.`)
      return
    }

    const existingWidth = thisWindowRect.width
    logDebug('setEditorSplitWidth', `Attempting to set width for editor #${String(editorWinIndex)} from ${String(existingWidth)} to ${String(width)}`)
    thisWindowRect.width = width
    editorWin.windowRect = thisWindowRect
    const newWidth = thisWindowRect.width
    logDebug('setEditorSplitWidth', '- now width = '.concat(String(newWidth)))
  } catch (error) {
    logError('setEditorSplitWidth', error.message)
    return
  }
}

/**
 * Return list of all open window IDs (other than main Editor).
 * Note: minimum version 3.9.1
 * @param {TWindowType} windowType - 'Editor' or 'HTMLView'
 * @returns {Array<string>} list of non-main window IDs
 * @author @jgclark
 */
export function getNonMainWindowIds(windowType: TWindowType = 'Editor'): Array<string> {
  const outputIDs = []
  switch (windowType) {
    case 'Editor': {
      let c = 0
      for (const win of NotePlan.editors) {
        if (c > 0) outputIDs.push(win.id)
        c++
      }
      break
    }
    case 'HTMLView': {
      for (const win of NotePlan.htmlWindows) {
        outputIDs.push(win.id)
      }
      break
    }
    default: {
      logWarn('getNonMainWindowIds', `Unknown window type '${windowType}'`)
    }
  }
  logDebug('getNonMainWindowIds', `for type '${windowType}' => ${outputIDs.join('\n')}`)
  return outputIDs
}


/**
 * Search open HTML windows and return the window object that matches a given customId (if available).
 * Matches are case-insensitive, and either an exact match or a starts-with-match.
 * @param {string} customId - to look for
 * @returns {string} the matching open HTML window's ID or false if not found
 */
export function getWindowIdFromCustomId(customId: string): string | false {
  if (NotePlan.environment.platform !== 'macOS') {
    logDebug('isHTMLWindowOpen', `Platform is ${NotePlan.environment.platform}`)
    // return false
  }

  const allHTMLWindows = NotePlan.htmlWindows
  // clo(allHTMLWindows, 'getWindowIdFromCustomId: allHTMLWindows')
  for (const thisWin of allHTMLWindows) {
    // clo(thisWin, `getWindowIdFromCustomId(): thisWin=`)
    if (caseInsensitiveMatch(customId, thisWin.customId) || caseInsensitiveStartsWith(customId, thisWin.customId)) {
      thisWin.customId = customId
      return thisWin.id
    } else {
      // logWarn('isHTMLWindowOpen', `Found window '${thisWin.customId}' *NOT* matching requested customID '${customId}'`)
    }
  }
  logDebug(
    'isHTMLWindowOpen',
    `Did not find open window with ID:"${customId}" on platform:"${NotePlan.environment.platform}". This is ok if the window is not open or the platform is not macOS.`,
  )
  return false
}

/**
 * Is a given HTML window open, based on its customId? 
 * Matches are case-insensitive, and either an exact match or a starts-with-match on the supplied customId.
 * @author @jgclark
 * @param {string} customId to look for
 * @returns {boolean}
 */
export function isHTMLWindowOpen(customId: string): boolean {
  return !!getWindowIdFromCustomId(customId)
}

/**
 * Is a given note open in a NP Editor window/split, based on its filename?
 * @author @jgclark
 * @param {string} filename to look for
 * @returns {boolean}
 */
export function isEditorWindowOpen(filename: string): boolean {
  // Get list of open Editor windows/splits
  const allEditorWindows = NotePlan.editors
  for (const thisEditorWindow of allEditorWindows) {
    if (thisEditorWindow.filename === filename) {
      return true
    }
  }
  return false
}

/**
 * Set customId for the given Editor window
 * Note: Hopefully in time, this will be removed, when @EduardMe rolls it into an API call
 * @author @jgclark
 * @param {string} openNoteFilename, i.e. note that is open in an Editor that we're trying to set customID for
 * @param {string} customId
 */
export function setEditorWindowId(openNoteFilename: string, customId: string): void {
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
}

/**
 * Set customId for the given Editor window
 * Note: Hopefully in time, this will be removed, when @EduardMe rolls it into an API call
 * @author @jgclark
 * @param {string} filenameToFind, i.e. note that is open in an Editor that we're trying to set customID for
 * @returns {Editor} the Editor window
 */
export function findEditorWindowByFilename(filenameToFind: string): TEditor | false {
  logWindowsList()

  const allEditorWindows = NotePlan.editors
  for (const thisEditorWindow of allEditorWindows) {
    if (thisEditorWindow.filename === filenameToFind) {
      logDebug('findEditorWindowByFilename', `found Editor Window for filename ${filenameToFind}. ID=${thisEditorWindow.id}`)
      return thisEditorWindow
    }
  }
  logWarn('findEditorWindowByFilename', `Couldn't match '${filenameToFind}' to an Editor window`)
  return false
}

/**
 * Tests whether the provided filename is open in an Editor window.
 * @author @jgclark
 * @param {string} openNoteFilename
 * @returns {boolean}
 */
export function noteOpenInEditor(openNoteFilename: string): boolean {
  const allEditorWindows = NotePlan.editors
  for (const thisEditorWindow of allEditorWindows) {
    if (thisEditorWindow.filename === openNoteFilename) {
      return true
    }
  }
  return false
}

/**
 * Returns the Editor object that matches a given filename (if available)
 * @author @jgclark
 * @param {string} openNoteFilename to find in list of open Editor windows
 * @returns {TEditor} the matching open Editor window
 */
export function getOpenEditorFromFilename(openNoteFilename: string): TEditor | false {
  const allEditorWindows = NotePlan.editors
  for (const thisEditorWindow of allEditorWindows) {
    if (thisEditorWindow.filename === openNoteFilename) {
      return thisEditorWindow
    }
  }
  return false
}

/**
 * If the customId matches an open HTML window, then simply focus it, and return true.
 * @param {string} customID
 * @returns {boolean} true if we have given focus to an existing window
 */
export function focusHTMLWindowIfAvailable(customId: string): boolean {
  const allHTMLWindows = NotePlan.htmlWindows
  for (const thisWindow of allHTMLWindows) {
    if (thisWindow.customId === customId) {
      thisWindow.focus()
      logInfo('focusHTMLWindowIfAvailable', `Focused HTML window '${thisWindow.customId}'`)
      return true
    }
  }
  logInfo('focusHTMLWindowIfAvailable', `No HTML window with '${customId}' is open`)
  return false
}

/**
 * Opens note in new floating window, if it's not already open in one
 * @param {string} filename to open in window
 * @returns {boolean} success?
 */
export async function openNoteInNewWindowIfNeeded(filename: string): Promise<boolean> {
  const isAlreadyOpen = isEditorWindowOpen(filename)
  if (isAlreadyOpen) {
    logDebug('openNoteInNewWindowIfNeeded', `Note '${filename}' is already open in an Editor window. Skipping.`)
    return false
  }
  const res = await Editor.openNoteByFilename(filename, true, 0, 0, false, false) // create new floating window
  if (res) {
    logDebug('openWindowSet', `Opened floating window '${filename}'`)
  } else {
    logWarn('openWindowSet', `Failed to open floating window '${filename}'`)
  }
  return !!res
}

/**
 * Opens note in new split window, if it's not already open in one
 * @param {string} filename to open in split
 * @returns {boolean} success?
 */
export async function openNoteInNewSplitIfNeeded(filename: string): Promise<boolean> {
  const isAlreadyOpen = isEditorWindowOpen(filename)
  if (isAlreadyOpen) {
    logDebug('openNoteInNewSplitIfNeeded', `Note '${filename}' is already open in an Editor window. Skipping.`)
    return false
  }
  const res = await Editor.openNoteByFilename(filename, false, 0, 0, true, false) // create new split window
  if (res) {
    logDebug('openWindowSet', `Opened split window '${filename}'`)
  } else {
    logWarn('openWindowSet', `Failed to open split window '${filename}'`)
  }
  return !!res
}

/**
 * Open a calendar note in a split editor, and (optionally) move insertion point to 'cursorPointIn'
 * @author @jgclark
 * @param {string} filename
 * @param {string | number} cursorPointIn
 */
export async function openCalendarNoteInSplit(filename: string, cursorPointIn?: string | number = 0): Promise<void> {
  logDebug('openCalendarNoteInSplit', `Opening calendar note '${filename}' in split at cursor point ${cursorPointIn}`)
  // For some reason need to add a bit to get to the right place.
  const cursorPoint = (typeof cursorPointIn === 'string') ? parseInt(cursorPointIn) + 21 : cursorPointIn + 21
  const res = Editor.openNoteByDateString(filename.split('.')[0], false, cursorPoint, cursorPoint, true)
  if (res) {
    // Make sure it all fits on the screen
    await constrainMainWindow()
  }
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
  if (win) {
    const windowRect: Rect = win.windowRect
    clo(windowRect, `getLiveWindowRectFromWin(): Retrieved Rect ${rectToString(windowRect)}:`)
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
export function applyRectToHTMLWindow(rect: Rect, customId?: string): void {
  const winToUse = customId ? getWindowFromCustomId(customId) : NotePlan.htmlWindows[0]
  // logDebug('applyRectToHTMLWindow', `Trying to set Rect for HTML window '${customId ?? 'HTML[0]'}'`)
  if (winToUse) {
    winToUse.windowRect = rect
    logDebug('applyRectToHTMLWindow', `Set Rect for HTML window '${customId ?? 'HTML[0]'}' -> ${rectToString(winToUse.windowRect)}`)
  } else {
    logWarn('applyRectToHTMLWindow', `Can't get valid window from ${customId ?? 'HTML[0]'}`)
  }
}

/**
 * Set window width -- either from parameter, or ask user.
 * TODO: Currently not working as hoped. Waiting for @EduardMe to fix things.
 * @author @jgclark
 * @param {number?} editorWinIn index into open .editors array
 * @param {number?} width to set
 */
export async function setEditorWindowWidth(editorWinIn?: number, widthIn?: number): Promise<void> {
  try {
    const editorWinIndex = editorWinIn
      ? editorWinIn
      : await inputIntegerBounded('Set Width', 'Which open Editor number to set width for? (0-${String(NotePlan.editors.length - 1)})', NotePlan.editors.length - 1, 0)
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
export function constrainWindowSizeAndPosition<T: { x: number, y: number, width: number, height: number, ... }>(winDetails: T): T {
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

export function logSidebarWidth(): void {
  if (NotePlan.environment.buildVersion >= MAIN_SIDEBAR_CONTROL_BUILD_VERSION) {
    const sidebarWidth = NotePlan.getSidebarWidth()
    logInfo('logSidebarWidth', `Sidebar width: ${sidebarWidth} -- WARNING: This cannot tell if the sidebar is actually visible or not!`)
  } else {
    logWarn('logSidebarWidth', `Cannot get Sidebar width before NP v3.19.2`)
  }
}

// eslint-disable-next-line require-await
export async function setSidebarWidth(widthIn?: number): Promise<void> {
  if (NotePlan.environment.buildVersion >= MAIN_SIDEBAR_CONTROL_BUILD_VERSION) {
    const width = widthIn ?? await inputIntegerBounded('Set Width for main NP Window', `Width (pixels)? (up to ${String(NotePlan.environment.screenWidth)})`, NotePlan.environment.screenWidth)
    NotePlan.setSidebarWidth(width)
    logDebug('setSidebarWidth', `Sidebar width set to ${width}`)
  } else {
    logWarn('setSidebarWidth', `Cannot Sidebar width before NP v3.19.2`)
  }
}

export function toggleSidebar(): void {
  NotePlan.toggleSidebar(false, false, true)
}

/**
 * Open the sidebar, and optionally set its width
 * Note: Available from v3.19.2 (macOS only).
 * @author @jgclark
 * 
 * @param {number?} widthIn - width to set for the sidebar (pixels)
 */
export function openSidebar(widthIn?: number): void {
  NotePlan.toggleSidebar(false, true, true)
  if (widthIn && !isNaN(widthIn)) {
    NotePlan.setSidebarWidth(widthIn)
  }
}

export function closeSidebar(): void {
  NotePlan.toggleSidebar(true, false, true)
}
