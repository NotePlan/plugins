// @flow
// ----------------------------------------------------------------------------
// Plugin to help move selected selectedParagraphs to other notes
// Jonathan Clark
// last updated 17.5.2022 for v0.7.0
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getFilerSettings } from './fileItems'
import { clo, log, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { showMessage } from '@helpers/userInput'
import { allNotesSortedByChanged } from '@helpers/note'
import {
  calcSmartPrependPoint,
  // findEndOfActivePartOfNote,
  // findStartOfActivePartOfNote,
  parasToText,
  selectedLinesIndex,
} from '@helpers/paragraph'
import { chooseHeading } from '@helpers/userInput'
import { getSelectedParaIndex } from '../../jgclark.Summaries/src/progress' // TODO: shift this to helpers/?

//-----------------------------------------------------------------------------

/**
 * Add a line/block ID to current line, and ask which note's heading (section)
 * to also add it to.
 */
export async function addIDAndAddToOtherNote(): Promise<void> {
  const { content, paragraphs, selectedParagraphs, note } = Editor
  if (content == null || selectedParagraphs == null || note == null) {
    // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
    logWarn(pluginJson, 'No note open, so stopping.')
    return
  }

  // Get config settings
  const config = await getFilerSettings()

  // Get current paragraph
  const firstSelParaIndex = getSelectedParaIndex()
  const para = paragraphs[firstSelParaIndex]
  const paraType = para.type

  // Add Block ID for the first paragraph 
  note.addBlockID(para)
  note.updateParagraph(para)
  const newBlockID = para.blockId
  if (newBlockID) {
    log(pluginJson, `blockId added: '${newBlockID}'`)
  } else {
    logError(pluginJson, `no blockId created. Stopping.`)
    return
  }

  // turn into text, for reasons given in moveParas()
  const selectedParasAsText = parasToText([para]) // i.e. turn single para into a single-iterm array
  
  // Decide where to copy the line to
  const notes = allNotesSortedByChanged()
  const res = await CommandBar.showOptions(
    notes.map((n) => n.title ?? 'untitled'),
    `Select note to copy the line to`,
  )
  const destNote = notes[res.index]
  // Note: showOptions returns the first item if something else is typed. And I can't see a way to distinguish between the two.
  log(pluginJson, displayTitle(destNote)) // NB: -> first item in list (if a new item is typed)

  // Ask to which heading to add the selectedParas
  const headingToFind = (await chooseHeading(destNote, true, true, false))
  // log(pluginJson, `  Adding to note: ${displayTitle(destNote)} under heading: '${headingToFind}'`)

  // Add to new location
  // Note: When written, there was no API function to deal with multiple
  // selectedParagraphs, but we can insert a raw text string.
  // (can't simply use note.addParagraphBelowHeadingTitle() as we have more options than it supports)
  // TODO: when the following has been tested, make a common function out of it for this and for moveParas()
  const destNoteParas = destNote.paragraphs
  let insertionIndex = undefined
  if (headingToFind === destNote.title || headingToFind.includes('(top of note)')) { // i.e. the first line in project or calendar note
    insertionIndex = calcSmartPrependPoint(destNote)
    log(pluginJson, `  -> top of note, line ${insertionIndex}`)
    await destNote.insertParagraph(selectedParasAsText, insertionIndex, 'text')

  } else if (headingToFind.includes('(bottom of note)')) {
    insertionIndex = destNoteParas.length + 1
    log(pluginJson, `  -> bottom of note, line ${insertionIndex}`)
    await destNote.insertParagraph(selectedParasAsText, insertionIndex, 'text')

  } else if (config.whereToAddInSection === 'start') {
    log(pluginJson, `  Inserting at start of section ${headingToFind}`)
    await destNote.addParagraphBelowHeadingTitle(selectedParasAsText, 'text', headingToFind, false, false)

  } else if (config.whereToAddInSection === 'end') {
    log(pluginJson, `  Inserting at end of section ${headingToFind}`)
    await destNote.addParagraphBelowHeadingTitle(selectedParasAsText, 'text', headingToFind, true, false)

  } else {
    logError(pluginJson,`Can't find heading '${headingToFind}'. Stopping.`)
    return
  }

  // NB: handily, the blockId goes with it as part of the para.content
  // log(pluginJson, `Inserting 1 para at index ${insertionIndex} into ${displayTitle(destNote)}`)
  // await destNote.insertParagraph(para.content, insertionIndex, paraType)  
}
