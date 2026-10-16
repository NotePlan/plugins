// @flow
//-----------------------------------------------------------------------------
// Project Kanban `status` frontmatter helpers for Reviews plugin
// Last updated 2026-10-15 for v2.4.0 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import { getFieldKeyStringFromPreference } from './reviewSettings'
import { checkBoolean, checkString } from '@helpers/checkType'
import { logDebug } from '@helpers/dev'
import { getFrontmatterAttribute, removeFrontMatterField, updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { getHashtagsFromString } from '@helpers/stringTransforms'
import { isClosed } from '@helpers/utils'

export type ProjectStatusState = 'notstarted' | 'started' | 'paused' | 'completed' | 'cancelled'

export const STATUS_FRONTMATTER_KEY = 'status'

/** Settings whose rename should offer a vault-wide metadata update. */
export const METADATA_TERM_SETTINGS_FOR_RENAME: $ReadOnlyArray<string> = [
  'startMentionStr',
  'completedMentionStr',
  'cancelledMentionStr',
  'pausedMentionStr',
  'notstartedMentionStr',
  'dueMentionStr',
  'reviewedMentionStr',
  'reviewIntervalMentionStr',
  'nextReviewMentionStr',
  'progressStr',
  'projectMetadataFrontmatterKey',
]

export type MetadataTermRename = {
  settingKey: string,
  oldTerm: string,
  newTerm: string,
}

/**
 * Strip leading @/# and trim; fall back to defaultTerm when empty.
 * @param {string} raw
 * @param {string} defaultTerm
 * @returns {string}
 */
export function normalizeMentionTerm(raw: string, defaultTerm: string): string {
  const s = String(raw || '')
    .replace(/^[@#]/, '')
    .trim()
  return s !== '' ? s : defaultTerm
}

/**
 * Whether the Kanban status feature is enabled (from DataStore preference set by getReviewSettings).
 * Tolerates missing preference (treat as off) so callers do not throw before getReviewSettings runs.
 * @returns {boolean}
 */
export function isProjectStatusFeatureEnabled(): boolean {
  const pref: mixed = DataStore.preference('useProjectStatus')
  if (typeof pref === 'boolean') return pref
  if (pref == null || pref === '') return false
  try {
    return checkBoolean(pref) === true
  } catch (_e) {
    // Non-boolean leftovers from older sessions -- treat only explicit true-ish strings as on
    return String(pref).toLowerCase() === 'true'
  }
}

/**
 * Configured term for a status state (no leading #).
 * @param {ProjectStatusState} state
 * @returns {string}
 */
export function getStatusTermForState(state: ProjectStatusState): string {
  switch (state) {
    case 'notstarted':
      return normalizeMentionTerm(checkString(DataStore.preference('notstartedMentionStr') || ''), 'notstarted')
    case 'started':
      return getFieldKeyStringFromPreference('startMentionStr', 'started')
    case 'paused':
      return normalizeMentionTerm(checkString(DataStore.preference('pausedMentionStr') || ''), 'paused')
    case 'completed':
      return getFieldKeyStringFromPreference('completedMentionStr', 'completed')
    case 'cancelled':
      return getFieldKeyStringFromPreference('cancelledMentionStr', 'cancelled')
    default:
      return 'notstarted'
  }
}

/**
 * Status hashtag for a lifecycle state (e.g. '#started').
 * @param {ProjectStatusState} state
 * @returns {string}
 */
export function getStatusHashtagForState(state: ProjectStatusState): string {
  return `#${getStatusTermForState(state)}`
}

/**
 * Configured paused hashtag (e.g. '#paused').
 * @returns {string}
 */
export function getPausedHashtag(): string {
  return getStatusHashtagForState('paused')
}

/**
 * True when a frontmatter status value matches the given hashtag (with or without leading #).
 * @param {?string} statusValue
 * @param {string} hashtagWithHash
 * @returns {boolean}
 */
export function statusValueMatchesHashtag(statusValue: ?string, hashtagWithHash: string): boolean {
  if (statusValue == null || statusValue === '') return false
  const want = normalizeMentionTerm(hashtagWithHash, '')
  if (want === '') return false
  const got = normalizeMentionTerm(String(statusValue), '')
  return got.toLowerCase() === want.toLowerCase()
}

/**
 * Count completed tasks and checklists (done / cancelled / checklistDone / checklistCancelled).
 * @param {Array<TParagraph>} paras
 * @returns {number}
 */
export function countClosedTasksAndChecklists(paras: Array<TParagraph>): number {
  return paras.filter(isClosed).length
}

/**
 * Initial status hashtag for create/convert: started if ≥1 closed item, else notstarted.
 * @param {Array<TParagraph>} paras
 * @returns {string}
 */
export function initialStatusHashtagForNoteParas(paras: Array<TParagraph>): string {
  const closed = countClosedTasksAndChecklists(paras)
  return closed >= 1 ? getStatusHashtagForState('started') : getStatusHashtagForState('notstarted')
}

/**
 * Resolve which status hashtag to write from Project flags + optional explicit state.
 * Completed/cancelled/paused win; otherwise use explicitState or existing status when it is notstarted/started.
 * @param {{ isCompleted: boolean, isCancelled: boolean, isPaused: boolean }} flags
 * @param {?ProjectStatusState} explicitState
 * @param {?string} existingStatusValue
 * @returns {string}
 */
export function resolveStatusHashtagToWrite(
  flags: { isCompleted: boolean, isCancelled: boolean, isPaused: boolean },
  explicitState: ?ProjectStatusState,
  existingStatusValue: ?string,
): string {
  if (flags.isCompleted) return getStatusHashtagForState('completed')
  if (flags.isCancelled) return getStatusHashtagForState('cancelled')
  if (flags.isPaused) return getStatusHashtagForState('paused')
  if (explicitState === 'started' || explicitState === 'notstarted') {
    return getStatusHashtagForState(explicitState)
  }
  const startedTag = getStatusHashtagForState('started')
  const notstartedTag = getStatusHashtagForState('notstarted')
  if (statusValueMatchesHashtag(existingStatusValue, startedTag)) return startedTag
  if (statusValueMatchesHashtag(existingStatusValue, notstartedTag)) return notstartedTag
  if (explicitState != null) return getStatusHashtagForState(explicitState)
  return notstartedTag
}

/**
 * True if note hashtags include the paused tag (configured or legacy #paused).
 * @param {Array<string> | Set<string> | mixed} hashtags
 * @returns {boolean}
 */
export function hashtagsIncludePaused(hashtags: mixed): boolean {
  const pausedTag = getPausedHashtag()
  const list: Array<string> = Array.isArray(hashtags)
    ? hashtags.map((t) => String(t))
    : hashtags instanceof Set
      ? Array.from(hashtags).map((t) => String(t))
      : []
  for (const tag of list) {
    if (statusValueMatchesHashtag(tag, pausedTag) || statusValueMatchesHashtag(tag, '#paused')) {
      return true
    }
  }
  return false
}

/**
 * Detect paused from status frontmatter and/or legacy tags on the combined/project hashtag list.
 * @param {CoreNoteFields} note
 * @param {Array<string> | Set<string> | mixed} hashtags
 * @returns {boolean}
 */
export function detectIsPausedFromNote(note: CoreNoteFields, hashtags: mixed): boolean {
  const statusVal = getFrontmatterAttribute(note, STATUS_FRONTMATTER_KEY)
  if (statusValueMatchesHashtag(statusVal, getPausedHashtag()) || statusValueMatchesHashtag(statusVal, '#paused')) {
    return true
  }
  return hashtagsIncludePaused(hashtags)
}

/**
 * Write status frontmatter on a note/editor when the feature is enabled.
 * @param {TNote | TEditor} noteLike
 * @param {ProjectStatusState | string} stateOrHashtag - state name or full hashtag
 * @returns {boolean}
 */
export function writeProjectStatusFrontmatter(noteLike: TNote | TEditor, stateOrHashtag: ProjectStatusState | string): boolean {
  if (!isProjectStatusFeatureEnabled()) return false
  const hashtag =
    stateOrHashtag === 'notstarted' ||
    stateOrHashtag === 'started' ||
    stateOrHashtag === 'paused' ||
    stateOrHashtag === 'completed' ||
    stateOrHashtag === 'cancelled'
      ? getStatusHashtagForState(stateOrHashtag)
      : String(stateOrHashtag).startsWith('#')
        ? String(stateOrHashtag)
        : `#${normalizeMentionTerm(String(stateOrHashtag), 'notstarted')}`
  return updateFrontMatterVars(noteLike, { [STATUS_FRONTMATTER_KEY]: hashtag })
}

/**
 * Promote status from notstarted to started when there is ≥1 closed task/checklist.
 * @param {TNote | TEditor} noteLike
 * @param {Array<TParagraph>} paras
 * @returns {boolean} true if status was written
 */
export function promoteNotstartedToStartedIfHasClosedItems(noteLike: TNote | TEditor, paras: Array<TParagraph>): boolean {
  if (!isProjectStatusFeatureEnabled()) return false
  const statusVal = getFrontmatterAttribute(noteLike, STATUS_FRONTMATTER_KEY)
  if (!statusValueMatchesHashtag(statusVal, getStatusHashtagForState('notstarted'))) {
    return false
  }
  if (countClosedTasksAndChecklists(paras) < 1) {
    return false
  }
  const ok = writeProjectStatusFrontmatter(noteLike, 'started')
  if (ok) {
    logDebug('promoteNotstartedToStartedIfHasClosedItems', `Promoted status to ${getStatusHashtagForState('started')}`)
  }
  return ok
}

/**
 * Build rename list from previous vs current raw settings for metadata-term keys.
 * @param {?{ [string]: any }} previous
 * @param {?{ [string]: any }} current
 * @returns {Array<MetadataTermRename>}
 */
export function getMetadataTermRenames(previous: ?{ [string]: any }, current: ?{ [string]: any }): Array<MetadataTermRename> {
  if (previous == null || current == null) return []
  const renames: Array<MetadataTermRename> = []
  for (const settingKey of METADATA_TERM_SETTINGS_FOR_RENAME) {
    const oldRaw = previous[settingKey]
    const newRaw = current[settingKey]
    if (oldRaw == null || newRaw == null) continue
    if (String(oldRaw) === String(newRaw)) continue
    const defaults: { [string]: string } = {
      startMentionStr: 'started',
      completedMentionStr: 'completed',
      cancelledMentionStr: 'cancelled',
      pausedMentionStr: 'paused',
      notstartedMentionStr: 'notstarted',
      dueMentionStr: 'due',
      reviewedMentionStr: 'reviewed',
      reviewIntervalMentionStr: 'review',
      nextReviewMentionStr: 'nextReview',
      progressStr: 'progress',
      projectMetadataFrontmatterKey: 'project',
    }
    const def = defaults[settingKey] || 'term'
    const oldTerm = normalizeMentionTerm(String(oldRaw), def)
    const newTerm = normalizeMentionTerm(String(newRaw), def)
    if (oldTerm === newTerm) continue
    renames.push({ settingKey, oldTerm, newTerm })
  }
  return renames
}

/**
 * Replace @oldTerm( with @newTerm( in a string (body mentions).
 * @param {string} text
 * @param {string} oldTerm
 * @param {string} newTerm
 * @returns {string}
 */
export function replaceBodyMentionTerm(text: string, oldTerm: string, newTerm: string): string {
  if (oldTerm === '' || newTerm === '' || oldTerm === newTerm) return text
  const re = new RegExp(`@${escapeRegExp(oldTerm)}\\(`, 'gi')
  return text.replace(re, `@${newTerm}(`)
}

/**
 * Replace #oldTerm hashtag tokens in a combined tags string.
 * @param {string} text
 * @param {string} oldTerm
 * @param {string} newTerm
 * @param {boolean} stripOnly - when true, remove #oldTerm instead of renaming
 * @returns {string}
 */
export function replaceOrStripHashtagInCombinedValue(text: string, oldTerm: string, newTerm: string, stripOnly: boolean = false): string {
  const tags = getHashtagsFromString(text)
  const oldHash = `#${oldTerm}`
  const newHash = `#${newTerm}`
  const out: Array<string> = []
  const seen: Set<string> = new Set()
  for (const tag of tags) {
    const norm = String(tag)
    if (statusValueMatchesHashtag(norm, oldHash) || (oldTerm.toLowerCase() === 'paused' && statusValueMatchesHashtag(norm, '#paused'))) {
      if (stripOnly) continue
      if (!seen.has(newHash)) {
        seen.add(newHash)
        out.push(newHash)
      }
      continue
    }
    if (!seen.has(norm)) {
      seen.add(norm)
      out.push(norm)
    }
  }
  return out.join(' ')
}

/**
 * Apply one term rename on a single note's frontmatter + body mentions.
 * @param {TNote} note
 * @param {MetadataTermRename} rename
 * @param {boolean} useProjectStatus
 * @param {string} combinedKeyName - current combined project tags key name
 * @returns {boolean} true if anything changed
 */
export function applyMetadataTermRenameToNote(
  note: TNote,
  rename: MetadataTermRename,
  useProjectStatus: boolean,
  combinedKeyName: string,
): boolean {
  let changed = false
  const { settingKey, oldTerm, newTerm } = rename

  // Rename separate frontmatter key (or combined key name itself)
  const oldKey = settingKey === 'projectMetadataFrontmatterKey' ? oldTerm : oldTerm
  const newKey = settingKey === 'projectMetadataFrontmatterKey' ? newTerm : newTerm
  const oldVal = getFrontmatterAttribute(note, oldKey)
  if (oldVal != null && oldVal !== '' && oldKey !== newKey) {
    const ok = updateFrontMatterVars(note, { [newKey]: oldVal })
    if (ok) {
      removeFrontMatterField(note, oldKey)
      changed = true
    }
  }

  // Status hashtag value
  const statusVal = getFrontmatterAttribute(note, STATUS_FRONTMATTER_KEY)
  if (statusVal != null && statusValueMatchesHashtag(statusVal, `#${oldTerm}`)) {
    updateFrontMatterVars(note, { [STATUS_FRONTMATTER_KEY]: `#${newTerm}` })
    changed = true
  }

  // Combined project tags: rename or strip paused when status feature owns pause
  const effectiveCombinedKey =
    settingKey === 'projectMetadataFrontmatterKey' ? newKey : combinedKeyName
  const combinedVal = getFrontmatterAttribute(note, effectiveCombinedKey)
  if (combinedVal != null && typeof combinedVal === 'string' && combinedVal !== '') {
    const stripPausedFromCombined =
      useProjectStatus && (settingKey === 'pausedMentionStr' || oldTerm.toLowerCase() === 'paused')
    const nextCombined = replaceOrStripHashtagInCombinedValue(
      combinedVal,
      oldTerm,
      newTerm,
      stripPausedFromCombined,
    )
    if (nextCombined !== combinedVal) {
      updateFrontMatterVars(note, { [effectiveCombinedKey]: nextCombined })
      changed = true
    }
  }

  // Body @mentions
  const paras = note.paragraphs
  for (let i = 0; i < paras.length; i++) {
    const para = paras[i]
    const content = para.content ?? ''
    const next = replaceBodyMentionTerm(content, oldTerm, newTerm)
    if (next !== content) {
      para.content = next
      note.updateParagraph(para)
      changed = true
    }
  }

  if (changed) {
    DataStore.updateCache(note, true)
  }
  return changed
}

/**
 * Escape a string for use in a RegExp.
 * @param {string} s
 * @returns {string}
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
