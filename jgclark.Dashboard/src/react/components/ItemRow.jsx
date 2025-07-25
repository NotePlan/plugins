// @flow
//--------------------------------------------------------------------------
// Represents a row item within a section.
// Could be: Task, Review Item, Filtered Indicator, No Tasks left, No Projects, No Search Results.
// Called by ItemGrid component.
// Last updated 2025-07-22 for v2.3.0.b, @jgclark
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import ProjectItem from './ProjectItem.jsx'
import TaskItem from './TaskItem.jsx'
import TasksFiltered from './TasksFiltered.jsx'
import MessageOnlyItem from './MessageOnlyItem.jsx'
import { logDebug, logInfo } from '@helpers/react/reactDev'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
}

/**
 * Represents a row item within a section.
 * Loads the proper Component depending on itemType
 * Note: the contentClassName are CSS classes that are used to style the item row, and are defined in Section.css
 */
function ItemRow({ item, thisSection }: Props): Node {
  const { itemType } = item

  let congratsMessage = 'Nothing on this list'
  if (itemType === 'itemCongrats' && thisSection.doneCounts?.completedTasks && thisSection.doneCounts.completedTasks > 0) {
    congratsMessage = `All ${thisSection.doneCounts.completedTasks} items completed on this list`
  }

  // Deal with the different item types, defaulting to a task/checklist at the end
  return (
    <>
      {itemType === 'project' ? (
        <ProjectItem item={item} />
      )
        : itemType === 'projectCongrats' ? (
          <MessageOnlyItem message={'No Projects need reviewing: take a break'}
            contentClassName="projectCongrats"
            closingFAIconClassName="fa-solid fa-mug" />
        )
          : itemType === 'noSearchResults' ? (
            <MessageOnlyItem message={item?.message ?? ''}
              contentClassName="noSearchResults"
              settingsDialogAnchor={item?.settingsDialogAnchor ?? ''} />
          )
            : itemType === 'preLimitOverdues' ? (
              <MessageOnlyItem message={item?.message ?? ''}
                contentClassName="noSearchResults"
                settingsDialogAnchor={item?.settingsDialogAnchor ?? ''}
                rowIconClassName="fa-regular fa-plus" />
            )
              : itemType === 'filterIndicator' ? (
                <TasksFiltered item={item} />
              )
                : itemType === 'itemCongrats' ? (
                  <MessageOnlyItem message={congratsMessage}
                    contentClassName="itemCongrats"
                    closingFAIconClassName="fa-light fa-champagne-glasses pad-left" />
                )
                  : itemType === 'info' ? (
                    <MessageOnlyItem message={item?.message ?? ''}
                      contentClassName="infoItem" />
                  )
                    : (
                      <TaskItem item={item} thisSection={thisSection} />
                    )}
    </>
  )
}

export default ItemRow
