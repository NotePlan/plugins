/* global ThemedSelect */
// Callback to the plugin: runPluginCommand('onMessageFromHTMLView', 'dwertheimer.React', ['ranAPluginCommand', 'green', 'tea'])

// REACT DATA TABLE COMPONENT:
// https://react-data-table-component.netlify.app/?path=/docs/api-props--page
// https://www.npmjs.com/package/react-data-table-component/v/6.3.5
// RDC styles: https://github.com/jbetancur/react-data-table-component/blob/master/src/DataTable/styles.ts
// Tweaking the styles: https://react-data-table-component.netlify.app/?path=/docs/api-custom-themes--page
// DETAILS: https://github.com/jbetancur/react-data-table-component/blob/master/src/DataTable/styles.ts

function OverdueDataTable(props) {
  /**
   * **************************************************
   * resources:
   * click to highlight and select a whole row: https://codesandbox.io/s/react-data-table-row-select-color-example-ppbc5
   */
  const { columns, overdueParas, title, dropdownOptionsAll, dropdownOptionsLine, contextButtons, returnPluginCommand } = props.data

  const overdueParasWithKey = overdueParas.map((p, i) => ({ ...p, id: typeof p.id !== 'undefined' ? p.id : i, originalRawContent: p.rawContent }))

  const [dataTableData, setDataTableData] = React.useState(overdueParasWithKey)
  // const [multiDateSelected, setMultiDateSelected] = React.useState({})
  // const [selectedItems, setSelectedItems] = React.useState(overdueParasWithKey.map((p) => false))
  const [editedCell, setEditedCell] = React.useState([])
  //   const [selectedItem, setSelectedItem] = React.useState(overdueParas[0] || null)

  console.log(`OverdueDataTable: overdueParasWithKey`, overdueParasWithKey)
  // you can send the columns you want in the props, or use the default columns below
  const columnsWithFallback = columns ?? [
    {
      name: 'Type',
      selectorName: 'overdueStatus',
      // selector: (row) => row.type,
      sortable: true,
      width: '80px',
    },
    {
      name: '',
      selectorName: 'type',
      /* omit: true for now, lets not show the status column */
      // selector: (row) => row.type,
      sortable: true,
      width: '50px',
      cell: (row) => <StatusButton rowID={row.id} initialState={row.type} onClick={handleTaskStatusChange} />,
    },
    {
      name: 'Content',
      selector: (row) => row.content,
      sortable: true,
      grow: 3,
      wrap: true,
    },
    {
      name: 'Note Title',
      omit: true /* for now, lets not show the column */,
      selectorName: 'title',
      // selector: (row) => row.title,
      sortable: true,
    },
    {
      name: 'Filename',
      omit: true /* for now, lets not show the column */,
      selectorName: 'filename',
      // selector: (row) => row.title,
      sortable: true,
    },
  ]
  // if we pass in column names, we can't pass through the selector function, so we need to calculate it here
  const colsWithSelectorNameMap = columnsWithFallback.map((c) => ({ ...c, selector: c.selector ?? ((row) => row[c.selectorName || c.name]), grow: c.grow ?? 1 }))

  const mainTableColumns = useMemo(
    () => [
      // selector: (row) => row.filename,
      ...colsWithSelectorNameMap,
      {
        name: 'Action',
        cell: (row) =>
          row.isSelected ? '' : <ThemedSelect options={dropdownOptionsLine} onSelect={(e) => onDropdownItemSelected} onChange={() => console.log(`onchange ${row.id} `)} />,
        allowOverflow: true,
        grow: 2,
      },
      /*
    Add a button :)
    {
      name: 'Poster Button',
      button: true,
      cell: () => <Button>Something</Button>,
    },
    */
    ],
    [],
  )

  const rescheduleComponent = (row) => (
    <ThemedSelect options={dropdownOptionsLine} onSelect={(e) => onDropdownItemSelected} id="multi" onChange={() => console.log(`onchange multi`)} />
  )

  /**
   * Update edited content field - this comes from the field itself
   */
  const handleEditableContentChange = React.useCallback(({ id, field, value }) => {
    console.log(`contentUpdated (actual edited paragraph.onInput) id=${id}, field=${field}, value=${value}`)
    const updatedData = dataTableData.map((item) => {
      if (item.id !== id) {
        return item
      }
      return {
        ...item,
        [field]: value,
      }
    })
    postChangesAfterDebounce('paragraphUpdate', updatedData, { row: updatedData[id], field })
  }, [])

  /**
   * The wrapper got a change event. Not sure we need this one, but TBD
   * @param {*} value - is the field value of the edited cell, but we need more info
   */
  const handleEditableWrapperChange = (value) => {
    console.log(`handleEditableWrapperChange (EditableElement onChange) value=${JSON.stringify(value)}`)
    // setValue(value);
  }

  /**
   * Debounce and after [1s] setTableData and send changes to NotePlan
   * @param {string} type - type of change (for processing on the NotePlan side)
   * @param {object} newTableData - the new table data that will be saved here after debounce
   * @param {object} objectToSend - object that will be sent to NotePlan, e.g. { row: updatedData[id], field}
   */
  const postChangesAfterDebounce = debounce((type, newTableData, objectToSend) => {
    setDataTableData(newTableData)
    console.log(`Post changes to NotePlan: ${type} ${JSON.stringify(objectToSend, null, 2)}`, objectToSend)
    // console.log(`Post changes to NotePlan: ${JSON.stringify(value, null, 2)} ${new Date().toString}`, value)
    sendToPlugin([type, objectToSend])
  }, 3000)

  const handleTaskStatusChange = (rowID, newStatus) => {
    if (typeof rowID === 'number' && newStatus) {
      console.log(`handleTaskStatusChange rowID=${rowID}, newStatus=${newStatus}`)
      const updatedData = dataTableData.map((item) => {
        if (item.id !== rowID) {
          return item
        }
        return {
          ...item,
          type: newStatus,
        }
      })
      postChangesAfterDebounce('paragraphUpdate', updatedData, { rows: [updatedData[rowID]], field: 'type' }, 3000)
    }
  }

  //TODO: move to a separate file
  // https://javascript.plainenglish.io/editable-html-in-react-6dd67dd7e302
  const EditableElement = (props) => {
    console.log(`EditableElement props=`, props)
    const { onChange } = props
    const element = useRef()
    let elements = React.Children.toArray(props.children)
    if (elements.length > 1) {
      throw Error("Can't have more than one child")
    }
    const onMouseUp = () => {
      const value = element.current?.value || element.current?.innerText
      onChange(value)
    }
    useEffect(() => {
      const value = element.current?.value || element.current?.innerText
      onChange(value)
    }, [])
    elements = React.cloneElement(elements[0], {
      contentEditable: true,
      suppressContentEditableWarning: true,
      ref: element,
      onKeyUp: onMouseUp,
    })
    console.log(`EditableElement elements=`, elements)
    return elements
  }

  // Wnen the user clicks the down arrow, this component is rendered
  const ExpandedComponent = ({ data: row, handler }) => {
    console.log(`ExpandedComponent row=${JSON.stringify(row)}`)
    return (
      <div className="expanded-row">
        <div className="w3-cell-row">
          <div className="w3-cell-middle">
            <MultiSetBar contextButtons={contextButtons} handler={handler} rescheduleComponent={rescheduleComponent} buttonType={'context'} />
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
                field={'content'}
                /* contentEditable={true} */
                onInput={(e) => handleEditableContentChange({ id: row.id, field: 'rawContent', value: e.currentTarget.innerHTML })}
                style={{ maxWidth: '100vw', paddingLeft: 30, paddingRight: 50 }}
                onBlur={() => {}}
              >
                {row.rawContent}
              </p>
            </EditableElement>
          </div>
        </div>
      </div>
    )
  }

  /**
   * send runplugin command to NotePlan to process data
   * returnPluginCommand var with {command && id} should be sent in the initial data payload in HTML
   * @param {Array<any>} args to send to NotePlan (typically an array with two items: ["actionName",{an object payload, e.g. row, field, value}])
   * @example sendToPlugin({ choice: action, rows: selectedRows })
   *
   */
  const sendToPlugin = React.useCallback((args) => {
    if (!returnPluginCommand?.command) throw 'returnPluginCommand.cmd is not defined in the intial data passed to the plugin'
    if (!returnPluginCommand?.id) throw 'returnPluginCommand.id is not defined in the intial data passed to the plugin'
    const { command, id } = returnPluginCommand
    runPluginCommand(command, id, args)
  }, [])

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
        console.log(`updateSelectedItems selectedRows = ${JSON.stringify(selectedRows, null, 2)}`, selectedRows)
        let madeChanges = false
        const isSelectedMap = dataTableData.map((item) => selectedRows.find((r) => r.id === item.id) !== undefined)
        const newData = dataTableData.map((item) => {
          if (item.isSelected !== isSelectedMap[item.id]) {
            madeChanges = true
          }
          return { ...item, isSelected: isSelectedMap[item.id] }
        })
        if (madeChanges) {
          setDataTableData(newData)
        }
      }
    },
    [dataTableData],
  )

  /**
   * (handler) user checks or unchecks a row's multi-select checkbox
   * DBW: has dependency tracking
   * @param {Array} selectedRows
   */
  const onSelectionCheck = React.useCallback(
    ({ allSelected, selectedCount, selectedRows }) => {
      console.log(`onSelectionCheck selectedCount=${selectedCount} selectedRows=`, selectedRows)
      updateSelectedItems(selectedRows)
    },
    [dataTableData],
  )

  /**
   * (handler) for onRowSingleClick
   * given a row single-clicked, update the data table to reflect the selection
   * no state-checking going on here because a tap/toggle always will make a change
   * DBW: has dependency tracking
   * @param {Array} selectedRows
   */
  const onRowSingleClick = React.useCallback(
    (row) => {
      console.log(`onRowSingleClick row`, row)
      // const newData = dataTableData.map((item) => ({ ...item, isSelected: row.id === item.id ? !item.isSelected : item.isSelected }))
      const newData = dataTableData.map((item) => ({ ...item, isExpanded: row.id === item.id ? !item.isExpanded : false })) // only allow one expanded at a time
      setDataTableData(newData)
    },
    [dataTableData],
  )

  const onRowDoubleClick = (row, event) => {
    console.log(`onRowDoubleClick -- for now doing nothing, just expanding`, row, event)
  }

  /*
    Selects
    NOTE: menuPortalTarget={document.body} is required to get the dropdown to expand outside of the div
   */
  const SelectDateForMultiple = (handler) => {
    console.log(`SelectDateForMultiple handler=`, handler)
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

  // columns:
  //    cell: row => <CustomTitle row={row} />
  /*
  const CustomTitle = ({ row }) => (
9	<div>
10		{}
11		<div>{row.title}</div>
12		<div>
13			<div
14				data-tag="allowRowEvents"
15				style={{ color: 'grey', overflow: 'hidden', whiteSpace: 'wrap', textOverflow: 'ellipses' }}
16			>
17				{}
18				{row.plot}
19			</div>
20		</div>
21	</div>
22);
*/
  const onDropdownItemSelected = (row, event) => {
    console.log(`onDropdownItemSelected:`, row, event)
  }

  //   const RescheduleLineSelect = ({ row }) => <Select options={dropdownOptionsLine} onSelect={onDropdownItemSelected} />

  const keyListener = React.useCallback((event) => {
    const handleKeyDown = (event) => {
      const { key, metaKey, altKey, ctrlKey, shiftKey } = event
      console.log('keydown event', event)
      if (event.key === 'Escape') {
        handler('escape')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const MultiSetBar = (props) => {
    const { contextButtons, handler, rescheduleComponent, buttonType } = props
    const paddingBetweenElements = '5px'
    const buttonContainerStyle = buttonType === 'multi' ? { flexGrow: 1 } : { paddingLeft: '85px' } // for single, add padding to the left b/c there is no reschedule component
    useEffect(() => keyListener, [])
    return (
      <div
        id="multisetbar-container"
        className="w3-panel w3-card"
        style={{
          paddingTop: '8px',
          paddingBottom: '8px',
          margin: 'inherit',
        }}
      >
        <div style={buttonContainerStyle} className={'w3-cell-row'}>
          {contextButtons?.map((button, i) => (
            <div style={{ flexGrow: 1, paddingLeft: paddingBetweenElements }} className={'w3-cell'} key={i}>
              <Button key={`button${i}`} onClick={() => handler(`${buttonType}-button`, i)} style={{ fontSize: '0.8rem' }}>
                {button.text}
              </Button>
            </div>
          ))}
          {buttonType === 'multi' && (
            <div style={{ flexGrow: 3, paddingLeft: paddingBetweenElements, minWidth: '250px' }} className={'w3-cell'}>
              {rescheduleComponent}
            </div>
          )}
        </div>
      </div>
    )
  }

  const getSelectedItems = React.useCallback((isMulti = true) => dataTableData.filter((r) => (isMulti ? r.isSelected : r.isExpanded)), [dataTableData])

  const multiSetHandler = React.useCallback(
    (event, info) => {
      console.log(`multiSetHandler event=${JSON.stringify(event)} info=${JSON.stringify(info)}`, event)
      const isDateSelect = event?.label?.length > 0
      const buttonType = /(.*?)-button/.exec(event)?.[1]
      const buttonClicked = buttonType ? info : false
      let action = ''
      if (isDateSelect) {
        // setMultiDateSelected(event) // {label: "set to xxx 2021-01-01", value: "2021-01-01"}
        action = event.value
      } else if (buttonClicked !== false) {
        console.log(`multiSetHandler buttonType=${buttonType} buttonClicked=${buttonClicked}`, buttonClicked)
        action = contextButtons[buttonClicked].action
      }
      const selectedRows = getSelectedItems(buttonType === 'multi')
      if (action !== '-----' && selectedRows.length > 0) {
        const dataToSend = { choice: action, rows: selectedRows }
        console.log(`multiSetHandler dataToSend=${JSON.stringify(dataToSend, null, 2)}`, dataToSend)
        sendToPlugin(['actionDropdown', dataToSend])
        setDataTableData(dataTableData.filter((item) => !item.isSelected)) // clear the selected rows
      } else {
        console.log(`multiSetHandler: no action or no selected rows (could be 2nd call to handler)`)
      }
      // const SHOULD_CONFIRM = false
      // if (!SHOULD_CONFIRM || window.confirm(`Are you sure you want to hide:\r ${userSelectedRows.map((r) => r.content)}?`)) {
      //   setToggleCleared(!toggleCleared)
      //   const newData = dataTableData.filter((item) => !userSelectedRows.includes(item))
      //   setDataTableData(newData)
      // }
    },
    [dataTableData],
  )

  const multiSelectContextComponent = React.useMemo(() => {
    console.log(`multiSelectContextComponent RUNNING`)
    return <MultiSetBar rescheduleComponent={SelectDateForMultiple(multiSetHandler)} handler={multiSetHandler} contextButtons={contextButtons} buttonType={'multi'} />
  }, [dataTableData])

  /* NP_THEME
    "base": {
        "backgroundColor": "#1D1E1F",
        "textColor": "#DAE3E8",
        "h1": "#CC6666",
        "h2": "#E9C062",
        "h3": "#E9C062",
        "h4": "#E9C062",
        "tintColor": "#E9C0A2",
        "altColor": "#2E2F30"
    }
*/

  // USE THIS REF:  https://github.com/jbetancur/react-data-table-component/blob/master/src/DataTable/styles.ts

  // definied in the rollup export
  createDataTableTheme(
    'np-theme',
    {
      text: {
        primary: '#268bd2',
        secondary: '#2aa198',
      },
      background: {
        default: NP_THEME.base.backgroundColor,
      },
      context: {
        background: NP_THEME.base.h2,
        text: NP_THEME.base.backgroundColor,
      },
      divider: {
        default: '#073642',
      },
      action: {
        button: 'rgba(0,0,0,.54)',
        hover: 'rgba(0,0,0,.08)',
        disabled: 'rgba(0,0,0,.12)',
      },
    },
    'dark',
  )

  const customTableStyles = {
    table: {
      style: {
        maxWidth: '97vw',
        backgroundColor: NP_THEME.base.backgroundColor,
        marginBottom: '60px', // make sure we can see last row under pagination
      },
    },
    header: {
      style: {
        paddingTop: '10px',
        maxWidth: '97vw',
        backgroundColor: NP_THEME.base.altColor,
        color: NP_THEME.base.textColor,
      },
    },
    pagination: {
      style: {
        maxWidth: '100vw',
        position: 'fixed',
        left: 0,
        bottom: 0,
        backgroundColor: NP_THEME.base.altColor,
        color: NP_THEME.base.textColor,
      },
    },
    rows: {
      style: {
        minHeight: '64px', // override the row height
        backgroundColor: NP_THEME.base.backgroundColor,
        color: NP_THEME.base.textColor,
        border: `1px solid ${chroma(NP_THEME.base.backgroundColor).brighten().css()}`,
      },
      stripedStyle: {
        color: NP_THEME.base.textColor,
        backgroundColor: NP_THEME.base.altColor,
      },
    },
    headCells: {
      style: {
        paddingLeft: '8px', // override the cell padding for head cells
        paddingRight: '8px',
        backgroundColor: NP_THEME.base.backgroundColor,
        color: NP_THEME.base.textColor,
      },
    },
    cells: {
      style: {
        paddingLeft: '8px', // override the cell padding for data cells
        paddingRight: '8px',
      },
    },
    expanderCell: {
      style: {
        backgroundColor: 'transparent' /* FIXME: this will find the cells but won't fix the white box, need to find the theme that's setting the white underneath */,
      },
    },
    expanderRow: {
      style: {
        backgroundColor: 'lightgray',
        color: 'black',
      },
    },
    expanderButton: {
      style: {
        backgroundColor: 'transparent',
        color: NP_THEME.base.textColor,
        fill: NP_THEME.base.textColor,
      },
    },
  }

  const conditionalRowStyles = React.useMemo(
    () => [
      {
        when: (row) => row.isSelected,
        style: {
          backgroundColor: chroma('#ccc').css() /* NP_THEME.base.h1, // 'Khaki', */,
          color: 'black',
        },
      },
      {
        when: (row) => row.priority < 3,
        classNames: ['luke', 'leia'], //You can apply classNames instead or in addition to style:
        style: {
          backgroundColor: 'green',
          color: 'white',
          '&:hover': {
            cursor: 'pointer',
          },
        },
      },
      // You can also pass a callback to style for additional customization
      {
        when: (row) => row.priority < 400,
        style: (row) => ({ backgroundColor: row.isSpecial ? 'pink' : 'inerit' }),
      },
    ],
    [],
  )

  return (
    <>
      {/* {SelectedItemComponent} */}
      <div style={{ maxWidth: '100vw', width: '100vw' }}>
        <DataTable
          title={title}
          fixedHeader
          fixedHeaderScrollHeight="100vh" /* "calc(100vh - 200px)" */
          striped
          highlightOnHover
          overflowY={false}
          columns={mainTableColumns}
          data={dataTableData}
          selectableRows
          onSelectedRowsChange={onSelectionCheck}
          selectableRowSelected={(row) => row.isSelected}
          /* selectableRowsSingle */
          contextActions={multiSelectContextComponent}
          onRowClicked={onRowSingleClick}
          onRowDoubleClick={onRowDoubleClick}
          /* clearuserSelectedRows={toggleCleared} */
          expandableRows
          expandableRowExpanded={(row) => row.isExpanded}
          expandableRowsComponent={ExpandedComponent}
          expandableRowDisabled={(row) => row.isSelected} /* TODO: figure out how to know if we should show the row expander */
          expandonRowDoubleClick
          expandableRowsComponentProps={{ handler: multiSetHandler }}
          conditionalRowStyles={conditionalRowStyles}
          customStyles={customTableStyles}
          pagination
          paginationPerPage={20}
          paginationRowsPerPageOptions={[10, 20, 30, 40, 50, 100]}
          theme="np-theme"
          /* dense={() => dataTableData.length > 10} */
          /* selectableRowsComponent={Checkbox} */
        />
      </div>
    </>
  )
}

const Checkbox = (props) => {
  console.log(`Checkbox props=`, props)
  const { onChange, onClick } = props
  return <input className="w3-check" onChange={onChange} onClick={onClick} type="checkbox" checked="checked" />
}
