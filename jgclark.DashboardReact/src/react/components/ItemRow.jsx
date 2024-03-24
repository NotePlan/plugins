// @flow
import React from 'react'

type Props = {
  status: string,
  content: string,
};

/**
 * Represents a single item within a section, displaying its status, content, and actions.
 */
const ItemRow = ({ status, content }: Props):React$Node => (
  <div className="itemRow">
    <span>{status}</span>
    <span>{content}</span>
  </div>
)

export default ItemRow
