// @flow
//--------------------------------------------------------------------------
// MarkdownPreview Component
// Displays markdown content in a non-editable preview format
// Supports: (a) static markdown text, (b) note by filename/title, (c) note from another field
//--------------------------------------------------------------------------

import React, { useState, useEffect } from 'react'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import './MarkdownPreview.css'

export type MarkdownPreviewProps = {
  label?: string,
  markdownText?: string, // Static markdown text to display
  noteFilename?: ?string, // Filename of note to display (if not using static text)
  noteTitle?: ?string, // Title of note to display (alternative to filename)
  sourceNoteKey?: ?string, // Key of a note-chooser field to get note from dynamically
  sourceNoteValue?: ?string, // Current value from sourceNoteKey field (note filename)
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Function to request note content from plugin
  disabled?: boolean,
  compactDisplay?: boolean,
  className?: string,
}

/**
 * MarkdownPreview Component
 * Displays markdown content as rendered HTML
 * @param {MarkdownPreviewProps} props
 * @returns {React$Node}
 */
export function MarkdownPreview({
  label,
  markdownText,
  noteFilename,
  noteTitle,
  sourceNoteKey,
  sourceNoteValue,
  requestFromPlugin,
  disabled = false,
  compactDisplay = false,
  className = '',
}: MarkdownPreviewProps): React$Node {
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<?string>(null)

  // Determine which note to load (priority: sourceNoteValue > noteFilename > noteTitle)
  const noteToLoad = sourceNoteValue || noteFilename || noteTitle || null

  // Load markdown content
  useEffect(() => {
    const loadContent = async () => {
      // If we have static markdown text, use that
      if (markdownText) {
        setLoading(true)
        try {
          if (requestFromPlugin) {
            const html = await requestFromPlugin('renderMarkdown', { markdown: markdownText })
            if (typeof html === 'string') {
              setHtmlContent(html)
              setError(null)
            } else {
              throw new Error('Invalid response from renderMarkdown')
            }
          } else {
            // Fallback: just display the markdown as-is (could be enhanced with client-side rendering)
            setHtmlContent(`<pre class="markdown-preview-static">${markdownText}</pre>`)
            setError(null)
          }
        } catch (err) {
          logError('MarkdownPreview', `Failed to render markdown: ${err.message}`)
          setError(err.message)
          setHtmlContent('')
        } finally {
          setLoading(false)
        }
      } else if (noteToLoad && requestFromPlugin) {
        // Load note content
        setLoading(true)
        try {
          logDebug('MarkdownPreview', `Loading note: ${noteToLoad}`)
          const html = await requestFromPlugin('getNoteContentAsHTML', {
            noteIdentifier: noteToLoad,
            isFilename: Boolean(noteFilename || sourceNoteValue),
            isTitle: Boolean(noteTitle && !noteFilename && !sourceNoteValue),
          })
          if (typeof html === 'string') {
            setHtmlContent(html)
            setError(null)
          } else {
            throw new Error('Invalid response from getNoteContentAsHTML')
          }
        } catch (err) {
          logError('MarkdownPreview', `Failed to load note: ${err.message}`)
          setError(err.message)
          setHtmlContent('')
        } finally {
          setLoading(false)
        }
      } else {
        // No content to display
        setHtmlContent('')
        setError(null)
        setLoading(false)
      }
    }

    loadContent()
  }, [markdownText, noteToLoad, noteFilename, noteTitle, sourceNoteValue, requestFromPlugin])

  const labelElement = label ? (
    <div className={`markdown-preview-label ${compactDisplay ? 'compact' : ''}`}>{label}</div>
  ) : null

  return (
    <div
      className={`markdown-preview-container ${compactDisplay ? 'compact' : ''} ${className} ${disabled ? 'disabled' : ''}`}
      data-field-type="markdown-preview"
    >
      {labelElement}
      <div className="markdown-preview-content">
        {loading && <div className="markdown-preview-loading">Loading...</div>}
        {error && <div className="markdown-preview-error">Error: {error}</div>}
        {!loading && !error && htmlContent && (
          <div
            className="markdown-preview-html"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        )}
        {!loading && !error && !htmlContent && (
          <div className="markdown-preview-empty">No content to display</div>
        )}
      </div>
    </div>
  )
}

