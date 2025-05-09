// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2025-05-01 for v2.2.2, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import type { TDashboardSettings, TSection, TSectionItem, TSectionDetails } from './types'
import { getNumCompletedTasksTodayFromNote } from './countDoneTasks'
import {
  createSectionItemObject,
  isLineDisallowedByExcludedTerms,
  makeDashboardParas,
} from './dashboardHelpers'
import { tagParasFromNote } from './demoData'
import { getFilenamesOfNotesWithTagOrMentions } from './tagMentionCache'
import { filenameIsInFuture, includesScheduledFutureDate } from '@helpers/dateTime'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, logDebug, logError, logInfo, logTimer, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { displayTitle } from '@helpers/general'
import { noteHasFrontMatter } from '@helpers/NPFrontMatter'
import { getNoteByFilename } from '@helpers/note'
import { findNotesMatchingHashtagOrMention, getHeadingsFromNote } from '@helpers/NPnote'
import { sortListBy } from '@helpers/sorting'
import { eliminateDuplicateSyncedParagraphs } from '@helpers/syncedCopies'
import { isOpen, isOpenTask, removeDuplicates } from '@helpers/utils'
//-----------------------------------------------------------------
/**
 * Generate data for a section for items with a Tag/Mention.
 * Only find paras with this *single* tag/mention which include open tasks that aren't scheduled in the future.
 * Now also uses all the 'ignore' settings, other than any that are the same as this particular tag/mention.
 * Now also uses FFlag_UseNoteTags to include all open items in a note, based on tag in frontmatter.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 */
export async function getTaggedSectionData(config: TDashboardSettings, useDemoData: boolean = false, sectionDetail: TSectionDetails, index: number): Promise<TSection> {
  const thisStartTime = new Date()
  const sectionNumStr = `12-${index}`
  const thisSectionCode = 'TAG'
  logInfo('getTaggedSectionData', `------- Gathering Tag items for section #${String(sectionNumStr)}: ${sectionDetail.sectionName} --------`)
  // if (config.ignoreChecklistItems) logDebug('getTaggedSectionData', `Note: will filter out checklists`)
  let itemCount = 0
  let totalCount = 0
  const items: Array<TSectionItem> = []
  let isHashtag = false
  let isMention = false
  // const thisStartTime = new Date()

  const ignoreTermsMinusTagCSV: string = stringListOrArrayToArray(config.ignoreItemsWithTerms, ',')
    .filter((t) => t !== sectionDetail.sectionName)
    .join(',')
  logInfo('getTaggedSectionData', `ignoreTermsMinusTag: ${ignoreTermsMinusTagCSV}  (was: ${config.ignoreItemsWithTerms})`)

  if (useDemoData) {
    isHashtag = true
    tagParasFromNote.map((item) => {
      const thisID = `${sectionNumStr}-${itemCount}`
      items.push({ ID: thisID, ...item })
      itemCount++
    })
  } else {
    isHashtag = sectionDetail.sectionName.startsWith('#')
    isMention = sectionDetail.sectionName.startsWith('@')
    if (isHashtag || isMention) {
      let filteredTagParas: Array<TParagraph> = []

      // Get notes with matching hashtag or mention (as can't get list of paras directly)
      // const notesWithTagFromCache: Array<TNote> = []
      let notesWithTag: Array<TNote> = []
      if (config?.FFlag_UseTagCache) {
        // TODO: this is the only place this function is called, so it could be refactored to return Notes, not their filenames
        const filenamesWithTagFromCache = await getFilenamesOfNotesWithTagOrMentions([sectionDetail.sectionName], true)
        logInfo('getTaggedSectionData', `- found ${filenamesWithTagFromCache.length} filenames: [${filenamesWithTagFromCache.join(',')}]`)

        // TODO: try moving the folder-filtering here, and see if it makes enough of a time difference

        // This is taking about 2ms per note for JGC
        filenamesWithTagFromCache.forEach((filename) => {
          const note = getNoteByFilename(filename)
          if (note) {
            notesWithTag.push(note)
          } else {
            logError('getTaggedSectionData', `- failed to get note by filename ${filename}`)
          }
        })
        // $FlowIgnore[unsafe-arithmetic]
        logTimer('getTaggedSectionData', thisStartTime, `- from CACHE filename list looked up ${notesWithTag.length} notes with ${sectionDetail.sectionName}`)
        // $FlowIgnore[unsafe-arithmetic]
        // cacheLookupTime = new Date() - cachedOperationStartTime
      } else {
        // Note: this is slow (about 1ms per note, so 3100ms for 3250 notes).
        // Though JGC has also seen 9,900ms for all notes in the system, so its variable.
        const thisStartTime = new Date()
        notesWithTag = findNotesMatchingHashtagOrMention(sectionDetail.sectionName, true, true, true)
        // $FlowIgnore[unsafe-arithmetic]
        // const APILookupTime = new Date() - thisStartTime
        logTimer('getTaggedSectionData', thisStartTime, `- found ${notesWithTag.length} notes with ${sectionDetail.sectionName} from API in ${timer(thisStartTime)}`)
      }

      for (const n of notesWithTag) {
        logTimer('getTaggedSectionData', thisStartTime, `- start of processing for note "${n.filename}"`)
        // Don't continue if this note is in an excluded folder
        const thisNoteFolder = getFolderFromFilename(n.filename)
        if (stringListOrArrayToArray(config.excludedFolders, ',').includes(thisNoteFolder)) {
          // logDebug('getTaggedSectionData', `- ignoring note '${n.filename}' as it is in an ignored folder`)
          continue
        }

        // Get the relevant paras from this note
        const paras = n.paragraphs ?? []
        if (paras.length > 500) {
          logTimer('getTaggedSectionData', thisStartTime, `  - found ${paras.length} paras in "${n.filename}"`)
          const content = n.content ?? ''
          logTimer('getTaggedSectionData', thisStartTime, `  - to pull content from note`)
          const pp = content.split('\n')
          logTimer('getTaggedSectionData', thisStartTime, `  - to split content into ${pp.length} lines`)
        }

        // If we want to use note tags, and the note has a 'note-tag' field in its FM, then work out if the note-tag matches this particular tag/mention.
        let noteTagMatches = false
        logDebug('getTaggedSectionData', `- '${displayTitle(n)}' has FM? ${String(noteHasFrontMatter(n))}, FFlag_UseNoteTags: ${String(config.FFlag_UseNoteTags)}`)
        if (config.FFlag_UseNoteTags && noteHasFrontMatter(n)) {
          logInfo('getTaggedSectionData', `- note "${n.filename}" has FM`)
          const frontmatterAttributes = n.frontmatterAttributes
          clo(frontmatterAttributes, 'getTaggedSectionData fm attributes')
          if (frontmatterAttributes && 'note-tag' in frontmatterAttributes) {
            logInfo('getTaggedSectionData', `- note "${n.filename}" has noteTag(s) "${frontmatterAttributes['note-tag']}"`)
            const noteTags = frontmatterAttributes['note-tag'].split(',')
            if (noteTags.includes(sectionDetail.sectionName)) {
              noteTagMatches = true
              logInfo('getTaggedSectionData', `-> noteTag is a match for ${sectionDetail.sectionName}`)
            }
          }
        }
        // Add the paras that contain the tag/mention, unless FFlag_UseNoteTags is true, in which case add all paras if FM field 'note-tag' matches. (Later we filter down to open non-scheduled items).
        const tagParasFromNote = (noteTagMatches)
          ? paras
          : paras.filter((p) => p.content?.includes(sectionDetail.sectionName))
        logTimer('getTaggedSectionData', thisStartTime, `- found ${tagParasFromNote.length} paras containing ${sectionDetail.sectionName} in "${n.filename}"`)

        // Further filter out checklists and otherwise empty items
        const filteredTagParasFromNote = config.ignoreChecklistItems
          ? tagParasFromNote.filter((p) => isOpenTask(p) && p.content.trim() !== '')
          : tagParasFromNote.filter((p) => isOpen(p) && p.content.trim() !== '')

        // Save this para, unless in matches the 'ignoreItemsWithTerms' setting (now modified to exclude this tag/mention)
        for (const p of filteredTagParasFromNote) {
          if (!isLineDisallowedByExcludedTerms(p.content, ignoreTermsMinusTagCSV)) {
            filteredTagParas.push(p)
          } else {
            // logDebug('getTaggedSectionData', `- ignoring para {${p.content}}`)
          }
        }
        // logTimer('getTaggedSectionData', thisStartTime, `- "${n.title || ''}" after filtering out: ${config.ignoreItemsWithTerms}, ${filteredTagParas.length} paras`)
      }
      logTimer('getTaggedSectionData', thisStartTime, `- ${filteredTagParas.length} paras after filtering ${notesWithTag.length} notes`)

      // filter out paras in the future
      const dateToUseUnhyphenated = config.showTomorrowSection ? new moment().add(1, 'days').format('YYYYMMDD') : new moment().format('YYYYMMDD')
      filteredTagParas = filteredTagParas.filter((p) => !filenameIsInFuture(p.filename || '', dateToUseUnhyphenated))
      const dateToUseHyphenated = config.showTomorrowSection ? new moment().add(1, 'days').format('YYYY-MM-DD') : new moment().format('YYYY-MM-DD')
      // Next operation typically takes 1ms
      filteredTagParas = filteredTagParas.filter((p) => !includesScheduledFutureDate(p.content, dateToUseHyphenated))
      logTimer('getTaggedSectionData', thisStartTime, `- after filtering for future, ${filteredTagParas.length} paras`)

      if (filteredTagParas.length > 0) {
        // Remove possible dupes from these sync'd lines. Note: this is a quick operation, as we aren't using the 'most recent' option (which does a sort)
        filteredTagParas = eliminateDuplicateSyncedParagraphs(filteredTagParas)
        logTimer('getTaggedSectionData', thisStartTime, `- after sync dedupe -> ${filteredTagParas.length}`)
        // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
        // Note: this is a quick operation
        // $FlowIgnore[class-object-subtyping]
        filteredTagParas = removeDuplicates(filteredTagParas, ['content', 'filename'])
        logTimer('getTaggedSectionData', thisStartTime, `- after removeDuplicates -> ${filteredTagParas.length}`)

        // Create a much cut-down version of this array that just leaves the content, priority, but also the note's title, filename and changedDate.
        // Note: this is a pretty quick operation (3-4ms / item)
        // $FlowIgnore[class-object-subtyping]
        const dashboardParas = makeDashboardParas(filteredTagParas)
        logTimer('getTaggedSectionData', thisStartTime, `- after eliminating dupes -> ${dashboardParas.length}`)

        totalCount = dashboardParas.length

        // Sort paragraphs by one of several options
        const sortOrder =
          config.overdueSortOrder === 'priority'
            ? ['-priority', '-changedDate']
            : config.overdueSortOrder === 'earliest'
              ? ['changedDate', '-priority']
              : config.overdueSortOrder === 'due date'
                ? ['dueDate', '-priority']
                : ['-changedDate', '-priority'] // 'most recent'
        const sortedTagParas = sortListBy(dashboardParas, sortOrder)
        logTimer('getTaggedSectionData', thisStartTime, `- Filtered, Reduced & Sorted  ${sortedTagParas.length} items by ${String(sortOrder)}`)

        for (const p of sortedTagParas) {
          const thisID = `${sectionNumStr}.${itemCount}`
          // $FlowIgnore[incompatible-call]
          items.push(createSectionItemObject(thisID, p))
          itemCount++
        }
      } else {
        logDebug('getTaggedSectionData', `- no items to show for ${sectionDetail.sectionName}`)
      }
    }
  }

  // Return section details, even if no items found
  let sectionDescription = `{count} item{s} ordered by ${config.overdueSortOrder}`
  if (config?.FFlag_ShowSectionTimings) sectionDescription += ` in ${timer(thisStartTime)}`
  if (config?.FFlag_UseTagCache) sectionDescription += `, using CACHE` // TODO(later): remove note about the tag cache
  const section: TSection = {
    ID: sectionNumStr,
    name: sectionDetail.sectionName,
    showSettingName: sectionDetail.showSettingName,
    sectionCode: thisSectionCode,
    description: sectionDescription,
    FAIconClass: isHashtag ? 'fa-light fa-hashtag' : 'fa-light fa-at',
    sectionTitleColorPart: isHashtag ? 'sidebarHashtag' : 'sidebarMention',
    sectionFilename: '',
    sectionItems: items,
    totalCount: totalCount, // Note: Now not sure how this is used (if it is)
    generatedDate: new Date(),
    isReferenced: false,
    actionButtons: [],
  }
  logTimer('getTaggedSectionData', thisStartTime, `to find ${itemCount} ${sectionDetail.sectionName} items`, 1000)
  return section
}
