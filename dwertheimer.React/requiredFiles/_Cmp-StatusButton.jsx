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
  { type: 'bullet', icon: '-', class: 'noteplanstate' },
  { type: 'checklist', icon: '+', class: 'noteplanstate' },
  { type: 'checklistDone', icon: 'd', class: 'noteplanstate' },
  { type: 'checklistCancelled', icon: 'e', class: 'noteplanstate' },
  { type: 'checklistScheduled', icon: 'f', class: 'noteplanstate' },
]

export const StatusButton = ({ initialState, onStatusChange, rowID, style, showText, dropdown = true, delayOnSimpleClick = 3000, delayOnDropdownClick = 300 }) => {
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
    <div className="w3-dropdown-hover statusbutton-displayed" style={style}>
      <div className={`${currentState.class} statusbutton-collapsed`} style={style} onClick={handleClick}>
        {currentState.icon}
      </div>
      <div className="w3-dropdown-content w3-bar-block w3-border pointer" style={style}>
        {states
          .filter((o) => o.type !== currentState.type)
          .map((s, i) => (
            <a href="" className="w3-bar-item statusbutton-bar pointer" key={i}>
              <div onClick={(e) => handleClick(e, rowID, s.type)}>
                <span className={`${currentState.class} statusbutton-icon pointer`} style={style}>
                  {s.icon}
                </span>
                <span className="statusbutton-text pointer" style={style}>
                  {s.type}
                </span>
              </div>
            </a>
          ))}
      </div>
    </div>
  )

  const withoutHover = (
    <div className="statusbutton w3-cell-middle" onClick={(e) => handleClick(e, rowID)} style={style}>
      <div className={currentState.class}>{currentState.icon}</div>
      {showText && <div className="statusbutton-text">{currentState.type}</div>}
    </div>
  )

  return dropdown ? withHover : withoutHover
}

export default StatusButton
