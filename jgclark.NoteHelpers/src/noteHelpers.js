// @flow
//-----------------------------------------------------------------------------
// Note Helpers plugin for NotePlan
// Jonathan Clark & Eduard Metzger
// Last updated 2024-12-25 for v0.20.3 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
// import { allNotesSortedByChanged } from '@helpers/note'
import { convertNoteToFrontmatter } from '@helpers/NPnote' // Note: not the one in 'NPTemplating'
import { addTrigger, noteHasFrontMatter, setFrontMatterVars, TRIGGER_LIST } from '@helpers/NPFrontMatter'
import { printNote } from '@helpers/NPnote'
import {
  chooseFolder,
  // chooseHeading,
  chooseOption, getInput, showMessage
} from '@helpers/userInput'
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
export async function logEditorNoteDetailed(): Promise<void> {
  try {
    if (!Editor || !Editor.note) {
      // No note open, so don't do anything.
      logError('logEditorNoteDetailed()', 'No note open. Stopping.')
      return
    }
    logDebug('logEditorNoteDetailed()', `Editor: ${Editor.filename})`)
    printNote(Editor.note, true)
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

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
 * Delete a note -- by moving to the special @Trash folder
 * @author @jgclark
 */
export async function trashNote(): Promise<void> {
  try {
    const { title, filename } = Editor
    if (title == null || filename == null) {
      // No note open, so don't do anything.
      logError('trashNote()', 'No note open. Stopping.')
      return
    }

    const newFilename = DataStore.moveNote(filename, '@Trash')

    if (!newFilename) {
      logError('trashNote()', `Error trying to move note to @Trash`)
    }
  }
  catch (err) {
    logError(pluginJson, `${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

//-----------------------------------------------------------------

/**
 * Add trigger to the currently open Editor note, with choice offered to user of which trigger to add (if param not given).
 * It decides which are trigger-related functions by:
 * - if plugin command name is on TRIGGER_LIST
 * - if plugin command description is on TRIGGER_LIST
 * - if either contains string 'trigger'
 * @author @jgclark
 * @param {string?} triggerStringArg optional full trigger string, e.g. onEditorWillSave => jgclark.DashboardReact.decideWhetherToUpdateDashboard
 */
export async function addTriggerToNote(triggerStringArg: string = ''): Promise<void> {
  try {
    if (!Editor || !Editor.note) {
      throw new Error("No Editor open, so can't continue")
    }
    logDebug(pluginJson, `addTriggerToNote('${triggerStringArg}') starting ...`)

    // Get list of available triggers from looking at installed plugins
    const allVisibleCommands = []
    const triggerRelatedCommands = []
    const triggerRelatedStrings = []
    const installedPlugins = DataStore.installedPlugins()
    // logDebug('addTriggerToNote', "Found following trigger-related plugin commands:")
    for (const p of installedPlugins) {
      for (const pluginCommand of p.commands) {
        // Only include if this command name or description is a trigger type or contains the string 'trigger' (excluding this one!)
        if ((pluginCommand.desc.includes("trigger") || pluginCommand.name.includes("trigger") || TRIGGER_LIST.includes(pluginCommand.name) || TRIGGER_LIST.includes(pluginCommand.desc))
          && pluginCommand.name !== "add trigger to note") {
          triggerRelatedCommands.push(pluginCommand)
          const thisTriggerString = `${pluginCommand.name} => ${p.id}.${pluginCommand.name}`
          // logDebug('addTriggerToNote', `- ${thisTriggerString}`)
          triggerRelatedStrings.push(thisTriggerString)
        }
        if (!pluginCommand.hidden) {
          allVisibleCommands.push(pluginCommand)
        }
      }
    }
    // clo(triggerRelatedCommands, 'triggerRelatedCommands')

    let triggerName = ''
    let triggerPluginID = ''
    let funcName = ''

    if (triggerStringArg !== '') {
      // if (!TRIGGER_LIST.includes(triggerName)) {
      if (!triggerRelatedStrings.includes(triggerStringArg)) {
        logInfo('addTriggerToNote', `Trigger '${triggerStringArg}' not found in the list of triggers I can identify, but will still add it.`)
      }

      // Add to note
      // Note: using Editor, not Editor.note, in case this is used in a Template
      // V1 Note: this can make duplicate frontmatter, as it calls ensureFrontmatter()
      // await convertNoteToFrontmatter(Editor, `triggers: ${triggerStringArg}`)

      // V2 trying to be smarter. Note: setFrontMatterVars also calls ensureFrontmatter() :-(
      const hasFMalready = noteHasFrontMatter(Editor)
      if (hasFMalready) {
        logDebug('addTriggerToNote', `- Editor "${displayTitle(Editor)}" already has frontmatter`)
        const res = setFrontMatterVars(Editor, { "triggers": triggerStringArg })
        logDebug('addTriggerToNote', `- result of setFrontMatterVars = ${String(res)}`)
      } else {
        logDebug('addTriggerToNote', `- Editor "${displayTitle(Editor)}" doesn't already have frontmatter`)
        await convertNoteToFrontmatter(Editor, `triggers: ${triggerStringArg}`)
      }
      return

    } else {

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
      const result: PluginCommandObject | string = await chooseOption("Pick the trigger to add", commandOptions)
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

      if (!choice) {
        throw new Error("Couldn't get a valid trigger choice for some reason. Stopping.")
      } else {
        // clo(choice, 'choice')
        // Get trigger type from either name or description
        triggerName = (TRIGGER_LIST.includes(choice.name))
          ? choice.name
          : (TRIGGER_LIST.includes(choice.desc)) ? choice.desc
            : 'onEditorWillSave' // default to onEditorWillSave if no trigger type is found
        triggerPluginID = choice.pluginID
        funcName = choice.name
      }
    }

    // Add trigger to note
    const res = await addTrigger(Editor, triggerName, triggerPluginID, funcName)
    if (res) {
      logDebug('addTriggerToNote', `Trigger ${triggerName} for ${triggerPluginID} func ${funcName} was added to note ${displayTitle(Editor)}`)
    } else {
      logError('addTriggerToNote', `Trigger ${triggerName} for ${triggerPluginID} func ${funcName} WASN'T added to note ${displayTitle(Editor)}`)
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
        `noteplan://x-callback-url/runPlugin?pluginID=jgclark.NoteHelpers&command=jump%20to%20heading&arg1=${encodeURIComponent(link)}`
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
    const res = await convertNoteToFrontmatter(thisNote, config.defaultFMText ?? '')
    logDebug('note/convertNoteToFrontmatter', `ensureFrontmatter() returned ${String(res)}.`)
  }
  catch (error) {
    logError(pluginJson, JSP(error))
    await showMessage(error.message)
    return
  }
}
