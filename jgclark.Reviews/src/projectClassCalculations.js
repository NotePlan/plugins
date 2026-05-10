// @flow
//-----------------------------------------------------------------------------
// Project class calculations for Project & Reviews plugin
// by Jonathan Clark
// Last updated 2026-04-30 for v2.0.0.b27, @Cursor
//-----------------------------------------------------------------------------

import moment from 'moment/min/moment-with-locales'
import type { Project } from './projectClass'
import { formatDurationString } from './projectClassHelpers'
import { calcNextReviewDate } from './reviewHelpers'
import { RE_DATE, daysBetween } from '@helpers/dateTime'
import { logDebug, logError, logWarn } from '@helpers/dev'

/**
 * Type for updatable Project fields in helper functions
 */
type ProjectUpdates = {
  dueDays?: number,
  nextReviewDateStr?: ?string,
  nextReviewDays?: number,
  completedDuration?: ?string,
  cancelledDuration?: ?string,
}

/**
 * Create an immutable copy of a Project with updated properties.
 * Returns a new object with all properties from the original plus any updates.
 * @param {Project} project - The original Project instance
 * @param {ProjectUpdates} updates - Object with properties to update
 * @returns {Project} - New immutable Project-like object
 */
function createImmutableProjectCopy(project: Project, updates: ProjectUpdates = {}): Project {
  // $FlowIgnore[incompatible-return] - Object literal has all Project properties, compatible for our use case
  return {
    note: project.note,
    filename: project.filename,
    folder: project.folder,
    metadataParaLineIndex: project.metadataParaLineIndex,
    title: project.title,
    startDate: project.startDate,
    dueDate: project.dueDate,
    dueDays: updates.dueDays !== undefined ? updates.dueDays : project.dueDays,
    reviewedDate: project.reviewedDate,
    reviewInterval: project.reviewInterval,
    nextReviewDateStr: updates.nextReviewDateStr !== undefined ? updates.nextReviewDateStr : project.nextReviewDateStr,
    nextReviewDays: updates.nextReviewDays !== undefined ? updates.nextReviewDays : project.nextReviewDays,
    completedDate: project.completedDate,
    completedDuration: updates.completedDuration !== undefined ? updates.completedDuration : project.completedDuration,
    cancelledDate: project.cancelledDate,
    cancelledDuration: updates.cancelledDuration !== undefined ? updates.cancelledDuration : project.cancelledDuration,
    numOpenItems: project.numOpenItems,
    numCompletedItems: project.numCompletedItems,
    numTotalItems: project.numTotalItems,
    numWaitingItems: project.numWaitingItems,
    numFutureItems: project.numFutureItems,
    isCompleted: project.isCompleted,
    isCancelled: project.isCancelled,
    isPaused: project.isPaused,
    percentComplete: project.percentComplete,
    lastProgressComment: project.lastProgressComment,
    mostRecentProgressLineIndex: project.mostRecentProgressLineIndex,
    nextActionsRawContent: project.nextActionsRawContent,
    ID: project.ID,
    icon: project.icon,
    iconColor: project.iconColor,
    allProjectTags: project.allProjectTags ?? [],
    noteChangedAtMs: project.noteChangedAtMs,
  }
}

/**
 * Normalise a possibly non-ISO date string to strict ISO format (YYYY-MM-DD), or null if invalid.
 * Handles legacy full ISO datetime strings (e.g. 'YYYY-MM-DDTHH:mm:ss.sssZ') by truncating to the date part.
 * @param {?string} dateStrIn
 * @param {string} context - description for logging
 * @returns {?string} normalised ISO date string or null
 */
function normaliseISODateString(dateStrIn: ?string, context: string): ?string {
  if (typeof dateStrIn !== 'string' || dateStrIn === '') {
    return null
  }

  const reISODate = new RegExp(`^${RE_DATE}$`)
  if (reISODate.test(dateStrIn)) {
    return dateStrIn
  }

  // Handle full ISO datetime 'YYYY-MM-DDTHH:mm:ss.sssZ' by truncating to the date part
  const isoDateTimeMatch = dateStrIn.match(/^(\d{4}-\d{2}-\d{2})T/)
  if (isoDateTimeMatch && isoDateTimeMatch[1]) {
    const truncated = isoDateTimeMatch[1]
    if (reISODate.test(truncated)) {
      logWarn('normaliseISODateString', `Truncating full ISO datetime '${dateStrIn}' to '${truncated}' for ${context}`)
      return truncated
    }
  }

  logWarn('normaliseISODateString', `Invalid date string '${dateStrIn}' for ${context}; treating as null`)
  return null
}

/**
 * From a Project metadata object read in, calculate updated due/finished durations, and return an immutable updated Project object.
 * On error, returns the original Project object.
 * @author @jgclark
 * @param {Project} thisProjectIn
 * @returns {Project}
 */
export function calcDurationsForProject(thisProjectIn: Project): Project {
  try {
    const now = moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone

    const dueDays = thisProjectIn.dueDate != null
      ? daysBetween(now, thisProjectIn.dueDate)
      : NaN

    let completedDuration = thisProjectIn.completedDuration
    let cancelledDuration = thisProjectIn.cancelledDuration

    if (thisProjectIn.completedDate != null) {
      completedDuration = formatDurationString(thisProjectIn.completedDate, thisProjectIn.startDate ?? undefined, true)
    } else if (thisProjectIn.cancelledDate != null) {
      cancelledDuration = formatDurationString(thisProjectIn.cancelledDate, thisProjectIn.startDate ?? undefined, true)
    }

    return createImmutableProjectCopy(thisProjectIn, {
      dueDays,
      completedDuration,
      cancelledDuration,
    })
  } catch (error) {
    logError('calcDurationsForProject', error.message)
    return thisProjectIn
  }
}

/**
 * From a Project metadata object read in, calculate updated next review date, and return an immutable updated Project object.
 * On error, returns the original Project object.
 * @author @jgclark
 * @param {Project} thisProjectIn
 * @returns {Project}
 */
export function calcReviewFieldsForProject(thisProjectIn: Project): Project {
  try {
    const now = moment().toDate() // use moment instead of `new Date` to ensure we get a date in the local timezone

    let nextReviewDateStr: ?string = thisProjectIn.nextReviewDateStr
    let nextReviewDays: number = thisProjectIn.nextReviewDays

    const rawStartDateIn = thisProjectIn.startDate
    const startDateIn = normaliseISODateString(rawStartDateIn, 'startDate')
    if (startDateIn != null) {
      const momTSD = moment(startDateIn)
      if (momTSD.isAfter(now)) {
        nextReviewDateStr = startDateIn
        nextReviewDays = daysBetween(now, startDateIn)
        logDebug('calcReviewFieldsForProject', `project start is in future (${momTSD.format('YYYY-MM-DD')}) -> ${String(nextReviewDays)} interval`)
      }
    }

    const rawNextReviewDateStrIn = thisProjectIn.nextReviewDateStr
    const normalisedNextReviewDateStr = normaliseISODateString(rawNextReviewDateStrIn, 'nextReviewDateStr')

    if (normalisedNextReviewDateStr != null) {
      nextReviewDateStr = normalisedNextReviewDateStr
      nextReviewDays = daysBetween(now, normalisedNextReviewDateStr)
    } else if (thisProjectIn.reviewInterval != null) {
      const reviewedDateIn = thisProjectIn.reviewedDate
      if (typeof reviewedDateIn === 'string' && reviewedDateIn !== '') {
        const calculatedNextReviewDateStr = calcNextReviewDate(reviewedDateIn, thisProjectIn.reviewInterval)
        const hasValidCalculated = calculatedNextReviewDateStr != null && calculatedNextReviewDateStr !== ''
        if (hasValidCalculated) {
          const safeCalculatedNextReviewDateStr = normaliseISODateString(calculatedNextReviewDateStr, 'calculatedNextReviewDateStr')
          if (safeCalculatedNextReviewDateStr != null) {
            nextReviewDateStr = safeCalculatedNextReviewDateStr
            nextReviewDays = daysBetween(now, safeCalculatedNextReviewDateStr)
          } else {
            nextReviewDateStr = moment().format('YYYY-MM-DD')
            nextReviewDays = 0
            logWarn('calcReviewFieldsForProject', `Could not normalise calculated nextReviewDate '${String(calculatedNextReviewDateStr)}' for project '${thisProjectIn.title}'; using today`)
          }
        } else {
          nextReviewDateStr = moment().format('YYYY-MM-DD')
          nextReviewDays = 0
          logDebug('calcReviewFieldsForProject', `calcNextReviewDate returned no date for reviewedDate=${String(reviewedDateIn)}; using today`)
        }
      } else {
        nextReviewDateStr = moment().format('YYYY-MM-DD')
        nextReviewDays = 0
      }
    }

    return createImmutableProjectCopy(thisProjectIn, {
      nextReviewDateStr,
      nextReviewDays,
    })
  } catch (error) {
    logError('calcReviewFieldsForProject', `${error.message} in project '${thisProjectIn.title}'`)
    return thisProjectIn
  }
}
