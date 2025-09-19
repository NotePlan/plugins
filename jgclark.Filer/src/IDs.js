// @flow
// ----------------------------------------------------------------------------
// Plugin to help link lines between notes with Line IDs
// Jonathan Clark
// last updated 2025-08-30 for v1.3.1
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { getFilerSettings, highlightSelectionInEditor } from './filerHelpers'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { allRegularNotesSortedByChanged } from '@helpers/note'
// import { getFrontmatterParagraphs } from '@helpers/NPFrontMatter'
import { chooseNoteV2 } from '@helpers/NPnote'
import { addParagraphsToNote, parasToText, smartAppendPara, smartPrependPara } from '@helpers/paragraph'
import { chooseHeadingV2 } from '@helpers/userInput'
import { getSelectedParagraphLineIndex } from '@helpers/NPParagraph'

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
    const firstSelParaIndex = selectedParagraphs[0].lineIndex
    logDebug('addIDAndAddToOtherNote', `- firstSelParaIndex = ${String(firstSelParaIndex)} for {${selectedParagraphs[0].content}}`) // ❌
    // const otherMethod = await getSelectedParagraphLineIndex()
    // logDebug('addIDAndAddToOtherNote', `- otherMethod = ${String(otherMethod)}`)

    // // Check .selection as well // ✅
    // if (selection) {
    //   clo(selection, `selection`)
    // }

    // TEST: that this is now not needed
    // // Nasty fudge for Frontmatter is now required if it exists: add the number of lines of frontmatter to the index
    // const frontmatterParas = getFrontmatterParagraphs(note, true)
    // if (frontmatterParas && frontmatterParas.length > 0) {
    //   firstSelParaIndex += frontmatterParas.length
    //   logDebug('addIDAndAddToOtherNote', `- added ${frontmatterParas.length} lines of frontmatter to firstSelParaIndex => ${firstSelParaIndex}`)
    // }
    let para = note.paragraphs[firstSelParaIndex]

    // Attempt to highlight them to help user check all is well
    // $FlowIgnore[incompatible-call] just a readonly array issue
    highlightSelectionInEditor([para])

    // Add Line ID for the first paragraph (known as 'blockID' by API)
    note.addBlockID(para) // in this case, note is Editor.note, which is not saved in realtime. This has been causing race conditions at times.
    note.updateParagraph(para)
    Editor.save() // save the note as well. Needs NP 3.9.3 (build 1053) or later
    para = note.paragraphs[firstSelParaIndex] // refresh para
    const newBlockID = para.blockId
    if (newBlockID) {
      logDebug('addIDAndAddToOtherNote', `- blockId added: '${newBlockID}'`)
    } else {
      logError('addIDAndAddToOtherNote', `- no blockId created. Stopping.`)
      return
    }

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
      smartPrependPara(destNote, parasToText([para]), 'text')
    } else if (headingToFind === '<<bottom of note>>') {
      // add to bottom of note
      smartAppendPara(destNote, parasToText([para]), 'text')
    } else {
      addParagraphsToNote(destNote, [para], headingToFind, config.whereToAddInSection, true)
    }

    // unhighlight the previous selection, for safety's sake
    const emptyRange: TRange = Range.create(0, 0)
    Editor.highlightByRange(emptyRange)
  }
  catch (error) {
    logError('Filer/addIDAndAddToOtherNote', error.message)
  }
}
