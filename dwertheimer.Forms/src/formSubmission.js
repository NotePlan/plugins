// @flow
//--------------------------------------------------------------------------
// Form Submission Handling - Processing form submissions and calling TemplateRunner
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { type PassedData } from './NPTemplateForm.js'
import { logError, logDebug, clo, JSP } from '@helpers/dev'
import { promiseResolve, promiseRace, delayMs } from '@helpers/promisePolyfill'

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
 * Return a new PassedData object with pluginData merged from updates.
 * Used to send errors/aiAnalysisResult back via RESPONSE without mutating reactWindowData.
 * Pass undefined for a key to remove it from pluginData (e.g. clear formSubmissionError on success).
 * @param {PassedData} reactWindowData - The base window data (not mutated)
 * @param {{ formSubmissionError?: string, aiAnalysisResult?: string }} updates - Keys to merge; undefined means delete
 * @returns {PassedData} New object with pluginData updated
 */
function withPluginDataUpdates(reactWindowData: PassedData, updates: { formSubmissionError?: string, aiAnalysisResult?: string }): PassedData {
  const pd = { ...(reactWindowData.pluginData || {}) }
  for (const k of Object.keys(updates)) {
    if ((updates: any)[k] === undefined) {
      delete (pd: any)[k]
    } else {
      ;(pd: any)[k] = (updates: any)[k]
    }
  }
  return { ...reactWindowData, pluginData: pd }
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

/** Timeout (ms) for getRenderContext invoke - prevents indefinite freeze if np.Templating hangs */
const GET_RENDER_CONTEXT_TIMEOUT_MS = 20000

/**
 * Set to 1,2,3,4 to inject throws in getTemplatingContext to find where it freezes.
 * Run with step N: you get DIAG-GTC-N and stop. Set step to N+1 and run again;
 * if it freezes, the freeze is between GTC-N and GTC-(N+1). 0 = off.
 * @type {number}
 */
const GET_TEMPLATING_CONTEXT_DIAG_STEP = 0

/**
 * If > 0: throw before copying that key index when copying bridge context to plain object.
 * Use to find which key/value causes hang: run with 1,2,3,... until it freezes instead of throwing.
 * 0 = off.
 * @type {number}
 */
const GET_TEMPLATING_CONTEXT_DIAG_COPY_KEY = 0

/**
 * Get the full templating context with form values merged in
 * Uses a timeout to avoid indefinite freeze if np.Templating.getRenderContext hangs (e.g. bridge/context issues).
 * @param {Object} formValues - The form values to merge into context
 * @returns {Promise<Object>} - The full templating context
 */
async function getTemplatingContext(formValues: Object): Promise<Object> {
  if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
  logDebug('getTemplatingContext: [DIAG] entry LBB')
  logDebug(`getTemplatingContext: Getting templating render context... (formValues keys: ${Object.keys(formValues || {}).join(', ')})`)
  if (GET_TEMPLATING_CONTEXT_DIAG_STEP >= 1) throw new Error('DIAG-GTC-1-after-log-before-invoke')
  if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
  logDebug('getTemplatingContext: [DIAG] about to invoke getRenderContext LBB')
  const invokePromise = DataStore.invokePluginCommandByName('getRenderContext', 'np.Templating', [formValues])
  if (GET_TEMPLATING_CONTEXT_DIAG_STEP >= 2) throw new Error('DIAG-GTC-2-after-invoke-before-await')
  let templatingContext: Object
  if (typeof setTimeout === 'undefined') {
    templatingContext = await invokePromise
  } else {
    const timeoutIdRef: { id: ReturnType<typeof setTimeout> | null } = { id: null }
    const timeoutPromise = new Promise((_resolve: (any) => void, reject: (reason: any) => void) => {
      timeoutIdRef.id = setTimeout(() => {
        reject(new Error(`getRenderContext (np.Templating) did not return within ${GET_RENDER_CONTEXT_TIMEOUT_MS}ms - possible bridge/plugin hang`))
      }, GET_RENDER_CONTEXT_TIMEOUT_MS)
    })
    const clearTimeoutOnInvoke = (): void => {
      if (timeoutIdRef.id != null && typeof clearTimeout !== 'undefined') {
        clearTimeout(timeoutIdRef.id)
        timeoutIdRef.id = null
      }
    }
    try {
      templatingContext = await promiseRace([
        invokePromise.then((v: Object) => {
          clearTimeoutOnInvoke()
          return v
        }),
        timeoutPromise,
      ])
      if (GET_TEMPLATING_CONTEXT_DIAG_STEP >= 3) throw new Error('DIAG-GTC-3-after-await')
    } catch (err) {
      clearTimeoutOnInvoke()
      if (err instanceof Error && err.message.includes('did not return within')) {
        logError(pluginJson, `getTemplatingContext: ${err.message}. Check np.Templating getRenderContext and NotePlan plugin bridge.`)
      }
      throw err
    }
  }
  // CRITICAL: Do not touch the bridge result (Object.keys, spread, etc.) — it can freeze (proxy/getters).
  // Log without touching context so we know we're past the await.
  if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
  logDebug('getTemplatingContext: bridge returned (copying to plain object) LBB')

  // Copy bridge result into a plain object key-by-key so later code never touches the live bridge object.
  const plainContext: { [string]: any } = {}
  let keyIndex = 0
  try {
    for (const k in templatingContext) {
      // $FlowFixMe[method-unbinding] - safe use for own-property check on bridge result
      if (!Object.prototype.hasOwnProperty.call(templatingContext, k)) continue
      keyIndex += 1
      if (GET_TEMPLATING_CONTEXT_DIAG_COPY_KEY > 0 && GET_TEMPLATING_CONTEXT_DIAG_COPY_KEY === keyIndex) {
        throw new Error(`DIAG-COPY-before-key-${keyIndex}-${String(k)}`)
      }
      plainContext[k] = (templatingContext: any)[k]
    }
  } catch (copyErr) {
    if (copyErr instanceof Error && copyErr.message.startsWith('DIAG-COPY-')) throw copyErr
    logError(pluginJson, `getTemplatingContext: failed to copy bridge context at keyIndex=${keyIndex}: ${copyErr instanceof Error ? copyErr.message : String(copyErr)}`)
    throw copyErr
  }

  if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
  logDebug(`getTemplatingContext: Got templating context with ${Object.keys(plainContext).length} keys LBB`)
  if (GET_TEMPLATING_CONTEXT_DIAG_STEP >= 4) throw new Error('DIAG-GTC-4-after-copy-before-sanitize')

  // CRITICAL: The templating context might contain null values from its internal processing
  // Sanitize it to prevent issues when we merge it with form values
  const sanitizedContext = deepSanitizeNulls(plainContext)
  logDebug(`getTemplatingContext: Sanitized templating context (removed any null/undefined values)`)

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
 * Set true to inject throws after each context-var assignment in the generated templatejs body.
 * Run with flag on: the last DIAG-VAR-N-key in the error is the last key that completed; the hang is on the next key.
 * Example: if you see "DIAG-VAR-4-noteTitle", key 4 (noteTitle) finished; remove that throw and re-run;
 * if it then hangs, the hang is on key 5 (or on user code if 4 was the last var).
 * @type {boolean}
 */
const TEMPLATEJS_DIAG_CONTEXT_VARS = false

/**
 * When true: profile the execution context (shallow) and THROW right before the user's TemplateJS block executes.
 * This is meant to prevent freezes while still showing what was in `context`.
 * @type {boolean}
 */
const TEMPLATEJS_DIAG_PROFILE_CONTEXT_AND_THROW = false // Set to true to profile context and stop before execution

/**
 * DIAG: Test templatejs-block execution with empty context first, then add keys one at a time
 * 0 = off (normal execution)
 * 1 = execute with empty context first
 * 2 = execute with empty context, then add keys one at a time until freeze (forward order)
 * 3 = execute with empty context, then add keys one at a time until freeze (reverse order, to find last safe key)
 * 4 = binary search: test with chunks to find problematic key combination
 * @type {number}
 */
const TEMPLATEJS_DIAG_TEST_CONTEXT_KEYS = 0 // Set to 0 to use safeContext directly (fix for freeze issue)

/**
 * DIAG: Throw checkpoints during workingContext build to locate the exact hang point.
 * These throws are more reliable than logs when the NotePlan log buffer dies.
 *
 * - Set TEMPLATEJS_DIAG_THROW_WORKING_KEY to a 1-based key index (matching the "Adding key X/63" logs).
 * - Set TEMPLATEJS_DIAG_THROW_WORKING_STAGE to decide where to throw for that key.
 *
 * Stages:
 * 0 = off
 * 1 = at start of loop iteration (before any access)
 * 2 = after `key = contextKeys[i]` (before assigning workingContext[key])
 * 3 = after `workingContext[key] = safeContext[key]`
 * 4 = right before calling `fn(workingContext)` (when shouldCallFn is true)
 * 5 = right after calling `fn(workingContext)` (when shouldCallFn is true)
 * @type {number}
 */
const TEMPLATEJS_DIAG_THROW_WORKING_KEY = 0
const TEMPLATEJS_DIAG_THROW_WORKING_STAGE = 0

/**
 * DIAG: Throw right before calling np.Templating templateRunner in processCreateNew/processWriteExisting.
 * Use to confirm we reach templateRunner (log buffers can lie).
 * @type {boolean}
 */
const DIAG_THROW_BEFORE_TEMPLATERUNNER = false

/**
 * DIAG: Skip actual fn() call and return dummy result to test if freeze is in function execution or elsewhere.
 * @type {boolean}
 */
const DIAG_SKIP_FN_CALL_USE_DUMMY_RESULT = true

/**
 * Create a safe, shallow, log-friendly summary of a value.
 * Avoids JSON.stringify and avoids deep traversal (can be huge / circular).
 * @param {any} value
 * @returns {string}
 */
function summarizeContextValue(value: any): string {
  try {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    const t = typeof value
    if (t === 'string') {
      const s = value.length > 120 ? `${value.substring(0, 120)}…(len=${value.length})` : value
      return `string "${s.replace(/\n/g, '\\n')}"`
    }
    if (t === 'number' || t === 'boolean' || t === 'bigint') return `${t} ${String(value)}`
    if (t === 'function') return `function ${value.name || '(anonymous)'}`
    if (Array.isArray(value)) return `array(len=${value.length})`
    if (value instanceof Date) return `Date(${value.toISOString()})`

    // Objects (including Moment, NotePlan bridge types, etc.)
    // $FlowFixMe[method-unbinding] - safe call pattern for type tag
    const tag = Object.prototype.toString.call(value)
    const ctorName = value && value.constructor && value.constructor.name ? value.constructor.name : '(no-constructor)'
    if (tag === '[object Object]') {
      // Only count keys for plain objects (safe-ish); avoid for non-plain.
      let keyCount = 'N/A'
      try {
        keyCount = String(Object.keys((value: any)).length)
      } catch (e) {
        keyCount = 'ERR'
      }
      return `${tag} ctor=${ctorName} keys=${keyCount}`
    }
    return `${tag} ctor=${ctorName}`
  } catch (e) {
    return `<<error summarizing value: ${e instanceof Error ? e.message : String(e)}>>`
  }
}

/**
 * Build a shallow profile of the TemplateJS execution context.
 * @param {Object} context
 * @param {number} maxKeys - cap to avoid log explosions
 * @returns {string}
 */
function profileTemplateJSContext(context: Object, maxKeys: number = 200): string {
  let keys: Array<string> = []
  try {
    keys = Object.keys(context || {})
  } catch (e) {
    return `CTXPROFILE: failed to Object.keys(context): ${e instanceof Error ? e.message : String(e)}`
  }
  const lines: Array<string> = []
  lines.push(`CTXPROFILE: keys=${String(keys.length)} (showing up to ${String(maxKeys)})`)
  const limit = Math.min(keys.length, maxKeys)
  for (let i = 0; i < limit; i++) {
    const k = keys[i]
    try {
      // Access value once; if getter throws, catch and report.
      const v = (context: any)[k]
      lines.push(`CTXPROFILE: [${String(i)}] ${k}: ${summarizeContextValue(v)}`)
    } catch (readErr) {
      lines.push(`CTXPROFILE: [${String(i)}] ${k}: <<error reading value: ${readErr instanceof Error ? readErr.message : String(readErr)}>>`)
    }
  }
  if (keys.length > limit) {
    lines.push(`CTXPROFILE: … truncated, ${String(keys.length - limit)} more key(s) not shown`)
  }
  return lines.join('\n')
}

/** Ms to delay before each LBB log so the log buffer has time to flush before a freeze.
 * Set to 0 to disable. In NotePlan's JSContext there is no real setTimeout; the polyfill
 * only yields to the microtask queue and does not give the log buffer time to flush, so
 * delays do not help. Kept as a constant so LBB log points can be re-enabled elsewhere. */
const LBB_DELAY_MS = 0

/**
 * Execute a single templatejs block with the given context
 * @param {Object} field - The field object
 * @param {string} code - The JavaScript code to execute
 * @param {Object} context - The execution context
 * @param {number} blockIndex - The index of this block (for error messages)
 * @param {PassedData} _reactWindowData - Unused; errors are returned via __blockError (no direct writes)
 * @returns {Promise<Object|null>} - The returned object from the block, or { __blockError } on error
 */
async function executeTemplateJSBlock(field: Object, code: string, context: Object, blockIndex: number, _reactWindowData: PassedData): Promise<Object | null> {
  // throw new Error(`DIAG-10b: executeTemplateJSBlock after field access (before try) ${field.label || ''}, ${blockIndex} ${JSON.stringify(field, null, 2)}`)
  const fieldIdentifier = field.key || generateKeyFromLabel(field.label || '', blockIndex)
  // throw new Error(`DIAG-10c: executeTemplateJSBlock after fieldIdentifier ${fieldIdentifier}`)
  try {
    // throw new Error('DIAG-11: executeTemplateJSBlock try start')
    if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
    logDebug(`executeTemplateJSBlock: Executing templatejs block from field "${fieldIdentifier}" LBB`)

    // Sanitize the code before execution (replace smart quotes, etc.)
    const sanitizedCode = sanitizeTemplateJSCode(code)
    if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
    logDebug(`executeTemplateJSBlock: LBB after sanitizeTemplateJSCode (len=${sanitizedCode.length})`)
    if (sanitizedCode !== code) {
      logDebug(`executeTemplateJSBlock: Code was sanitized (smart quotes replaced)`)
    }

    // CRITICAL: Build a fresh plain object copy of context to avoid proxy/getter issues
    // Even though getTemplatingContext() returns a plain object, nested values might still be proxies
    // Building incrementally (like testContext) avoids freeze issues when accessing all properties at once
    // NOTE: This is a SHALLOW copy - functions and objects are copied by reference (same objects),
    // so functions will still work correctly. Only the top-level object structure is new.
    const safeContext: { [string]: any } = {}
    const contextKeys = Object.keys(context)
    let functionCount = 0
    // Build incrementally to avoid freeze (same approach as testContext that works)
    for (const key of contextKeys) {
      safeContext[key] = context[key]
      // Verify functions are preserved (same reference)
      if (typeof context[key] === 'function') {
        functionCount++
      }
    }
    // Test that safeContext works by calling fn with it (if diagnostic mode is off, this is the only call)
    if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
    logDebug(`executeTemplateJSBlock: LBB after building safeContext copy (${contextKeys.length} keys, ${functionCount} functions preserved)`)

    // Build context variables - only create variables for valid JavaScript identifiers
    // When TEMPLATEJS_DIAG_CONTEXT_VARS is true, inject throws after each assignment; last DIAG-VAR-N-key = last key that completed.
    const contextVars = contextKeys
      .map((key, index) => {
        if (isValidIdentifier(key)) {
          const assign = `const ${key} = params.${key};`
          if (TEMPLATEJS_DIAG_CONTEXT_VARS) {
            return `${assign}\n    throw new Error('DIAG-VAR-${index}-${key}');`
          }
          return assign
        }
        // For invalid identifiers, don't create a variable - user can access via params['key-name']
        if (TEMPLATEJS_DIAG_CONTEXT_VARS) {
          return `// Key "${key}" is not a valid JavaScript identifier - access via params['${key}']\n    throw new Error('DIAG-VAR-${index}-${key}');`
        }
        return `// Key "${key}" is not a valid JavaScript identifier - access via params['${key}']`
      })
      .join('\n')
    if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
    logDebug(`executeTemplateJSBlock: LBB after contextVars build (bodyLen=${contextVars.length})`)

    const functionBody = TEMPLATEJS_DIAG_CONTEXT_VARS
      ? `
      ${contextVars}
      throw new Error('DIAG-VAR-END-user-code-next');
      // Execute user's code
      ${sanitizedCode}
    `
      : `
      ${contextVars}
      // Execute user's code
      // All templating functions are available: moment, date, note, tasks, etc.
      ${sanitizedCode}
    `
    if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
    logDebug(`executeTemplateJSBlock: LBB after functionBody (fnBodyLen=${functionBody.length})`)

    // $FlowIgnore[prop-missing] - Function constructor is safe here as code comes from form definition
    const fn = Function.apply(null, ['params', functionBody])
    if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
    logDebug(`executeTemplateJSBlock: LBB about to call fn(safeContext) for field "${fieldIdentifier}"`)
    let result
    logDebug(`executeTemplateJSBlock: [DIAG] result is ${result === undefined ? 'undefined' : 'defined'} before check`)

    /**
     * Centralized TemplateJS invocation point.
     * We call the compiled function `fn` in one place only so debugging behavior is consistent,
     * while still allowing different test contexts (emptyContext, testContext, safeContext, workingContext).
     * @param {{[string]: any}} params
     * @param {string} label
     * @returns {any}
     */
    const runTemplateJSFn = (params: { [string]: any }, label: string): any => {
      if (DIAG_SKIP_FN_CALL_USE_DUMMY_RESULT) {
        // Always return a fresh object so callers don't accidentally share/mutate state.
        logDebug(`executeTemplateJSBlock: [DIAG] SKIPPING fn(${label}) call, using dummy result: { daysBtween: '2' }`)
        return { daysBtween: '2' }
      }
      return fn(params)
    }

    // CRITICAL: Use safeContext (built incrementally above) - this avoids freeze issues
    // The incremental testContext approach works, so safeContext built the same way should work too

    // DIAG: Test with empty context first, then add keys one at a time
    if (TEMPLATEJS_DIAG_TEST_CONTEXT_KEYS >= 1) {
      logDebug(`executeTemplateJSBlock: [DIAG] Testing with empty context first (original context has ${Object.keys(safeContext).length} keys)`)
      try {
        const emptyContext = {}
        result = runTemplateJSFn(emptyContext, 'emptyContext')
        logDebug(`executeTemplateJSBlock: [DIAG] ✓ Empty context execution succeeded, result type=${typeof result}`)
      } catch (emptyError) {
        const msg = emptyError instanceof Error ? emptyError.message : String(emptyError)
        logError(pluginJson, `executeTemplateJSBlock: [DIAG] ✗ Empty context execution failed: ${msg}`)
        throw new Error(`TemplateJS block "${fieldIdentifier}" failed even with empty context: ${msg}`)
      }

      // If mode 2 or 3, add keys one at a time (forward or reverse order)
      // If mode 4, binary search to find problematic combination
      if (TEMPLATEJS_DIAG_TEST_CONTEXT_KEYS >= 2) {
        // Use safeContext for diagnostic tests (already built above)

        // Mode 4: Binary search - test if weekDates works without keys 0-51
        if (TEMPLATEJS_DIAG_TEST_CONTEXT_KEYS >= 4) {
          logDebug(`executeTemplateJSBlock: [DIAG] Binary search mode: Testing if weekDates (key 52) works without keys 0-51`)
          const testContextSkipEarly: { [string]: any } = {}

          // Add only keys 52+ (weekDates and later)
          for (let i = 51; i < contextKeys.length; i++) {
            const key = contextKeys[i]
            testContextSkipEarly[key] = safeContext[key]
          }

          logDebug(`executeTemplateJSBlock: [DIAG] Testing with keys 52-${contextKeys.length} only (skipping 0-51)`)
          try {
            result = runTemplateJSFn(testContextSkipEarly, 'binarySearch.skipEarly')
            logDebug(`executeTemplateJSBlock: [DIAG] ✓ Keys 52+ work WITHOUT keys 0-51! This confirms the issue is the COMBINATION.`)
            logDebug(`executeTemplateJSBlock: [DIAG] Now testing: does weekDates work with FIRST HALF (keys 0-31)?`)

            // Test with first half + weekDates
            const testContextFirstHalf: { [string]: any } = {}
            for (let i = 0; i < 32 && i < contextKeys.length; i++) {
              testContextFirstHalf[contextKeys[i]] = safeContext[contextKeys[i]]
            }
            // Add weekDates (key 52)
            if (contextKeys.length > 51) {
              testContextFirstHalf[contextKeys[51]] = safeContext[contextKeys[51]]
            }

            result = runTemplateJSFn(testContextFirstHalf, 'binarySearch.firstHalf')
            logDebug(`executeTemplateJSBlock: [DIAG] ✓ Keys 0-31 + weekDates work! Testing second half (keys 32-51) + weekDates...`)

            // Test with second half (32-51) + weekDates
            const testContextSecondHalf: { [string]: any } = {}
            for (let i = 32; i < 52 && i < contextKeys.length; i++) {
              testContextSecondHalf[contextKeys[i]] = safeContext[contextKeys[i]]
            }
            // Add weekDates (key 52)
            if (contextKeys.length > 51) {
              testContextSecondHalf[contextKeys[51]] = safeContext[contextKeys[51]]
            }

            result = runTemplateJSFn(testContextSecondHalf, 'binarySearch.secondHalf')
            logDebug(`executeTemplateJSBlock: [DIAG] ✓ Keys 32-51 + weekDates also work! The issue must be ALL keys 0-51 together.`)
            logDebug(`executeTemplateJSBlock: [DIAG] Narrowing: test keys 0-25 + weekDates, then 26-51 + weekDates`)

            // Narrow down: first quarter + weekDates
            const testContextQ1: { [string]: any } = {}
            for (let i = 0; i < 26 && i < contextKeys.length; i++) {
              testContextQ1[contextKeys[i]] = safeContext[contextKeys[i]]
            }
            if (contextKeys.length > 51) {
              testContextQ1[contextKeys[51]] = safeContext[contextKeys[51]]
            }
            result = runTemplateJSFn(testContextQ1, 'binarySearch.q1')
            logDebug(`executeTemplateJSBlock: [DIAG] ✓ Keys 0-25 + weekDates work`)

            // Second quarter + weekDates
            const testContextQ2: { [string]: any } = {}
            for (let i = 26; i < 52 && i < contextKeys.length; i++) {
              testContextQ2[contextKeys[i]] = safeContext[contextKeys[i]]
            }
            if (contextKeys.length > 51) {
              testContextQ2[contextKeys[51]] = safeContext[contextKeys[51]]
            }
            result = runTemplateJSFn(testContextQ2, 'binarySearch.q2')
            logDebug(`executeTemplateJSBlock: [DIAG] ✓ Keys 26-51 + weekDates work! Both halves work separately.`)
            logDebug(`executeTemplateJSBlock: [DIAG] This suggests a CUMULATIVE issue: too many keys total, not a specific combination.`)
          } catch (skipError) {
            const msg = skipError instanceof Error ? skipError.message : String(skipError)
            logError(pluginJson, `executeTemplateJSBlock: [DIAG] ✗ Keys 52+ failed even without keys 0-51: ${msg}`)
            throw new Error(`TemplateJS block "${fieldIdentifier}" failed with keys 52+ only: ${msg}`)
          }
        }

        const reverseOrder = TEMPLATEJS_DIAG_TEST_CONTEXT_KEYS >= 3 && TEMPLATEJS_DIAG_TEST_CONTEXT_KEYS < 4
        const orderLabel = reverseOrder ? 'reverse' : 'forward'
        logDebug(`executeTemplateJSBlock: [DIAG] Adding context keys one at a time in ${orderLabel} order (${contextKeys.length} total keys)`)
        const testContext: { [string]: any } = {}

        // Create index array: forward [0,1,2,...] or reverse [N-1, N-2, ..., 0]
        const indices = reverseOrder ? Array.from({ length: contextKeys.length }, (_, i) => contextKeys.length - 1 - i) : Array.from({ length: contextKeys.length }, (_, i) => i)

        for (let idx = 0; idx < indices.length; idx++) {
          const i = indices[idx]
          const key = contextKeys[i]
          const value = context[key]
          const displayIndex = idx + 1 // 1-based for display

          // Starting from key 52 (forward) or last 12 keys (reverse), add detailed inspection and LBB logging
          const shouldInspect = reverseOrder ? idx < 12 : i >= 51

          if (shouldInspect) {
            logDebug(`executeTemplateJSBlock: [DIAG] LBB before inspecting key ${displayIndex}/${contextKeys.length} (index ${i}): "${key}"`)
            const valueType = typeof value
            const valueCtor = value && typeof value === 'object' ? value.constructor?.name || 'Unknown' : 'N/A'
            const valueKeys = value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).length : 'N/A'
            const valueIsFunction = typeof value === 'function'
            const valueStr = valueIsFunction ? `function ${value.name || 'anonymous'}` : String(value).substring(0, 100)
            logDebug(
              `executeTemplateJSBlock: [DIAG] Key ${displayIndex} (index ${i}, "${key}") value: type=${valueType}, ctor=${valueCtor}, keys=${valueKeys}, isFunction=${
                valueIsFunction ? 'true' : 'false'
              }, preview="${valueStr}"`,
            )
            logDebug(`executeTemplateJSBlock: [DIAG] LBB after inspecting key ${displayIndex}, about to add to testContext`)
          }

          logDebug(`executeTemplateJSBlock: [DIAG] Adding key ${displayIndex}/${contextKeys.length} (index ${i}): "${key}"`)

          if (shouldInspect) {
            logDebug(`executeTemplateJSBlock: [DIAG] LBB before testContext[key] = value for key ${displayIndex}`)
          }

          try {
            testContext[key] = safeContext[key]

            if (shouldInspect) {
              logDebug(`executeTemplateJSBlock: [DIAG] LBB after testContext[key] = value, about to call fn(testContext) for key ${displayIndex}`)
            }

            result = runTemplateJSFn(testContext, `testContext.keyByKey.${displayIndex}`)

            if (shouldInspect) {
              logDebug(`executeTemplateJSBlock: [DIAG] LBB after fn(testContext) returned for key ${displayIndex}`)
            }

            logDebug(`executeTemplateJSBlock: [DIAG] ✓ Key ${displayIndex} (index ${i}, "${key}") added successfully, result type=${typeof result}`)
          } catch (keyError) {
            const msg = keyError instanceof Error ? keyError.message : String(keyError)
            logError(pluginJson, `executeTemplateJSBlock: [DIAG] ✗ FREEZE at key ${displayIndex}/${contextKeys.length} (index ${i}, "${key}"): ${msg}`)
            throw new Error(`TemplateJS block "${fieldIdentifier}" froze when adding context key "${key}" (key ${displayIndex}/${contextKeys.length}, index ${i}): ${msg}`)
          }
        }

        logDebug(`executeTemplateJSBlock: [DIAG] ✓ All ${contextKeys.length} keys added successfully in ${orderLabel} order`)

        // DIAG: Test if safeContext works (vs incremental testContext)
        if (TEMPLATEJS_DIAG_TEST_CONTEXT_KEYS >= 4) {
          logDebug(`executeTemplateJSBlock: [DIAG] Testing if safeContext works (vs incremental testContext)`)
          logDebug(
            `executeTemplateJSBlock: [DIAG] testContext constructor: ${testContext.constructor?.name || 'unknown'}, safeContext constructor: ${
              safeContext.constructor?.name || 'unknown'
            }`,
          )
          logDebug(`executeTemplateJSBlock: [DIAG] testContext keys: ${Object.keys(testContext).length}, safeContext keys: ${Object.keys(safeContext).length}`)
          logDebug(`executeTemplateJSBlock: [DIAG] Are they equal? ${testContext === safeContext ? 'YES (same object)' : 'NO (different objects)'}`)

          // Compare a few key values to see if they're the same
          const sampleKeys = Object.keys(safeContext).slice(0, 5)
          for (const key of sampleKeys) {
            const testVal = testContext[key]
            const safeVal = safeContext[key]
            const sameRef = testVal === safeVal
            const testType = typeof testVal
            const safeType = typeof safeVal
            logDebug(
              `executeTemplateJSBlock: [DIAG] Key "${key}": testContext=${testType}, safeContext=${safeType}, same reference=${sameRef ? 'true' : 'false'}`,
            )
          }

          try {
            logDebug(`executeTemplateJSBlock: [DIAG] LBB before calling fn(safeContext)`)
            result = runTemplateJSFn(safeContext, 'safeContext')
            logDebug(`executeTemplateJSBlock: [DIAG] LBB after calling fn(safeContext) - SUCCESS!`)
            logDebug(`executeTemplateJSBlock: [DIAG] ✓ safeContext WORKS!`)
            // If safeContext works, we're done - return early
            return result
          } catch (fullContextError) {
            const msg = fullContextError instanceof Error ? fullContextError.message : String(fullContextError)
            logError(pluginJson, `executeTemplateJSBlock: [DIAG] ✗ safeContext FAILED: ${msg}`)
            logDebug(`executeTemplateJSBlock: [DIAG] Since incremental testContext worked, we'll use that instead`)
            // Use the working testContext instead
            result = runTemplateJSFn(testContext, 'testContext.final')
            logDebug(`executeTemplateJSBlock: [DIAG] ✓ Using incremental testContext instead - this works!`)
            // Continue with result from testContext
          }
        }
        // Continue with full context for final execution (unless we already returned above)
      }
    }

    try {
      if (TEMPLATEJS_DIAG_PROFILE_CONTEXT_AND_THROW) {
        const profile = profileTemplateJSContext(context)
        // Put the full profile in logs (safer than throwing huge message).
        logDebug(`executeTemplateJSBlock: [DIAG] Context profile for "${fieldIdentifier}" (throwing before execution)\n${profile}`)
        throw new Error(`DIAG-CTXPROFILE: stopping before executing TemplateJS block "${fieldIdentifier}"`)
      }
      // Only call fn() if we haven't already set result above
      // CRITICAL: The diagnostic tests proved that building incrementally and calling fn() after each key works
      // Use that exact same pattern: build a fresh context incrementally and call fn() after each key
      // This avoids the freeze that happens when calling fn() with all 63 keys at once
      if (result === undefined) {
        logDebug(`executeTemplateJSBlock: [DIAG] Entering incremental build block, contextKeys.length=${contextKeys.length}`)
        logDebug(`executeTemplateJSBlock: [DIAG] LBB before creating workingContext`)
        const workingContext: { [string]: any } = {}
        logDebug(`executeTemplateJSBlock: [DIAG] LBB after creating workingContext, about to start loop`)
        clo(contextKeys, 'contextKeys LBB')
        // Build incrementally but only call fn() every 10 keys to avoid freeze from too many calls
        // The diagnostic tests showed calling after each key works, but maybe 51+ calls causes issues
        for (let i = 0; i < contextKeys.length; i++) {
          const oneBased = i + 1
          if (TEMPLATEJS_DIAG_THROW_WORKING_KEY > 0 && TEMPLATEJS_DIAG_THROW_WORKING_KEY === oneBased && TEMPLATEJS_DIAG_THROW_WORKING_STAGE === 1) {
            throw new Error(`DIAG-WORKINGCTX: stage=1 start-loop key=${oneBased}`)
          }

          const key = contextKeys[i]
          if (TEMPLATEJS_DIAG_THROW_WORKING_KEY > 0 && TEMPLATEJS_DIAG_THROW_WORKING_KEY === oneBased && TEMPLATEJS_DIAG_THROW_WORKING_STAGE === 2) {
            throw new Error(`DIAG-WORKINGCTX: stage=2 after-key-read key=${oneBased} name="${String(key)}"`)
          }
          const isProblematicKey = i >= 50 // Keys 51+ are where we've seen freezes

          if (isProblematicKey) {
            logDebug(`executeTemplateJSBlock: [DIAG] LBB before adding key ${i + 1}/${contextKeys.length}: "${key}"`)
          }

          logDebug(`executeTemplateJSBlock: [DIAG] Adding key ${i + 1}/${contextKeys.length}: "${key}" LBB`)
          workingContext[key] = safeContext[key]
          if (TEMPLATEJS_DIAG_THROW_WORKING_KEY > 0 && TEMPLATEJS_DIAG_THROW_WORKING_KEY === oneBased && TEMPLATEJS_DIAG_THROW_WORKING_STAGE === 3) {
            throw new Error(`DIAG-WORKINGCTX: stage=3 after-assign key=${oneBased} name="${String(key)}"`)
          }
          logDebug(`executeTemplateJSBlock: [DIAG] Key ${i + 1} added`)

          // Only call fn() every 10 keys, or on the last key, to reduce number of calls
          // This should still work since we're building incrementally
          const shouldCallFn = (i + 1) % 10 === 0 || i === contextKeys.length - 1
          if (shouldCallFn) {
            logDebug(`executeTemplateJSBlock: [DIAG] Calling fn(workingContext) after ${i + 1} keys`)
            if (isProblematicKey) {
              logDebug(`executeTemplateJSBlock: [DIAG] LBB before fn(workingContext) call for key ${i + 1}`)
            }
            if (TEMPLATEJS_DIAG_THROW_WORKING_KEY > 0 && TEMPLATEJS_DIAG_THROW_WORKING_KEY === oneBased && TEMPLATEJS_DIAG_THROW_WORKING_STAGE === 4) {
              throw new Error(`DIAG-WORKINGCTX: stage=4 before-fn key=${oneBased} name="${String(key)}"`)
            }
            result = runTemplateJSFn(workingContext, `workingContext.${i + 1}`)
            if (TEMPLATEJS_DIAG_THROW_WORKING_KEY > 0 && TEMPLATEJS_DIAG_THROW_WORKING_KEY === oneBased && TEMPLATEJS_DIAG_THROW_WORKING_STAGE === 5) {
              throw new Error(`DIAG-WORKINGCTX: stage=5 after-fn key=${oneBased} name="${String(key)}"`)
            }
            if (isProblematicKey) {
              logDebug(`executeTemplateJSBlock: [DIAG] LBB after fn(workingContext) returned for key ${i + 1}`)
            }
            logDebug(`executeTemplateJSBlock: [DIAG] fn(workingContext) returned after ${i + 1} keys`)
          }
        }
        logDebug(`executeTemplateJSBlock: [DIAG] Loop completed, all keys added`)
        logDebug(`executeTemplateJSBlock: [DIAG] LBB before logging final result ready`)
        logDebug(`executeTemplateJSBlock: [DIAG] All keys added, final result ready`)
        logDebug(`executeTemplateJSBlock: [DIAG] LBB after logging final result ready, result type=${typeof result}`)
        // Result is already set from the last call above
      }
      logDebug(`executeTemplateJSBlock: [DIAG] LBB before checking result type`)
      const isArrayResult = Array.isArray(result)
      const isObjectResult = result != null && typeof result === 'object'
      logDebug(
        `executeTemplateJSBlock: [DIAG] fn(safeContext) returned, type=${typeof result}, isArray=${isArrayResult ? 'true' : 'false'}, isObject=${
          isObjectResult ? 'true' : 'false'
        }`,
      )
      logDebug(`executeTemplateJSBlock: [DIAG] LBB after logging result type`)
    } catch (fnError) {
      const msg = fnError instanceof Error ? fnError.message : String(fnError)
      const stack = fnError instanceof Error ? fnError.stack : ''
      logError(pluginJson, `executeTemplateJSBlock: runTemplateJSFn threw: ${msg}\nstack: ${stack || '(no stack)'}`)
      throw new Error(`TemplateJS block "${fieldIdentifier}" threw when called with context: ${msg}`)
    }

    // Validate that the code returned an object
    logDebug(`executeTemplateJSBlock: [DIAG] About to check result type for "${fieldIdentifier}"`)
    logDebug(`executeTemplateJSBlock: [DIAG] LBB before result type check`)
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      logDebug(`executeTemplateJSBlock: [DIAG] LBB before Object.keys(result)`)
      const resultKeys = Object.keys(result)
      logDebug(`executeTemplateJSBlock: [DIAG] LBB after Object.keys(result), got ${resultKeys.length} keys`)
      logDebug(`executeTemplateJSBlock: [DIAG] TemplateJS block "${fieldIdentifier}" returned object with ${resultKeys.length} keys: ${resultKeys.join(', ')}`)

      // CRITICAL: Create a plain object copy of result before passing to promiseResolve
      // The result object might contain proxies/getters that cause freeze when accessing result[key]
      logDebug(`executeTemplateJSBlock: [DIAG] Creating plain object copy of result before promiseResolve`)
      const plainResult: { [string]: any } = {}
      logDebug(`executeTemplateJSBlock: [DIAG] LBB before copying result keys, resultKeys.length=${resultKeys.length}`)
      for (let i = 0; i < resultKeys.length; i++) {
        const key = resultKeys[i]
        logDebug(`executeTemplateJSBlock: [DIAG] Copying key ${i + 1}/${resultKeys.length}: "${key}"`)
        logDebug(`executeTemplateJSBlock: [DIAG] LBB before accessing result["${key}"]`)
        const value = result[key]
        logDebug(`executeTemplateJSBlock: [DIAG] LBB after accessing result["${key}"], type=${typeof value}`)
        logDebug(`executeTemplateJSBlock: [DIAG] LBB before plainResult["${key}"] = value`)
        plainResult[key] = value
        logDebug(`executeTemplateJSBlock: [DIAG] LBB after plainResult["${key}"] = value`)
      }
      logDebug(`executeTemplateJSBlock: [DIAG] Plain result copy created with ${Object.keys(plainResult).length} keys LBB`)

      // NotePlan's Promise is not a constructor (can't use new Promise()).
      // Just return plainResult directly - the async function will wrap it automatically.
      // If this freezes, the issue is in the caller when they await this return value.
      logDebug(`executeTemplateJSBlock: [DIAG] Returning plainResult directly (async function will wrap) LBB`)
      return plainResult
    } else if (result !== undefined) {
      const errorMessage = `TemplateJS block "${fieldIdentifier}" should return an object, but returned ${typeof result}. Please update your code to return an object (e.g., return { key: value }).`
      logError(pluginJson, `executeTemplateJSBlock: ${errorMessage}`)
      return promiseResolve({ __blockError: errorMessage })
    } else {
      const errorMessage = `TemplateJS block "${fieldIdentifier}" did not return anything. Please update your code to return an object (e.g., return { key: value }).`
      logError(pluginJson, `executeTemplateJSBlock: ${errorMessage}`)
      return promiseResolve({ __blockError: errorMessage })
    }
  } catch (error) {
    // throw new Error(`DIAG-17: executeTemplateJSBlock catch start ${fieldIdentifier} ${error.message}`)
    const errorMessage = `Error executing TemplateJS block "${fieldIdentifier}": ${error.message}`
    logError(pluginJson, `executeTemplateJSBlock: ${errorMessage}`)
    return promiseResolve({ __blockError: errorMessage })
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
  // Avoid spreading initialContext: it comes from getRenderContext (bridge). Spread/proxy can freeze.
  // Build a plain object by copying only own enumerable keys, excluding block keys.
  let context: { [string]: any } = {}
  try {
    const keys = Object.keys(initialContext)
    for (const k of keys) {
      if (!templatejsBlockKeys.has(k)) context[k] = initialContext[k]
    }
  } catch (e) {
    logError(pluginJson, `executeTemplateJSBlocks: failed to copy initialContext keys: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }

  // DIAG: profile context and stop here so we can inspect it before executing any TemplateJS blocks.
  // This also tells us if `blocks.length` is unexpectedly 0 (i.e. blocks not being extracted).
  if (TEMPLATEJS_DIAG_PROFILE_CONTEXT_AND_THROW) {
    const firstFew = (blocks || [])
      .slice(0, 5)
      .map((b) => b?.field?.key || b?.field?.label || '?')
      .join(', ')
    logDebug(`executeTemplateJSBlocks: [DIAG] About to profile context (blocks=${String(blocks?.length || 0)}, firstFew=${firstFew || '(none)'})`)
    const profile = profileTemplateJSContext(context)
    // Split profile into lines and log each separately to avoid truncation
    const profileLines = profile.split('\n')
    logDebug(`executeTemplateJSBlocks: [DIAG] Context profile START (${profileLines.length} lines)`)
    for (let i = 0; i < profileLines.length; i++) {
      logDebug(`executeTemplateJSBlocks: [DIAG] CTXPROFILE-LINE-${String(i)}: ${profileLines[i]}`)
    }
    logDebug(`executeTemplateJSBlocks: [DIAG] Context profile END`)
    // NOTE: blocks=0 is OK if this is the "after" execution path and all blocks are "before"
    // The real issue is when blocks exist but freeze during execution
    throw new Error(`DIAG-CTXPROFILE: stopping in executeTemplateJSBlocks before executing any blocks (blocks=${String(blocks?.length || 0)})`)
  }

  // DIAG: Log before starting block execution loop
  logDebug(pluginJson, `executeTemplateJSBlocks: [DIAG] Starting execution loop for ${blocks?.length || 0} block(s)`)

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const { field, code } = blocks[blockIndex]
    const fieldIdentifier = field?.key || field?.label || `block-${blockIndex}`
    if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
    logDebug(`executeTemplateJSBlocks: [DIAG] LBB about to executeTemplateJSBlock blockIndex=${blockIndex} field="${fieldIdentifier}"`)
    logDebug(`executeTemplateJSBlocks: [DIAG] LBB before await executeTemplateJSBlock`)
    const result = await executeTemplateJSBlock(field, code, context, blockIndex, reactWindowData)
    logDebug(`executeTemplateJSBlocks: [DIAG] LBB after await executeTemplateJSBlock`)
    logDebug(
      `executeTemplateJSBlocks: [DIAG] executeTemplateJSBlock returned for blockIndex=${blockIndex} field="${fieldIdentifier}", result type=${typeof result}, isNull=${
        result === null ? 'true' : 'false'
      }, hasError=${result && typeof result === 'object' && (result: any).__blockError ? 'yes' : 'no'}`,
    )

    if (result === null) {
      logDebug(`executeTemplateJSBlocks: [DIAG] Block ${blockIndex} returned null, aborting`)
      return null
    }
    if (result && typeof result === 'object' && (result: any).__blockError) {
      logDebug(`executeTemplateJSBlocks: [DIAG] Block ${blockIndex} returned error: ${(result: any).__blockError}`)
      return result
    }

    logDebug(
      `executeTemplateJSBlocks: [DIAG] About to merge result into context for blockIndex=${blockIndex}, result keys=${
        result && typeof result === 'object' ? Object.keys(result).join(', ') : 'N/A'
      }`,
    )
    logDebug(`executeTemplateJSBlocks: [DIAG] LBB before context spread merge`)
    // CRITICAL: Avoid spread operator on result - it might contain proxies that freeze
    // Build a plain object copy instead
    const plainResult: { [string]: any } = {}
    if (result && typeof result === 'object') {
      const resultKeys = Object.keys(result)
      logDebug(`executeTemplateJSBlocks: [DIAG] Copying ${resultKeys.length} result keys into plainResult`)
      for (const key of resultKeys) {
        plainResult[key] = result[key]
      }
      logDebug(`executeTemplateJSBlocks: [DIAG] plainResult copy complete`)
    }
    logDebug(`executeTemplateJSBlocks: [DIAG] LBB before context = { ...context, ...plainResult }`)
    context = { ...context, ...plainResult }
    logDebug(`executeTemplateJSBlocks: [DIAG] LBB after context merge`)
    logDebug(`executeTemplateJSBlocks: [DIAG] Context merged successfully for blockIndex=${blockIndex}, context now has ${Object.keys(context).length} keys`)
  }

  return context
}

/**
 * Handle template runner result - check for AI analysis and formSubmissionError.
 * Returns updated PassedData (no mutation). Errors/aiAnalysisResult are sent back via RESPONSE.
 * @param {any} templateRunnerResult - The result from templateRunner
 * @param {PassedData} reactWindowData - The React window data (base for returned copy)
 * @returns {PassedData} New object with pluginData.aiAnalysisResult or pluginData.formSubmissionError as appropriate
 */
function handleTemplateRunnerResult(templateRunnerResult: any, reactWindowData: PassedData): PassedData {
  logDebug(
    pluginJson,
    `handleTemplateRunnerResult: templateRunner result type=${typeof templateRunnerResult}, length=${templateRunnerResult?.length || 0}, includes AI marker=${String(
      templateRunnerResult?.includes?.('==**Templating Error Found**') || false,
    )}`,
  )

  // Check if result contains AI analysis (error message from template rendering)
  if (templateRunnerResult && typeof templateRunnerResult === 'string' && templateRunnerResult.includes('==**Templating Error Found**')) {
    logDebug(`handleTemplateRunnerResult: AI analysis result detected, returning updated data with aiAnalysisResult`)
    const updated = withPluginDataUpdates(reactWindowData, { aiAnalysisResult: templateRunnerResult })
    logDebug(`handleTemplateRunnerResult: AI analysis in returned data, aiAnalysisResult length=${updated.pluginData?.aiAnalysisResult?.length || 0}`)
    return updated
  }
  if (templateRunnerResult === null || (typeof templateRunnerResult === 'string' && templateRunnerResult.trim() === '')) {
    // Template runner returned null or empty string - this indicates an error occurred
    // NOTE: undefined is NOT an error - when templateRunner successfully creates a note via templateNew,
    // it returns undefined (see NPTemplateRunner.js line 874). This is a valid success case.
    logError(pluginJson, `handleTemplateRunnerResult: Template runner returned null or empty string - this indicates an error occurred during template execution`)
    const formFields = reactWindowData?.pluginData?.formFields || []
    const formFieldKeys = formFields.filter((f) => f.key).map((f) => f.key)

    let errorMessage = 'Template execution failed. The error "null is not an object" typically means the templating plugin encountered a null value when processing the form data.'
    if (formFieldKeys.length > 0) {
      errorMessage += ` All form fields were sent: ${formFieldKeys.join(', ')}.`
    }
    errorMessage += ' This error occurs when the templating plugin tries to process a null value in the data object.'
    errorMessage += ' The form data has been sanitized to remove nulls, but the templating plugin may have created null values during frontmatter processing.'
    errorMessage += ' Please check the NotePlan Plugin Console logs for the detailed error message from the Templating plugin.'
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: errorMessage })
  }
  // Success case: undefined (note created), string (rendered content), or other valid result
  logDebug(
    pluginJson,
    `handleTemplateRunnerResult: Template execution completed successfully. Result type: ${typeof templateRunnerResult}, value: ${
      templateRunnerResult === undefined ? 'undefined (note created)' : String(templateRunnerResult).substring(0, 100)
    }`,
  )
  return withPluginDataUpdates(reactWindowData, { formSubmissionError: undefined })
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
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: errorMessage })
  }

  // Get formFields for validation
  const formFields = reactWindowData?.pluginData?.formFields || []
  logDebug(`processFormProcessor: Starting with ${Object.keys(formValues || {}).length} formValues keys, ${formFields.length} formFields`)

  // Step 1: Prepare form values and get templating context
  // CRITICAL: Pass formFields to ensure all fields exist

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

  const fullContext = await executeTemplateJSBlocks(templateJSBlocks, templatingContext, reactWindowData)
  if (fullContext === null) {
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: 'Failed to prepare template context.' })
  }
  if (fullContext && typeof fullContext === 'object' && (fullContext: any).__blockError) {
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: (fullContext: any).__blockError })
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

  logDebug(
    pluginJson,
    `processFormProcessor: After adding formValues, formSpecificVars has ${Object.keys(formSpecificVars).length} keys: ${Object.keys(formSpecificVars).join(', ')}`,
  )

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
      logDebug(`processFormProcessor: Final validation - All ${formFields.length} form fields are present in formSpecificVars`)
    }
  }

  logDebug(`processFormProcessor: Final formSpecificVars has ${Object.keys(formSpecificVars).length} keys before calling templateRunner`)

  // Step 4: Deep sanitize formSpecificVars to ensure no null/undefined values exist anywhere
  // This prevents errors in the templating plugin when it tries to process the data
  const sanitizedFormSpecificVars = deepSanitizeNulls(formSpecificVars)
  logDebug(`processFormProcessor: After deep sanitization, sanitizedFormSpecificVars has ${Object.keys(sanitizedFormSpecificVars).length} keys`)

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
    logDebug(`processFormProcessor: Verified - no null/undefined values found in sanitizedFormSpecificVars`)
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
  logDebug(`processFormProcessor: sanitizedFormSpecificVars preview: ${JSON.stringify(sanitizedPreview, null, 2)}`)

  // Final safety check: ensure the object itself is not null and has the expected structure
  if (!sanitizedFormSpecificVars || typeof sanitizedFormSpecificVars !== 'object') {
    logError(pluginJson, `processFormProcessor: CRITICAL - sanitizedFormSpecificVars is not a valid object: ${typeof sanitizedFormSpecificVars}`)
  }

  // Step 5: Call templateRunner with only form-specific variables (sanitized)
  const argumentsToSend = [receivingTemplateTitle, shouldOpenInEditor, sanitizedFormSpecificVars]
  clo(argumentsToSend, `processFormProcessor: Calling templateRunner with form-specific variables only (after executing ${templateJSBlocks.length} templatejs blocks)`)

  const templateRunnerResult = await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', argumentsToSend)
  return handleTemplateRunnerResult(templateRunnerResult, reactWindowData)
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
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: errorMessage })
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
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: 'Failed to prepare template context.' })
  }
  if (fullContext && typeof fullContext === 'object' && (fullContext: any).__blockError) {
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: (fullContext: any).__blockError })
  }

  // Step 3: Extract only form-specific variables (form values + templatejs block results)
  // Don't pass templating context (modules, globals) to templateRunner - it will add those itself
  logDebug(`processCreateNew: [DIAG] About to build formSpecificVars from fullContext LBB`)
  logDebug(
    `processCreateNew: [DIAG] fullContext type: ${typeof fullContext}, keys: ${fullContext && typeof fullContext === 'object' ? Object.keys(fullContext).length : 'N/A'} LBB`,
  )
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
  logDebug(`processCreateNew: [DIAG] About to copy templatejs block results from fullContext to formSpecificVars`)
  logDebug(`processCreateNew: [DIAG] fullContext keys: ${Object.keys(fullContext).length}, templatingContextKeys: ${templatingContextKeys.size}`)
  Object.keys(fullContext).forEach((key) => {
    // Only include keys that are NOT in the templating context (i.e., templatejs block results)
    // AND that are not already in formSpecificVars (form values take precedence)
    if (!templatingContextKeys.has(key) && !(key in formSpecificVars)) {
      logDebug(`processCreateNew: [DIAG] Copying key "${key}" from fullContext to formSpecificVars`)
      formSpecificVars[key] = fullContext[key]
      logDebug(`processCreateNew: [DIAG] Key "${key}" copied successfully`)
    }
  })
  logDebug(`processCreateNew: [DIAG] Finished copying templatejs block results, formSpecificVars now has ${Object.keys(formSpecificVars).length} keys`)

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
  return handleTemplateRunnerResult(templateRunnerResult, reactWindowData)
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
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: errorMessage })
  }

  logDebug(`processRunJSOnly: Found ${templateJSBlocks.length} templatejs blocks to execute`)

  const fullContext = await executeTemplateJSBlocks(templateJSBlocks, templatingContext, reactWindowData)
  if (fullContext === null) {
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: 'Failed to prepare template context.' })
  }
  if (fullContext && typeof fullContext === 'object' && (fullContext: any).__blockError) {
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: (fullContext: any).__blockError })
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
 * @param {PassedData} reactWindowData - The React window data
 * @returns {Promise<PassedData | null>} - Updated React window data or null on error
 */
async function processCreateNew(data: any, reactWindowData: PassedData): Promise<PassedData | null> {
  logDebug(`processCreateNew: [DIAG] START LBB`)
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
        logDebug(`processCreateNew: Extracted newNoteTitle from template body frontmatter: "${newNoteTitleToUse}"`)
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
        logDebug(`processCreateNew: Extracted folder from template body frontmatter: "${newNoteFolderToUse}"`)
      }
    }
  }

  // Get formFields for validation
  const formFields = reactWindowData?.pluginData?.formFields || []
  if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
  logDebug(`processCreateNew: [DIAG] about to prepareFormValuesForRendering LBB`)

  // Step 2: Prepare form values and get templating context (needed to render template tags)
  // CRITICAL: Pass formFields to ensure all fields exist
  const formValuesForRendering = prepareFormValuesForRendering(formValues, formFields)
  if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
  logDebug(`processCreateNew: [DIAG] prepareFormValuesForRendering done LBB`)
  if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
  logDebug(`processCreateNew: [DIAG] about to getTemplatingContext LBB`)
  const templatingContext = await getTemplatingContext(formValuesForRendering)
  if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
  logDebug(`processCreateNew: [DIAG] getTemplatingContext done LBB`)

  // Step 3: Render newNoteTitle template tags if present
  let renderedNewNoteTitle = newNoteTitleToUse
  if (newNoteTitleToUse && typeof newNoteTitleToUse === 'string' && (newNoteTitleToUse.includes('<%') || newNoteTitleToUse.includes('${'))) {
    try {
      if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
      logDebug(`processCreateNew: [DIAG] about to np.Templating render (newNoteTitle) LBB`)
      // Use templating plugin to render the title (it contains template tags like <%- Contact_Name %>)
      // Split invoke so we can see if hang is in sync part (arg serialization) vs await (np.Templating)
      const renderPromise = DataStore.invokePluginCommandByName('render', 'np.Templating', [newNoteTitleToUse, templatingContext])
      if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
      logDebug(`processCreateNew: [DIAG] invoke render returned promise, awaiting... LBB`)
      const renderedTitleResult = await renderPromise
      if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
      logDebug(`processCreateNew: [DIAG] np.Templating render (newNoteTitle) done LBB`)
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
    return withPluginDataUpdates(reactWindowData, {
      formSubmissionError: 'No new note title was specified. Please set a new note title in your form settings.',
    })
  }

  // Step 5: Extract and execute templatejs blocks
  logDebug(`processCreateNew: [DIAG] About to extractTemplateJSBlocks, formFields.length=${formFields?.length || 0}`)
  // For DIAG: also extract "before" blocks to see what exists and profile their context
  if (TEMPLATEJS_DIAG_PROFILE_CONTEXT_AND_THROW) {
    const allBlocks = extractTemplateJSBlocks(formFields) // No filter = get all
    const beforeBlocks = extractTemplateJSBlocks(formFields, 'before')
    const afterBlocks = extractTemplateJSBlocks(formFields, 'after')
    logDebug(`processCreateNew: [DIAG] Block extraction: all=${allBlocks.length}, before=${beforeBlocks.length}, after=${afterBlocks.length}`)
    // Profile context for "before" blocks (they execute during template rendering, get same templatingContext)
    if (beforeBlocks.length > 0) {
      logDebug(`processCreateNew: [DIAG] Profiling context for ${beforeBlocks.length} "before" block(s)`)
      const beforeProfile = profileTemplateJSContext(templatingContext)
      const beforeProfileLines = beforeProfile.split('\n')
      logDebug(`processCreateNew: [DIAG] BEFORE-BLOCKS context profile START (${beforeProfileLines.length} lines)`)
      for (let i = 0; i < beforeProfileLines.length; i++) {
        logDebug(`processCreateNew: [DIAG] BEFORE-CTXPROFILE-LINE-${String(i)}: ${beforeProfileLines[i]}`)
      }
      logDebug(`processCreateNew: [DIAG] BEFORE-BLOCKS context profile END`)
      throw new Error(`DIAG-CTXPROFILE: stopping before executing "before" blocks (before=${beforeBlocks.length}, after=${afterBlocks.length})`)
    }
  }

  // DIAG: Log block extraction results (always, not just when profiling)
  const allBlocks = extractTemplateJSBlocks(formFields) // No filter = get all
  const beforeBlocks = extractTemplateJSBlocks(formFields, 'before')
  const afterBlocks = extractTemplateJSBlocks(formFields, 'after')
  logDebug(`processCreateNew: [DIAG] Block extraction: all=${allBlocks.length}, before=${beforeBlocks.length}, after=${afterBlocks.length}`)

  const templateJSBlocks = extractTemplateJSBlocks(formFields, 'after')
  logDebug(`processCreateNew: [DIAG] extractTemplateJSBlocks returned ${templateJSBlocks?.length || 0} block(s)`)
  if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
  logDebug(`processCreateNew: [DIAG] about to executeTemplateJSBlocks LBB`)
  const fullContext = await executeTemplateJSBlocks(templateJSBlocks, templatingContext, reactWindowData)
  if (LBB_DELAY_MS > 0) await delayMs(LBB_DELAY_MS)
  logDebug(`processCreateNew: [DIAG] executeTemplateJSBlocks done LBB`)
  if (fullContext === null) {
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: 'Failed to prepare template context.' })
  }
  if (fullContext && typeof fullContext === 'object' && (fullContext: any).__blockError) {
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: (fullContext: any).__blockError })
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
  let newNoteFrontmatter = reactWindowData?.pluginData?.newNoteFrontmatter || data?.newNoteFrontmatter || ''
  const templateBody = reactWindowData?.pluginData?.templateBody || data?.templateBody || ''

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
        const originalNewNoteTitle = newNoteTitleToUse || reactWindowData?.pluginData?.newNoteTitle || data?.newNoteTitle || ''

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
  logDebug(`processCreateNew: [DIAG] about to np.Templating templateRunner`)
  if (DIAG_THROW_BEFORE_TEMPLATERUNNER) {
    const keys = Object.keys(templateRunnerArgs || {})
    logDebug(`processCreateNew: [DIAG] DIAG_THROW_BEFORE_TEMPLATERUNNER: templateRunnerArgs keys=${keys.length}, first20=${keys.slice(0, 20).join(', ')}`)
    throw new Error(`DIAG-BEFORE-TEMPLATERUNNER: reached processCreateNew before templateRunner (keys=${keys.length})`)
  }
  const templateRunnerResult = await DataStore.invokePluginCommandByName('templateRunner', 'np.Templating', ['', shouldOpenInEditor, templateRunnerArgs])
  logDebug(`processCreateNew: [DIAG] np.Templating templateRunner done`)
  return handleTemplateRunnerResult(templateRunnerResult, reactWindowData)
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
  const method = processingMethod || (receivingTemplateTitle ? 'form-processor' : 'write-existing')
  logDebug(`handleSubmitButtonClick: [DIAG] START, method will be="${String(method)}"`)
  clo(data, `handleSubmitButtonClick: data BEFORE acting on it`)

  // Validate submission type
  if (type !== 'submit') {
    logDebug(`handleSubmitButtonClick: type is not 'submit', returning`)
    return reactWindowData
  }

  if (!formValues) {
    logError(pluginJson, `handleSubmitButtonClick: formValues is undefined`)
    return withPluginDataUpdates(reactWindowData, {
      formSubmissionError: 'Form values are missing. Please try submitting again.',
    })
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

  // Determine processing method (method already set above for DIAG log)

  // Add shouldOpenInEditor to data for processing functions
  data.shouldOpenInEditor = shouldOpenInEditor

  // Route to appropriate processing method
  let result: PassedData | null = null
  if (method === 'form-processor') {
    logDebug(`handleSubmitButtonClick: [DIAG] calling processFormProcessor NOW`)
    result = await processFormProcessor(data, reactWindowData)
  } else if (method === 'create-new') {
    logDebug(`handleSubmitButtonClick: [DIAG] calling processCreateNew NOW`)
    result = await processCreateNew(data, reactWindowData)
  } else if (method === 'write-existing') {
    result = await processWriteExisting(data, reactWindowData)
  } else if (method === 'run-js-only') {
    result = await processRunJSOnly(data, reactWindowData)
  } else {
    const errorMessage = `Unknown processing method: ${method}`
    logError(pluginJson, `handleSubmitButtonClick: ${errorMessage}`)
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: errorMessage })
  }

  // Return result - processX returns updated PassedData or null on unexpected failure
  if (result === null) {
    return withPluginDataUpdates(reactWindowData, { formSubmissionError: 'Form submission failed.' })
  }
  logDebug(
    pluginJson,
    `handleSubmitButtonClick: Returning result, has aiAnalysisResult=${String(!!result?.pluginData?.aiAnalysisResult)}, aiAnalysisResult length=${
      result?.pluginData?.aiAnalysisResult?.length || 0
    }`,
  )
  return result
}
