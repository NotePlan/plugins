// @flow
/* eslint-disable prefer-template */
//-----------------------------------------------------------------------------
// Smart duplicate note from an existing one.
// Last updated 2024-10-14 for v1.2.0 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { removeEmptyHeadings, sortTasksDefault } from '../../dwertheimer.TaskSorting/src/sortTasks'
import { archiveNoteUsingFolder } from './archive'
import {
  calcOffsetDateStr,
  MOMENT_FORMAT_NP_QUARTER, MOMENT_FORMAT_NP_YEAR,
  RE_NP_QUARTER_SPEC, RE_NP_HALFYEAR_SPEC, RE_NP_YEAR_SPEC
} from '@helpers/dateTime'
import { clo, logDebug, logError, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { getAttributes, noteHasFrontMatter, removeFrontMatterField } from '@helpers/NPFrontMatter'
import { openNoteInNewSplitIfNeeded } from '@helpers/NPWindows'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { getInput, showMessage, showMessageYesNo } from '@helpers/userInput'
import { isClosed } from '@helpers/utils'

/**
 * Smartly Duplicate the currently open note in the Editor.
 * Don't carry forward:
 * - any items in '## Done' or '## Completed' sections.
 * - any completed tasks/checklists (unless they have open )
 * - any quotes/bullets/ indented under completed items
 * - any section headings that then have no content
 * Then tidy up:
 * - remove duplicate blank lines or separators
 * - remove blank lines after headings
 * Then sort what remains, using Filer's "Tasks sort by user defaults" command, using its settings.
 * Offer to remove any triggers from the original note.
 * Offer to archive the original note.
 * @author @jgclark
 */
export async function smartDuplicateRegularNote(): Promise<void> {
  try {
    const sourceNote = Editor.note ?? null
    if (!sourceNote) {
      // No note open, so don't do anything.
      logWarn(pluginJson, 'archiveNoteUsingFolder(): No note passed or open in the Editor, so stopping.')
      return
    }
    logDebug(pluginJson, `smartDuplicateRegularNote() starting from note '${displayTitle(Editor.note)}'`)

    // Get title for this note
    // TODO: now offer a list of titles for old and new notes
    const relativeDates = []
    const todayMom = moment()
    let thisDateStr = ''
    thisDateStr = moment(todayMom).startOf('quarter').format(MOMENT_FORMAT_NP_YEAR)
    relativeDates.push({ label: 'this year', value: thisDateStr })
    thisDateStr = moment(todayMom).subtract(1, 'year').startOf('year').format(MOMENT_FORMAT_NP_YEAR)
    relativeDates.push({ label: 'last year', value: thisDateStr })
    thisDateStr = moment(todayMom).add(1, 'year').startOf('year').format(MOMENT_FORMAT_NP_YEAR)
    relativeDates.push({ label: 'next year', value: thisDateStr })
    thisDateStr = moment(todayMom).startOf('quarter').format(MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ label: 'this quarter', value: thisDateStr })
    thisDateStr = moment(todayMom).subtract(1, 'quarter').startOf('quarter').format(MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ label: 'last quarter', value: thisDateStr })
    thisDateStr = moment(todayMom).add(1, 'quarter').startOf('quarter').format(MOMENT_FORMAT_NP_QUARTER)
    relativeDates.push({ label: 'next quarter', value: thisDateStr })
    clo(relativeDates, 'relativeDates')

    // First try to guess if its for a given period
    // Remove any "YYYY" or "Qn" or "Hn" from the title, with or without brackets
    let notePeriod = ''
    let nextTitle = ''
    let updatedSourceTitle = sourceNote.title
    if (updatedSourceTitle.match(RE_NP_QUARTER_SPEC)) {
      notePeriod = 'quarter'
      const nextPeriodStr = updatedSourceTitle.match(/\D(\d{4}[Q][1-4])\D/)[1]
      nextTitle = updatedSourceTitle.replace(/\d{4}Q[1-4]/, calcOffsetDateStr(nextPeriodStr, "+1q", false))
    } else if (updatedSourceTitle.match(RE_NP_HALFYEAR_SPEC)) {
      // updatedSourceTitle = updatedSourceTitle.replace(/\d{4}H[1-2]/, '')
      notePeriod = 'half-year'
      const nextPeriodStr = updatedSourceTitle.match(/\D(\d{4}[Q][1-4])\D/)[1]
      nextTitle = updatedSourceTitle.replace(/\d{4}H[1-2]/, calcOffsetDateStr(nextPeriodStr, "+1h", false))
    } else if (updatedSourceTitle.match(RE_NP_YEAR_SPEC)) {
      // updatedSourceTitle = updatedSourceTitle.replace(/\d{4}/, '')
      notePeriod = 'year'
      const nextPeriodStr = updatedSourceTitle.match(/\D(\d{4}[Q][1-4])\D/)[1]
      nextTitle = updatedSourceTitle.replace(/\d{4}/, calcOffsetDateStr(nextPeriodStr, "+1y", false))
    }
    updatedSourceTitle = updatedSourceTitle.replace("()", '').replace("[]", '').trim()
    if (notePeriod !== '') logDebug(`smartDuplicateRegularNote`, `found note with period ${notePeriod}`)

    // Offer the first line to use, shorn of any leading # marks
    let titleToOffer = updatedSourceTitle
    if (titleToOffer === sourceNote.title) titleToOffer = updatedSourceTitle + " (newer)"
    // try to work out new title
    const title = await getInput(`Title of new ${notePeriod !== '' ? notePeriod + 'ly ' : ''} note`, 'OK', 'Smart Duplicate Note', titleToOffer)
    if (typeof title === 'boolean' && title === false) {
      logWarn('smartDuplicateRegularNote', 'The user cancelled the operation.')
      return
    }
    logDebug('smartDuplicateRegularNote', `new title will be ${title}`)

    // Work out the contents of the active part of the note
    // const activeParas = getActiveParagraphs(sourceNote) // Note: doesn't work properly
    const activeParas = sourceNote.paragraphs.slice(0, findEndOfActivePartOfNote(sourceNote))
    logDebug('smartDuplicateRegularNote', `- has ${activeParas.length} paras in the active part`)
    // Keep all lines that aren't open tasks/checklists
    const parasToKeep = activeParas.filter(para => !isClosed(para))
    logDebug('smartDuplicateRegularNote', `- has ${parasToKeep.length} paras to keep (!isClosed)`)
    // TEST: need to update title line first: change line 0 (or 1 if frontmatter) to be the new title
    let sourceTitlePara: TParagraph
    if (noteHasFrontMatter(sourceNote)) {
      sourceTitlePara = sourceNote.paragraphs[1]
      sourceTitlePara.content = `title: ${title}`
    } else {
      sourceTitlePara = sourceNote.paragraphs[0]
      sourceTitlePara.content = updatedSourceTitle
    }
    sourceNote.updateParagraph(sourceTitlePara)
    logDebug('smartDuplicateRegularNote', ` CHECK: source title = ${displayTitle(sourceNote)}`)

    // Do some further clean up of the paragraphs
    // let lastContent = ''
    let lastType = 'title'
    for (let i = 1; i < parasToKeep.length; i++) {
      // lastContent = parasToKeep[i - 1].content
      const thisRawContent = parasToKeep[i].rawContent
      logDebug('smartDuplicateRegularNote', `#${i}: {${thisRawContent}}`)
      lastType = parasToKeep[i - 1].type
      // Remove consecutive separators or empty lines
      if ((parasToKeep[i].type === 'empty' && lastType === 'empty') || (parasToKeep[i].type === 'separator') && (lastType === 'separator')) {
        logDebug('smartDuplicateRegularNote', `- removing consecutive empty/separator line`)
        parasToKeep.splice(i, 1)
        continue
      }
      // Remove any blank lines after headings (if wanted)
      if (lastType === 'title' && parasToKeep[i].type === 'empty') {
        logDebug('smartDuplicateRegularNote', `- removing blank line after heading`)
        parasToKeep.splice(i, 1)
        continue
      }
    }

    // Save contents to new note in the same folder
    // const currentFolder = await chooseFolder('Select folder to add note in:', false, true)  // don't include @Archive as an option, but do allow creation of a new folder
    const currentFolder = getFolderFromFilename(sourceNote.filename)
    const content = parasToKeep.map((p) => p.rawContent).join('\n')
    const newFilename = (await DataStore.newNoteWithContent(content, currentFolder)) ?? ''
    logDebug('smartDuplicateRegularNote', ` -> filename: ${newFilename}`)

    // Open the new note
    const newNote: ?TNote = await Editor.openNoteByFilename(newFilename)
    if (!newNote) {
      throw new Error(`Error trying to open new note with filename ${newFilename}`)
    }
    // FIXME: this fails
    logDebug('smartDuplicateRegularNote', ` CHECK: wanted title = ${title}; new title = ${displayTitle(newNote)}`)

    // TEST: Remove empty headings
    removeEmptyHeadings(newNote)

    // Sort remaining tasks according to user's defaults.
    // Note: this uses @dwertheimer's sortTasksDefault() = /std, which only works on the current Editor, so has to come here.
    // TODO: see if we can get it to work on passed paragraphs instead, to avoid the step above.
    await sortTasksDefault()

    // Does the source note have a trigger field?
    if (noteHasFrontMatter(sourceNote)) {
      const allFMFields = getAttributes(sourceNote.content)
      clo(allFMFields, 'allFMFields')
      if (allFMFields['triggers']) {
        // If so, offer to remove them
        if (await showMessageYesNo('Remove triggers from source note?', ['Yes', 'No'], `Smart Duplicate Note`) === 'Yes') {
          const result = removeFrontMatterField(sourceNote, 'triggers', '', true)
          if (result) {
            logDebug('smartDuplicateRegularNote', `removed frontmatter trigger field from '${displayTitle(sourceNote)}'`)
          } else {
            logWarn('smartDuplicateRegularNote', `failed to remove frontmatter trigger field from '${displayTitle(sourceNote)}' for some reason`)
          }
        }
      }
    }

    // Offer to archive the source note
    // FIXME: this fails?
    // TODO(later): Allow a different archive root folder, as in Reviews.
    if (await showMessageYesNo('Archive the source note?', ['Yes', 'No'], `Smart Duplicate Note`) === 'Yes') {
      const res = archiveNoteUsingFolder(sourceNote)
      logDebug('smartDuplicateRegularNote', `result of archiving '${displayTitle(sourceNote)}': ${String(res)}`)
    }

    // Offer to open the source note in a new split
    // FIXME: this fails
    if (await showMessageYesNo('Open the source note in a new split?', ['Yes', 'No'], `Smart Duplicate Note`) === 'Yes') {
      const res = openNoteInNewSplitIfNeeded(sourceNote.filename)
      logDebug('smartDuplicateRegularNote', `result of opening source note in new split: ${String(res)}`)
    }

  } catch (err) {
    logError('smartDuplicateRegularNote', err)
  }
}
