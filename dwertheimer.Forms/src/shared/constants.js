// @flow
//--------------------------------------------------------------------------
// Shared Constants - Used by both React components and back-end code
// These constants have no back-end dependencies and can be safely imported by React
//--------------------------------------------------------------------------

import pluginJson from '../../plugin.json'

/**
 * Base window ID for Form Builder React windows
 * Individual windows will append the template title/filename to make them unique
 */
export const FORMBUILDER_WINDOW_ID = `${pluginJson['plugin.id']} Form Builder React Window`

/**
 * Window ID for the Form Entry React window
 */
export const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']} Form Entry React Window`
