// @flow
// ----------------------------------------------------------------------------
// Functions to file [[note links]] from calendar notes to project notes.
// Jonathan Clark
// last updated 10.4.2023, for v1.1.0
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { addParasAsText, getFilerSettings, type FilerConfig } from './filerHelpers'
import moment from 'moment/min/moment-with-locales'
import { getSetting } from '@helpers/NPConfiguration'
import { hyphenatedDate, toLocaleDateTimeString } from '@helpers/dateTime'
import {
  clo, logDebug, logError, logInfo, logWarn,
  overrideSettingsWithEncodedTypedArgs,
} from '@helpers/dev'
import { displayTitle, rangeToString } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'
import { getNotesChangedInInterval } from '@helpers/NPnote'
import { findStartOfActivePartOfNote, parasToText } from '@helpers/paragraph'
import { getParagraphBlock, selectedLinesIndex } from '@helpers/NPParagraph'
import { NP_RE_note_title_link, RE_NOTE_TITLE_CAPTURE } from '@helpers/regex'
import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------

const pluginID = pluginJson['plugin.id']

//-----------------------------------------------------------------------------
// Wrappers that are called

export async function copyNoteLinks(): Promise<number> {
  const settings: FilerConfig = await getFilerSettings()
  settings.copyOrMove = "copy"
  // get current note
  const { note } = Editor
  if (!note) {
    logWarn(pluginID, `No note selected, so stopping.`)
    await showMessage("No note selected, so cannot run.")
    return NaN
  }
  // main call
  const result = await fileNoteLinks(note, settings, false)
  await showMessage(`${String(result)} note links copied from ${displayTitle(note)}`, 'OK', 'Move note links')
  return result
}

/**
 * Entry point for fileRecentNoteLinks, but will process any passed JSON parameters to override the settings object.
 * @param {?string} params - can pass parameter string e.g. '{"period": "mtd", "progressHeading": "Progress"}'
 * @returns {number} number of paragraphs copied
 */
export async function copyRecentNoteLinks(params: string = ''): Promise<number> {
  logDebug(pluginJson, `copyRecentNoteLinks: Starting with params '${params}'`)
  let settings: FilerConfig = await getFilerSettings()
  settings.copyOrMove = "copy"

  // If there are params passed, then we've been called by a template command (and so use those).
  if (params) {
    settings = overrideSettingsWithEncodedTypedArgs(settings, params)
    clo(settings, `- config after overriding with params '${params}'`)
  } else {
    // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
    clo(settings, '- settings without params')
  }

  // main call
  const result = await fileRecentNoteLinks(settings, false)
  if (!params) {
    await showMessage(`${String(result)} note links copied.`, 'OK', 'Copy recent note links')
  }
  return result
}

export async function moveNoteLinks(): Promise<number> {
  const settings: FilerConfig = await getFilerSettings()
  settings.copyOrMove = "move"
  // get current note
  const { note } = Editor
  if (!note) {
    logWarn(pluginID, `No note selected, so stopping.`)
    await showMessage("No note selected, so cannot run.")
    return NaN
  }
  // main call
  const result = await fileNoteLinks(note, settings, false)
  await showMessage(`${String(result)} note links moved from ${displayTitle(note)}`, 'OK', 'Move note links')
  return result
}

/**
 * Entry point for moveRecentNoteLinks, but will process any passed JSON parameters to override the settings object.
 * @param {?string} params - can pass parameter string e.g. '{"period": "mtd", "progressHeading": "Progress"}'
 * @returns {number} number of paragraphs moved
 */
export async function moveRecentNoteLinks(params: string = ''): Promise<number> {
  logDebug(pluginJson, `moveRecentNoteLinks: Starting with params '${params}'`)
  let settings: FilerConfig = await getFilerSettings()
  settings.copyOrMove = "move"

  // If there are params passed, then we've been called by a template command (and so use those).
  if (params) {
    settings = overrideSettingsWithEncodedTypedArgs(settings, params)
    clo(settings, `- config after overriding with params '${params}'`)
  } else {
    // If no params are passed, then we've been called by a plugin command (and so use defaults from config).
    clo(settings, '- settings without params')
  }

  // main call
  const result = await fileRecentNoteLinks(settings, false)
  if (!params) {
    await showMessage(`${String(result)} note links moved.`, 'OK', 'Move recent note links')
  }
  return result
}

//-----------------------------------------------------------------------------
// Main functions (not exposed)

/**
 * File note links from recent calendar notes to project note(s).
 * See various settings passed in the 'config' parameter object.
 * See above for entry points to this function.
 * @author @jgclark
 * @param {FilerConfig} settings object
 * @param {boolean} runInteractively?
 * @returns {number} - number of paragraphs filed
 */
async function fileRecentNoteLinks(config: FilerConfig, runInteractively: boolean = false): Promise<number> {
  try {
    // Get array of recent calendar notes
    const recentCalendarNotes = getNotesChangedInInterval(config.recentDays, ['Calendar'])
    logDebug(pluginJson, `fileRecentNoteLinks() starting with ${recentCalendarNotes.length} recent calendar notes from ${String(config.recentDays)} days`)

    // Run the filer on each in turn
    let filedItemCount = 0
    for (let thisNote of recentCalendarNotes) {
      const res = await fileNoteLinks(thisNote, config, runInteractively)
      if (res) filedItemCount++
    }
    logInfo(`fileRecentNoteLinks`, `-> ${String(filedItemCount)} paragraphs filed from ${String(recentCalendarNotes.length)} recent calendar notes`)
    return filedItemCount
  } catch (err) {
    logError(pluginJson, `fileRecentNoteLinks(): ${err.name}: ${err.message}`)
    return NaN
  }
}

/**
 * File note links from a calendar 'note' to project note(s).
 * See various settings passed in the 'config' parameter object.
 * @author @jgclark
 * @param {CoreNoteFields} note
 * @param {FilerConfig} config settings object
 * @param {boolean} runInteractively?
 * @returns {number} number of paragraphs filed
 */
async function fileNoteLinks(note: CoreNoteFields, config: FilerConfig, runInteractively: boolean = false): Promise<number> {
  try {
    let filedItemCount = 0
    logDebug('fileNoteLinks', `fileNoteLinks() starting to ${config.copyOrMove} links in ${note.filename}`)

    // translate from setting 'typesToFile' to the line types to include in the filing
    let typesToFile = []
    switch (config.typesToFile) {
      case "all lines":
        typesToFile = ['open', 'done', 'scheduled', 'cancelled', 'checklist', 'checklistDone', 'checklistScheduled', 'checklistCancelled', 'title', 'quote', 'list', 'empty', 'text', 'code'] // all but 'separator'
        break
      case "all but incomplete task/checklist items":
        typesToFile = ['done', 'cancelled', 'checklistDone', 'checklistCancelled', 'title', 'quote', 'list', 'empty', 'text', 'code'] // all but 'open', 'scheduled', 'checklist', 'checklistScheduled', 'separator'
        break
      case "only completed task/checklist items":
        typesToFile = ['done', 'cancelled', 'checklistDone', 'checklistCancelled', 'title']
        break
      case "only non-task/checklist items":
        typesToFile = ['title', 'quote', 'list', 'empty', 'text', 'code']
        break
      default:
        throw new Error(`Invalid 'typesToFile' setting: ${config.typesToFile}`)
    }
    logDebug('fileNoteLinks', `typesToFile from "${config.typesToFile}" = ${String(typesToFile)}`)

    // Get array of lines containing note links, filtering by the above types
    let noteLinkParas = note.paragraphs
      .filter((p) => p.content.match(NP_RE_note_title_link))
      .filter((p) => typesToFile.includes(p.type))

    // Check if this paragraph should be ignored
    if (noteLinkParas.length > 0 && config.ignoreNoteLinkFilerTag) {
      noteLinkParas = noteLinkParas.filter((p) => !p.content.match(config.ignoreNoteLinkFilerTag))
      logDebug('fileNoteLinks', `  - after ignore check, ${noteLinkParas.length} note links still present`)
    }

    // Does it make sense to proceed?
    if (noteLinkParas.length === 0) {
      logInfo('fileNoteLinks', `- no note links found in ${note.filename}`)
      if (runInteractively) {
        await showMessage(`Sorry, no note links found in ${note.filename}.`)
      }
      return NaN
    }
    logInfo('fileNoteLinks', `- ${noteLinkParas.length} note links found in ${note.filename}`)

    // Process each such note link line
    let latestBlockLineIndex = -1
    // let thisParaLineIndex = 0
    for (let thisPara of noteLinkParas) {
      let thisParaLineIndex = thisPara.lineIndex
      // If we previously had a block, then we need to make sure we're passed the end of the block before we start re-processing.
      if (thisParaLineIndex <= latestBlockLineIndex) {
        logDebug('fileNoteLinks', `- skipping line ${thisParaLineIndex}:<${thisPara.content}> as it is before the latest block line ${latestBlockLineIndex}`)
        continue // skip this paragraph as we will have seen it before
      }

      logDebug('fileNoteLinks', `- thisPara ${thisParaLineIndex}:<${thisPara.content}>`)
      // Get details of note (and perhaps heading) to file to from (first) [[note link]] in line
      const noteLinkParts = thisPara.content.match(RE_NOTE_TITLE_CAPTURE)
      if (!noteLinkParts) {
        throw new Error(`<${thisPara.content}> does not match RE_NOTE_TITLE_CAPTURE`)
      }
      // logDebug('fileNoteLinks', `- noteLinkParts: ${String(noteLinkParts)}`)
      const noteLinkTitle = noteLinkParts[1]
      const noteLinkHeading = noteLinkParts[2]
      const possibleNotes = DataStore.projectNoteByTitle(noteLinkTitle)
      if (!possibleNotes) {
        throw new Error(`'${noteLinkTitle}' could not be found in project notes`)
      }
      const noteToAddTo = possibleNotes[0]
      if (!noteToAddTo || !noteToAddTo.filename) {
        throw new Error(`could not find noteToAddTo.filename for some reason`)
      }
      logDebug('fileNoteLinks', `- found linked note '${noteLinkTitle}' ${noteLinkHeading ? "and heading '" + noteLinkHeading + "'" : "with no heading"} (filename: ${noteToAddTo.filename})`)

      let outputLines = []
      // Remove the [[name]] text by finding first example of the string points
      const thisParaWithoutNotelink = thisPara.content.replace(noteLinkParts[0], '').replace('  ', ' ')
      // logDebug('fileNoteLinks', `-> ${thisParaWithoutNotelink}`)

      let thisParaLineOrBlock: Array<TParagraph> = []
      // If user wants it, get its paragraph block from this point on
      if (config.useBlocks) {
        // include all paragraphs in this paragraph block
        thisParaLineOrBlock = getParagraphBlock(note, thisPara.lineIndex, config.includeFromStartOfSection, config.useTightBlockDefinition)
        latestBlockLineIndex += thisParaLineOrBlock.length - 1
        // now filter out the para types we don't want to include
        thisParaLineOrBlock = thisParaLineOrBlock.filter(para => typesToFile.includes(para.type))
      }
      // Or just use thisPara
      else {
        thisParaLineOrBlock = [thisPara] // as single-item array
      }
      // either way we need to remove the [[note link]] from the first paragraph in thisParaLineOrBlock
      thisParaLineOrBlock[0].content = thisParaWithoutNotelink

      logDebug('fileNoteLinks', `  - block has ${thisParaLineOrBlock.length} paragraphs:\n\t${thisParaLineOrBlock.map(p => String(p.lineIndex) + ': ' + p.content).join('\n\t')}`)

      // Add text to the new location in destination note
      // Note: can't use addParagraphBelowHeadingTitle() here because you can't specify H2-H5, but only H1 of type 'title'.
      const selectedParasAsText = thisParaLineOrBlock.map(p => p.rawContent).join('\n')
      if (noteLinkHeading) {
        // add after specified heading
        addParasAsText(noteToAddTo, selectedParasAsText, noteLinkHeading, config.whereToAddInSection, config.allowNotePreambleBeforeHeading)
        logDebug(pluginJson, `- Added parasAsText after '${noteLinkHeading}`)
      } else {

        // Note: can't use this API as it doesn't recognise front matter  (as of 3.8.1): noteToAddTo.prependParagraph(thisParaWithoutNotelink, thisPara.type)

        // work out what indicator to send to addParasAsText(), based on setting 'whereToAddInNote' (start or end)
        const positionInNoteIndicator = (config.whereToAddInNote === 'start') ? '<<top of note>>' : ''
        addParasAsText(noteToAddTo, selectedParasAsText, positionInNoteIndicator, config.whereToAddInSection, config.allowNotePreambleBeforeHeading)

        // // add after title or frontmatter
        // const insertionIndex = findStartOfActivePartOfNote(noteToAddTo)
        // noteToAddTo.insertParagraph(selectedParasAsText, insertionIndex, 'text')
        // logDebug(pluginJson, `- Added parasAsText after frontmatter/title line ${String(insertionIndex)}`)
      }

      // if we're doing 'move' not 'copy' then delete from existing location
      if (config.copyOrMove === 'move') {
        logDebug(pluginJson, `- Removing ${thisParaLineOrBlock.length} paras from original note`)
        note.removeParagraphs(thisParaLineOrBlock)
      }

      filedItemCount++
    }
    return filedItemCount
  }
  catch (err) {
    logError(pluginJson, `fileNoteLinks(): ${err.name}: ${err.message}`)
    return NaN
  }
}
