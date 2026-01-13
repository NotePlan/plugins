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

        // Build initial context from formValues
        const formValuesForRendering = { ...formValues }
        delete formValuesForRendering.__isJSON__

        // Execute templatejs blocks in order (top to bottom) and merge their returned objects into context
        const formFields = reactWindowData?.pluginData?.formFields || []
        let context = { ...formValuesForRendering }

        // Extract and execute templatejs blocks in order
        // Note: templatejs-block fields don't need keys - they're only used for logging/error messages
        const templateJSBlocks: Array<{ field: Object, code: string, order: number }> = []
        formFields.forEach((field, index) => {
          if (field.type === 'templatejs-block' && field.templateJSContent) {
            const code = String(field.templateJSContent).trim()
            if (code) {
              const executeTiming = field.executeTiming || 'after'
              // Only include 'after' blocks - they run after form fields are available
              if (executeTiming === 'after') {
                templateJSBlocks.push({ field, code, order: index })
              }
            }
          }
        })

        // Sort by order (top to bottom) and execute each block
        templateJSBlocks.sort((a, b) => a.order - b.order)

        // Helper function to check if a key is a valid JavaScript identifier
        const isValidIdentifier = (key: string): boolean => {
          // JavaScript identifier: starts with letter/underscore/$ and contains only letters, digits, underscore, $
          return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
        }

        // Helper function to generate a key from label + random string
        // Returns a valid JavaScript identifier for use in error messages
        const generateKeyFromLabel = (label: string, index: number): string => {
          // Sanitize label: remove special chars, replace spaces/hyphens with underscores, ensure starts with letter/underscore
          let sanitized = (label || 'templatejs-block')
            .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special chars except spaces, hyphens, underscores
            .replace(/[\s-]+/g, '_') // Replace spaces and hyphens with underscores
            .replace(/_+/g, '_') // Replace multiple underscores with single underscore
            .substring(0, 30) // Limit length
            .toLowerCase()
            .trim()

          // Ensure it starts with a letter or underscore (valid JS identifier requirement)
          if (sanitized.length === 0 || !/^[a-zA-Z_]/.test(sanitized)) {
            sanitized = `block_${sanitized}`
          }

          // Generate random string (4 chars) for uniqueness
          const randomStr = Math.random().toString(36).substring(2, 6)
          return `${sanitized}_${randomStr}_${index + 1}`
        }

        for (let blockIndex = 0; blockIndex < templateJSBlocks.length; blockIndex++) {
          const { field, code } = templateJSBlocks[blockIndex]
          // Generate key from label + random string if no key exists
          const fieldIdentifier = field.key || generateKeyFromLabel(field.label || '', blockIndex)
          try {
            logDebug(pluginJson, `handleSubmitButtonClick: Executing templatejs block from field "${fieldIdentifier}"`)
            // Execute the JavaScript code with context as 'params' variable
            // The code should return an object that will be spread into the context
            // Using Function constructor to safely execute with context
            // Make all context properties available as variables in the function
            // Only create variables for keys that are valid JavaScript identifiers (no hyphens, etc.)
            // Invalid identifiers can still be accessed via params['key-name']
            const contextVars = Object.keys(context)
              .map((key) => {
                if (isValidIdentifier(key)) {
                  return `const ${key} = params.${key};`
                }
                // For invalid identifiers, don't create a variable - user can access via params['key-name']
                return `// Key "${key}" is not a valid JavaScript identifier - access via params['${key}']`
              })
              .join('\n')
            const functionBody = `
              ${contextVars}
              // Execute user's code
              ${code}
            `
            // $FlowIgnore[prop-missing] - Function constructor is safe here as code comes from form definition
            const fn = Function.apply(null, ['params', functionBody])
            const result = fn(context)

            // If the code returns an object, spread it into context
            if (result && typeof result === 'object' && !Array.isArray(result)) {
              context = { ...context, ...result }
              logDebug(pluginJson, `handleSubmitButtonClick: TemplateJS block "${fieldIdentifier}" returned object with keys: ${Object.keys(result).join(', ')}`)
            } else if (result !== undefined) {
              logError(pluginJson, `handleSubmitButtonClick: TemplateJS block "${fieldIdentifier}" should return an object, but returned: ${typeof result}`)
              await showMessage(
                `TemplateJS block "${fieldIdentifier}" should return an object, but returned ${typeof result}. Please update your code to return an object (e.g., return { key: value }).`,
              )
            } else {
              logError(pluginJson, `handleSubmitButtonClick: TemplateJS block "${fieldIdentifier}" did not return anything. It should return an object.`)
              await showMessage(`TemplateJS block "${fieldIdentifier}" did not return anything. Please update your code to return an object (e.g., return { key: value }).`)
            }
          } catch (error) {
            logError(pluginJson, `handleSubmitButtonClick: Error executing templatejs block "${fieldIdentifier}": ${error.message}`)
            await showMessage(`Error executing TemplateJS block "${fieldIdentifier}": ${error.message}`)
            return null
          }
        }

        // Pass the merged context (with all templatejs block results) to templateRunner
        // No need for __templateJSBlocks__ anymore since we've executed them here
        const templateRunnerArgs = { ...context }

        const argumentsToSend = [receivingTemplateTitle, shouldOpenInEditor, templateRunnerArgs]
        clo(argumentsToSend, `handleSubmitButtonClick: Using form-processor, calling templateRunner with arguments (after executing ${templateJSBlocks.length} templatejs blocks)`)
        const templateRunnerResult = await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', argumentsToSend)
        logDebug(
          pluginJson,
          `handleSubmitButtonClick: templateRunner result type=${typeof templateRunnerResult}, length=${templateRunnerResult?.length || 0}, includes AI marker=${String(
            templateRunnerResult?.includes?.('==**Templating Error Found**') || false,
          )}`,
        )
        // Check if result contains AI analysis (error message from template rendering)
        if (templateRunnerResult && typeof templateRunnerResult === 'string' && templateRunnerResult.includes('==**Templating Error Found**')) {
          logDebug(pluginJson, `handleSubmitButtonClick: AI analysis result detected, storing in reactWindowData.pluginData.aiAnalysisResult`)
          // Store AI analysis result in reactWindowData so it can be passed back to React window
          if (!reactWindowData.pluginData) {
            reactWindowData.pluginData = {}
          }
          ;(reactWindowData.pluginData: any).aiAnalysisResult = templateRunnerResult
          logDebug(
            pluginJson,
            `handleSubmitButtonClick: AI analysis stored, reactWindowData.pluginData.aiAnalysisResult length=${reactWindowData.pluginData.aiAnalysisResult?.length || 0}`,
          )
        } else {
          logDebug(pluginJson, `handleSubmitButtonClick: No AI analysis result detected in templateRunner result`)
        }
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
        const templateRunnerResult = await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', ['', shouldOpenInEditor, templateRunnerArgs])
        logDebug(
          pluginJson,
          `handleSubmitButtonClick: templateRunner result type=${typeof templateRunnerResult}, length=${templateRunnerResult?.length || 0}, includes AI marker=${String(
            templateRunnerResult?.includes?.('==**Templating Error Found**') || false,
          )}`,
        )
        // Check if result contains AI analysis (error message from template rendering)
        if (templateRunnerResult && typeof templateRunnerResult === 'string' && templateRunnerResult.includes('==**Templating Error Found**')) {
          logDebug(pluginJson, `handleSubmitButtonClick: AI analysis result detected, storing in reactWindowData.pluginData.aiAnalysisResult`)
          // Store AI analysis result in reactWindowData so it can be passed back to React window
          if (!reactWindowData.pluginData) {
            reactWindowData.pluginData = {}
          }
          ;(reactWindowData.pluginData: any).aiAnalysisResult = templateRunnerResult
          logDebug(
            pluginJson,
            `handleSubmitButtonClick: AI analysis stored, reactWindowData.pluginData.aiAnalysisResult length=${reactWindowData.pluginData.aiAnalysisResult?.length || 0}`,
          )
        } else {
          logDebug(pluginJson, `handleSubmitButtonClick: No AI analysis result detected in templateRunner result`)
        }
      } else if (method === 'run-js-only') {
        // Option D: Run JS Only (no note creation)
        // Get TemplateJS blocks from form fields (templatejs-block type)
        const formFields = reactWindowData?.pluginData?.formFields || []

        logDebug(pluginJson, `handleSubmitButtonClick: run-js-only: formFields.length=${formFields.length}`)

        // Find all TemplateJS blocks from form fields
        const templateJSBlocks: Array<string> = []
        formFields.forEach((field) => {
          if (field.type === 'templatejs-block' && field.templateJSContent && field.key) {
            const code = String(field.templateJSContent).trim()
            logDebug(pluginJson, `handleSubmitButtonClick: run-js-only: Found templatejs-block field "${field.key}" with ${code.length} chars of code`)
            logDebug(pluginJson, `handleSubmitButtonClick: run-js-only: JavaScript code: ${code.substring(0, 200)}${code.length > 200 ? '...' : ''}`)
            if (code) {
              templateJSBlocks.push(code)
            }
          }
        })

        if (templateJSBlocks.length === 0) {
          await showMessage('No TemplateJS block found in form fields. Please add a TemplateJS Block field to your form with the JavaScript code to execute.')
          return null
        }

        // Combine all TemplateJS blocks (they will be executed in order)
        // Format as templatejs code blocks
        const finalTemplateBody = templateJSBlocks.map((code) => `\`\`\`templatejs\n${code}\n\`\`\``).join('\n')

        // Build form values for rendering (filter out __isJSON__ flag)
        const formValuesForRendering = { ...formValues }
        delete formValuesForRendering.__isJSON__

        logDebug(pluginJson, `handleSubmitButtonClick: run-js-only: formValues keys: ${Object.keys(formValuesForRendering).join(', ')}`)
        logDebug(pluginJson, `handleSubmitButtonClick: run-js-only: templateBody length: ${finalTemplateBody.length} chars`)

        // Execute JavaScript directly using templating plugin's render command
        // This will process the templatejs blocks, convert them to EJS, and execute them with form values as context
        try {
          logDebug(pluginJson, `handleSubmitButtonClick: run-js-only: About to execute JavaScript with form values: ${JSON.stringify(formValuesForRendering)}`)
          const result = await DataStore.invokePluginCommandByName('render', 'np.Templating', [finalTemplateBody, formValuesForRendering])
          logDebug(
            pluginJson,
            `handleSubmitButtonClick: run-js-only: render result type=${typeof result}, length=${result?.length || 0}, includes AI marker=${String(
              result?.includes?.('==**Templating Error Found**') || false,
            )}`,
          )

          // Check if result contains AI analysis (error message from template rendering)
          if (result && typeof result === 'string' && result.includes('==**Templating Error Found**')) {
            logDebug(pluginJson, `handleSubmitButtonClick: run-js-only: AI analysis result detected, storing in reactWindowData.pluginData.aiAnalysisResult`)
            // Store AI analysis result in reactWindowData so it can be passed back to React window
            if (!reactWindowData.pluginData) {
              reactWindowData.pluginData = {}
            }
            ;(reactWindowData.pluginData: any).aiAnalysisResult = result
            logDebug(
              pluginJson,
              `handleSubmitButtonClick: run-js-only: AI analysis stored, reactWindowData.pluginData.aiAnalysisResult length=${
                reactWindowData.pluginData.aiAnalysisResult?.length || 0
              }`,
            )
          } else {
            logDebug(pluginJson, `handleSubmitButtonClick: run-js-only: No AI analysis result detected in render result`)
          }

          logDebug(pluginJson, `handleSubmitButtonClick: run-js-only: JavaScript executed successfully, result length: ${result?.length || 0} chars`)
          // Result is typically empty for JS-only execution (no output expected, just side effects like creating folders)
          // Note: If folders aren't being created, check that the JavaScript code uses the correct folder paths
          // For example, if parentFolder is "DELETEME" and folderName is "tetpara", the code should use:
          // DataStore.createFolder(`${parentFolder}/${folderName}`) or similar
        } catch (error) {
          logError(pluginJson, `handleSubmitButtonClick: run-js-only: Error executing JavaScript: ${error.message}`)
          logError(pluginJson, `handleSubmitButtonClick: run-js-only: Error stack: ${error.stack}`)
          await showMessage(`Error executing JavaScript: ${error.message}`)
          return null
        }
      } else if (method === 'create-new') {
        // Option B: Create New Note
        const { newNoteTitle, newNoteFolder, space } = data
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
        // If space (teamspace) is set and folder doesn't already have teamspace prefix, prepend it
        // Don't pass null as DataStore.newNote treats null as the literal string "null"
        let folderPath = newNoteFolder && newNoteFolder.trim() ? newNoteFolder.trim() : '/'

        // If space is set (teamspace) and folder doesn't already have teamspace prefix, prepend it
        if (space && space.trim() && !folderPath.startsWith('%%NotePlanCloud%%')) {
          // Construct teamspace folder path: %%NotePlanCloud%%/{teamspaceID}/{folder}
          // Note: teamspace folder format requires / after %%NotePlanCloud%%
          if (folderPath === '/' || folderPath === '') {
            folderPath = `%%NotePlanCloud%%/${space}/`
          } else {
            // Remove leading slash from folderPath if present (we'll add it after teamspace prefix)
            const cleanFolder = folderPath.startsWith('/') ? folderPath.slice(1) : folderPath
            folderPath = `%%NotePlanCloud%%/${space}/${cleanFolder}`
          }
          logDebug(pluginJson, `handleSubmitButtonClick: Prefixed folder with teamspace: ${folderPath}`)
        }

        templateRunnerArgs.folder = folderPath

        clo(templateRunnerArgs, `handleSubmitButtonClick: Using create-new, calling templateRunner with args`)
        const templateRunnerResult = await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', ['', shouldOpenInEditor, templateRunnerArgs])
        logDebug(
          pluginJson,
          `handleSubmitButtonClick: templateRunner result type=${typeof templateRunnerResult}, length=${templateRunnerResult?.length || 0}, includes AI marker=${String(
            templateRunnerResult?.includes?.('==**Templating Error Found**') || false,
          )}`,
        )
        // Check if result contains AI analysis (error message from template rendering)
        if (templateRunnerResult && typeof templateRunnerResult === 'string' && templateRunnerResult.includes('==**Templating Error Found**')) {
          logDebug(pluginJson, `handleSubmitButtonClick: AI analysis result detected, storing in reactWindowData.pluginData.aiAnalysisResult`)
          // Store AI analysis result in reactWindowData so it can be passed back to React window
          if (!reactWindowData.pluginData) {
            reactWindowData.pluginData = {}
          }
          ;(reactWindowData.pluginData: any).aiAnalysisResult = templateRunnerResult
          logDebug(
            pluginJson,
            `handleSubmitButtonClick: AI analysis stored, reactWindowData.pluginData.aiAnalysisResult length=${reactWindowData.pluginData.aiAnalysisResult?.length || 0}`,
          )
        } else {
          logDebug(pluginJson, `handleSubmitButtonClick: No AI analysis result detected in templateRunner result`)
        }
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
  logDebug(
    pluginJson,
    `handleSubmitButtonClick: Returning reactWindowData, has aiAnalysisResult=${String(!!reactWindowData?.pluginData?.aiAnalysisResult)}, aiAnalysisResult length=${
      reactWindowData?.pluginData?.aiAnalysisResult?.length || 0
    }`,
  )
  return reactWindowData
}
