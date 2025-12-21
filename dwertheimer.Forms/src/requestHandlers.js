// @flow

/**
 * Request Handlers for Forms Plugin
 *
 * This file contains handlers for request/response pattern communication from React to NotePlan.
 * Each handler should return a standardized response object with:
 * - success: boolean
 * - message: string (optional, for error messages or informational messages)
 * - data: any (the actual response data)
 *
 * @author @dwertheimer
 */

import pluginJson from '../plugin.json'
import { getAllNotesAsOptions, getRelativeNotesAsOptions } from './noteHelpers'
import { logDebug, logError, logInfo } from '@helpers/dev'
import { getFoldersMatching } from '@helpers/folders'
import { getAllTeamspaceIDsAndTitles } from '@helpers/NPTeamspace'
import { showMessage } from '@helpers/userInput'
import { getHeadingsFromNote } from '@helpers/NPnote'
import { getNoteByFilename } from '@helpers/note'

/**
 * Standardized response type for all request handlers
 */
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Test function to verify request handlers are working correctly
 * Call this from NotePlan Command Bar: "Test Request Handlers"
 * @returns {Promise<void>}
 */
export async function testRequestHandlers(): Promise<void> {
  try {
    logInfo(pluginJson, '🧪 Testing request handlers...')

    // Test getFolders
    logInfo(pluginJson, 'Testing getFolders...')
    const foldersResult = getFolders({ excludeTrash: true })
    logInfo(pluginJson, `getFolders: success=${String(foldersResult.success)}, folders=${foldersResult.data?.length ?? 0}`)
    if (foldersResult.data && foldersResult.data.length > 0) {
      logInfo(pluginJson, `First 3 folders: ${foldersResult.data.slice(0, 3).join(', ')}`)
    }

    // Test getNotes
    logInfo(pluginJson, 'Testing getNotes...')
    const notesResult = getNotes({ includeCalendarNotes: false })
    logInfo(pluginJson, `getNotes: success=${String(notesResult.success)}, notes=${notesResult.data?.length ?? 0}`)
    if (notesResult.data && notesResult.data.length > 0) {
      logInfo(
        pluginJson,
        `First 3 notes: ${notesResult.data
          .slice(0, 3)
          .map((n: any) => n.title || n.filename)
          .join(', ')}`,
      )
    }

    // Test getTeamspaces
    logInfo(pluginJson, 'Testing getTeamspaces...')
    const teamspacesResult = getTeamspaces({})
    logInfo(pluginJson, `getTeamspaces: success=${String(teamspacesResult.success)}, teamspaces=${teamspacesResult.data?.length ?? 0}`)
    if (teamspacesResult.data && teamspacesResult.data.length > 0) {
      logInfo(pluginJson, `Teamspaces: ${teamspacesResult.data.map((ts: any) => `${ts.title} (${ts.id})`).join(', ')}`)
    }

    logInfo(pluginJson, '✅ All request handlers tested successfully! Check Plugin Console for details.')
    await showMessage('Request handlers test complete! Check Plugin Console (NotePlan > Help > Plugin Console) for details.')
  } catch (error) {
    logError(pluginJson, `❌ Error testing request handlers: ${error.message}`)
    await showMessage(`Error testing request handlers: ${error.message}`)
  }
}

/**
 * Get list of folders (excluding trash)
 * @param {Object} params - Request parameters
 * @param {boolean} params.excludeTrash - Whether to exclude @Trash folder (default: true)
 * @returns {RequestResponse}
 */
export function getFolders(params: { excludeTrash?: boolean } = {}): RequestResponse {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[DIAG] getFolders START: excludeTrash=${String(params.excludeTrash ?? true)}`)

    const excludeTrash = params.excludeTrash ?? true
    const exclusions = excludeTrash ? ['@Trash'] : []

    // Get all folders except exclusions. Include special folders (@Templates, @Archive, etc.) and teamspaces, sorted
    const foldersStartTime: number = Date.now()
    const folders = getFoldersMatching([], false, exclusions, false, true)
    const foldersElapsed: number = Date.now() - foldersStartTime
    logDebug(pluginJson, `[DIAG] getFolders getFoldersMatching: elapsed=${foldersElapsed}ms, found=${folders.length} folders`)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getFolders COMPLETE: totalElapsed=${totalElapsed}ms, found=${folders.length} folders`)

    if (folders.length === 0) {
      logInfo(pluginJson, `getFolders: No folders found, returning root folder only`)
      return {
        success: true,
        message: 'No folders found, returning root folder',
        data: ['/'],
      }
    }

    return {
      success: true,
      data: folders,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getFolders ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get folders: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get list of notes with filtering options
 * @param {Object} params - Request parameters
 * @param {boolean} params.includeCalendarNotes - Include calendar notes (default: false)
 * @param {boolean} params.includePersonalNotes - Include personal/project notes (default: true)
 * @param {boolean} params.includeRelativeNotes - Include relative notes like <today>, <thisweek>, etc. (default: false)
 * @param {boolean} params.includeTeamspaceNotes - Include teamspace notes (default: true)
 * @returns {RequestResponse}
 */
export function getNotes(
  params: {
    includeCalendarNotes?: boolean,
    includePersonalNotes?: boolean,
    includeRelativeNotes?: boolean,
    includeTeamspaceNotes?: boolean,
  } = {},
): RequestResponse {
  const startTime: number = Date.now()
  try {
    const includeCalendarNotes = params.includeCalendarNotes ?? false
    const includePersonalNotes = params.includePersonalNotes ?? true
    const includeRelativeNotes = params.includeRelativeNotes ?? false
    const includeTeamspaceNotes = params.includeTeamspaceNotes ?? true

    logDebug(
      pluginJson,
      `[DIAG] getNotes START: includeCalendarNotes=${String(includeCalendarNotes)}, includePersonalNotes=${String(includePersonalNotes)}, includeRelativeNotes=${String(
        includeRelativeNotes,
      )}, includeTeamspaceNotes=${String(includeTeamspaceNotes)}`,
    )

    const allNotes: Array<any> = []

    // Get project notes and calendar notes separately, then filter
    const processStartTime: number = Date.now()

    // Get project notes (personal notes)
    if (includePersonalNotes) {
      const projectNotes = getAllNotesAsOptions(false, true) // Don't include calendar notes here
      const processElapsed: number = Date.now() - processStartTime
      logDebug(pluginJson, `[DIAG] getNotes PROJECT: elapsed=${processElapsed}ms, found=${projectNotes.length} project notes`)

      // Filter teamspace notes if needed
      for (const note of projectNotes) {
        const isTeamspaceNote = note.isTeamspaceNote === true
        if (includeTeamspaceNotes || !isTeamspaceNote) {
          allNotes.push(note)
        }
      }
      logDebug(pluginJson, `[DIAG] getNotes PROJECT FILTERED: ${allNotes.length} personal notes after teamspace filter`)
    }

    // Get calendar notes if requested
    if (includeCalendarNotes) {
      const calendarStartTime: number = Date.now()
      const calendarNotes = getAllNotesAsOptions(true, true) // Include calendar notes
      const calendarElapsed: number = Date.now() - calendarStartTime
      logDebug(pluginJson, `[DIAG] getNotes CALENDAR: elapsed=${calendarElapsed}ms, found=${calendarNotes.length} calendar notes`)

      // Filter teamspace notes if needed, and only include calendar notes (not project notes)
      for (const note of calendarNotes) {
        const isCalendarNote = note.type === 'Calendar'
        const isTeamspaceNote = note.isTeamspaceNote === true

        // Only include if it's actually a calendar note (not a project note that got mixed in)
        if (isCalendarNote) {
          if (includeTeamspaceNotes || !isTeamspaceNote) {
            allNotes.push(note)
          }
        }
      }
      logDebug(pluginJson, `[DIAG] getNotes CALENDAR FILTERED: ${allNotes.length} total notes after calendar filter`)
    }

    logDebug(pluginJson, `[DIAG] getNotes FILTERED: ${allNotes.length} notes after filtering`)

    // Get relative notes (like <today>, <thisweek>, etc.)
    if (includeRelativeNotes) {
      const processStartTime: number = Date.now()
      const relativeNotes = getRelativeNotesAsOptions(true) // Include decoration
      const processElapsed: number = Date.now() - processStartTime
      logDebug(pluginJson, `[DIAG] getNotes RELATIVE: elapsed=${processElapsed}ms, found=${relativeNotes.length} relative notes`)
      allNotes.push(...relativeNotes)
    }

    // Re-sort all notes together by changedDate (most recent first), but put relative notes at the top
    allNotes.sort((a: any, b: any) => {
      // Relative notes (those with filename starting with '<') should appear first
      const aIsRelative = typeof a.filename === 'string' && a.filename.startsWith('<')
      const bIsRelative = typeof b.filename === 'string' && b.filename.startsWith('<')

      if (aIsRelative && !bIsRelative) return -1
      if (!aIsRelative && bIsRelative) return 1

      // For non-relative notes, sort by changedDate (most recent first)
      const aDate = typeof a.changedDate === 'number' ? a.changedDate : 0
      const bDate = typeof b.changedDate === 'number' ? b.changedDate : 0
      return bDate - aDate
    })

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getNotes COMPLETE: totalElapsed=${totalElapsed}ms, found=${allNotes.length} total notes`)

    return {
      success: true,
      data: allNotes,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getNotes ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get notes: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get teamspace definitions for folder decoration
 * @param {Object} params - Request parameters (currently unused)
 * @returns {RequestResponse}
 */
export function getTeamspaces(_params: Object = {}): RequestResponse {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[DIAG] getTeamspaces START`)

    const teamspacesStartTime: number = Date.now()
    const teamspaces = getAllTeamspaceIDsAndTitles()
    const teamspacesElapsed: number = Date.now() - teamspacesStartTime
    logDebug(pluginJson, `[DIAG] getTeamspaces getAllTeamspaceIDsAndTitles: elapsed=${teamspacesElapsed}ms, found=${teamspaces.length} teamspaces`)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getTeamspaces COMPLETE: totalElapsed=${totalElapsed}ms, found=${teamspaces.length} teamspaces`)

    return {
      success: true,
      data: teamspaces,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getTeamspaces ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get teamspaces: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Create a new folder
 * @param {Object} params - Request parameters
 * @param {string} params.folderPath - Full path of the folder to create (e.g., '/Projects/NewProject' or 'NewFolder')
 * @returns {RequestResponse}
 */
export function createFolder(params: { folderPath: string }): RequestResponse {
  try {
    logDebug(pluginJson, `createFolder: Creating folder="${params.folderPath}"`)

    if (!params.folderPath || !params.folderPath.trim()) {
      return {
        success: false,
        message: 'Folder path is required',
        data: null,
      }
    }

    const folderPath = params.folderPath.trim()

    // Check if folder already exists
    const existingFolders = DataStore.folders || []
    if (existingFolders.includes(folderPath)) {
      logDebug(pluginJson, `createFolder: Folder already exists: "${folderPath}"`)
      return {
        success: true,
        message: 'Folder already exists',
        data: folderPath,
      }
    }

    // Create the folder
    DataStore.createFolder(folderPath)

    logDebug(pluginJson, `createFolder: Successfully created folder: "${folderPath}"`)

    return {
      success: true,
      data: folderPath,
    }
  } catch (error) {
    logError(pluginJson, `createFolder: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to create folder: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get headings from a note
 * @param {Object} params - Request parameters
 * @param {string} params.noteFilename - Filename of the note to get headings from
 * @param {boolean} params.optionAddTopAndBottom - Whether to add "top of note" and "bottom of note" options (default: true)
 * @param {boolean} params.includeArchive - Whether to include headings in Archive section (default: false)
 * @returns {RequestResponse}
 */
export function getHeadings(params: { noteFilename: string, optionAddTopAndBottom?: boolean, includeArchive?: boolean }): RequestResponse {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[DIAG] getHeadings START: noteFilename="${params.noteFilename}"`)

    if (!params.noteFilename) {
      return {
        success: false,
        message: 'Note filename is required',
        data: null,
      }
    }

    // Get the note by filename
    const note = getNoteByFilename(params.noteFilename)
    if (!note) {
      return {
        success: false,
        message: `Note not found: ${params.noteFilename}`,
        data: null,
      }
    }

    // Get headings from the note
    const optionAddTopAndBottom = params.optionAddTopAndBottom ?? true
    const includeArchive = params.includeArchive ?? false
    const headings = getHeadingsFromNote(note, false, optionAddTopAndBottom, false, includeArchive)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getHeadings COMPLETE: totalElapsed=${totalElapsed}ms, found=${headings.length} headings`)

    return {
      success: true,
      data: headings,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getHeadings ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get headings: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Router function to handle requests from React
 * @param {string} requestType - The type of request (e.g., 'getFolders', 'getNotes', 'createFolder')
 * @param {Object} params - Request parameters
 * @returns {Promise<RequestResponse>}
 */
export function handleRequest(requestType: string, params: Object = {}): RequestResponse {
  try {
    logDebug(pluginJson, `handleRequest: requestType="${requestType}", params=${JSON.stringify(params)}`)

    switch (requestType) {
      case 'getFolders':
        return getFolders(params)
      case 'getNotes':
        return getNotes(params)
      case 'getTeamspaces':
        return getTeamspaces(params)
      case 'createFolder':
        return createFolder(params)
      case 'getHeadings':
        return getHeadings(params)
      default:
        logError(pluginJson, `handleRequest: Unknown request type: "${requestType}"`)
        return {
          success: false,
          message: `Unknown request type: "${requestType}"`,
          data: null,
        }
    }
  } catch (error) {
    logError(pluginJson, `handleRequest: Error handling request "${requestType}": ${error.message}`)
    return {
      success: false,
      message: `Error handling request: ${error.message}`,
      data: null,
    }
  }
}
