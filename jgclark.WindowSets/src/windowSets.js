// @flow
//---------------------------------------------------------------
// Main functions for WindowSets plugin
// Jonathan Clark
// last update 10.9.2022 for v0.2.0 by @jgclark
//---------------------------------------------------------------

import pluginJson from '../plugin.json'
import { addCodeBlock, getCodeBlocksOfType, updateCodeBlock } from '@helpers/codeBlocks'
import {
  calcOffsetDateStr,
  daysBetween,
  // getDateStringFromCalendarFilename,
  // getDateStrForStartofPeriodFromCalendarFilename,
  getDateStringFromCalendarFilename,
  getISODateStringFromYYYYMMDD,
  getTodaysDateHyphenated,
  isValidCalendarNoteFilename,
  RE_OFFSET_DATE_CAPTURE,
  RE_OFFSET_DATE,
  unhyphenateString,
  // unhyphenatedDate,
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { logPreference, unsetPreference } from '@helpers/NPdev'
import { displayTitle } from '@helpers/general'
import { getOrMakeNote, getProjectNotesInFolder } from '@helpers/note'
import { relativeDateCodeFromDateString } from '@helpers/NPdateTime'
import { getNoteFilenameFromTitle } from '@helpers/NPnote'
import {
  applyRectToWindow,
  closeWindowFromId,
  getNonMainWindowIds,
  rectToString
} from '@helpers/NPWindows'
import {
  openNoteInNewSplitIfNeeded,
  openNoteInNewWindowIfNeeded
} from "@helpers/NPWindows";
import { chooseOption, getInputTrimmed, showMessage, showMessageYesNo, showMessageYesNoCancel } from '@helpers/userInput'

//-----------------------------------------------------------------
// Plugin lookup list
type PluginWindowCommand = {
  pluginWindowId: string,
  pluginID: string,
  pluginCommandName: string
}
const pluginWindowsAndCommands: Array<PluginWindowCommand> = [
  { pluginWindowId: 'jgclark.Dashboard.main', pluginID: 'jgclark.Dashboard', pluginCommandName: 'Show Dashboard window' },
  { pluginWindowId: 'Review List', pluginID: 'jgclark.Reviews', pluginCommandName: 'project lists' },
]

//-----------------------------------------------------------------
// Data types
type EditorWinDetails = {
  noteType: string, // "Calendar" | "Note"
  filename: string,
  openAction: string, // "main" | "floating" | "split"
  title?: string, // optional, but persist it where used
  x?: number,
  y?: number,
  width?: number,
  height?: number,
}

type HTMLWinDetails = {
  type: string, // "Plugin" is the only type supported so far
  pluginID: string,
  pluginCommand: string,
  customId?: string, // If set to the same as the plugin sets, then you can override the last-stored x/y/width/height of the window
  x?: number,
  y?: number,
  width?: number,
  height?: number,
  // filename, customID are set by the plugin command itself so aren't needed here
}

type WindowSet = {
  name: string,
  closeOtherWindows: boolean,
  editorWindows: Array<EditorWinDetails>,
  htmlWindows: Array<HTMLWinDetails>,
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

const exampleContent1 = `# Day + Week Window Sets

This is an example of:
- use of a 'json' code block to specify a Window Set
- more than 1 Window Set definition in separate code blocks in the same note
- specifying "Calendar" note types
- use of relative dates to define dates that work relative to today's date (see the [Plugin's README](https://github.com/NotePlan/plugins/blob/main/jgclark.WindowSets/README.md) for more details)
- the ability to "closeOtherWindows" before the Window Set is activated
- "htmlWindows", "x", "y", "width", "height" should be left out if you don't want to define them
- these can have "title"s, though currently they're only used to help you identify different windows.

Note: the JSON has to be well-formatted to be usable. In particular check that there aren't any extra commas after the final item of any section.

\`\`\`json
{
  "name": "Days (Yesterday+Today+Tomorrow)",
  "closeOtherWindows": true,
  "editorWindows": [
		{
		"noteType": "Calendar",
		"openAction": "split",
		"filename": "{-1d}",
		"title": "yesterday"
		},
		{
		"noteType": "Calendar",
		"openAction": "split",
		"filename": "{0d}",
		"title": "today"
		},
		{
		"noteType": "Calendar",
		"openAction": "split",
		"filename": "{+1d}",
		"title": "tomorrow"
		}
  ]
}
\`\`\`

\`\`\`json
{
  "name": "Weeks (Last+This+Next)",
  "closeOtherWindows": true,
  "editorWindows": [
		{
		"noteType": "Calendar",
		"openAction": "split",
		"filename": "{-1w}",
		"title": "last week"
		},
		{
		"noteType": "Calendar",
		"openAction": "split",
		"filename": "{0w}",
		"title": "this week"
		},
		{
		"noteType": "Calendar",
		"openAction": "split",
		"filename": "{+1w}",
		"title": "next week"
		}
  ]
}
\`\`\`
`

const exampleContent2 = `# Staff Meeting Window Sets

This is an example of:
- specifying regular type "Note" notes. Note that the full filepath (including extension) needs to be given, not just the filename or title.
- specifying they should be opened in new 'floating' windows. If x/y/width/height aren't given, NotePlan will determine them.
- specifying a plugin window to be run, by its command name. Note: this should *not* be URI-encoded.
- use of x/y/wdith/height can override the last-used settings of the plugin window.

Note: the JSON has to be well-formatted to be usable. In particular check that there aren't any extra commas after the final item of any section.

\`\`\`json
{
  "name": "Staff Meeting",
  "closeOtherWindows": false,
  "editorWindows": [
    {
      "type": "Note",
      "openAction": "floating",
      "filename": "CCC Areas/Admin (Work).md",
      "title": "Admin (Work)"
    },
    {
      "type": "Note",
      "openAction": "floating",
      "filename": "Saved Searches/RP Search Results.md",
      "title": "@RP Search Results"
    }
  ],
  "htmlWindows": [
    {
      "type": "Plugin",
      "pluginID": "jgclark.Dashboard",
      "pluginCommand": "show dashboard",
      "customId": "Dashboard",
      "x": 416, "y": 515, "width": 990, "height": 360
    }
  ]
}
\`\`\`
`

//---------------------------------------------------------------
// Settings

export type WindowSetsConfig = {
  folderForDefinitions: string,
  _logDebug: String,
}

const pluginID = 'jgclark.WindowSets'

/**
 * Get general config settings for this plugin
 * @return {any} object with configuration
 */
export async function getPluginSettings(): Promise<any> {
  // logDebug(pluginJson, `Start of getPluginSettings()`)
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

/**
 * Read current WindowSet definitions
 * V2: read from 'folderForDefinitions' folder of files. In each the JSON code block(s) define(s) the WS.
 * @param {string} folderForDefinitions
 * @returns {Array<WindowSet>} JSON configuration object for all window sets
 */
export function readWindowSetDefinitions(folderForDefinitions: string): Array<WindowSet> {
  try {
    logDebug(pluginJson, `readWindowSetDefinitions() starting for folder '${folderForDefinitions}'`)
    let windowSets: Array<WindowSet> = []
    // Read all files in @WindowSets folder
    const folderFiles = getProjectNotesInFolder(folderForDefinitions)
    if (folderFiles.length > 0) {
      for (const file of folderFiles) {
        logDebug('readWindowSetDefinitions', `file: ${file.filename}: `)
        // Get the contents of code blocks ot type JSON
        const codeBlocks = getCodeBlocksOfType(file, ['json'])
        if (codeBlocks.length === 0) {
          logWarn('readWindowSetDefinitions', `No JSON code blocks found in '${file.filename}'`)
          continue
        } else {
          // Process the codeblock(s)
          let cbCount = 0
          for (const cb of codeBlocks) {
            cbCount++
            // logDebug('readWindowSetDefinitions', `code block ${String(cbCount)}:\n${cb.code}`)
            const thisJSON = JSON.parse(cb.code)
            // clo(thisJSON, `thisJSON:`)

            let thisWS: WindowSet = {
              name: thisJSON.name ?? '(no name supplied)',
              closeOtherWindows: thisJSON.closeOtherWindows ?? false,
              editorWindows: thisJSON.editorWindows ?? [],
              htmlWindows: thisJSON.htmlWindows ?? [],
            }
            // clo(thisWS, `thisWS:`)
            windowSets.push(thisWS)
          }
        }
      }
      logDebug('readWindowSetDefinitions', `Read ${String(windowSets.length)} window sets`)
    } else {
      logInfo('readWindowSetDefinitions', `No Window Set definition files found in folder '${folderForDefinitions}'`)
    }
    return windowSets
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    return [] // for completeness
  }
}


//---------------------------------------------------------------
// WindowSet functions

/**
 * Get the detailed Window Set object for the passed window set name.
 * V2: reads from @WindowSets folder of files.
 * TEST: me.
 * @author @jgclark
 * @param {string} name of window set to look up
 * @returns {WindowSet | null} window set, if found, otherwise null
 */
function getDetailedWindowSetByName(name: string, folderForDefinitions: string): WindowSet | null {
  try {
    if (NotePlan.environment.platform !== 'macOS') {
      logWarn('logWindowSets', `Window Sets only runs on macOS. Stopping.`)
      return null
    }

    const windowSets = readWindowSetDefinitions(folderForDefinitions)
    if (!windowSets) {
      logInfo('logWindowSets', `No saved windowSets object found.`)
      return null
    }
    for (const set of windowSets) {
      if (set.name === name) {
        logDebug('logWindowSets', `Found saved windowSet '${name}'.`)
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
 * V2: reads from @WindowSets folder of files.
 * @author @jgclark
 */
export async function logWindowSets(): Promise<void> {
  try {
    if (NotePlan.environment.platform !== 'macOS') {
      logWarn('logWindowSets', `Window Sets only runs on macOS. Stopping.`)
      return
    }
    const config = await getPluginSettings()

    const windowSets = readWindowSetDefinitions(config.folderForDefinitions)
    if (!windowSets) {
      logInfo('logWindowSets', `No saved windowSets object found.`)
      return
    }
    const outputLines = []
    outputLines.push(`Window Sets:`)
    for (const set of windowSets) {
      let c = 0
      outputLines.push(`${set.name}:`)
      if (set.editorWindows) {
        for (const ws of set.editorWindows) {
          outputLines.push(`- ${String(c)}: ${ws.noteType}: title:'${ws.title ?? ''}' filename:${ws.filename ?? ''} x:${ws.x ?? '-'} y:${ws.y ?? '-'} w:${ws.width ?? '-'} h:${ws.height ?? '-'}`)
          c++
        }
      } else {
        logInfo('logWindowSets', `WindowSet #${String(c)} has no editorWindows array`)
      }
      if (set.htmlWindows) {
        for (const ws of set.htmlWindows) {
          outputLines.push(`- ${String(c)}: ${ws.type}: customId:'${ws.customId ?? ''}' plugin.id:${ws.pluginID ?? '?'} x:${ws.x ?? '-'} y:${ws.y ?? '-'} w:${ws.width ?? '-'} h:${ws.height ?? '-'}`)
          c++
        }
      } else {
        logInfo('logWindowSets', `WindowSet #${String(c)} has no htmlWindows array`)
      }
    }
    // logDebug('', String(outputLines))
    logInfo('logWindowSets', (outputLines.length > 0) ? outputLines.join('\n') : '**none**')
  }
  catch (error) {
    logError('logWindowSets', JSP(error))
  }
}

/**
 * Save detailed set of windows/panes as a set to the preference store for the current device.
 * V2: reads from @WindowSets folder of files.
 * @author @jgclark
 */
export async function saveWindowSet(): Promise<void> {
  try {
    const config = await getPluginSettings()

    if (NotePlan.environment.platform !== 'macOS') {
      logInfo('saveWindowSet', `Window Sets needs NotePlan v3.9.1 or later on macOS. Stopping.`)
      return
    }
    // Form this set from open windows
    // Note: needs to use a cut-down set of attributes available in the window objects
    const editorWinDetails: Array<EditorWinDetails> = NotePlan.editors.map((win) => {
      const winRect = win.windowRect
      return {
        noteType: win.type,
        openAction: '', // set later
        filename: win.filename,
        title: undefined, // potentially gets defined later
        x: winRect.x,
        y: winRect.y,
        width: winRect.width,
        height: winRect.height,
      }
    })
    // logDebug('saveWindowSet', `Found ${String(editorWinDetails.length)} editor windows`)

    const htmlWinDetails: Array<HTMLWinDetails> = NotePlan.htmlWindows.map((win) => {
      const winRect = win.windowRect
      return {
        type: win.type,
        pluginID: '???', // gets set later
        pluginCommand: '???', // gets set later
        customId: win.customId,
        x: winRect.x,
        y: winRect.y,
        width: winRect.width,
        height: winRect.height,
      }
    })
    // logDebug('saveWindowSet', `Found ${String(htmlWinDetails.length)} HTML windows`)

    if ((editorWinDetails.length + htmlWinDetails.length) < 2) {
      const answer = await showMessageYesNo("There's only 1 open window. Are you sure you want to continue to make a Window Set?")
      if (answer === 'No') {
        return
      }
    }

    // Get current saved set names
    const savedWindowSets: Array<WindowSet> = readWindowSetDefinitions(config.folderForDefinitions) ?? []
    let choice = 0
    let setName = ''
    let isNewSet = false
    let windowSets: Array<WindowSet> = []

    // Offer current set names and/or offer to create new one
    if (savedWindowSets) {
      logDebug('saveWindowSet', `found ${String(savedWindowSets.length)} windowSets`)
      const nameOptions: Array<Object> = []
      nameOptions.push({ value: 0, label: "+ New window set" })
      for (let i = 0; i < savedWindowSets.length; i++) {
        const thisWindowSet = savedWindowSets[i]
        nameOptions.push({ value: i + 1, label: thisWindowSet.name })
      }
      const res = await chooseOption('Enter new window set name, or which one to update', nameOptions, 0)
      if (typeof res === 'boolean' && !res) {
        logInfo('saveWindowSet', `User cancelled operation: ${res}.`)
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
        logDebug('saveWindowSet', `User selected existing WS '${setName}'`)
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
    let thisWSToSave: WindowSet = {
      name: setName,
      closeOtherWindows: true,
      editorWindows: [],
      htmlWindows: [],
    }

    // First process Editor windows
    let ewCount = 0
    const firstWindow = editorWinDetails[0]
    for (const ew of editorWinDetails) {
      let tempFilename = ''
      const thisNote = DataStore.projectNoteByFilename(ew.filename)
      let tempTitle = displayTitle(thisNote)

      // Check to see if any editor windows are calendar dates
      if (ew.noteType === 'Calendar') {
        // Offer to make them a relative date to today/this week etc.
        // Turn this into a daily date at start of period
        const thisDateStr = getISODateStringFromYYYYMMDD(getDateStringFromCalendarFilename(ew.filename))
        // const thisDateStr = getISODateStringFromYYYYMMDD(getDateStrForStartofPeriodFromCalendarFilename(ew.filename))
        // Get number of days between today and the calendar filename
        logDebug('getDateStringFromCalendarFilename(ew.filename)', getDateStringFromCalendarFilename(ew.filename)) // 2023-W36
        logDebug('thisDateStr', thisDateStr) // FIXME: error
        // const daysDiff = daysBetween(getTodaysDateHyphenated(), thisDateStr)
        // logDebug('daysDiff', String(daysDiff))

        const relativeDateStr = `{${relativeDateCodeFromDateString(thisDateStr)}}`
        logDebug('relativeDateStr', relativeDateStr)
        const res = await showMessageYesNoCancel(`Open window '${thisDateStr}' is a calendar note. Do you want to make it a relative date '${relativeDateStr}'?`)
        if (res === 'Yes') {
          tempFilename = relativeDateStr
          tempTitle = `relative date ${relativeDateStr}` // TODO: make proper relative name
        } else if (res === 'No') {
          tempFilename = ew.filename
          // title from calendar note already set
        } else if (res === 'Cancel') {
          logInfo('saveWindowSet', `User cancelled operation.`)
          return
        }
      } else {
        // A project note: nothing particular to do
      }
    // Get type of window by looking at the second open window (the first always being 'main')

      // Note: API docs say Editor.type can be main | split | floating | unsupported
      // FIXME(Eduard): but I'm only getting Notes | Calendar
      // const actionType = (editorWinDetails.length > 1 && editorWinDetails[1].type === 'split') ? 'split' : 'floating'

      // TODO(later): remove this workaround
      let actionType = 'floating'
      if (ewCount === 0) {
        actionType = 'main'
      } else {
        if (ew.x === firstWindow.x && ew.y === firstWindow.y && ew.width === firstWindow.width && ew.height === firstWindow.height) {
          actionType = 'split'
        }
      }
      // Save other details
      let thisEWToSave: EditorWinDetails = {
        noteType: ew.noteType,
        x: ew.x,
        y: ew.y,
        width: ew.width,
        height: ew.height,
        openAction: actionType,
        filename: tempFilename,
      }
      if (tempTitle) {
        thisEWToSave.title = tempTitle
      }
      clo(thisWSToSave, 'thisWSToSave')
      thisWSToSave.editorWindows.push(thisEWToSave)
      ewCount++
    }

    // Now process HTML windows
    // Currently works from lookup list defined at top
    for (const thisHtmlWinDetails of htmlWinDetails) {
      const thisWindowId = thisHtmlWinDetails.customId ?? 'n/a'
      logDebug('saveWindowSet', `for thisHtmlWinDetails: ${thisWindowId}`)
      const thisPWAC = pluginWindowsAndCommands.filter((p) => thisWindowId === p.pluginWindowId)
      const thisHWPluginID = (thisPWAC)
        ? thisHtmlWinDetails.pluginID : '? needs to be set from plugin'
      const thisHWPluginCommand = (thisPWAC)
        ? thisHtmlWinDetails.pluginCommand : '? needs to be set from ' + thisWindowId
      const thisHWToSave = {
        type: thisHtmlWinDetails.type,
        pluginID: thisHWPluginID,
        pluginCommand: thisHWPluginCommand,
        customId: thisHtmlWinDetails.customId,
        x: thisHtmlWinDetails.x,
        y: thisHtmlWinDetails.y,
        width: thisHtmlWinDetails.width,
        height: thisHtmlWinDetails.height,
      }
      clo(thisHWToSave, 'thisHWToSave')
      thisWSToSave.htmlWindows.push(thisHWToSave)
    }

    // Save to preferences store
    // Add or update this WS
    // if (isNewSet) {
    //   // Add this one
    //   windowSets.push(thisWSToSave)
    // } else {
    //   let c = 0
    //   let found = false
    //   for (const set of windowSets) {
    //     clo(set, 'set')
    //     if (set.name === setName) {
    //       // Update this one
    //       windowSets[c] = thisWSToSave
    //       found = true
    //       break
    //     }
    //     c++
    //   }
    // }
    // clo(windowSets, 'windowSets')
    // DataStore.setPreference('windowSets', windowSets)

    // Save to WS note
    // Add or update this WS
    const WSNoteTitle = `Window Sets`
    let res = false
    if (isNewSet) {
      // Prepend to WS note
      logDebug('saveWindowSet', `About to prepend window set '${setName}' to WindowSet note ...`)
      res = await writeWSToNote('insert', config.folderForDefinitions, WSNoteTitle, thisWSToSave)
    } else {
      // Replace in WS note
      // FIXME: fails for existing note, as 'setName' undefined
      logDebug('saveWindowSet', `About to replace window set '${setName}' in WindowSet note ...`)
      res = await writeWSToNote('update', config.folderForDefinitions, WSNoteTitle, thisWSToSave)
    }
    // Report success/failure
    if (res) {
      logDebug('saveWindowSet', `Saved window set '${setName}' to WindowSet note`)
    } else {
      logError('saveWindowSet', `Failed to save window set '${setName}' to WindowSet note`)
    }
  } catch (error) {
    logError('saveWindowSet', JSP(error))
  }
}

/**
 * Write the supplied WindowSet to the specified NP note, either 'insert'ing or 'update'ing
 * @param {string} operation: 'insert' or 'update'
 * @param {string} noteTitle to write to
 * @param {WindowSet} thisWSToSave
 * @returns
 */
export async function writeWSToNote(operation: string, noteFolder: string, noteTitle: string, thisWSToSave: WindowSet): Promise<boolean> {
  try {
    logDebug(pluginJson, `writeWSToNote() starting '${operation}' for '${thisWSToSave.name}' to folder '${noteFolder}' title '${noteTitle}'`)
    const WSNote: ?TNote = await getOrMakeNote(noteTitle, noteFolder)
    if (!WSNote) {
      throw new Error(`writeWSToNote() no note found for '${noteTitle}' in folder '${noteFolder}'`)
    }
    logDebug('writeWSToNote', `- ${displayTitle(WSNote)} / ${noteTitle}`)

    // Make string from WindowSet object
    const thisWindowSetStr = JSON.stringify(thisWSToSave, null, 2)
    // logDebug('writeWSToNote', `writeWSToNote() thisWindowSetStr:\n${thisWindowSetStr}`)
    // Add or update to note
    let res = false
    if (operation === 'update') {
      res = updateCodeBlock(WSNote, thisWindowSetStr, 'json')
    }
    else {
      res = addCodeBlock(WSNote, thisWindowSetStr, 'json')
    }

    return res
  } catch (error) {
    logError(pluginJson, `writeWSToNote: ${error.message}`)
    return false
  }
}

/**
 * Open the saved window set named 'setName'
 * V2: reads from @WindowSets folder of files
 * Note: minimum version v3.9.5
 * @author @jgclark
 * @param {string?} setName to open; if not given, will ask user
 * @returns {boolean} success?
 */
export async function openWindowSet(setName: string = ''): Promise<boolean> {
  try {
    if (NotePlan.environment.platform !== 'macOS') {
      logInfo('saveWindowSet', `Window Sets only runs on macOS. Stopping.`)
      return false
    }

    const config = await getPluginSettings()
    let success = false
    let thisWS: WindowSet
    let res = false
    if (setName !== '') {
      res = getDetailedWindowSetByName(setName, config.folderForDefinitions)
    }
    if (res) {
      // Use this one
      thisWS = res
      logDebug('openWindowSet', `Request for window set '${setName}' by parameter`)
    }
    else {
      // Form list of window sets to choose from
      // Get all available windowSets
      const savedWindowSets = readWindowSetDefinitions(config.folderForDefinitions)
      if (!savedWindowSets) {
        logInfo('logWindowSets', `No saved windowSets object found.`)

        // TEST: Offer to make two default sets
        let res = await showMessageYesNoCancel(`There are no Window Set definitions in folder '${config.folderForDefinitions}'. Shall I add some example ones?`, ['Yes', 'No', 'Cancel'], "Window Sets")
        switch (res) {
          case 'Yes': {
            // create two default sets
            const filename1 = config.folderForDefinitions + '/Day + Week Window Sets.md'
            const n1 = await Editor.openNoteByFilename(filename1, false, 0, 0, false, true, exampleContent1)
            const filename2 = config.folderForDefinitions + '/Staff Meeting.md'
            const n2 = await Editor.openNoteByFilename(filename1, false, 0, 0, true, true, exampleContent1)
            await showMessage(`Written 2 example Window Sets. Please run the command again to try them out.`)
            return false
          }
          case 'No': {
            break
          }
          case 'Cancel': {
            // Stop execution
            logDebug(pluginJson, `User cancelled operation.`)
            return false
          }
        }
      }
      // clo(savedWindowSets, 'savedWindowSets')

      let c = -1
      const setChoices = savedWindowSets.map((sws) => {
        c++
        return { label: `${sws.name} (with ${String(sws.editorWindows?.length ?? 0)} windows)`, value: c }
      })
      const num = await chooseOption("Which Window Set to open?", setChoices)
      logDebug(pluginJson, `${String(num)}, ${typeof num}`)
      if (isNaN(num)) {
        logInfo(pluginJson, `No valid set chosen, so stopping.`)
        return false
      }
      thisWS = savedWindowSets[num]
      const setName = thisWS.name
      logDebug('openWindowSet', `User requests window set '${setName}'`)
    }

    clo(thisWS)

    // First close other windows (if requested)
    if (thisWS.closeOtherWindows) {
      // logDebug('openWindowSet', `Attempting to close any other windows that aren't part of the set`)

      // Get list of currently open windows
      const openWindowIds = getNonMainWindowIds()
      for (const winId of openWindowIds) {
        // logDebug('openWindowSet', `Attempting to close window ID ${winId}`)
        closeWindowFromId(winId)
      }
    }

    // Now open new windows/splits
    let openCount = 0
    // First any HTMLWindows (currently just plugins)
    for (const hw of thisWS.htmlWindows) {
      switch (hw.type) {
        case 'Plugin': {
          logDebug('openWindowSet', `- Calling Plugin '${hw.pluginID}::${hw.pluginCommand}'  ...`)
          await DataStore.invokePluginCommandByName(hw.pluginCommand, hw.pluginID)
          // If x,y,w,h given the override now
          if (hw.x && hw.y && hw.width && hw.height) {
            const rect = { x: hw.x, y: hw.y, width: hw.width, height: hw.height }
            logDebug('openWindowSet', `- applying Rect definition ${rectToString(rect)} to ${thisWS.name}`)
            applyRectToWindow(rect, hw.customId)
          }
          break
        }
        default: {
          logError('openWindowSet', `- WS '${thisWS.name}' is empty`)
        }
      }
    }

    for (const ew of thisWS.editorWindows) {
      if (ew.filename === '') {
        logError('openWindowSet', `- WS '${thisWS.name}' has an empty Editor filename: ignoring.`)
        continue
      }

      let resourceToOpen = ew.filename
      logDebug('openWindowSet', `- trying note filename '${ew.filename}' with openAction ${ew.openAction}`)
      if (ew.openAction === 'floating') {
        // Open in a full window pane
        switch (ew.noteType) {
          case 'Calendar': {
            // if this is a relative date, calculate the actual date
            if (resourceToOpen.match(RE_OFFSET_DATE)) {
              const dateOffsetStrings = resourceToOpen.match(RE_OFFSET_DATE_CAPTURE) ?? ['']
              logDebug('dateOffsetStrings', String(dateOffsetStrings))
              const dateOffsetString = dateOffsetStrings[1] // first capture group
              logDebug('dateOffsetString', dateOffsetString)
              resourceToOpen = calcOffsetDateStr(getTodaysDateHyphenated(), dateOffsetString, 'offset')
              logDebug('resourceToOpen', resourceToOpen)
            }
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
      } else if (ew.openAction === 'split') {
        // Open in a split window
        switch (ew.noteType) {
          case 'Calendar': {
            // if this is a relative date, calculate the actual date
            if (resourceToOpen.match(RE_OFFSET_DATE)) {
              const dateOffsetStrings = resourceToOpen.match(RE_OFFSET_DATE_CAPTURE) ?? ['']
              logDebug('dateOffsetStrings', String(dateOffsetStrings))
              const dateOffsetString = dateOffsetStrings[1] // first capture group
              logDebug('dateOffsetString', dateOffsetString)
              resourceToOpen = calcOffsetDateStr(getTodaysDateHyphenated(), dateOffsetString, 'offset')
              logDebug('resourceToOpen', resourceToOpen)
            }
            const res = await Editor.openNoteByDateString(resourceToOpen, false, 0, 0, true)
            openCount++
            break
          }
          default: { // 'Note'
            const res = await Editor.openNoteByFilename(resourceToOpen, false, 0, 0, (openCount > 0), false)
            openCount++
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
    logInfo('deleteWindowSet', `You have asked to delete window set #${num}`)

    // Delete this window set, and save back to preferences store
    windowSets.splice(num, 1)
    DataStore.setPreference('windowSets', windowSets)
    logDebug('deleteWindowSet', `Window set '${setName}'`)
    logWindowSets()

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
export function deleteAllSavedWindowSets(): void {
  try {
    unsetPreference('windowSets')
    logInfo('deleteAllSavedWindowSets', `Deleted all Window Sets`)
  }
  catch (error) {
    logError('deleteAllSavedWindowSets', JSP(error))
  }
}
