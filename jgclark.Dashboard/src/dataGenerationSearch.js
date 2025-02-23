// @flow
//-----------------------------------------------------------------------------
// Generate search results for the Dashboard
// Last updated 2025-02-21 for v2.2.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { extendedSearch, type SearchOptions } from '../../jgclark.SearchExtensions/src/saveSearch'
import type { noteAndLine, resultOutputTypeV3 } from '../../jgclark.SearchExtensions/src/searchHelpers'
import { WEBVIEW_WINDOW_ID } from './constants'
import type { TDashboardSettings, TSection, TSectionItem } from './types'
import {
  // createSectionOpenItemsFromParas,
  createSectionItemObject,
  getDashboardSettings,
  // isLineDisallowedByExcludedTerms,
  makeDashboardParas,
  mergeSections,
  setPluginData
} from './dashboardHelpers'
import { getTodaysDateHyphenated } from '@helpers/dateTime'
import { JSP, clo, logDebug, logError, logInfo, logTimer, logWarn } from '@helpers/dev'
import { getNoteByFilename } from '@helpers/note'
import { stringListOrArrayToArray } from '@helpers/dataManipulation'
import { getGlobalSharedData } from '@helpers/HTMLView'

//-----------------------------------------------------------------

/**
 * Start a new search and open its section. For use by x-callbacks or other plugins.
 * @param {string} searchTerms space-separated search terms, using the extended syntax as the search box in the Dashboard.
 * @param {string?} noteTypesToIncludeStr (optional, default is 'notes, calendar')
 * @param {string?} fromDateStr start date for calendar notes as ISO string (optional, default is empty)
 * @param {string?} toDateStr end date for calendar notes as ISO string (optional, default is empty)
 */
export async function externallyStartSearch(
  searchTerms: string,
  noteTypesToIncludeStr: string = 'notes, calendar',
  fromDateStr: string = '',
  toDateStr: string = '',
): Promise<void> {
  const config: TDashboardSettings = await getDashboardSettings()

  const noteTypesToIncludeArr: Array<string> = (noteTypesToIncludeStr === 'both') ? ['notes', 'calendar'] : stringListOrArrayToArray(noteTypesToIncludeStr, ',')
  const searchOptions: SearchOptions = {
    noteTypesToInclude: noteTypesToIncludeArr,
    paraTypesToInclude: config.ignoreChecklistItems ? ['open', 'scheduled'] : ['open', 'scheduled', 'checklist', 'checklistScheduled'],
    caseSensitiveSearching: false,
    fullWordSearching: true,
    foldersToInclude: config.includedFolders ? stringListOrArrayToArray(config.includedFolders, ',') : [],
    foldersToExclude: config.excludedFolders ? stringListOrArrayToArray(config.excludedFolders, ',') : [],
    fromDateStr: fromDateStr,
    toDateStr: toDateStr,
  }

  // Start a transient search
  const newSections = await getSearchResults(searchTerms, searchOptions, config)

  // Add the new sections to the existing sections
  const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
  const pluginData = reactWindowData.pluginData
  const existingSections = pluginData.sections
  const mergedSections = mergeSections(existingSections, newSections)
  const updates: TAnyObject = { sections: mergedSections }
  await setPluginData(updates, `Finished getSearchResults for [${String(searchTerms)}]`)
}

/**
 * Get search results from all items in NP (constrained by searchOptions).
 * TODO(later): Add support for saved searches.
 * @param {string} searchTermsArg
 * @param {SearchOptions} searchOptions
 * @param {TDashboardSettings} config
 * @param {string?} savedSearchName (optional, for FUTURE use with saved searches)
 * @returns {Array<TSection>} new section(s) for search results
 */
export async function getSearchResults(searchTermsArg: string, searchOptions: SearchOptions, config: TDashboardSettings, savedSearchName: string = ''): Promise<Array<TSection>> {
  try {
    const sectionNumStr = '21' // TODO(later): This will need updating if we have saved search sections
    const thisSectionCode = 'QSEARCH' // TODO(later): This will need updating if we have saved search sections
    const sections: Array<TSection> = []
    // const config: TDashboardSettings = await getDashboardSettings()
    // const NPSettings = getNotePlanSettings()
    const isQuickSearch = savedSearchName === ''
    logInfo('getSearchResults', `---------- Getting ${isQuickSearch ? 'Quick' : 'Saved'} Search results for section #${String(sectionNumStr)} ------------`)
    // clo(searchOptions, 'getSearchResults: searchOptions:')
    const startTime = new Date() // for timing only

    // Sort out searchOptions
    const searchTermsStr = searchTermsArg
    // extend given search terms with the current term(s) to filter out as extra -term(s)
    const currentIgnoreTermsArr = stringListOrArrayToArray(config.ignoreItemsWithTerms, ',')
    const extendedSearchTerms = `${searchTermsStr} -${currentIgnoreTermsArr.join(' -')}`

    // If dontSearchFutureItems is true, then we need to add an end date filter (of today) to the search terms (which covers which calendar notes are included)
    logDebug('getSearchResults', `- config.dontSearchFutureItems: ${String(config.dontSearchFutureItems)}`)
    if (config.dontSearchFutureItems) {
      searchOptions.toDateStr = getTodaysDateHyphenated()
      logDebug('getSearchResults', `- searchOptions.toDateStr: ${String(searchOptions.toDateStr)}`)
    }
    // TODO: filter out future items from the search results, to catch items from regular notes as well as calendar notes
    // TODO: ...

    // Main search call to jgclark.SearchExtensions, that includes Perspective folder-level filtering, and item-defeating, but it doesn't cover ignoring certain sections within a note.
    const searchResultSet: resultOutputTypeV3 = await extendedSearch(extendedSearchTerms, searchOptions)
    const getSearchTermsRep = searchResultSet.searchTermsRepArr.join(' ')
    const resultNALs: Array<noteAndLine> = searchResultSet.resultNoteAndLineArr
    logDebug('getSearchResults', `- found ${resultNALs.length} items from [${getSearchTermsRep}]`)

    // Iterate and write items for the section
    let itemCount = 0
    const items: Array<TSectionItem> = []
    resultNALs.map((rnal) => {
      const thisID = `${sectionNumStr}-${itemCount}`
      // resultNALs is an array of noteAndLine objects, not paragraphs. We need to go and find the paragraph from the noteAndLine object
      const thisParagraph = getParagraphFromSearchResult(rnal)

      // TODO: Now test to see if this paragraph is in a disallowed section header
      if (true) {
        const thisDashboardPara = makeDashboardParas([thisParagraph])[0]
        if (itemCount < 3) {
          clo(thisDashboardPara, `para ${itemCount}:`)
        }
        items.push(createSectionItemObject(thisID, thisDashboardPara))
        itemCount++
      }
    })
    // items = createSectionOpenItemsFromParas(sortedOrCombinedParas, sectionNumStr)
    itemCount += items.length

    logTimer('getSearchResults', startTime, `- finished search for [${getSearchTermsRep}]`)

    let sectionDescription = `{count} results for [${searchTermsStr}]`
    if (searchOptions.fromDateStr) {
      sectionDescription += ` from ${searchOptions.fromDateStr}`
    }
    if (searchOptions.toDateStr) {
      sectionDescription += ` to ${searchOptions.toDateStr}`
    }

    const section: TSection = {
      ID: sectionNumStr,
      name: 'Search',
      showSettingName: 'showSearchSection', // TODO(later): This will probably change to showQuickSearchSection if we have multiple saved search sections.
      sectionCode: thisSectionCode,
      description: sectionDescription,
      FAIconClass: 'fa-regular fa-search',
      sectionTitleColorPart: 'sidebarSearch',
      sectionItems: items,
      generatedDate: new Date(),
      actionButtons: isQuickSearch ? [
        {
          actionName: 'closeSection',
          actionPluginID: `${pluginJson['plugin.id']}`,
          tooltip: "Close this Search section",
          display: '<i class= "fa-solid fa-circle-xmark"></i> ',
          actionParam: 'QSEARCH', // TODO: Will need to be smarter if we have multiple Search sections
          postActionRefresh: [],
          // formFields: thisMonthFormFields,
          // submitOnEnter: true,
          // submitButtonText: 'Add & Close',
        },
      ] : [],
      isReferenced: false,
    }
    sections.push(section)

    logTimer('getSearchResults', startTime, `- found ${itemCount} items from [${getSearchTermsRep}]`)
    // clo(sections, 'sections')
    return sections
  } catch (error) {
    logError('getSearchResults', `ERROR: ${error.message}`)
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
  // const thisParagraph: TParagraphForDashboard = makeDashboardParas([thePara])[0]
  return thePara
}
