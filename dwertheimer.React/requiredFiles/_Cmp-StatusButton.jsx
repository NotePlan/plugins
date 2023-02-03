/**
 * Button to cycle through states
 * Props:
 * @param {string} initialState  - e.g. "open"
 * @param {function} onClick - function to call (will send (rowID, newState)))
 * @param {number} rowID - rowID of the row
 * @param {object} style - style object
 * @param {boolean} showText - whether to show the text of the state underneath the icon
 *
 * TODO: think about dropdown - https://www.w3schools.com/w3css/w3css_dropdowns.asp
 * Per Eduard, use the app "Glyphs Mini" to open the font
 */
const states = [
  { type: 'test', icon: 'x', class: 'noteplanstate' },
  { type: 'open', icon: '*', class: 'noteplanstate' },
  { type: 'done', icon: 'a', class: 'noteplanstate' },
  { type: 'scheduled', icon: 'b', class: 'noteplanstate' },
  { type: 'cancelled', icon: 'c', class: 'noteplanstate' },
  { type: 'bullet', icon: '-', class: 'noteplanstate' },
  { type: 'checklist', icon: '+', class: 'noteplanstate' },
  { type: 'checklist-done', icon: 'd', class: 'noteplanstate' },
  { type: 'checklist-cancelled', icon: 'e', class: 'noteplanstate' },
  { type: 'checklist-scheduled', icon: 'f', class: 'noteplanstate' },
]

const StatusButton = ({ initialState, onClick, rowID, style, showText }) => {
  // let upper = letter.toUpperCase();

  const [currentState, setCurrentState] = useState(states.find((s) => s.type === initialState))

  const handleClick = () => {
    const nextIndex = (states.indexOf(currentState) + 1) % states.length
    console.log(`StatusButton: handleClick: rowID=${rowID}, setting state from ${currentState} to: ${states[nextIndex]}`)
    setCurrentState(states[nextIndex])
    onClick(rowID, states[nextIndex])
  }
  /*
      <div class="w3-dropdown-hover">
      <button class="w3-button">Hover Over Me!</button>
      <div class="w3-dropdown-content w3-bar-block w3-border">
        {states.map((s) => (
            <a href="#" class="w3-bar-item w3-button">{s.icon}</a>
        }
        <a href="#" class="w3-bar-item w3-button">
          Link 1
        </a>
        <a href="#" class="w3-bar-item w3-button">
          Link 2
        </a>
        <a href="#" class="w3-bar-item w3-button">
          Link 3
        </a>
      </div>
    </div>

    */
  const textStyle = {}
  return (
    <div className="statusbutton w3-cell-middle" onClick={handleClick} style={style}>
      <div className={currentState.class}>{currentState.icon}</div>
      {showText && <div className="statusbutton-text">{currentState.type}</div>}
    </div>
  )
}
