// @flow
// ----------------------------------------------------------------------------
// Plugin to help move selected Paragraphs to other notes
// Jonathan Clark
// last updated 28.11.2022, for v1.0.0-beta
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getSetting } from '@helpers/NPConfiguration'
import {
  hyphenatedDate,
  toLocaleDateTimeString
} from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import {
  displayTitle,
  rangeToString
} from '@helpers/general'
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

const pluginID = pluginJson['plugin.id'] // was 'jgclark.Filer'

type FilerConfig = {
  addDateBacklink: boolean,
  dateRefStyle: string,
  includeFromStartOfSection: boolean,
  useTightBlockDefinition: boolean,
  whereToAddInSection: string, // 'start' (default) or 'end'
}

export async function getFilerSettings(): Promise<any> {
  try {
    // First get global setting 'useTightBlockDefinition'
    let useTightBlockDefinition = getSetting('np.Globals', 'useTightBlockDefinition')
    logDebug('getFilerSettings', `- useTightBlockDefinition: np.Globals: ${String(useTightBlockDefinition)}`)

    // Get settings using ConfigV2
    const v2Config: FilerConfig = await DataStore.loadJSON(`../${pluginID}/settings.json`)

    if (v2Config == null || Object.keys(v2Config).length === 0) {
      logError(pluginJson, `getFilerSettings() cannot find '${pluginID}' plugin settings. Stopping.`)
      await showMessage(`Cannot find settings for the '${pluginID}' plugin. Please make sure you have installed it from the Plugin Preferences pane.`)
      return
    } else {
      if (useTightBlockDefinition) {
        logDebug('getFilerSettings', `- using useTightBlockDefinition setting from np.Globals`)
        v2Config.useTightBlockDefinition = useTightBlockDefinition
      }
      clo(v2Config, `${pluginID} settings from V2:`)
      return v2Config
    }

  } catch (err) {
    logError(pluginJson, `GetFilerSettings(): ${err.name}: ${err.message}`)
    await showMessage('Error: ' + err.message)
  }
}

// ----------------------------------------------------------------------------

/**
 * Move text to a different note, forcing treating this as a block.
 * See moveParas() for definition of selection logic.
 * @author @jgclark
 */
export async function moveParaBlock(): Promise<void> {
  await moveParas(true)
}

/**
 * Move text to a different note.
 * NB: Can't select dates without an existing Calendar note.
 * Note: Waiting for better date picker from Eduard before working further on this.
 *
 * This is how we identify what we're moving (in priority order):
 * - current selection (if any)
 * - current heading + its following section (if 'withBlockContext' true)
 * - current line
 * - current line plus any paragraphs directly following, if 'withBlockContext' true).
 * NB: the Setting 'includeFromStartOfSection' decides whether these directly following paragaphs have to be indented (false) or can take all following lines at same level until next empty line as well.
 * @param {boolean?} withBlockContext?
 * @author @jgclark
 */
export async function moveParas(withBlockContext: boolean = false): Promise<void> {
  try {
    const { note, content, paragraphs, selection, selectedParagraphs } = Editor
    if (content == null || selectedParagraphs == null || note == null) {
      // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
      logWarn(pluginJson, 'moveParas: No note open, so stopping.')
      return
    }

    // Get config settings
    const config = await getFilerSettings()

    // Get current selection, and its range
    if (selection == null) {
      // Really a belt-and-braces check that the editor is active
      logError(pluginJson, 'moveParas: No selection found, so stopping.')
      return
    }

    // Get paragraph indexes for the start and end of the selection (can be the same)
    const [firstSelLineIndex, lastSelLineIndex] = selectedLinesIndex(selection, paragraphs)

    // Get paragraphs for the selection or block
    let parasInBlock: Array<TParagraph>
    if (lastSelLineIndex !== firstSelLineIndex) {
      // use only the selected paras
      logDebug(pluginJson, `moveParas: user has selected lineIndexes ${firstSelLineIndex}-${lastSelLineIndex}`)
      parasInBlock = selectedParagraphs.slice() // copy to avoid $ReadOnlyArray problem
    } else {
      // there is no user selection
      // now see whether user wants to work on the surrounding block or not
      if (withBlockContext) {
        // user has requested working on the surrounding block
        parasInBlock = getParagraphBlock(note, firstSelLineIndex, config.includeFromStartOfSection, config.useTightBlockDefinition)
        logDebug(pluginJson, `moveParas: move block of ${parasInBlock.length} paras`)
      } else {
        // user just wants to move the current line
        parasInBlock = selectedParagraphs.slice(0, 1) // just first para
        logDebug(pluginJson, `moveParas: move current para only`)
      }

      // Now attempt to highlight them to help user check all is well (but only works from v3.6.2, build 844)
      if (NotePlan.environment.buildVersion > 844) {
        const firstStartIndex = parasInBlock[0].contentRange?.start ?? null
        const lastEndIndex = parasInBlock[parasInBlock.length - 1].contentRange?.end ?? null
        if (firstStartIndex && lastEndIndex) {
          const parasCharIndexRange: TRange = Range.create(firstStartIndex, lastEndIndex)
          // logDebug(pluginJson, `- will try to highlight automatic block selection range ${rangeToString(parasCharIndexRange)}`)
          Editor.highlightByRange(parasCharIndexRange)
        }
      }
    }

    // If this is a calendar note we've moving from, and the user wants to
    // create a date backlink, then append backlink to the first selectedPara in parasInBlock
    if (config.addDateBacklink && note.type === 'Calendar') {
      const datePart: string =
        (config.dateRefStyle === 'link') ? ` >${hyphenatedDate(new Date())}`
          : (config.dateRefStyle === 'at') ? ` @${hyphenatedDate(new Date())}`
            : (config.dateRefStyle === 'date') ? ` (${toLocaleDateTimeString(new Date())})`
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
      `Select note to move ${(parasInBlock.length > 1) ? parasInBlock.length + ' lines' : 'current line'} to`,
    )
    const destNote = notes[res.index]
    // Note: showOptions returns the first item if something else is typed. And I can't see a way to distinguish between the two.

    // Ask to which heading to add the selectedParas
    const headingToFind = (await chooseHeading(destNote, true, true, false))
    logDebug(pluginJson, `- Moving to note '${displayTitle(destNote)}' under heading: '${headingToFind}'`)

    // Add text to the new location in destination note
    addParasAsText(destNote, selectedParasAsText, headingToFind, config.whereToAddInSection)

    // delete from existing location
    logDebug(pluginJson, `- Removing ${parasInBlock.length} paras from original note`)
    note.removeParagraphs(parasInBlock)
  }
  catch (error) {
    logError(pluginJson, error.message)
  }
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
 * (Not called directly by users.)
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 * @param {Date} date of weekly note to move to
 * @param {boolean?} withBlockContext?
 */
export async function moveParasToCalendarWeekly(destDate: Date, withBlockContext: boolean = false): Promise<void> {
  try {
    const { content, paragraphs, selectedParagraphs, note } = Editor
    // Get config settings
    const config = await getFilerSettings()

    // Pre-flight checks
    if (content == null || selectedParagraphs == null || note == null) {
      // No note open, or no selectedParagraph selection (empty note?), so don't do anything.
      logWarn(pluginJson, 'No note open, so stopping.')
      return
    }
    // Need to be running v3.6.0 (v802/801) or over for this feature
    if (NotePlan.environment.buildVersion < 801) {
      await showMessage(`Sorry: you need to be running NotePlan v3.6.0 or higher for the Weekly note feature to work.`)
      logWarn(pluginJson, 'Need to be running NotePlan v3.6.0 or higher for the Weekly note feature to work.')
      return
    }
    // Find the Weekly note to move to
    const destNote = DataStore.calendarNoteByDate(destDate, 'week')
    if (destNote == null) {
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
    let parasInBlock: Array<TParagraph>
    const [firstSelParaIndex, lastSelParaIndex] = selectedLinesIndex(selection, paragraphs)
    // Get paragraphs for the selection or block
    if (withBlockContext) {
      // user has requested working on the surrounding block
      parasInBlock = getParagraphBlock(note, firstSelParaIndex, config.includeFromStartOfSection, config.useTightBlockDefinition)
      logDebug(pluginJson, `moveParas: move block of ${parasInBlock.length} paras`)
    } else {
      // user just wants to move the current line
      parasInBlock = selectedParagraphs.slice(0, 1) // just first para
      logDebug(pluginJson, `moveParas: move current para only`)
    }

    // FIXME: check options here
    // const parasInBlock: Array<TParagraph> = (lastSelParaIndex !== firstSelParaIndex)
    //   ? selectedParagraphs.slice()   // copy to avoid $ReadOnlyArray problem
    //   : getParagraphBlock(note, firstSelParaIndex, config.includeFromStartOfSection, config.useTightBlockDefinition)


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
  catch (error) {
    logError(pluginJson, error.message)
  }
}

// -----------------------------------------------------------------

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
 * (Not called directly by users.)
 * Uses the same selection strategy as moveParas() above
 * @author @jgclark
 * @param {Date} date of daily note to move to
 * @param {boolean?} withBlockContext?
 */
export async function moveParasToCalendarDate(destDate: Date, withBlockContext: boolean = false): Promise<void> {
  try {
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
    let parasInBlock: Array<TParagraph>
    if (withBlockContext) {
      // user has requested working on the surrounding block
      parasInBlock = getParagraphBlock(note, firstSelParaIndex, config.includeFromStartOfSection, config.useTightBlockDefinition)
      logDebug(pluginJson, `moveParas: move block of ${parasInBlock.length} paras`)
    } else {
      // user just wants to move the current line
      parasInBlock = selectedParagraphs.slice(0, 1) // just first para
      logDebug(pluginJson, `moveParas: move current para only`)
    }

    // FIXME: update this
    // const parasInBlock: Array<TParagraph> = (lastSelParaIndex !== firstSelParaIndex)
    //   ? selectedParagraphs.slice()   // copy to avoid $ReadOnlyArray problem
    //   : getParagraphBlock(note, firstSelParaIndex, config.includeFromStartOfSection, config.useTightBlockDefinition)

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
  catch (error) {
    logError(pluginJson, error.message)
  }
}

/**
 * Function to write text either to top of note, bottom of note, or after a heading
 * Note: When written, there was no API function to deal with multiple selectedParagraphs,
 * but we can insert a raw text string.
 * Note: now can't simply use note.addParagraphBelowHeadingTitle() as we have more options than it supports
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
  const destinationNoteParas = destinationNote.paragraphs
  let insertionIndex: number
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