// @flow
//--------------------------------------------------------------------------
// shared.js
// shared functions between plugin and React
// Last updated 2024-07-09 for v2.0.1 by @jgclark
//--------------------------------------------------------------------------

import type { MessageDataObject, TSectionItem, TDashboardSettings } from './types'
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
            logDebug(`shared / parseSettings()`, `settingsStr is already an object, so returning it as is`)
            return settingsStr
        }
        return JSON.parse(settingsStr)
    } catch (error) {
        logError(`shared / parseSettings()`, `Error parsing settingsStr: ${error.message}: Settings string: ${(JSP(settingsStr))}`)
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
		const { item, filename } = data
		let { para, project } = item || {}
		const isProject = project !== undefined
		const isTask = para !== undefined

		// $FlowIgnore[incompatible-type]
		if (!para) para = {}
		// $FlowIgnore[incompatible-type]
		if (!project) project = {}

		// Check for filename, which is always required -- from either data.filename or item.para.filename or item.project.filename
		const activeObject = isProject ? project : isTask ? para : undefined
		if (!filename && !activeObject?.filename) {
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
		const result = {}

		const objectsToMerge = [{ ...data }, { ...item }, { ...para }, { ...project }]

		for (const obj of objectsToMerge) {
			for (const [key, value] of Object.entries(obj)) {
				if (allKeys.has(key)) {
					throw new Error(`Key collision detected: '${key}' exists in multiple objects.`)
				}
				allKeys.add(key)
				//$FlowIgnore[prop-missing]
				result[key] = value
			}
		}

		// Add 'item' and 'para' back to the result
		//$FlowIgnore[prop-missing]
		result.item = { ...item }
		//$FlowIgnore[prop-missing]
		if (isTask) result.para = { ...para }
		//$FlowIgnore[prop-missing]
		if (isProject) result.project = { ...project }
		//$FlowIgnore[prop-missing]
		return result
	} catch (error) {
		logError(`shared / validateAndFlattenMessageObject()`, `Error validating data: ${error.message} Data: ${JSP(data, 2)}`)
		return { filename: '(error)', content: '(error)' }
	}
}

/**
 * Returns a reduced version of the provided settings object 
 * without the sharedSettings and reactSettings objects, and the timeblockMustContainString field.
 * @param {TAnyObject} settings
 * @returns {TAnyObject} The redacted settings object
 */
export function getSettingsRedacted(settings: TAnyObject): TAnyObject {
    // FIXME(@jgclark): you asked why is timeblockMustContainString a special case? Or at least why are defaultFileExtension and doneDatesAvailable not eliminated as well?
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