// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Search Panel.
// Called by Header component.
// Last updated 2025-02-25 for v2.2.0.a5
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, useCallback, type Node } from 'react'
// import type { TSettingItem } from '../../types'
// import { renderItem } from '../support/uiElementRenderHelpers'
import './SearchPanel.css' // Import the CSS file
import { useAppContext } from '../AppContext.jsx'
import { logDebug } from '@helpers/react/reactDev.js'
//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------

/**
 * A map of switch keys to their current boolean state.
 */
// type SwitchStateMap = { [key: string]: boolean }

type SearchPanelProps = {
  /**
   * Callback function to close the search panel
   */
  onClose?: () => void,
}

//--------------------------------------------------------------------------
// SearchPanel Component Definition
//--------------------------------------------------------------------------

/**
 * SearchPanel component to display toggles and input fields for user configuration.
 * @function
 * @param {SearchPanelProps} props - Component props
 * @param {Function} [props.onClose] - Callback function to close the search panel
 * @returns {Node} The rendered component.
 */
function SearchPanel({ onClose }: SearchPanelProps): Node {
  // ----------------------------------------------------------------------
  // Context
  // ----------------------------------------------------------------------
  const {
    // dashboardSettings,
    // dispatchDashboardSettings,
    // pluginData,
    sendActionToPlugin,
  } = useAppContext()

  //----------------------------------------------------------------------
  // Refs
  //----------------------------------------------------------------------
  const panelRef = useRef<?HTMLDivElement>(null)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [changesMade, setChangesMade] = useState(false)
  const [query, setQuery] = useState('')
  const [isActive, setIsActive] = useState(false)

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  const handleInputChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  /**
   * Handles keyboard events for the search input
   * @param {KeyboardEvent} event - The keyboard event
   */
  const handleKeyDown = (event: SyntheticKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      logDebug(`SearchBar: handleKeyDown: Enter key pressed, with query term currently '${query}'`) // OK here
      handleSearch(query)
    } else if (event.key === 'Escape') {
      setQuery('')
      setIsActive(false)
      if (onClose) onClose()
    }
  }

  /**
   * Handles the search event.
   * @param {string} query - The search query.
   */
  const handleSearch = (query: string): void => {
    if (!query.trim()) return

    console.log('Header: handleSearch', `Search query:${query}`) // not OK here
    // Send request to plugin to start a search
    const data = {
      stringToEvaluate: query,
      from: 'searchBar',
    }
    sendActionToPlugin('startSearch', data, 'Search button clicked', false)

    // Reset the query and close the panel
    setQuery('')
    setIsActive(false)
    if (onClose) onClose()
  }

  const closeSearchPanel = () => {
    setQuery('')
    setIsActive(false)
    if (onClose) onClose()
  }

  /**
   * Handles clicks outside the search panel
   */
  const handleClickOutside = useCallback((event: MouseEvent) => {
    // Check if the click target is the search panel button or its children
    const isSearchButton = event.target instanceof Element && event.target.closest('#searchPanelButton') !== null

    // Only close if the click is outside the panel and not on the search button
    if (panelRef.current && !panelRef.current.contains(event.target instanceof Element ? event.target : null) && !isSearchButton) {
      closeSearchPanel()
    }
  }, [])

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  // Focus the search input when the panel becomes visible
  useEffect(() => {
    const searchInput = document.getElementById('searchTerms')
    // Only focus if the panel is visible and the input exists
    if (searchInput) {
      setTimeout(() => {
        // Check again if the element still exists and the panel is open
        const isVisible = document.querySelector('.search-panel-container.open') !== null
        const inputStillExists = document.getElementById('searchTerms')
        if (isVisible && inputStillExists) {
          inputStillExists.focus()
        }
      }, 800) // Delay focus until animation completes (matching the 800ms animation)
    }
  }, [])

  // Add click outside listener
  useEffect(() => {
    // Use mouseup instead of mousedown to better handle the case where the user clicks on the X
    document.addEventListener('mouseup', handleClickOutside)
    return () => {
      document.removeEventListener('mouseup', handleClickOutside)
    }
  }, [handleClickOutside])

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  return (
    <div className="panel" ref={panelRef}>
      <div className="dialogItem">
        {/* Search Terms */}
        <input
          type="text"
          id="searchTerms"
          name="searchTerms"
          className="search-input"
          placeholder="Search terms..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoFocus
          tabIndex="1"
        />
        <button type="submit" className="mainButton HAButton" tabIndex="2" onClick={() => handleSearch(query)}>
          Search
        </button>
        <i className="fa-regular fa-circle-question"></i>
        <button type="button" tabIndex="3" onClick={closeSearchPanel} className="mainButton HAButton">
          Cancel
        </button>
      </div>

      <div className="panel-controls">
        <div className="controlItem">
          <input className="apple-switch switch-input" type="checkbox" name="notetype" id="notes" value="notes" />
          <label htmlFor="notes">Include Regular notes</label>
          {/* TODO: following will normally be hidden by CSS */}
          {/* <span id="noteTypeWarning" className="validationWarning">[Please select at least one!]</span> */}
        </div>
        <div className="controlItem">
          <input className="apple-switch switch-input" type="checkbox" name="notetype" id="calendar" value="calendar" />
          <label htmlFor="calendar">Include Calendar notes</label>
        </div>

        <div className="controlItem">
          <input className="apple-switch switch-input" type="checkbox" name="notetype" id="calendar" value="calendar" />
          <label htmlFor="calendar">Apply Perspective filtering?</label>
        </div>

        <div className="controlItem">
          <input className="apple-switch switch-input" type="checkbox" name="notetype" id="calendar" value="calendar" />
          <label htmlFor="calendar">Include future items?</label>
        </div>

        <div className="controlItem">
          <input className="apple-switch switch-input" type="checkbox" id="casesens" name="casesens" value="casesens" />
          <label htmlFor="casesens" className="switch">
            Case sensitive searching?
          </label>
        </div>
        <div className="controlItem">
          <input className="apple-switch switch-input" type="checkbox" id="fullword" name="fullword" value="fullword" />
          <label htmlFor="fullword" className="switch">
            Match full words only?
          </label>
        </div>
      </div>
      {/* TODO: make this appear when needed. Where? */}
      {/* <div className="info">
        <p>
          <i className="fa-regular fa-circle-question"></i> Searches match on whole words.
          Separate search terms by spaces; surround an exact phrase in double quotes.</p>
        <p>
          Must find: <kbd>+term</kbd><br />
          Must not find in same line: <kbd>-term</kbd><br />
          Must not find in note: <kbd>!term</kbd><br />
        </p>
        <p><a href="https://github.com/NotePlan/plugins/tree/main/jgclark.SearchExtensions/" target="_blank" rel="noreferrer">Open full documentation</a></p>
      </div> */}
    </div>
  )
}

export default SearchPanel
