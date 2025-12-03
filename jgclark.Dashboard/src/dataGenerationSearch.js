// @flow
//-----------------------------------------------------------------------------
// Generate search results for the Dashboard
// Last updated 2025-11-28 for v2.3.0.b16
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { extendedSearch } from '../../jgclark.SearchExtensions/src/externalSearch'
import { getSearchSettings } from '../../jgclark.SearchExtensions/src/searchHelpers'
import type { noteAndLine, resultOutputType, TSearchOptions } from '../../jgclark.SearchExtensions/src/searchHelpers'
import { WEBVIEW_WINDOW_ID } from './constants'
import { savedSearch1 } from './demoData'
import type { TDashboardSettings, TSection, TSectionItem } from './types'
import {
  createSectionItemObject,
  getDashboardSettings,
  isLineDisallowedByIgnoreTerms,
  makeDashboardParas,
  mergeSections,
  setPluginData,
} from './dashboardHelpers'
import { getActivePerspectiveName, getPerspectiveSettings } from './perspectiveHelpers'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { filenameIsInFuture, getTodaysDateHyphenated, includesScheduledFutureDate } from '@helpers/dateTime'
import { JSP, clo, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getHeadingHierarchyForThisPara } from '@helpers/headings'
import { getGlobalSharedData } from '@helpers/HTMLView'
import { getNoteByFilename } from '@helpers/note'

//-----------------------------------------------------------------

/**
 * Start a new search and open its section. For use by x-callbacks or other plugins.
 * @param {string} searchTerms space-separated search terms, using the extended syntax as if entered in a search box
 * @param {string?} noteTypesToIncludeStr (optional, default is 'notes, calendar')
 * @param {string?} fromDateStr start date for calendar notes as ISO string (optional, default is empty)
 * @param {string?} toDateStr end date for calendar notes as ISO string (optional, default is empty)
 */
export async function externallyStartSearch(
  searchTermsArg: string,
  noteTypesToIncludeStr: string = 'notes, calendar',
  fromDateStr: string = '',
  toDateStr: string = '',
): Promise<void> {
  const config: TDashboardSettings = await getDashboardSettings()
  clo(config, 'externallyStartSearch: config:')
  logInfo('externallyStartSearch', `- starting search with searchTermsArg: "${searchTermsArg}" ${config.applyCurrentFilteringToSearch ? 'WITH' : 'WITHOUT'} Perspective filtering`)

  // Compile the searchOptions object
  const foldersToExcludePlusArchive = config.applyCurrentFilteringToSearch && config.excludedFolders ? stringListOrArrayToArray(config.excludedFolders, ',') : []
  foldersToExcludePlusArchive.push('@Archive')
  const noteTypesToIncludeArr: Array<string> = noteTypesToIncludeStr === 'both' ? ['notes', 'calendar'] : stringListOrArrayToArray(noteTypesToIncludeStr, ',')
  // In v2.2 we need to get 2 remaining options from the SearchExtensions plugin (if loaded). If not, then use defaults from how NP operates
  const SEConfig = await getSearchSettings()
  const caseSensitiveSearching = SEConfig?.caseSensitiveSearching ?? false
  const fullWordSearching = SEConfig?.fullWordSearching ?? false
  logInfo('externallyStartSearch', `- from SearchExtensions config: caseSensitiveSearching: ${String(caseSensitiveSearching)}, fullWordSearching: ${String(fullWordSearching)}`)
  const searchOptions: TSearchOptions = {
    noteTypesToInclude: noteTypesToIncludeArr,
    paraTypesToInclude: config.ignoreChecklistItems ? ['open', 'scheduled'] : ['open', 'scheduled', 'checklist', 'checklistScheduled'],
    foldersToInclude: config.applyCurrentFilteringToSearch && config.includedFolders ? stringListOrArrayToArray(config.includedFolders, ',') : [],
    foldersToExclude: foldersToExcludePlusArchive,
    caseSensitiveSearching: caseSensitiveSearching,
    fullWordSearching: fullWordSearching,
    fromDateStr: fromDateStr,
    toDateStr: toDateStr ? toDateStr : config.dontSearchFutureItems ? getTodaysDateHyphenated() : '',
  }

  // Start a search
  const newSections = await getSearchResults(searchTermsArg, config, searchOptions)

  // Add the new section(s) to the existing sections
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  const pluginData = reactWindowData.pluginData
  const existingSections = pluginData.sections
  const mergedSections = mergeSections(existingSections, newSections)
  const updates: TAnyObject = { sections: mergedSections }
  await setPluginData(updates, `Finished getSearchResults for [${String(searchTermsArg)}]`)
}

/**
 * Get search results from all items in NP (constrained by searchOptions).
 * Note: this is not quite the same as getting saved search results -- see below for that.
 * @param {string} searchTermsStr
 * @param {TDashboardSettings} config
 * @param {SearchOptions} searchOptionsArg
 * @returns {Array<TSection>} new section(s) for search results
 */
export async function getSearchResults(searchTermsStr: string, config: TDashboardSettings, searchOptions: TSearchOptions): Promise<Array<TSection>> {
  try {
    const thisSectionCode = 'SEARCH'
    const sections: Array<TSection> = []
    logInfo('getSearchResults', `---------- Getting (non-saved) Search results for section ${thisSectionCode} ------------`)
    logInfo('getSearchResults', `- setting basic searchOptions ${config.applyCurrentFilteringToSearch ? 'WITH' : 'WITHOUT'} Perspective filtering'}`)
    // clo(searchOptions, 'getSearchResults: searchOptions:')
    const startTime = new Date() // for timing only
    const maxInSection = config.maxItemsToShowInSection

    // Main search call to jgclark.SearchExtensions, that includes Perspective folder-level filtering, and item-defeating, but it doesn't cover ignoring certain sections within a note.
    const searchResultSet: resultOutputType = await extendedSearch(searchTermsStr, searchOptions)
    const searchTermsRep = searchResultSet.searchTermsRepArr.join(' ')
    const resultNALs: Array<noteAndLine> = searchResultSet.resultNoteAndLineArr
    logDebug('getSearchResults', `- found ${resultNALs.length} items from [${searchTermsRep}]`)
    logTimer('getSearchResults', startTime, `- finished search for [${searchTermsRep}]`)

    logInfo('getSearchResults', `- ignoreItemsWithTerms: [${config.ignoreItemsWithTerms}]`)

    // Iterate and write items for the section
    let itemCount = 0
    const items: Array<TSectionItem> = []
    for (const rnal of resultNALs) {
      const thisID = `${thisSectionCode}-${itemCount}`
      // resultNALs is an array of noteAndLine objects, not paragraphs. We need to go and find the paragraph from the noteAndLine object
      const thisPara = getParagraphFromSearchResult(rnal)
      let keepItem = true

      // If wanted, now apply rest of Perpsective filtering: is paragraph in a disallowed section header?
      if (config.applyCurrentFilteringToSearch && config.applyCurrentFilteringToSearch && config.ignoreItemsWithTerms !== '') {
        logInfo('getSearchResults', `- applying Perspective filtering to item {${thisPara.content}}`)
        if (isLineDisallowedByIgnoreTerms(thisPara.content, config.ignoreItemsWithTerms)) {
          logInfo('getSearchResults', `- ignoring item {${thisPara.content}} as it  because it contains a disallowed term`)
          keepItem = false
        }
        // Additionally apply to calendar headings in this note
        // Now using getHeadingHierarchyForThisPara() to apply to all H4/H3/H2 headings in the hierarchy for this para
        if (config.applyIgnoreTermsToCalendarHeadingSections) {
          const theseHeadings = getHeadingHierarchyForThisPara(thisPara)
          for (const thisHeading of theseHeadings) {
            if (isLineDisallowedByIgnoreTerms(thisHeading, config.ignoreItemsWithTerms)) {
              logInfo('getSearchResults', `- ignoring item {${thisPara.content}} as it under disallowed heading '${thisHeading}'`)
              keepItem = false
            }
          }
        }
      }

      // If wanted, filter out future items from the search results, to catch items from regular notes as well as calendar notes
      if (config.dontSearchFutureItems) {
        // First ignore items that contain a future date
        if (includesScheduledFutureDate(thisPara.content)) {
          // logDebug('getSearchResults', `- skipping future item {${thisPara.content}}`)
          keepItem = false
        }
        // Then ignore items from future notes
        if (filenameIsInFuture(rnal.noteFilename)) {
          // logDebug('getSearchResults', `- skipping item {${thisPara.content}} from future note ${rnal.noteFilename}`)
          keepItem = false
        }
      }

      // If we get here, then we still want this result, so make it a dashboard para and add it to the items array
      if (keepItem) {
        const thisDashboardPara = makeDashboardParas([thisPara])[0]
        // for TEST:
        if (itemCount < 3) {
          clo(thisDashboardPara, `para ${itemCount}:`)
        }
        items.push(createSectionItemObject(thisID, thisSectionCode, thisDashboardPara))
        itemCount++
      }
    }

    // Apply limit to set of ordered results if necessary.
    // Note: We apply some limiting here, in case there are hundreds of items. There is also display filtering in the Section component via useSectionSortAndFilter.
    const itemsLimited = itemCount > maxInSection
      ? items.slice(0, maxInSection)
      : items
    logDebug('getSearchResults', `- after limit, now ${itemsLimited.length} of ${itemCount} items will be passed to React`)
    logTimer('getSearchResults', startTime, `- finished post-search processing`)

    // If there are no items, then we need to show a message instead of an empty section
    if (items.length === 0) {
      let message = `No results found for search [${searchTermsStr}]`
      let settingsDialogAnchor = ''
      if (config.usePerspectives && config.applyCurrentFilteringToSearch) {
        const perspectiveSettings = await getPerspectiveSettings()
        const perspectiveName = getActivePerspectiveName(perspectiveSettings)
        message += ` using '${perspectiveName}' Perspective filtering. You can turn off Perspective filtering in the Dashboard settings:`
        settingsDialogAnchor = 'searchSection'
      }
      items.push({
        ID: `${thisSectionCode}-Empty`,
        sectionCode: thisSectionCode,
        itemType: 'noSearchResults',
        message: message,
        settingsDialogAnchor: settingsDialogAnchor,
      })
    }

    let sectionDescription = `{countWithLimit} results for [${searchTermsStr}]`
    if (searchOptions.fromDateStr) {
      sectionDescription += ` from ${searchOptions.fromDateStr}`
    }
    if (searchOptions.toDateStr) {
      sectionDescription += ` to ${searchOptions.toDateStr}`
    }

    const section: TSection = {
      ID: thisSectionCode,
      name: 'Search',
      showSettingName: 'showSearchSection',
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-search',
      sectionTitleColorPart: 'sidebarSearch',
      sectionItems: itemsLimited,
      totalCount: itemCount,
      generatedDate: new Date(),
      showColoredBackground: true,
      actionButtons: [
        {
          actionName: 'closeSearchSection',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: 'Close this Search section',
          display: '<i class= "fa-solid fa-circle-xmark"></i> ',
          actionParam: 'SEARCH',
          postActionRefresh: [],
        },
      ],
      isReferenced: false,
    }
    sections.push(section)

    logTimer('getSearchResults', startTime, `- found ${itemCount} items from [${searchTermsRep}]`)
    return sections
  } catch (error) {
    logError('getSearchResults', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Get saved search results from all items in NP (constrained by searchOptions).
 * TODO: This is not yet complete or used, but the structure is for future expansion.
 * @param {TDashboardSettings} config
 * @param {boolean} useDemoData (optional, default is false)
 * @returns {Array<TSection>} new section(s) for search results
 */
export async function getSavedSearchResults(
  // searchTermsArg: string,
  // searchOptions: TSearchOptions,
  config: TDashboardSettings,
  useDemoData: boolean = false,
): Promise<Array<TSection>> {
  try {
    const thisSectionCode = 'SAVEDSEARCH'
    const sections: Array<TSection> = []
    // const config: TDashboardSettings = await getDashboardSettings()
    // const NPSettings = getNotePlanSettings()
    logInfo('getSavedSearchResults', `---------- Getting Saved Search results for section ${thisSectionCode} ${useDemoData ? 'with DEMO data ' : ''}------------`)
    // clo(searchOptions, 'getSavedSearchResults: searchOptions:')
    let itemCount = 0
    const items: Array<TSectionItem> = []
    let searchTermsStr: string = '?'
    let searchTermsRep: string = '?'
    const startTime = new Date() // for timing only
    const maxInSection = config.maxItemsToShowInSection

    // TODO: rework this, as with function above.
    const searchOptions: TSearchOptions = {
      noteTypesToInclude: ['notes', 'calendar'],
      paraTypesToInclude: config.ignoreChecklistItems ? ['open', 'scheduled'] : ['open', 'scheduled', 'checklist', 'checklistScheduled'],
      caseSensitiveSearching: false,
      fullWordSearching: true,
      foldersToInclude: config.includedFolders ? stringListOrArrayToArray(config.includedFolders, ',') : [],
      foldersToExclude: config.excludedFolders ? stringListOrArrayToArray(config.excludedFolders, ',') : [],
      fromDateStr: '',
      toDateStr: '',
    }

    if (useDemoData) {
      // $FlowFixMe[prop-missing]
      items.push(...savedSearch1.items)
      itemCount = items.length
      searchTermsStr = savedSearch1.name
      searchTermsRep = savedSearch1.rep
    } else {
      // TODO: This is not yet complete or used, but the structure is for future expansion.
      return []

      // // Sort out searchOptions
      // const searchTermsStr = searchTermsArg
      // // extend given search terms with the current term(s) to filter out as extra -term(s)
      // const currentIgnoreTermsArr = stringListOrArrayToArray(config.ignoreItemsWithTerms, ',')
      // const extendedSearchTerms = `${searchTermsStr} -${currentIgnoreTermsArr.join(' -')}`

      // // If dontSearchFutureItems is true, then we need to add an end date filter (of today) to the search terms (which covers which calendar notes are included)
      // logDebug('getSavedSearchResults', `- config.dontSearchFutureItems: ${String(config.dontSearchFutureItems)}`)
      // if (config.dontSearchFutureItems) {
      //   searchOptions.toDateStr = getTodaysDateHyphenated()
      //   logDebug('getSavedSearchResults', `- searchOptions.toDateStr: ${String(searchOptions.toDateStr)}`)
      // }
      // // Filter out future items from the search results, to catch items from regular notes as well as calendar notes
      // // TODO: ...

      // // Main search call to jgclark.SearchExtensions, that includes Perspective folder-level filtering, and item-defeating, but it doesn't cover ignoring certain sections within a note.
      // const searchResultSet: resultOutputType = await extendedSearch(extendedSearchTerms, searchOptions)
      // const searchTermsRep = searchResultSet.searchTermsRepArr.join(' ')
      // const resultNALs: Array<noteAndLine> = searchResultSet.resultNoteAndLineArr
      // logDebug('getSavedSearchResults', `- found ${resultNALs.length} items from [${searchTermsRep}]`)

      // // Iterate and write items for the section
      // resultNALs.map((rnal) => {
      //   const thisID = `${thisSectionCode}-${itemCount}`
      //   // resultNALs is an array of noteAndLine objects, not paragraphs. We need to go and find the paragraph from the noteAndLine object
      //   const thisParagraph = getParagraphFromSearchResult(rnal)

      //   // TODO: Now test to see if this paragraph is in a disallowed section header
      //   if (true) {
      //     const thisDashboardPara = makeDashboardParas([thisParagraph])[0]
      //     if (itemCount < 3) {
      //       clo(thisDashboardPara, `para ${itemCount}:`)
      //     }
      //     items.push(createSectionItemObject(thisID, thisSectionCode, thisDashboardPara))
      //     itemCount++
      //   }
      // })
      // itemCount += items.length

      // logTimer('getSavedSearchResults', startTime, `- finished search for [${searchTermsRep}]`)
    }
    // Apply limit to set of ordered results if necessary.
    // Note: We apply some limiting here, in case there are hundreds of items. There is also display filtering in the Section component via useSectionSortAndFilter.
    const itemsLimited = itemCount > maxInSection
      ? items.slice(0, maxInSection)
      : items
    logDebug('getSearchResults', `- after limit, now ${itemsLimited.length} of ${itemCount} items will be passed to React`)
    logTimer('getSearchResults', startTime, `- finished post-search processing`)

    // If there are no items, then we need to show a message instead of an empty section
    if (items.length === 0) {
      let message = `No results found for search [${searchTermsStr}]`
      let settingsDialogAnchor = ''
      if (config.usePerspectives && config.applyCurrentFilteringToSearch) {
        const perspectiveSettings = await getPerspectiveSettings()
        const perspectiveName = getActivePerspectiveName(perspectiveSettings)
        const perspectiveDisplayName = (perspectiveName === '-') ? 'default' : `'${perspectiveName}'`
        message += ` using ${perspectiveDisplayName} Perspective filtering. You can turn off Perspective filtering in the Dashboard settings:`
        settingsDialogAnchor = 'applyCurrentFilteringToSearch'

      }
      // Add a link to the section offering to open settings
      items.push({
        ID: `${thisSectionCode}-Empty`,
        sectionCode: thisSectionCode,
        itemType: 'noSearchResults',
        message: message,
        settingsDialogAnchor: settingsDialogAnchor,
      })
    }

    let sectionDescription = `{count} results for [${searchTermsStr}]`
    if (searchOptions.fromDateStr) {
      sectionDescription += ` from ${searchOptions.fromDateStr}`
    }
    if (searchOptions.toDateStr) {
      sectionDescription += ` to ${searchOptions.toDateStr}`
    }

    const section: TSection = {
      ID: thisSectionCode,
      name: 'Saved Search',
      showSettingName: 'showSearchSection', // TODO(later): This will probably change to showQuickSearchSection if we have multiple saved search sections.
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-search',
      sectionTitleColorPart: 'sidebarSearch',
      sectionItems: itemsLimited,
      totalCount: itemCount,
      generatedDate: new Date(),
      isReferenced: false,
      showColoredBackground: true,
      actionButtons: [
        {
          actionName: 'closeSearchSection',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: 'Close this Search section',
          display: '<i class= "fa-solid fa-circle-xmark"></i> ',
          actionParam: 'SEARCH', // TODO: Will need to be smarter if we have multiple 'SAVEDSEARCH' sections
          postActionRefresh: [],
        },
      ],
    }
    sections.push(section)

    logTimer('getSavedSearchResults', startTime, `- found ${itemCount} items from [${searchTermsRep}]`)
    return sections
  } catch (error) {
    logError('getSavedSearchResults', `ERROR: ${error.message}`)
    return []
  }
}

/**
 * Get the para from the noteAndLine object.
 * Note: this is not an efficient way of working, but it works with the current Search Extensions code.
 * @param {noteAndLine} rnal
 * @returns {TParagraph}
 */
function getParagraphFromSearchResult(rnal: noteAndLine): TParagraph {
  const theNote = getNoteByFilename(rnal.noteFilename) // helper function works for both notes and calendar notes
  if (!theNote) {
    throw new Error(`getParagraphFromSearchResult: note not found: ${rnal.noteFilename}`)
  }
  const thePara = theNote.paragraphs[rnal.index]
  if (!thePara) {
    throw new Error(`getParagraphFromSearchResult: no paragraph at line index ${rnal.index} found in ${rnal.noteFilename}`)
  }
  return thePara
}
