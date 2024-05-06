// @flow
import { type TSection } from '../../types.js'

/**
 * Removes duplicates from sections based on specified fields and prioritizes sections based on a given order.
 *
 * @param {Array<TSection>} sections - The sections to filter.
 * @param {Array<string>} paraMatcherFields - The fields (on the underlying para) to match for duplicates
 * @param {Array<SectionCode>} useFirst - Priority order of sectionCode names to determine retention priority
 * @returns {Array<Section>} - The sections with duplicates removed according to the rules.
 * @usage
 */
export function removeDuplicates(_sections: Array<TSection>, paraMatcherFields: Array<string>, useFirst: Array<SectionCode>): Array<TSection> {
  if (!paraMatcherFields) return _sections
  const sections = JSON.parse(JSON.stringify(_sections)) // Deep copy so we don't mutate the original pluginData
  const itemMap = new Map()
  // Prioritize sections according to useFirst
  const orderedSections = useFirst.map((st) => sections.find((section) => section.sectionCode === st)).filter(Boolean)

  // Include sections not listed in useFirst at the end of the array
  orderedSections.push(...sections.filter((section) => !useFirst.includes(section.sectionCode)))

  // Process each section (but not if it's a "PROJ" section)
  orderedSections.forEach((section) => {
    section.sectionItems =
      section.sectionCode === 'PROJ'
        ? section.sectionItems
        : section.sectionItems.filter((item) => {
            const key = paraMatcherFields.map((field) => (item?.para ? item?.para[field] : '<no value>')).join('|')
            if (!itemMap.has(key)) {
              itemMap.set(key, true)
              return true
            }
            return false
          })
  })

  return sections
}
