// @flow
//-----------------------------------------------------------------------------
// Write a list of all published notes to a specific note
// Last updated 2025-02-19 for v1.1.0 by @jgclark
//-----------------------------------------------------------------------------

import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { createRunPluginCallbackUrl, displayFolderAndTitle } from '@helpers/general'
import { getOrMakeRegularNoteInFolder } from '@helpers/NPnote'

const outputNoteName = 'Published Notes'
const publicURLPrefix = 'https://noteplan.co/n/'

/**
 * List all published notes.
 * @returns void
 */
export async function listPublishedNotes(): Promise<void> {
  try {
    const publishedNotes = DataStore.projectNotes.filter(note => note.publicRecordID)

    // Construct output
    const outputArray = []
    const xCallbackURL = createRunPluginCallbackUrl('jgclark.NoteHelpers', 'listPublishedNotes', [])
    outputArray.push(`# Published Notes`)
    outputArray.push(`Found ${publishedNotes.length} published notes. Last run: ${new Date().toLocaleString()}  [🔄 Refresh list](${xCallbackURL})`)
    outputArray.push(``)
    publishedNotes.map(note => {
      // $FlowIgnore[incompatible-type]
      outputArray.push(`- [Link](${publicURLPrefix}${note.publicRecordID}) to ${displayFolderAndTitle(note)}`)
    })
    const outString = outputArray.join('\n')

    // let outputNote = DataStore.projectNoteByTitle(outputNoteName)
    const outputNote = await getOrMakeRegularNoteInFolder(outputNoteName, "/")
    // fresh test to see if we now have the note
    if (outputNote != null) {
      outputNote.content = outString // overwrite what was there before
      // Note: this setter doesn't seem to be enough in some cases?
    } else {
      throw new Error(`error: couldn't make or get valid note '${outputNoteName}' to write to`)
    }

  } catch (error) {
    logError('listPublishedNotes', JSP(error))
  }
}
