// @flow
import { type TSection, type TSharedSettings, type TSectionCode, allSectionDetails } from '../../types.js'
import { logDebug } from '@helpers/react/reactDev.js'

/**
 * Gets the visibility setting for a given section code.
 * 
 * @param {TSectionCode} sectionCode - The section code.
 * @param {TSharedSettings} sharedSettings - Shared settings to determine visibility of sections.
 * @returns {boolean} - Whether the section is visible.
 */
const isSectionVisible = (sectionCode: TSectionCode, sharedSettings: TSharedSettings): boolean => {
  if (!sharedSettings) return false
  const thisSection = allSectionDetails.find((section) => section.sectionCode === sectionCode)
  if (!thisSection) {
    logDebug('sectionHelpers', `Section code: ${sectionCode} not found in allSectionDetails`)
    return false
  }
  const settingName = thisSection.showSettingName
  if (!settingName) return true
  const showSetting = sharedSettings[settingName]
  return typeof showSetting === 'undefined' || showSetting === true
}

/**
 * Filters and returns the prioritized section codes based on visibility settings.
 *
 * @param {Array<TSectionCode>} useFirst - Priority order of sectionCode names to determine retention priority.
 * @param {TSharedSettings} sharedSettings - Shared settings to determine visibility of sections.
 * @returns {Array<TSectionCode>} - Filtered and prioritized section codes.
 */
function getUseFirstVisibleOnly(
  useFirst: Array<TSectionCode>,
  sharedSettings: TSharedSettings
): Array<TSectionCode> {
  return sharedSettings ? useFirst.filter((sectionCode) => isSectionVisible(sectionCode, sharedSettings)) : useFirst
}

/**
 * Removes duplicates from sections based on specified fields and prioritizes sections based on a given order.
 *
 * @param {Array<TSection>} _sections - The sections to filter.
 * @param {Array<string>} paraMatcherFields - The fields (on the underlying para) to match for duplicates.
 * @param {Array<TSectionCode>} useFirst - Priority order of sectionCode names to determine retention priority.
 * @param {TSharedSettings} sharedSettings - Shared settings to determine visibility of sections.
 * @returns {Array<TSection>} - The sections with duplicates removed according to the rules.
 */
export function getSectionsWithoutDuplicateLines(
  _sections: Array<TSection>,
  paraMatcherFields: Array<string>,
  useFirst: Array<TSectionCode>,
  sharedSettings: TSharedSettings
): Array<TSection> {
  if (!paraMatcherFields) return _sections
  const sections = JSON.parse(JSON.stringify(_sections)) // Deep copy so we don't mutate the original pluginData

  const useFirstVisibleOnly = getUseFirstVisibleOnly(useFirst, sharedSettings)

  const orderedSections = useFirstVisibleOnly.map((st) =>
    sections.find((section) => section.sectionCode === st)
  ).filter(Boolean)

  // Include sections not listed in useFirst at the end of the array
  orderedSections.push(...sections.filter((section) => !useFirst.includes(section.sectionCode)))

  // Process each section (but not if it's a "PROJ" section)
  const itemMap: Map<string, boolean> = new Map()
  orderedSections.forEach((section) => {
    section.sectionItems =
      section.sectionCode === 'PROJ'
        ? section.sectionItems
        : section.sectionItems.filter((item) => {
            const key = paraMatcherFields.map((field) =>
              item?.para ? item?.para[field] : '<no value>'
            ).join('|')
            if (!itemMap.has(key)) {
              itemMap.set(key, true)
              return true
            }
            return false
          })
  })

  return sections
}

/**
 * Counts the total number of sectionItems in an array of TSection objects
 * @param {Array<TSection>} sections - The array of TSection objects
 * @returns {number} The total number of sectionItems
 */
export const countTotalSectionItems = (sections: Array<TSection>): number => {
  sections.forEach(section => section.sectionItems ? logDebug('sectionHelpers', `countTotalSectionItems ${section.name} has ${section.sectionItems.length} items`) : null)
  return sections.reduce((total, section) => total + section.sectionItems.length, 0)
}

/**
 * Counts the total number of sectionItems in visible sections based on shared settings
 * @param {Array<TSection>} sections - The array of TSection objects
 * @param {TSharedSettings} sharedSettings - Shared settings to determine visibility of sections.
 * @returns {number} The total number of visible sectionItems
 */
export const countTotalVisibleSectionItems = (sections: Array<TSection>, sharedSettings: TSharedSettings): number => {
  return sections.reduce((total, section) => {
    if (isSectionVisible(section.sectionCode, sharedSettings)) {
      logDebug('sectionHelpers', `countTotalVisibleSectionItems ${section.name} is visible and has ${section.sectionItems.length} items`)
      return total + section.sectionItems.length
    }
    return total
  }, 0)
}
