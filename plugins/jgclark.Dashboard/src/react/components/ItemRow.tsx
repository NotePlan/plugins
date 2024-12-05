// @flow
//--------------------------------------------------------------------------
// Represents a row item within a section.
// Could be: Task, Review Item, Filtered Indicator, No Tasks left or No Projects.
// Called by ItemGrid component.
// Last updated for v2.1.0.a
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import NoProjects from './NoProjects.jsx'
import NoTasks from './NoTasks.jsx'
import ProjectItem from './ProjectItem.jsx'
import TaskItem from './TaskItem.jsx'
import TasksFiltered from './TasksFiltered.jsx'
import TimeBlockInfo from './TimeBlockInfo.jsx'
import { logDebug, logInfo } from '@np/helpers/react/reactDev'

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
        <NoProjects />
      ) : itemType === 'filterIndicator' ? (
        <TasksFiltered item={item} />
      ) : itemType === 'itemCongrats' ? (
        <NoTasks />
              // ) : itemType === 'timeblock' ? (
              //   <TimeBlockInfo item={item} thisSection={thisSection} />
      ) : (
        <TaskItem item={item} thisSection={thisSection} />
      )}
    </>
  )
}

export default ItemRow
