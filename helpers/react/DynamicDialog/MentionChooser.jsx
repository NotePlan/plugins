// @flow
//--------------------------------------------------------------------------
// MentionChooser Component
// A multi-select chooser for mentions using ContainedMultiSelectChooser
//--------------------------------------------------------------------------

import React, { useState, useEffect, useCallback } from 'react'
import ContainedMultiSelectChooser from './ContainedMultiSelectChooser.jsx'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import './MentionChooser.css'

export type MentionChooserProps = {
  label?: string,
  value?: string | Array<string>, // Can be string "@mention1,@mention2" or array ["@mention1", "@mention2"]
  onChange: (value: string | Array<string>) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  returnAsArray?: boolean, // If true, return as array, otherwise return as comma-separated string (default: false)
  defaultChecked?: boolean, // If true, all items checked by default (default: false)
  includePattern?: string, // Regex pattern to include mentions
  excludePattern?: string, // Regex pattern to exclude mentions
  maxHeight?: string, // Max height for scrollable list (default: '200px')
  allowCreate?: boolean, // If true, show "+New" button to create new mentions (default: true)
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Function to request data from plugin
}

/**
 * MentionChooser Component
 * A multi-select chooser for mentions
 * @param {MentionChooserProps} props
 * @returns {React$Node}
 */
export function MentionChooser({
  label,
  value,
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search mentions...',
  returnAsArray = false,
  defaultChecked = false,
  includePattern = '',
  excludePattern = '',
  maxHeight = '200px',
  allowCreate = true,
  requestFromPlugin,
}: MentionChooserProps): React$Node {
  const [mentions, setMentions] = useState<Array<string>>([])
  const [loaded, setLoaded] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)

  // Load mentions from plugin via REQUEST
  // Delay the request to yield to TOC rendering and other critical UI elements
  // This prevents blocking the initial render with data loading
  useEffect(() => {
    if (requestFromPlugin && !loaded && !loading) {
      // Use setTimeout to delay the request, allowing TOC and other UI to render first
      const timeoutId = setTimeout(() => {
        setLoading(true)
        logDebug('MentionChooser', 'Loading mentions from plugin (delayed)')
        requestFromPlugin('getMentions', {})
          .then((mentionsData: Array<string>) => {
            if (Array.isArray(mentionsData)) {
              // DataStore.mentions returns items without @ prefix, so we can use them directly
              setMentions(mentionsData)
              setLoaded(true)
              logDebug('MentionChooser', `Loaded ${mentionsData.length} mentions`)
            } else {
              logError('MentionChooser', 'Invalid response format from getMentions')
              setMentions([])
              setLoaded(true)
            }
          })
          .catch((error) => {
            logError('MentionChooser', `Failed to load mentions: ${error.message}`)
            setMentions([])
            setLoaded(true)
          })
          .finally(() => {
            setLoading(false)
          })
      }, 200) // 200ms delay to yield to TOC rendering

      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [requestFromPlugin, loaded, loading])

  // Function to format mention for display (add @ prefix only if not already present)
  // Memoized with useCallback to prevent recreation on every render
  const getItemDisplayLabel = useCallback((mention: string): string => {
    return mention.startsWith('@') ? mention : `@${mention}`
  }, [])

  // Handle creating a new mention
  // Note: Mentions in NotePlan are derived from notes, so we can't "create" them in DataStore
  // Instead, we add the new mention to our local list so it can be selected and used in the form
  const handleCreateMention = useCallback(
    async (newMention: string): Promise<void> => {
      // Remove @ prefix if present (we store mentions without prefix internally)
      const cleanedMention = newMention.startsWith('@') ? newMention.substring(1) : newMention
      const trimmedMention = cleanedMention.trim()

      if (!trimmedMention) {
        return
      }

      // Add the new mention to our local list if it doesn't already exist
      setMentions((prev) => {
        if (!prev.includes(trimmedMention)) {
          logDebug('MentionChooser', `Added new mention to local list: ${trimmedMention}`)
          return [...prev, trimmedMention]
        }
        return prev
      })
    },
    [],
  )

  return (
    <div className="mention-chooser-wrapper" data-field-type="mention-chooser">
      <ContainedMultiSelectChooser
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled || loading}
        compactDisplay={compactDisplay}
        placeholder={loading ? 'Loading mentions...' : placeholder}
        items={mentions}
        getItemDisplayLabel={getItemDisplayLabel}
        returnAsArray={returnAsArray}
        defaultChecked={defaultChecked}
        includePattern={includePattern}
        excludePattern={excludePattern}
        maxHeight={maxHeight}
        emptyMessageNoItems="No mentions available"
        emptyMessageNoMatch="No mentions match"
        fieldType="mention-chooser"
        allowCreate={allowCreate}
        onCreate={handleCreateMention}
      />
    </div>
  )
}

export default MentionChooser
