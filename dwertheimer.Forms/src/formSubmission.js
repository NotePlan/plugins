// @flow
//--------------------------------------------------------------------------
// Form Submission Handling - Processing form submissions and calling TemplateRunner
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getRenderContext as getRenderContextLocal } from '../../np.Templating/src/Templating.js'
import { type PassedData } from './NPTemplateForm.js'
import { logError, logDebug, clo, JSP } from '@helpers/dev'

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
 * Simplified form submission result - only contains what the window needs to know
 * @typedef {Object} FormSubmissionResult
 * @property {boolean} success - Whether the submission was successful
 * @property {string} [formSubmissionError] - Error message if submission failed
 * @property {string} [aiAnalysisResult] - AI analysis result if template error was detected
 */
export type FormSubmissionResult = {
  success: boolean,
  formSubmissionError?: string,
  aiAnalysisResult?: string,
}

/**
 * Resolve a single conditional-values output from source value and conditions.
 * First match wins. Used only at form submission; conditional-values are not rendered in the dialog.
 *
 * @param {string} sourceVal - Raw value from the watched field
 * @param {Array<{ matchTerm: string, value: string }>} conds - matchTerm/value pairs
 * @param {'regex'|'string'} mode - Match mode
 * @param {boolean} caseSens - Case-sensitive matching
 * @param {boolean} trim - Trim source before matching
 * @param {string} [defaultVal] - Value when no condition matches
 * @returns {string} Resolved value
 */
function resolveConditionalValue(
  sourceVal: string,
  conds: Array<{ matchTerm: string, value: string }>,
  mode: 'regex' | 'string',
  caseSens: boolean,
  trim: boolean,
  defaultVal?: string,
): string {
  const toMatch = trim ? (typeof sourceVal === 'string' ? sourceVal : String(sourceVal ?? '')).trim() : String(sourceVal ?? '')
  if (!Array.isArray(conds) || conds.length === 0) {
    return defaultVal ?? ''
  }
  for (let i = 0; i < conds.length; i++) {
    const c = conds[i]
    const term = c?.matchTerm ?? ''
    const outVal = c?.value ?? ''
    if (mode === 'regex') {
      try {
        const flags = caseSens ? 'u' : 'iu'
        const re = new RegExp(term, flags)
        if (re.test(toMatch)) {
          return outVal
        }
      } catch (e) {
        logError(pluginJson, `resolveConditionalValue: invalid regex matchTerm "${term}": ${(e: any).message}`)
        continue
      }
    } else {
      const eq = caseSens ? toMatch === term : toMatch.toLowerCase() === term.toLowerCase()
      if (eq) {
        return outVal
      }
    }
  }
  return defaultVal ?? ''
}

/**
 * Resolve conditional-values fields from current form values. Conditional-values are only for
 * final form submission processing; they are not rendered in the dialog.
 *
 * @param {Object} formValues - Current form values (source fields must already be present)
 * @param {Array<Object>} formFields - Form fields array
 * @returns {Object} formValues with conditional-values keys set to resolved values
 */
function resolveConditionalValuesFields(formValues: Object, formFields: Array<Object>): Object {
  if (!formFields || formFields.length === 0) {
    return formValues
  }
  const out = { ...formValues }
  formFields.forEach((field) => {
    if (field.type !== 'conditional-values' || !field.key) {
      return
    }
    const sourceFieldKey = field.sourceFieldKey || ''
    const sourceValue = sourceFieldKey ? String(out[sourceFieldKey] ?? '') : ''
    const rawConditions = Array.isArray(field.conditions) ? field.conditions : []
    const conditions = rawConditions.filter((c) => (c?.matchTerm ?? '').trim() !== '')
    const matchMode = field.matchMode === 'regex' ? 'regex' : 'string'
    const caseSensitive = field.caseSensitive ?? false
    const trimSourceBeforeMatch = field.trimSourceBeforeMatch !== false
    const defaultWhenNoMatch = field.defaultWhenNoMatch
    const resolved = resolveConditionalValue(sourceValue, conditions, matchMode, caseSensitive, trimSourceBeforeMatch, defaultWhenNoMatch)
    out[field.key] = resolved
  })
  return out
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
    // Conditional-values are resolved only at submit via resolveConditionalValuesFields; do not add them here
    // Templatejs-block keys are output-only (computed by the block at submit); do not add to formValues passed to getRenderContext
    if (field.type === 'conditional-values' || field.type === 'templatejs-block' || !field.key) return
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
  })

  if (missingFields.length > 0) {
    logDebug(`ensureAllFormFieldsExist: Added/fixed ${missingFields.length} missing field(s): ${missingFields.join(', ')}`)
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
  // Resolve conditional-values from current form values (only at submission; not rendered in dialog)
  const withConditionalsResolved = formFields ? resolveConditionalValuesFields(formValues, formFields) : formValues
  // Then ensure all fields exist if formFields is provided
  const withAllFields = formFields ? ensureAllFormFieldsExist(withConditionalsResolved, formFields) : withConditionalsResolved

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
 * Uses local import of np.Templating.getRenderContext to preserve prototype chains and methods.
 * @param {Object} formValues - The form values to merge into context
 * @returns {Promise<Object>} - The full templating context
 */
async function getTemplatingContext(formValues: Object): Promise<Object> {
  const sanitizedFormValues = deepSanitizeNulls(formValues || {})
  const templatingContext = await getRenderContextLocal(sanitizedFormValues)
  // IMPORTANT: Do NOT deepSanitizeNulls() the returned templatingContext.
  // It contains class instances (e.g. DateModule) and sanitizing would traverse/alter them.
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
  logDebug(`extractTemplateJSBlocks: Checking ${formFields?.length || 0} formFields for templatejs-block (executeTiming="${executeTiming || 'any'}")`)
  formFields.forEach((field, index) => {
    const fieldType = field?.type || '(no-type)'
    const hasContent = !!field?.templateJSContent
    const fieldExecuteTiming = field?.executeTiming || 'after'
    if (fieldType === 'templatejs-block') {
      logDebug(
        `extractTemplateJSBlocks: Found templatejs-block at index ${index}, key="${field?.key || '(no-key)'}", label="${field?.label || '(no-label)'}", hasContent=${String(
          hasContent,
        )}, executeTiming="${fieldExecuteTiming}"`,
      )
    }
    if (field.type === 'templatejs-block' && field.templateJSContent) {
      const rawCode = String(field.templateJSContent).trim()
      // Sanitize the code when extracting (replace smart quotes, etc.)
      const code = sanitizeTemplateJSCode(rawCode)
      if (code) {
        if (!executeTiming || fieldExecuteTiming === executeTiming) {
          blocks.push({ field, code, order: index })
          logDebug(
            `extractTemplateJSBlocks: Added block at index ${index}, key="${field?.key || '(no-key)'}", executeTiming="${fieldExecuteTiming}" matches filter="${
              executeTiming || 'any'
            }"`,
          )
        } else {
          logDebug(`extractTemplateJSBlocks: Skipped block at index ${index} (executeTiming="${fieldExecuteTiming}" !== filter="${executeTiming}")`)
        }
      } else {
        logDebug(`extractTemplateJSBlocks: Skipped block at index ${index} (code empty after sanitize)`)
      }
    }
  })
  // Sort by order (top to bottom)
  blocks.sort((a, b) => a.order - b.order)
  logDebug(`extractTemplateJSBlocks: Returning ${blocks.length} block(s)`)
  return blocks
}

/**
 * Replace smart quotes (curly quotes) with straight quotes — inlined to avoid calling into np.Templating
 * during templatejs-block execution, which can cause bridge/recursion freeze when Forms invokes getRenderContext.
 * @param {string} text - The text to process
 * @returns {string} - Text with smart quotes replaced
 */
function replaceSmartQuotesLocal(text: string): string {
  if (!text || typeof text !== 'string') return text
  return text
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
}

/**
 * Sanitize templateJS code before execution
 * - Replaces smart quotes with straight quotes (uses local impl to avoid np.Templating call during block run)
 * @param {string} code - The raw templateJS code
 * @returns {string} - The sanitized code
 */
function sanitizeTemplateJSCode(code: string): string {
  if (!code || typeof code !== 'string') {
    return code || ''
  }
  let sanitized = replaceSmartQuotesLocal(code)
  if (typeof sanitized !== 'string') sanitized = String(sanitized)
  return sanitized
}


/**
 * Execute a single templatejs block with the given context
 * @param {Object} field - The field object
 * @param {string} code - The JavaScript code to execute
 * @param {Object} context - The execution context
 * @param {number} blockIndex - The index of this block (for error messages)
 * @param {PassedData} _reactWindowData - Unused; errors are returned via __blockError (no direct writes)
 * @returns {Object|null} - The returned object from the block, or { __blockError } on error
 */
function executeTemplateJSBlock(field: Object, code: string, context: Object, blockIndex: number, _reactWindowData: PassedData): Object | null {
  const fieldIdentifier = field.key || generateKeyFromLabel(field.label || '', blockIndex)
  try {
    // Sanitize the code before execution (replace smart quotes, etc.)
    const sanitizedCode = sanitizeTemplateJSCode(code)
    if (sanitizedCode !== code) {
      logDebug(`executeTemplateJSBlock: Code was sanitized (smart quotes replaced)`)
    }

    // CRITICAL: Use the original context directly from np.Templating to preserve prototype chains and methods.
    // Shallow copying breaks objects like `date` that have methods on their prototype (e.g., date.now()).
    // We'll enumerate keys for variable declarations, but pass the original context object to the function.
    const contextKeys: string[] = []
    for (const key in context) {
      // $FlowFixMe[method-unbinding] - safe use for own-property check
      if (!Object.prototype.hasOwnProperty.call(context, key)) continue
      contextKeys.push(key)
    }
    // Use the original context directly - don't create a copy
    const contextToUse = context

    // Build context variables - only create variables for valid JavaScript identifiers
    const contextVars = contextKeys
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
    
    // Execute the function with the original context to preserve prototype chains and methods
    let result
    try {
      result = fn(contextToUse)
    } catch (fnError) {
      const msg = fnError instanceof Error ? fnError.message : String(fnError)
      const stack = fnError instanceof Error ? fnError.stack : ''
      logError(pluginJson, `executeTemplateJSBlock: TemplateJS function threw: ${msg}\nstack: ${stack || '(no stack)'}`)
      throw new Error(`TemplateJS block "${fieldIdentifier}" threw when called with context: ${msg}`)
    }

    // Validate that the code returned an object
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      const resultKeys = Object.keys(result)
      
      // Create a plain object copy of result to avoid proxy/getter issues
      const plainResult: { [string]: any } = {}
      for (const key of resultKeys) {
        plainResult[key] = result[key]
      }

      // NotePlan's Promise is not a constructor (can't use new Promise()).
      // Just return plainResult directly - the async function will wrap it automatically.
      return plainResult
    } else if (result !== undefined) {
      const errorMessage = `TemplateJS block "${fieldIdentifier}" should return an object, but returned ${typeof result}. Please update your code to return an object (e.g., return { key: value }).`
      logError(pluginJson, `executeTemplateJSBlock: ${errorMessage}`)
      return { __blockError: errorMessage }
    } else {
      const errorMessage = `TemplateJS block "${fieldIdentifier}" did not return anything. Please update your code to return an object (e.g., return { key: value }).`
      logError(pluginJson, `executeTemplateJSBlock: ${errorMessage}`)
      return { __blockError: errorMessage }
    }
  } catch (error) {
    const errorMessage = `Error executing TemplateJS block "${fieldIdentifier}": ${error.message}`
    logError(pluginJson, `executeTemplateJSBlock: ${errorMessage}`)
    return { __blockError: errorMessage }
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
  // Templatejs-block keys must not be in the scope passed to the block (output-only).
  const templatejsBlockKeys = new Set(blocks.map((b) => b.field?.key).filter(Boolean))
  // CRITICAL: Use the original context directly from np.Templating to preserve prototype chains and methods.
  // Shallow copying breaks objects like `date` that have methods on their prototype.
  // We'll filter out templatejs-block keys when building the contextKeys list for variable declarations,
  // but pass the original context object directly to the function.
  
  // Build a filtered context object that excludes templatejs-block keys (for variable declarations)
  // But we'll still pass the original context to the function to preserve methods
  let context: { [string]: any } = {}
  try {
    // Use for...in to get all enumerable properties (not just own)
    for (const k in initialContext) {
      // $FlowFixMe[method-unbinding] - safe use for own-property check
      if (!Object.prototype.hasOwnProperty.call(initialContext, k)) continue
      if (!templatejsBlockKeys.has(k)) {
        // Still build context object for key enumeration, but we'll use original context when calling fn
        context[k] = (initialContext: any)[k]
      }
    }
  } catch (e) {
    logError(pluginJson, `executeTemplateJSBlocks: failed to enumerate initialContext keys: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
  
  // Use the original context directly (not the filtered copy) to preserve prototype chains
  // But we'll merge results back into the filtered context object for subsequent blocks
  const contextToUse = initialContext

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const { field, code } = blocks[blockIndex]
    // Pass the original contextToUse (initialContext) to preserve prototype chains and methods
    // The filtered context is only used for key enumeration, not execution
    const result = executeTemplateJSBlock(field, code, contextToUse, blockIndex, reactWindowData)

    if (result === null) {
      return null
    }
    if (result && typeof result === 'object' && (result: any).__blockError) {
      return result
    }

    // CRITICAL: Avoid spread operator on result - it might contain proxies that freeze
    // Build a plain object copy instead
    const plainResult: { [string]: any } = {}
    if (result && typeof result === 'object') {
      const resultKeys = Object.keys(result)
      for (const key of resultKeys) {
        plainResult[key] = result[key]
      }
    }
    context = { ...context, ...plainResult }
  }

  return context
}

/**
 * Handle template runner result - check for AI analysis and formSubmissionError.
 * Returns simplified result with only what the window needs to know.
 * @param {any} templateRunnerResult - The result from templateRunner
 * @param {Array<Object>} formFields - Form fields array (for error messages)
 * @returns {FormSubmissionResult} Simplified result with success/error info
 */
function handleTemplateRunnerResult(templateRunnerResult: any, formFields: Array<Object>): FormSubmissionResult {
  logDebug(
    pluginJson,
    `handleTemplateRunnerResult: templateRunner result type=${typeof templateRunnerResult}, length=${templateRunnerResult?.length || 0}, includes AI marker=${String(
      templateRunnerResult?.includes?.('==**Templating Error Found**') || false,
    )}`,
  )

  // Check if result contains AI analysis (error message from template rendering)
  if (templateRunnerResult && typeof templateRunnerResult === 'string' && templateRunnerResult.includes('==**Templating Error Found**')) {
    logDebug(`handleTemplateRunnerResult: AI analysis result detected, returning result with aiAnalysisResult`)
    return {
      success: false,
      aiAnalysisResult: templateRunnerResult,
    }
  }
  if (templateRunnerResult === null || (typeof templateRunnerResult === 'string' && templateRunnerResult.trim() === '')) {
    // Template runner returned null or empty string - this indicates an error occurred
    // NOTE: undefined is NOT an error - when templateRunner successfully creates a note via templateNew,
    // it returns undefined (see NPTemplateRunner.js line 874). This is a valid success case.
    logError(pluginJson, `handleTemplateRunnerResult: Template runner returned null or empty string - this indicates an error occurred during template execution`)
    const formFieldKeys = formFields.filter((f) => f.key).map((f) => f.key)

    let errorMessage = 'Template execution failed. The error "null is not an object" typically means the templating plugin encountered a null value when processing the form data.'
    if (formFieldKeys.length > 0) {
      errorMessage += ` All form fields were sent: ${formFieldKeys.join(', ')}.`
    }
    errorMessage += ' This error occurs when the templating plugin tries to process a null value in the data object.'
    errorMessage += ' The form data has been sanitized to remove nulls, but the templating plugin may have created null values during frontmatter processing.'
    errorMessage += ' Please check the NotePlan Plugin Console logs for the detailed error message from the Templating plugin.'
    return {
      success: false,
      formSubmissionError: errorMessage,
    }
  }
  // Success case: undefined (note created), string (rendered content), or other valid result
  logDebug(
    pluginJson,
    `handleTemplateRunnerResult: Template execution completed successfully. Result type: ${typeof templateRunnerResult}, value: ${
      templateRunnerResult === undefined ? 'undefined (note created)' : String(templateRunnerResult).substring(0, 100)
    }`,
  )
  return { success: true }
}

// ============================================================================
// Processing Method Handlers
// ============================================================================

/**
 * Process form submission using form-processor method
 * @param {Object} data - The submission data
 * @param {Array<Object>} formFields - Form fields array
 * @returns {Promise<FormSubmissionResult>} - Simplified result with success/error info
 */
async function processFormProcessor(data: any, formFields: Array<Object>): Promise<FormSubmissionResult> {
  const { receivingTemplateTitle, formValues, shouldOpenInEditor } = data

  if (!receivingTemplateTitle) {
    const errorMessage = 'No Processing Template was Provided; You should set a processing template in your form settings.'
    logError(pluginJson, `processFormProcessor: ${errorMessage}`)
    return { success: false, formSubmissionError: errorMessage }
  }
  logDebug(`processFormProcessor: Starting with ${Object.keys(formValues || {}).length} formValues keys, ${formFields.length} formFields`)

  // Step 1: Prepare form values and get templating context
  const formValuesForRendering = prepareFormValuesForRendering(formValues, formFields)
  logDebug(
    pluginJson,
    `processFormProcessor: After prepareFormValuesForRendering, have ${Object.keys(formValuesForRendering).length} keys: ${Object.keys(formValuesForRendering).join(', ')}`,
  )

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
      logDebug(`processFormProcessor: All ${formFields.length} form fields are present in formValuesForRendering`)
    }
  }

  const templatingContext = await getTemplatingContext(formValuesForRendering)

  // Step 2: Extract and execute templatejs blocks
  // Note: We use the full templating context for execution so templatejs blocks have access to moment, date, etc.

  const templateJSBlocks = extractTemplateJSBlocks(formFields, 'after')

  // Create minimal PassedData object for executeTemplateJSBlocks (it doesn't actually use most properties)
  const minimalWindowData: PassedData = {
    pluginData: { formFields },
    componentPath: '',
    debug: false,
    logProfilingMessage: false,
    returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFormSubmitFromHTMLView' },
  }
  const fullContext = await executeTemplateJSBlocks(templateJSBlocks, templatingContext, minimalWindowData)
  if (fullContext === null) {
    return { success: false, formSubmissionError: 'Failed to prepare template context.' }
  }
  if (fullContext && typeof fullContext === 'object' && (fullContext: any).__blockError) {
    return { success: false, formSubmissionError: (fullContext: any).__blockError }
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

  // Step 4: Deep sanitize formSpecificVars to ensure no null/undefined values exist anywhere
  // This prevents errors in the templating plugin when it tries to process the data
  const sanitizedFormSpecificVars = deepSanitizeNulls(formSpecificVars)
  logDebug(`processFormProcessor: After deep sanitization, sanitizedFormSpecificVars has ${Object.keys(sanitizedFormSpecificVars).length} keys`)

  // Step 5: Call templateRunner with form-specific variables
  const argumentsToSend = [receivingTemplateTitle, shouldOpenInEditor, sanitizedFormSpecificVars]
  const templateRunnerResult = await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', argumentsToSend)

  // Step 7: Handle result
  return handleTemplateRunnerResult(templateRunnerResult, formFields)
}

/**
 * Process form submission using write-existing method
 * @param {Object} data - The submission data
 * @param {Array<Object>} formFields - Form fields array
 * @returns {Promise<FormSubmissionResult>} - Simplified result with success/error info
 */
async function processWriteExisting(data: any, formFields: Array<Object>): Promise<FormSubmissionResult> {
  const { getNoteTitled, location, writeUnderHeading, createMissingHeading, formValues, shouldOpenInEditor } = data

  if (!getNoteTitled) {
    const errorMessage = 'No target note was specified. Please set a target note in your form settings.'
    logError(pluginJson, `processWriteExisting: ${errorMessage}`)
    return { success: false, formSubmissionError: errorMessage }
  }

  // Step 1: Prepare form values and get templating context
  // CRITICAL: Pass formFields to ensure all fields exist
  const formValuesForRendering = prepareFormValuesForRendering(formValues, formFields)
  const templatingContext = await getTemplatingContext(formValuesForRendering)

  // Step 2: Extract and execute templatejs blocks
  const templateJSBlocks = extractTemplateJSBlocks(formFields, 'after')

  // Create minimal PassedData object for executeTemplateJSBlocks (it doesn't actually use most properties)
  const minimalWindowData: PassedData = {
    pluginData: { formFields },
    componentPath: '',
    debug: false,
    logProfilingMessage: false,
    returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFormSubmitFromHTMLView' },
  }
  const fullContext = await executeTemplateJSBlocks(templateJSBlocks, templatingContext, minimalWindowData)
  if (fullContext === null) {
    return { success: false, formSubmissionError: 'Failed to prepare template context.' }
  }
  if (fullContext && typeof fullContext === 'object' && (fullContext: any).__blockError) {
    return { success: false, formSubmissionError: (fullContext: any).__blockError }
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
  const templateBody = data?.templateBody || ''
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
  return handleTemplateRunnerResult(templateRunnerResult, formFields)
}

/**
 * Process form submission using run-js-only method
 * @param {Object} data - The submission data
 * @param {Array<Object>} formFields - Form fields array
 * @returns {Promise<FormSubmissionResult>} - Simplified result with success/error info
 */
async function processRunJSOnly(data: any, formFields: Array<Object>): Promise<FormSubmissionResult> {
  const { formValues } = data

  logDebug(`processRunJSOnly: formFields.length=${formFields.length}`)

  // Step 1: Prepare form values and get templating context
  // CRITICAL: Pass formFields to ensure all fields exist
  const formValuesForRendering = prepareFormValuesForRendering(formValues, formFields)
  const templatingContext = await getTemplatingContext(formValuesForRendering)

  // Step 2: Extract and execute templatejs blocks
  const templateJSBlocks = extractTemplateJSBlocks(formFields, 'after')

  if (templateJSBlocks.length === 0) {
    const errorMessage = 'No TemplateJS block found in form fields. Please add a TemplateJS Block field to your form with the JavaScript code to execute.'
    logError(pluginJson, `processRunJSOnly: ${errorMessage}`)
    return { success: false, formSubmissionError: errorMessage }
  }

  logDebug(`processRunJSOnly: Found ${templateJSBlocks.length} templatejs blocks to execute`)

  // Create minimal PassedData object for executeTemplateJSBlocks (it doesn't actually use most properties)
  const minimalWindowData: PassedData = {
    pluginData: { formFields },
    componentPath: '',
    debug: false,
    logProfilingMessage: false,
    returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFormSubmitFromHTMLView' },
  }
  const fullContext = await executeTemplateJSBlocks(templateJSBlocks, templatingContext, minimalWindowData)
  if (fullContext === null) {
    return { success: false, formSubmissionError: 'Failed to prepare template context.' }
  }
  if (fullContext && typeof fullContext === 'object' && (fullContext: any).__blockError) {
    return { success: false, formSubmissionError: (fullContext: any).__blockError }
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

  logDebug(`processRunJSOnly: JavaScript executed successfully. Results: ${resultsString}`)
  // Success - results are logged to console
  return { success: true }
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
    logDebug(`parseFrontmatterFromString: No frontmatter markers found in content (length=${content.length}, first 100 chars: "${content.substring(0, 100)}")`)
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
      logDebug(`parseFrontmatterFromString: Extracted ${key}="${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`)
    }
  }

  logDebug(`parseFrontmatterFromString: Parsed ${Object.keys(attributes).length} attributes: ${Object.keys(attributes).join(', ')}`)
  return attributes
}

/**
 * Process form submission using create-new method
 * @param {Object} data - The submission data
 * @param {Array<Object>} formFields - Form fields array
 * @returns {Promise<FormSubmissionResult>} - Simplified result with success/error info
 */
async function processCreateNew(data: any, formFields: Array<Object>): Promise<FormSubmissionResult> {
  const { newNoteTitle, newNoteFolder, space, formValues, shouldOpenInEditor } = data

  // Step 1: Get newNoteTitle from multiple sources (data, or template body frontmatter)
  let newNoteTitleToUse = newNoteTitle || ''

  // If still empty, try to parse from template body frontmatter
  if (!newNoteTitleToUse || !newNoteTitleToUse.trim()) {
    const templateBody = data?.templateBody || ''
    if (templateBody) {
      const templateFrontmatter = parseFrontmatterFromString(templateBody)
      if (templateFrontmatter.newNoteTitle) {
        newNoteTitleToUse = templateFrontmatter.newNoteTitle
        logDebug(`processCreateNew: Extracted newNoteTitle from template body frontmatter: "${newNoteTitleToUse}"`)
      }
    }
  }

  // Also check for folder in template body frontmatter if not provided
  let newNoteFolderToUse = newNoteFolder || ''
  if (!newNoteFolderToUse || !newNoteFolderToUse.trim()) {
    const templateBody = data?.templateBody || ''
    if (templateBody) {
      const templateFrontmatter = parseFrontmatterFromString(templateBody)
      if (templateFrontmatter.folder) {
        newNoteFolderToUse = templateFrontmatter.folder
        logDebug(`processCreateNew: Extracted folder from template body frontmatter: "${newNoteFolderToUse}"`)
      }
    }
  }
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
        logDebug(`processCreateNew: Rendered newNoteTitle from "${newNoteTitleToUse}" to "${renderedNewNoteTitle}"`)
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
    return {
      success: false,
      formSubmissionError: 'No new note title was specified. Please set a new note title in your form settings.',
    }
  }

  // Step 5: Extract and execute templatejs blocks
  const templateJSBlocks = extractTemplateJSBlocks(formFields, 'after')
  // Create minimal PassedData object for executeTemplateJSBlocks (it doesn't actually use most properties)
  const minimalWindowData: PassedData = {
    pluginData: { formFields },
    componentPath: '',
    debug: false,
    logProfilingMessage: false,
    returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFormSubmitFromHTMLView' },
  }
  const fullContext = await executeTemplateJSBlocks(templateJSBlocks, templatingContext, minimalWindowData)
  if (fullContext === null) {
    return { success: false, formSubmissionError: 'Failed to prepare template context.' }
  }
  if (fullContext && typeof fullContext === 'object' && (fullContext: any).__blockError) {
    return { success: false, formSubmissionError: (fullContext: any).__blockError }
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
  // Get new note frontmatter and body content (templateBody)
  let newNoteFrontmatter = data?.newNoteFrontmatter || ''
  const templateBody = data?.templateBody || ''

  // Ensure title is preserved: if frontmatter exists, check if it has a title field
  // If not, and body doesn't start with "# <%- newNoteTitle %>", add title to frontmatter
  if (newNoteFrontmatter && newNoteFrontmatter.trim()) {
    // Parse frontmatter to check for title field
    const frontmatterLines = newNoteFrontmatter.trim().split('\n')
    let hasTitleField = false

    for (const line of frontmatterLines) {
      const trimmedLine = line.trim()
      // Check if line matches "title:" (case-insensitive, with optional whitespace)
      if (trimmedLine.match(/^title\s*:/i)) {
        hasTitleField = true
        break
      }
    }

    // If no title field exists, check body content
    if (!hasTitleField) {
      const bodyFirstLine = templateBody.trim().split('\n')[0] || ''
      const hasTitleHeading = bodyFirstLine.trim() === '# <%- newNoteTitle %>'

      // If body doesn't have the title heading, add title to frontmatter
      if (!hasTitleHeading) {
        // Use the original newNoteTitle template tag if it contains template syntax,
        // otherwise use the newNoteTitle variable (which will be available in template context)
        const originalNewNoteTitle = newNoteTitleToUse || data?.newNoteTitle || ''

        // If newNoteTitle contains template tags, use them directly; otherwise reference newNoteTitle variable
        let titleTemplateTag = '<%- newNoteTitle %>'
        if (originalNewNoteTitle && typeof originalNewNoteTitle === 'string' && originalNewNoteTitle.includes('<%')) {
          // Use the original template tag (e.g., "<%- Contact_Name %>")
          titleTemplateTag = originalNewNoteTitle
        }

        // Add title field to the top of frontmatter
        newNoteFrontmatter = `title: ${titleTemplateTag}\n${newNoteFrontmatter.trim()}`
        logDebug(`processCreateNew: Added title field to frontmatter to preserve title from being overwritten: title: ${titleTemplateTag}`)
      }
    }
  }

  let finalTemplateBody = ''

  // If we have frontmatter, combine it with templateBody using -- delimiters
  if (newNoteFrontmatter && newNoteFrontmatter.trim()) {
    const parts = ['--', newNoteFrontmatter.trim(), '--']
    if (templateBody && templateBody.trim()) {
      parts.push(templateBody.trim())
    }
    finalTemplateBody = parts.join('\n')
    logDebug(`processCreateNew: Combined newNoteFrontmatter and templateBody with -- delimiters`)
  } else {
    // No frontmatter, just use templateBody (backward compatibility - old forms may have -- in templateBody)
    finalTemplateBody =
      templateBody ||
      Object.keys(formSpecificVars)
        .filter((key) => key !== '__isJSON__')
        .map((key) => `${key}: <%- ${key} %>`)
        .join('\n')
  }

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
  // If form has a field named "folder", it overrides the form definition (see ProcessingMethodSection)
  const formFolderRaw = formSpecificVars['folder']
  const formFolder = formFolderRaw != null && String(formFolderRaw).trim() !== '' ? String(formFolderRaw).trim() : ''
  let folderSource = newNoteFolderToUse && newNoteFolderToUse.trim() ? newNoteFolderToUse.trim() : ''
  if (formFolder !== '') {
    folderSource = formFolder
    logDebug(`processCreateNew: Using form field "folder" override: "${folderSource}"`)
  }
  let folderPath = folderSource || '/'

  // Render folder template tags if present
  if (folderPath && typeof folderPath === 'string' && (folderPath.includes('<%') || folderPath.includes('${'))) {
    try {
      const renderedFolderResult = await DataStore.invokePluginCommandByName('render', 'np.Templating', [folderPath, templatingContext])
      if (renderedFolderResult && typeof renderedFolderResult === 'string') {
        folderPath = renderedFolderResult
        logDebug(`processCreateNew: Rendered folder to "${folderPath}"`)
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
    logDebug(`processCreateNew: Prefixed folder with teamspace: ${folderPath}`)
  }
  templateRunnerArgs.folder = folderPath

  // Step 10: Call templateRunner
  clo(templateRunnerArgs, `processCreateNew: Calling templateRunner with args`)
  const templateRunnerResult = await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', ['', shouldOpenInEditor, templateRunnerArgs])
  return handleTemplateRunnerResult(templateRunnerResult, formFields)
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
 * @param {PassedData} reactWindowData - the current data in the React Window (used to read formFields)
 * @returns {Promise<FormSubmissionResult>} - Simplified result with success/error info
 */
export async function handleSubmitButtonClick(data: any, reactWindowData: PassedData): Promise<FormSubmissionResult> {
  const { type, formValues, processingMethod, receivingTemplateTitle } = data
  const method = processingMethod || (receivingTemplateTitle ? 'form-processor' : 'write-existing')
  clo(data, `handleSubmitButtonClick: data BEFORE acting on it`)

  // Validate submission type
  if (type !== 'submit') {
    logDebug(`handleSubmitButtonClick: type is not 'submit', returning success`)
    return { success: true }
  }

  if (!formValues) {
    logError(pluginJson, `handleSubmitButtonClick: formValues is undefined`)
    return {
      success: false,
      formSubmissionError: 'Form values are missing. Please try submitting again.',
    }
  }

  // Validate that all form fields are present in formValues (even if empty)
  // Conditional-values are resolved in prepareFormValuesForRendering; do not add them here
  // Templatejs-block keys are output-only (computed by the block at submit); do not add to formValues or jsContext
  const formFields = reactWindowData?.pluginData?.formFields || []
  if (formFields && formFields.length > 0) {
    const missingFields: Array<string> = []
    formFields.forEach((field) => {
      if (field.type === 'conditional-values' || field.type === 'templatejs-block') return
      if (field.key && !(field.key in formValues)) {
        missingFields.push(field.key)
        // Add missing field with empty value
        formValues[field.key] = field.default ?? field.value ?? ''
      }
    })
    if (missingFields.length > 0) {
      logDebug(`handleSubmitButtonClick: Added ${missingFields.length} missing field(s) to formValues: ${missingFields.join(', ')}`)
    }
  }

  // Mark form values as JSON for templating plugin
  formValues['__isJSON__'] = true
  const shouldOpenInEditor = data.shouldOpenInEditor !== false // Default to true if not set

  // Add shouldOpenInEditor to data for processing functions
  data.shouldOpenInEditor = shouldOpenInEditor

  // Route to appropriate processing method
  let result: FormSubmissionResult
  if (method === 'form-processor') {
    result = await processFormProcessor(data, formFields)
  } else if (method === 'create-new') {
    result = await processCreateNew(data, formFields)
  } else if (method === 'write-existing') {
    result = await processWriteExisting(data, formFields)
  } else if (method === 'run-js-only') {
    result = await processRunJSOnly(data, formFields)
  } else {
    const errorMessage = `Unknown processing method: ${method}`
    logError(pluginJson, `handleSubmitButtonClick: ${errorMessage}`)
    return { success: false, formSubmissionError: errorMessage }
  }

  logDebug(
    pluginJson,
    `handleSubmitButtonClick: Returning result, success=${String(result.success)}, has aiAnalysisResult=${String(!!result.aiAnalysisResult)}, aiAnalysisResult length=${
      result.aiAnalysisResult?.length || 0
    }`,
  )
  return result
}
