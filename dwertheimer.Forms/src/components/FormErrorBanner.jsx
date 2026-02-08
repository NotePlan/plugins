// @flow
//--------------------------------------------------------------------------
// FormErrorBanner Component - Reusable error display banner for forms
//--------------------------------------------------------------------------

import React, { useEffect, useState, useRef } from 'react'
import './FormView.css'

type FormErrorBannerProps = {
  aiAnalysisResult?: string, // AI analysis result from template rendering errors
  formSubmissionError?: string, // Form submission error message
  requestFromPlugin?: (command: string, data?: any) => Promise<any>, // Optional: for rendering markdown
  onClose?: () => void, // Optional: callback when banner is closed
}

/**
 * FormErrorBanner - Displays template errors and form submission errors
 * This component can be used in both FormView and FormPreview
 */
const FormErrorBanner = ({
  aiAnalysisResult = '',
  formSubmissionError = '',
  requestFromPlugin,
  onClose,
}: FormErrorBannerProps): React$Node => {
  // State for rendered markdown HTML and visibility
  const [aiAnalysisHtml, setAiAnalysisHtml] = useState<string>('')
  const [showAiAnalysis, setShowAiAnalysis] = useState<boolean>(false)
  const bannerShownRef = useRef<boolean>(false)

  // State for form submission error visibility
  const [showFormSubmissionError, setShowFormSubmissionError] = useState<boolean>(false)
  const formErrorShownRef = useRef<boolean>(false)
  const formErrorLastValueRef = useRef<string>('')

  // Render markdown when AI analysis result is received (only once)
  useEffect(() => {
    if (aiAnalysisResult && typeof aiAnalysisResult === 'string' && aiAnalysisResult.includes('==**Templating Error Found**') && !bannerShownRef.current) {
      bannerShownRef.current = true
      setShowAiAnalysis(true)

      // Render markdown to HTML using requestFromPlugin
      if (requestFromPlugin) {
        requestFromPlugin('renderMarkdown', { markdown: aiAnalysisResult })
          .then((response: any) => {
            // renderMarkdown returns { success: true, data: html }
            const html = response?.data || response
            if (typeof html === 'string') {
              setAiAnalysisHtml(html)
            } else {
              setAiAnalysisHtml(aiAnalysisResult.replace(/\n/g, '<br/>')) // Fallback to simple line breaks
            }
          })
          .catch((error: Error) => {
            setAiAnalysisHtml(aiAnalysisResult.replace(/\n/g, '<br/>')) // Fallback to simple line breaks
          })
      } else {
        // Fallback if requestFromPlugin not available
        setAiAnalysisHtml(aiAnalysisResult.replace(/\n/g, '<br/>'))
      }
    } else if (!aiAnalysisResult) {
      // Reset banner shown flag when AI analysis is cleared
      bannerShownRef.current = false
      setAiAnalysisHtml('')
      setShowAiAnalysis(false)
    }
  }, [aiAnalysisResult, requestFromPlugin])

  // Display form submission error when received; show again when error message changes (e.g. after resubmit)
  useEffect(() => {
    if (formSubmissionError && typeof formSubmissionError === 'string') {
      if (formSubmissionError !== formErrorLastValueRef.current) {
        formErrorLastValueRef.current = formSubmissionError
        formErrorShownRef.current = true
      }
      setShowFormSubmissionError(true)
    } else if (!formSubmissionError) {
      formErrorShownRef.current = false
      formErrorLastValueRef.current = ''
      setShowFormSubmissionError(false)
    }
  }, [formSubmissionError])

  const handleCloseAiAnalysis = () => {
    setShowAiAnalysis(false)
    if (onClose) onClose()
  }

  const handleCloseFormError = () => {
    setShowFormSubmissionError(false)
    if (onClose) onClose()
  }

  if (!showAiAnalysis && !showFormSubmissionError) {
    return null
  }

  return (
    <>
      {/* Display form submission error at the top if present */}
      {showFormSubmissionError && formSubmissionError && (
        <div className="form-ai-analysis-error">
          <div className="form-ai-analysis-header">
            <div className="form-ai-analysis-title">⚠️ Form Submission Error:</div>
            <button
              type="button"
              className="form-ai-analysis-close"
              onClick={handleCloseFormError}
              title="Close"
            >
              ×
            </button>
          </div>
          <div className="form-ai-analysis-content">{formSubmissionError}</div>
        </div>
      )}
      {/* Display AI analysis result at the top if present */}
      {showAiAnalysis && aiAnalysisResult && (
        <div className="form-ai-analysis-error">
          <div className="form-ai-analysis-header">
            <div className="form-ai-analysis-title">⚠️ Template Error - AI Analysis:</div>
            <button
              type="button"
              className="form-ai-analysis-close"
              onClick={handleCloseAiAnalysis}
              title="Close"
            >
              ×
            </button>
          </div>
          {aiAnalysisHtml ? (
            <div
              className="form-ai-analysis-content"
              dangerouslySetInnerHTML={{ __html: aiAnalysisHtml }}
            />
          ) : (
            <div>Loading...</div>
          )}
        </div>
      )}
    </>
  )
}

export default FormErrorBanner
