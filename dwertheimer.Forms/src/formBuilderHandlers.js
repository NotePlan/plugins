// @flow
//--------------------------------------------------------------------------
// Form Builder Request Handlers
// Handlers for requests from FormBuilder component
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getGlobalSharedData } from '../../helpers/HTMLView'
import { createProcessingTemplate } from './ProcessingTemplate'
import { openFormBuilder } from './NPTemplateForm'
import { FORMBUILDER_WINDOW_ID } from './windowManagement'
import {
  formatFormFieldsAsCodeBlock,
  getFormTemplateList,
  loadTemplateBodyFromTemplate,
  loadTemplateRunnerArgsFromTemplate,
  saveFormFieldsToTemplate,
  saveTemplateBodyToTemplate,
  saveTemplateRunnerArgsToTemplate,
  saveCustomCSSToTemplate,
  updateReceivingTemplateWithFields,
} from './templateIO'
import { removeEmptyLinesFromNote, updateFormLinksInNote } from './requestHandlers'
import { getNoteByFilename, getNote } from '@helpers/note'
import { focusHTMLWindowIfAvailable } from '@helpers/NPWindows'
import { updateFrontMatterVars, ensureFrontmatter, endOfFrontmatterLineIndex } from '@helpers/NPFrontMatter'
import { saveCodeBlockToNote, loadCodeBlockFromNote } from '@helpers/codeBlocks'
import { parseObjectString, stripDoubleQuotes } from '@helpers/stringTransforms'
import { replaceContentUnderHeading } from '@helpers/NPParagraph'
import { waitForCondition } from '@helpers/promisePolyfill'
import { getFolderFromFilename } from '@helpers/folders'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

// RequestResponse type definition (shared with requestHandlers.js)
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Handle creating a processing template from FormBuilder
 * @param {Object} params - Request parameters
 * @returns {RequestResponse}
 */
export async function handleCreateProcessingTemplate(params: Object): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleCreateProcessingTemplate: params=${JSON.stringify(params)}`)

    const options = {
      formTemplateTitle: params.formTemplateTitle,
      formTemplateFilename: params.formTemplateFilename,
      suggestedProcessingTitle: params.suggestedProcessingTitle,
      formLaunchLink: params.formLaunchLink,
      formEditLink: params.formEditLink,
    }

    const result = await createProcessingTemplate(options)

    if (result && result.processingTitle) {
      // Bring the Form Builder window back to the front
      focusHTMLWindowIfAvailable(FORMBUILDER_WINDOW_ID)

      const processingTitle = result.processingTitle || ''
      return {
        success: true,
        message: `Processing template "${processingTitle}" created successfully`,
        data: {
          processingTitle: processingTitle,
          processingFilename: result.processingFilename,
        },
      }
    } else {
      return {
        success: false,
        message: 'Processing template creation was cancelled or failed',
        data: null,
      }
    }
  } catch (error) {
    logError(pluginJson, `handleCreateProcessingTemplate: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to create processing template: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Handle opening a note from FormBuilder
 * @param {Object} params - Request parameters
 * @param {string} params.filename - The note filename to open (preferred)
 * @param {string} params.title - The note title to open (fallback if filename not provided)
 * @returns {RequestResponse}
 */
export async function handleOpenNote(params: { filename?: string, title?: string }): Promise<RequestResponse> {
  try {
    const filename = params.filename
    const title = params.title

    if (!filename && !title) {
      return {
        success: false,
        message: 'filename or title is required',
        data: null,
      }
    }

    if (filename) {
      logDebug(pluginJson, `handleOpenNote: Opening by filename="${filename}"`)
      // Open the note in the editor
      Editor.openNoteByFilename(filename)
      return {
        success: true,
        message: 'Note opened successfully',
        data: null,
      }
    } else if (title) {
      logDebug(pluginJson, `handleOpenNote: Opening by title="${title}"`)
      // Find note by title using getNote helper
      const note = await getNote(title)
      if (!note) {
        return {
          success: false,
          message: `Note not found: ${title}`,
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
    }

    return {
      success: false,
      message: 'No filename or title provided',
      data: null,
    }
  } catch (error) {
    logError(pluginJson, `handleOpenNote: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to open note: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Handle copying form URL to clipboard
 * @param {Object} params - Request parameters
 * @param {string} params.launchLink - The launch link URL to copy
 * @returns {RequestResponse}
 */
export function handleCopyFormUrl(params: { launchLink?: string }): RequestResponse {
  try {
    const launchLink = params.launchLink
    logDebug(pluginJson, `handleCopyFormUrl: launchLink="${String(launchLink || '')}"`)
    if (!launchLink) {
      logError(pluginJson, `handleCopyFormUrl: No launchLink provided in params`)
      return {
        success: false,
        message: 'No launch link provided',
        data: null,
      }
    }

    Clipboard.string = launchLink
    logDebug(pluginJson, `handleCopyFormUrl: Successfully copied to clipboard, Clipboard.string="${Clipboard.string}"`)
    return {
      success: true,
      message: 'Form URL copied to clipboard',
      data: null,
    }
  } catch (error) {
    logError(pluginJson, `handleCopyFormUrl: Error copying to clipboard: ${error.message || String(error)}`)
    return {
      success: false,
      message: `Failed to copy URL: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Handle duplicating a form template
 * @param {Object} params - Request parameters
 * @param {string} params.templateFilename - The source template filename
 * @param {string} params.templateTitle - The source template title
 * @param {string} params.receivingTemplateTitle - The receiving template title (if any)
 * @returns {RequestResponse}
 */
export async function handleDuplicateForm(params: { templateFilename?: string, templateTitle?: string, receivingTemplateTitle?: string }): Promise<RequestResponse> {
  try {
    const { templateFilename, templateTitle, receivingTemplateTitle } = params
    if (!templateFilename || !templateTitle) {
      return {
        success: false,
        message: 'Template filename and title are required',
        data: null,
      }
    }

    // Prompt for new name (suggest current name + " copy")
    const suggestedName = `${templateTitle} copy`
    const newTitle = await CommandBar.textPrompt('Duplicate Form', 'Enter new form title:', suggestedName)
    if (!newTitle || typeof newTitle === 'boolean') {
      return {
        success: false,
        message: 'Duplicate cancelled',
        data: null,
      }
    }

    // Read the current form template
    const sourceNote = await getNoteByFilename(templateFilename)
    if (!sourceNote) {
      return {
        success: false,
        message: `Could not find source form template: ${templateFilename}`,
        data: null,
      }
    }

    // Get folder from source template (use same folder as original, not a subfolder)
    const sourceFolder = getFolderFromFilename(templateFilename) || '@Forms'

    // Read all codeblocks from source
    const formFields = await loadCodeBlockFromNote<Array<Object>>(sourceNote, 'formfields', pluginJson.id, parseObjectString)
    const templateBody = await loadTemplateBodyFromTemplate(sourceNote)
    const templateRunnerArgs = await loadTemplateRunnerArgsFromTemplate(sourceNote)

    // Create new note with empty content (updateFormLinksInNote will add the heading and links)
    const newNoteContent = ''

    // Create new note in the same folder as the original (not inside the original's folder)
    const newFilename = DataStore.newNoteWithContent(newNoteContent, sourceFolder, `${newTitle}.md`)
    if (!newFilename) {
      return {
        success: false,
        message: `Failed to create duplicate form "${newTitle}"`,
        data: null,
      }
    }

    const newNote = await getNoteByFilename(newFilename)
    if (!newNote) {
      return {
        success: false,
        message: `Created duplicate form but could not open it: ${newFilename}`,
        data: null,
      }
    }

    // Update cache immediately after getting the note to ensure it's available
    const cachedNote = DataStore.updateCache(newNote, true)
    if (cachedNote) {
      logDebug(pluginJson, `handleDuplicateForm: Updated cache for newly created note "${newTitle}"`)
    }

    // Copy frontmatter using frontmatterAttributesArray to preserve order and all fields
    const sourceFrontmatterArray = sourceNote.frontmatterAttributesArray || []
    const encodedNewTitle = encodeURIComponent(newTitle)
    const newLaunchLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=${encodedNewTitle}`
    const newFormEditLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Form%20Builder/Editor&arg0=${encodedNewTitle}`

    // Prepare frontmatter for new note copy all fields from source, updating title-related ones
    const newFrontmatter: { [string]: string } = {}
    const fieldsToUpdate = {
      type: 'template-form',
      windowTitle: newTitle,
      // formTitle is left blank by default - user can fill it in later (don't copy from source)
      launchLink: newLaunchLink,
      formEditLink: newFormEditLink,
    }

    // Copy all frontmatter fields from source, preserving order
    for (const attr of sourceFrontmatterArray) {
      const key = attr.key
      // Skip title-related fields that we'll update
      if (!['type', 'windowTitle', 'formTitle', 'launchLink', 'formEditLink', 'title'].includes(key)) {
        newFrontmatter[key] = attr.value
      }
    }

    // Add/update the title-related fields
    Object.assign(newFrontmatter, fieldsToUpdate)

    // Update frontmatter - ensure frontmatter exists first
    ensureFrontmatter(newNote, true, newTitle)
    updateFrontMatterVars(newNote, newFrontmatter)

    // Update markdown links in body using replaceContentUnderHeading (works better than manual insertion)
    await updateFormLinksInNote(newNote, newTitle, newLaunchLink, newFormEditLink, undefined)

    // Copy codeblocks (these will be added after the heading)
    if (formFields && Array.isArray(formFields) && formFields.length > 0) {
      await saveCodeBlockToNote(newFilename, 'formfields', formFields, pluginJson.id, formatFormFieldsAsCodeBlock, false)
    }
    if (templateBody) {
      await saveCodeBlockToNote(newFilename, 'template:ignore templateBody', templateBody, pluginJson.id, null, false)
    }
    if (templateRunnerArgs) {
      await saveCodeBlockToNote(newFilename, 'template:ignore templateRunnerArgs', templateRunnerArgs, pluginJson.id, (obj) => JSON.stringify(obj, null, 2), false)
    }

    // Reload note after code blocks are saved to get latest content
    const noteAfterCodeBlocks = await getNoteByFilename(newFilename)
    if (noteAfterCodeBlocks) {
      // Update cache after code blocks are saved
      DataStore.updateCache(noteAfterCodeBlocks, true)
    }

    // Clean up: remove any duplicate title text and extra blank lines
    const finalNote = await getNoteByFilename(newFilename)
    if (finalNote) {
      // Remove text paragraphs that are just the title (duplicates)
      const titleText = newTitle.trim()
      const cleanedParas = finalNote.paragraphs.filter((p) => {
        // Keep frontmatter separators
        if (p.type === 'separator') return true
        // Remove text paragraphs that match the title exactly (these are unwanted duplicates)
        if (p.type === 'text' && p.content.trim() === titleText) return false
        return true
      })

      // Rebuild content without the duplicate title
      const contentParts = cleanedParas.map((p) => p.rawContent)
      finalNote.content = contentParts.join('\n')
      finalNote.updateParagraphs(finalNote.paragraphs)

      // Remove empty lines
      removeEmptyLinesFromNote(finalNote)

      // Update cache to ensure the note is available in DataStore.projectNotes
      // This is critical for getFormTemplateList() to find the newly created form
      const updatedNote = DataStore.updateCache(finalNote, true)
      if (updatedNote) {
        logDebug(pluginJson, `handleDuplicateForm: Updated cache for note "${newTitle}"`)
      } else {
        logWarn(pluginJson, `handleDuplicateForm: Failed to update cache for note "${newTitle}"`)
      }
    }

    // Wait for the note to be available in getFormTemplateList() before trying to open it
    // This handles race conditions where the note was created but not yet in DataStore.projectNotes
    logDebug(pluginJson, `handleDuplicateForm: Waiting for note "${newTitle}" to be available in cache...`)
    const noteAvailable = await waitForCondition(
      () => {
        const options = getFormTemplateList()
        const found = options.find((option) => option.label === newTitle)
        if (found) {
          logDebug(pluginJson, `handleDuplicateForm: Note "${newTitle}" is now available in cache`)
          return true
        }
        return false
      },
      { maxWaitMs: 3000, checkIntervalMs: 100 },
    )

    if (!noteAvailable) {
      logWarn(pluginJson, `handleDuplicateForm: Note "${newTitle}" not found in cache after waiting, but will try to open anyway`)
    }

    // If there's a receiving template, duplicate it too
    let newReceivingTemplateTitle = ''
    if (receivingTemplateTitle) {
      const receivingNote = await getNoteByFilename(receivingTemplateTitle)
      if (receivingNote) {
        // Create duplicate receiving template
        const receivingFolder = getFolderFromFilename(receivingTemplateTitle) || sourceFolder
        const newReceivingTitle = `${receivingTemplateTitle} copy`
        const newReceivingContent = receivingNote.content || ''
        const newReceivingFilename = DataStore.newNoteWithContent(newReceivingContent, receivingFolder, `${newReceivingTitle}.md`)
        if (newReceivingFilename) {
          const newReceivingNote = await getNoteByFilename(newReceivingFilename)
          if (newReceivingNote) {
            // Copy frontmatter from receiving template
            const receivingFrontmatter = receivingNote.frontmatterAttributes || {}
            const newReceivingFrontmatter: { [string]: string } = {}
            Object.keys(receivingFrontmatter).forEach((key) => {
              if (key !== 'title') {
                newReceivingFrontmatter[key] = String(receivingFrontmatter[key])
              }
            })
            updateFrontMatterVars(newReceivingNote, newReceivingFrontmatter)
            newReceivingTemplateTitle = newReceivingTitle

            // Update the form's receivingTemplateTitle
            updateFrontMatterVars(newNote, { receivingTemplateTitle: newReceivingTemplateTitle })
          }
        }
      }
    }

    // Open the new form in the Form Builder
    await openFormBuilder(newTitle)

    return {
      success: true,
      message: `Form "${newTitle}" duplicated successfully`,
      data: {
        newTemplateFilename: newFilename,
        newTemplateTitle: newTitle,
        newReceivingTemplateTitle: newReceivingTemplateTitle || undefined,
      },
    }
  } catch (error) {
    logError(pluginJson, `handleDuplicateForm: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to duplicate form: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Save frontmatter to template
 * @param {string} templateFilename - The template filename
 * @param {Object} frontmatter - The frontmatter object
 * @returns {Promise<void>}
 */
export async function saveFrontmatterToTemplate(templateFilename: string, frontmatter: Object): Promise<void> {
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

      // Allow empty strings for specific fields that users may want to blank out (formTitle, windowTitle)
      // receivingTemplateTitle should also be allowed to be empty (to clear it)
      // For other fields, skip empty strings to avoid writing "" to frontmatter
      const fieldsThatAllowEmpty = ['formTitle', 'windowTitle', 'receivingTemplateTitle']
      const shouldInclude = stringValue !== '' || fieldsThatAllowEmpty.includes(key)
      if (shouldInclude) {
        frontmatterAsStrings[key] = stringValue
        logDebug(pluginJson, `saveFrontmatterToTemplate: Including ${key}="${stringValue}" (empty string allowed: ${String(fieldsThatAllowEmpty.includes(key))})`)
      } else {
        logDebug(pluginJson, `saveFrontmatterToTemplate: Skipping ${key}="${stringValue}" (empty string not allowed for this field)`)
      }
    })

    // Update frontmatter (only non-empty values will be written)
    updateFrontMatterVars(templateNote, frontmatterAsStrings)
    logDebug(pluginJson, `saveFrontmatterToTemplate: Saved frontmatter to template`)
  } catch (error) {
    logError(pluginJson, `saveFrontmatterToTemplate error: ${error.message || String(error)}`)
    await showMessage(`Error saving frontmatter: ${error.message}`)
  }
}

/**
 * Handle save request from React (request/response pattern)
 * @param {Object} data - Request data containing fields, frontmatter, templateFilename, templateTitle
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
// Buffer buster padding for NotePlan's console
export async function handleSaveRequest(data: any): Promise<{ success: boolean, message?: string, data?: any }> {
  const saveId = `SAVE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  logDebug(pluginJson, `[${saveId}] handleSaveRequest: ENTRY - saveId=${saveId}`)
  logDebug(
    pluginJson,
    `[${saveId}] handleSaveRequest: data.fields: ${
      data?.fields ? `exists, type=${typeof data.fields}, isArray=${String(Array.isArray(data.fields))}, length=${data.fields.length || 0}` : 'missing'
    }`,
  )
  if (data?.fields?.length > 0) {
    logDebug(
      pluginJson,
      `[${saveId}] handleSaveRequest: First field: ${typeof data.fields[0] === 'string' ? data.fields[0].substring(0, 50) : JSON.stringify(data.fields[0]).substring(0, 50)}`,
    )
  }
  logDebug(pluginJson, `[${saveId}] handleSaveRequest: ENTRY - Starting save request`)
  try {
    // Get the template filename from the data passed from React, or fall back to reactWindowData
    const templateFilename = data?.templateFilename
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: templateFilename="${templateFilename}"`)
    // Try to get window data using the windowId from the request (if provided), otherwise use the default
    const windowId = data?.__windowId || FORMBUILDER_WINDOW_ID
    let fallbackTemplateFilename = ''
    try {
      // Note: getGlobalSharedData may hang if window is in bad state, but we can't use Promise.race
      // in NotePlan's JSContext (Promise is not a constructor). Just try it and let it fail naturally.
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Attempting to get window data for windowId="${windowId}"`)
      const reactWindowData = await getGlobalSharedData(windowId)
      fallbackTemplateFilename = reactWindowData?.pluginData?.templateFilename || ''
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Got window data, fallbackTemplateFilename="${fallbackTemplateFilename}"`)
    } catch (e) {
      // If we can't get window data, that's ok - we'll use templateFilename from data
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Could not get window data: ${e.message || String(e)}`)
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Could not get window data for windowId="${windowId}", using templateFilename from data`)
    }
    const finalTemplateFilename = templateFilename || fallbackTemplateFilename
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: finalTemplateFilename="${finalTemplateFilename}"`)

    if (!finalTemplateFilename) {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: ERROR: No template filename provided`)
      return {
        success: false,
        message: 'No template filename provided',
        data: null,
      }
    }

    // Check for missing or empty fields array
    logDebug(
      pluginJson,
      `[${saveId}] handleSaveRequest: Checking fields: data?.fields=${data?.fields ? 'exists' : 'missing'}, isArray=${String(Array.isArray(data?.fields))}, length=${
        data?.fields?.length || 0
      }`,
    )
    if (!data?.fields || !Array.isArray(data.fields) || data.fields.length === 0) {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: ERROR: No fields provided to save`)
      return {
        success: false,
        message: 'No fields provided to save',
        data: null,
      }
    }
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: Fields check passed, proceeding with save`)

    // Parse fields if they're strings (shouldn't happen, but just in case)
    logDebug(
      pluginJson,
      `[${saveId}] handleSaveRequest: Fields before parsing: type=${typeof data.fields}, isArray=${String(Array.isArray(data.fields))}, length=${
        data.fields?.length || 0
      }, firstFieldType=${data.fields?.[0] ? typeof data.fields[0] : 'none'}`,
    )
    let fieldsToSave = data.fields
    if (Array.isArray(fieldsToSave) && fieldsToSave.length > 0 && typeof fieldsToSave[0] === 'string') {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Fields are strings, attempting to parse`)
      logWarn(pluginJson, `[${saveId}] handleSaveRequest: Fields are strings, attempting to parse`)
      fieldsToSave = fieldsToSave.map((field) => {
        try {
          const parsed = typeof field === 'string' ? JSON.parse(field) : field
          logDebug(pluginJson, `[${saveId}] handleSaveRequest: Parsed field: ${JSON.stringify(parsed).substring(0, 100)}`)
          return parsed
        } catch (e) {
          logDebug(pluginJson, `[${saveId}] handleSaveRequest: Error parsing field: ${e.message}`)
          logError(pluginJson, `[${saveId}] handleSaveRequest: Error parsing field: ${e.message}`)
          return field
        }
      })
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Finished parsing ${fieldsToSave.length} fields`)
    } else {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Fields are already objects, no parsing needed`)
    }

    // Clean up markdown-preview fields: remove empty string values
    // Empty strings are used in the UI to maintain state, but shouldn't be saved
    fieldsToSave = fieldsToSave.map((field) => {
      if (field.type === 'markdown-preview') {
        const cleaned = { ...field }
        // Remove empty string values - they're just UI state markers
        if (cleaned.sourceNoteKey === '') {
          delete cleaned.sourceNoteKey
        }
        if (cleaned.markdownNoteFilename === '') {
          delete cleaned.markdownNoteFilename
        }
        if (cleaned.markdownNoteTitle === '') {
          delete cleaned.markdownNoteTitle
        }
        if (cleaned.markdownText === '') {
          delete cleaned.markdownText
        }
        // Also clean up old property names for backward compatibility
        if (cleaned.dependsOnNoteKey === '') {
          delete cleaned.dependsOnNoteKey
        }
        return cleaned
      }
      return field
    })

    logDebug(pluginJson, `[${saveId}] handleSaveRequest: About to save ${fieldsToSave.length} fields to template "${finalTemplateFilename}"`)

    await saveFormFieldsToTemplate(finalTemplateFilename, fieldsToSave)
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: Fields saved to template successfully`)

    // Extract TemplateRunner processing variables from frontmatter
    // These contain template tags and should be stored in codeblock, not frontmatter
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: Creating templateRunnerArgs object`)
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
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: Checking if frontmatter exists: ${data?.frontmatter ? 'yes' : 'no'}`)
    if (data?.frontmatter) {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Extracting TemplateRunner args from frontmatter`)
      templateRunnerArgKeys.forEach((key) => {
        if (data.frontmatter[key] !== undefined) {
          templateRunnerArgs[key] = data.frontmatter[key]
        }
      })
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Extracted ${Object.keys(templateRunnerArgs).length} TemplateRunner args`)
    } else {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: No frontmatter found, skipping TemplateRunner args extraction`)
    }

    // Save templateBody to codeblock if provided
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: Checking templateBody: ${data?.frontmatter?.templateBody !== undefined ? 'exists' : 'missing'}`)
    if (data?.frontmatter?.templateBody !== undefined) {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: About to save templateBody to codeblock`)
      await saveTemplateBodyToTemplate(finalTemplateFilename, data.frontmatter.templateBody || '')
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: templateBody saved to codeblock`)
    }

    // Save custom CSS to codeblock if provided
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: Checking customCSS: ${data?.frontmatter?.customCSS !== undefined ? 'exists' : 'missing'}`)
    if (data?.frontmatter?.customCSS !== undefined) {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: About to save customCSS to codeblock`)
      await saveCustomCSSToTemplate(finalTemplateFilename, data.frontmatter.customCSS || '')
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: customCSS saved to codeblock`)
    }

    // Save TemplateRunner args to codeblock if any exist
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: Checking TemplateRunner args: ${Object.keys(templateRunnerArgs).length} keys`)
    if (Object.keys(templateRunnerArgs).length > 0) {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: About to save TemplateRunner args to codeblock`)
      await saveTemplateRunnerArgsToTemplate(finalTemplateFilename, templateRunnerArgs)
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: TemplateRunner args saved to codeblock`)
    } else {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: No TemplateRunner args to save`)
    }

    // Save frontmatter if provided (but exclude TemplateRunner args and templateBody as they're in codeblocks)
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: About to check if frontmatter needs to be saved`)
    if (data?.frontmatter) {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Frontmatter exists, preparing for save`)
      const frontmatterForSave = { ...data.frontmatter }
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Frontmatter to save: ${JSON.stringify(frontmatterForSave)}`)
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: receivingTemplateTitle="${frontmatterForSave.receivingTemplateTitle || 'MISSING'}"`)
      // Remove TemplateRunner args, templateBody, and customCSS from frontmatter (they're in codeblocks)
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Removing TemplateRunner args, templateBody, and customCSS from frontmatter`)
      delete frontmatterForSave.templateBody
      delete frontmatterForSave.customCSS
      templateRunnerArgKeys.forEach((key) => {
        delete frontmatterForSave[key]
      })
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Frontmatter after cleanup: ${JSON.stringify(frontmatterForSave)}`)
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: About to save frontmatter to template`)
      await saveFrontmatterToTemplate(finalTemplateFilename, frontmatterForSave)
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Frontmatter saved successfully`)
    } else {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: No frontmatter provided in data`)
    }

    // Get template note for success message and cleanup
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: Getting template note for "${finalTemplateFilename}"...`)
    const templateNote = await getNoteByFilename(finalTemplateFilename)
    const templateTitle = templateNote?.title || finalTemplateFilename
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: Template note found: title="${templateTitle}", type="${templateNote?.frontmatterAttributes?.type || 'none'}"`)

    // Remove empty lines from the note
    if (templateNote) {
      removeEmptyLinesFromNote(templateNote)
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: Removed empty lines from note`)
    }

    // Check if we should update the receiving template
    // Use try-catch to ensure form saving continues even if template update fails
    // Update automatically without prompting (user requested automatic update)
    // Note: We await this so it completes, but errors don't stop the save
    // IMPORTANT: Skip updating the receiving template if this is being called recursively
    // (i.e., if we're already saving a processing template itself)
    // This prevents infinite loops when the processing template has its own receivingTemplateTitle
    logDebug(pluginJson, `[${saveId}] handleSaveRequest: Checking if we need to update receiving template...`)
    if (templateNote) {
      const isProcessingTemplateSave = templateNote.frontmatterAttributes?.type === 'forms-processor'
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: isProcessingTemplateSave=${String(isProcessingTemplateSave)}`)
      if (!isProcessingTemplateSave) {
        const receivingTemplateTitle = templateNote.frontmatterAttributes?.receivingTemplateTitle
        logDebug(pluginJson, `[${saveId}] handleSaveRequest: receivingTemplateTitle="${receivingTemplateTitle || 'none'}"`)
        if (receivingTemplateTitle) {
          // Strip double quotes before passing to updateReceivingTemplateWithFields
          const cleanedReceivingTemplateTitle = stripDoubleQuotes(receivingTemplateTitle)
          logDebug(pluginJson, `[${saveId}] handleSaveRequest: About to call updateReceivingTemplateWithFields for "${cleanedReceivingTemplateTitle}"`)
          try {
            // Await the update but don't let errors stop the save
            await updateReceivingTemplateWithFields(cleanedReceivingTemplateTitle, fieldsToSave, saveId)
            logDebug(pluginJson, `[${saveId}] handleSaveRequest: Successfully updated processing template "${cleanedReceivingTemplateTitle}"`)
          } catch (error) {
            // Log error but don't stop form saving
            logError(pluginJson, `[${saveId}] handleSaveRequest: Error updating receiving template: ${error.message || String(error)}`)
          }
        } else {
          logDebug(pluginJson, `[${saveId}] handleSaveRequest: No receivingTemplateTitle found, skipping update`)
        }
      } else {
        logDebug(pluginJson, `[${saveId}] handleSaveRequest: Skipping recursive update of receiving template for processing template "${templateNote.title || ''}"`)
      }
    } else {
      logDebug(pluginJson, `[${saveId}] handleSaveRequest: No template note found, skipping receiving template update`)
    }

    logDebug(pluginJson, `[${saveId}] handleSaveRequest: EXIT - Save completed successfully`)
    return {
      success: true,
      message: `Form saved successfully to "${templateTitle}"`,
      data: { templateFilename: finalTemplateFilename, templateTitle },
    }
  } catch (error) {
    logError(pluginJson, `[${saveId}] handleSaveRequest: EXIT - ERROR: ${error.message || String(error)}`)
    logError(pluginJson, `[${saveId}] handleSaveRequest: Stack trace: ${error.stack || 'No stack trace'}`)
    return {
      success: false,
      message: `Error saving form: ${error.message || String(error)}`,
      data: null,
    }
  }
}
