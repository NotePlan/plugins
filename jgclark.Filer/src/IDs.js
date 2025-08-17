// @flow
// ----------------------------------------------------------------------------
// Plugin to help link lines between notes with Line IDs
// Jonathan Clark
// last updated 2025-08-13 for v1.3.0
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { addParasAsText, getFilerSettings } from './filerHelpers'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allRegularNotesSortedByChanged } from '@helpers/note'
import { chooseNoteV2 } from '@helpers/NPnote'
// import { getSelectedParaIndex } from '@helpers/NPParagraph'
import { parasToText, smartAppendPara, smartPrependPara } from '@helpers/paragraph'
import { chooseHeadingV2 } from '@helpers/userInput'

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
    const firstSelParaIndex = selectedParagraphs[0].lineIndex
    let para = note.paragraphs[firstSelParaIndex]

    // Add Line ID for the first paragraph (known as 'blockID' by API)
    note.addBlockID(para) // in this case, note is Editor.note, which is not saved in realtime. This has been causing race conditions at times.
    note.updateParagraph(para)
    Editor.save() // save the note as well. Needs NP 3.9.3 (build 1053) or later
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
    const destNote = await chooseNoteV2('Select note to sync the line to', allRegularNotesSortedByChanged(), true, true, false, true)
    if (!destNote) {
      logWarn('addIDAndAddToOtherNote', `- No note chosen. Stopping.`)
      return
    }

    // Ask to which heading to add the selectedParas
    const headingToFind = await chooseHeadingV2(destNote, true, true, false)
    logDebug('addIDAndAddToOtherNote', `- Will add to note '${displayTitle(destNote)}' under heading: '${headingToFind}'`)

    // Add text to the new location in destination note
    // Note: handily, the blockId goes with it as part of the para.content
    if (headingToFind === '<<top of note>>') {
      // add to top of note
      smartPrependPara(destNote, selectedParasAsText, 'text')
    } else if (headingToFind === '<<bottom of note>>') {
      // add to bottom of note
      smartAppendPara(destNote, selectedParasAsText, 'text')
    } else {
      addParasAsText(destNote, selectedParasAsText, headingToFind, config.whereToAddInSection, true)
    }
  }
  catch (error) {
    logError('Filer/addIDAndAddToOtherNote', error.message)
  }
}
