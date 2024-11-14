// SearchBox.jsx
// @flow

import React, { useState, useCallback } from 'react'

type Props = {
  onSearchChange: (searchText: string) => void,
  onToggleRegex: (useRegex: boolean) => void,
  onToggleExpand: (expandToShow: boolean) => void,
  onToggleFilter: (filter: boolean) => void,
  onReset: () => void,
  useRegex: boolean,
  expandToShow: boolean,
  filter: boolean,
}

/**
 * SearchBox component provides a search input with regex, expand-to-show, filter, and reset options.
 *
 * @param {Props} props - The props for the component.
 * @returns {React.Node} The rendered SearchBox component.
 */
const SearchBox = ({ onSearchChange, onToggleRegex, onToggleExpand, onToggleFilter, onReset, useRegex, expandToShow, filter }: Props): React.Node => {
  const [searchText, setSearchText] = useState('')

  const handleSearchChange = useCallback(
    (e: SyntheticInputEvent<HTMLInputElement>) => {
      const text = e.target.value
      setSearchText(text)
      onSearchChange(text)
    },
    [onSearchChange],
  )

  const toggleButtonStyle = (isActive: boolean) => ({
    backgroundColor: isActive ? '#007bff' : 'unset',
    color: isActive ? '#fff' : '#000',
    border: '1px solid #ccc',
    padding: '2px 5px',
    cursor: 'pointer',
    marginRight: '5px',
    borderRadius: '3px',
  })

  return (
    <div className="search-box" style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
      <input type="text" value={searchText} onChange={handleSearchChange} placeholder="Search or path:key" style={{ marginRight: '5px' }} />
      <button onClick={() => onToggleRegex(!useRegex)} style={toggleButtonStyle(useRegex)}>
        .*
      </button>
      <button onClick={() => onToggleExpand(!expandToShow)} style={toggleButtonStyle(expandToShow)}>
        Expand
      </button>
      <button onClick={() => onToggleFilter(!filter)} style={toggleButtonStyle(filter)}>
        Filter
      </button>
      <button onClick={onReset} style={{ marginLeft: '5px' }}>
        Reset
      </button>
    </div>
  )
}

export default SearchBox
