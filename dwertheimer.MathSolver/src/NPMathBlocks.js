// @flow
/**
 * TODO:
 * - ignore date on left
 * - Allow for statements inside parens
 *  - make "at" and "per" work properly
 *  - in to cm etc.
 * - implement insertResultsAtCursor
 * - add user pref for whether to include total or not
 * - the second total prints at the bottom (need a cloneDeep to work)
 * - pricePerHour = 20  //= 20 (does not need to print this out, but how to determine this? maybe we need mathOnly)
 */
// import {cloneDeep} from 'lodash.clonedeep' // crashes NP
import pluginJson from '../plugin.json'
import { chooseOption, showMessage } from "../../helpers/userInput"
import type { CodeBlock } from "../../helpers/codeBlocks"
import { type LineInfo, parse} from './support/solver'
import {getParagraphContainingPosition, selectedLinesIndex} from '@helpers/NPParagraph'
import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'
import { createRunPluginCallbackUrl , formatWithFields } from '@helpers/general'
import { getCodeBlocksOfType } from '@helpers/codeBlocks'

/**
 * Format the output according to user preferences
 * @param {Array<LineInfo>} results - the results of the solver's info property
 * @returns {Array<string>} formatted text
 */
export function formatOutput(results:Array<LineInfo>, formatTemplate:string = "{{originalText}} {{value}}"): Array<string> {
  const resultsWithStringValues = results.map(line => {
    const isPctOf = /(\d*[\.,])?(\d+\s?)(as|as a)?(\s*%)(\s+(of)\s+)(\d*[\.,])?(\d+\s?)/g.test(line.originalText)
    const isZero = line.lineValue === 0
    const isNotCalc = (String(line.lineValue) === line.expression) && !isPctOf
    const isNumericalAssignment = line.typeOfResult === "A" && !(/(\+|\-|\*|\/)+/.test(line.originalText))
    line.value = (isZero || isNotCalc || isNumericalAssignment) ? '' : `//= ${String(line.lineValue)}` // eslint-disable-line eqeqeq
    // logDebug(pluginJson, `line.value: ${line.value} line.expression: ${line.expression}`)
    return line
  })
  const formatted = resultsWithStringValues.map(line => formatWithFields(formatTemplate, line))
  logDebug(pluginJson,`Formatted data: ${JSON.stringify(resultsWithStringValues,null,2)}`)

  return formatted
}

/**
 * Parse the code blocks in the current note
 * @returns {Array<LineInfo>} the results of the solver
 */
export function parseCodeBlocks(): $ReadOnlyArray<$ReadOnly<CodeBlock>> {
  const codeBlocks = getCodeBlocksOfType('math')
  if (codeBlocks.length) {
    const results = codeBlocks.map(block => parse(block.text))
    return results || []
  } else {
    logDebug(pluginJson, `There were no code blocks to parse`)
    return []
  }
}

/**
 * Show the results of the solver in the editor at cursor position
 * @param {Array<LineInfo>} results - the results of the solver
 * @param {string} template - should probably be called with settings.documentTemplate 
 */
// export function insertResultsAtCursor(results: Array<LineInfo>,template:string): void {
//   const formatted = formatOutput(results,template)
//   Editor.insertTextAtCursor(formatted.join('\n'))
// }

/**
 * Remove annotations from a specific code block
 * @param {*} note 
 * @param {*} blockData 
 */
export function removeAnnotations(note:CoreNoteFields, blockData:$ReadOnly<CodeBlock>) {
  const updates = []
  for(let i = 0; i < blockData.paragraphs.length; i++) {
    const paragraph = blockData.paragraphs[i]
    if (/ {2}(\/\/\=.*)/g.test(paragraph.content)) {
      const thisParaInNote = note.paragraphs[paragraph.lineIndex]
      thisParaInNote.content = thisParaInNote.content.replace(/ {2}(\/\/\=.*)/g, '')
      updates.push(thisParaInNote)
    }
  }
  if (updates.length) note.updateParagraphs(updates)
}

export function annotateResults(note:CoreNoteFields, blockData:$ReadOnly<CodeBlock>, results: Array<LineInfo>, template:string, totalsOnly:boolean): void {
  const formatted = formatOutput(results,template) // writes .value using template?
  removeAnnotations(note, blockData)
  const updates = []
  let j = 0
  for(let i = 0; i < blockData.paragraphs.length; i++) {
    const paragraph = blockData.paragraphs[i]
    const solverData = results[j]
    const shouldPrint = !totalsOnly || (totalsOnly && (solverData.typeOfResult === "T" || solverData.typeOfResult === "S"))
    if (solverData.value !== '' && shouldPrint) {
      const comment = `  ${solverData.value}`
      clo(solverData, `annotateResults solverData`)
      logDebug(pluginJson,`$comment=${comment}`)
      const thisParaInNote = note.paragraphs[paragraph.lineIndex]
      // thisParaInNote.content.replace(/ {2}(\/\/\=.*)/g,'')
      thisParaInNote.content += comment
      updates.push(thisParaInNote)
// `    logDebug(`annotateResults: paragraph.lineIndex: ${paragraph.lineIndex} content="${paragraph.content}" results[].value=${solverData.value || ''}`)
//      logDebug(`${paragraph.content}${comment}`)
    }
    j++
  }
  // clo(updates, `annotateResults::updates:`)
  if (updates.length) note.updateParagraphs(updates)
}

/**
 * Show the results of the solver in popup
 * @param {Array<LineInfo>} results - the results of the solver 
 * @param {string} template - should probably be called with settings.documentTemplate
 * @param {string} title - the title of the popup
 */
export async function showResultsInPopup(results: Array<LineInfo>,template:string, title:string): void {
  if (results.length) {
    const formattedLines = formatOutput(results,template)
    const options = formattedLines.map((line,i)=>({label:line,value:String(results[i].lineValue)}))
    logDebug(pluginJson,`Showing results in popup: ${String(options.map(o=>o.label))}`)
    const selected = await chooseOption(`${title} Results (return to copy line value)`,options,options[0].value)
    if (selected) {
      logDebug(pluginJson,`Selected: ${selected}`)
      Clipboard.string = String(selected)
    }
  }
}

/**
 * Remove all annotations previously added by this plugin
 * (plugin entrypoint for command: /Remove Annotations from Active Document)
 * @returns {void}
 */
export function removeAllAnnotations(): void {
  if (Editor) {
    const codeBlocks = getCodeBlocksOfType(Editor, 'math')
    const note = Editor
    if (!note) return
    for(let i = 0; i < codeBlocks.length; i++) {
      const blockData = codeBlocks[i]
      removeAnnotations(note, blockData)
    }
  }
}

/**
 * Generic math block processing function (can be called by calculate or totalsOnly)
 * @param {string} incoming - math block text to process
 * @param {boolean} totalsOnly - if true, only calculate totals (default: false)
 */
export async function calculateBlocks(incoming:string|null = null, totalsOnly:boolean = true): Promise<void> {
  try {
    const { popUpTemplate } = DataStore.settings
    // get the code blocks in the editor
      let codeBlocks = (incoming === '' || incoming === null) ? getCodeBlocksOfType(Editor, `math`) : [{ type: "unknown", code: incoming, startLineIndex: -1 }]
      logDebug(pluginJson,`calculateEditorMathBlocks: codeBlocks.length: ${codeBlocks.length}`)
    if (codeBlocks.length && Editor) {
      for (let b =0; b < codeBlocks.length; b++) {
        if (b>0) {
          // get the codeblocks again because the line indexes may have changed if the last round made edits
          codeBlocks = getCodeBlocksOfType(Editor,`math`)
        }
        const block = codeBlocks[b]
        // clo(block,`calculateEditorMathBlocks block=`)
        let currentData = {info: [], variables: {}, relations: [], expressions: [], rows: 0}
        block.code.split("\n").forEach((line,i)=>{
            currentData.rows = i+1
            currentData = parse(line,i,currentData)
        })
        const totalData = parse("TOTAL",currentData.rows,currentData)
        const t = totalData.info[currentData.rows]
        const totalLine = {
          "lineValue": t.lineValue,
          "originalText": t.originalText,
          "expression": t.expression,
          "row": -1,
          "typeOfResult": t.typeOfResult,
          "typeOfResultFormat": t.typeOfResultFormat,
          "value": t.value,
          error: ''
        }
        // logDebug(pluginJson,`Final data: ${JSON.stringify(currentData,null,2)}`)
        // TODO: Maybe add a total if there isn't one? But maybe people are not adding?
        // if (currentData.info[currentData.info.length-1].typeOfResult !== "T") {
        //   currentData = parse("total",i,currentData)
        // }
        // TODO: add user pref for whether to include total or not
        await annotateResults(Editor,block,currentData.info,popUpTemplate,totalsOnly)
        // await showResultsInPopup([totalLine,...currentData.info], popUpTemplate, `Block ${b+1}`)
      }
    } else {
      const msg = `Did not find any 'math' code blocks in active editor`
      logDebug(pluginJson,msg)
      await showMessage(msg)
    }  
  } catch (error) {
    logError(pluginJson, `calculateBlocks error: ${error}`)
  }
}

/**
 * Calculate all the math blocks on the current page
 * (plugin entrypoint for command: /Calculate Math Code Blocks in Active Document)
 * @param {*} incoming 
 */
export async function calculateEditorMathBlocks(incoming:string|null = null) {
  try {
    await calculateBlocks(incoming,false)
  } catch (error) {
    logError(pluginJson,error)
  }
}

export async function calculateEditorMathBlocksTotalsOnly(incoming:string|null = null) {
  try {
    await calculateBlocks(incoming,true)    
  } catch (error) {
    logError(pluginJson,error)
  }
}

/**
 * Insert a math block and a calculate button
 *  (plugin entrypoint for command: /Insert Math Block at Cursor)
 */
export async function insertMathBlock() {
  try {
    const {includeCalc,includeClear, includeTotals} = DataStore.settings
    // NOTE: this relies on the calculate command being the first in the list in plugin.json
    const calcLink = includeCalc ? `[Calculate](${createRunPluginCallbackUrl(pluginJson['plugin.id'], pluginJson['plugin.commands'][0].name)})` : ''
    const clrLink = includeClear ? `[Clear](${createRunPluginCallbackUrl(pluginJson['plugin.id'], pluginJson['plugin.commands'][1].name)})` : ''
    const totLink = includeTotals ? `[Totals](${createRunPluginCallbackUrl(pluginJson['plugin.id'], pluginJson['plugin.commands'][2].name)})` : ''
    let buttonLine = includeClear ? clrLink : ''
    buttonLine = includeCalc ? `${buttonLine + (includeClear ? ` ` : '')}${calcLink}` : buttonLine
    buttonLine = includeTotals ? `${buttonLine + (includeClear || includeCalc ? ` ` : '')}${totLink}` : buttonLine
    buttonLine = buttonLine.length ? `${buttonLine}\n` : ''
    const onLine = getParagraphContainingPosition(Editor, Editor.selection.start)
    const returnIfNeeded = onLine?.type !== "empty" ? "\n" : ""
    const block = `${returnIfNeeded}\`\`\`math\n\n\`\`\`\n${buttonLine}`
    await Editor.insertTextAtCursor(block)
    const sel = Editor.selection
    if (sel) {
      const para = getParagraphContainingPosition(Editor, Editor.selection.start)
      if (para && para.lineIndex) {
        const offset = buttonLine.length ? 3 : 2
        const range = Editor.paragraphs[para.lineIndex-offset].contentRange
        if (range?.start) {
          Editor.select(range.start, 0)
        }
      }
    }
  } catch (error) {
    logError(pluginJson,error)
  }
}