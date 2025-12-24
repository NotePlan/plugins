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
  actionButtons?: React$Node, // Buttons to display in the toggle area
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
 * Replace leading and trailing spaces with visible space indicator for display
 * Also replaces newlines with <return> indicators
 * Only shows space indicators at the start or end of text, not in the middle
 * @param {string} text - The text to process
 * @returns {string} Text with leading/trailing spaces replaced by "<space>" and newlines by "<return>"
 */
function displayTextWithSpaces(text: string): string {
  // First, replace all newlines with <return>
  let processedText = text.replace(/\n/g, '<return>')

  // Then replace leading spaces and trailing spaces separately
  // Leading spaces: ^\s+
  // Trailing spaces: \s+$
  // Middle spaces are left as-is
  processedText = processedText.replace(/^(\s+)/, (match) => '<space>'.repeat(match.length))
  processedText = processedText.replace(/(\s+)$/, (match) => '<space>'.repeat(match.length))

  return processedText
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
  actionButtons,
}: TemplateTagEditorProps): React$Node {
  const [showRaw, setShowRaw] = useState<boolean>(false)
  const [pills, setPills] = useState<Array<TemplateTagPill>>([])
  const [selectedPillId, setSelectedPillId] = useState<?string>(null)
  const [editingTextIndex, setEditingTextIndex] = useState<?number>(null)
  const [editingTextValue, setEditingTextValue] = useState<string>('')
  const [draggedPillId, setDraggedPillId] = useState<?string>(null)
  const [dragOverIndex, setDragOverIndex] = useState<?number>(null)
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null)
  const [cursorPosition, setCursorPosition] = useState<?number>(null) // Position in pills array where cursor should be
  const [editingPillId, setEditingPillId] = useState<?string>(null) // Pill being edited in raw mode
  const containerRef = useRef<?HTMLDivElement>(null)
  const textareaRef = useRef<?HTMLTextAreaElement>(null)
  const pillsContainerRef = useRef<?HTMLDivElement>(null)

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
    setEditingPillId(null)
  }, [editingTextIndex, editingTextValue, pills, onChange])

  // Handle text edit cancel
  const handleTextEditCancel = useCallback(() => {
    setEditingTextIndex(null)
    setEditingTextValue('')
    setEditingPillId(null)
  }, [])

  // Handle pill click
  const handlePillClick = useCallback((pillId: string, e: SyntheticMouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    setSelectedPillId(pillId)
  }, [])

  // Handle drag start
  const handleDragStart = useCallback((pillId: string, e: SyntheticDragEvent<HTMLDivElement>) => {
    setDraggedPillId(pillId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', pillId)
    // Set I-beam cursor
    if (e.target instanceof HTMLElement) {
      e.target.style.cursor = 'text'
    }
  }, [])

  // Handle drag over
  const handleDragOver = useCallback(
    (index: number, position: 'before' | 'after', e: SyntheticDragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'

      // Update drag over state for real-time feedback
      setDragOverIndex(index)
      setDragOverPosition(position)

      // If dragging over a text pill, allow splitting it
      const pill = pills[index]
      if (pill && pill.type === 'text' && draggedPillId && draggedPillId !== pill.id) {
        const rect = e.currentTarget.getBoundingClientRect()
        const midPoint = rect.left + rect.width / 2
        const newPosition = e.clientX < midPoint ? 'before' : 'after'
        setDragOverPosition(newPosition)
      }
    },
    [pills, draggedPillId],
  )

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null)
    setDragOverPosition(null)
  }, [])

  // Handle drop
  const handleDrop = useCallback(
    (dropIndex: number, position: 'before' | 'after', e: SyntheticDragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()

      if (!draggedPillId) {
        setDraggedPillId(null)
        setDragOverIndex(null)
        setDragOverPosition(null)
        return
      }

      const draggedIndex = pills.findIndex((p) => p.id === draggedPillId)
      if (draggedIndex === -1) {
        setDraggedPillId(null)
        setDragOverIndex(null)
        setDragOverPosition(null)
        return
      }

      const newPills = [...pills]
      const draggedPill = newPills[draggedIndex]
      const dropPill = newPills[dropIndex]

      if (!draggedPill) {
        setDraggedPillId(null)
        setDragOverIndex(null)
        setDragOverPosition(null)
        return
      }

      // If dropping on a text pill, split it at the drop position
      if (dropPill && dropPill.type === 'text' && draggedPillId !== dropPill.id) {
        const rect = e.currentTarget.getBoundingClientRect()
        const midPoint = rect.left + rect.width / 2
        const actualPosition = e.clientX < midPoint ? 'before' : 'after'

        // Remove dragged pill first
        newPills.splice(draggedIndex, 1)

        // Adjust drop index if we removed an item before it
        const adjustedDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex
        const targetPill = newPills[adjustedDropIndex]

        if (targetPill && targetPill.type === 'text') {
          // Split text pill at cursor position (approximate - use midpoint for now)
          const textContent = targetPill.content
          const splitPoint = Math.floor(textContent.length / 2)
          const beforeText = textContent.substring(0, splitPoint)
          const afterText = textContent.substring(splitPoint)

          // Create new pills array with split text
          const splitPills: Array<TemplateTagPill> = []
          if (beforeText) {
            splitPills.push({
              ...targetPill,
              id: `${targetPill.id}-before`,
              content: beforeText,
              label: beforeText,
            })
          }
          splitPills.push(draggedPill)
          if (afterText) {
            splitPills.push({
              ...targetPill,
              id: `${targetPill.id}-after`,
              content: afterText,
              label: afterText,
            })
          }

          // Replace target pill with split pills
          newPills.splice(adjustedDropIndex, 1, ...splitPills)
        } else {
          // Insert before or after based on position
          const insertIndex = actualPosition === 'before' ? adjustedDropIndex : adjustedDropIndex + 1
          newPills.splice(insertIndex, 0, draggedPill)
        }
      } else {
        // Normal drop - remove and reinsert
        newPills.splice(draggedIndex, 1)

        // Calculate insert index
        let insertIndex = dropIndex
        if (draggedIndex < dropIndex) {
          insertIndex = dropIndex - 1
        }

        if (position === 'after') {
          insertIndex += 1
        }

        newPills.splice(insertIndex, 0, draggedPill)
      }

      const newValue = reconstructText(newPills)
      setPills(newPills)
      onChange(newValue)

      setDraggedPillId(null)
      setDragOverIndex(null)
      setDragOverPosition(null)
    },
    [draggedPillId, pills, onChange],
  )

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedPillId(null)
    setDragOverIndex(null)
    setDragOverPosition(null)
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

  // Handle container click to position cursor
  const handleContainerClick = useCallback(
    (e: SyntheticMouseEvent<HTMLDivElement>) => {
      if (!pillsContainerRef.current || !textareaRef.current) return

      const container = pillsContainerRef.current
      const rect = container.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      // Find which pill or gap was clicked
      const children = Array.from(container.querySelectorAll('.template-tag-pill, .template-tag-drop-zone'))
      let clickedIndex = -1
      let position: 'before' | 'after' = 'after'

      for (let i = 0; i < children.length; i++) {
        const child = (children[i]: any)
        if (!(child instanceof HTMLElement)) continue
        const childRect = child.getBoundingClientRect()
        const childLeft = childRect.left - rect.left
        const childRight = childRect.right - rect.left

        if (clickX >= childLeft && clickX <= childRight) {
          // Clicked on a pill or drop zone
          const midPoint = childLeft + (childRight - childLeft) / 2
          position = clickX < midPoint ? 'before' : 'after'

          // Find the corresponding pill index
          const pillId = child.getAttribute('data-pill-id') || child.getAttribute('data-drop-zone-index')
          if (pillId) {
            clickedIndex = pills.findIndex((p) => p.id === pillId)
            if (clickedIndex === -1) {
              // Might be a drop zone index
              const dropZoneIndex = parseInt(pillId, 10)
              if (!isNaN(dropZoneIndex)) {
                clickedIndex = dropZoneIndex
              }
            }
          }
          break
        }
      }

      // If clicked at the end, position cursor at the end of the text
      if (clickedIndex === -1) {
        if (textareaRef.current) {
          const textLength = value.length
          textareaRef.current.setSelectionRange(textLength, textLength)
        }
      } else {
        // Calculate cursor position in the text
        let cursorPos = 0
        for (let i = 0; i < pills.length; i++) {
          if (i === clickedIndex) {
            if (position === 'before') {
              break
            } else {
              cursorPos += pills[i].content.length
              break
            }
          }
          cursorPos += pills[i].content.length
        }
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(cursorPos, cursorPos)
        }
      }
    },
    [pills, value],
  )

  // Handle pill mode textarea change
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
      const isDragging = draggedPillId === pill.id
      const isDragOver = dragOverIndex === index
      const showDropIndicatorBefore = isDragOver && dragOverPosition === 'before' && draggedPillId !== pill.id
      const showDropIndicatorAfter = isDragOver && dragOverPosition === 'after' && draggedPillId !== pill.id

      if (pill.type === 'tag') {
        return (
          <React.Fragment key={pill.id}>
            {/* Drop indicator before */}
            {showDropIndicatorBefore && <div className="template-tag-drop-indicator" />}
            <div
              data-pill-id={pill.id}
              className={`template-tag-pill template-tag-pill-tag ${selectedPillId === pill.id ? 'template-tag-pill-selected' : ''} ${
                isDragging ? 'template-tag-pill-dragging' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation()
                handlePillClick(pill.id, e)
                // Focus textarea and position cursor
                const textarea = textareaRef.current
                if (textarea) {
                  textarea.focus()
                  let cursorPos = 0
                  for (let i = 0; i < index; i++) {
                    cursorPos += pills[i].content.length
                  }
                  // Position cursor after this pill
                  cursorPos += pill.content.length
                  textarea.setSelectionRange(cursorPos, cursorPos)
                }
              }}
              draggable={true}
              onDragStart={(e) => handleDragStart(pill.id, e)}
              onDragOver={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const midPoint = rect.left + rect.width / 2
                const position = e.clientX < midPoint ? 'before' : 'after'
                handleDragOver(index, position, e)
              }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(index, dragOverPosition || 'before', e)}
              onDragEnd={handleDragEnd}
              title={pill.content}
              style={{ cursor: isDragging ? 'text' : 'grab' }}
            >
              {showDropIndicatorBefore && <div className="template-tag-drop-indicator" />}
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
              {showDropIndicatorAfter && <div className="template-tag-drop-indicator" />}
            </div>
            {/* Drop zone for between pills - also clickable for text input */}
            {index < pills.length - 1 && (
              <div
                data-drop-zone-index={index + 1}
                className="template-tag-drop-zone"
                onClick={(e) => {
                  e.stopPropagation()
                  // Focus textarea and position cursor between pills
                  const textarea = textareaRef.current
                  if (textarea) {
                    textarea.focus()
                    let cursorPos = 0
                    for (let i = 0; i <= index; i++) {
                      cursorPos += pills[i].content.length
                    }
                    textarea.setSelectionRange(cursorPos, cursorPos)
                  }
                }}
                onDragOver={(e) => handleDragOver(index + 1, 'before', e)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(index + 1, dragOverPosition || 'before', e)}
              />
            )}
          </React.Fragment>
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
              style={{ fontFamily: 'Menlo, monospace' }}
            />
          )
        } else {
          return (
            <React.Fragment key={pill.id}>
              {/* Drop indicator before */}
              {showDropIndicatorBefore && <div className="template-tag-drop-indicator" />}
              <div
                data-pill-id={pill.id}
                className={`template-tag-pill template-tag-pill-text ${isDragging ? 'template-tag-pill-dragging' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  // Focus textarea and position cursor in this text pill
                  const textarea = textareaRef.current
                  if (textarea) {
                    textarea.focus()
                    let cursorPos = 0
                    for (let i = 0; i < index; i++) {
                      cursorPos += pills[i].content.length
                    }
                    // Position cursor in the middle of this text pill (or at click position)
                    const rect = e.currentTarget.getBoundingClientRect()
                    const clickX = e.clientX - rect.left
                    const midPoint = rect.width / 2
                    const charPos = Math.floor((clickX / rect.width) * pill.content.length)
                    cursorPos += Math.max(0, Math.min(charPos, pill.content.length))
                    textarea.setSelectionRange(cursorPos, cursorPos)
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  // Switch to raw editing mode for this pill
                  setEditingPillId(pill.id)
                  setEditingTextIndex(index)
                  setEditingTextValue(pill.content)
                }}
                draggable={true}
                onDragStart={(e) => handleDragStart(pill.id, e)}
                onDragOver={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const midPoint = rect.left + rect.width / 2
                  const position = e.clientX < midPoint ? 'before' : 'after'
                  handleDragOver(index, position, e)
                }}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(index, dragOverPosition || 'before', e)}
                onDragEnd={handleDragEnd}
                title="Click to position cursor, double-click to edit"
                style={{ cursor: isDragging ? 'text' : 'text', fontFamily: 'Menlo, monospace' }}
              >
                {showDropIndicatorBefore && <div className="template-tag-drop-indicator" />}
                {displayTextWithSpaces(pill.content)}
                {showDropIndicatorAfter && <div className="template-tag-drop-indicator" />}
              </div>
              {/* Drop zone for between pills - also clickable for text input */}
              {index < pills.length - 1 && (
                <div
                  data-drop-zone-index={index + 1}
                  className="template-tag-drop-zone"
                  onClick={(e) => {
                    e.stopPropagation()
                    // Focus textarea and position cursor between pills
                    const textarea = textareaRef.current
                    if (textarea) {
                      textarea.focus()
                      let cursorPos = 0
                      for (let i = 0; i <= index; i++) {
                        cursorPos += pills[i].content.length
                      }
                      textarea.setSelectionRange(cursorPos, cursorPos)
                    }
                  }}
                  onDragOver={(e) => handleDragOver(index + 1, 'before', e)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(index + 1, dragOverPosition || 'before', e)}
                />
              )}
            </React.Fragment>
          )
        }
      }
    })
  }, [
    pills,
    selectedPillId,
    editingTextIndex,
    editingTextValue,
    draggedPillId,
    dragOverIndex,
    dragOverPosition,
    handlePillClick,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleDeletePill,
    handleTextEdit,
    handleTextEditSave,
    handleTextEditCancel,
  ])

  return (
    <div className={`template-tag-editor ${className}`} style={style} ref={containerRef} data-field-type="textarea">
      {/* Toggle switch for raw mode */}
      <div className="template-tag-editor-toggle">
        <label className="template-tag-toggle-switch">
          <input type="checkbox" checked={showRaw} onChange={handleRawToggle} />
          <span className="template-tag-toggle-slider"></span>
          <span className="template-tag-toggle-label">Show RAW template code</span>
        </label>
        {actionButtons && (
          <div
            className="template-tag-editor-action-buttons"
            onClick={(e) => {
              // Ensure button clicks work
              e.stopPropagation()
            }}
            onMouseDown={(e) => {
              // Ensure button clicks work
              e.stopPropagation()
            }}
          >
            {actionButtons}
          </div>
        )}
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
          onKeyDown={(e) => {
            // Allow Tab key to insert a tab character instead of moving focus
            if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault()
              const textarea = e.currentTarget
              const start = textarea.selectionStart || 0
              const end = textarea.selectionEnd || 0
              const newValue = `${value.substring(0, start)}\t${value.substring(end)}`
              onChange(newValue)
              // Set cursor position after the inserted tab
              setTimeout(() => {
                textarea.focus()
                const newCursorPos = start + 1
                textarea.setSelectionRange(newCursorPos, newCursorPos)
              }, 0)
            }
            // Ensure Enter key works normally (creates newline in textarea)
            // Stop propagation to prevent DynamicDialog from submitting the form
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.stopPropagation()
              // Don't prevent default - let the textarea handle Enter naturally to create newline
            }
          }}
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
        /* Pill mode - show pills only, with hidden textarea for typing */
        <div className="template-tag-editor-pills-wrapper">
          {/* Pills display */}
          <div
            ref={pillsContainerRef}
            className="template-tag-editor-pills-container"
            onClick={(e) => {
              // Don't interfere with textarea clicks
              if ((e.target: any) instanceof HTMLTextAreaElement) {
                return
              }
              setSelectedPillId(null)
              // Focus the hidden textarea when clicking in the container
              if (textareaRef.current) {
                textareaRef.current.focus()
                // Set cursor position based on click location
                handleContainerClick(e)
              }
            }}
            onKeyDown={(e) => {
              // Don't interfere with textarea key events - let them bubble naturally
              // But prevent container from handling Enter if textarea is focused
              if (e.target instanceof HTMLTextAreaElement) {
                return
              }
            }}
          >
            {pills.length > 0 ? (
              <div className="template-tag-editor-pills">{renderPills}</div>
            ) : (
              <div className="template-tag-editor-empty">{placeholder || 'Start typing or use +Field/+Date buttons to add template tags'}</div>
            )}
          </div>
          {/* Hidden textarea for syncing and adding new content - positioned to overlay pills container */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handlePillModeTextareaChange}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder || 'Start typing or use +Field/+Date buttons to add template tags'}
            rows={minRows}
            onKeyDown={(e) => {
              // Allow Tab key to insert a tab character instead of moving focus
              if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault()
                const textarea = e.currentTarget
                const start = textarea.selectionStart || 0
                const end = textarea.selectionEnd || 0
                const newValue = `${value.substring(0, start)}\t${value.substring(end)}`
                onChange(newValue)
                // Set cursor position after the inserted tab
                setTimeout(() => {
                  textarea.focus()
                  const newCursorPos = start + 1
                  textarea.setSelectionRange(newCursorPos, newCursorPos)
                }, 0)
              }
              // Ensure Enter key creates a newline - stop propagation to prevent parent handlers
              if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.stopPropagation()
                // Don't prevent default - let textarea handle Enter naturally to create newline
              }
            }}
            onMouseDown={(e) => {
              // Allow clicks on buttons to work - check if click is on a button
              const target = (e.target: any)
              if (target instanceof HTMLElement && target.closest('.template-tag-editor-action-buttons')) {
                e.stopPropagation()
                return
              }
            }}
            onClick={(e) => {
              // Allow clicks on buttons to work - check if click is on a button
              const target = (e.target: any)
              if (target instanceof HTMLElement && target.closest('.template-tag-editor-action-buttons')) {
                e.stopPropagation()
                return
              }
            }}
            style={Object.assign(
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0,
                width: '100%',
                height: '100%',
                padding: '0.5rem',
                border: 'none',
                background: 'transparent',
                resize: 'none',
                fontFamily: 'Menlo, monospace',
                fontSize: '0.9em',
                lineHeight: '1.4',
                zIndex: 1,
                cursor: 'text',
                pointerEvents: 'auto',
              },
              style || {},
            )}
            className="template-tag-editor-sync-textarea"
          />
        </div>
      )}
    </div>
  )
}

export default TemplateTagEditor
