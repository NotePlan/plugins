// @flow
//--------------------------------------------------------------------------
// Window Management Functions - Opening and managing React windows
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { type PassedData } from './shared/types.js'
import { FORMBUILDER_WINDOW_ID, WEBVIEW_WINDOW_ID } from './shared/constants.js'
import { loadTemplateBodyFromTemplate, loadTemplateRunnerArgsFromTemplate, loadCustomCSSFromTemplate, loadNewNoteFrontmatterFromTemplate } from './templateIO.js'
import { getFolders, getNotes, getTeamspaces, getMentions, getHashtags, getEvents } from './dataHandlers'
import { closeWindowFromCustomId } from '@helpers/NPWindows'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { logDebug, logError, timer, JSP, clo } from '@helpers/dev'
import { getNoteByFilename } from '@helpers/note'
import { showMessage } from '@helpers/userInput'
import { stripDoubleQuotes } from '@helpers/stringTransforms'
import { parseTeamspaceFilename } from '@helpers/teamspace'
import { getTeamspaceTitleFromID } from '@helpers/NPTeamspace'

// Re-export constants for backward compatibility with other back-end files
export { FORMBUILDER_WINDOW_ID, WEBVIEW_WINDOW_ID }

const REACT_WINDOW_TITLE = 'Form View'

/**
 * Generate a unique window ID for a form window by concatenating WEBVIEW_WINDOW_ID with the form title
 * This allows multiple form windows to be open simultaneously with different IDs
 * @param {string} formTitle - The title of the form (optional, defaults to empty string)
 * @returns {string} - The unique window ID
 */
export function getFormWindowId(formTitle?: string): string {
  const titleSuffix = formTitle && formTitle.trim() ? ` ${formTitle.trim()}` : ''
  return `${WEBVIEW_WINDOW_ID}${titleSuffix}`
}

/**
 * Generate a unique window ID for a Form Builder window by concatenating FORMBUILDER_WINDOW_ID with the template title/filename
 * This allows multiple Form Builder windows to be open simultaneously with different IDs
 * @param {string} templateTitle - The title of the template (optional, defaults to empty string)
 * @param {string} templateFilename - The filename of the template (optional, used as fallback if templateTitle not provided)
 * @returns {string} - The unique window ID
 */
export function getFormBuilderWindowId(templateTitle?: string, templateFilename?: string): string {
  const identifier = templateTitle && templateTitle.trim() ? templateTitle.trim() : templateFilename && templateFilename.trim() ? templateFilename.trim() : ''
  const suffix = identifier ? ` ${identifier}` : ''
  return `${FORMBUILDER_WINDOW_ID}${suffix}`
}

/**
 * Generate a unique window ID for a Form Browser window
 * This allows multiple Form Browser windows to be open simultaneously with different IDs
 * @param {string} identifier - Optional identifier to make the window unique (e.g., 'floating', 'main', or a custom identifier)
 * @returns {string} - The unique window ID
 */
export function getFormBrowserWindowId(identifier?: string): string {
  const suffix = identifier && identifier.trim() ? ` ${identifier.trim()}` : ''
  return `form-browser-window${suffix}`
}

/**
 * Find the window ID for a form window by looking at all open HTML windows
 * This is used when we receive a message from a window and need to find its ID
 * @param {string} formTitle - The title of the form (optional)
 * @returns {string | null} - The window ID if found, or null
 */
export function findFormWindowId(formTitle?: string): string | null {
  // If formTitle is provided, look for exact match first
  if (formTitle) {
    const expectedId = getFormWindowId(formTitle)
    for (const win of NotePlan.htmlWindows) {
      if (win.customId === expectedId) {
        return expectedId
      }
    }
  }

  // Look through all open HTML windows to find one that starts with WEBVIEW_WINDOW_ID
  // This handles cases where we don't know the form title but need to find any form window
  for (const win of NotePlan.htmlWindows) {
    if (win.customId && win.customId.startsWith(WEBVIEW_WINDOW_ID)) {
      logDebug(pluginJson, `findFormWindowId: Found window with ID "${win.customId}"`)
      return win.customId
    }
  }

  // If not found, try the base WEBVIEW_WINDOW_ID for backward compatibility
  for (const win of NotePlan.htmlWindows) {
    if (win.customId === WEBVIEW_WINDOW_ID) {
      return WEBVIEW_WINDOW_ID
    }
  }
  return null
}

/**
 * Parse window dimension value (can be number, percentage string, special position value, or undefined)
 * @param {string | number | void} value - The dimension value
 * @param {number} screenDimension - The screen dimension (width or height) for percentage calculation
 * @param {number} windowDimension - The window dimension (width or height) for position calculation
 * @param {string} positionType - 'x' or 'y' to determine which special values to handle
 * @returns {number | void} - Parsed pixel value or undefined
 */
export function parseWindowDimension(value: ?(number | string), screenDimension: number, windowDimension?: ?number, positionType?: 'x' | 'y'): ?number {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const trimmedValue = value.trim().toLowerCase()

    // Handle special position values (only for x and y positions)
    if (positionType && windowDimension !== null && windowDimension !== undefined) {
      if (trimmedValue === 'center') {
        // Center the window on the screen
        return Math.round((screenDimension - windowDimension) / 2)
      } else if (positionType === 'x') {
        if (trimmedValue === 'left') {
          return 0
        } else if (trimmedValue === 'right') {
          return Math.round(screenDimension - windowDimension)
        }
      } else if (positionType === 'y') {
        if (trimmedValue === 'top') {
          return 0
        } else if (trimmedValue === 'bottom') {
          return Math.round(screenDimension - windowDimension)
        }
      }
    }

    // Handle percentage values
    if (trimmedValue.endsWith('%')) {
      const percentage = parseFloat(trimmedValue)
      if (!isNaN(percentage)) {
        return Math.round((percentage / 100) * screenDimension)
      }
    } else {
      // Handle numeric values
      const numValue = parseInt(trimmedValue, 10)
      if (!isNaN(numValue)) {
        return numValue
      }
    }
  }
  return undefined
}

/**
 * Gathers key data for the React Window, including the callback function that is used for comms back to the plugin
 * @returns {PassedData} the React Data Window object
 */
export async function createWindowInitData(argObj: Object): Promise<PassedData> {
  const startTime = new Date()
  logDebug(pluginJson, `createWindowInitData: ENTRY - argObj keys: ${Object.keys(argObj || {}).join(', ')}`)
  // get whatever pluginData you want the React window to start with and include it in the object below. This all gets passed to the React window
  const pluginData = await getPluginData(argObj)
  const foldersArray = Array.isArray(pluginData.folders) ? pluginData.folders : []
  logDebug(pluginJson, `createWindowInitData: After getPluginData - folders.length=${foldersArray.length}`)
  const ENV_MODE = 'development' /* helps during development. set to 'production' when ready to release */
  const formTitle = argObj?.formTitle || ''
  const templateTitle = argObj?.templateTitle || formTitle || ''
  const templateFilename = argObj?.templateFilename || ''
  logDebug(pluginJson, `createWindowInitData: templateFilename="${templateFilename}", templateTitle="${templateTitle}", formTitle="${formTitle}"`)
  // Use unique windowId if provided (from openFormWindow with random suffix), otherwise generate base windowId
  // This ensures windowId in pluginData matches the actual window customId (which may have random suffix for uniqueness)
  const windowId = argObj?.uniqueWindowId || getFormWindowId(argObj?.formTitle || argObj?.windowTitle || '')

  // Generate launchLink URL if we have a template title
  let launchLink = ''
  if (templateTitle) {
    const encodedTitle = encodeURIComponent(templateTitle)
    launchLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=${encodedTitle}`
  }

  const dataToPass: PassedData = {
    pluginData: {
      ...pluginData,
      windowId: windowId, // Store window ID in pluginData so we can retrieve it later
      formTitle: formTitle, // Store form title for window ID reconstruction
      templateTitle: templateTitle, // Store template title for URL generation
      templateFilename: templateFilename, // Store template filename for autosave
      launchLink: launchLink, // Store launchLink for Form URL button
      defaultValues: argObj?.defaultValues || {}, // Store default values for form pre-population
    },
    title: formTitle || REACT_WINDOW_TITLE,
    width: argObj?.width,
    height: argObj?.height,
    logProfilingMessage: false,
    debug: false,
    ENV_MODE,
    returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFormSubmitFromHTMLView' },
    /* change the ID below to your plugin ID */
    componentPath: `../dwertheimer.Forms/react.c.FormView.bundle.dev.js`,
    startTime,
  }
  return dataToPass
}

/**
 * Detect which chooser types are needed based on form fields
 * @param {Array<Object>} formFields - The form fields to analyze
 * @returns {Object} Object with boolean flags for each chooser type
 */
function detectFieldRequirements(formFields: Array<Object>): {
  needsFolders: boolean,
  needsNotes: boolean,
  needsSpaces: boolean,
  needsMentions: boolean,
  needsHashtags: boolean,
  needsEvents: boolean,
  frontmatterKeys: Array<string>, // Array of unique frontmatter keys to preload
} {
  // Collect unique frontmatter keys from frontmatter-key-chooser fields
  const frontmatterKeys = new Set<string>()
  formFields.forEach((field) => {
    if (field.type === 'frontmatter-key-chooser' && field.frontmatterKey) {
      frontmatterKeys.add(field.frontmatterKey)
    }
  })

  return {
    needsFolders: formFields.some((field) => field.type === 'folder-chooser'),
    needsNotes: formFields.some((field) => field.type === 'note-chooser'),
    needsSpaces: formFields.some((field) => field.type === 'space-chooser' || field.type === 'folder-chooser'),
    needsMentions: formFields.some((field) => field.type === 'mention-chooser'),
    needsHashtags: formFields.some((field) => field.type === 'tag-chooser'),
    needsEvents: formFields.some((field) => field.type === 'event-chooser'),
    frontmatterKeys: Array.from(frontmatterKeys),
  }
}

/**
 * Ensure autosave field is added if autosave is enabled in settings
 * TODO: Re-enable autosave by default once templatejs-block freeze issue is resolved
 * @param {Array<Object>} formFields - The form fields array
 * @param {Object} argObj - The argObj to update if autosave field is added
 * @returns {Array<Object>} Updated form fields array
 */
function ensureAutosaveField(formFields: Array<Object>, argObj: Object): Array<Object> {
  const autosaveEnabled = DataStore.settings?.autosave === true
  const hasAutosaveField = formFields.some((field) => field.type === 'autosave')

  if (autosaveEnabled && !hasAutosaveField) {
    logDebug(pluginJson, `ensureAutosaveField: Autosave enabled in settings, adding invisible autosave field`)
    const updatedFields = [
      ...formFields,
      {
        type: 'autosave',
        invisible: true, // Hide the UI but still perform autosaves
        autosaveInterval: 2, // Default 2 seconds
        // autosaveFilename will use default pattern with form title
      },
    ]
    // Update argObj with the modified formFields
    argObj.formFields = updatedFields
    return updatedFields
  }

  return formFields
}

/**
 * Initialize empty arrays for all chooser data types
 * @param {Object} pluginData - The plugin data object to initialize
 */
function initializeEmptyChooserData(pluginData: Object): void {
  pluginData.folders = []
  pluginData.notes = []
  pluginData.preloadedTeamspaces = []
  pluginData.preloadedMentions = []
  pluginData.preloadedHashtags = []
  pluginData.preloadedEvents = []
  pluginData.preloadedFrontmatterValues = {}
}

/**
 * Preload folders data if needed
 * @param {Object} pluginData - The plugin data object to populate
 * @param {boolean} needsFolders - Whether folders are needed
 */
function preloadFolders(pluginData: Object, needsFolders: boolean): void {
  if (!needsFolders) {
    pluginData.folders = []
    return
  }

  try {
    const foldersResult = getFolders({ excludeTrash: true, space: null })
    if (foldersResult.success && Array.isArray(foldersResult.data)) {
      pluginData.folders = foldersResult.data
      logDebug(pluginJson, `preloadFolders: Preloaded ${foldersResult.data.length} folders`)
    } else {
      pluginData.folders = []
      logError(pluginJson, `preloadFolders: Failed to preload folders`)
    }
  } catch (error) {
    pluginData.folders = []
    logError(pluginJson, `preloadFolders: Error preloading folders: ${error.message}`)
  }
}

/**
 * Preload notes data if needed
 * @param {Object} pluginData - The plugin data object to populate
 * @param {boolean} needsNotes - Whether notes are needed
 */
function preloadNotes(pluginData: Object, needsNotes: boolean): void {
  if (!needsNotes) {
    pluginData.notes = []
    return
  }

  try {
    const notesResult = getNotes({
      includeCalendarNotes: true,
      includePersonalNotes: true,
      includeRelativeNotes: true,
      includeTeamspaceNotes: true,
    })
    if (notesResult.success && Array.isArray(notesResult.data)) {
      pluginData.notes = notesResult.data
      logDebug(pluginJson, `preloadNotes: Preloaded ${notesResult.data.length} notes`)
    } else {
      pluginData.notes = []
      logError(pluginJson, `preloadNotes: Failed to preload notes`)
    }
  } catch (error) {
    pluginData.notes = []
    logError(pluginJson, `preloadNotes: Error preloading notes: ${error.message}`)
  }
}

/**
 * Preload teamspaces data if needed
 * @param {Object} pluginData - The plugin data object to populate
 * @param {boolean} needsSpaces - Whether teamspaces are needed
 */
function preloadTeamspaces(pluginData: Object, needsSpaces: boolean): void {
  if (!needsSpaces) {
    pluginData.preloadedTeamspaces = []
    return
  }

  try {
    const teamspacesResult = getTeamspaces({})
    if (teamspacesResult.success && Array.isArray(teamspacesResult.data)) {
      pluginData.preloadedTeamspaces = teamspacesResult.data
      logDebug(pluginJson, `preloadTeamspaces: Preloaded ${teamspacesResult.data.length} teamspaces`)
    } else {
      pluginData.preloadedTeamspaces = []
      logError(pluginJson, `preloadTeamspaces: Failed to preload teamspaces`)
    }
  } catch (error) {
    pluginData.preloadedTeamspaces = []
    logError(pluginJson, `preloadTeamspaces: Error preloading teamspaces: ${error.message}`)
  }
}

/**
 * Preload mentions data if needed
 * @param {Object} pluginData - The plugin data object to populate
 * @param {boolean} needsMentions - Whether mentions are needed
 */
function preloadMentions(pluginData: Object, needsMentions: boolean): void {
  if (!needsMentions) {
    pluginData.preloadedMentions = []
    return
  }

  try {
    const mentionsResult = getMentions({})
    if (mentionsResult.success && Array.isArray(mentionsResult.data)) {
      pluginData.preloadedMentions = mentionsResult.data
      logDebug(pluginJson, `preloadMentions: Preloaded ${mentionsResult.data.length} mentions`)
    } else {
      pluginData.preloadedMentions = []
      logError(pluginJson, `preloadMentions: Failed to preload mentions`)
    }
  } catch (error) {
    pluginData.preloadedMentions = []
    logError(pluginJson, `preloadMentions: Error preloading mentions: ${error.message}`)
  }
}

/**
 * Preload hashtags data if needed
 * @param {Object} pluginData - The plugin data object to populate
 * @param {boolean} needsHashtags - Whether hashtags are needed
 */
function preloadHashtags(pluginData: Object, needsHashtags: boolean): void {
  if (!needsHashtags) {
    pluginData.preloadedHashtags = []
    return
  }

  try {
    const hashtagsResult = getHashtags({})
    if (hashtagsResult.success && Array.isArray(hashtagsResult.data)) {
      pluginData.preloadedHashtags = hashtagsResult.data
      logDebug(pluginJson, `preloadHashtags: Preloaded ${hashtagsResult.data.length} hashtags`)
    } else {
      pluginData.preloadedHashtags = []
      logError(pluginJson, `preloadHashtags: Failed to preload hashtags`)
    }
  } catch (error) {
    pluginData.preloadedHashtags = []
    logError(pluginJson, `preloadHashtags: Error preloading hashtags: ${error.message}`)
  }
}

/**
 * Preload events data if needed (preloads today's events by default)
 * @param {Object} pluginData - The plugin data object to populate
 * @param {boolean} needsEvents - Whether events are needed
 */
async function preloadEvents(pluginData: Object, needsEvents: boolean): Promise<void> {
  if (!needsEvents) {
    pluginData.preloadedEvents = []
    return
  }

  try {
    // Get today's date in YYYY-MM-DD format for preloading
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayString = `${year}-${month}-${day}`

    const eventsResult = await getEvents({
      dateString: todayString,
      allCalendars: true, // Preload all calendars for maximum compatibility
      includeReminders: true, // Include reminders for comprehensive data
    })
    if (eventsResult.success && Array.isArray(eventsResult.data)) {
      pluginData.preloadedEvents = eventsResult.data
      logDebug(pluginJson, `preloadEvents: Preloaded ${eventsResult.data.length} events for ${todayString}`)
    } else {
      pluginData.preloadedEvents = []
      logError(pluginJson, `preloadEvents: Failed to preload events`)
    }
  } catch (error) {
    pluginData.preloadedEvents = []
    logError(pluginJson, `preloadEvents: Error preloading events: ${error.message}`)
  }
}

/**
 * Preload frontmatter key values if needed
 * @param {Object} pluginData - The plugin data object to populate
 * @param {Array<string>} frontmatterKeys - Array of frontmatter keys to preload values for
 */
/**
 * Preload frontmatter key values if needed
 * @param {Object} pluginData - The plugin data object to populate
 * @param {Array<string>} frontmatterKeys - Array of frontmatter keys to preload values for
 */
async function preloadFrontmatterKeyValues(pluginData: Object, frontmatterKeys: Array<string>): Promise<void> {
  if (!frontmatterKeys || frontmatterKeys.length === 0) {
    pluginData.preloadedFrontmatterValues = {}
    return
  }

  try {
    const { getFrontmatterKeyValues } = await import('./requestHandlers.js')
    const preloadedValues: { [string]: Array<string> } = {}

    // Preload values for each unique frontmatter key
    for (const key of frontmatterKeys) {
      try {
        const result = await getFrontmatterKeyValues({
          frontmatterKey: key,
          noteType: 'All',
          caseSensitive: false,
        })
        if (result.success && Array.isArray(result.data)) {
          const values: Array<string> = result.data || []
          preloadedValues[key] = values
          logDebug(pluginJson, `preloadFrontmatterKeyValues: Preloaded ${values.length} values for key "${key}"`)
        } else {
          preloadedValues[key] = []
          logError(pluginJson, `preloadFrontmatterKeyValues: Failed to preload values for key "${key}"`)
        }
      } catch (error) {
        preloadedValues[key] = []
        logError(pluginJson, `preloadFrontmatterKeyValues: Error preloading values for key "${key}": ${error.message}`)
      }
    }

    pluginData.preloadedFrontmatterValues = preloadedValues
    logDebug(pluginJson, `preloadFrontmatterKeyValues: Preloaded values for ${Object.keys(preloadedValues).length} frontmatter keys`)
  } catch (error) {
    pluginData.preloadedFrontmatterValues = {}
    logError(pluginJson, `preloadFrontmatterKeyValues: Error preloading frontmatter values: ${error.message}`)
  }
}

/**
 * Preload all chooser data if preloadChooserData is enabled
 * @param {Object} pluginData - The plugin data object to populate
 * @param {Object} requirements - Object with boolean flags for each chooser type
 */
async function preloadAllChooserData(pluginData: Object, requirements: Object): Promise<void> {
  logDebug(pluginJson, `preloadAllChooserData: Loading chooser data upfront for static HTML testing`)

  preloadFolders(pluginData, requirements.needsFolders)
  preloadNotes(pluginData, requirements.needsNotes)
  preloadTeamspaces(pluginData, requirements.needsSpaces)
  preloadMentions(pluginData, requirements.needsMentions)
  preloadHashtags(pluginData, requirements.needsHashtags)
  await preloadEvents(pluginData, requirements.needsEvents)
  await preloadFrontmatterKeyValues(pluginData, requirements.frontmatterKeys || [])
}

/**
 * Gather data you want passed to the React Window (e.g. what you you will use to display)
 * You will likely use this function to pull together your starting window data
 * Must return an object, with any number of properties, however you cannot use the following reserved
 * properties: pluginData, title, debug, ENV_MODE, returnPluginCommand, componentPath, passThroughVars, startTime
 * @returns {Promise<{[string]: mixed}>} - the data that your React Window will start with
 */
export async function getPluginData(argObj: Object): Promise<{ [string]: mixed }> {
  logDebug(pluginJson, `getPluginData: ENTRY - argObj keys: ${Object.keys(argObj || {}).join(', ')}`)

  // Check if form fields include folder-chooser or note-chooser
  let formFields = argObj.formFields || []
  logDebug(pluginJson, `getPluginData: Checking ${formFields.length} form fields for chooser types`)

  // Ensure autosave field is added if needed
  formFields = ensureAutosaveField(formFields, argObj)

  // Log field types for debugging
  const fieldTypes = formFields.map((f) => f.type).filter(Boolean)
  logDebug(pluginJson, `getPluginData: Field types found: ${fieldTypes.join(', ')}`)

  // Detect which chooser types are needed
  const requirements = detectFieldRequirements(formFields)
  logDebug(
    pluginJson,
    `getPluginData: needsFolders=${String(requirements.needsFolders)}, needsNotes=${String(requirements.needsNotes)}, needsSpaces=${String(
      requirements.needsSpaces,
    )}, needsMentions=${String(requirements.needsMentions)}, needsHashtags=${String(requirements.needsHashtags)}, needsEvents=${String(
      requirements.needsEvents,
    )}, frontmatterKeys=[${(requirements.frontmatterKeys || []).join(', ')}]`,
  )

  const pluginData = { platform: NotePlan.environment.platform, ...argObj }

  // Check if preloadChooserData option is enabled (for testing in Chrome without NotePlan connection)
  // Handle both boolean true and string "true" from frontmatter
  const preloadChooserData = argObj.preloadChooserData === true || argObj.preloadChooserData === 'true'

  if (preloadChooserData) {
    await preloadAllChooserData(pluginData, requirements)
  } else {
    // Always initialize folders and notes arrays as empty
    // Both FormView and FormBuilder now load folders/notes dynamically via requestFromPlugin
    // This is more consistent and allows for better error handling and on-demand loading
    initializeEmptyChooserData(pluginData)

    if (requirements.needsFolders) {
      logDebug(pluginJson, `getPluginData: Folder-chooser field detected - folders will be loaded dynamically by FormView`)
    }
    if (requirements.needsNotes) {
      logDebug(pluginJson, `getPluginData: Note-chooser field detected - notes will be loaded dynamically by FormView`)
    }
  }

  const foldersArray = Array.isArray(pluginData.folders) ? pluginData.folders : []
  const notesArray = Array.isArray(pluginData.notes) ? pluginData.notes : []
  const teamspacesArray = Array.isArray(pluginData.preloadedTeamspaces) ? pluginData.preloadedTeamspaces : []
  const mentionsArray = Array.isArray(pluginData.preloadedMentions) ? pluginData.preloadedMentions : []
  const hashtagsArray = Array.isArray(pluginData.preloadedHashtags) ? pluginData.preloadedHashtags : []
  logDebug(
    pluginJson,
    `getPluginData: EXIT - pluginData keys: ${Object.keys(pluginData).join(', ')}, folders.length=${foldersArray.length}, notes.length=${notesArray.length}, teamspaces.length=${
      teamspacesArray.length
    }, mentions.length=${mentionsArray.length}, hashtags.length=${hashtagsArray.length}`,
  )
  return pluginData // this could be any object full of data you want to pass to the window
}

/**
 * Opens the HTML+React window; Called after the form data has been generated
 * @param {Object} argObj - the data to pass to the React Window (comes from templating "openTemplateForm" command, a combination of the template frontmatter vars and formFields codeblock)
 *  - formFields: array (required) - the form fields to display
 *  - windowTitle: string (optional) - the title of the window (defaults to 'Form')
 *  - formTitle: string (optional) - the title of the form (inside the window)
 *  - width: string (optional) - the width of the form window
 *  - height: string (optional) - the height of the form window
 */
export async function openFormWindow(argObj: Object): Promise<void> {
  try {
    logDebug(pluginJson, `openFormWindow: Starting`)
    // Make sure we have np.Shared plugin which has the core react code
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true)
    logDebug(pluginJson, `openFormWindow: installOrUpdatePluginsByID ['np.Shared'] completed`)

    // Generate base customId (without random suffix) for searching existing windows
    const baseCustomId = getFormWindowId(argObj?.formTitle || argObj?.windowTitle || '')
    
    // IMPORTANT: If we re-open a form into an existing HTML window with the same base `customId`,
    // NotePlan may keep the window around after close and reuse it, replacing its HTML/JS. We've seen recurring 
    // native crashes in JavaScriptCore (`EXC_BAD_ACCESS` in `JSC::JSRunLoopTimer::Manager::timerDidFireCallback`) 
    // when a window is "reloaded" this way, likely due to pending timers/cleanup in the old WebView/React instance 
    // racing with the new load.
    // Mitigation: 
    // 1. Search for any existing windows that START WITH the base customId and close them
    // 2. Append a random suffix to make the customId unique, preventing window reuse
    // 3. Store the unique windowId in pluginData so backend receives correct ID (window sends __windowId in requests)
    const windowsToClose: Array<string> = []
    for (const win of NotePlan.htmlWindows) {
      if (win.customId && win.customId.startsWith(baseCustomId)) {
        windowsToClose.push(win.customId)
      }
    }
    if (windowsToClose.length > 0) {
      logDebug(pluginJson, `openFormWindow: Found ${windowsToClose.length} existing form window(s) with base customId="${baseCustomId}", closing them before opening new window to avoid JSC crash`)
      for (const customIdToClose of windowsToClose) {
        closeWindowFromCustomId(customIdToClose)
      }
    }

    // Generate unique customId with random suffix to prevent window reuse
    // Format: "baseCustomId-{timestamp}-{random}"
    const randomSuffix = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const uniqueCustomId = `${baseCustomId}-${randomSuffix}`
    logDebug(pluginJson, `openFormWindow: Generated unique customId="${uniqueCustomId}" from base="${baseCustomId}"`)
    
    // Pass the unique windowId to createWindowInitData so it's stored in pluginData.windowId
    // This ensures the window sends the correct __windowId to backend (backend uses __windowId from request, not customId)
    const argObjWithUniqueWindowId = {
      ...argObj,
      uniqueWindowId: uniqueCustomId, // Pass unique windowId to be stored in pluginData
    }

    // get initial data to pass to the React Window
    const data = await createWindowInitData(argObjWithUniqueWindowId)

    // Note the first tag below uses the w3.css scaffolding for basic UI elements. You can delete that line if you don't want to use it
    const cssTagsString = `
      <link rel="stylesheet" href="../np.Shared/css.w3.css">
      <link href="../np.Shared/fontawesome.css" rel="stylesheet">
      <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">\n`

    // Parse window dimensions (can be numbers or percentage strings)
    const screenWidth = NotePlan.environment.screenWidth
    const screenHeight = NotePlan.environment.screenHeight

    const parsedWidth = parseWindowDimension(argObj?.width, screenWidth)
    const parsedHeight = parseWindowDimension(argObj?.height, screenHeight)
    // For X and Y positions, we need the window dimensions to calculate special values like "center", "left", "right", "top", "bottom"
    const parsedX = parseWindowDimension(argObj?.x, screenWidth, parsedWidth, 'x')
    // IMPORTANT: NotePlan's API uses bottom-left origin (y=0 is bottom of screen, window bottom at screen bottom)
    // We work with top-left origin (y=0 is top of screen) in our Forms code
    // parseWindowDimension returns top-left coordinates, so convert to bottom-left:
    // bottomLeft_y = screenHeight - windowHeight - topLeft_y
    let parsedY = parseWindowDimension(argObj?.y, screenHeight, parsedHeight, 'y')
    if (parsedY !== undefined && parsedY !== null && parsedHeight !== undefined && parsedHeight !== null) {
      // Convert from top-left coordinate system to NotePlan's bottom-left coordinate system
      parsedY = screenHeight - parsedHeight - parsedY
    }

    // Build windowOptions, only including width/height/x/y if they are defined
    // This allows mixing numbers and percentages, or setting only one dimension
    const windowOptions: { [string]: any } = {
      savedFilename: `../../${pluginJson['plugin.id']}/form_output.html` /* for saving a debug version of the html file */,
      headerTags: cssTagsString,
      windowTitle: argObj?.windowTitle || 'Form',
      customId: uniqueCustomId, // Use unique customId with random suffix to prevent window reuse
      shouldFocus: true /* focus window everyd time (set to false if you want a bg refresh) */,
      generalCSSIn: generateCSSFromTheme(), // either use dashboard-specific theme name, or get general CSS set automatically from current theme
      postBodyScript: `
        <script type="text/javascript" >
        // Set DataStore.settings so default logDebug etc. logging works in React
        let DataStore = { settings: {_logLevel: "${DataStore.settings._logLevel}" } };
        </script>
      `,
    }
    // Only include dimensions if they are defined (allows mixing numbers/percentages or setting only one)
    if (parsedWidth !== undefined && parsedWidth !== null) {
      windowOptions.width = parsedWidth
    }
    if (parsedHeight !== undefined && parsedHeight !== null) {
      windowOptions.height = parsedHeight
    }
    if (parsedX !== undefined && parsedX !== null) {
      windowOptions.x = parsedX
    }
    if (parsedY !== undefined && parsedY !== null) {
      windowOptions.y = parsedY
    }
    logDebug(`===== openReactWindow Calling React after ${timer(data.startTime || new Date())} =====`)
    logDebug(pluginJson, `openReactWindow invoking window. openReactWindow stopping here. It's all React from this point forward`)

    // clo(windowOptions, `openReactWindow windowOptions object passed`)
    // clo(data, `openReactWindow data object passed`) // this is a lot of data
    // now ask np.Shared to open the React Window with the data we just gathered
    await DataStore.invokePluginCommandByName('openReactWindow', 'np.Shared', [data, windowOptions])
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Opens the FormBuilder React window
 * @param {Object} argObj - Contains formFields, templateFilename, templateTitle
 * @returns {Promise<void>}
 */
export async function openFormBuilderWindow(argObj: Object): Promise<void> {
  try {
    logDebug(pluginJson, `openFormBuilderWindow: Starting`)
    // clo(argObj, `openFormBuilderWindow: argObj`)

    const startTime = new Date()
    const ENV_MODE = 'development'

    // Check if np.Shared is already installed before trying to install it
    // This avoids unnecessary async work if it's already available
    const npSharedInstalled = DataStore.isPluginInstalledByID('np.Shared')
    if (!npSharedInstalled) {
      logDebug(pluginJson, `openFormBuilderWindow: np.Shared not installed, installing...`)
      await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true)
      logDebug(pluginJson, `openFormBuilderWindow: installOrUpdatePluginsByID ['np.Shared'] completed`)
    } else {
      logDebug(pluginJson, `openFormBuilderWindow: np.Shared already installed, skipping installation check`)
    }

    // Get receiving template title - use initialReceivingTemplateTitle if provided (for newly created forms),
    // otherwise read from note's frontmatter (for existing forms)
    let receivingTemplateTitle = ''
    let templateNote = null

    // Fetch the note once and reuse it (performance optimization)
    let templateTeamspaceID = '' // Will be used as default space for form operations
    let templateTeamspaceTitle = '' // Will be used for display in Form Builder
    if (argObj.templateFilename) {
      templateNote = await getNoteByFilename(argObj.templateFilename)
      if (templateNote) {
        // Detect teamspace from template note (if form is in a teamspace, preserve that context)
        if (templateNote.filename?.startsWith('%%NotePlanCloud%%')) {
          const teamspaceDetails = parseTeamspaceFilename(templateNote.filename || '')
          templateTeamspaceID = teamspaceDetails.teamspaceID || ''
          if (templateTeamspaceID) {
            templateTeamspaceTitle = getTeamspaceTitleFromID(templateTeamspaceID)
            logDebug(pluginJson, `openFormBuilderWindow: Template is in teamspace: ${templateTeamspaceID} (${templateTeamspaceTitle})`)
          }
        }

        if (argObj.initialReceivingTemplateTitle) {
          // For newly created forms, use the value we already have - no need to read from note
          receivingTemplateTitle = argObj.initialReceivingTemplateTitle
          logDebug(pluginJson, `openFormBuilderWindow: Using initialReceivingTemplateTitle="${receivingTemplateTitle}"`)
        } else {
          // For existing forms, read from note's frontmatter
          // Backward compat: formProcessorTitle was legacy name for receivingTemplateTitle
          const fm = templateNote.frontmatterAttributes || {}
          receivingTemplateTitle = fm?.receivingTemplateTitle || fm?.formProcessorTitle || ''
          logDebug(pluginJson, `openFormBuilderWindow: Read receivingTemplateTitle="${receivingTemplateTitle}" from note frontmatter`)
        }
      }
    }

    // Get all frontmatter values from the template note
    let windowTitle = ''
    let formTitle = ''
    let allowEmptySubmit = false
    let hideDependentItems = false
    let width: ?number | ?string = undefined
    let height: ?number | ?string = undefined
    let x: ?number | ?string = undefined
    let y: ?number | ?string = undefined
    let processingMethod = '' // Read from frontmatter
    let isNewForm = false
    let templateBody = ''
    let templateRunnerArgs = null
    let customCSSValue = ''
    let newNoteFrontmatter = ''
    let templateTitleForWindow = argObj.templateTitle || ''
    let launchLink = '' // Will be generated or read from frontmatter

    if (templateNote) {
      templateTitleForWindow = templateNote.title || templateTitleForWindow
      // Strip quotes from frontmatter values if present
      windowTitle = stripDoubleQuotes(templateNote.frontmatterAttributes?.windowTitle || '') || ''
      formTitle = stripDoubleQuotes(templateNote.frontmatterAttributes?.formTitle || '') || ''
      allowEmptySubmit = templateNote.frontmatterAttributes?.allowEmptySubmit === 'true' || templateNote.frontmatterAttributes?.allowEmptySubmit === true
      hideDependentItems = templateNote.frontmatterAttributes?.hideDependentItems === 'true' || templateNote.frontmatterAttributes?.hideDependentItems === true
      // Read processingMethod from frontmatter (don't strip quotes as it's not a string value that needs cleaning)
      processingMethod = templateNote.frontmatterAttributes?.processingMethod || ''
      // Read launchLink from frontmatter if available, otherwise generate it
      launchLink = templateNote.frontmatterAttributes?.launchLink || ''
      if (!launchLink && templateTitleForWindow) {
        // Generate launchLink if not in frontmatter
        const encodedTitle = encodeURIComponent(templateTitleForWindow)
        launchLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=${encodedTitle}`
      }
      // Parse width, height, x, and y (can be numbers or percentage strings)
      const widthStr = templateNote.frontmatterAttributes?.width
      const heightStr = templateNote.frontmatterAttributes?.height
      const xStr = templateNote.frontmatterAttributes?.x
      const yStr = templateNote.frontmatterAttributes?.y
      if (widthStr) {
        width = typeof widthStr === 'number' ? widthStr : String(widthStr)
      }
      if (heightStr) {
        height = typeof heightStr === 'number' ? heightStr : String(heightStr)
      }
      if (xStr !== undefined && xStr !== null && xStr !== '') {
        x = typeof xStr === 'number' ? xStr : String(xStr)
      }
      if (yStr !== undefined && yStr !== null && yStr !== '') {
        y = typeof yStr === 'number' ? yStr : String(yStr)
      }

      // Load templateBody, TemplateRunner args, custom CSS, and new note frontmatter in parallel (performance optimization)
      // Start all promises to run in parallel, then await them
      const templateBodyPromise = loadTemplateBodyFromTemplate(templateNote)
      const templateRunnerArgsPromise = loadTemplateRunnerArgsFromTemplate(templateNote)
      const customCSSPromise = loadCustomCSSFromTemplate(templateNote)
      const newNoteFrontmatterPromise = loadNewNoteFrontmatterFromTemplate(templateNote)
      templateBody = await templateBodyPromise
      templateRunnerArgs = await templateRunnerArgsPromise
      customCSSValue = await customCSSPromise
      newNoteFrontmatter = await newNoteFrontmatterPromise

      // Merge TemplateRunner args into the data object that will be passed to FormBuilder
      // These will override any values that might be in frontmatter
      if (templateRunnerArgs) {
        // Store TemplateRunner args in a separate object for FormBuilder to use
        // FormBuilder will merge these into frontmatter state
        Object.assign(argObj, { templateRunnerArgs })
      }
    } else {
      // No templateFilename means this is a new form
      isNewForm = true
    }
    // Allow explicit override (e.g., when creating a new form but note already exists)
    if (argObj.isNewForm !== undefined) {
      isNewForm = argObj.isNewForm
    }

    // Generate unique window ID based on template title/filename
    const windowId = getFormBuilderWindowId(templateTitleForWindow, argObj.templateFilename)

    const data: PassedData = {
      pluginData: {
        platform: NotePlan.environment.platform,
        formFields: argObj.formFields || [],
        templateRunnerArgs: argObj.templateRunnerArgs || {}, // Pass TemplateRunner args to FormBuilder
        templateFilename: argObj.templateFilename || '',
        templateTitle: argObj.templateTitle || '',
        receivingTemplateTitle: receivingTemplateTitle,
        windowTitle: windowTitle,
        formTitle: formTitle,
        allowEmptySubmit: allowEmptySubmit,
        hideDependentItems: hideDependentItems,
        width: width,
        height: height,
        x: x,
        y: y,
        processingMethod: processingMethod, // Pass processingMethod from frontmatter
        templateBody: templateBody, // Load from codeblock
        customCSS: customCSSValue || '', // Load custom CSS from codeblock
        newNoteFrontmatter: newNoteFrontmatter || '', // Load from codeblock
        isNewForm: isNewForm,
        launchLink: launchLink, // Add launchLink to pluginData
        windowId: windowId, // Store window ID in pluginData so React can send it in requests
        templateTeamspaceID: templateTeamspaceID, // Pass template's teamspace ID as default space for form operations
        templateTeamspaceTitle: templateTeamspaceTitle, // Pass template's teamspace title for display
      },
      title: templateTitleForWindow
        ? templateTeamspaceTitle
          ? `Form Builder - ${templateTeamspaceTitle} ${templateTitleForWindow}`
          : `Form Builder - ${templateTitleForWindow}`
        : 'Form Builder',
      logProfilingMessage: false,
      debug: false,
      ENV_MODE,
      returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFormBuilderAction' },
      componentPath: `../dwertheimer.Forms/react.c.FormBuilderView.bundle.${ENV_MODE === 'development' ? 'dev' : 'min'}.js`,
      startTime,
    }
    logDebug(pluginJson, `openFormBuilderWindow: Created data object, about to open React window`)

    const cssTagsString = `
      <link rel="stylesheet" href="../np.Shared/css.w3.css">
      <link href="../np.Shared/fontawesome.css" rel="stylesheet">
      <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">\n`

    const windowOptions = {
      savedFilename: `../../${pluginJson['plugin.id']}/formbuilder_output.html`,
      headerTags: cssTagsString,
      windowTitle: data.title,
      width: 1200,
      height: 800,
      customId: windowId, // Use unique window ID instead of constant
      reuseUsersWindowRect: true,
      shouldFocus: true,
      generalCSSIn: generateCSSFromTheme(),
      postBodyScript: `
        <script type="text/javascript" >
        // Set DataStore.settings so default logDebug etc. logging works in React
        let DataStore = { settings: {_logLevel: "${DataStore.settings._logLevel}" } };
        </script>
      `,
    }
    logDebug(pluginJson, `openFormBuilderWindow: About to invoke openReactWindow`)
    await DataStore.invokePluginCommandByName('openReactWindow', 'np.Shared', [data, windowOptions])
    logDebug(pluginJson, `openFormBuilderWindow: openReactWindow completed successfully`)
  } catch (error) {
    logError(pluginJson, `openFormBuilderWindow: Error occurred: ${JSP(error)}`)
    logError(pluginJson, error)
    await showMessage(`Error opening Form Builder: ${error.message || String(error)}`)
  }
}

/**
 * Open Form Browser window - browse and select template forms
 * @param {boolean} _showFloating - If true, use openReactWindow instead of showInMainWindow
 * @returns {Promise<void>}
 */
export async function openFormBrowser(_showFloating: boolean = false): Promise<void> {
  try {
    logDebug(pluginJson, `openFormBrowser: Starting, showFloating=${String(_showFloating)}`)

    // Make sure we have np.Shared plugin which has the core react code
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true)
    logDebug(pluginJson, `openFormBrowser: installOrUpdatePluginsByID ['np.Shared'] completed`)

    const startTime = new Date()
    const ENV_MODE = 'development'
    const showFloating = _showFloating === true || (typeof _showFloating === 'string' && /true/i.test(_showFloating))

    // Create plugin data
    // Note: requestFromPlugin is now implemented in FormBrowserView using the dispatch pattern
    // (functions can't be serialized when passed through HTML/JSON)
    // Generate unique window ID based on whether it's floating or main window
    const windowId = showFloating ? getFormBrowserWindowId('floating') : getFormBrowserWindowId('main')
    const pluginData = {
      platform: NotePlan.environment.platform,
      windowId: windowId, // Store window ID in pluginData so React can send it in requests
      showFloating: showFloating, // Pass showFloating flag so React knows whether to show header
    }

    // Create data object to pass to React
    const dataToPass: PassedData = {
      pluginData,
      title: 'Template Forms',
      logProfilingMessage: false,
      debug: false, // Enable debug mode to show test buttons
      ENV_MODE,
      returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFormBrowserAction' },
      componentPath: `../dwertheimer.Forms/react.c.FormBrowserView.bundle.dev.js`,
      startTime,
    }

    // CSS tags for styling
    const cssTagsString = `
      <link rel="stylesheet" href="../np.Shared/css.w3.css">
      <link href="../np.Shared/fontawesome.css" rel="stylesheet">
      <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">\n`

    // Use the same windowOptions for both floating and main window
    const windowOptions = {
      savedFilename: `../../${pluginJson['plugin.id']}/form_browser_output.html`,
      headerTags: cssTagsString,
      windowTitle: 'Template Forms',
      width: 1200,
      height: 800,
      customId: windowId, // Use unique window ID instead of constant
      shouldFocus: true,
      generalCSSIn: generateCSSFromTheme(),
      postBodyScript: `
        <script type="text/javascript" >
        // Set DataStore.settings so default logDebug etc. logging works in React
        let DataStore = { settings: {_logLevel: "${DataStore.settings._logLevel}" } };
        </script>
      `,
      // Options for showInMainWindow (main window mode)
      splitView: false,
      icon: 'list',
      iconColor: 'blue-500',
      autoTopPadding: true,
      showReloadButton: true,
      reloadPluginID: 'dwertheimer.Forms',
      reloadCommandName: 'openFormBrowser',
    }

    // Choose the appropriate command based on whether it's floating or main window
    const windowType = showFloating ? 'openReactWindow' : 'showInMainWindow'
    logDebug(pluginJson, `openFormBrowser: Using ${windowType} (${showFloating ? 'floating' : 'main'} window)`)
    await DataStore.invokePluginCommandByName(windowType, 'np.Shared', [dataToPass, windowOptions])

    logDebug(pluginJson, `openFormBrowser: Completed after ${timer(startTime)}`)
  } catch (error) {
    logError(pluginJson, `openFormBrowser: Error: ${JSP(error)}`)
    await showMessage(`Error opening form browser: ${error.message}`)
  }
}
