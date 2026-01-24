// @flow
//--------------------------------------------------------------------------
// Request Handler: addTaskToNote
// Adds a task to a specified note
//--------------------------------------------------------------------------

import pluginJson from '../../plugin.json'
import { logDebug, logError } from '@helpers/dev'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Add a task to a specified note
 * TODO(@jgclark): Implement actual task adding logic here
 * This could call doAddItem or similar function from clickHandlers
 *
 * @param {Object} params - Request parameters
 * @param {string} params.filename - Filename of the note to add the task to
 * @param {string} params.taskText - The task text to add
 * @param {string?} params.heading - Optional heading to add the task under
 * @param {string?} params.space - Optional space ID (for teamspace notes)
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {RequestResponse}
 */
export function addTaskToNote(params: { filename: string, taskText: string, heading?: ?string, space?: ?string }, pluginJson: any): RequestResponse {
  try {
    const { filename, taskText, heading, space } = params
    logDebug('Dashboard/requestHandlers] addTaskToNote', `Starting with filename="${filename}", taskText="${taskText}", heading="${heading || 'none'}", space="${space || 'private'}"`)

    // TODO(@jgclark): Implement actual task adding logic here
    // This could call doAddItem or similar function from clickHandlers
    // Or import some code from /qath or something else -- you know best

    // you may want to trigger a refresh of the appropriate section before returning a value

    // For now, returning a message indicating it's not implemented yet, with the data so @jgclark knows what to implement
    return {
      success: false,
      message: `⚠️ This request was sent to the backend but needs @jgclark to implement it in the new addTaskToNote() request handler. Data received:\n${JSON.stringify({
        filename,
        taskText,
        heading: heading || null,
        space: space || null,
      })}`,
      // Sending the data field back may not be strictly necessary unless you want to do an optomistic update
      // Just here as an example
      data: {
        filename,
        taskText,
        heading: heading || null,
        space: space || null,
      },
    }
  } catch (error) {
    logError(pluginJson, `[Dashboard/requestHandlers] addTaskToNote ERROR: ${error.message}`)
    return {
      success: false,
      message: `Error adding task: ${error.message}`,
      data: null,
    }
  }
}
