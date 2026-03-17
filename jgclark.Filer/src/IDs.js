// @flow
// ----------------------------------------------------------------------------
// Plugin to help link lines between notes with Line IDs
// Jonathan Clark
// last updated 2025-11-24 for v1.3.4
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getFilerSettings } from './filerHelpers'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { getSelectedParagraphsToUse } from '@helpers/NPEditor'
import { displayTitle } from '@helpers/general'
import { allRegularNotesSortedByChanged } from '@helpers/note'
import { chooseNoteV2 } from '@helpers/NPnote'
import { highlightSelectionInEditor } from '@helpers/NPParagraph'
import { addParagraphsToNote, parasToText, smartAppendPara, smartPrependPara } from '@helpers/paragraph'
import { chooseHeadingV2 } from '@helpers/userInput'

//-----------------------------------------------------------------------------

/**
 * Add a 'blockId' to current line, and ask which note's heading (section)
 * to also add it to.
 */
export async function addIDAndAddToOtherNote(): Promise<void> {
  try {
    const { note, content, selectedParagraphs, selection } = Editor
    if (content == null || selectedParagraphs == null || note == null) {
      // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
      logWarn(pluginJson, 'No note open, so stopping.')
      return
    }
    // Get current selection, and its range
    if (selection == null) {
      // Really a belt-and-braces check that the editor is active
      logError(pluginJson, 'moveParas: No selection found, so stopping.')
      return
    }
    const config = await getFilerSettings()
    logDebug(pluginJson, `Filer/addIDAndAddToOtherNote() starting for note '${displayTitle(note)}'`)

    // Work out which paragraph to add the line ID to
    const selectedParagraphsToUse = getSelectedParagraphsToUse()
    logDebug('addIDAndAddToOtherNote', `selectedParagraphsToUse:\n${String(selectedParagraphsToUse.map((p) => `- ${p.lineIndex}: ${p.content}`).join('\n'))}`)
    const numSelectedParas = selectedParagraphsToUse.length
    const firstPara = selectedParagraphsToUse[0]
    logDebug('addIDAndAddToOtherNote', `- first selected para (of ${String(numSelectedParas)}): #${firstPara.lineIndex} {${firstPara.content}}`)

    // Attempt to highlight them to help user check all is well
    highlightSelectionInEditor(selectedParagraphsToUse)

    // Decide where to copy the para(s) to
    const lineCountStr = (numSelectedParas > 1) ? `${numSelectedParas} lines` : 'current line'
    const destNote = await chooseNoteV2(`Select note to sync the ${lineCountStr} to`, allRegularNotesSortedByChanged(), true, true, false, true)
    if (!destNote) {
      logWarn('addIDAndAddToOtherNote', `- No note chosen. Stopping.`)
      return
    }

    // Ask to which heading to add the selectedParas
    const headingToFind = await chooseHeadingV2(destNote, true, true, false)
    logDebug('addIDAndAddToOtherNote', `- Will add to note '${displayTitle(destNote)}' under heading: '${headingToFind}'`)

    // Add Line ID for each paragraph (known as 'blockID' by API), using the same destination note and heading
    // TODO: Works for 1 para OK. But for >1 para they are synced in reverse order.
    for (const para of selectedParagraphsToUse) {
      note.addBlockID(para) // in this case, note is Editor.note, which is not saved in realtime. This has been causing race conditions at times.
      note.updateParagraph(para)
      Editor.save() // save the note as well
      const newBlockID = para.blockId
      if (newBlockID) {
        logDebug('addIDAndAddToOtherNote', `- blockId present: {${para.rawContent}}`)
      } else {
        logError('addIDAndAddToOtherNote', `- no blockId created. Stopping.`)
        return
      }
    }

    // Add the selected paras with added blockIds to the new location in destination note
    // Note: handily, the blockId goes with it as part of the para.content
    if (headingToFind === '<<top of note>>') {
      // add to top of note
      smartPrependPara(destNote, parasToText(selectedParagraphsToUse), 'text')
    } else if (headingToFind === '<<bottom of note>>') {
      // add to bottom of note
      smartAppendPara(destNote, parasToText(selectedParagraphsToUse), 'text')
    } else {
      addParagraphsToNote(destNote, selectedParagraphsToUse, headingToFind, config.whereToAddInSection, true) // true = allow preamble before heading
    }

    // unhighlight the previous selection, for safety's sake
    const emptyRange: TRange = Range.create(0, 0)
    Editor.highlightByRange(emptyRange)
  }
  catch (error) {
    logError('Filer/addIDAndAddToOtherNote', error.message)
  }
}
