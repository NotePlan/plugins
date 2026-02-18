// @flow
// ----------------------------------------------------------------------------
// Move completed / cancelled tasks and checklists in a note to a '## Done' section
// Jonathan Clark, aided by Cursor AI
// Last updated 2026-02-18 for v1.5.2 by @jgclark
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
 */

import pluginJson from '../plugin.json'
import type { FilerConfig } from './filerHelpers'
import { getFilerSettings } from './filerHelpers'
import { blockHasActiveTasks, getParagraphBlock } from '@helpers/blocks'
import { clo, JSP, logDebug, logInfo, logError, logWarn } from '@helpers/dev'
import { getCurrentHeading } from '@helpers/headings'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { isClosed } from '@helpers/utils'

//----------------------------------------------------------------------------
// Constants

const PLUGIN_ID = pluginJson['plugin.id']

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

  // Walk upwards to find the nearest less-indented line
  for (let i = currentIndex - 1; i >= 0; i--) {
    const candidate = paras[i]
    const candidateIndent = candidate.indents ?? 0

    // Only consider true parents: first line above with lower indentation
    if (candidateIndent < currentIndent) {
      const taskTypes = [
        'open',
        'scheduled',
        'todo',
        'checklist',
        'checklistScheduled',
      ]
      const isPotentialTaskParent = taskTypes.includes(candidate.type)

      if (isPotentialTaskParent && !isClosed(candidate)) {
        return true
      }
      // Once we've hit a less-indented line, nothing further up can be a direct parent
      return false
    }
  }

  return false
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
  // Always get fresh paragraph list to account for any previous insertions
  const paras = note.paragraphs
  const desiredHeadingLevel = Math.min((sourceHeading.headingLevel ?? 2) + 1, 5)
  
  // Extract heading text from rawContent (which has the original format like "## Heading")
  // or fall back to content if rawContent is not available
  let headingTextContent = ''
  if (sourceHeading.rawContent) {
    // Parse rawContent to extract just the text part (strip ALL # markers and whitespace)
    headingTextContent = sourceHeading.rawContent.trim()
    // Remove any leading # characters and following whitespace
    headingTextContent = headingTextContent.replace(/^#+\s*/, '')
  } else {
    // Fallback to content, ensuring no # markers
    headingTextContent = sourceHeading.content.trim()
    headingTextContent = headingTextContent.replace(/^#+\s*/, '').trim()
    headingTextContent = headingTextContent.replace(/\s*#+\s*/g, ' ').trim()
  }
  
  // Look for an existing matching heading in the entire Done section
  // (search from Done heading to end of note, or until next level-2 heading)
  for (let i = doneHeadingLineIndex + 1; i < paras.length; i++) {
    const p = paras[i]
    // Stop if we hit another level-2 heading (end of Done section)
    if (p.type === 'title' && (p.headingLevel ?? 1) <= 2 && i > doneHeadingLineIndex) {
      break
    }
    // Check if this is a matching heading
    // Compare using content (which Note mock strips # from) or rawContent
    let pContent = ''
    if (p.rawContent) {
      pContent = p.rawContent.replace(/^\s*#+\s+/, '').trim()
    } else {
      pContent = p.content.trim().replace(/^#+\s*/, '').trim()
    }
    if (
      p.type === 'title' &&
      p.headingLevel === desiredHeadingLevel &&
      pContent === headingTextContent
    ) {
      return p
    }
  }

  // No existing heading found, so create a new one at the end of the Done section
  // Find the last paragraph in the Done section (before next level-2 heading or end of note)
  let insertionIndex = paras.length
  for (let i = doneHeadingLineIndex + 1; i < paras.length; i++) {
    const p = paras[i]
    if (p.type === 'title' && (p.headingLevel ?? 1) <= 2 && i > doneHeadingLineIndex) {
      insertionIndex = i
      break
    }
  }

  // Create heading text with correct format: "### Heading" (not "# ### Heading")
  // headingTextContent should already be clean (no # markers)
  // Ensure headingTextContent is definitely clean before using it
  const cleanHeadingText = headingTextContent.trim()
  
  // Final verification - ensure no # characters remain
  if (cleanHeadingText.includes('#')) {
    logWarn('moveCompletedToDone', `Warning: cleanHeadingText still contains #: "${cleanHeadingText}"`)
    // Remove all # characters as a last resort
    const finalClean = cleanHeadingText.replace(/#/g, '').trim()
    if (finalClean) {
      headingTextContent = finalClean
    }
  }
  
  const headingMarker = '#'.repeat(desiredHeadingLevel)
  // Construct heading text: exactly "### Heading" format with single space after #
  // Use the same approach as getOrCreateDoneSection for consistency
  const headingText = `${headingMarker} ${headingTextContent.trim()}`
  
  logDebug('moveCompletedToDone', `Creating heading: "${headingText}", level=${desiredHeadingLevel}`)
  
  // Use 'title' type like we do for '## Done' - this should work consistently
  note.insertParagraph(headingText, insertionIndex, 'text')

  // After insertion, re-read the paragraph and verify/fix if needed
  const updatedParas = note.paragraphs
  const insertedHeading = updatedParas.find(
    (p, idx) => {
      if (idx < doneHeadingLineIndex) return false
      if (p.type !== 'title' || p.headingLevel !== desiredHeadingLevel) return false
      // Compare using rawContent or content
      let pContent = ''
      if (p.rawContent) {
        pContent = p.rawContent.replace(/^\s*#+\s+/, '').trim()
      } else {
        pContent = p.content.trim().replace(/^#+\s*/, '').trim()
      }
      return pContent === headingTextContent.trim()
    },
  )
  
  // If heading was found but has wrong rawContent (extra #), fix it
  if (insertedHeading && insertedHeading.rawContent) {
    const expectedRawContent = `${headingMarker} ${headingTextContent.trim()}`
    const extraHashPrefix = `# ${expectedRawContent}`
    if (insertedHeading.rawContent !== expectedRawContent && insertedHeading.rawContent.startsWith(extraHashPrefix)) {
      logWarn('moveCompletedToDone', `Fixing heading with extra #: "${insertedHeading.rawContent}" -> "${expectedRawContent}"`)
      // Update the rawContent directly
      insertedHeading.rawContent = expectedRawContent
      note.updateParagraph(insertedHeading)
    }
  }
  
  if (insertedHeading) {
    return insertedHeading
  }
  // Fallback: return the paragraph at insertionIndex
  return updatedParas[insertionIndex]
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
  if (headingPara.lineIndex == null) {
    logWarn('moveCompletedToDone', 'appendParasUnderHeading: headingPara has no lineIndex')
    return
  }
  const paras = note.paragraphs
  const thisLevel = headingPara.headingLevel ?? 2
  let insertionIndex = paras.length

  for (let i = headingPara.lineIndex + 1; i < paras.length; i++) {
    const p = paras[i]
    if (p.type === 'title' && (p.headingLevel ?? 1) <= thisLevel) {
      insertionIndex = i
      break
    }
  }

  const linesToInsert = parasToInsert.map((p) => {
    const line = p.rawContent ?? p.content ?? ''
    // Trim trailing whitespace/newlines from each line to avoid extra blank paragraphs
    return line.replace(/\s+$/, '')
  })
  if (linesToInsert.length === 0) {
    return
  }

  // Insert as a single multi-line text block (without trailing newline to avoid empty paragraph)
  const textBlock = linesToInsert.join('\n')
  note.insertParagraph(textBlock, insertionIndex, 'text')
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
  const endOfActive = findEndOfActivePartOfNote(note, [trimmedName])
  const existingDone = paras.find(
    (p, i) =>
      i > endOfActive &&
      p.type === 'title' &&
      p.content.trim() === trimmedName,
  )
  if (existingDone && typeof existingDone.lineIndex === 'number') {
    logDebug('moveCompletedToDone', `Found existing '## ${doneSectionHeadingName}' at line ${existingDone.lineIndex}`)
    return existingDone.lineIndex
  }

  // Create a new level-2 heading at the end of the note using the configured name
  const insertionIndex = paras.length
  const headingText = `## ${doneSectionHeadingName}`
  logDebug('moveCompletedToDone', `Creating new '${headingText}' heading at line ${insertionIndex}`)
  note.insertParagraph(headingText, insertionIndex, 'text')

  // After insertion, ensure we return the actual line index of the new heading
  const updated = note.paragraphs
  const newDone = updated.find(
    (p) =>
      p.type === 'title' &&
      p.content.trim() === trimmedName,
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
  const doneHeading = note.paragraphs.find(
    (p) => p.type === 'title' && p.headingLevel === 2 && p.content.trim() === trimmedName,
  )
  if (!doneHeading || typeof doneHeading.lineIndex !== 'number') {
    return []
  }
  const block = getParagraphBlock(note, doneHeading.lineIndex, false, false)
  return block
}

/**
 * Core worker: Move completed / cancelled tasks and checklists in the given note to a '## Done' section.
 * - Only moves items where the task line is completed/cancelled.
 * - Only moves an item if all task/checklist lines in its child block are also completed/cancelled.
 * - If "onlyMoveCompletedWhenWholeSectionComplete" is true, completed items are only moved
 *   when their entire section (under the current heading) has no active tasks.
 * - If "recreateDoneSectionStructure" is true, subheadings are recreated under '## Done'
 *   that mirror the parent headings of moved items.
 *
 * @param {TNote} note
 * @param {boolean} recreateDoneSectionStructure
 * @param {boolean} onlyMoveCompletedWhenWholeSectionComplete
 * @param {boolean} skipDoneSubtasksUnderOpenTasks
 * @param {string} doneSectionHeadingName
 */
export function moveCompletedItemsToDoneSection(
  note: TNote,
  recreateDoneSectionStructure: boolean,
  onlyMoveCompletedWhenWholeSectionComplete: boolean,
  skipDoneSubtasksUnderOpenTasks: boolean = false,
  doneSectionHeadingName: string = 'Done',
): void {
  try {
    const paras = note.paragraphs
    if (!paras || paras.length === 0) {
      logWarn('moveCompletedToDone', 'Note has no paragraphs; nothing to do.')
      return
    }

    // Identify existing "Done" section (so we don't reprocess it)
    const doneBlock = getNamedDoneSectionBlock(note, doneSectionHeadingName)
    const doneLineIndexes = new Set<number>()
    doneBlock.forEach((p) => {
      if (typeof p.lineIndex === 'number') {
        doneLineIndexes.add(p.lineIndex)
      }
    })

    const includeFromStartOfSectionFlag = onlyMoveCompletedWhenWholeSectionComplete
    const blocksToMove: Array<Array<TParagraph>> = []
    const processedLineIndexes = new Set<number>()

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
      if (includeFromStartOfSectionFlag) {
        const sectionBlock = getParagraphBlock(note, idx, true, false)
        if (blockHasActiveTasks(sectionBlock)) {
          logDebug('moveCompletedToDone', `Skipping completed items at line ${idx} because the wider section still has active tasks.`,)
          continue
        }
      }

      blocksToMove.push(taskBlock)
    }

    if (blocksToMove.length === 0) {
      logInfo('moveCompletedToDone', 'No eligible completed items found to move.')
      return
    }

    // Ensure we have a "Done" heading to move to
    const doneHeadingLineIndex = getOrCreateNamedDoneSection(note, doneSectionHeadingName)

    // Cache to track headings we've already created in the Done section
    // Key: `${headingLevel}:${content}`, Value: TParagraph
    const createdHeadingsCache = new Map<string, TParagraph>()

    // Second pass: actually move the collected blocks
    for (const block of blocksToMove) {
      if (block.length === 0) continue

      // Work out where to add in the Done section
      let targetHeading = note.paragraphs[doneHeadingLineIndex]
      if (recreateDoneSectionStructure) {
        const parentHeading = getCurrentHeading(note, block[0])
        if (parentHeading) {
          const desiredLevel = Math.min((parentHeading.headingLevel ?? 2) + 1, 5)
          // Extract heading text content for cache key (same way as in getOrCreateSubheadingInDoneSection)
          let headingTextForCache = ''
          if (parentHeading.rawContent) {
            headingTextForCache = parentHeading.rawContent.replace(/^\s*#+\s+/, '').trim()
          } else {
            headingTextForCache = parentHeading.content.trim().replace(/^#+\s*/, '').trim()
          }
          const cacheKey = `${desiredLevel}:${headingTextForCache}`
          
          // Check cache first
          if (createdHeadingsCache.has(cacheKey)) {
            targetHeading = createdHeadingsCache.get(cacheKey)
          } else {
            // Create or find existing heading
            targetHeading = getOrCreateSubheadingInDoneSection(
              note,
              parentHeading,
              doneHeadingLineIndex,
            )
            // Cache it for future use
            createdHeadingsCache.set(cacheKey, targetHeading)
          }
        }
      }

      // Insert copies of the completed block under the target heading
      appendParasUnderHeading(note, targetHeading, block)

      // Remove the original paragraphs from the note
      note.removeParagraphs(block)
    }
  } catch (error) {
    logError('moveCompletedToDone', error.message)
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

    const config: FilerConfig = await getFilerSettings()
    const recreateDoneSectionStructure = Boolean(config.recreateDoneSectionStructure)
    const onlyMoveCompletedWhenWholeSectionComplete = Boolean(config.onlyMoveCompletedWhenWholeSectionComplete)
    const skipDoneSubtasksUnderOpenTasks = Boolean(config.skipDoneSubtasksUnderOpenTasks)
    const rawDoneHeadingName = config.doneSectionHeadingName
    const doneSectionHeadingName =
      typeof rawDoneHeadingName === 'string' && rawDoneHeadingName.trim().length > 0
        ? rawDoneHeadingName.trim()
        : 'Done'

    moveCompletedItemsToDoneSection(
      note,
      recreateDoneSectionStructure,
      onlyMoveCompletedWhenWholeSectionComplete,
      skipDoneSubtasksUnderOpenTasks,
      doneSectionHeadingName,
    )
  } catch (error) {
    logError(PLUGIN_ID, error.message)
  }
}
