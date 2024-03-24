// @flow
import React from 'react'
import ItemGrid from './ItemGrid.jsx'

type ItemProps = {
  status: string,
  content: string,
};

type Props = {
  name: string,
  description: string,
  items: Array<ItemProps>,
};

/**
 * Represents a section within the dashboard, like Today, Yesterday, Projects, etc.
 */
const Section = ({ name, description, items }: Props):React$Node => (
  <div className="section">
    <h2>{name}</h2>
    <p>{description}</p>
    <ItemGrid items={items} />
  </div>
)

export default Section
