// @flow
//--------------------------------------------------------------------------
// shared.js
// shared functions between plugin and React
// Last updated 10.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import { type MessageDataObject, type TSectionItem } from './types'
import { clo, clof, JSP, log, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'

export type ValidatedData = {
    filename: string,
    content: any,
    item?: TSectionItem,
    [string]: any,
}

export function parseSettings(settings: string): any {
    try {
        if (!settings) {
            throw new Error('Undefined settings passed')
        }
        return JSON.parse(settings)
    } catch (error) {
        logError(`shared/parseSettings`, `Error parsing settings: ${error.message}: Settings: ${settings}`)
    }
}

/**
 * Validates the provided MessageDataObject to ensure the basic fields exist
 * and are non-null, so we don't have to write this checking code in every handler.
 * All properties of data, data.item, and data.item.para are included in the return object
 * and can be destructured directly. In case of key collisions, an error is thrown.
 * Additionally, 'item' and 'para' themselves are included in the result set.
 * In case of key collisions, it throws an error indicating where the collisions are.
 * However, no validation is done on any params other than 'filename' and 'content'.
 * If 'filename' or 'content' is null, an error is thrown specifying the issue.
 * @param {MessageDataObject} data The data object to validate.
 * @returns {ValidatedData} The validated data with all properties lifted, including 'item' and 'para'.
 * @throws {Error} If the data object is invalid, there are key collisions, or 'filename'/'content' is null.
 * @example const { filename, content, item, para, someOtherProp } = validateAndFlattenMessageObject(data)
 */
export function validateAndFlattenMessageObject(data: MessageDataObject): ValidatedData {
    const { item } = data
    let { para, project } = item
    const isProject = project !== undefined
    const isTask = !isProject

    if (!para) para = {}
    if (!project) project = {}

    // Check for required fields in para
    const activeObject = isProject ? project : para
    if (!activeObject?.filename) {
        throw new Error("Error validating data: 'filename' is null or undefined.")
    }
    if (isTask) {
        if (!data?.item?.para) {
            logError(`Error validating data: 'item.para' is missing in data:\n${JSP(data, 2)}`)
            throw new Error(`Error validating data: 'item.para' is missing:\n${JSP(data, 2)}`)
        }
        if (para?.content === null || para?.content === undefined) {
            throw new Error("Error validating data: 'content' is null or undefined.")
        }
    }

    // Merge objects with collision detection
    const allKeys: Set<string> = new Set()
    const result = {}

    const objectsToMerge = [{ ...data }, { ...item }, { ...para }, { ...project }]

    for (const obj of objectsToMerge) {
        for (const [key, value] of Object.entries(obj)) {
            if (allKeys.has(key)) {
                logError(`Key collision detected: '${key}' exists in multiple objects.`)
                clo(data, `validateAndFlattenMessageObject: key collision detected: '${key}' exists in multiple objects. data`)
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
    return result
}

/**
 * Get the feature flags from the JSON stringified setting called featureFlags
 * @param {any} pluginData - the full pluginData object
 * @returns {Object} - the feature flags
 * @example: const { overdueProcessing } = getFeatureFlags(pluginData)
 */
export function getFeatureFlags(pluginData: any): any {
    const { featureFlags: ffStr } = pluginData?.settings || {}
    return parseSettings(ffStr) || {}
}
