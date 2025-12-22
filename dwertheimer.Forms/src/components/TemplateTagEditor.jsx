// @flow
//--------------------------------------------------------------------------
// TemplateTagEditor Component
// A user-friendly editor for template tags that displays them as interactive pills
//--------------------------------------------------------------------------

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import './TemplateTagEditor.css'

export type TemplateTagPill = {
  id: string,
  type: 'tag' | 'text',
  content: string, // For tags: the full tag like "<%- field1 %>", for text: the text content
  label: string, // Display label for tags (e.g., "field1" or "Date: YYYY-MM-DD")
  startIndex: number, // Original position in the text
  endIndex: number, // Original end position in the text
}

export type TemplateTagEditorProps = {
  value: string,
  onChange: (value: string) => void,
  onFocus?: (e: FocusEvent) => void,
  onBlur?: (e: FocusEvent) => void,
  placeholder?: string,
  minRows?: number,
  maxRows?: number,
  fields?: Array<{ key: string, label: string }>, // For displaying field labels
  className?: string,
  style?: { [key: string]: any },
}

/**
 * Parse template tags from text and extract information
 * @param {string} text - The text to parse
 * @param {Array<{key: string, label: string}>} fields - Available form fields for label lookup
 * @returns {Array<TemplateTagPill>} Array of pills (tags and text segments)
 */
function parseTemplateTags(text: string, fields: Array<{ key: string, label: string }> = []): Array<TemplateTagPill> {
  if (!text) return []

  const pills: Array<TemplateTagPill> = []
  const TAG_PATTERN = /<%-?\s*([^%]+?)\s*-?%>/g
  let lastIndex = 0
  let match
  let pillId = 0

  while ((match = TAG_PATTERN.exec(text)) !== null) {
    if (!match || match.index === undefined) continue
    const fullTag = match[0] || ''
    const tagContent = (match[1] || '').trim()
    const startIndex = match.index
    const endIndex = startIndex + fullTag.length

    // Add text before this tag
    if (startIndex > lastIndex) {
      const textContent = text.substring(lastIndex, startIndex)
      if (textContent) {
        pills.push({
          id: `text-${pillId++}`,
          type: 'text',
          content: textContent,
          label: textContent,
          startIndex: lastIndex,
          endIndex: startIndex,
        })
      }
    }

    // Parse tag content to determine label
    let label = tagContent
    if (tagContent.startsWith('date.format(')) {
      // Extract date format
      const formatMatch = tagContent.match(/date\.format\(["']([^"']+)["']\)/)
      if (formatMatch) {
        label = `Date: ${formatMatch[1]}`
      } else {
        label = 'Date Format'
      }
    } else if (tagContent.includes('.')) {
      // Handle other function calls
      const parts = tagContent.split('.')
      label = parts[0] || tagContent
    } else {
      // Look up field label
      const field = fields.find((f) => f.key === tagContent)
      label = field ? field.label : tagContent
    }

    // Add tag pill
    pills.push({
      id: `tag-${pillId++}`,
      type: 'tag',
      content: fullTag,
      label: label,
      startIndex: startIndex,
      endIndex: endIndex,
    })

    lastIndex = endIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const textContent = text.substring(lastIndex)
    if (textContent) {
      pills.push({
        id: `text-${pillId++}`,
        type: 'text',
        content: textContent,
        label: textContent,
        startIndex: lastIndex,
        endIndex: text.length,
      })
    }
  }

  return pills
}

/**
 * Reconstruct text from pills
 * @param {Array<TemplateTagPill>} pills - Array of pills
 * @returns {string} Reconstructed text
 */
function reconstructText(pills: Array<TemplateTagPill>): string {
  return pills.map((pill) => (pill.type === 'tag' ? pill.content : pill.content)).join('')
}

/**
 * TemplateTagEditor Component
 * Displays template tags as interactive pills with a toggle for raw mode
 */
export function TemplateTagEditor({
  value = '',
  onChange,
  onFocus,
  onBlur,
  placeholder = '',
  minRows = 3,
  maxRows = 10,
  fields = [],
  className = '',
  style = {},
}: TemplateTagEditorProps): React$Node {
  const [showRaw, setShowRaw] = useState<boolean>(false)
  const [pills, setPills] = useState<Array<TemplateTagPill>>([])
  const [selectedPillId, setSelectedPillId] = useState<?string>(null)
  const [editingTextIndex, setEditingTextIndex] = useState<?number>(null)
  const [editingTextValue, setEditingTextValue] = useState<string>('')
  const containerRef = useRef<?HTMLDivElement>(null)
  const textareaRef = useRef<?HTMLTextAreaElement>(null)

  // Parse pills from value
  useEffect(() => {
    if (!showRaw) {
      const parsedPills = parseTemplateTags(value, fields)
      setPills(parsedPills)
    }
  }, [value, fields, showRaw])

  // Handle pill deletion
  const handleDeletePill = useCallback(
    (pillId: string) => {
      const newPills = pills.filter((p) => p.id !== pillId)
      const newValue = reconstructText(newPills)
      setPills(newPills)
      onChange(newValue)
    },
    [pills, onChange],
  )

  // Handle text editing
  const handleTextEdit = useCallback(
    (index: number) => {
      const pill = pills[index]
      if (pill && pill.type === 'text') {
        setEditingTextIndex(index)
        setEditingTextValue(pill.content)
      }
    },
    [pills],
  )

  // Handle text edit save
  const handleTextEditSave = useCallback(() => {
    if (editingTextIndex !== null && editingTextIndex !== undefined && editingTextIndex >= 0 && editingTextIndex < pills.length) {
      const newPills = [...pills]
      const existingPill = newPills[editingTextIndex]
      if (existingPill) {
        newPills[editingTextIndex] = {
          ...existingPill,
          content: editingTextValue,
          label: editingTextValue,
        }
        const newValue = reconstructText(newPills)
        setPills(newPills)
        onChange(newValue)
      }
    }
    setEditingTextIndex(null)
    setEditingTextValue('')
  }, [editingTextIndex, editingTextValue, pills, onChange])

  // Handle text edit cancel
  const handleTextEditCancel = useCallback(() => {
    setEditingTextIndex(null)
    setEditingTextValue('')
  }, [])

  // Handle pill click
  const handlePillClick = useCallback((pillId: string, e: SyntheticMouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    setSelectedPillId(pillId)
  }, [])

  // Handle pill drag start (basic implementation - could be enhanced with drag-and-drop)
  const handlePillDragStart = useCallback((pillId: string, e: SyntheticDragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', pillId)
    setSelectedPillId(pillId)
  }, [])

  // Handle raw mode toggle
  const handleRawToggle = useCallback(() => {
    if (showRaw) {
      // Switching from raw to pill mode - parse the current value
      const parsedPills = parseTemplateTags(value, fields)
      setPills(parsedPills)
    }
    setShowRaw(!showRaw)
  }, [showRaw, value, fields])

  // Handle raw textarea change
  const handleRawChange = useCallback(
    (e: SyntheticInputEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)
    },
    [onChange],
  )

  // Handle pill mode - we'll use a contentEditable approach or visible textarea
  // For now, use a visible textarea that shows pills as visual overlay
  const handlePillModeTextareaChange = useCallback(
    (e: SyntheticInputEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      // Parse and update pills in real-time
      const parsedPills = parseTemplateTags(newValue, fields)
      setPills(parsedPills)
      onChange(newValue)
    },
    [fields, onChange],
  )

  // Render pills
  const renderPills = useMemo(() => {
    return pills.map((pill, index) => {
      if (pill.type === 'tag') {
        return (
          <div
            key={pill.id}
            className={`template-tag-pill template-tag-pill-tag ${selectedPillId === pill.id ? 'template-tag-pill-selected' : ''}`}
            onClick={(e) => handlePillClick(pill.id, e)}
            draggable={true}
            onDragStart={(e) => handlePillDragStart(pill.id, e)}
            title={pill.content}
          >
            <span className="template-tag-pill-label">{pill.label}</span>
            <button
              type="button"
              className="template-tag-pill-delete"
              onClick={(e) => {
                e.stopPropagation()
                handleDeletePill(pill.id)
              }}
              title="Delete tag"
            >
              ×
            </button>
          </div>
        )
      } else {
        // Text pill - editable
        if (editingTextIndex === index) {
          return (
            <input
              key={pill.id}
              type="text"
              className="template-tag-pill template-tag-pill-text template-tag-pill-editing"
              value={editingTextValue}
              onChange={(e) => setEditingTextValue(e.target.value)}
              onBlur={handleTextEditSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleTextEditSave()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  handleTextEditCancel()
                }
              }}
              autoFocus={true}
            />
          )
        } else {
          return (
            <div
              key={pill.id}
              className="template-tag-pill template-tag-pill-text"
              onClick={(e) => {
                e.stopPropagation()
                handleTextEdit(index)
              }}
              title="Click to edit text"
            >
              {pill.content}
            </div>
          )
        }
      }
    })
  }, [pills, selectedPillId, editingTextIndex, editingTextValue, handlePillClick, handlePillDragStart, handleDeletePill, handleTextEdit, handleTextEditSave, handleTextEditCancel])

  return (
    <div className={`template-tag-editor ${className}`} style={style} ref={containerRef}>
      {/* Toggle switch for raw mode */}
      <div className="template-tag-editor-toggle">
        <label>
          <input type="checkbox" checked={showRaw} onChange={handleRawToggle} />
          <span>Show RAW template code</span>
        </label>
      </div>

      {/* Raw mode - simple textarea */}
      {showRaw ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleRawChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={minRows}
            style={Object.assign(
              {
                width: '100%',
                minHeight: `${minRows * 1.5}em`,
                maxHeight: `${maxRows * 1.5}em`,
                resize: 'vertical',
                fontFamily: 'Menlo, monospace',
                fontSize: '0.9em',
              },
              style || {},
            )}
          className="template-tag-editor-raw"
        />
      ) : (
        /* Pill mode - show pills above a textarea for editing */
        <div className="template-tag-editor-pills-wrapper">
          {/* Pills display */}
          {pills.length > 0 && (
            <div className="template-tag-editor-pills-container" onClick={() => setSelectedPillId(null)}>
              <div className="template-tag-editor-pills">{renderPills}</div>
            </div>
          )}
          {/* Textarea for editing - shows parsed pills visually above */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handlePillModeTextareaChange}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder || 'Start typing or use +Field/+Date buttons to add template tags'}
            rows={minRows}
            style={Object.assign(
              {
                width: '100%',
                minHeight: `${minRows * 1.5}em`,
                maxHeight: `${maxRows * 1.5}em`,
                resize: 'vertical',
              },
              style || {},
            )}
            className="template-tag-editor-textarea"
          />
        </div>
      )}
    </div>
  )
}

export default TemplateTagEditor

