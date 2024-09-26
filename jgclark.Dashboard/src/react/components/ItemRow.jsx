// @flow
//--------------------------------------------------------------------------
// Represents a row item within a section.
// Could be: Task, Review Item, Filtered Indicator, No Tasks left or No Projects.
// Called by ItemGrid component.
// Last updated 2024-09-12 for v2.1.0.a10 by @jgclark
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import ProjectItem from './ProjectItem.jsx'
import TaskItem from './TaskItem.jsx'
import TasksFiltered from './TasksFiltered.jsx'
import NoTasks from './NoTasks.jsx'
import NoProjects from './NoProjects.jsx'
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
      {itemType === 'project'
        ? (<ProjectItem item={item} />)
        : itemType === 'projectCongrats'
          ? (<NoProjects />)
          : itemType === 'filterIndicator'
            ? (<TasksFiltered item={item} />)
            : itemType === 'itemCongrats'
              ? (<NoTasks />)
              : (<TaskItem item={item} thisSection={thisSection} />)
      }
    </>
  )
}

export default ItemRow
