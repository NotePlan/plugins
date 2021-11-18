// @flow
//--------------------------------------------------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark & Eduard Metzger
// v0.10.6, 17.11.2021
//--------------------------------------------------------------------------------------------------------------------

import {
  allNotesSortedByChanged,
  printNote,
} from '../../helpers/note'
import { chooseFolder } from '../../helpers/userInput'

//-----------------------------------------------------------------
// Command from Eduard to move a note to a different folder
export async function moveNote() {
  const { title, filename } = Editor
  if (title == null || filename == null) {
    // No note open, so don't do anything.
    console.log('moveNote: warning: No note open.')
    return
  }
  const selectedFolder = await chooseFolder(`Select a folder for '${  title  }'`, true) // include @Archive as an option
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
// Open a user-selected note in a new window.
export async function openNoteNewWindow() {
  // Ask for the note we want to add the task
  const notes = allNotesSortedByChanged()
  const re = await CommandBar.showOptions(
    notes.map((n) => n.title).filter(Boolean),
    'Select note to open in new window',
  )
  const note = notes[re.index]
  const filename = note.filename
  await Editor.openNoteByFilename(filename, true)
}

//------------------------------------------------------------------
// Jumps the cursor to the heading of the current note that the user selects
// NB: need to update to allow this to work with sub-windows, when EM updates API
export async function jumpToHeading() {
  const paras = Editor?.paragraphs
  if (paras == null) {
    // No note open
    return
  }

  // TODO: it would be a good learning exercise to work out how to combine
  // the following two variables into a single map -> showOptions
  const headingParas = paras.filter((p) => p.type === 'title') // = all headings, not just the top 'title'
  const headingValues = headingParas.map((p) => {
    let prefix = ''
    for (let i = 1; i < p.headingLevel; i++) {
      prefix += '    '
    }
    return `${prefix}${p.content}`
  })

  // Present list of headingValues for user to choose from
  if (headingValues.length > 0) {
    const re = await CommandBar.showOptions(
      headingValues,
      'Select heading to jump to:',
    )
    // find out position of this heading, ready to set insertion point
    const startPos = headingParas[re.index].contentRange?.start ?? 0
    // console.log(startPos)
    // Editor.renderedSelect(startPos, 0) // feels the better one to use, but doesn't seem to work
    Editor.select(startPos, 0)
    CommandBar.hide() // shouldn't be needed, but seems to...


    // Earlier version:
    // Editor.highlight(headingParas[re.index])
  } else {
    console.log('Warning: No headings found in this note')
  }
}

//------------------------------------------------------------------
// Jumps the cursor to the heading of the current note that the user selects
// NB: need to update to allow this to work with sub-windows, when EM updates API
export async function jumpToNoteHeading() {
  // first jump to the note of interest, then to the heading
  const notesList = allNotesSortedByChanged()
  const re = await CommandBar.showOptions(
    notesList.map((n) => n.title ?? 'untitled'),
    'Select note to jump to',
  )
  const note = notesList[re.index]

  // Open the note in the Editor
  if (note != null && note.title != null) {
    await Editor.openNoteByTitle(note.title)
  } else {
    console.log("\terror: couldn't open selected note")
    return
  }

  // Now jump to the heading
  await jumpToHeading()
}

//------------------------------------------------------------------
// Jump cursor to the '## Done' heading in the current file
// NB: need to update to allow this to work with sub-windows, when EM updates API
export function jumpToDone() {
  const paras = Editor?.paragraphs
  if (paras == null) {
    // No note open
    return
  }

  // Find the 'Done' heading of interest from all the paragraphs
  const matches = paras
    .filter((p) => p.headingLevel === 2)
    .filter((q) => q.content.startsWith('Done'))

  if (matches != null) {
    const startPos = matches[0].contentRange?.start ?? 0
    console.log(`  Found ## Done at position ${startPos}`)
    // Editor.renderedSelect(startPos, 0) // sometimes doesn't work
    Editor.select(startPos, 0)

    // Earlier version
    // Editor.highlight(p)
  } else {
    console.log("Warning: Couldn't find a '## Done' section")
  }
}

//------------------------------------------------------------------
// Set the title of a note from YAML, rather than the first line.
// NOTE: not currently working because of lack of API support yet (as of release 636)
// TODO: add following back into plugin.json to active this again:
// {
//   "name": "Set title from YAML",
//     "description": "Set the note's title from the YAML or frontmatter block, not the first line",
//       "jsFunction": "setTitleFromYAML"
// },

export function setTitleFromYAML() {
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
    note.title = newTitle // TODO: when setter available
  }
  printNote(note)
}
