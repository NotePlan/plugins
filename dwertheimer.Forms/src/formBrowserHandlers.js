// @flow
//--------------------------------------------------------------------------
// Form Browser Request Handlers
// Handlers for requests from FormBrowserView component
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { openFormBuilder } from './NPTemplateForm'
import { handleSubmitButtonClick } from './formSubmission'
import { loadCodeBlockFromNote } from '@helpers/codeBlocks'
import { parseObjectString } from '@helpers/stringTransforms'
import { logDebug, logError } from '@helpers/dev'
import { getNoteByFilename } from '@helpers/note'
import { parseTeamspaceFilename } from '@helpers/teamspace'
import { getFolderFromFilename } from '@helpers/folders'

// RequestResponse type definition (shared with requestHandlers.js)
// NOTE: Handler functions return this format. The router wraps it in a RESPONSE message.
// React components receive just the data (result.data) when the promise resolves.
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get list of form templates filtered by space and @Forms folder
 * @param {Object} params - Request parameters
 * @param {string} params.space - Space ID to filter by (empty string = Private, teamspace ID = specific teamspace)
 * @returns {RequestResponse}
 */
export function getFormTemplates(params: { space?: string } = {}): RequestResponse {
  try {
    const spaceId = params.space ?? '' // Empty string = Private (default)
    logDebug(pluginJson, `getFormTemplates: space=${spaceId || 'Private'}`)

    const allNotes = DataStore.projectNotes
    const formTemplates = []
    let templateFormCount = 0
    let inFormsFolderCount = 0
    let spaceMatchCount = 0

    for (const note of allNotes) {
      const type = note.frontmatterAttributes?.type
      if (type === 'template-form') {
        templateFormCount++
        // Get the folder path from the note's filename
        const noteFolder = getFolderFromFilename(note.filename || '')

        // Check if note is in teamspace
        const isTeamspaceNote = note.filename?.startsWith('%%NotePlanCloud%%') || false
        const noteTeamspaceID = isTeamspaceNote ? parseTeamspaceFilename(note.filename || '').teamspaceID : null

        // Apply space filter first
        if (spaceId === '') {
          // Private space: only include private notes (non-teamspace)
          if (isTeamspaceNote) {
            logDebug(pluginJson, `getFormTemplates: Skipping teamspace note "${note.title || note.filename}" for Private space`)
            continue
          }
        } else {
          // Teamspace: only include notes from that specific teamspace
          if (!isTeamspaceNote || noteTeamspaceID !== spaceId) {
            logDebug(pluginJson, `getFormTemplates: Skipping note "${note.title || note.filename}" - teamspaceID="${String(noteTeamspaceID || 'null')}", expected="${spaceId}"`)
            continue
          }
        }

        // Check if note is in the @Forms folder (or a subfolder of @Forms)
        // For Private: noteFolder should start with '@Forms' or be exactly '@Forms'
        // For teamspace: noteFolder should start with '%%NotePlanCloud%%{teamspaceID}/@Forms'
        let isInFormsFolder = false
        if (spaceId === '') {
          // Private: check if folder is '@Forms' or starts with '@Forms/'
          isInFormsFolder = noteFolder === '@Forms' || noteFolder.startsWith('@Forms/')
        } else {
          // Teamspace: check if folder starts with '%%NotePlanCloud%%{teamspaceID}/@Forms'
          // Note: getFolderFromFilename may return paths with or without the leading slash after %%NotePlanCloud%%
          const expectedPrefix1 = `%%NotePlanCloud%%${spaceId}/@Forms`
          const expectedPrefix2 = `%%NotePlanCloud%%/${spaceId}/@Forms`
          isInFormsFolder =
            noteFolder === expectedPrefix1 || noteFolder.startsWith(`${expectedPrefix1}/`) || noteFolder === expectedPrefix2 || noteFolder.startsWith(`${expectedPrefix2}/`)
        }

        if (!isInFormsFolder) {
          logDebug(pluginJson, `getFormTemplates: Skipping note "${note.title || note.filename}" - folder="${noteFolder}", space="${spaceId || 'Private'}"`)
          continue // Skip notes not in @Forms folder
        }
        inFormsFolderCount++
        spaceMatchCount++

        // Note passed all filters - add it to the list
        const title = note.title || note.filename || ''
        if (title) {
          formTemplates.push({
            label: title,
            value: note.filename || '',
            filename: note.filename || '',
          })
        }
      }
    }

    logDebug(
      pluginJson,
      `getFormTemplates: Scanned ${templateFormCount} template-form notes, ${inFormsFolderCount} in @Forms folder, ${spaceMatchCount} matched space filter, ${formTemplates.length} added to results`,
    )

    // Sort by title
    formTemplates.sort((a, b) => a.label.localeCompare(b.label))

    logDebug(pluginJson, `getFormTemplates: Found ${formTemplates.length} templates`)
    return {
      success: true,
      data: formTemplates,
    }
  } catch (error) {
    logError(pluginJson, `getFormTemplates: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to get form templates: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get form fields and frontmatter for a specific template
 * @param {Object} params - Request parameters
 * @param {string} params.templateFilename - The template filename
 * @returns {RequestResponse}
 */
export async function getFormFields(params: { templateFilename?: string } = {}): Promise<RequestResponse> {
  try {
    const templateFilename = params.templateFilename
    if (!templateFilename) {
      return {
        success: false,
        message: 'templateFilename is required',
        data: null,
      }
    }

    logDebug(pluginJson, `getFormFields: templateFilename="${templateFilename}"`)

    // Get the template note to read frontmatter
    const templateNote = await getNoteByFilename(templateFilename)
    if (!templateNote) {
      return {
        success: false,
        message: `Template not found: ${templateFilename}`,
        data: null,
      }
    }

    // Load form fields from code block
    const formFields = await loadCodeBlockFromNote<Array<any>>(templateFilename, 'formfields', pluginJson.id, parseObjectString)

    if (!formFields || !Array.isArray(formFields)) {
      return {
        success: false,
        message: 'No form fields found in template',
        data: null,
      }
    }

    // Get frontmatter attributes
    const frontmatter = templateNote.frontmatterAttributes || {}

    logDebug(pluginJson, `getFormFields: Loaded ${formFields.length} form fields`)
    return {
      success: true,
      data: {
        formFields,
        frontmatter,
      },
    }
  } catch (error) {
    logError(pluginJson, `getFormFields: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to get form fields: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Handle form submission from FormBrowserView
 * @param {Object} params - Request parameters
 * @param {string} params.templateFilename - The template filename
 * @param {Object} params.formValues - The form values
 * @param {string} params.windowId - Optional window ID
 * @returns {RequestResponse}
 */
export async function handleSubmitForm(params: { templateFilename?: string, formValues?: Object, windowId?: string } = {}): Promise<RequestResponse> {
  try {
    const { templateFilename, formValues, windowId } = params
    if (!templateFilename || !formValues) {
      return {
        success: false,
        message: 'templateFilename and formValues are required',
        data: null,
      }
    }

    logDebug(pluginJson, `handleSubmitForm: templateFilename="${templateFilename}"`)

    // Get the template note to extract processing information
    const templateNote = await getNoteByFilename(templateFilename)
    if (!templateNote) {
      return {
        success: false,
        message: `Template not found: ${templateFilename}`,
        data: null,
      }
    }

    // Get frontmatter attributes
    const fm = templateNote.frontmatterAttributes || {}
    const processingMethod = fm?.processingMethod || (fm?.receivingTemplateTitle ? 'form-processor' : null)

    if (!processingMethod) {
      return {
        success: false,
        message: 'Template does not have a processingMethod set',
        data: null,
      }
    }

    // Call the form submission handler
    // handleSubmitButtonClick expects (data, reactWindowData) but we'll create a minimal reactWindowData
    const submitData = {
      type: 'submit',
      formValues,
      windowId: windowId || '',
      processingMethod,
      receivingTemplateTitle: fm?.receivingTemplateTitle || '',
      getNoteTitled: fm?.getNoteTitled || '',
      location: fm?.location || 'append',
      writeUnderHeading: fm?.writeUnderHeading || '',
      replaceNoteContents: fm?.replaceNoteContents || false,
      createMissingHeading: fm?.createMissingHeading !== false,
      newNoteTitle: fm?.newNoteTitle || '',
      newNoteFolder: fm?.newNoteFolder || '',
    }

    // Create minimal reactWindowData for handleSubmitButtonClick
    // $FlowFixMe[prop-missing] - PassedData type requires more properties, but handleSubmitButtonClick only needs pluginData
    const reactWindowData = {
      pluginData: {
        formFields: [], // Not needed for submission
      },
      componentPath: '',
      debug: false,
      logProfilingMessage: false,
      returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFormSubmitFromHTMLView' },
    }

    const result = await handleSubmitButtonClick(submitData, reactWindowData)

    // handleSubmitButtonClick returns PassedData | null, so check if it's not null
    if (result) {
      return {
        success: true,
        message: 'Form submitted successfully',
        data: result,
      }
    } else {
      return {
        success: false,
        message: 'Failed to submit form',
        data: null,
      }
    }
  } catch (error) {
    logError(pluginJson, `handleSubmitForm: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to submit form: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Handle creating a new form from FormBrowserView (skips the chooser dialog)
 * @param {Object} _params - Request parameters (currently unused)
 * @returns {RequestResponse}
 */
export async function handleCreateNewForm(_params: Object = {}): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleCreateNewForm: Creating new form directly`)

    // Import helpers (CommandBar and DataStore are global in NotePlan, no need to import)
    const { showMessage } = require('@helpers/userInput')
    const { getNoteByFilename } = require('@helpers/note')
    const { openFormBuilderWindow } = require('./windowManagement')
    const { ensureFrontmatter, updateFrontMatterVars } = require('@helpers/NPFrontMatter')

    // Prompt for new form title (CommandBar is global)
    let newTitle = await CommandBar.textPrompt('New Form Template', 'Enter template title:', '')
    logDebug(pluginJson, `handleCreateNewForm: User entered title: "${String(newTitle)}"`)
    if (!newTitle || typeof newTitle === 'boolean') {
      logDebug(pluginJson, `handleCreateNewForm: User cancelled or empty title, returning`)
      return {
        success: false,
        message: 'Form creation cancelled',
        data: null,
      }
    }

    // Append "Form" to title if it doesn't already contain "form" (case-insensitive)
    if (!/form/i.test(newTitle)) {
      newTitle = `${newTitle} Form`
      logDebug(pluginJson, `handleCreateNewForm: Appended "Form" to title, new title: "${newTitle}"`)
    }

    // Create folder path: @Forms/{form name}
    const formFolderPath = `@Forms/${newTitle}`
    logDebug(pluginJson, `handleCreateNewForm: Creating form in folder "${formFolderPath}"`)

    // Create new note in Forms subfolder
    const filename = DataStore.newNote(newTitle, formFolderPath)
    logDebug(pluginJson, `handleCreateNewForm: DataStore.newNote returned filename: "${filename || 'null'}"`)
    if (!filename) {
      logError(pluginJson, `handleCreateNewForm: Failed to create template "${newTitle}"`)
      await showMessage(`Failed to create template "${newTitle}"`)
      return {
        success: false,
        message: `Failed to create template "${newTitle}"`,
        data: null,
      }
    }

    const templateNote = await getNoteByFilename(filename)
    if (!templateNote) {
      logError(pluginJson, `handleCreateNewForm: Could not find note with filename: ${filename}`)
      await showMessage(`Failed to open newly created template "${newTitle}"`)
      return {
        success: false,
        message: `Failed to open newly created template "${newTitle}"`,
        data: null,
      }
    }

    // Set frontmatter for new template
    ensureFrontmatter(templateNote, true, newTitle)
    const encodedNewTitle = encodeURIComponent(newTitle)
    const newLaunchLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=${encodedNewTitle}`
    const newFormEditLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Form%20Builder/Editor&arg0=${encodedNewTitle}`

    updateFrontMatterVars(templateNote, {
      type: 'template-form',
      windowTitle: newTitle,
      launchLink: newLaunchLink,
      formEditLink: newFormEditLink,
    })

    // Update cache to ensure note is available
    DataStore.updateCache(templateNote, true)

    // Open FormBuilder with the new form
    await openFormBuilderWindow({
      formFields: [],
      templateFilename: filename,
      templateTitle: newTitle,
    })

    return {
      success: true,
      message: `Form "${newTitle}" created successfully`,
      data: { templateFilename: filename, templateTitle: newTitle },
    }
  } catch (error) {
    logError(pluginJson, `handleCreateNewForm: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to create new form: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Handle opening FormBuilder from FormBrowserView
 * @param {Object} params - Request parameters
 * @param {string} params.templateTitle - Optional template title to open in FormBuilder
 * @param {string} params.initialReceivingTemplateTitle - Optional receiving template title
 * @returns {RequestResponse}
 */
export async function handleOpenFormBuilder(params: { templateTitle?: string, initialReceivingTemplateTitle?: string } = {}): Promise<RequestResponse> {
  try {
    const { templateTitle, initialReceivingTemplateTitle } = params
    logDebug(
      pluginJson,
      `handleOpenFormBuilder: Opening FormBuilder, templateTitle="${templateTitle || ''}", initialReceivingTemplateTitle="${initialReceivingTemplateTitle || ''}"`,
    )

    if (templateTitle) {
      // Open existing form in FormBuilder
      // The receivingTemplateTitle will be read from the note's frontmatter by openFormBuilder
      // But if initialReceivingTemplateTitle is provided, it will be used instead
      await openFormBuilder(templateTitle)
    } else {
      // Open FormBuilder for new form
      await openFormBuilder()
    }

    return {
      success: true,
      message: 'FormBuilder opened',
      data: null,
    }
  } catch (error) {
    logError(pluginJson, `handleOpenFormBuilder: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to open FormBuilder: ${error.message}`,
      data: null,
    }
  }
}
