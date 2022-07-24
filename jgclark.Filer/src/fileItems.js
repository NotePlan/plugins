// @flow
// ----------------------------------------------------------------------------
// Plugin to help move selected Paragraphs to other notes
// Jonathan Clark
// last updated 24.7.2022 for v0.8.0+
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import {
  hyphenatedDate,
  toLocaleDateTimeString
} from '@helpers/dateTime'
import { logDebug, logError, logWarn } from '@helpers/dev'
// import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'
import {
  calcSmartPrependPoint,
  parasToText,
} from '@helpers/paragraph'
import { chooseHeading, showMessage } from '@helpers/userInput'
import {
  getParagraphBlock,
  selectedLinesIndex,
  // getSelectedParaIndex,
} from '@helpers/NPParagraph'

//-----------------------------------------------------------------------------
// Get settings

const pluginID = 'jgclark.Filer'

type FilerConfig = {
  addDateBacklink: boolean,
  dateRefStyle: string,
  useExtendedBlockDefinition: boolean,
  whereToAddInSection: string, // 'start' (default) or 'end'
}

export async function getFilerSettings(): Promise<any> {
  try {
    // Get settings using ConfigV2
    const v2Config: FilerConfig = await DataStore.loadJSON("../jgclark.Filer/settings.json")

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      logDebug(pluginJson, `getFilerSettings() cannot find '${pluginID}' plugin settings. Stopping.`)
      await showMessage(`Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    } else {
      // clo(v2Config, `${pluginID} settings from V2:`)
      return v2Config
    }
  } catch (err) {
    logError(pluginJson, `in getFilerSettings: ${err.name}: ${err.message}`)
    await showMessage(err.message)
  }
}

// ----------------------------------------------------------------------------

/**
 * Move text to a different note.
 * NB: Can't selecet dates with no existing Calendar note.
 * Note: Waiting for better date picker from Eduard before working further on this.
 *
 * This is how we identify what we're moving (in priority order):
 * - current selection
 * - current heading + its following section
 * - current line
 * - current line (plus any paragraphs directly following). NB: the Setting
 *   'useExtendedBlockDefinition' decides whether these directly following paragaphs
 *   have to be indented (false) or can take all following lines at same level until next
 *   empty line as well.
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
  const selection = Editor.selection
  if (selection == null) {
    logWarn(pluginJson, 'moveParas: No selection found, so stopping.')
    return
  }
  // Get paragraph indexes for the start and end of the selection (can be the same)
  const [firstSelParaIndex, lastSelParaIndex] = selectedLinesIndex(selection, paragraphs)
  // Get paragraphs for the selection or block
  const parasInBlock: Array<TParagraph> = (lastSelParaIndex !== firstSelParaIndex)
    ? selectedParagraphs.slice()   // copy to avoid $ReadOnlyArray problem
    : getParagraphBlock(note, firstSelParaIndex, config.useExtendedBlockDefinition)

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
  // Note: When written, there was no API function to deal with multiple 
  // selectedParagraphs, qbut we can insert a raw text string.
  // (can't simply use note.addParagraphBelowHeadingTitle() as we have more options than it supports)
  const selectedParasAsText = parasToText(parasInBlock)

  // Decide where to move to
  // Ask for the note we want to add the selectedParas
  const notes = allNotesSortedByChanged()

  const res = await CommandBar.showOptions(
    notes.map((n) => n.title ?? 'untitled'),
    `Select note to move ${parasInBlock.length} lines to`,
  )
  const destNote = notes[res.index]
  // Note: showOptions returns the first item if something else is typed. And I can't see a way to distinguish between the two.
  // logDebug(pluginJson, displayTitle(destNote)) // NB: -> first item in list (if a new item is typed)

  // Ask to which heading to add the selectedParas
  const headingToFind = (await chooseHeading(destNote, true, true, false))
  // logDebug(pluginJson, `  Moving to note: ${displayTitle(destNote)} under heading: '${headingToFind}'`)

  // Add text to the new location in destination note
  addParasAsText(destNote, selectedParasAsText, headingToFind, config.whereToAddInSection)

  // delete from existing location
  logDebug(pluginJson, `Removing ${parasInBlock.length} paras from original note`)
  note.removeParagraphs(parasInBlock)
}

/**
 * Move text to the current Weekly note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToThisWeekly(): Promise<void> {
  await moveParasToCalendarWeekly(new Date())
}

/**
 * Move text to the current Weekly note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToNextWeekly(): Promise<void> {
  await moveParasToCalendarWeekly(Calendar.addUnitToDate(new Date(), 'day', 7)) // + 1 week
}

/**
 * Move text to the current Weekly note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 * @param {Date} date of weekly note to move to
 */
export async function moveParasToCalendarWeekly(destDate: Date): Promise<void> {
  const { content, paragraphs, selectedParagraphs, note } = Editor
  // Get config settings
  const config = await getFilerSettings()

  // Pre-flight checks
  if (content == null || selectedParagraphs == null || note == null) {
    // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
    logWarn(pluginJson, 'No note open, so stopping.')
    return
  }
  if (NotePlan.environment.buildVersion < 801) {
    // Need to be running v3.6.0 (v802/801) or over for this feature
    // TODO: change this to .versionString < "3.6.0" if Eduard changes the logic
    await showMessage(`Sorry: you need to be running NotePlan v3.6.0 or higher for the Weekly note feature to work.`)
    logWarn(pluginJson, 'Need to be running NotePlan v3.6.0 or higher for the Weekly note feature to work.')
    return
  }
  // Find the Weekly note to move to
  const destNote = DataStore.calendarNoteByDate(destDate, 'week')
  if (destNote == null) {
    // Need to be running v3.6.0 or over for this feature
    await showMessage(`Sorry: I can't find the Weekly note for ${destDate.toLocaleDateString()}.`)
    logError(pluginJson, `Failed to open the Weekly note for ${destDate.toLocaleDateString()}. Stopping.`)
    return
  }

  // Get current selection, and its range
  const selection = Editor.selection
  if (selection == null) {
    logError(pluginJson, 'No selection found, so stopping.')
    return
  }
  // Get paragraph indexes for the start and end of the selection (can be the same)
  const [firstSelParaIndex, lastSelParaIndex] = selectedLinesIndex(selection, paragraphs)
  // Get paragraphs for the selection or block
  const parasInBlock: Array<TParagraph> = (lastSelParaIndex !== firstSelParaIndex)
    ? selectedParagraphs.slice()   // copy to avoid $ReadOnlyArray problem
    : getParagraphBlock(note, firstSelParaIndex, config.useExtendedBlockDefinition)

  // At the time of writing, there's no API function to work on multiple selectedParagraphs,
  // or one to insert an indented selectedParagraph, so we need to convert the selectedParagraphs
  // to a raw text version which we can include
  const selectedParasAsText = parasToText(parasInBlock)

  // Append text to the new location in destination note
  addParasAsText(destNote, selectedParasAsText, '', config.whereToAddInSection)

  // delete from existing location
  logDebug(pluginJson, `Removing ${parasInBlock.length} paras from original note`)
  note.removeParagraphs(parasInBlock)
}

/**
 * Move text to today's Daily note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToToday(): Promise<void> {
  await moveParasToCalendarDate(new Date()) // today
}

/**
 * Move text to tomorrow's Daily note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 */
export async function moveParasToTomorrow(): Promise<void> {
  await moveParasToCalendarDate(Calendar.addUnitToDate(new Date(), 'day', 1))// tomorrow
}

/**
 * Move text to a specified Daily note.
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 * @param {Date} date of daily note to move to
 */
export async function moveParasToCalendarDate(destDate: Date): Promise<void> {
  const { content, paragraphs, selectedParagraphs, note } = Editor
  // Get config settings
  const config = await getFilerSettings()

  // Pre-flight checks
  if (content == null || selectedParagraphs == null || note == null) {
    // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
    logError(pluginJson, 'No note open, so stopping.')
    return
  }
  // Find the Daily note to move to
  const destNote = DataStore.calendarNoteByDate(destDate, 'day')
  if (destNote == null) {
    // Need to be running v3.6.0 or over for this feature
    await showMessage(`Sorry: I can't find the Daily note for ${destDate.toLocaleDateString()}.`)
    logError(pluginJson, `Failed to open the Daily note for ${destDate.toLocaleDateString()}. Stopping.`)
    return
  }

  // Get current selection, and its range
  const selection = Editor.selection
  if (selection == null) {
    logError(pluginJson, 'No selection found, so stopping.')
    return
  }
  // Get paragraph indexes for the start and end of the selection (can be the same)
  const [firstSelParaIndex, lastSelParaIndex] = selectedLinesIndex(selection, paragraphs)
  // Get paragraphs for the selection or block
  const parasInBlock: Array<TParagraph> = (lastSelParaIndex !== firstSelParaIndex)
    ? selectedParagraphs.slice()   // copy to avoid $ReadOnlyArray problem
    : getParagraphBlock(note, firstSelParaIndex, config.useExtendedBlockDefinition)

  // At the time of writing, there's no API function to work on multiple selectedParagraphs,
  // or one to insert an indented selectedParagraph, so we need to convert the selectedParagraphs
  // to a raw text version which we can include
  const selectedParasAsText = parasToText(parasInBlock)

  // Append text to the new location in destination note
  addParasAsText(destNote, selectedParasAsText, '', config.whereToAddInSection)

  // delete from existing location
  logDebug(pluginJson, `Removing ${parasInBlock.length} paras from original note`)
  note.removeParagraphs(parasInBlock)
}


/**
 * Function to write text either to top of note, bottom of note, or after a heading
 * Note: When written, there was no API function to deal with multiple selectedParagraphs,
 * but we can insert a raw text string.
 * @author @jgclark
 * 
 * @param {TNote} destinationNote 
 * @param {string} selectedParasAsText 
 * @param {string} headingToFind if empty, means 'end of note'
 * @param {string} whereToAddInSection to add after a heading: 'start' or 'end'
 */
export function addParasAsText(
  destinationNote: TNote,
  selectedParasAsText: string,
  headingToFind: string,
  whereToAddInSection: string
): void {
  // (can't simply use note.addParagraphBelowHeadingTitle() as we have more options than it supports)
  const destinationNoteParas = destinationNote.paragraphs
  let insertionIndex = undefined
  if (headingToFind === destinationNote.title || headingToFind.includes('(top of note)')) {
    // i.e. the first line in project or calendar note
    insertionIndex = calcSmartPrependPoint(destinationNote)
    logDebug(pluginJson, `-> top of note, line ${insertionIndex}`)
    destinationNote.insertParagraph(selectedParasAsText, insertionIndex, 'text')

  } else if (headingToFind === '') {
    // blank return from chooseHeading has special meaning of 'end of note'
    insertionIndex = destinationNoteParas.length + 1
    logDebug(pluginJson, `-> bottom of note, line ${insertionIndex}`)
    destinationNote.insertParagraph(selectedParasAsText, insertionIndex, 'text')

  } else if (whereToAddInSection === 'start') {
    logDebug(pluginJson, `-> Inserting at start of section '${headingToFind}'`)
    destinationNote.addParagraphBelowHeadingTitle(selectedParasAsText, 'text', headingToFind, false, false)

  } else if (whereToAddInSection === 'end') {
    logDebug(pluginJson, `-> Inserting at end of section '${headingToFind}'`)
    destinationNote.addParagraphBelowHeadingTitle(selectedParasAsText, 'text', headingToFind, true, false)

  } else {
    // Shouldn't get here
    logError(pluginJson,`Can't find heading '${headingToFind}'. Stopping.`)
  }
}