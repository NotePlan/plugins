// @flow
//--------------------------------------------------------------------------
// Represents a row item within a section.
// Could be: Task, Review Item, Filtered Indicator, No Tasks left, No Projects, No Search Results.
// Called by ItemGrid component.
// Last updated for v2.2.0
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import NoTasks from './NoTasks.jsx'
import ProjectItem from './ProjectItem.jsx'
import TaskItem from './TaskItem.jsx'
import TasksFiltered from './TasksFiltered.jsx'
// import TimeBlockInfo from './TimeBlockInfo.jsx'
import MessageOnlyItem from './MessageOnlyItem.jsx'
import { logDebug, logInfo } from '@helpers/react/reactDev'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
}

/**
 * Represents a row item within a section.
 * Loads the proper Component depending on itemType
 */
function ItemRow({ item, thisSection }: Props): Node {
  const { itemType } = item

  return (
    <>
      {itemType === 'project' ? (
        <ProjectItem item={item} />
      ) : itemType === 'projectCongrats' ? (
          <MessageOnlyItem message={"No Projects need reviewing: take a break"} contentClassName="projectCongrats" closingFAIconClassName="fa-solid fa-mug" />
        ) : itemType === 'noSearchResults' ? (
          <MessageOnlyItem message={item?.message ?? ""} contentClassName="noSearchResults" />
      ) : itemType === 'filterIndicator' ? (
        <TasksFiltered item={item} />
            ) : itemType === 'itemCongrats' ? (
                // <NoTasks />
                <MessageOnlyItem message={"Nothing left on this list"} contentClassName="itemCongrats" closingFAIconClassName="fa-light fa-champagne-glasses pad-left" />

              // ) : itemType === 'timeblock' ? (
              //   <TimeBlockInfo item={item} thisSection={thisSection} />
      ) : (
        <TaskItem item={item} thisSection={thisSection} />
      )}
    </>
  )
}

export default ItemRow
