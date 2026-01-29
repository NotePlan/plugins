// @flow
//--------------------------------------------------------------------------
// Form Browser Request Handlers
// Handlers for requests from FormBrowserView component
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { openFormBuilder } from './NPTemplateForm'
import { handleSubmitButtonClick } from './formSubmission'
import { findDuplicateFormTemplates } from './templateIO'
import { openFormBuilderWindow } from './windowManagement'
import { loadCodeBlockFromNote } from '@helpers/codeBlocks'
import { parseObjectString, stripDoubleQuotes } from '@helpers/stringTransforms'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { getNoteByFilename, getNote } from '@helpers/note'
import { parseTeamspaceFilename } from '@helpers/teamspace'
import { getFolderFromFilename } from '@helpers/folders'
import { showMessage } from '@helpers/userInput'
import { sendBannerMessage } from '@helpers/HTMLView'
import { getAllTeamspaceIDsAndTitles } from '@helpers/NPTeamspace'
import { ensureFrontmatter, updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { waitForCondition } from '@helpers/promisePolyfill'

// RequestResponse type definition (shared with requestHandlers.js)
// NOTE: Handler functions return this format. The router wraps it in a RESPONSE message.
// React components receive just the data (result.data) when the promise resolves.
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get list of form templates filtered by space and @Forms or @Templates folder
 * @param {Object} params - Request parameters
 * @param {string} params.space - Space ID to filter by (empty string = Private, teamspace ID = specific teamspace)
 * @returns {RequestResponse}
 */
export function getFormTemplates(params: { space?: string } = {}): RequestResponse {
  try {
    const spaceId = params.space ?? '' // Empty string = Private (default), "__all__" = all spaces
    const showAll = spaceId === '__all__'
    logDebug(pluginJson, `getFormTemplates: space=${spaceId || 'Private'}, showAll=${String(showAll)}`)

    // Get teamspace titles for lookup
    const teamspaces = getAllTeamspaceIDsAndTitles()
    const teamspaceMap = new Map<string, string>()
    teamspaces.forEach((ts) => {
      teamspaceMap.set(ts.id, ts.title)
    })

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

        // Apply space filter (skip if showAll is true)
        if (!showAll) {
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
        }

        // Check if note is in the @Forms folder OR @Templates folder (or subfolders)
        // For Private: noteFolder should start with '@Forms' or '@Templates' or be exactly '@Forms' or '@Templates'
        // For teamspace: noteFolder should start with '%%NotePlanCloud%%/{teamspaceID}/@Forms' or '%%NotePlanCloud%%/{teamspaceID}/@Templates'
        // Note: We check both formats (with and without the /) for backward compatibility, but the correct format is with the /
        let isInFormsFolder = false
        let isInTemplatesFolder = false
        if (showAll) {
          // When showing all, check folder based on the note's actual space
          if (isTeamspaceNote && noteTeamspaceID) {
            // Teamspace note: check if folder starts with '%%NotePlanCloud%%/{teamspaceID}/@Forms' or '@Templates'
            const formsPrefix1 = `%%NotePlanCloud%%${noteTeamspaceID}/@Forms`
            const formsPrefix2 = `%%NotePlanCloud%%/${noteTeamspaceID}/@Forms`
            const templatesPrefix1 = `%%NotePlanCloud%%${noteTeamspaceID}/@Templates`
            const templatesPrefix2 = `%%NotePlanCloud%%/${noteTeamspaceID}/@Templates`
            isInFormsFolder =
              noteFolder === formsPrefix1 || noteFolder.startsWith(`${formsPrefix1}/`) || noteFolder === formsPrefix2 || noteFolder.startsWith(`${formsPrefix2}/`)
            isInTemplatesFolder =
              noteFolder === templatesPrefix1 || noteFolder.startsWith(`${templatesPrefix1}/`) || noteFolder === templatesPrefix2 || noteFolder.startsWith(`${templatesPrefix2}/`)
          } else {
            // Private note: check if folder is '@Forms' or '@Templates' or starts with '@Forms/' or '@Templates/'
            isInFormsFolder = noteFolder === '@Forms' || noteFolder.startsWith('@Forms/')
            isInTemplatesFolder = noteFolder === '@Templates' || noteFolder.startsWith('@Templates/')
          }
        } else if (spaceId === '') {
          // Private: check if folder is '@Forms' or '@Templates' or starts with '@Forms/' or '@Templates/'
          isInFormsFolder = noteFolder === '@Forms' || noteFolder.startsWith('@Forms/')
          isInTemplatesFolder = noteFolder === '@Templates' || noteFolder.startsWith('@Templates/')
        } else {
          // Teamspace: check if folder starts with '%%NotePlanCloud%%/{teamspaceID}/@Forms' or '@Templates' (correct format)
          // Note: getFolderFromFilename may return paths with or without the leading slash after %%NotePlanCloud%%
          // We check both for backward compatibility, but the correct format is: %%NotePlanCloud%%/{teamspaceID}/...
          const formsPrefix1 = `%%NotePlanCloud%%${spaceId}/@Forms` // Incorrect format (for backward compatibility)
          const formsPrefix2 = `%%NotePlanCloud%%/${spaceId}/@Forms` // Correct format
          const templatesPrefix1 = `%%NotePlanCloud%%${spaceId}/@Templates` // Incorrect format (for backward compatibility)
          const templatesPrefix2 = `%%NotePlanCloud%%/${spaceId}/@Templates` // Correct format
          isInFormsFolder =
            noteFolder === formsPrefix1 || noteFolder.startsWith(`${formsPrefix1}/`) || noteFolder === formsPrefix2 || noteFolder.startsWith(`${formsPrefix2}/`)
          isInTemplatesFolder =
            noteFolder === templatesPrefix1 || noteFolder.startsWith(`${templatesPrefix1}/`) || noteFolder === templatesPrefix2 || noteFolder.startsWith(`${templatesPrefix2}/`)
        }

        if (!isInFormsFolder && !isInTemplatesFolder) {
          logDebug(pluginJson, `getFormTemplates: Skipping note "${note.title || note.filename}" - folder="${noteFolder}", space="${spaceId || 'Private'}" (not in @Forms or @Templates)`)
          continue // Skip notes not in @Forms or @Templates folder
        }
        inFormsFolderCount++
        spaceMatchCount++

        // Note passed all filters - add it to the list
        const title = note.title || note.filename || ''
        if (title) {
          // Determine space info for this template
          const templateSpaceId = isTeamspaceNote && noteTeamspaceID ? noteTeamspaceID : ''
          const templateSpaceTitle = isTeamspaceNote && noteTeamspaceID ? teamspaceMap.get(noteTeamspaceID) || 'Unknown Teamspace' : 'Private'
          
          formTemplates.push({
            label: title,
            value: note.filename || '',
            filename: note.filename || '',
            spaceId: templateSpaceId,
            spaceTitle: templateSpaceTitle,
          })
        }
      }
    }

    logDebug(
      pluginJson,
      `getFormTemplates: Scanned ${templateFormCount} template-form notes, ${inFormsFolderCount} in @Forms or @Templates folder, ${spaceMatchCount} matched space filter, ${formTemplates.length} added to results`,
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
export async function getFormFields(params: { templateFilename?: string, templateTitle?: string, windowId?: string } = {}): Promise<RequestResponse> {
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
    
    // Check for duplicate titles if templateTitle is provided
    const templateTitle = params.templateTitle || templateNote.title
    if (templateTitle) {
      const duplicates = findDuplicateFormTemplates(templateTitle)
      if (duplicates.length > 1) {
        // Multiple forms with same title found - include warning in response
        const duplicateFilenames = duplicates.map((d) => d.value).join(', ')
        const warningMsg = `⚠️ WARNING: Multiple forms found with the title "${templateTitle}". This may cause confusion. Duplicate files: ${duplicates.length} found. Please rename one of these forms to avoid conflicts.`
        logWarn(pluginJson, `getFormFields: Found ${duplicates.length} forms with title "${templateTitle}": ${duplicateFilenames}`)
        
        // Send banner message to React window if windowId is provided
        if (params.windowId && typeof params.windowId === 'string' && params.windowId.length > 0) {
          // $FlowFixMe[incompatible-call] - We've checked that windowId is a string above
          await sendBannerMessage(params.windowId, warningMsg, 'WARN', 10000)
        }
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
export async function handleSubmitForm(params: { templateFilename?: string, formValues?: Object, windowId?: string, keepOpenOnSubmit?: boolean } = {}): Promise<RequestResponse> {
  try {
    const { templateFilename, formValues, windowId, keepOpenOnSubmit } = params
    if (!templateFilename || !formValues) {
      return {
        success: false,
        message: 'templateFilename and formValues are required',
        data: null,
      }
    }

    logDebug(pluginJson, `handleSubmitForm: templateFilename="${templateFilename}", keepOpenOnSubmit=${String(keepOpenOnSubmit || false)}`)

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

    // For run-js-only, we don't need receivingTemplateTitle or templateBody validation
    // TemplateJS blocks come from form fields, not from templateBody

    // Call the form submission handler
    // handleSubmitButtonClick expects (data, reactWindowData) but we'll create a minimal reactWindowData
    // Strip quotes from string values that may have been stored with quotes in frontmatter
    // receivingTemplateTitle can come from formValues (dynamic) or frontmatter (static)
    const receivingTemplateTitleFromForm = formValues?.receivingTemplateTitle || ''
    const receivingTemplateTitleFromFrontmatter = stripDoubleQuotes(fm?.receivingTemplateTitle || '') || ''
    const receivingTemplateTitle = receivingTemplateTitleFromForm || receivingTemplateTitleFromFrontmatter
    
    const submitData = {
      type: 'submit',
      formValues,
      windowId: windowId || '',
      processingMethod,
      receivingTemplateTitle: receivingTemplateTitle,
      getNoteTitled: stripDoubleQuotes(fm?.getNoteTitled || '') || '',
      location: fm?.location || 'append',
      writeUnderHeading: stripDoubleQuotes(fm?.writeUnderHeading || '') || '',
      replaceNoteContents: fm?.replaceNoteContents || false,
      createMissingHeading: fm?.createMissingHeading !== false,
      newNoteTitle: stripDoubleQuotes(fm?.newNoteTitle || '') || '',
      newNoteFolder: stripDoubleQuotes(fm?.newNoteFolder || '') || '',
    }

    // Load formFields from template note (needed for run-js-only to find TemplateJS blocks and validation)
    let formFields: Array<any> = []
    try {
      const loadedFields = await loadCodeBlockFromNote<Array<any>>(templateFilename, 'formfields', pluginJson.id, parseObjectString)
      if (loadedFields && Array.isArray(loadedFields)) {
        formFields = loadedFields
      }
    } catch (error) {
      logError(pluginJson, `handleSubmitForm: Error loading formFields: ${error.message}`)
      // Continue without formFields - will fail validation if run-js-only needs them
    }

    // Validate that all form fields are present in formValues (even if empty)
    // Conditional-values are resolved in prepareFormValuesForRendering; do not add them here
    if (formFields && formFields.length > 0) {
      const missingFields: Array<string> = []
      formFields.forEach((field) => {
        if (field.type === 'conditional-values') return
        if (field.key && !(field.key in formValues)) {
          missingFields.push(field.key)
          // Add missing field with empty value
          formValues[field.key] = field.default ?? field.value ?? ''
        }
      })
      if (missingFields.length > 0) {
        logDebug(pluginJson, `handleSubmitForm: Added ${missingFields.length} missing field(s) to formValues: ${missingFields.join(', ')}`)
      }
    }

    // Create minimal reactWindowData for handleSubmitButtonClick
    // $FlowFixMe[prop-missing] - PassedData type requires more properties, but handleSubmitButtonClick only needs pluginData
    const reactWindowData = {
      pluginData: {
        formFields, // Include formFields so TemplateJS blocks can be found for run-js-only
      },
      componentPath: '',
      debug: false,
      logProfilingMessage: false,
      returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFormSubmitFromHTMLView' },
    }

    const result = await handleSubmitButtonClick(submitData, reactWindowData)

    // Check for errors in result
    if (!result.success) {
      // Extract error message
      let errorMessage = result.formSubmissionError || 'Template execution failed.'
      if (!result.formSubmissionError && result.aiAnalysisResult) {
        // Extract a brief summary from AI analysis (first line or first sentence)
        const aiMsg = result.aiAnalysisResult
        const firstLine = aiMsg.split('\n')[0] || aiMsg.substring(0, 200)
        errorMessage = `Template error: ${firstLine}`
      }
      
      logError(pluginJson, `handleSubmitForm: Form submission failed with error: ${errorMessage}`)
      // Return error info in data so FormBrowserView can access it even when success=false
      return {
        success: false,
        message: errorMessage,
        data: {
          formSubmissionError: result.formSubmissionError,
          aiAnalysisResult: result.aiAnalysisResult,
          processingMethod,
        },
      }
    }

    // Success case
    // Determine note title based on processing method for success dialog
    let noteTitle = ''
    if (processingMethod === 'create-new') {
      noteTitle = submitData.newNoteTitle || ''
    } else if (processingMethod === 'write-existing') {
      noteTitle = submitData.getNoteTitled || ''
    }
    // For form-processor and run-js-only, we don't know the note title, so leave it empty

    return {
      success: true,
      message: 'Form submitted successfully',
      data: {
        noteTitle,
        processingMethod,
      },
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
 * Handle creating a new form from FormBrowserView
 * @param {Object} params - Request parameters
 * @param {string} params.formName - The form name (will have "Form" appended if not present)
 * @param {string} params.space - The space ID (empty string = Private, teamspace ID = specific teamspace)
 * @returns {RequestResponse}
 */
export async function handleCreateNewForm(params: { formName?: string, space?: string } = {}): Promise<RequestResponse> {
  try {
    const { formName, space = '' } = params
    logDebug(pluginJson, `handleCreateNewForm: Creating new form, formName="${formName || ''}", space="${space || 'Private'}"`)

    if (!formName || typeof formName !== 'string' || !formName.trim()) {
      logDebug(pluginJson, `handleCreateNewForm: No form name provided, returning`)
      return {
        success: false,
        message: 'Form name is required',
        data: null,
      }
    }

    // Append "Form" to title if it doesn't already contain "form" (case-insensitive)
    let newTitle = formName.trim()
    if (!/form/i.test(newTitle)) {
      newTitle = `${newTitle} Form`
      logDebug(pluginJson, `handleCreateNewForm: Appended "Form" to title, new title: "${newTitle}"`)
    }

    // Create folder path based on space
    // For Private: @Forms/{form name}
    // For teamspace: %%NotePlanCloud%%/{teamspaceID}/@Forms/{form name}
    // Note: teamspace folder format requires / after %%NotePlanCloud%%
    let formFolderPath: string
    if (space && space.trim()) {
      // Teamspace: construct path with teamspace prefix (note the / after %%NotePlanCloud%%)
      formFolderPath = `%%NotePlanCloud%%/${space}/@Forms/${newTitle}`
    } else {
      // Private: use standard folder path
      formFolderPath = `@Forms/${newTitle}`
    }
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

    // Wait for the note to appear in the cache (especially important for teamspace notes)
    // Teamspace notes may take a moment to be indexed after creation
    logDebug(pluginJson, `handleCreateNewForm: Waiting for note to appear in cache...`)
    const noteFound = await waitForCondition(
      () => {
        const note = DataStore.projectNoteByFilename(filename)
        return note != null
      },
      { maxWaitMs: 3000, checkIntervalMs: 100 },
    )

    if (!noteFound) {
      logError(pluginJson, `handleCreateNewForm: Note did not appear in cache within timeout: ${filename}`)
      await showMessage(`Note was created but could not be found. Please try again.`)
      return {
        success: false,
        message: `Note was created but could not be found: ${filename}`,
        data: null,
      }
    }

    // Now get the note (should be available now)
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

    // Open FormBuilder with the new form (pass isNewForm: true so default comment field is added)
    await openFormBuilderWindow({
      formFields: [],
      templateFilename: filename,
      templateTitle: newTitle,
      isNewForm: true,
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

/**
 * Handle opening a note by title from FormBrowserView
 * @param {Object} params - Request parameters
 * @param {string} params.noteTitle - The note title to open
 * @returns {Promise<RequestResponse>}
 */
export async function handleOpenNoteByTitle(params: { noteTitle?: string } = {}): Promise<RequestResponse> {
  try {
    const { noteTitle } = params
    if (!noteTitle) {
      return {
        success: false,
        message: 'noteTitle is required',
        data: null,
      }
    }

    logDebug(pluginJson, `handleOpenNoteByTitle: noteTitle="${noteTitle}"`)

    // Find note by title (getNote returns a Promise)
    const note = await getNote(noteTitle)
    if (!note) {
      return {
        success: false,
        message: `Note not found: ${noteTitle}`,
        data: null,
      }
    }

    // Open the note in the editor
    Editor.openNoteByFilename(note.filename || '')

    return {
      success: true,
      message: 'Note opened successfully',
      data: null,
    }
  } catch (error) {
    logError(pluginJson, `handleOpenNoteByTitle: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to open note: ${error.message}`,
      data: null,
    }
  }
}
