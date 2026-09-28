// @flow
// ----------------------------------------------------------------------------
// Helpers for window management
// See also HTMLView for specifics of working in HTML
// ----------------------------------------------------------------------------

import { getLastOpenedOpenEditorFromFilename } from './NPEditorBasics'
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
const DEFAULT_FLOATING_WINDOW_WIDTH = 500
const DEFAULT_WINDOW_GAP = 10
const PLACEMENT_SCAN_STEP = 50

/**
 * Width used for a new floating window. 0 or a non-finite value means the default 500px.
 * @param {number} requestedWidth
 * @returns {number}
 */
function placementWidth(requestedWidth: number): number {
  return (Number.isFinite(requestedWidth) && requestedWidth > 0) ? requestedWidth : DEFAULT_FLOATING_WINDOW_WIDTH
}

/**
 * Pixels left between a new window and the windows it is placed beside.
 * A missing value uses 10px. A negative value means no gap.
 * @param {?number} requestedGap
 * @returns {number}
 */
function placementGap(requestedGap: ?number): number {
  if (requestedGap == null || !Number.isFinite(requestedGap)) {
    return DEFAULT_WINDOW_GAP
  }
  if (requestedGap < 0) {
    return 0
  }
  return requestedGap
}

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
    outputLines.push(`- E ${String(c)}: ${win.windowType}: customId:'${win.customId ?? '-'}' filename:${win.filename ?? '-'} ID:${win.id} Rect:${rectToString(win.windowRect)}`)
    c++
  }
  c = 0
  for (const win of NotePlan.htmlWindows) {
    outputLines.push(`- H ${String(c)}: ${win.type}: customId:'${win.customId ?? '-'}' ${win.isVisible ? '' : '❌ INVISIBLE'} ID:${win.id} Rect:${rectToString(win.windowRect)}`)
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
 * Set the width of an open Editor split window.
 * WARNING: this doesn't fully work in practice. Only works for the main Editor window, and not for split windows.
 * An omitted argument asks the user, except when only one Editor is open: that pane is used and the editor-number prompt is skipped. A passed 0 is a real value: editor index 0 is the first open editor.
 * If editorWinIn is omitted and more than one Editor is open, the prompt accepts an editor index from 0 through the last open editor. Cancelling, or an answer outside that range, stops the function.
 * If widthIn is omitted, the prompt accepts a width from 300px through the screen width. Cancelling, or an answer outside that range, stops the function.
 * @author @jgclark
 *
 * @param {number?} editorWinIn - index into the open .editors array. If omitted and more than one Editor is open, the user is asked for an index from 0 to the last open editor. If only one Editor is open, that pane is used.
 * @param {number?} widthIn - width to set, in px. If omitted, the user is asked for a width from 300 to the screen width.
 */
export async function setEditorSplitWidth(editorWinIn?: number, widthIn?: number): Promise<void> {
  try {
    let editorWinIndex: number
    if (editorWinIn != null) {
      editorWinIndex = editorWinIn
    } else {
      const editorCount = NotePlan.editors?.length ?? 0
      if (editorCount < 1) {
        logWarn('setEditorSplitWidth', `No open Editor windows, so will stop.`)
        return
      }
      if (editorCount === 1) {
        editorWinIndex = 0
        logDebug('setEditorSplitWidth', `Only 1 open Editor, so will use editor #0`)
      } else {
        editorWinIndex = await inputIntegerBounded('Set Width', `Which open Editor number to set width for? (0-${String(editorCount - 1)})`, editorCount - 1, 0)
        if (isNaN(editorWinIndex)) {
          logWarn('setEditorSplitWidth', `User didn't provide an editor number, so will stop.`)
          return
        }
      }
    }
    const editorWin = NotePlan.editors[editorWinIndex]
    logDebug('setEditorSplitWidth', `- ew#${String(editorWinIndex)} currently Rect: ${rectToString(editorWin.windowRect)}`)
    const thisWindowRect = getLiveWindowRectFromWin(editorWin)
    if (!thisWindowRect) {
      logError('setEditorSplitWidth', `Can't get window rect for editor ${String(editorWinIndex)}`)
      return
    }

    const width = widthIn == null
      ? await inputIntegerBounded('Set Width', `Width? (300-${String(NotePlan.environment.screenWidth)})`, NotePlan.environment.screenWidth, 300)
      : widthIn
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
 * Width of the main sidebar when it is open. A collapsed sidebar, or NotePlan before sidebar control, counts as 0.
 * getSidebarWidth() still returns a number when the sidebar is hidden, so visibility has to be checked separately.
 * @returns {number}
 */
function openMainSidebarWidth(): number {
  if (!usersVersionHas('mainSidebarControl') || NotePlan.isSidebarCollapsed()) {
    return 0
  }
  const sidebarWidth = NotePlan.getSidebarWidth()
  return Number.isFinite(sidebarWidth) ? sidebarWidth : 0
}

/**
 * Set each main and split pane to the given width.
 * A split's windowRect.width is that pane. The main Editor's windowRect.width is the whole window: the open sidebar plus every pane.
 * The main window is therefore set to (open sidebar width) + (pane count * width), and capped to the screen width.
 * Splits are set first. The main window is set last, because that is the width NotePlan actually applies.
 * @param {number} width pane width to set (px)
 * @author @jgclark
 */
export async function setAllMainAndSplitWindowWidths(width: number): Promise<void> {
  try {
    const editors = NotePlan.editors ?? []
    const paneIndexes = []
    let frameIndex = -1
    for (let i = 0; i < editors.length; i++) {
      if (editors[i].windowType === 'floating') {
        continue
      }
      paneIndexes.push(i)
      if (editors[i].windowType === 'main') {
        frameIndex = i
      }
    }
    // If nothing is labelled main, the first non-floating editor is the whole window.
    if (frameIndex < 0 && paneIndexes.length > 0) {
      frameIndex = paneIndexes[0]
    }

    const sidebarWidth = openMainSidebarWidth()
    let mainWindowWidth = sidebarWidth + (paneIndexes.length * width)
    const screenWidth = NotePlan.environment.screenWidth
    if (Number.isFinite(screenWidth) && mainWindowWidth > screenWidth) {
      logDebug('setAllMainAndSplitWindowWidths', `- Main window width ${String(mainWindowWidth)}px is wider than the screen ${String(screenWidth)}px, so will cap it.`)
      mainWindowWidth = screenWidth
    }
    logDebug('setAllMainAndSplitWindowWidths', `Pane width ${String(width)}px, open sidebar ${String(sidebarWidth)}px, ${String(paneIndexes.length)} panes, main window ${String(mainWindowWidth)}px`)

    for (const i of paneIndexes) {
      if (i === frameIndex) {
        continue
      }
      logDebug('setAllMainAndSplitWindowWidths', `- setting split window #${String(i)} to ${String(width)}px`)
      await setEditorSplitWidth(i, width)
    }
    if (frameIndex >= 0) {
      logDebug('setAllMainAndSplitWindowWidths', `- setting main window #${String(frameIndex)} to ${String(mainWindowWidth)}px (includes open sidebar)`)
      await setEditorSplitWidth(frameIndex, mainWindowWidth)
    }
  } catch (error) {
    logError('setAllMainAndSplitWindowWidths', error.message)
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
 * Matches are exact and case-insensitive.
 * Note: From v3.20.2, this also checks the HTMLView.isVisible property to see if the window is actually visible, as it may be cached in memory. (Unless checkIsVisible is false, when no check is made.)
 * @param {string} customId - to look for
 * @param {boolean} checkIsVisible - whether to check the HTMLView.isVisible property to see if the window is actually visible, as it may be cached in memory. (Default: true)
 * @returns {string | false} the matching open HTML window's ID or false if not found
 */
export function getWindowIdFromCustomId(
  customId: string,
  checkIsVisible: boolean = true
): string | false {
  if (NotePlan.environment.platform !== 'macOS') {
    logDebug('getWindowIdFromCustomId', `Starting on ${NotePlan.environment.platform} for customId '${customId}'`)
    // return false
  }
  let foundWin: ?HTMLView | ?TEditor = null
  const doCheckIsVisible = checkIsVisible && usersVersionHas('windowIsVisible')

  // First try to find an HTML window with the same customId
  const allHTMLWindows = NotePlan.htmlWindows
  // clo(allHTMLWindows, 'getWindowIdFromCustomId: allHTMLWindows')
  for (const thisWin of allHTMLWindows) {
    // clo(thisWin, `getWindowIdFromCustomId(): thisWin=`)
    if (caseInsensitiveMatch(customId, thisWin.customId) /* || caseInsensitiveStartsWith(customId, thisWin.customId) */) {
      thisWin.customId = customId
      logDebug('getWindowIdFromCustomId', `Found HTML window '${thisWin.customId}' matching customId '${customId}' with ID '${thisWin.id}'`)
      foundWin = thisWin
    }
  }

  // From 3.20 now try to find an Editor window with the same customId
  const allEditorWindows = NotePlan.editors
  for (const thisWin of allEditorWindows) {
    if (caseInsensitiveMatch(customId, thisWin.customId) || caseInsensitiveStartsWith(customId, thisWin.customId)) {
      logDebug('getWindowIdFromCustomId', `Found Editor window '${thisWin.customId}' matching customId '${customId}' with ID '${thisWin.id}'`)
      foundWin = thisWin
    }
  }

  if (foundWin) {
    if (!doCheckIsVisible || (foundWin.isVisible ?? false)) {
      // logDebug('getWindowIdFromCustomId', `Window '${customId}' is available, so will return its ID '${foundWin.id}'.`)
      return foundWin.id
    }
    logDebug('getWindowIdFromCustomId', `Window '${foundWin.customId}' is available, but not visible, so will not return it.`)
    return false
  }
  logDebug('getWindowIdFromCustomId', `Did not find window with customId:"${customId}" on platform ${NotePlan.environment.platform}.`)
  return false
}

/**
 * Is a given HTML window open and visible, based on its customId?
 * Matches are case-insensitive, and either an exact match or a starts-with-match on the supplied customId.
 * Always uses getWindowIdFromCustomId(..., true) so hidden/cached panes do not count as open.
 * @author @jgclark
 * @param {string} customId to look for
 * @returns {boolean}
 */
export function isHTMLWindowOpen(customId: string): boolean {
  return !!getWindowIdFromCustomId(customId, true)
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
  // logWindowsList()

  const allEditorWindows = NotePlan.editors
  for (const thisEditorWindow of allEditorWindows) {
    if (thisEditorWindow.filename === filenameToFind) {
      logDebug('findEditorWindowByFilename', `found Editor Window for filename ${filenameToFind}. ID=${thisEditorWindow.id}`)
      return thisEditorWindow
    }
  }
  logDebug('findEditorWindowByFilename', `Couldn't match '${filenameToFind}' to an Editor window. All Editor windows: [${allEditorWindows.map(ew => ew.filename).join(', ')}]`)
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
 * @param {?number} requestedGap - pixels to leave between this window and others (missing means 10px)
 * @returns {boolean} success?
 */
function positionEditorWindowWithSmartPlacement(editor: TEditor, requestedWidth: number, requestedGap: ?number): boolean {
  const editorId = editor.id
  if (editor.windowType === 'main') {
    logWarn('positionEditorWindowWithSmartPlacement', `Refusing to move or resize the main window '${editorId}' ('${editor.filename ?? ''}')`)
    return false
  }
  logDebug('positionEditorWindowWithSmartPlacement', `Positioning ${editor.windowType ?? 'unknown'} Editor window '${editorId}' for filename '${editor.filename}' (customId: '${editor.customId}', ${rectToString(editor.windowRect)})`)

  // Narrow the main window first when there is no side-by-side gap, so the search below sees the freed space.
  shrinkMainWindowToDefaultIfNoHorizontalRoom(editorId, requestedWidth, requestedGap)

  const currentWindowRect = getLiveWindowRect(editorId)
  if (!currentWindowRect) {
    logWarn('positionEditorWindowWithSmartPlacement', `Couldn't get window rect for Editor window '${editorId}'`)
    return false
  }

  // Calculate the smart location for the new window
  const newWindowRect = calculateSmartLocation(currentWindowRect, requestedWidth, editorId, requestedGap)
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
 * @param {?number} windowGap - pixels to leave between the new window and others when smart placement is on (missing means 10px)
 * @returns {boolean} success?
 */
export async function openNoteInNewWindow(
  filename: string,
  width: number,
  onlyIfNotAlreadyOpen: boolean = false,
  smartLocation: boolean = true,
  windowGap: ?number = null): Promise<boolean> {
  try {
    // If note is already open, then simply focus it
    if (onlyIfNotAlreadyOpen && isEditorWindowOpen(filename)) {
      const thisEditor = getLastOpenedOpenEditorFromFilename(filename)
      if (!thisEditor) {
        throw new Error(`Couldn't find open Editor window for filename '${filename}'`)
      }
      logDebug('openNoteInNewWindow', `Note '${filename}' is already open in an Editor window. Will focus it.`)
      thisEditor.focus()
      return true
    }

    // Not open, so now open the note in a new floating window.
    // Remember which editors already exist: the same note may already be open in the main window.
    const editorIdsBefore = (NotePlan.editors ?? []).map((editor) => editor.id)
    const res: ?TNote = await Editor.openNoteByFilename(filename, true, 0, 0, false, false)
    if (!res) {
      logWarn('openNoteInNewWindow', `Failed to open floating window '${filename}'`)
      return false
    }
    logDebug('openNoteInNewWindow', `Opened new floating window for '${filename}'`)

    // Position window at smart location if requested
    if (smartLocation) {
      const thisEditor = floatingEditorOpenedSince(filename, editorIdsBefore)
      if (!thisEditor) {
        throw new Error(`Couldn't find the new floating Editor window for filename '${filename}'`)
      }
      positionEditorWindowWithSmartPlacement(thisEditor, width, windowGap)
    }

    return true
  } catch (error) {
    logError('openNoteInNewWindow', `Error: ${error.message}`)
    return false
  }
}

/**
 * The floating Editor created by the open that just happened.
 * An editor that already had this filename, including the main window, is not returned.
 * @param {string} filename
 * @param {Array<string>} editorIdsBefore - editor ids from before Editor.openNoteByFilename
 * @returns {TEditor | false}
 */
function floatingEditorOpenedSince(filename: string, editorIdsBefore: Array<string>): TEditor | false {
  const editors = NotePlan.editors ?? []
  const newEditors = editors.filter((editor) => editor.filename === filename && editorIdsBefore.indexOf(editor.id) === -1)
  const newFloating = newEditors.filter((editor) => editor.windowType === 'floating')
  if (newFloating.length > 0) {
    const chosen = newFloating[newFloating.length - 1]
    logDebug('openNoteInNewWindow', `Will position newly opened floating window '${chosen.id}' (${rectToString(chosen.windowRect)})`)
    return chosen
  }
  const newTypes = newEditors.map((editor) => `${editor.id}:${editor.windowType ?? ''}`).join(', ')
  logWarn('openNoteInNewWindow', `No new floating window for '${filename}'. New editors with that filename: ${newTypes || '(none)'}. Will not move an existing window.`)
  return false
}

type PlacementAnchor = {
  label: string,
  rect: Rect,
}

/**
 * Windows that occupy the screen for smart placement.
 * The window being moved is excluded. Split panes are excluded because their origin is 0,0 and the main window already covers them.
 * Hidden plugin windows are excluded when NotePlan reports visibility.
 * Anchors are ordered: main window, then other floating notes, then visible plugin windows.
 * @param {string} excludeEditorId
 * @returns {{ anchors: Array<PlacementAnchor>, skippedSplits: number, skippedHiddenHtml: number }}
 */
function collectPlacementAnchors(excludeEditorId: string): { anchors: Array<PlacementAnchor>, skippedSplits: number, skippedHiddenHtml: number } {
  const anchors: Array<PlacementAnchor> = []
  const floating: Array<PlacementAnchor> = []
  let skippedSplits = 0
  const editors = NotePlan.editors ?? []
  for (const editor of editors) {
    const editorLabel = editor.filename ?? editor.id
    if (excludeEditorId !== '' && editor.id === excludeEditorId) {
      logDebug('calculateSmartLocation', `Excluding the window just opened ('${editorLabel}') from the search`)
      continue
    }
    if (editor.windowType === 'split') {
      skippedSplits++
      continue
    }
    if (editor.windowType === 'main') {
      anchors.push({ label: `main window '${editorLabel}'`, rect: editor.windowRect })
      continue
    }
    if (editor.windowType === 'floating') {
      floating.push({ label: `floating window '${editorLabel}'`, rect: editor.windowRect })
      continue
    }
    logDebug('calculateSmartLocation', `Skipping editor '${editorLabel}' with windowType '${editor.windowType ?? ''}'`)
  }
  anchors.push(...floating)

  let skippedHiddenHtml = 0
  const checkVisible = usersVersionHas('windowIsVisible')
  const htmlWindows = NotePlan.htmlWindows ?? []
  for (const htmlWin of htmlWindows) {
    const htmlLabel = htmlWin.customId ?? htmlWin.id
    if (checkVisible && htmlWin.isVisible === false) {
      skippedHiddenHtml++
      logDebug('calculateSmartLocation', `Skipping hidden plugin window '${htmlLabel}'`)
      continue
    }
    anchors.push({ label: `plugin window '${htmlLabel}'`, rect: htmlWin.windowRect })
  }
  if (skippedSplits > 0) {
    logDebug('calculateSmartLocation', `Skipped ${String(skippedSplits)} split panes (origin is 0,0, and the main window already covers them)`)
  }
  return { anchors, skippedSplits, skippedHiddenHtml }
}

/**
 * True when some x-range on screen is at least neededWidth wide and does not overlap any anchor's x-range.
 * Y is ignored: a window above or below still occupies its horizontal span.
 * A free span beside another window must also leave `spacing` pixels between them. The screen edge does not need that spacing.
 * @param {Array<PlacementAnchor>} anchors
 * @param {number} neededWidth
 * @param {number} screenWidth
 * @param {number} spacing
 * @returns {boolean}
 */
function hasHorizontalGapForWidth(anchors: Array<PlacementAnchor>, neededWidth: number, screenWidth: number, spacing: number): boolean {
  if (!Number.isFinite(screenWidth) || screenWidth <= 0) {
    logDebug('shrinkMainWindowToDefaultIfNoHorizontalRoom', `Screen width ${String(screenWidth)} is not usable, so this is not treated as a missing horizontal gap`)
    return true
  }
  const intervals: Array<{ left: number, right: number, label: string }> = []
  for (const anchor of anchors) {
    const rect = anchor.rect
    if (!Number.isFinite(rect.x) || !Number.isFinite(rect.width) || rect.width <= 0) {
      continue
    }
    const left = Math.max(0, rect.x)
    const right = Math.min(screenWidth, rect.x + rect.width)
    if (right > left) {
      intervals.push({ left, right, label: anchor.label })
    }
  }
  intervals.sort((a, b) => a.left - b.left)
  const merged: Array<{ left: number, right: number }> = []
  for (const interval of intervals) {
    const last = merged[merged.length - 1]
    if (!last || interval.left > last.right) {
      merged.push({ left: interval.left, right: interval.right })
    } else if (interval.right > last.right) {
      last.right = interval.right
    }
  }
  // Space beside another window is reserved for the gap. Space against the screen edge is not.
  function usableSpan(freeStart: number, freeEnd: number): number {
    const span = freeEnd - freeStart
    if (span <= 0) {
      return 0
    }
    let reserved = 0
    if (freeStart > 0) {
      reserved += spacing
    }
    if (freeEnd < screenWidth) {
      reserved += spacing
    }
    const usable = span - reserved
    return usable > 0 ? usable : 0
  }

  let cursor = 0
  let largestGap = 0
  for (const interval of merged) {
    const usable = usableSpan(cursor, interval.left)
    if (usable > largestGap) {
      largestGap = usable
    }
    if (interval.right > cursor) {
      cursor = interval.right
    }
  }
  const endUsable = usableSpan(cursor, screenWidth)
  if (endUsable > largestGap) {
    largestGap = endUsable
  }
  const coverage = intervals.map((interval) => `${interval.label} x${String(interval.left)}-${String(interval.right)}`).join('; ')
  const fits = largestGap >= neededWidth
  logDebug('shrinkMainWindowToDefaultIfNoHorizontalRoom', `Horizontal coverage: ${coverage || '(none)'}. Largest usable gap ${String(largestGap)}px after leaving ${String(spacing)}px between windows. Need ${String(neededWidth)}px. ${fits ? 'A side-by-side gap exists.' : 'No side-by-side gap.'}`)
  return fits
}

/**
 * When the new window cannot sit beside open windows without sharing their horizontal span, and the main window is wider than its default, narrow the main window to that default.
 * The default is the open sidebar plus each non-floating pane at the placement width. x, y, and height are left unchanged. The window is not narrowed when it is already at or below that width.
 * Narrowing moves the right edge left. Floating windows whose left edge was beside that edge are shifted left by the same amount. The window just opened is not shifted.
 * @param {string} excludeEditorId - the new floating window, which is not an obstacle and is not shifted
 * @param {number} requestedWidth - placement width (0 means 500px)
 * @param {?number} requestedGap - pixels to leave between windows (missing means 10px)
 */
function shrinkMainWindowToDefaultIfNoHorizontalRoom(excludeEditorId: string, requestedWidth: number, requestedGap: ?number): void {
  const neededWidth = placementWidth(requestedWidth)
  const spacing = placementGap(requestedGap)
  const { anchors } = collectPlacementAnchors(excludeEditorId)
  const screenWidth = NotePlan.environment.screenWidth
  if (hasHorizontalGapForWidth(anchors, neededWidth, screenWidth, spacing)) {
    logDebug('shrinkMainWindowToDefaultIfNoHorizontalRoom', `A horizontal gap fits the new window, so the main window will not be resized`)
    return
  }

  const editors = NotePlan.editors ?? []
  let mainEditor: TEditor | null = null
  let paneCount = 0
  for (const editor of editors) {
    if (editor.windowType === 'main' && mainEditor == null) {
      mainEditor = editor
    }
    if (editor.windowType !== 'floating') {
      paneCount++
    }
  }
  if (mainEditor == null) {
    logInfo('shrinkMainWindowToDefaultIfNoHorizontalRoom', `No horizontal gap of ${String(neededWidth)}px, and there is no main window to narrow`)
    return
  }
  if (paneCount < 1) {
    paneCount = 1
  }
  const sidebarWidth = openMainSidebarWidth()
  const defaultWidth = sidebarWidth + (paneCount * neededWidth)
  const currentRect = getLiveWindowRectFromWin(mainEditor)
  if (!currentRect) {
    logWarn('shrinkMainWindowToDefaultIfNoHorizontalRoom', `No horizontal gap of ${String(neededWidth)}px, but the main window rect could not be read, so it will not be resized`)
    return
  }
  if (!(currentRect.width > defaultWidth)) {
    logInfo('shrinkMainWindowToDefaultIfNoHorizontalRoom', `No horizontal gap of ${String(neededWidth)}px. Main window is ${String(currentRect.width)}px, which is not wider than the default ${String(defaultWidth)}px (open sidebar ${String(sidebarWidth)}px + ${String(paneCount)} panes at ${String(neededWidth)}px). It will not be resized.`)
    return
  }

  const oldRight = currentRect.x + currentRect.width
  const delta = currentRect.width - defaultWidth
  const updatedRect: Rect = { x: currentRect.x, y: currentRect.y, width: defaultWidth, height: currentRect.height }
  mainEditor.windowRect = updatedRect
  logInfo('shrinkMainWindowToDefaultIfNoHorizontalRoom', `No horizontal gap of ${String(neededWidth)}px. Reduced main window width from ${String(currentRect.width)}px to the default ${String(defaultWidth)}px (open sidebar ${String(sidebarWidth)}px + ${String(paneCount)} panes at ${String(neededWidth)}px). Right edge moved left by ${String(delta)}px. Position otherwise unchanged: ${rectToString(mainEditor.windowRect)}`)
  shiftFloatingWindowsBesideMovedEdge(oldRight, delta, spacing, excludeEditorId)
}

/**
 * Shift floating note windows that were sitting against the main window edge that just moved.
 * Only the right edge moves, and only leftward, so a window counts as beside it when its left edge is within the placement gap of that old edge (plus 2px for rounding).
 * Each match moves left by `delta`. Width, height, and y stay the same. The window just opened is left for placement.
 * @param {number} oldRight - x of the main window's right edge before it was narrowed
 * @param {number} delta - how far that edge moved left
 * @param {number} spacing - configured gap between windows
 * @param {string} excludeEditorId - the new floating window
 */
function shiftFloatingWindowsBesideMovedEdge(oldRight: number, delta: number, spacing: number, excludeEditorId: string): void {
  if (!(delta > 0)) {
    return
  }
  const maxDistance = spacing + 2
  const editors = NotePlan.editors ?? []
  let movedCount = 0
  for (const editor of editors) {
    if (editor.windowType !== 'floating') {
      continue
    }
    const label = editor.filename ?? editor.id
    if (excludeEditorId !== '' && editor.id === excludeEditorId) {
      logDebug('shrinkMainWindowToDefaultIfNoHorizontalRoom', `Not shifting the window just opened ('${label}')`)
      continue
    }
    const rect = getLiveWindowRectFromWin(editor)
    if (!rect || !Number.isFinite(rect.x)) {
      logDebug('shrinkMainWindowToDefaultIfNoHorizontalRoom', `Not shifting floating window '${label}': its rect could not be read`)
      continue
    }
    const distance = rect.x - oldRight
    if (distance < -2 || distance > maxDistance) {
      logDebug('shrinkMainWindowToDefaultIfNoHorizontalRoom', `Leaving floating window '${label}' at x${String(rect.x)}: its left edge is ${String(distance)}px from the moved edge, and beside means between -2px and ${String(maxDistance)}px`)
      continue
    }
    const updatedRect: Rect = { x: rect.x - delta, y: rect.y, width: rect.width, height: rect.height }
    editor.windowRect = updatedRect
    movedCount++
    logInfo('shrinkMainWindowToDefaultIfNoHorizontalRoom', `Moved floating window '${label}' left by ${String(delta)}px, matching the main window's right edge. It was ${String(distance)}px from that edge. Now ${rectToString(editor.windowRect)}`)
  }
  if (movedCount === 0) {
    logDebug('shrinkMainWindowToDefaultIfNoHorizontalRoom', `No other floating window was beside the main window's right edge, so none were moved`)
  }
}

/**
 * Calculate the smart placement for the new window.
 * Obstacles are the main window, other floating notes, and visible plugin windows. The window being moved is not an obstacle.
 * The first gap that fits is used: main window before other windows, and beside each window right, then left, then below, then above.
 * Screen origin is the bottom-left. Height matches the anchor window. Width is the requested width, or 500px when none was given.
 * @param {Rect} thisWindowRect - the Rect of the window being moved
 * @param {number} requestedWidth - the requested width of the new window (0 means use 500px)
 * @param {string} excludeEditorId - id of the window being moved
 * @param {?number} requestedGap - pixels to leave between this window and others (missing means 10px)
 * @returns {Rect} the smart location for the new window
 */
export function calculateSmartLocation(thisWindowRect: Rect, requestedWidth: number, excludeEditorId: string = '', requestedGap: ?number = null): Rect {
  const width = placementWidth(requestedWidth)
  if (!(Number.isFinite(requestedWidth) && requestedWidth > 0)) {
    logDebug('calculateSmartLocation', `No usable requested width (${String(requestedWidth)}), so will use ${String(DEFAULT_FLOATING_WINDOW_WIDTH)}px`)
  }
  const spacing = placementGap(requestedGap)
  if (requestedGap == null || !Number.isFinite(requestedGap)) {
    logDebug('calculateSmartLocation', `No usable window gap (${String(requestedGap)}), so will use ${String(DEFAULT_WINDOW_GAP)}px`)
  }
  const height = (Number.isFinite(thisWindowRect.height) && thisWindowRect.height > 0) ? thisWindowRect.height : MIN_WINDOW_HEIGHT
  const { anchors, skippedHiddenHtml } = collectPlacementAnchors(excludeEditorId)
  const anchorSummary = anchors.map((anchor) => anchor.label).join('; ')
  logDebug('calculateSmartLocation', `Obstacles: ${anchorSummary || '(none)'}. Skipped ${String(skippedHiddenHtml)} hidden plugin windows. Fallback height from the new window is ${String(height)}px. Window gap is ${String(spacing)}px.`)
  const newWindowRect = findNextClosestAvailableArea(anchors, height, width, spacing)
  logDebug('calculateSmartLocation', `Calculated smart location: ${rectToString(newWindowRect)}`)
  return newWindowRect
}

/**
 * Find the next available area that is:
 * - not overlapping with any anchor window
 * - as tall as the anchor window, and the requested width
 * - beside an anchor, trying the main window first
 * - within the screen boundaries
 * Screen origin is the bottom-left. "Below" is toward y=0. "Above" is toward the top of the screen.
 * @param {Array<PlacementAnchor>} anchors - ordered obstacles: main, then floating notes, then visible plugin windows
 * @param {number} fallbackHeight - height to use when an anchor has no usable height, and for the screen scan
 * @param {number} requestedWidth - width of the new window, already resolved to a positive number
 * @param {number} windowGap - pixels to leave between this window and others
 * @returns {Rect} the next available area
 */
function findNextClosestAvailableArea(anchors: Array<PlacementAnchor>, fallbackHeight: number, requestedWidth: number, windowGap: number): Rect {
  const screenWidth = NotePlan.environment.screenWidth
  const screenHeight = NotePlan.environment.screenHeight
  const directionOrder = ['right', 'left', 'below', 'above']

  // Helper function to check if two rects overlap. Touching edges do not count.
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

  function firstOverlapLabel(candidateRect: Rect): string {
    for (const anchor of anchors) {
      if (rectsOverlap(candidateRect, anchor.rect)) {
        return anchor.label
      }
    }
    return ''
  }

  // Overlap, or nearer than windowGap. A distance of exactly windowGap is allowed. The screen edge does not need a gap.
  function blockingReason(candidateRect: Rect): string {
    const overlapLabel = firstOverlapLabel(candidateRect)
    if (overlapLabel !== '') {
      return `overlaps ${overlapLabel}`
    }
    if (windowGap <= 0) {
      return ''
    }
    const paddedRect: Rect = {
      x: candidateRect.x - windowGap,
      y: candidateRect.y - windowGap,
      width: candidateRect.width + (windowGap * 2),
      height: candidateRect.height + (windowGap * 2),
    }
    const closeLabel = firstOverlapLabel(paddedRect)
    if (closeLabel !== '') {
      return `closer than ${String(windowGap)}px to ${closeLabel}`
    }
    return ''
  }

  function heightForAnchor(anchor: PlacementAnchor): number {
    if (Number.isFinite(anchor.rect.height) && anchor.rect.height > 0) {
      return anchor.rect.height
    }
    return fallbackHeight
  }

  // Screen origin is the bottom-left, so "below" uses a smaller y and "above" uses a larger y.
  function rectBeside(anchor: PlacementAnchor, direction: string, height: number): Rect {
    const existingRect = anchor.rect
    if (direction === 'right') {
      return { x: existingRect.x + existingRect.width + windowGap, y: existingRect.y, width: requestedWidth, height }
    }
    if (direction === 'left') {
      return { x: existingRect.x - requestedWidth - windowGap, y: existingRect.y, width: requestedWidth, height }
    }
    if (direction === 'below') {
      return { x: existingRect.x, y: existingRect.y - height - windowGap, width: requestedWidth, height }
    }
    return { x: existingRect.x, y: existingRect.y + existingRect.height + windowGap, width: requestedWidth, height }
  }

  logDebug('findNextClosestAvailableArea', `Decision rule: first slot that fits. Anchors: main window, then floating notes, then visible plugin windows. Beside each: right, left, below, above, leaving ${String(windowGap)}px between windows.`)

  // If no existing windows, place in the top-left corner
  if (anchors.length === 0) {
    const width = Math.min(requestedWidth, screenWidth)
    const height = Math.min(fallbackHeight, screenHeight)
    const topLeftRect: Rect = { x: 0, y: Math.max(0, screenHeight - height), width, height }
    logInfo('findNextClosestAvailableArea', `No other windows, so chose top-left at ${rectToString(topLeftRect)}`)
    return topLeftRect
  }

  let rejectedCount = 0
  for (const anchor of anchors) {
    const height = heightForAnchor(anchor)
    for (const direction of directionOrder) {
      const candidateRect = rectBeside(anchor, direction, height)
      if (!rectFitsInScreen(candidateRect)) {
        rejectedCount++
        logDebug('findNextClosestAvailableArea', `Rejected ${direction} of ${anchor.label}: off screen ${rectToString(candidateRect)}`)
        continue
      }
      const blockReason = blockingReason(candidateRect)
      if (blockReason !== '') {
        rejectedCount++
        logDebug('findNextClosestAvailableArea', `Rejected ${direction} of ${anchor.label}: ${blockReason} (${rectToString(candidateRect)})`)
        continue
      }
      logInfo('findNextClosestAvailableArea', `Chose ${direction} of ${anchor.label} at ${rectToString(candidateRect)}, leaving ${String(windowGap)}px. Height matches that window. Rejected ${String(rejectedCount)} earlier slots.`)
      return candidateRect
    }
  }

  // Helper for fallback scanning. y grows upward, so the scan still covers the screen.
  function scanForAvailableRect(minWidth: number, minHeight: number, desc: string): Rect | null {
    for (let y = 0; y <= screenHeight - minHeight; y += PLACEMENT_SCAN_STEP) {
      for (let x = 0; x <= screenWidth - minWidth; x += PLACEMENT_SCAN_STEP) {
        const candidateRect: Rect = {
          x,
          y,
          width: minWidth,
          height: minHeight,
        }
        if (rectFitsInScreen(candidateRect) && blockingReason(candidateRect) === '') {
          logInfo('findNextClosestAvailableArea', `Chose scanned gap (${desc}) at ${rectToString(candidateRect)} after no beside-slot fitted`)
          return candidateRect
        }
      }
    }
    return null
  }

  // TODO: ideally we would now try to reduce the requested size in steps, down to the minimum size, find any available space on the screen

  // Fallback 1: try to find any available space on the screen at the requested size
  logDebug('findNextClosestAvailableArea', `No beside-slot fitted (${String(rejectedCount)} rejected), trying a scan at the requested size`)
  let minHeight = fallbackHeight
  let fallbackPosition = scanForAvailableRect(requestedWidth, fallbackHeight, 'requested size')
  if (fallbackPosition) return fallbackPosition

  // Fallback 2: reduce from the requested width to minimums, and try to find any available space on the screen
  logDebug('findNextClosestAvailableArea', `No gap at the requested size, trying minimum width ${String(MIN_WINDOW_WIDTH)}px`)
  fallbackPosition = scanForAvailableRect(MIN_WINDOW_WIDTH, minHeight, 'minimum width')
  if (fallbackPosition) return fallbackPosition

  // Fallback 3: reduce from the requested window size to minimums, and try to find any available space on the screen
  logDebug('findNextClosestAvailableArea', `No gap at minimum width, trying minimum width and height`)
  minHeight = MIN_WINDOW_HEIGHT
  fallbackPosition = scanForAvailableRect(MIN_WINDOW_WIDTH, minHeight, 'minimum width+height')
  if (fallbackPosition) return fallbackPosition

  // Last resort: place in the top-right corner, constrained to the screen. This can cover another window.
  const width = Math.min(requestedWidth, screenWidth)
  const height = Math.min(fallbackHeight, screenHeight)
  const fallbackRect: Rect = {
    x: Math.max(0, screenWidth - width),
    y: Math.max(0, screenHeight - height),
    width,
    height,
  }
  logWarn('findNextClosestAvailableArea', `No free gap, so chose top-right at ${rectToString(fallbackRect)}. This can cover another window.`)
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
 * Optional highlightStart/highlightLength are passed to the x-callback so NotePlan can jump/select as the note opens
 * (needed because waiting for the Editor pane after NotePlan.openURL is unreliable in NotePlan's JSContext).
 * Note: This is in place of `await Editor.openNoteByFilename(note.filename, true, 0, 0, false, false)` which doesn't have reuseSplitView option. (Yet.)
 * @author @jgclark
 * @param {string} filename - filename of the note to open
 * @param {string=} callingFunctionName - for logging
 * @param {number | null=} highlightStart - character index to jump/select after opening
 * @param {number | null=} highlightLength - selection length (0 = cursor only)
 * @returns {boolean} true if a new split view was opened, false if the note was already open
 */
export function openNoteInSplitViewIfNotOpenAlready(
  filename: string,
  callingFunctionName?: string,
  highlightStart: number | null = null,
  highlightLength: number | null = null,
): boolean {
  try {
    const possibleEditor: TEditor | false = findEditorWindowByFilename(filename)
    if (possibleEditor !== false) {
      logDebug('openNoteInSplitViewIfNotOpenAlready', `(for ${callingFunctionName ?? '?'}) Note '${filename}' is already open in Editor window '${possibleEditor.id}'. Focusing it.`)
      possibleEditor.focus()
      return false
    }

    const splitOpenType = usersVersionHas('reuseSplitView') ? 'reuseSplitView' : 'splitView'
    const callbackUrl = createOpenOrDeleteNoteCallbackUrl(
      filename,
      'filename',
      null,
      splitOpenType,
      false,
      '',
      null,
      highlightStart,
      highlightLength,
    )
    logDebug(
      'openNoteInSplitViewIfNotOpenAlready',
      `(for ${callingFunctionName ?? '?'}) splitOpenType: ${splitOpenType} highlightStart=${String(highlightStart)} highlightLength=${String(highlightLength)} openNote callbackUrl: ${callbackUrl}`,
    )
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
 * Embed type of an Editor or HTML window (`main` | `split` | `floating` | `unsupported`).
 * Prefer `.windowType` (TEditor, and HTMLView in current NotePlan). `.type` on HTMLView is often the view kind (`html`), not the embed location, despite older API docs listing main|split|floating.
 * @param {TEditor | HTMLView} win
 * @returns {string}
 */
export function getWindowEmbedType(win: TEditor | HTMLView): string {
  const anyWin: any = win
  if (typeof anyWin.windowType === 'string' && anyWin.windowType !== '') {
    return anyWin.windowType
  }
  // Older HTMLView docs claimed `.type` was the embed location; skip the view-kind value `html`.
  if (typeof anyWin.type === 'string' && anyWin.type !== '' && anyWin.type !== 'html') {
    return anyWin.type
  }
  return ''
}

/**
 * True when the window is a pane of the main NotePlan window (`main` or `split`).
 * Those are mutually exclusive with `floating`: a window cannot be both embedded and floating.
 * HTMLView.showInMainWindow panes typically have an empty windowRect (`{}`).
 * @param {TEditor | HTMLView} win
 * @returns {boolean}
 */
export function isEmbeddedWindow(win: TEditor | HTMLView): boolean {
  const embedType = getWindowEmbedType(win)
  return embedType === 'main' || embedType === 'split'
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
 * Coerce a preference / bridge value to a finite number.
 * NotePlan sometimes persists rect edges as numeric strings (e.g. `"-0"`), and live windowRect values can
 * arrive as non-plain number-like values; both should still be usable.
 * @param {mixed} value
 * @returns {number | null} finite number, or null if not coercible
 */
function finiteNumberFromPref(value: mixed): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) {
      return n
    }
  }
  return null
}

/**
 * Build a plain Rect from mixed x/y/width/height values, or null if any edge is missing/invalid.
 * Always returns a plain object (not a native bridge Rect) so setPreference can serialize it.
 * @param {mixed} x
 * @param {mixed} y
 * @param {mixed} width
 * @param {mixed} height
 * @returns {Rect | null}
 */
function plainRectFromParts(x: mixed, y: mixed, width: mixed, height: mixed): Rect | null {
  const nx = finiteNumberFromPref(x)
  const ny = finiteNumberFromPref(y)
  const nw = finiteNumberFromPref(width)
  const nh = finiteNumberFromPref(height)
  if (nx == null || ny == null || nw == null || nh == null) {
    return null
  }
  return { x: nx, y: ny, width: nw, height: nh }
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
  if (!thisWindow) {
    logWarn('storeWindowRect', `Couldn't save Rect for '${customId}'`)
    return
  }
  // Main Window / Split View HTML panes have no independent floating windowRect (API returns {}).
  const embedType = getWindowEmbedType(thisWindow)
  if (isEmbeddedWindow(thisWindow)) {
    logDebug('storeWindowRect', `Skipping save for '${customId}': window type '${embedType}' has no independent windowRect`)
    return
  }
  // Copy into a plain object: passing a native windowRect bridge object into setPreference can persist as {}.
  const live = thisWindow.windowRect
  const windowRect = plainRectFromParts(live?.x, live?.y, live?.width, live?.height)
  if (!windowRect) {
    const anyWin: any = thisWindow
    // Empty rect is expected for Main Window / Split View HTML panes (and when `.type` is just `html`).
    logDebug('storeWindowRect', `Skipping save for '${customId}': type='${String(anyWin.type ?? '')}' windowType='${String(anyWin.windowType ?? '')}' live windowRect is not numeric (${rectToString(live)})`)
    return
  }
  const prefName = `WinRect_${customId}`
  DataStore.setPreference(prefName, windowRect)
  logDebug('storeWindowRect', `Saved Rect ${rectToString(windowRect)} to ${prefName}`)
}

/**
 * Get the Rect (x/y/w/h) of the given window, given by its ID, from the local device's NP preferences store
 * @param {string} customId
 * @returns {Rect} the Rect (x/y/w/h)
 */
export function getStoredWindowRect(customId: string): Rect | false {
  try {
    const prefName = `WinRect_${customId}`
    // DataStore.preference() is untyped (`mixed`), so the stored value has to be validated at runtime before it can be
    // treated as a Rect. Anything malformed takes the same "couldn't retrieve it" path as a missing pref.
    const storedPref = DataStore.preference(prefName)
    if (!storedPref || typeof storedPref !== 'object') {
      logWarn('getWindowRect', `Couldn't retrieve Rect from saved pref ${prefName}`)
      return false
    }
    // Prefs may hold numbers or numeric strings; empty historical prefs (e.g. {} from bridge serialisation) fail here.
    const raw: any = storedPref
    const windowRect = plainRectFromParts(raw.x, raw.y, raw.width, raw.height)
    if (!windowRect) {
      logWarn('getWindowRect', `Saved pref ${prefName} isn't a valid Rect (x/y/width/height must all be numbers); got ${JSON.stringify(storedPref)}`)
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
    const live = win.windowRect
    // Native bridge Rect can enumerate as {} with undefined x/y/w/h (typical for main/split HTML panes).
    const windowRect = plainRectFromParts(live?.x, live?.y, live?.width, live?.height)
    if (windowRect) {
      clo(windowRect, `getLiveWindowRectFromWin(): Retrieved Rect ${rectToString(windowRect)}:`)
      return windowRect
    }
    logDebug('getLiveWindowRectFromWin', `windowRect is not numeric (${rectToString(live)})`)
    return false
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
// export function constrainWindowSizeAndPosition(winDetails: EditorWinDetails | HTMLWinDetails): EditorWinDetails | HTMLWinDetails {
export function constrainWindowSizeAndPosition<T: { x: number, y: number, width: number, height: number, +title?: string, ... }>(winDetails: T): T {
  try {
    const screenHeight = NotePlan.environment.screenHeight // remember bottom edge is y=0
    const screenWidth = NotePlan.environment.screenWidth
    const left = winDetails.x
    const right = winDetails.x + winDetails.width
    const top = winDetails.y + winDetails.height
    const bottom = winDetails.y
    const title = winDetails.title ?? 'n/a' // only used for logging; a plain Rect has no title
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
