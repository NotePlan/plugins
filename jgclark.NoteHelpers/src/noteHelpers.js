// @flow
//-----------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark & Eduard Metzger
// Last updated 30.6.2023 for v0.17.2 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'
import { convertNoteToFrontmatter } from '@helpers/NPnote'
import { addTrigger, TRIGGER_LIST } from '@helpers/NPFrontMatter'
import { getParaFromContent, findStartOfActivePartOfNote } from '@helpers/paragraph'
import { chooseFolder, chooseHeading, chooseOption, getInput, showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------
// Settings

const pluginID = 'jgclark.NoteHelpers'

export type noteHelpersConfigType = {
  dateDisplayType: string,
  defaultFMText: string, // default text to add to frontmatter.
  displayOrder: string,
  ignoreCompletedItems: boolean,
  includeSubfolders: boolean,
  indexTitle: string,
}

/**
 * Get config settings
 * @author @jgclark
 */
export async function getSettings(): Promise<any> {
  try {
    // Get settings
    const config: noteHelpersConfigType = await DataStore.loadJSON(`../${pluginID}/settings.json`)

    if (config == null || Object.keys(config).length === 0) {
      await showMessage(
        `Cannot find settings for the 'NoteHelpers' plugin. Please make sure you have installed it from the Plugin Preferences pane.`,
      )
      return
    } else {
      // clo(config, `settings`)
      return config
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
    const selectedFolder = await chooseFolder(`Select a folder for '${title}'`, true, true) // include @Archive as an option, and to create a new folder
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
 * It decides which are trigger-related functions by:
 * - if plugin command name is on TRIGGER_LIST
 * - if plugin command description is on TRIGGER_LIST
 * - if either contains string 'trigger'
 * @author @jgclark
 */
export async function addTriggerToNote(): Promise<void> {
  try {
    if (!Editor) {
      throw new Error("No Editor open, so can't continue")
    }

    // Get list of available triggers from looking at installed plugins
    let triggerRelatedCommands = []
    let allVisibleCommands = []
    const installedPlugins = DataStore.installedPlugins()
    for (const p of installedPlugins) {
      for (const pcom of p.commands) {
        // Only include if this command name or description is a trigger type or contains the string 'trigger' (excluding this one!)
        if ((pcom.desc.includes("trigger") || pcom.name.includes("trigger") || TRIGGER_LIST.includes(pcom.name) || TRIGGER_LIST.includes(pcom.desc))
          && pcom.name !== "add trigger to note") {
          triggerRelatedCommands.push(pcom)
        }
        if (!pcom.hidden) allVisibleCommands.push(pcom)
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
    let result: PluginCommandObject | string = await chooseOption("Pick the trigger to add", commandOptions)
    let choice: PluginCommandObject
    // If user has chosen pick from whole list, then show that full list and get selection
    if (typeof result === "string" && result === "pickFromAll") {
      commandOptions = allVisibleCommands.map((pco) => {
        return { label: `${pco.pluginName} '${pco.name}'`, value: pco }
      })
      choice = await chooseOption("Pick the trigger to add", commandOptions)
    }
    else if (typeof result !== "string") {
      choice = result // this check appeases flow from here on
    }

    if (choice) {
      // clo(choice, 'choice')
      // Get trigger type from either name or description
      let triggerName = (TRIGGER_LIST.includes(choice.name)) ? choice.name
        : (TRIGGER_LIST.includes(choice.desc)) ? choice.desc
          : 'onEditorWillSave' // default to onEditorWillSave if no trigger type is found

      // Add to note
      let res = await addTrigger(Editor, triggerName, choice.pluginID, choice.name)
      if (res) {
        // $FlowIgnore[prop-missing]
        logDebug('addTriggerToNote', `Trigger ${choice.name} for ${choice.pluginID} was added to note ${displayTitle(Editor)}`)
      } else {
        // $FlowIgnore[prop-missing]
        logError('addTriggerToNote', `Trigger ${choice.name} for ${choice.pluginID} WASN'T added to note ${displayTitle(Editor)}`)
      }
    } else {
      throw new Error("Couldn't get a valid trigger choice for some reason. Stopping.")
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

/**
 * Convert the note to using frontmatter Syntax
 * If optional default text is given, this is added to the frontmatter.
 * @author @jgclark
 * @param {TNote} note
 */
export async function addFrontmatterToNote(note: TNote): Promise<void> {
  try {
    let thisNote: TNote
    if (note == null) {
      if (Editor == null) {
        throw new Error(`No note open to convert.`)
      } else {
        thisNote = Editor
      }
    } else {
      thisNote = note
    }
    if (!thisNote) {
      throw new Error(`No note supplied, and can't find Editor either.`)
    }
    const config = await getSettings()
    const res = convertNoteToFrontmatter(thisNote, config.defaultFMText ?? '')
    logDebug('note/convertNoteToFrontmatter', `ensureFrontmatter() returned ${String(res)}.`)
  }
  catch (error) {
    logError(pluginJson, JSP(error))
    await showMessage(error.message)
    return
  }
}
