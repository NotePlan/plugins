// @flow
//--------------------------------------------------------------------------
// Helpers for the Section component.
// Last updated 2026-07-10 for v2.4.0.b47 by @jgclark + @CursorAI
//--------------------------------------------------------------------------

import type { TSection, TSectionItem, TDashboardSettings, TSectionCode, TSectionDetails, TSettingItem } from '../../../types.js'
import { allSectionDetails, CAN_HAVE_EMPTY_SECTION_MESSAGES, treatSingleItemTypesAsZeroItems } from '../../../constants'
import { logTimer } from '@helpers/dev.js'
import { clo, clof, logDebug, logError, logInfo, timer } from '@helpers/react/reactDev'

/**
 * Count section items that represent real work (not congrats / empty-state placeholders).
 * Used by hideEmptySections to tell "had open items" from "already showing an empty message".
 * @param {?Array<TSectionItem>} items
 * @returns {number}
 */
export function countRealSectionItems(items: ?Array<TSectionItem>): number {
  if (!items || items.length === 0) return 0
  return items.filter((item) => !treatSingleItemTypesAsZeroItems.includes(item.itemType)).length
}

/**
 * Normalize section.generatedDate for equality checks (Date or ISO string after bridge serialization).
 * @param {Date | string | void | null} generatedDate
 * @returns {string}
 */
export function getGeneratedDateKey(generatedDate: ?(Date | string)): string {
  if (generatedDate == null) return ''
  if (typeof generatedDate === 'string') return generatedDate
  // Avoid method-unbinding: call via Date.prototype rather than extracting toISOString
  if (generatedDate instanceof Date) return Date.prototype.toISOString.call(generatedDate)
  return String(generatedDate)
}

/**
 * Get a list of TSettingItem (key, label, type) objects for the showSettingName settings for all sections except TAG (which requires special handling).
 * Also, INFO section is turned off by default.
 * @returns {Array<TSettingItem>}
 */
export const showSectionSettingItems: Array<TSettingItem> = allSectionDetails.reduce((acc, s) => {
  if (s.sectionCode !== 'TAG') {
    acc.push({ label: `Show ${s.sectionName}`, key: s.showSettingName, type: 'switch', default: s.sectionCode !== 'INFO', checked: s.sectionCode !== 'INFO' })
  }
  return acc
}, [])

/**
 * Return list of currently visible sections.
 * @param {TDashboardSettings} dashboardSettings - Shared settings to determine visibility of sections.
 * @param {Array<TSection>} sections - The sections to filter.
 * @returns {Array<TSectionCode>}
 */
export function getVisibleSectionCodes(dashboardSettings: TDashboardSettings, sections: Array<TSection>): Array<TSectionCode> {
  const output: Array<TSectionCode> = []

  for (const section of sections) {
    if (section) {
      const isVisible = sectionIsVisible(section, dashboardSettings)
      if (isVisible) {
        output.push(section.sectionCode)
      }
    }
  }
  // logDebug('sectionHelpers/getVisibleSectionCodes', `Visible section codes: ${String(output)}`)
  return output
}

/**
 * TB section is visible when Time Block and/or Reminders section setting is on.
 * Missing showRemindersSection means ON (default); only an explicit false disables Reminders.
 * @param {?TDashboardSettings} dashboardSettings
 * @returns {boolean}
 */
export function isTBSectionVisibleInSettings(dashboardSettings: ?TDashboardSettings): boolean {
  if (!dashboardSettings) return false
  // Same rule as isTBSectionEnabled() in dashboardHelpers (kept local to avoid React/plugin circular imports)
  const timeBlockOn = Boolean(dashboardSettings.showTimeBlockSection)
  const remindersOn = dashboardSettings.showRemindersSection !== false
  return timeBlockOn || remindersOn
}

/**
 * Gets the visibility setting for a given section code.
 *
 * @param {TSectionCode} sectionCode - The section code.
 * @param {TDashboardSettings} dashboardSettings - Shared settings to determine visibility of sections.
 * @returns {boolean} - Whether the section is visible.
 */
const sectionIsVisible = (section: TSection, dashboardSettings: TDashboardSettings): boolean => {
  const sectionCode: TSectionCode = section.sectionCode
  if (!sectionCode) logDebug(`sectionHelpers`, `section has no sectionCode`, section)
  if (!dashboardSettings) return false
  // TB can show when Time Block and/or Reminders is enabled (timed reminders live in TB)
  if (sectionCode === 'TB') return isTBSectionVisibleInSettings(dashboardSettings)
  // const thisSection = getSectionDetailsFromSectionCode(sectionCode) // get sectionCode, sectionName, showSettingName
  const settingName = section.showSettingName
  if (!settingName) logDebug(`sectionHelpers`, `sectionCode ${sectionCode} has no showSettingName`, section)
  if (!settingName) return true
  // $FlowIgnore[invalid-computed-prop]
  const showSetting = sectionCode === 'TAG' ? dashboardSettings[settingName] : dashboardSettings[settingName]
  // logDebug('sectionHelpers', `sectionIsVisible ${sectionCode} ${settingName} ${showSetting} returning ${typeof showSetting === 'undefined' || showSetting === true}`)
  return typeof showSetting === 'undefined' || showSetting === true
}

/**
 * Whether a section would actually render after Section.jsx empty-state handling (for load/refresh, not local last-item congrats).
 * Mirrors Section.jsx: enabled sections with real items always show; empty SEARCH always shows;
 * empty DT/W/M/Q (non-ref), TAG, PROJ* show congrats unless hideEmptySections is on; empty WINS and other empties hide.
 * @param {TSection} section
 * @param {TDashboardSettings} dashboardSettings
 * @returns {boolean}
 */
export function sectionWouldDisplayAfterRefresh(section: TSection, dashboardSettings: TDashboardSettings): boolean {
  if (!sectionIsVisible(section, dashboardSettings)) return false

  const realCount = countRealSectionItems(section.sectionItems)
  if (realCount > 0) return true

  const sectionCode = section.sectionCode
  // Search empty state always shows a "no results" row
  if (sectionCode === 'SEARCH' || sectionCode === 'SAVEDSEARCH') return true

  // Referenced calendar empties never get congrats
  if (section.isReferenced) return false

  const hideEmptySections = dashboardSettings.hideEmptySections === true
  // Sections that inject congrats / empty messages when hideEmptySections is off
  if (CAN_HAVE_EMPTY_SECTION_MESSAGES.includes(sectionCode)) { return !hideEmptySections }

  // TB, OVERDUE, PRIORITY, Yesterday, etc. hide when empty
  return false
}

/**
 * Count how many sections would render after a load/refresh given current settings (including hideEmptySections).
 * @param {Array<TSection>} sections
 * @param {TDashboardSettings} dashboardSettings
 * @returns {number}
 */
export function countSectionsThatWouldDisplay(sections: Array<TSection>, dashboardSettings: TDashboardSettings): number {
  if (!sections || !dashboardSettings) return 0
  return sections.reduce((total, section) => (sectionWouldDisplayAfterRefresh(section, dashboardSettings) ? total + 1 : total), 0)
}

/**
 * Reduce the useFirst array to include only the visible sections.
 * Filters and returns the prioritized section codes based on visibility settings.
 * @param {Array<TSectionCode>} useFirst - Priority order of sectionCode names to determine retention priority.
 * @param {TDashboardSettings} dashboardSettings - Shared settings to determine visibility of sections.
 * @param {Array<TSection>} sections - The sections to filter.
 * @returns {Array<TSectionCode>} - Filtered and prioritized section codes.
 */
function getUseFirstButVisible(useFirst: Array<TSectionCode>, dashboardSettings: TDashboardSettings, sections: Array<TSection>): Array<TSectionCode> {
  const useFirstButVisible = dashboardSettings
    ? useFirst.filter((sectionCode) => {
      const section = sections.find((section) => section.sectionCode === sectionCode)
      if (section) {
        const isVisible = sectionIsVisible(section, dashboardSettings)
        // logDebug('sectionHelpers', `getUseFirstButVisible useFirstButVisible sectionCode=${sectionCode} isVisible=${isVisible} sectionCode=${sectionCode} section=${section}`)
        return section && isVisible
      } else {
        // TAG sections are a special case, so don't log an error if not found
        // sectionCode !== "TAG" ? logDebug('sectionHelpers/getUseFirstButVisible', `sectionCode=${sectionCode} not found in sections data (if switched off, this is ok)`, sections) : null
        return false
      }
    })
    : useFirst
  // logDebug('sectionHelpers/getUseFirstButVisible', `Visible section codes: ${String(useFirstButVisible)}`)
  // logDebug('sectionHelpers', `getUseFirstButVisible useFirstButVisible`,useFirstButVisible)
  return useFirstButVisible
}

/**
 * Removes duplicate items from sections based on specified fields and prioritizes sections based on a given order.
 * Note: This will be called multiple times for each section being displayed -- for all the other sections, it seems.
 * @param {Array<TSection>} _sections - The sections to filter.
 * @param {Array<string>} paraMatcherFields - The fields (on the underlying para) to match for duplicates.
 * @param {Array<TSectionCode>} useFirst - Priority order of sectionCode names to determine retention priority.
 * @param {Array<TSectionCode>} dontDedupeList - sectionCodes to ignore in this.
 * @param {TDashboardSettings} dashboardSettings - Shared settings to determine visibility of sections.
 * @returns {Array<TSection>} - The sections with duplicates removed according to the rules.
 */
export function getSectionsWithoutDuplicateLines(
  _sections: Array<TSection>,
  paraMatcherFields: Array<string>,
  useFirst: Array<TSectionCode>,
  dontDedupeList: Array<TSectionCode>,
  dashboardSettings: TDashboardSettings,
): Array<TSection> {
  try {
    if (!paraMatcherFields) return _sections
    const startTime = new Date()

    // Deep copy the sections to avoid mutating the original data
    const sections = JSON.parse(JSON.stringify(_sections))

    // Get ordered list of sectionCodes based on visibility and priority
    const useFirstVisibleOnly: Array<TSectionCode> = getUseFirstButVisible(useFirst, dashboardSettings, sections)

    // Create an array of ordered sections based on the `useFirstVisibleOnly` priority list.
    // For each section code (`st`) in `useFirstVisibleOnly`, use `flatMap` to:
    // - Filter the `sections` array to find all sections with a matching `sectionCode`.
    // - Flatten these arrays into a single array of sections.
    // This ensures `orderedSections` contains all sections, ordered by `useFirstVisibleOnly` with duplicates included.
    // because there could be multiples (e.g. TAGs or Today/>Today with the same sectionCode)
    const orderedSections = useFirstVisibleOnly.flatMap((st) => sections.filter((section) => section.sectionCode === st))
    // const totalItemsBeforeDedupe = countTotalSectionItems(orderedSections, dontDedupeList)
    // logDebug('getSectionsWithoutDuplicateLines', `Starting with useFirstVisibleOnly: ${useFirstVisibleOnly.join('-')}  with ${totalItemsBeforeDedupe} items`)

    // Include sections not listed in useFirst at the end of the array
    orderedSections.push(...sections.filter((section) => !useFirst.includes(section.sectionCode)))
    // Map to track unique items
    const itemMap: any = new Map()

    // Now we are working with actual TSection objects, not sectionCodes anymore
    // Process each section (but not if it's a "TB", or Project-type Section, because they have different sorts of items)
    orderedSections.forEach((section) => {
      // logDebug('getSectionsWithoutDuplicateLines', `- Checking section ${section.sectionCode}. Starts with ${section.sectionItems.length} items`)
      if (dontDedupeList.includes(section.sectionCode)) return

      // If the item has a synced line, use the blockId for the key, not the constructed key
      // because we want to delete duplicates that are in different sections of synced lines also
      section.sectionItems = section.sectionItems.filter((item) => {
        let key: string
        if (item.itemType === 'reminder' && item.reminder) {
          // Stable key across TB / REM / DT clones of the same Apple Reminder
          key = item.reminder.id
            ? `reminder:${item.reminder.id}`
            : `reminder:${item.reminder.listname}|${item.reminder.title}|${item.reminder.date || ''}|${item.reminder.time || ''}`
        } else {
          key = item?.para?.content?.match(/\^[a-z0-9]{6}/)?.[0] || paraMatcherFields.map((field) => (item?.para ? item.para[field] : '<no value>')).join('|')
        }

        if (!itemMap.has(key)) {
          itemMap.set(key, true)
          return true
        } else {
          // logInfo('getSectionsWithoutDuplicateLines', `  - Duplicate item ${item.ID}: ${key}`)
        }

        return false
      })
      // logInfo('getSectionsWithoutDuplicateLines', `- ${section.sectionCode} ends with ${section.sectionItems.length} items`) // OK
    })
    const totalItemsAfterDedupe = countTotalSectionItems(orderedSections, dontDedupeList)
    logTimer('getSectionsWithoutDuplicateLines', startTime, ` ${orderedSections.length} sections ${String(orderedSections.map((s) => s.name))} with ${totalItemsAfterDedupe} items`)

    // Return the orderedSections instead of the original sections
    return orderedSections
  } catch (error) {
    logError('getSectionsWithoutDuplicateLines', `Error: ${error}. Returning unchanged sections instead.`)
    return _sections
  }
}

/**
 * Counts the total number of sectionItems in an array of TSection objects.
 * Ignore the dontDedupeList sections
 * @param {Array<TSection>} sections - The array of TSection objects
 * @param {Array<TSectionCode>} ignoreList - array of TSectionCodes
 * @returns {number} The total number of sectionItems
 */
export const countTotalSectionItems = (sections: Array<TSection>, ignoreList: Array<TSectionCode>): number => {
  return sections.filter((section) => !ignoreList.includes(section.sectionCode)).reduce((total, section) => total + section.sectionItems?.length ?? 0, 0)
}

/**
 * Counts the total number of sectionItems in visible sections based on shared settings
 * @param {Array<TSection>} sections - The array of TSection objects
 * @param {TDashboardSettings} dashboardSettings - Shared settings to determine visibility of sections.
 * @returns {number} The total number of visible sectionItems
 */
export const countTotalVisibleSectionItems = (sections: Array<TSection>, dashboardSettings: TDashboardSettings): number => {
  return sections.reduce((total, section) => {
    if (sectionIsVisible(section, dashboardSettings)) {
      return total + section.sectionItems.length
    }
    return total
  }, 0)
}

/**
 * Filters the global allSectionDetails array based on the sectionCode
 * Returns a single section with the matching section code prefix
 * @param {string} thisSectionCode - The section code to filter by.
 * @returns {TSectionDetails} {sectionCode, sectionName, showSettingName}
 */
export function getSectionDetailsFromSectionCode(thisSectionCode: string): TSectionDetails | void {
  const found = allSectionDetails.find((section) => section.sectionCode.startsWith(thisSectionCode))
  if (!found) {
    logDebug('sectionHelpers', `Section code: ${thisSectionCode} not found in allSectionDetails`)
  }
  return found
}

const sectionWithTag = allSectionDetails.filter((s) => s.sectionCode === 'TAG')[0]

/**
 * Get a consistent showSettingName for a given tag.
 * @param {string} tag
 * @returns {string} The setting name.
 */
export function getShowTagSettingName(tag: string): string {
  const showSetting = sectionWithTag.showSettingName
  return `${showSetting}_${tag}`
}

/**
 * Get Section Details for all wanted tags/mentions in settings
 * @param {TDashboardSettings} dashboardSettings
 * @returns {Array<TSectionDetails>} {sectionCode, sectionName, showSettingName}
 */
export function getTagSectionDetails(dashboardSettings: TDashboardSettings): Array<TSectionDetails> {
  const tags = (dashboardSettings.tagsToShow ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '')
  return tags.map((t) => ({ sectionCode: 'TAG', sectionName: t, showSettingName: getShowTagSettingName(t) }))
}

/**
 * Sorts the sections array by sectionCode based on a predefined order and then by sectionName alphabetically.
 * TAG sections are sorted by the order in dashboardSettings.tagsToShow instead of alphabetically.
 * @param {Array<TSection>} sections - The array of sections to be sorted.
 * @param {Array<TSectionCode>} predefinedOrder - The predefined order for sectionCode.
 * @param {?Array<TSectionCode>} customDisplayOrder - Optional custom order. If provided and not empty, this overrides predefinedOrder.
 * @param {?TDashboardSettings} dashboardSettings - Optional dashboard settings to get tagsToShow order for TAG sections.
 * @returns {Array<Section>} The sorted array of sections.
 */
export function sortSections(
  sections: Array<TSection>,
  predefinedOrder: Array<TSectionCode>,
  customDisplayOrder: ?Array<TSectionCode> = [],
  tagsToShowOrder: ?string = '',
): Array<TSection> {
  // logDebug('sectionHelpers/sortSections', `Starting with ${sections.length} sections ${getDisplayListOfSectionCodes(sections)}`)
  
  // Use custom order if provided and not empty, otherwise use predefined order
  const orderToUse = customDisplayOrder && customDisplayOrder.length > 0 ? customDisplayOrder : predefinedOrder
  
  // Get all unique section codes from the actual sections
  const sectionCodesInSections = new Set(sections.map((s) => s.sectionCode))
  
  // Build order map for TAG sections based on tagsToShow order
  const tagOrderMap: { [key: string]: number } = {}
  if (tagsToShowOrder) {
    const tags = (tagsToShowOrder ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '')
    tags.forEach((tag, index) => {
      tagOrderMap[tag] = index
    })
  }

  // Build order map, handling missing sections by appending them
  const orderMap: { [key: string]: number } = {}
  let maxIndex = orderToUse.length
  
  // First, map the order we want to use
  orderToUse.forEach((code: TSectionCode, index: number) => {
    // For TAG sections, we'll handle them as a group, so just mark the position
    if (code === 'TAG' || sectionCodesInSections.has(code)) {
      orderMap[code] = index
    }
  })
  
  // Add any sections that exist but aren't in the order (append to end)
  sections.forEach((section) => {
    const code = section.sectionCode
    if (typeof orderMap[code] === 'undefined') {
      orderMap[code] = maxIndex++
    }
  })
  
  // For TAG sections, all TAG sections should be grouped together
  // Find the TAG position in the order
  const tagPosition = orderToUse.indexOf('TAG')
  const tagPositionInMap = tagPosition >= 0 ? orderMap['TAG'] : maxIndex

  return sections.sort((a, b) => {
    // SEARCH sections always come first
    if (a.sectionCode === 'SEARCH' && b.sectionCode === 'SEARCH') {
      return 0
    }
    if (a.sectionCode === 'SEARCH') {
      return -1
    }
    if (b.sectionCode === 'SEARCH') {
      return 1
    }

    // Handle TAG sections specially - group them together
    if (a.sectionCode === 'TAG' && b.sectionCode === 'TAG') {
      // Sort TAG sections by the order in tagsToShow, falling back to alphabetical if not found
      const orderA = typeof tagOrderMap[a.name] !== 'undefined' ? tagOrderMap[a.name] : Number.MAX_SAFE_INTEGER
      const orderB = typeof tagOrderMap[b.name] !== 'undefined' ? tagOrderMap[b.name] : Number.MAX_SAFE_INTEGER
      if (orderA !== orderB) {
        return orderA - orderB
      }
      // If both are not in tagsToShow (or same order), sort alphabetically
      return a.name.localeCompare(b.name)
    }
    
    if (a.sectionCode === 'TAG') {
      // $FlowIgnore
      const orderB = orderMap[b.sectionCode] ?? maxIndex
      return tagPositionInMap - orderB
    }
    
    if (b.sectionCode === 'TAG') {
      // $FlowIgnore
      const orderA = orderMap[a.sectionCode] ?? maxIndex
      return orderA - tagPositionInMap
    }
    
    // $FlowIgnore
    const orderA = orderMap[a.sectionCode] ?? maxIndex
    // $FlowIgnore
    const orderB = orderMap[b.sectionCode] ?? maxIndex

    if (orderA !== orderB) {
      return orderA - orderB
    }

    // If two sections have the same order and same sectionCode, ensure referenced sections come after non-referenced
    if (a.sectionCode === b.sectionCode) {
      // Non-referenced sections (isReferenced: false) should come before referenced sections (isReferenced: true)
      if (a.isReferenced !== b.isReferenced) {
        return a.isReferenced ? 1 : -1
      }
    }

    // If two sections with the same code (but not TAG or SEARCH), sort them alphabetically by name
    return a.name.localeCompare(b.name)
  })
}
