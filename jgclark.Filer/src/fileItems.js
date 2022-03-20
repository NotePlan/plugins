// @flow
// ----------------------------------------------------------------------------
// Plugin to help move selected selectedParagraphs to other notes
// Jonathan Clark
// last updated 2.3.2022 for v0.6.1
// ----------------------------------------------------------------------------

import pluginJson from "../plugin.json"
import type { EventsConfig } from '../../helpers/NPCalendar'
import { castBooleanFromMixed, castStringFromMixed, } from '../../helpers/dataManipulation'
import { todaysDateISOString, } from '../../helpers/dateTime'
import { clo, log, logError, logWarn } from '../../helpers/dev'
import { displayTitle } from '../../helpers/general'
import { allNotesSortedByChanged } from '../../helpers/note'
import {
  calcSmartPrependPoint,
  findEndOfActivePartOfNote,
  findStartOfActivePartOfNote,
  parasToText,
  selectedLinesIndex,
} from '../../helpers/paragraph'
import { chooseHeading } from '../../helpers/userInput'
import { getOrMakeConfigurationSection } from '../../nmn.Templates/src/configuration'

//-----------------------------------------------------------------------------
// // Get settings

const configKey = 'filer'

type FilerConfig = {
  addDateBacklink: boolean,
  dateRefStyle: string,
  useExtendedBlockDefinition: boolean,
  whereToAddInSection: string,
  version: string
}

async function getFilerSettings(): Promise<FilerConfig> {
  log(pluginJson, `Start of getFilerSettings()`)
  let config: FilerConfig

  const v2Config: FilerConfig = DataStore.settings
  // $FlowFixMe[incompatible-call]
  // clo(v2Config, 'v2Config settings:')

  if (v2Config != null && Object.keys(v2Config).length > 0) {
    config = v2Config
    log(pluginJson, `Using V2 config`)
  } else {
    // Get config settings from Template folder _configuration note or ConfigV2
    const v1config = await getOrMakeConfigurationSection(
      configKey,
      // DEFAULT_FILER_OPTIONS,
      // no minimum config
    ) ?? {}

    
    if (v1config == null || Object.keys(v1config).length === 0) {
      log(pluginJson, `Info: couldn't find '${configKey}' settings. Will use defaults.`)
      config = {
        addDateBacklink: false,
        dateRefStyle: 'link',
        useExtendedBlockDefinition: false,
        whereToAddInSection: 'start',
        version: '(no config found)'
      }
    } else {
      log(pluginJson, `Found '${configKey}' settings`)
      config = {
        addDateBacklink: castBooleanFromMixed(v1config, 'addDateBacklink'),
        dateRefStyle: castStringFromMixed(v1config, 'dateRefStyle'),
        useExtendedBlockDefinition: castBooleanFromMixed(v1config, 'useExtendedBlockDefinition'),
        whereToAddInSection: castStringFromMixed(v1config, 'whereToAddInSection'),
        version: '(v1Config)'
      }
    }
    // $FlowFixMe
    // clo(config, `\t${configKey} V1 _config settings:`)
  }
  return config
}

// ----------------------------------------------------------------------------

/**
 * Move text to a different note.
 * NB: Can't selecet dates with no existing Calendar note.
 * TODO(EduardMe): Waiting for better date picker from Eduard before working further on this.
 *
 * This is how we identify what we're moving (in priority order):
 * - current selection
 * - current heading + its following section
 * - current line
 * - current line (plus any paragraphs directly following). NB: the Setting
 *   'useExtendedBlockDefinition' decides whether these directly following paragaphs
 *   have to be indented (false) or can take all following lines at same level until next
 *   empty line as well.
 * @author @jgclark
 */
export async function moveParas(): Promise<void> {
  const { content, paragraphs, selectedParagraphs, note } = Editor
  if (content == null || selectedParagraphs == null || note == null) {
    // No note open, or no selectedParagraph selection (perhaps empty note), so don't do anything.
    logWarn(pluginJson, 'No note open, so stopping.')
    return
  }

  // Get config settings from Template folder _configuration note
  const config = await getFilerSettings()

  // Get current selection, and its range
  // TODO: Break this out into a separate helper function, which could also be used in progress.js
  // TODO: First check progress.js for getSelectedParaIndex() which does some of this.
  const selection = Editor.selection
  if (selection == null) {
    logWarn(pluginJson, 'No selection found, so stopping.')
    return
  }
  // Get paragraph indexes for the start and end of the selection (can be the same)
  // const firstSelParaIndex = selectedLinesIndex(selection, paragraphs)
  const [firstSelParaIndex, lastSelParaIndex] = selectedLinesIndex(selection, paragraphs)

  // Get paragraphs for the selection or block
  const parasInBlock: Array<TParagraph> = (lastSelParaIndex != firstSelParaIndex)
    // $FlowIgnore[incompatible-type]  
    ? selectedParagraphs
    : getParagraphBlock(note, firstSelParaIndex, config.useExtendedBlockDefinition)

  // If this is a calendar note we've moving from, and the user wants to
  // create a date backlink, then append backlink to the first selectedPara in parasInBlock
  if (config.addDateBacklink && note.type === 'Calendar') {
    parasInBlock[0].content = `${parasInBlock[0].content} >${todaysDateISOString}`
  }

  // There's no API function to work on multiple selectedParagraphs,
  // or one to insert an indented selectedParagraph, so we need to convert the selectedParagraphs
  // to a raw text version which we can include
  const selectedParasAsText = parasToText(parasInBlock)

  // Decide where to move to
  // Ask for the note we want to add the selectedParas
  const notes = allNotesSortedByChanged()

  const res = await CommandBar.showOptions(
    notes.map((n) => n.title ?? 'untitled'),
    `Select note to move ${parasInBlock.length} lines to`,
  )
  const destNote = notes[res.index]
  // TODO(EduardMe): The problem is that the showOptions returns the first item if something else is typed. And I can't see a way to distinguish between the two.
  // log(pluginJson, displayTitle(destNote)) // NB: -> first item in list (if a new item is typed)

  // Ask to which heading to add the selectedParas
  const headingToFind = (await chooseHeading(destNote, true)).toString() // don't know why this coercion is required for flow

  log(pluginJson, `  Moving to note: ${destNote.title ?? 'untitled'} under heading: '${headingToFind}'`)

  // Add to new location
  // Currently there's no API function to deal with multiple selectedParagraphs,
  // but we can insert a raw text string.
  // (can't simply use note.addParagraphBelowHeadingTitle() as we have more options than in supports)
  const destNoteParas = destNote.paragraphs
  let insertionIndex = null
  if (headingToFind === destNote.title || headingToFind.includes('(top of note)')) { // i.e. the first line in project or calendar note
    insertionIndex = calcSmartPrependPoint(destNote)
    log(pluginJson, `  -> top of note, line ${insertionIndex}`)
  } else if (headingToFind.includes('(bottom of note)')) {
    insertionIndex = destNoteParas.length + 1
    log(pluginJson, `  -> bottom of note, line ${insertionIndex}`)
  } else {
    for (let i = 0; i < destNoteParas.length; i++) {
      const p = destNoteParas[i]
      if (p.content.trim() === headingToFind && p.type === 'title') {
        insertionIndex = i + 1
        break
      }
    }
    log(pluginJson, `  -> other heading, line ${String(insertionIndex)}`)
  }
  if (insertionIndex === null) {
    logError(pluginJson, `insertionIndex is null. Stopping.`)
    return
  }
  log(pluginJson, `Inserting ${parasInBlock.length} paras at index ${insertionIndex} into new note`)
  await destNote.insertParagraph(selectedParasAsText, insertionIndex, 'empty')

  // delete from existing location
  log(pluginJson, `Removing ${parasInBlock.length} paras from original note`)
  note.removeParagraphs(parasInBlock)
}

// Quick tester function
// export function testStart(): void {
//   if (Editor.note != null) {
//     const result: number = findStartOfActivePartOfNote(Editor.note)
//     log(pluginJson, result)
//   }
// }

/**
 * Get the set of paragraphs that make up this block based on the current paragraph.
 * This is how we identify the block:
 * - current line, plus any indented paragraphs that directly follow it
 * - current line, plus if this line is a heading, its following section
 *
 * The plugin setting 'useExtendedBlockDefinition' decides whether to include more lines:
 * if its true (and by default it is false) then it will work as if the cursor is on the
 * preceding heading line, and take all its lines up until the next same-level heading.
 *
 * NB: in both cases the block always finishes before any horizontal line (e.g. --- or ***).
 * @author @jgclark
 * @param {[TParagraph]} allParas - all selectedParas in the note
 * @param {number} selectedParaIndex - the index of the current Paragraph
 * @param {boolean} useExtendedBlockDefinition - TODO:
 * @return {[TParagraph]} the set of selectedParagraphs in the block
 */
export function getParagraphBlock(
  note: TNote,
  selectedParaIndex: number,
  useExtendedBlockDefinition: boolean = false
): Array<TParagraph> {
  const parasInBlock: Array<TParagraph> = [] // to hold set of paragraphs in block to return
  const endOfActiveSection = findEndOfActivePartOfNote(note)
  const startOfActiveSection = findStartOfActivePartOfNote(note)
  const allParas = note.paragraphs
  let startLine = selectedParaIndex
  let selectedPara = allParas[startLine]
  log(pluginJson, `  getParaBlock: ${selectedParaIndex} ${selectedPara.type} '${selectedPara.content}'`)

  if (useExtendedBlockDefinition) {
    // include line unless we hit a new heading, an empty line, or a less-indented line
    // TODO: also work out what to do about lower-level headings
    // First look earlier to find earlier lines up to a blank line or horizontal rule
    for (let i = selectedParaIndex - 1; i > startOfActiveSection; i--) {
      const p = allParas[i]
      // log(pluginJson, `  ${i} / indent ${p.indents} / ${p.content}`)
      if (p.type === 'separator') {
        log(pluginJson, `Found separator line`)
        startLine = i + 1
        break
      } else if (p.content === '') {
        log(pluginJson, `Found blank line`)
        startLine = i + 1
        break
      } else if (p.type === 'title') {
        log(pluginJson, `Found heading`)
        startLine = i
        // parasInBlock.unshift(p) // save para onto front, but then stop
        break
      }
      // parasInBlock.unshift(p) // save para onto front
    }
    log(pluginJson, `For extended block worked back and will now start at line ${startLine}`)
  }

  selectedPara = allParas[startLine]

  // if the first line is a heading, find the rest of its section
  if (selectedPara.type === 'title') {
    // includes all heading levels
    const thisHeadingLevel = selectedPara.headingLevel
    log(pluginJson, `  Found heading level ${thisHeadingLevel}`)
    parasInBlock.push(selectedPara) // make this the first line to move
    // Work out how far this section extends. (NB: headingRange doesn't help us here.)
    for (let i = startLine + 1; i < endOfActiveSection; i++) {
      const p = allParas[i]
      if (p.type === 'title' && p.headingLevel <= thisHeadingLevel) {
        // log(pluginJson, `Found new heading of same or higher level`)
        break
      } 
      if (p.type === 'separator') {
        // log(pluginJson, `Found HR`)
        break
      } else if (p.content === '') {
        // log(pluginJson, `Found blank line`)
        break
      }
      parasInBlock.push(p)
    }
    // log(pluginJson, `  Found ${parasInBlock.length} heading section lines`)
  } else {
    // This isn't a heading.
    const startingIndentLevel = selectedPara.indents
    log(pluginJson, `  Found single line with indent level ${startingIndentLevel}`)
    parasInBlock.push(selectedPara)

    // See if there are following indented lines to move as well
    for (let i = startLine + 1; i < endOfActiveSection; i++) {
      const p = allParas[i]
      // log(pluginJson, `  ${i} / indent ${p.indents} / ${p.content}`)
      // stop if horizontal line
      if (p.type === 'separator') {
        // log(pluginJson, `Found HR`)
        break
      } else if (p.content === '') {
        // log(pluginJson, `Found blank line`)
        break
      } else if (p.indents <= startingIndentLevel) {
        // stop as this selectedPara is same or less indented than the starting line
        // log(pluginJson, `Stopping as found lower indent`)
        break
      }
      parasInBlock.push(p) // add onto end of array
    }
  }

  log(pluginJson, `  Found ${parasInBlock.length} paras in block:`)
  for (const pib of parasInBlock) {
    log(pluginJson, `    ${pib.content}`)
  }
  return parasInBlock
}
