import Button from './Button.jsx'
// @flow

/**
 * Context menu bar with buttons and a reschedule component
 * @param {*} props (see below)
 * @returns
 */
export const MultiActionBar = (props) => {
  const { contextButtons, handler, rescheduleComponent, buttonType, keyListener } = props
  const paddingBetweenElements = '5px'
  const buttonContainerStyle = buttonType === 'multi' ? { flexGrow: 1 } : { paddingLeft: '3px' } // for single, add padding to the left b/c there is no reschedule component
  //   useEffect(keyListener, [])
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
          <div style={{ flexGrow: 3, paddingLeft: paddingBetweenElements, paddingRight: paddingBetweenElements, minWidth: '250px' }} className={'w3-cell'}>
            {rescheduleComponent}
          </div>
        )}
      </div>
    </div>
  )
}

export default MultiActionBar
