/**
 * Warning/message banner at top of page
 * Send a SHOW_BANNER message from the plugin with the following payload:
 * @param { type, msg, color, border, hide, icon, timeout } props
 * @returns
 */

import { useEffect, useState } from 'react'
import './MessageBanner.css'

export function MessageBanner(props) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  // Effect to handle the visibility of the banner, to allow for animation
  useEffect(() => {
    if (props.msg) {
      // Show: add to DOM and then make visible
      setShouldRender(true)
      // Use setTimeout to ensure DOM is ready before adding visible class
      setTimeout(() => setIsVisible(true), 10)
    } else if (shouldRender) {
      // Hide: remove visible class first, then remove from DOM after animation
      setIsVisible(false)
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 350) // Match the longest transition duration (max-height: 0.35s)
      return () => clearTimeout(timer)
    }
  }, [props.type, props.msg, props.timeout, shouldRender])

  if (!shouldRender) {
    return null
  }

  const visibleClass = isVisible ? 'banner-panel--visible' : ''
  const iconClass = props.icon + ' fa-lg'
  const className = `banner-panel ${visibleClass} ${props.border ?? ''} ${props.color ?? ''}`

  if (!/BANNER_TEST/.test(props.msg)) window.scrollTo(0, 0)
  return (
    <div className={className}>
      <div><i className={iconClass}></i></div>
      <div className="banner-message-text">{props.msg}</div>
      <div onClick={() => props.hide()} className="banner-close-button">
        <i className="fa-solid fa-circle-xmark"></i>
      </div>
    </div>
  )
}

export default MessageBanner
