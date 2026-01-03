// @flow
//--------------------------------------------------------------------------
// FieldTypeSelector Component - Modal for selecting field type when adding new field
//--------------------------------------------------------------------------

import React, { useState, useEffect, useRef, useMemo, type Node } from 'react'
import { FIELD_TYPES, type FieldTypeOption } from './fieldTypes.js'
import { type TSettingItemType } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'

type FieldTypeSelectorProps = {
  isOpen: boolean,
  onSelect: (type: TSettingItemType) => void,
  onClose: () => void,
}

export function FieldTypeSelector({ isOpen, onSelect, onClose }: FieldTypeSelectorProps): Node {
  const [filterText, setFilterText] = useState<string>('')
  const filterInputRef = useRef<?HTMLInputElement>(null)

  // Focus filter input when modal opens
  useEffect(() => {
    if (isOpen && filterInputRef.current) {
      // Use setTimeout to ensure the modal is fully rendered
      setTimeout(() => {
        if (filterInputRef.current) {
          filterInputRef.current.focus()
        }
      }, 0)
    } else if (!isOpen) {
      // Clear filter when modal closes
      setFilterText('')
    }
  }, [isOpen])

  // Filter field types based on filter text (searches in value, label, and description)
  const filteredFieldTypes = useMemo(() => {
    if (!filterText.trim()) {
      return FIELD_TYPES
    }
    const searchTerm = filterText.toLowerCase()
    return FIELD_TYPES.filter((fieldType) => {
      return (
        fieldType.value.toLowerCase().includes(searchTerm) ||
        fieldType.label.toLowerCase().includes(searchTerm) ||
        fieldType.description.toLowerCase().includes(searchTerm)
      )
    })
  }, [filterText])

  if (!isOpen) return null

  const handleSelect = (fieldType: FieldTypeOption) => {
    onSelect(fieldType.value)
  }

  return (
    <div className="field-type-selector-overlay" onClick={onClose}>
      <div className="field-type-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="field-type-selector-header">
          <h3>Select Field Type</h3>
          <div className="field-type-selector-filter-wrapper">
            <input
              ref={filterInputRef}
              type="text"
              className="field-type-selector-filter"
              placeholder="Filter by name, type, or description..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <button className="field-type-selector-close" onClick={onClose}>
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        <div className="field-type-selector-content">
          <div className="field-type-list">
            {filteredFieldTypes.length === 0 ? (
              <div className="field-type-no-results">No field types match your search.</div>
            ) : (
              filteredFieldTypes.map((fieldType) => (
                <div key={fieldType.value} className="field-type-option" onClick={() => handleSelect(fieldType)}>
                  <div className="field-type-label">{fieldType.label}</div>
                  <div className="field-type-description">{fieldType.description}</div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="field-type-selector-footer">
          <button className="PCButton cancel-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default FieldTypeSelector
