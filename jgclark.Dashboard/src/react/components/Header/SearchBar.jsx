import React, { useEffect, useRef, useState } from 'react'
import './SearchBar.css'

const SearchBar = ({ onSearch }) => {
  const [isActive, setIsActive] = useState(false)
  const [query, setQuery] = useState('')
  const searchContainerRef = useRef(null)
  const handleIconClick = () => {
    setIsActive(!isActive)
  }

  const handleInputChange = (event) => {
    setQuery(event.target.value)
  }

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && onSearch) {
      console.log(`SearchBar: handleKeyPress: Enter key pressed, with query term currently '${query}'`) // OK here
      onSearch(query)
      setIsActive(false)
    }
  }

  const handleClickOutside = (event) => {
    if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
      setIsActive(false)
    }
  }

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
