// @flow

import pluginJson from '../plugin.json'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { showMessage, chooseHeading } from '@helpers/userInput'
import { TASK_TYPES } from '@helpers/sorting'
import { removeRepeats } from '@helpers/dateTime'

/**
 * Move top-level tasks to heading
 * Plugin entrypoint for command: "/Move top-level tasks to heading"
 * Arguments:
 *      "Heading name to place the tasks under (will be created if doesn't exist)", 
        "Run silently (e.g. in a template). Default is false."
 * @author @dwertheimer
 * @param {string} headingName - Name of heading to place the tasks under (will be created if doesn't exist)
 * @param {boolean} runSilently - Run silently (e.g. in a template). Default is false.
 */
export async function moveTopLevelTasksInEditor(headingName: string | null = null, runSilently: boolean = false) {
  try {
    logDebug(pluginJson, `moveTopLevelTasksInEditor running with headingName: ${String(headingName)}, runSilently: ${String(runSilently)}`)
    await moveTopLevelTasksInNote(Editor, headingName, runSilently)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
/**
 * Move top-level tasks to heading - Helper function called by the moveTopLevelTasksInEditor function
 * @author @dwertheimer
 * @param {CoreNoteFields} note - The note to process. Can be Editor,or a note
 * @param {string} headingName - Name of heading to place the tasks under (will be created if doesn't exist)
 * @param {boolean} runSilently - Run silently (e.g. in a template). Default is false.
 */
export async function moveTopLevelTasksInNote(note: CoreNoteFields, headingName: string | null = null, runSilently: boolean = false) {
  try {
    logDebug(pluginJson, `moveTopLevelTasksInNote running with headingName: ${String(headingName)}, runSilently: ${String(runSilently)}`)
    let heading = headingName || DataStore.settings.moveTopLevelTasksHeading
    /*
            Note: top level tasks without a title are just like calendar notes:
            Even with a title in a project note, they are the same as below
            -1 for items at the top level
            1+ for items beneath a heading
          */
    const minLevel = 0
    if (note.paragraphs.length) {
      const topLevelParas = note.paragraphs.filter((para) => para.headingLevel < minLevel && TASK_TYPES.includes(para.type))
      if (topLevelParas.length) {
        if (!heading) {
          heading = await chooseHeading(note, true, true, true)
          if (!heading) {
            logError(pluginJson, 'moveTopLevelTasks: No heading chosen. Exiting.')
            runSilently ? null : await showMessage('No heading chosen. Exiting.')
            return
          }
        }
        const reversedParas = topLevelParas.sort((a, b) => (b.lineIndex > a.lineIndex ? 1 : -1))
        reversedParas.forEach((para) => {
          logDebug(pluginJson, `moveTopLevelTasks: Moving paragraph ${para.lineIndex}: "${para.rawContent}" to heading ${heading}`)
          note.addParagraphBelowHeadingTitle(para.content, para.type, heading || '', false, true)
          para.content = removeRepeats(para.content)
          note.updateParagraph(para)
          note.removeParagraph(para)
          if (note.paragraphs[para.lineIndex] && note.paragraphs[para.lineIndex].rawContent === para.rawContent) {
            logError(pluginJson, `moveTopLevelTasks: Failed to remove paragraph ${para.lineIndex}: "${para.rawContent}"`)
          }
        })
        // Deal with bug in NP API where top row in note is not actually removed
        // when the bug is fixed in NP this code will not run
        if (note.paragraphs[0].type === 'empty') {
          logDebug(pluginJson, 'moveTopLevelTasks: Removing empty paragraph at top of note.')
          const contentArr = note.content?.split('\n') || []
          note.content = contentArr.slice(1).join('\n')
          const headingPara = note.paragraphs.find((para) => para.type === 'title' && para.content === heading)
          if (headingPara) {
            const headingContentRangeEnd = headingPara.contentRange?.end || 0
            Editor.highlightByIndex(headingContentRangeEnd + 1, 0) // skip the newline and the task character
            clo(headingPara, `headingPara`)
            clo(headingPara.contentRange, `headingPara.contentRange`)
          }
        }
      }
    } else {
      logError(pluginJson, 'moveTopLevelTasks: No paragraphs in note. Exiting.')
      runSilently ? null : await showMessage('No paragraphs in note. Exiting.')
      return
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
