/**
 * Toast notification component that displays transient messages in the top-right corner
 * Send a SHOW_TOAST message from the plugin with the following payload:
 * @param { type, msg, color, border, icon, timeout } props
 * @returns
 */

import { useEffect, useState } from 'react'
import './Toast.css'

export function Toast(props) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  // Effect to handle the visibility of the toast, to allow for animation
  useEffect(() => {
    // Check if msg is truthy and not just whitespace
    const hasMessage = props.msg && typeof props.msg === 'string' && props.msg.trim().length > 0
    const shouldShow = hasMessage && props.type !== 'REMOVE'
    
    if (shouldShow) {
      // Show: add to DOM and then make visible
      setShouldRender(true)
      // Use setTimeout to ensure DOM is ready before adding visible class
      const showTimer = setTimeout(() => setIsVisible(true), 10)
      return () => clearTimeout(showTimer)
    } else {
      // Hide: remove visible class first, then remove from DOM after animation
      setIsVisible(false)
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 300) // Match the transition duration
      return () => clearTimeout(timer)
    }
  }, [props.type, props.msg])

  if (!shouldRender) {
    return null
  }

  const visibleClass = isVisible ? 'toast--visible' : ''
  const iconClass = `${props.icon} fa-lg`
  const className = `toast ${visibleClass} ${props.border ?? ''} ${props.color ?? ''}`

  return (
    <div className={className}>
      <div>
        <i className={iconClass}></i>
      </div>
      <div className="toast-message-text">{props.msg}</div>
      <div onClick={() => props.hide()} className="toast-close-button">
        <i className="fa-solid fa-circle-xmark"></i>
      </div>
    </div>
  )
}

export default Toast
