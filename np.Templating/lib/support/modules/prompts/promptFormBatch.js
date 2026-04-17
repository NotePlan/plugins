// @flow
/**
 * @fileoverview Command Bar showForm batching for consecutive prompt / promptDate tags.
 * Batches are groups of consecutive prompt / promptDate tags that are displayed together in a single Command Bar form.
 * Keeps PromptRegistry focused on registry orchestration and single-tag processing.
 */

import json5 from 'json5'
import pluginJson from '../../../../plugin.json'
import PromptDateHandler from './PromptDateHandler'
import StandardPromptHandler from './StandardPromptHandler'
import { cleanVarName, findMatchingPromptType, isPromptTag } from './promptTypesRegistry'
import { parseTagContent } from './promptTagParse'
import { clo, logDebug, logWarn } from '@helpers/dev'
import { usersVersionHas } from '@helpers/NPVersions'
import { escapeRegExp } from '@helpers/regexEscape'

/** Default ISO-style format for CommandBar.showForm date fields (Swift-style pattern). */
const SHOW_FORM_DATE_FORMAT_DEFAULT = 'yyyy-MM-dd'

const FORM_BATCH_TITLE = 'Template'
const FORM_BATCH_SUBMIT = 'Continue'

/**
 * Resolve `format` for a batched `promptDate` field: user JSON options may set `dateFormat` or `format`.
 * @param {any} params - `parseParameters` result for `promptDate`
 * @returns {string}
 */
function resolveShowFormDateFormat(params: any): string {
  const opts = params.options
  if (opts != null && typeof opts === 'object' && !Array.isArray(opts)) {
    const fmt = opts.dateFormat ?? opts.format
    if (typeof fmt === 'string' && fmt.trim() !== '') return fmt.trim()
  }
  if (typeof opts === 'string') {
    const t = opts.trim()
    if (t.startsWith('{') && t.endsWith('}')) {
      try {
        const parsed = json5.parse(t)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const fmt = parsed.dateFormat ?? parsed.format
          if (typeof fmt === 'string' && fmt.trim() !== '') return fmt.trim()
        }
      } catch (_e) {
        /* keep default */
      }
    }
  }
  return SHOW_FORM_DATE_FORMAT_DEFAULT
}

/**
 * True when NotePlan supports CommandBar.showForm and the API is present (never throws — safe in Jest / partial globals).
 * @returns {boolean}
 */
export function notePlanSupportsCommandBarForms(): boolean {
  try {
    return usersVersionHas('commandBarForms') && typeof CommandBar.showForm === 'function'
  } catch (_e) {
    return false
  }
}

/**
 * Read a key from session data or session.data (frontmatter merge).
 * @param {any} sessionData - Session object
 * @param {string} key - Key name
 * @returns {mixed}
 */
function sessionDataLookup(sessionData: any, key: string): mixed {
  if (sessionData[key] !== undefined) return sessionData[key]
  if (sessionData.data && typeof sessionData.data === 'object' && sessionData.data[key] !== undefined) return sessionData.data[key]
  return undefined
}

/**
 * Extract `prompt(...)` / `promptDate(...)` call text and optional assignment target from a tag.
 * @param {string} tag - Full EJS tag
 * @returns {?{ promptCall: string, assignmentVarName: ?string }}
 */
function extractPromptInvocationFromTag(tag: string): ?{| promptCall: string, assignmentVarName: ?string |} {
  const { content } = parseTagContent(tag)
  const assignmentMatch = content.match(/^\s*(const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:await\s+)?(.+)$/i)
  if (assignmentMatch) {
    const promptCall = assignmentMatch[3].trim()
    if (!findMatchingPromptType(promptCall)) return null
    return { promptCall, assignmentVarName: assignmentMatch[2].trim() }
  }
  const processContent = content.startsWith('await ') ? content.substring(6).trim() : content
  if (!findMatchingPromptType(processContent)) return null
  return { promptCall: processContent, assignmentVarName: null }
}

/**
 * @param {string} promptTypeName - Registered prompt name
 * @returns {boolean}
 */
function isFormBatchEligibleName(promptTypeName: string): boolean {
  return promptTypeName === 'prompt' || promptTypeName === 'promptDate'
}

/**
 * True if options still depend on a variable that another batched prompt will write (same form = unavailable).
 * @param {any} params - Parsed handler params
 * @param {any} batchBaseSession - Session snapshot before the batch
 * @param {Set<string>} pendingBatchWrites - Var names assigned earlier in the batch
 * @returns {boolean}
 */
function optionsDependOnPendingBatchWrites(params: any, batchBaseSession: any, pendingBatchWrites: Set<string>): boolean {
  const opts = params.options
  if (opts == null || Array.isArray(opts)) return false
  if (typeof opts !== 'string') return false
  const t = opts.trim()
  if (!/^[a-zA-Z_$][\w$]*$/.test(t)) return false
  if (sessionDataLookup(batchBaseSession, t) !== undefined) return false
  return pendingBatchWrites.has(t)
}

/**
 * Variable names this prompt will write when answered.
 * @param {string} promptName - Handler name
 * @param {any} params - Parsed params
 * @param {string} tag - Original tag
 * @param {?string} assignmentVar - Assignment LHS if any
 * @returns {Array<string>}
 */
function collectVarsWrittenForBatchEntry(promptName: string, params: any, tag: string, assignmentVar: ?string): string[] {
  const names: string[] = []
  if (assignmentVar) names.push(assignmentVar)
  if (params.varName) names.push(params.varName)
  if (promptName === 'prompt') {
    const m = tag.match(/(?:^|\s)prompt\(\s*['"]([^'"]+)['"]\s*,/)
    if (m && m[1]) names.push(m[1])
  }
  return [...new Set(names.filter(Boolean))]
}

/**
 * Ensure unique CommandBar form keys across fields.
 * @param {Array<any>} entries - Mutated in place (each item: formKey, field; may include tag)
 * @returns {void}
 */
function dedupeFormKeys(entries: Array<any>): void {
  const seen: { [string]: boolean } = {}
  for (const e of entries) {
    let k = e.formKey
    let n = 0
    while (seen[k]) {
      n += 1
      k = `${e.formKey}_${n}`
    }
    seen[k] = true
    e.formKey = k
    e.field.key = k
  }
}

/**
 * Build one CommandBar.showForm field from a parsed prompt.
 * @param {string} promptName - prompt | promptDate
 * @param {any} params - Handler params
 * @param {string} formKey - Result key
 * @returns {Object} Field descriptor for NotePlan (`type`, `key`, `title`, …; `choices` for dropdowns)
 */
function buildFormFieldForBatchEntry(promptName: string, params: any, formKey: string): Object {
  const messageRaw = typeof params.promptMessage === 'string' ? params.promptMessage : ''
  const title = messageRaw.length > 0 ? messageRaw : promptName === 'promptDate' ? 'Date' : 'Answer'

  if (promptName === 'promptDate') {
    let defaultVal = ''
    let canBeEmpty = false
    if (Array.isArray(params.options)) {
      const d0 = params.options[0]
      defaultVal = typeof d0 === 'string' ? d0 : ''
      const canBeEmptyRaw = params.options[1]
      canBeEmpty = canBeEmptyRaw === undefined || canBeEmptyRaw === null ? false : typeof canBeEmptyRaw === 'string' ? /^true$/i.test(canBeEmptyRaw) : Boolean(canBeEmptyRaw)
    } else if (typeof params.options === 'string') {
      defaultVal = params.options
    }
    const field: Object = {
      type: 'date',
      key: formKey,
      title,
      label: title,
      format: resolveShowFormDateFormat(params),
      required: !canBeEmpty,
    }
    if (defaultVal !== '') {
      field.default = defaultVal
    }
    return field
  }

  const field: Object = {
    type: 'string',
    key: formKey,
    title,
    label: title,
  }
  const opts = params.options
  if (Array.isArray(opts) && opts.length > 0) {
    field.choices = opts.map((x) => String(x))
  } else if (typeof opts === 'string' && opts.length > 0) {
    const def = opts.replace(/\\"/g, '"').replace(/\\'/g, "'")
    field.default = def
  }
  return field
}

/**
 * Collect consecutive form-batchable prompt tags starting at startIndex.
 * @param {Array<string>} tagsArray - All tags in document order
 * @param {number} startIndex - Index of first tag
 * @param {any} sessionData - Live session (read-only for batch parsing)
 * @returns {?{ tags: string[], entries: Array<{ tag: string, formKey: string, field: Object }> }}
 */
export function tryCollectFormBatch(
  tagsArray: Array<string>,
  startIndex: number,
  sessionData: any,
): ?{| tags: Array<string>, entries: Array<{| tag: string, formKey: string, field: Object |}> |} {
  const pendingWrites: Set<string> = new Set()
  const tags: Array<string> = []
  const entries: Array<{| tag: string, formKey: string, field: Object |}> = []
  const batchBaseSession = sessionData
  let j = startIndex

  while (j < tagsArray.length) {
    const tag = tagsArray[j]
    if (!isPromptTag(tag)) break

    const inv = extractPromptInvocationFromTag(tag)
    if (!inv) break

    const match = findMatchingPromptType(inv.promptCall)
    if (!match || !isFormBatchEligibleName(match.name)) break

    const tempTag = `<%- ${inv.promptCall} %>`
    const params = match.promptType.parseParameters(tempTag, batchBaseSession)
    if (inv.assignmentVarName) params.varName = inv.assignmentVarName

    if (match.name === 'prompt') {
      const dec = StandardPromptHandler.getPromptExecutionDecision(tag, batchBaseSession, params)
      if (dec.kind === 'use_existing') break
    } else if (match.name === 'promptDate') {
      if (!PromptDateHandler.shouldShowPromptUI(batchBaseSession, params)) break
    }

    if (optionsDependOnPendingBatchWrites(params, batchBaseSession, pendingWrites)) break

    const written = collectVarsWrittenForBatchEntry(match.name, params, tag, inv.assignmentVarName)
    for (const w of written) pendingWrites.add(w)

    const formKeyBase = inv.assignmentVarName || params.varName || written[0] || `npForm${entries.length}`
    const formKey = cleanVarName(formKeyBase)
    const field = buildFormFieldForBatchEntry(match.name, params, formKey)
    tags.push(tag)
    entries.push({ tag, formKey, field })
    j += 1
  }

  if (tags.length < 2) return null
  return { tags, entries }
}

/**
 * Replace a processed prompt tag in template text (matches processPrompts semantics).
 * @param {string} sessionTemplateData - Template string
 * @param {string} tag - Original tag
 * @param {string} promptResponseText - Replacement content
 * @returns {string}
 */
export function replacePromptResultInTemplate(sessionTemplateData: string, tag: string, promptResponseText: string): string {
  const doChomp = tag.endsWith('-%>')
  const replaceWhat = doChomp ? new RegExp(`${escapeRegExp(tag)}\\s*\\n*`) : tag
  const replaceWithWhat = tag.startsWith('<% ') ? '' : promptResponseText
  return sessionTemplateData.replace(replaceWhat, replaceWithWhat)
}

/**
 * Handles the response from a prompt, storing it in session data and returning appropriate output
 * @param {string} tag - The original tag
 * @param {string} varName - The variable name to store the response
 * @param {string} response - The prompt response
 * @param {any} sessionData - The session data
 * @returns {string} The output for the template
 */
export function handlePromptResponse(tag: string, varName: string, response: string, sessionData: any): string {
  // Store both the original and cleaned variable names
  const cleanedVarName = cleanVarName(varName)
  sessionData[varName] = response
  sessionData[cleanedVarName] = response

  // Check if this is an output tag (<%- ... %>) or execution tag (<% ... %>)
  const isOutputTag = tag.startsWith('<%- ')
  if (isOutputTag) {
    // For output tags, return the variable reference to output the value
    logDebug(pluginJson, `PromptRegistry::processPromptTag Creating variable reference for output: ${cleanedVarName} -- "<%- ${cleanedVarName} %>"`)
    return `<%- ${cleanedVarName} ${tag.endsWith('-%>') ? '-%>' : '%>'}`
  } else {
    // For execution tags, return empty string (no output)
    logDebug(pluginJson, `PromptRegistry::processPromptTag Execution tag completed - returning empty string`)
    return ''
  }
}

/**
 * Apply a resolved prompt value the same way processPromptTag would after user input (session + template fragment).
 * @param {string} tag - Original EJS tag
 * @param {any} sessionData - Session (mutated)
 * @param {string} response - User value
 * @returns {string} Replacement string for the tag
 */
export function applyPromptResponseToTemplate(tag: string, sessionData: any, response: string): string {
  const { content } = parseTagContent(tag)

  const assignmentMatch = content.match(/^\s*(const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:await\s+)?(.+)$/i)
  if (assignmentMatch) {
    const varNameAssign = assignmentMatch[2].trim()
    const promptCall = assignmentMatch[3].trim()
    const pmatch = findMatchingPromptType(promptCall)
    sessionData[varNameAssign] = response
    if (pmatch && pmatch.name === 'prompt') {
      const pm = tag.match(/(?:^|\s)prompt\(\s*['"]([^'"]+)['"]\s*,/)
      if (pm && pm[1] && pm[1] !== varNameAssign) {
        sessionData[pm[1]] = response
      }
    }
    return ''
  }

  const isAwaited = content.startsWith('await ')
  const processContent = isAwaited ? content.substring(6).trim() : content
  const varRefMatch = /^\s*([a-zA-Z0-9_$]+)\s*$/.exec(processContent)
  if (varRefMatch && varRefMatch[1] && sessionData.hasOwnProperty(varRefMatch[1])) {
    return tag
  }

  const promptTypeInfo = findMatchingPromptType(processContent)
  if (!promptTypeInfo) {
    return tag.startsWith('<%- ') ? response : ''
  }

  const params = promptTypeInfo.promptType.parseParameters(tag, sessionData)
  if (params.varName) {
    return handlePromptResponse(tag, params.varName, response, sessionData)
  }

  if (promptTypeInfo.name === 'prompt') {
    const pm = tag.match(/(?:^|\s)prompt\(\s*['"]([^'"]+)['"]\s*,/)
    if (pm && pm[1]) {
      return handlePromptResponse(tag, pm[1], response, sessionData)
    }
  }

  if (tag.startsWith('<%- ')) return response
  return ''
}

/**
 * Show one CommandBar form for multiple independent prompts and merge results.
 * @param {{ tags: Array<string>, entries: Array<{ tag: string, formKey: string, field: Object }> }} batchInfo - Batch metadata
 * @param {any} sessionData - Session (mutated)
 * @param {string} sessionTemplateData - Template (mutated)
 * @returns {Promise<false | null | { sessionTemplateData: string }>} null when showForm is unusable (fall back to sequential prompts)
 */
export async function runCommandBarFormBatch(
  batchInfo: {| tags: Array<string>, entries: Array<{| tag: string, formKey: string, field: Object |}> |},
  sessionData: any,
  sessionTemplateData: string,
): Promise<false | null | {| sessionTemplateData: string |}> {
  const workEntries: Array<{| tag: string, formKey: string, field: Object |}> = batchInfo.entries.map((e) => ({
    tag: e.tag,
    formKey: e.formKey,
    field: { ...e.field },
  }))
  dedupeFormKeys(workEntries)
  const fields = workEntries.map((e) => e.field)
  logDebug(pluginJson, `runCommandBarFormBatch: showing form with ${String(fields.length)} fields`)
  clo(fields, 'Form fields')

  const formResult = await CommandBar.showForm({
    title: FORM_BATCH_TITLE,
    submitText: FORM_BATCH_SUBMIT,
    fields,
  })
  if (!formResult || typeof formResult.submitted !== 'boolean') {
    logWarn(pluginJson, 'runCommandBarFormBatch: invalid showForm result; using sequential prompts')
    return null
  }

  if (!formResult.submitted) {
    logDebug(pluginJson, 'runCommandBarFormBatch: user cancelled')
    return false
  }
  clo(formResult, 'Form result: User submitted values')

  let out = sessionTemplateData
  for (const e of workEntries) {
    const raw = formResult.values[e.formKey]
    const strVal = raw == null ? '' : typeof raw === 'string' ? raw : String(raw)
    const replacement = applyPromptResponseToTemplate(e.tag, sessionData, strVal)
    out = replacePromptResultInTemplate(out, e.tag, replacement)
  }
  return { sessionTemplateData: out }
}
