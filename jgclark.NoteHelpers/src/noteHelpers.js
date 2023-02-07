// @flow
//-----------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark & Eduard Metzger
// Last updated 5.1.2023 for v0.16.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'
import { getParaFromContent, findStartOfActivePartOfNote } from '@helpers/paragraph'
import { chooseFolder, chooseHeading, getInput, showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------
// Settings

const pluginID = 'jgclark.NoteHelpers'

export type noteHelpersConfigType = {
  dateDisplayType: string,
  defaultText: string,
  displayOrder: string,
}

/**
 * Get config settings using Config V2 system.
 * @author @jgclark
 */
export async function getSettings(): Promise<any> {
  // logDebug(pluginJson, `Start of getSettings()`)
  try {
    // Get settings using ConfigV2
    const v2Config: noteHelpersConfigType = await DataStore.loadJSON(`../${pluginID}/settings.json`)

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      await showMessage(
        `Cannot find settings for the 'NoteHelpers' plugin. Please make sure you have installed it from the Plugin Preferences pane.`,
      )
      return
    } else {
      // clo(v2Config, `settings`)
      return v2Config
    }
  } catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

//-----------------------------------------------------------------
/**
 * Command from Eduard to move a note to a different folder
 * @author @eduardme
 */
export async function moveNote(): Promise<void> {
  try {
    const { title, filename } = Editor
    if (title == null || filename == null) {
      // No note open, so don't do anything.
      logError('moveNote()', 'No note open. Stopping.')
      return
    }
    const selectedFolder = await chooseFolder(`Select a folder for '${title}'`, true) // include @Archive as an option
    logDebug('moveNote()', `move ${title} (filename = ${filename}) to ${selectedFolder}`)

    const newFilename = DataStore.moveNote(filename, selectedFolder)

    if (newFilename != null) {
      await Editor.openNoteByFilename(newFilename)
    } else {
      logError('moveNote()', `Error trying to move note`)
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

/**
 * Open a user-selected note in a new window.
 * @author @jgclark
 */
export async function openNoteNewWindow(): Promise<void> {
  // Ask for the note we want to open
  const notes = allNotesSortedByChanged()
  const re = await CommandBar.showOptions(
    notes.map((n) => displayTitle(n)),
    'Select note to open in new window',
  )
  const note = notes[re.index]
  const filename = note.filename
  // work out where start of main content of the note is
  const startOfMainContentLine = findStartOfActivePartOfNote(note)
  const startOfMainContentCharIndex = note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
  // open note, moving cursor to start of main content
  await Editor.openNoteByFilename(filename, true, startOfMainContentCharIndex, startOfMainContentCharIndex, false)
}

/**
 * Open a user-selected note in a new split of the main window.
 * Note: uses API option only available on macOS and from v3.4.
 * It falls back to opening in a new window on unsupported versions.
 * @author @jgclark
 */
export async function openNoteNewSplit(): Promise<void> {
  // Ask for the note we want to open
  const notes = allNotesSortedByChanged()
  const re = await CommandBar.showOptions(
    notes.map((n) => displayTitle(n)),
    'Select note to open in new split window',
  )
  const note = notes[re.index]
  const filename = note.filename
  // work out where start of main content of the note is
  const startOfMainContentLine = findStartOfActivePartOfNote(note)
  const startOfMainContentCharIndex = note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
  // open note, moving cursor to start of main content
  await Editor.openNoteByFilename(filename, false, startOfMainContentCharIndex, startOfMainContentCharIndex, true)
}

/**
 * Open the current note in a new split of the main window.
 * Note: uses API option only available on macOS and from v3.4.
 * It falls back to opening in a new window on unsupported versions.
 * @author @jgclark
 */
export async function openCurrentNoteNewSplit(): Promise<void> {
  const { note, filename } = Editor
  if (note == null || filename == null) {
    // No note open, so don't do anything.
    logError('openCurrentNoteNewSplit()', 'No note open. Stopping.')
    return
  }
  // work out where start of main content of the note is
  const startOfMainContentLine = findStartOfActivePartOfNote(note)
  const startOfMainContentCharIndex = note.paragraphs[startOfMainContentLine].contentRange?.start ?? 0
  // open note, moving cursor to start of main content
  await Editor.openNoteByFilename(filename, false, startOfMainContentCharIndex, startOfMainContentCharIndex, true)
}

/**
 * Jumps the cursor to the heading of the current note that the user selects
 * @author @jgclark
 * @param {?string} heading to jump to
 */
export async function jumpToHeading(heading?: string): Promise<void> {
  const { paragraphs, note } = Editor
  if (note == null || paragraphs == null) {
    // No note open, or no content
    return
  }

  const headingStr = heading ?? (await chooseHeading(note, false, false, true))
  // find out position of this heading, ready to set insertion point
  // (or 0 if it can't be found)
  const startPos = getParaFromContent(note, headingStr)?.contentRange?.start ?? 0
  logDebug('noteHelpers / jumpToHeading', `for '${headingStr}' at position ${startPos} max ${String(note.content?.length)}`)
  Editor.select(startPos, 0)
}

/**
 * Converts all links that start with a `#` symbol, i.e links to headings within a note,
 * to x-callback-urls that call the `jumpToHeading` plugin command to actually jump to that heading.
 * @author @nmn
 */
export function convertLocalLinksToPluginLinks(): void {
  const note = Editor
  const paragraphs = note?.paragraphs
  if (note == null || paragraphs == null) {
    // No note open, or no content
    return
  }
  // Look for markdown links that are local to the note
  // and convert them to plugin links
  let changed = false
  for (const para of paragraphs) {
    const content = para.content
    const newContent = content.replace(/\[(.*?)\]\(\#(.*?)\)/g, (match, label, link) => {
      const newLink =
        `noteplan://x-callback-url/runPlugin?pluginID=jgclark.NoteHelpers&command=jump%20to%20heading&arg1=` +
        encodeURIComponent(link)
      return `[${label}](${newLink})`
    })
    if (newContent !== content) {
      para.content = newContent
      changed = true
    }
  }
  if (changed) {
    // Force update the note
    note.paragraphs = paragraphs
  }
}

/**
 * Jumps the cursor to the heading of the current note that the user selects
 * NB: need to update to allow this to work with sub-windows, when EM updates API
 * @author @jgclark
 */
export async function jumpToNoteHeading(): Promise<void> {
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
    logError("Couldn't open selected note")
    return
  }

  // Now jump to the heading
  await jumpToHeading()
}

/**
 * Jump cursor to the '## Done' heading in the current file
 * NB: need to update to allow this to work with sub-windows, when EM updates API
 * @author @jgclark
 */
export function jumpToDone(): void {
  const paras = Editor?.paragraphs
  if (paras == null) {
    // No note open
    return
  }

  // Find the 'Done' heading of interest from all the paragraphs
  const matches = paras.filter((p) => p.headingLevel === 2).filter((q) => q.content.startsWith('Done')) // startsWith copes with Done section being folded

  if (matches != null) {
    const startPos = matches[0].contentRange?.start ?? 0
    logDebug('jumpToDone()', `Jumping to '## Done' at position ${startPos}`)
    // Editor.renderedSelect(startPos, 0) // sometimes doesn't work
    Editor.select(startPos, 0)

    // Earlier version
    // Editor.highlight(p)
  } else {
    logWarn('jumpToDone()', "Couldn't find a '## Done' section. Stopping.")
  }
}

/**
 * Rename the currently open note's file on disk
 * NB: Only available from v3.6.1 build 826+
 * @author @jgclark
 */
export async function renameNoteFile(): Promise<void> {
  try {
    const { note } = Editor
    // Check for version less than v3.6.1 (828)
    const bvNumber = NotePlan.environment.buildVersion
    if (bvNumber < 826) {
      logError('renameNoteFile()', 'Will only work on NotePlan v3.6.1 or greater. Stopping.')
      return
    }
    if (note == null || note.paragraphs.length < 1) {
      // No note open, so don't do anything.
      logError('renameNoteFile()', 'No note open, or no content. Stopping.')
      return
    }
    if (Editor.type === 'Calendar') {
      // Won't work on calendar notes
      logError('renameNoteFile()', 'This will not work on Calendar notes. Stopping.')
      return
    }
    const currentFullPath = note.filename
    // let currentFilename = ''
    // let currentFolder = ''
    // if (currentFullPath.lastIndexOf('/') > -1) {
    //   currentFolder = res.substr(0, res.lastIndexOf('/'))
    //   currentFilename = res.substr(res.lastIndexOf('/') + 1)
    // } else {
    //   currentFolder = '/'
    //   currentFilename = res
    // }

    const requestedPath = await getInput(`Please enter new filename for file (including folder and file extension)`, 'OK', 'Rename file', currentFullPath)
    if (typeof requestedPath === 'string') {
      // let newFolder = ''
      // let newFilename = ''
      // if (requestedPath.lastIndexOf('/') > -1) {
      //   newFolder = requestedPath.substr(0, requestedPath.lastIndexOf('/'))
      //   newFilename = requestedPath.substr(requestedPath.lastIndexOf('/') + 1)
      // } else {
      //   newFolder = '/'
      //   newFilename = requestedPath
      // }
      // logDebug(pluginJson, `${newFolder}  /  ${newFilename}`)
      logDebug(pluginJson, `Requested new filepath = ${requestedPath}`)

      const newFilename = note.rename(requestedPath)
      logDebug('renameNoteFile()', `Note file renamed from '${currentFullPath}' to '${newFilename}'`)
    } else {
      // User cancelled operation
      logWarn('renameNoteFile()', `User cancelled operation`)
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }

}
