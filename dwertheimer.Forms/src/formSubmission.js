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
 * Deep sanitize an object to ensure no null or undefined values exist
 * Recursively converts null/undefined to empty strings
 * @param {any} obj - The object to sanitize
 * @returns {any} - Sanitized object with no null/undefined values
 */
function deepSanitizeNulls(obj: any): any {
  // Handle null/undefined at the root
  if (obj === null || obj === undefined) {
    return ''
  }
  
  // Handle arrays - recursively sanitize each item
  if (Array.isArray(obj)) {
    return obj.map((item) => deepSanitizeNulls(item))
  }
  
  // Handle objects - but check for null first (typeof null === 'object' in JavaScript!)
  if (obj === null) {
    return ''
  }
  
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const sanitized: { [string]: any } = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key]
        // Convert null/undefined to empty string
        if (value === null || value === undefined) {
          sanitized[key] = ''
        } else {
          // Recursively sanitize nested structures
          sanitized[key] = deepSanitizeNulls(value)
        }
      }
    }
    return sanitized
  }
  
  // For primitives, Dates, etc., return as-is
  return obj
}

/**
 * Ensure all form fields exist in formValues, adding missing ones with empty string values
 * @param {Object} formValues - The form values object
 * @param {Array<Object>} formFields - The form fields array
 * @returns {Object} - Form values with all fields guaranteed to exist
 */
function ensureAllFormFieldsExist(formValues: Object, formFields: Array<Object>): Object {
  if (!formFields || formFields.length === 0) {
    return formValues
  }

  const ensured = { ...formValues }
  const missingFields: Array<string> = []
  
  formFields.forEach((field) => {
    if (field.key) {
      // Check if key exists (even if value is undefined/null/empty string)
      if (!(field.key in ensured)) {
        missingFields.push(field.key)
        // Add missing field with empty value (or default if available)
        ensured[field.key] = field.default ?? field.value ?? ''
      } else if (ensured[field.key] === undefined || ensured[field.key] === null) {
        // Field exists but is undefined/null - ensure it's at least an empty string
        missingFields.push(`${field.key} (was undefined/null)`)
        ensured[field.key] = field.default ?? field.value ?? ''
      }
    }
  })
  
  if (missingFields.length > 0) {
    logDebug(pluginJson, `ensureAllFormFieldsExist: Added/fixed ${missingFields.length} missing field(s): ${missingFields.join(', ')}`)
  }
  
  return ensured
}

/**
 * Prepare form values for rendering by removing internal flags and ensuring all fields exist
 * @param {Object} formValues - The raw form values
 * @param {Array<Object>} formFields - The form fields array (optional, for validation)
 * @returns {Object} - Cleaned form values with all fields guaranteed
 */
function prepareFormValuesForRendering(formValues: Object, formFields?: Array<Object>): Object {
  // First ensure all fields exist if formFields is provided
  const withAllFields = formFields ? ensureAllFormFieldsExist(formValues, formFields) : formValues
  
  // Create cleaned object - use explicit iteration to avoid any spread issues
  const cleaned: { [string]: any } = {}
  Object.keys(withAllFields).forEach((key) => {
    if (key !== '__isJSON__') {
      // Ensure value is never undefined or null - convert to empty string
      const value = withAllFields[key]
      cleaned[key] = value === undefined || value === null ? '' : value
    }
  })
  
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
  
  // CRITICAL: The templating context might contain null values from its internal processing
  // Sanitize it to prevent issues when we merge it with form values
  const sanitizedContext = deepSanitizeNulls(templatingContext)
  logDebug(pluginJson, `getTemplatingContext: Sanitized templating context (removed any null/undefined values)`)
  
  return sanitizedContext
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
 * Also detects when templateRunner returns null/undefined/empty, which indicates an error
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
  } else if (templateRunnerResult === null || (typeof templateRunnerResult === 'string' && templateRunnerResult.trim() === '')) {
    // Template runner returned null or empty string - this indicates an error occurred
    // NOTE: undefined is NOT an error - when templateRunner successfully creates a note via templateNew,
    // it returns undefined (see NPTemplateRunner.js line 874). This is a valid success case.
    logError(pluginJson, `handleTemplateRunnerResult: Template runner returned null or empty string - this indicates an error occurred during template execution`)
    if (!reactWindowData.pluginData) {
      reactWindowData.pluginData = {}
    }
    
    // Provide a more specific error message based on the actual error
    // The error "null is not an object (evaluating 'Object.getOwnPropertyNames')" indicates
    // that the templating plugin's JSP function encountered a null value when trying to log/debug
    const formFields = reactWindowData?.pluginData?.formFields || []
    const formFieldKeys = formFields.filter((f) => f.key).map((f) => f.key)
    
    let errorMessage = 'Template execution failed. The error "null is not an object" typically means the templating plugin encountered a null value when processing the form data.'
    if (formFieldKeys.length > 0) {
      errorMessage += ` All form fields were sent: ${formFieldKeys.join(', ')}.`
    }
    errorMessage += ' This error occurs when the templating plugin tries to process a null value in the data object.'
    errorMessage += ' The form data has been sanitized to remove nulls, but the templating plugin may have created null values during frontmatter processing.'
    errorMessage += ' Please check the NotePlan Plugin Console logs for the detailed error message from the Templating plugin.'
    ;(reactWindowData.pluginData: any).formSubmissionError = errorMessage
  } else {
    // Success case: undefined (note created), string (rendered content), or other valid result
    logDebug(pluginJson, `handleTemplateRunnerResult: Template execution completed successfully. Result type: ${typeof templateRunnerResult}, value: ${templateRunnerResult === undefined ? 'undefined (note created)' : String(templateRunnerResult).substring(0, 100)}`)
    // Clear any previous error state
    if (reactWindowData.pluginData) {
      delete (reactWindowData.pluginData: any).formSubmissionError
    }
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

  // Get formFields for validation
  const formFields = reactWindowData?.pluginData?.formFields || []
  logDebug(pluginJson, `processFormProcessor: Starting with ${Object.keys(formValues || {}).length} formValues keys, ${formFields.length} formFields`)

  // Step 1: Prepare form values and get templating context
  // CRITICAL: Pass formFields to ensure all fields exist
  const formValuesForRendering = prepareFormValuesForRendering(formValues, formFields)
  logDebug(pluginJson, `processFormProcessor: After prepareFormValuesForRendering, have ${Object.keys(formValuesForRendering).length} keys: ${Object.keys(formValuesForRendering).join(', ')}`)
  
  // Validate that all form fields are present
  if (formFields && formFields.length > 0) {
    const missingFields: Array<string> = []
    formFields.forEach((field) => {
      if (field.key && !(field.key in formValuesForRendering)) {
        missingFields.push(field.key)
      }
    })
    if (missingFields.length > 0) {
      logError(pluginJson, `processFormProcessor: CRITICAL - Missing fields after prepareFormValuesForRendering: ${missingFields.join(', ')}`)
    } else {
      logDebug(pluginJson, `processFormProcessor: All ${formFields.length} form fields are present in formValuesForRendering`)
    }
  }
  
  const templatingContext = await getTemplatingContext(formValuesForRendering)

  // Step 2: Extract and execute templatejs blocks
  // Note: We use the full templating context for execution so templatejs blocks have access to moment, date, etc.
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
  // CRITICAL: Always include ALL form values first, even if they conflict with templating context
  // Form values take precedence and must be present (even if empty strings) to prevent template errors
  const formSpecificVars: { [string]: any } = {}
  
  // First, include ALL original form values (these take precedence and must be present)
  // Use explicit iteration to avoid any spread issues
  Object.keys(formValuesForRendering).forEach((key) => {
    const value = formValuesForRendering[key]
    // Ensure value is never undefined or null
    formSpecificVars[key] = value === undefined || value === null ? '' : value
  })
  
  logDebug(pluginJson, `processFormProcessor: After adding formValues, formSpecificVars has ${Object.keys(formSpecificVars).length} keys: ${Object.keys(formSpecificVars).join(', ')}`)
  
  // Then, include templatejs block results (but don't override form values)
  Object.keys(fullContext).forEach((key) => {
    // Only include keys that are NOT in the templating context (i.e., templatejs block results)
    // AND that are not already in formSpecificVars (form values take precedence)
    if (!templatingContextKeys.has(key) && !(key in formSpecificVars)) {
      const value = fullContext[key]
      // Deep sanitize to ensure no null/undefined values exist (including nested objects/arrays)
      formSpecificVars[key] = deepSanitizeNulls(value)
    }
  })
  
  // CRITICAL: Final validation - ensure ALL form fields are present in formSpecificVars
  if (formFields && formFields.length > 0) {
    const missingFields: Array<string> = []
    formFields.forEach((field) => {
      if (field.key && !(field.key in formSpecificVars)) {
        missingFields.push(field.key)
        // Add missing field with empty value
        formSpecificVars[field.key] = field.default ?? field.value ?? ''
      } else if (field.key && (formSpecificVars[field.key] === undefined || formSpecificVars[field.key] === null)) {
        missingFields.push(`${field.key} (was undefined/null)`)
        // Fix undefined/null values
        formSpecificVars[field.key] = field.default ?? field.value ?? ''
      }
    })
    if (missingFields.length > 0) {
      logError(pluginJson, `processFormProcessor: CRITICAL - Fixed missing/null fields in formSpecificVars: ${missingFields.join(', ')}`)
    } else {
      logDebug(pluginJson, `processFormProcessor: Final validation - All ${formFields.length} form fields are present in formSpecificVars`)
    }
  }
  
  logDebug(pluginJson, `processFormProcessor: Final formSpecificVars has ${Object.keys(formSpecificVars).length} keys before calling templateRunner`)

  // Step 4: Deep sanitize formSpecificVars to ensure no null/undefined values exist anywhere
  // This prevents errors in the templating plugin when it tries to process the data
  const sanitizedFormSpecificVars = deepSanitizeNulls(formSpecificVars)
  logDebug(pluginJson, `processFormProcessor: After deep sanitization, sanitizedFormSpecificVars has ${Object.keys(sanitizedFormSpecificVars).length} keys`)
  
  // CRITICAL: Verify no null/undefined values exist after sanitization
  // Also do a second pass of sanitization to catch any edge cases
  const nullCheckResults: Array<string> = []
  const checkForNulls = (obj: any, path: string = ''): void => {
    if (obj === null || obj === undefined) {
      nullCheckResults.push(`${path} is ${obj === null ? 'null' : 'undefined'}`)
      return
    }
    // Check for null explicitly (typeof null === 'object' in JavaScript!)
    if (obj === null) {
      nullCheckResults.push(`${path} is null (caught by explicit check)`)
      return
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        checkForNulls(item, `${path}[${index}]`)
      })
    } else if (typeof obj === 'object') {
      Object.keys(obj).forEach((key) => {
        const value = obj[key]
        const newPath = path ? `${path}.${key}` : key
        if (value === null || value === undefined) {
          nullCheckResults.push(`${newPath} is ${value === null ? 'null' : 'undefined'}`)
        } else {
          checkForNulls(value, newPath)
        }
      })
    }
  }
  checkForNulls(sanitizedFormSpecificVars)
  if (nullCheckResults.length > 0) {
    logError(pluginJson, `processFormProcessor: CRITICAL - Found null/undefined values after sanitization: ${nullCheckResults.join(', ')}`)
    // Force replace any remaining nulls with a second sanitization pass
    const doubleSanitized = deepSanitizeNulls(sanitizedFormSpecificVars)
    // Copy all keys from doubleSanitized to sanitizedFormSpecificVars
    Object.keys(doubleSanitized).forEach((key) => {
      sanitizedFormSpecificVars[key] = doubleSanitized[key]
    })
    // Also check for any keys that might have been missed
    Object.keys(sanitizedFormSpecificVars).forEach((key) => {
      if (sanitizedFormSpecificVars[key] === null || sanitizedFormSpecificVars[key] === undefined) {
        logError(pluginJson, `processFormProcessor: CRITICAL - Key "${key}" is still null/undefined after double sanitization, forcing to empty string`)
        sanitizedFormSpecificVars[key] = ''
      }
    })
  } else {
    logDebug(pluginJson, `processFormProcessor: Verified - no null/undefined values found in sanitizedFormSpecificVars`)
  }
  
  // Log the actual structure being passed (first level only to avoid huge logs)
  const sanitizedKeys = Object.keys(sanitizedFormSpecificVars)
  const sanitizedPreview: { [string]: string } = {}
  sanitizedKeys.forEach((key) => {
    const value = sanitizedFormSpecificVars[key]
    if (value === null || value === undefined) {
      sanitizedPreview[key] = `[NULL/UNDEFINED - THIS IS THE PROBLEM]`
      logError(pluginJson, `processFormProcessor: CRITICAL - Key "${key}" is null/undefined in preview, this will cause JSP to fail!`)
    } else if (typeof value === 'object' && value !== null) {
      sanitizedPreview[key] = `[object: ${Array.isArray(value) ? 'array' : 'object'}]`
    } else {
      sanitizedPreview[key] = String(value).substring(0, 50)
    }
  })
  logDebug(pluginJson, `processFormProcessor: sanitizedFormSpecificVars preview: ${JSON.stringify(sanitizedPreview, null, 2)}`)
  
  // Final safety check: ensure the object itself is not null and has the expected structure
  if (!sanitizedFormSpecificVars || typeof sanitizedFormSpecificVars !== 'object') {
    logError(pluginJson, `processFormProcessor: CRITICAL - sanitizedFormSpecificVars is not a valid object: ${typeof sanitizedFormSpecificVars}`)
  }

  // Step 5: Call templateRunner with only form-specific variables (sanitized)
  const argumentsToSend = [receivingTemplateTitle, shouldOpenInEditor, sanitizedFormSpecificVars]
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

  // Get formFields for validation
  const formFields = reactWindowData?.pluginData?.formFields || []

  // Step 1: Prepare form values and get templating context
  // CRITICAL: Pass formFields to ensure all fields exist
  const formValuesForRendering = prepareFormValuesForRendering(formValues, formFields)
  const templatingContext = await getTemplatingContext(formValuesForRendering)

  // Step 2: Extract and execute templatejs blocks
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
  // CRITICAL: Always include ALL form values first, even if they conflict with templating context
  // Form values take precedence and must be present (even if empty strings) to prevent template errors
  const formSpecificVars: { [string]: any } = {}
  
  // First, include ALL original form values (these take precedence and must be present)
  Object.keys(formValuesForRendering).forEach((key) => {
    formSpecificVars[key] = formValuesForRendering[key]
  })
  
  // Then, include templatejs block results (but don't override form values)
  Object.keys(fullContext).forEach((key) => {
    // Only include keys that are NOT in the templating context (i.e., templatejs block results)
    // AND that are not already in formSpecificVars (form values take precedence)
    if (!templatingContextKeys.has(key) && !(key in formSpecificVars)) {
      formSpecificVars[key] = fullContext[key]
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
  // CRITICAL: Pass formFields to ensure all fields exist
  const formValuesForRendering = prepareFormValuesForRendering(formValues, formFields)
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
  // CRITICAL: Always include ALL form values first, even if they conflict with templating context
  // Form values take precedence and must be present (even if empty strings) to prevent template errors
  const results: { [string]: any } = {}
  
  // First, include ALL original form values (these take precedence and must be present)
  Object.keys(formValuesForRendering).forEach((key) => {
    results[key] = formValuesForRendering[key]
  })
  
  // Then, include templatejs block results (but don't override form values)
  Object.keys(fullContext).forEach((key) => {
    // Only include keys that are NOT in the templating context (i.e., templatejs block results)
    // AND that are not already in results (form values take precedence)
    if (!templatingContextKeys.has(key) && !(key in results)) {
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

  // Get formFields for validation
  const formFields = reactWindowData?.pluginData?.formFields || []

  // Step 2: Prepare form values and get templating context (needed to render template tags)
  // CRITICAL: Pass formFields to ensure all fields exist
  const formValuesForRendering = prepareFormValuesForRendering(formValues, formFields)
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
  // CRITICAL: Always include ALL form values first, even if they conflict with templating context
  // Form values take precedence and must be present (even if empty strings) to prevent template errors
  const formSpecificVars: { [string]: any } = {}
  
  // First, include ALL original form values (these take precedence and must be present)
  Object.keys(formValuesForRendering).forEach((key) => {
    formSpecificVars[key] = formValuesForRendering[key]
  })
  
  // Then, include templatejs block results (but don't override form values)
  Object.keys(fullContext).forEach((key) => {
    // Only include keys that are NOT in the templating context (i.e., templatejs block results)
    // AND that are not already in formSpecificVars (form values take precedence)
    if (!templatingContextKeys.has(key) && !(key in formSpecificVars)) {
      formSpecificVars[key] = fullContext[key]
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
    if (!reactWindowData.pluginData) {
      reactWindowData.pluginData = {}
    }
    ;(reactWindowData.pluginData: any).formSubmissionError = 'Form values are missing. Please try submitting again.'
    return reactWindowData
  }

  // Validate that all form fields are present in formValues (even if empty)
  // This ensures templates receive all expected variables
  const formFields = reactWindowData?.pluginData?.formFields || []
  if (formFields && formFields.length > 0) {
    const missingFields: Array<string> = []
    formFields.forEach((field) => {
      if (field.key && !(field.key in formValues)) {
        missingFields.push(field.key)
        // Add missing field with empty value
        formValues[field.key] = field.default ?? field.value ?? ''
      }
    })
    if (missingFields.length > 0) {
      logDebug(pluginJson, `handleSubmitButtonClick: Added ${missingFields.length} missing field(s) to formValues: ${missingFields.join(', ')}`)
    }
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
