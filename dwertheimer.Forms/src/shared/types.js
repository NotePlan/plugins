// @flow
//--------------------------------------------------------------------------
// Shared Types - Used by both React components and back-end code
// These types have no back-end dependencies and can be safely imported by React
//--------------------------------------------------------------------------

/**
 * Data structure passed to React windows from the plugin
 */
export type PassedData = {
  startTime?: Date /* used for timing/debugging */,
  title?: string /* React Window Title */,
  width?: number /* React Window Width */,
  height?: number /* React Window Height */,
  pluginData: any /* Your plugin's data to pass on first launch (or edited later) */,
  ENV_MODE?: 'development' | 'production',
  debug: boolean /* set based on ENV_MODE above */,
  logProfilingMessage: boolean /* whether you want to see profiling messages on React redraws (not super interesting) */,
  returnPluginCommand: { id: string, command: string } /* plugin jsFunction that will receive comms back from the React window */,
  componentPath: string /* the path to the rolled up webview bundle. should be ../pluginID/react.c.WebView.bundle.* */,
  passThroughVars?: any /* any data you want to pass through to the React Window */,
}

/**
 * Standardized response type for all request handlers
 */
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

