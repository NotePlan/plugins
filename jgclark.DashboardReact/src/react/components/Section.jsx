// @flow
import React from 'react'
import type { TSection } from '../../types.js'
import ItemGrid from './ItemGrid.jsx'
import CommandButton from './CommandButton.jsx'

// type Props = {
//   name: string,
//   FAIconClass: string,
//   description: string,
//   sectionType: string,
//   items: Array<SectionItem>,
// }

/**
 * Represents a section within the dashboard, like Today, Yesterday, Projects, etc.
 */
function Section(section: TSection): React$Node {
  const { ID, name, sectionType, description, sectionItems, FAIconClass, sectionTitleClass, filename, actionButtons } = section

  if (!sectionItems) {
    console.log(`❓Section: ${ID} / ${sectionType} doesn't have any sectionItems`)
    return
  } else {
    console.log(`Section: ${ID} / ${sectionType} with ${sectionItems.length} items`)
  }
  // console.log('- actionButtons: ')
  // for (const ab of actionButtons) {
  //   console.log(ab.display)
  // } // ✅

  // Produce set of actionButtons, if present
  const buttons = actionButtons?.map((item, index) => (
    <CommandButton key={index} button={item} filename={filename} />
  )) ?? []

  return (
    <div className="section">
      <div className="sectionInfo">
        <span className={`${sectionTitleClass} sectionName`}>
          <i className={`sectionIcon ${FAIconClass}`}></i>
          {name}
        </span>{' '}
        <span className="sectionDescription">
          <span id={`section${ID}Count`}>{description}</span>
          {buttons}
        </span>
      </div>
      <ItemGrid thisSection={section} items={sectionItems} />
    </div>
  )
}

// {(buttons.length > 0 ?? buttons)}

export default Section
