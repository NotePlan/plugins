// @flow
//--------------------------------------------------------------------------
// ConditionsEditor Component - Editor for conditional-values matchTerm/value pairs
// Similar to OptionsEditor but with matchTerm and value columns (no label/isDefault).
//--------------------------------------------------------------------------

import React, { useState, useEffect, type Node } from 'react'
import { ValueInsertButtons } from './ValueInsertButtons.jsx'

type ConditionItem = {
  matchTerm: string,
  value: string,
}

type ConditionsEditorProps = {
  conditions: Array<{ matchTerm: string, value: string }>,
  onChange: (conditions: Array<{ matchTerm: string, value: string }>) => void,
}

/**
 * Editor for conditional-values conditions (matchTerm/value pairs).
 * First match wins when evaluating.
 *
 * @param {ConditionsEditorProps} props
 * @returns {Node}
 */
export function ConditionsEditor({ conditions, onChange }: ConditionsEditorProps): Node {
  const normalizeCondition = (c: { matchTerm?: string, value?: string } | any): ConditionItem => ({
    matchTerm: c?.matchTerm ?? '',
    value: c?.value ?? '',
  })

  const [conditionItems, setConditionItems] = useState<Array<ConditionItem>>(() => {
    return Array.isArray(conditions) ? conditions.map(normalizeCondition) : []
  })

  const handleAddCondition = () => {
    const newItem: ConditionItem = { matchTerm: '', value: '' }
    const updated = [...conditionItems, newItem]
    setConditionItems(updated)
    onChange(updated)
  }

  const handleUpdateCondition = (index: number, updates: Partial<ConditionItem>) => {
    const updated = [...conditionItems]
    updated[index] = { ...updated[index], ...updates }
    setConditionItems(updated)
    onChange(updated)
  }

  const handleDeleteCondition = (index: number) => {
    const updated = conditionItems.filter((_, i) => i !== index)
    setConditionItems(updated)
    onChange(updated)
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const updated = [...conditionItems]
    const temp = updated[index - 1]
    updated[index - 1] = updated[index]
    updated[index] = temp
    setConditionItems(updated)
    onChange(updated)
  }

  const handleMoveDown = (index: number) => {
    if (index === conditionItems.length - 1) return
    const updated = [...conditionItems]
    const temp = updated[index]
    updated[index] = updated[index + 1]
    updated[index + 1] = temp
    setConditionItems(updated)
    onChange(updated)
  }

  useEffect(() => {
    const normalized = Array.isArray(conditions) ? conditions.map(normalizeCondition) : []
    setConditionItems(normalized)
  }, [conditions])

  return (
    <div className="conditions-editor conditions-editor-conditional-values">
      <div className="conditions-editor-header">
        <label>Conditions (matchTerm → value, first match wins):</label>
        <button type="button" className="PCButton add-condition-button" onClick={handleAddCondition}>
          + Add Condition
        </button>
      </div>
      <div className="conditions-list">
        {conditionItems.length === 0 ? (
          <div className="conditions-empty-state">No conditions yet. Click &quot;Add Condition&quot; to add match/value pairs.</div>
        ) : (
          conditionItems.map((cond, index) => (
            <div key={`condition-${index}`} className="condition-item">
              <div className="condition-item-controls">
                <button type="button" className="condition-move-button" onClick={() => handleMoveUp(index)} disabled={index === 0} title="Move up">
                  ↑
                </button>
                <button type="button" className="condition-move-button" onClick={() => handleMoveDown(index)} disabled={index === conditionItems.length - 1} title="Move down">
                  ↓
                </button>
              </div>
              <div className="condition-item-fields">
                <div className="condition-field">
                  <label>Match:</label>
                  <input
                    type="text"
                    value={cond.matchTerm}
                    onChange={(e) => handleUpdateCondition(index, { matchTerm: e.target.value })}
                    placeholder="Trip or .*trip.* (regex)"
                  />
                </div>
                <div className="condition-field condition-field-value">
                  <label>Value:</label>
                  <div className="value-input-with-insert-row">
                    <input
                      type="text"
                      value={cond.value}
                      onChange={(e) => handleUpdateCondition(index, { value: e.target.value })}
                      placeholder="red-500, fa-solid fa-star, lined, etc."
                    />
                    <ValueInsertButtons onValueReplace={(v) => handleUpdateCondition(index, { value: v })} />
                  </div>
                </div>
              </div>
              <button type="button" className="condition-delete-button" onClick={() => handleDeleteCondition(index)} title="Delete condition">
                ×
              </button>
            </div>
          ))
        )}
      </div>
      <div className="conditions-editor-help">
        When the source field&apos;s value matches &quot;Match&quot; (string or regex), this field is set to &quot;Value&quot;. Order matters: first match wins. Use the +Color, +Icon, +Pattern, and +IconStyle buttons next to the Value field to insert values commonly used as NotePlan variables in frontmatter: +Color inserts Tailwind color names (e.g. amber-100, red-500); +Icon inserts Font Awesome icon classes (e.g. fa-solid fa-star); +Pattern inserts lined, squared, mini-squared, or dotted; +IconStyle inserts solid, light, or regular.
      </div>
    </div>
  )
}

export default ConditionsEditor
