// @flow

import pluginJson from '../plugin.json'
import { getGlobalSharedData, sendToHTMLWindow, sendBannerMessage } from '../../helpers/HTMLView'
// Note: getAllNotesAsOptions is no longer used here - FormView loads notes dynamically via requestFromPlugin
import { createProcessingTemplate } from './ProcessingTemplate'
import { handleRequest, testRequestHandlers } from './requestHandlers'
import {
  saveFormFieldsToTemplate,
  saveTemplateBodyToTemplate,
  loadTemplateBodyFromTemplate,
  saveTemplateRunnerArgsToTemplate,
  loadTemplateRunnerArgsFromTemplate,
  updateReceivingTemplateWithFields,
} from './templateIO.js'
import { handleSubmitButtonClick, insertTemplateJSBlocks } from './formSubmission.js'
import { openFormWindow, openFormBuilderWindow, createWindowInitData, getPluginData, parseWindowDimension, FORMBUILDER_WINDOW_ID, WEBVIEW_WINDOW_ID } from './windowManagement.js'
import { log, logError, logDebug, logWarn, timer, clo, JSP, logInfo } from '@helpers/dev'
import { /* getWindowFromId, */ closeWindowFromCustomId } from '@helpers/NPWindows'
import { showMessage } from '@helpers/userInput'
import NPTemplating from 'NPTemplating'
import { getNoteByFilename } from '@helpers/note'
import { validateObjectString, stripDoubleQuotes, parseObjectString } from '@helpers/stringTransforms'
import { updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { loadCodeBlockFromNote } from '@helpers/codeBlocks'
// Note: getFoldersMatching is no longer used here - FormView loads folders dynamically via requestFromPlugin

// Import extracted modules

const REACT_WINDOW_TITLE = 'Form View' // change this to what you want window title to display

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

        // Check processing method - determine from frontmatter or infer from receivingTemplateTitle (backward compatibility)
        const processingMethod = fm?.processingMethod || (fm?.receivingTemplateTitle || fm?.receivingtemplatetitle ? 'form-processor' : null)

        // If no processing method is set, require the user to set one
        if (!processingMethod) {
          await showMessage(
            `Template "${
              note.title || ''
            }" does not have a "processingMethod" set in frontmatter. Please set the "processingMethod" field in your template frontmatter to one of: "write-existing", "create-new", or "form-processor".`,
          )
          return
        }

        // Only require receivingTemplateTitle if processing method is 'form-processor'
        if (processingMethod === 'form-processor') {
          const receiver = fm && (fm.receivingTemplateTitle || fm.receivingtemplatetitle) // NP has a bug where it sometimes lowercases the frontmatter keys
          if (!receiver) {
            await showMessage(
              `Template "${
                note.title || ''
              }" uses "form-processor" processing method but does not have a "receivingTemplateTitle" set in frontmatter. Please set the "receivingTemplateTitle" field in your template frontmatter, or change the processing method.`,
            )
            return
          }
        }
        // Use generalized helper function to load formFields
        const loadedFormFields = await loadCodeBlockFromNote<Array<Object>>(selectedTemplate, 'formfields', pluginJson.id, parseObjectString)
        if (loadedFormFields) {
          formFields = loadedFormFields
          if (!formFields) {
            const formFieldsString: ?string = await loadCodeBlockFromNote<string>(selectedTemplate, 'formfields', pluginJson.id, null)
            if (formFieldsString) {
              const errors = validateObjectString(formFieldsString)
              logError(pluginJson, `getTemplateFormData: error validating form fields in ${selectedTemplate}, String:\n${formFieldsString}, `)
              logError(pluginJson, `getTemplateFormData: errors: ${errors.join('\n')}`)
              return
            }
          }
          clo(formFields, `🎅🏼 DBWDELETE NPTemplating.getTemplateFormData formFields=`)
          logDebug(pluginJson, `🎅🏼 DBWDELETE NPTemplating.getTemplateFormData formFields=\n${JSON.stringify(formFields, null, 2)}`)
        } else {
          // Try to get raw string for error reporting
          const formFieldsString: ?string = await loadCodeBlockFromNote<string>(selectedTemplate, 'formfields', pluginJson.id, null)
          if (formFieldsString) {
            try {
              formFields = parseObjectString(formFieldsString)
              if (!formFields) {
                const errors = validateObjectString(formFieldsString)
                logError(pluginJson, `getTemplateFormData: error validating form fields in ${selectedTemplate}, String:\n${formFieldsString}, `)
                logError(pluginJson, `getTemplateFormData: errors: ${errors.join('\n')}`)
                return
              }
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

    // Check processing method - determine from frontmatter or infer from receivingTemplateTitle (backward compatibility)
    const processingMethod = templateFrontmatterAttributes?.processingMethod || (templateFrontmatterAttributes?.receivingTemplateTitle ? 'form-processor' : null)

    // If no processing method is set, require the user to set one
    if (!processingMethod) {
      logError(pluginJson, 'Template does not have a processingMethod set')
      await showMessage(
        'Template Form does not have a "processingMethod" set in frontmatter. Please set the "processingMethod" field in your template frontmatter to one of: "write-existing", "create-new", or "form-processor".',
      )
      return
    }

    // Only require receivingTemplateTitle if processing method is 'form-processor'
    if (processingMethod === 'form-processor' && !templateFrontmatterAttributes?.receivingTemplateTitle) {
      logError(pluginJson, 'Template uses form-processor method but does not have a receivingTemplateTitle set')
      await showMessage(
        'Template Form uses "form-processor" processing method but does not have a "receivingTemplateTitle" field set. Please set the "receivingTemplateTitle" field in your template frontmatter, or change the processing method.',
      )
      return
    }

    //TODO: we may not need this step, ask @codedungeon what he thinks
    // for now, we'll call renderFrontmatter() via DataStore.invokePluginCommandByName()
    const { _, frontmatterAttributes } = await DataStore.invokePluginCommandByName('renderFrontmatter', 'np.Templating', [templateData])

    // Load TemplateRunner processing variables from codeblock (not frontmatter)
    // These contain template tags that reference form field values and should not be processed during form opening
    if (selectedTemplate) {
      const templateNote = await getNoteByFilename(selectedTemplate)
      if (templateNote) {
        // Load templateBody from codeblock
        const templateBodyFromCodeblock = await loadTemplateBodyFromTemplate(templateNote)
        if (templateBodyFromCodeblock) {
          frontmatterAttributes.templateBody = templateBodyFromCodeblock
        }

        // Load TemplateRunner args from codeblock
        const templateRunnerArgs = await loadTemplateRunnerArgsFromTemplate(templateNote)
        if (templateRunnerArgs) {
          // Merge TemplateRunner args into frontmatterAttributes (overriding any from frontmatter)
          Object.assign(frontmatterAttributes, templateRunnerArgs)
        }
      }
    }

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
/**
 * Parse a value that can be a number or percentage string
 * @param {string|number|undefined} value - The value to parse (e.g., "750", "50%", or 750)
 * @param {number} screenDimension - Screen dimension (width or height) for percentage calculation
 * @returns {number|undefined} Parsed pixel value or undefined
 */
// Window management functions are now imported from windowManagement.js

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
    const receivingTemplateTitle: string = '' // Track receiving template title for newly created forms

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

        // Create folder path: @Forms/{form name}
        const formFolderPath = `@Forms/${newTitle}`
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
        const formEditLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Form%20Builder/Editor&arg0=${encodedTitle}`

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
      // Use generalized helper function to load formFields
      const loadedFormFields = await loadCodeBlockFromNote<Array<Object>>(templateNote, 'formfields', pluginJson.id, parseObjectString)
      if (loadedFormFields) {
        formFields = loadedFormFields || []
        logDebug(pluginJson, `openFormBuilder: Loaded ${formFields.length} existing form fields`)
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

// openFormBuilderWindow is now imported from windowManagement.js

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

        // Handle save action as a special case (it's not in requestHandlers)
        const actualActionType = data?.type
        if (actualActionType === 'save') {
          const saveResult = await handleSaveRequest(data)
          sendToHTMLWindow(FORMBUILDER_WINDOW_ID, 'RESPONSE', {
            correlationId: data.__correlationId,
            success: saveResult.success,
            data: saveResult.data,
            error: saveResult.message,
          })
          return {}
        }

        // For other request types, use the standard handleRequest
        const result = await handleRequest(actionType, data)
        // Don't log the data if it's an object/array to avoid cluttering logs with [object Object]
        const dataPreview = result.data != null ? (typeof result.data === 'object' ? `[object]` : String(result.data)) : 'null'
        logDebug(
          pluginJson,
          `onFormBuilderAction: handleRequest result for "${actionType}": success=${String(result.success)}, data type=${typeof result.data}, data="${dataPreview}"`,
        )

        // Send response back to React
        sendToHTMLWindow(FORMBUILDER_WINDOW_ID, 'RESPONSE', {
          correlationId: data.__correlationId,
          success: result.success,
          data: result.data,
          error: result.message,
        })
        return {}
      } catch (error) {
        logError(pluginJson, `onFormBuilderAction: Error handling REQUEST: ${error.message || String(error)}`)
        sendToHTMLWindow(FORMBUILDER_WINDOW_ID, 'RESPONSE', {
          correlationId: data.__correlationId,
          success: false,
          data: null,
          error: error.message || String(error) || 'Unknown error',
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

      // Extract TemplateRunner processing variables from frontmatter
      // These contain template tags and should be stored in codeblock, not frontmatter
      const templateRunnerArgs: { [string]: any } = {}
      const templateRunnerArgKeys = [
        'newNoteTitle', // Contains template tags like <%- field1 %>
        'getNoteTitled', // May contain special values like <today>, <current>
        'location', // Write location setting
        'writeUnderHeading', // Heading to write under
        'replaceNoteContents', // Whether to replace note contents
        'createMissingHeading', // Whether to create missing heading
        'newNoteFolder', // Folder for new note
      ]

      // Extract TemplateRunner args from frontmatter
      if (data?.frontmatter) {
        templateRunnerArgKeys.forEach((key) => {
          if (data.frontmatter[key] !== undefined) {
            templateRunnerArgs[key] = data.frontmatter[key]
          }
        })
      }

      // Save templateBody to codeblock if provided
      if (data?.frontmatter?.templateBody !== undefined) {
        await saveTemplateBodyToTemplate(finalTemplateFilename, data.frontmatter.templateBody || '')
      }

      // Save TemplateRunner args to codeblock if any exist
      if (Object.keys(templateRunnerArgs).length > 0) {
        await saveTemplateRunnerArgsToTemplate(finalTemplateFilename, templateRunnerArgs)
      }

      // Save frontmatter if provided (but exclude TemplateRunner args and templateBody as they're in codeblocks)
      if (data?.frontmatter) {
        const frontmatterForSave = { ...data.frontmatter }
        // Remove TemplateRunner args and templateBody from frontmatter
        delete frontmatterForSave.templateBody
        templateRunnerArgKeys.forEach((key) => {
          delete frontmatterForSave[key]
        })
        await saveFrontmatterToTemplate(finalTemplateFilename, frontmatterForSave)
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
    // IMPORTANT: Skip empty string values to avoid writing "" to frontmatter
    const frontmatterAsStrings: { [string]: string } = {}
    Object.keys(frontmatter).forEach((key) => {
      const value = frontmatter[key]
      // Skip null, undefined, and empty strings - don't write them to frontmatter
      if (value === null || value === undefined) {
        // Skip - don't add to frontmatterAsStrings
        return
      }

      let stringValue: string = ''
      if (typeof value === 'boolean') {
        stringValue = String(value)
      } else if (typeof value === 'number') {
        stringValue = String(value)
      } else if (typeof value === 'string') {
        // Strip quotes from string values
        stringValue = stripDoubleQuotes(value)
      } else {
        stringValue = stripDoubleQuotes(String(value))
      }

      // Only add non-empty string values to frontmatter
      // This prevents writing empty quotes (""") to frontmatter
      if (stringValue !== '') {
        frontmatterAsStrings[key] = stringValue
      }
    })

    // Update frontmatter (only non-empty values will be written)
    updateFrontMatterVars(templateNote, frontmatterAsStrings)
    logDebug(pluginJson, `saveFrontmatterToTemplate: Saved frontmatter to template`)
  } catch (error) {
    logError(pluginJson, `saveFrontmatterToTemplate error: ${JSP(error)}`)
    await showMessage(`Error saving frontmatter: ${error.message}`)
  }
}

/**
 * Handle save request from React (request/response pattern)
 * @param {Object} data - Request data containing fields, frontmatter, templateFilename, templateTitle
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function handleSaveRequest(data: any): Promise<{ success: boolean, message?: string, data?: any }> {
  try {
    // Get the template filename from the data passed from React, or fall back to reactWindowData
    const templateFilename = data?.templateFilename
    const reactWindowData = await getGlobalSharedData(FORMBUILDER_WINDOW_ID)
    const fallbackTemplateFilename = reactWindowData?.pluginData?.templateFilename || ''
    const finalTemplateFilename = templateFilename || fallbackTemplateFilename

    if (!finalTemplateFilename) {
      return {
        success: false,
        message: 'No template filename provided',
        data: null,
      }
    }

    if (!data?.fields) {
      return {
        success: false,
        message: 'No fields provided to save',
        data: null,
      }
    }

    // Parse fields if they're strings (shouldn't happen, but just in case)
    let fieldsToSave = data.fields
    if (Array.isArray(fieldsToSave) && fieldsToSave.length > 0 && typeof fieldsToSave[0] === 'string') {
      logWarn(pluginJson, `handleSaveRequest: Fields are strings, attempting to parse`)
      fieldsToSave = fieldsToSave.map((field) => {
        try {
          return typeof field === 'string' ? JSON.parse(field) : field
        } catch (e) {
          logError(pluginJson, `handleSaveRequest: Error parsing field: ${e.message}`)
          return field
        }
      })
    }

    logDebug(pluginJson, `handleSaveRequest: Saving ${fieldsToSave.length} fields to template "${finalTemplateFilename}"`)

    await saveFormFieldsToTemplate(finalTemplateFilename, fieldsToSave)

    // Extract TemplateRunner processing variables from frontmatter
    // These contain template tags and should be stored in codeblock, not frontmatter
    const templateRunnerArgs: { [string]: any } = {}
    const templateRunnerArgKeys = [
      'newNoteTitle', // Contains template tags like <%- field1 %>
      'getNoteTitled', // May contain special values like <today>, <current>
      'location', // Write location setting
      'writeUnderHeading', // Heading to write under
      'replaceNoteContents', // Whether to replace note contents
      'createMissingHeading', // Whether to create missing heading
      'newNoteFolder', // Folder for new note
    ]

    // Extract TemplateRunner args from frontmatter
    if (data?.frontmatter) {
      templateRunnerArgKeys.forEach((key) => {
        if (data.frontmatter[key] !== undefined) {
          templateRunnerArgs[key] = data.frontmatter[key]
        }
      })
    }

    // Save templateBody to codeblock if provided
    if (data?.frontmatter?.templateBody !== undefined) {
      await saveTemplateBodyToTemplate(finalTemplateFilename, data.frontmatter.templateBody || '')
    }

    // Save TemplateRunner args to codeblock if any exist
    if (Object.keys(templateRunnerArgs).length > 0) {
      await saveTemplateRunnerArgsToTemplate(finalTemplateFilename, templateRunnerArgs)
    }

    // Save frontmatter if provided (but exclude TemplateRunner args and templateBody as they're in codeblocks)
    if (data?.frontmatter) {
      const frontmatterForSave = { ...data.frontmatter }
      // Remove TemplateRunner args and templateBody from frontmatter
      delete frontmatterForSave.templateBody
      templateRunnerArgKeys.forEach((key) => {
        delete frontmatterForSave[key]
      })
      await saveFrontmatterToTemplate(finalTemplateFilename, frontmatterForSave)
    }

    // Get template note for success message
    const templateNote = await getNoteByFilename(finalTemplateFilename)
    const templateTitle = templateNote?.title || finalTemplateFilename

    return {
      success: true,
      message: `Form saved successfully to "${templateTitle}"`,
      data: { templateFilename: finalTemplateFilename, templateTitle },
    }
  } catch (error) {
    logError(pluginJson, `handleSaveRequest error: ${JSP(error)}`)
    return {
      success: false,
      message: `Error saving form: ${error.message || String(error)}`,
      data: null,
    }
  }
}

/**
 * Save form fields to template as formfields code block
 * @param {string} templateFilename - The template filename
 * @param {Array<Object>} fields - The form fields array
 * @returns {Promise<void>}
 */
// Template I/O functions are now imported from templateIO.js

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
        // Close the window after successful submission
        if (returnValue !== null) {
          closeWindowFromCustomId(WEBVIEW_WINDOW_ID)
        }
        break
      default:
        await sendBannerMessage(WEBVIEW_WINDOW_ID, `Plugin received an unknown actionType: "${actionType}" command with data:\n${JSON.stringify(data)}`, 'ERROR')
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
 * Insert TemplateJS blocks into templateBody based on executeTiming
 * @param {string} templateBody - The base template body
 * @param {Array<Object>} formFields - The form fields array (may contain templatejs-block fields)
 * @returns {string} - The templateBody with TemplateJS blocks inserted
 */
// Form submission handling functions are now imported from formSubmission.js

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
// openFormWindow is now imported from windowManagement.js

/**
 * Export testRequestHandlers for direct testing
 */
export { testRequestHandlers }
