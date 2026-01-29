// @flow
//--------------------------------------------------------------------------
// Request Handler: addTaskToNote
// Adds a task to a specified note
// Last updated 2026-01-25 for v2.4.0.b19 by @jgclark
//--------------------------------------------------------------------------

import { getDashboardSettings } from '../dashboardHelpers'
import { isValidCalendarNoteFilename, convertISOToYYYYMMDD, isDailyDateStr } from '@helpers/dateTime'
import { logDebug, logError } from '@helpers/dev'
import { coreAddTaskToNoteHeading } from '@helpers/NPAddItems'
import { getNoteFromFilename } from '@helpers/NPnote'
import { processChosenHeading } from '@helpers/userInput'

// RequestResponse type definition
export type RequestResponse = {
  success: boolean,
  message?: string,
  data?: any,
}

/**
 * Add a task to a specified note
 * @param {Object} params - Request parameters
 * @param {string} params.filename - Filename of the note to add the task to
 * @param {string} params.taskText - The task text to add
 * @param {string?} params.heading - Optional heading to add the task under
 * @param {string?} params.space - Optional space ID (empty string for Private, teamspace ID for teamspace notes)
 * @param {Object} pluginJson - Plugin JSON object for logging
 * @returns {RequestResponse}
 */
export async function addTaskToNote(params: { filename: string, taskText: string, heading?: ?string, space?: ?string }, pluginJson: any): Promise<RequestResponse> {
  try {
    const { filename, taskText, heading, space } = params
    logDebug('requestHandlers/addTaskToNote', `Starting with filename="${filename}", taskText="${taskText}", heading="${heading || 'none'}", space="${space || 'private'}"`)

    // Validate inputs
    if (!filename || !taskText || !taskText.trim()) {
      return {
        success: false,
        message: 'Filename and task text are required',
        data: null,
      }
    }

    // Normalize filename: convert ISO date format (YYYY-MM-DD) to NotePlan format (YYYYMMDD) if needed
    // Check if filename (without extension) is a daily date string in ISO format
    const filenameWithoutExt = filename.replace(/\.(md|txt)$/, '')
    let normalizedFilename = filename
    if (isDailyDateStr(filenameWithoutExt)) {
      // Convert ISO format to NotePlan format for calendar notes
      const convertedDate = convertISOToYYYYMMDD(filenameWithoutExt)
      if (convertedDate !== filenameWithoutExt) {
        // Conversion happened - reconstruct filename with NotePlan format
        const ext = filename.match(/\.(md|txt)$/)?.[0] || '.md'
        normalizedFilename = `${convertedDate}${ext}`
        logDebug('requestHandlers/addTaskToNote', `Converted ISO date filename "${filename}" to NotePlan format "${normalizedFilename}"`)
      }
    }
    logDebug('requestHandlers/addTaskToNote', `normalizedFilename: "${normalizedFilename}"`)

    // Get dashboard settings for heading configuration
    const config = await getDashboardSettings()
    if (!config) {
      return {
        success: false,
        message: 'Failed to load dashboard settings',
        data: null,
      }
    }

    // FIXME: Get the note - handle teamspace notes if space is provided
    let destNote = null
    if (space && space !== '' && space !== 'Private') {
      // Teamspace note - use DataStore APIs with teamspace ID
      const isCalendarNote = isValidCalendarNoteFilename(normalizedFilename)
      if (isCalendarNote) {
        // Extract date string from normalized filename (without extension) for calendarNoteByDateString
        const dateStr = normalizedFilename.replace(/\.(md|txt)$/, '')
        // calendarNoteByDateString accepts both ISO (YYYY-MM-DD) and NotePlan (YYYYMMDD) formats,
        // but we've normalized to NotePlan format, so use that
        destNote = DataStore.calendarNoteByDateString(dateStr, space)
      } else {
        destNote = DataStore.noteByFilename(normalizedFilename, 'Notes', space)
      }
    } else {
      // Private note - use getNoteFromFilename helper which handles both regular and calendar notes
      // getNoteFromFilename should handle ISO format conversion internally, but we'll use normalized filename for consistency
      destNote = getNoteFromFilename(normalizedFilename)
    }

    if (!destNote) {
      return {
        success: false,
        message: `Unable to locate note: ${filename}${space && space !== '' && space !== 'Private' ? ` in teamspace ${space}` : ''}`,
        data: null,
      }
    }

    // Process heading if provided, otherwise use default from config
    const newHeadingLevel = config.newTaskSectionHeadingLevel || 2
    const headingToUse = heading
      ? await processChosenHeading(destNote, heading, newHeadingLevel)
      : config.newTaskSectionHeading || ''

    // Add the task to the note
    // logDebug('requestHandlers/addTaskToNote', `Adding task to note: "${destNote?.title || '?'}" with heading: "${headingToUse}"`)
    const resultingPara = coreAddTaskToNoteHeading(destNote, headingToUse, taskText.trim(), newHeadingLevel, true)
    // logDebug('requestHandlers/addTaskToNote', `Resulting paragraph: "${resultingPara?.rawContent || '?'}"`)

    if (!resultingPara) {
      return {
        success: false,
        message: 'Failed to add task to note',
        data: null,
      }
    }

    logDebug('requestHandlers/addTaskToNote', `Successfully added task "${taskText}" to note "${filename}" under heading "${headingToUse || 'default'}"`)
    return {
      success: true,
      message: `Task added successfully to ${destNote.title || filename}`,
      data: {
        filename,
        taskText,
        heading: headingToUse || null,
        space: space || null,
      },
    }
  } catch (error) {
    logError(pluginJson, `requestHandlers/addTaskToNote ERROR: ${error.message}`)
    return {
      success: false,
      message: `Error adding task: ${error.message}`,
      data: null,
    }
  }
}
