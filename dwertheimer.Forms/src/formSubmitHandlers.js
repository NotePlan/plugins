// @flow
//--------------------------------------------------------------------------
// Form Submit Request Handlers
// Handlers for requests from FormView component (form submission)
// REQUEST/RESPONSE path does not read or write reactWindowData; form is loaded by filename.
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { getGlobalSharedData, sendToHTMLWindow, sendBannerMessage } from '../../helpers/HTMLView'
import { handleSubmitButtonClick } from './formSubmission'
import { loadTemplateBodyFromTemplate, loadNewNoteFrontmatterFromTemplate } from './templateIO'
import { WEBVIEW_WINDOW_ID, getFormWindowId, findFormWindowId } from './windowManagement'
import { closeWindowFromCustomId } from '@helpers/NPWindows'
import { loadCodeBlockFromNote } from '@helpers/codeBlocks'
import { getNoteByFilename } from '@helpers/note'
import { parseObjectString, stripDoubleQuotes } from '@helpers/stringTransforms'
import { logDebug, logError, clo } from '@helpers/dev'

// RequestResponse type definition (shared with other handler files)
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get window ID for form submission, with fallback strategies
 * @param {Object} data - Request data with optional windowId
 * @returns {Promise<string>} - The window ID to use
 */
export async function getFormWindowIdForSubmission(data: any): Promise<string> {
  // Window ID lookup: __windowId (from REQUEST bridge), then windowId from data, then fallback strategies
  let windowId = data?.__windowId || data?.windowId || ''

  // If windowId was provided in data, use it directly
  if (windowId) {
    try {
      await getGlobalSharedData(windowId)
      logDebug(pluginJson, `getFormWindowIdForSubmission: Using windowId from data: ${windowId}`)
      return windowId
    } catch (e) {
      logDebug(pluginJson, `getFormWindowIdForSubmission: Could not get window data with provided windowId: ${windowId}, falling back to search`)
      windowId = '' // Reset to trigger fallback
    }
  }

  // Fallback strategies if windowId not provided or lookup failed
  if (!windowId) {
    // Strategy 1: Try to find window by looking at all open windows (most reliable for dynamic IDs)
    windowId = findFormWindowId() || WEBVIEW_WINDOW_ID

    // Strategy 2: Try to get window data using the found/fallback window ID
    try {
      const reactWindowData = await getGlobalSharedData(windowId)
      // If we got window data, use the windowId from it if available (most reliable)
      if (reactWindowData?.pluginData?.windowId) {
        windowId = reactWindowData.pluginData.windowId
        // Re-fetch with the correct window ID if different
        if (windowId !== WEBVIEW_WINDOW_ID) {
          try {
            await getGlobalSharedData(windowId)
          } catch (e) {
            logDebug(pluginJson, `getFormWindowIdForSubmission: Could not re-fetch with corrected windowId: ${windowId}`)
          }
        }
      } else if (reactWindowData?.pluginData?.formTitle) {
        // Reconstruct window ID from form title if we have it
        const reconstructedId = getFormWindowId(reactWindowData.pluginData.formTitle)
        if (reconstructedId !== windowId) {
          windowId = reconstructedId
          try {
            await getGlobalSharedData(windowId)
          } catch (e) {
            logDebug(pluginJson, `getFormWindowIdForSubmission: Could not fetch with reconstructed windowId: ${windowId}`)
          }
        }
      }
    } catch (e) {
      // Strategy 3: Fallback - try base WEBVIEW_WINDOW_ID for backward compatibility
      if (windowId !== WEBVIEW_WINDOW_ID) {
        try {
          const tempWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
          if (tempWindowData?.pluginData?.windowId) {
            windowId = tempWindowData.pluginData.windowId
            await getGlobalSharedData(windowId)
          } else if (tempWindowData) {
            // Use base ID window data if available
            windowId = WEBVIEW_WINDOW_ID
          }
        } catch (e2) {
          logDebug(pluginJson, `getFormWindowIdForSubmission: Could not get window data with base ID either`)
        }
      }
    }
  }

  return windowId
}

/**
 * Load form definition and template content from the form file (by filename).
 * Used by REQUEST/RESPONSE submit so we do not read reactWindowData.
 * @param {string} formTemplateFilename - Filename of the form template note
 * @returns {Promise<{ formFields: Array<Object>, templateBody: string, newNoteTitle: string, newNoteFolder: string, newNoteFrontmatter: string } | null>}
 */
export async function loadFormContextFromFilename(
  formTemplateFilename: string,
): Promise<{
  formFields: Array<Object>,
  templateBody: string,
  newNoteTitle: string,
  newNoteFolder: string,
  newNoteFrontmatter: string,
} | null> {
  if (!formTemplateFilename || !formTemplateFilename.trim()) {
    return null
  }
  try {
    const templateNote = await getNoteByFilename(formTemplateFilename)
    if (!templateNote) {
      logError(pluginJson, `loadFormContextFromFilename: Template not found: ${formTemplateFilename}`)
      return null
    }
    const fm = templateNote.frontmatterAttributes || {}
    let formFields: Array<Object> = []
    try {
      const loaded = await loadCodeBlockFromNote<Array<any>>(formTemplateFilename, 'formfields', pluginJson.id, parseObjectString)
      if (loaded && Array.isArray(loaded)) {
        formFields = loaded
      }
    } catch (e) {
      logError(pluginJson, `loadFormContextFromFilename: Error loading formFields: ${e instanceof Error ? e.message : String(e)}`)
    }
    const templateBody = (await loadTemplateBodyFromTemplate(formTemplateFilename)) || ''
    const newNoteFrontmatter = (await loadNewNoteFrontmatterFromTemplate(formTemplateFilename)) || ''
    return {
      formFields,
      templateBody,
      newNoteTitle: stripDoubleQuotes(fm?.newNoteTitle || '') || '',
      newNoteFolder: stripDoubleQuotes(fm?.newNoteFolder || '') || '',
      newNoteFrontmatter,
    }
  } catch (error) {
    logError(pluginJson, `loadFormContextFromFilename: Error: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

/**
 * Execute form submission as a REQUEST (no SET_DATA, no close).
 * Used when front-end calls requestFromPlugin('submitForm', payload).
 * Does not read or write reactWindowData: requires formTemplateFilename and loads the form from the file.
 * Returns { success, data: { formSubmissionError?, aiAnalysisResult? }, message } so the form can display errors before closing.
 *
 * @param {Object} data - Request payload (formValues, formTemplateFilename, processingMethod, etc.)
 * @returns {Promise<RequestResponse>}
 */
export async function submitFormRequest(data: any): Promise<RequestResponse> {
  logDebug(pluginJson, `submitFormRequest: Called (REQUEST path - no reactWindowData), formTemplateFilename="${data?.formTemplateFilename || 'NOT SET'}"`)
  try {
    const formTemplateFilename = data?.formTemplateFilename || ''
    if (!formTemplateFilename || !formTemplateFilename.trim()) {
      logError(pluginJson, `submitFormRequest: formTemplateFilename is required; form must submit the filename of the form that was filled out.`)
      return {
        success: false,
        message: 'Form template filename is required. The form must submit the filename of the form that was filled out.',
        data: { formSubmissionError: 'Form template filename is required.' },
      }
    }
    logDebug(pluginJson, `submitFormRequest: Loading form from file "${formTemplateFilename}"`)
    const formContext = await loadFormContextFromFilename(formTemplateFilename)
    if (!formContext) {
      return {
        success: false,
        message: `Could not load form from "${formTemplateFilename}". Template not found or invalid.`,
        data: { formSubmissionError: `Could not load form from "${formTemplateFilename}".` },
      }
    }
    // Minimal PassedData-shaped object so handleSubmitButtonClick can read pluginData; we never read/write reactWindowData in this path
    const fakeWindowData = {
      pluginData: formContext,
      componentPath: '',
      debug: false,
      logProfilingMessage: false,
      returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFormSubmitFromHTMLView' },
    }
    logDebug(pluginJson, `submitFormRequest: [DIAG] calling handleSubmitButtonClick with loaded form (no reactWindowData)`)
    const returnValue = await handleSubmitButtonClick(data, fakeWindowData)
    const hasError = returnValue?.pluginData?.formSubmissionError
    const success = returnValue !== null && !hasError
    const responseData = {
      formSubmissionError: returnValue?.pluginData?.formSubmissionError,
      aiAnalysisResult: returnValue?.pluginData?.aiAnalysisResult,
    }
    logDebug(
      pluginJson,
      `submitFormRequest: handleSubmitButtonClick done, success=${String(success)}, hasFormSubmissionError=${String(!!hasError)}`,
    )
    return {
      success,
      data: responseData,
      message: success ? 'Form submitted' : (hasError || 'Form submission failed'),
    }
  } catch (error) {
    logError(pluginJson, `submitFormRequest: Error: ${error.message}`)
    return {
      success: false,
      message: `Form submission error: ${error.message}`,
      data: { formSubmissionError: error.message || 'Form submission failed' },
    }
  }
}

/**
 * Handle form submission action (onSubmitClick)
 * @param {Object} data - Request data
 * @param {Object} reactWindowData - Window data from React
 * @param {string} windowId - Window ID (already determined by router)
 * @returns {Promise<RequestResponse>}
 */
// Track recent SET_DATA sends to prevent loops (key: windowId, value: last send time)
const recentSetDataSends = new Map<string, number>()

/**
 * Clean up old entries from recentSetDataSends (older than 5 seconds)
 * This is called proactively when we interact with the Map, avoiding the need for setTimeout
 */
function cleanupOldSetDataSends(): void {
  const now = Date.now()
  const maxAge = 5000 // 5 seconds
  for (const [windowId, timestamp] of recentSetDataSends.entries()) {
    if (now - timestamp > maxAge) {
      recentSetDataSends.delete(windowId)
    }
  }
}

export async function handleFormSubmitAction(data: any, reactWindowData: any, windowId: string): Promise<RequestResponse> {
  logDebug(pluginJson, `[BACK-END] handleFormSubmitAction: Called from front-end (onSubmitClick), windowId="${windowId}"`)
  try {
    if (!reactWindowData) {
      logError(pluginJson, `handleFormSubmitAction: reactWindowData is required`)
      return {
        success: false,
        message: `reactWindowData is required`,
        data: null,
      }
    }
    
    // GUARD: Prevent sending SET_DATA too frequently (within 100ms) to same window
    // Clean up old entries first (proactive cleanup, no setTimeout needed)
    cleanupOldSetDataSends()
    const lastSendTime = recentSetDataSends.get(windowId) || 0
    const timeSinceLastSend = Date.now() - lastSendTime
    if (timeSinceLastSend < 100) {
      logDebug(pluginJson, `[BACK-END] GUARD: handleFormSubmitAction: SET_DATA sent recently (${timeSinceLastSend}ms ago), skipping to prevent loop`)
      // Still return success but don't send SET_DATA
      return {
        success: true,
        message: 'Form submission throttled to prevent loop',
        data: reactWindowData, // Return existing data
      }
    }

    // Merge passThroughVars if provided
    if (data.passThroughVars && reactWindowData.passThroughVars) {
      reactWindowData.passThroughVars = { ...reactWindowData.passThroughVars, ...data.passThroughVars }
    } else if (data.passThroughVars) {
      reactWindowData.passThroughVars = { ...data.passThroughVars }
    }

    logDebug(pluginJson, `[BACK-END] handleFormSubmitAction: Calling handleSubmitButtonClick...`)
    const returnValue = await handleSubmitButtonClick(data, reactWindowData)
    logDebug(pluginJson, `[BACK-END] handleFormSubmitAction: handleSubmitButtonClick returned, returnValue !== null=${String(returnValue !== null)}`)

    // Check if there's an AI analysis result (error message from template rendering)
    const hasAiAnalysis =
      returnValue?.pluginData?.aiAnalysisResult &&
      typeof returnValue.pluginData.aiAnalysisResult === 'string' &&
      returnValue.pluginData.aiAnalysisResult.includes('==**Templating Error Found**')
    
    // Check if there's a form submission error
    const hasFormSubmissionError =
      returnValue?.pluginData?.formSubmissionError &&
      typeof returnValue.pluginData.formSubmissionError === 'string'
    logDebug(
      pluginJson,
      `handleFormSubmitAction: returnValue !== null=${String(returnValue !== null)}, hasAiAnalysis=${String(hasAiAnalysis)}, keepOpenOnSubmit=${String(data.keepOpenOnSubmit)}`,
    )
    logDebug(
      pluginJson,
      `handleFormSubmitAction: returnValue.pluginData.aiAnalysisResult exists=${String(!!returnValue?.pluginData?.aiAnalysisResult)}, length=${
        returnValue?.pluginData?.aiAnalysisResult?.length || 0
      }`,
    )

    // Update window data if it changed (send returnValue, not reactWindowData)
    // Check if pluginData changed (especially aiAnalysisResult) even if object reference is the same
    const hasPluginDataChanges =
      returnValue?.pluginData?.aiAnalysisResult &&
      (!reactWindowData?.pluginData?.aiAnalysisResult || returnValue.pluginData.aiAnalysisResult !== reactWindowData.pluginData.aiAnalysisResult)

    // Always send SET_DATA if there's an AI analysis result or form submission error, even if object reference is the same
    // Check if we need to send SET_DATA (either object changed OR has AI analysis OR has form submission error)
    const hasErrorChanges =
      returnValue?.pluginData?.formSubmissionError &&
      (!reactWindowData?.pluginData?.formSubmissionError || returnValue.pluginData.formSubmissionError !== reactWindowData.pluginData.formSubmissionError)
    const shouldSendSetData = returnValue && (returnValue !== reactWindowData || hasPluginDataChanges || hasAiAnalysis || hasFormSubmissionError || hasErrorChanges)

    if (shouldSendSetData && returnValue) {
      const updateText = hasAiAnalysis
        ? 'AI Analysis Error Detected'
        : hasFormSubmissionError
        ? 'Form Submission Error Detected'
        : `After onSubmitClick, data was updated`
      logDebug(
        pluginJson,
        `[BACK-END] handleFormSubmitAction: Sending SET_DATA to windowId="${windowId}", has aiAnalysisResult=${String(!!returnValue.pluginData?.aiAnalysisResult)}, has formSubmissionError=${String(hasFormSubmissionError)}`,
      )
      logDebug(
        pluginJson,
        `[BACK-END] SET_DATA trigger: returnValue !== reactWindowData=${String(returnValue !== reactWindowData)}, hasPluginDataChanges=${String(hasPluginDataChanges)}, hasAiAnalysis=${String(hasAiAnalysis)}, hasFormSubmissionError=${String(hasFormSubmissionError)}, hasErrorChanges=${String(hasErrorChanges)}`,
      )
      clo(returnValue, `[BACK-END] handleFormSubmitAction: after updating window data,returnValue=`)
      sendToHTMLWindow(windowId, 'SET_DATA', returnValue, updateText)
      // Track that we sent SET_DATA to prevent rapid resends
      recentSetDataSends.set(windowId, Date.now())
      // Clean up old entries proactively (no setTimeout needed - cleanup happens on next check/add)
      cleanupOldSetDataSends()
      logDebug(pluginJson, `[BACK-END] handleFormSubmitAction: SET_DATA sent to windowId="${windowId}"`)
    } else {
      logDebug(pluginJson, `[BACK-END] handleFormSubmitAction: Not sending SET_DATA - returnValue === reactWindowData and no changes`)
    }

    // Close the window after successful submission, unless:
    // 1. keepOpenOnSubmit is true (e.g., for Form Browser context)
    // 2. There's an AI analysis result (keep window open to show the error)
    // 3. There's a form submission error (keep window open to show the error)
    if (returnValue !== null && !data.keepOpenOnSubmit && !hasAiAnalysis && !hasFormSubmissionError) {
      logDebug(pluginJson, `handleFormSubmitAction: Closing window windowId="${windowId}" (no keepOpenOnSubmit, no AI analysis)`)
      closeWindowFromCustomId(windowId)
    } else if (returnValue !== null && (data.keepOpenOnSubmit || hasAiAnalysis || hasFormSubmissionError)) {
      logDebug(
        pluginJson,
        `handleFormSubmitAction: NOT closing window - keepOpenOnSubmit=${String(data.keepOpenOnSubmit)} or hasAiAnalysis=${String(hasAiAnalysis)} or hasFormSubmissionError=${String(hasFormSubmissionError)}`,
      )
    } else if (returnValue === null) {
      logDebug(pluginJson, `handleFormSubmitAction: returnValue is null, not closing window`)
    }

    return {
      success: returnValue !== null,
      message: returnValue !== null ? 'Form submitted successfully' : 'Form submission failed',
      data: returnValue,
    }
  } catch (error) {
    logError(pluginJson, `handleFormSubmitAction: Error: ${error.message}`)
    return {
      success: false,
      message: `Error submitting form: ${error.message}`,
      data: null,
    }
  }
}

/**
 * Handle unknown action type
 * @param {string} actionType - The unknown action type
 * @param {Object} data - Request data
 * @param {string} windowId - Window ID
 * @returns {Promise<RequestResponse>}
 */
export async function handleUnknownAction(actionType: string, data: any, windowId: string): Promise<RequestResponse> {
  await sendBannerMessage(windowId, `Plugin received an unknown actionType: "${actionType}" command with data:\n${JSON.stringify(data)}`, 'ERROR')
  return {
    success: false,
    message: `Unknown actionType: "${actionType}"`,
    data: null,
  }
}
