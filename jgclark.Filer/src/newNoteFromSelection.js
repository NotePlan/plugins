// @flow
//-----------------------------------------------------------------------------
// @dwertheimer based on @jgclark's newNote
// Create new note from currently selected text
// and (optionally) leave backlink to it where selection was
// Last updated 12.2.2022 for 0.6.0, @jgclark
//-----------------------------------------------------------------------------

import {
  getUniqueNoteTitle,
  noteOpener,
} from '../../helpers/note'
import { displayTitle } from '../../helpers/general'
import {
  chooseFolder,
  showMessage,
  showMessageYesNo,
} from '../../helpers/userInput'

export async function newNoteFromSelection() {
  const { selectedLinesText, selectedText, selectedParagraphs, note } = Editor

  if (note != null && selectedLinesText.length && selectedText !== '') {
    console.log(`  with ${selectedParagraphs.length} selected:`)

    // Get title for this note
    const isTextContent =
      ['title', 'text', 'empty'].indexOf(selectedParagraphs[0].type) >= 0
    const strippedFirstLine = selectedParagraphs[0].content
    let title = await CommandBar.showInput(
      'Title of new note ([enter] to use text below)',
      strippedFirstLine,
    )
    // If user just hit [enter], then use the first line as suggested
    if (!title) {
      title = strippedFirstLine
      if (isTextContent) {
        // $FlowFixMe -- TODO(dwertheimer): the types don't allow you to mutate selectedLinesText 
        selectedLinesText.shift()
      }
    }
    const movedText = selectedLinesText.join('\n')
    const uniqueTitle = getUniqueNoteTitle(title)
    if (title !== uniqueTitle) {
      await showMessage(`Title exists. Using "${uniqueTitle}" instead`, `OK`, `New Note from Selection`)
      title = uniqueTitle
    }
    const currentFolder = await chooseFolder('Select folder to add note in:')

    if (title) {
      // Create new note in the specific folder
      const origFile = displayTitle(note) // Calendar notes have no title, so need to make one
      console.log(`\torigFile: ${origFile}`)
      const filename = (await DataStore.newNote(title, currentFolder)) ?? ''
      console.log(`\tnewNote() -> filename: ${filename}`)

      // This question needs to be here after newNote and before noteOpener
      // to force a cache refresh after newNote. This API bug will eventually be fixed.
      // TODO: Check if this bug has been fixed (I think it has).
      const iblq = await CommandBar.showOptions(
        ['Yes', 'No'],
        'Insert link to new file where selection was?',
      )

      const newNote = await noteOpener(filename, 'using filename')

      if (newNote) {
        console.log(`\tnewNote's title: ${String(newNote.title)}`)
        console.log(`\tnewNote's content: ${String(newNote.content)} ...`)

        const insertBackLink = iblq.index === 0
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
        if (await showMessageYesNo('New Note created. Open it now?',['Yes','No'], `New Note from Selection`) === 'Yes') {
          await Editor.openNoteByFilename(filename)
        }
      } else {
        console.log(`\tCould not open new note: ${filename}`)
        showMessage(`Could not open new note ${filename}`, `OK`, `New Note from Selection`)
      }
    } else {
      console.log('\tError: undefined or empty title')
    }
  } else {
    console.log('\tNo text was selected, so nothing to do.')
    showMessage('No text was selected, so nothing to do.', "OK, I'll try again", `New Note from Selection`)
  }
  console.log('newNoteFromSelection (finished)')
}
