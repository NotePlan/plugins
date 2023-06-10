// @flow
//-----------------------------------------------------------------------------
// @dwertheimer based on @jgclark's newNote
// Create new note from currently selected text
// and (optionally) leave backlink to it where selection was
// Last updated 10.6.2023 for 1.1.1, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { getUniqueNoteTitle, noteOpener } from '@helpers/note'
import { chooseFolder, getInput, showMessage, showMessageYesNo } from '@helpers/userInput'

/**
 * Create new note from the clipboard contents.
 * @author @jgclark
 */
export async function newNoteFromClipboard(): Promise<void> {
  const { string } = Clipboard

  if (string != null && string.length > 0) {
    logDebug(pluginJson, `newNoteFromClipboard() starting: have ${string.length} characters in clipboard`)

    // Get title for this note
    // Offer the first line to use, shorn of any leading # marks
    const firstLineMatches: Array<string> = string.match(/(?:---\n(?:title:\s*)?|[#\s]*)?(.*)\n/) ?? []
    const titleToOffer = firstLineMatches[1] ?? ''
    let title = await getInput('Title of new note', 'OK', 'New Note from Clipboard', titleToOffer)
    if (typeof title === 'string') {
      const uniqueTitle = getUniqueNoteTitle(title)
      if (title !== uniqueTitle) {
        await showMessage(`  Title exists. Using "${uniqueTitle}" instead`, `OK`, `New Note from Clipboard`)
        title = uniqueTitle
      }
      const currentFolder = await chooseFolder('Select folder to add note in:', false, true)  // don't include @Archive as an option, but do allow creation of a new folder
      const content = `# ${title}\n${string}`
      if (title) {
        // Create new note in the specific folder
        const filename = (await DataStore.newNoteWithContent(content, currentFolder)) ?? ''
        logDebug(pluginJson, ` -> filename: ${filename}`)

        if (await showMessageYesNo('New Note created. Open it now?', ['Yes', 'No'], `New Note from Clipboard`) === 'Yes') {
          await Editor.openNoteByFilename(filename)
        }
      } else {
        logError(pluginJson, 'Undefined or empty title')
      }
    } else {
      logWarn(pluginJson, 'The user cancelled the operation.')
    }
  } else {
    logWarn(pluginJson, 'The clipboard was empty, so nothing to do.')
    showMessage("The clipboard was empty, so there's nothing to do.", "OK, I'll try again", `New Note from Clipboard`)
  }
}

/**
 * Create new note from currently selected text and (optionally) leave backlink to it where selection was.
 * @author @dwertheimer + @jgclark
 */
export async function newNoteFromSelection(): Promise<void> {
  const { selectedLinesText, selectedText, selectedParagraphs, note } = Editor

  if (note != null && selectedLinesText.length && selectedText !== '') {
    logDebug(pluginJson, `newNoteFromSelection() starting with ${selectedParagraphs.length} selected:`)
    const selectedLinesTextToMutate = selectedLinesText.slice() // copy that we can change

    // Get title for this note
    const isTextContent = ['title', 'text'].indexOf(selectedParagraphs[0].type) >= 0
    const strippedFirstLine = selectedParagraphs[0].content
    let title = await getInput('Title of new note', 'OK', 'New Note from Selection', strippedFirstLine)
    if (typeof title === 'string') {
      // If user selected the first line, then remove it from the body content
      if (title === strippedFirstLine && isTextContent) {
        selectedLinesTextToMutate.shift()
      }
      const movedText = selectedLinesTextToMutate.join('\n')
      const uniqueTitle = getUniqueNoteTitle(title)
      if (title !== uniqueTitle) {
        await showMessage(`Title exists. Using "${uniqueTitle}" instead`, `OK`, `New Note from Selection`)
        title = uniqueTitle
      }
      const currentFolder = await chooseFolder('Select folder to add note in:', false, true)  // don't include @Archive as an option, but do allow creation of a new folder

      if (title) {
        // Create new note in the specific folder
        const origFile = displayTitle(note) // Calendar notes have no title, so need to make one
        logDebug(pluginJson, `- origFile: ${origFile}`)
        const filename = (await DataStore.newNote(title, currentFolder)) ?? ''
        logDebug(pluginJson, `- newNote() -> filename: ${filename}`)

        // This question needs to be here after newNote and before noteOpener
        // to force a cache refresh after newNote.
        // Note: This API bug has probably now been fixed.
        // TODO: I think there are better API calls to use now
        const res = await CommandBar.showOptions(['Yes', 'No'], 'Insert link to new file where selection was?')

        const newNote = await noteOpener(filename, 'using filename')

        if (newNote) {
          logDebug(pluginJson, `- newNote's title: ${String(newNote.title)}`)
          logDebug(pluginJson, `- newNote's content: ${String(newNote.content)} ...`)
          const insertBackLink = res.index === 0
          // $FlowFixMe[method-unbinding] - Flow thinks the function is being removed from the object, but it's not
          if (Editor.replaceSelectionWithText) {
            // for compatibility, make sure the function exists
            if (insertBackLink) {
              Editor.replaceSelectionWithText(`[[${title}]]`)
            } else {
              Editor.replaceSelectionWithText(``)
            }
          }

          newNote.appendParagraph(movedText, 'empty')
          if (insertBackLink) {
            newNote.appendParagraph(`^ Moved from [[${origFile}]]:`, 'text')
          }
          if ((await showMessageYesNo('New Note created. Open it now?', ['Yes', 'No'], `New Note from Selection`)) === 'Yes') {
            await Editor.openNoteByFilename(filename)
          }
        } else {
          logWarn(pluginJson, `Couldn't open new note: ${filename}`)
          showMessage(`Could not open new note ${filename}`, `OK`, `New Note from Selection`)
        }
      } else {
        logError(pluginJson, 'Undefined or empty title')
      }
    } else {
      logWarn(pluginJson, 'The user cancelled the operation.')
    }
  } else {
    logDebug(pluginJson, '- No text was selected, so nothing to do.')
    showMessage('No text was selected, so nothing to do.', "OK, I'll try again", `New Note from Selection`)
  }
}
