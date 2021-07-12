// @flow
//--------------------------------------------------------------------------------------------------------------------
// Part of Note Helpers plugin for NotePlan
// Jonathan Clark
// at v0.10.1, 8.7.2021
//--------------------------------------------------------------------------------------------------------------------

import {
  // projectNotesSortedByChanged, printNote, chooseFolder,
  nowShortDateTime,
  chooseOption,
  chooseFolder,
  defaultFileExt,
} from '../../helperFunctions'

// Get the folder name from the full NP (project) note filename
function getFolderFromFilename(fullFilename: string): string {
  const filenameParts = fullFilename.split('/')
  // console.log(filenameParts)
  return filenameParts.slice(0, (filenameParts.length - 1)).join('/')
}
// Tests for gFFF function above
// console.log(`gFFF('one/two/three/four.txt') -> ${getFolderFromFilename('one/two/three/four.txt')}`)
// console.log(`gFFF('one/two/three/four and a bit.md') -> ${getFolderFromFilename('one/two/three/four and a bit.md')}`)
// console.log(`gFFF('one/two or three/fifteen.txt') -> ${getFolderFromFilename('one/two or three/fifteen.txt')}`)
// console.log(`gFFF('/sixes and sevenses/calm one.md') -> ${getFolderFromFilename('sixes and sevenses/calm one.md')}`)

// Return (project) note title as a [[link]]
function titleAsLink(note: TNote): string {
  return (note.title !== undefined) ? `[[${note.title ?? ''}]]` : '(error)'
}

// Return list of notes in a folder with a particular hashtag
function notesInFolderSortedByName(folder: string): Array<TNote> {
  let notesInFolder: Array<TNote>
  // If folder given (not empty) then filter using it
  if (folder !== '') {
    notesInFolder = DataStore.projectNotes
      .slice()
      .filter((n) => getFolderFromFilename(n.filename) === folder)
  } else {
    notesInFolder = DataStore.projectNotes.slice()
  }
  // Sort alphabetically on note's title
  const notesSortedByName = notesInFolder.sort((first, second) =>
    (first.title ?? '').localeCompare(second.title ?? ''),
  )
  return notesSortedByName
}

//-----------------------------------------------------------------
// Command to calculate the index of a specified folder.
// Input is folder name (without trailling /)
// Returns an array of strings, one for each output line.
function makeFolderIndex(
  folder: string,
  includeSubfolders: boolean):
  Array<string> {
  console.log(`\nmakeFolderIndex for '${folder}' (${includeSubfolders ? 'with' : 'without'} subfolders)`)

  let noteCount = 0
  const outputArray: Array<string> = []
  let folderList: Array<string> = []
  // if we want a to include any subfolders, create list of folders
  if (includeSubfolders) {
    folderList = DataStore.folders.
      filter((f) => f.startsWith(folder))
  } else {
  // otherwise use a single folder
    folderList = [folder]
  }
  console.log(`\tFound ${folderList.length} matching folder(s)`)
  // Iterate over the folders
  // A for-of loop is cleaner and less error prone than a regular for-loop
  for (const f of folderList) {
    const notes = notesInFolderSortedByName(f)
    // console.log(notes.length)
    if (notes.length > 0) {
      // If this is a sub-folder level, then prefix with ### for a 3rd level heading,
      // otherwise leave blank, as a suitable header gets added elsewhere.
      outputArray.push( (noteCount>0) ? `### ${f} Index` : `${f} Index`)
      outputArray.push(`(${notes.length} notes, last updated: ${nowShortDateTime})`)
      // iterate over this folder's notes
      for (const note of notes) {
        outputArray.push(titleAsLink(note))
      }
      outputArray.push('')
      noteCount += notes.length
    }
  }

  return outputArray 
}

//----------------------------------------------------------------
// Command to index folders, creating list of note links
// Options:
// 1. This folder only (insert into current note)
// 2. This folder only (add/update to _index note)
// 3. This folder + subfolders (add/update into single _index note)
// 4. TODO: This folder + subfolders (add/update into _index notes in each subfolder)

export async function indexFolders(): Promise<void> {
  // To start with just operate on current note's folder
  const fullFilename = Editor.filename ?? undefined
  // const currentNote = Editor.note ?? undefined
  let thisFolder: string
  let outputArray: Array<string> = []

  if (fullFilename === undefined) {
    console.log(`  Info: No current filename (and therefore folder) found, so will ask instead.`)
    thisFolder = await chooseFolder(`Please pick folder to index`)
  } else {
    thisFolder = getFolderFromFilename(fullFilename)
  }
  console.log(`\nindexFolders from folder ${thisFolder}`)

  const option = await chooseOption(
    'Create index for which folder(s)?',
    [
      {
        label: `This folder only (insert into current note)`,
        value: 'one-to-current',
      },
      {
        label: `This folder only (add/update to _index note)`,
        value: 'one-to-index',
      },
      {
        label: `This folder and sub-folders (add/update to single _index note)`,
        value: 'all-to-one-index',
      },
      {
        label: `(NOT YET WORKING) This folder and sub-folders (add/update to _index notes)`,
        value: 'all-to-many-index',
      },
      {
        label: '❌ Cancel',
        value: false,
      },
    ],
    false,
  )

  if (!option) {
    return
  }

  console.log(`  option: ${option}`)
  if (option.startsWith('one')) {
    outputArray = makeFolderIndex(thisFolder, false)
  } else if (option.startsWith('all')) {
    outputArray = makeFolderIndex(thisFolder, true)
  }
  const outString = outputArray.join('\n')
  console.log(`  -> ${outString}`)

  if (option.endsWith('index')) {

    // write out to index file(s)
    let outputFilename = `${thisFolder}/_index.${defaultFileExt}`
    // see if we already have an _index file in this folder
    let outputNote = DataStore.projectNoteByFilename(outputFilename)

    if (outputNote == null) {
      // make a new note for this
      outputFilename = await DataStore.newNote(
        '_index',
        thisFolder,
      )
      console.log(`\tnewNote filename: ${String(outputFilename)}`)
      // outputFilename = `${pref_folderToStore}/${String(outputFilename)}` ?? '(error)'
      // NB: filename here = folder + filename
      outputNote = await DataStore.projectNoteByFilename(outputFilename)
      console.log(`\twriting results to the new note '${outputFilename}'`)
    }

    if (outputNote != null) {
      outputNote.content = `# ${outString}` // overwrite what was there before

    } else {
      console.log("error after newNote(): no valid note to write to")
      return
    }

  } else if (option.endsWith('current')) {

    // write out to the current file
    Editor.insertTextAtCursor(`${outString}`)
  }

  console.log(`\nFinished indexFolders.`)
}
