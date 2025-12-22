// @flow
//-----------------------------------------------------------------------------
// Duplicate note with options from current Editor
// Last updated 2025-12-20 for v1.3.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { addFrontmatterToNote, getSettings } from './noteHelpers'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { chooseFolder, getInputTrimmed, chooseOption } from '@helpers/userInput'

/**
 * Duplicate the current note.
 * @author @jgclark
 */
export async function duplicateNote(): Promise<void> {
  try {
    const existingNote = Editor.note
    if (!existingNote) {
      throw new Error('No note open; stopping.')
    }

    // Work out a candidate title for the new note, based on the current note's title as the default, but first:
    // - if it contains year (as \d{4}) then increment it
    // - if it contains half-year (as \d{4}H[12]) then increment it
    // - if it contains quarter (as \d{4}Q[1234]) then increment it
    // - else append "copy"
    let candidateTitle = existingNote.title ?? ''
    if (candidateTitle.match(/\d{4}Q[1234]/)) {
      candidateTitle = candidateTitle.replace(/\d{4}Q[1234]/, `${parseInt(candidateTitle.match(/\d{4}Q[1234]/)[0]) + 1}Q`)
    } else if (candidateTitle.match(/\d{4}H[12]/)) {
      candidateTitle = candidateTitle.replace(/\d{4}H[12]/, `${parseInt(candidateTitle.match(/\d{4}H[12]/)[0]) + 1}H`)
    } else if (candidateTitle.match(/\d{4}/)) {
      candidateTitle = candidateTitle.replace(/\d{4}/, `${parseInt(candidateTitle.match(/\d{4}/)[0]) + 1}`)
    } else {
      candidateTitle = candidateTitle + ' copy'
    }

    // Now offer this title to the user for confirmation or modification.
    const title = await getInputTrimmed('Title of duplicate note', 'OK', 'Duplicate Note', candidateTitle)
    if (typeof title !== 'string') {
      throw new Error('The user cancelled the operation.')
    }
    logDebug('duplicateNote', `Will use title '${title}' for the new note.`)

    const currentFolder = await chooseFolder('Select folder to add note in:', false, true, '/', true)  // don't include @Archive as an option, but do allow creation of a new folder

    // Workk out the content for the new note, by either:
    // - if the existing content starts with content on an H1 line, then replace it with the new title
    // - if the existing content starts with a frontmatter block, then replace the title in the frontmatter with the new title
    // - otherwise, prepend the new title to the existing content as an H1 line
    let content = existingNote.content ?? ''
    const frontmatterMatches = content.match(/^---[\s\S]*?title:.*?---$/m)
    if (frontmatterMatches) {
      content = content.replace(frontmatterMatches[0], `---${frontmatterMatches[0].replace(/title:.*?$/, `title: ${title}`)}---`)
    } else {
      const h1LineMatches = content.match(/^# (.*)$/)
      if (h1LineMatches) {
        content = content.replace(h1LineMatches[0], `# ${title}`)
      } else {
        content = `# ${title}\n${content}`
      }
    }

    // Create new note in the specific folder
    const filename = (await DataStore.newNoteWithContent(content, currentFolder)) ?? ''
    logDebug('newNote', ` -> created new note with filename: ${filename}`)

    // Add frontmatter if required
    const config = await getSettings()
    if (config.defaultFrontmatter !== '') {
      // Add frontmatter to the note
      const newNote = await DataStore.noteByFilename(filename, 'Notes')
      if (newNote) {
        await addFrontmatterToNote(newNote)
      }
    }

    // Offer the user the option to open the new note in the current Editor, or a new split, or a new window, or to do nothing
    const openOptions = [
      { label: 'Current Editor', value: 'current' },
      { label: 'New Split', value: 'split' },
      { label: 'New Window', value: 'window' },
      { label: 'Do Nothing', value: 'none' },
    ]
    const openOption = await chooseOption('New Note created. Open it now?', openOptions, 'current')
    if (openOption === 'current') {
      await Editor.openNoteByFilename(filename)
    } else if (openOption === 'split') {
      await Editor.openNoteByFilename(filename, true)
    } else if (openOption === 'window') {
      await Editor.openNoteByFilename(filename, false, 0, 0, true)
    } else if (openOption === 'none') {
      return
    }
  } catch (err) {
    logError(pluginJson, `duplicateNote: ${err}`)
  }
}
