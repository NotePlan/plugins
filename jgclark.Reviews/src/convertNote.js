// @flow
//-----------------------------------------------------------------------------
// Convert a regular note into a project note (frontmatter metadata).
// by @jgclark
// Last updated 2026-05-23 for v2.0.1 by @CursorAI & @jgclark
//-----------------------------------------------------------------------------

import { addNewProjectToAllProjectsListIfInScope } from './allProjectsListHelpers'
import { normalizeProgressDateFromForm, separateFmKeyFromMentionPref } from './projectClassHelpers'
import { formatProgressCommentString, getReviewSettings, type ReviewConfig } from './reviewHelpers'
import { renderProjectListsIfOpen } from './reviews'
import { checkString } from '@helpers/checkType'
import { RE_DATE } from '@helpers/dateTime'
import { JSP, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getOpenEditorFromFilename } from '@helpers/NPEditor'
import { getNoteFromFilename } from '@helpers/NPnote'
import { updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { usersVersionHas } from '@helpers/NPVersions'
import { showMessage } from '@helpers/userInput'

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
  // startingProgressNumber: ?number,
  // startingProgressComment: ?string,
  startingProgress: ?string,
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
      logWarn('parseConvertToProjectFormValues', `User did not submit form`)
      return null
    }
    const fieldMap: { [string]: mixed } = formResult.values ?? {}
    const projectTagRaw = fieldMap.projectTag
    const projectTag = typeof projectTagRaw === 'string' ? projectTagRaw.trim() : String(projectTagRaw ?? '').trim()
    if (projectTag === '') {
      logWarn('parseConvertToProjectFormValues', `Empty project tag`)
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
      logWarn('parseConvertToProjectFormValues', `Invalid review interval '${reviewInterval}'`)
      return null
    }
    const aimRaw = fieldMap.aim
    const aimTrimmed = typeof aimRaw === 'string' ? aimRaw.trim() : String(aimRaw ?? '').trim()
    const aim = aimTrimmed !== '' ? aimTrimmed : null
    const isSequential = sequentialFieldOffered ? parseBoolFromForm(fieldMap.isSequential) : false
    const startingProgressNumberAsString: string = fieldMap.startingProgressNumber != null ? String(Number(fieldMap.startingProgressNumber)) : ''
    const startingProgressComment = fieldMap.startingProgressComment != null && fieldMap.startingProgressComment !== '' ? String(fieldMap.startingProgressComment) : ''
    const startingProgress =
      startingProgressComment !== ''
        ? formatProgressCommentString(
          startingProgressComment,
          startingProgressNumberAsString !== '' ? startingProgressNumberAsString : undefined,
        )
        : startingProgressNumberAsString !== ''
          ? formatProgressCommentString('Started', startingProgressNumberAsString)
          : null
    return { projectTag, startDate, dueDate, reviewedDate, reviewInterval, aim, isSequential, startingProgress }
  } catch (error) {
    logError('parseConvertToProjectFormValues', `Error parsing form result: ${error.message}`)
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
  const progressKey = separateFmKeyFromMentionPref(checkString(config.progressStr || 'progress'), 'progress')
  const sequentialTag = (config.sequentialTag ?? '').trim()
  const combinedTagValue =
    inputs.isSequential && sequentialTag !== '' ? `${inputs.projectTag} ${sequentialTag}`.replace(/\s+/g, ' ').trim() : inputs.projectTag
  const startingProgress = inputs.startingProgress != null && inputs.startingProgress !== '' ? inputs.startingProgress : null
  const attrs: { [string]: string } = {
    [singleKeyName]: combinedTagValue,
    [startKey]: inputs.startDate,
    [reviewedKey]: inputs.reviewedDate,
    [reviewIntervalKey]: inputs.reviewInterval,
  }
  if (startingProgress != null) {
    attrs[progressKey] = startingProgress
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
 * Convert the given note (or current Editor note) into a project: prompt for metadata via CommandBar.showForm and write YAML frontmatter.
 * Requires NotePlan with command-bar forms (v3.21+).
 * @param {CoreNoteFields?} noteArg - optional note; defaults to Editor.note
 * @returns {Promise<void>}
 */
export async function convertToProject(noteArg?: CoreNoteFields): Promise<void> {
  let resolvedNote: ?CoreNoteFields = null
  try {
    // Initial checks
    const noteMaybe: ?CoreNoteFields = noteArg ?? Editor?.note
    if (!noteMaybe) {
      logWarn('convertToProject', `No note passed and not in an Editor.`)
      logInfo('convertToProject', `Convert to project failed: no note (pass a note or open one in the editor).`)
      return
    }
    if (noteMaybe.type === 'Calendar') {
      logWarn('convertToProject', `Calendar notes can't be converted to be a project note.`)
      await showMessage(`Couldn't convert note '${displayTitle(noteMaybe)}' as it is a calendar note.`, 'OK', 'Convert to Project')
      return
    }
    if ((noteMaybe.paragraphs?.length ?? 0) === 0) {
      logWarn('convertToProject', `Note is empty, so it can't be converted to be a project note.`)
      await showMessage(`Couldn't convert note '${displayTitle(noteMaybe)}' as it is empty.`, 'OK', 'Convert to Project')
      return
    }
    resolvedNote = noteMaybe

    logInfo('convertToProject', `Starting for note '${displayTitle(resolvedNote)}' (${resolvedNote.filename ?? 'no filename'})`)

    if (!usersVersionHas('commandBarForms')) {
      await showMessage(
        'This command needs NotePlan v3.21 or later (Command Bar forms). Please update NotePlan, or add project metadata manually in the note frontmatter.',
        'OK',
        'Convert to project',
      )
      logInfo('convertToProject', `Convert to project failed: NotePlan version does not support Command Bar forms.`)
      return
    }

    const config: ?ReviewConfig = await getReviewSettings()
    if (!config) {
      logError('convertToProject', `Could not load Review plugin settings.`)
      logInfo('convertToProject', `Convert to project failed: could not load plugin settings.`)
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
      {
        type: 'number',
        key: 'startingProgressNumber',
        title: 'Starting progress (optional)',
        description: 'Optional starting progress percentage (0-100)',
        default: 0,
        min: 0,
        max: 100,
        placeholder: '',
        required: false,
      },
      {
        type: 'string',
        key: 'startingProgressComment',
        title: 'Starting progress comment',
        description: 'Optional starting progress comment',
        placeholder: 'Started',
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
      logInfo('convertToProject', `Convert to project cancelled or not submitted for '${displayTitle(resolvedNote)}'.`)
      return
    }

    const inputs = parseConvertToProjectFormValues(formResult, sequentialFieldOffered)
    if (!inputs) {
      logInfo('convertToProject', `Convert to project failed: invalid or incomplete form data for '${displayTitle(resolvedNote)}'.`)
      await showMessage(`Couldn't convert '${displayTitle(resolvedNote)}'. The form data was invalid or incomplete.`, 'OK', 'Convert to Project')
      return
    }

    const attrs = buildFrontmatterAttrs(inputs, config)
    const possibleEditor = getOpenEditorFromFilename(resolvedNote.filename)
    // $FlowFixMe[incompatible-type]
    const targetForFm: TEditor | TNote = possibleEditor || resolvedNote
    const noteForCache: TNote = (possibleEditor && possibleEditor.note) ? possibleEditor.note : ((resolvedNote: any): TNote)

    const ok = updateFrontMatterVars(targetForFm, attrs)
    if (!ok) {
      logError('convertToProject', `updateFrontMatterVars returned false for '${displayTitle(resolvedNote)}'`)
      logInfo('convertToProject', `Convert to project failed: could not write frontmatter for '${displayTitle(resolvedNote)}'.`)
      await showMessage(`Couldn't convert '${displayTitle(resolvedNote)}'. I couldn't write frontmatter to this note.`, 'OK', 'Convert to Project')
      return
    }
    DataStore.updateCache(noteForCache, true)

    const refreshedNote = getNoteFromFilename(resolvedNote.filename ?? '') ?? noteForCache
    await addNewProjectToAllProjectsListIfInScope(refreshedNote, inputs.projectTag, config)
    await renderProjectListsIfOpen(config)

    logInfo('convertToProject', `Convert to project succeeded for '${displayTitle(resolvedNote)}' (${resolvedNote.filename ?? ''}); wrote project metadata to frontmatter.`)
    await showMessage(`Converted '${displayTitle(resolvedNote)}' to a project and updated frontmatter metadata.`, 'OK', 'Convert to Project')
  } catch (error) {
    logError('convertToProject', JSP(error))
    const title = resolvedNote != null ? displayTitle(resolvedNote) : '(unknown note)'
    logInfo('convertToProject', `Convert to project failed for '${title}': ${error.message}`)
    await showMessage(`Couldn't convert '${title}' to a project: ${error.message}`, 'OK', 'Convert to project')
  }
}
