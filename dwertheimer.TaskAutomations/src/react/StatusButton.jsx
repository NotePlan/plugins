/**
 * Button to cycle through states
 * Props:
 * @param {string} initialState  - e.g. "open"
 * @param {function} onStatusChange - function to call (will send (rowID, newState)))
 * @param {number} rowID - rowID of the row
 * @param {object} style - style object
 * @param {boolean} showText - whether to show the text of the state underneath the icon (default: false)
 * @param {boolean} dropdown - whether to show the dropdown of all the choices (or simply cycle thru them) - (default:true)
 * @param {number} delayOnSimpleClick - how long to wait before changing the state if the user clicks on the button (default: 3000) - should be longer than the delayOnDropdownClick because you want to wait to see if they will click more than once
 * @param {number} delayOnDropdownClick - how long to wait before changing the state if the user clicks on the dropdown (default: 500)
 *
 * Per Eduard, use the app "Glyphs Mini" to open the font
 */
const states = [
  { type: 'open', icon: '*', class: 'noteplanstate' },
  { type: 'done', icon: 'a', class: 'noteplanstate' },
  { type: 'scheduled', icon: 'b', class: 'noteplanstate' },
  { type: 'cancelled', icon: 'c', class: 'noteplanstate' },
  { type: 'list', icon: '-', class: 'noteplanstate' },
  { type: 'checklist', icon: '+', class: 'noteplanstate' },
  { type: 'checklistDone', icon: 'd', class: 'noteplanstate' },
  { type: 'checklistCancelled', icon: 'e', class: 'noteplanstate' },
  { type: 'checklistScheduled', icon: 'f', class: 'noteplanstate' },
]

export const StatusButton = ({
  initialState,
  onStatusChange,
  rowID,
  menuStyles /* base, hover, icon props */,
  showText,
  dropdown = true,
  showScheduledOptions = false,
  delayOnSimpleClick = 3000,
  delayOnDropdownClick = 300,
  className,
}) => {
  // let upper = letter.toUpperCase();

  const [currentState, setCurrentState] = useState(states.find((s) => s.type === initialState))

  if (!currentState) {
    throw `StatusButton: No state found for row:${rowID} ${initialState}`
    return false
  }
  const handleClick = (event, rowIndex, newState) => {
    const wasSimpleClick = Boolean(!newState) // simeple click if just clicking on the state. not using the dropdown
    console.log(`StatusButton: handleClick: wasSimpleClick=${wasSimpleClick || ''} rowID=${rowID || ''}, newState=${newState || ''}`, rowID, newState)
    let nextIndex
    if (wasSimpleClick) {
      nextIndex = (states.indexOf(currentState) + 1) % states.length
    } else {
      nextIndex = states.findIndex((s) => s.type === newState)
    }
    console.log(`StatusButton: handleClick: rowID=${rowID}, setting state from ${currentState.type} to: ${states[nextIndex].type}`)
    setCurrentState(states[nextIndex])
    // onStatusChange: rowID, newState, highlight, delay

    onStatusChange(rowID, states[nextIndex].type, wasSimpleClick ? false : true, wasSimpleClick ? delayOnSimpleClick : delayOnDropdownClick) // if was a simple click, wait to see if they click again, but if not,
    event.preventDefault() // cancel the click
  }

  const withHover = (
    <div className="statusbutton-hoverable w3-dropdown-hover pointer" style={menuStyles.base}>
      <div className={`${currentState.class} statusbutton-data-row-icon pointer`} style={menuStyles.base} onClick={(e) => handleClick(e, rowID)}>
        {currentState.icon}
      </div>
      <div className="statusbutton-dropdown-container w3-dropdown-content w3-bar-block w3-border pointer" style={menuStyles.base}>
        {states
          .filter((o) => o.type !== currentState.type)
          .filter((o) => showScheduledOptions || !o.type.includes('cheduled'))
          .map((s, i) => (
            <div
              onClick={(e) => handleClick(e, rowID, s.type)}
              className="statusbutton-option-row w3-bar-item pointer"
              key={i}
              style={{ cursor: 'pointer', ':hover': menuStyles.hover }}
            >
              <span className={`statusbutton-option-icon ${currentState.class} pointer`} style={menuStyles.icon}>
                {s.icon}
              </span>
              <span className="statusbutton-option-text pointer">{s.type}</span>
            </div>
          ))}
      </div>
    </div>
  )

  const withoutHover = (
    <div className="statusbutton-collapsed w3-cell-middle" onClick={(e) => handleClick(e, rowID)} style={menuStyles.base}>
      <div className={currentState.class}>{currentState.icon}</div>
      {showText && <div className="statusbutton-text">{currentState.type}</div>}
    </div>
  )

  return dropdown ? withHover : withoutHover
}

export default StatusButton
