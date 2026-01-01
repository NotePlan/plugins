// @flow
//--------------------------------------------------------------------------
// Template I/O Functions - Loading and saving template data from/to codeblocks
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { templateBodyCodeBlockType, templateRunnerArgsCodeBlockType, varsCodeBlockType, varsInForm, customCSSCodeBlockType } from './ProcessingTemplate'
import { getNoteByFilename } from '@helpers/note'
import { saveCodeBlockToNote, loadCodeBlockFromNote, replaceCodeBlockContent } from '@helpers/codeBlocks'
import { parseObjectString, stripDoubleQuotes } from '@helpers/stringTransforms'
import { logError, logDebug, JSP } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'
import NPTemplating from 'NPTemplating'

/**
 * Search DataStore.projectNotes for form templates (type: template-form)
 * This searches all project notes, not just @Templates/*
 * @returns {Array<{label: string, value: string}>} Array of {label: title, value: filename}
 */
export function getFormTemplateList(): Array<{ label: string, value: string }> {
  const allNotes = DataStore.projectNotes
  const formTemplates = []

  for (const note of allNotes) {
    const type = note.frontmatterAttributes?.type
    if (type === 'template-form') {
      const title = note.title || note.filename || ''
      if (title) {
        formTemplates.push({
          label: title,
          value: note.filename || '',
        })
      }
    }
  }

  // Sort by title
  formTemplates.sort((a, b) => a.label.localeCompare(b.label))

  return formTemplates
}

/**
 * Format form fields array as code block JSON (more readable format)
 * @param {Array<Object>} fields - The form fields
 * @returns {string} - Formatted JSON string
 */
export function formatFormFieldsAsCodeBlock(fields: Array<Object>): string {
  // Use JSON.stringify with indentation, but we'll clean it up for readability
  const json = JSON.stringify(fields, null, 2)
  // Replace quoted keys with unquoted keys where appropriate (for cleaner look)
  // Actually, let's keep it as standard JSON since it needs to be parseable
  return json
}

/**
 * Save form fields to template as code block
 * @param {string} templateFilename - The template filename
 * @param {Array<Object>} fields - The form fields array
 * @returns {Promise<void>}
 */
export async function saveFormFieldsToTemplate(templateFilename: string, fields: Array<Object>): Promise<void> {
  try {
    // Use generalized helper function
    const success = await saveCodeBlockToNote(
      templateFilename,
      'formfields',
      fields,
      pluginJson.id,
      formatFormFieldsAsCodeBlock, // Format function
      true, // Show error messages to user
    )

    if (success) {
      const templateNote = await getNoteByFilename(templateFilename)
      if (templateNote) {
        // await showMessage(`Form fields saved to template "${templateNote.title || templateFilename}"`)
        logDebug(pluginJson, `saveFormFieldsToTemplate: Saved ${fields.length} fields to template`)
      }
    }
  } catch (error) {
    logError(pluginJson, `saveFormFieldsToTemplate error: ${JSP(error)}`)
    await showMessage(`Error saving form fields: ${error.message}`)
  }
}

/**
 * Save templateBody to template as code block
 * @param {string} templateFilename - The template filename
 * @param {string} templateBody - The template body content
 * @returns {Promise<void>}
 */
export async function saveTemplateBodyToTemplate(templateFilename: string, templateBody: string): Promise<void> {
  try {
    // Use generalized helper function (no formatting needed for templateBody, it's already a string)
    await saveCodeBlockToNote(
      templateFilename,
      templateBodyCodeBlockType,
      templateBody || '',
      pluginJson.id,
      null, // No format function needed
      false, // Don't show error messages to user (silent operation)
    )
  } catch (error) {
    logError(pluginJson, `saveTemplateBodyToTemplate error: ${JSP(error)}`)
  }
}

/**
 * Load templateBody from template code block
 * @param {CoreNoteFields | string} templateNoteOrFilename - The template note or filename
 * @returns {Promise<string>} - The template body content, or empty string if not found
 */
export async function loadTemplateBodyFromTemplate(templateNoteOrFilename: CoreNoteFields | string): Promise<string> {
  try {
    // Use generalized helper function (no parsing needed for templateBody, it's already a string)
    const content = await loadCodeBlockFromNote<string>(templateNoteOrFilename, templateBodyCodeBlockType, pluginJson.id, null)
    return content || ''
  } catch (error) {
    logError(pluginJson, `loadTemplateBodyFromTemplate error: ${JSP(error)}`)
    return ''
  }
}

/**
 * Load TemplateRunner args from template code block
 * These are processing variables that contain template tags and should not be in frontmatter
 * @param {CoreNoteFields | string} templateNoteOrFilename - The template note or filename
 * @returns {Promise<?Object>} - The TemplateRunner args object, or null if not found
 */
export async function loadTemplateRunnerArgsFromTemplate(templateNoteOrFilename: CoreNoteFields | string): Promise<?Object> {
  try {
    // Use generalized helper function to load and parse JSON
    const content = await loadCodeBlockFromNote<Object>(templateNoteOrFilename, templateRunnerArgsCodeBlockType, pluginJson.id, parseObjectString)
    return content || null
  } catch (error) {
    logError(pluginJson, `loadTemplateRunnerArgsFromTemplate error: ${JSP(error)}`)
    return null
  }
}

/**
 * Save TemplateRunner args to template code block
 * These are processing variables that contain template tags and should not be in frontmatter
 * @param {string} templateFilename - The template filename
 * @param {Object} templateRunnerArgs - The TemplateRunner args object to save
 * @returns {Promise<void>}
 */
export async function saveTemplateRunnerArgsToTemplate(templateFilename: string, templateRunnerArgs: Object): Promise<void> {
  try {
    // Use generalized helper function to save as JSON
    await saveCodeBlockToNote(
      templateFilename,
      templateRunnerArgsCodeBlockType,
      templateRunnerArgs || {},
      pluginJson.id,
      (obj) => JSON.stringify(obj, null, 2), // Format as JSON
      false, // Don't show error messages to user (silent operation)
    )
  } catch (error) {
    logError(pluginJson, `saveTemplateRunnerArgsToTemplate error: ${JSP(error)}`)
  }
}

/**
 * Save custom CSS to template as code block
 * @param {string} templateFilename - The template filename
 * @param {string} customCSS - The custom CSS content
 * @returns {Promise<void>}
 */
export async function saveCustomCSSToTemplate(templateFilename: string, customCSS: string): Promise<void> {
  try {
    // Use generalized helper function (no formatting needed for CSS, it's already a string)
    await saveCodeBlockToNote(
      templateFilename,
      customCSSCodeBlockType,
      customCSS || '',
      pluginJson.id,
      null, // No format function needed
      false, // Don't show error messages to user (silent operation)
    )
  } catch (error) {
    logError(pluginJson, `saveCustomCSSToTemplate error: ${JSP(error)}`)
  }
}

/**
 * Load custom CSS from template code block
 * @param {CoreNoteFields | string} templateNoteOrFilename - The template note or filename
 * @returns {Promise<string>} - The custom CSS content, or empty string if not found
 */
export async function loadCustomCSSFromTemplate(templateNoteOrFilename: CoreNoteFields | string): Promise<string> {
  try {
    // Use generalized helper function (no parsing needed for CSS, it's already a string)
    const content = await loadCodeBlockFromNote<string>(templateNoteOrFilename, customCSSCodeBlockType, pluginJson.id, null)
    return content || ''
  } catch (error) {
    logError(pluginJson, `loadCustomCSSFromTemplate error: ${JSP(error)}`)
    return ''
  }
}

/**
 * Update receiving template with field keys from form fields
 * Adds template variables for each field key at the end of the template
 * @param {string} receivingTemplateTitle - The title of the receiving template
 * @param {Array<Object>} fields - The form fields array
 * @returns {Promise<void>}
 */
export async function updateReceivingTemplateWithFields(receivingTemplateTitle: string, fields: Array<Object>): Promise<void> {
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
