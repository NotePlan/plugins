// @ flow
//------------------------------------------------------------------
// @dwertheimer based on @jgclark's newNote
// Create new note from currently selected text
// and (optionally) leave backlink to it where selection was
import {
  showMessage,
  showMessageYesNo,
  noteOpener,
  getUniqueNoteTitle,
  chooseFolder,
} from './helpers'

export async function newNoteFromSelection() {
  const version = `0.4.0`
  console.log(`Running v${version}`)
  const { selectedLinesText, selectedText, selectedParagraphs } = Editor
  console.log(
    `\nnewNoteFromSelection (running v${version}) ${selectedParagraphs.length} selected:`,
  )

  if (selectedLinesText.length && selectedText !== '') {
    // Get title for this note
    console.log(
      `\t1st Para Type = ${selectedParagraphs[0].type} = "${selectedParagraphs[0].content}"`,
    )

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
        selectedLinesText.shift()
      }
    }
    const movedText = selectedLinesText.join('\n')
    const uniqueTitle = getUniqueNoteTitle(title)
    if (title !== uniqueTitle) {
      await showMessage(`Title exists. Using "${uniqueTitle}" instead`)
      title = uniqueTitle
    }
    const currentFolder = await chooseFolder('Select folder to add note in:')

    if (title) {
      // Create new note in the specific folder
      const origFile = Editor.note.title || Editor.note.filename // Calendar notes have no title
      // const origFileType = Editor.note.type //either "Notes" or "Calendar"
      console.log(`\torigFile:${origFile}`)
      const filename = (await DataStore.newNote(title, currentFolder)) ?? ''
      console.log(`\tnewNote returned Filename:${filename}`)

      const fullPath = `${
        currentFolder !== '/' ? `${currentFolder}/` : ''
      }${filename}`

      // This question needs to be here after newNote and before noteOpener
      // to force a cache refresh after newNote. This API bug will eventually be fixed.
      const iblq = await CommandBar.showOptions(
        ['Yes', 'No'],
        'Insert link to new file where selection was?',
      )

      const newNote = await noteOpener(fullPath, 'no leading slash')

      if (newNote) {
        console.log(`\tnewNote=${newNote}\n\t${newNote.title}`)
        console.log(`\tcontent=${newNote.content}`)

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
          newNote.appendParagraph(`^^^ Moved from [[${origFile}]]:`, 'text')
        }
        if (
          (await showMessageYesNo('New Note created. Open it now?')) === 'Yes'
        ) {
          await Editor.openNoteByFilename(fullPath)
        }
      } else {
        console.log(`\tCould not open file: "${fullPath}"`)
        showMessage(`\tCould not open file ${fullPath}`)
      }
    } else {
      console.log('\tError: undefined or empty title')
    }
  } else {
    showMessage('No text was selected. Nothing to do.', "OK, I'll try again!")
  }
  console.log('\nnewNoteFromSelection (finished)')
}
globalThis.newNoteFromSelection = newNoteFromSelection
