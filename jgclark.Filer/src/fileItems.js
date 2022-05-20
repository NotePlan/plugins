// @flow
// ----------------------------------------------------------------------------
// Plugin to help move selected selectedParagraphs to other notes
// Jonathan Clark
// last updated 20.5.2022 for v0.7.0
// ----------------------------------------------------------------------------
// TODO: update the Locale string when the environment() API call is available

import pluginJson from "../plugin.json"
import { castBooleanFromMixed, castStringFromMixed, } from '@helpers/dataManipulation'
import {
  hyphenatedDate,
  todaysDateISOString,
  toLocaleDateTimeString
} from '@helpers/dateTime'
import { clo, log, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'
import {
  calcSmartPrependPoint,
  findEndOfActivePartOfNote,
  findStartOfActivePartOfNote,
  parasToText,
  selectedLinesIndex,
} from '@helpers/paragraph'
import { chooseHeading, showMessage } from '@helpers/userInput'
import { getParagraphBlock, getSelectedParaIndex } from '@helpers/paragraph'

//-----------------------------------------------------------------------------
// Get settings

const configKey = 'filer'

type FilerConfig = {
  addDateBacklink: boolean,
  dateRefStyle: string,
  whereToAddInSection: string,
}

export async function getFilerSettings(): Promise<any> {
  let config: FilerConfig
  try {
    // Get settings using ConfigV2
    const v2Config: FilerConfig = await DataStore.loadJSON("../jgclark.Filer/settings.json")

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      log(pluginJson, `getFilerSettings() cannot find '${configKey}' plugin settings. Stopping.`)
      await showMessage(`Cannot find settings for the '${configKey}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    } else {
      // clo(v2Config, `${configKey} settings from V2:`)
      return v2Config
    }
  } catch (err) {
    logError(pluginJson, `in getFilerSettings: ${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

// ----------------------------------------------------------------------------

/**
 * Move paragraph(s) to a different note.
 * NB: Can't select dates with no existing Calendar note.
 * Note: Waiting for better date picker from Eduard before working further on this.
 *
 * This is how we identify what we're moving (in priority order):
 * - current selection
 * - current line
 * @author @jgclark
 */
export async function moveParas(): Promise<void> {
  const { content, paragraphs, selectedParagraphs, note } = Editor
  if (content == null || selectedParagraphs == null || note == null) {
    // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
    logWarn(pluginJson, 'moveParas: No note open, so stopping.')
    return
  }

  // Get config settings
  const config = await getFilerSettings()

  // Get current selection, and its range
  // TODO: Check paragraph.js for getSelectedParaIndex() which does some of this.
  //       Is it as simple as?:   const firstSelParaIndex = getSelectedParaIndex()
  const selection = Editor.selection
  if (selection == null) {
    logWarn(pluginJson, 'moveParas: No selection found, so stopping.')
    return
  }

  // Get paragraph indexes for the start and end of the selection (can be the same)
  // const firstSelParaIndex = selectedLinesIndex(selection, paragraphs)
  const [firstSelParaIndex, lastSelParaIndex] = selectedLinesIndex(selection, paragraphs)

  // Get paragraphs for the selection or block
  const parasInBlock: Array<TParagraph> = (lastSelParaIndex != firstSelParaIndex)
    ? selectedParagraphs.slice()   // copy to avoid $ReadOnlyArray problem
    : getParagraphBlock(note, firstSelParaIndex, false)

  // If this is a calendar note we've moving from, and the user wants to
  // create a date backlink, then append backlink to the first selectedPara in parasInBlock
  if (config.addDateBacklink && note.type === 'Calendar') {
    const datePart: string = 
        (config.dateLinkStyle === 'link') ? ` >${hyphenatedDate(new Date())}`
        : (config.dateLinkStyle === 'at') ? ` @${hyphenatedDate(new Date())}`
          : (config.dateLinkStyle === 'date') ? ` (${toLocaleDateTimeString(new Date())})`
            : ''
    parasInBlock[0].content = `${parasInBlock[0].content} ${datePart}`
  }
  // At the time of writing, there's no API function to work on multiple selectedParagraphs,
  // or one to insert an indented selectedParagraph, so we need to convert the selectedParagraphs
  // to a raw text version which we can include
  const selectedParasAsText = parasToText(parasInBlock)

  // Decide where to move to
  // Ask for the note we want to add the selectedParas
  const notes = allNotesSortedByChanged()

  const res = await CommandBar.showOptions(
    notes.map((n) => n.title ?? 'untitled'),
    `Select note to move ${parasInBlock.length} lines to`,
  )
  const destNote = notes[res.index]

  // Ask to which heading to add the selectedParas
  const headingToFind = (await chooseHeading(destNote, true, true, false))
  // log(pluginJson, `  Moving to note: ${displayTitle(destNote)} under heading: '${headingToFind}'`)

  // Add text to the new location in destination note
  await addParasAsText(destNote, selectedParasAsText, headingToFind, config.whereToAddInSection)

  // delete from existing location
  log(pluginJson, `Removing ${parasInBlock.length} paras from original note`)
  note.removeParagraphs(parasInBlock)
}


/**
 * Move text block to a different note.
 * NB: Can't selecet dates with no existing Calendar note.
 * Note: Waiting for better date picker from Eduard before working further on this.
 *
 * This is how we identify what we're moving (in priority order):
 * - current heading + its following section
 * - current line
 * - current line (plus any paragraphs directly following). NB: the Setting
 *   'useExtendedBlockDefinition' decides whether these directly following paragaphs
 *   have to be indented (false) or can take all following lines at same level until next
 *   empty line as well.
 * @author @jgclark
 */
export async function moveBlock(): Promise<void> {
  const { content, paragraphs, selection, selectedParagraphs, note } = Editor
  if (note == null || content == null) {
    // No note open, or empty note, so don't do anything.
    logWarn(pluginJson, 'moveBlock: No note open, so stopping.')
    return
  }

  // Get config settings
  const config = await getFilerSettings()

  // Get paragraph indexes for the start and end of the selection (can be the same)
  // const firstSelParaIndex = selectedLinesIndex(selection, paragraphs)
  // const [firstSelParaIndex, lastSelParaIndex] = selectedLinesIndex(selection, paragraphs)
  const firstSelParaIndex = selectedParagraphs.slice()[0].lineIndex
  log(pluginJson, firstSelParaIndex)

  // Get paragraphs for this block
  const parasInBlock: Array<TParagraph> = getParagraphBlock(note, firstSelParaIndex, true)
  log(pluginJson, parasInBlock.length)
  log(pluginJson, parasInBlock[0].content)

  // If this is a calendar note we've moving from, and the user wants to
  // create a date backlink, then append backlink to the first selectedPara in parasInBlock
  if (config.addDateBacklink && note.type === 'Calendar') {
    const datePart: string =
      (config.dateLinkStyle === 'link') ? ` >${hyphenatedDate(new Date())}`
        : (config.dateLinkStyle === 'at') ? ` @${hyphenatedDate(new Date())}`
          : (config.dateLinkStyle === 'date') ? ` (${toLocaleDateTimeString(new Date())})`
            : ''
    parasInBlock[0].content = `${parasInBlock[0].content} ${datePart}`
  }
  // At the time of writing, there's no API function to work on multiple selectedParagraphs,
  // or one to insert an indented selectedParagraph, so we need to convert the selectedParagraphs
  // to a raw text version which we can include
  const selectedParasAsText = parasToText(parasInBlock)

  // Decide where to move to
  // Ask for the note we want to add the selectedParas
  const notes = allNotesSortedByChanged()
  const res = await CommandBar.showOptions(
    notes.map((n) => n.title ?? 'untitled'),
    `Select note to move ${parasInBlock.length} lines to`,
  )
  const destNote = notes[res.index]

  // Ask to which heading to add the selectedParas
  const headingToFind = (await chooseHeading(destNote, true, true, false))
  // log(pluginJson, `  Moving to note: ${displayTitle(destNote)} under heading: '${headingToFind}'`)

  // Add text to the new location in destination note
  await addParasAsText(destNote, selectedParasAsText, headingToFind, config.whereToAddInSection)

  // delete from existing location
  log(pluginJson, `Removing ${parasInBlock.length} paras from original note`)
  note.removeParagraphs(parasInBlock)
}

/**
 * Function to write text either to top of note, bottom of note, or after a heading
 * Note: When written, there was no API function to deal with multiple  selectedParagraphs, but we can insert a raw text string.
 * This might no longer be needed.
 * @author @jgclark
 * 
 * @param {TNote} destinationNote 
 * @param {string} selectedParasAsText 
 * @param {string} headingToFind 
 * @param {string} whereToAddInSection to add after a heading: 'start' or 'end'
 */
export async function addParasAsText(destinationNote: TNote, selectedParasAsText: string, headingToFind: string, whereToAddInSection: string): Promise<void> {
  // (can't simply use note.addParagraphBelowHeadingTitle() as we have more options than it supports)
  const destinationNoteParas = destinationNote.paragraphs
  let insertionIndex = undefined
  if (headingToFind === destinationNote.title || headingToFind.includes('(top of note)')) {
    // i.e. the first line in project or calendar note
    insertionIndex = calcSmartPrependPoint(destinationNote)
    log(pluginJson, `  -> top of note, line ${insertionIndex}`)
    await destinationNote.insertParagraph(selectedParasAsText, insertionIndex, 'text')

  } else if (headingToFind === '') {
    // blank return from chooseHeading has special meaning of 'end of note'
    insertionIndex = destinationNoteParas.length + 1
    log(pluginJson, `  -> bottom of note, line ${insertionIndex}`)
    await destinationNote.insertParagraph(selectedParasAsText, insertionIndex, 'text')

  } else if (whereToAddInSection === 'start') {
    log(pluginJson, `  -> Inserting at start of section '${headingToFind}'`)
    await destinationNote.addParagraphBelowHeadingTitle(selectedParasAsText, 'text', headingToFind, false, false)

  } else if (whereToAddInSection === 'end') {
    log(pluginJson, `  -> Inserting at end of section '${headingToFind}'`)
    await destinationNote.addParagraphBelowHeadingTitle(selectedParasAsText, 'text', headingToFind, true, false)

  } else {
    // Shouldn't get here
    logError(pluginJson,`Can't find heading '${headingToFind}'. Stopping.`)
  }
}