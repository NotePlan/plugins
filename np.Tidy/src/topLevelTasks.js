// @flow
// Last updated 2024-01-xx by @dwertheimer

import pluginJson from '../plugin.json'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { showMessage } from '@helpers/userInput'
import { TASK_TYPES } from '@helpers/sorting'
import { removeRepeats } from '@helpers/dateTime'
// import { getParagraphParentsOnly, removeParentsWhoAreChildren, type ParentParagraphs } from '@helpers/parentsAndChildren'

/**
 * Move top-level tasks to heading
 * Plugin entrypoint for command: "/Move top-level tasks to heading"
 * Arguments:
 *      "Heading name to place the tasks under (will be created if doesn't exist)", 
        "Run silently (e.g. in a template). Default is false."
        "Return the content of the note as text, rather than inserting under a heading (e.g. for template use)"
 * @author @dwertheimer
 * @param {string} headingName - Name of heading to place the tasks under (will be created if doesn't exist)
 * @param {boolean} runSilently - Run silently (e.g. in a template). Default is false.
 * @param {boolean} returnContentAsText - Return the content of the note as text, rather than inserting under a heading (e.g. for template use)
 * @param {boolean|string} isTemplate - Is this running from a template? (default: false)
 * @returns {Promise<string>} Promise resolving to the modified note content or null
 */
export async function moveTopLevelTasksInEditor(
  headingName: string | null = null,
  _runSilently: boolean = false,
  _returnContentAsText: boolean = false,
  _isTemplate: boolean | string = false,
): Promise<string> {
  const runSilently = typeof _runSilently === 'boolean' ? _runSilently : /true/i.test(_runSilently) || false
  const returnContentAsText = typeof _returnContentAsText === 'boolean' ? _returnContentAsText : /true/i.test(_returnContentAsText) || false
  const headingNameIsEmpty = !headingName || headingName.trim() === ''

  try {
    logDebug(
      pluginJson,
      `moveTopLevelTasksInEditor running with headingName: ${String(headingName)}, runSilently: ${String(runSilently)} returnContentAsText: ${String(
        returnContentAsText,
      )} (typeof returnContentAsText: ${typeof returnContentAsText})`,
    )
    if (headingNameIsEmpty && !returnContentAsText) {
      const msg = `It appears you are running the moveTopLevelTasksInEditor from a template tag. When invoked this way, you must set the final argument (returnContentAsText) to true to return the content to be moved as text to output the results. Otherwise, concurrent edits by the templating engine could cause unexpected results. See the README for more information. Skipping this function.`
      logError(pluginJson, msg)
      return ''
    }
    const result = await moveTopLevelTasksInNote(Editor, headingName, runSilently, returnContentAsText)
    returnContentAsText ? logDebug(pluginJson, `moveTopLevelTasksInEditor: returning to Templating:${String(returnContentAsText)}, result:"${result}"`) : null
    removeEmptyTopParagraphs(Editor)
    return result ?? ''
  } catch (error) {
    handleCatchError(error, returnContentAsText, 'moveTopLevelTasksInEditor')
  }
  return ''
}

/**
 * Move top-level tasks to heading - Helper function called by the moveTopLevelTasksInEditor function
 * @param {CoreNoteFields} note - The note to process. Can be Editor, or a note
 * @param {string|null} headingName - Name of heading to place the tasks under (will be created if doesn't exist, could be empty/null if using returnContentAsText)
 * @param {boolean} runSilently - Run silently (e.g. in a template). Default is false.
 * @param {boolean} returnContentAsText - Return the content of the note as text, rather than inserting under a heading (e.g. for template use)
 * @returns {Promise<string|null>} Promise resolving to the modified note content or null
 */
export async function moveTopLevelTasksInNote(
  note: CoreNoteFields,
  headingName: string | null = null,
  _runSilently: boolean = false,
  _returnContentAsText?: boolean = false,
): Promise<string> {
  const runSilently = typeof _runSilently === 'boolean' ? _runSilently : /true/i.test(_runSilently) || false
  const returnContentAsText = typeof _returnContentAsText === 'boolean' ? _returnContentAsText : /true/i.test(_returnContentAsText) || false
  try {
    const heading = getHeadingName(headingName) // get heading from arguments or default
    const topLevelTasks = getTopLevelTasks(note) // get top-level paras that are tasks
    logDebug(pluginJson, `moveTopLevelTasks: Found ${topLevelTasks.length} tasks without heading`)
    if (topLevelTasks.length) {
      const result = processTopLevelTasks(note, topLevelTasks, heading, returnContentAsText)
      logDebug(pluginJson, `moveTopLevelTasks: Finished processing. result=[${result.toString()}]`)
      return returnContentAsText ? result.join('\n') : ''
    } else {
      await handleNoTopLevelParagraphs(runSilently, returnContentAsText)
    }
  } catch (error) {
    handleCatchError(error, returnContentAsText, 'moveTopLevelTasksInNote')
    return ''
  }
  return returnContentAsText ? '' : ''
}

/**
 * Retrieve the heading name from the provided argument or default settings
 * @param {string|null} headingName - The name of the heading provided
 * @returns {string} The heading name
 */
export function getHeadingName(headingName: string | null): string {
  try {
    return headingName || DataStore?.settings?.moveTopLevelTasksHeading || ''
  } catch (error) {
    handleCatchError(error, true, 'getHeadingName')
  }
  return ''
}

/**
 * Get top-level tasks from the note
 * @param {CoreNoteFields} note - The note from which to retrieve tasks
 * @returns {Array<Paragraph>} Array of top-level task paragraphs
 */
export function getTopLevelTasks(note: CoreNoteFields): Array<Paragraph> {
  const minLevel = 0
  logDebug(`getTopLevelTasks TASK_TYPES: ${TASK_TYPES.toString()}`)
  clo(note.paragraphs, `getTopLevelTasks paragraphs: ${note.paragraphs.length}`)
  try {
    return note.paragraphs.filter((para) => para.headingLevel < minLevel && TASK_TYPES.includes(para.type))
  } catch (error) {
    handleCatchError(error, true, 'getTopLevelTasks')
  }
  return []
}

/**
 * Get array of parents and their children paragraphs as a flat array of paragraphs
 * @param {Array<Paragraph>} topLevelParas - Array of top-level paragraphs
 * @returns {Array<TParagraph>} Array of parent and child paragraphs
 */
export function getFlatArrayOfParentsAndChildren(topLevelParas: Array<Paragraph>): Array<TParagraph> {
  // get all .children of all top-level paragraphs
  const topLevelParasAndAllChildren = topLevelParas.reduce((acc: TParagraph[], p: TParagraph) => {
    // Add the top-level element if it's not already included, identify by finding the lineIndex property
    if (!acc.find((pp) => pp.lineIndex === p.lineIndex)) {
      acc.push(p)
    }

    // Iterate over children and add them if they are not already included
    // $FlowFixMe[method-unbinding] I (JGC) don't understand this error
    const children = p.children()
    if (children && children.length) {
      children.forEach((c: TParagraph) => {
        if (!acc.find((pp) => pp.lineIndex === c.lineIndex)) {
          acc.push(c)
        }
      })
    }

    return acc
  }, [])

  logDebug(`getFlatArrayOfParentsAndChildren: topLevelParasAndAllChildren: ${topLevelParasAndAllChildren.length}`)
  // const parentsAndChildren: ParentParagraphs[] = getParagraphParentsOnly(topLevelParas)
  // const everyParaListedOnce = removeParentsWhoAreChildren(parentsAndChildren)
  // const outputParas = []
  // for (let i = 0; i < parentsAndChildren.length; i++) {
  //   const pp = parentsAndChildren[i]
  //   // if outputParas does not already include the parent, add it
  //   if (!outputParas.includes(pp.parent)) outputParas.push(pp.parent)
  //   pp.children.length ? outputParas.push(...pp.children) : null
  // }
  // return outputParas
  try {
    return topLevelParasAndAllChildren
  } catch (error) {
    handleCatchError(error, true, 'getFlatArrayOfParentsAndChildren')
  }
  return []
}

/**
 * Process top-level tasks in the note
 * - remove the top-level tasks from the note (including their children)
 * - and either:
 * - return an array of the rawContent of the top-level tasks
 * - or, if returnContentAsText is true, return an array of the rawContent of the top-level tasks
 * - and return the note with the top-level tasks removed
 * @param {CoreNoteFields} note - The note to process
 * @param {Array<Paragraph>} topLevelParas - Array of top-level paragraphs
 * @param {string} heading - Heading under which tasks will be moved
 * @param {boolean} returnContentAsText - Flag to determine if content should be returned as text
 * @returns {Array<string>} Array of processed paragraphs as strings
 */
export function processTopLevelTasks(note: CoreNoteFields, topLevelTasks: Array<Paragraph>, heading: string, returnContentAsText: boolean): Array<string> {
  let returnTextArr: Array<string> = []
  // Some indented items under tasks may not be topLevelTasks (could be notes etc)
  // so we need to get all the parents and the children of those parents
  // skip all empty paragraphs (may want to make that only if it's at the end but we shall see)
  const flat = getFlatArrayOfParentsAndChildren(topLevelTasks)
  // const flat = parentsAndChildren.map((pp) => pp.parent).filter((pp) => pp.type !== 'empty')

  logDebug(`moveTopLevelTasks: Moving ${flat.length} parents (and children) ${returnContentAsText ? 'and will return as text to calling function' : `to heading: ${heading}`} `)
  // add under heading in reverse order

  const reversedParentsAndChildren = flat.sort((a, b) => (b.lineIndex > a.lineIndex ? 1 : -1))

  reversedParentsAndChildren.forEach((para) => {
    moveParagraph(note, para, heading, returnContentAsText, returnTextArr)
  })
  removeEmptyTopParagraphs(note)

  returnContentAsText ? null : scrollToTitle(note, heading)
  // delete one or multiple items that contain empty text at the end of the returnTextArr
  if (returnContentAsText) {
    returnTextArr = returnTextArr.reverse()
    while (returnTextArr[returnTextArr.length - 1] === '') {
      returnTextArr.pop()
    }
  }
  logDebug(`moveTopLevelTasks: Finished moving. returnTextArr=[${returnTextArr.toString()}]`)
  return returnTextArr
}

/**
 * Move a paragraph in the note (or if returning as text, delete it and add to returnTextArr)
 * IMPORTANT: This function mutates the note and adds to the returnTextArr parameter if returning as text
 * @param {CoreNoteFields} note - The note to process
 * @param {Paragraph} para - The paragraph to move
 * @param {string} heading - Heading under which the paragraph will be moved
 * @param {boolean} returnContentAsText - Flag to determine if content should be returned as text
 * @param {Array<string>} returnTextArr - Array of strings to which the paragraph content will be added if returning as text
 */
export function moveParagraph(note: CoreNoteFields, para: Paragraph, heading: string, returnContentAsText: boolean, returnTextArr: Array<string>): void {
  logDebug(
    `moveTopLevelTasks: ${returnContentAsText ? 'REMOVING' : 'Moving'} paragraph ${para.lineIndex}: "${para.content}" ${
      returnContentAsText ? `(removing for now - will return as text)` : `to heading ${heading}`
    }`,
  )
  try {
    returnContentAsText ? returnTextArr.push(para.rawContent) : note.addParagraphBelowHeadingTitle(para.rawContent, 'text', heading || '', false, true)
    para.content = removeRepeats(para.content)
    note.updateParagraph(para)
    note.removeParagraph(note.paragraphs[para.lineIndex])
    if (note.paragraphs[para.lineIndex] && note.paragraphs[para.lineIndex].rawContent === para.rawContent) {
      logError(pluginJson, `moveTopLevelTasks: Failed to remove paragraph ${para.lineIndex}: "${para.rawContent}"`)
      clo(note.paragraphs, 'note.paragraphs after failed paragraph removal - is it a race condition?')
    }
  } catch (error) {
    handleCatchError(error, returnContentAsText, 'moveParagraph')
  }
}

/**
 * Remove blank/empty paragraph(s) at the top of the note
 * IMPORTANT: This function mutates the note
 * @param {CoreNoteFields} note - The note to process
 */
export function removeEmptyTopParagraphs(note: CoreNoteFields): void {
  try {
    if (note?.paragraphs?.length) {
      for (const para of note.paragraphs) {
        logDebug(`removeEmptyTopParagraphs: para.type: ${para.type} para.content: ${para.content}`)
        if (para?.type === 'empty' || para?.content?.trim() === '') {
          logDebug(`removeEmptyTopParagraphs: found empty paragraph at top of note ${para.lineIndex}. deleting. This may not work in a template.`)
          note.removeParagraph(para)
          clo(note.paragraphs, 'note.paragraphs after paragraph removal')
          if (note?.paragraphs?.length && (note.paragraphs[0].type === 'empty' || note.paragraphs[0].content.trim() === '')) {
            // there's a bug in the NP API where it doesn't handle empty paragraphs at the top of the note
            // so we need to handle it manually
            const content = note.content
            if (content) {
              const contentWithoutLeadingNewlines = content.replace(/^[\n\r]+/, '')
              note.content = contentWithoutLeadingNewlines
            }
          }
        } else {
          //stop looking
          return
        }
      }
    }
  } catch (error) {
    handleCatchError(error, true, 'removeEmptyTopParagraphs')
  }
}

export function scrollToTitle(note: CoreNoteFields, heading: string) {
  try {
    logDebug(pluginJson, `scrollToTitle: "${heading}"`)
    const headingPara = note.paragraphs.find((para) => para.type === 'title' && para.content === heading)
    if (headingPara) {
      const headingContentRangeEnd = headingPara.contentRange?.end || 0
      Editor.highlightByIndex(headingContentRangeEnd + 1, 0)
    }
  } catch (error) {
    handleCatchError(error, true, 'scrollToTitle')
  }
}

/**
 * Handle cases where no top-level paragraphs are found
 * @param {boolean} runSilently - Flag to determine if the operation should run silently
 * @param {boolean} returnContentAsText - Flag to determine if content should be returned as text
 * @returns {Promise<string|null>} Promise resolving to an empty string or null
 */
async function handleNoTopLevelParagraphs(runSilently: boolean, returnContentAsText: boolean): Promise<string | null> {
  try {
    runSilently ? logDebug('No task-type paragraphs in note. Exiting.') : await showMessage('No task-type paragraphs at top level of this note.')
    return returnContentAsText ? '' : null
  } catch (error) {
    handleCatchError(error, returnContentAsText, 'handleNoTopLevelParagraphs')
  }
  return returnContentAsText ? '' : null
}

/**
 * Handle errors caught during the execution of the script
 * @param {any} error - The error object caught
 * @param {boolean} returnContentAsText - Flag to determine if content should be returned as text
 * @returns {string|null} Returns an empty string or null based on the flag
 */
export function handleCatchError(error: any, returnContentAsText: boolean = true, failingFunction: string = ''): string | null {
  try {
    logError(pluginJson, `${failingFunction ? `${failingFunction}: ` : ''}${JSP(error)}`)
    return returnContentAsText ? '' : null
  } catch (error) {
    logError(pluginJson, `handleCatchError: ${JSP(error)}`)
  }
  return returnContentAsText ? '' : null
}
