/**
 * Warning/message banner at top of page (or floating toast when floating=true)
 * Send a SHOW_BANNER message from the plugin with the following payload:
 * @param { type, msg, color, border, hide, icon, timeout, floating } props
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
      // Use different timeout based on floating mode (toast uses 300ms, banner uses 350ms)
      const animationDuration = props.floating ? 300 : 350
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, animationDuration)
      return () => clearTimeout(timer)
    }
  }, [props.type, props.msg, props.timeout, props.floating, shouldRender])

  if (!shouldRender) {
    return null
  }

  const visibleClass = isVisible ? 'banner-panel--visible' : ''
  const floatingClass = props.floating ? 'banner-panel--floating' : ''
  const iconClass = props.icon + ' fa-lg'
  const className = `banner-panel ${visibleClass} ${floatingClass} ${props.border ?? ''} ${props.color ?? ''}`

  // Only scroll to top for non-floating banners
  if (!props.floating && !/BANNER_TEST/.test(props.msg)) window.scrollTo(0, 0)
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
