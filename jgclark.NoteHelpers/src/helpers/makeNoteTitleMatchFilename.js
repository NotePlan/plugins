// @flow
//-----------------------------------------------------------------------------
// Reset a note's title (frontmatter title: and/or body H1) to match its filename.
// Originally by Leo Melo, maintained by @jgclark
// Last updated 2026-08-18 for v1.4.0 by @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../../plugin.json'
import { logDebug, logWarn } from '@helpers/dev'
import { displayTitle } from '@helpers/general'
import { endOfFrontmatterLineIndex, getFrontmatterAttribute, updateFrontMatterVars } from '@helpers/NPFrontMatter'
import { showMessage, showMessageYesNoCancel } from '@helpers/userInput'
import { findFirstBodyH1, normalizeFrontmatterTitle } from '../addTitleToNoteBody'

export type TitleMatchPlan = {
  newTitle: string,
  currentTitle: string,
  alreadyMatches: boolean,
  hasFrontmatter: boolean,
  h1LineIndex: number | null,
}

/**
 * Filename stem (no folder, no extension) to use as the note title.
 * @author @jgclark
 * @param {TNote} note
 * @returns {string}
 */
export function getFilenameStemAsTitle(note: TNote): string {
  const currentFullPath = note.filename ?? ''
  const currentFilename: string = currentFullPath.split('/').pop() ?? currentFullPath
  const ext = DataStore.defaultFileExtension || 'md'
  return currentFilename.replace(`.${ext}`, '')
}

/**
 * Plan how to reset the note title to match its filename.
 * Returns null when the note is missing or empty.
 * @author @jgclark
 * @param {TNote} note
 * @returns {TitleMatchPlan | null}
 */
export function getTitleMatchPlan(note: TNote): TitleMatchPlan | null {
  if (note == null || (note.paragraphs?.length ?? 0) < 1) {
    return null
  }

  const newTitle = getFilenameStemAsTitle(note)
  const endOfFM = endOfFrontmatterLineIndex(note) || 0
  const hasFrontmatter = endOfFM > 0
  const firstH1 = findFirstBodyH1(note)
  const h1LineIndex = firstH1 ? firstH1.lineIndex : null

  if (hasFrontmatter) {
    const fmTitle = normalizeFrontmatterTitle(getFrontmatterAttribute(note, 'title'))
    const currentTitle = fmTitle !== '' ? fmTitle : displayTitle(note)
    const h1Matches = !firstH1 || firstH1.content.trim() === newTitle
    const alreadyMatches = fmTitle === newTitle && h1Matches
    return { newTitle, currentTitle, alreadyMatches, hasFrontmatter: true, h1LineIndex }
  }

  const currentTitle = firstH1 ? firstH1.content.trim() : displayTitle(note)
  const alreadyMatches = currentTitle === newTitle
  return { newTitle, currentTitle, alreadyMatches, hasFrontmatter: false, h1LineIndex }
}

/**
 * Apply a planned title reset: update frontmatter title: when present, and update or insert a body H1.
 * Never removes the opening `---` of a frontmatter note.
 * @author @jgclark
 * @param {TNote} note
 * @param {TitleMatchPlan} plan
 * @returns {boolean} true if the note was changed
 */
export function applyTitleMatchPlan(note: TNote, plan: TitleMatchPlan): boolean {
  if (plan.alreadyMatches || plan.newTitle === '') {
    return false
  }

  if (plan.hasFrontmatter) {
    updateFrontMatterVars(note, { title: plan.newTitle })
  }

  if (plan.h1LineIndex != null) {
    const p = note.paragraphs[plan.h1LineIndex]
    if (p) {
      p.content = plan.newTitle
      note.updateParagraph(p)
    }
  } else if (!plan.hasFrontmatter) {
    note.insertHeading(plan.newTitle, 0, 1)
  }

  return true
}

/**
 * Reset the note's title (frontmatter `title:` and/or body H1) to match its filename.
 * Does not rename the file. Calendar notes are skipped.
 * @author @jgclark
 * @param {TNote} note
 * @param {boolean} shouldPromptBeforeRenaming
 * @returns {Promise<boolean>} whether the title was changed (or the user chose to skip in a batch)
 */
export async function makeNoteTitleMatchFilename(note: TNote, shouldPromptBeforeRenaming: boolean = true): Promise<boolean> {
  if (note == null || note.paragraphs.length < 1) {
    logDebug(pluginJson, 'No note open, or no content. Stopping.')
    return false
  }
  if (note.type === 'Calendar') {
    await showMessage('Sorry: calendar notes cannot be renamed.')
    return false
  }

  const plan = getTitleMatchPlan(note)
  if (!plan) {
    logDebug(pluginJson, 'makeNoteTitleMatchFilename(): Could not plan a title change. Stopping.')
    return false
  }

  if (plan.alreadyMatches) {
    logDebug(pluginJson, 'makeNoteTitleMatchFilename(): Current title is the same as the filename. Stopping.')
    await showMessage('The note title is already consistent with the filename.')
    return false
  }

  if (shouldPromptBeforeRenaming) {
    const promptResponse = await showMessageYesNoCancel(`
  Would you like to change the note title "${plan.currentTitle}" to match the filename "${plan.newTitle}"?
  `)

    if (promptResponse === 'Cancel') {
      logDebug(pluginJson, `makeNoteTitleMatchFilename(): User cancelled`)
      return false
    } else if (promptResponse !== 'Yes') {
      logDebug(pluginJson, 'makeNoteTitleMatchFilename(): User chose not to rename.')
      return true
    }
  }

  const changed = applyTitleMatchPlan(note, plan)
  if (changed) {
    logDebug(pluginJson, `makeNoteTitleMatchFilename(): ${plan.currentTitle} -> ${plan.newTitle}`)
    if (shouldPromptBeforeRenaming) {
      await showMessage(`Changed note title from ${plan.currentTitle} to ${plan.newTitle}.`)
    }
  } else {
    logWarn(pluginJson, 'makeNoteTitleMatchFilename(): Plan did not apply.')
  }
  return changed
}
