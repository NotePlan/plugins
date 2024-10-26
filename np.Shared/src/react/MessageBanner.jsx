/**
 * Warning/message banner at top of page
 * Send a SHOW_BANNER message from the plugin with the following payload:
 * @param { warn, msg, color, border, hide } props
 * @returns
 */
export function MessageBanner(props) {
  if (!props.warn) {
    return null
  }
  // onclick="this.parentElement.style.display='none'" class="w3-button w3-display-topright"
  console.log(`Root: MessageBanner: props=${JSON.stringify(props)}`)
  const className = `w3-panel w3-display-container ${props.border ? 'w3-leftbar' : ''} ${props.border ?? 'w3-border-red'} ${props.color ?? 'w3-pale-red'}`
  console.log(`MessageBanner: scrolling to top and displaying banner className=${className}`)
  window.scrollTo(0, 0)
  return (
    <div className={className}>
      <span onClick={() => props.hide()} className="w3-button w3-display-right">
        X
      </span>
      <p style={{whiteSpace: 'pre-wrap'}}>{props.msg}</p>
    </div>
  )
}

export default MessageBanner