/**
 * Warning/message banner at top of page
 * Send a SHOW_BANNER message from the plugin with the following payload:
 * @param { warn, msg, color, border, hide, icon } props
 * @returns
 */

import { useEffect, useState } from 'react'
import './MessageBanner.css'

// TODO: remove 'warn' parameter, as its not really being used

export function MessageBanner(props) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  // Effect to handle the visibility of the banner, to allow for animation
  useEffect(() => {
    if (props.warn && props.msg) {
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
  }, [props.warn, props.msg, shouldRender])

  if (!shouldRender) {
    return null
  }

  const visibleClass = isVisible ? 'banner-panel--visible' : ''
  const className = `banner-panel ${visibleClass} ${props.border ? 'banner-panel-leftbar' : ''} ${props.border ?? 'w3-border-red'} ${props.color ?? 'w3-pale-red'}`
  if (!/BANNER_TEST/.test(props.msg)) window.scrollTo(0, 0)
  return (
    <div className={className}>
      <div><i className={props.icon}></i></div>
      <div className="banner-message-text">{props.msg}</div>
      <div onClick={() => props.hide()} className="banner-close-button">
        X
      </div>
    </div>
  )
}

export default MessageBanner
