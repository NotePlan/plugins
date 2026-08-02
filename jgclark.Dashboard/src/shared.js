// @flow
//--------------------------------------------------------------------------
// shared.js
// shared functions between plugin and React
// Last updated 2026-07-16 for v2.4.0.b51 by @jgclark + @CursorAI
//--------------------------------------------------------------------------

import type { MessageDataObject, TParagraphForDashboard, TProjectForDashboard, TSectionItem } from './types'
import { clo, clof, JSP, log, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'

export type ValidatedData = {
	filename: string,
	content: any,
	item?: TSectionItem,
	[string]: any,
}

/**
 * Parses a JSON string into a JavaScript object.
 * @param {string} settingsStr - The JSON string to parse
 * @return {any} The parsed JavaScript object, or undefined if an error occurs
 */
export function parseSettings(settingsStr: string): any {
	try {
		if (!settingsStr) {
			throw new Error('Undefined settingsStr passed')
		}
		if (typeof settingsStr === 'object') {
			// logDebug(`shared / parseSettings()`, `settingsStr is already an object, so returning it as is`)
			return settingsStr
		}
		return JSON.parse(settingsStr)
	} catch (error) {
		logError(`shared / parseSettings()`, `Error parsing settingsStr: ${error.message}: Settings string: ${(JSP(settingsStr))}`)
		return undefined
	}
}

/**
 * Validates the provided MessageDataObject to ensure the basic fields exist and are non-null, so we don't have to write this checking code in every handler.
 * If 'filename' or 'content' is null, an error is thrown specifying the issue.
 * However, no validation is done on any params other than 'filename' and 'content'.
 * All properties of data, data.item, and data.item.para are included in the return object and can be destructured directly.
 * Additionally, 'item' and 'para' and 'project' themselves are included in the result set.
 * In case of key collisions, it throws an error indicating where the collisions are.
 * @param {MessageDataObject} data The data object to validate.
 * @returns {ValidatedData} The validated data with all properties lifted, including 'item' and 'para'.
 * @throws {Error} If the data object is invalid, there are key collisions, or 'filename'/'content' is null.
 * @example const { filename, content, item, para, someOtherProp } = validateAndFlattenMessageObject(data)
 */
export function validateAndFlattenMessageObject(data: MessageDataObject): ValidatedData {
	try {
		const { item, filename, toFilename } = data
		// Partial<> because the two lines below deliberately substitute `{}` as a sentinel for an absent
		// para/project, and every read of them below is already optional-chained or existence-checked.
		let { para, project }: { +para?: $ReadOnly<Partial<TParagraphForDashboard>>, +project?: $ReadOnly<Partial<TProjectForDashboard>>, ... } = item || {}
		const isProject = project !== undefined
		const isTask = para !== undefined

		if (!para) para = {}
		if (!project) project = {}

		// Check for filename, which is always required -- from either data.filename, data.toFilename, or item.para.filename or item.project.filename
		const activeObject = isProject ? project : isTask ? para : undefined
		const resolvedFilename = filename || toFilename || activeObject?.filename
		if (!resolvedFilename) {
			throw new Error("'filename' is null or undefined.")
		}
		// Check for required fields in para
		if (isTask) {
			if (!data?.item?.para) {
				throw new Error(`'item.para' is missing in data.`)
			}
			if (para?.content === null || para?.content === undefined) {
				throw new Error("'content' is null or undefined.")
			}
		}
		// Check for required fields in project
		if (isProject) {
			if (!project?.title || !project?.filename) {
				throw new Error("Projects must have title and filename set.")
			}
		}

		// Checks passed. Now merge objects with collision detection
		const allKeys: Set<string> = new Set()
		// result is filled key-by-key from the merged objects below, so it starts life as a bare index map
		const result: { [string]: any } = {}

		const objectsToMerge = [{ ...data }, { ...item }, { ...para }, { ...project }]

		for (const obj of objectsToMerge) {
			for (const [key, value] of Object.entries(obj)) {
				if (allKeys.has(key)) {
					throw new Error(`Key collision detected: '${key}' exists in multiple objects.`)
				}
				allKeys.add(key)
				result[key] = value
			}
		}

		// Normalize filename: if toFilename was used, ensure filename is set in result
		if (!result.filename && result.toFilename) {
			result.filename = result.toFilename
		}

		// Add 'item' and 'para' back to the result
		result.item = { ...item }
		if (isTask) result.para = { ...para }
		if (isProject) result.project = { ...project }
		// logDebug(`shared / validateAndFlattenMessageObject()`, `result: ${JSP(result, 2)}`)
		// Cast: the loop above lifts the required filename/content keys (both validated at the top of this
		// function) into result, but Flow can't see that a { [string]: any } map has ValidatedData's keys.
		return (result: any)
	} catch (error) {
		logError(`shared / validateAndFlattenMessageObject()`, `Error validating data: ${error.message} Data: ${JSP(data, 2)}`)
		// Re-throw so callers abort cleanly instead of operating on sentinel '(error)' filenames
		throw error
	}
}

/**
 * Returns a reduced version of the provided settings object 
 * without the sharedSettings and reactSettings objects, and the timeblockMustContainString field.
 * @param {TAnyObject} settings
 * @returns {TAnyObject} The redacted settings object
 */
export function getSettingsRedacted(settings: TAnyObject): TAnyObject {
	// Note: (to @jgc from @dbw): you asked why is timeblockMustContainString a special case? Or at least why are defaultFileExtension and doneDatesAvailable not eliminated as well?
	// it probably doesn't matter anymore but the reason was that i didn't want it to get recursive. 
	// the np settings had a shared settings object and i didn't want that sharedSettings to be saved inside sharedSettings when all other fields were migrated
	const keysToEliminate = ['sharedSettings', 'reactSettings', "timeblockMustContainString"]
	const settingsRedacted = JSON.parse(JSON.stringify(settings))
	const keys = Object.keys(settingsRedacted)
	for (const key of keys) {
		if (keysToEliminate.includes(key)) {
			delete settingsRedacted[key]
		}
	}
	return settingsRedacted
}