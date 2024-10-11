// @flow
//-----------------------------------------------------------------------------
// Smart duplicate note from an existing one.
// Last updated 2024-10-11 for v1.2.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getActiveParagraphs, sortTasksDefault } from '../../dwertheimer.TaskSorting/src/sortTasks'
import { archiveNoteUsingFolder } from './archive'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { getUniqueNoteTitle, noteOpener } from '@helpers/note'
import { openNoteInNewSplitIfNeeded } from '@helpers/NPWindows'
import { chooseFolder, getInput, showMessage, showMessageYesNo } from '@helpers/userInput'
import { isOpen } from '@helpers/utils'

/**
 * 
 * @author @jgclark
 */
export async function smartDuplicateRegularNote(): Promise<void> {
  try {
    // TODO: be smarter about guessing the period
    let notePeriod = 'yearly'
    const sourceNote = Editor.note ?? null

    if (!sourceNote) {
      // No note open, so don't do anything.
      logWarn(pluginJson, 'archiveNoteUsingFolder(): No note passed or open in the Editor, so stopping.')
      return
    }
    logDebug(pluginJson, `smartDuplicateRegularNote() starting from note '${displayTitle(Editor.note)}'`)

    // Get title for this note
    // Offer the first line to use, shorn of any leading # marks
    const sourceNoteTitle = sourceNote.title ?? 'error'
    let titleToOffer = sourceNoteTitle
    // Remove any "YYYY" or "Qn" or "Hn" from the title, with or without brackets
    titleToOffer = titleToOffer.replace(/\(\d{4}\)/g, '').replace(/\s+\d{4}/g, '').replace(/\([QH]\d\)/g, '').replace(/\s+[QH]\d/g, '')
    // try to work out new title
    let title = await getInput(`Title of new ${notePeriod} period note`, 'OK', 'New Periodic Note', titleToOffer)
    if (typeof title === 'boolean' && title === false) {
      logWarn('smartDuplicateRegularNote', 'The user cancelled the operation.')
      return
    }
    const uniqueTitle = getUniqueNoteTitle(sourceNoteTitle)
    if (title !== uniqueTitle) {
      await showMessage(`Title exists. Using "${uniqueTitle}" instead`, `OK`, `New Periodic Note`)
      title = uniqueTitle
    }

    // Work out the contents of the active part of the note
    const activeParas = getActiveParagraphs(sourceNote)
    // Keep all lines that aren't open tasks/checklists
    let parasToKeep = activeParas.filter(para => !isOpen(para))

    // Do some further clean up of the paragraphs
    let lastContent = ''
    let lastType = 'title'
    for (let i = 1; i < parasToKeep.length; i++) {
      lastContent = parasToKeep[i - 1].content
      logDebug('smartDuplicateRegularNote', `#${i}: {${lastContent}}`)
      lastType = parasToKeep[i - 1].type
      // Remove consecutive separators or empty lines
      if ((parasToKeep[i].type === 'empty' && lastType === 'empty') || (parasToKeep[i].type === 'separator') && (lastType === 'separator')) {
        logDebug('smartDuplicateRegularNote', `- removing consecutive empty/separator line`)
        parasToKeep.splice(i, 1)
        continue
      }
      // Remove any blank lines after headings (if wanted)
      if (lastType === 'title' && parasToKeep[i].type === 'empty') {
        logDebug('smartDuplicateRegularNote', `- removing blank line after heading`)
        parasToKeep.splice(i, 1)
        continue
      }
    }

    // Save contents to new note in the same folder
    // const currentFolder = await chooseFolder('Select folder to add note in:', false, true)  // don't include @Archive as an option, but do allow creation of a new folder
    const currentFolder = getFolderFromFilename(sourceNote.filename)
    const content = parasToKeep.join('\n')
    const newFilename = (await DataStore.newNoteWithContent(content, currentFolder)) ?? ''
    logDebug('smartDuplicateRegularNote', ` -> filename: ${newFilename}`)

    // Open the new note
    const res: ?TNote = await Editor.openNoteByFilename(newFilename)

    // Sort remaining tasks according to user's defaults.
    // Note: this uses @dwertheimer's sortTasksDefault() = /std, which only works on the current Editor, so has to come here.
    // TODO: see if we can get it to work on passed paragraphs instead, to avoid the step above.
    await sortTasksDefault()

    // Offer to archive the source note
    // TODO: Allow a different archive root folder, as in Reviews.
    if (await showMessageYesNo('Archive the source note?', ['Yes', 'No'], `New Periodic Note`) === 'Yes') {
      const res = archiveNoteUsingFolder(sourceNote)
    }

    // Offer to open the source note in a new split
    if (await showMessageYesNo('Open the source note in a new split?', ['Yes', 'No'], `New Periodic Note`) === 'Yes') {
      const res = openNoteInNewSplitIfNeeded(sourceNote.filename)
    }

  } catch (err) {
    logError('smartDuplicateRegularNote', err)
  }
}
