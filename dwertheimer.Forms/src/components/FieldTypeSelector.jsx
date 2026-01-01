// @flow
//--------------------------------------------------------------------------
// FieldTypeSelector Component - Modal for selecting field type when adding new field
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import { FIELD_TYPES, type FieldTypeOption } from './fieldTypes.js'
import { type TSettingItemType } from '@helpers/react/DynamicDialog/DynamicDialog.jsx'

type FieldTypeSelectorProps = {
  isOpen: boolean,
  onSelect: (type: TSettingItemType) => void,
  onClose: () => void,
}

export function FieldTypeSelector({ isOpen, onSelect, onClose }: FieldTypeSelectorProps): Node {
  if (!isOpen) return null

  const handleSelect = (fieldType: FieldTypeOption) => {
    onSelect(fieldType.value)
  }

  return (
    <div className="field-type-selector-overlay" onClick={onClose}>
      <div className="field-type-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="field-type-selector-header">
          <h3>Select Field Type</h3>
          <button className="field-type-selector-close" onClick={onClose}>
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        <div className="field-type-selector-content">
          <div className="field-type-list">
            {FIELD_TYPES.map((fieldType) => (
              <div key={fieldType.value} className="field-type-option" onClick={() => handleSelect(fieldType)}>
                <div className="field-type-label">{fieldType.label}</div>
                <div className="field-type-description">{fieldType.description}</div>
              </div>
            ))}
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
