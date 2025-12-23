// @flow
//--------------------------------------------------------------------------
// Form Submission Handling - Processing form submissions and calling TemplateRunner
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { type PassedData } from './NPTemplateForm.js'
import { logError, logDebug, clo, JSP } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'

/**
 * Insert TemplateJS blocks into templateBody based on executeTiming
 * @param {string} templateBody - The base template body
 * @param {Array<Object>} formFields - The form fields array
 * @returns {string} - The template body with TemplateJS blocks inserted
 */
export function insertTemplateJSBlocks(templateBody: string, formFields: Array<Object>): string {
  if (!Array.isArray(formFields) || formFields.length === 0) {
    return templateBody
  }

  const beforeBlocks: Array<string> = []
  const afterBlocks: Array<string> = []

  // Extract TemplateJS blocks from form fields
  formFields.forEach((field) => {
    if (field.type === 'templatejs-block' && field.templateJSContent && field.key) {
      const code = String(field.templateJSContent).trim()
      if (code) {
        // Format as templatejs code block (no extra whitespace)
        const codeBlock = `\`\`\`templatejs\n${code}\n\`\`\``
        const executeTiming = field.executeTiming || 'after'
        if (executeTiming === 'before') {
          beforeBlocks.push(codeBlock)
        } else {
          afterBlocks.push(codeBlock)
        }
      }
    }
  })

  // Build final templateBody: before blocks + original + after blocks
  const parts: Array<string> = []
  if (beforeBlocks.length > 0) {
    parts.push(beforeBlocks.join('\n'))
  }
  if (templateBody.trim()) {
    parts.push(templateBody)
  }
  if (afterBlocks.length > 0) {
    parts.push(afterBlocks.join('\n'))
  }

  return parts.join('\n')
}

/**
 * When someone clicks a "Submit" button in the React Window, it calls the router (onMessageFromHTMLView)
 * which sees the actionType === "onSubmitClick" so it routes to this function for processing
 * @param {any} data - the data sent from the React Window for the action 'onSubmitClick'
 * @param {any} reactWindowData - the current data in the React Window
 * @returns {any} - the updated data to send back to the React Window
 */
export async function handleSubmitButtonClick(data: any, reactWindowData: PassedData): Promise<PassedData | null> {
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
        const { getNoteTitled, location, writeUnderHeading, createMissingHeading } = data
        if (!getNoteTitled) {
          await showMessage('No target note was specified. Please set a target note in your form settings.')
          return null
        }

        // Get templateBody from reactWindowData (loaded from template codeblock) or from data, otherwise build from form values
        const templateBody = reactWindowData?.pluginData?.templateBody || data?.templateBody || ''
        const baseTemplateBody =
          templateBody ||
          Object.keys(formValues)
            .filter((key) => key !== '__isJSON__')
            .map((key) => `${key}: <%- ${key} %>`)
            .join('\n')

        // Insert TemplateJS blocks into templateBody based on executeTiming
        const formFields = reactWindowData?.pluginData?.formFields || []
        const finalTemplateBody = insertTemplateJSBlocks(baseTemplateBody, formFields)

        // NOTE: For 'write-existing', we do NOT pre-render templateBody here.
        // TemplateRunner will render it at line 764 using renderTemplate(frontmatterBody, data).
        // The form values are spread into templateRunnerArgs below so TemplateRunner can access them for rendering.
        // Pre-rendering here would cause double-rendering, which is safe (already-rendered content with no <% tags
        // will pass through unchanged), but unnecessary.

        // Build frontmatter object for TemplateRunner
        // Spread formValues into templateRunnerArgs so they're available for rendering template tags in templateBody
        // Filter out __isJSON__ flag as it's not needed for rendering
        const formValuesForRendering = { ...formValues }
        delete formValuesForRendering.__isJSON__

        const templateRunnerArgs: { [string]: any } = {
          getNoteTitled,
          templateBody: finalTemplateBody, // TemplateRunner will render this with form values at line 764
          ...formValuesForRendering, // Spread form values so TemplateRunner can render template tags like <%- field1 %>
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
        const { newNoteTitle, newNoteFolder } = data
        // Clean newNoteTitle: trim and remove any newlines (defensive)
        const cleanedNewNoteTitle = newNoteTitle ? String(newNoteTitle).replace(/\n/g, ' ').trim() : ''
        if (!cleanedNewNoteTitle) {
          await showMessage('No new note title was specified. Please set a new note title in your form settings.')
          return null
        }

        // NOTE: We do NOT pre-render newNoteTitle here anymore.
        // TemplateRunner now handles rendering in handleNewNoteCreation.
        // This ensures consistent behavior: TemplateRunner always renders newNoteTitle, regardless of which path is taken.
        // The form values are spread into templateRunnerArgs below so TemplateRunner can access them for rendering.

        // Get templateBody from reactWindowData (loaded from template codeblock) or from data, otherwise build from form values
        const templateBody = reactWindowData?.pluginData?.templateBody || data?.templateBody || ''
        const baseTemplateBody =
          templateBody ||
          Object.keys(formValues)
            .filter((key) => key !== '__isJSON__')
            .map((key) => `${key}: <%- ${key} %>`)
            .join('\n')

        // Insert TemplateJS blocks into templateBody based on executeTiming
        const formFields = reactWindowData?.pluginData?.formFields || []
        const finalTemplateBody = insertTemplateJSBlocks(baseTemplateBody, formFields)

        // NOTE: We do NOT pre-render templateBody here anymore.
        // TemplateRunner now handles rendering in handleNewNoteCreation (for create-new) and renderTemplate (for write-existing).
        // This ensures consistent behavior: TemplateRunner always renders templateBody, regardless of which path is taken.
        // The form values are spread into templateRunnerArgs below so TemplateRunner can access them for rendering.

        // Build frontmatter object for TemplateRunner
        // Spread formValues into templateRunnerArgs so they're available for rendering template tags in templateBody
        // Filter out __isJSON__ flag as it's not needed for rendering
        const formValuesForRendering = { ...formValues }
        delete formValuesForRendering.__isJSON__

        const templateRunnerArgs: { [string]: any } = {
          newNoteTitle: cleanedNewNoteTitle, // TemplateRunner will render this with form values in handleNewNoteCreation
          templateBody: finalTemplateBody, // TemplateRunner will render this with form values in handleNewNoteCreation
          ...formValuesForRendering, // Spread form values so TemplateRunner can render template tags like <%- field1 %>
        }

        // Set folder - use '/' for root folder if empty, otherwise use the specified folder
        // Don't pass null as DataStore.newNote treats null as the literal string "null"
        templateRunnerArgs.folder = newNoteFolder && newNoteFolder.trim() ? newNoteFolder.trim() : '/'

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
  return reactWindowData
}
