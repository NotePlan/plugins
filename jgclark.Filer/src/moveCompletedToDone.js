// @flow
// ----------------------------------------------------------------------------
// Move completed / cancelled tasks and checklists in a note to a '## Done' section
// Jonathan Clark, aided by Cursor AI
// Last updated 2026-06-26 for v1.6.1 by @jgclark
// ----------------------------------------------------------------------------
/**
 * Original prompt for AI:
 * Add a new feature to the jgclark.Filer plugin. 
This will take a note and move all lines with completed and cancelled tasks and checklists to a section at the end of the file that starts '## Done'. Create this section if it doesn't already exist. 
Only move lines if and any child lines are all completed or cancelled as well. Use the helpers/NPParagraph.js function getParagraphBlock() with parameter includeFromStartOfSection set to false, and includeFromStartOfSection to false, to select child lines.
There need to be two further options, added to the config settings for this plugin. The first is called "Recreate existing section structure in Done section?", and will insert copies of any necessary headings in the '## Done' area, in the order that they appear in the main part of the note.
The second is called "Only move completed items when whole section is complete?". If this is set, then set the parameter includeFromStartOfSection to true.
Write this to a new file in the jgclark.Filer/src folder.
Generate jest tests for this function.

It did a reasonable job, but it hasn't used some existing helper functions, and it didn't use note.insertHeading() over .insertParagraph().

Later for 1.6.1 I asked it to update it:
- To match "Done …" as well as "Done" headings.
- When all of a section block is completed, it should move all the section, including the heading, in exact order, to the "Done" section, and remove all of it from the active section, including the heading. 
- Section note lines (non-task lines that aren't indented under a task) should get archived directly under the heading, once the whole of the section is moved to Done.
- If a section has no tasks at all, only notes, then don't archive any of it.
- Use the add-one-level-to-section-heading consistently to ensure that the section headings are nested one level deeper inside the Done section.
 */

import type { FilerConfig } from './filerHelpers'
import { getFilerSettings } from './filerHelpers'
import { blockHasActiveTasks, getParagraphBlock } from '@helpers/blocks'
import { clo, JSP, logDebug, logInfo, logError, logTimer, logWarn, timer } from '@helpers/dev'
import { getCurrentHeading, isParaAMatchForHeading } from '@helpers/headings'
import { insertParas } from '@helpers/paragraph'
import { isClosed } from '@helpers/utils'
import { showMessage, showMessageYesNoCancel } from '@helpers/userInput'

//----------------------------------------------------------------------------
// Constants

const PLUGIN_ID = "jgclark.Filer"
const MAKE_HEADINGS_ONE_DEEPER: boolean = true
const WHEN_TO_MOVE_ASK_EACH_TIME = 'ask each time'
const WHEN_TO_MOVE_SECTION_COMPLETE = 'move when whole section complete'
const WHEN_TO_MOVE_ANY_COMPLETE = 'move when any are complete'
const WHEN_TO_MOVE_CHOICES: Array<string> = [
  WHEN_TO_MOVE_ASK_EACH_TIME,
  WHEN_TO_MOVE_SECTION_COMPLETE,
  WHEN_TO_MOVE_ANY_COMPLETE,
]

const TASK_PARA_TYPES: Array<string> = [
  'open',
  'scheduled',
  'todo',
  'checklist',
  'checklistScheduled',
  'done',
  'cancelled',
  'checklistDone',
  'checklistCancelled',
]

//----------------------------------------------------------------------------
// Helper Functions

/**
 * Check whether the given paragraph has an open task/checklist parent above it
 * at a lower indentation level.
 * Used to optionally skip moving completed subtasks that are still visually
 * part of an open parent task.
 * @author Cursor
 * @param {TNote} note
 * @param {TParagraph} para
 * @returns {boolean}
 */
function hasOpenParentTask(note: TNote, para: TParagraph): boolean {
  if (para.lineIndex == null) {
    return false
  }

  const paras = note.paragraphs
  const currentIndex = para.lineIndex
  const currentIndent = para.indents ?? 0

  // Walk upwards to find any less-indented ancestor task line
  for (let i = currentIndex - 1; i >= 0; i--) {
    const candidate = paras[i]
    const candidateIndent = candidate.indents ?? 0

    // Only consider true parents: lines above with lower indentation
    if (candidateIndent < currentIndent) {
      const taskTypes = [
        'open',
        'scheduled',
        'todo',
        'checklist',
        'checklistScheduled',
      ]
      const isPotentialTaskParent = taskTypes.includes(candidate.type)

      if (isPotentialTaskParent) {
        if (!isClosed(candidate)) {
          return true
        }
        // Closed parent; keep scanning upwards in case there is an open ancestor task
        continue
      }
      // Non-task ancestor at a lower indent: keep searching upwards
      continue
    }
  }

  return false
}

/**
 * Return the line index where the Done archive area ends (before ## Cancelled or end of note).
 * Sub-headings deeper than the Done heading (e.g. recreated ### Section A) are included in the archive.
 * @param {TNote} note
 * @param {number} doneHeadingLineIndex
 * @returns {number}
 */
function getDoneArchiveEndIndex(note: TNote, doneHeadingLineIndex: number): number {
  const doneHeading = note.paragraphs[doneHeadingLineIndex]
  const doneLevel = doneHeading?.headingLevel ?? 2
  for (let i = doneHeadingLineIndex + 1; i < note.paragraphs.length; i++) {
    const p = note.paragraphs[i]
    if (p.type === 'title' && (p.headingLevel ?? 1) <= doneLevel && p.content.trim().startsWith('Cancelled')) {
      return i
    }
  }
  return note.paragraphs.length
}

/**
 * Extract normalised heading text and desired level for a source heading paragraph.
 * @param {TParagraph} sourceHeading
 * @returns {{ headingTextContent: string, desiredHeadingLevel: number }}
 */
function getSubheadingMatchDetails(sourceHeading: TParagraph): { headingTextContent: string, desiredHeadingLevel: number } {
  const desiredHeadingLevel = Math.min(
    (sourceHeading.headingLevel ?? 2) + (MAKE_HEADINGS_ONE_DEEPER ? 1 : 0),
    5,
  )
  const headingTextContent = (sourceHeading.rawContent ?? sourceHeading.content ?? '')
    .replace(/^\s*#+\s+/, '')
    .trim()
  return { headingTextContent, desiredHeadingLevel }
}

/**
 * Under the '## Done' section, find an existing copy of the given heading.
 * @param {TNote} note
 * @param {TParagraph} sourceHeading
 * @param {number} doneHeadingLineIndex
 * @returns {TParagraph | null}
 */
function findSubheadingInDoneSection(
  note: TNote,
  sourceHeading: TParagraph,
  doneHeadingLineIndex: number,
): TParagraph | null {
  const paras = note.paragraphs
  const { headingTextContent, desiredHeadingLevel } = getSubheadingMatchDetails(sourceHeading)
  const endIndex = getDoneArchiveEndIndex(note, doneHeadingLineIndex)

  for (let i = doneHeadingLineIndex + 1; i < endIndex; i++) {
    const p = paras[i]
    const pContent = (p.rawContent ?? p.content ?? '')
      .replace(/^\s*#+\s+/, '')
      .trim()
    if (
      p.type === 'title' &&
      p.headingLevel === desiredHeadingLevel &&
      pContent === headingTextContent
    ) {
      return p
    }
  }
  return null
}

/**
 * Under the '## Done' section, find (or create) a copy of the given heading
 * at one level deeper than the original (e.g. '## Heading' -> '### Heading' under '## Done').
 * Returns the paragraph representing the subheading in the Done section.
 * @param {TNote} note
 * @param {TParagraph} sourceHeading
 * @param {number} doneHeadingLineIndex
 */
function getOrCreateSubheadingInDoneSection(
  note: TNote,
  sourceHeading: TParagraph,
  doneHeadingLineIndex: number,
): TParagraph {
  const existing = findSubheadingInDoneSection(note, sourceHeading, doneHeadingLineIndex)
  if (existing) {
    return existing
  }

  const { headingTextContent, desiredHeadingLevel } = getSubheadingMatchDetails(sourceHeading)

  // No existing heading found, so create a new one at the end of the Done section
  const insertionIndex = getDoneArchiveEndIndex(note, doneHeadingLineIndex)

  logDebug('moveCompletedToDone', `Creating heading: "${headingTextContent}", level=${desiredHeadingLevel}`)
  // $FlowFixMe[incompatible-call]
  note.insertHeading(headingTextContent, insertionIndex, desiredHeadingLevel)

  // After insertion, re-read the paragraph and verify/fix if needed
  const updatedParas = note.paragraphs
  const insertedHeading = updatedParas.find(
    (p, idx) => {
      if (idx < doneHeadingLineIndex) return false
      if (p.type !== 'title' || p.headingLevel !== desiredHeadingLevel) return false
      const pContent = (p.rawContent ?? p.content ?? '')
        .replace(/^\s*#+\s+/, '')
        .trim()
      return pContent === headingTextContent
    },
  )

  // If heading was found but has wrong rawContent (extra #), fix by setting content and updating
  if (insertedHeading && insertedHeading.rawContent) {
    const headingMarker = '#'.repeat(desiredHeadingLevel)
    const expectedRawContent = `${headingMarker} ${headingTextContent.trim()}`
    const extraHashPrefix = `# ${expectedRawContent}`
    if (insertedHeading.rawContent !== expectedRawContent && insertedHeading.rawContent.startsWith(extraHashPrefix)) {
      logWarn('moveCompletedToDone', `Fixing heading with extra #: "${insertedHeading.rawContent}" -> "${expectedRawContent}"`)
      insertedHeading.content = headingTextContent.trim()
      note.updateParagraph(insertedHeading)
    }
  }

  if (insertedHeading) {
    return insertedHeading
  }
  return updatedParas[insertionIndex]
}

/**
 * Return the line index just before the next heading of same-or-higher level under headingPara.
 * @param {TNote} note
 * @param {TParagraph} headingPara
 * @returns {number}
 */
function getSubsectionEndIndex(note: TNote, headingPara: TParagraph): number {
  if (headingPara.lineIndex == null) {
    return note.paragraphs.length
  }
  const thisLevel = headingPara.headingLevel ?? 2
  const paras = note.paragraphs
  let endIndex = paras.length
  for (let i = headingPara.lineIndex + 1; i < paras.length; i++) {
    const p = paras[i]
    if (p.type === 'title' && (p.headingLevel ?? 1) <= thisLevel) {
      endIndex = i
      break
    }
  }
  // Back up over any trailing empty/blank lines so new content is inserted
  // immediately after the last real line of the subsection (keeps the Done section compact).
  while (endIndex > headingPara.lineIndex + 1 && isEmptyPara(paras[endIndex - 1])) {
    endIndex--
  }
  return endIndex
}

/**
 * Return true if the paragraph is an empty/blank line (type 'empty' or whitespace-only content).
 * @param {TParagraph} para
 * @returns {boolean}
 */
function isEmptyPara(para: TParagraph): boolean {
  if (para.type === 'empty') {
    return true
  }
  return (para.rawContent ?? para.content ?? '').trim() === ''
}

/**
 * Build insert lines and types from paragraphs, using rawContent to preserve the original
 * markers and indentation. Each line is inserted as type 'text' so NotePlan does NOT re-add
 * a type marker (which would double up e.g. '* [x] * [x] ', '- - ', '> > '); NotePlan re-parses
 * the raw markdown into the correct paragraph type on read.
 * Empty/blank lines are skipped so the Done section stays compact (no stray blank lines).
 * @param {Array<TParagraph>} parasToInsert
 * @returns {{ linesToInsert: Array<string>, paraTypesToInsert: Array<ParagraphType> }}
 */
function buildInsertLinesFromParas(parasToInsert: Array<TParagraph>): { linesToInsert: Array<string>, paraTypesToInsert: Array<ParagraphType> } {
  const nonEmptyParas = parasToInsert.filter((p) => !isEmptyPara(p))
  const linesToInsert = nonEmptyParas.map((p) => (p.rawContent ?? p.content ?? '').replace(/\s+$/, ''))
  const paraTypesToInsert = nonEmptyParas.map((): ParagraphType => 'text')
  return { linesToInsert, paraTypesToInsert }
}

/**
 * Determine whether the paragraph at the given index in a section body is indented
 * under a task/checklist line, by climbing its ancestor chain (any less-indented
 * ancestor line). Returns true if any ancestor is a task/checklist paragraph.
 * @param {Array<TParagraph>} bodyParas
 * @param {number} index
 * @returns {boolean}
 */
function isIndentedUnderTask(bodyParas: Array<TParagraph>, index: number): boolean {
  let currentIndent = bodyParas[index].indents ?? 0
  if (currentIndent === 0) {
    return false
  }
  // Walk upwards through ancestors (lines at progressively lower indents)
  for (let i = index - 1; i >= 0; i--) {
    const candidateIndent = bodyParas[i].indents ?? 0
    if (candidateIndent < currentIndent) {
      if (TASK_PARA_TYPES.includes(bodyParas[i].type)) {
        return true
      }
      // Climb to this ancestor's level and keep looking for higher ancestors
      currentIndent = candidateIndent
      if (candidateIndent === 0) {
        break
      }
    }
  }
  return false
}

/**
 * Split section body paragraphs into non-task and task groups.
 * Non-task lines that are indented under a task/checklist line stay grouped with the
 * tasks (so a parent task keeps its indented note children), and only top-level note
 * lines (non-task lines not indented under a task) are returned as nonTaskParas.
 * @param {Array<TParagraph>} bodyParas
 * @returns {{ nonTaskParas: Array<TParagraph>, taskParas: Array<TParagraph> }}
 */
function splitSectionBodyParas(bodyParas: Array<TParagraph>): { nonTaskParas: Array<TParagraph>, taskParas: Array<TParagraph> } {
  const nonTaskParas: Array<TParagraph> = []
  const taskParas: Array<TParagraph> = []
  bodyParas.forEach((p, i) => {
    if (!TASK_PARA_TYPES.includes(p.type) && !isIndentedUnderTask(bodyParas, i)) {
      nonTaskParas.push(p)
    } else {
      taskParas.push(p)
    }
  })
  return { nonTaskParas, taskParas }
}

/**
 * Merge a whole completed section body into an existing matching subsection under '## Done'.
 * Non-task lines are inserted immediately after the subsection heading; task lines are appended
 * at the end of the subsection, after any existing content.
 * @param {TNote} note
 * @param {TParagraph} existingSubheading
 * @param {Array<TParagraph>} bodyParas
 */
function mergeWholeSectionIntoDoneSubsection(
  note: TNote,
  existingSubheading: TParagraph,
  bodyParas: Array<TParagraph>,
): void {
  try {
    if (existingSubheading.lineIndex == null) {
      logWarn('moveCompletedToDone', 'mergeWholeSectionIntoDoneSubsection: existingSubheading has no lineIndex')
      return
    }

    const { nonTaskParas, taskParas } = splitSectionBodyParas(bodyParas)

    if (nonTaskParas.length > 0) {
      const { linesToInsert, paraTypesToInsert } = buildInsertLinesFromParas(nonTaskParas)
      if (linesToInsert.length > 0) {
        insertParas(note, existingSubheading.lineIndex + 1, linesToInsert, paraTypesToInsert)
      }
    }

    if (taskParas.length > 0) {
      const subheadingLineIndex = existingSubheading.lineIndex
      const freshSubheading = note.paragraphs[subheadingLineIndex]
      if (!freshSubheading) {
        logWarn('moveCompletedToDone', 'mergeWholeSectionIntoDoneSubsection: could not re-read subsection heading')
        return
      }
      const taskInsertionIndex = getSubsectionEndIndex(note, freshSubheading)
      const { linesToInsert, paraTypesToInsert } = buildInsertLinesFromParas(taskParas)
      if (linesToInsert.length > 0) {
        insertParas(note, taskInsertionIndex, linesToInsert, paraTypesToInsert)
      }
    }
  } catch (error) {
    logError('moveCompletedToDone', error.message)
  }
}

/**
 * Insert the given paragraphs as rawContent lines at the end of a section defined by a heading paragraph. 
 * New lines are inserted just before the next heading of same-or-higher level, or at end of note.
 * @param {TNote} note
 * @param {TParagraph} headingPara
 * @param {Array<TParagraph>} parasToInsert
 */
function appendParasUnderHeading(
  note: TNote,
  headingPara: TParagraph,
  parasToInsert: Array<TParagraph>,
): void {
  try {
    if (headingPara.lineIndex == null) {
      logWarn('moveCompletedToDone', 'appendParasUnderHeading: headingPara has no lineIndex')
      return
    }
    const insertionIndex = getSubsectionEndIndex(note, headingPara)

    const { linesToInsert, paraTypesToInsert } = buildInsertLinesFromParas(parasToInsert)
    if (linesToInsert.length === 0) {
      return
    }

    insertParas(note, insertionIndex, linesToInsert, paraTypesToInsert)
  } catch (error) {
    logError('moveCompletedToDone', error.message)
  }
}

/**
 * Find the first level-2 Done-style archive heading in the note, using the same
 * matching rules as findEndOfActivePartOfNote().
 * @param {TNote} note
 * @param {string} doneSectionHeadingName
 * @returns {TParagraph | void}
 */
function findNamedDoneSectionHeading(note: TNote, doneSectionHeadingName: string): TParagraph | void {
  const trimmedName = doneSectionHeadingName.trim()
  return note.paragraphs.find((p) => isParaAMatchForHeading(p, trimmedName, 2))
}

/**
 * Find the Done-style section in a note based on a heading name, or create it at the end if not present. Returns the lineIndex of the Done heading.
 * Note: I had wondered whether to move the setting for the Done section heading name to the Shared plugin. But Cursor tells me that this is the _only command that writes to the Done section_, as opposed to stopping scanning at the Done section.
 * @author Cursor, guided by @jgclark
 * @param {TNote} note
 * @param {string} doneSectionHeadingName
 * @returns {number} lineIndex of the Done-style heading
 */
function getOrCreateNamedDoneSection(note: TNote, doneSectionHeadingName: string): number {
  const paras = note.paragraphs
  const trimmedName = doneSectionHeadingName.trim()
  const existingDone = findNamedDoneSectionHeading(note, trimmedName)
  if (existingDone && typeof existingDone.lineIndex === 'number') {
    logDebug('moveCompletedToDone', `Found existing '## ${doneSectionHeadingName}' at line ${existingDone.lineIndex}`)
    return existingDone.lineIndex
  }

  // Create a new level-2 heading at the end of the note using the configured name
  const insertionIndex = paras.length
  logDebug('moveCompletedToDone', `Creating new '## ${trimmedName}' heading at line ${insertionIndex}`)
  note.insertHeading(trimmedName, insertionIndex, 2)

  // After insertion, ensure we return the actual line index of the new heading
  const updated = note.paragraphs
  const newDone = updated.find(
    (p) => isParaAMatchForHeading(p, trimmedName, 2),
  )
  if (newDone && typeof newDone.lineIndex === 'number') {
    return newDone.lineIndex
  }
  // Fallback: return original insertion index
  return insertionIndex
}

/**
 * Get the block that makes up the Done-style section (heading + following lines until next level-2 heading) using the configured heading name.
 * If the section doesn't yet exist, returns an empty array.
 * @author Cursor, guided by @jgclark
 * @param {TNote} note
 * @param {string} doneSectionHeadingName
 * @returns {Array<TParagraph>}
 */
function getNamedDoneSectionBlock(note: TNote, doneSectionHeadingName: string): Array<TParagraph> {
  const trimmedName = doneSectionHeadingName.trim()
  const doneHeading = findNamedDoneSectionHeading(note, trimmedName)
  if (!doneHeading || typeof doneHeading.lineIndex !== 'number') {
    logInfo(
      'getNamedDoneSectionBlock',
      `No '## ${trimmedName}' heading found after the end of the active part of the note. Returning empty array.`,
    )
    return []
  }
  const endIndex = getDoneArchiveEndIndex(note, doneHeading.lineIndex)
  return note.paragraphs.slice(doneHeading.lineIndex, endIndex)
}

/**
 * Return true if the block contains any task or checklist paragraph.
 * @param {Array<TParagraph>} block
 * @returns {boolean}
 */
function blockHasTaskOrChecklistParagraphs(block: Array<TParagraph>): boolean {
  return block.some((p) => TASK_PARA_TYPES.includes(p.type))
}

/**
 * Return the display name for a section heading paragraph.
 * @param {TParagraph} headingPara
 * @returns {string}
 */
function getSectionHeadingDisplayName(headingPara: TParagraph): string {
  return (headingPara.rawContent ?? headingPara.content ?? '')
    .replace(/^\s*#+\s+/, '')
    .trim()
}

/**
 * When whole-section mode is enabled, log for active sections that contain only
 * notes/bullets/quotes and no task/checklist paragraphs (these are never archived).
 * @param {TNote} note
 * @param {Set<number>} doneLineIndexes
 */
function logNotesOnlySectionsSkipped(note: TNote, doneLineIndexes: Set<number>): void {
  for (const p of note.paragraphs) {
    if (p.lineIndex == null) continue
    if (p.type !== 'title' || (p.headingLevel ?? 1) <= 1) continue
    if (doneLineIndexes.has(p.lineIndex)) continue

    const sectionBlock = getParagraphBlock(note, p.lineIndex, false, false)
    if (sectionBlock.length <= 1) continue
    if (blockHasTaskOrChecklistParagraphs(sectionBlock)) continue

    const headingName = getSectionHeadingDisplayName(p)
    logInfo(
      'moveCompletedToDone',
      `Skipping section '${headingName}': section contains no task/checklist paragraphs (only notes/bullets/quotes).`,
    )
  }
}

/**
 * Return true when a block being moved already starts with its own section heading.
 * @param {Array<TParagraph>} block
 * @returns {boolean}
 */
function blockStartsWithSectionHeading(block: Array<TParagraph>): boolean {
  const first = block[0]
  return first?.type === 'title' && (first.headingLevel ?? 1) > 1
}

/**
 * Return the line index in the active part of the note (before any Done-style archive heading)
 * for the first heading matching the given level and text, or -1 if not found.
 * @param {TNote} note
 * @param {number} level
 * @param {string} text - normalised heading text (no leading '#'s)
 * @param {number} boundaryIndex - scan stops at this index (e.g. the Done heading line)
 * @returns {number}
 */
function findActiveHeadingLineIndex(note: TNote, level: number, text: string, boundaryIndex: number): number {
  const paras = note.paragraphs
  for (let i = 0; i < boundaryIndex && i < paras.length; i++) {
    const p = paras[i]
    if (p.type === 'title' && (p.headingLevel ?? 1) === level) {
      const pText = (p.rawContent ?? p.content ?? '').replace(/^\s*#+\s+/, '').trim()
      if (pText === text) {
        return i
      }
    }
  }
  return -1
}

/**
 * After items have been archived, remove any section headings whose body is now empty
 * (only blank lines remain until the next same-or-higher heading or the Done section).
 * Only headings that we moved items out of (passed in parentHeadings) and that are deeper
 * than H1 are considered, so the note title and untouched sections are never removed.
 * Re-resolves positions on each removal so it is robust to shifting line indexes.
 * @param {TNote} note
 * @param {Array<TParagraph>} parentHeadings - parent headings captured before moving (may contain duplicates/nulls)
 * @param {string} doneSectionHeadingName
 */
function removeEmptiedSectionHeadings(note: TNote, parentHeadings: Array<TParagraph | null>, doneSectionHeadingName: string): void {
  // De-duplicate targets by level + normalised text, ignoring nulls and H1 (the note title)
  const seen = new Set<string>()
  const targets: Array<{ level: number, text: string }> = []
  for (const h of parentHeadings) {
    if (!h || h.type !== 'title') continue
    const level = h.headingLevel ?? 2
    if (level <= 1) continue
    const text = (h.rawContent ?? h.content ?? '').replace(/^\s*#+\s+/, '').trim()
    const key = `${level}:${text}`
    if (!seen.has(key)) {
      seen.add(key)
      targets.push({ level, text })
    }
  }

  for (const target of targets) {
    const doneHeading = findNamedDoneSectionHeading(note, doneSectionHeadingName.trim())
    const boundaryIndex = doneHeading && typeof doneHeading.lineIndex === 'number' ? doneHeading.lineIndex : note.paragraphs.length
    const headingLineIndex = findActiveHeadingLineIndex(note, target.level, target.text, boundaryIndex)
    if (headingLineIndex < 0) continue

    const paras = note.paragraphs
    // Collect the heading plus any following lines until the next same-or-higher heading or the boundary.
    const sectionParas: Array<TParagraph> = [paras[headingLineIndex]]
    let bodyHasContent = false
    for (let i = headingLineIndex + 1; i < boundaryIndex && i < paras.length; i++) {
      const p = paras[i]
      if (p.type === 'title' && (p.headingLevel ?? 1) <= target.level) {
        break
      }
      if (!isEmptyPara(p)) {
        bodyHasContent = true
        break
      }
      sectionParas.push(p)
    }
    if (bodyHasContent) continue

    logDebug('moveCompletedToDone', `Removing emptied section heading '${target.text}' (level ${target.level}).`)
    note.removeParagraphs(sectionParas)
  }
}

// Export selected helpers for testing
export { hasOpenParentTask, getOrCreateNamedDoneSection, blockStartsWithSectionHeading, blockHasTaskOrChecklistParagraphs, buildInsertLinesFromParas }

//----------------------------------------------------------------------------
// Core Function

/**
 * Core worker: Move completed / cancelled tasks and checklists in the given note to a '## Done' section.
 * - Only moves items where the task line is completed/cancelled.
 * - Only moves an item if all task/checklist lines in its child block are also completed/cancelled.
 * - If "onlyMoveCompletedWhenWholeSectionComplete" is true, completed items are only moved
 *   when their entire section (under the current heading) has no active tasks. When a whole
 *   section qualifies, the entire section block (including its heading) is moved together.
 * - If "recreateDoneSectionStructure" is true, subheadings are recreated under '## Done'
 *   that mirror the parent headings of moved items.
 * - If "onlyMoveCompletedWhenWholeSectionComplete" is true, sections that contain only
 *   notes/bullets/quotes (no task/checklist paragraphs) are not archived.
 * @tests in moveCompletedToDone.test.js
 * @param {TNote} note
 * @param {boolean} recreateDoneSectionStructure
 * @param {boolean} onlyMoveCompletedWhenWholeSectionComplete
 * @param {boolean} skipDoneSubtasksUnderOpenTasks
 * @param {string} doneSectionHeadingName
 * @returns {boolean} true if any items were moved, false otherwise
 */
export function moveCompletedItemsToDoneSection(
  note: TNote,
  recreateDoneSectionStructure: boolean,
  onlyMoveCompletedWhenWholeSectionComplete: boolean,
  skipDoneSubtasksUnderOpenTasks: boolean = false,
  doneSectionHeadingName: string = 'Done',
): boolean {
  try {
    const paras = note.paragraphs
    if (!paras || paras.length === 0) {
      logWarn('moveCompletedToDone', 'Note has no paragraphs; nothing to do.')
      return false
    }
    const startTime = new Date()

    // Identify existing "Done" section (so we don't reprocess it)
    const doneBlock = getNamedDoneSectionBlock(note, doneSectionHeadingName)
    const doneLineIndexes = new Set<number>()
    doneBlock.forEach((p) => {
      if (typeof p.lineIndex === 'number') {
        doneLineIndexes.add(p.lineIndex)
      }
    })

    // Each entry stores the block plus the parent heading captured *now* (while line indexes are
    // still valid). Capturing here avoids re-deriving the parent later from stale line indexes,
    // which previously caused a moved item to be nested under the wrong (deeper) heading.
    const blocksToMove: Array<{ block: Array<TParagraph>, parentHeading: TParagraph | null }> = []
    const processedLineIndexes = new Set<number>()

    if (onlyMoveCompletedWhenWholeSectionComplete) {
      logNotesOnlySectionsSkipped(note, doneLineIndexes)
    }

    // First pass: decide which lines/blocks should be moved
    for (const p of paras) {
      if (p.lineIndex == null) continue
      const idx = p.lineIndex

      if (doneLineIndexes.has(idx)) {
        continue
      }
      if (processedLineIndexes.has(idx)) {
        continue
      }
      if (!isClosed(p)) {
        continue
      }

      // Optionally skip completed subtasks that are indented under an open parent task
      if (skipDoneSubtasksUnderOpenTasks && hasOpenParentTask(note, p)) {
        logDebug(
          'moveCompletedToDone',
          `Skipping completed subtask at line ${idx} because it has an open parent task above it.`,
        )
        continue
      }

      // Get the full block for this completed task line
      const fullBlock = getParagraphBlock(note, idx, false, false)

      // Derive the block we will actually move:
      // the completed line itself plus only its child lines (more-indented),
      // stopping when we hit a same-or-less indented line or a heading.
      const startingIndent = p.indents ?? 0
      const taskBlock: Array<TParagraph> = []
      if (fullBlock.length > 0) {
        taskBlock.push(fullBlock[0])
        for (let i = 1; i < fullBlock.length; i++) {
          const q = fullBlock[i]
          const qIndent = q.indents ?? 0
          if (q.type === 'title' || qIndent <= startingIndent) {
            break
          }
          taskBlock.push(q)
        }
      }

      taskBlock.forEach((bp) => {
        if (typeof bp.lineIndex === 'number') {
          processedLineIndexes.add(bp.lineIndex)
        }
      })

      // Check that all *child* task lines in this block are themselves completed/cancelled
      const childLines = taskBlock.slice(1)
      if (blockHasActiveTasks(childLines)) {
        logDebug('moveCompletedToDone', `Skipping block starting at line ${idx} because it has active tasks in its children.`)
        continue
      }

      // If we only move when the whole section is complete, verify there are no active tasks
      // in the wider section (includeFromStartOfSection = true) that contains this line.
      // When the whole section is complete, move the entire section block (including heading).
      if (onlyMoveCompletedWhenWholeSectionComplete) {
        const sectionBlock = getParagraphBlock(note, idx, true, false)
        if (blockHasActiveTasks(sectionBlock)) {
          logDebug('moveCompletedToDone', `Skipping completed items at line ${idx} because the wider section still has active tasks.`,)
          continue
        }

        if (!blockHasTaskOrChecklistParagraphs(sectionBlock)) {
          const sectionHeading = sectionBlock.find((bp) => bp.type === 'title' && (bp.headingLevel ?? 1) > 1)
          const headingName = sectionHeading ? getSectionHeadingDisplayName(sectionHeading) : 'unknown'
          logInfo(
            'moveCompletedToDone',
            `Skipping section '${headingName}': section contains no task/checklist paragraphs (only notes/bullets/quotes).`,
          )
          continue
        }

        const sectionStartLineIndex = sectionBlock[0]?.lineIndex
        if (sectionStartLineIndex != null && processedLineIndexes.has(sectionStartLineIndex)) {
          continue
        }

        sectionBlock.forEach((bp) => {
          if (typeof bp.lineIndex === 'number') {
            processedLineIndexes.add(bp.lineIndex)
          }
        })
        // Whole-section blocks carry their own heading, so no separate parent heading is needed.
        blocksToMove.push({ block: sectionBlock, parentHeading: null })
        continue
      }

      // Capture the parent heading now (while line indexes are valid) for use when recreating
      // structure under Done and for cleaning up emptied section headings afterwards.
      const parentHeading = getCurrentHeading(note, p)
      blocksToMove.push({ block: taskBlock, parentHeading })
    }
    logTimer('moveCompletedToDone', startTime, `End of Pass 1 over ${paras.length} paragraphs.`)

    if (blocksToMove.length === 0) {
      logInfo('moveCompletedToDone', 'No eligible completed items found to move.')
      return false
    }
    logInfo('moveCompletedToDone', `Found ${blocksToMove.length} blocks to move to Done section.`)

    // Remove ALL original block paragraphs first, in a single pass, while their line indexes are
    // still valid. Doing all removals before any insertions avoids stale-line-index bugs that occur
    // when inserting and removing are interleaved (NotePlan does not live-update paragraph line indexes).
    // The detached paragraph objects keep their rawContent/type/indents, which is all the insert
    // helpers need.
    const allParasToRemove: Array<TParagraph> = []
    blocksToMove.forEach(({ block }) => {
      block.forEach((bp) => allParasToRemove.push(bp))
    })
    note.removeParagraphs(allParasToRemove)
    logTimer('moveCompletedToDone', startTime, `- removed ${allParasToRemove.length} original paragraphs.`)

    // Now that completed items are gone, remove any section headings that have been left empty.
    const parentHeadingsTouched = blocksToMove.map(({ parentHeading }) => parentHeading)
    removeEmptiedSectionHeadings(note, parentHeadingsTouched, doneSectionHeadingName)

    // Ensure we have a "Done" heading to move to (create it now, after removals have settled).
    getOrCreateNamedDoneSection(note, doneSectionHeadingName)

    // Second pass: insert the collected blocks into the Done section. Positions are re-resolved
    // fresh on each iteration (by heading name/level) so they stay correct as the note grows.
    for (const { block, parentHeading } of blocksToMove) {
      if (block.length === 0) continue

      // Re-find the Done heading fresh each time, since earlier insertions shift its position.
      const doneHeading = findNamedDoneSectionHeading(note, doneSectionHeadingName.trim())
      const doneHeadingLineIndex = doneHeading && typeof doneHeading.lineIndex === 'number' ? doneHeading.lineIndex : note.paragraphs.length - 1

      const movingWholeSection = blockStartsWithSectionHeading(block)

      if (movingWholeSection) {
        const sectionHeading = block[0]
        const bodyParas = block.slice(1)
        const existingSubsection = findSubheadingInDoneSection(note, sectionHeading, doneHeadingLineIndex)
        if (existingSubsection) {
          mergeWholeSectionIntoDoneSubsection(note, existingSubsection, bodyParas)
        } else {
          // Recreate the section's heading under '## Done' at the appropriate (deeper) level,
          // rather than moving it verbatim, so a moved '## Section' becomes a '### Section' nested inside Done.
          const newSubheading = getOrCreateSubheadingInDoneSection(note, sectionHeading, doneHeadingLineIndex)
          appendParasUnderHeading(note, newSubheading, bodyParas)
        }
      } else {
        // Work out where to add in the Done section, recreating the parent heading if requested.
        let targetHeading: TParagraph = note.paragraphs[doneHeadingLineIndex]
        if (recreateDoneSectionStructure && parentHeading && (parentHeading.headingLevel ?? 1) > 1) {
          targetHeading = getOrCreateSubheadingInDoneSection(note, parentHeading, doneHeadingLineIndex)
        }
        appendParasUnderHeading(note, targetHeading, block)
      }
      logTimer('moveCompletedToDone', startTime, `- appended ${block.length} paragraphs to Done section.`)
    }
    logTimer('moveCompletedToDone', startTime, `End of Pass 2.`)
    return true
  } catch (error) {
    logError('moveCompletedToDone', error.message)
    return false
  }
}

/**
 * Plugin command: move completed / cancelled tasks in the current note to its '## Done' section.
 * Uses Filer plugin settings to control behaviour.
 */
export async function moveCompletedItemsToDoneSectionCommand(): Promise<void> {
  try {
    const note = Editor.note
    if (!note) {
      logWarn(PLUGIN_ID, 'moveCompletedItemsToDoneSection: No note open, so stopping.')
      return
    }

    const startTime = new Date()
    const config: FilerConfig = await getFilerSettings()
    const recreateDoneSectionStructure = Boolean(config.recreateDoneSectionStructure)
    const skipDoneSubtasksUnderOpenTasks = Boolean(config.skipDoneSubtasksUnderOpenTasks)
    const rawDoneHeadingName = config.doneSectionHeadingName
    const doneSectionHeadingName =
      typeof rawDoneHeadingName === 'string' && rawDoneHeadingName.trim().length > 0
        ? rawDoneHeadingName.trim()
        : 'Done'

    // Work out how/when to move completed items based on new string setting,
    // with backward compatibility for the old boolean setting.
    let whenToMoveCompletedToDone: string = config.whenToMoveCompletedToDone
    if (!whenToMoveCompletedToDone || !WHEN_TO_MOVE_CHOICES.includes(whenToMoveCompletedToDone)) {
      // Backward compatibility: map old boolean-only setting if present
      // $FlowFixMe[prop-missing] - older settings files may still have this key
      const legacyOnlyMoveCompletedWhenWholeSectionComplete = config.onlyMoveCompletedWhenWholeSectionComplete
      if (typeof legacyOnlyMoveCompletedWhenWholeSectionComplete === 'boolean') {
        whenToMoveCompletedToDone = legacyOnlyMoveCompletedWhenWholeSectionComplete
          ? WHEN_TO_MOVE_SECTION_COMPLETE
          : WHEN_TO_MOVE_ANY_COMPLETE
      } else {
        whenToMoveCompletedToDone = WHEN_TO_MOVE_ASK_EACH_TIME
      }
    }

    let onlyMoveCompletedWhenWholeSectionComplete = whenToMoveCompletedToDone === WHEN_TO_MOVE_SECTION_COMPLETE

    if (whenToMoveCompletedToDone === WHEN_TO_MOVE_ASK_EACH_TIME) {
      const choice = await showMessageYesNoCancel(
        'How should completed items be moved to the Done section this time?',
        ['Move when whole section complete', 'Move when any are complete', 'Cancel'],
        'Filer: Move completed to Done',
      )
      if (choice === 'Cancel') {
        logInfo('moveCompletedToDone', 'User cancelled moveCompletedItemsToDoneSectionCommand from ask-each-time dialog.')
        return
      }
      onlyMoveCompletedWhenWholeSectionComplete = choice === 'Move when whole section complete'
    }

    const didMove = moveCompletedItemsToDoneSection(
      note,
      recreateDoneSectionStructure,
      onlyMoveCompletedWhenWholeSectionComplete,
      skipDoneSubtasksUnderOpenTasks,
      doneSectionHeadingName,
    )
    logInfo('moveCompletedToDone', `Completed in ${timer(startTime)}`)
    if (!didMove) {
      const currentSettingsStr = 
        `${onlyMoveCompletedWhenWholeSectionComplete ? 'only moving lines/blocks when whole section complete' : 'moving when any completed item is found'
         }, and ${
         skipDoneSubtasksUnderOpenTasks ? 'skipping done subtasks under open tasks' : 'including done subtasks under open tasks'
         }.`
      await showMessage(
        `No completed or cancelled items to move to the '${doneSectionHeadingName}' section.\n\nMy current settings are: ${currentSettingsStr}`,
        'OK',
        'Filer: Move completed to Done',
      )
    }
  } catch (error) {
    logError(PLUGIN_ID, error.message)
  }
}
