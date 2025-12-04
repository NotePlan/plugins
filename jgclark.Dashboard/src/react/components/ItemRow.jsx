// @flow
//--------------------------------------------------------------------------
// Represents a row item within a section.
// Could be: Task, Review Item, Filtered Indicator, No Tasks left, No Projects, No Search Results.
// Called by ItemGrid component.
// Last updated 2025-12-04 for v2.3.3, @jgclark
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import ProjectItem from './ProjectItem.jsx'
import TaskItem from './TaskItem.jsx'
import TasksFiltered from './TasksFiltered.jsx'
import MessageOnlyItem from './MessageOnlyItem.jsx'
import { logDebug, logInfo } from '@helpers/react/reactDev'
import './ItemRow.css'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
  onToggleShowAll?: () => void,
}

/**
 * Represents a row item within a section.
 * Loads the proper Component depending on itemType
 * Note: the contentClassName are CSS classes that are used to style the item row, and are defined in ItemRow.css
 */
function ItemRow({ item, thisSection, onToggleShowAll }: Props): Node {
  const { itemType } = item

  let itemCongratsMessage = 'Nothing on this list'
  if (itemType === 'itemCongrats' && thisSection.doneCounts?.completedTasks && thisSection.doneCounts.completedTasks > 0) {
    itemCongratsMessage = `All ${thisSection.doneCounts.completedTasks} items completed on this list`
  }

  // Deal with the different item types, defaulting to a task/checklist at the end
  return (
    <>
      {itemType === 'project' ? (
        <ProjectItem item={item} />
      ) : itemType === 'projectCongrats' ? (
        <MessageOnlyItem message={'No Projects need reviewing: take a break'} contentClassName="projectCongrats" closingFAIconClassName="fa-solid fa-mug" />
      ) : itemType === 'noSearchResults' ? (
            <MessageOnlyItem message={item?.message ?? ''} contentClassName="messageItemRow" settingsDialogAnchor={item?.settingsDialogAnchor ?? ''} />
      ) : itemType === 'preLimitOverdues' ? (
        <MessageOnlyItem
          message={item?.message ?? ''}
                contentClassName="messageItemRow"
          settingsDialogAnchor={item?.settingsDialogAnchor ?? ''}
          rowIconClassName="fa-regular fa-plus"
        />
            ) : (itemType === 'filterIndicator' || itemType === 'offerToFilter') ? (
                <TasksFiltered item={item} onToggleShowAll={onToggleShowAll} />
      ) : itemType === 'itemCongrats' ? (
                    <MessageOnlyItem message={itemCongratsMessage} contentClassName="itemCongrats" closingFAIconClassName="fa-light fa-champagne-glasses pad-left" />
      ) : itemType === 'info' ? (
                    <MessageOnlyItem message={item?.message ?? ''} contentClassName="infoItemRow" />
      ) : (
        <TaskItem item={item} thisSection={thisSection} />
      )}
    </>
  )
}

export default ItemRow
