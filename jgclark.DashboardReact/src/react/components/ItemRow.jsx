// @flow
/**
 * ItemRow.jsx
 * Represents a row item within a section.
 * Could be: Task, Review Item, Filtered Indicator, or No Tasks Left
 */
import * as React from 'react'
import type { TSectionItem, TSection } from '../../types.js'
// import { useAppContext } from './AppContext.jsx'
import ReviewItem from './ReviewItem.jsx'
import ItemIcon from './ItemIcon.jsx'
import TasksFiltered from './TasksFiltered.jsx'
import NoTasks from './NoTasks.jsx'
import { logDebug } from '@helpers/react/reactDev'

type Props = {
  item: TSectionItem,
  thisSection: TSection,
}

/**
 * Represents a row item within a section.
 * Loads the proper Component depending on itemType
 */
function ItemRow({ item, thisSection }: Props): React.Node {
  const { itemType } = item

  return (
    <>
      {itemType === 'review' ? (
        <ReviewItem item={item} />
      ) : itemType === 'filterIndicator' ? (
        <TasksFiltered item={item} />
      ) : itemType === 'congrats' ? (
        <NoTasks />
      ) : (
        <ItemIcon item={item} thisSection={thisSection} />
      )}
    </>
  )
}

export default ItemRow
