// @flow
/**
 * TODO:
 * why doesn't dollars work? $2 + $4
 * "round by default" and "show no-rounding button"
 * what to do about commas
 * as you calculate and recalculate, seems to cycle between totals and non-totals
 * refactor to make more modular and eliminate relations and one of the each-line-loops
 * maybe print zero in output on subtotal or total lines only
 * time-date math per George: https://discord.com/channels/763107030223290449/1009525907075113053/1012085619658334351 and
 *  - https://documentation.soulver.app/syntax-reference/dates-and-times
 *  - https://documentation.soulver.app/whats-new
 * 2) would be so cool if  @Eduard could tweak autocomplete inside a math block to give you choices of variables without you having to type them in.
 * - Allow for statements inside parens
 *  - make "at" and "per" work properly
 *  - in to cm etc.
 * - implement format preferences (see hidden user prefs)
 * - implement insertResultsAtCursor
 * - add user pref for whether to include total or not
 * - the second total prints at the bottom (need a cloneDeep to work)
 * (done) add output columns https://www.npmjs.com/package/columnify (showColumns fa;se)
 * (done) Nested frontmatter under mathPresets
 * (done) Can you assign a subtotal line to a variable? @george65#1130
 * (done) save variables you use frequently in preferences and reference them without defining them every time
 * (done) pricePerHour = 20  //= 20 (does not need to print this out)
 * (done) ignore date on left
 * (done) basic time math
 * Reference: https://numpad.io/
 * Playground: https://mathnotepad.com/
 */
// import cloneDeep from 'lodash/cloneDeep' // Should not Crash NP anymore
import columnify from 'columnify'
import pluginJson from '../plugin.json'
import { chooseOption, showMessage } from '../../helpers/userInput'
import type { CodeBlock } from '../../helpers/codeBlocks'
import { type LineInfo, parse, isLineType, checkIfUnit } from './support/solver'
import { getParagraphContainingPosition, getSelectedParagraphLineIndex } from '@helpers/NPParagraph'
import { log, logDebug, logError, logWarn, clo, JSP } from '@helpers/dev'
import { createRunPluginCallbackUrl, formatWithFields, CreateUUID } from '@helpers/general'
import { getCodeBlocksOfType } from '@helpers/codeBlocks'
import { getAttributes } from '@helpers/NPFrontMatter'

/**
 * Get the frontmatter variables for this document
 * @param {string} noteContent
 * @returns {object} frontmatter values
 */
export function getFrontmatterVariables(noteContent: string): any {
  try {
    const noteContentNoTabs = noteContent.replace('\t', ' ') //tabs in frontmatter break hierarchy
    const fmVars = getAttributes(noteContentNoTabs)
    return fmVars && fmVars.mathPresets ? fmVars.mathPresets : {}
  } catch (error) {
    logError(pluginJson, JSP(error))
    return {}
  }
}

/**
 * Round a number to a certain number of significant digits in the decimal
 * @param {*} n - the number
 * @param {*} d - the number of digits to round to (zeros will be omitted)
 * @returns
 */
const round = (n: number, d: number) => (n && d ? Math.round(n * Math.pow(10, d)) / Math.pow(10, d) : 0)

/**
 * Format the output according to user preferences
 * @param {Array<LineInfo>} results - the results of the solver's info property
 * @param {string} formatTemplate - the template to use for formatting output (not currently implemented)
 * @param {string} precisionSetting - the precision to round to (default "No Rounding")
 * @returns {Array<string>} formatted text
 */
export function formatOutput(results: Array<LineInfo>, formatTemplate: string = '{{originalText}} {{value}}', precisionSetting: string = 'No Rounding'): Array<string> {
  const precision = precisionSetting === 'No Rounding' ? 14 : Number(precisionSetting)
  const resultsWithStringValues = results.map((line) => {
    const isPctOf = /(\d*[\.,])?(\d+\s?)(as|as a)?(\s*%)(\s+(of)\s+)(\d*[\.,])?(\d+\s?)/g.test(line.originalText)
    const isZero = line.lineValue === 0 && isLineType(line, ['N', 'S', 'T']) // && !/total/i.test(line.originalText)
    const isNotCalc = (String(line.lineValue) === line.expression && !isPctOf) || (Number(line.lineValue) === Number(line.expression) && !Number(line.expression) !== 0)
    const isNumericalAssignment = line.typeOfResult === 'A' && !/(\+|\-|\*|\/)+/.test(line.originalText)
    const isUndefined = line.lineValue === undefined
    let val = line.lineValue
    if (!isUndefined) {
      // logDebug(pluginJson, `checking line.lineValue: ${String(line?.lineValue)}`)
      if (checkIfUnit(line.lineValue)) {
        const strValue = String(line.lineValue).split(' ')
        val = `${round(Number(strValue[0]), precision)} ${strValue[1]}`
        logDebug(pluginJson, `checking val.value: ${val}`)
      } else {
        val = val && precision && typeof val === 'number' ? round(val, precision) : val
      }
    }
    // val = val.toFixed(precision).replace(/(?:\.\d*)(0+)$/,"")
    line.value = !line.lineValue || isZero || isNotCalc || isNumericalAssignment || isUndefined ? '' : `//= ${String(val)}` // eslint-disable-line eqeqeq
    if (line.error) line.value += ` //= ${line.error}`
    // logDebug(pluginJson, `line.value: ${line.value} line.expression: ${line.expression}`)
    return line
  })
  const formatted = resultsWithStringValues.map((line) => formatWithFields(formatTemplate, typeof line === 'object' ? line : {}))
  // logDebug(pluginJson, `Formatted data: ${JSON.stringify(resultsWithStringValues, null, 2)}`)

  return formatted
}

/**
 * Parse the code blocks in the current note
 * @returns {Array<LineInfo>} the results of the solver
 */
// export function parseCodeBlocks(): void {
//   // was: $ReadOnlyArray<$ReadOnly<CodeBlock>>
//   // $FlowIgnore
//   const codeBlocks = getCodeBlocksOfType('math')
//   if (codeBlocks.length) {
//     codeBlocks.map((block) => parse(block.text))
//   } else {
//     logDebug(pluginJson, `There were no code blocks to parse`)
//   }
// }

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
export function removeAnnotations(note: CoreNoteFields, blockData: $ReadOnly<CodeBlock>) {
  const updates = []
  for (let i = 0; i < blockData.paragraphs.length; i++) {
    const paragraph = blockData.paragraphs[i]
    if (/(\/\/\=.*)/g.test(paragraph.content)) {
      // const thisParaInNote = note.paragraphs[paragraph.lineIndex]
      paragraph.content = paragraph.content.replace(/(\/\/\=.*)/g, '').trimEnd()
    }
    paragraph.content = paragraph.content.trimEnd()
    updates.push(paragraph)
  }
  if (updates.length) note.updateParagraphs(updates)
}

export function annotateResults(note: CoreNoteFields, blockData: $ReadOnly<CodeBlock>, results: Array<LineInfo>, template: string, mode: string): void {
  const { columnarOutput, precisionSetting } = DataStore.settings
  logDebug(pluginJson, `annotateResults mode=${mode} results:${results.length} lines`)
  // clo(results, `annotateResults: results obj`)
  const totalsOnly = mode === 'totalsOnly'
  const debug = mode === 'debug'
  const precision = mode === 'noRounding' ? 'No Rounding' : precisionSetting
  formatOutput(results, template, precision) // important: populates the .value field for output
  // const updates = []
  let j = 0
  const debugOutput = []
  const outputObjects = []
  for (let i = 0; i < blockData.paragraphs.length; i++) {
    // const li = blockData.paragraphs[i].lineIndex
    const paragraph = blockData.paragraphs[i]
    const solverData = results[j]
    paragraph.content = paragraph.content.replace(/(\/\/\=.*)/g, '').trimEnd() //clean every line
    let shouldPrint = !totalsOnly || (totalsOnly && (solverData.typeOfResult === 'T' || solverData.typeOfResult === 'S'))
    if (debug) {
      shouldPrint = true
      // Probably don't need to output error, because it's in value field: ${solverData.error.length ? ` err:"${solverData.error}"` : ''}
      solverData.value = ` //= R${i}(${solverData.typeOfResult}): expr:"${solverData.expression}" lineValue:${String(solverData.lineValue)} value:"${String(solverData.value)}"`
      // debugOutput.push(`R${String(i).padStart(2,'0')}(${solverData.typeOfResult}): orig:"${solverData.originalText}" expr:"${solverData.expression}" lineValue:${solverData.lineValue} value:"${solverData.value }"`)
      debugOutput.push({
        row: `R${String(i)}`,
        typeOfResult: `${solverData.typeOfResult}`,
        originalText: `${solverData.originalText}`,
        expression: `${solverData.expression}`,
        lineValue: `${String(solverData.lineValue)}`,
        value: `"${String(solverData.value)}"`,
      })
    }
    if (solverData.value !== '' && shouldPrint) {
      const comment = solverData.value ? ` ${solverData.value}` : ''
      // clo(solverData, `annotateResults solverData`)
      // logDebug(pluginJson, `$comment=${comment}`)
      // const thisParaInNote = note.paragraphs[paragraph.lineIndex]
      // thisParaInNote.content.replace(/ {2}(\/\/\=.*)/g,'')
      if (columnarOutput && !debug) {
        outputObjects.push({ content: paragraph.content.trimEnd(), comment })
      } else {
        paragraph.content = paragraph.content.trimEnd() + comment
      }
      // `    logDebug(`annotateResults: paragraph.lineIndex: ${paragraph.lineIndex} content="${paragraph.content}" results[].value=${solverData.value || ''}`)
      //      logDebug(`${paragraph.content}${comment}`)
    } else {
      if (columnarOutput) {
        outputObjects.push({ content: paragraph.content.trimEnd(), comment: '' })
      }
    }
    j++
  }
  if (columnarOutput) {
    // clo(blockData.paragraphs,`blockData.paragraphs`)
    const formattedColumnarOutput = columnify(outputObjects)
    formattedColumnarOutput
      .split('\n')
      .slice(1)
      .forEach((line, i) => {
        blockData.paragraphs[i].content = line
      })
    // clo(formattedColumnarOutput, `annotateResults::formattedColumnarOutput\n`)
  }
  if (debugOutput.length && DataStore.settings._logLevel === 'DEBUG') {
    const columns = columnify(debugOutput) //options is a 2nd param
    console.log(`\n\n${columns}\nDebug Output:\n`)
  }
  // clo(updates, `annotateResults::updates:`)
  // if (updates.length) note.updateParagraphs(blockData.paragraphs)
  note.updateParagraphs(blockData.paragraphs)
}

/**
 * Show the results of the solver in popup
 * @param {Array<LineInfo>} results - the results of the solver
 * @param {string} template - should probably be called with settings.documentTemplate
 * @param {string} title - the title of the popup
 */
export async function showResultsInPopup(results: Array<LineInfo>, template: string, title: string): Promise<void> {
  if (results.length) {
    const formattedLines = formatOutput(results, template)
    const options = formattedLines.map((line, i) => ({ label: line, value: String(results[i].lineValue) }))
    logDebug(pluginJson, `Showing results in popup: ${String(options.map((o) => o.label))}`)
    const selected = await chooseOption(`${title} Results (return to copy line value)`, options, options[0].value)
    if (selected) {
      logDebug(pluginJson, `Selected: ${selected}`)
      Clipboard.string = String(selected)
    }
  }
}

/**
 * Remove all annotations previously added by this plugin
 * (plugin entrypoint for command: /Remove Annotations from Active Document)
 * @returns {void}
 */
export function removeAllAnnotations(buttonClickedIndex: number | null): void {
  if (Editor) {
    const note = Editor
    if (!note) return
    const codeBlocks = getCodeBlocksOfType(Editor, 'math')
    // logDebug(pluginJson, `removeAllAnnotations ${codeBlocks.length} "${buttonClickedIndex}"="${typeof buttonClickedIndex}"`)
    const blockToCalc = buttonClickedIndex != null ? findBlockToCalculate(codeBlocks, buttonClickedIndex) : null
    const startIndex = blockToCalc !== null ? blockToCalc : 0
    const endIndex = blockToCalc !== null ? blockToCalc + 1 : codeBlocks.length
    for (let i = startIndex; i < endIndex; i++) {
      // logDebug(pluginJson, `removeAllAnnotations ${i}/${codeBlocks.length}`)
      // clo(codeBlocks[i], `removeAllAnnotations::codeBlocks[${i}]`)
      const blockData = codeBlocks[i]
      removeAnnotations(note, blockData)
    }
  }
}

/**
 * Find the block index of the last block above the given line index
 * @param {*} blocks
 * @param {*} lineIndex
 * @returns
 */
export function findBlockToCalculate(blocks: $ReadOnlyArray<CodeBlock>, lineIndex: number): number {
  let blockToCalculate = -1
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const startLine = block.paragraphs[0].lineIndex
    const endLine = block.paragraphs[block.paragraphs.length - 1].lineIndex
    if (startLine < lineIndex && endLine < lineIndex) {
      blockToCalculate = i
    }
  }
  return blockToCalculate
}

/**
 * Generic math block processing function (can be called by calculate or totalsOnly)
 * @param {number|null} buttonClickedIndex - the index of the calculation button that was clicked (to look above it for the math block)
 * @param {boolean} mode - if empty, calculate normally, 'totalsOnly', only calculate totals, 'debug' - calculate with verbose debug output (default: '')
 */
export async function calculateBlocks(buttonClickedIndex: number | null = null, mode: string = '', vars: any = {}): Promise<void> {
  try {
    const { popUpTemplate, presetValues /*, precisionSetting */ } = DataStore.settings
    // const precision = (precisionSetting === "No Rounding") ? null : Number(precisionSetting) // doing rounding inside parse does not work well. Will do it inside annotate
    const precision = null
    // get the code blocks in the editor
    await removeAllAnnotations(buttonClickedIndex)
    // let codeBlocks = incoming === '' || incoming === null ? getCodeBlocksOfType(Editor, `math`) : [{ type: 'unknown', code: incoming, startLineIndex: -1 }]
    let codeBlocks = getCodeBlocksOfType(Editor, `math`)
    const blockToCalc = buttonClickedIndex !== null ? findBlockToCalculate(codeBlocks, buttonClickedIndex) : null
    const startIndex = blockToCalc !== null ? blockToCalc : 0
    const endIndex = blockToCalc !== null ? blockToCalc + 1 : codeBlocks.length
    // clo(codeBlocks, `calculateBlocks::codeBlocks`)
    logDebug(pluginJson, `calculateBlocks: codeBlocks.length:${codeBlocks.length} buttonClickedIndex:${buttonClickedIndex || ''} startIndex:${startIndex} endIndex:${endIndex}`)
    if (codeBlocks.length && Editor) {
      for (let b = startIndex; b < endIndex; b++) {
        if (b > 0) {
          // get the codeblocks again because the line indexes may have changed if the last round made edits
          codeBlocks = getCodeBlocksOfType(Editor, `math`)
        }
        const block = codeBlocks[b]
        // removeAnnotations(Editor, block) //FIXME: MAYBE put this back, especially for non-columnar output
        // clo(block,`calculateEditorMathBlocks block=`)
        let currentData = { info: [], variables: { ...presetValues, ...vars }, relations: [], expressions: [], rows: 0, precision }
        block.code.split('\n').forEach((line, i) => {
          currentData.rows = i + 1
          currentData = parse(line, i, currentData)
        })
        if (mode === 'noRounding') {
          currentData.precision = null
        }
        // const totalData = parse('TOTAL', currentData.rows, currentData)
        // const t = totalData.info[currentData.rows]
        // const totalLine = {
        //   lineValue: t.lineValue,
        //   originalText: t.originalText,
        //   expression: t.expression,
        //   row: -1,
        //   typeOfResult: t.typeOfResult,
        //   typeOfResultFormat: t.typeOfResultFormat,
        //   value: t.value,
        //   error: '',
        // }
        // logDebug(pluginJson,`Final data: ${JSON.stringify(currentData,null,2)}`)
        // TODO: Maybe add a total if there isn't one? But maybe  people are not adding?
        // if (currentData.info[currentData.info.length-1].typeOfResult !== "T") {
        //   currentData = parse("total",i,currentData)
        // }
        // TODO: add user pref for whether to include total or not
        // clo(currentData, `calculateEditorMathBlocks mathBlock[${b}] currentData:`)
        await annotateResults(Editor, block, currentData.info, popUpTemplate, mode)
        // await showResultsInPopup([totalLine,...currentData.info], popUpTemplate, `Block ${b+1}`)
      }
    } else {
      const msg = `Did not find any 'math' code blocks in active editor`
      logDebug(pluginJson, msg)
      await showMessage(msg)
    }
  } catch (error) {
    logError(pluginJson, `calculateBlocks error: ${error}`)
  }
}

/**
 * Calculate all the math blocks on the current page
 * (plugin entrypoint for command: /Calculate Math Code Blocks in Active Document)
 * @param {string} incoming - string from xcallback entry
 */
export async function calculateEditorMathBlocks(incoming: string | null = null) {
  try {
    await calculateBlocks(null, '', getFrontmatterVariables(Editor.content || ''))
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Calculate the math block preceeding the button that was clicked
 * (plugin entrypoint for command: /Calculate Preceeding Math Block -- hidden, used only by xcallback)
 */
export async function calculatePreceedingMathBlock(id: string) {
  try {
    const paragraph = Editor.paragraphs.find((p) => p.content.includes(id))
    if (paragraph) {
      // const buttonClickedIndex = await getSelectedParagraphLineIndex()
      const buttonClickedIndex = paragraph.lineIndex
      logDebug(pluginJson, `calculatePreceedingMathBlock calling calculateBlocks with buttonClickedIndex=${buttonClickedIndex} content:"${paragraph.content}"`)
      await calculateBlocks(buttonClickedIndex, '', getFrontmatterVariables(Editor.content || ''))
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Calculate the math block preceeding the button that was clicked
 * (plugin entrypoint for command: /Calculate Preceeding Math Block -- hidden, used only by xcallback)
 */
export async function calculatePreceedingMathBlockTotal(id: string) {
  try {
    const paragraph = Editor.paragraphs.find((p) => p.content.includes(id))
    if (paragraph) {
      // const buttonClickedIndex = await getSelectedParagraphLineIndex()
      const buttonClickedIndex = paragraph.lineIndex
      logDebug(pluginJson, `calculatePreceedingMathBlock calling calculateBlocks with buttonClickedIndex=${buttonClickedIndex} content:"${paragraph.content}"`)
      await calculateBlocks(buttonClickedIndex, 'totalsOnly', getFrontmatterVariables(Editor.content || ''))
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Calculate the math block preceeding the button that was clicked
 * (plugin entrypoint for command: /Calculate Preceeding Math Block -- hidden, used only by xcallback)
 */
export function clearPreceedingMathBlock(id: string) {
  try {
    if (id) {
      const paragraph = Editor.paragraphs.find((p) => p.content.includes(id))
      if (paragraph) {
        removeAllAnnotations(paragraph.lineIndex)
      }
    }
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Calculate all the math blocks on the current page but annotate the totals only
 * (plugin entrypoint for command: /Calculate Totals Only)
 * @param {string} incoming - string from xcallback entry
 */
export async function calculateEditorMathBlocksTotalsOnly(incoming: string | null = null) {
  try {
    await calculateBlocks(null, 'totalsOnly', getFrontmatterVariables(Editor.content || ''))
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Calculate Math Blocks with no rounding
 * Plugin entrypoint for "/Calculate Math Blocks (no rounding)"
 */
export async function calculateNoRounding(incoming: string) {
  try {
    await calculateBlocks(null, 'noRounding', getFrontmatterVariables(Editor.content || ''))
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * Insert a math block and a calculate button
 *  (plugin entrypoint for command: /Insert Math Block at Cursor)
 */
export async function insertMathBlock() {
  try {
    const { includeCalc, includeClear, includeTotals } = DataStore.settings
    // NOTE: this relies on the calculate command being the first in the list in plugin.json
    const guid = CreateUUID(8)
    const calcLink = includeCalc ? `[Calculate](${createRunPluginCallbackUrl(pluginJson['plugin.id'], pluginJson['plugin.commands'][0].name, [guid])})` : ''
    const clrLink = includeClear ? `[Clear](${createRunPluginCallbackUrl(pluginJson['plugin.id'], pluginJson['plugin.commands'][1].name, [guid])})` : ''
    const totLink = includeTotals ? `[Totals](${createRunPluginCallbackUrl(pluginJson['plugin.id'], pluginJson['plugin.commands'][2].name, [guid])})` : ''
    let buttonLine = includeClear ? clrLink : ''
    buttonLine = includeCalc ? `${buttonLine + (includeClear ? ` ` : '')}${calcLink}` : buttonLine
    buttonLine = includeTotals ? `${buttonLine + (includeClear || includeCalc ? ` ` : '')}${totLink}` : buttonLine
    buttonLine = buttonLine.length ? `${buttonLine}\n` : ''
    const onLine = Editor?.selection?.start && Editor.selection.start >= 0 ? getParagraphContainingPosition(Editor, Editor.selection.start) : null
    const returnIfNeeded = onLine?.type !== 'empty' ? '\n' : ''
    const block = `${returnIfNeeded}\`\`\`math\n\n\`\`\`\n${buttonLine}`
    await Editor.insertTextAtCursor(block)
    const sel = Editor.selection
    if (sel) {
      const para = Editor?.selection?.start && Editor.selection.start >= 0 ? getParagraphContainingPosition(Editor, Editor.selection.start) : null
      if (para && para.lineIndex) {
        const offset = buttonLine.length ? 3 : 2
        const range = Editor.paragraphs[para.lineIndex - offset].contentRange
        if (range?.start) {
          Editor.select(range.start, 0)
        }
      }
    }
  } catch (error) {
    logError(pluginJson, error)
  }
}

/**
 * Calculate Math Block with Verbose Debug Output
 * Plugin entrypoint for "/Debug Math Calculations"
 */
export async function debugMath() {
  try {
    await calculateBlocks(null, 'debug', getFrontmatterVariables(Editor.content || ''))
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
