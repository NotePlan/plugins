// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a search bar in the Header.
// Last updated 2025-03-31 for v2.2.0.a10
//--------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from 'react'
import { logDebug } from '@helpers/react/reactDev'
import './SearchBar.css'

//----------------------------------------------------------------------

type Props = {
  onSearch: (query: string) => void,
}

const SearchBar = ({ onSearch }: Props): React$Node => {
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
      // logDebug(`SearchBar: handleKeyDown: Enter key pressed, with query term currently '${query}'`)
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
    <search className={`${isActive ? 'active' : ''}`}>
      <input
        type="search"
        className="search-input"
        placeholder="Search terms"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        style={{ width: isActive ? '15ch' : '0', opacity: isActive ? '1' : '0' }}
        ref={inputRef}
      />
      <button className="buttonsWithoutBordersOrBackground" onClick={handleIconClick} title="Search">
        <i className="fa-solid fa-search"></i>
      </button>
    </search>
  )
}

export default SearchBar
