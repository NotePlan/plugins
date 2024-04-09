// @flow
import React from 'react'
import type { TSection } from '../../types.js'
import ItemGrid from './ItemGrid.jsx'
import ThisPeriodAddButtons from './ThisPeriodAddButtons.jsx'
import NextPeriodAddButtons from './NextPeriodAddButtons.jsx'

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
  const { name, sectionType, description, sectionItems, FAIconClass, filename } = section
  return (
    <div className="section">
      <div className="sectionInfo">
        <span className="sidebarDaily sectionName">
          <i className={`sectionIcon ${FAIconClass}`}></i>
          {name}
        </span>{' '}
        <span className="sectionDescription">
          <span id="section0Count">{description}</span>
          {/* TODO: Change this to send buttons as properties? */}
          <span id="section0Buttons">
            {['DT', 'W', 'M'].includes(sectionType) ? <ThisPeriodAddButtons sectionType={sectionType} filename={filename} /> : null}
            {['DT', 'W', 'M'].includes(sectionType) ? <NextPeriodAddButtons sectionType={sectionType} filename={filename} /> : null}
            {/* TODO: other button types */}
          </span>
        </span>
      </div>
      <ItemGrid items={sectionItems} />
    </div>
  )
}

export default Section
