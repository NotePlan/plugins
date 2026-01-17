// @flow
//--------------------------------------------------------------------------
// Form Submission Handling - Processing form submissions and calling TemplateRunner
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { type PassedData } from './NPTemplateForm.js'
import { logError, logDebug, clo, JSP } from '@helpers/dev'
import { replaceSmartQuotes } from '@templating/utils/stringUtils'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a key is a valid JavaScript identifier
 * @param {string} key - The key to check
 * @returns {boolean} - True if the key is a valid JavaScript identifier
 */
function isValidIdentifier(key: string): boolean {
  // JavaScript identifier: starts with letter/underscore/$ and contains only letters, digits, underscore, $
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
}

/**
 * Generate a key from label + random string for use in error messages
 * @param {string} label - The field label
 * @param {number} index - The field index
 * @returns {string} - A valid JavaScript identifier
 */
function generateKeyFromLabel(label: string, index: number): string {
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

/**
 * Prepare form values for rendering by removing internal flags
 * @param {Object} formValues - The raw form values
 * @returns {Object} - Cleaned form values
 */
function prepareFormValuesForRendering(formValues: Object): Object {
  const cleaned = { ...formValues }
  delete cleaned.__isJSON__
  return cleaned
}

/**
 * Get the full templating context with form values merged in
 * @param {Object} formValues - The form values to merge into context
 * @returns {Promise<Object>} - The full templating context
 */
async function getTemplatingContext(formValues: Object): Promise<Object> {
  logDebug(pluginJson, `getTemplatingContext: Getting templating render context...`)
  const templatingContext = await DataStore.invokePluginCommandByName('getRenderContext', 'np.Templating', [formValues])
  logDebug(pluginJson, `getTemplatingContext: Got templating context with ${Object.keys(templatingContext).length} keys`)
  return templatingContext
}

/**
 * Extract templatejs blocks from form fields
 * @param {Array<Object>} formFields - The form fields array
 * @param {string} executeTiming - Filter by execute timing ('before' or 'after')
 * @returns {Array<{field: Object, code: string, order: number}>} - Array of templatejs blocks
 */
function extractTemplateJSBlocks(formFields: Array<Object>, executeTiming?: string): Array<{ field: Object, code: string, order: number }> {
  const blocks: Array<{ field: Object, code: string, order: number }> = []
  formFields.forEach((field, index) => {
    if (field.type === 'templatejs-block' && field.templateJSContent) {
      const rawCode = String(field.templateJSContent).trim()
      // Sanitize the code when extracting (replace smart quotes, etc.)
      const code = sanitizeTemplateJSCode(rawCode)
      if (code) {
        const fieldExecuteTiming = field.executeTiming || 'after'
        if (!executeTiming || fieldExecuteTiming === executeTiming) {
          blocks.push({ field, code, order: index })
        }
      }
    }
  })
  // Sort by order (top to bottom)
  blocks.sort((a, b) => a.order - b.order)
  return blocks
}

/**
 * Sanitize templateJS code before execution
 * - Replaces smart quotes with straight quotes
 * - Removes any other problematic characters
 * @param {string} code - The raw templateJS code
 * @returns {string} - The sanitized code
 */
function sanitizeTemplateJSCode(code: string): string {
  if (!code || typeof code !== 'string') {
    return code || ''
  }

  // Replace smart quotes with straight quotes
  let sanitized = replaceSmartQuotes(code)

  // Ensure it's still a string after processing
  if (typeof sanitized !== 'string') {
    sanitized = String(sanitized)
  }

  return sanitized
}

/**
 * Execute a single templatejs block with the given context
 * @param {Object} field - The field object
 * @param {string} code - The JavaScript code to execute
 * @param {Object} context - The execution context
 * @param {number} blockIndex - The index of this block (for error messages)
 * @param {PassedData} reactWindowData - The React window data to store errors in
 * @returns {Promise<Object|null>} - The returned object from the block, or null on error
 */
function executeTemplateJSBlock(field: Object, code: string, context: Object, blockIndex: number, reactWindowData: PassedData): Promise<Object | null> {
  const fieldIdentifier = field.key || generateKeyFromLabel(field.label || '', blockIndex)
  try {
    logDebug(pluginJson, `executeTemplateJSBlock: Executing templatejs block from field "${fieldIdentifier}"`)

    // Sanitize the code before execution (replace smart quotes, etc.)
    const sanitizedCode = sanitizeTemplateJSCode(code)
    if (sanitizedCode !== code) {
      logDebug(pluginJson, `executeTemplateJSBlock: Code was sanitized (smart quotes replaced)`)
    }

    // Build context variables - only create variables for valid JavaScript identifiers
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
      // All templating functions are available: moment, date, note, tasks, etc.
      ${sanitizedCode}
    `

    // $FlowIgnore[prop-missing] - Function constructor is safe here as code comes from form definition
    const fn = Function.apply(null, ['params', functionBody])
    const result = fn(context)

    // Validate that the code returned an object
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      logDebug(pluginJson, `executeTemplateJSBlock: TemplateJS block "${fieldIdentifier}" returned object with keys: ${Object.keys(result).join(', ')}`)
      return Promise.resolve(result)
    } else if (result !== undefined) {
      const errorMessage = `TemplateJS block "${fieldIdentifier}" should return an object, but returned ${typeof result}. Please update your code to return an object (e.g., return { key: value }).`
      logError(pluginJson, `executeTemplateJSBlock: ${errorMessage}`)
      // Store error in reactWindowData instead of using showMessage
      if (!reactWindowData.pluginData) {
        reactWindowData.pluginData = {}
      }
      ;(reactWindowData.pluginData: any).formSubmissionError = errorMessage
      return Promise.resolve(null)
    } else {
      const errorMessage = `TemplateJS block "${fieldIdentifier}" did not return anything. Please update your code to return an object (e.g., return { key: value }).`
      logError(pluginJson, `executeTemplateJSBlock: ${errorMessage}`)
      // Store error in reactWindowData instead of using showMessage
      if (!reactWindowData.pluginData) {
        reactWindowData.pluginData = {}
      }
      ;(reactWindowData.pluginData: any).formSubmissionError = errorMessage
      return Promise.resolve(null)
    }
  } catch (error) {
    const errorMessage = `Error executing TemplateJS block "${fieldIdentifier}": ${error.message}`
    logError(pluginJson, `executeTemplateJSBlock: ${errorMessage}`)
    // Store error in reactWindowData instead of using showMessage
    if (!reactWindowData.pluginData) {
      reactWindowData.pluginData = {}
    }
    ;(reactWindowData.pluginData: any).formSubmissionError = errorMessage
    return Promise.resolve(null)
  }
}

/**
 * Execute all templatejs blocks in order and merge their results into context
 * @param {Array<{field: Object, code: string, order: number}>} blocks - The templatejs blocks to execute
 * @param {Object} initialContext - The initial execution context
 * @param {PassedData} reactWindowData - The React window data to store errors in
 * @returns {Promise<Object|null>} - The merged context, or null on error (errors are stored in reactWindowData.pluginData.formSubmissionError)
 */
async function executeTemplateJSBlocks(blocks: Array<{ field: Object, code: string, order: number }>, initialContext: Object, reactWindowData: PassedData): Promise<Object | null> {
  let context = { ...initialContext }

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const { field, code } = blocks[blockIndex]
    const result = await executeTemplateJSBlock(field, code, context, blockIndex, reactWindowData)

    if (result === null) {
      // Error occurred and was stored in reactWindowData.pluginData.formSubmissionError
      // Abort execution
      return null
    }

    // Merge the returned object into context
    context = { ...context, ...result }
  }

  return context
}

/**
 * Handle template runner result - check for AI analysis and store in reactWindowData
 * @param {any} templateRunnerResult - The result from templateRunner
 * @param {PassedData} reactWindowData - The React window data to update
 */
function handleTemplateRunnerResult(templateRunnerResult: any, reactWindowData: PassedData): void {
  logDebug(
    pluginJson,
    `handleTemplateRunnerResult: templateRunner result type=${typeof templateRunnerResult}, length=${templateRunnerResult?.length || 0}, includes AI marker=${String(
      templateRunnerResult?.includes?.('==**Templating Error Found**') || false,
    )}`,
  )

  // Check if result contains AI analysis (error message from template rendering)
  if (templateRunnerResult && typeof templateRunnerResult === 'string' && templateRunnerResult.includes('==**Templating Error Found**')) {
    logDebug(pluginJson, `handleTemplateRunnerResult: AI analysis result detected, storing in reactWindowData.pluginData.aiAnalysisResult`)
    // Store AI analysis result in reactWindowData so it can be passed back to React window
    if (!reactWindowData.pluginData) {
      reactWindowData.pluginData = {}
    }
    ;(reactWindowData.pluginData: any).aiAnalysisResult = templateRunnerResult
    logDebug(
      pluginJson,
      `handleTemplateRunnerResult: AI analysis stored, reactWindowData.pluginData.aiAnalysisResult length=${reactWindowData.pluginData.aiAnalysisResult?.length || 0}`,
    )
  } else {
    logDebug(pluginJson, `handleTemplateRunnerResult: No AI analysis result detected in templateRunner result`)
  }
}

// ============================================================================
// Processing Method Handlers
// ============================================================================

/**
 * Process form submission using form-processor method
 * @param {Object} data - The submission data
 * @param {PassedData} reactWindowData - The React window data
 * @returns {Promise<PassedData | null>} - Updated React window data or null on error
 */
async function processFormProcessor(data: any, reactWindowData: PassedData): Promise<PassedData | null> {
  const { receivingTemplateTitle, formValues, shouldOpenInEditor } = data

  if (!receivingTemplateTitle) {
    const errorMessage = 'No Processing Template was Provided; You should set a processing template in your form settings.'
    logError(pluginJson, `processFormProcessor: ${errorMessage}`)
    // Store error in reactWindowData instead of using showMessage
    if (!reactWindowData.pluginData) {
      reactWindowData.pluginData = {}
    }
    ;(reactWindowData.pluginData: any).formSubmissionError = errorMessage
    return reactWindowData // Return reactWindowData with error, not null
  }

  // Step 1: Prepare form values and get templating context
  const formValuesForRendering = prepareFormValuesForRendering(formValues)
  const templatingContext = await getTemplatingContext(formValuesForRendering)

  // Step 2: Extract and execute templatejs blocks
  // Note: We use the full templating context for execution so templatejs blocks have access to moment, date, etc.
  const formFields = reactWindowData?.pluginData?.formFields || []
  const templateJSBlocks = extractTemplateJSBlocks(formFields, 'after')

  const fullContext = await executeTemplateJSBlocks(templateJSBlocks, templatingContext, reactWindowData)
  if (fullContext === null) {
    // Error occurred and was stored in reactWindowData.pluginData.formSubmissionError
    return reactWindowData // Return reactWindowData with error, not null
  }

  // Step 3: Extract only form-specific variables (form values + templatejs block results)
  // Don't pass templating context (modules, globals) to templateRunner - it will add those itself
  // Track which keys are templating context keys (these should be excluded)
  const templatingContextKeys = new Set(Object.keys(templatingContext))

  // Build a clean object with only form-specific variables
  const formSpecificVars: { [string]: any } = {}
  Object.keys(fullContext).forEach((key) => {
    // Only include keys that are NOT in the templating context (i.e., form values or templatejs block results)
    if (!templatingContextKeys.has(key)) {
      formSpecificVars[key] = fullContext[key]
    }
  })

  // Also include original form values (in case templatejs blocks didn't add them)
  Object.keys(formValuesForRendering).forEach((key) => {
    if (!(key in formSpecificVars)) {
      formSpecificVars[key] = formValuesForRendering[key]
    }
  })

  // Step 4: Call templateRunner with only form-specific variables
  const argumentsToSend = [receivingTemplateTitle, shouldOpenInEditor, formSpecificVars]
  clo(argumentsToSend, `processFormProcessor: Calling templateRunner with form-specific variables only (after executing ${templateJSBlocks.length} templatejs blocks)`)

  const templateRunnerResult = await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', argumentsToSend)
  handleTemplateRunnerResult(templateRunnerResult, reactWindowData)

  return reactWindowData
}

/**
 * Process form submission using write-existing method
 * @param {Object} data - The submission data
 * @param {PassedData} reactWindowData - The React window data
 * @returns {Promise<PassedData | null>} - Updated React window data or null on error
 */
async function processWriteExisting(data: any, reactWindowData: PassedData): Promise<PassedData | null> {
  const { getNoteTitled, location, writeUnderHeading, createMissingHeading, formValues, shouldOpenInEditor } = data

  if (!getNoteTitled) {
    const errorMessage = 'No target note was specified. Please set a target note in your form settings.'
    logError(pluginJson, `processWriteExisting: ${errorMessage}`)
    // Store error in reactWindowData so it can be displayed in the UI
    if (!reactWindowData.pluginData) {
      reactWindowData.pluginData = {}
    }
    ;(reactWindowData.pluginData: any).formSubmissionError = errorMessage
    return reactWindowData
  }

  // Step 1: Prepare form values and get templating context
  const formValuesForRendering = prepareFormValuesForRendering(formValues)
  const templatingContext = await getTemplatingContext(formValuesForRendering)

  // Step 2: Extract and execute templatejs blocks
  const formFields = reactWindowData?.pluginData?.formFields || []
  const templateJSBlocks = extractTemplateJSBlocks(formFields, 'after')

  const fullContext = await executeTemplateJSBlocks(templateJSBlocks, templatingContext, reactWindowData)
  if (fullContext === null) {
    // Error occurred and was stored in reactWindowData.pluginData.formSubmissionError
    return reactWindowData // Return reactWindowData with error, not null
  }

  // Step 3: Extract only form-specific variables (form values + templatejs block results)
  // Don't pass templating context (modules, globals) to templateRunner - it will add those itself
  const templatingContextKeys = new Set(Object.keys(templatingContext))

  // Build a clean object with only form-specific variables
  const formSpecificVars: { [string]: any } = {}
  Object.keys(fullContext).forEach((key) => {
    // Only include keys that are NOT in the templating context (i.e., form values or templatejs block results)
    if (!templatingContextKeys.has(key)) {
      formSpecificVars[key] = fullContext[key]
    }
  })

  // Also include original form values (in case templatejs blocks didn't add them)
  Object.keys(formValuesForRendering).forEach((key) => {
    if (!(key in formSpecificVars)) {
      formSpecificVars[key] = formValuesForRendering[key]
    }
  })

  // Step 4: Build template body (DO NOT insert templatejs blocks - they're already executed)
  const templateBody = reactWindowData?.pluginData?.templateBody || data?.templateBody || ''
  const finalTemplateBody =
    templateBody ||
    Object.keys(formSpecificVars)
      .filter((key) => key !== '__isJSON__')
      .map((key) => `${key}: <%- ${key} %>`)
      .join('\n')

  // Step 5: Build templateRunner args with form-specific variables
  const templateRunnerArgs: { [string]: any } = {
    getNoteTitled,
    templateBody: finalTemplateBody,
  }
  // Add form-specific variables (spread after explicit keys to avoid Flow error)
  Object.keys(formSpecificVars).forEach((key) => {
    templateRunnerArgs[key] = formSpecificVars[key]
  })

  // Step 4: Handle location options
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
    if (writeUnderHeading) {
      templateRunnerArgs.writeUnderHeading = writeUnderHeading
      if (createMissingHeading !== undefined) {
        templateRunnerArgs.createMissingHeading = createMissingHeading
      }
    }
  }

  // Step 5: Call templateRunner
  clo(templateRunnerArgs, `processWriteExisting: Calling templateRunner with args`)
  const templateRunnerResult = await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', ['', shouldOpenInEditor, templateRunnerArgs])
  handleTemplateRunnerResult(templateRunnerResult, reactWindowData)

  return reactWindowData
}

/**
 * Process form submission using run-js-only method
 * @param {Object} data - The submission data
 * @param {PassedData} reactWindowData - The React window data
 * @returns {Promise<PassedData | null>} - Updated React window data or null on error
 */
async function processRunJSOnly(data: any, reactWindowData: PassedData): Promise<PassedData | null> {
  const { formValues } = data
  const formFields = reactWindowData?.pluginData?.formFields || []

  logDebug(pluginJson, `processRunJSOnly: formFields.length=${formFields.length}`)

  // Step 1: Prepare form values and get templating context
  const formValuesForRendering = prepareFormValuesForRendering(formValues)
  const templatingContext = await getTemplatingContext(formValuesForRendering)

  // Step 2: Extract and execute templatejs blocks
  const templateJSBlocks = extractTemplateJSBlocks(formFields, 'after')

  if (templateJSBlocks.length === 0) {
    const errorMessage = 'No TemplateJS block found in form fields. Please add a TemplateJS Block field to your form with the JavaScript code to execute.'
    logError(pluginJson, `processRunJSOnly: ${errorMessage}`)
    // Store error in reactWindowData instead of using showMessage
    if (!reactWindowData.pluginData) {
      reactWindowData.pluginData = {}
    }
    ;(reactWindowData.pluginData: any).formSubmissionError = errorMessage
    return reactWindowData // Return reactWindowData with error, not null
  }

  logDebug(pluginJson, `processRunJSOnly: Found ${templateJSBlocks.length} templatejs blocks to execute`)

  const fullContext = await executeTemplateJSBlocks(templateJSBlocks, templatingContext, reactWindowData)
  if (fullContext === null) {
    // Error occurred and was stored in reactWindowData.pluginData.formSubmissionError
    return reactWindowData // Return reactWindowData with error, not null
  }

  // Step 3: Extract only form-specific variables (form values + templatejs block results)
  // Don't pass templating context (modules, globals) - we just want the results
  const templatingContextKeys = new Set(Object.keys(templatingContext))

  // Build a clean object with only form-specific variables (the results)
  const results: { [string]: any } = {}
  Object.keys(fullContext).forEach((key) => {
    // Only include keys that are NOT in the templating context (i.e., form values or templatejs block results)
    if (!templatingContextKeys.has(key)) {
      results[key] = fullContext[key]
    }
  })

  // Step 4: Show results to user (or store in reactWindowData for display)
  const resultsString = Object.keys(results)
    .map((key) => `${key}: ${JSON.stringify(results[key])}`)
    .join('\n')

  logDebug(pluginJson, `processRunJSOnly: JavaScript executed successfully. Results: ${resultsString}`)
  // Store success results in reactWindowData for display in React UI (or use logInfo for console only)
  // Note: This is a success message, not an error, but we can store it for display if needed
  // For now, just log it - user can see results in console
  // If we want to show in UI, we could use formSubmissionError but change the styling to indicate success

  return reactWindowData
}

/**
 * Parse frontmatter from a string (extracts key: value pairs between -- or --- markers)
 * @param {string} content - The content string to parse
 * @returns {Object} - Parsed frontmatter attributes
 */
function parseFrontmatterFromString(content: string): { [string]: string } {
  const attributes: { [string]: string } = {}
  if (!content || typeof content !== 'string') {
    return attributes
  }

  // Match frontmatter between -- or --- markers (can be at start or anywhere)
  // Try --- first (standard YAML frontmatter), then -- (NotePlan style)
  // The closing marker may or may not be followed by a newline
  let frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/)
  if (!frontmatterMatch) {
    frontmatterMatch = content.match(/^--\s*\n([\s\S]*?)\n--(?:\s*\n|$)/)
  }
  if (!frontmatterMatch) {
    logDebug(pluginJson, `parseFrontmatterFromString: No frontmatter markers found in content (length=${content.length}, first 100 chars: "${content.substring(0, 100)}")`)
    return attributes
  }

  const frontmatterContent = frontmatterMatch[1]
  const lines = frontmatterContent.split('\n')

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue // Skip empty lines and comments
    }

    // Match key: value pattern
    const match = trimmedLine.match(/^([^:]+):\s*(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      attributes[key] = value
      logDebug(pluginJson, `parseFrontmatterFromString: Extracted ${key}="${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`)
    }
  }

  logDebug(pluginJson, `parseFrontmatterFromString: Parsed ${Object.keys(attributes).length} attributes: ${Object.keys(attributes).join(', ')}`)
  return attributes
}

/**
 * Process form submission using create-new method
 * @param {Object} data - The submission data
 * @param {PassedData} reactWindowData - The React window data
 * @returns {Promise<PassedData | null>} - Updated React window data or null on error
 */
async function processCreateNew(data: any, reactWindowData: PassedData): Promise<PassedData | null> {
  const { newNoteTitle, newNoteFolder, space, formValues, shouldOpenInEditor } = data

  // Step 1: Get newNoteTitle from multiple sources (templateRunnerArgs, data, or template body frontmatter)
  let newNoteTitleToUse = newNoteTitle || reactWindowData?.pluginData?.newNoteTitle || ''

  // If still empty, try to parse from template body frontmatter
  if (!newNoteTitleToUse || !newNoteTitleToUse.trim()) {
    const templateBody = reactWindowData?.pluginData?.templateBody || data?.templateBody || ''
    if (templateBody) {
      const templateFrontmatter = parseFrontmatterFromString(templateBody)
      if (templateFrontmatter.newNoteTitle) {
        newNoteTitleToUse = templateFrontmatter.newNoteTitle
        logDebug(pluginJson, `processCreateNew: Extracted newNoteTitle from template body frontmatter: "${newNoteTitleToUse}"`)
      }
    }
  }

  // Also check for folder in template body frontmatter if not provided
  let newNoteFolderToUse = newNoteFolder || reactWindowData?.pluginData?.newNoteFolder || ''
  if (!newNoteFolderToUse || !newNoteFolderToUse.trim()) {
    const templateBody = reactWindowData?.pluginData?.templateBody || data?.templateBody || ''
    if (templateBody) {
      const templateFrontmatter = parseFrontmatterFromString(templateBody)
      if (templateFrontmatter.folder) {
        newNoteFolderToUse = templateFrontmatter.folder
        logDebug(pluginJson, `processCreateNew: Extracted folder from template body frontmatter: "${newNoteFolderToUse}"`)
      }
    }
  }

  // Step 2: Prepare form values and get templating context (needed to render template tags)
  const formValuesForRendering = prepareFormValuesForRendering(formValues)
  const templatingContext = await getTemplatingContext(formValuesForRendering)

  // Step 3: Render newNoteTitle template tags if present
  let renderedNewNoteTitle = newNoteTitleToUse
  if (newNoteTitleToUse && typeof newNoteTitleToUse === 'string' && (newNoteTitleToUse.includes('<%') || newNoteTitleToUse.includes('${'))) {
    try {
      // Use templating plugin to render the title (it contains template tags like <%- Contact_Name %>)
      const renderedTitleResult = await DataStore.invokePluginCommandByName('render', 'np.Templating', [newNoteTitleToUse, templatingContext])
      if (renderedTitleResult && typeof renderedTitleResult === 'string') {
        renderedNewNoteTitle = renderedTitleResult
        logDebug(pluginJson, `processCreateNew: Rendered newNoteTitle from "${newNoteTitleToUse}" to "${renderedNewNoteTitle}"`)
      } else {
        logError(pluginJson, `processCreateNew: Invalid result from render for newNoteTitle: ${typeof renderedTitleResult}`)
      }
    } catch (error) {
      logError(pluginJson, `processCreateNew: Error rendering newNoteTitle template: ${error.message}`)
      // Continue with original value - might just be plain text
    }
  }

  // Step 4: Validate and clean rendered new note title
  const cleanedNewNoteTitle = renderedNewNoteTitle ? String(renderedNewNoteTitle).replace(/\n/g, ' ').trim() : ''
  if (!cleanedNewNoteTitle) {
    logError(pluginJson, 'processCreateNew: No new note title was specified. Please set a new note title in your form settings.')
    // Store error in reactWindowData instead of using showMessage
    if (!reactWindowData.pluginData) {
      reactWindowData.pluginData = {}
    }
    ;(reactWindowData.pluginData: any).formSubmissionError = 'No new note title was specified. Please set a new note title in your form settings.'
    return reactWindowData // Return reactWindowData with error, not null
  }

  // Step 5: Extract and execute templatejs blocks
  const formFields = reactWindowData?.pluginData?.formFields || []
  const templateJSBlocks = extractTemplateJSBlocks(formFields, 'after')

  const fullContext = await executeTemplateJSBlocks(templateJSBlocks, templatingContext, reactWindowData)
  if (fullContext === null) {
    // Error occurred and was stored in reactWindowData.pluginData.formSubmissionError
    return reactWindowData // Return reactWindowData with error, not null
  }

  // Step 6: Extract only form-specific variables (form values + templatejs block results)
  // Don't pass templating context (modules, globals) to templateRunner - it will add those itself
  const templatingContextKeys = new Set(Object.keys(templatingContext))

  // Build a clean object with only form-specific variables
  const formSpecificVars: { [string]: any } = {}
  Object.keys(fullContext).forEach((key) => {
    // Only include keys that are NOT in the templating context (i.e., form values or templatejs block results)
    if (!templatingContextKeys.has(key)) {
      formSpecificVars[key] = fullContext[key]
    }
  })

  // Also include original form values (in case templatejs blocks didn't add them)
  Object.keys(formValuesForRendering).forEach((key) => {
    if (!(key in formSpecificVars)) {
      formSpecificVars[key] = formValuesForRendering[key]
    }
  })

  // Step 7: Build template body (DO NOT insert templatejs blocks - they're already executed)
  const templateBody = reactWindowData?.pluginData?.templateBody || data?.templateBody || ''
  const finalTemplateBody =
    templateBody ||
    Object.keys(formSpecificVars)
      .filter((key) => key !== '__isJSON__')
      .map((key) => `${key}: <%- ${key} %>`)
      .join('\n')

  // Step 8: Build templateRunner args with form-specific variables
  const templateRunnerArgs: { [string]: any } = {
    newNoteTitle: cleanedNewNoteTitle,
    templateBody: finalTemplateBody,
  }
  // Add form-specific variables (spread after explicit keys to avoid Flow error)
  Object.keys(formSpecificVars).forEach((key) => {
    templateRunnerArgs[key] = formSpecificVars[key]
  })

  // Step 9: Handle folder path and teamspace (use extracted folder if available)
  let folderPath = newNoteFolderToUse && newNoteFolderToUse.trim() ? newNoteFolderToUse.trim() : '/'

  // Render folder template tags if present
  if (folderPath && typeof folderPath === 'string' && (folderPath.includes('<%') || folderPath.includes('${'))) {
    try {
      const renderedFolderResult = await DataStore.invokePluginCommandByName('render', 'np.Templating', [folderPath, templatingContext])
      if (renderedFolderResult && typeof renderedFolderResult === 'string') {
        folderPath = renderedFolderResult
        logDebug(pluginJson, `processCreateNew: Rendered folder from "${newNoteFolderToUse}" to "${folderPath}"`)
      } else {
        logError(pluginJson, `processCreateNew: Invalid result from render for folder: ${typeof renderedFolderResult}`)
      }
    } catch (error) {
      logError(pluginJson, `processCreateNew: Error rendering folder template: ${error.message}`)
      // Continue with original value
    }
  }
  if (space && space.trim() && !folderPath.startsWith('%%NotePlanCloud%%')) {
    if (folderPath === '/' || folderPath === '') {
      folderPath = `%%NotePlanCloud%%/${space}/`
    } else {
      const cleanFolder = folderPath.startsWith('/') ? folderPath.slice(1) : folderPath
      folderPath = `%%NotePlanCloud%%/${space}/${cleanFolder}`
    }
    logDebug(pluginJson, `processCreateNew: Prefixed folder with teamspace: ${folderPath}`)
  }
  templateRunnerArgs.folder = folderPath

  // Step 10: Call templateRunner
  clo(templateRunnerArgs, `processCreateNew: Calling templateRunner with args`)
  const templateRunnerResult = await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', ['', shouldOpenInEditor, templateRunnerArgs])
  handleTemplateRunnerResult(templateRunnerResult, reactWindowData)

  return reactWindowData
}

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
      const rawCode = String(field.templateJSContent).trim()
      // Sanitize the code (replace smart quotes, etc.)
      const code = sanitizeTemplateJSCode(rawCode)
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

  // Validate submission type
  if (type !== 'submit') {
    logDebug(pluginJson, `handleSubmitButtonClick: type is not 'submit', returning`)
    return reactWindowData
  }

  if (!formValues) {
    logError(pluginJson, `handleSubmitButtonClick: formValues is undefined`)
    return reactWindowData
  }

  // Mark form values as JSON for templating plugin
  formValues['__isJSON__'] = true
  const shouldOpenInEditor = data.shouldOpenInEditor !== false // Default to true if not set

  // Determine processing method
  const method = processingMethod || (receivingTemplateTitle ? 'form-processor' : 'write-existing')

  // Add shouldOpenInEditor to data for processing functions
  data.shouldOpenInEditor = shouldOpenInEditor

  // Route to appropriate processing method
  let result: PassedData | null = null
  if (method === 'form-processor') {
    result = await processFormProcessor(data, reactWindowData)
  } else if (method === 'create-new') {
    result = await processCreateNew(data, reactWindowData)
  } else if (method === 'write-existing') {
    result = await processWriteExisting(data, reactWindowData)
  } else if (method === 'run-js-only') {
    result = await processRunJSOnly(data, reactWindowData)
  } else {
    const errorMessage = `Unknown processing method: ${method}`
    logError(pluginJson, `handleSubmitButtonClick: ${errorMessage}`)
    // Store error in reactWindowData instead of using showMessage
    if (!reactWindowData.pluginData) {
      reactWindowData.pluginData = {}
    }
    ;(reactWindowData.pluginData: any).formSubmissionError = errorMessage
    return reactWindowData // Return reactWindowData with error, not null
  }

  // Return result - even if null, check if there's an error message to display
  if (result === null) {
    // If result is null, return reactWindowData if it has an error message, otherwise return null
    if (reactWindowData?.pluginData?.formSubmissionError) {
      return reactWindowData
    }
    return null
  }
  logDebug(
    pluginJson,
    `handleSubmitButtonClick: Returning reactWindowData, has aiAnalysisResult=${String(!!reactWindowData?.pluginData?.aiAnalysisResult)}, aiAnalysisResult length=${
      reactWindowData?.pluginData?.aiAnalysisResult?.length || 0
    }`,
  )
  return reactWindowData
}
