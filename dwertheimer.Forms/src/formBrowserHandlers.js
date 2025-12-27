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

// RequestResponse type definition (shared with requestHandlers.js)
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get list of form templates filtered by space
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

    for (const note of allNotes) {
      const type = note.frontmatterAttributes?.type
      if (type === 'template-form') {
        // Filter by space
        const isTeamspaceNote = note.filename?.startsWith('%%NotePlanCloud%%') || false
        const noteTeamspaceID = isTeamspaceNote ? parseTeamspaceFilename(note.filename || '').teamspaceID : null

        // Apply space filter
        if (spaceId !== '') {
          // Space filter is set - only include notes from that specific space
          if (spaceId === noteTeamspaceID) {
            const title = note.title || note.filename || ''
            if (title) {
              formTemplates.push({
                label: title,
                value: note.filename || '',
                filename: note.filename || '',
              })
            }
          }
        } else {
          // No space filter (Private) - only include private notes (non-teamspace)
          if (!isTeamspaceNote) {
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
      }
    }

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
 * Get form fields for a specific template
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

    // Load form fields from code block
    const formFields = await loadCodeBlockFromNote<Array<any>>(templateFilename, 'formfields', pluginJson.id, parseObjectString)

    if (!formFields || !Array.isArray(formFields)) {
      return {
        success: false,
        message: 'No form fields found in template',
        data: null,
      }
    }

    logDebug(pluginJson, `getFormFields: Loaded ${formFields.length} form fields`)
    return {
      success: true,
      data: formFields,
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
 * Handle opening FormBuilder from FormBrowserView
 * @param {Object} params - Request parameters (currently unused, but kept for consistency)
 * @returns {RequestResponse}
 */
export async function handleOpenFormBuilder(params: Object = {}): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleOpenFormBuilder: Opening FormBuilder`)

    // Open FormBuilder (no template title = new form)
    await openFormBuilder()

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
