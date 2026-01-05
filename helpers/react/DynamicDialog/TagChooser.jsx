// @flow
//--------------------------------------------------------------------------
// TagChooser Component
// A multi-select chooser for hashtags using ContainedMultiSelectChooser
//--------------------------------------------------------------------------

import React, { useState, useEffect, useCallback } from 'react'
import ContainedMultiSelectChooser from './ContainedMultiSelectChooser.jsx'
import { logDebug, logError } from '@helpers/react/reactDev.js'
import './TagChooser.css'

export type TagChooserProps = {
  label?: string,
  value?: string | Array<string>, // Can be string "#tag1,#tag2" or array ["#tag1", "#tag2"]
  onChange: (value: string | Array<string>) => void,
  disabled?: boolean,
  compactDisplay?: boolean,
  placeholder?: string,
  returnAsArray?: boolean, // If true, return as array, otherwise return as comma-separated string (default: false)
  defaultChecked?: boolean, // If true, all items checked by default (default: false)
  includePattern?: string, // Regex pattern to include tags
  excludePattern?: string, // Regex pattern to exclude tags
  maxHeight?: string, // Max height for scrollable list (default: '200px')
  allowCreate?: boolean, // If true, show "+New" button to create new tags (default: true)
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>, // Function to request data from plugin
}

/**
 * TagChooser Component
 * A multi-select chooser for hashtags
 * @param {TagChooserProps} props
 * @returns {React$Node}
 */
export function TagChooser({
  label,
  value,
  onChange,
  disabled = false,
  compactDisplay = false,
  placeholder = 'Type to search hashtags...',
  returnAsArray = false,
  defaultChecked = false,
  includePattern = '',
  excludePattern = '',
  maxHeight = '200px',
  allowCreate = true,
  requestFromPlugin,
}: TagChooserProps): React$Node {
  const [hashtags, setHashtags] = useState<Array<string>>([])
  const [loaded, setLoaded] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)

  // Load hashtags from plugin via REQUEST
  // Delay the request to yield to TOC rendering and other critical UI elements
  // This prevents blocking the initial render with data loading
  useEffect(() => {
    if (requestFromPlugin && !loaded && !loading) {
      // Use setTimeout to delay the request, allowing TOC and other UI to render first
      const timeoutId = setTimeout(() => {
        setLoading(true)
        logDebug('TagChooser', 'Loading hashtags from plugin (delayed)')
        requestFromPlugin('getHashtags', {})
          .then((hashtagsData: Array<string>) => {
            if (Array.isArray(hashtagsData)) {
              // DataStore.hashtags returns items without # prefix, so we can use them directly
              setHashtags(hashtagsData)
              setLoaded(true)
              logDebug('TagChooser', `Loaded ${hashtagsData.length} hashtags`)
            } else {
              logError('TagChooser', 'Invalid response format from getHashtags')
              setHashtags([])
              setLoaded(true)
            }
          })
          .catch((error) => {
            logError('TagChooser', `Failed to load hashtags: ${error.message}`)
            setHashtags([])
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

  // Function to format hashtag for display (add # prefix only if not already present)
  // Memoized with useCallback to prevent recreation on every render
  const getItemDisplayLabel = useCallback((tag: string): string => {
    return tag.startsWith('#') ? tag : `#${tag}`
  }, [])

  // Handle creating a new tag
  // Note: Tags in NotePlan are derived from notes, so we can't "create" them in DataStore
  // Instead, we add the new tag to our local list so it can be selected and used in the form
  const handleCreateTag = useCallback(
    async (newTag: string): Promise<void> => {
      // Remove # prefix if present (we store tags without prefix internally)
      const cleanedTag = newTag.startsWith('#') ? newTag.substring(1) : newTag
      const trimmedTag = cleanedTag.trim()

      if (!trimmedTag) {
        return
      }

      // Add the new tag to our local list if it doesn't already exist
      setHashtags((prev) => {
        if (!prev.includes(trimmedTag)) {
          logDebug('TagChooser', `Added new tag to local list: ${trimmedTag}`)
          return [...prev, trimmedTag]
        }
        return prev
      })
    },
    [],
  )

  return (
    <div className="tag-chooser-wrapper" data-field-type="tag-chooser">
      <ContainedMultiSelectChooser
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled || loading}
        compactDisplay={compactDisplay}
        placeholder={loading ? 'Loading hashtags...' : placeholder}
        items={hashtags}
        getItemDisplayLabel={getItemDisplayLabel}
        returnAsArray={returnAsArray}
        defaultChecked={defaultChecked}
        includePattern={includePattern}
        excludePattern={excludePattern}
        maxHeight={maxHeight}
        emptyMessageNoItems="No hashtags available"
        emptyMessageNoMatch="No hashtags match"
        fieldType="tag-chooser"
        allowCreate={allowCreate}
        onCreate={handleCreateTag}
      />
    </div>
  )
}

export default TagChooser
