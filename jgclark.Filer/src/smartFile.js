// @flow
//-----------------------------------------------------------------------------
// Smart tidy up a note, filing completed items to Done/Cancelled.
// Last updated 2024-10-14 for v1.2.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { insertTodos, removeEmptyHeadings, sortTasksDefault } from '../../dwertheimer.TaskSorting/src/sortTasks'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { findEndOfActivePartOfNote, findStartOfActivePartOfNote } from '@helpers/paragraph'
import { showMessage, showMessageYesNo } from '@helpers/userInput'
import { isClosed, isOpen } from '@helpers/utils'
import {
  getParagraphBlock,
  // selectedLinesIndex,
} from '@helpers/NPParagraph'

type ParagraphForFiling = {
  lineIndex: number,
  content: string,
  type: string,
  headingUnder: string,
  indents: number,
  numChildren: number,
  numOpenChildren: number,
  toMove: boolean,
}

//-----------------------------------------------------------------------------

function makeFilablePara(paragraph: TParagraph): ParagraphForFiling {
  let fp = {}
  if (paragraph.type === 'title') {
    const sectionBlock = getParagraphBlock(paragraph.note, paragraph.lineIndex, true, true)
    fp = {
      headingUnder: paragraph.heading || '', // TEST: should only be '' near the top of a calendar note
      content: paragraph.content,
      lineIndex: paragraph.lineIndex,
      type: paragraph.type,
      level: paragraph.headingLevel, // = heading level
      numChildren: sectionBlock.length,
      numOpenChildren: sectionBlock.filter(isOpen).length,
      toMove: false, // by default
    }
  } else {
    fp = {
      headingUnder: paragraph.heading || '', // TEST: should only be '' near the top of a calendar note
      content: paragraph.content,
      lineIndex: paragraph.lineIndex,
      type: paragraph.type,
      level: paragraph.indents, // = indent level
      numChildren: paragraph.children().length,
      numOpenChildren: paragraph.children().filter(isOpen).length,
      toMove: false, // by default
    }
  }
  return fp
}


//-----------------------------------------------------------------------------

/**
 * Smartly file completed (done/cancelled) items to Done/Cancelled sections.
 * Only move if an item is completed, and all its subitems too (if any).
 * 
 * Then tidy up:
 * - remove duplicate blank lines or separators
 * - ? remove blank lines after headings
 * Then sort what remains, using Filer's "Tasks sort by user defaults" command, using its settings.
 * @author @jgclark
 */
export async function smartFileToCompletedSections(filenameIn: string = ''): Promise<void> {
  try {
    const note = filenameIn ? DataStore.noteByFilename(filenameIn) : Editor?.note ? Editor.note : null
    if (!note) {
      // No note open or passed, so don't do anything.
      logWarn(pluginJson, 'archiveNoteUsingFolder(): No note passed or open in the Editor, so stopping.')
      return
    }
    logDebug(pluginJson, `smartFileToCompletedSections() starting from note '${displayTitle(note)}'`)

    // Work out the contents of the active part of the note (after the preamble, which we leave alone)
    const activeStart = findStartOfActivePartOfNote(note)
    const activeEnd = findEndOfActivePartOfNote(note)
    logDebug('paragraph/smartFileToCompletedSections', `activeStart = ${activeStart} / activeEnd = ${activeEnd} / total lines = ${note.paragraphs.length}`)

    // Make reduced-but-filable paras to process
    const activeParas = note.paragraphs.slice(activeStart, activeEnd).map(ap => makeFilablePara(ap))

    // Now go through each section/heading
    const activeHeadingParas = activeParas.filter(para => para.type === 'title')
    // logDebug('smartFileToCompletedSections', `found ${activeHeadingParas.length} headings: [${activeHeadingParas.map(p => p.content).join(', ')}]`) // OK

    // let previousHeading = undefined
    for (const thisHeading of activeHeadingParas) {
      let parasToMove = []
      let headingIndex = thisHeading.lineIndex
      let headingLevel = thisHeading.level
      let lineIndex = headingIndex + 1
      logDebug('smartFileToCompletedSections', `processing heading ${thisHeading.content} (level ${headingLevel}) at line ${headingIndex}:`)
      while (lineIndex < activeParas.length && activeParas[lineIndex].type !== 'title') {
        lineIndex++ // skip heading lines until ()
        const thisPara = activeParas[lineIndex]
        if (lineIndex > 42) clo(thisPara)
        if (thisPara.numChildren === 0 || (thisPara.numChildren > 0 && thisPara.numOpenChildren === 0)) {
          thisPara.toMove = true
          parasToMove.push(thisPara)
          logDebug('smartFileToCompletedSections', `found line ${thisPara.lineIndex}:<${thisPara.content}> to move to Done`)
        }
      }
      logDebug('smartFileToCompletedSections', `- after processing heading ${thisHeading.content}, lineIndex=${lineIndex} and found ${parasToMove.length} paras to move to Done/Cancelled`)
      if (parasToMove.length > 0) {
        clo(parasToMove)
        // Insert block of these paras under ## Done section
        // FIXME: "undefined is not an object (evaluating 'todos[lineIndex][subHeadingCategory][0]')",
        // I DON'T THINK MY DATA STRUCTURE IS CORRECT for insertTodos.
        // insertTodos(note, parasToMove, '', '', thisHeading.content, 'Done', false)
        // TODO: Try DataStore....HeadingSection instead
      }
    }

    // Check: #moved against length
    // TODO: Now remove the moved lines

    // Do some further clean up of the paragraphs
    // let lastContent = ''
    // let lastType = 'title'
    // for (let i = 1; i < parasToKeep.length; i++) {
    //   // lastContent = parasToKeep[i - 1].content
    //   const thisRawContent = parasToKeep[i].rawContent
    //   logDebug('smartFileToCompletedSections', `#${i}: {${thisRawContent}}`)
    //   lastType = parasToKeep[i - 1].type
    //   // Remove consecutive separators or empty lines
    //   if ((parasToKeep[i].type === 'empty' && lastType === 'empty') || (parasToKeep[i].type === 'separator') && (lastType === 'separator')) {
    //     logDebug('smartFileToCompletedSections', `- removing consecutive empty/separator line`)
    //     parasToKeep.splice(i, 1)
    //     continue
    //   }
    //   // Remove any blank lines after headings (if wanted)
    //   if (lastType === 'title' && parasToKeep[i].type === 'empty') {
    //     logDebug('smartFileToCompletedSections', `- removing blank line after heading`)
    //     parasToKeep.splice(i, 1)
    //     continue
    //   }
    // }

    // TODO: Save contents to the note

    // TEST: Remove empty headings
    // removeEmptyHeadings(note)

    // If wanted, file completed tasks with a [[note link]] to that note, using the Tidy command/code.
    // TODO: Decide if there are relevant items to file, and if so, offer to file those.
    // if (await showMessageYesNo('Shall I sort the note using your default options (from TaskSorting plugin)?', ['Yes', 'No'], `Smart File Paragraphs in Note`) === 'Yes') {
    // TODO: something from Tidy
    // }

    // If wanted, sort remaining tasks according to user's defaults.
    // Note: this uses @dwertheimer's sortTasksDefault() = /std, which only works on the current Editor, so has to come here.
    // TODO: see if we can get it to work on passed paragraphs instead, to avoid the step above.
    // if (await showMessageYesNo('Shall I sort the note using your default options (from TaskSorting plugin)?', ['Yes', 'No'], `Smart File Paragraphs in Note`) === 'Yes') {
    //   await sortTasksDefault()
    // }

  } catch (err) {
    logError('smartFileToCompletedSections', err)
  }
}
