// @flow
import React from 'react'
import type { ItemRowType } from './flow-types'

/**
 * Represents a single item within a section, displaying its status, content, and actions.
 */
const ItemRow = ({ status, content }: ItemRowType): React$Node => (
  <div className="itemRow">
    <span>{status}</span>
    <span>{content}</span>
  </div>
)

export default ItemRow
