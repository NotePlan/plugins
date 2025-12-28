// @flow
//--------------------------------------------------------------------------
// Request Handlers - Handle requests from React components
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { favoriteNotes, type FavoritesConfig } from './favorites'
import { getConfig } from './NPFavorites'
import { getFrontmatterNotes } from '@helpers/NPFrontMatter'
import { getNoteDecoration } from '@helpers/NPnote'
import { getFolderFromFilename, getFolderDisplayName } from '@helpers/folders'
import { getPluginJson } from '@helpers/NPConfiguration'
import { logDebug, logError, JSP } from '@helpers/dev'
import { type RequestResponse } from './routerUtils'

/**
 * Handle request to get favorite notes
 * @param {Object} requestData - Request data
 * @returns {Promise<RequestResponse>}
 */
export async function handleGetFavoriteNotes(requestData: Object): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleGetFavoriteNotes: ENTRY`)
    const config = await getConfig()

    // Get all notes with frontmatter
    const notesWithFM = getFrontmatterNotes() // not including template notes
    const notesWithStars = DataStore.projectNotes.filter((note) => note.title?.includes(config.favoriteIcon))
    const combinedNotes = [...notesWithFM, ...notesWithStars]
    const nonDuplicateNotes = combinedNotes.filter((note, index, self) => self.findIndex((t) => t.filename === note.filename) === index)
    const faveNotes = favoriteNotes(nonDuplicateNotes, config)

    // Format notes for React component
    const formattedNotes = faveNotes.map((note) => {
      const decoration = getNoteDecoration(note)
      const folder = getFolderFromFilename(note.filename) || '/'
      const folderDisplay = getFolderDisplayName(folder) || folder

      return {
        filename: note.filename,
        title: note.title || '',
        type: note.type || 'Notes',
        frontmatterAttributes: note.frontmatterAttributes || {},
        icon: decoration.icon,
        color: decoration.color,
        folder: folderDisplay,
      }
    })

    logDebug(pluginJson, `handleGetFavoriteNotes: Returning ${formattedNotes.length} favorite notes`)
    return {
      success: true,
      data: formattedNotes,
    }
  } catch (error) {
    logError(pluginJson, `handleGetFavoriteNotes: Error: ${JSP(error)}`)
    return {
      success: false,
      message: error.message || 'Failed to get favorite notes',
    }
  }
}

/**
 * Handle request to get favorite commands (presets)
 * @param {Object} requestData - Request data
 * @returns {Promise<RequestResponse>}
 */
export async function handleGetFavoriteCommands(requestData: Object): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleGetFavoriteCommands: ENTRY`)
    const livePluginJson = await getPluginJson(pluginJson['plugin.id'])

    // Get all preset commands (isPreset: true)
    const presetCommands = (livePluginJson.plugin.commands || [])
      .filter((cmd) => cmd.isPreset === true && cmd.name && !cmd.name.match(/^Favorites: Set Preset/))
      .map((cmd) => ({
        name: cmd.name || '',
        description: cmd.description || '',
        jsFunction: cmd.jsFunction || '',
        data: cmd.data || cmd.URL || '',
      }))

    logDebug(pluginJson, `handleGetFavoriteCommands: Returning ${presetCommands.length} favorite commands`)
    return {
      success: true,
      data: presetCommands,
    }
  } catch (error) {
    logError(pluginJson, `handleGetFavoriteCommands: Error: ${JSP(error)}`)
    return {
      success: false,
      message: error.message || 'Failed to get favorite commands',
    }
  }
}

/**
 * Handle request to open a note
 * @param {Object} requestData - Request data with filename, newWindow, splitView
 * @returns {Promise<RequestResponse>}
 */
export async function handleOpenNote(requestData: Object): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleOpenNote: ENTRY - filename="${requestData.filename}", newWindow=${String(requestData.newWindow)}, splitView=${String(requestData.splitView)}`)

    const { filename, newWindow = false, splitView = false } = requestData

    if (!filename) {
      return {
        success: false,
        message: 'Filename is required',
      }
    }

    // Use Editor.openNoteByFilename with options
    // Parameters: filename, newWindow, highlightStart, highlightEnd, splitView, createIfNeeded, content
    await Editor.openNoteByFilename(filename, newWindow, 0, 0, splitView, false, undefined)

    logDebug(pluginJson, `handleOpenNote: Successfully opened note`)
    return {
      success: true,
      data: { filename },
    }
  } catch (error) {
    logError(pluginJson, `handleOpenNote: Error: ${JSP(error)}`)
    return {
      success: false,
      message: error.message || 'Failed to open note',
    }
  }
}

/**
 * Handle request to run a command
 * @param {Object} requestData - Request data with jsFunction and data
 * @returns {Promise<RequestResponse>}
 */
export async function handleRunCommand(requestData: Object): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleRunCommand: ENTRY - jsFunction="${requestData.jsFunction}"`)

    const { jsFunction, data } = requestData

    if (!jsFunction) {
      return {
        success: false,
        message: 'jsFunction is required',
      }
    }

    // If data is a URL, open it
    if (data && typeof data === 'string' && (data.startsWith('http') || data.startsWith('noteplan://'))) {
      NotePlan.openURL(data)
      logDebug(pluginJson, `handleRunCommand: Opened URL: ${data}`)
    } else {
      // Otherwise, try to call the function if it exists
      logDebug(pluginJson, `handleRunCommand: Command function not directly callable, URL method used`)
    }

    return {
      success: true,
      data: { jsFunction },
    }
  } catch (error) {
    logError(pluginJson, `handleRunCommand: Error: ${JSP(error)}`)
    return {
      success: false,
      message: error.message || 'Failed to run command',
    }
  }
}

