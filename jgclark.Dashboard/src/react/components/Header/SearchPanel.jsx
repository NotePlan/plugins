// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the Search Panel.
// Called by Header component.
// Last updated 2025-02-25 for v2.2.0.a5
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef, useState, type Node } from 'react'
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
  // sectionItems?: Array<TSettingItem>,
  // otherItems: Array<TSettingItem>,
  // handleSwitchChange?: (key: string) => (e: any) => void,
  // handleInputChange?: (key: string, e: any) => void,
  // handleComboChange?: (key: string, e: any) => void,
  // handleSaveInput?: (key: string) => (newValue: string) => void,
  // onSaveChanges: (updatedSettings?: Object) => void,
  // iconClass?: string,
  // className?: string,
  // labelPosition?: 'left' | 'right',
  // isOpen: boolean,
  // toggleMenu: () => void,
  // onSearch: (query: string) => void,
}

//--------------------------------------------------------------------------
// SearchPanel Component Definition
//--------------------------------------------------------------------------

/**
 * SearchPanel component to display toggles and input fields for user configuration.
 * @function
 * @param {SearchPanelProps} props
 * @returns {Node} The rendered component.
 */
function SearchPanel({
  // sectionItems = [],
  // otherItems,
  // handleSwitchChange = (key: string) => (e: any) => { },
  // handleInputChange = (_key, _e) => { },
  // handleComboChange = (_key, _e) => { },
  // handleSaveInput = (key: string) => (newValue: string) => { },
  // onSaveChanges,
  // iconClass = 'fa-solid fa-filter',
  // className = '',
  // labelPosition = 'right',
  // isOpen,
  // toggleMenu,
  // onSearch,
}: SearchPanelProps): Node {
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
  const panelRef = useRef <? HTMLDivElement > (null)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------
  const [changesMade, setChangesMade] = useState(false)
  const [query, setQuery] = useState('')
  const [isActive, setIsActive] = useState(false)

  // const [localSwitchStates, setLocalSwitchStates] = useState < SwitchStateMap > (() => {
  //   const initialStates: SwitchStateMap = {}
  //     ;[...otherItems, ...sectionItems].forEach((item) => {
  //       if (item.type === 'switch' && item.key) {
  //         initialStates[item.key] = item.checked || false
  //       }
  //     })
  //   return initialStates
  // })

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  // const handleFieldChange = (key: string, value: any) => {
  //   logDebug('SearchPanel', `menu:"${className}" Field change detected for ${key} with value ${value}`)
  //   setChangesMade(true)
  //   setLocalSwitchStates((prevStates) => {
  //     const revisedSwitchStates = {
  //       ...prevStates,
  //       [key]: value,
  //     }
  //     logDebug(`SearchPanel: handleFieldChange: ${key} changed to ${value}, revised localSwitchStates`, { revisedSwitchStates })
  //     return revisedSwitchStates
  //   })
  // }

  // const handleSaveChanges = useCallback(
  //   (shouldToggleMenu: boolean = true) => {
  //     logDebug('SearchPanel/handleSaveChanges:', `menu:"${className}"  changesMade = ${String(changesMade)}`)
  //     if (changesMade && onSaveChanges) {
  //       console.log('SearchPanel', `handleSaveChanges: calling onSaveChanges`, { localSwitchStates })
  //       onSaveChanges(localSwitchStates)
  //     }
  //     setChangesMade(false)
  //     if (shouldToggleMenu && isOpen) {
  //       toggleMenu()
  //     }
  //   },
  //   [changesMade, localSwitchStates, onSaveChanges, toggleMenu, isOpen],
  // )

  //   const handleClickOutside = useCallback(
  //     (event: MouseEvent) => {
  //       if (panelRef.current && !panelRef.current.contains((event.target: any))) {
  //         logDebug('SearchPanel', 'Click outside detected')
  //   handleSaveChanges()
  // }
  //     },
  // [handleSaveChanges],
  //   )

  const handleInputChange = (event: SyntheticInputEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      logDebug(`SearchBar: handleKeyDown: Enter key pressed, with query term currently '${query}'`) // OK here
      handleSearch(query)
      setQuery('')
      setIsActive(false)
    } else if (event.key === 'Escape') {
      setQuery('')
      setIsActive(false)
    }
  }

  /**
   * Handles the search event.
   * @param {string} query - The search query.
   */
  const handleSearch = (query: string): void => {
    console.log('Header: handleSearch', `Search query:${query}`) // not OK here
    // Send request to plugin to start a search
    const data = {
      stringToEvaluate: query,
      from: 'searchBar',
    }
    sendActionToPlugin('startSearch', data, 'Search button clicked', false)
  }

  const closeSearchPanel = () => {
    setQuery('')
    setIsActive(false)
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  // Update localSwitchStates from the sectionItems or otherItems only when
  // the menu is closed. This prevents overwriting user toggles while open.
  // useEffect(() => {
  //   if (!isOpen) {
  //     const updatedStates: SwitchStateMap = {}
  //       ;[...otherItems, ...sectionItems].forEach((item) => {
  //         if (item.type === 'switch' && item.key) {
  //           updatedStates[item.key] = item.checked || false
  //         }
  //       })
  //     // Only update state if there is a change
  //     setLocalSwitchStates((prevStates) => {
  //       const hasChanged = Object.keys(updatedStates).some((key) => updatedStates[key] !== prevStates[key])
  //       logDebug(
  //         `SearchPanel: useEffect sectionItems or otherItems changed, updating localSwitchStates`,
  //         {
  //           updatedStates,
  //         },
  //         { prevStates },
  //         { hasChanged },
  //       )
  //       return hasChanged ? updatedStates : prevStates
  //     })
  //   }
  // }, [isOpen, sectionItems, otherItems])

  // Added useEffect to detect when isOpen changes from true to false
  // useEffect(() => {
  //   if (!isOpen && changesMade) {
  //     logDebug('SearchPanel', 'Menu is closing; calling handleSaveChanges')
  //     handleSaveChanges(false) // We pass false to avoid toggling the menu again
  //   }
  // }, [isOpen, changesMade, handleSaveChanges])

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  return (
    <div className="panel">
      {/* <div className="panel-contents"> */}
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
          tabIndex="1" />
        <button
          type="submit"
          className="mainButton HAButton"
          tabIndex="2"
          onClick={() => handleSearch(query)}>
          Search
        </button>
        <i className="fa-regular fa-circle-question"></i>
        {/* TEST: does this work on iOS/iPadOS? */}
        {/* <button type="submit" tabIndex="3"
            onClick={() => closeSearchPanel()}
            className="mainButton">
            Cancel
          </button> */}
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
          <label htmlFor="casesens" className="switch" >
            Case sensitive searching?
          </label>
        </div>
        <div className="controlItem">
          <input className="apple-switch switch-input" type="checkbox" id="fullword" name="fullword" value="fullword" />
          <label htmlFor="fullword" className="switch" >
            Match full words only?
          </label>
        </div>
      </div>
      {/* </div> */}
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
