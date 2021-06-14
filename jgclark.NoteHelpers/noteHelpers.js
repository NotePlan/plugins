// @flow
//--------------------------------------------------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark & Eduard Metzger
// /nns by @dwertheimer
// v0.9.2, 1.6.2021
//--------------------------------------------------------------------------------------------------------------------

// Globals
// eslint-disable-next-line no-unused-vars
const todaysDate = new Date().toISOString().slice(0, 10)
// eslint-disable-next-line no-unused-vars
const defaultTodoMarker =
  DataStore.preference('defaultTodoCharacter') !== undefined
    ? DataStore.preference('defaultTodoCharacter')
    : '*'

//------------------------------------------------------------------
// Helper functions
//------------------------------------------------------------------
function printNote(note) {
  if (note == null) {
    console.log('Note not found!')
    return
  }

  if (note.type === 'Notes') {
    console.log(
      `title: ${note.title ?? ''}\n\tfilename: ${
        note.filename ?? ''
      }\n\thashtags: ${note.hashtags?.join(',') ?? ''}\n\tmentions: ${
        note.mentions?.join(',') ?? ''
      }\n\tcreated: ${String(note.createdDate) ?? ''}\n\tchanged: ${
        String(note.changedDate) ?? ''
      }`,
    )
  } else {
    console.log(
      `date: ${String(note.createdDate) ?? ''}\n\tfilename: ${
        note.filename ?? ''
      }\n\thashtags: ${note.hashtags?.join(',') ?? ''}\n\tmentions: ${
        note.mentions?.join(',') ?? ''
      }`,
    )
  }
}

async function selectFolder() {
  if (Editor.type === 'Notes') {
    // [String] list of options, placeholder text, callback function with selection
    const folder = await CommandBar.showOptions(
      DataStore.folders,
      `Select new folder for '${Editor.title ?? ''}'`,
    )
    moveNote(folder.value)
  } else {
    console.log("\tWarning: I can't move calendar notes.")
    CommandBar.hide()
  }
}
globalThis.selectFolder = selectFolder

// Show feedback message using Command Bar (@dwertheimer)
async function showMessage(message, confirmTitle = 'OK') {
  return await CommandBar.showOptions([confirmTitle], message)
}

// Show feedback Yes/No Question via Command Bar (@dwertheimer)
async function showMessageYesNo(message, choicesArray = ['Yes', 'No']) {
  const answer = await CommandBar.showOptions(choicesArray, message)
  return choicesArray[answer.index]
}

// Find a unique note title/filename so backlinks can work properly (@dwertheimer)
function getUniqueNoteTitle(title) {
  let i = 0,
    res = [],
    newTitle = title
  while (++i === 1 || res.length > 0) {
    newTitle = i === 1 ? title : `${title} ${i}`
    res = DataStore.projectNoteByTitle(newTitle, true, false)
  }
  return newTitle
}

//------------------------------------------------------------------
// Command from Eduard to move a note to a different folder
function moveNote(selectedFolder) {
  const { title, filename } = Editor
  if (title == null || filename == null) {
    // No note open, so don't do anything.
    console.log('moveNote: warning: No note open.')
    return
  }
  console.log(`move ${title} (filename = ${filename}) to ${selectedFolder}`)

  const newFilename = DataStore.moveNote(filename, selectedFolder)

  if (newFilename != null) {
    Editor.openNoteByFilename(newFilename)
    console.log('\tmoving note was successful')
  } else {
    console.log('\tmoving note was NOT successful')
  }
}

//------------------------------------------------------------------
// Jumps the cursor to the heading of the current note that the user selects
// NB: need to update to allow this to work with sub-windows, when EM updates API
async function jumpToHeading() {
  const paras = Editor?.paragraphs
  if (paras == null) {
    // No note open
    return
  }

  const headingParas = paras.filter((p) => p.type === 'title') // = all headings, not just the top 'title'
  const headingValues = headingParas.map((p) => {
    let prefix = ''
    for (let i = 1; i < p.headingLevel; i++) {
      prefix += '    '
    }
    return prefix + p.content
  })

  // Present list of headingValues for user to choose from
  if (headingValues.length > 0) {
    const re = await CommandBar.showOptions(
      headingValues,
      'Select heading to jump to:',
    )
    Editor.highlight(headingParas[re.index])
  } else {
    console.log('Warning: No headings found in this note')
  }
}
globalThis.jumpToHeading = jumpToHeading

//------------------------------------------------------------------
// Jump cursor to the '## Done' heading in the current file
// NB: need to update to allow this to work with sub-windows, when EM updates API
function jumpToDone() {
  const paras = Editor?.paragraphs
  if (paras == null) {
    // No note open
    return
  }
  const paraCount = paras.length

  // Find the line of interest from all the paragraphs
  for (let i = 0; i < paraCount; i++) {
    const p = paras[i]
    if (
      (p.content === 'Done' || p.content === 'Done …') &&
      p.headingLevel === 2
    ) {
      // jump cursor to that paragraph
      Editor.highlight(p)
      break
    }
  }
  console.log("Warning: Couldn't find a ## Done section")
}
globalThis.jumpToDone = jumpToDone

//------------------------------------------------------------------
// Set the title of a note from YAML, rather than the first line.
// NOTE: not currently working because of lack of API support yet (as of release 628)
// TODO: add following back into plugin.json to active this again:
// {
//   "name": "Set title from YAML",
//     "description": "Set the note's title from the YAML or frontmatter block, not the first line",
//       "jsFunction": "setTitleFromYAML"
// },

function setTitleFromYAML() {
  const { note, content } = Editor
  if (note == null || content == null) {
    // no note open.
    return
  }
  console.log(`setTitleFromYAML:\n\told title = ${note.title ?? ''}`)
  const lines = content.split('\n')
  let n = 0
  let newTitle = ''
  while (n < lines.length) {
    if (lines[n].match(/^[Tt]itle:\s*.*/)) {
      const rer = lines[n].match(/^[Tt]itle:\s*(.*)/)
      newTitle = rer?.[1] ?? ''
    }
    if (lines[n] === '' || lines[n] === '...') {
      break
    }
    n += 1
  }
  console.log(`\tnew title = ${newTitle}`)
  if (newTitle !== '') {
    note.title = newTitle // TODO: setter not available not yet available (last checked on release 628)
  }
  printNote(Editor.note)
}
globalThis.setTitleFromYAML = setTitleFromYAML

//------------------------------------------------------------------
// @dwertheimer based on @jgclark's newNote
// Create new note from currently selected text
// and (optionally) leave backlink to it where selection was
async function newNoteFromSelection() {
  const version = `0.9.2`
  console.log(`Running v${version}`)
  const { selectedLinesText, selectedText, selectedParagraphs } = Editor
  console.log(
    `\nnewNoteFromSelection (running v${version}) ${selectedParagraphs.length} selected:`,
  )
  let currentFolder = ''

  if (selectedLinesText.length && selectedText !== '') {
    // Get title for this note
    console.log(
      `\t1st Para Type = ${selectedParagraphs[0].type} = "${selectedParagraphs[0].content}"`,
    )
    // const stripHashes = /^\s*(#)* *(.*)/
    // const firstLineArray = stripHashes.exec(selectedLinesText[0])
    // const strippedFirstLine =
    //   firstLineArray.length === 3 ? firstLineArray[2] : ''

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
    const folders = DataStore.folders // excludes Trash and Archive
    if (folders.length > 0) {
      const re = await CommandBar.showOptions(
        folders,
        'Select folder to add note in:',
      )
      currentFolder = folders[re.index]
    } else {
      // no Folders so go to root
      currentFolder = '/'
    }
    console.log(`\tcurrentFolder=${currentFolder}`)

    if (title) {
      // Create new note in the specific folder
      const origFile = Editor.note.title || Editor.note.filename // Calendar notes have no title
      // const origFileType = Editor.note.type //either "Notes" or "Calendar"
      console.log(`\torigFile:${origFile}`)
      const filename = (await DataStore.newNote(title, currentFolder)) ?? ''
      console.log(`\tnewNote returned Filename:${filename}`)

      // Start Testing/debugging here
      const noteOpener = async function (
        fullPath,
        desc,
        useProjNoteByFilename = true,
      ) {
        console.log(
          `\tAbout to open filename: "${fullPath}" (${desc}) using ${
            useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'
          }`,
        )
        const newNote = (await useProjNoteByFilename)
          ? DataStore.projectNoteByFilename(fullPath)
          : DataStore.noteByFilename(fullPath, 'Notes')
        if (newNote) {
          console.log(`\t\tWorked! ${fullPath} (${desc} version) `)
        } else {
          console.log(
            `\t\tDidn't work! ${
              useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'
            } returned ${newNote}`,
          )
        }
        return newNote
      }
      let fullPath = `${
        currentFolder !== '/' ? currentFolder + '/' : ''
      }${filename}`

      let newNote = await noteOpener(fullPath, 'no leading slash')
      if (!newNote) {
        fullPath = `${
          currentFolder !== '/' ? '/' + currentFolder + '/' : ''
        }${filename}`
        newNote = await noteOpener(fullPath, 'with leading slash')
      }
      if (!newNote) {
        newNote = await noteOpener(
          `${currentFolder}/${filename}`,
          'Jonathan way',
        )
      }
      if (!newNote) {
        newNote = await noteOpener(
          `${filename}`,
          'no folder path, filename only',
        )
      }
      if (!newNote) {
        newNote = await noteOpener(
          `${currentFolder !== '/' ? currentFolder + '/' : ''}${filename}`,
          'using noteByFilename Instead',
          false,
        )
      }
      if (!newNote) {
        newNote = await noteOpener(
          `${
            currentFolder !== '/' ? '/' + currentFolder + '/' : ''
          }${filename}`,
          'using noteByFilename Instead, leading slash',
          false,
        )
      }
      // let newNote = await DataStore.projectNoteByFilename(fullPath)

      if (!newNote) {
      }

      if (newNote) {
        console.log(`\tnewNote=${newNote}\n\t${newNote.title}`)
        console.log(`\tcontent=${newNote.content}`)

        const iblq = await CommandBar.showOptions(
          ['Yes', 'No'],
          'Insert link to new file where selection was?',
        )
        const insertBackLink = iblq.index === 0
        if (Editor.replaceSelectionWithText) {
          // for compatibility, make sure the function exists
          if (insertBackLink) {
            Editor.replaceSelectionWithText(`[[${title}]]`)
          } else {
            Editor.replaceSelectionWithText(``)
          }
        }
        if (insertBackLink) {
          newNote.appendParagraph(`From [[${origFile}]]:`, 'text')
        }
        newNote.appendParagraph(movedText, 'empty')
        if (
          (await showMessageYesNo('New Note created. Open it now?')) === 'Yes'
        ) {
          await Editor.openNoteByFilename(filename)
        }
      } else {
        console.log(`\Could not open file: "${fullPath}"`)
        showMessage(`Could not open file ${fullPath}`)
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
