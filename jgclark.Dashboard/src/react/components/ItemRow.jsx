// @flow
//--------------------------------------------------------------------------
// Represents a row item within a section.
// Could be: Task, Review Item, Filtered Indicator, or No Tasks Left
// Last updated 2024-07-03 for v2.0.1 by @jgclark
//--------------------------------------------------------------------------

import {type Node} from 'react'
import type { TSectionItem, TSection } from '../../types.js'
import ProjectItem from './ProjectItem.jsx'
import TaskItem from './TaskItem.jsx'
import TasksFiltered from './TasksFiltered.jsx'
import NoTasks from './NoTasks.jsx'
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
      ) : itemType === 'filterIndicator' ? (
        <TasksFiltered item={item} />
      ) : itemType === 'congrats' ? (
        <NoTasks />
      ) : (
              <TaskItem item={item} thisSection={thisSection} />
      )}
    </>
  )
}

export default ItemRow
