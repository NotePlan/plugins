// @flow
//-----------------------------------------------------------------------------
// Convert an existing note, or create a new note, as a project (frontmatter metadata).
// by @jgclark
// Last updated 2026-09-11 for v2.2.0 by @CursorAI & @jgclark
//-----------------------------------------------------------------------------

import { addNewProjectToAllProjectsListIfInScope, ALWAYS_EXCLUDED_PROJECT_FOLDERS } from './allProjectsListHelpers'
import { normalizeProgressDateFromForm, separateFmKeyFromMentionPref } from './projectClassHelpers'
import { formatProgressCommentString, getReviewSettings, type ReviewConfig } from './reviewHelpers'
import { renderProjectListsIfOpen } from './reviews'
import { checkString } from '@helpers/checkType'
import { RE_DATE } from '@helpers/dateTime'
import { JSP, logError, logInfo, logWarn } from '@helpers/dev'
import { getFolderDisplayName, getFolderFromFilename, getFolderListMinusExclusions } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { getOpenEditorFromFilename } from '@helpers/NPEditor'
import { updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { getNoteFromFilename } from '@helpers/NPnote'
import { usersVersionHas } from '@helpers/NPVersions'
import { openNoteInNewSplitIfNeeded } from '@helpers/NPWindows'
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
  startingProgress: ?string,
}

type CreateNewProjectInputs = {
  ...ConvertToProjectInputs,
  title: string,
  folder: string,
}

export type FolderChoice = {
  path: string,
  label: string,
}

// Note: `min`/`max` are accepted at runtime by CommandBar.showForm for number fields, but are not (yet) in its flow-typed signature
type ProjectFormField = {
  type: string,
  key: string,
  title: string,
  label?: string,
  placeholder?: string,
  default?: string | number | boolean,
  required?: boolean,
  description?: string,
  format?: string,
  choices?: $ReadOnlyArray<string>,
  boxHeight?: number,
  min?: number,
  max?: number,
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
 * Parse and validate CommandBar.showForm result for create-new-project (title + folder plus convert-to-project fields).
 * @param {CommandBarFormResult} formResult
 * @param {boolean} sequentialFieldOffered
 * @returns {?CreateNewProjectInputs}
 */
export function parseCreateNewProjectFormValues(formResult: CommandBarFormResult, sequentialFieldOffered: boolean): ?CreateNewProjectInputs {
  const projectInputs = parseConvertToProjectFormValues(formResult, sequentialFieldOffered)
  if (!projectInputs) return null
  const fieldMap: { [string]: mixed } = formResult.values ?? {}
  const title = typeof fieldMap.title === 'string' ? fieldMap.title.trim() : String(fieldMap.title ?? '').trim()
  const folder = typeof fieldMap.folder === 'string' ? fieldMap.folder.trim() : String(fieldMap.folder ?? '').trim()
  if (title === '') {
    logWarn('parseCreateNewProjectFormValues', `Empty project title`)
    return null
  }
  if (folder === '') {
    logWarn('parseCreateNewProjectFormValues', `Empty folder`)
    return null
  }
  return { ...projectInputs, title, folder }
}

/**
 * Folder choices for the create-new-project dropdown: all folders except @Archive, @Templates, and @Trash.
 * Labels use getFolderDisplayName so Teamspace folders show the space title instead of a UUID.
 * @returns {Array<FolderChoice>}
 */
export function getFolderChoicesForNewProject(): Array<FolderChoice> {
  const folders = getFolderListMinusExclusions(ALWAYS_EXCLUDED_PROJECT_FOLDERS, false, false)
    .filter((folder) => folder && folder !== '(error)')
  if (folders.length === 0) {
    return [{ path: '/', label: getFolderDisplayName('/') }]
  }
  // Add private root folder if we haven't already got it
  if (!folders.includes('/')) {
    folders.unshift('/')
  }
  return folders
    .map((path) => ({ path, label: getFolderDisplayName(path) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Initially-selected folder for create-new-project: the current Editor note's folder when it is a regular note in the choices list, otherwise root (or the first choice).
 * @param {Array<FolderChoice>} folderChoices
 * @param {?TNote} editorNote
 * @returns {FolderChoice}
 */
export function getDefaultFolderForNewProject(folderChoices: Array<FolderChoice>, editorNote: ?TNote): FolderChoice {
  const fallback = folderChoices.find((choice) => choice.path === '/') ?? folderChoices[0] ?? { path: '/', label: '/' }
  if (editorNote == null || editorNote.type === 'Calendar' || !editorNote.filename) {
    return fallback
  }
  const currentFolder = getFolderFromFilename(editorNote.filename)
  const match = folderChoices.find((choice) => choice.path === currentFolder)
  if (match) {
    return match
  }
  return fallback
}

/**
 * Map a dropdown selection (display label, or raw folder path) back to the DataStore folder path.
 * @param {Array<FolderChoice>} folderChoices
 * @param {string} selected
 * @returns {?string}
 */
export function resolveFolderPathFromChoice(folderChoices: Array<FolderChoice>, selected: string): ?string {
  const trimmed = selected.trim()
  if (trimmed === '') return null
  const byPath = folderChoices.find((choice) => choice.path === trimmed)
  if (byPath) return byPath.path
  const byLabel = folderChoices.find((choice) => choice.label === trimmed)
  return byLabel ? byLabel.path : null
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
 * Shared CommandBar fields used by convert-to-project and create-new-project.
 * @param {ReviewConfig} config
 * @param {string} todayIso
 * @param {boolean} sequentialFieldOffered
 * @param {string} sequentialTagSetting
 * @param {string} sequentialDescription
 * @returns {Array<ProjectFormField>}
 */
function buildSharedProjectMetadataFields(
  config: ReviewConfig,
  todayIso: string,
  sequentialFieldOffered: boolean,
  sequentialTagSetting: string,
  sequentialDescription: string,
): Array<ProjectFormField> {
  const tagChoices: Array<string> =
    Array.isArray(config.projectTypeTags) && config.projectTypeTags.length > 0 ? [...config.projectTypeTags] : ['#project']
  const defaultTag = tagChoices[0] ?? '#project'
  const fields: Array<ProjectFormField> = [
    { type: 'string', key: 'projectTag', title: 'Project type tag', choices: tagChoices, default: defaultTag, required: true },
    {
      type: 'string',
      key: 'aim',
      title: 'Aim (optional)',
      description: 'Optional one-line statement of the project aim',
      required: false,
    },
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
  return fields
}

/**
 * Write project frontmatter and refresh open project lists.
 * @param {TNote} note
 * @param {ConvertToProjectInputs} inputs
 * @param {ReviewConfig} config
 * @returns {Promise<boolean>}
 */
async function applyProjectMetadataAndRefreshLists(note: TNote, inputs: ConvertToProjectInputs, config: ReviewConfig): Promise<boolean> {
  const attrs = buildFrontmatterAttrs(inputs, config)
  const possibleEditor = getOpenEditorFromFilename(note.filename)
  const targetForFm: TEditor | TNote = possibleEditor || note
  const noteForCache: TNote = (possibleEditor && possibleEditor.note) ? possibleEditor.note : note

  const ok = updateFrontMatterVars(targetForFm, attrs)
  if (!ok) {
    return false
  }
  DataStore.updateCache(noteForCache, true)

  const refreshedNote = getNoteFromFilename(note.filename ?? '') ?? noteForCache
  await addNewProjectToAllProjectsListIfInScope(refreshedNote, inputs.projectTag, config)
  await renderProjectListsIfOpen(config)
  return true
}

/**
 * Shared setup for convert/create project forms (settings, version check, sequential fields).
 * @param {string} commandTitle
 * @returns {Promise<?{ config: ReviewConfig, todayIso: string, sequentialFieldOffered: boolean, sequentialTagSetting: string, sequentialDescription: string }>}
 */
async function loadProjectFormContext(commandTitle: string): Promise<?{
  config: ReviewConfig,
  todayIso: string,
  sequentialFieldOffered: boolean,
  sequentialTagSetting: string,
  sequentialDescription: string,
}> {
  if (!usersVersionHas('commandBarForms')) {
    await showMessage(
      'This command needs NotePlan v3.21 or later (Command Bar forms). Please update NotePlan, or add project metadata manually in the note frontmatter.',
      'OK',
      commandTitle,
    )
    logInfo('loadProjectFormContext', `${commandTitle} failed: NotePlan version does not support Command Bar forms.`)
    return null
  }

  const config: ?ReviewConfig = await getReviewSettings()
  if (!config) {
    logError('loadProjectFormContext', `Could not load Review plugin settings.`)
    logInfo('loadProjectFormContext', `${commandTitle} failed: could not load plugin settings.`)
    return null
  }

  const todayIso = normalizeProgressDateFromForm(null)
  const sequentialTagSetting = (config.sequentialTag ?? '').trim()
  const sequentialDescription = `The marker to identify sequential projects. If this appears in a project's frontmatter 'project' attribute, or the metadata line, the first open task/checklist will be shown as a next action.`
  const sequentialFieldOffered = sequentialTagSetting !== ''
  return { config, todayIso, sequentialFieldOffered, sequentialTagSetting, sequentialDescription }
}

/**
 * Convert the given note (or current Editor note) into a project: prompt for metadata via CommandBar.showForm and write YAML frontmatter.
 * Requires NotePlan with command-bar forms (v3.21+).
 * @param {TNote?} noteArg - optional note; defaults to Editor.note
 * @returns {Promise<void>}
 */
export async function convertToProject(noteArg?: TNote): Promise<void> {
  let resolvedNote: ?TNote = null
  try {
    // Initial checks
    const noteMaybe: ?TNote = noteArg ?? Editor?.note
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

    const formContext = await loadProjectFormContext('Convert to project')
    if (!formContext) {
      return
    }
    const { config, todayIso, sequentialFieldOffered, sequentialTagSetting, sequentialDescription } = formContext
    const fields = buildSharedProjectMetadataFields(config, todayIso, sequentialFieldOffered, sequentialTagSetting, sequentialDescription)

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

    const ok = await applyProjectMetadataAndRefreshLists(resolvedNote, inputs, config)
    if (!ok) {
      logError('convertToProject', `updateFrontMatterVars returned false for '${displayTitle(resolvedNote)}'`)
      logInfo('convertToProject', `Convert to project failed: could not write frontmatter for '${displayTitle(resolvedNote)}'.`)
      await showMessage(`Couldn't convert '${displayTitle(resolvedNote)}'. I couldn't write frontmatter to this note.`, 'OK', 'Convert to Project')
      return
    }

    logInfo('convertToProject', `Convert to project succeeded for '${displayTitle(resolvedNote)}' (${resolvedNote.filename ?? ''}); wrote project metadata to frontmatter.`)
    await showMessage(`Converted '${displayTitle(resolvedNote)}' to a project and updated frontmatter metadata.`, 'OK', 'Convert to Project')
  } catch (error) {
    logError('convertToProject', JSP(error))
    const title = resolvedNote != null ? displayTitle(resolvedNote) : '(unknown note)'
    logInfo('convertToProject', `Convert to project failed for '${title}': ${error.message}`)
    await showMessage(`Couldn't convert '${title}' to a project: ${error.message}`, 'OK', 'Convert to project')
  }
}

/**
 * Create a new project note: prompt for title, folder, and the same metadata as convert-to-project, then open the note in a split view.
 * Requires NotePlan with command-bar forms (v3.21+).
 * @returns {Promise<void>}
 */
export async function createNewProject(): Promise<void> {
  try {
    logInfo('createNewProject', `Starting`)

    const formContext = await loadProjectFormContext('Create new project')
    if (!formContext) {
      return
    }
    const { config, todayIso, sequentialFieldOffered, sequentialTagSetting, sequentialDescription } = formContext
    const folderChoices = getFolderChoicesForNewProject()
    const defaultFolder = getDefaultFolderForNewProject(folderChoices, Editor?.note)
    const metadataFields = buildSharedProjectMetadataFields(config, todayIso, sequentialFieldOffered, sequentialTagSetting, sequentialDescription)
    const fields: Array<ProjectFormField> = [
      {
        type: 'string',
        key: 'title',
        title: 'Project title',
        placeholder: 'Name of the new project note',
        required: true,
      },
      {
        type: 'string',
        key: 'folder',
        title: 'Folder',
        description: 'Folder to create the new project note in',
        choices: folderChoices.map((choice) => choice.label),
        default: defaultFolder.label,
        required: true,
      },
      ...metadataFields,
    ]

    const formResult = await CommandBar.showForm({
      title: 'Create new project',
      submitText: 'Create',
      fields,
    })

    if (formResult == null || formResult.submitted !== true) {
      logInfo('createNewProject', `Create new project cancelled or not submitted.`)
      return
    }

    const inputs = parseCreateNewProjectFormValues(formResult, sequentialFieldOffered)
    if (!inputs) {
      logInfo('createNewProject', `Create new project failed: invalid or incomplete form data.`)
      await showMessage(`Couldn't create the project. The form data was invalid or incomplete.`, 'OK', 'Create new project')
      return
    }

    const folderPath = resolveFolderPathFromChoice(folderChoices, inputs.folder)
    if (!folderPath) {
      logInfo('createNewProject', `Create new project failed: could not resolve folder '${inputs.folder}'.`)
      await showMessage(`Couldn't create the project. The chosen folder '${inputs.folder}' was not recognised.`, 'OK', 'Create new project')
      return
    }

    const filename = await DataStore.newNote(inputs.title, folderPath)
    if (!filename) {
      logError('createNewProject', `DataStore.newNote returned no filename for title '${inputs.title}' in folder '${folderPath}'`)
      await showMessage(`Couldn't create a note titled '${inputs.title}' in folder '${inputs.folder}'.`, 'OK', 'Create new project')
      return
    }

    const createdNote = getNoteFromFilename(filename)
    if (!createdNote) {
      logError('createNewProject', `Could not load newly created note '${filename}'`)
      await showMessage(`Created '${inputs.title}' but couldn't open it to add project metadata.`, 'OK', 'Create new project')
      return
    }

    const ok = await applyProjectMetadataAndRefreshLists(createdNote, inputs, config)
    if (!ok) {
      logError('createNewProject', `updateFrontMatterVars returned false for '${inputs.title}' (${filename})`)
      await showMessage(`Created '${inputs.title}' but couldn't write project metadata to it. You can run convert to project on that note.`, 'OK', 'Create new project')
      return
    }

    const opened = await openNoteInNewSplitIfNeeded(filename)
    if (!opened) {
      logWarn('createNewProject', `Created '${inputs.title}' (${filename}) but did not open a new split (note may already be open).`)
    }
    logInfo('createNewProject', `Create new project succeeded for '${inputs.title}' (${filename}) in folder '${folderPath}'.`)
  } catch (error) {
    logError('createNewProject', JSP(error))
    logInfo('createNewProject', `Create new project failed: ${error.message}`)
    await showMessage(`Couldn't create a new project: ${error.message}`, 'OK', 'Create new project')
  }
}
