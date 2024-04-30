// TasksFiltered.jsx

// @flow
import * as React from 'react'
import type { TSectionItem } from '../../types.js'

type Props = {
  item: TSectionItem,
}

/**
 * Component for displaying a filter indicator.
 */
const TasksFiltered = ({ item }: Props): React.Node => {
  return (
    <div className="sectionItemRow" id={item.ID}>
      <div className="itemIcon checked">
        <i id={item.ID} className="fa-light fa-plus"></i>
      </div>
      <div className="sectionItemContent sectionItem">
        <a className="content">
          <i>{item?.para?.content || '<no content>'}</i>
        </a>
      </div>
    </div>
  )
}

export default TasksFiltered
