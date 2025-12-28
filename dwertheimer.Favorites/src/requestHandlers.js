// @flow
//--------------------------------------------------------------------------
// Request Handlers - Handle requests from React components
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { favoriteNotes, type FavoritesConfig } from './favorites'
import { getConfig } from './NPFavorites'
import { type RequestResponse } from './routerUtils'
import { getFrontmatterNotes } from '@helpers/NPFrontMatter'
import { getNoteDecoration } from '@helpers/NPnote'
import { getFolderFromFilename, getFolderDisplayName } from '@helpers/folders'
import { getPluginJson } from '@helpers/NPConfiguration'
import { logDebug, logError, JSP } from '@helpers/dev'

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

    if (!livePluginJson) {
      logError(pluginJson, `handleGetFavoriteCommands: getPluginJson returned null/undefined`)
      return {
        success: false,
        message: 'Failed to load plugin configuration',
      }
    }

    // plugin.json uses flat keys like 'plugin.commands', not nested objects
    const commands = livePluginJson['plugin.commands'] || []
    logDebug(pluginJson, `handleGetFavoriteCommands: Found ${commands.length} total commands`)

    const presetCommands = commands
      .filter((cmd) => cmd.isPreset === true && cmd.name && !cmd.name.match(/^Favorites: Set Preset/))
      .map((cmd) => {
        // Strip leading dashes and whitespace from names for display
        const displayName = (cmd.name || '').replace(/^[-]\s*/, '')
        return {
          name: displayName,
          description: cmd.description || '',
          jsFunction: cmd.jsFunction || '',
          data: cmd.data || cmd.URL || '',
        }
      })

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
    // Note: Editor.openNoteByFilename may not return a Promise, so we call it directly
    const note = Editor.openNoteByFilename(filename, newWindow, 0, 0, splitView, false, undefined)

    if (note) {
      logDebug(pluginJson, `handleOpenNote: Successfully opened note "${filename}"`)
      return {
        success: true,
        data: { filename },
      }
    } else {
      logError(pluginJson, `handleOpenNote: Editor.openNoteByFilename returned null/undefined for "${filename}"`)
      return {
        success: false,
        message: `Failed to open note: "${filename}". Note may not exist.`,
      }
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

/**
 * Handle request to add a favorite note
 * @param {Object} requestData - Request data with filename
 * @returns {Promise<RequestResponse>}
 */
export async function handleAddFavoriteNote(requestData: Object): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleAddFavoriteNote: ENTRY - filename="${requestData.filename}"`)

    const { filename } = requestData

    if (!filename) {
      return {
        success: false,
        message: 'Filename is required',
      }
    }

    // Find the note
    const note = DataStore.projectNoteByFilename(filename)
    if (!note) {
      return {
        success: false,
        message: `Note not found: "${filename}"`,
      }
    }

    // Check if already a favorite
    const config = await getConfig()
    const { setFavorite } = await import('./NPFavorites')

    // Check if already favorite
    const { noteIsFavorite } = await import('./favorites')
    if (noteIsFavorite(note, config)) {
      return {
        success: false,
        message: 'This note is already a favorite',
      }
    }

    // Open the note in editor and set it as favorite
    await Editor.openNoteByFilename(filename)
    await setFavorite()

    logDebug(pluginJson, `handleAddFavoriteNote: Successfully added favorite note`)
    return {
      success: true,
      data: { filename },
    }
  } catch (error) {
    logError(pluginJson, `handleAddFavoriteNote: Error: ${JSP(error)}`)
    return {
      success: false,
      message: error.message || 'Failed to add favorite note',
    }
  }
}

/**
 * Handle request to get preset commands for selection
 * @param {Object} requestData - Request data
 * @returns {Promise<RequestResponse>}
 */
export async function handleGetPresetCommands(requestData: Object): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleGetPresetCommands: ENTRY`)

    const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
    if (!livePluginJson || !livePluginJson['plugin.commands']) {
      return {
        success: false,
        message: 'Plugin configuration is missing plugin.commands',
      }
    }

    const commands = livePluginJson['plugin.commands']
    const presetCommands = commands.filter((command) => command.isPreset === true)

    // Map to options format for dropdown
    const options = presetCommands.map((command) => ({
      label: command.name || command.jsFunction,
      value: command.jsFunction,
    }))

    logDebug(pluginJson, `handleGetPresetCommands: Returning ${options.length} preset commands`)
    return {
      success: true,
      data: options,
    }
  } catch (error) {
    logError(pluginJson, `handleGetPresetCommands: Error: ${JSP(error)}`)
    return {
      success: false,
      message: error.message || 'Failed to get preset commands',
    }
  }
}

/**
 * Handle request to add/update a favorite command (preset)
 * @param {Object} requestData - Request data with jsFunction, name, and data (URL)
 * @returns {Promise<RequestResponse>}
 */
export async function handleAddFavoriteCommand(requestData: Object): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleAddFavoriteCommand: ENTRY - jsFunction="${requestData.jsFunction}", name="${requestData.name}"`)

    const { jsFunction, name, data: url } = requestData

    if (!jsFunction) {
      return {
        success: false,
        message: 'jsFunction is required',
      }
    }

    if (!name || !name.trim()) {
      return {
        success: false,
        message: 'Command name is required',
      }
    }

    if (!url || !url.trim()) {
      return {
        success: false,
        message: 'URL/X-Callback is required',
      }
    }

    // Validate URL
    const isValidURL = (url: string) => /^(https?|[a-z0-9\-]+):\/\/[a-z0-9\-]+/i.test(url)
    if (!isValidURL(url)) {
      return {
        success: false,
        message: `"${url}" is not a valid URL. Must be an X-Callback URL or full Web URL.`,
      }
    }

    // Get the command details from plugin.json
    const livePluginJson = await getPluginJson(pluginJson['plugin.id'])
    if (!livePluginJson || !livePluginJson['plugin.commands']) {
      return {
        success: false,
        message: 'Plugin configuration is missing plugin.commands',
      }
    }

    const commands = livePluginJson['plugin.commands']
    const command = commands.find((cmd) => cmd.jsFunction === jsFunction && cmd.isPreset === true)

    if (!command) {
      return {
        success: false,
        message: `Preset command not found: ${jsFunction}`,
      }
    }

    // Apply charsToPrepend if configured
    const config = DataStore.settings
    let commandName = name.trim()
    if (config.charsToPrepend) {
      commandName = `${config.charsToPrepend}${commandName}`
    }

    // Save the command using savePluginCommand
    const { savePluginCommand } = await import('@helpers/NPPresets')
    await savePluginCommand(pluginJson, { ...command, name: commandName, data: url })

    logDebug(pluginJson, `handleAddFavoriteCommand: Successfully saved preset command`)
    return {
      success: true,
      data: { jsFunction, name: commandName, data: url },
    }
  } catch (error) {
    logError(pluginJson, `handleAddFavoriteCommand: Error: ${JSP(error)}`)
    return {
      success: false,
      message: error.message || 'Failed to add favorite command',
    }
  }
}

/**
 * Handle request to get X-Callback URL using Link Creator
 * @param {Object} requestData - Request data with commandName and defaultValue
 * @returns {Promise<RequestResponse>}
 */
export async function handleGetCallbackURL(requestData: Object): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleGetCallbackURL: ENTRY`)

    const { commandName, defaultValue } = requestData

    // Call the Link Creator plugin
    const url = await DataStore.invokePluginCommandByName('Get X-Callback-URL', 'np.CallbackURLs', ['', true])

    if (url && typeof url === 'string') {
      logDebug(pluginJson, `handleGetCallbackURL: Successfully got URL from Link Creator`)
      return {
        success: true,
        data: { url },
      }
    } else {
      return {
        success: false,
        message: 'No URL returned from Link Creator',
      }
    }
  } catch (error) {
    logError(pluginJson, `handleGetCallbackURL: Error: ${JSP(error)}`)
    return {
      success: false,
      message: error.message || 'Failed to get callback URL',
    }
  }
}

/**
 * Handle request to get project notes for NoteChooser
 * @param {Object} requestData - Request data
 * @returns {Promise<RequestResponse>}
 */
export async function handleGetProjectNotes(requestData: Object): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleGetProjectNotes: ENTRY`)

    // Get all project notes (not calendar notes)
    const notes = DataStore.projectNotes.map((note) => ({
      title: note.title || '',
      filename: note.filename || '',
      type: note.type || 'Notes',
      frontmatterAttributes: note.frontmatterAttributes || {},
      changedDate: note.changedDate?.getTime() || 0,
    }))

    logDebug(pluginJson, `handleGetProjectNotes: Returning ${notes.length} project notes`)
    return {
      success: true,
      data: notes,
    }
  } catch (error) {
    logError(pluginJson, `handleGetProjectNotes: Error: ${JSP(error)}`)
    return {
      success: false,
      message: error.message || 'Failed to get project notes',
    }
  }
}
