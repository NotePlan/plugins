// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main function to generate data
// Last updated 2025-09-07 for v2.3.0.b10, @jgclark
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import type { TDashboardSettings, TSection, TSectionItem, TSectionDetails } from './types'
import { getNumCompletedTasksFromNote } from './countDoneTasks'
import { createSectionItemObject, isLineDisallowedByIgnoreTerms, makeDashboardParas } from './dashboardHelpers'
import { tagParasFromNote } from './demoData'
import {
  addTagMentionCacheDefinitions,
  getFilenamesOfNotesWithTagOrMentions,
  isTagMentionCacheAvailableforItem,
  scheduleTagMentionCacheGeneration,
  WANTED_PARA_TYPES,
} from './tagMentionCache'
import { filenameIsInFuture, includesScheduledFutureDate } from '@helpers/dateTime'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { clo, logDebug, logError, logInfo, logTimer, logWarn, timer } from '@helpers/dev'
import { getFolderFromFilename } from '@helpers/folders'
import { getFrontmatterAttribute, noteHasFrontMatter } from '@helpers/NPFrontMatter'
import { getNoteByFilename } from '@helpers/note'
import { findNotesMatchingHashtagOrMention, getHeadingsFromNote } from '@helpers/NPnote'
import { sortListBy } from '@helpers/sorting'
import { caseInsensitiveSubstringMatch, caseInsensitiveMatch } from '@helpers/search'
import { eliminateDuplicateParagraphs } from '@helpers/syncedCopies'
import { isOpen, isOpenTask, removeDuplicates } from '@helpers/utils'

//-----------------------------------------------------------------

/**
 * Generate data for a section for items with a Tag/Mention.
 * Only find paras with this *single* tag/mention which include open tasks, and that by default aren't scheduled in the future.
 * Uses all the 'ignore' settings, apart from 'ignoreItemsWithTerms' if it includes this particular tag/mention.
 * Now also implements noteTags feature to include all open items in a note, based on 'note-tag' attribute in frontmatter.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData?
 */
export async function getTaggedSectionData(config: TDashboardSettings, useDemoData: boolean = false, sectionDetail: TSectionDetails, index: number): Promise<?TSection> {
  try {
  const thisStartTime = new Date()
  const sectionNumStr = `12-${index}`
  const thisSectionCode = 'TAG'
  const thisTag = sectionDetail.sectionName
  logInfo('getTaggedSectionData', `------- Gathering Tag items for section #${String(sectionNumStr)}: ${thisTag} --------`)
  // if (config.ignoreChecklistItems) logDebug('getTaggedSectionData', `Note: will filter out checklists`)
  let itemCount = 0
  let totalCount = 0
  const items: Array<TSectionItem> = []
  let isHashtag = false
  let isMention = false
  let source = ''
  const turnOnAPIComparison = config.FFlag_UseTagCacheAPIComparison ?? false
  let comparisonDetails = ''

  const ignoreTermsMinusTagCSV: string = stringListOrArrayToArray(config.ignoreItemsWithTerms, ',')
    .filter((t) => t !== thisTag)
    .join(',')
  logInfo('getTaggedSectionData', `ignoreTermsMinusTag: ${ignoreTermsMinusTagCSV}  (was: ${config.ignoreItemsWithTerms})`)

  if (useDemoData) {
    isHashtag = true
    tagParasFromNote.map((item) => {
      const thisID = `${sectionNumStr}-${itemCount}`
      items.push({ ID: thisID, ...item })
      itemCount++
    })
    source = 'using DEMO data'
  } else {
    isHashtag = thisTag.startsWith('#')
    isMention = thisTag.startsWith('@')
    if (!isHashtag && !isMention) {
      logError('getTaggedSectionData', `- thisTag '${thisTag}' is not a hashtag or mention. Stopping generation of this section.`)
    } else {
      let filteredTagParas: Array<TParagraph> = []

      // Get notes with matching hashtag or mention (as can't get list of paras directly)
      // Use Cache if wanted (and available), otherwise the API.
      let notesWithTag: Array<TNote> = []
      const cacheIsAvailableForThisTag = isTagMentionCacheAvailableforItem(thisTag)
      if (config.FFlag_UseTagCache && cacheIsAvailableForThisTag) {
        // Use Cache
        logInfo('getTaggedSectionData', `- using cache for ${thisTag}`)
        let filenamesWithTagFromCache: Array<string> = []
        ;[filenamesWithTagFromCache, comparisonDetails] = await getFilenamesOfNotesWithTagOrMentions([thisTag], true, turnOnAPIComparison)

        // This is taking about 2ms per note for JGC
        if (!filenamesWithTagFromCache || filenamesWithTagFromCache.length === 0) {
          logWarn('getTaggedSectionData', `- no valid filenamesWithTagFromCache result for ${thisTag}`)
        } else {
          filenamesWithTagFromCache.forEach((filename) => {
            const note = getNoteByFilename(filename)
            if (note) {
              notesWithTag.push(note)
            } else {
              logError('getTaggedSectionData', `- failed to get note by filename ${filename}`)
            }
          })
        }
        logTimer('getTaggedSectionData', thisStartTime, `- from CACHE found ${notesWithTag.length} notes with ${thisTag}`)
        // $FlowIgnore[unsafe-arithmetic]
        // cacheLookupTime = new Date() - cachedOperationStartTime
        source = turnOnAPIComparison ? 'using CACHE + API' : 'using just CACHE'
      } else {
        // Use API
        logInfo('getTaggedSectionData', `- using API only for ${thisTag}`)
        // Note: this is slow (1-3ms per note, so 3-9s for 3250 notes).
        notesWithTag = findNotesMatchingHashtagOrMention(thisTag, true, true, true, [], WANTED_PARA_TYPES, '', false, true)
        // $FlowIgnore[unsafe-arithmetic]
        // const APILookupTime = new Date() - thisStartTime
        logTimer('getTaggedSectionData', thisStartTime, `- from API only found ${notesWithTag.length} notes with ${thisTag}`)
        source = 'using API'
      }

      const excludedFolders = config.excludedFolders ? stringListOrArrayToArray(config.excludedFolders, ',').map((folder) => folder.trim()) : []

      for (const n of notesWithTag) {
        // logTimer('getTaggedSectionData', thisStartTime, `- start of processing for note "${n.filename}"`)
        // Don't continue if this note is in an excluded folder
        const thisNoteFolder = getFolderFromFilename(n.filename)
        if (excludedFolders.includes(thisNoteFolder)) {
          logDebug('getTaggedSectionData', `  - ignoring note '${n.filename}' as it is in an ignored folder`)
          continue
        }

        // Get the relevant paras from this note
        const paras = n.paragraphs ?? []

        // If we want to use note tags, and the note has a 'note-tag' field in its FM, then work out if the note-tag matches this particular tag/mention.
        let hasMatchingNoteTag = false
        logDebug('getTaggedSectionData', `- checking note '${n.filename}' for note-tag`)
        if (noteHasFrontMatter(n)) {
          const noteTagAttribute = getFrontmatterAttribute(n, 'note-tag')
          const noteTagList = noteTagAttribute ? stringListOrArrayToArray(noteTagAttribute, ',') : []
          if (noteTagList.length > 0) {
            hasMatchingNoteTag = noteTagList && noteTagList.some((tag) => caseInsensitiveMatch(tag, thisTag))

            logInfo('getTaggedSectionData', `-> noteTag(s) '${String(noteTagList)}' is ${hasMatchingNoteTag ? 'a' : 'NOT a'} match for ${thisTag}`)
          }
        }
        // Add the paras that contain the tag/mention, unless this is a noteTag, in which case add all paras if FM field 'note-tag' matches. (Later we filter down to open non-scheduled items).
        const tagParasFromNote = hasMatchingNoteTag ? paras : paras.filter((p) => caseInsensitiveSubstringMatch(thisTag, p.content))
        logTimer('getTaggedSectionData', thisStartTime, `- found ${tagParasFromNote.length} ${thisTag} items in "${n.filename}"`)

        // Further filter out checklists and otherwise empty items
        const filteredTagParasFromNote = config.ignoreChecklistItems
          ? tagParasFromNote.filter((p) => isOpenTask(p) && p.content.trim() !== '')
          : tagParasFromNote.filter((p) => isOpen(p) && p.content.trim() !== '')

        // Save this para, unless in matches the 'ignoreItemsWithTerms' setting (now modified to exclude this tag/mention)
        for (const p of filteredTagParasFromNote) {
          if (!isLineDisallowedByIgnoreTerms(p.content, ignoreTermsMinusTagCSV)) {
            filteredTagParas.push(p)
          } else {
            // logDebug('getTaggedSectionData', `- ignoring para {${p.content}}`)
          }
        }
        // logTimer('getTaggedSectionData', thisStartTime, `- "${n.title || ''}" after filtering out: ${config.ignoreItemsWithTerms}, ${filteredTagParas.length} paras`)
      }
      logTimer('getTaggedSectionData', thisStartTime, `- ${filteredTagParas.length} paras after filtering ${notesWithTag.length} notes`)

      // filter out paras in the future (if wanted)
      if (!config.includeFutureTagMentions) {
        const dateToUseUnhyphenated = config.showTomorrowSection ? new moment().add(1, 'days').format('YYYYMMDD') : new moment().format('YYYYMMDD')
        filteredTagParas = filteredTagParas.filter((p) => !filenameIsInFuture(p.filename || '', dateToUseUnhyphenated))
        const dateToUseHyphenated = config.showTomorrowSection ? new moment().add(1, 'days').format('YYYY-MM-DD') : new moment().format('YYYY-MM-DD')
        // Next operation typically takes 1ms
        filteredTagParas = filteredTagParas.filter((p) => !includesScheduledFutureDate(p.content, dateToUseHyphenated))
        logTimer('getTaggedSectionData', thisStartTime, `- after filtering for future, ${filteredTagParas.length} paras`)
      }

      if (filteredTagParas.length > 0) {
        // Remove possible dupes from these sync'd lines. Note: this is a quick operation, as we aren't using the 'most recent' option (which does a sort)
        filteredTagParas = eliminateDuplicateParagraphs(filteredTagParas)
        logTimer('getTaggedSectionData', thisStartTime, `- after sync dedupe -> ${filteredTagParas.length}`)

        // Remove items that appear in this section twice (which can happen if a task is in a calendar note and scheduled to that same date)
        // const beforeFilterCount = filteredTagParas.length
        // Note: this is a quick operation
        const preDedupeCount = filteredTagParas.length
        // $FlowIgnore[class-object-subtyping]
        filteredTagParas = removeDuplicates(filteredTagParas, ['content', 'filename'])
        const postDedupeCount = filteredTagParas.length

        // TODO: remove this logging once we find cause of DBW seeing dupes
        if (preDedupeCount !== postDedupeCount) {
          logDebug('getTaggedSectionData', `- de-duped from ${preDedupeCount} to ${postDedupeCount} items`)
        } else {
          logDebug('getTaggedSectionData', `- no de-duping done of items:`)
          for (const p of filteredTagParas) {
            logDebug('getTaggedSectionData', `  - {${p.content}} in ${p.filename} line ${p.lineIndex}`)
          }
        }

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
        logDebug('getTaggedSectionData', `- no items to show for ${thisTag}`)
      }

      // If we wanted to use the cache but it wasn't available or populated correctly, schedule it to be generated at the next opportunity, and ensure thisTag is in the cache definitions.
      if (config?.FFlag_UseTagCache && !cacheIsAvailableForThisTag) {
        logInfo('getTaggedSectionData', `- adding ${thisTag} to the tagCache definitions, and scheduling a regeneration`)
        addTagMentionCacheDefinitions([thisTag])
        scheduleTagMentionCacheGeneration()
        source = `using API as cache not yet available for ${thisTag}`
      }
    }
  }

  // Return section details, even if no items found
  let sectionDescription = `{countWithLimit} open {itemType} ordered by ${config.overdueSortOrder}`
  if (config?.FFlag_ShowSectionTimings) sectionDescription += ` [${timer(thisStartTime)}]`
  // TODO(later): remove note about the tag cache
  sectionDescription += `, ${source}`
  if (comparisonDetails !== '') sectionDescription += ` [${comparisonDetails}]`
  const section: TSection = {
    ID: sectionNumStr,
    name: thisTag,
    showSettingName: sectionDetail.showSettingName,
    sectionCode: thisSectionCode,
    description: sectionDescription,
    FAIconClass: isHashtag ? 'fa-light fa-hashtag' : 'fa-light fa-at',
    sectionTitleColorPart: isHashtag ? 'sidebarHashtag' : 'sidebarMention',
    sectionFilename: '',
    sectionItems: items,
    totalCount: totalCount,
    generatedDate: new Date(),
    isReferenced: false,
    actionButtons: [],
  }
  logTimer('getTaggedSectionData', thisStartTime, `to find ${itemCount} ${thisTag} items`, 1000)
    return section
  } catch (err) {
    logError('getTaggedSectionData', err.message)
  }
}
