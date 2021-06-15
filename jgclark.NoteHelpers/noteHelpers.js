// @ flow
//--------------------------------------------------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark & Eduard Metzger
// v0.9.3, 1.6.2021
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

//-----------------------------------------------------------------
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
