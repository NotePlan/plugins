// @flow
//--------------------------------------------------------------------------
// OptionsEditor Component - Reusable editor for dropdown/button-group options
//--------------------------------------------------------------------------

import React, { useState, useEffect, type Node } from 'react'

type OptionItem = {
  label: string,
  value: string,
  isDefault: boolean,
}

type OptionsEditorProps = {
  options: Array<any>, // Can be Array<string | OptionItem>, but Flow has trouble with union arrays
  fieldType: 'dropdown-select' | 'combo' | 'button-group',
  onChange: (options: Array<any>) => void, // Can be Array<string | OptionItem>
}

export function OptionsEditor({ options, fieldType, onChange }: OptionsEditorProps): Node {
  // Normalize options to always work with OptionItem format internally
  const normalizeOption = (opt: string | OptionItem): OptionItem => {
    if (typeof opt === 'string') {
      return { label: opt, value: opt, isDefault: false }
    }
    return { label: opt.label || opt.value || '', value: opt.value || '', isDefault: opt.isDefault || false }
  }

  const [optionItems, setOptionItems] = useState<Array<OptionItem>>(() => {
    return options ? options.map(normalizeOption) : []
  })

  const handleAddOption = () => {
    const newOption: OptionItem = { label: 'New Option', value: 'newOption', isDefault: false }
    const updated = [...optionItems, newOption]
    setOptionItems(updated)
    convertAndNotify(updated)
  }

  const handleUpdateOption = (index: number, updates: Partial<OptionItem>) => {
    const updated = [...optionItems]
    const currentItem = updated[index]
    const newItem = { ...currentItem, ...updates }
    // Ensure value is also updated if label changes and they were the same
    if (updates.label && currentItem.label === currentItem.value && !updates.value) {
      newItem.value = updates.label
    }
    updated[index] = newItem
    setOptionItems(updated)
    // Convert back to the appropriate format for the field type
    convertAndNotify(updated)
  }

  const handleDeleteOption = (index: number) => {
    const updated = optionItems.filter((_, i) => i !== index)
    setOptionItems(updated)
    convertAndNotify(updated)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const updated = [...optionItems]
    const temp = updated[index - 1]
    updated[index - 1] = updated[index]
    updated[index] = temp
    setOptionItems(updated)
    convertAndNotify(updated)
  }

  const handleMoveDown = (index: number) => {
    if (index === optionItems.length - 1) return
    const updated = [...optionItems]
    const temp = updated[index]
    updated[index] = updated[index + 1]
    updated[index + 1] = temp
    setOptionItems(updated)
    convertAndNotify(updated)
  }

  const handleToggleDefault = (index: number) => {
    const updated = optionItems.map((opt, i) => ({
      label: opt.label,
      value: opt.value,
      isDefault: i === index ? !opt.isDefault : false, // Only one default at a time
    }))
    setOptionItems(updated)
    convertAndNotify(updated)
  }

  const convertAndNotify = (items: Array<OptionItem>) => {
    if (fieldType === 'button-group') {
      // For button-group, always return objects with isDefault (but convert to the format expected)
      const converted: Array<OptionItem> = items.map((item) => ({
        label: item.label,
        value: item.value,
        isDefault: item.isDefault,
      }))
      onChange(converted)
    } else {
      // For dropdown-select/combo, return strings if label === value, otherwise objects
      const converted: Array<string | { label: string, value: string }> = items.map((item) => {
        if (item.label === item.value) {
          return item.label
        }
        return { label: item.label, value: item.value }
      })
      onChange(converted)
    }
  }

  useEffect(() => {
    // Update internal state when options prop changes externally
    const normalized = options ? options.map(normalizeOption) : []
    setOptionItems(normalized)
  }, [options])

  return (
    <div className="options-editor">
      <div className="options-editor-header">
        <label>Options:</label>
        <button type="button" className="PCButton add-option-button" onClick={handleAddOption}>
          + Add Option
        </button>
      </div>
      <div className="options-list">
        {optionItems.length === 0 ? (
          <div className="options-empty-state">No options yet. Click &quot;Add Option&quot; to get started.</div>
        ) : (
          optionItems.map((option, index) => (
            <div key={`option-${index}`} className="option-item">
              <div className="option-item-controls">
                <button type="button" className="option-move-button" onClick={() => handleMoveUp(index)} disabled={index === 0} title="Move up">
                  ↑
                </button>
                <button type="button" className="option-move-button" onClick={() => handleMoveDown(index)} disabled={index === optionItems.length - 1} title="Move down">
                  ↓
                </button>
              </div>
              <div className="option-item-fields">
                <div className="option-field">
                  <label>Label:</label>
                  <input type="text" value={option.label} onChange={(e) => handleUpdateOption(index, { label: e.target.value })} placeholder="Display label" />
                </div>
                <div className="option-field">
                  <label>Value:</label>
                  <input type="text" value={option.value} onChange={(e) => handleUpdateOption(index, { value: e.target.value })} placeholder="Value (for template)" />
                </div>
                {fieldType === 'button-group' && (
                  <div className="option-field option-checkbox-field">
                    <label>
                      <input type="checkbox" checked={option.isDefault || false} onChange={() => handleToggleDefault(index)} />
                      Default
                    </label>
                  </div>
                )}
              </div>
              <button type="button" className="option-delete-button" onClick={() => handleDeleteOption(index)} title="Delete option">
                ×
              </button>
            </div>
          ))
        )}
      </div>
      <div className="options-editor-help">
        {fieldType === 'button-group'
          ? 'Label is what users see, Value is used in templates. Only one option can be marked as default.'
          : 'Label is what users see, Value is used in templates. Leave Value empty to use Label as Value.'}
      </div>
    </div>
  )
}

export default OptionsEditor
