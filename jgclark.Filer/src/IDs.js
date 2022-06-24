// @flow
// ----------------------------------------------------------------------------
// Plugin to help link lines between notes with Line IDs
// Jonathan Clark
// last updated 18.5.2022 for v0.7.0+
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getFilerSettings, addParasAsText } from './fileItems'
import { log, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'
import { getSelectedParaIndex } from '@helpers/NPParagraph'
import {
  // calcSmartPrependPoint,
  parasToText,
  // selectedLinesIndex,
} from '@helpers/paragraph'
import { chooseHeading } from '@helpers/userInput'
// import { showMessage } from '@helpers/userInput'

//-----------------------------------------------------------------------------

/**
 * Add a 'blockId' to current line, and ask which note's heading (section)
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

  // Add Line ID for the first paragraph (known as 'blockID' by API)
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

  // Add text to the new location in destination note
  await addParasAsText(destNote, selectedParasAsText, headingToFind, config.whereToAddInSection)

  // NB: handily, the blockId goes with it as part of the para.content
  // log(pluginJson, `Inserting 1 para at index ${insertionIndex} into ${displayTitle(destNote)}`)
  // await destNote.insertParagraph(para.content, insertionIndex, paraType)  
}
