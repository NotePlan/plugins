// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a search bar in the Header.
// Last updated for v2.2.0.a4
//--------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from 'react'
import './SearchBar.css'

//----------------------------------------------------------------------

type Props = {
  onSearch: (query: string) => void,
}

const SearchBar = ({ onSearch }: Props) => {
  //----------------------------------------------------------------------
  //Refs
  //----------------------------------------------------------------------

  const searchContainerRef = useRef <? HTMLDivElement > (null)

//----------------------------------------------------------------------
// State
//----------------------------------------------------------------------

  const [isActive, setIsActive] = useState(false)
  const [query, setQuery] = useState('')

  //----------------------------------------------------------------------
  // Functions
  //----------------------------------------------------------------------

  const handleIconClick = () => {
    setIsActive(!isActive)
  }

  const handleInputChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  const handleKeyPress = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && onSearch) {
      console.log(`SearchBar: handleKeyPress: Enter key pressed, with query term currently '${query}'`) // OK here
      onSearch(query)
      setIsActive(false)
    }
  }

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target
    if (searchContainerRef.current && target instanceof Node && !searchContainerRef.current.contains(target)) {
      setIsActive(false)
    }
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  // Force the window to be focused on load so that we can capture clicks on hover
  useEffect(() => {
    if (searchContainerRef.current) {
      searchContainerRef.current.focus()
    }
  }, [])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className={`search-container ${isActive ? 'active' : ''}`} ref={searchContainerRef}>
      <input
        type="text"
        className="search-input"
        placeholder="Search..."
        value={query}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        style={{ width: isActive ? '7rem' : '0', opacity: isActive ? '1' : '0' }}
      />
      <div className="search-icon" onClick={handleIconClick}>
        <i className="fa-regular fa-search"></i>
      </div>
    </div>
  )
}

export default SearchBar
