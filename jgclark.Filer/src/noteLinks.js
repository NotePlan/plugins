// @flow
// ----------------------------------------------------------------------------
// Functions to file [[note links]] from calendar notes to project notes.
// Jonathan Clark
// last updated 18.3.2023, for v1.1.0
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { addParasAsText, getFilerSettings, type FilerConfig } from './filerHelpers'
import moment from 'moment/min/moment-with-locales'
import { getSetting } from '@helpers/NPConfiguration'
import { hyphenatedDate, toLocaleDateTimeString } from '@helpers/dateTime'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { displayTitle, rangeToString } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'
import { getNotesChangedInInterval } from '@helpers/NPnote'
import { findStartOfActivePartOfNote, parasToText } from '@helpers/paragraph'
import {
  getParagraphBlock,
  selectedLinesIndex,
  // getSelectedParaIndex,
} from '@helpers/NPParagraph'
import { NP_RE_note_title_link, RE_NOTE_TITLE_CAPTURE } from '@helpers/regex'
import { chooseHeading, showMessage } from '@helpers/userInput'

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
  const result = fileNoteLinks(note, settings)
  return result
}

export async function copyRecentNoteLinks(): Promise<number> {
  const settings: FilerConfig = await getFilerSettings()
  settings.copyOrMove = "copy"
  // main call
  const result = fileRecentNoteLinks(settings)
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
  const result = fileNoteLinks(note, settings)
  return result
}

export async function moveRecentNoteLinks(): Promise<number> {
  const settings: FilerConfig = await getFilerSettings()
  settings.copyOrMove = "move"
  // main call
  const result = fileRecentNoteLinks(settings)
  return result
}

//-----------------------------------------------------------------------------
// Main functions (not exposed)

/**
 * Move text to a different note, forcing treating this as a block.
 * See moveParas() for definition of selection logic.
 * Can be run as an on-demand command,
 * TODO: or as a template command with parameters.
 * @author @jgclark
 * @param {FilerConfig} settings object
 * @returns {number} - number of paragraphs filed
 */
async function fileRecentNoteLinks(config: FilerConfig): Promise<number> {
  try {
    // Get array of recent calendar notes
    const recentCalendarNotes = getNotesChangedInInterval(config.recentDays, ['Calendar'])
    logDebug(pluginJson, `fileRecentNoteLinks() starting with ${recentCalendarNotes.length} recent calendar notes from ${String(config.recentDays)} days`)

    // Run the filer on each in turn
    let filedItemCount = 0
    for (let thisNote of recentCalendarNotes) {
      const res = await fileNoteLinks(thisNote, config)
      if (res) filedItemCount++
    }
    logInfo(`fileRecentNoteLinks`, `-> ${String(filedItemCount)} paragraphs filed`)
    return filedItemCount
  } catch (err) {
    logError(pluginJson, `fileRecentNoteLinks(): ${err.name}: ${err.message}`)
    // await showMessage('Error: ' + err.message)
    return NaN
  }
}

/**
 * File note links from a calendar 'note' to project note(s).
 * See various settings passed in the 'config' parameter object.
 * @author @jgclark
 * @param {CoreNoteFields} note
 * @param {FilerConfig} config settings object
 * @returns {number} number of paragraphs filed
 */
function fileNoteLinks(note: CoreNoteFields, config: FilerConfig): number {
  try {
    let filedItemCount = 0
    logDebug('fileNoteLinks', `fileNoteLinks() starting to ${config.copyOrMove} links in ${note.filename}`)

    // Get array of lines containing note links (optionally just in completed items or headings)
    let noteLinkParas = note.paragraphs.filter((p) => p.content.match(NP_RE_note_title_link))
    if (config.justCompletedItems) {
      noteLinkParas = noteLinkParas.filter((p) => ['title', 'done', 'checklistDone'].includes(p.type))
    }
    logDebug('fileNoteLinks', `- ${noteLinkParas.length} note links found ${config.justCompletedItems ? 'in completed items' : ''}`)
    // Check if this paragraph should be ignored
    if (noteLinkParas.length > 0 && config.ignoreNoteLinkFilerTag) {
      noteLinkParas = noteLinkParas.filter((p) => !p.content.match(config.ignoreNoteLinkFilerTag))
      logDebug('fileNoteLinks', `  - after ignore check, ${noteLinkParas.length} note links still present`)
    }

    // Process each such note link line
    for (let thisPara of noteLinkParas) {
      // Get details of note (and perhaps heading) to file to from (first) [[note link]] in line
      const noteLinkParts = thisPara.content.match(RE_NOTE_TITLE_CAPTURE)
      if (!noteLinkParts) {
        throw new Error(`<${thisPara.content}> does not match RE_NOTE_TITLE_CAPTURE`)
      }
      logDebug('fileNoteLinks', `- noteLinkParts: ${String(noteLinkParts)}`)
      const noteLinkTitle = noteLinkParts[1]
      const noteLinkHeading = noteLinkParts[2]
      const possibleNotes = DataStore.projectNoteByTitle(noteLinkTitle)
      if (!possibleNotes) {
        throw new Error(`'${noteLinkTitle}' could not be found in project notes`)
      }
      const noteToAddTo = possibleNotes[0]
      logDebug('fileNoteLinks', `- found linked note '${noteLinkTitle}' heading '${noteLinkHeading}' (filename: ${noteToAddTo.filename})`)

      let outputLines = []
      // Remove the [[name]] text by finding first example of the string points
      const thisParaWithoutNotelink = thisPara.content.replace(noteLinkParts[0], '').replace('  ', ' ')
      // logDebug('fileNoteLinks', `-> ${thisParaWithoutNotelink}`)

      // If user wants it, get its paragraph block
      if (config.useBlocks) {
        const thisParaBlock: Array<TParagraph> = getParagraphBlock(note, thisPara.lineIndex, config.includeFromStartOfSection, config.useTightBlockDefinition)
        logDebug('fileNoteLinks', `  - block has ${thisParaBlock.length} paragraphs:\n\t${thisParaBlock.map(p => String(p.lineIndex) + ': ' + p.content).join('\n\t')}`)

        // Add text to the new location in destination note
        const selectedParasAsText = thisParaBlock.map(p => p.rawContent).join('\n')
        if (noteLinkHeading) {
          // add after specified heading
          addParasAsText(noteToAddTo, selectedParasAsText, noteLinkHeading, config.whereToAddInSection)
          logDebug(pluginJson, `- Added parasAsText after '${noteLinkHeading}`)
        } else {
          // add after title or frontmatter
          const insertionIndex = findStartOfActivePartOfNote(noteToAddTo)
          noteToAddTo.insertParagraph(selectedParasAsText, insertionIndex, 'text')
          logDebug(pluginJson, `- Added parasAsText after frontmatter/title line ${String(insertionIndex)}`)
        }

        // delete from existing location
        if (config.copyOrMove === 'move') {
          logDebug(pluginJson, `- Removing ${thisParaBlock.length} paras from original note`)
          note.removeParagraphs(thisParaBlock)
        }
      }
      else {
        // just work on thisPara
        // insert updated line(s) to the right section of the project note file

        if (noteLinkHeading) {
          // add after specified heading
          noteToAddTo.addParagraphBelowHeadingTitle(thisParaWithoutNotelink, thisPara.type, noteLinkHeading, (config.whereToAddInSection === 'end'), true)
        }
        else {
          // add after header lines, or end of file, as no heading specified
          if (config.whereToAddInSection === 'start') {
            // Note: can't use this API as it doesn't recognise front matter. As of 3.8.1
            // noteToAddTo.prependParagraph(thisParaWithoutNotelink, thisPara.type) 
            // Alternative method: TODO: remove in time
            const index = findStartOfActivePartOfNote(noteToAddTo)
            noteToAddTo.insertParagraphBeforeParagraph(thisParaWithoutNotelink, noteToAddTo.paragraphs[index], thisPara.type)
          } else {
            noteToAddTo.appendParagraph(thisParaWithoutNotelink, thisPara.type)
          }
          logDebug(pluginJson, `- Added 1 para <${thisParaWithoutNotelink}> to ${noteToAddTo.filename}`)
        }
        // Remove this line from the calendar note (if user wants to 'move' not 'copy')
        if (config.copyOrMove === 'move') {
          logDebug(pluginJson, `- Removing 1 para from original note`)
          note.removeParagraph(thisPara)
        }
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
