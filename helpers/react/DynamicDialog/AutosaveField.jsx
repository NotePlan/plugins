// @flow
//--------------------------------------------------------------------------
// Autosave field component for DynamicDialog.
// Automatically saves form state periodically with debouncing.
//--------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { logDebug, logError } from '@helpers/react/reactDev'

type AutosaveFieldProps = {
  label?: string,
  updatedSettings: { [key: string]: any }, // Current form state
  requestFromPlugin?: (command: string, dataToSend?: any, timeout?: number) => Promise<any>,
  autosaveInterval?: number, // Interval in seconds (default: 2)
  autosaveFilename?: string, // Filename pattern (default: "@Trash/Autosave-<ISO8601>")
  formTitle?: string, // Form title to include in filename
  templateFilename?: string, // Template filename for form identification
  templateTitle?: string, // Template title for form identification
  compactDisplay?: boolean,
  disabled?: boolean,
  invisible?: boolean, // If true, hide the UI but still perform autosaves
  onRegisterTrigger?: (triggerFn: () => Promise<void>) => void, // Callback to register trigger function
}

/**
 * Formats a time difference in a human-readable format
 */
const formatTimeAgo = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.floor(seconds)} sec${seconds !== 1 ? 's' : ''} ago`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    return `${minutes} min${minutes !== 1 ? 's' : ''} ago`
  } else {
    const hours = Math.floor(seconds / 3600)
    return `${hours} hr${hours !== 1 ? 's' : ''} ago`
  }
}

/**
 * Generates a filename with ISO 8601 timestamp and optional form title
 */
const generateAutosaveFilename = (pattern?: string, formTitle?: string): string => {
  // Generate ISO 8601 timestamp (local timezone) - only once at startup
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const timestamp = `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`

  // Sanitize form title for use in filename (remove special characters)
  const sanitizedFormTitle = formTitle
    ? formTitle
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .substring(0, 50) // Limit length
        .trim()
    : ''

  // Build base pattern
  const defaultPattern = sanitizedFormTitle ? `@Trash/Autosave-<formTitle>-<ISO8601>` : '@Trash/Autosave-<ISO8601>'
  let basePattern = pattern || defaultPattern

  // Replace form title placeholder first (if present) - support both <formTitle> and <FORM_NAME>
  if (basePattern.includes('<formTitle>') || basePattern.includes('<FORM_NAME>')) {
    if (sanitizedFormTitle) {
      basePattern = basePattern.replace('<formTitle>', sanitizedFormTitle).replace('<FORM_NAME>', sanitizedFormTitle)
    } else {
      // Remove the placeholder and any surrounding dashes if no form title
      basePattern = basePattern.replace(/-?<formTitle>-?/g, '').replace(/-?<FORM_NAME>-?/g, '')
    }
  }

  // Replace timestamp placeholders
  basePattern = basePattern.replace('<ISO8601>', timestamp).replace('<timestamp>', timestamp)

  // If form title wasn't in pattern and we have one, add it before the timestamp
  if (sanitizedFormTitle && !basePattern.includes(sanitizedFormTitle)) {
    // Insert form title before the timestamp or at the end
    if (basePattern.includes(timestamp)) {
      basePattern = basePattern.replace(timestamp, `${sanitizedFormTitle}-${timestamp}`)
    } else {
      basePattern = `${basePattern}-${sanitizedFormTitle}`
    }
  }

  return basePattern
}

const AutosaveField = ({
  label,
  updatedSettings,
  requestFromPlugin,
  autosaveInterval = 2,
  autosaveFilename,
  formTitle,
  templateFilename,
  templateTitle,
  compactDisplay = false,
  disabled = false,
  invisible = false,
  onRegisterTrigger,
}: AutosaveFieldProps): React$Node => {
  const [lastSaveTime, setLastSaveTime] = useState<?Date>(null)
  const [timeAgo, setTimeAgo] = useState<string>('Never saved')
  const [isSaving, setIsSaving] = useState(false)
  const lastSavedStateRef = useRef<string>('')
  const saveTimerRef = useRef<?TimeoutID>(null)
  const timeAgoTimerRef = useRef<?IntervalID>(null)
  const autosaveFilenameRef = useRef<?string>(null) // Store filename generated at startup
  const updatedSettingsRef = useRef<{ [key: string]: any }>(updatedSettings) // Store latest settings for debounced save
  const intervalMs = autosaveInterval * 1000

  // Keep ref updated with latest settings
  useEffect(() => {
    updatedSettingsRef.current = updatedSettings
  }, [updatedSettings])

  // Generate filename once at startup, or regenerate if formTitle becomes available
  useEffect(() => {
    const pattern = autosaveFilename || '@Trash/Autosave-<ISO8601>'
    const needsFormTitle = pattern.includes('<formTitle>') || pattern.includes('<FORM_NAME>')

    // Generate filename if:
    // 1. We don't have one yet, OR
    // 2. Pattern needs formTitle, we have formTitle now, and our current filename doesn't include a sanitized version of it
    let shouldGenerate = !autosaveFilenameRef.current

    if (!shouldGenerate && needsFormTitle && formTitle) {
      const currentFilename = autosaveFilenameRef.current
      if (currentFilename) {
        // Check if current filename includes the sanitized form title
        const sanitized = formTitle
          .replace(/[^a-zA-Z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 50)
          .trim()
        shouldGenerate = !currentFilename.includes(sanitized)
      }
    }

    if (shouldGenerate) {
      const generatedFilename = generateAutosaveFilename(autosaveFilename, formTitle)
      autosaveFilenameRef.current = generatedFilename
      logDebug('AutosaveField', `Generated autosave filename: ${autosaveFilenameRef.current} (formTitle: ${formTitle || 'none'}, pattern: ${pattern})`)
    }
  }, [formTitle, autosaveFilename]) // Regenerate if formTitle or pattern changes

  // Serialize form state for comparison
  const serializeState = useCallback((state: { [key: string]: any }): string => {
    try {
      // Sort keys for consistent comparison
      const sorted: { [key: string]: any } = Object.keys(state)
        .sort()
        .reduce((acc: { [key: string]: any }, key: string) => {
          acc[key] = state[key]
          return acc
        }, {})
      return JSON.stringify(sorted)
    } catch (error) {
      logError('AutosaveField', `Error serializing state: ${error.message}`)
      return ''
    }
  }, [])

  // Save function that sends to plugin (reads from ref to avoid dependency on updatedSettings)
  const performSave = useCallback(
    async (force: boolean = false): Promise<void> => {
      if (!requestFromPlugin || disabled) {
        return Promise.resolve()
      }

      // Read latest settings from ref (this avoids dependency on updatedSettings)
      const latestSettings = updatedSettingsRef.current
      const currentState = serializeState(latestSettings)

      // Only save if state has changed (unless forced)
      if (!force && currentState === lastSavedStateRef.current) {
        logDebug('AutosaveField', 'State unchanged, skipping save')
        return Promise.resolve()
      }

      try {
        setIsSaving(true)
        const filename = autosaveFilenameRef.current || generateAutosaveFilename(autosaveFilename, formTitle)

        logDebug('AutosaveField', `Saving form state to ${filename}`)

        // Add lastUpdated timestamp and form identification to form state
        const stateWithTimestamp = {
          ...latestSettings,
          lastUpdated: new Date().toLocaleString(), // Local timestamp
          __formTitle__: formTitle || '', // Form title for restoration
          __templateFilename__: templateFilename || '', // Template filename for restoration
          __templateTitle__: templateTitle || '', // Template title for restoration
        }

        // Send to plugin asynchronously
        // Use a code block format as suggested
        const formStateCode = `\`\`\`json
${JSON.stringify(stateWithTimestamp, null, 2)}
\`\`\``

        // Await the save to ensure it completes before form submission
        await requestFromPlugin('saveAutosave', {
          filename,
          content: formStateCode,
          formState: stateWithTimestamp, // Also send as object for easier parsing (with timestamp)
        })

        // Update last saved state and time
        lastSavedStateRef.current = currentState
        const now = new Date()
        setLastSaveTime(now)
        setTimeAgo('Just now')

        logDebug('AutosaveField', 'Autosave completed successfully')
      } catch (error) {
        logError('AutosaveField', `Error in performSave: ${error.message}`)
        throw error // Re-throw so caller knows it failed
      } finally {
        setIsSaving(false)
      }
    },
    [requestFromPlugin, autosaveFilename, formTitle, templateFilename, templateTitle, serializeState, disabled],
  )

  // Create a stable trigger function using useRef to prevent re-registration on every render
  // CRITICAL: Use ref to ensure same function reference across renders, preventing duplicate registrations
  const triggerSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  triggerSaveRef.current = () => performSave(true) // Update implementation, but keep same reference

  // Register trigger function with parent ONCE (not on every render)
  const hasRegisteredRef = useRef<boolean>(false)
  useEffect(() => {
    if (onRegisterTrigger && !hasRegisteredRef.current) {
      onRegisterTrigger(triggerSaveRef.current)
      hasRegisteredRef.current = true
      logDebug('AutosaveField', 'Registered autosave trigger (one-time)')
    }
    // Cleanup: reset registration flag if onRegisterTrigger changes (shouldn't happen, but just in case)
    return () => {
      if (!onRegisterTrigger) {
        hasRegisteredRef.current = false
      }
    }
  }, [onRegisterTrigger]) // Only depend on onRegisterTrigger, not performSave

  // Update time ago display
  useEffect(() => {
    if (!lastSaveTime) {
      setTimeAgo('Never saved')
      return
    }

    const updateTimeAgo = () => {
      if (!lastSaveTime) return
      const now = new Date()
      const diffSeconds = Math.floor((now.getTime() - lastSaveTime.getTime()) / 1000)
      setTimeAgo(formatTimeAgo(diffSeconds))
    }

    // Update immediately
    updateTimeAgo()

    // Update every second
    timeAgoTimerRef.current = (window.setInterval(updateTimeAgo, 1000): any)

    return () => {
      if (timeAgoTimerRef.current) {
        clearInterval((timeAgoTimerRef.current: any))
      }
    }
  }, [lastSaveTime])

  // Debounced save effect (only depends on updatedSettings and intervalMs, not performSave)
  // CRITICAL: Disable autosave timer when disabled prop is true (e.g., during form submission)
  useEffect(() => {
    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout((saveTimerRef.current: any))
      saveTimerRef.current = null
    }

    // Don't set timer if disabled (e.g., during form submission)
    if (disabled) {
      logDebug('AutosaveField', 'Autosave timer disabled - not setting save timer')
      return
    }

    // Set new timer to save after interval
    // Use a stable reference to performSave via closure
    saveTimerRef.current = (window.setTimeout(() => {
      performSave(false) // Regular autosave, don't force
    }, intervalMs): any)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout((saveTimerRef.current: any))
        saveTimerRef.current = null
      }
    }
  }, [updatedSettings, intervalMs, disabled]) // Added disabled to dependencies - clears timer when disabled becomes true

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout((saveTimerRef.current: any))
      }
      if (timeAgoTimerRef.current) {
        clearInterval((timeAgoTimerRef.current: any))
      }
    }
  }, [])

  // If invisible, don't render UI but keep autosave functionality running
  if (invisible) {
    return null
  }

  return (
    <div className={`autosave-field-container ${compactDisplay ? 'compact' : ''} ${disabled ? 'disabled' : ''}`}>
      <div className="autosave-field-status">
        {isSaving ? <span className="autosave-field-saving">Saving...</span> : <span className="autosave-field-saved">Autosaved {timeAgo}</span>}
      </div>
    </div>
  )
}

export default AutosaveField
