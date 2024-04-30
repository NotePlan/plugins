// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a whole Dashboard Section
// Last updated 22.4.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------
import React from 'react'
import type { TSection, TSectionItem } from '../../types.js'
import CommandButton from './CommandButton.jsx'
import ItemGrid from './ItemGrid.jsx'
import { useAppContext } from './AppContext.jsx'
import { clo } from '@helpers/dev'
import { logDebug, logError } from '@helpers/react/reactDev'

type SectionProps = {
  section: TSection,
}

/**
 * Represents a section within the dashboard, like Today, Yesterday, Projects, etc.
 */
function Section(inputObj: SectionProps): React$Node {
  const thisSection = inputObj.section
  logDebug(`Section`, `csection ${thisSection.sectionType}/${thisSection.ID}${thisSection.sectionFilename} && ${typeof item !== 'undefined' ? item.itemNoteTitle : '<no item>'}`)

  const { reactSettings } = useAppContext()
  try {
    const { section } = inputObj
    const items: Array<TSectionItem> = section.sectionItems
    const { pluginData } = useAppContext()
    const config = pluginData.settings
    // clo(config)

    if (!section || isNaN(section.ID)) {
      throw new Error(`❓Section doesn't exist.`)
    } else if (!section.sectionItems || section.sectionItems.length === 0) {
      if (section.ID !== 0) {
        logDebug('Section', `Section: ${section.ID} / ${section.sectionType} doesn't have any sectionItems, so not displaying.`)
        return
      } else {
        // As there are no items in first section, then add a congratulatory message
        logDebug('Section', `Section 0 doesn't have any sectionItems, so display congrats message`)
        items.push({
          ID: '0-Congrats',
          itemType: 'congrats',
          itemFilename: '',
          itemNoteTitle: '',
          noteType: 'Notes', // for sake of something
          para: {
            filename: '',
            type: 'text', // for sake of something
            content: `Nothing to do: take a break <i class="fa-regular fa-mug"></i>`, // earlier tried fa-party-horn
          },
        })
      }
    } else {
      logDebug(`Section`, `Section: ${section.ID} / ${section.sectionType} with ${section.sectionItems.length} items`)
    }

    // Produce set of actionButtons, if present
    const buttons = section.actionButtons?.map((item, index) => <CommandButton key={index} button={item} />) ?? []

    // Filter down by priority (if desired)
    const filterPriorityItems = reactSettings?.filterPriorityItems ?? false
    let maxPrioritySeen = 0
    for (const i of items) {
      if (i.para?.priority && i.para.priority > maxPrioritySeen) {
        maxPrioritySeen = i.para.priority
      }
    }
    logDebug('Section', `- config.filterPriorityItems = ${String(filterPriorityItems)}, maxPrioritySeen=${String(maxPrioritySeen)}`)
    const filteredItems = filterPriorityItems ? items.filter((f) => (f.para?.priority ?? 0) >= maxPrioritySeen) : items.slice()
    const priorityFilteringHappening = items.length > filteredItems.length
    logDebug('Section', `- After filter, ${String(filteredItems.length)} from ${String(items.length)} items (${String(priorityFilteringHappening)})`)

    // Now sort the items by startTime, then by endTime, then by priority, then title
    // TEST: 12-hour times once I've coded for that in dataGeneration.
    // TODO: can we use an earlier helper here? (This was from Copilot++)
    // logDebug('Section', `- Before sort:\n${JSON.stringify(filteredItems, null, 2)}`)
    filteredItems.sort((a, b) => {
      // Compare by startTime
      if (a.para?.startTime && b.para?.startTime) {
        const startTimeComparison = a.para.startTime.localeCompare(b.para.startTime)
        if (startTimeComparison !== 0) return startTimeComparison
      } else if (a.para?.startTime) {
        return -1
      } else if (b.para?.startTime) {
        return 1
      }

      // Compare by endTime
      if (a.para?.endTime && b.para?.endTime) {
        const endTimeComparison = a.para.endTime.localeCompare(b.para.endTime)
        if (endTimeComparison !== 0) return endTimeComparison
      } else if (a.para?.endTime) {
        return -1
      } else if (b.para?.endTime) {
        return 1
      }

      // Compare by priority
      const priorityA = a.para?.priority ?? 0
      const priorityB = b.para?.priority ?? 0
      if (priorityA !== priorityB) {
        return priorityB - priorityA // Higher priority first
      }

      // Finally, compare by title
      const titleA = a.itemNoteTitle?.toLowerCase() ?? ''
      const titleB = b.itemNoteTitle?.toLowerCase() ?? ''
      return titleA.localeCompare(titleB)
    })
    // logDebug('Section', `- After sort:\n${JSON.stringify(filteredItems, null, 2)}`)

    // Now apply limit (if desired)
    const limit = config?.maxTasksToShowInSection ?? 20
    const itemsToShow = filteredItems.slice(0, limit)
    // Caclculate how many are not shown: not as simple as 'items.length - itemsToShow.length'
    // because there can be a pre-filter in Overdue generation, given by section.totalCount
    const filteredOut = section.totalCount ? section.totalCount - itemsToShow.length : items.length - itemsToShow.length
    const limitApplied = (section.totalCount ?? 0) > itemsToShow.length
    logDebug('Section', `- selected ${itemsToShow.length} visible items, with ${String(filteredOut)} filtered out (and potentially using maxTasksToShowInSection ${String(limit)})`)

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
          type: 'text', // for want of something else
        },
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
          </span>{' '}
          <span className="sectionDescription" dangerouslySetInnerHTML={{ __html: descriptionToUse }}></span>
          {buttons}
        </div>
        <ItemGrid thisSection={inputObj.section} items={itemsToShow} />
      </div>
    )
  } catch (error) {
    logError('Section', `❗️ERROR❗️: ${error.message}`)
  }
}
export default Section
