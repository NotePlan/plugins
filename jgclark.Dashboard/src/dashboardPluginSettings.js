// @flow
//-----------------------------------------------------------------------------
// Load/save jgclark.Dashboard settings.json with sanitization (repair corrupt root
// structure from array-spread bugs, double-encoded JSON, etc.).
// Last updated 2026-05-28 for v2.4.0.b45, @jgclark + @Cursor
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { cleanDashboardSettingsInAPerspective } from './dashboardSettingsClean'
import { parseSettings } from './shared'
import { updateTagMentionCacheDefinitionsFromAllPerspectives } from './tagMentionCache'
import { ALLOWED_ROOT_KEYS } from './types'
import type { TPerspectiveDef } from './types'
import { logError, logInfo, logWarn } from '@helpers/dev'
import { backupSettings, getSettings, saveSettings } from '@helpers/NPConfiguration'
import { showMessage } from '@helpers/userInput'

const pluginID = pluginJson['plugin.id']

export type TDashboardPluginSettingsSanitizeReport = {
  removedRootKeys: Array<string>,
  coercedPerspectiveSettingsFromObject: boolean,
  parsedStringDashboardSettings: boolean,
  parsedStringPerspectiveSettings: boolean,
  cleanedPerspectiveDefCount: number,
}

export type TDashboardPluginSettingsSanitizeOptions = {
  /** When false (default on load), only fix file structure — do not strip perspective dashboardSettings. */
  cleanPerspectiveDefs?: boolean,
}

/** In-memory cache so refresh / per-section generation does not re-read and re-sanitize settings.json. */
let pluginSettingsCache: any | null = null

/** Avoid repeating the same WARN on every load when nothing structural remains to fix. */
let lastLoggedSanitizeReportKey: string = ''

/**
 * Clear cached plugin settings (call after any save or explicit repair).
 */
export function invalidateDashboardPluginSettingsCache(): void {
  pluginSettingsCache = null
  lastLoggedSanitizeReportKey = ''
}

/**
 * Human-readable lines describing what sanitization did (for logs and showMessage).
 * @param {TDashboardPluginSettingsSanitizeReport} report
 * @returns {Array<string>}
 */
export function buildSanitizeReportLines(report: TDashboardPluginSettingsSanitizeReport): Array<string> {
  const parts: Array<string> = []
  if (report.removedRootKeys.length > 0) {
    parts.push(`removed stray root key(s) [${report.removedRootKeys.join(', ')}] (duplicate perspective defs from array spread)`)
  }
  if (report.coercedPerspectiveSettingsFromObject) {
    parts.push('coerced perspectiveSettings from numeric-key object to array')
  }
  if (report.parsedStringDashboardSettings) {
    parts.push('parsed dashboardSettings from JSON string')
  }
  if (report.parsedStringPerspectiveSettings) {
    parts.push('parsed perspectiveSettings from JSON string')
  }
  if (report.cleanedPerspectiveDefCount > 0) {
    parts.push(`ran cleanDashboardSettingsInAPerspective on ${String(report.cleanedPerspectiveDefCount)} perspective definition(s)`)
  }
  return parts
}

/**
 * @param {TDashboardPluginSettingsSanitizeReport} report
 */
function logSanitizeReport(report: TDashboardPluginSettingsSanitizeReport): void {
  const parts = buildSanitizeReportLines(report)
  if (parts.length === 0) return
  const reportKey = JSON.stringify(report)
  if (reportKey === lastLoggedSanitizeReportKey) return
  lastLoggedSanitizeReportKey = reportKey
  logWarn('sanitizeDashboardPluginSettings', parts.join('; '))
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function isNumericArrayIndexKey(key: string): boolean {
  return /^\d+$/.test(key)
}

/**
 * Root-level duplicate from `{ ...perspectiveSettingsArray }` instead of `{ perspectiveSettings: array }`.
 * @param {any} value
 * @returns {boolean}
 */
function looksLikeStrayPerspectiveDefAtRoot(value: any): boolean {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value.name === 'string' &&
    value.dashboardSettings != null &&
    typeof value.dashboardSettings === 'object'
  )
}

/**
 * @param {any} raw
 * @returns {boolean}
 */
function shouldRemoveStrayRootKey(key: string, value: any): boolean {
  if (ALLOWED_ROOT_KEYS.has(key)) return false
  if (isNumericArrayIndexKey(key)) return true
  if (looksLikeStrayPerspectiveDefAtRoot(value)) return true
  return false
}

/**
 * @param {any} perspectiveSettingsRaw
 * @returns {{ perspectives: Array<TPerspectiveDef>, coercedFromObject: boolean }}
 */
function normalizePerspectiveSettingsArray(perspectiveSettingsRaw: any): { perspectives: Array<TPerspectiveDef>, coercedFromObject: boolean } {
  let ps = perspectiveSettingsRaw
  if (typeof ps === 'string') {
    ps = parseSettings(ps) ?? []
  }
  if (Array.isArray(ps)) {
    return { perspectives: ps, coercedFromObject: false }
  }
  if (ps && typeof ps === 'object') {
    const indexKeys = Object.keys(ps)
      .filter(isNumericArrayIndexKey)
      .sort((a, b) => Number(a) - Number(b))
    if (indexKeys.length > 0) {
      return {
        perspectives: indexKeys.map((k) => ps[k]),
        coercedFromObject: true,
      }
    }
  }
  return { perspectives: [], coercedFromObject: false }
}

/**
 * @param {TDashboardPluginSettingsSanitizeReport} report
 * @returns {boolean}
 */
function reportNeedsStructuralWrite(report: TDashboardPluginSettingsSanitizeReport): boolean {
  return (
    report.removedRootKeys.length > 0 ||
    report.coercedPerspectiveSettingsFromObject ||
    report.parsedStringDashboardSettings ||
    report.parsedStringPerspectiveSettings
  )
}

/**
 * Sanitize the full plugin settings object before load/save.
 * @param {any} rawIn
 * @param {TDashboardPluginSettingsSanitizeOptions?} options
 * @returns {{ settings: any, report: TDashboardPluginSettingsSanitizeReport, needsWrite: boolean }}
 */
export function sanitizeDashboardPluginSettings(
  rawIn: any,
  options?: TDashboardPluginSettingsSanitizeOptions,
): { settings: any, report: TDashboardPluginSettingsSanitizeReport, needsWrite: boolean } {
  const cleanPerspectiveDefs = options?.cleanPerspectiveDefs === true
  const report: TDashboardPluginSettingsSanitizeReport = {
    removedRootKeys: [],
    coercedPerspectiveSettingsFromObject: false,
    parsedStringDashboardSettings: false,
    parsedStringPerspectiveSettings: false,
    cleanedPerspectiveDefCount: 0,
  }

  if (rawIn == null || typeof rawIn !== 'object' || Array.isArray(rawIn)) {
    return { settings: rawIn ?? {}, report, needsWrite: false }
  }

  const settings = { ...rawIn }

  Object.keys(settings).forEach((key) => {
    if (shouldRemoveStrayRootKey(key, settings[key])) {
      report.removedRootKeys.push(key)
      delete settings[key]
    }
  })

  if (typeof settings.dashboardSettings === 'string') {
    settings.dashboardSettings = parseSettings(settings.dashboardSettings) ?? {}
    report.parsedStringDashboardSettings = true
  }

  let perspectiveSettingsInput = settings.perspectiveSettings
  if (typeof perspectiveSettingsInput === 'string') {
    perspectiveSettingsInput = parseSettings(perspectiveSettingsInput) ?? []
    report.parsedStringPerspectiveSettings = true
  }

  const { perspectives, coercedFromObject } = normalizePerspectiveSettingsArray(perspectiveSettingsInput)
  if (coercedFromObject) {
    report.coercedPerspectiveSettingsFromObject = true
  }

  settings.perspectiveSettings = perspectives.map((p) => {
    if (!p || typeof p !== 'object') return p
    if (!cleanPerspectiveDefs) {
      return p
    }
    const original = p.dashboardSettings || {}
    const cleaned = cleanDashboardSettingsInAPerspective(original)
    if (JSON.stringify(cleaned) !== JSON.stringify(original)) {
      report.cleanedPerspectiveDefCount += 1
    }
    return { ...p, dashboardSettings: cleaned }
  })

  const needsWrite =
    reportNeedsStructuralWrite(report) || (cleanPerspectiveDefs && report.cleanedPerspectiveDefCount > 0)

  return { settings, report, needsWrite }
}

/**
 * Load settings.json for this plugin, sanitize, and optionally write structural repairs back to disk.
 * Perspective dashboardSettings cleaning runs on save/repair only (not every load/refresh).
 * @param {boolean?} autoRepairOnLoad - when true (default), persist structural fixes immediately
 * @returns {Promise<any>}
 */
export async function loadDashboardPluginSettings(autoRepairOnLoad: boolean = true): Promise<any> {
  if (pluginSettingsCache != null) {
    return pluginSettingsCache
  }

  const raw = await getSettings(pluginID, {})
  const { settings, report, needsWrite } = sanitizeDashboardPluginSettings(raw, { cleanPerspectiveDefs: false })
  if (needsWrite) {
    logSanitizeReport(report)
    if (autoRepairOnLoad) {
      await saveSettings(pluginID, settings, true)
    }
  }
  pluginSettingsCache = settings
  return settings
}

/**
 * Sanitize then save settings.json for this plugin (includes perspective dashboardSettings cleaning).
 * @param {any} settings
 * @param {boolean?} triggerUpdateMechanism
 * @returns {Promise<boolean>}
 */
export async function saveDashboardPluginSettings(settings: any, triggerUpdateMechanism: boolean = true): Promise<boolean> {
  const { settings: sanitized, report, needsWrite } = sanitizeDashboardPluginSettings(settings, { cleanPerspectiveDefs: true })
  if (needsWrite) {
    logSanitizeReport(report)
  }

  // Keep wantedTagMentionsList.json in sync whenever perspective defs are persisted (union of all tagsToShow).
  // Note: Save Perspective uses this path directly; copy/rename/delete use savePerspectiveSettings() which also ends up here.
  const perspectiveDefs = sanitized?.perspectiveSettings
  if (Array.isArray(perspectiveDefs) && perspectiveDefs.length > 0) {
    updateTagMentionCacheDefinitionsFromAllPerspectives(perspectiveDefs)
  }

  const res = await saveSettings(pluginID, sanitized, triggerUpdateMechanism)
  if (res) {
    pluginSettingsCache = sanitized
  } else {
    invalidateDashboardPluginSettingsCache()
  }
  return res
}

/**
 * Hidden command: backup settings.json, run full sanitization, and save if repairs are needed.
 * x-callback: noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=repairDashboardSettings
 * @returns {Promise<void>}
 */
export async function repairDashboardSettings(): Promise<void> {
  try {
    invalidateDashboardPluginSettingsCache()
    logInfo('repairDashboardSettings', 'Starting repair of settings.json')
    const backedUp = await backupSettings(pluginID, 'before_repairDashboardSettings', true)
    if (!backedUp) {
      logWarn('repairDashboardSettings', 'Backup before repair failed; continuing with repair anyway')
    }
    const raw = await getSettings(pluginID, {})
    const { settings, report, needsWrite } = sanitizeDashboardPluginSettings(raw, { cleanPerspectiveDefs: true })

    // Repair may be run only to fix a stale wantedTagMentionsList.json; refresh union from all perspective defs.
    const perspectiveDefs = settings?.perspectiveSettings
    if (Array.isArray(perspectiveDefs) && perspectiveDefs.length > 0) {
      updateTagMentionCacheDefinitionsFromAllPerspectives(perspectiveDefs)
    }
    
    if (!needsWrite) {
      pluginSettingsCache = settings
      await showMessage('Dashboard settings.json: no repairs were needed.', 'OK', 'Dashboard settings')
      return
    }
    logSanitizeReport(report)
    const res = await saveDashboardPluginSettings(settings, true)
    const lines = buildSanitizeReportLines(report)
    const detail = lines.map((line) => `• ${line}`).join('\n')
    if (res) {
      pluginSettingsCache = settings
      const backupNote = backedUp ? '\n\nA dated backup was saved in Plugins/data/jgclark.Dashboard/.' : ''
      await showMessage(`Dashboard settings.json repaired:\n${detail}${backupNote}`, 'OK', 'Dashboard settings repaired')
    } else {
      invalidateDashboardPluginSettingsCache()
      await showMessage(
        `Repairs were identified but could not be saved:\n${detail}\n\nSee Plugin Console for details.`,
        'OK',
        'Dashboard settings repair failed',
        true,
      )
    }
  } catch (error) {
    invalidateDashboardPluginSettingsCache()
    logError('repairDashboardSettings', error.message)
    await showMessage(`Repair failed: ${error.message}`, 'OK', 'Dashboard settings repair failed', true)
  }
}
