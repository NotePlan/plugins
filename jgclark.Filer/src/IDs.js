// @flow
// ----------------------------------------------------------------------------
// Plugin to help link lines between notes with Line IDs
// Jonathan Clark
// last updated 2025-01-07 for v1.2.0
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import { addParasAsText, getFilerSettings } from './filerHelpers'
import { logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { findHeading, getHeadingTextFromMarkdownHeadingText, parasToText, smartAppendPara, smartPrependPara } from '@helpers/paragraph'
import { chooseNote, chooseHeading } from '@helpers/userInput'

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
      logWarn(pluginJson, 'addIDAndAddToOtherNote(): No note open, so stopping.')
      return
    }

    // Get config settings
    const config = await getFilerSettings()
    const defaultMarkdownHeading = config.defaultHeadingToSyncTo

    // Get current selected paragraph(s)
    logDebug(pluginJson, `addIDAndAddToOtherNote() starting with ${String(selectedParagraphs.length)} selected lines, and syncToDifferentDestination ${String(config.syncToDifferentDestination)}.`)

    // Iterate over each selected paragraph
    let destNote: ?TNote
    let destHeading: string = ''
    for (const thisPara of selectedParagraphs) {
      // Add blockId for thisPara (confusingly, also known as 'blockID' by API)
      // But first check if it already has one, and if so, use that.
      if (thisPara.blockId !== '') {
        note.addBlockID(thisPara)
        note.updateParagraph(thisPara)
      }
      // Get (new or existing) blockId
      const newBlockID = thisPara.blockId
      if (!newBlockID) {
        throw new Error(`No blockId created for line {${thisPara.content}} for unknown reason. Stopping.`)
      }
      logDebug('addIDAndAddToOtherNote', `-> blockId for line #${String(thisPara.lineIndex)}: '${newBlockID}'`)

      // Decide where to copy the line to (the first time around, or if we want a different destination for each para)
      // V1
      // const allNotes = allNotesSortedByChanged()
      // const res = await CommandBar.showOptions(
      //   allNotes.map((n) => n.title ?? 'untitled'),
      //   `Select note to copy the line to`,
      // )
      // const destNote = allNotes[res.index]
      // Note: showOptions returns the first item if something else is typed. And I can't see a way to distinguish between the two.
      // V2
      // Attempt to highlight them to help user check all is well
      const firstStartIndex = thisPara.contentRange?.start ?? NaN
      const lastEndIndex = thisPara.contentRange?.end ?? NaN
      if (firstStartIndex && lastEndIndex) {
        const parasCharIndexRange: TRange = Range.create(firstStartIndex, lastEndIndex)
        Editor.highlightByRange(parasCharIndexRange)
      }
      const truncatedContent = `${thisPara.content.slice(0, 30)}…`
      destNote = await chooseNote(true, true, [], `Note to sync '${truncatedContent}' to`, false, true)
      if (!destNote) {
        logDebug('addIDAndAddToOtherNote', `User cancelled operation. Stopping.`)
        return
      }

      // Ask to which heading to add the selectedParas (if we don't have a default)
      if (defaultMarkdownHeading === '') {
        destHeading = await chooseHeading(destNote, true, true, false)
        logDebug('addIDAndAddToOtherNote', `- Will add to note '${displayTitle(destNote)}' under heading: '${destHeading}'`)
        if (destHeading === '') {
          logDebug('addIDAndAddToOtherNote', `User cancelled operation. Stopping.`)
          return
        }
      } else {
        // Now have to check whether it exists, and if not create it
        const defaultHeading = getHeadingTextFromMarkdownHeadingText(defaultMarkdownHeading)
        if (!findHeading(destNote, defaultHeading, false)) {
          logDebug('addIDAndAddToOtherNote', `Heading ${defaultHeading} doesn't exist in destNote so will need to add first`)
          const markdownHeading = defaultMarkdownHeading
          if (config.whereToAddNewHeadingInNote === 'start') {
            smartPrependPara(destNote, markdownHeading, 'title')
          } else {
            smartAppendPara(destNote, markdownHeading, 'title')
          }
          logDebug('addIDAndAddToOtherNote', `Added ${markdownHeading} at ${config.whereToAddNewHeadingInNote} of note`)
          DataStore.updateCache(destNote)
        }
        destHeading = defaultHeading
      }

      // Turn para into text, for reasons given in moveParas()
      const selectedParaAsText = parasToText([thisPara]) // i.e. turn single para into a single-iterm array

      // Add text to the new location in destination note
      addParasAsText(destNote, selectedParaAsText, destHeading, config.whereToAddInSection, true)

      // NB: handily, the blockId goes with it as part of the para.content
      // logDebug('addIDAndAddToOtherNote', `- Inserting 1 para at index ${insertionIndex} into ${displayTitle(destNote)}`)
      // await destNote.insertParagraph(para.content, insertionIndex, paraType)
    }
  }
  catch (error) {
    logError('addIDAndAddToOtherNote', error.message)
  }
}
