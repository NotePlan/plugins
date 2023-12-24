/****************************************************************************************************************************
 *                             WEBVIEW COMPONENT - WITH DATA TABLE
 ****************************************************************************************************************************/
// @flow

type Props = {
  data: any /* passed in from the plugin as globalSharedData */,
  dispatch: Function,
}
/****************************************************************************************************************************
 *                             NOTES
 * WebView should act as a "controlled component", as far as the data from the plugin is concerned.
 * Plugin-related data is always passed in via props, and never stored in state in this component
 *
 * FYI, if you do use state, it is highly recommended when setting state with hooks to use the functional form of setState
 * e.g. setTodos((prevTodos) => [...prevTodos, newTodo]) rather than setTodos([...todos, newTodo])
 * This has cost me a lot of time in debugging stale state issues
 */

/****************************************************************************************************************************
 *                             IMPORTS
 ****************************************************************************************************************************/

import debounce from 'lodash/debounce'
import React, { useEffect, type Node } from 'react'
import DataTable from 'react-data-table-component'
import ThemedSelect from './ThemedSelect.jsx'
import TypeFilter from './TypeFilter.jsx'
import EditableElement from './EditableElement.jsx'
import MultiActionBar from './MultiActionBar.jsx'
// import StatusButton from './StatusButton.jsx'
// import Button from './Button.jsx'
import { columnSpec, conditionalRowStyles, customTableStyles, sortByDaysOverdue } from './dataTableFormatting.jsx'

// color this component's output differently in the console
const consoleStyle = 'background: #222; color: #bada55' //lime green
const logDebug = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, consoleStyle, ...args)
const logSubtle = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, 'color: #6D6962', ...args)
const logTemp = (msg, ...args) => console.log(`${window.webkit ? '' : '%c'}${msg}`, 'background: #fff; color: #000', ...args)

// REACT DATA TABLE COMPONENT:
// https://react-data-table-component.netlify.app/?path=/docs/api-props--page
// https://www.npmjs.com/package/react-data-table-component/v/6.3.5
// RDC styles: https://github.com/jbetancur/react-data-table-component/blob/master/src/DataTable/styles.ts
// Tweaking the styles: https://react-data-table-component.netlify.app/?path=/docs/api-custom-themes--page
// DETAILS: https://github.com/jbetancur/react-data-table-component/blob/master/src/DataTable/styles.ts

/**
 * Root element for the Plugin's React Tree
 * @param {any} data
 * @param {Function} dispatch - function to send data back to the Root Component and plugin
 */
export function WebView({ data, dispatch }: Props): Node {
  /****************************************************************************************************************************
   *                             HOOKS
   ****************************************************************************************************************************/
  const justSelectedRows = React.useRef(false) // used to prevent the selection from being cleared when the user clicks on a row
  logDebug(`Webview: top of render. justSelectedRows:${String(justSelectedRows.current)} data.startingFilter=${data.startingFilter} `)
  const filterValue = React.useRef(data.startingFilter || 'All') // used to maintain value of filter when user makes changes
  const [, setFilter] = React.useState(filterValue.current) // used to cause re-render and hide
  logDebug(`Webview: top of render. filterValue.current:${String(filterValue.current)}`)

  // const scrollTopRef = React.useRef(-1) // used to scroll to the last scrolled position before the table was re-rendered (e.g. for an ExpandedComponent display)
  // logDebug(`Webview: scrollTopRef:${scrollTopRef.current}`)

  // const dataTableScrollRef = useRef(0)

  /****************************************************************************************************************************
   *                             VARIABLES
   ****************************************************************************************************************************/

  // destructure all the startup data we expect from the plugin
  let { overdueParas } = data
  const { title, dropdownOptionsAll, dropdownOptionsLine, contextButtons, debug, autoSelectNext = true, showDaysTilDueColumn = false } = data
  overdueParas = overdueParas.sort(sortByDaysOverdue)
  const nonOmittedRows = overdueParas.filter((row) => !row.omit).filter(rowFilter)
  // const displayRows = [...nonOmittedRows.filter((row) => !row.highlight), ...nonOmittedRows.filter((row) => row.highlight)]
  const displayRows = nonOmittedRows // don't highlight rows for now (we will move them to 'Processed' status instead)

  debug && logDebug(`Webview top level code running with data:`, data)

  logDebug(`WebView top level code running with data:`, 'data')

  // const setNextSelection = React.useCallback(() => {
  //   if (!autoSelectNext) return
  //   const newData = data.overdueParas.map((d) => {
  //     //FIXME: do something with .isSelected here and call it from somewhere
  //     return { ...d, isSelected: newState }
  //   })
  // }, [])

  /****************************************************************************************************************************
   *                             HANDLERS
   ****************************************************************************************************************************/

  /**
   * Send data back to the plugin to update the data in the plugin
   * @param {[command:string,data:any,additionalDetails:string]} param0
   */
  const sendToPlugin = ([command, data, additionalDetails = '']) => {
    if (!command) throw new Error('sendToPlugin: command must be called with a string')
    logDebug(`Webview: sendToPlugin: command:${JSON.stringify(command)} details:${additionalDetails} data:${JSON.stringify(data)}`, command, data, additionalDetails)
    if (!data) throw new Error('sendToPlugin: data must be called with an object')
    dispatch('SEND_TO_PLUGIN', [command, data], `WebView: sendToPlugin: ${String(command)} ${additionalDetails}`)
  }

  /**
   * Write the state data for the table (immediately)
   * We don't know for sure what changes were made during the async wait before this function was called
   * So instead of sending a full object, let's just apply the changes to the existing data
   * So send an array of objects with the changes to overwrite
   * @param { Array<{[string]:mixed}>|{[string]:mixed}} changesToApply - array of objects with just the ID (required) and the fields that you want to change, e.g. [{id: 1, highlight: true}, {id: 2, highlight: false}]
   */
  const updateTableData = (changesToApply: Array<{ [string]: mixed }> | { [string]: mixed }): void => {
    logDebug(`Webview: updateTableData dataToSave:${JSON.stringify(changesToApply || '')}`, changesToApply)
    if (!changesToApply) throw new Error('updateTableData[AfterDebounce]: changesToApply must be called with an array of changes. not:${typeof changesToApply}')
    const changes = Array.isArray(changesToApply) ? changesToApply : [changesToApply]
    let newData = { ...data }
    const tableData = newData.overdueParas
    const historyMsg = `WebView updateTableData sending: ${changes.length} changes to rows: [ ${changes
      .map((c) => {
        const { id, ...rest } = c
        return `${String(id)}=>(${JSON.stringify(rest)})`
      })
      .join(', ')} ]`
    changes.forEach((change) => {
      logDebug(`Webview: updateTableData: change:${JSON.stringify(change)}`, change, data.overdueParas)
      tableData[change.id] = { ...tableData[change.id], ...change }
    })
    newData = addPassthroughVars(newData)
    dispatch('UPDATE_DATA', newData, historyMsg)
  }

  /**
   * Set a row's .highlight to true
   */
  const highlightRow = (rowID, shouldHideAfter) => {
    logDebug(`Webview: highlightRow ${rowID}; shouldHideAfter=${String(shouldHideAfter)} ${shouldHideAfter ? '(set to Processed & hiding)' : ''}`)
    shouldHideAfter ? updateTableData({ id: rowID, overdueStatus: 'Processed' }) : ''
    // updateTableData({ id: rowID, highlight: true })
  }

  // const resetScrollEffect = ({ element, top }) => {
  //   element.current.getScrollableNode().children[0].scrollTop = top
  // }

  /**
   * Add the passthrough variables to the data object that will roundtrip to the plugin and come back in the data object
   * (e.g. lastWindowScrollTop, startingFilter)
   * @param {*} data
   * @returns
   */
  const addPassthroughVars = (data) => {
    const newData = { ...data }
    newData.lastWindowScrollTop = window.scrollY
    newData.startingFilter = filterValue.current
    logDebug(`Webview: addPassthroughVars: lastWindowScrollTop:${newData.lastWindowScrollTop} newData.startingFilter=${newData.startingFilter}`)
    return newData
  }

  /****************************************************************************************************************************
   *                             EFFECTS
   ****************************************************************************************************************************/

  /**
   * Hydrate the data with a key 'id' once at startup, if the data did not come in with one
   */
  useEffect(() => {
    let changes = false
    const tableData = overdueParas.map((p, i) => {
      if (typeof p.id === 'undefined') {
        logDebug(`Webview: add id to data: ${i} ${JSON.stringify(p)}`)
        changes = true
        return { ...p, id: i }
      }
      return p
    })
    if (changes) {
      let newData = { ...data, overdueParas: tableData }
      newData = addPassthroughVars(newData)
      dispatch('UPDATE_DATA', newData, 'WebView: add id to data')
    }
  }, [])

  /**
   * Save scroll position between renders so we can scroll back to it
   * I am solving this in another way by saving the scroll position in the data object but I'm leaving this here for now
   * because I want to figure out why this doesn't work
   * FIXME: THIS DOES NOT WORK. I DON'T GET WHY. THE USEREF ALWAYS RESETS TO -1 WHEN THE DATA CHANGES UPSTREAM
   */
  // useEffect(() => {
  //   const handleScroll = (event, which) => {
  //     if (window.scrollY > 0 && window.scrollY !== scrollTopRef.current) {
  //       // logDebug(`Webview: handleScroll: window.scrollY=${window.scrollY} scrollTopRef=${scrollTopRef.current}`)
  //       scrollTopRef.current = window.scrollY
  //       logDebug(`Webview: handleScroll: dataTableScrollRef=${dataTableScrollRef?.current || ''}`, dataTableScrollRef.current)
  //     }
  //   }

  //   const dataTableEl = document.getElementsByClassName('rdt_TableBody')[0] ?? null

  //   window.addEventListener('scroll', (event) => handleScroll(event, 'window'))
  //   dataTableEl.addEventListener('scroll', (event) => handleScroll(event, 'dataTable'))

  //   return () => {
  //     window.removeEventListener('scroll', handleScroll)
  //   }
  // }, [])

  /**
   * When the data changes, console.log it so we know and scroll the window
   * Fires after components draw
   */
  useEffect(() => {
    if (data?.lastWindowScrollTop !== window.scrollY) {
      debug && logDebug(`Webview: useLayoutEffect: data changed. Scrolling to ${String(data.lastWindowScrollTop)} data.overdueParas=`, data.overdueParas)
      window.scrollTo(0, data.lastWindowScrollTop)
    }
  }, [data])

  /**
   * Some actions should not hide the row after the action is processed (e.g. updating priority)
   */
  const shouldHideAfter = React.useCallback((action) => {
    if (/__p\d__/.test(action)) {
      return false
    }
    return true
  }, [])

  /**
   * Highlight the rows and send the data to the plugin
   * @param {number[]} rowIDs - array of row ids to highlight (and potentially omit)
   * @param {string} action - a string action to send to the plugin to identify this type of action, e.g. 'highlight'
   * @param {any} objectToSend - fully formed object to send to the plugin, e.g. { rows: [xxx], choice: 'yyy'}
   * @param {milliseconds|false} omitAfter - whether to omit the rows from view afterwards (false = don't omit, a number = omit after that many milliseconds)
   */
  const highlightAndSend = React.useCallback(
    (rowIDs, action, objectToSend, omitAfter? = null) => {
      logDebug(`Webview: highlightAndSend rowIds:${rowIDs.toString()} action:${action} omitAfter:${String(omitAfter)} objectToSend=${JSON.stringify(objectToSend)}`)
      rowIDs.forEach((rowID) => highlightRow(rowID, shouldHideAfter(objectToSend.choice))) // highlight the rows immediately
      // do now
      sendToPlugin(['actionDropdown', objectToSend, objectToSend.choice || '']) // send the data to the plugin immediately
      // do later - omit/hide the rows after a brief delay
      // if (typeof omitAfter === 'number') {
      //   // debouncing not working
      //   updateTableDataAfterDebounce(omitAfter)(rowIDs.map((rowID) => ({ id: rowID, omit: true }))) // after n secs, set the .omit property to true for the rows
      // }
    },
    [data],
  )

  /**
   * A single-row dropdown Action menu was selected
   * TODO: combine this one with the multiSetHandler() below
   * DO NOT MOVE THIS FUNCTION: this function has to be up here at the top so it be called in the columns code lower in the code
   * @param {number} rowID
   * @param {{label:string,value:string}} dropdownSelected
   */
  const onDropdownItemSelected = React.useCallback((rowID, itemSelected) => {
    logDebug(`Webview: onDropdownItemSelected: row:${rowID} itemSelected: ${JSON.stringify(itemSelected)}`)
    if (isNaN(rowID)) throw new Error(`rowID is not a number: ${rowID} (${typeof rowID})`)
    if (!itemSelected.value) throw new Error(`itemSelected.value is not defined: ${itemSelected.value} (${typeof itemSelected.value})`)
    const action = itemSelected.value
    if (action !== '-----') {
      const row = data.overdueParas[rowID]
      const dataToSend = { rows: [row], choice: action }
      highlightAndSend([rowID], 'actionDropdown', dataToSend, 1000) //       const dataToSend = { rows: [row], choice: action }
    }
  })

  // Get the selected rows or a single row if it's just a click-expanded row
  const getSelectedItems = React.useCallback((isMulti = true) => data.overdueParas.filter((r) => (isMulti ? r.isSelected && !r.omit : r.isExpanded)), [data])

  /**
   * A multi-row Context Action was selected (either a button click or a dropdown selection)
   */
  const multiSetHandler = React.useCallback(
    (event, info) => {
      logDebug(`Webview: multiSetHandler event=${JSON.stringify(event)} info=${JSON.stringify(info || {})}`, event)
      const isDateSelect = event?.label?.length > 0
      const buttonType = /(.*?)-button/.exec(event)?.[1]
      const buttonClicked = buttonType ? info : false
      logDebug(`Webview: multiSetHandler isDateSelect=${String(isDateSelect)} buttonType=${String(buttonType)} buttonClicked=${String(buttonClicked)}`, event)
      let action = ''
      if (isDateSelect) {
        // setMultiDateSelected(event) // {label: "set to xxx 2021-01-01", value: "2021-01-01"}
        action = event.value
      } else if (buttonClicked !== false) {
        action = contextButtons[buttonClicked].action
      }
      const selectedRows = getSelectedItems(isDateSelect || buttonType === 'multi') // get the selected rows if multicheck or if single if it's expanded
      logDebug(`Webview: multiSetHandler action=${action} selectedRows=${JSON.stringify(selectedRows, null, 2)}`, selectedRows)
      if (action !== '-----' && selectedRows.length > 0) {
        const dataToSend = { choice: action, rows: selectedRows }
        logDebug(`Webview: multiSetHandler dataToSend=${JSON.stringify(dataToSend)}`, dataToSend)
        highlightAndSend(
          selectedRows.map((s) => s.id),
          'actionDropdown',
          dataToSend,
          true,
        )
        // sendToPlugin(['actionDropdown', dataToSend])
        // // set omit to true for all selected rows
        // setdata.overdueParas((prev) => prev.map((item) => ({ ...item, omit: Boolean(selectedRows.find((r) => r.id === item.id)) }))) // clear the selected rows
      } else {
        logDebug(`Webview: multiSetHandler: no action or no selected rows (could be 2nd call to handler)`)
      }
    },
    [data],
  )

  useEffect(() => {
    logDebug(`Webview: EFFECT data.overdueParas changed`, data.overdueParas)
  }, [data])

  const hideRow = (row) => {
    logDebug(`Webview: hideRow rowID=${row.id}`)
    updateTableData([{ id: row.id, omit: true }])
  }

  // you can send the columns you want in the props, or use the default columns below

  const rescheduleComponent = ({ row }) => (
    <ThemedSelect options={dropdownOptionsLine} onSelect={(e) => onDropdownItemSelected} id="multi" onChange={() => logDebug(`Webview: onchange multi`)} />
  )

  /**
   * Convenience map function to
   * Change a line's data in the table and return the entire updated dataTable object
   * @param {number} rowID - the ID of the row to change
   * @param {any} valuesToChange - an object of rows and fields to change
   */
  const getUpdatedRowData = React.useCallback(
    (rowID, valuesToChange: { [string]: mixed }) => {
      if (isNaN(rowID)) return data.overdueParas
      logDebug(`Webview: getUpdatedRowData ${data.overdueParas[0].omit} ${data.overdueParas[1].omit} ${data.overdueParas[2].omit} ${data.overdueParas[3].omit}`)
      return data.overdueParas.map((item) => {
        if (item.id !== rowID) {
          return item
        }
        return {
          ...item,
          ...valuesToChange,
        }
      })
    },
    [data],
  )

  /**
   * Debounce and after [3s] setTableData and send changes to NotePlan
   * @param {string} type - type of change (for processing on the NotePlan side)
   * @param {object} objectToSend - object that will be sent to NotePlan, e.g. { rows: updatedData[id], field}
   * @param {number} delay - delay in ms before sending and writing to table (FIXME: this does not work)
   * NOTE: this field ^^^ will also be used to determine the updates to the table data after the debounce
   *
   */
  // const postChangesAfterDebounce = ((type, objectToSend, delay = 2618) =>
  //   debounce((type, objectToSend) => {
  //     logDebug(`Webview: (back after debounce of ${delay}ms) Post changes to NotePlan: ${type} ${JSON.stringify(objectToSend, null, 2)}`, objectToSend)
  //     setdata.overdueParas((prev) => {
  //       const newState = [...prev]
  //       objectToSend.rows?.forEach((row) => {
  //         newState[row.id] = row
  //       })
  //       return newState
  //     })
  //     // logDebug(`Webview: Post changes to NotePlan: ${JSON.stringify(value, null, 2)} ${new Date().toString}`, value)
  //     sendToPlugin([type, objectToSend])
  //   }, delay))()

  /**
   * Callback to handle a status change from a StatusButton (e.g. click or dropdown)
   * @param {*} rowID
   * @param {*} newStatus
   * @param {*} highlight - highlight the row for a brief time
   * @param {*} delay - delay in ms before writing to table and sending to NotePlan
   */
  const handleTaskStatusChange = React.useCallback(
    (rowID, newStatus, highlight = false, delay = 500) => {
      if (typeof rowID === 'number' && newStatus && data.overdueParas[rowID].type !== newStatus) {
        logDebug(`Webview: WebView::handleTaskStatusChange rowID=${rowID}, newStatus=${newStatus} highlight=${String(highlight)} delay=${delay}`, newStatus)
        // const dataWithOmittedRow = data.overdueParas.map((item) => (item.id !== rowID ? item : { ...item, type: newStatus, omit: true, highlight: false }))
        // setDataTableData((prev) => prev.map((item) => (item.id !== rowID ? item : { ...item, type: newStatus }))) // change the status immediately
        if (highlight) {
          highlightRow(rowID, true)
          // set a row to highlighted for a brief time before debounce takes it out (with .omit=true)
          // setDataTableData((prev) => prev.map((item) => (item.id !== rowID ? item : { ...item, type: newStatus, omit: false, highlight: true })))
        }
        logDebug(`Webview: Calling debounce for 'paragraphUpdate' after delay=${delay}`)
        const changedRow = { ...data.overdueParas[rowID], type: newStatus }
        // const debouncedSendToPlugin = debounce((type, objectToSend) => {
        //   sendToPlugin([type, objectToSend])
        // }, delay)
        // debouncedSendToPlugin('paragraphUpdate', { rows: [changedRow], field: 'type' })
        // sendToPluginAfterDebounce(delay)(['paragraphUpdate', { rows: [changedRow], field: 'type' }, `paragraphUpdate: ${newStatus}`])
        // updateTableDataAfterDebounce(delay)([{ id: rowID, type: newStatus }])
        sendToPlugin(['paragraphUpdate', { rows: [changedRow], field: 'type' }, `paragraphUpdate: ${newStatus}`])
      }
    },
    [data],
  )

  /**
   * Helper function to remove HTML entities from a string
   * @param {*} text
   * @returns
   */
  function decodeHTMLEntities(text) {
    const textArea = document.createElement('textarea')
    textArea.innerHTML = text
    const decoded = textArea.value
    return decoded
  }

  /**
   * Debounce and after [3s] setTableData and send changes to NotePlan
   */
  const editableDebounced = debounce((id, field, value) => {
    sendToPlugin(['paragraphUpdate', { rows: [data.overdueParas[id]], field }, `content: "${value}"`])
  }, 3000)

  /**
   * Update edited content field - this comes from the field itself
   */
  const handleEditableContentChange = React.useCallback(
    ({ id, field, value }) => {
      // updateTableData([{ id, [field]: decodeHTMLEntities(value) }])
      const decodedValue = decodeHTMLEntities(value)
      logDebug(`Webview: contentUpdated (actual edited paragraph.onInput) id=${id}, field=${field}, value=${decodedValue}`)
      data.overdueParas[id][field] = decodedValue
      editableDebounced(id, field, decodedValue)
      // updateTableDataAfterDebounce(3000)([{ id, [field]: decodeHTMLEntities(value) }])
      // sendToPluginAfterDebounce(3500)(['paragraphUpdate', { rows: [data.overdueParas[id]], field }, `paragraphUpdate: ${field}`])
    },
    [data],
  )

  /**
   * The wrapper got a change event. Not sure we need this one, but TBD
   * @param {*} value - is the field value of the edited cell, but we need more info
   */
  const handleEditableWrapperChange = (value) => {
    logDebug(`Webview: handleEditableWrapperChange (EditableElement onChange) value=${JSON.stringify(value)}`)
    // setValue(value);
  }

  //FIXME: i am here. expanded component does not work

  // Wnen the user clicks the down arrow, this component is rendered
  const ExpandedComponent = ({ data: row, handler }) => {
    logDebug(`Webview: ExpandedComponent row=${JSON.stringify(row, null, 2)}`)
    return (
      <div className="expanded-row">
        <div className="w3-cell-row">
          <div className="w3-cell-middle">
            <MultiActionBar contextButtons={contextButtons} handler={handler} rescheduleComponent={rescheduleComponent} buttonType={'context'} />
          </div>
        </div>
        <div className="w3-cell-row">
          <div className="w3-cell spacer" style={{ minWidth: '8px' }}>
            &nbsp;
          </div>
          <div className="w3-cell-middle">Edit:</div>
          <div className="w3-cell">
            <EditableElement onChange={handleEditableWrapperChange}>
              <p
                key={row.id}
                /* contentEditable={true} */
                onInput={(e) => handleEditableContentChange({ id: row.id, field: 'content', value: e.currentTarget.innerHTML })}
                style={{ maxWidth: '100vw', paddingLeft: 30, paddingRight: 50 }}
                onBlur={() => {}}
              >
                {row.content}
              </p>
            </EditableElement>
          </div>
        </div>
        <div className="w3-cell-row expanded-note-details">
          <div className="w3-cell w3-right-align">
            Note: {row.title} (file: {row.filename})
          </div>
        </div>
      </div>
    )
  }
  /****************************************************************************************************************************
   *                             TYPE FILTER
   ****************************************************************************************************************************/
  const handleTypeFilterChange = React.useCallback(({ value }) => {
    logDebug(`WebView:handleTypeFilterChange: ${value}`)
    filterValue ? (filterValue.current = value) : logDebug(`WARNING: WebView:handleTypeFilterChange: filterValue is undefined`)
    setFilter(value)
  }, [])
  // Filter callback for filtering items based on current filterValue
  function rowFilter(row) {
    if (filterValue.current === 'All') {
      return true
    }
    return filterValue.current === row.overdueStatus
  }
  const filterTypes = ['All', 'Overdue', 'LeftOpen', 'Today', 'Processed']
  // use a reducer to count the number of items in each type
  const typeCounts = data.overdueParas.reduce((counts, item) => {
    const type = item.overdueStatus
    counts[type] = counts[type] ? counts[type] + 1 : 1
    return counts
  }, {})
  typeCounts['All'] = data.overdueParas.length
  const filterOptions = filterTypes.map((item) => ({ label: `${item}  (${typeCounts[item] || 0})`, value: item }))
  const selectedOption = filterOptions.find((option) => option.value === filterValue.current)
  const ThisTypeFilter = <TypeFilter options={filterOptions} onChange={handleTypeFilterChange} defaultValue={selectedOption} />

  /**
   * (state-setting helper function) for onSelectionCheck and the multi-select checkboxes
   * given a list of selected rows, update the data table to reflect the selection
   * this is called when the user checks or unchecks a row's multi-select checkbox
   * DBW: has dependency tracking
   * @param {Array} selectedRows
   */
  const updateSelectedItems = React.useCallback(
    (selectedRows) => {
      if (selectedRows !== undefined) {
        // check if this has already been done (to avoid infinite loop in React Render)
        let madeChanges = false
        const isSelectedMap = data.overdueParas.map((item) => selectedRows.find((r) => r.id === item.id) !== undefined)
        // logDebug(`Webview: updateSelectedItems isSelectedMap = ${JSON.stringify(isSelectedMap)}`, isSelectedMap)
        const newData = { ...data }
        const newTableData = newData.overdueParas.map((item) => {
          if (Boolean(item.isSelected) !== Boolean(isSelectedMap[item.id])) {
            madeChanges = true
          }
          return { ...item, isSelected: isSelectedMap[item.id] }
        })
        if (madeChanges) {
          // logDebug(`Webview: updateSelectedItems something changed selectedRows = ${JSON.stringify(selectedRows, null, 2)}`, selectedRows)
          // logDebug(`Webview: updateSelectedItems something changed selectedRows.length=${selectedRows.length}`, selectedRows)
          // setdata.overdueParas((prev) => newData)
          newData.overdueParas = newTableData
          logDebug(`Webview: updateSelectedItems dispatching newData:`, newData)
          newData.lastWindowScrollTop = window.scrollY
          dispatch('UPDATE_DATA', newData, `updateSelectedItems: Selected rows changed to ${isSelectedMap.toString()}}`)
        }
      }
    },
    [data],
  )

  /**
   * (handler) user checks or unchecks a row's multi-select checkbox
   * This is somehow getting called immediately after new content is set in the table and something is selected
   * So it is getting called with a selectedCount of 0, which is wrong and then that causes an update to happen
   * Using this useRef to guard against that. It's weird though. Wish I understood why this is happening.
   * @param {Array} selectedRows
   */
  const onSelectionCheck = React.useCallback(({ allSelected, selectedCount, selectedRows }) => {
    if (selectedCount === 0 && justSelectedRows.current === false) {
      // logDebug(`Webview: Guarding against this ghost call...selectedCountZero ${allSelected} ${selectedCount} ${selectedRows}`, selectedRows)
      justSelectedRows.current = true
      return
    }
    logDebug(`Webview: onSelectionCheck selectedCount=${selectedCount} selectedRows=`, selectedRows)
    updateSelectedItems(selectedRows)
  }, [])

  /**
   * (handler) for onRowSingleClick
   * given a row single-clicked, update the data table to reflect the selection
   * no state-checking going on here because a tap/toggle always will make a change
   * DBW: has dependency tracking
   * @param {Array} selectedRows
   */
  const onRowSingleClick = React.useCallback(
    (row) => {
      logDebug(`Webview: onRowSingleClick row`, row)
      // const newData = data.overdueParas.map((item) => ({ ...item, isSelected: row.id === item.id ? !item.isSelected : item.isSelected }))
      // only allow one expanded at a time
      if (!row.isExpanded) {
        sendToPlugin(['actionDropdown', { rows: [row], choice: '__opentask__' }, `actionDropdown: __opentask__ row ${row.id}`])
      }
      // setdata.overdueParas((prev) => prev.map((item) => ({ ...item, isExpanded: row.id === item.id ? !item.isExpanded : false })))
      let newData = { ...data }
      let newTableData = newData.overdueParas
      newTableData = newTableData.map((item) => ({ ...item, isExpanded: row.id === item.id ? !item.isExpanded : false }))
      newData.overdueParas = newTableData
      newData = addPassthroughVars(newData)
      dispatch('UPDATE_DATA', newData, `onRowSingleClick: Expanded row ${row.id}`)
    },
    [data],
  )

  const onRowDoubleClick = (row, event) => {
    logDebug(`Webview: onRowDoubleClick -- for now doing nothing, just expanding`, row, event)
  }

  /*
    Selects
    NOTE: menuPortalTarget={document.body} is required to get the dropdown to expand outside of the div
   */
  const SelectDateForMultiple = (handler) => {
    return (
      <ThemedSelect
        options={dropdownOptionsAll}
        onSelect={onDropdownItemSelected}
        /* onChange={onDropdownItemSelected} */
        onChange={(value) => {
          handler(value)
        }}
      />
    )
  }

  const SelectDateForSingle = <ThemedSelect options={dropdownOptionsLine} onSelect={onDropdownItemSelected} onChange={onDropdownItemSelected} />

  const keyListener = React.useCallback((event) => {
    const handleKeyDown = (event) => {
      const { key, metaKey, altKey, ctrlKey, shiftKey } = event
      console.log('WebView: keydown event', event)
      if (event.key === 'Escape') {
        // handler('escape')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const multiSelectContextComponent = React.useMemo(() => {
    logDebug(`Webview: multiSelectContextComponent refreshing (data.overdueParas changed)`)
    return (
      <MultiActionBar
        rescheduleComponent={SelectDateForMultiple(multiSetHandler)}
        handler={multiSetHandler}
        contextButtons={contextButtons}
        buttonType={'multi'}
        keyListener={keyListener}
      />
    )
  }, [])

  const mainTableColumns = [
    ...columnSpec({ handleTaskStatusChange, hideRow, showDaysTilDueColumn }),
    {
      name: 'Action',
      cell: (row) =>
        row.isSelected ? '' : <ThemedSelect options={dropdownOptionsLine} onSelect={(e) => onDropdownItemSelected} onChange={(e) => onDropdownItemSelected(row.id, e)} />,
      allowOverflow: true,
      grow: 2,
    },
  ]
  // find the columns item that has defaultSort set to true
  const sortIndexCol = mainTableColumns.findIndex((c) => c.defaultSort) + 1 || 4 // 1-indexed column number

  /****************************************************************************************************************************
   *                             ABANDONED CODE
   ****************************************************************************************************************************/
  /**
   * Save data and send to plugin after a delay
   * (this is a Debounce of the saveAndSendNow function)
   * @param {number} delay - milliseconds to wait before sending
   * @returns {function} - the debounced function
   * // when you call it, put the delay in the first parentheses, and the row changes to send to the `updateTableData` function in the second parentheses
   * @example updateTableDataAfterDebounce(500)(rowIDs.map((rowID) => ({ id: rowID, omit: true }))) // after n secs, set the .omit property to true for these rows
   */
  // const updateTableDataAfterDebounce = React.useCallback((delay) => debounce(updateTableData, delay), [data])

  /**
   * Send data to the plugin after a delay
   * (this is a Debounce of the sendToPlugin function)
   * @param {number} delay - milliseconds to wait before sending
   * @returns {function} - the debounced function
   * // when you call it, put the delay in the first parentheses, and the data to send to the plugin in the second parentheses
   * @example sendToPluginAfterDebounce(500)('highlight', { rows: [xxx], choice: 'yyy'}) // after n secs, send this data to the plugin
   */
  // const sendToPluginAfterDebounce = React.useCallback((delay) => debounce(sendToPlugin, delay), [data])

  /****************************************************************************************************************************
   *                             RENDER
   ****************************************************************************************************************************/

  return (
    <>
      {/* {SelectedItemComponent} */}
      <div style={{ maxWidth: '100vw', width: '100vw' }}>
        <DataTable
          title={
            <div className="w3-row">
              <div className="titleSpan w3-threequarter">{title}</div>
              <div className="w3-quarter">{ThisTypeFilter}</div>
            </div>
          }
          striped
          highlightOnHover
          overflowY={false}
          columns={mainTableColumns}
          defaultSortFieldId={sortIndexCol} // dbw: added defaultSort:true to the column spec
          data={displayRows}
          selectableRows
          onSelectedRowsChange={onSelectionCheck}
          selectableRowSelected={(row) => row.isSelected}
          contextActions={multiSelectContextComponent}
          onRowClicked={onRowSingleClick}
          onRowDoubleClick={onRowDoubleClick}
          expandableRows
          expandableRowExpanded={(row) => row.isExpanded}
          expandableRowsComponent={ExpandedComponent}
          expandableRowDisabled={(row) => row.isSelected} /* TODO: figure out how to know if we should show the row expander */
          expandableRowsComponentProps={{ handler: multiSetHandler }}
          conditionalRowStyles={conditionalRowStyles}
          customStyles={customTableStyles}
          theme="np-theme"
          fixedHeader
          /* selectableRowsSingle */
          /* clearuserSelectedRows={toggleCleared} */
          /* expandonRowDoubleClick */
          /* dense={() => data.overdueParas.length > 10} */
          /* selectableRowsComponent={Checkbox} */
          /* NOTE: fixedHeader and fixedHeaderScrollHeight + pagination cause problems when data changes
          scroll position is frequently not right. could not figure out how to fix it.
          /* fixedHeaderScrollHeight="100vh" /* "calc(100vh - 200px)" */
          /*
          pagination
          paginationPerPage={20}
          paginationRowsPerPageOptions={[10, 20, 30, 40, 50, 100]}
          */
        />
      </div>
    </>
  )
}

// const Checkbox = (props) => {
//   logDebug(`Webview: Checkbox props=`, props)
//   const { onChange, onClick } = props
//   return <input className="w3-check" onChange={onChange} onClick={onClick} type="checkbox" checked="checked" />
// }
