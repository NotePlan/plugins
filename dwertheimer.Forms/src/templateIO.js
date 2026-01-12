// @flow
//--------------------------------------------------------------------------
// Template I/O Functions - Loading and saving template data from/to codeblocks
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { templateBodyCodeBlockType, templateRunnerArgsCodeBlockType, varsCodeBlockType, varsInForm, customCSSCodeBlockType } from './ProcessingTemplate'
import { getNoteByFilename } from '@helpers/note'
import { saveCodeBlockToNote, loadCodeBlockFromNote, replaceCodeBlockContent } from '@helpers/codeBlocks'
import { parseObjectString, stripDoubleQuotes } from '@helpers/stringTransforms'
// DataStore is a global variable in NotePlan, no import needed
import { logError, logDebug, JSP } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'
import NPTemplating from 'NPTemplating'
import { isDoubleEncoded, fixDoubleEncoded } from './utils/encodingFix.js'

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
 * Check for duplicate form titles and return duplicates if found
 * @param {string} templateTitle - The title to check for duplicates
 * @returns {Array<{label: string, value: string}>} - Array of duplicate templates (empty if no duplicates)
 */
export function findDuplicateFormTemplates(templateTitle: string): Array<{ label: string, value: string }> {
  if (!templateTitle || !templateTitle.trim()) {
    return []
  }

  const allTemplates = getFormTemplateList()
  const duplicates = allTemplates.filter((template) => template.label === templateTitle)

  // If there's more than one match, return all duplicates
  return duplicates.length > 1 ? duplicates : []
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
    let cleanedBody = templateBody || ''
    
    // IMPORTANT: Check if the content coming from React is already corrupted
    // This can happen if the data was corrupted when sent through the bridge
    // We should fix it before saving to prevent the corruption from persisting
    const { isDoubleEncoded, fixDoubleEncoded } = await import('./utils/encodingFix.js')
    if (cleanedBody && isDoubleEncoded(cleanedBody)) {
      logDebug(pluginJson, `saveTemplateBodyToTemplate: Detected corruption in content from React, fixing before save`)
      const fixed = fixDoubleEncoded(cleanedBody)
      if (fixed !== cleanedBody) {
        logDebug(pluginJson, `saveTemplateBodyToTemplate: Fixed corruption before save (original length=${cleanedBody.length}, fixed length=${fixed.length})`)
        cleanedBody = fixed
      }
    }
    
    // Log encoding info for debugging
    if (cleanedBody) {
      const hasUnicode = /[^\x00-\x7F]/.test(cleanedBody)
      if (hasUnicode) {
        logDebug(pluginJson, `saveTemplateBodyToTemplate: Saving content with Unicode characters (length=${cleanedBody.length})`)
        // Check for common Unicode characters that might get corrupted
        const hasEmDash = cleanedBody.includes('—')
        const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(cleanedBody)
        if (hasEmDash || hasEmoji) {
          logDebug(pluginJson, `saveTemplateBodyToTemplate: Content contains em-dash or emoji - monitoring for encoding issues`)
        }
      }
    }
    
    // Use generalized helper function (no formatting needed for templateBody, it's already a string)
    await saveCodeBlockToNote(
      templateFilename,
      templateBodyCodeBlockType,
      cleanedBody,
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
    const loadedContent = content || ''
    
    // Check for and fix double-encoded UTF-8 issues
    // This can happen if content was saved with wrong encoding
    if (loadedContent) {
      logDebug(pluginJson, `loadTemplateBodyFromTemplate: Loaded content (length=${loadedContent.length})`)
      
      // Check for specific corruption patterns we know exist in the file
      // Check both the literal characters and their character codes
      const hasKnownCorruption = 
        loadedContent.includes('ðŸ') || 
        loadedContent.includes('ô€') || 
        loadedContent.includes('ô»') ||
        loadedContent.includes('ï¿¼') ||
        loadedContent.includes(String.fromCharCode(0xF0, 0x9F)) || // ðŸ as bytes
        loadedContent.includes(String.fromCharCode(0xF4, 0x8F)) || // ô€ as bytes  
        loadedContent.includes(String.fromCharCode(0xEF, 0xBF, 0xBD)) // ï¿¼ as bytes (replacement character)
      
      if (hasKnownCorruption) {
        logDebug(pluginJson, `loadTemplateBodyFromTemplate: Found known corruption patterns`)
        // Log a sample of corrupted content for debugging
        const sampleStart = loadedContent.indexOf('ðŸ') >= 0 ? loadedContent.indexOf('ðŸ') : 
                           loadedContent.indexOf('ô€') >= 0 ? loadedContent.indexOf('ô€') :
                           loadedContent.indexOf('ï¿¼') >= 0 ? loadedContent.indexOf('ï¿¼') : -1
        if (sampleStart >= 0) {
          const sample = loadedContent.substring(Math.max(0, sampleStart - 10), Math.min(loadedContent.length, sampleStart + 30))
          logDebug(pluginJson, `loadTemplateBodyFromTemplate: Sample corrupted content: "${sample}"`)
          // Log character codes
          const charCodes = []
          for (let i = Math.max(0, sampleStart - 5); i < Math.min(loadedContent.length, sampleStart + 10); i++) {
            charCodes.push(`${loadedContent[i]}(${loadedContent.charCodeAt(i)})`)
          }
          logDebug(pluginJson, `loadTemplateBodyFromTemplate: Character codes: ${charCodes.join(', ')}`)
        }
      }
      
      if (isDoubleEncoded(loadedContent) || hasKnownCorruption) {
        logDebug(pluginJson, `loadTemplateBodyFromTemplate: Detected double-encoded UTF-8, attempting fix`)
        
        // Log a sample of corrupted content before fix
        const corruptedSample = loadedContent.substring(
          Math.max(0, (loadedContent.indexOf('ðŸ') >= 0 ? loadedContent.indexOf('ðŸ') : 
                      loadedContent.indexOf('ô€') >= 0 ? loadedContent.indexOf('ô€') : 
                      loadedContent.indexOf('ï¿¼') >= 0 ? loadedContent.indexOf('ï¿¼') : 0) - 5),
          Math.min(loadedContent.length, (loadedContent.indexOf('ðŸ') >= 0 ? loadedContent.indexOf('ðŸ') : 
                                          loadedContent.indexOf('ô€') >= 0 ? loadedContent.indexOf('ô€') : 
                                          loadedContent.indexOf('ï¿¼') >= 0 ? loadedContent.indexOf('ï¿¼') : 0) + 20)
        )
        logDebug(pluginJson, `loadTemplateBodyFromTemplate: Before fix sample: "${corruptedSample}"`)
        
        const fixed = fixDoubleEncoded(loadedContent)
        
        // Log a sample of fixed content
        const fixedSample = fixed.substring(
          Math.max(0, Math.min(corruptedSample.length, fixed.length) - 5),
          Math.min(fixed.length, Math.max(corruptedSample.length, fixed.length) + 20)
        )
        logDebug(pluginJson, `loadTemplateBodyFromTemplate: After fix sample: "${fixedSample}"`)
        
        // Check if corruption patterns are still present
        const stillHasCorruption = isDoubleEncoded(fixed) || 
                                   fixed.includes('ðŸ') || 
                                   fixed.includes('ô€') || 
                                   fixed.includes('ï¿¼')
        
        if (fixed !== loadedContent) {
          logDebug(pluginJson, `loadTemplateBodyFromTemplate: Fixed encoding issues (original length=${loadedContent.length}, fixed length=${fixed.length}, stillHasCorruption=${String(stillHasCorruption)})`)
          // Auto-save the fixed content to prevent future issues
          // But only if we loaded from a filename (not a note object)
          if (typeof templateNoteOrFilename === 'string') {
            logDebug(pluginJson, `loadTemplateBodyFromTemplate: Auto-saving fixed content back to template`)
            await saveTemplateBodyToTemplate(templateNoteOrFilename, fixed)
          }
          return fixed
        } else {
          logDebug(pluginJson, `loadTemplateBodyFromTemplate: Detected double-encoding but fix did not change content`)
          if (stillHasCorruption) {
            logDebug(pluginJson, `loadTemplateBodyFromTemplate: WARNING - Corruption still present after fix attempt`)
          }
        }
      } else {
        logDebug(pluginJson, `loadTemplateBodyFromTemplate: No double-encoding detected`)
      }
    }
    
    return loadedContent
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
export async function updateReceivingTemplateWithFields(receivingTemplateTitle: string, fields: Array<Object>, parentSaveId?: string): Promise<void> {
  const updateId = parentSaveId ? `${parentSaveId}-UPDATE` : `UPDATE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  try {
    // Strip double quotes from the template title at the start
    const cleanedReceivingTemplateTitle = stripDoubleQuotes(receivingTemplateTitle)
    logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: ENTRY - Starting for template "${cleanedReceivingTemplateTitle}"`)

    // Find the receiving template by searching all notes (not just template folder)
    // Search all project notes for forms-processor type templates
    logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: Searching ${DataStore.projectNotes.length} project notes...`)
    let receivingNote: ?TNote = null
    const allNotes = DataStore.projectNotes
    for (const note of allNotes) {
      const noteType = note.frontmatterAttributes?.type
      if (noteType === 'forms-processor' || noteType === 'template-runner') {
        const noteTitle = stripDoubleQuotes(note.title || '')
        logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: Checking note "${noteTitle}" (type="${noteType}")`)
        if (noteTitle === cleanedReceivingTemplateTitle) {
          receivingNote = note
          logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: Found processing template "${cleanedReceivingTemplateTitle}" at "${note.filename}"`)
          break
        }
      }
    }

    // Fallback: try getTemplateList if direct search didn't find it
    if (!receivingNote) {
      logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: Direct search didn't find template, trying getTemplateList`)
      const templateList = await NPTemplating.getTemplateList('forms-processor')
      logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: Found ${templateList.length} forms-processor templates`)
      const receivingTemplate = templateList.find((t) => {
        // Strip double quotes from both sides for comparison
        const templateLabel = stripDoubleQuotes(t.label)
        return templateLabel === cleanedReceivingTemplateTitle
      })

      if (receivingTemplate) {
        logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: Found template in getTemplateList, loading note...`)
        receivingNote = await getNoteByFilename(receivingTemplate.value)
      }
    }

    if (!receivingNote) {
      logError(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: Could not find receiving template "${cleanedReceivingTemplateTitle}"`)
      // Don't show error message or throw - just log and continue
      return
    }
    
    logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: Found receiving note: "${receivingNote.filename}", type="${receivingNote.frontmatterAttributes?.type || 'none'}"`)

    // Extract fields that have keys (only fields that have keys, excluding separators and headings)
    const fieldsWithKeys = fields.filter((f) => f.key && f.type !== 'separator' && f.type !== 'heading')

    logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: Found ${fieldsWithKeys.length} fields with keys to add`)

    // Build the code block content: varsInForm followed by lines like "<label>: <%- key %>"
    const codeBlockLines = [varsInForm]
    for (const field of fieldsWithKeys) {
      const label = field.label || field.key
      codeBlockLines.push(`${label}: <%- ${field.key} %>`)
    }
    const codeBlockContent = codeBlockLines.join('\n')
    logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: About to replace code block (${codeBlockContent.length} chars)`)

    // Use the helper function to replace code block content
    logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: Calling replaceCodeBlockContent...`)
    const success = replaceCodeBlockContent(receivingNote, varsCodeBlockType, codeBlockContent, pluginJson.id)
    const successStr = success ? 'true' : 'false'
    logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: replaceCodeBlockContent returned: ${successStr}`)
    if (!success) {
      logError(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: Failed to replace code block content`)
      // Don't show error message or throw - just log and continue
      return
    }
    logDebug(pluginJson, `[${updateId}] updateReceivingTemplateWithFields: EXIT - Updated receiving template with ${fieldsWithKeys.length} field variables`)
    // Don't show message - let the form save message handle user feedback
  } catch (error) {
    // Log error but don't throw or stop execution - form saving should continue
    logError(pluginJson, `updateReceivingTemplateWithFields error: ${JSP(error)}`)
    // Don't show error message to user - just log it
  }
}
