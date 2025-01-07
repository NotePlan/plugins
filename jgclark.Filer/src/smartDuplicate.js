// @flow
/* eslint-disable prefer-template */
//-----------------------------------------------------------------------------
// Smart duplicate note from an existing one.
// Last updated 2024-10-14 for v1.2.0 by @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import { Project } from '../../jgclark.Reviews/src/projectClass'
import { updateMetadataInEditor } from '../../jgclark.Reviews/src/reviewHelpers'
import { removeEmptyHeadings, sortTasksDefault } from '../../dwertheimer.TaskSorting/src/sortTasks'
import { archiveNoteUsingFolder } from './archive'
import {
  calcOffsetDateStr,
  getHalfYearRangeDate,
  getTodaysDateHyphenated,
  MOMENT_FORMAT_NP_QUARTER, MOMENT_FORMAT_NP_YEAR,
  RE_NP_QUARTER_SPEC, RE_NP_HALFYEAR_SPEC, RE_NP_YEAR_SPEC
} from '@helpers/dateTime'
import { clo, JSP, logDebug, logError, logInfo, logWarn } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { getAttributes, noteHasFrontMatter, removeFrontMatterField } from '@helpers/NPFrontMatter'
import { openNoteInNewSplitIfNeeded } from '@helpers/NPWindows'
import { findEndOfActivePartOfNote } from '@helpers/paragraph'
import { chooseOption, getInput, showMessageYesNo } from '@helpers/userInput'
import { isClosed } from '@helpers/utils'


//-----------------------------------------------------------------------------

/**
 * Rename title of regular note, by changing line 0 (or 1 if frontmatter) to be the new title
 * @param {TNote} note
 * @param {string} newTitle
 */
export function renameNoteTitle(note: TNote, newTitle: string): void {
  const origTitle = note.title ?? '(error)'
  let titlePara: TParagraph
  if (noteHasFrontMatter(note)) {
    titlePara = note.paragraphs[1]
    titlePara.content = `title: ${newTitle}`
  } else {
    titlePara = note.paragraphs[0]
    titlePara.content = newTitle
  }
  note.updateParagraph(titlePara)
  logDebug('renameNoteTitle', `CHECK: note title is now ${displayTitle(note)} (was: ${origTitle})`)
}

/**
 * Smartly Duplicate the currently open regular note in the Editor.
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
 * TODO: More clearly need to distinguish between copying all closed items over and making open again, or just keeping structure and non-closed items.
 * @author @jgclark
 */
export async function smartDuplicateRegularNote(): Promise<void> {
  try {
    const sourceNote = Editor.note ?? null
    if (!sourceNote) {
      // No note open, so don't do anything.
      logWarn(pluginJson, `archiveNoteUsingFolder(): No note passed or open in the Editor, so stopping.`)
      return
    }
    if (sourceNote.type !== 'Notes') {
      // Doesn't make sense to run on Calendar notes
      logWarn(pluginJson, `archiveNoteUsingFolder(): It doesn't make sense to run this on Calendar noteHasFrontMatter, so stopping.`)
      return
    }
    logDebug(pluginJson, `smartDuplicateRegularNote() starting from note '${displayTitle(sourceNote)}'`)

    // Get period for existing source note, and work out title for new note
    // First work out if source note has a period in the title
    const sourceTitle = sourceNote.title ?? ''
    let datedSourceTitle = sourceTitle
    if (!(new RegExp(RE_NP_QUARTER_SPEC)).test(sourceTitle) && !(new RegExp(RE_NP_HALFYEAR_SPEC)).test(sourceTitle) && !(new RegExp(RE_NP_YEAR_SPEC)).test(sourceTitle)) {
      // No period found, so ask user
      const chosenSourcePeriod = await getTimePeriodFromUser()
      if (!chosenSourcePeriod || chosenSourcePeriod === '') {
        logWarn('smartDuplicateRegularNote', 'No time period given, so treating as if user cancelled the operation.')
        return
      }
      logDebug('smartDuplicateRegularNote', `user's chosen period: ${chosenSourcePeriod}`)
      datedSourceTitle = `${sourceTitle} (${chosenSourcePeriod})`
    }

    // Now process original title, or original title + period, to work out next period and title.
    // Remove any "Qn" or "Hn" or "YYYY" (which needs to come last) from the title, with or without brackets
    let notePeriod = ''
    let sourcePeriodStr = ''
    let nextPeriodStr = ''
    let nextPeriodStartDateStr = '' // for ISO date
    let nextPeriodEndDateStr = '' // for ISO date
    let nextTitle = ''
    let undatedSourceTitle = sourceTitle
    // logDebug('smartDuplicateRegularNote', `undatedSourceTitle: '${undatedSourceTitle}'`)
    if ((new RegExp(RE_NP_QUARTER_SPEC)).test(datedSourceTitle)) {
      logDebug('smartDuplicateRegularNote', `found note with quarter period`)
      notePeriod = 'quarter'
      sourcePeriodStr = datedSourceTitle.match(/\D(\d{4}[Q][1-4])(\D|$)/)[1]
      nextPeriodStr = calcOffsetDateStr(sourcePeriodStr, "+1q")
      nextPeriodStartDateStr = moment(nextPeriodStr, MOMENT_FORMAT_NP_QUARTER).startOf('quarter').format('YYYY-MM-DD')
      nextPeriodEndDateStr = moment(nextPeriodStr, MOMENT_FORMAT_NP_QUARTER).endOf('quarter').format('YYYY-MM-DD')
      nextTitle = undatedSourceTitle.replace(/\d{4}Q[1-4]/, nextPeriodStr)
      undatedSourceTitle = undatedSourceTitle.replace(/\d{4}H[1-2]/, '')
    } else if ((new RegExp(RE_NP_HALFYEAR_SPEC)).test(datedSourceTitle)) {
      logDebug('smartDuplicateRegularNote', `found note with half-year period`)
      notePeriod = 'half-year'
      sourcePeriodStr = datedSourceTitle.match(/\D(\d{4}H[1-2])(\D|$)/)[1]
      nextPeriodStr = calcOffsetDateStr(sourcePeriodStr, "+1h")
      logDebug('smartDuplicate', `${sourcePeriodStr} +1h -> ${nextPeriodStr}`)
        ;[nextPeriodStartDateStr, nextPeriodEndDateStr] = getHalfYearRangeDate(nextPeriodStr)
      nextTitle = undatedSourceTitle.replace(/\d{4}H[1-2]/, nextPeriodStr)
      undatedSourceTitle = undatedSourceTitle.replace(/\d{4}H[1-2]/, '')
    } else if ((new RegExp(RE_NP_YEAR_SPEC)).test(datedSourceTitle)) {
      logDebug('smartDuplicateRegularNote', `found note with year period`)
      notePeriod = 'year'
      sourcePeriodStr = datedSourceTitle.match(/\D(\d{4})(\D|$)/)[1]
      nextPeriodStr = calcOffsetDateStr(sourcePeriodStr, "+1y")
      nextPeriodStartDateStr = moment(nextPeriodStr, MOMENT_FORMAT_NP_YEAR).startOf('year').format('YYYY-MM-DD')
      nextPeriodEndDateStr = moment(nextPeriodStr, MOMENT_FORMAT_NP_QUARTER).endOf('year').format('YYYY-MM-DD')
      nextTitle = undatedSourceTitle.replace(/\d{4}/, nextPeriodStr)
      undatedSourceTitle = undatedSourceTitle.replace(/\d{4}/, '')
    }
    else {
      // Shouldn't get here
      logError('smartDuplicateRegularNote', `Couldn't work out source period. Stopping.`)
    }

    logDebug('smartDuplicateRegularNote', `user's chosen period: ${notePeriod}, nextPeriodStr: ${nextPeriodStr}, nextTitle: '${nextTitle}'`)
    undatedSourceTitle = undatedSourceTitle.replace("()", '').replace("[]", '').trim()
    if (notePeriod !== '') logDebug(`smartDuplicateRegularNote`, `found note with period: ${notePeriod}, nextTitle: '${nextTitle}'`)

    // Rename existing file to include time period (if it didn't already)
    if (datedSourceTitle !== sourceTitle) {
      logDebug('smartDuplicateRegularNote', `updating source title to '${datedSourceTitle}'`)
      renameNoteTitle(sourceNote, datedSourceTitle)
    }

    // Offer the first line to use, shorn of any leading # marks
    const newTitleToOffer = nextTitle
    // try to work out new title
    const newTitle = await getInput(`Title of new ${notePeriod !== '' ? notePeriod + 'ly ' : ''}note`, 'OK', 'Smart Duplicate Note', newTitleToOffer)
    if (typeof newTitle === 'boolean') {
      logWarn('smartDuplicateRegularNote', 'The user cancelled the operation.')
      return
    }
    logDebug('smartDuplicateRegularNote', `new title will be ${newTitle}`)

    // Work out the contents of the active part of the note
    // const activeParas = getActiveParagraphs(sourceNote) // TODO: doesn't work properly
    const activeParas = sourceNote.paragraphs.slice(0, findEndOfActivePartOfNote(sourceNote))
    logDebug('smartDuplicateRegularNote', `- has ${activeParas.length} paras in the active part`)
    // Keep all lines that aren't open tasks/checklists
    // FIXME: but also keep sync'd lines
    const parasToKeep = activeParas.filter(para => !isClosed(para))
    logDebug('smartDuplicateRegularNote', `- has ${parasToKeep.length} paras to keep (!isClosed)`)

    // TEST: need to update title line first: change line 0 (or 1 if frontmatter) to be the new title
    renameNoteTitle(sourceNote, newTitle)
    let destTitlePara: TParagraph
    if (noteHasFrontMatter(sourceNote)) {
      destTitlePara = parasToKeep[1]
      destTitlePara.content = `title: ${newTitle}`
    } else {
      destTitlePara = parasToKeep[0]
      destTitlePara.content = newTitle
    }
    logDebug('smartDuplicateRegularNote', `- CHECK: destTitlePara => ${destTitlePara.content}`)

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
    logInfo('smartDuplicateRegularNote', `-> NEW note with filename: ${newFilename}`)

    // Open the new note
    const newNote: ?TNote = await Editor.openNoteByFilename(newFilename)
    if (!newNote) {
      throw new Error(`Error trying to open new note with filename ${newFilename}`)
    }
    logDebug('smartDuplicateRegularNote', ` CHECK: wanted title = ${newTitle}; new title = ${displayTitle(newNote)}`)

    // TEST: Remove empty headings
    removeEmptyHeadings(newNote)

    // Update project-related metadata:
    const metadataArr: Array<string> = []
    // - @reviewed() -> start of this period
    const todayMom = moment()
    metadataArr.push(`@reviewed(${todayMom.format('YYYY-MM-DD')})`)
    // - @start() -> start of this period
    metadataArr.push(`@start(${nextPeriodStartDateStr})`)
    // - @due() -> end of this period
    metadataArr.push(`@due(${nextPeriodEndDateStr})`)
    const res = updateMetadataInEditor(metadataArr)
    // TODO: delete any @completed() date

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
    // TODO(later): Allow a different archive root folder, as in Reviews.
    if (await showMessageYesNo('Archive the source note?', ['Yes', 'No'], `Smart Duplicate Note`) === 'Yes') {
      const res = archiveNoteUsingFolder(sourceNote)
      logDebug('smartDuplicateRegularNote', `result of archiving '${displayTitle(sourceNote)}': ${String(res)}`)
    }

    // Offer to open the source note in a new split
    if (await showMessageYesNo('Open the source note in a new split?', ['Yes', 'No'], `Smart Duplicate Note`) === 'Yes') {
      const res = openNoteInNewSplitIfNeeded(sourceNote.filename)
      logDebug('smartDuplicateRegularNote', `result of opening source note in new split: ${String(res)}`)
    }

  } catch (err) {
    logError('smartDuplicateRegularNote', err.message)
  }
}

async function getTimePeriodFromUser(): Promise<string> {
  // make a list of possible titles for old and new notes
  const relativeDates = []
  const todayMom = moment()
  const todayDateStr = getTodaysDateHyphenated()
  let thisDateStr = ''
  thisDateStr = moment(todayMom).startOf('year').format(MOMENT_FORMAT_NP_YEAR)
  relativeDates.push({ label: `this year (${thisDateStr})`, value: thisDateStr })
  thisDateStr = moment(todayMom).subtract(1, 'year').startOf('year').format(MOMENT_FORMAT_NP_YEAR)
  relativeDates.push({ label: `last year (${thisDateStr})`, value: thisDateStr })
  thisDateStr = moment(todayMom).add(1, 'year').startOf('year').format(MOMENT_FORMAT_NP_YEAR)
  relativeDates.push({ label: `next year (${thisDateStr})`, value: thisDateStr })

  thisDateStr = calcOffsetDateStr(todayDateStr, '0h', 'offset')
  relativeDates.push({ label: `this half-year (${thisDateStr})`, value: thisDateStr })
  thisDateStr = calcOffsetDateStr(todayDateStr, '-1h', 'offset')
  relativeDates.push({ label: `last half-year (${thisDateStr})`, value: thisDateStr })
  thisDateStr = calcOffsetDateStr(todayDateStr, '+1h', 'offset')
  relativeDates.push({ label: `next half-year (${thisDateStr})`, value: thisDateStr })

  thisDateStr = moment(todayMom).startOf('quarter').format(MOMENT_FORMAT_NP_QUARTER)
  relativeDates.push({ label: `this quarter (${thisDateStr})`, value: thisDateStr })
  thisDateStr = moment(todayMom).subtract(1, 'quarter').startOf('quarter').format(MOMENT_FORMAT_NP_QUARTER)
  relativeDates.push({ label: `last quarter (${thisDateStr})`, value: thisDateStr })
  thisDateStr = moment(todayMom).add(1, 'quarter').startOf('quarter').format(MOMENT_FORMAT_NP_QUARTER)
  relativeDates.push({ label: `next quarter (${thisDateStr})`, value: thisDateStr })
  clo(relativeDates, 'relativeDates')

  const periodOptions = relativeDates
  const chosenSourcePeriod = await chooseOption(`What was the time period that this existing note covered?`, periodOptions, ``)
  return chosenSourcePeriod
}