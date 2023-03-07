// @flow
//-----------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark & Eduard Metzger
// Last updated 7.2.2023 for v0.16.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'
import { addTrigger, TRIGGER_LIST } from '@helpers/NPFrontMatter'
import { getParaFromContent, findStartOfActivePartOfNote } from '@helpers/paragraph'
import { chooseFolder, chooseHeading, chooseOption, getInput, showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------
// Settings

const pluginID = 'jgclark.NoteHelpers'

export type noteHelpersConfigType = {
  dateDisplayType: string,
  defaultText: string, // default text to add to frontmatter. Note: currently unused.
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
    logError(pluginJson, JSP(err))
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

//-----------------------------------------------------------------

/**
 * Add trigger to the currently open Editor note, with choice offered to user of which trigger to add.
 * @author @jgclark
 */
export async function addTriggerToNote(): Promise<void> {
  try {
    if (!Editor) {
      throw new Error("No Editor open, so can't continue")
    }

    // Get list of available triggers from looking at installed plugins (that aren't hidden)
    let triggerRelatedCommands = []
    let allVisibleCommands = []
    const installedPlugins = DataStore.installedPlugins().filter((p) => !p.isHidden)
    for (const p of installedPlugins) {
      for (const pcom of p.commands) {
        // Only include if this command name is a trigger type or the description includes 'trigger' (excluding this one!)
        if ((pcom.desc.includes("trigger") || TRIGGER_LIST.includes(pcom.name)) && pcom.name !== "add trigger to note") {
          triggerRelatedCommands.push(pcom)
        }
        allVisibleCommands.push(pcom)
      }
    }
    // clo(triggerRelatedCommands, 'triggerRelatedCommands')

    // Ask user to select one. Examples:
    // let trigger = "onEditorWillSave"
    // let pluginID = "jgclark.RepeatExtensions"
    // let commandName = "generate repeats"
    if (triggerRelatedCommands.length === 0) {
      throw new Error("No triggers are supported in your installed plugins.")
    }
    let commandOptions: Array<any> = triggerRelatedCommands.map((pco) => {
      return { label: `${pco.pluginName} '${pco.name}'`, value: pco }
    })
    commandOptions.push({ label: `Pick from whole list of functions ...`, value: "pickFromAll" })
    let choice: PluginCommandObject | string = await chooseOption("Pick the trigger to add", commandOptions)

    // If user has chosen pick from whole list, then show that full list and get selection
    if (typeof choice === "string" && choice === "pickFromAll") {
      commandOptions = allVisibleCommands.map((pco) => {
        return { label: `${pco.pluginName} '${pco.name}'`, value: pco }
      })
      choice = await chooseOption("Pick the trigger to add", commandOptions)
      clo(choice, 'choice')
    }

    // Add to note FIXME: not working, but reporting it has
    // $FlowIgnore[prop-missing]
    let res = await addTrigger(Editor, choice.name, choice.pluginID, choice.name)
    if (res) {
      // $FlowIgnore[prop-missing]
      logDebug('addTriggerToNote', `Trigger ${choice.name} for ${choice.pluginID} was added to note ${displayTitle(Editor)}`)
    } else {
      // $FlowIgnore[prop-missing]
      logError('addTriggerToNote', `Trigger ${choice.name} for ${choice.pluginID} WASN'T added to note ${displayTitle(Editor)}`)
    }
  }
  catch (err) {
    logError(pluginJson, err.message)
    await showMessage(err.message)
  }
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
