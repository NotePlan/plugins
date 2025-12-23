// @flow
//--------------------------------------------------------------------------
// Window Management Functions - Opening and managing React windows
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { type PassedData } from './NPTemplateForm.js'
import { loadTemplateBodyFromTemplate, loadTemplateRunnerArgsFromTemplate } from './templateIO.js'
import { getNoteByFilename } from '@helpers/note'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { logDebug, logError, timer, JSP, clo } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'
import { stripDoubleQuotes } from '@helpers/stringTransforms'

export const FORMBUILDER_WINDOW_ID = `${pluginJson['plugin.id']} Form Builder React Window`
export const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']} Form Entry React Window`
const REACT_WINDOW_TITLE = 'Form View'

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
export function createWindowInitData(argObj: Object): PassedData {
  const startTime = new Date()
  logDebug(pluginJson, `createWindowInitData: ENTRY - argObj keys: ${Object.keys(argObj || {}).join(', ')}`)
  // get whatever pluginData you want the React window to start with and include it in the object below. This all gets passed to the React window
  const pluginData = getPluginData(argObj)
  const foldersArray = Array.isArray(pluginData.folders) ? pluginData.folders : []
  logDebug(pluginJson, `createWindowInitData: After getPluginData - folders.length=${foldersArray.length}`)
  const ENV_MODE = 'development' /* helps during development. set to 'production' when ready to release */
  const dataToPass: PassedData = {
    pluginData,
    title: argObj?.formTitle || REACT_WINDOW_TITLE,
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
 * Gather data you want passed to the React Window (e.g. what you you will use to display)
 * You will likely use this function to pull together your starting window data
 * Must return an object, with any number of properties, however you cannot use the following reserved
 * properties: pluginData, title, debug, ENV_MODE, returnPluginCommand, componentPath, passThroughVars, startTime
 * @returns {[string]: mixed} - the data that your React Window will start with
 */
export function getPluginData(argObj: Object): { [string]: mixed } {
  logDebug(pluginJson, `getPluginData: ENTRY - argObj keys: ${Object.keys(argObj || {}).join(', ')}`)

  // Check if form fields include folder-chooser or note-chooser
  const formFields = argObj.formFields || []
  logDebug(pluginJson, `getPluginData: Checking ${formFields.length} form fields for folder-chooser/note-chooser`)

  // Log field types for debugging
  const fieldTypes = formFields.map((f) => f.type).filter(Boolean)
  logDebug(pluginJson, `getPluginData: Field types found: ${fieldTypes.join(', ')}`)

  const needsFolders = formFields.some((field) => field.type === 'folder-chooser')
  const needsNotes = formFields.some((field) => field.type === 'note-chooser')

  logDebug(pluginJson, `getPluginData: needsFolders=${String(needsFolders)}, needsNotes=${String(needsNotes)}`)

  const pluginData = { platform: NotePlan.environment.platform, ...argObj }

  // Always initialize folders and notes arrays as empty
  // Both FormView and FormBuilder now load folders/notes dynamically via requestFromPlugin
  // This is more consistent and allows for better error handling and on-demand loading
  pluginData.folders = []
  pluginData.notes = []

  if (needsFolders) {
    logDebug(pluginJson, `getPluginData: Folder-chooser field detected - folders will be loaded dynamically by FormView`)
  }
  if (needsNotes) {
    logDebug(pluginJson, `getPluginData: Note-chooser field detected - notes will be loaded dynamically by FormView`)
  }

  const foldersArray = Array.isArray(pluginData.folders) ? pluginData.folders : []
  const notesArray = Array.isArray(pluginData.notes) ? pluginData.notes : []
  logDebug(pluginJson, `getPluginData: EXIT - pluginData keys: ${Object.keys(pluginData).join(', ')}, folders.length=${foldersArray.length}, notes.length=${notesArray.length}`)
  return pluginData // this could be any object full of data you want to pass to the window
}

/**
 * Opens the HTML+React window; Called after the form data has been generated
 * @param {Object} argObj - the data to pass to the React Window (comes from templating "getTemplateFormData" command, a combination of the template frontmatter vars and formFields codeblock)
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

    // get initial data to pass to the React Window
    const data = await createWindowInitData(argObj)

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
    const parsedY = parseWindowDimension(argObj?.y, screenHeight, parsedHeight, 'y')

    const windowOptions = {
      savedFilename: `../../${pluginJson['plugin.id']}/form_output.html` /* for saving a debug version of the html file */,
      headerTags: cssTagsString,
      windowTitle: argObj?.windowTitle || 'Form',
      width: parsedWidth,
      height: parsedHeight,
      x: parsedX,
      y: parsedY,
      customId: WEBVIEW_WINDOW_ID,
      shouldFocus: true /* focus window everyd time (set to false if you want a bg refresh) */,
      generalCSSIn: generateCSSFromTheme(), // either use dashboard-specific theme name, or get general CSS set automatically from current theme
      postBodyScript: `
        <script type="text/javascript" >
        // Set DataStore.settings so default logDebug etc. logging works in React
        let DataStore = { settings: {_logLevel: "${DataStore.settings._logLevel}" } };
        </script>
      `,
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

    // Make sure we have np.Shared plugin which has the core react code
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true)
    logDebug(pluginJson, `openFormBuilderWindow: installOrUpdatePluginsByID ['np.Shared'] completed`)

    const startTime = new Date()
    const ENV_MODE = 'development'
    // Get receiving template title - use initialReceivingTemplateTitle if provided (for newly created forms),
    // otherwise read from note's frontmatter (for existing forms)
    let receivingTemplateTitle = ''
    if (argObj.initialReceivingTemplateTitle) {
      // For newly created forms, use the value we already have - no need to read from note
      receivingTemplateTitle = argObj.initialReceivingTemplateTitle
      logDebug(pluginJson, `openFormBuilderWindow: Using initialReceivingTemplateTitle="${receivingTemplateTitle}"`)
    } else if (argObj.templateFilename) {
      // For existing forms, read from note's frontmatter
      const templateNote = await getNoteByFilename(argObj.templateFilename)
      if (templateNote) {
        receivingTemplateTitle = templateNote.frontmatterAttributes?.receivingTemplateTitle || ''
        logDebug(pluginJson, `openFormBuilderWindow: Read receivingTemplateTitle="${receivingTemplateTitle}" from note frontmatter`)
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
    let isNewForm = false
    let templateBody = ''

    if (argObj.templateFilename) {
      const templateNote = await getNoteByFilename(argObj.templateFilename)
      if (templateNote) {
        // Strip quotes from frontmatter values if present
        windowTitle = stripDoubleQuotes(templateNote.frontmatterAttributes?.windowTitle || '') || ''
        formTitle = stripDoubleQuotes(templateNote.frontmatterAttributes?.formTitle || '') || ''
        allowEmptySubmit = templateNote.frontmatterAttributes?.allowEmptySubmit === 'true' || templateNote.frontmatterAttributes?.allowEmptySubmit === true
        hideDependentItems = templateNote.frontmatterAttributes?.hideDependentItems === 'true' || templateNote.frontmatterAttributes?.hideDependentItems === true
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
        if (xStr) {
          x = typeof xStr === 'number' ? xStr : String(xStr)
        }
        if (yStr) {
          y = typeof yStr === 'number' ? yStr : String(yStr)
        }
        // Load templateBody from codeblock
        templateBody = await loadTemplateBodyFromTemplate(templateNote)

        // Load TemplateRunner args from codeblock (these contain template tags and should not be in frontmatter)
        const templateRunnerArgs = await loadTemplateRunnerArgsFromTemplate(templateNote)

        // Merge TemplateRunner args into the data object that will be passed to FormBuilder
        // These will override any values that might be in frontmatter
        if (templateRunnerArgs) {
          // Store TemplateRunner args in a separate object for FormBuilder to use
          // FormBuilder will merge these into frontmatter state
          Object.assign(argObj, { templateRunnerArgs })
        }
      }
    } else {
      // No templateFilename means this is a new form
      isNewForm = true
    }

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
        templateBody: templateBody, // Load from codeblock
        isNewForm: isNewForm,
      },
      title: 'Form Builder',
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
      customId: FORMBUILDER_WINDOW_ID,
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
