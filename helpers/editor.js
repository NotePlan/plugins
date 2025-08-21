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
  if (!Editor?.note) throw 'There is no active Editor.note'
  if (Editor.note?.content !== Editor.content) await Editor.save() // ensure recent/unsaved changes get saved first
}

/**
 * Check if Editor has no content or just contains "#", "# ", or "# \n"
 * @usage const isEmpty = editorIsEmpty()
 * @returns {boolean} true if Editor is empty or contains only "#" variations
 */
export function editorIsEmpty() {
  if (!Editor?.content) return true

  const content = Editor.content.trim()
  return content === '' || content === '#' || content === '# ' || content === '# \n'
}

/**
 * Check if the template wants the note to be created in a folder and if so, move the empty note to the trash and create a new note in the folder
 * @param {*} frontmatterAttributes
 * @returns {boolean} whether to stop execution (true) or continue (false)
 */
export async function checkAndProcessFolderAndNewNoteTitle(templateNote: TNote, frontmatterAttributes: Object): Promise<boolean> {
  logDebug(`checkAndProcessFolderAndNewNoteTitle starting: templateNote:"${templateNote?.title || ''}", frontmatterAttributes:${JSON.stringify(frontmatterAttributes)}`)
  // Check if the template wants the note to be created in a folder and if so, move the empty note to the trash and create a new note in the folder
  const isEditorEmpty = editorIsEmpty()
  let theFolder = frontmatterAttributes?.folder?.trim() || ''

  // Use the rendered frontmatter attributes first, then fall back to template analysis
  const renderedNewNoteTitle = frontmatterAttributes?.newNoteTitle?.trim()
  logDebug(`checkAndProcessFolderAndNewNoteTitle: rendered frontmatterAttributes.newNoteTitle: "${renderedNewNoteTitle}"`)

  // For inline title detection, we need to use the original template data
  // But we'll only use this for determining if we should create a new note
  // The actual title extraction will happen in templateNew after rendering
  const templateNoteTitle = getNoteTitleFromTemplate(templateNote?.content || '')
  logDebug(`checkAndProcessFolderAndNewNoteTitle: templateNoteTitle from getNoteTitleFromTemplate: "${templateNoteTitle}"`)

  // We need to determine if there's a title, but we won't pass the unrendered title to templateNew
  const hasTitle = renderedNewNoteTitle || templateNoteTitle

  logDebug(`checkAndProcessFolderAndNewNoteTitle starting: templateNote:"${templateNote?.title || ''}", frontmatterAttributes:${JSON.stringify(frontmatterAttributes)}`)
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
      await DataStore.invokePluginCommandByName('templateNew', 'np.Templating', argsArray)
      // move the empty note to the trash
      await DataStore.moveNote(emptyNoteFilename, '@Trash')
      return true
    } else if (theFolder.length > 0) {
      if (!Editor.filename.startsWith(theFolder)) {
        const isChooseFolder = /<select>|<choose>/i.test(theFolder)
        const res = await showMessageYesNo(
          `The template has a folder property (folder: ${theFolder}). Should we move the current note to the folder ${
            isChooseFolder ? 'the folder you select' : `"${theFolder}"`
          }?`,
          ['Yes', 'No'],
          'Move this Note?',
        )
        logDebug(`checkAndProcessFolderAndNewNoteTitle: res:${res} isChooseFolder:${String(isChooseFolder)}`)
        if (res === 'Yes') {
          if (isChooseFolder) {
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
          }
        }
      }
    }
  }
  return false
}
