// @flow
//--------------------------------------------------------------------------
// ValueInsertButtons - Buttons that insert Color / Icon / Pattern / IconStyle
// into a value field. Generalizes the "+ Add Field" style for value replacement.
// Used next to conditional-values "Value" input and other value fields.
//--------------------------------------------------------------------------

import React, { useState, useRef, useEffect, useCallback, type Node } from 'react'
import { TAILWIND_COLOR_NAMES, getColorStyle } from '@helpers/colors'

const PATTERNS = ['lined', 'squared', 'mini-squared', 'dotted']
const ICON_STYLES = ['solid', 'light', 'regular']

/** Curated Font Awesome free icon names (segment after "fa-"). Insert as "fa-{style} fa-{name}". */
const FA_ICON_NAMES = [
  'star',
  'circle',
  'calendar',
  'calendar-day',
  'calendar-alt',
  'clock',
  'check',
  'times',
  'xmark',
  'folder',
  'folder-open',
  'file',
  'file-lines',
  'edit',
  'pen',
  'trash',
  'plus',
  'minus',
  'user',
  'cube',
  'spinner',
  'chevron-down',
  'bell',
  'triangle-exclamation',
  'circle-exclamation',
  'circle-info',
  'circle-question',
  'image',
  'envelope',
  'heart',
  'bookmark',
  'tag',
  'link',
  'copy',
  'filter',
  'search',
  'cog',
  'home',
  'save',
  'upload',
  'download',
  'list',
  'paper-plane',
  'reply',
  'share',
  'lock',
  'unlock',
  'eye',
  'eye-slash',
  'grip-vertical',
  'check-double',
  'square',
  'bolt',
  'fire',
  'flag',
  'gem',
  'globe',
  'key',
  'map-marker',
  'palette',
  'pencil',
  'print',
  'rocket',
  'stamp',
  'certificate',
  'wrench',
  'book',
  'note-sticky',
  'calendar-plus',
  'calendar-check',
  'thumbs-up',
  'thumbs-down',
  'comment',
  'comment-dots',
  'at',
  'hashtag',
  'arrow-right',
  'arrow-left',
  'chart-line',
]

type ValueInsertButtonsProps = {
  onValueReplace: (value: string) => void,
  defaultIconStyle?: string,
  disabled?: boolean,
  className?: string,
}

/**
 * Buttons (+Color, +Icon, +Pattern, +IconStyle) that replace the current value
 * with a chosen item. Picking from a list inserts that value into the field.
 *
 * @param {ValueInsertButtonsProps} props
 * @returns {Node}
 */
export function ValueInsertButtons({
  onValueReplace,
  defaultIconStyle = 'solid',
  disabled = false,
  className = '',
}: ValueInsertButtonsProps): Node {
  const [openDropdown, setOpenDropdown] = useState<?'color' | 'icon' | 'pattern' | 'iconstyle'>(null)
  const containerRef = useRef<?HTMLDivElement>(null)

  const close = useCallback(() => setOpenDropdown(null), [])

  useEffect(() => {
    if (!openDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains((e: any).target)) {
        close()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdown, close])

  const handlePick = (value: string) => {
    onValueReplace(value)
    close()
  }

  const toggle = (key: 'color' | 'icon' | 'pattern' | 'iconstyle') => {
    setOpenDropdown((prev) => (prev === key ? null : key))
  }

  return (
    <div ref={containerRef} className={`value-insert-buttons ${className}`.trim()} data-value-insert-buttons>
      <div className="value-insert-btn-group">
        <button
          type="button"
          className="value-insert-btn"
          onClick={() => toggle('color')}
          disabled={disabled}
          title="Insert Tailwind color"
        >
          +Color
        </button>
        {openDropdown === 'color' && (
          <div className="value-insert-dropdown value-insert-dropdown-colors">
            {TAILWIND_COLOR_NAMES.map((name) => {
              const hex = getColorStyle(name)
              return (
                <button
                  key={name}
                  type="button"
                  className="value-insert-option value-insert-option-color"
                  onClick={() => handlePick(name)}
                >
                  <span
                    className="value-insert-color-swatch"
                    style={{ background: hex || 'transparent', border: '1px solid var(--divider-color, #CDCFD0)' }}
                  />
                  <span className="value-insert-option-label">{name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="value-insert-btn-group">
        <button type="button" className="value-insert-btn" onClick={() => toggle('icon')} disabled={disabled} title="Insert Font Awesome icon">
          +Icon
        </button>
        {openDropdown === 'icon' && (
          <div className="value-insert-dropdown value-insert-dropdown-icons">
            {FA_ICON_NAMES.map((name) => {
              const fullClass = `fa-${defaultIconStyle} fa-${name}`
              return (
                <button
                  key={name}
                  type="button"
                  className="value-insert-option value-insert-option-icon"
                  onClick={() => handlePick(fullClass)}
                >
                  <i className={fullClass} style={{ width: '1rem', marginRight: '0.5rem', textAlign: 'center' }} />
                  <span className="value-insert-option-label">{name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="value-insert-btn-group">
        <button type="button" className="value-insert-btn" onClick={() => toggle('pattern')} disabled={disabled} title="Insert pattern name">
          +Pattern
        </button>
        {openDropdown === 'pattern' && (
          <div className="value-insert-dropdown value-insert-dropdown-pattern">
            {PATTERNS.map((p) => (
              <button key={p} type="button" className="value-insert-option" onClick={() => handlePick(p)}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="value-insert-btn-group">
        <button type="button" className="value-insert-btn" onClick={() => toggle('iconstyle')} disabled={disabled} title="Insert icon style">
          +IconStyle
        </button>
        {openDropdown === 'iconstyle' && (
          <div className="value-insert-dropdown value-insert-dropdown-iconstyle">
            {ICON_STYLES.map((s) => (
              <button key={s} type="button" className="value-insert-option" onClick={() => handlePick(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ValueInsertButtons
