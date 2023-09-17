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
 * @param {boolean} returnContentAsText - Return the content of the note as text, rather than inserting under a heading (e.g. for template use)
 */
export async function moveTopLevelTasksInEditor(headingName: string | null = null, runSilently: boolean = false, returnContentAsText: boolean = false): Promise<string | null> {
  try {
    logDebug(
      pluginJson,
      `moveTopLevelTasksInEditor running with headingName: ${String(headingName)}, runSilently: ${String(runSilently)} returnContentAsText: ${String(returnContentAsText)}`,
    )
    if (headingName && !returnContentAsText) {
      const msg = `It appears you are running the moveTopLevelTasksInEditor from an xcallback or template tag. When invoked this way, you must set the final argument (returnContentAsText) to true to return the content to be moved as text to output the results. Otherwise, concurrent edits by the templating engine could cause unexpected results. See the README for more information. Skipping this function.`
      logError(pluginJson, msg)
      return ''
    }
    return await moveTopLevelTasksInNote(Editor, headingName, runSilently, returnContentAsText)
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
  return null
}
/**
 * Move top-level tasks to heading - Helper function called by the moveTopLevelTasksInEditor function
 * @author @dwertheimer
 * @param {CoreNoteFields} note - The note to process. Can be Editor,or a note
 * @param {string} headingName - Name of heading to place the tasks under (will be created if doesn't exist)
 * @param {boolean} runSilently - Run silently (e.g. in a template). Default is false.
 * @param {boolean} returnContentAsText - Return the content of the note as text, rather than inserting under a heading (e.g. for template use)
 */
export async function moveTopLevelTasksInNote(
  note: CoreNoteFields,
  headingName: string | null = null,
  runSilently: boolean = false,
  returnContentAsText?: boolean = false,
): Promise<string | null> {
  try {
    logDebug(
      pluginJson,
      `moveTopLevelTasksInNote running with headingName: ${String(headingName)}, runSilently: ${String(runSilently)} returnContentAsText: ${String(returnContentAsText)}`,
    )
    let heading = headingName || DataStore.settings.moveTopLevelTasksHeading
    /*
            Note: top level tasks without a title are just like calendar notes:
            Even with a title in a project note, they are the same as below
            -1 for items at the top level
            1+ for items beneath a heading
          */
    const returnTextArr = []
    const minLevel = 0
    if (note.paragraphs.length) {
      const topLevelParas = note.paragraphs.filter((para) => para.headingLevel < minLevel && TASK_TYPES.includes(para.type))
      if (topLevelParas.length) {
        if (!returnContentAsText && !heading) {
          heading = await chooseHeading(note, true, true, true)
          if (!heading) {
            logError(pluginJson, 'moveTopLevelTasks: No heading chosen. Exiting.')
            runSilently ? null : await showMessage('No heading chosen. Exiting.')
            return null
          }
        }
        const reversedParas = topLevelParas.sort((a, b) => (b.lineIndex > a.lineIndex ? 1 : -1))
        reversedParas.forEach((para) => {
          logDebug(
            pluginJson,
            `moveTopLevelTasks: Moving paragraph ${para.lineIndex}: "${para.rawContent}" ${
              returnContentAsText ? `(removing for now - will return as text)` : `to heading ${heading}`
            }`,
          )
          returnContentAsText ? returnTextArr.push(para.rawContent) : note.addParagraphBelowHeadingTitle(para.content, para.type, heading || '', false, true)
          // delete the paragraph at the top of the note
          para.content = removeRepeats(para.content)
          note.updateParagraph(para)
          note.removeParagraph(note.paragraphs[para.lineIndex])
          if (note.paragraphs[para.lineIndex] && note.paragraphs[para.lineIndex].rawContent === para.rawContent) {
            logError(pluginJson, `moveTopLevelTasks: Failed to remove paragraph ${para.lineIndex}: "${para.rawContent}"`)
          }
        })
        // Deal with bug in NP API where top row in note is not actually removed
        // when the bug is fixed in NP this code will not run
        if (note?.paragraphs?.length && note?.paragraphs[0].type === 'empty') {
          logDebug(pluginJson, 'moveTopLevelTasks: Removing empty paragraph at top of note.')
          const contentArr = note.content?.split('\n') || []
          note.content = contentArr.slice(1).join('\n')
          if (!returnContentAsText) {
            // resetting the content will scroll to the end of the note, so let's scroll to the place we inserted
            const headingPara = note.paragraphs.find((para) => para.type === 'title' && para.content === heading)
            if (headingPara) {
              const headingContentRangeEnd = headingPara.contentRange?.end || 0
              Editor.highlightByIndex(headingContentRangeEnd + 1, 0) // skip the newline and the task character
            }
          }
        }
        returnContentAsText ? logDebug(pluginJson, `moveTopLevelTasks: returning content:${returnTextArr.toString()}`) : null
        return returnContentAsText ? returnTextArr.join('\n') : null
      }
    } else {
      logError(pluginJson, 'moveTopLevelTasks: No paragraphs in note. Exiting.')
      runSilently ? null : await showMessage('No paragraphs in note. Exiting.')
      return returnContentAsText ? '' : null
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
    returnContentAsText ? '' : null
  }
  return returnContentAsText ? '' : null
}
