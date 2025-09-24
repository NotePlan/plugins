// @flow

import { logDebug } from './dev'
import { showMessageYesNo, showMessage, chooseFolder } from './userInput'
import { getNoteTitleFromTemplate, getNoteTitleFromRenderedContent } from './NPFrontMatter'
import { getFolderFromFilename } from '@helpers/folders'

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
    await Editor.save() // ensure recent/unsaved changes get saved first
  }
}

/**
 * Check if Editor has no content or just contains "#", "# ", or "# \n"
 * @usage const isEmpty = editorIsEmpty()
 * @returns {boolean} true if Editor is empty or contains only "#" variations
 */
export function editorIsEmpty(_note: TNote | TEditor = Editor): boolean {
  const note = _note.note || _note
  if (!note?.content) return true

  const content = note.content.trim()
  return content === '' || content === '#' || content === '# ' || content === '# \n'
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
    // Regex pattern: "New Note - " followed by numbers, dot, numbers, and .md or .txt extension
    const brandNewPattern = /^New Note - \d+\.\d+\.(md|txt)$/i
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
