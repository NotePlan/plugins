// @flow

import { getParaAndAllChildren } from '@helpers/blocks'
import { clo, JSP, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { addParasAsText} from '@helpers/NPParagraph'
import { parasToText } from '@helpers/paragraph'

/**
 * Move a given paragraph (and any following indented paragraphs) to a different note.
 * Note: simplified version of 'moveParas()' in NPParagraph.
 * NB: the Setting 'includeFromStartOfSection' decides whether these directly following paragaphs have to be indented (false) or can take all following lines at same level until next empty line as well.
 * Note: not yet used, it seems.
 * TODO: uses DataStore, so should move to NPBlocks, along with some of NPParagraph, to be honest.
 * @author @jgclark
 * @param {TParagraph} para
 * @param {string} toFilename
 * @param {NoteType} toNoteType
 * @param {string} toHeading to move under
 */
export function moveGivenParaAndBlock(para: TParagraph, toFilename: string, toNoteType: NoteType, toHeading: string): void {
  try {
    if (!toFilename) {
      throw new Error('Invalid destination filename given.')
    }
    if (!para) {
      throw new Error('Invalid paragraph filename given.')
    }

    const fromNote = para.note
    if (!fromNote) {
      throw new Error(`From note can't be found. Stopping.`)
    }

    // get children paras (as well as the original)
    const parasInBlock = getParaAndAllChildren(para)
    logDebug('blocks/moveGivenParaAndBlock', `moveParas: move block of ${parasInBlock.length} paras`)

    // Note: There's still no API function to add multiple
    // paragraphs in one go, but we can insert a raw text string.
    const selectedParasAsText = parasToText(parasInBlock)

    // Add text to the new location in destination note
    const destNote = DataStore.noteByFilename(toFilename, toNoteType)
    if (!destNote) {
      throw new Error(`Destination note can't be found from filename '${toFilename}'`)
    }
    logDebug('blocks/moveGivenParaAndBlock', `- Moving to note '${displayTitle(destNote)}' under heading: '${toHeading}'`)
    addParasAsText(destNote, selectedParasAsText, toHeading, 'start', true)

    // delete from existing location
    logDebug('blocks/moveGivenParaAndBlock', `- Removing ${parasInBlock.length} paras from original note`)
    fromNote.removeParagraphs(parasInBlock)
  }
  catch (error) {
    logError('blocks/moveGivenParaAndBlock', `moveParas(): ${error.message}`)
  }
}
