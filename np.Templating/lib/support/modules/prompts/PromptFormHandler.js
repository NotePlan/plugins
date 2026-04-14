// @flow
/**
 * @fileoverview Explicit multi-field Command Bar form via `promptForm({ ... })` (NotePlan 3.21+).
 * One tag describes title, submit label, and fields; results are written to session keys matching each field `key`.
 */

import json5 from 'json5'
import pluginJson from '../../../../plugin.json'
import { notePlanSupportsCommandBarForms } from './promptFormBatch'
import { cleanVarName, registerPromptType } from './promptTypesRegistry'
import { chooseOptionWithModifiers, datePicker } from '@helpers/userInput'
import { logDebug, logError, logWarn } from '@helpers/dev'

const DEFAULT_FORM_TITLE = 'Template'
const DEFAULT_SUBMIT_TEXT = 'Continue'

/**
 * Strip a leading `await` so assignment and output tags parse the same call shape.
 * @param {string} source
 * @returns {string}
 */
function stripLeadingAwait(source: string): string {
  const t = source.trim()
  return /^await\s+/i.test(t) ? t.replace(/^await\s+/i, '').trim() : t
}

/**
 * Extract a single `{ ... }` object literal from `promptForm( ... )` using brace depth (string-aware).
 * @param {string} source - Tag body, e.g. `promptForm({ title: 'x', fields: [] })`
 * @returns {?string} Object source including braces, or null
 */
export function extractPromptFormObjectSource(source: string): ?string {
  const trimmed = stripLeadingAwait(source)
  const open = trimmed.match(/^\s*promptForm\s*\(\s*/i)
  if (!open) return null
  let i = open[0].length
  while (i < trimmed.length && /\s/.test(trimmed[i])) i++
  if (trimmed[i] !== '{') return null
  const start = i
  let depth = 0
  let inString = false
  let quote = ''
  let escape = false
  for (; i < trimmed.length; i++) {
    const c = trimmed[i]
    if (escape) {
      escape = false
      continue
    }
    if (inString) {
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === quote) inString = false
      continue
    }
    if (c === '"' || c === "'") {
      inString = true
      quote = c
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return trimmed.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Validate and normalize config from parsed JSON.
 * @param {any} raw - Parsed object
 * @returns {{ ok: true, config: Object } | { ok: false, error: string }}
 */
function validateFormConfig(raw: any): {| ok: true, config: Object |} | {| ok: false, error: string |} {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'promptForm argument must be a single object' }
  }
  const fieldsRaw = raw.fields
  if (!Array.isArray(fieldsRaw) || fieldsRaw.length === 0) {
    return { ok: false, error: 'promptForm.fields must be a non-empty array' }
  }
  const fields = []
  for (let idx = 0; idx < fieldsRaw.length; idx++) {
    const f = fieldsRaw[idx]
    if (f == null || typeof f !== 'object' || Array.isArray(f)) {
      return { ok: false, error: `promptForm.fields[${String(idx)}] must be an object` }
    }
    const type = typeof f.type === 'string' ? f.type.trim() : ''
    const key = typeof f.key === 'string' ? f.key.trim() : ''
    if (!key) {
      return { ok: false, error: `promptForm.fields[${String(idx)}] needs a non-empty key` }
    }
    if (!type) {
      return { ok: false, error: `promptForm.fields[${String(idx)}] needs a type` }
    }
    const allowed = ['string', 'number', 'bool', 'date', 'hidden']
    if (!allowed.includes(type)) {
      return { ok: false, error: `promptForm.fields[${String(idx)}]: unsupported type "${type}"` }
    }
    const titleBase = typeof f.title === 'string' && f.title.trim() !== '' ? f.title.trim() : typeof f.label === 'string' ? f.label.trim() : key
    const title = titleBase || key
    if (type === 'hidden' && f.default === undefined) {
      return { ok: false, error: `promptForm.fields[${String(idx)}] (hidden) should include default` }
    }
    fields.push({ ...f, type, key, title })
  }
  const title = typeof raw.title === 'string' && raw.title.trim() !== '' ? raw.title.trim() : DEFAULT_FORM_TITLE
  const submitText = typeof raw.submitText === 'string' && raw.submitText.trim() !== '' ? raw.submitText.trim() : DEFAULT_SUBMIT_TEXT
  return { ok: true, config: { title, submitText, fields } }
}

/**
 * Map a validated field to CommandBar.showForm field shape.
 * @param {any} field
 * @returns {Object}
 */
function fieldToShowFormField(field: any): Object {
  const title = typeof field.title === 'string' ? field.title : String(field.key)
  const out: Object = {
    type: field.type,
    key: String(field.key),
    title,
    label: title,
  }
  if (field.placeholder != null && String(field.placeholder) !== '') out.placeholder = String(field.placeholder)
  if (field.default !== undefined) out.default = field.default
  if (field.required === true) out.required = true
  if (field.description != null && String(field.description) !== '') out.description = String(field.description)
  if (field.type === 'date' && field.format != null && String(field.format) !== '') out.format = String(field.format)
  if (Array.isArray(field.choices) && field.choices.length > 0) {
    out.choices = field.choices.map((x) => String(x))
  }
  if (typeof field.boxHeight === 'number' && field.boxHeight > 0) out.boxHeight = field.boxHeight
  return out
}

/**
 * Write form values into session (original and cleaned keys, same idea as handlePromptResponse).
 * @param {any} sessionData
 * @param {Object} values
 * @returns {void}
 */
export function applyPromptFormValuesToSession(sessionData: any, values: { [string]: mixed }): void {
  for (const rawKey of Object.keys(values)) {
    const cleaned = cleanVarName(rawKey)
    const raw = values[rawKey]
    let strVal = ''
    if (raw == null) strVal = ''
    else if (typeof raw === 'boolean') strVal = raw ? 'true' : 'false'
    else if (typeof raw === 'number' && !Number.isNaN(raw)) strVal = String(raw)
    else strVal = String(raw)
    sessionData[rawKey] = strVal
    sessionData[cleaned] = strVal
  }
}

/**
 * Ask each field in order when showForm is unavailable.
 * @param {Object} config - { title, submitText, fields }
 * @param {any} sessionData
 * @returns {Promise<string | false>} '' on success, false if cancelled
 */
async function runPromptFormSequential(config: Object, sessionData: any): Promise<string | false> {
  const fields = config.fields
  const values: { [string]: mixed } = {}
  for (const field of fields) {
    const key = String(field.key)
    const label = typeof field.title === 'string' ? field.title : key
    if (field.type === 'hidden') {
      values[key] = field.default != null ? field.default : ''
      continue
    }
    if (field.type === 'date') {
      const canBeEmpty = field.required !== true
      const defaultValue = field.default != null && String(field.default) !== '' ? String(field.default) : canBeEmpty ? '' : 'YYYY-MM-DD'
      const r = await datePicker({
        question: label,
        defaultValue,
        canBeEmpty,
      })
      if (r === false) return false
      values[key] = r
      continue
    }
    if (field.type === 'bool') {
      const opts = [
        { label: 'Yes', value: 'true' },
        { label: 'No', value: 'false' },
      ]
      const pick = await chooseOptionWithModifiers(label || 'Choose', opts, false)
      if (!pick || pick.value == null) return false
      values[key] = pick.value === 'true' || pick.value === true
      continue
    }
    if (Array.isArray(field.choices) && field.choices.length > 0) {
      const opts = field.choices.map((c) => ({ label: String(c), value: String(c) }))
      const pick = await chooseOptionWithModifiers(label, opts, false)
      if (!pick || pick.value == null) return false
      values[key] = pick.value
      continue
    }
    const defStr = field.default != null && field.default !== '' ? String(field.default) : ''
    const r = await CommandBar.textPrompt(config.title || DEFAULT_FORM_TITLE, label, defStr)
    if (r === false) return false
    if (field.type === 'number') {
      const n = Number(r)
      values[key] = Number.isNaN(n) ? r : n
    } else {
      values[key] = r
    }
  }
  applyPromptFormValuesToSession(sessionData, values)
  return ''
}

export default class PromptFormHandler {
  /**
   * Parse `promptForm({ ... })` from tag content.
   * @param {string} tag - Inner tag content (no EJS wrappers)
   * @param {any} _sessionData - Unused; signature matches other handlers
   * @returns {Object} `{ config }` or `{ _error: string }`
   */
  static parseParameters(tag: string, _sessionData?: any): Object {
    void _sessionData
    const inner = extractPromptFormObjectSource(tag)
    if (!inner) {
      return { _error: 'Could not parse promptForm({ ... }) object literal' }
    }
    let raw: mixed
    try {
      raw = json5.parse(inner)
    } catch (e) {
      const msg = e && typeof e.message === 'string' ? e.message : String(e)
      return { _error: `Invalid JSON in promptForm: ${msg}` }
    }
    const validated = validateFormConfig(raw)
    if (!validated.ok) {
      return { _error: validated.error }
    }
    return { config: validated.config }
  }

  /**
   * Show one CommandBar form (or sequential fallback) and populate session.
   * @param {string} tag - Full tag (unused; values come from params)
   * @param {any} sessionData
   * @param {any} params - From parseParameters
   * @returns {Promise<string|false>} Empty string on success, false if cancelled
   */
  static async process(tag: string, sessionData: any, params: any): Promise<string | false> {
    void tag
    if (params._error) {
      logError(pluginJson, `promptForm: ${params._error}`)
      return `<!-- Error: promptForm: ${params._error} -->`
    }
    const config = params.config
    const showFields = config.fields.map((f) => fieldToShowFormField(f))

    if (notePlanSupportsCommandBarForms()) {
      logDebug(pluginJson, `promptForm: showing CommandBar.showForm with ${String(showFields.length)} fields`)
      const formResult = await CommandBar.showForm({
        title: config.title,
        submitText: config.submitText,
        fields: showFields,
      })
      if (!formResult || typeof formResult.submitted !== 'boolean') {
        logWarn(pluginJson, 'promptForm: invalid showForm result; falling back to sequential prompts')
        return await runPromptFormSequential(config, sessionData)
      }
      if (!formResult.submitted) {
        logDebug(pluginJson, 'promptForm: user cancelled')
        return false
      }
      applyPromptFormValuesToSession(sessionData, formResult.values || {})
      return ''
    }

    logDebug(pluginJson, 'promptForm: showForm not available; using sequential prompts')
    return await runPromptFormSequential(config, sessionData)
  }
}

registerPromptType({
  name: 'promptForm',
  parseParameters: (tag: string, sessionData?: any) => PromptFormHandler.parseParameters(tag, sessionData),
  process: PromptFormHandler.process.bind(PromptFormHandler),
})
