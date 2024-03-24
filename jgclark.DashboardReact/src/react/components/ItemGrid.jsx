// @flow
import React from 'react'
import ItemRow from './ItemRow.jsx' 

type Props = {
  items: Array<{
    status: string,
    content: string,
  }>,
};

/**
 * A grid layout for items within a section.
 */
const ItemGrid = ({ items }: Props):React$Node => (
  <div className="itemGrid">
    {items.map((item, index) => (
      <ItemRow key={index} {...item} />
    ))}
  </div>
)

export default ItemGrid
