// @flow
//--------------------------------------------------------------------------
// Form Builder Request Handlers
// Handlers for requests from FormBuilder component
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { createProcessingTemplate } from './ProcessingTemplate'
import { openFormBuilder } from './NPTemplateForm'
import { FORMBUILDER_WINDOW_ID } from './windowManagement'
import { formatFormFieldsAsCodeBlock, getFormTemplateList, loadTemplateBodyFromTemplate, loadTemplateRunnerArgsFromTemplate } from './templateIO'
import { getNoteByFilename } from '@helpers/note'
import { focusHTMLWindowIfAvailable } from '@helpers/NPWindows'
import { updateFrontMatterVars, ensureFrontmatter, endOfFrontmatterLineIndex } from '@helpers/NPFrontMatter'
import { saveCodeBlockToNote, loadCodeBlockFromNote } from '@helpers/codeBlocks'
import { parseObjectString } from '@helpers/stringTransforms'
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
 * @param {string} params.filename - The note filename to open
 * @returns {RequestResponse}
 */
export function handleOpenNote(params: { filename?: string }): RequestResponse {
  try {
    const filename = params.filename
    if (!filename) {
      return {
        success: false,
        message: 'filename is required',
        data: null,
      }
    }

    logDebug(pluginJson, `handleOpenNote: filename="${filename}"`)

    // Open the note in the editor
    Editor.openNoteByFilename(filename)

    return {
      success: true,
      message: 'Note opened successfully',
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
    const { updateFormLinksInNote } = require('./requestHandlers')
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
      const { removeEmptyLinesFromNote } = require('./requestHandlers')
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
