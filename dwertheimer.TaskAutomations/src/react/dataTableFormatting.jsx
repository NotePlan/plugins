/* global NP_THEME */

import chroma from 'chroma-js'
import { createTheme as createDataTableTheme } from 'react-data-table-component'
import { StatusButton } from './StatusButton.jsx'

// Data Table Styles:
// USE THIS REF:  https://github.com/jbetancur/react-data-table-component/blob/master/src/DataTable/styles.ts

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

const isDark = (bgColor) => chroma(bgColor).luminance() < 0.5
const isLight = (bgColor) => !isDark(bgColor)

const sortByDaysOverdue = (a, b) => a.daysOverdue - b.daysOverdue

/**
 * Calculate a lightly-offset altColor based on the background color
 * Useful for striped rows (default) and highlight on hover
 * @param {string} bgColor
 * @param {number} strength - 0-1 (default 0.2)
 * @returns
 */
const getAltColor = (bgColor, strength = 0.2) => {
  const calcAltFromBGColor = isLight(bgColor) ? chroma(bgColor).darken(strength).css() : chroma(bgColor).brighten(strength).css()
  // if (!altColor || chroma.deltaE(bgColor,altColor) < ) return calcAltFromBGColor
  return calcAltFromBGColor
}

const getMenuStyles = () => {
  return {
    base: {
      backgroundColor: getAltColor(NP_THEME.base.backgroundColor),
      color: getAltColor(NP_THEME.base.textColor),
    },
    hover: {
      backgroundColor: getAltColor(NP_THEME.base.backgroundColor, 0.75),
      color: getAltColor(NP_THEME.base.textColor, 0.75),
      border: '1px solid',
      borderColor: NP_THEME.base.textColor,
    },
    icon: {
      color: getAltColor(NP_THEME.base.textColor, 0.75),
    },
  }
}

const menuStyles = getMenuStyles()

/**
 * Column Definitions
 */

const columnsWithFallback = ({ handleTaskStatusChange, hideRow, showDaysTilDueColumn }) => {
  const base = [
    {
      name: 'Type',
      selectorName: 'overdueStatus',
      // selector: (row) => row.type,
      style: { color: chroma(NP_THEME.editor.textColor).alpha(0.4).css() },
      sortable: true,
      width: '80px',
    },
    {
      name: '',
      selectorName: 'type',
      sortable: true,
      width: '50px',
      cell: (row) => <StatusButton rowID={row.id} initialState={row.type} onStatusChange={handleTaskStatusChange} className={'todo'} menuStyles={menuStyles} />,
    },
    {
      name: 'Content',
      selector: (row) => row.cleanContent,
      sortable: true,
      grow: 3,
      classNames: 'todo',
      wrap: true,
      cell: (row, index, column, id) => (
        <div style={{ fontSize: NP_THEME.base.baseFontSize - 2 }} dangerouslySetInnerHTML={{ __html: row.cleanContent }} data-tag="allowRowEvents" />
      ) /* allow links to be clickable */,
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
    {
      name: 'Hide',
      selectorName: 'hide',
      width: '40px',
      center: true,
      omit: true,
      cell: (row) => <span onClick={() => hideRow(row)}>X</span>,
    },
  ]

  if (showDaysTilDueColumn) {
    base.push({
      name: 'Due in',
      selectorName: 'daysOverdue',
      selector: (row) => (typeof row.daysOverdue === 'number' ? `${row.daysOverdue?.toFixed()}d` : ''),
      sortable: true,
      sortFunction: sortByDaysOverdue,
      defaultSort: true,
    })
  }

  return base
}

// if we pass in column names, we can't pass through the selector function, so we need to calculate it here
const columnSpec = (props) => columnsWithFallback(props).map((c) => ({ ...c, selector: c.selector ?? ((row) => row[c.selectorName || c.name]), grow: c.grow ?? 1 }))

/**
 * Conditional Row Styling/Formatting
 */

const conditionalRowStyles = [
  {
    when: (row) => row.isSelected,
    style: {
      backgroundColor: chroma('#ccc').css() /* NP_THEME.base.h1, // 'Khaki', */,
      color: 'black',
    },
  },
  {
    when: (row) => row.highlight,
    style: {
      backgroundColor: chroma('PaleGreen').alpha(0.5).css() /* NP_THEME.base.h1, // 'Khaki', */,
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
]

const theme = createDataTableTheme(
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
      color: NP_THEME.styles.title1.color,
      fontSize: NP_THEME.styles.title1.size,
      font: NP_THEME.styles.title1.font,
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
      minHeight: '44px', // override the row height
      backgroundColor: NP_THEME.base.backgroundColor,
      color: NP_THEME.base.textColor,
      border: `1px solid ${chroma(NP_THEME.base.backgroundColor).brighten().css()}`,
    },
    stripedStyle: {
      color: NP_THEME.base.textColor,
      backgroundColor: getAltColor(NP_THEME.base.backgroundColor), // calculate stripes rather than relying on NP_THEME.base.altColor,
    },
    highlightOnHoverStyle: {
      backgroundColor: getAltColor(NP_THEME.base.backgroundColor, 0.75),
    },
  },
  headCells: {
    style: {
      paddingLeft: '8px', // override the cell padding for head cells
      paddingRight: '8px',
      backgroundColor: NP_THEME.base.backgroundColor,
      color: NP_THEME.base.h2,
      fontSize: NP_THEME.styles.title3.size - 3,
    },
  },
  cells: {
    style: {
      color: NP_THEME.base.textColor,
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

export { columnSpec, conditionalRowStyles, customTableStyles, menuStyles, sortByDaysOverdue }
