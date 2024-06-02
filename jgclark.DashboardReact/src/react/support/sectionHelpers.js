// @flow
import { type TSection, type TSharedSettings, type TSectionCode, type TSectionDetails } from '../../types.js'
import { allSectionDetails } from "../../constants.js"
import { logDebug, clof } from '@helpers/react/reactDev.js'

const sectionWithTag = allSectionDetails.filter(s => s.sectionCode === 'TAG')[0]

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
 * Gets the visibility setting for a given section code.
 * 
 * @param {TSectionCode} sectionCode - The section code.
 * @param {TSharedSettings} sharedSettings - Shared settings to determine visibility of sections.
 * @returns {boolean} - Whether the section is visible.
 */
const sectionIsVisible = (section:TSection, sharedSettings: TSharedSettings): boolean => {
  const sectionCode: TSectionCode = section.sectionCode
  if (!sharedSettings) return false
  // const thisSection = getSectionDetailsFromSectionCode(sectionCode) // get sectionCode, sectionName, showSettingName
  const settingName = section.showSettingName
  if (!settingName) return true
  // TODO(later): alter this first part of the ternary to do something like startsWitth
  const showSetting = sectionCode === 'TAG' ? sharedSettings[settingName] : sharedSettings[settingName]
  return typeof showSetting === 'undefined' || showSetting === true
}

/**
 * Taskes in a TSection (the full section data) and returns the visibility setting for a given section
 * which may be the showSettingName or in the case of a TAG, will be an amalgamated string
 * @param {TSection} section - The section to get the setting name for.
 * @returns {string} - The setting name.
 */
// export function getSettingName(section:TSection):string {
//   logDebug('sectionHelpers', `getSettingName ${section.sectionCode} ${section.name}`)
//   const settingName = section.showSettingName ?? (getSectionDetailsFromSectionCode(section.sectionCode)?.showSettingName || '')
//   // if (!settingName && section.sectionCode === 'TAG') {
//   //   settingName = section.showSettingName
//   // }
//   return settingName
// }

/**
 * Reduce the useFirst array to include only the visible sections
 * Filters and returns the prioritized section codes based on visibility settings.
 *
 * @param {Array<TSectionCode>} useFirst - Priority order of sectionCode names to determine retention priority.
 * @param {TSharedSettings} sharedSettings - Shared settings to determine visibility of sections.
 * @param {Array<TSection>} sections - The sections to filter.
 * @returns {Array<TSectionCode>} - Filtered and prioritized section codes.
 */
function getUseFirstButVisible(
  useFirst: Array<TSectionCode>,
  sharedSettings: TSharedSettings,
  sections: Array<TSection>
): Array<TSectionCode> {
  return sharedSettings ? 
    useFirst.filter((sectionCode) => sections.find((section) => section.sectionCode === sectionCode) && sectionIsVisible(sectionCode, sharedSettings)) 
  : useFirst
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
  
  // Deep copy the sections to avoid mutating the original data
  const sections = JSON.parse(JSON.stringify(_sections))
  
  // Get ordered sections based on visibility and priority
  // These are just sectionCodes
  const useFirstVisibleOnly:Array<TSectionCode> = getUseFirstButVisible(useFirst, sharedSettings, sections)
  
// Create an array of ordered sections based on the `useFirstVisibleOnly` priority list.
// For each section code (`st`) in `useFirstVisibleOnly`, use `flatMap` to:
// - Filter the `sections` array to find all sections with a matching `sectionCode`.
// - Flatten these arrays into a single array of sections.
// This ensures `orderedSections` contains all sections, ordered by `useFirstVisibleOnly` with duplicates included.
// because there could be multiples (e.g. TAGs or Today/>Today with the same sectionCode)
const orderedSections = useFirstVisibleOnly.flatMap(st =>
    sections.filter(section => section.sectionCode === st)
  )
  
  // Include sections not listed in useFirst at the end of the array
  orderedSections.push(...sections.filter(section => !useFirst.includes(section.sectionCode)))
  // clof(orderedSections, `getSectionsWithoutDuplicateLines orderedSections (length=${orderedSections.length})`,['sectionCode','name'],true)
  // logDebug('Dashboard sectionHelpers', `orderedSections: ${orderedSections.toString()}`)
  
  // Map to track unique items
  const itemMap:any = new Map()
  
  // Now we are working with actual TSection objects, not sectionCodes anymore
  // Process each section (but not if it's a "PROJ" section)
  orderedSections.forEach(section => {
    if (section.sectionCode === 'PROJ') return

    // If the item has a synced line, use the blockId for the key, not the constructed key
    // because we want to delete duplicates that are in different sections of synced lines also
    section.sectionItems = section.sectionItems.filter(item => {
      const key = item?.para?.content?.match(/\^[a-z0-9]{6}/)?.[0] ||
      paraMatcherFields.map(field => item?.para ? item.para[field] : '<no value>').join('|')
          
      if (!itemMap.has(key)) {
        itemMap.set(key, true)
        return true
      }
      
      return false
    })
  })
  
  // Return the orderedSections instead of the original sections
  return orderedSections
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
    if (sectionIsVisible(section, sharedSettings)) {
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
export function getSectionDetailsFromSectionCode(thisSectionCode: string): TSectionDetails|void {
  const found = allSectionDetails.find((section) => section.sectionCode.startsWith(thisSectionCode))
  if (!found) {
    logDebug('sectionHelpers', `Section code: ${thisSectionCode} not found in allSectionDetails`)
  }
  return found
}

/**
 * Get Section Details for all tags in settings
 * @param {TSharedSettings} sharedSettings 
 * @param {TAnyObject} pluginSettings 
 * @returns {Array<TSectionDetails>} {sectionCode, sectionName, showSettingName}
 */
export function getTagSectionDetails(sharedSettings: TSharedSettings, pluginSettings:TAnyObject): Array<TSectionDetails> {
  //   { sectionCode: 'TAG', sectionName: '', showSettingName: `showTagSection` }
  const tags = (sharedSettings.tagToShow ?? pluginSettings.tagToShow ?? '').split(',').map(t => t.trim()).filter(t => t !== '')
  return tags.map(t => ({ sectionCode: "TAG", sectionName: t, showSettingName:getShowTagSettingName(t) }))
}

/**
 * Sorts the sections array by sectionCode based on a predefined order and then by sectionName alphabetically.
 * @param {Array<TSection>} sections - The array of sections to be sorted.
 * @param {Array<string>} order - The predefined order for sectionCode.
 * @returns {Array<Section>} The sorted array of sections.
 */
export function sortSections(sections:Array<TSection>, order:Array<string>):Array<TSection> {
  const orderMap = order.reduce((acc: {[key: string]: number}, code:string, index:number) => {
    acc[code] = index
    return acc
  }, {})

  return sections.sort((a, b) => {
    // $FlowIgnore
    const orderA = orderMap[a.sectionCode]
    // $FlowIgnore
    const orderB = orderMap[b.sectionCode]

    if (orderA !== orderB) {
      return orderA - orderB
    }

    return -(a.name.localeCompare(b.name))
  })
}