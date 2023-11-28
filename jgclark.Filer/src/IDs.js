// @flow
// ----------------------------------------------------------------------------
// Plugin to help link lines between notes with Line IDs
// Jonathan Clark
// last updated 1.9.2023 for v0.7.0+
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { addParasAsText, getFilerSettings } from './filerHelpers'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allNotesSortedByChanged } from '@helpers/note'
import { getSelectedParaIndex } from '@helpers/NPParagraph'
import { parasToText } from '@helpers/paragraph'
import { chooseHeading } from '@helpers/userInput'

//-----------------------------------------------------------------------------

/**
 * Add a 'blockId' to current line, and ask which note's heading (section)
 * to also add it to.
 */
export async function addIDAndAddToOtherNote(): Promise<void> {
  try {
    const { note, content, selectedParagraphs } = Editor
    if (content == null || selectedParagraphs == null || note == null) {
      // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
      logWarn(pluginJson, 'No note open, so stopping.')
      return
    }

    // Get config settings
    const config = await getFilerSettings()

    // Get current paragraph
    const firstSelParaIndex = selectedParagraphs[0].lineIndex //getSelectedParaIndex()
    let para = note.paragraphs[firstSelParaIndex]

    // Add Line ID for the first paragraph (known as 'blockID' by API)
    note.addBlockID(para) // in this case, note is Editor.note, which is not saved in realtime. This has been causing race conditions at times.
    note.updateParagraph(para)
    if (NotePlan.environment.buildVersion >= 1053) {
      await Editor.save() // attempt to save this before reading it again (if running NP 3.9.3+)
    }
    para = note.paragraphs[firstSelParaIndex] // refresh para
    const newBlockID = para.blockId
    if (newBlockID) {
      logDebug(pluginJson, `- blockId added: '${newBlockID}'`)
    } else {
      logError(pluginJson, `- no blockId created. Stopping.`)
      return
    }

    // turn into text, for reasons given in moveParas()
    const selectedParasAsText = parasToText([para]) // i.e. turn single para into a single-iterm array

    // Decide where to copy the line to
    const allNotes = allNotesSortedByChanged()
    const res = await CommandBar.showOptions(
      allNotes.map((n) => n.title ?? 'untitled'),
      `Select note to copy the line to`,
    )
    const destNote = allNotes[res.index]
    // Note: showOptions returns the first item if something else is typed. And I can't see a way to distinguish between the two.

    // Ask to which heading to add the selectedParas
    const headingToFind = await chooseHeading(destNote, true, true, false)
    logDebug(pluginJson, `- Will add to note '${displayTitle(destNote)}' under heading: '${headingToFind}'`)

    // Add text to the new location in destination note
    addParasAsText(destNote, selectedParasAsText, headingToFind, config.whereToAddInSection, true)

    // NB: handily, the blockId goes with it as part of the para.content
    // logDebug(pluginJson, `- Inserting 1 para at index ${insertionIndex} into ${displayTitle(destNote)}`)
    // await destNote.insertParagraph(para.content, insertionIndex, paraType)
  }
  catch (error) {
    logError(pluginJson, error.message)
  }
}
