// @flow
//--------------------------------------------------------------------------
// TemplateJSBlock Component
// A code editor for TemplateJS blocks that execute JavaScript
//--------------------------------------------------------------------------

import React, { useState, useRef, useEffect } from 'react'
import './TemplateJSBlock.css'

export type TemplateJSBlockProps = {
  label?: string,
  value?: string,
  onChange?: (value: string) => void,
  disabled?: boolean,
  placeholder?: string,
  compactDisplay?: boolean,
  className?: string,
  executeTiming?: 'before' | 'after', // When to execute: before form fields render, or after
}

/**
 * TemplateJSBlock Component
 * A code editor for TemplateJS blocks
 */
export function TemplateJSBlock({
  label = '',
  value = '',
  onChange,
  disabled = false,
  placeholder = '// Enter JavaScript code here\n// This code will be executed when the form is processed',
  compactDisplay = false,
  className = '',
  executeTiming = 'after', // Default to executing after form fields render
}: TemplateJSBlockProps): React$Node {
  const textareaRef = useRef<?HTMLTextAreaElement>(null)

  const handleChange = (e: SyntheticInputEvent<HTMLTextAreaElement>) => {
    if (onChange && !disabled) {
      onChange(e.target.value)
    }
  }

  return (
    <div className={`templatejs-block ${className} ${compactDisplay ? 'compact' : ''}`}>
      {label && <label className="templatejs-block-label">{label}</label>}
      <div className="templatejs-block-editor-wrapper">
        <div className="templatejs-block-header">
          <span className="templatejs-block-timing">
            Execute: {executeTiming === 'before' ? 'Before form fields render' : 'After form fields render'}
          </span>
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className="templatejs-block-editor"
          spellCheck={false}
        />
        <div className="templatejs-block-footer">
          <span className="templatejs-block-hint">
            This code will be saved as a &quot;template:ignore templateJS&quot; code block and executed during template processing.
          </span>
        </div>
      </div>
    </div>
  )
}

export default TemplateJSBlock

