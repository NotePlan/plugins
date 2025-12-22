// @flow

import pluginJson from '../plugin.json'
import { getGlobalSharedData, sendToHTMLWindow, sendBannerMessage } from '../../helpers/HTMLView'
// Note: getAllNotesAsOptions is no longer used here - FormView loads notes dynamically via requestFromPlugin
import { createProcessingTemplate, varsInForm, varsCodeBlockType } from './ProcessingTemplate'
import { handleRequest, testRequestHandlers } from './requestHandlers'
import { log, logError, logDebug, logWarn, timer, clo, JSP, logInfo } from '@helpers/dev'
import { /* getWindowFromId, */ closeWindowFromCustomId } from '@helpers/NPWindows'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { showMessage } from '@helpers/userInput'
import NPTemplating from 'NPTemplating'
import { getNoteByFilename } from '@helpers/note'
import { getCodeBlocksOfType, replaceCodeBlockContent } from '@helpers/codeBlocks'
import { parseObjectString, validateObjectString, stripDoubleQuotes } from '@helpers/stringTransforms'
import { updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { findStartOfActivePartOfNote } from '@helpers/paragraph'
// Note: getFoldersMatching is no longer used here - FormView loads folders dynamically via requestFromPlugin

const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']} Form Entry React Window` // will be used as the customId for your window
// you can leave it like this or if you plan to open multiple windows, make it more specific per window
const REACT_WINDOW_TITLE = 'Form View' // change this to what you want window title to display
const FORMBUILDER_WINDOW_ID = `${pluginJson['plugin.id']} Form Builder React Window`

export type PassedData = {
  startTime?: Date /* used for timing/debugging */,
  title?: string /* React Window Title */,
  width?: number /* React Window Width */,
  height?: number /* React Window Height */,
  pluginData: any /* Your plugin's data to pass on first launch (or edited later) */,
  ENV_MODE?: 'development' | 'production',
  debug: boolean /* set based on ENV_MODE above */,
  logProfilingMessage: boolean /* whether you want to see profiling messages on React redraws (not super interesting) */,
  returnPluginCommand: { id: string, command: string } /* plugin jsFunction that will receive comms back from the React window */,
  componentPath: string /* the path to the rolled up webview bundle. should be ../pluginID/react.c.WebView.bundle.* */,
  passThroughVars?: any /* any data you want to pass through to the React Window */,
}

/**
 * Validate the form fields to make sure they are valid
 * @param {Array<Object>} formFields - the form fields to validate
 * @returns {boolean} - true if the form fields are valid, false otherwise
 */
function validateFormFields(formFields: Array<Object>): boolean {
  let i = 0
  const reservedWords = [
    '__isJSON__',
    'submit',
    'location',
    'writeUnderHeading',
    'openNoteTitle',
    'writeNoteTitle',
    'getNoteTitled',
    'replaceNoteContents',
    'createMissingHeading',
    'receivingTemplateTitle',
    'windowTitle',
    'formTitle',
    'width',
    'height',
    'hideDependentItems',
    'allowEmptySubmit',
    'title',
  ]
  for (const field of formFields) {
    i++
    // check that each field has a type, and if not use showMessage to alert the user
    if (!field.type) {
      showMessage(`Field "${field.label || ''}" (index ${i}) does not have a type. Please set a type for every field.`)
      return false
    }
    // every field that is not a separator must have a key
    if (field.type !== 'separator' && field.type !== 'heading' && !field.key) {
      showMessage(`Field "${field.label || ''}" (index ${i}) does not have a key. Please set a key for every field.`)
      return false
    }
    // check that the key is not a reserved word
    if (reservedWords.includes(field.key)) {
      // Just warn the user in the log, don't fail the form
      logInfo(
        pluginJson,
        `Field "${field.label || ''}" has a key ("${field.key}") that is a reserved word in the forms processor. Generally speaking, you will want to use a key other than "${
          field.key
        }". Continuing for now in case it was intentional.`,
      )
    }
  }
  return true
}

/**
 * Plugin entrypoint for getting the form data and then opening the form window
 * Open a form window with the form fields from the template codeblock named "formFields"
 * @param {string} templateTitle - the title of the template to use
 * @returns {void}
 */
export async function getTemplateFormData(templateTitle?: string): Promise<void> {
  try {
    let selectedTemplate // will be a filename
    if (templateTitle?.trim().length) {
      const options = await NPTemplating.getTemplateList('template-form')
      const chosenOpt = options.find((option) => option.label === templateTitle)
      if (chosenOpt) {
        // variable passed is a note title, but we need the filename
        selectedTemplate = chosenOpt.value
      }
    } else {
      // ask the user for the template
      selectedTemplate = await NPTemplating.chooseTemplate('template-form')
    }
    let formFields: Array<Object> = []
    if (selectedTemplate) {
      const note = await getNoteByFilename(selectedTemplate)
      if (note) {
        const fm = note.frontmatterAttributes
        clo(fm, `getTemplateFormData fm=`)
        const receiver = fm && (fm.receivingTemplateTitle || fm.receivingtemplatetitle) // NP has a bug where it sometimes lowercases the frontmatter keys
        if (!receiver) {
          await showMessage(
            `Template "${
              note.title || ''
            }" does not have a "receivingTemplateTitle" set in frontmatter. Please set the "receivingTemplateTitle" field in your template frontmatter first.`,
          )
          return
        }
        const codeBlocks = getCodeBlocksOfType(note, 'formfields')
        if (codeBlocks.length > 0) {
          const formFieldsString = codeBlocks[0].code
          if (formFieldsString) {
            try {
              formFields = parseObjectString(formFieldsString)
              if (!formFields) {
                const errors = validateObjectString(formFieldsString)
                logError(pluginJson, `getTemplateFormData: error validating form fields in ${selectedTemplate}, String:\n${formFieldsString}, `)
                logError(pluginJson, `getTemplateFormData: errors: ${errors.join('\n')}`)
                return
              }
              clo(formFields, `🎅🏼 DBWDELETE NPTemplating.getTemplateFormData formFields=`)
              logDebug(pluginJson, `🎅🏼 DBWDELETE NPTemplating.getTemplateFormData formFields=\n${JSON.stringify(formFields, null, 2)}`)
            } catch (error) {
              const errors = validateObjectString(formFieldsString)
              await showMessage(
                `getTemplateFormData: There is an error in your form fields (most often a missing comma).\nJS Error: "${error.message}"\nCheck Plugin Console Log for more details.`,
              )
              logError(pluginJson, `getTemplateFormData: error parsing form fields: ${error.message} String:\n${formFieldsString}`)
              logError(pluginJson, `getTemplateFormData: errors: ${errors.join('\n')}`)
              return
            }
          }
        }
      } else {
        logError(pluginJson, `getTemplateFormData: could not find form template: ${selectedTemplate}`)
        return
      }
    }
    const templateData = await NPTemplating.getTemplateContent(selectedTemplate)
    const templateFrontmatterAttributes = await NPTemplating.getTemplateAttributes(templateData)
    clo(templateData, `getTemplateFormData templateData=`)
    clo(templateFrontmatterAttributes, `getTemplateFormData templateFrontmatterAttributes=`)

    if (!templateFrontmatterAttributes?.receivingTemplateTitle) {
      logError(pluginJson, 'Template does not have a receivingTemplateTitle set')
      await showMessage('Template Form does not have a "receivingTemplateTitle" field set. Please set the "receivingTemplateTitle" field in your template frontmatter first.')
      return
    }

    //TODO: we may not need this step, ask @codedungeon what he thinks
    // for now, we'll call renderFrontmatter() via DataStore.invokePluginCommandByName()
    const { _, frontmatterAttributes } = await DataStore.invokePluginCommandByName('renderFrontmatter', 'np.Templating', [templateData])

    if (templateFrontmatterAttributes.formFields) {
      // yaml version of formFields
      frontmatterAttributes.formFields = templateFrontmatterAttributes.formFields
    } else {
      // codeblock version of formFields
      frontmatterAttributes.formFields = formFields
    }

    if (await validateFormFields(frontmatterAttributes.formFields)) {
      await openFormWindow(frontmatterAttributes)
    } else {
      logError(pluginJson, 'Form fields validation failed. The form window will not be opened.')
    }
  } catch (error) {
    logError(pluginJson, error)
  }
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
    width: argObj?.width ? parseInt(argObj.width) : undefined,
    height: argObj?.height ? parseInt(argObj.height) : undefined,
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
 * Router function that receives requests from the React Window and routes them to the appropriate function
 * Typically based on a user interaction in the React Window
 * (e.g. handleSubmitButtonClick example below)
 * Here's where you will process any other commands+data that comes back from the React Window
 * How it works:
 * let reactWindowData...reaches out to the React window and get the most current pluginData that it's using to render.
 * This is the data that you initially built and passed to the window in the initial call (with a few additions you don't need to worry about)
 * Then in the case statements, we pass that data to a function which will act on the particular action type,
 * and you edit the part of the data object that needs to be edited: typically `reactWindowData.pluginData.XXX`
 * and that function IMPORTANTLY returns a modified reactWindowData object after acting on the action (this should be the full object used to render the React Window)
 * That new updated reactWindowData object is sent back to the React window basically saying "hey, the data has changed, re-render as necessary!"
 * and React will look through the data and find the parts that have changed and re-draw only those parts of the window
 * @param {string} actionType - the reducer-type action to be dispatched
 * @param {any} data - the relevant sent from the React Window (could be anything the plugin needs to act on the actionType)
 * @author @dwertheimer
 */
/**
 * Open FormBuilder for creating/editing form fields
 * @param {string} templateTitle - Optional template title to edit
 * @returns {Promise<void>}
 */
export async function openFormBuilder(templateTitle?: string): Promise<void> {
  try {
    logDebug(pluginJson, `openFormBuilder: Starting, templateTitle="${templateTitle || ''}"`)
    let selectedTemplate
    let formFields: Array<Object> = []
    let templateNote = null
    let receivingTemplateTitle: string = '' // Track receiving template title for newly created forms

    if (templateTitle?.trim().length) {
      logDebug(pluginJson, `openFormBuilder: Using provided templateTitle`)
      const options = await NPTemplating.getTemplateList('template-form')
      const chosenOpt = options.find((option) => option.label === templateTitle)
      if (chosenOpt) {
        selectedTemplate = chosenOpt.value
        logDebug(pluginJson, `openFormBuilder: Found template, selectedTemplate="${selectedTemplate}"`)
      } else {
        logError(pluginJson, `openFormBuilder: Could not find template with title "${templateTitle}"`)
      }
    } else {
      logDebug(pluginJson, `openFormBuilder: Asking user to choose or create template`)
      // Ask user to choose or create a new template
      const createNew = await CommandBar.showOptions(['Create New Form', 'Edit Existing Form'], 'Form Builder', 'Choose an option')
      clo(createNew, `openFormBuilder: User selected option`)
      // $FlowFixMe[incompatible-type] - showOptions returns number index
      if (createNew.value === 'Create New Form' || createNew.index === 0) {
        logDebug(pluginJson, `openFormBuilder: User chose to create new template`)
        // Create new template
        let newTitle = await CommandBar.textPrompt('New Form Template', 'Enter template title:', '')
        logDebug(pluginJson, `openFormBuilder: User entered title: "${String(newTitle)}"`)
        if (!newTitle || typeof newTitle === 'boolean') {
          logDebug(pluginJson, `openFormBuilder: User cancelled or empty title, returning`)
          return
        }

        // Append "Form" to title if it doesn't already contain "form" (case-insensitive)
        if (!/form/i.test(newTitle)) {
          newTitle = `${newTitle} Form`
          logDebug(pluginJson, `openFormBuilder: Appended "Form" to title, new title: "${newTitle}"`)
        }

        // Create folder path: @Templates/Forms/{form name}
        const formFolderPath = `@Templates/Forms/${newTitle}`
        logDebug(pluginJson, `openFormBuilder: Creating form in folder "${formFolderPath}"`)

        logDebug(pluginJson, `openFormBuilder: Creating new note with title "${newTitle}" in ${formFolderPath} folder`)
        // Create new note in Forms subfolder
        const filename = DataStore.newNote(newTitle, formFolderPath)
        logDebug(pluginJson, `openFormBuilder: DataStore.newNote returned filename: "${filename || 'null'}"`)
        if (!filename) {
          logError(pluginJson, `openFormBuilder: Failed to create template "${newTitle}"`)
          await showMessage(`Failed to create template "${newTitle}"`)
          return
        }
        logDebug(pluginJson, `openFormBuilder: Created new template "${newTitle}" with filename: ${filename}`)
        templateNote = await getNoteByFilename(filename)
        logDebug(pluginJson, `openFormBuilder: getNoteByFilename returned: ${templateNote ? 'note found' : 'null'}`)
        if (!templateNote) {
          logError(pluginJson, `openFormBuilder: Could not find note with filename: ${filename}`)
          await showMessage(`Failed to open newly created template "${newTitle}"`)
          return
        }
        logDebug(pluginJson, `openFormBuilder: Setting frontmatter for new template`)

        // Generate launchLink URL (needed for both form and processing template)
        const encodedTitle = encodeURIComponent(newTitle)
        const launchLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=${encodedTitle}`
        // Generate formEditLink URL to launch Form Builder
        const formEditLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Form%20Builder&arg0=${encodedTitle}`

        // Ask if they want to create a receiving template
        const createReceiving = await CommandBar.showOptions(['Yes, create receiving template', 'No, skip for now'], 'Form Builder', 'Create receiving template for form output?')
        // receivingTemplateTitle is declared in outer scope above

        if (createReceiving?.value === 'Yes, create receiving template' || createReceiving.index === 0) {
          logDebug(pluginJson, `openFormBuilder: Calling createProcessingTemplate with form template details`)
          const result = await createProcessingTemplate({
            formTemplateTitle: newTitle,
            formTemplateFilename: filename,
            suggestedProcessingTitle: `${newTitle} Processing Template`,
            formLaunchLink: launchLink, // Pass the launch link to add to processing template frontmatter
            formEditLink: formEditLink, // Pass the edit link to add to processing template frontmatter
          })

          if (result?.processingTitle) {
            receivingTemplateTitle = result.processingTitle
            logDebug(pluginJson, `openFormBuilder: Created receiving template "${receivingTemplateTitle}" via createProcessingTemplate`)
          } else {
            logDebug(pluginJson, `openFormBuilder: createProcessingTemplate returned no result, user may have cancelled`)
          }
        }

        // Set initial frontmatter including launchLink and formEditLink
        updateFrontMatterVars(templateNote, {
          type: 'template-form',
          receivingTemplateTitle: receivingTemplateTitle,
          windowTitle: newTitle,
          formTitle: newTitle,
          launchLink: launchLink,
          formEditLink: formEditLink,
        })
        selectedTemplate = filename
        logDebug(pluginJson, `openFormBuilder: Set frontmatter and selectedTemplate = ${selectedTemplate}, receivingTemplateTitle = "${receivingTemplateTitle}"`)

        // Generate processing template link if receiving template exists
        let processingTemplateLink = ''
        if (receivingTemplateTitle) {
          const encodedProcessingTitle = encodeURIComponent(receivingTemplateTitle)
          processingTemplateLink = `noteplan://x-callback-url/openNote?noteTitle=${encodedProcessingTitle}`
        }

        // Add markdown links to body content in format: "title [open form]() [edit form]() [open processing template]()"
        const markdownLinks = `${newTitle}: [open form](${launchLink}) [edit form](${formEditLink})${
          processingTemplateLink ? ` [open processing template](${processingTemplateLink})` : ''
        }`
        templateNote.appendParagraph(markdownLinks, 'text')

        // Reload the note to ensure frontmatter is up to date before opening FormBuilder
        templateNote = await getNoteByFilename(filename)
        logDebug(pluginJson, `openFormBuilder: Reloaded template note after setting frontmatter`)
        if (templateNote) {
          const reloadedReceivingTitle = templateNote.frontmatterAttributes?.receivingTemplateTitle
          logDebug(pluginJson, `openFormBuilder: After reload, frontmatter receivingTemplateTitle = "${reloadedReceivingTitle || 'NOT FOUND'}"`)
          if (!reloadedReceivingTitle && receivingTemplateTitle) {
            logWarn(pluginJson, `openFormBuilder: WARNING - receivingTemplateTitle was set to "${receivingTemplateTitle}" but not found in reloaded note frontmatter!`)
          }
        }
        // $FlowFixMe[incompatible-type] - showOptions returns number index
      } else if (createNew.index === 1 || createNew.value === 'Edit Existing Form') {
        logDebug(pluginJson, `openFormBuilder: User chose to edit existing form`)
        // Edit existing
        selectedTemplate = await NPTemplating.chooseTemplate('template-form')
        logDebug(pluginJson, `openFormBuilder: User selected existing template: "${selectedTemplate || 'none'}"`)
      } else {
        logDebug(pluginJson, `openFormBuilder: User cancelled, returning`)
        return // cancelled
      }
    }

    if (!selectedTemplate) {
      logError(pluginJson, 'openFormBuilder: No template selected, cannot open FormBuilder')
      await showMessage('No template selected. Cannot open Form Builder.')
      return
    }

    logDebug(pluginJson, `openFormBuilder: Opening FormBuilder for template: ${selectedTemplate}`)

    // Get template note if we don't already have it
    if (!templateNote) {
      logDebug(pluginJson, `openFormBuilder: Getting template note for filename: ${selectedTemplate}`)
      templateNote = await getNoteByFilename(selectedTemplate)
      logDebug(pluginJson, `openFormBuilder: getNoteByFilename returned: ${templateNote ? 'note found' : 'null'}`)
    }

    if (templateNote) {
      logDebug(pluginJson, `openFormBuilder: Checking for existing formfields code blocks`)
      const codeBlocks = getCodeBlocksOfType(templateNote, 'formfields')
      logDebug(pluginJson, `openFormBuilder: Found ${codeBlocks.length} formfields code blocks`)
      if (codeBlocks.length > 0) {
        const formFieldsString = codeBlocks[0].code
        if (formFieldsString) {
          try {
            formFields = parseObjectString(formFieldsString) || []
            logDebug(pluginJson, `openFormBuilder: Loaded ${formFields.length} existing form fields`)
          } catch (error) {
            logError(pluginJson, `openFormBuilder: error parsing form fields: ${error.message}`)
          }
        }
      } else {
        logDebug(pluginJson, `openFormBuilder: No existing formfields code blocks found, starting with empty array`)
      }
    } else {
      logWarn(pluginJson, `openFormBuilder: templateNote is null, will start with empty form fields`)
    }

    logDebug(
      pluginJson,
      `openFormBuilder: About to call openFormBuilderWindow with ${formFields.length} fields, templateFilename="${selectedTemplate}", templateTitle="${templateNote?.title || ''}"`,
    )
    // If we just created a receiving template, pass it directly to ensure it's available
    const initialReceivingTemplateTitle = receivingTemplateTitle || undefined
    await openFormBuilderWindow({
      formFields,
      templateFilename: selectedTemplate,
      templateTitle: templateNote?.title || '',
      initialReceivingTemplateTitle: initialReceivingTemplateTitle,
    })
    logDebug(pluginJson, `openFormBuilder: openFormBuilderWindow call completed`)
  } catch (error) {
    logError(pluginJson, error)
  }
}

/**
 * Opens the FormBuilder React window
 * @param {Object} argObj - Contains formFields, templateFilename, templateTitle
 * @returns {Promise<void>}
 */
async function openFormBuilderWindow(argObj: Object): Promise<void> {
  try {
    logDebug(pluginJson, `openFormBuilderWindow: Starting`)
    clo(argObj, `openFormBuilderWindow: argObj`)

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
    let width: ?number = undefined
    let height: ?number = undefined
    let isNewForm = false

    if (argObj.templateFilename) {
      const templateNote = await getNoteByFilename(argObj.templateFilename)
      if (templateNote) {
        // Strip quotes from frontmatter values if present
        windowTitle = stripDoubleQuotes(templateNote.frontmatterAttributes?.windowTitle || '') || ''
        formTitle = stripDoubleQuotes(templateNote.frontmatterAttributes?.formTitle || '') || ''
        allowEmptySubmit = templateNote.frontmatterAttributes?.allowEmptySubmit === 'true' || templateNote.frontmatterAttributes?.allowEmptySubmit === true
        hideDependentItems = templateNote.frontmatterAttributes?.hideDependentItems === 'true' || templateNote.frontmatterAttributes?.hideDependentItems === true
        // Parse width and height as numbers if they exist
        const widthStr = templateNote.frontmatterAttributes?.width
        const heightStr = templateNote.frontmatterAttributes?.height
        if (widthStr) {
          width = typeof widthStr === 'number' ? widthStr : parseInt(String(widthStr), 10)
        }
        if (heightStr) {
          height = typeof heightStr === 'number' ? heightStr : parseInt(String(heightStr), 10)
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
        templateFilename: argObj.templateFilename || '',
        templateTitle: argObj.templateTitle || '',
        receivingTemplateTitle: receivingTemplateTitle,
        windowTitle: windowTitle,
        formTitle: formTitle,
        allowEmptySubmit: allowEmptySubmit,
        hideDependentItems: hideDependentItems,
        width: width,
        height: height,
        isNewForm: isNewForm,
      },
      title: 'Form Builder',
      logProfilingMessage: false,
      debug: ENV_MODE === 'development',
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
        // This setting comes from ${pluginJson['plugin.id']}
        let DataStore = { settings: {_logLevel: "${DataStore.settings._logLevel}" } };
        </script>
      `,
    }

    logDebug(pluginJson, `===== openFormBuilderWindow Calling React after ${timer(startTime)} =====`)
    logDebug(pluginJson, `openFormBuilderWindow: About to invoke 'openReactWindow' command on np.Shared plugin`)
    clo(windowOptions, `openFormBuilderWindow: windowOptions`)

    const result = await DataStore.invokePluginCommandByName('openReactWindow', 'np.Shared', [data, windowOptions])
    logDebug(pluginJson, `openFormBuilderWindow: invokePluginCommandByName returned: ${result ? 'success' : 'null/undefined'}`)
    logDebug(pluginJson, `openFormBuilderWindow: Window should now be open. It's all React from this point forward`)
  } catch (error) {
    logError(pluginJson, `openFormBuilderWindow: Error occurred: ${JSP(error)}`)
    logError(pluginJson, error)
    await showMessage(`Error opening Form Builder: ${error.message || String(error)}`)
  }
}

/**
 * Handle FormBuilder actions (save, cancel)
 * @param {string} actionType - The action type ('save' or 'cancel')
 * @param {any} data - The data sent from FormBuilder
 * @returns {Promise<any>}
 */
export async function onFormBuilderAction(actionType: string, data: any = null): Promise<any> {
  try {
    logDebug(pluginJson, `onFormBuilderAction received actionType="${actionType}"`)
    clo(data, `onFormBuilderAction data=`)

    // Check if this is a request that needs a response
    if (data?.__requestType === 'REQUEST' && data?.__correlationId) {
      try {
        logDebug(pluginJson, `onFormBuilderAction: Handling REQUEST type="${actionType}" with correlationId="${data.__correlationId}"`)
        const result = await handleRequest(actionType, data)

        // Send response back to React
        sendToHTMLWindow(FORMBUILDER_WINDOW_ID, 'RESPONSE', {
          correlationId: data.__correlationId,
          success: result.success,
          data: result.data,
          error: result.message,
        })
        return {}
      } catch (error) {
        logError(pluginJson, `onFormBuilderAction: Error handling REQUEST: ${error.message}`)
        sendToHTMLWindow(FORMBUILDER_WINDOW_ID, 'RESPONSE', {
          correlationId: data.__correlationId,
          success: false,
          data: null,
          error: error.message || 'Unknown error',
        })
        return {}
      }
    }

    // The data structure from React is: { type: 'save'|'cancel', fields: [...], templateFilename: ..., templateTitle: ... }
    // actionType will be "onFormBuilderAction" (the command name), and the actual action is in data.type
    const actualActionType = data?.type
    logDebug(pluginJson, `onFormBuilderAction: actualActionType="${actualActionType}"`)

    // Get the template filename from the data passed from React, or fall back to reactWindowData
    const templateFilename = data?.templateFilename
    const reactWindowData = await getGlobalSharedData(FORMBUILDER_WINDOW_ID)
    const fallbackTemplateFilename = reactWindowData?.pluginData?.templateFilename || ''
    const finalTemplateFilename = templateFilename || fallbackTemplateFilename

    logDebug(pluginJson, `onFormBuilderAction: templateFilename="${finalTemplateFilename}"`)

    if (actualActionType === 'save' && data?.fields) {
      // Parse fields if they're strings (shouldn't happen, but just in case)
      let fieldsToSave = data.fields
      if (Array.isArray(fieldsToSave) && fieldsToSave.length > 0 && typeof fieldsToSave[0] === 'string') {
        logWarn(pluginJson, `onFormBuilderAction: Fields are strings, attempting to parse`)
        fieldsToSave = fieldsToSave.map((field) => {
          try {
            return typeof field === 'string' ? JSON.parse(field) : field
          } catch (e) {
            logError(pluginJson, `onFormBuilderAction: Error parsing field: ${e.message}`)
            return field
          }
        })
      }

      logDebug(pluginJson, `onFormBuilderAction: Saving ${fieldsToSave.length} fields to template "${finalTemplateFilename}"`)
      clo(fieldsToSave, `onFormBuilderAction: fieldsToSave`)

      await saveFormFieldsToTemplate(finalTemplateFilename, fieldsToSave)

      // Save frontmatter if provided
      if (data?.frontmatter) {
        await saveFrontmatterToTemplate(finalTemplateFilename, data.frontmatter)
      }

      // Check if we should update the receiving template
      const templateNote = await getNoteByFilename(finalTemplateFilename)
      if (templateNote) {
        const receivingTemplateTitle = templateNote.frontmatterAttributes?.receivingTemplateTitle
        if (receivingTemplateTitle) {
          const updateReceiving = await CommandBar.showOptions(['Yes, update receiving template', 'No, skip'], 'Form Builder', 'Update receiving template with new field keys?')

          if (updateReceiving?.value === 'Yes, update receiving template' || updateReceiving?.index === 0) {
            await updateReceivingTemplateWithFields(receivingTemplateTitle, fieldsToSave)
          }
        }
      }

      // If you want to automatically close the window after saving, uncomment the line below
      // closeWindowFromCustomId(FORMBUILDER_WINDOW_ID)
    } else if (actualActionType === 'cancel') {
      logDebug(pluginJson, `onFormBuilderAction: User cancelled, closing window`)
      closeWindowFromCustomId(FORMBUILDER_WINDOW_ID)
    } else if (actualActionType === 'openForm' && data?.templateTitle) {
      logDebug(pluginJson, `onFormBuilderAction: Opening form with templateTitle="${data.templateTitle}"`)
      await getTemplateFormData(data.templateTitle)
    } else {
      logWarn(pluginJson, `onFormBuilderAction: Unknown actualActionType="${actualActionType}" or missing fields/data`)
      logWarn(pluginJson, `onFormBuilderAction: data.keys=${Object.keys(data || {}).join(', ')}`)
    }

    return {}
  } catch (error) {
    logError(pluginJson, `onFormBuilderAction error: ${JSP(error)}`)
  }
}

/**
 * Save frontmatter to template
 * @param {string} templateFilename - The template filename
 * @param {Object} frontmatter - The frontmatter object
 * @returns {Promise<void>}
 */
async function saveFrontmatterToTemplate(templateFilename: string, frontmatter: Object): Promise<void> {
  try {
    if (!templateFilename) {
      await showMessage('No template filename provided. Cannot save frontmatter.')
      return
    }

    const templateNote = await getNoteByFilename(templateFilename)
    if (!templateNote) {
      await showMessage(`Template not found: ${templateFilename}`)
      return
    }

    // Convert all frontmatter values to strings (updateFrontMatterVars expects strings)
    // Strip any quotes that might have been added
    const frontmatterAsStrings: { [string]: string } = {}
    Object.keys(frontmatter).forEach((key) => {
      const value = frontmatter[key]
      // Convert to string, handling null/undefined
      if (value === null || value === undefined) {
        frontmatterAsStrings[key] = ''
      } else if (typeof value === 'boolean') {
        frontmatterAsStrings[key] = String(value)
      } else if (typeof value === 'number') {
        frontmatterAsStrings[key] = String(value)
      } else if (typeof value === 'string') {
        // Strip quotes from string values
        frontmatterAsStrings[key] = stripDoubleQuotes(value)
      } else {
        frontmatterAsStrings[key] = stripDoubleQuotes(String(value))
      }
    })

    // Update frontmatter
    updateFrontMatterVars(templateNote, frontmatterAsStrings)
    logDebug(pluginJson, `saveFrontmatterToTemplate: Saved frontmatter to template`)
  } catch (error) {
    logError(pluginJson, `saveFrontmatterToTemplate error: ${JSP(error)}`)
    await showMessage(`Error saving frontmatter: ${error.message}`)
  }
}

/**
 * Save form fields to template as formfields code block
 * @param {string} templateFilename - The template filename
 * @param {Array<Object>} fields - The form fields array
 * @returns {Promise<void>}
 */
async function saveFormFieldsToTemplate(templateFilename: string, fields: Array<Object>): Promise<void> {
  try {
    if (!templateFilename) {
      await showMessage('No template filename provided. Cannot save form fields.')
      return
    }

    const templateNote = await getNoteByFilename(templateFilename)
    if (!templateNote) {
      await showMessage(`Template not found: ${templateFilename}`)
      return
    }

    // Convert fields to JSON string (pretty printed, but without quotes on keys where possible)
    // We'll create a more readable format similar to the example
    const jsonString = formatFormFieldsAsCodeBlock(fields)

    // Use the helper function to replace code block content (or add if it doesn't exist)
    const success = replaceCodeBlockContent(templateNote, 'formfields', jsonString, pluginJson.id)
    if (!success) {
      logError(pluginJson, `saveFormFieldsToTemplate: Failed to replace code block content`)
      await showMessage(`Error: Failed to save form fields to template`)
      return
    }

    await showMessage(`Form fields saved to template "${templateNote.title || templateFilename}"`)
    logDebug(pluginJson, `saveFormFieldsToTemplate: Saved ${fields.length} fields to template`)
  } catch (error) {
    logError(pluginJson, `saveFormFieldsToTemplate error: ${JSP(error)}`)
    await showMessage(`Error saving form fields: ${error.message}`)
  }
}

/**
 * Format form fields array as code block JSON (more readable format)
 * @param {Array<Object>} fields - The form fields
 * @returns {string} - Formatted JSON string
 */
function formatFormFieldsAsCodeBlock(fields: Array<Object>): string {
  // Use JSON.stringify with indentation, but we'll clean it up for readability
  const json = JSON.stringify(fields, null, 2)
  // Replace quoted keys with unquoted keys where appropriate (for cleaner look)
  // Actually, let's keep it as standard JSON since it needs to be parseable
  return json
}

/**
 * Update receiving template with field keys from form fields
 * Adds template variables for each field key at the end of the template
 * @param {string} receivingTemplateTitle - The title of the receiving template
 * @param {Array<Object>} fields - The form fields array
 * @returns {Promise<void>}
 */
async function updateReceivingTemplateWithFields(receivingTemplateTitle: string, fields: Array<Object>): Promise<void> {
  try {
    logDebug(pluginJson, `updateReceivingTemplateWithFields: Starting for template "${receivingTemplateTitle}"`)

    // Find the receiving template
    const templateList = await NPTemplating.getTemplateList('forms-processor')
    const receivingTemplate = templateList.find((t) => {
      // Strip double quotes from both sides for comparison
      const templateLabel = stripDoubleQuotes(t.label)
      const receivingTitle = stripDoubleQuotes(receivingTemplateTitle)
      return templateLabel === receivingTitle
    })

    if (!receivingTemplate) {
      logError(pluginJson, `updateReceivingTemplateWithFields: Could not find receiving template "${receivingTemplateTitle}"`)
      await showMessage(`Could not find receiving template "${receivingTemplateTitle}"`)
      return
    }

    const receivingNote = await getNoteByFilename(receivingTemplate.value)
    if (!receivingNote) {
      logError(pluginJson, `updateReceivingTemplateWithFields: Could not open receiving template note`)
      await showMessage(`Could not open receiving template "${receivingTemplateTitle}"`)
      return
    }

    // Extract fields that have keys (only fields that have keys, excluding separators and headings)
    const fieldsWithKeys = fields.filter((f) => f.key && f.type !== 'separator' && f.type !== 'heading')

    logDebug(pluginJson, `updateReceivingTemplateWithFields: Found ${fieldsWithKeys.length} fields with keys to add`)

    // Build the code block content: varsInForm followed by lines like "<label>: <%- key %>"
    const codeBlockLines = [varsInForm]
    for (const field of fieldsWithKeys) {
      const label = field.label || field.key
      codeBlockLines.push(`${label}: <%- ${field.key} %>`)
    }
    const codeBlockContent = codeBlockLines.join('\n')

    // Use the helper function to replace code block content
    const success = replaceCodeBlockContent(receivingNote, varsCodeBlockType, codeBlockContent, pluginJson.id)
    if (!success) {
      logError(pluginJson, `updateReceivingTemplateWithFields: Failed to replace code block content`)
    }
    logDebug(pluginJson, `updateReceivingTemplateWithFields: Updated receiving template with ${fieldsWithKeys.length} field variables`)
    await showMessage(`Updated receiving template "${receivingTemplateTitle}" with ${fieldsWithKeys.length} field variables`)
  } catch (error) {
    logError(pluginJson, `updateReceivingTemplateWithFields error: ${JSP(error)}`)
    await showMessage(`Error updating receiving template: ${error.message}`)
  }
}

export async function onFormSubmitFromHTMLView(actionType: string, data: any = null): Promise<any> {
  try {
    logDebug(pluginJson, `NP Plugin return path (onMessageFromHTMLView) received actionType="${actionType}" (typeof=${typeof actionType})  (typeof data=${typeof data})`)
    clo(data, `Plugin onMessageFromHTMLView data=`)

    // Check if this is a request that needs a response
    if (data?.__requestType === 'REQUEST' && data?.__correlationId) {
      try {
        logDebug(pluginJson, `onFormSubmitFromHTMLView: Handling REQUEST type="${actionType}" with correlationId="${data.__correlationId}"`)
        const result = await handleRequest(actionType, data)

        // Send response back to React
        sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'RESPONSE', {
          correlationId: data.__correlationId,
          success: result.success,
          data: result.data,
          error: result.message,
        })
        return {}
      } catch (error) {
        logError(pluginJson, `onFormSubmitFromHTMLView: Error handling REQUEST: ${error.message}`)
        sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'RESPONSE', {
          correlationId: data.__correlationId,
          success: false,
          data: null,
          error: error.message || 'Unknown error',
        })
        return {}
      }
    }

    // Existing fire-and-forget handling
    let returnValue = null
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID) // get the current data from the React Window
    // clo(reactWindowData, `Plugin onMessageFromHTMLView reactWindowData=`)
    if (data.passThroughVars) reactWindowData.passThroughVars = { ...reactWindowData.passThroughVars, ...data.passThroughVars }
    switch (actionType) {
      /* best practice here is not to actually do the processing but to call a function based on what the actionType was sent by React */
      /* you would probably call a different function for each actionType */
      case 'onSubmitClick':
        returnValue = await handleSubmitButtonClick(data, reactWindowData) //update the data to send it back to the React Window
        break
      default:
        await sendBannerMessage(WEBVIEW_WINDOW_ID, `Plugin received an unknown actionType: "${actionType}" command with data:\n${JSON.stringify(data)}`)
        break
    }
    if (returnValue && returnValue !== reactWindowData) {
      const updateText = `After ${actionType}, data was updated` /* this is just a string for debugging so you know what changed in the React Window */
      clo(reactWindowData, `Plugin onMessageFromHTMLView after updating window data,reactWindowData=`)
      sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'SET_DATA', reactWindowData, updateText) // note this will cause the React Window to re-render with the currentJSData
    }
    return {} // this return value is ignored but needs to exist or we get an error
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Update the data in the React Window (and cause it to re-draw as necessary with the new data)
 * This is likely most relevant when a trigger has been sent from a NotePlan window, but could be used anytime a plugin wants to update the data in the React Window
 * This is exactly the same as onMessageFromHTMLView, but named updateReactWindowData to clarify that the plugin is updating the data in the React Window
 * rather than a user interaction having triggered it (the result is the same)
 * @param {string} actionType - the reducer-type action to be dispatched -- see onMessageFromHTMLView above
 * @param {any} data - any data that the router (specified in onMessageFromHTMLView) needs -- may be nothing
 * @returns {Promise<any>} - does not return anything important
 */
// export async function updateReactWindowData(actionType: string, data: any = null): Promise<any> {
//   if (!getWindowFromId(WEBVIEW_WINDOW_ID)) {
//     logError(pluginJson, `updateReactWindowData('${actionType}'): Window with ID ${WEBVIEW_WINDOW_ID} not found. Could not update data.`)
//     return
//   }
//   return await onMessageFromHTMLView(actionType, data)
// }

/**
 * When someone clicks a "Submit" button in the React Window, it calls the router (onMessageFromHTMLView)
 * which sees the actionType === "onSubmitClick" so it routes to this function for processing
 * @param {any} data - the data sent from the React Window for the action 'onSubmitClick'
 * @param {any} reactWindowData - the current data in the React Window
 * @returns {any} - the updated data to send back to the React Window
 */
async function handleSubmitButtonClick(data: any, reactWindowData: PassedData): Promise<PassedData | null> {
  const { type, formValues, processingMethod, receivingTemplateTitle } = data
  clo(data, `handleSubmitButtonClick: data BEFORE acting on it`)
  if (type === 'submit') {
    if (formValues) {
      formValues['__isJSON__'] = true // include a flag to indicate that the formValues are JSON for use in the Templating plugin later
      const shouldOpenInEditor = data.shouldOpenInEditor !== false // Default to true if not set

      // Get processing method from data or fall back to form-processor for backward compatibility
      const method = processingMethod || (receivingTemplateTitle ? 'form-processor' : 'write-existing')

      if (method === 'form-processor') {
        // Option C: Use Form Processor (existing behavior)
        if (!receivingTemplateTitle) {
          await showMessage('No Processing Template was Provided; You should set a processing template in your form settings.')
          return null
        }
        const argumentsToSend = [receivingTemplateTitle, shouldOpenInEditor, JSON.stringify(formValues)]
        clo(argumentsToSend, `handleSubmitButtonClick: Using form-processor, calling templateRunner with arguments`)
        await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', argumentsToSend)
      } else if (method === 'write-existing') {
        // Option A: Write to Existing File
        const { getNoteTitled, location, writeUnderHeading, createMissingHeading, templateBody } = data
        if (!getNoteTitled) {
          await showMessage('No target note was specified. Please set a target note in your form settings.')
          return null
        }

        // Use templateBody from frontmatter if provided, otherwise build from form values
        const finalTemplateBody =
          templateBody ||
          Object.keys(formValues)
            .filter((key) => key !== '__isJSON__')
            .map((key) => `${key}: <%- ${key} %>`)
            .join('\n')

        // Build frontmatter object for TemplateRunner
        const templateRunnerArgs: { [string]: any } = {
          getNoteTitled,
          templateBody: finalTemplateBody,
        }

        // Handle location options
        if (location === 'replace') {
          templateRunnerArgs.replaceNoteContents = true
        } else if (location === 'prepend-under-heading') {
          templateRunnerArgs.location = 'prepend'
          if (writeUnderHeading) {
            templateRunnerArgs.writeUnderHeading = writeUnderHeading
            if (createMissingHeading !== undefined) {
              templateRunnerArgs.createMissingHeading = createMissingHeading
            }
          }
        } else if (location === 'append-under-heading') {
          templateRunnerArgs.location = 'append'
          if (writeUnderHeading) {
            templateRunnerArgs.writeUnderHeading = writeUnderHeading
            if (createMissingHeading !== undefined) {
              templateRunnerArgs.createMissingHeading = createMissingHeading
            }
          }
        } else {
          // For other location values (append, prepend, cursor, insert)
          if (location) {
            templateRunnerArgs.location = location
          }
          // Only set writeUnderHeading if it's provided (for backward compatibility)
          if (writeUnderHeading) {
            templateRunnerArgs.writeUnderHeading = writeUnderHeading
            if (createMissingHeading !== undefined) {
              templateRunnerArgs.createMissingHeading = createMissingHeading
            }
          }
        }

        clo(templateRunnerArgs, `handleSubmitButtonClick: Using write-existing, calling templateRunner with args`)
        await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', ['', shouldOpenInEditor, templateRunnerArgs])
      } else if (method === 'create-new') {
        // Option B: Create New Note
        const { newNoteTitle, newNoteFolder, templateBody } = data
        if (!newNoteTitle) {
          await showMessage('No new note title was specified. Please set a new note title in your form settings.')
          return null
        }

        // Use templateBody from frontmatter if provided, otherwise build from form values
        const finalTemplateBody =
          templateBody ||
          Object.keys(formValues)
            .filter((key) => key !== '__isJSON__')
            .map((key) => `${key}: <%- ${key} %>`)
            .join('\n')

        // Build frontmatter object for TemplateRunner
        const templateRunnerArgs: { [string]: any } = {
          newNoteTitle,
          templateBody: finalTemplateBody,
        }

        if (newNoteFolder) {
          templateRunnerArgs.folder = newNoteFolder
        }

        clo(templateRunnerArgs, `handleSubmitButtonClick: Using create-new, calling templateRunner with args`)
        await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', ['', shouldOpenInEditor, templateRunnerArgs])
      } else {
        logError(pluginJson, `handleSubmitButtonClick: Unknown processing method: ${method}`)
        await showMessage(`Unknown processing method: ${method}`)
        return null
      }
    } else {
      logError(pluginJson, `handleSubmitButtonClick: formValues is undefined`)
    }
  } else {
    logDebug(pluginJson, `handleSubmitButtonClick: formValues is undefined`)
  }
  closeWindowFromCustomId(WEBVIEW_WINDOW_ID)
  return reactWindowData
}

/**
 * Opens the HTML+React window; Called after the form data has been generated
 * @param {Object} argObj - the data to pass to the React Window (comes from templating "getTemplateFormData" command, a combination of the template frontmatter vars and formFields codeblock)
 *  - formFields: array (required) - the form fields to display
 *  - windowTitle: string (optional) - the title of the window (defaults to 'Form')
 *  - formTitle: string (optional) - the title of the form (inside the window)
 *  - width: string (optional) - the width of the form window
 *  - height: string (optional) - the height of the form window
 * @author @dwertheimer
 */
export async function openFormWindow(argObj: Object): Promise<void> {
  try {
    if (!argObj) {
      logError(pluginJson, `openFormWindow: argObj is undefined`)
      await showMessage('openFormWindow: no form fields were sent. Cannot continue. Make sure your template has a "formfields" codeblock.')
      return
    }
    logDebug(pluginJson, `openFormWindow starting up`)
    // get initial data to pass to the React Window
    const data = await createWindowInitData(argObj)

    // Note the first tag below uses the w3.css scaffolding for basic UI elements. You can delete that line if you don't want to use it
    // w3.css reference: https://www.w3schools.com/w3css/defaulT.asp
    // The second line needs to be updated to your pluginID in order to load any specific CSS you want to include for the React Window (in requiredFiles)
    const cssTagsString = `
      <link rel="stylesheet" href="../np.Shared/css.w3.css">
      <!-- Load in fontawesome assets from np.Shared (licensed for NotePlan) -->
      <link href="../np.Shared/fontawesome.css" rel="stylesheet">
      <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">\n`
    const windowOptions = {
      savedFilename: `../../${pluginJson['plugin.id']}/form_output.html` /* for saving a debug version of the html file */,
      headerTags: cssTagsString,
      windowTitle: argObj?.windowTitle || 'Form',
      width: argObj?.width,
      height: argObj?.height,
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
    clo(windowOptions, `openReactWindow windowOptions object passed`)
    // clo(data, `openReactWindow data object passed`) // this is a lot of data
    // now ask np.Shared to open the React Window with the data we just gathered
    await DataStore.invokePluginCommandByName('openReactWindow', 'np.Shared', [data, windowOptions])
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Export testRequestHandlers for direct testing
 */
export { testRequestHandlers }
