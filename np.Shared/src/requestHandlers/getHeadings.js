// @flow
//--------------------------------------------------------------------------
// Shared Request Handler: getHeadings
// Returns list of headings from a specified note
//--------------------------------------------------------------------------

import { getNoteByFilename } from '@helpers/note'
import { getHeadingsFromNote } from '@helpers/NPnote'
import { logDebug, logError } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Get list of headings from a specified note
 * @param {Object} params - Request parameters
 * @param {string} params.noteFilename - Filename of the note to get headings from
 * @param {boolean} params.optionAddTopAndBottom - Add "top" and "bottom" options (default: true)
 * @param {boolean} params.includeArchive - Include archived headings (default: false)
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {RequestResponse}
 */
export function getHeadings(params: { noteFilename: string, optionAddTopAndBottom?: boolean, includeArchive?: boolean }, pluginJson: any): RequestResponse {
  const startTime: number = Date.now()
  try {
    logDebug(pluginJson, `[np.Shared/requestHandlers] getHeadings START: noteFilename="${params.noteFilename}"`)

    if (!params.noteFilename) {
      return {
        success: false,
        message: 'Note filename is required',
        data: null,
      }
    }

    // Get the note by filename
    const note = getNoteByFilename(params.noteFilename)
    if (!note) {
      return {
        success: false,
        message: `Note not found: ${params.noteFilename}`,
        data: null,
      }
    }

    // Get headings from the note
    const optionAddTopAndBottom = params.optionAddTopAndBottom ?? true
    const includeArchive = params.includeArchive ?? false
    const headings = getHeadingsFromNote(note, false, optionAddTopAndBottom, false, includeArchive)

    const totalElapsed: number = Date.now() - startTime
    logDebug(pluginJson, `[np.Shared/requestHandlers] getHeadings COMPLETE: totalElapsed=${totalElapsed}ms, found=${headings.length} headings`)

    return {
      success: true,
      data: headings,
    }
  } catch (error) {
    const totalElapsed: number = Date.now() - startTime
    logError(pluginJson, `[np.Shared/requestHandlers] getHeadings ERROR: totalElapsed=${totalElapsed}ms, error="${error.message}"`)
    return {
      success: false,
      message: `Failed to get headings: ${error.message}`,
      data: null,
    }
  }
}


