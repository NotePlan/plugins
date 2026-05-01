// @flow
//-----------------------------------------------------------------------------
// Convert a regular note into a project note (frontmatter metadata).
// by @jgclark
// Last updated 2026-05-01 for v2.0.0.b28 by @Cursor
//-----------------------------------------------------------------------------

import { updateAllProjectsListAfterChange } from './allProjectsListHelpers'
import { normalizeProgressDateFromForm, separateFmKeyFromMentionPref } from './projectClassHelpers'
import { getReviewSettings, type ReviewConfig } from './reviewHelpers'
import { renderProjectListsIfOpen } from './reviews'
import { checkString } from '@helpers/checkType'
import { RE_DATE } from '@helpers/dateTime'
import { JSP, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getOpenEditorFromFilename } from '@helpers/NPEditor'
import { updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { usersVersionHas } from '@helpers/NPVersions'
import { showMessage } from '@helpers/userInput'

const LOG_PREFIX = 'convertToProject'

/** Matches review interval strings such as 1w, +2m (same rule as reviewHelpers populateSeparateDateKeysFromCombinedValue). */
const RE_REVIEW_INTERVAL = /^[+\-]?\d+[BbDdWwMmQqYy]$/

type ConvertToProjectInputs = {
  projectTag: string,
  startDate: string,
  dueDate: ?string,
  reviewedDate: string,
  reviewInterval: string,
  aim: ?string,
  isSequential: boolean,
}

/**
 * Coerce a form value to boolean (CommandBar bool or string).
 * @param {mixed} value
 * @returns {boolean}
 */
function parseBoolFromForm(value: mixed): boolean {
  if (value === true) return true
  if (value === false) return false
  const raw = String(value ?? '').trim().toLowerCase()
  if (['yes', 'y', 'true', '1'].includes(raw)) return true
  return false
}

/**
 * Parse and validate CommandBar.showForm result for convert-to-project.
 * @param {CommandBarFormResult} formResult
 * @param {boolean} sequentialFieldOffered - false when sequentialTag is unset in settings
 * @returns {?ConvertToProjectInputs}
 */
function parseConvertToProjectFormValues(formResult: CommandBarFormResult, sequentialFieldOffered: boolean): ?ConvertToProjectInputs {
  try {
    if (formResult == null || typeof formResult !== 'object') {
      throw new Error('formResult is null or not an object')
    }
    if (formResult.submitted === false) {
      logWarn(LOG_PREFIX, `User did not submit form`)
      return null
    }
    const fieldMap: { [string]: mixed } = formResult.values ?? {}
    const projectTagRaw = fieldMap.projectTag
    const projectTag = typeof projectTagRaw === 'string' ? projectTagRaw.trim() : String(projectTagRaw ?? '').trim()
    if (projectTag === '') {
      logWarn(LOG_PREFIX, `Empty project tag`)
      return null
    }
    const startDate = normalizeProgressDateFromForm(fieldMap.startDate)
    const reviewedDate = normalizeProgressDateFromForm(fieldMap.reviewedDate)
    const dueRaw = fieldMap.dueDate
    let dueDate: ?string = null
    if (dueRaw != null && String(dueRaw).trim() !== '') {
      const d = normalizeProgressDateFromForm(dueRaw)
      const reIso = new RegExp(`^${RE_DATE}$`)
      if (reIso.test(d)) {
        dueDate = d
      }
    }
    const reviewInterval = String(fieldMap.reviewInterval ?? '').trim()
    if (!RE_REVIEW_INTERVAL.test(reviewInterval)) {
      logWarn(LOG_PREFIX, `Invalid review interval '${reviewInterval}'`)
      return null
    }
    const aimRaw = fieldMap.aim
    const aimTrimmed = typeof aimRaw === 'string' ? aimRaw.trim() : String(aimRaw ?? '').trim()
    const aim = aimTrimmed !== '' ? aimTrimmed : null
    const isSequential = sequentialFieldOffered ? parseBoolFromForm(fieldMap.isSequential) : false
    return { projectTag, startDate, dueDate, reviewedDate, reviewInterval, aim, isSequential }
  } catch (error) {
    logError(LOG_PREFIX, `Error parsing form result: ${error.message}`)
    return null
  }
}

/**
 * Build frontmatter attribute map for project metadata (separate keys + combined tags key).
 * @param {ConvertToProjectInputs} inputs
 * @param {ReviewConfig} config
 * @returns {{ [string]: string }}
 */
function buildFrontmatterAttrs(inputs: ConvertToProjectInputs, config: ReviewConfig): { [string]: string } {
  const singleKeyName = checkString(config.projectMetadataFrontmatterKey || 'project')
  const startKey = separateFmKeyFromMentionPref(checkString(DataStore.preference('startMentionStr') || '@start'), 'start')
  const dueKey = separateFmKeyFromMentionPref(checkString(DataStore.preference('dueMentionStr') || '@due'), 'due')
  const reviewedKey = separateFmKeyFromMentionPref(checkString(DataStore.preference('reviewedMentionStr') || '@reviewed'), 'reviewed')
  const reviewIntervalKey = separateFmKeyFromMentionPref(checkString(DataStore.preference('reviewIntervalMentionStr') || '@review'), 'review')
  const sequentialTag = (config.sequentialTag ?? '').trim()
  const combinedTagValue =
    inputs.isSequential && sequentialTag !== '' ? `${inputs.projectTag} ${sequentialTag}`.replace(/\s+/g, ' ').trim() : inputs.projectTag
  const attrs: { [string]: string } = {
    [singleKeyName]: combinedTagValue,
    [startKey]: inputs.startDate,
    [reviewedKey]: inputs.reviewedDate,
    [reviewIntervalKey]: inputs.reviewInterval,
  }
  if (inputs.dueDate != null && inputs.dueDate !== '') {
    attrs[dueKey] = inputs.dueDate
  }
  if (inputs.aim != null && inputs.aim !== '') {
    attrs.aim = inputs.aim
  }
  return attrs
}

/**
 * Validate note can be converted (project-style note, not calendar).
 * @param {CoreNoteFields} note
 * @returns {boolean}
 */
function isValidNoteForConvert(note: CoreNoteFields): boolean {
  if (note == null || note.title == null) {
    return false
  }
  if (note.type === 'Calendar' || (note.paragraphs?.length ?? 0) < 2) {
    return false
  }
  return true
}

/**
 * Convert the given note (or current Editor note) into a project: prompt for metadata via CommandBar.showForm and write YAML frontmatter.
 * Requires NotePlan with command-bar forms (v3.21+).
 * @param {CoreNoteFields?} noteArg - optional note; defaults to Editor.note
 * @returns {Promise<void>}
 */
export async function convertToProject(noteArg?: CoreNoteFields): Promise<void> {
  let resolvedNote: ?CoreNoteFields = null
  try {
    const noteMaybe: ?CoreNoteFields = noteArg ?? Editor?.note
    if (!noteMaybe) {
      logWarn(LOG_PREFIX, `No note passed and not in an Editor.`)
      logInfo(LOG_PREFIX, `Convert to project failed: no note (pass a note or open one in the editor).`)
      return
    }
    resolvedNote = noteMaybe
    if (!isValidNoteForConvert(resolvedNote)) {
      logWarn(LOG_PREFIX, `Invalid note for convert (calendar or too short): '${displayTitle(resolvedNote)}'`)
      logInfo(
        LOG_PREFIX,
        `Convert to project failed: '${displayTitle(resolvedNote)}' is not a valid project note (needs a regular note with at least 2 lines).`,
      )
      return
    }

    logInfo(
      LOG_PREFIX,
      `Starting for note '${displayTitle(resolvedNote)}' (${resolvedNote.filename ?? 'no filename'})`,
    )

    if (!usersVersionHas('commandBarForms')) {
      await showMessage(
        'This command needs NotePlan v3.21 or later (Command Bar forms). Please update NotePlan, or add project metadata manually in the note frontmatter.',
        'OK',
        'Convert to project',
      )
      logInfo(LOG_PREFIX, `Convert to project failed: NotePlan version does not support Command Bar forms.`)
      return
    }

    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) {
      logError(LOG_PREFIX, `Could not load Review plugin settings.`)
      logInfo(LOG_PREFIX, `Convert to project failed: could not load plugin settings.`)
      return
    }

    const tagChoices: Array<string> =
      Array.isArray(config.projectTypeTags) && config.projectTypeTags.length > 0 ? [...config.projectTypeTags] : ['#project']
    const defaultTag = tagChoices[0] ?? '#project'
    const todayIso = normalizeProgressDateFromForm(null)
    const sequentialTagSetting = (config.sequentialTag ?? '').trim()
    const sequentialDescription = `The marker to identify sequential projects. If this appears in a project's frontmatter 'project' attribute, or the metadata line, the first open task/checklist will be shown as a next action.`
    const sequentialFieldOffered = sequentialTagSetting !== ''

    const fields: Array<{ [string]: mixed }> = [
      { type: 'string', key: 'projectTag', title: 'Project type tag', choices: tagChoices, default: defaultTag, required: true },
      { type: 'date', key: 'startDate', title: 'Start date', description: 'Project start date', default: todayIso, required: false },
      { type: 'date', key: 'dueDate', title: 'Due date (optional)', description: 'Target completion date', required: false },
      { type: 'date', key: 'reviewedDate', title: 'Last reviewed date', description: 'Treat as reviewed on this date', default: todayIso, required: false },
      {
        type: 'string',
        key: 'reviewInterval',
        title: 'Review interval',
        description: 'e.g. 1w, 2m, 1q',
        default: '1w',
        placeholder: '1w',
        required: true,
      },
      {
        type: 'string',
        key: 'aim',
        title: 'Aim (optional)',
        description: 'Optional one-line statement of the project aim',
        required: false,
      },
    ]
    if (sequentialFieldOffered) {
      fields.push({
        type: 'bool',
        key: 'isSequential',
        title: 'Treat project as sequential?',
        description: `${sequentialDescription} When enabled, '${sequentialTagSetting}' is added to the combined project tag field in frontmatter.`,
        default: false,
        required: false,
      })
    }

    const formResult = await CommandBar.showForm({
      title: `Convert '${displayTitle(resolvedNote)}' to a Project`,
      submitText: 'Convert',
      fields,
    })

    if (formResult == null || formResult.submitted !== true) {
      logInfo(LOG_PREFIX, `Convert to project cancelled or not submitted for '${displayTitle(resolvedNote)}'.`)
      return
    }

    const inputs = parseConvertToProjectFormValues(formResult, sequentialFieldOffered)
    if (!inputs) {
      logInfo(LOG_PREFIX, `Convert to project failed: invalid or incomplete form data for '${displayTitle(resolvedNote)}'.`)
      await showMessage(`Couldn't convert '${displayTitle(resolvedNote)}'. The form data was invalid or incomplete.`, 'OK', 'Convert to Project')
      return
    }

    const attrs = buildFrontmatterAttrs(inputs, config)
    const possibleEditor = getOpenEditorFromFilename(resolvedNote.filename)
    const targetForFm: TEditor | TNote = possibleEditor || resolvedNote
    const noteForCache: TNote = (possibleEditor && possibleEditor.note) ? possibleEditor.note : ((resolvedNote: any): TNote)

    const ok = updateFrontMatterVars(targetForFm, attrs)
    if (!ok) {
      logError(LOG_PREFIX, `updateFrontMatterVars returned false for '${displayTitle(resolvedNote)}'`)
      logInfo(LOG_PREFIX, `Convert to project failed: could not write frontmatter for '${displayTitle(resolvedNote)}'.`)
      await showMessage(`Couldn't convert '${displayTitle(resolvedNote)}'. I couldn't write frontmatter to this note.`, 'OK', 'Convert to Project')
      return
    }
    DataStore.updateCache(noteForCache, true)

    await updateAllProjectsListAfterChange(resolvedNote.filename ?? '', false, config)
    await renderProjectListsIfOpen(config)

    logInfo(
      LOG_PREFIX,
      `Convert to project succeeded for '${displayTitle(resolvedNote)}' (${resolvedNote.filename ?? ''}); wrote project metadata to frontmatter.`,
    )
    await showMessage(`Converted '${displayTitle(resolvedNote)}' to a project and updated frontmatter metadata.`, 'OK', 'Convert to Project')
  } catch (error) {
    logError(LOG_PREFIX, JSP(error))
    const title = resolvedNote != null ? displayTitle(resolvedNote) : '(unknown note)'
    logInfo(LOG_PREFIX, `Convert to project failed for '${title}': ${error.message}`)
    await showMessage(`Couldn't convert '${title}' to a project: ${error.message}`, 'OK', 'Convert to project')
  }
}
