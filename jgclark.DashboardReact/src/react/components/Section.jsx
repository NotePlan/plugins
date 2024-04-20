// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a whole Dashboard Section
// Last updated 15.4.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------
import React from 'react'
import type { TSection } from '../../types.js'
import CommandButton from './CommandButton.jsx'
import ItemGrid from './ItemGrid.jsx'
import { useAppContext } from './AppContext.jsx'
import { clo } from '@helpers/dev'

type SectionProps = {
  section: TSection
}

/**
 * Represents a section within the dashboard, like Today, Yesterday, Projects, etc.
 */
function Section(inputObj: SectionProps): React$Node {
  try {
    const { section } = inputObj
    const items = section.sectionItems
    const { pluginData } = useAppContext()
    const config = pluginData.settings
    // clo(config)

    if (!section || !section.ID) {
      throw new Error(`❓Section doesn't exist.`)
    } else if ((!section.sectionItems || section.sectionItems.length === 0)) {
      if (section.ID !== 0) {
        console.log(`Section: ${section.ID} / ${section.sectionType} doesn't have any sectionItems, so not displaying.`)
        return
      } else {
        // As there are no items in first section, then add a congratulatory message
        console.log(`Section 0 doesn't have any sectionItems, so display congrats message`)
        items.push({
          ID: '0-Congrats',
          type: 'congrats',
          content: `Nothing to do: take a break <i class="fa-regular fa-mug"></i>`, // earlier tried fa-party-horn
          rawContent: ``,
          filename: '',
        })
      }
    } else {
      console.log(`Section: ${section.ID} / ${section.sectionType} with ${section.sectionItems.length} items`)
    }

    // Produce set of actionButtons, if present
    const buttons = section.actionButtons?.map((item, index) => (
      <CommandButton key={index} button={item} />
    )) ?? []

    // Filter down by priority (if desired)
    const filterPriorityItems = config?.filterPriorityItems ?? true
    let maxPrioritySeen = 0
    for (const i of items) {
      if ((i.para?.priority) && i.para.priority > maxPrioritySeen) {
        maxPrioritySeen = i.para.priority
      }
    }
    console.log(`- config.filterPriorityItems = ${String(filterPriorityItems)}, maxPrioritySeen=${String(maxPrioritySeen)}`)
    const filteredItems = (filterPriorityItems)
      ? items.filter((f) => (f.para?.priority ?? 0) >= maxPrioritySeen)
      : items.slice()
    const priorityFilteringHappening = (items.length > filteredItems.length)
    console.log(`- After filter, ${String(filteredItems.length)} from ${String(items.length)} items (${String(priorityFilteringHappening)})`)

    // Now apply limit (if desired)
    const limit = config?.maxTasksToShowInSection ?? 20
    const itemsToShow = filteredItems.slice(0, limit)
    // Caclculate how many are not shown: not as simple as 'items.length - itemsToShow.length'
    // because there can be a pre-filter in Overdue generation, given by section.totalCount
    const filteredOut = (section.totalCount)
      ? section.totalCount - itemsToShow.length
      : items.length - itemsToShow.length
    const limitApplied = (section.totalCount > itemsToShow.length)
    console.log(`- selected ${itemsToShow.length} visible items, with ${String(filteredOut)} filtered out (and potentially using maxTasksToShowInSection ${String(limit)})`)

    // Send an extra line if we've applied filtering/limit
    if (filteredOut > 0) {
      itemsToShow.push({
        ID: `${section.ID}-Filter`,
        itemType: 'filterIndicator',
        itemFilename: '',
        noteType: 'Notes',
        para: {
          content: `There are also ${filteredOut} ${priorityFilteringHappening ? 'lower-priority' : ''} items currently hidden`,
          filename: '',
          type: 'text' // for want of something else
        }
      })
    }

    // Insert items count
    let descriptionToUse = section.description
    if (descriptionToUse.includes('{count}')) {
      if (limitApplied) {
        descriptionToUse = descriptionToUse.replace('{count}', `<span id='section${section.ID}Count'}>first ${String(itemsToShow.length)}</span>`)
      } else {
        descriptionToUse = descriptionToUse.replace('{count}', `<span id='section${section.ID}Count'}>${String(itemsToShow.length)}</span>`)
      }
    }
    if (descriptionToUse.includes('{totalCount}')) {
      descriptionToUse = descriptionToUse.replace('{totalCount}', `<span id='section${section.ID}TotalCount'}>${String(filteredOut)}</span>`)
    }

    return (
      <div className="section">
        <div className="sectionInfo">
          <span className={`${section.sectionTitleClass} sectionName`}>
            <i className={`sectionIcon ${section.FAIconClass}`}></i>
            {section.name}
          </span>
          {' '}
          <span className="sectionDescription" dangerouslySetInnerHTML={{ __html: descriptionToUse }}>
          </span>
          {buttons}
        </div>
        <ItemGrid thisSection={inputObj.section} items={itemsToShow} />
      </div>
    )
  } catch (error) {
    console.log(`❗️ERROR❗️: ${error.message}`)
  }
}
export default Section
