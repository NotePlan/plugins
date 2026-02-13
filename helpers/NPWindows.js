// @flow
// ----------------------------------------------------------------------------
// Helpers for window management
// See also HTMLView for specifics of working in HTML
// ----------------------------------------------------------------------------

import { getOpenEditorFromFilename, noteOpenInEditor } from './NPEditor'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { createOpenOrDeleteNoteCallbackUrl } from '@helpers/general'
import { usersVersionHas } from '@helpers/NPVersions'
import { caseInsensitiveMatch, caseInsensitiveStartsWith } from '@helpers/search'
import { inputIntegerBounded } from '@helpers/userInput'

// ----------------------------------------------------------------------------
// Types

export type TWindowType = 'Editor' | 'HTMLView' | 'FolderView'

// ----------------------------------------------------------------------------
// Constants

const MIN_WINDOW_WIDTH = 300
const MIN_WINDOW_HEIGHT = 430

// ----------------------------------------------------------------------------
// Functions

/**
 * Return string version of Rect's x/y/width/height attributes
 * @param {Rect} rect
 * @returns {string}
 */
export function rectToString(rect: Rect): string {
  if (!rect) { return 'undefined' }
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
    outputLines.push(`- ${String(c)}: ${win.windowType}: customId:'${win.customId ?? '-'}' filename:${win.filename ?? '-'} ID:${win.id} Rect:${rectToString(win.windowRect)}`)
    c++
  }
  c = 0
  for (const win of NotePlan.htmlWindows) {
    outputLines.push(`- ${String(c)}: ${win.type}: customId:'${win.customId ?? '-'}' ID:${win.id} Rect:${rectToString(win.windowRect)}`)
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
    if (usersVersionHas('mainSidebarControl') && mainSidebarWidth && !isNaN(mainSidebarWidth)) {
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
    logDebug('setEditorSplitWidth', `- ew#${String(editorWinIndex)} currently Rect: ${rectToString(editorWin.windowRect)}`)
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
    logDebug('setEditorSplitWidth', `- attempting to set width for ew#${String(editorWinIndex)} from ${String(existingWidth)}px to ${String(width)}px`)
    thisWindowRect.width = width
    editorWin.windowRect = thisWindowRect
    const newWidth = thisWindowRect.width
    logDebug('setEditorSplitWidth', `- now width = ${String(newWidth)}px`)
  } catch (error) {
    logError('setEditorSplitWidth', error.message)
    return
  }
}

/**
 * Set the width of all main + split windows to the given width.
 * @param {number} width to set (px)
 * @author @jgclark
 */
export async function setAllMainAndSplitWindowWidths(width: number): Promise<void> {
  logDebug('setAllMainAndSplitWindowWidths', `Attempting to set width for all split windows to ${String(width)}px`)
  for (let i = 0; i < NotePlan.editors.length; i++) {
    const editor = NotePlan.editors[i]
    if (editor.windowType !== 'floating') {
      logDebug('setAllMainAndSplitWindowWidths', `- setting width for split window #${String(i)} to ${String(width)}px`)
      await setEditorSplitWidth(i, width)
    }
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
    logDebug('getWindowIdFromCustomId', `Platform is ${NotePlan.environment.platform}`)
    // return false
  }

  // First try to find an HTML window with the same customId
  const allHTMLWindows = NotePlan.htmlWindows
  // clo(allHTMLWindows, 'getWindowIdFromCustomId: allHTMLWindows')
  for (const thisWin of allHTMLWindows) {
    // clo(thisWin, `getWindowIdFromCustomId(): thisWin=`)
    if (caseInsensitiveMatch(customId, thisWin.customId) || caseInsensitiveStartsWith(customId, thisWin.customId)) {
      thisWin.customId = customId
      logDebug('getWindowIdFromCustomId', `Found HTML window '${thisWin.customId}' matching customId '${customId}' with ID '${thisWin.id}'`)
      return thisWin.id
    }
  }

  // From 3.20 now try to find an Editor window with the same customId
  const allEditorWindows = NotePlan.editors
  for (const thisWin of allEditorWindows) {
    if (caseInsensitiveMatch(customId, thisWin.customId) || caseInsensitiveStartsWith(customId, thisWin.customId)) {
      logDebug('getWindowIdFromCustomId', `Found Editor window '${thisWin.customId}' matching customId '${customId}' with ID '${thisWin.id}'`)
      return thisWin.id
    }
  }

  logDebug(
    'getWindowIdFromCustomId',
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
 * Position an Editor window at a smart placement on the screen.
 * @param {TEditor} editor - the Editor window to position
 * @param {number} requestedWidth - requested width of the window (if set at zero, treat as if not set)
 * @returns {boolean} success?
 */
function positionEditorWindowWithSmartPlacement(editor: TEditor, requestedWidth: number): boolean {
  const editorId = editor.id
  logDebug('positionEditorWindowWithSmartPlacement', `Positioning Editor window '${editorId}' for filename '${editor.filename}' (customId: '${editor.customId}')`)

  const currentWindowRect = getLiveWindowRect(editorId)
  if (!currentWindowRect) {
    logWarn('positionEditorWindowWithSmartPlacement', `Couldn't get window rect for Editor window '${editorId}'`)
    return false
  }

  // Calculate the smart location for the new window
  const newWindowRect = calculateSmartLocation(currentWindowRect, requestedWidth)
  logDebug('positionEditorWindowWithSmartPlacement', `Calculated smart location for new window -> ${rectToString(newWindowRect)}`)

  // Set the window rect for the new window
  editor.windowRect = newWindowRect
  return true
}

/**
 * Opens note in new floating window, optionally only if it's not already open in one, and optionally move window to a smart location on the screen, rather than the default position, which is often unhelpful.
 * @param {string} filename to open in window
 * @param {number} width - requested width of the new window (if set at zero, treat as if not set)
 * @param {boolean} onlyIfNotAlreadyOpen - whether to only open the window if it's not already open in one
 * @param {boolean} smartLocation - whether to move window to a smart location on the screen, based on the current NP window size(s), position(s) and the screen area
 * @returns {boolean} success?
 */
export async function openNoteInNewWindow(
  filename: string,
  width: number,
  onlyIfNotAlreadyOpen: boolean = false,
  smartLocation: boolean = true): Promise<boolean> {
  try {
    // If note is already open, then simply focus it
    if (onlyIfNotAlreadyOpen && isEditorWindowOpen(filename)) {
      const thisEditor = getOpenEditorFromFilename(filename, true)
      if (!thisEditor) {
        throw new Error(`Couldn't find open Editor window for filename '${filename}'`)
      }
      logDebug('openNoteInNewWindow', `Note '${filename}' is already open in an Editor window. Will focus it.`)
      thisEditor.focus()
      return true
    }

    // Not open, so now open the note in a new floating window
    const res: ?TNote = await Editor.openNoteByFilename(filename, true, 0, 0, false, false)
    if (!res) {
      logWarn('openNoteInNewWindow', `Failed to open floating window '${filename}'`)
      return false
    }
    logDebug('openNoteInNewWindow', `Opened new floating window for '${filename}'`)

    // Position window at smart location if requested
    if (smartLocation) {
      const thisEditor = getOpenEditorFromFilename(filename)
      if (!thisEditor) {
        throw new Error(`Couldn't find open Editor window for filename '${filename}'`)
      }
      positionEditorWindowWithSmartPlacement(thisEditor, width)
    }

    return true
  } catch (error) {
    logError('openNoteInNewWindow', `Error: ${error.message}`)
    return false
  }
}

/** 
 * Calculate the smart placement for the new window:
 *   - Calculate all the areas of the screen from the existing open Editor and HTML windows.
 *   - Then find the next available area that is big enough for the same height and requested width, that is next to an existing Editor window, but within the screen boundaries.
 * @param {Rect} currenthisWindowRect - the Rect of the current window
 * @param {number} requestedWidth - the requested width of the new window (if set at zero, treat as if not set)
 * @returns {Rect} the smart location for the new window
 */
export function calculateSmartLocation(thisWindowRect: Rect, requestedWidth: number): Rect {
  const allWindows = NotePlan.editors.concat(NotePlan.htmlWindows)
  const allWindowRects = allWindows.map(win => win.windowRect)
  const allWindowRectsString = allWindowRects.map(rect => rectToString(rect)).join('\n')
  logDebug('calculateSmartLocation', `All window rects: ${allWindowRectsString}`)
  const requestedHeight = thisWindowRect.height
  const newWindowRect = findNextClosestAvailableArea(allWindowRects, requestedHeight, requestedWidth)
  logDebug('calculateSmartLocation', `Calculated smart location: ${rectToString(newWindowRect)}`)
  return newWindowRect
}

/**
 * Find the next available area that is:
 * - not overlapping with any existing 'allWindowRects'
 * - big enough for the requested height and width
 * - next to an existing Editor window
 * - within the screen boundaries
 * @param {Array<Rect>} allWindowRects - the Rects of the existing open Editor and HTML windows
 * @param {number} requestedHeight - the requested height of the new window
 * @param {number} requestedWidth - the requested width of the new window
 * @returns {Rect} the next available area
 */
function findNextClosestAvailableArea(allWindowRects: Array<Rect>, requestedHeight: number, requestedWidth: number): Rect {
  const screenWidth = NotePlan.environment.screenWidth
  const screenHeight = NotePlan.environment.screenHeight

  // Helper function to check if two rects overlap
  function rectsOverlap(rect1: Rect, rect2: Rect): boolean {
    return !(
      rect1.x + rect1.width <= rect2.x ||
      rect2.x + rect2.width <= rect1.x ||
      rect1.y + rect1.height <= rect2.y ||
      rect2.y + rect2.height <= rect1.y
    )
  }

  // Helper function to check if a rect fits within screen boundaries
  function rectFitsInScreen(rect: Rect): boolean {
    return (
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.x + rect.width <= screenWidth &&
      rect.y + rect.height <= screenHeight
    )
  }

  // Helper function to check if a candidate rect overlaps with any existing windows
  function doesNotOverlapWithExisting(candidateRect: Rect): boolean {
    for (const existingRect of allWindowRects) {
      if (rectsOverlap(candidateRect, existingRect)) {
        return false
      }
    }
    return true
  }

  // If no existing windows, place in top-left corner
  if (allWindowRects.length === 0) {
    return {
      x: 0,
      y: 0,
      width: requestedWidth > 0 ? requestedWidth : screenWidth,
      height: requestedHeight > 0 ? requestedHeight : screenHeight,
    }
  }

  // Try to place the new window adjacent to each existing window
  // Priority: right, left, bottom, top
  const candidatePositions: Array<Rect> = []

  // Helper to create and check a candidate position, pushing to array if valid
  function tryAddCandidate(rect: Rect, description: string) {
    if (rectFitsInScreen(rect) && doesNotOverlapWithExisting(rect)) {
      logDebug('findNextClosestAvailableArea', `Found candidate position ${description}: ${rectToString(rect)}`)
      candidatePositions.push(rect)
    }
  }

  for (const existingRect of allWindowRects) {
    // Try placing to the right
    tryAddCandidate({
      x: existingRect.x + existingRect.width,
      y: existingRect.y,
      width: requestedWidth > 0 ? requestedWidth : Math.max(300, screenWidth - (existingRect.x + existingRect.width)),
      height: requestedHeight > 0 ? requestedHeight : existingRect.height,
    }, 'to the right')

    // Try placing to the left
    tryAddCandidate({
      x: existingRect.x - (requestedWidth > 0 ? requestedWidth : Math.max(300, existingRect.x)),
      y: existingRect.y,
      width: requestedWidth > 0 ? requestedWidth : Math.max(300, existingRect.x),
      height: requestedHeight > 0 ? requestedHeight : existingRect.height,
    }, 'to the left')

    // Try placing below
    tryAddCandidate({
      x: existingRect.x,
      y: existingRect.y + existingRect.height,
      width: requestedWidth > 0 ? requestedWidth : existingRect.width,
      height: requestedHeight > 0 ? requestedHeight : Math.max(300, screenHeight - (existingRect.y + existingRect.height)),
    }, 'below')

    // Try placing above
    tryAddCandidate({
      x: existingRect.x,
      y: existingRect.y - (requestedHeight > 0 ? requestedHeight : Math.max(300, existingRect.y)),
      width: requestedWidth > 0 ? requestedWidth : existingRect.width,
      height: requestedHeight > 0 ? requestedHeight : Math.max(300, existingRect.y),
    }, 'above')
  }

  // If we found candidate positions, return the first one
  if (candidatePositions.length > 0) {
    logDebug('findNextClosestAvailableArea', `Found ${candidatePositions.length} candidate positions, using first: ${rectToString(candidatePositions[0])}`)
    return candidatePositions[0]
  }

  // Helper for fallback scanning
  function scanForAvailableRect(minWidth: number, minHeight: number, desc: string): Rect | null {
    for (let y = 0; y <= screenHeight - minHeight; y += stepSize) {
      for (let x = 0; x <= screenWidth - minWidth; x += stepSize) {
        const candidateRect: Rect = {
          x,
          y,
          width: minWidth,
          height: minHeight,
        }
        if (rectFitsInScreen(candidateRect) && doesNotOverlapWithExisting(candidateRect)) {
          logDebug('findNextClosestAvailableArea', `Found fallback position (${desc}): ${rectToString(candidateRect)}`)
          return candidateRect
        }
      }
    }
    return null
  }

  // TODO: ideally we would now try to reduce the requested size in steps, down to the minimum size, find any available space on the screen

  // Fallback 1: try to find any available space on the screen
  logDebug('findNextClosestAvailableArea', `No candidate positions found, trying first fallback`)
  const stepSize = 50 // Check every 50 pixels
  let minHeight = requestedHeight > 0 ? requestedHeight : 300
  let minWidth = requestedWidth > 0 ? requestedWidth : 300

  let fallbackPosition = scanForAvailableRect(
    requestedWidth > 0 ? requestedWidth : Math.max(300, screenWidth),
    requestedHeight > 0 ? requestedHeight : Math.max(300, screenHeight),
    "requested size"
  )
  if (fallbackPosition) return fallbackPosition

  // Fallback 2: reduce from the requested width to minimums, and try to find any available space on the screen
  logDebug('findNextClosestAvailableArea', `No candidate positions found, trying second fallback (width)`)
  minWidth = MIN_WINDOW_WIDTH
  fallbackPosition = scanForAvailableRect(minWidth, minHeight, "minimum width")
  if (fallbackPosition) return fallbackPosition

  // Fallback 3: reduce from the requested window size to minimums, and try to find any available space on the screen
  logDebug('findNextClosestAvailableArea', `No candidate positions found, trying third fallback (width+height)`)
  minHeight = MIN_WINDOW_HEIGHT
  minWidth = MIN_WINDOW_WIDTH
  fallbackPosition = scanForAvailableRect(minWidth, minHeight, "minimum width+height")
  if (fallbackPosition) return fallbackPosition

  // Last resort: place in top-right corner, constrained to screen
  logDebug('findNextClosestAvailableArea', `No candidate positions found, so will use last resort fallback`)
  const fallbackRect: Rect = {
    x: Math.max(0, screenWidth - (requestedWidth > 0 ? requestedWidth : screenWidth)),
    y: 0,
    width: requestedWidth > 0 ? Math.min(requestedWidth, screenWidth) : screenWidth,
    height: requestedHeight > 0 ? Math.min(requestedHeight, screenHeight) : screenHeight,
  }
  logWarn('findNextClosestAvailableArea', `Could not find ideal position, using fallback: ${rectToString(fallbackRect)}`)
  return fallbackRect
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
 * Open a note in a split view using x-callback-url, but only if it is not already open in any Editor window.
 * Uses the 'reuseSplitView' openType so that a single split view is reused where possible.
 * Note: This is in place of `await   Editor.openNoteByFilename(note.filename, true, 0, 0, false, false)` which doesn't have reuseSplitView option. (Yet.)
 * @author @jgclark
 * @param {string} filename - filename of the note to open
 * @returns {boolean} true if a new split view was opened, false if the note was already open
 */
export function openNoteInSplitViewIfNotOpenAlready(filename: string, callingFunctionName?: string): boolean {
  try {
    if (noteOpenInEditor(filename)) {
      logDebug('openNoteInSplitViewIfNotOpenAlready', `(for ${callingFunctionName ?? '?'}) Note '${filename}' is already open in an Editor window. Skipping.`)
      return false
    }

    const splitOpenType = usersVersionHas('reuseSplitView') ? 'reuseSplitView' : 'splitView'
    const callbackUrl = createOpenOrDeleteNoteCallbackUrl(filename, 'filename', null, splitOpenType, false)
    logDebug('openNoteInSplitViewIfNotOpenAlready', `(for ${callingFunctionName ?? '?'}) splitOpenType: ${splitOpenType} openNote in Editor callbackUrl: ${callbackUrl}`)
    NotePlan.openURL(callbackUrl)
    logDebug('openNoteInSplitViewIfNotOpenAlready', `(for ${callingFunctionName ?? '?'}) after x-callback call to openNote`)
    return true
  } catch (error) {
    logError('openNoteInSplitViewIfNotOpenAlready', `openNoteInSplitViewIfNotOpenAlready: Error: ${error.message}`)
    return false
  }
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

/**
 * Get the TEditor or HTMLView object from the given window ID
 * @param {string} windowId 
 * @returns {TEditor | HTMLView | false} the matching window object or false if not found
 */
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
  logWarn('getWindowFromId', `Couldn't find window matching id '${windowId}', so will return false. Here's the list of open windows:`)
  logWindowsList()
  return false
}

/**
 * Get the TEditor or HTMLView object from the given custom ID
 * @param {string} windowCustomId
 * @returns {TEditor | HTMLView | false} the matching window object or false if not found
 */
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
 * Close an Editor or HTML window given its windowId
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
    if (windowId !== '') {
      logWarn('getLiveWindowRect', `Couldn't retrieve windowRect from win id '${windowId}'`)
    } else {
      logDebug('getLiveWindowRect', `No HTML Windows available`)
    }
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
  if (usersVersionHas('mainSidebarControl')) {
    const sidebarWidth = NotePlan.getSidebarWidth()
    logInfo('logSidebarWidth', `Sidebar width: ${sidebarWidth} -- WARNING: This cannot tell if the sidebar is actually visible or not!`)
  } else {
    logWarn('logSidebarWidth', `Cannot get Sidebar width before NP v3.19.2`)
  }
}

// eslint-disable-next-line require-await
export async function setSidebarWidth(widthIn?: number): Promise<void> {
  if (usersVersionHas('mainSidebarControl')) {
    const width = widthIn ?? await inputIntegerBounded('Set Width for main NP Window', `Width (pixels)? (up to ${String(NotePlan.environment.screenWidth)})`, NotePlan.environment.screenWidth)
    NotePlan.setSidebarWidth(width)
    logDebug('setSidebarWidth', `Sidebar width set to ${width}`)
  } else {
    logWarn('setSidebarWidth', `Cannot Sidebar width before NP v3.19.2`)
  }
}

export function toggleSidebar(): void {
  if (usersVersionHas('mainSidebarControl')) {
    NotePlan.toggleSidebar(false, false, true)
  } else {
    logWarn('toggleSidebar', `Cannot toggle sidebar before NP v3.19.2`)
  }
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
  if (usersVersionHas('mainSidebarControl')) {
    NotePlan.toggleSidebar(true, false, true)
  } else {
    logWarn('closeSidebar', `Cannot close sidebar before NP v3.19.2`)
  }
}
