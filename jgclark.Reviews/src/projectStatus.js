// @flow
//-----------------------------------------------------------------------------
// Project Kanban `status` frontmatter helpers for Reviews plugin
// Last updated 2026-10-17 for v2.4.0 by @jgclark + @CursorAI
//-----------------------------------------------------------------------------

import { getFieldKeyStringFromPreference } from './reviewSettings'
import { checkBoolean, checkString } from '@helpers/checkType'
import { logDebug, logInfo, logWarn } from '@helpers/dev'
import {
  getFrontmatterAttribute,
  getFrontmatterParagraphs,
  removeFrontMatterField,
  updateFrontMatterVars,
} from '@helpers/NPFrontMatter'
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
 * All five configured status hashtags in display order.
 * @returns {Array<string>}
 */
export function getAllStatusHashtags(): Array<string> {
  return [
    getStatusHashtagForState('notstarted'),
    getStatusHashtagForState('started'),
    getStatusHashtagForState('paused'),
    getStatusHashtagForState('completed'),
    getStatusHashtagForState('cancelled'),
  ]
}

/**
 * Default hidden status hashtags for Filter + Order (finished hidden, paused shown).
 * @returns {Array<string>}
 */
export function getDefaultHiddenStatusTags(): Array<string> {
  return [getStatusHashtagForState('completed'), getStatusHashtagForState('cancelled')]
}

/**
 * Configured paused hashtag (e.g. '#paused').
 * @returns {string}
 */
export function getPausedHashtag(): string {
  return getStatusHashtagForState('paused')
}

/**
 * Resolve the display status hashtag for a project from frontmatter + lifecycle flags.
 * When status feature is off, returns ''.
 * When on: use frontmatter if it matches a known status hashtag; otherwise infer from flags.
 * @param {?string} existingStatusValue - raw `status:` frontmatter value
 * @param {{ isCompleted: boolean, isCancelled: boolean, isPaused: boolean }} flags
 * @returns {string} e.g. '#started', or '' when feature off
 */
export function resolveDisplayStatusHashtag(
  existingStatusValue: ?string,
  flags: { isCompleted: boolean, isCancelled: boolean, isPaused: boolean },
): string {
  if (!isProjectStatusFeatureEnabled()) return ''
  const known = getAllStatusHashtags()
  if (existingStatusValue != null && existingStatusValue !== '') {
    for (const tag of known) {
      if (statusValueMatchesHashtag(existingStatusValue, tag)) {
        return tag
      }
    }
  }
  return resolveStatusHashtagToWrite(flags, null, existingStatusValue)
}

/**
 * Status hashtag for list filtering when cache row may lack statusHashtag.
 * Prefers stored statusHashtag; otherwise infers from completed/cancelled/paused flags.
 * `any` accepts Project class instances and plain allProjectsList JSON rows.
 * @param {any} project
 * @returns {string}
 */
export function getProjectStatusHashtagForFilter(project: any): string {
  const stored = project != null ? project.statusHashtag : null
  if (stored != null && stored !== '') return String(stored)
  return resolveStatusHashtagToWrite(
    {
      isCompleted: project != null && project.isCompleted === true,
      isCancelled: project != null && project.isCancelled === true,
      isPaused: project != null && project.isPaused === true,
    },
    null,
    null,
  )
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
 * Status hashtag to create on finish-review when the note has no status field yet.
 * Prefers paused when the combined project field still has a paused hashtag; else started if ≥1
 * closed item; else notstarted.
 * @param {Array<TParagraph>} paras
 * @param {?string} combinedProjectValue - frontmatter project (or custom key) value
 * @returns {string}
 */
export function resolveStatusHashtagForFinishReviewWhenMissing(
  paras: Array<TParagraph>,
  combinedProjectValue: ?string,
): string {
  const tags = getHashtagsFromString(String(combinedProjectValue ?? ''))
  if (hashtagsIncludePaused(tags)) {
    return getStatusHashtagForState('paused')
  }
  return initialStatusHashtagForNoteParas(paras)
}

/**
 * Remove configured and legacy #paused tags from a combined project-field value.
 * @param {string} combinedVal
 * @returns {string}
 */
function stripPausedTagsFromCombinedValue(combinedVal: string): string {
  let next = combinedVal
  const configuredTerm = normalizeMentionTerm(getPausedHashtag(), 'paused')
  next = replaceOrStripHashtagInCombinedValue(next, configuredTerm, configuredTerm, true)
  if (configuredTerm.toLowerCase() !== 'paused') {
    next = replaceOrStripHashtagInCombinedValue(next, 'paused', 'paused', true)
  }
  return next
}

/**
 * On finish review: if status is missing, add it (paused / started / notstarted). If status is
 * already #notstarted and there is ≥1 closed item, promote to #started. When creating paused
 * status from a legacy #paused on the project field, that hashtag is removed from project:.
 * @param {TNote | TEditor} noteLike
 * @param {Array<TParagraph>} paras
 * @returns {boolean} true if status (or project field) was written
 */
export function ensureOrPromoteStatusOnFinishReview(noteLike: TNote | TEditor, paras: Array<TParagraph>): boolean {
  if (!isProjectStatusFeatureEnabled()) return false

  const statusVal = getFrontmatterAttribute(noteLike, STATUS_FRONTMATTER_KEY)
  const hasStatus = statusVal != null && String(statusVal).trim() !== ''
  if (hasStatus) {
    return promoteNotstartedToStartedIfHasClosedItems(noteLike, paras)
  }

  const combinedKey = checkString(DataStore.preference('projectMetadataFrontmatterKey') || 'project')
  const combinedVal = getFrontmatterAttribute(noteLike, combinedKey) ?? ''
  const statusHashtag = resolveStatusHashtagForFinishReviewWhenMissing(paras, combinedVal)
  const okStatus = writeProjectStatusFrontmatter(noteLike, statusHashtag)
  if (!okStatus) {
    logWarn('ensureOrPromoteStatusOnFinishReview', `Failed to write status: ${statusHashtag}`)
    return false
  }

  let strippedPaused = false
  if (statusValueMatchesHashtag(statusHashtag, getStatusHashtagForState('paused'))) {
    const nextCombined = stripPausedTagsFromCombinedValue(String(combinedVal))
    if (nextCombined !== combinedVal) {
      const okCombined = updateFrontMatterVars(noteLike, { [combinedKey]: nextCombined })
      if (okCombined) {
        strippedPaused = true
      } else {
        logWarn(
          'ensureOrPromoteStatusOnFinishReview',
          `Wrote status: ${statusHashtag} but failed to strip paused hashtag from '${combinedKey}'`,
        )
      }
    }
  }

  logInfo(
    'ensureOrPromoteStatusOnFinishReview',
    `Added missing status: ${statusHashtag}${strippedPaused ? ` (migrated paused hashtag off '${combinedKey}')` : ''}`,
  )
  return true
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
 * True when a hashtag token from the combined field matches the rename/strip target.
 * @param {string} tag - e.g. '#paused'
 * @param {string} oldTerm
 * @returns {boolean}
 */
function combinedHashtagMatchesTerm(tag: string, oldTerm: string): boolean {
  const oldHash = `#${oldTerm}`
  return (
    statusValueMatchesHashtag(tag, oldHash) ||
    (oldTerm.toLowerCase() === 'paused' && statusValueMatchesHashtag(tag, '#paused'))
  )
}

/**
 * Replace or strip #oldTerm hashtag tokens in a combined tags string, preserving @mentions and other text.
 * If the target hashtag is not present, returns the original string unchanged (avoids false "changed" when
 * the value also contains @reviewed / @due etc.).
 * @param {string} text
 * @param {string} oldTerm
 * @param {string} newTerm
 * @param {boolean} stripOnly - when true, remove #oldTerm instead of renaming
 * @returns {string}
 */
export function replaceOrStripHashtagInCombinedValue(text: string, oldTerm: string, newTerm: string, stripOnly: boolean = false): string {
  if (text === '' || oldTerm === '') return text
  const tags = getHashtagsFromString(text)
  const matchingTags = tags.filter((tag) => combinedHashtagMatchesTerm(String(tag), oldTerm))
  if (matchingTags.length === 0) return text

  const newHash = `#${newTerm}`
  let result = text
  const alreadyHasNew =
    !stripOnly && tags.some((tag) => statusValueMatchesHashtag(String(tag), newHash))

  for (const tag of matchingTags) {
    // Space-delimited tokens in the combined project field (preserves @mentions elsewhere).
    const re = new RegExp(`(^|\\s)${escapeRegExp(String(tag))}(?=\\s|$)`, 'gi')
    if (stripOnly || alreadyHasNew) {
      result = result.replace(re, '$1')
    } else {
      result = result.replace(re, `$1${newHash}`)
    }
  }
  return result.replace(/[ \t]{2,}/g, ' ').trim()
}

/**
 * When status owns pause: if the combined project field still has #oldTerm (or legacy #paused when
 * oldTerm is 'paused'), return the field with that hashtag removed and the status hashtag to write
 * (#newTerm). Returns null when there is nothing to migrate.
 * @param {string} combinedVal
 * @param {string} oldTerm
 * @param {string} newTerm
 * @returns {?{| nextCombined: string, statusHashtag: string |}}
 */
export function planPausedHashtagMigrationFromCombined(
  combinedVal: string,
  oldTerm: string,
  newTerm: string,
): ?{| nextCombined: string, statusHashtag: string |} {
  if (combinedVal === '' || oldTerm === '' || newTerm === '') return null
  const nextCombined = replaceOrStripHashtagInCombinedValue(combinedVal, oldTerm, newTerm, true)
  if (nextCombined === combinedVal) return null
  return { nextCombined, statusHashtag: `#${newTerm}` }
}

/** Result of applying one metadata-term rename to a note. */
export type MetadataTermRenameApplyResult = 'changed' | 'unchanged' | 'failed'

/**
 * True when the note's frontmatter paragraphs include an exact `key:` line (case-insensitive).
 * Prefer this over note.frontmatterAttributes alone -- that API can report stale/phantom keys.
 * @param {TNote} note
 * @param {string} key
 * @returns {boolean}
 */
export function noteHasExactFrontmatterKey(note: TNote, key: string): boolean {
  if (key === '') return false
  const fmParas = getFrontmatterParagraphs(note, false)
  if (!fmParas) return false
  const want = key.toLowerCase()
  for (const para of fmParas) {
    const content = para.content ?? ''
    const colonPos = content.indexOf(':')
    if (colonPos < 0) continue
    if (content.slice(0, colonPos).trim().toLowerCase() === want) return true
  }
  return false
}

/**
 * Apply one term rename on a single note's frontmatter + body mentions.
 * When dryRun is true, detect matches but do not write; INFO-log the filename if anything would change.
 * @param {TNote} note
 * @param {MetadataTermRename} rename
 * @param {boolean} useProjectStatus
 * @param {string} combinedKeyName - current combined project tags key name
 * @param {boolean} dryRun - when true, skip writes and only report what would change
 * @returns {MetadataTermRenameApplyResult} 'changed' if updated (or would in dry run); 'unchanged' if no match; 'failed' if a write was attempted and failed
 */
export function applyMetadataTermRenameToNote(
  note: TNote,
  rename: MetadataTermRename,
  useProjectStatus: boolean,
  combinedKeyName: string,
  dryRun: boolean = false,
): MetadataTermRenameApplyResult {
  let changed = false
  let failed = false
  const changeReasons: Array<string> = []
  const { settingKey, oldTerm, newTerm } = rename

  // Rename separate frontmatter key (or combined key name itself) -- only when an exact FM line exists
  const oldKey = settingKey === 'projectMetadataFrontmatterKey' ? oldTerm : oldTerm
  const newKey = settingKey === 'projectMetadataFrontmatterKey' ? newTerm : newTerm
  if (oldKey !== newKey && noteHasExactFrontmatterKey(note, oldKey)) {
    const oldVal = getFrontmatterAttribute(note, oldKey)
    if (oldVal != null && oldVal !== '') {
      if (dryRun) {
        changed = true
        changeReasons.push(`frontmatter key '${oldKey}'`)
      } else {
        const ok = updateFrontMatterVars(note, { [newKey]: oldVal })
        if (ok) {
          removeFrontMatterField(note, oldKey)
          changed = true
          changeReasons.push(`frontmatter key '${oldKey}' → '${newKey}'`)
        } else {
          failed = true
          logWarn(
            'applyMetadataTermRenameToNote',
            `updateFrontMatterVars failed renaming key '${oldKey}' → '${newKey}' in '${note.filename ?? '?'}'`,
          )
        }
      }
    }
  }

  // Status hashtag value
  const statusVal = getFrontmatterAttribute(note, STATUS_FRONTMATTER_KEY)
  if (statusVal != null && statusValueMatchesHashtag(statusVal, `#${oldTerm}`)) {
    if (dryRun) {
      changed = true
      changeReasons.push(`status: ${String(statusVal)}`)
    } else {
      const ok = updateFrontMatterVars(note, { [STATUS_FRONTMATTER_KEY]: `#${newTerm}` })
      if (ok) {
        changed = true
        changeReasons.push(`status: #${oldTerm} → #${newTerm}`)
      } else {
        failed = true
        logWarn(
          'applyMetadataTermRenameToNote',
          `updateFrontMatterVars failed updating status in '${note.filename ?? '?'}'`,
        )
      }
    }
  }

  // Combined project tags: when status owns pause, migrate #oldTerm/#paused from project: → status:;
  // otherwise rename the hashtag in place on the combined field.
  const effectiveCombinedKey =
    settingKey === 'projectMetadataFrontmatterKey' ? newKey : combinedKeyName
  const combinedVal = getFrontmatterAttribute(note, effectiveCombinedKey)
  if (combinedVal != null && typeof combinedVal === 'string' && combinedVal !== '') {
    const migratePausedToStatus =
      useProjectStatus && (settingKey === 'pausedMentionStr' || oldTerm.toLowerCase() === 'paused')
    if (migratePausedToStatus) {
      const migration = planPausedHashtagMigrationFromCombined(combinedVal, oldTerm, newTerm)
      if (migration != null) {
        const combinedReason = `migrate #${oldTerm} from ${effectiveCombinedKey}: → status: ${migration.statusHashtag}`
        if (dryRun) {
          changed = true
          changeReasons.push(combinedReason)
        } else {
          const okCombined = updateFrontMatterVars(note, { [effectiveCombinedKey]: migration.nextCombined })
          const okStatus = updateFrontMatterVars(note, { [STATUS_FRONTMATTER_KEY]: migration.statusHashtag })
          if (okCombined && okStatus) {
            changed = true
            changeReasons.push(combinedReason)
          } else {
            failed = true
            logWarn(
              'applyMetadataTermRenameToNote',
              `Failed migrating paused hashtag from '${effectiveCombinedKey}' to status in '${note.filename ?? '?'}' (combined=${String(okCombined)}, status=${String(okStatus)})`,
            )
          }
        }
      }
    } else {
      const nextCombined = replaceOrStripHashtagInCombinedValue(combinedVal, oldTerm, newTerm, false)
      if (nextCombined !== combinedVal) {
        const combinedReason = `hashtag #${oldTerm} → #${newTerm} in ${effectiveCombinedKey}:`
        if (dryRun) {
          changed = true
          changeReasons.push(combinedReason)
        } else {
          const ok = updateFrontMatterVars(note, { [effectiveCombinedKey]: nextCombined })
          if (ok) {
            changed = true
            changeReasons.push(combinedReason)
          } else {
            failed = true
            logWarn(
              'applyMetadataTermRenameToNote',
              `updateFrontMatterVars failed updating '${effectiveCombinedKey}' in '${note.filename ?? '?'}'`,
            )
          }
        }
      }
    }
  }

  // Body @mentions (including @mentions on the frontmatter project: line)
  const paras = note.paragraphs
  for (let i = 0; i < paras.length; i++) {
    const para = paras[i]
    const content = para.content ?? ''
    const next = replaceBodyMentionTerm(content, oldTerm, newTerm)
    if (next !== content) {
      if (!dryRun) {
        para.content = next
        note.updateParagraph(para)
      }
      changed = true
      changeReasons.push(`body @${oldTerm}( → @${newTerm}(`)
    }
  }

  if (changed) {
    const reasonText = changeReasons.join('; ')
    if (dryRun) {
      logInfo(
        'applyMetadataTermRenameToNote',
        `DRY RUN: would update '${oldTerm}' → '${newTerm}' in '${note.filename ?? '?'}' (${reasonText})`,
      )
    } else {
      DataStore.updateCache(note, true)
      logDebug(
        'applyMetadataTermRenameToNote',
        `Updated '${note.filename ?? '?'}' for '${oldTerm}' → '${newTerm}' (${reasonText})`,
      )
    }
  }
  if (changed) return 'changed'
  if (failed) return 'failed'
  return 'unchanged'
}

/**
 * Escape a string for use in a RegExp.
 * @param {string} s
 * @returns {string}
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
