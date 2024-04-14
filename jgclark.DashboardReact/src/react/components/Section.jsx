// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a whole Dashboard Section
// Last updated 13.4.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------
import React from 'react'
import type { TSection } from '../../types.js'
import ItemGrid from './ItemGrid.jsx'
import CommandButton from './CommandButton.jsx'

type SectionProps = {
  section: TSection
}

/**
 * Represents a section within the dashboard, like Today, Yesterday, Projects, etc.
 */
function Section(inputObj: SectionProps): React$Node {
  const { section } = inputObj
  try {
    if (!section || !section.ID) {
      throw new Error(`❓Section doesn't exist.`)
    } else if ((!section.sectionItems || section.sectionItems.length === 0) && section.ID !== 0) {
      console.log(`Section: ${section.ID} / ${section.sectionType} doesn't have any sectionItems, so not displaying.`)
      return
    } else {
      console.log(`Section: ${section.ID} / ${section.sectionType} with ${section.sectionItems.length} items`)
    }

    // Produce set of actionButtons, if present
    const buttons = section.actionButtons?.map((item, index) => (
      <CommandButton key={index} button={item} />
    )) ?? []
    // Insert items count
    const countStr = (section.description.startsWith('{count}'))
      ? String(section.sectionItems.length) + ' '
      : ''
    const descriptionToUse = (section.description.startsWith('{count}'))
      ? section.description.replace('{count}', '')
      : section.description

    return (
      <div className="section">
        <div className="sectionInfo">
          <span className={`${section.sectionTitleClass} sectionName`}>
            <i className={`sectionIcon ${section.FAIconClass}`}></i>
            {section.name}
          </span>{' '}
          <span className="sectionDescription">
            <span id={`section${section.ID}Count`}>{countStr}</span>
            {descriptionToUse} {buttons}
          </span>
        </div>
        <ItemGrid thisSection={inputObj.section} items={section.sectionItems} />
      </div>
    )
  } catch (error) {
    console.log(`❗️ERROR❗️: ${error.message}`)
  }
}
export default Section
