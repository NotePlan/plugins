// @flow

import { clo, JSP, logDebug, logError, logInfo, logWarn } from './dev'
import { getFolderFromFilename } from './folders'
import { getNoteTitleFromTemplate } from './NPFrontMatter'
import { getSelectedParagraphsWithCorrectLineIndex, highlightParagraphInEditor } from './NPParagraph'
import { usersVersionHas } from './NPVersions'
import { showMessageYesNo, showMessage, chooseFolder } from './userInput'

/**
 * Run Editor.save() if active Editor is dirty and needs saving
 * Does nothing if Editor and Editor.note are the same (has been saved)
 * If they don't match, it saves
 * @usage await saveEditorIfNecessary()
 * @dwertheimer sometimes found that calling Editor.save() on a note which didn't need saving would crash the plugin
 */
export async function saveEditorIfNecessary() {
  if (!Editor?.note) {
    logDebug('saveEditorIfNecessary', 'We are not in the Editor; Nothing to do.')
    return
  }
  if (Editor.note?.content !== Editor.content) {
    logDebug('saveEditorIfNecessary', 'Editor.note?.content !== Editor.content; Saving Editor')
    try {
      await Editor.save() // ensure recent/unsaved changes get saved first
    } catch (error) {
      logError('saveEditorIfNecessary', `Error saving Editor: ${error.message}`)
      throw error
    }
  }
}

/**
 * Check if Editor has no content or just contains "#" or "# "
 * @usage const isEmpty = editorIsEmpty()
 * @returns {boolean} true if Editor is empty or contains only "#" variations
 */
export function editorIsEmpty(_note: TNote | TEditor = Editor): boolean {
  const note: TNote = (_note: any).note || _note
  if (!note?.content || typeof note.content !== 'string') return true

  const content = note.content.trim()
  return content === '' || content === '#' || content === '# '
}

/**
 * Check if a note is freshly created (blank note, fresh note, untitled note, with no content)
 * - has no content (could have frontmatter, like "order")
 * - regular notes: filename matches the pattern of a brand new note with timestamp
 * - teamspace notes: title is "Untitled"
 * Pattern: "New Note - [numbers].[numbers].(md|txt)" after the last slash
 * @param {string} filename - The filename to check
 * @returns {boolean} true if the filename matches the brand new note pattern
 * @usage const isNew = isBrandNewFilename('folder/New Note - 55.2810.md')
 */
export function isBrandNewNote(note: TNote | TEditor): boolean {
  const contentsIsBlank = editorIsEmpty(note) // it may have frontmatter
  if (!contentsIsBlank) return false
  const filename = note?.filename
  if (!filename || typeof filename !== 'string') return false

  // Extract the filename part after the last slash
  const lastSlashIndex = filename.lastIndexOf('/')
  const filenameOnly = lastSlashIndex >= 0 ? filename.substring(lastSlashIndex + 1) : filename
  let passesPattern = false
  if (note.isTeamspaceNote) {
    passesPattern = note.title === 'Untitled'
  } else {
    // Regex pattern: "[defaultNewNoteName] - " followed by numbers, dot, numbers, and .md or .txt extension
    // Use DataStore.defaultNewNoteName to handle localized versions of "New Note"
    const newNoteName = DataStore.defaultNewNoteName ?? 'New Note'
    const escapedName = newNoteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters
    const brandNewPattern = new RegExp(`^${escapedName} - \\d+\\.\\d+\\.(md|txt)$`, 'i')
    passesPattern = brandNewPattern.test(filenameOnly)
  }
  logDebug(`isBrandNewNote: contentsIsBlank:${String(contentsIsBlank)} filename:${filename} title:${note?.title || ''} isABrandNewNote:${String(passesPattern)}`)
  return passesPattern
}

/**
 * Empty Note Button processing:
 * If template has a folder attribute, a new note is created using templateNew and the empty note is moved to the trash
 * If template has a newNoteTitle attribute, a new note is created using templateNew and the empty note is moved to the trash
 * If template has neither, the note is not moved to the trash and the template is rendered
 *
 * Check if the template wants the note to be created in a folder and if so, move the empty note to the trash and create a new note in the folder
 * @param {*} frontmatterAttributes
 * @returns {boolean} whether to stop execution (true) or continue (false)
 */
export async function checkAndProcessFolderAndNewNoteTitle(templateNote: TNote, frontmatterAttributes: Object): Promise<boolean> {
  logDebug(
    `checkAndProcessFolderAndNewNoteTitle Checks for and deals with using the insert button on an empty template when the template has a folder or new note title and the file should be renamed or moved`,
  )
  logDebug(`checkAndProcessFolderAndNewNoteTitle starting: templateNote:"${templateNote?.title || ''}", frontmatterAttributes:${JSON.stringify(frontmatterAttributes)}`)
  // Check if the template wants the note to be created in a folder and if so, move the empty note to the trash and create a new note in the folder
  const isEditorEmpty = editorIsEmpty()
  let theFolder = frontmatterAttributes?.folder?.trim() || ''

  // Use the rendered frontmatter attributes first, then fall back to template analysis
  const renderedNewNoteTitle = frontmatterAttributes?.newNoteTitle?.trim()
  logDebug(
    `checkAndProcessFolderAndNewNoteTitle; Editor.filename:"${Editor.filename}" Editor.title:"${Editor.title || ''}" isEditorEmpty:${String(
      isEditorEmpty,
    )} folder in template fm:"${theFolder}"; rendered frontmatterAttributes.newNoteTitle: "${renderedNewNoteTitle}"`,
  )

  // For inline title detection, we need to use the original template data
  // But we'll only use this for determining if we should create a new note
  // The actual title extraction will happen in templateNew after rendering
  const templateNoteTitle = getNoteTitleFromTemplate(templateNote?.content || '')
  logDebug(`checkAndProcessFolderAndNewNoteTitle: templateNoteTitle from getNoteTitleFromTemplate: "${templateNoteTitle}"`)

  // We need to determine if there's a title, but we won't pass the unrendered title to templateNew
  const hasTitle = renderedNewNoteTitle || templateNoteTitle

  logDebug(`checkAndProcessFolderAndNewNoteTitle: folder:"${theFolder}" hasTitle:${hasTitle} isBrandNewNote:${String(isBrandNewNote(Editor))}`)
  if (!isBrandNewNote(Editor)) {
    logDebug(`checkAndProcessFolderAndNewNoteTitle: hasTitle:${hasTitle} isBrandNewNote:${String(isBrandNewNote(Editor))} so continuing on with standard template rendering`)
    return false
  }
  // FIXME: I am here. This or may be incorrect - need to test
  if (theFolder.length > 0 || hasTitle) {
    if (isEditorEmpty) {
      logDebug(
        `checkAndProcessFolderAndNewNoteTitle: template has folder:"${theFolder}", hasTitle:${hasTitle}, so moving empty note to trash and creating a new note in the folder`,
      )
      // invoke the template with the folder attribute
      const emptyNoteFilename = Editor.filename
      const templateTitle = templateNote?.title
      const folderToUse = theFolder.length > 0 ? theFolder : getFolderFromFilename(Editor.filename)
      // Don't pass the unrendered title - let templateNew extract it from rendered content
      const argsArray = [templateTitle, folderToUse === '/' ? '' : folderToUse, '', frontmatterAttributes]
      logDebug(`checkAndProcessFolderAndNewNoteTitle: invoking templateNew because theFolder:"${theFolder}" hasTitle:${hasTitle} with argsArray:${JSON.stringify(argsArray)}`)
      await DataStore.invokePluginCommandByName('templateNew', 'np.Templating', argsArray)
      // move the empty note to the trash
      // await DataStore.moveNote(emptyNoteFilename, '@Trash')
      await DataStore.trashNote(emptyNoteFilename)
      return true
    } else if (theFolder.length > 0) {
      if (!Editor.filename.startsWith(theFolder)) {
        const isChooseFolder = /<select|<choose/i.test(theFolder)
        let res = 'Yes'
        if (!isChooseFolder) {
          res = await showMessageYesNo(
            `The template has a folder property (folder: "${theFolder}"). Should we move the current note to the folder "${theFolder}"?`,
            ['Yes', 'No'],
            'Move this Note?',
          )
        }
        logDebug(`checkAndProcessFolderAndNewNoteTitle: move folder?:${res} isChooseFolder:${String(isChooseFolder)}`)
        if (res === 'Yes') {
          if (isChooseFolder) {
            // TODO: deal with startFolder inside the <choose> tag
            const folder = await chooseFolder()
            if (folder) {
              theFolder = folder
            }
          }
          const newFilename = DataStore.moveNote(Editor.filename, theFolder)
          if (newFilename) {
            // This message is actually necessary to kill time while the move happens because the move is not async
            // And we can't actually open the note until after 1s-ish
            await showMessage(`Note moved to folder "${theFolder}"`)
            await Editor.openNoteByFilename(newFilename)
            logDebug(`checkAndProcessFolderAndNewNoteTitle: note moved to folder "${theFolder}"`)
          } else {
            logDebug(`checkAndProcessFolderAndNewNoteTitle: note ${Editor.filename} failed to move to folder "${theFolder}"`)
            await showMessage(`Was unable to move note ${Editor.filename} to folder "${theFolder}"`)
          }
        }
      }
    }
  }
  logDebug(`checkAndProcessFolderAndNewNoteTitle: no folder or new note title, so continuing on with standard template rendering`)
  return false
}

/**
 * Get the selected paragraphs, handling version differences and frontmatter issues.
 * @returns {Array<TParagraph>} Selected paragraphs with correct line indices
 */
export function getSelectedParagraphsToUse(): Array<TParagraph> {
  try {
    // First check Editor is active
    const { note, content, selectedParagraphs, selection } = Editor
    if (content == null || selectedParagraphs == null || note == null) {
      // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
      logWarn('getSelectedParagraphsToUse', 'No note open, so stopping.')
      return []
    }
    // Get current selection, and its range
    if (selection == null) {
      // Really a belt-and-braces check that the editor is active
      logError('getSelectedParagraphsToUse', 'No selection found, so stopping.')
      return []
    }

    if (usersVersionHas('settableLineIndex')) {
      // v3: use getSelectedParagraphsWithCorrectLineIndex() instead, which is settable from v3.19.2 (build 1440 onwards), to help deal with the issue mentioned above.
      return getSelectedParagraphsWithCorrectLineIndex()
    } else {
    // v2: use Editor.selectedParagraphs instead
      if (!Editor.selectedParagraphs) return []
      return Editor.selectedParagraphs.map((p) => Editor.paragraphs[p.lineIndex]).filter(Boolean)
    }
  } catch (error) {
    logError('getSelectedParagraphsToUse', error.message)
    return []
  }
}

/**
 * Clear any highlighting in the editor.
 */
export function clearHighlighting(): void {
  // Get current selection, and its range
  const { selection } = Editor
  if (selection == null) {
    const emptyRange = Range.create(0, 0)
    Editor.highlightByRange(emptyRange)
  } else {
    const currentStart = selection.start
    const thisRange = Range.create(currentStart, currentStart)
    Editor.highlightByRange(thisRange)
  }
}

/**
 * Deprecated: use isNoteOpenInEditor() instead.
 * Tests whether the provided filename is open in an Editor window/split.
 * @author @jgclark
 * @param {string} filename
 * @returns {boolean}
 */
export function noteOpenInEditor(filename: string): boolean {
  const allEditorWindows = NotePlan.editors
  for (const thisEditorWindow of allEditorWindows) {
    if (thisEditorWindow.filename === filename) {
      return true
    }
  }
  return false
}

/**
 * Tests whether the provided filename is open in an Editor window/split.
 * Note: this is a newer name for the function noteOpenInEditor(), which is now deprecated.
 * @author @jgclark
 * @param {string} filename
 * @returns {boolean}
 */
export function isNoteOpenInEditor(filename: string): boolean {
  const allEditorWindows = NotePlan.editors
  for (const thisEditorWindow of allEditorWindows) {
    if (thisEditorWindow.filename === filename) {
      return true
    }
  }
  return false
}

/**
 * Returns the first open Editor window that matches a given filename (if any).
 * If 'getLastOpenEditor' is true, then return the last matching open Editor window (which is the most recently opened one) instead.
 * @author @jgclark
 * @param {string} openNoteFilename to find in list of open Editor windows
 * @param {boolean} getLastOpenEditor - whether to return the last open Editor window (which is the most recently opened one) instead of the first one that matches the filename (the default)
 * @returns {TEditor | false} the matching open Editor window or false if not found
 */
export function getOpenEditorFromFilename(openNoteFilename: string, getLastOpenEditor: boolean = false): TEditor | false {
  const allEditorWindows = NotePlan.editors
  const matchingEditorWindows = allEditorWindows.filter(ew => ew.filename === openNoteFilename)
  if (matchingEditorWindows.length === 0) {
    logDebug('getOpenEditorFromFilename', `No open Editor window found for filename '${openNoteFilename}'`)
    return false
  }
  if (getLastOpenEditor) {
    return matchingEditorWindows[matchingEditorWindows.length - 1]
  }
  return matchingEditorWindows[0]
}

/**
 * Show an existing note in an Editor window, identified by its filename.
 * Uses smart features to determine which window or split view to open the note in:
 * - If already open in another window or split, simply focuses it.
 * - If not open, opens it in a new split view.
 * Returns true if successful, false otherwise.
 * Note: only designed for macOS, but may work in a limited way on other platforms.
 * Note: Prefer the showLine... variant of this (below) where possible.
 * @param {string} filename - the filename of the note to open
 * @param {string} newWindowType - the type of window to open the note in ('window' or 'split') if not already open
 * @returns {boolean} success?
 */
export async function smartOpenNoteInEditorFromFilename(filename: string, newWindowType: 'window' | 'split' = 'window'): Promise<boolean> {
  try {
    if (!filename) throw 'No filename: stopping.'

    const thisEditor = await getOrOpenEditorFromFilename(filename, newWindowType)
    if (thisEditor) {
      thisEditor.focus()
      logDebug('smartOpenNoteInEditorFromFilename', `Focused Editor window '${thisEditor.id}' for filename '${filename}'`)
      return true
    }
    return false
  } catch (error) {
    logError('smartOpenNoteInEditorFromFilename', error.message)
    return false
  }
}

/**
 * Handle a show line call by opening the note in an Editor, and then finding and moving the cursor to the start of that line.
 * If the note isn't already open, then open in a new split view.
 * Note: Handles Teamspace notes from b1375 (v3.17.0).
 * @param {string} filename - the filename of the note to open
 * @param {string} content - the content of the note to open
 * @param {string} newWindowType - the type of window to open the note in ('window' or 'split') if not already open
 * @returns {boolean} success?
 */
export async function smartShowLineInEditorFromFilename(filename: string, content: string, newWindowType: 'window' | 'split' = 'window'): Promise<boolean> {
  try {
    if (!filename) throw new Error('No filename: stopping.')
    if (!content) throw new Error('No content: stopping.')

    const thisEditor = await getOrOpenEditorFromFilename(filename, newWindowType)
    if (thisEditor) {
      logDebug('smartShowLineInEditorFromFilename', `Focused Editor window '${thisEditor.id}' for filename '${filename}'`)
      // $FlowIgnore[prop-missing]
      // $FlowIgnore[incompatible-call]
      const res = highlightParagraphInEditor({ filename: filename, content: content }, true)
      if (!res) {
        logWarn('smartShowLineInEditorFromFilename', `Failed to highlight paragraph in already-open note '${filename}'`)
      }
    }
    return true
  } catch (error) {
    logError('smartShowLineInEditorFromFilename', `Error "${error.message}" for note '${filename}' and content {${content || '?'}}.`)
    return false
  }
}

/**
 * Get the open Editor that matches a given filename.  [Related: getOpenEditorFromFilename()]
 * If the original Editor is still open, then return it, otherwise open the note in a new window/split view and return the new Editor.
 * (This can be needed when you have an Editor reference, but then open other window(s), and you want to use the original Editor still.)
 * On failure, return false.
 * @param {string} filename - the filename of the note to find
 * @param {string} newWindowType - the type of window to open the note in ('window' or 'split')
 * @returns {TEditor | false} the open Editor window that matches the filename, or false if not found
 */
export async function getOrOpenEditorFromFilename(filename: string, newWindowType: 'window' | 'split' = 'window'): Promise<TEditor | false> {
  try {
    if (!filename) throw new Error('No filename passed: stopping.')
    // Find the open Editor window that matches the filename (if any)
    let thisEditor = getOpenEditorFromFilename(filename)
    if (thisEditor) {
      return thisEditor
    }

    // If not found, then try to open the note in a new window/split view and return the new Editor
    const res = await Editor.openNoteByFilename(filename, false, 0, 0, newWindowType === 'split', false)
    if (!res) throw new Error('Failed to open note in a new window/split view: stopping.')
    thisEditor = getOpenEditorFromFilename(filename)
    if (!thisEditor) throw new Error('Failed to get Editor window after trying to open Editor for filename: stopping.')
    return thisEditor
  } catch (error) {
    logError('getOrOpenEditorFromFilename', error.message)
    return false
  }
}