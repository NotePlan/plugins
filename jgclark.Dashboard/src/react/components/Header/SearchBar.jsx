// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a search bar in the Header.
// Last updated for v2.2.0.a4
//--------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from 'react'
import { logDebug } from '@helpers/react/reactDev'
import './SearchBar.css'

//----------------------------------------------------------------------

type Props = {
  onSearch: (query: string) => void,
}

const SearchBar = ({ onSearch }: Props) => {
  //----------------------------------------------------------------------
  //Refs
  //----------------------------------------------------------------------

  const inputRef = useRef<?HTMLInputElement>(null)

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
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleInputChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && onSearch) {
      logDebug(`SearchBar: handleKeyDown: Enter key pressed, with query term currently '${query}'`) // OK here
      onSearch(query)
      setQuery('')
      setIsActive(false)
    } else if (event.key === 'Escape') {
      setQuery('')
      setIsActive(false)
    }
  }

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target
    if (inputRef.current && target instanceof Node && !inputRef.current.contains(target)) {
      setIsActive(false)
    }
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className={`search-container ${isActive ? 'active' : ''}`}>
      <input
        type="text"
        className="search-input"
        placeholder="Search..."
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        style={{ width: isActive ? '7rem' : '0', opacity: isActive ? '1' : '0' }}
        ref={inputRef}
      />
      <div className="search-icon" onClick={handleIconClick}>
        <i className="fa-regular fa-search"></i>
      </div>
    </div>
  )
}

export default SearchBar
