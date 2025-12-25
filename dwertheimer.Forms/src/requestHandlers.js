// @flow

/**
 * Request Handlers for Forms Plugin
 *
 * This file contains handlers for request/response pattern communication from React to NotePlan.
 * Each handler should return a standardized response object with:
 * - success: boolean
 * - message: string (optional, for error messages or informational messages)
 * - data: any (the actual response data)
 *
 * @author @dwertheimer
 */

import pluginJson from '../plugin.json'
import { getAllNotesAsOptions, getRelativeNotesAsOptions } from './noteHelpers'
import { createProcessingTemplate } from './ProcessingTemplate'
import { FORMBUILDER_WINDOW_ID } from './windowManagement'
import { loadTemplateBodyFromTemplate, loadTemplateRunnerArgsFromTemplate, formatFormFieldsAsCodeBlock, getFormTemplateList } from './templateIO'
import { openFormBuilder } from './NPTemplateForm'
import { logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFoldersMatching, getFolderFromFilename } from '@helpers/folders'
import { getAllTeamspaceIDsAndTitles } from '@helpers/NPTeamspace'
import { showMessage } from '@helpers/userInput'
import { getHeadingsFromNote } from '@helpers/NPnote'
import { getNoteByFilename } from '@helpers/note'
import { focusHTMLWindowIfAvailable } from '@helpers/NPWindows'
import { updateFrontMatterVars, ensureFrontmatter, endOfFrontmatterLineIndex } from '@helpers/NPFrontMatter'
import { saveCodeBlockToNote, loadCodeBlockFromNote } from '@helpers/codeBlocks'
import { parseObjectString } from '@helpers/stringTransforms'
import { replaceContentUnderHeading } from '@helpers/NPParagraph'
import { initPromisePolyfills, waitForCondition } from '@helpers/promisePolyfill'

// Initialize Promise polyfills early
initPromisePolyfills()

/**
 * Standardized response type for all request handlers
 */
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Test function to verify request handlers are working correctly
 * Call this from NotePlan Command Bar: "Test Request Handlers"
 * @returns {Promise<void>}
 */
export async function testRequestHandlers(): Promise<void> {
  try {
    logInfo(pluginJson, '🧪 Testing request handlers...')

    // Test getFolders
    logInfo(pluginJson, 'Testing getFolders...')
    const foldersResult = getFolders({ excludeTrash: true })
    logInfo(pluginJson, `getFolders: success=${String(foldersResult.success)}, folders=${foldersResult.data?.length ?? 0}`)
    if (foldersResult.data && foldersResult.data.length > 0) {
      logInfo(pluginJson, `First 3 folders: ${foldersResult.data.slice(0, 3).join(', ')}`)
    }

    // Test getNotes
    logInfo(pluginJson, 'Testing getNotes...')
    const notesResult = getNotes({ includeCalendarNotes: false })
    logInfo(pluginJson, `getNotes: success=${String(notesResult.success)}, notes=${notesResult.data?.length ?? 0}`)
    if (notesResult.data && notesResult.data.length > 0) {
      logInfo(
        pluginJson,
        `First 3 notes: ${notesResult.data
          .slice(0, 3)
          .map((n: any) => n.title || n.filename)
          .join(', ')}`,
      )
    }

    // Test getTeamspaces
    logInfo(pluginJson, 'Testing getTeamspaces...')
    const teamspacesResult = getTeamspaces({})
    logInfo(pluginJson, `getTeamspaces: success=${String(teamspacesResult.success)}, teamspaces=${teamspacesResult.data?.length ?? 0}`)
    if (teamspacesResult.data && teamspacesResult.data.length > 0) {
      logInfo(pluginJson, `Teamspaces: ${teamspacesResult.data.map((ts: any) => `${ts.title} (${ts.id})`).join(', ')}`)
    }

    logInfo(pluginJson, '✅ All request handlers tested successfully! Check Plugin Console for details.')
    await showMessage('Request handlers test complete! Check Plugin Console (NotePlan > Help > Plugin Console) for details.')
  } catch (error) {
    logError(pluginJson, `❌ Error testing request handlers: ${error.message}`)
    await showMessage(`Error testing request handlers: ${error.message}`)
  }
}

/**
 * Get list of folders (excluding trash)
 * @param {Object} params - Request parameters
 * @param {boolean} params.excludeTrash - Whether to exclude @Trash folder (default: true)
 * @returns {RequestResponse}
 */
export function getFolders(params: { excludeTrash?: boolean } = {}): RequestResponse {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[DIAG] getFolders START: excludeTrash=${String(params.excludeTrash ?? true)}`)

    const excludeTrash = params.excludeTrash ?? true
    const exclusions = excludeTrash ? ['@Trash'] : []

    // Get all folders except exclusions. Include special folders (@Templates, @Archive, etc.) and teamspaces, sorted
    const foldersStartTime: number = Date.now()
    const folders = getFoldersMatching([], false, exclusions, false, true)
    const foldersElapsed: number = Date.now() - foldersStartTime
    logDebug(pluginJson, `[DIAG] getFolders getFoldersMatching: elapsed=${foldersElapsed}ms, found=${folders.length} folders`)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getFolders COMPLETE: totalElapsed=${totalElapsed}ms, found=${folders.length} folders`)

    if (folders.length === 0) {
      logInfo(pluginJson, `getFolders: No folders found, returning root folder only`)
      return {
        success: true,
        message: 'No folders found, returning root folder',
        data: ['/'],
      }
    }

    return {
      success: true,
      data: folders,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getFolders ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get folders: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get list of notes with filtering options
 * @param {Object} params - Request parameters
 * @param {boolean} params.includeCalendarNotes - Include calendar notes (default: false)
 * @param {boolean} params.includePersonalNotes - Include personal/project notes (default: true)
 * @param {boolean} params.includeRelativeNotes - Include relative notes like <today>, <thisweek>, etc. (default: false)
 * @param {boolean} params.includeTeamspaceNotes - Include teamspace notes (default: true)
 * @returns {RequestResponse}
 */
export function getNotes(
  params: {
    includeCalendarNotes?: boolean,
    includePersonalNotes?: boolean,
    includeRelativeNotes?: boolean,
    includeTeamspaceNotes?: boolean,
  } = {},
): RequestResponse {
  const startTime: number = Date.now()
  try {
    const includeCalendarNotes = params.includeCalendarNotes ?? false
    const includePersonalNotes = params.includePersonalNotes ?? true
    const includeRelativeNotes = params.includeRelativeNotes ?? false
    const includeTeamspaceNotes = params.includeTeamspaceNotes ?? true

    logDebug(
      pluginJson,
      `[DIAG] getNotes START: includeCalendarNotes=${String(includeCalendarNotes)}, includePersonalNotes=${String(includePersonalNotes)}, includeRelativeNotes=${String(
        includeRelativeNotes,
      )}, includeTeamspaceNotes=${String(includeTeamspaceNotes)}`,
    )

    const allNotes: Array<any> = []

    // Get project notes and calendar notes separately, then filter
    const processStartTime: number = Date.now()

    // Get project notes (personal notes)
    if (includePersonalNotes) {
      const projectNotes = getAllNotesAsOptions(false, true) // Don't include calendar notes here
      const processElapsed: number = Date.now() - processStartTime
      logDebug(pluginJson, `[DIAG] getNotes PROJECT: elapsed=${processElapsed}ms, found=${projectNotes.length} project notes`)

      // Filter teamspace notes if needed
      for (const note of projectNotes) {
        const isTeamspaceNote = note.isTeamspaceNote === true
        if (includeTeamspaceNotes || !isTeamspaceNote) {
          allNotes.push(note)
        }
      }
      logDebug(pluginJson, `[DIAG] getNotes PROJECT FILTERED: ${allNotes.length} personal notes after teamspace filter`)
    }

    // Get calendar notes if requested
    if (includeCalendarNotes) {
      const calendarStartTime: number = Date.now()
      const calendarNotes = getAllNotesAsOptions(true, true) // Include calendar notes
      const calendarElapsed: number = Date.now() - calendarStartTime
      logDebug(pluginJson, `[DIAG] getNotes CALENDAR: elapsed=${calendarElapsed}ms, found=${calendarNotes.length} calendar notes`)

      // Filter teamspace notes if needed, and only include calendar notes (not project notes)
      for (const note of calendarNotes) {
        const isCalendarNote = note.type === 'Calendar'
        const isTeamspaceNote = note.isTeamspaceNote === true

        // Only include if it's actually a calendar note (not a project note that got mixed in)
        if (isCalendarNote) {
          if (includeTeamspaceNotes || !isTeamspaceNote) {
            allNotes.push(note)
          }
        }
      }
      logDebug(pluginJson, `[DIAG] getNotes CALENDAR FILTERED: ${allNotes.length} total notes after calendar filter`)
    }

    logDebug(pluginJson, `[DIAG] getNotes FILTERED: ${allNotes.length} notes after filtering`)

    // Get relative notes (like <today>, <thisweek>, etc.)
    if (includeRelativeNotes) {
      const processStartTime: number = Date.now()
      const relativeNotes = getRelativeNotesAsOptions(true) // Include decoration
      const processElapsed: number = Date.now() - processStartTime
      logDebug(pluginJson, `[DIAG] getNotes RELATIVE: elapsed=${processElapsed}ms, found=${relativeNotes.length} relative notes`)
      allNotes.push(...relativeNotes)
    }

    // Re-sort all notes together by changedDate (most recent first), but put relative notes at the top
    allNotes.sort((a: any, b: any) => {
      // Relative notes (those with filename starting with '<') should appear first
      const aIsRelative = typeof a.filename === 'string' && a.filename.startsWith('<')
      const bIsRelative = typeof b.filename === 'string' && b.filename.startsWith('<')

      if (aIsRelative && !bIsRelative) return -1
      if (!aIsRelative && bIsRelative) return 1

      // For non-relative notes, sort by changedDate (most recent first)
      const aDate = typeof a.changedDate === 'number' ? a.changedDate : 0
      const bDate = typeof b.changedDate === 'number' ? b.changedDate : 0
      return bDate - aDate
    })

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getNotes COMPLETE: totalElapsed=${totalElapsed}ms, found=${allNotes.length} total notes`)

    return {
      success: true,
      data: allNotes,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getNotes ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get notes: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get teamspace definitions for folder decoration
 * @param {Object} params - Request parameters (currently unused)
 * @returns {RequestResponse}
 */
export function getTeamspaces(_params: Object = {}): RequestResponse {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[DIAG] getTeamspaces START`)

    const teamspacesStartTime: number = Date.now()
    const teamspaces = getAllTeamspaceIDsAndTitles()
    const teamspacesElapsed: number = Date.now() - teamspacesStartTime
    logDebug(pluginJson, `[DIAG] getTeamspaces getAllTeamspaceIDsAndTitles: elapsed=${teamspacesElapsed}ms, found=${teamspaces.length} teamspaces`)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getTeamspaces COMPLETE: totalElapsed=${totalElapsed}ms, found=${teamspaces.length} teamspaces`)

    return {
      success: true,
      data: teamspaces,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getTeamspaces ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get teamspaces: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Create a new folder
 * @param {Object} params - Request parameters
 * @param {string} params.folderPath - Full path of the folder to create (e.g., '/Projects/NewProject' or 'NewFolder')
 * @returns {RequestResponse}
 */
export function createFolder(params: { folderPath: string }): RequestResponse {
  try {
    logDebug(pluginJson, `createFolder: Creating folder="${params.folderPath}"`)

    if (!params.folderPath || !params.folderPath.trim()) {
      return {
        success: false,
        message: 'Folder path is required',
        data: null,
      }
    }

    const folderPath = params.folderPath.trim()

    // Check if folder already exists
    const existingFolders = DataStore.folders || []
    if (existingFolders.includes(folderPath)) {
      logDebug(pluginJson, `createFolder: Folder already exists: "${folderPath}"`)
      return {
        success: true,
        message: 'Folder already exists',
        data: folderPath,
      }
    }

    // Create the folder
    DataStore.createFolder(folderPath)

    logDebug(pluginJson, `createFolder: Successfully created folder: "${folderPath}"`)

    return {
      success: true,
      data: folderPath,
    }
  } catch (error) {
    logError(pluginJson, `createFolder: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to create folder: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Create a new note
 * @param {Object} params - Request parameters
 * @param {string} params.noteTitle - Title of the new note
 * @param {string} params.folder - Folder path to create the note in (default: '/')
 * @returns {RequestResponse}
 */
export function createNote(params: { noteTitle: string, folder?: string }): RequestResponse {
  const startTime: number = Date.now()
  try {
    const { noteTitle, folder = '/' } = params

    if (!noteTitle || !noteTitle.trim()) {
      return {
        success: false,
        message: 'Note title is required',
        data: null,
      }
    }

    logDebug(pluginJson, `[DIAG] createNote START: noteTitle="${noteTitle}", folder="${folder}"`)

    // Create the note using DataStore.newNote
    const filename = DataStore.newNote(noteTitle.trim(), folder)

    if (filename) {
      const totalElapsed: number = Date.now() - startTime
      logDebug(pluginJson, `[DIAG] createNote COMPLETE: totalElapsed=${totalElapsed}ms, filename="${filename}"`)
      return {
        success: true,
        data: filename,
      }
    } else {
      const totalElapsed: number = Date.now() - startTime
      logError(pluginJson, `[DIAG] createNote ERROR: totalElapsed=${totalElapsed}ms, DataStore.newNote returned null`)
      return {
        success: false,
        message: 'Failed to create note: DataStore.newNote returned null',
        data: null,
      }
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] createNote ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to create note: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Get headings from a note
 * @param {Object} params - Request parameters
 * @param {string} params.noteFilename - Filename of the note to get headings from
 * @param {boolean} params.optionAddTopAndBottom - Whether to add "top of note" and "bottom of note" options (default: true)
 * @param {boolean} params.includeArchive - Whether to include headings in Archive section (default: false)
 * @returns {RequestResponse}
 */
export function getHeadings(params: { noteFilename: string, optionAddTopAndBottom?: boolean, includeArchive?: boolean }): RequestResponse {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[DIAG] getHeadings START: noteFilename="${params.noteFilename}"`)

    if (!params.noteFilename) {
      return {
        success: false,
        message: 'Note filename is required',
        data: null,
      }
    }

    // Get the note by filename
    const note = getNoteByFilename(params.noteFilename)
    if (!note) {
      return {
        success: false,
        message: `Note not found: ${params.noteFilename}`,
        data: null,
      }
    }

    // Get headings from the note
    const optionAddTopAndBottom = params.optionAddTopAndBottom ?? true
    const includeArchive = params.includeArchive ?? false
    const headings = getHeadingsFromNote(note, false, optionAddTopAndBottom, false, includeArchive)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[DIAG] getHeadings COMPLETE: totalElapsed=${totalElapsed}ms, found=${headings.length} headings`)

    return {
      success: true,
      data: headings,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[DIAG] getHeadings ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get headings: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Handler for createProcessingTemplate request
 * @param {Object} params - Request parameters (formTemplateTitle, formTemplateFilename, etc.)
 * @returns {Promise<RequestResponse>}
 */
async function handleCreateProcessingTemplate(params: Object): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleCreateProcessingTemplate: params=${JSON.stringify(params)}`)

    const options = {
      formTemplateTitle: params.formTemplateTitle,
      formTemplateFilename: params.formTemplateFilename,
      suggestedProcessingTitle: params.suggestedProcessingTitle,
      formLaunchLink: params.formLaunchLink,
      formEditLink: params.formEditLink,
    }

    const result = await createProcessingTemplate(options)

    if (result && result.processingTitle) {
      // Bring the Form Builder window back to the front
      focusHTMLWindowIfAvailable(FORMBUILDER_WINDOW_ID)

      const processingTitle = result.processingTitle || ''
      return {
        success: true,
        message: `Processing template "${processingTitle}" created successfully`,
        data: {
          processingTitle: processingTitle,
          processingFilename: result.processingFilename,
        },
      }
    } else {
      return {
        success: false,
        message: 'Processing template creation was cancelled or failed',
        data: null,
      }
    }
  } catch (error) {
    logError(pluginJson, `handleCreateProcessingTemplate: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to create processing template: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Handle opening a note file in NotePlan Editor
 * @param {Object} params - Request parameters
 * @param {string} params.filename - The filename of the note to open
 * @returns {RequestResponse}
 */
function handleOpenNote(params: { filename?: string }): RequestResponse {
  try {
    const filename = params?.filename
    if (!filename) {
      return {
        success: false,
        message: 'Filename is required',
        data: null,
      }
    }

    Editor.openNoteByFilename(filename)

    return {
      success: true,
      message: `Opened note: ${filename}`,
      data: filename,
    }
  } catch (error) {
    logError(pluginJson, `handleOpenNote: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to open note: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Handle copy form URL request - copies launchLink to clipboard
 * @param {Object} params - Request parameters
 * @param {string} params.launchLink - The launchLink URL to copy
 * @returns {RequestResponse}
 */
function handleCopyFormUrl(params: { launchLink?: string }): RequestResponse {
  try {
    const { launchLink } = params
    logDebug(pluginJson, `handleCopyFormUrl: launchLink="${String(launchLink || '')}"`)
    if (!launchLink) {
      logError(pluginJson, `handleCopyFormUrl: No launchLink provided in params`)
      return {
        success: false,
        message: 'No launchLink provided',
        data: null,
      }
    }
    // Copy to clipboard
    Clipboard.string = launchLink
    logDebug(pluginJson, `handleCopyFormUrl: Successfully copied to clipboard, Clipboard.string="${Clipboard.string}"`)
    return {
      success: true,
      message: 'Form URL copied to clipboard',
      data: { launchLink },
    }
  } catch (error) {
    logError(pluginJson, `handleCopyFormUrl: Error copying to clipboard: ${error.message || String(error)}`)
    return {
      success: false,
      message: `Failed to copy URL: ${error.message || String(error)}`,
      data: null,
    }
  }
}

/**
 * Remove empty lines from a note's content
 * Removes sequences of 2+ newlines, blank lines after frontmatter, and trailing blank lines
 * @param {any} note - The note to clean up (CoreNoteFields)
 * @returns {void}
 */
export function removeEmptyLinesFromNote(note: any): void {
  if (!note) return

  // Rebuild content from paragraphs
  const contentParts = note.paragraphs.map((p) => p.rawContent)
  let cleanedContent = contentParts.join('\n')

  // Remove all blank lines: replace any sequence of 2+ newlines with a single newline
  cleanedContent = cleanedContent.replace(/\n{2,}/g, '\n')
  // Remove blank lines immediately after frontmatter (after the closing ---)
  cleanedContent = cleanedContent.replace(/(---\n)\n+/g, '$1')
  // Remove trailing blank lines
  cleanedContent = cleanedContent.replace(/\n+$/, '')

  note.content = cleanedContent
  note.updateParagraphs(note.paragraphs)
}

/**
 * Update form links in a note's body content under "Form Details" heading
 * Uses replaceContentUnderHeading to replace or create the heading section
 * @param {CoreNoteFields} note - The note to update
 * @param {string} formTitle - The title of the form
 * @param {string} launchLink - The launch link URL
 * @param {string} formEditLink - The form edit link URL
 * @param {string} processingTemplateLink - Optional processing template link URL
 * @returns {Promise<void>}
 */
export async function updateFormLinksInNote(
  note: any, // CoreNoteFields - note object with paragraphs and frontmatter
  formTitle: string,
  launchLink: string,
  formEditLink: string,
  processingTemplateLink?: string,
): Promise<void> {
  logDebug(pluginJson, `updateFormLinksInNote: [START] Called with formTitle: "${formTitle}"`)
  logDebug(pluginJson, `updateFormLinksInNote: [START] Note content before (first 30 lines):\n${(note.content || '').split('\n').slice(0, 30).join('\n')}`)
  logDebug(pluginJson, `updateFormLinksInNote: [START] Note has ${note.paragraphs.length} paragraphs`)

  const links = [`- [open form](${launchLink})`, `- [edit form](${formEditLink})`]
  if (processingTemplateLink) {
    links.push(`- [open processing template](${processingTemplateLink})`)
  }
  // Use replaceContentUnderHeading to replace or create the "Form Details" section
  // Note: The heading text includes the formTitle, but this is just for display in the body
  const markdownContent = `## Form Details - ${formTitle}:\n${links.join('\n')}`
  logDebug(pluginJson, `updateFormLinksInNote: [BEFORE] markdownContent to insert:\n${markdownContent}`)

  // Find where the frontmatter ends to insert after it
  // endOfFrontmatterLineIndex expects a note object, not just paragraphs
  const endOfFM = endOfFrontmatterLineIndex(note)
  logDebug(pluginJson, `updateFormLinksInNote: endOfFrontmatterLineIndex returned: ${endOfFM}`)

  if (endOfFM != null && endOfFM >= 0) {
    // We have frontmatter - insert after it
    const insertionIndex = endOfFM + 1
    logDebug(pluginJson, `updateFormLinksInNote: Will insert at index ${insertionIndex} (after frontmatter ending at ${endOfFM})`)

    // Check if "Form Details" heading already exists
    let headingIndex = -1
    for (let i = insertionIndex; i < note.paragraphs.length; i++) {
      const p = note.paragraphs[i]
      if (p.type === 'title' && p.content.trim().startsWith('Form Details')) {
        headingIndex = i
        break
      }
    }

    if (headingIndex >= 0) {
      // Heading exists, remove content under it first
      const { removeContentUnderHeading } = require('@helpers/NPParagraph')
      removeContentUnderHeading(note, 'Form Details', false, false)
      // Re-find the heading after removal
      for (let i = insertionIndex; i < note.paragraphs.length; i++) {
        const p = note.paragraphs[i]
        if (p.type === 'title' && p.content.trim().startsWith('Form Details')) {
          headingIndex = i
          break
        }
      }
      // Insert content after the heading
      note.insertParagraph(links.join('\n'), headingIndex + 1, 'text')
    } else {
      // Heading doesn't exist, insert heading and content
      // Use insertHeading with headingLevel 2 for ## heading
      note.insertHeading(`Form Details - ${formTitle}:`, insertionIndex, 2)
      note.insertParagraph(links.join('\n'), insertionIndex + 1, 'text')
    }
  } else {
    // No frontmatter, use the standard method
    logDebug(pluginJson, `updateFormLinksInNote: No frontmatter found, using replaceContentUnderHeading`)
    await replaceContentUnderHeading(note, 'Form Details', markdownContent, false, 2)
  }

  logDebug(pluginJson, `updateFormLinksInNote: [AFTER] Note content after (first 30 lines):\n${(note.content || '').split('\n').slice(0, 30).join('\n')}`)
  logDebug(pluginJson, `updateFormLinksInNote: [AFTER] Note has ${note.paragraphs.length} paragraphs`)
}

/**
 * Handle duplicate form request - creates a copy of the form with a new name
 * @param {Object} params - Request parameters
 * @param {string} params.templateFilename - The current form template filename
 * @param {string} params.templateTitle - The current form template title
 * @param {string} params.receivingTemplateTitle - The receiving template title (if any)
 * @returns {Promise<RequestResponse>}
 */
async function handleDuplicateForm(params: { templateFilename?: string, templateTitle?: string, receivingTemplateTitle?: string }): Promise<RequestResponse> {
  try {
    const { templateFilename, templateTitle, receivingTemplateTitle } = params
    if (!templateFilename || !templateTitle) {
      return {
        success: false,
        message: 'Template filename and title are required',
        data: null,
      }
    }

    // Prompt for new name (suggest current name + " copy")
    const suggestedName = `${templateTitle} copy`
    const newTitle = await CommandBar.textPrompt('Duplicate Form', 'Enter new form title:', suggestedName)
    if (!newTitle || typeof newTitle === 'boolean') {
      return {
        success: false,
        message: 'Duplicate cancelled',
        data: null,
      }
    }

    // Read the current form template
    const sourceNote = await getNoteByFilename(templateFilename)
    if (!sourceNote) {
      return {
        success: false,
        message: `Could not find source form template: ${templateFilename}`,
        data: null,
      }
    }

    // Get folder from source template (use same folder as original, not a subfolder)
    const sourceFolder = getFolderFromFilename(templateFilename) || '@Forms'

    // Read all codeblocks from source
    const formFields = await loadCodeBlockFromNote<Array<Object>>(sourceNote, 'formfields', pluginJson.id, parseObjectString)
    const templateBody = await loadTemplateBodyFromTemplate(sourceNote)
    const templateRunnerArgs = await loadTemplateRunnerArgsFromTemplate(sourceNote)

    // Create new note with empty content (updateFormLinksInNote will add the heading and links)
    const newNoteContent = ''

    // Create new note in the same folder as the original (not inside the original's folder)
    const newFilename = DataStore.newNoteWithContent(newNoteContent, sourceFolder, `${newTitle}.md`)
    if (!newFilename) {
      return {
        success: false,
        message: `Failed to create duplicate form "${newTitle}"`,
        data: null,
      }
    }

    const newNote = await getNoteByFilename(newFilename)
    if (!newNote) {
      return {
        success: false,
        message: `Created duplicate form but could not open it: ${newFilename}`,
        data: null,
      }
    }

    // Update cache immediately after getting the note to ensure it's available
    const cachedNote = DataStore.updateCache(newNote, true)
    if (cachedNote) {
      logDebug(pluginJson, `handleDuplicateForm: Updated cache for newly created note "${newTitle}"`)
    }

    // Copy frontmatter using frontmatterAttributesArray to preserve order and all fields
    const sourceFrontmatterArray = sourceNote.frontmatterAttributesArray || []
    const encodedNewTitle = encodeURIComponent(newTitle)
    const newLaunchLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Open%20Template%20Form&arg0=${encodedNewTitle}`
    const newFormEditLink = `noteplan://x-callback-url/runPlugin?pluginID=dwertheimer.Forms&command=Form%20Builder/Editor&arg0=${encodedNewTitle}`

    // Prepare frontmatter for new note copy all fields from source, updating title-related ones
    const newFrontmatter: { [string]: string } = {}
    const fieldsToUpdate = {
      type: 'template-form',
      windowTitle: newTitle,
      formTitle: newTitle,
      launchLink: newLaunchLink,
      formEditLink: newFormEditLink,
    }

    // Copy all frontmatter fields from source, preserving order
    for (const attr of sourceFrontmatterArray) {
      const key = attr.key
      // Skip title-related fields that we'll update
      if (!['type', 'windowTitle', 'formTitle', 'launchLink', 'formEditLink', 'title'].includes(key)) {
        newFrontmatter[key] = attr.value
      }
    }

    // Add/update the title-related fields
    Object.assign(newFrontmatter, fieldsToUpdate)

    // Update frontmatter - ensure frontmatter exists first
    ensureFrontmatter(newNote, true, newTitle)
    updateFrontMatterVars(newNote, newFrontmatter)

    // Update markdown links in body using replaceContentUnderHeading (works better than manual insertion)
    await updateFormLinksInNote(newNote, newTitle, newLaunchLink, newFormEditLink)

    // Copy codeblocks (these will be added after the heading)
    if (formFields && Array.isArray(formFields) && formFields.length > 0) {
      await saveCodeBlockToNote(newFilename, 'formfields', formFields, pluginJson.id, formatFormFieldsAsCodeBlock, false)
    }
    if (templateBody) {
      await saveCodeBlockToNote(newFilename, 'template:ignore templateBody', templateBody, pluginJson.id, null, false)
    }
    if (templateRunnerArgs) {
      await saveCodeBlockToNote(newFilename, 'template:ignore templateRunnerArgs', templateRunnerArgs, pluginJson.id, (obj) => JSON.stringify(obj, null, 2), false)
    }

    // Reload note after code blocks are saved to get latest content
    const noteAfterCodeBlocks = await getNoteByFilename(newFilename)
    if (noteAfterCodeBlocks) {
      // Update cache after code blocks are saved
      DataStore.updateCache(noteAfterCodeBlocks, true)
    }

    // Clean up: remove any duplicate title text and extra blank lines
    const finalNote = await getNoteByFilename(newFilename)
    if (finalNote) {
      // Remove text paragraphs that are just the title (duplicates)
      const titleText = newTitle.trim()
      const cleanedParas = finalNote.paragraphs.filter((p) => {
        // Keep frontmatter separators
        if (p.type === 'separator') return true
        // Remove text paragraphs that match the title exactly (these are unwanted duplicates)
        if (p.type === 'text' && p.content.trim() === titleText) return false
        return true
      })

      // Rebuild content without the duplicate title
      const contentParts = cleanedParas.map((p) => p.rawContent)
      finalNote.content = contentParts.join('\n')
      finalNote.updateParagraphs(finalNote.paragraphs)

      // Remove empty lines
      removeEmptyLinesFromNote(finalNote)

      // Update cache to ensure the note is available in DataStore.projectNotes
      // This is critical for getFormTemplateList() to find the newly created form
      const updatedNote = DataStore.updateCache(finalNote, true)
      if (updatedNote) {
        logDebug(pluginJson, `handleDuplicateForm: Updated cache for note "${newTitle}"`)
      } else {
        logWarn(pluginJson, `handleDuplicateForm: Failed to update cache for note "${newTitle}"`)
      }
    }

    // Wait for the note to be available in getFormTemplateList() before trying to open it
    // This handles race conditions where the note was created but not yet in DataStore.projectNotes
    logDebug(pluginJson, `handleDuplicateForm: Waiting for note "${newTitle}" to be available in cache...`)
    const noteAvailable = await waitForCondition(
      () => {
        const options = getFormTemplateList()
        const found = options.find((option) => option.label === newTitle)
        if (found) {
          logDebug(pluginJson, `handleDuplicateForm: Note "${newTitle}" is now available in cache`)
          return true
        }
        return false
      },
      { maxWaitMs: 3000, checkIntervalMs: 100 },
    )

    if (!noteAvailable) {
      logWarn(pluginJson, `handleDuplicateForm: Note "${newTitle}" not found in cache after waiting, but will try to open anyway`)
    }

    // If there's a receiving template, duplicate it too
    let newReceivingTemplateTitle = ''
    if (receivingTemplateTitle) {
      const receivingNote = await getNoteByFilename(receivingTemplateTitle)
      if (receivingNote) {
        // Create duplicate receiving template
        const receivingFolder = getFolderFromFilename(receivingTemplateTitle) || sourceFolder
        const newReceivingTitle = `${receivingTemplateTitle} copy`
        const newReceivingContent = receivingNote.content || ''
        const newReceivingFilename = DataStore.newNoteWithContent(newReceivingContent, receivingFolder, `${newReceivingTitle}.md`)
        if (newReceivingFilename) {
          const newReceivingNote = await getNoteByFilename(newReceivingFilename)
          if (newReceivingNote) {
            // Copy frontmatter from receiving template
            const receivingFrontmatter = receivingNote.frontmatterAttributes || {}
            const newReceivingFrontmatter: { [string]: string } = {}
            Object.keys(receivingFrontmatter).forEach((key) => {
              if (key !== 'title') {
                newReceivingFrontmatter[key] = String(receivingFrontmatter[key])
              }
            })
            updateFrontMatterVars(newReceivingNote, newReceivingFrontmatter)
            newReceivingTemplateTitle = newReceivingTitle

            // Update the form's receivingTemplateTitle
            updateFrontMatterVars(newNote, { receivingTemplateTitle: newReceivingTemplateTitle })
          }
        }
      }
    }

    // Open the new form in the Form Builder
    await openFormBuilder(newTitle)

    return {
      success: true,
      message: `Form "${newTitle}" duplicated successfully`,
      data: {
        newTemplateFilename: newFilename,
        newTemplateTitle: newTitle,
        newReceivingTemplateTitle: newReceivingTemplateTitle || undefined,
      },
    }
  } catch (error) {
    logError(pluginJson, `handleDuplicateForm: Error: ${error.message}`)
    return {
      success: false,
      message: `Failed to duplicate form: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Router function to handle requests from React
 * @param {string} requestType - The type of request (e.g., 'getFolders', 'getNotes', 'createFolder')
 * @param {Object} params - Request parameters
 * @returns {Promise<RequestResponse>}
 */
export async function handleRequest(requestType: string, params: Object = {}): Promise<RequestResponse> {
  try {
    logDebug(pluginJson, `handleRequest: requestType="${requestType}", params=${JSON.stringify(params)}`)

    switch (requestType) {
      case 'getFolders':
        return getFolders(params)
      case 'getNotes':
        return getNotes(params)
      case 'getTeamspaces':
        return getTeamspaces(params)
      case 'createFolder':
        return createFolder(params)
      case 'getHeadings':
        return getHeadings(params)
      case 'createNote':
        return createNote(params)
      case 'createProcessingTemplate':
        return await handleCreateProcessingTemplate(params)
      case 'openNote':
        return handleOpenNote(params)
      case 'copyFormUrl':
        return handleCopyFormUrl(params)
      case 'duplicateForm':
        return await handleDuplicateForm(params)
      default:
        logError(pluginJson, `handleRequest: Unknown request type: "${requestType}"`)
        return {
          success: false,
          message: `Unknown request type: "${requestType}"`,
          data: null,
        }
    }
  } catch (error) {
    logError(pluginJson, `handleRequest: Error handling request "${requestType}": ${error.message}`)
    return {
      success: false,
      message: `Error handling request: ${error.message}`,
      data: null,
    }
  }
}
