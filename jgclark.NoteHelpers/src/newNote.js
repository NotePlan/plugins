// @flow
//-----------------------------------------------------------------------------
// @dwertheimer based on @jgclark's newNote
// Create new note from currently selected text
// and (optionally) leave backlink to it where selection was
// Note: this was originally in Filer plugin
// Last updated 2025-04-08 for 1.2.0, @jgclark (originally @dwertheimer)
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getActiveParagraphs, sortTasksDefault } from '../../dwertheimer.TaskSorting/src/sortTasks'
import { archiveNoteUsingFolder } from '../../jgclark.Filer/src/archive'
import { addFrontmatterToNote, getSettings } from './noteHelpers'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { openNoteInNewSplitIfNeeded } from '@helpers/NPWindows'
import { isOpen } from '@helpers/utils'
import { getUniqueNoteTitle, getNote } from '@helpers/note'
import { chooseFolder, getInput, getInputTrimmed, showMessage, showMessageYesNo } from '@helpers/userInput'

/**
 * Create new (regular) note.
 * @author @jgclark
 */
export async function newNote(): Promise<void> {
  try {
    // Get title for this note
    const title = await getInputTrimmed('Title of new note', 'OK', 'New Note from Clipboard', '')
    if (typeof title === 'string') {
      const currentFolder = await chooseFolder('Select folder to add note in:', false, true)  // don't include @Archive as an option, but do allow creation of a new folder
      const content = `# ${title}\n`
      if (title) {
        // Create new note in the specific folder
        const filename = (await DataStore.newNoteWithContent(content, currentFolder)) ?? ''
        logDebug('newNote', ` -> filename: ${filename}`)

        // Add frontmatter if required
        const config = await getSettings()
        if (config.defaultFrontmatter !== '') {
          // Add frontmatter to the note
          const newNote = await DataStore.noteByFilename(filename, 'Notes')
          if (newNote) {
            await addFrontmatterToNote(newNote)
          }
        }

        const res = (await showMessageYesNo('New Note created. Open it now?', ['Yes', 'No'], `New Note`))
        if (res === 'Yes') {
          await Editor.openNoteByFilename(filename)
        }
      } else {
        logError('newNote', 'Undefined or empty title')
      }
    } else {
      logWarn('newNote', 'The user cancelled the operation.')
    }
  } catch (err) {
    logError(pluginJson, `newNote: ${err}`)
  }
}

/**
 * Create new note from the clipboard contents.
 * @author @jgclark
 */
export async function newNoteFromClipboard(): Promise<void> {
  const { string } = Clipboard

  if (string != null && string.length > 0) {
    logDebug(pluginJson, `newNoteFromClipboard() starting: have ${string.length} characters in clipboard`)

    // Get title for this note
    // Offer the first line to use, shorn of any leading # marks, from either frontmatter's 'title:' or the first line of the text
    // FIXME: 
    const firstLineMatches: Array<string> = string.match(/^(?:---\n(?:title:\s*)?|^title:\s+(.*)\n|^[#\s]*)?(.*)\n/) ?? []
    const titleToOffer = firstLineMatches[1] ?? ''
    let title = await getInput('Title of new note', 'OK', 'New Note from Clipboard', titleToOffer)
    if (typeof title === 'string') {
      const uniqueTitle = getUniqueNoteTitle(title)
      if (title !== uniqueTitle) {
        await showMessage(`  Title exists. Using "${uniqueTitle}" instead`, `OK`, `New Note from Clipboard`)
        title = uniqueTitle
      }
      const currentFolder = await chooseFolder('Select folder to add note in:', false, true)  // don't include @Archive as an option, but do allow creation of a new folder
      const content = `# ${title}\n${string}`
      if (title) {
        // Create new note in the specific folder
        const filename = (await DataStore.newNoteWithContent(content, currentFolder)) ?? ''
        logDebug(pluginJson, ` -> filename: ${filename}`)

        const res = (await showMessageYesNo('New Note created. Open it now?', ['Yes', 'No'], `New Note from Clipboard`))
        if (res === 'Yes') {
          await Editor.openNoteByFilename(filename)
        }
      } else {
        logError(pluginJson, 'Undefined or empty title')
      }
    } else {
      logWarn(pluginJson, 'The user cancelled the operation.')
    }
  } else {
    logWarn(pluginJson, 'The clipboard was empty, so nothing to do.')
    showMessage("The clipboard was empty, so there's nothing to do.", "OK, I'll try again", `New Note from Clipboard`)
  }
}

/**
 * Create new note from currently selected text and (optionally) leave backlink to it where selection was.
 * @author @dwertheimer + @jgclark
 */
export async function newNoteFromSelection(): Promise<void> {
  const { selectedLinesText, selectedText, selectedParagraphs, note } = Editor

  if (note != null && selectedLinesText.length && selectedText !== '') {
    logDebug(pluginJson, `newNoteFromSelection() starting with ${selectedParagraphs.length} selected:`)
    const selectedLinesTextToMutate = selectedLinesText.slice() // copy that we can change

    // Get title for the new note
    // First get frontmatter's 'title:' (if present) or the first line of the text (shorn of any leading # or spaces)
    const isTextContent = ['title', 'text', 'separator'].indexOf(selectedParagraphs[0].type) >= 0
    const firstLineMatches: Array<string> = selectedText?.match(/^(?:---\n(?:title:\s*)?|^title:\s+(.*)\n|^[#\s]*)?(.*)\n/) ?? []
    const titleToOffer = isTextContent && firstLineMatches[1] ? firstLineMatches[1] : ''
    // const strippedFirstLine = selectedParagraphs[0].content
    let title = await getInput('Title of new note', 'OK', 'New Note from Selection', titleToOffer)
    if (typeof title === 'string') {
      // If user selected the first line, then remove it from the body content
      if (title === titleToOffer && selectedParagraphs[0].type === 'title') {
        selectedLinesTextToMutate.shift()
      }
      const movedText = selectedLinesTextToMutate.join('\n')
      const uniqueTitle = getUniqueNoteTitle(title)
      if (title !== uniqueTitle) {
        await showMessage(`Title exists. Using "${uniqueTitle}" instead`, `OK`, `New Note from Selection`)
        title = uniqueTitle
      }
      const currentFolder = await chooseFolder('Select folder to add note in:', false, true)  // don't include @Archive as an option, but do allow creation of a new folder

      if (title) {
        // Create new note in the specific folder
        const origFile = displayTitle(note) // Calendar notes have no title, so need to make one
        logDebug(pluginJson, `- origFile: ${origFile}`)
        const filename = (await DataStore.newNote(title, currentFolder)) ?? ''
        logDebug(pluginJson, `- newNote() -> filename: ${filename}`)

        // This question needs to be here after newNote and before getNote to force a cache refresh after newNote.
        // Note: This API bug has probably now been fixed.
        const res = await CommandBar.showOptions(['Yes', 'No'], 'Insert link to new file where selection was?')

        const newNote = await getNote(filename, true)

        if (newNote) {
          logDebug(pluginJson, `- newNote's title: ${String(newNote.title)}`)
          logDebug(pluginJson, `- newNote's content: ${String(newNote.content)} ...`)
          const insertBackLink = res.index === 0
          // $FlowFixMe[method-unbinding] - Flow thinks the function is being removed from the object, but it's not
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
          const res2 = await showMessageYesNo('New Note created. Open it now?', ['Yes', 'No'], `New Note from Selection`)
          if (res2 === 'Yes') {
            await Editor.openNoteByFilename(filename)
          }
        } else {
          logWarn(pluginJson, `Couldn't open new note: ${filename}`)
          showMessage(`Could not open new note ${filename}`, `OK`, `New Note from Selection`)
        }
      } else {
        logError(pluginJson, 'Undefined or empty title')
      }
    } else {
      logWarn(pluginJson, 'The user cancelled the operation.')
    }
  } else {
    logDebug(pluginJson, '- No text was selected, so nothing to do.')
    showMessage('No text was selected, so nothing to do.', "OK, I'll try again", `New Note from Selection`)
  }
}

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