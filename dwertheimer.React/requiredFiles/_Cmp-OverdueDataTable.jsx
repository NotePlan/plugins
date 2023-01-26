// import {ThemedSelect}
/* global ThemedSelect */

// REACT DATA TABLE COMPONENT:
// https://www.npmjs.com/package/react-data-table-component/v/6.3.5
// RDC styles: https://github.com/jbetancur/react-data-table-component/blob/master/src/DataTable/styles.ts

function OverdueDataTable(props) {
  /**
   * **************************************************
   * resources:
   * click to highlight and select a whole row: https://codesandbox.io/s/react-data-table-row-select-color-example-ppbc5
   */
  //   console.log(`OverdueDataTable: props.data=${JSON.stringify(props.data, null, 2)}`)
  const { columns, overdueParas, title, dropdownOptionsAll, dropdownOptionsLine } = props.data
  // you can send the columns you want in the props, or use the default columns below
  const overdueParasWithKey = overdueParas.map((p, i) => ({ ...p, id: typeof p.id !== 'undefined' ? p.id : i, originalContent: p.content }))
  const columnsWithFallback = columns ?? [
    {
      name: 'Content',
      selectorName: 'content',
      // selector: (row) => row.content,
      sortable: true,
      grow: 3,
    },
    {
      name: 'Status',
      selectorName: 'type',
      omit: true /* for now, lets not show the status column */,
      // selector: (row) => row.type,
      sortable: true,
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
  const colsWithSelectorNameMap = columnsWithFallback.map((c) => ({ ...c, selector: (row) => row[c.selectorName || c.name], grow: c.grow ?? 1 }))

  const rescheduleComponent = <ThemedSelect options={dropdownOptionsLine} onSelect={onDropdownItemSelected} />

  const mainTableColumns = [
    // selector: (row) => row.filename,
    ...colsWithSelectorNameMap,
    {
      name: 'Action',
      cell: (row) => rescheduleComponent,
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
  ]
  const [userSelectedRows, setUserSelectedRows] = React.useState([])
  const [toggleCleared, setToggleCleared] = React.useState(false)
  const [dataTableData, setDataTableData] = React.useState(overdueParasWithKey)
  const [multiDateSelected, setMultiDateSelected] = React.useState({})
  const [editedCell, setEditedCell] = React.useState({})
  //   const [selectedItem, setSelectedItem] = React.useState(overdueParas[0] || null)

  const editableContentUpdated = React.useCallback(({ id, field, value }) => {
    // console.log(`contentUpdated id=${id}, field=${field}, value=${value}`)
    const updatedData = dataTableData.map((item) => {
      if (item.id !== id) {
        return item
      }
      return {
        ...item,
        [field]: value,
      }
    })
    postChanges(updatedData)
    //TODO: send the change to NotePlan but with some kind of debounce
  }, [])

  const postChanges = debounce((value) => {
    setDataTableData(value)
    console.log(`Post changes to NotePlan: ${JSON.stringify(value, null, 2)} ${new Date().toString}`, value)
  }, 1000)

  const handleChangeTEMP = (value) => {
    console.log(`handleChangeTEMP value=${JSON.stringify(value)}`)
    // setValue(value);
  }

  // Wnen the user clicks the down arrow, this component is rendered
  const ExpandedComponent = ({ data: row }) => {
    return (
      <>
        <EditableElement onChange={handleChangeTEMP}>
          <p
            key={row.id}
            field={'content'}
            /* contentEditable={true} */
            onInput={(e) => editableContentUpdated({ id: row.id, field: 'content', value: e.currentTarget.innerHTML })}
            style={{ maxWidth: '100vw', paddingLeft: 112, paddingRight: 50 }}
            onBlur={() => {}}
          >
            {row.content}
          </p>
        </EditableElement>
      </>
    )
  }

  // Filter out duplicates in an array of objects, because onRowSelected was constantly sending back copies of the same row
  //   const uniqueArray = (arr) =>
  //     arr.filter((value, index) => {
  //       const _value = JSON.stringify(value)
  //       return (
  //         index ===
  //         arr.findIndex((obj) => {
  //           return JSON.stringify(obj) === _value
  //         })
  //       )
  //     })

  //   const onRowSelected = React.useCallback(
  //     (state, event) => {
  //       console.log(`onRowSelected state,event`, state, event)
  //       const isMultiSelect = state?.userSelectedRows?.length
  //       console.log(`onRowSelected state?.userSelectedRows`, state?.userSelectedRows)
  //       // state is an object with the following shape: {"allSelected":true,"selectedCount":1,"userSelectedRows":[{"filename":"foo.md","content":"This is come content","priority":"A","type":"open"}]}
  //       if (isMultiSelect) {
  //         const newuserSelectedRows = state?.userSelectedRows || []
  //         setUserSelectedRows(uniqueArray(newuserSelectedRows)) // should make the popup appear
  //         console.log(`onRowSelected, state.userSelectedRows=${JSON.stringify(newuserSelectedRows)}`)
  //         const updatedData = newuserSelectedRows.length
  //           ? dataTableData.map((item) => {
  //               const row = state.userSelectedRows?.find((r) => r.id === item.id)
  //               if (!row) {
  //                 return item
  //               }
  //               console.log(`onRowSelected found matching row`, row)
  //               return {
  //                 ...item,
  //                 toggleSelected: !item.toggleSelected,
  //               }
  //             })
  //           : dataTableData
  //         setDataTableData(updatedData)
  //         return state
  //       } else {
  //         console.log(`onRowSelected, single row clicked.`, state)
  //         return state
  //       }
  //     },
  //     [userSelectedRows],
  //   )

  const onRowSelected = React.useCallback(
    (data, event) => {
      const rowCheckboxChanged = data?.userSelectedRows !== undefined
      const rowWasSingleClicked = event !== undefined && event.type === 'click'
      console.log(
        `onRowSelected rowCheckboxChanged=${rowCheckboxChanged} rowWasSingleClicked=${rowWasSingleClicked} userSelectedRows=${data?.userSelectedRows?.length || 'n/a'}`,
        data,
        event,
      )
      let newuserSelectedRows = []
      if (rowCheckboxChanged) {
        newuserSelectedRows = data.userSelectedRows
        setUserSelectedRows(data.userSelectedRows)
      } else {
        // was a single click
        const row = data
        const wasPreviouslySelected = userSelectedRows.find((s) => s.id === row.id)
        console.log(`onRowSelected wasPreviouslySelected:${wasPreviouslySelected} userSelectedRows,row=`, userSelectedRows, row)
        newuserSelectedRows = wasPreviouslySelected ? userSelectedRows.filter((s) => s.id !== row.id) : [...userSelectedRows, row]
        setUserSelectedRows(newuserSelectedRows)
      }
      const newData = dataTableData.map((item) => ({ ...item, isSelected: newuserSelectedRows.find((r) => r.id === item.id) !== undefined }))
      setDataTableData(newData)
      console.log(`just set setDataTableData to`, newData)
    },
    [userSelectedRows, dataTableData],
  )

  const onRowDoubleClicked = (row, event) => {
    console.log(`onRowDoubleClicked -- for now doing nothing, just expanding`, row, event)
  }

  /*
    Selects
    NOTE: menuPortalTarget={document.body} is required to get the dropdown to expand outside of the div
   */
  const SelectDateForMultiple = (handler) => (
    <ThemedSelect
      options={dropdownOptionsAll}
      onSelect={onDropdownItemSelected}
      /* onChange={onDropdownItemSelected} */
      onChange={(value) => {
        //FIXME I AM HERE
        handler(value)
        // this.setState({ selectedOption2: value.value })
      }}
    />
  )
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

  const MultiSetBar = (props) => {
    return (
      <div id="multisetbar-container" className="w3-panel w3-card w3-animate-top">
        <div style={{ flexGrow: 4 }} className={'w3-cell-row w3-animate-top'}>
          <div style={{ flexGrow: 3, fontSize: 13 }} className={'w3-cell'}>
            {props.rescheduleComponent}
          </div>
          <div style={{ flexGrow: 1 }} className={'w3-cell'}>
            <Button key="set" onClick={props.handler}>
              Set
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const contextActions = React.useMemo(() => {
    console.log(`contextActions userSelectedRows=`, userSelectedRows)
    const multiSetHandler = (event) => {
      console.log(`multiSetHandler event=`, event)
      const isDateSelect = event?.label?.length > 0
      const buttonClicked = event?.buttonClicked ?? false
      if (isDateSelect) {
        setMultiDateSelected(event) // {label: "set to xxx 2021-01-01", value: "2021-01-01"}
      } else if (buttonClicked) {
      }
      const SHOULD_CONFIRM = false
      if (!SHOULD_CONFIRM || window.confirm(`Are you sure you want to hide:\r ${userSelectedRows.map((r) => r.content)}?`)) {
        setToggleCleared(!toggleCleared)
        const newData = dataTableData.filter((item) => !userSelectedRows.includes(item))
        setDataTableData(newData)
      }
    }
    return <MultiSetBar rescheduleComponent={SelectDateForMultiple(multiSetHandler)} handler={multiSetHandler} />
  }, [dataTableData, userSelectedRows, toggleCleared])

  const conditionalRowStyles = [
    {
      when: (row) => row.isSelected,
      style: {
        backgroundColor: 'Khaki',
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
  ]

  const customTableStyles = {
    table: {
      style: {
        maxWidth: '97vw',
      },
    },
    header: {
      style: {
        paddingTop: '10px',
        maxWidth: '97vw',
      },
    },
    pagination: {
      style: {
        maxWidth: '97vw',
      },
    },
    rows: {
      style: {
        minHeight: '72px', // override the row height
      },
    },
    headCells: {
      style: {
        paddingLeft: '8px', // override the cell padding for head cells
        paddingRight: '8px',
      },
    },
    cells: {
      style: {
        paddingLeft: '8px', // override the cell padding for data cells
        paddingRight: '8px',
      },
    },
  }
  return (
    <>
      {/* {SelectedItemComponent} */}
      <div style={{ maxWidth: '100vw', width: '100vw' }}>
        <DataTable
          title={title}
          fixedHeader={true}
          striped
          highlightOnHover
          overflowY={false}
          columns={mainTableColumns}
          data={dataTableData}
          selectableRows
          onuserSelectedRowsChange={onRowSelected /* onRowSelected */}
          /* selectableRowsSingle */
          contextActions={contextActions}
          onRowClicked={onRowSelected}
          onRowDoubleClicked={onRowDoubleClicked}
          clearuserSelectedRows={toggleCleared}
          expandableRows
          expandableRowsComponent={ExpandedComponent}
          expandableRowDisabled={(row) => row.expandDisabled} /** TODO: figure out how to know if we should show the row expander */
          expandOnRowDoubleClicked
          conditionalRowStyles={conditionalRowStyles}
          customStyles={customTableStyles}
          pagination
          /* selectableRowsComponent={Checkbox} */
        />
      </div>
    </>
  )
}

//TODO: move to a separate file
// https://javascript.plainenglish.io/editable-html-in-react-6dd67dd7e302
const EditableElement = (props) => {
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
  return elements
}

const Checkbox = (props) => {
  console.log(`Checkbox props=`, props)
  const { onChange, onClick } = props
  return <input className="w3-check" onChange={onChange} onClick={onClick} type="checkbox" checked="checked" />
}
