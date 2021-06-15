// @flow

//------------------------------------------------------------------
// Helper functions
//------------------------------------------------------------------
export function printNote(note) {
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

// Show feedback message using Command Bar (@dwertheimer)
export async function showMessage(message:string, confirmTitle:string = 'OK') {
  return await CommandBar.showOptions([confirmTitle], message)
}

// Show feedback Yes/No Question via Command Bar (@dwertheimer)
export async function showMessageYesNo(message:string, choicesArray:Array<string> = ['Yes', 'No']):Promise<string> {
  const answer = await CommandBar.showOptions(choicesArray, message)
  return choicesArray[answer.index]
}

export async function noteOpener(
  fullPath: string,
  desc: string,
  useProjNoteByFilename: boolean = true): Promise<TNote> {
  console.log(
    `\tAbout to open filename: "${fullPath}" (${desc}) using ${
      useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'
    }`,
  )
  const newNote = (await useProjNoteByFilename)
    ? DataStore.projectNoteByFilename(fullPath)
    : DataStore.noteByFilename(fullPath, 'Notes')
  if (newNote) {
    console.log(`\t\tOpened ${fullPath} (${desc} version) `)
  } else {
    console.log(
      `\t\tDidn't work! ${
        useProjNoteByFilename ? 'projectNoteByFilename' : 'noteByFilename'
      } returned ${newNote}`,
    )
  }
  return newNote
}

// Find a unique note title/filename so backlinks can work properly (@dwertheimer)
// Keep adding numbers to the end of a filename (if already taken) until it works
export function getUniqueNoteTitle(title:string):string {
  let i = 0,
    res = [],
    newTitle = title
  while (++i === 1 || res.length > 0) {
    newTitle = i === 1 ? title : `${title} ${i}`
    res = DataStore.projectNoteByTitle(newTitle, true, false)
  }
  return newTitle
}

export async function chooseFolder(msg:string):Promise<string> {
  let currentFolder
  const folders = DataStore.folders // excludes Trash and Archive
  if (folders.length > 0) {
    const re = await CommandBar.showOptions(folders, msg)
    currentFolder = folders[re.index]
  } else {
    // no Folders so go to root
    currentFolder = '/'
  }
  console.log(`\tcurrentFolder=${currentFolder}`)
  return currentFolder
}
