// @flow
//--------------------------------------------------------------------------
// shared.js
// shared functions between plugin and React
// Last updated 10.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------

import { type MessageDataObject, type TSectionItem, type TSharedSettings } from './types'
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
        logError(`shared/parseSettings`, `Error parsing settings: ${error.message}: Settings string: ${(JSP(settings))}`)
    }
}

/**
 * Validates the provided MessageDataObject to ensure the basic fields exist
 * and are non-null, so we don't have to write this checking code in every handler.
 * All properties of data, data.item, and data.item.para are included in the return object
 * and can be destructured directly. In case of key collisions, an error is thrown.
 * Additionally, 'item' and 'para' and 'project' themselves are included in the result set.
 * In case of key collisions, it throws an error indicating where the collisions are.
 * However, no validation is done on any params other than 'filename' and 'content'.
 * If 'filename' or 'content' is null, an error is thrown specifying the issue.
 * @param {MessageDataObject} data The data object to validate.
 * @returns {ValidatedData} The validated data with all properties lifted, including 'item' and 'para'.
 * @throws {Error} If the data object is invalid, there are key collisions, or 'filename'/'content' is null.
 * @example const { filename, content, item, para, someOtherProp } = validateAndFlattenMessageObject(data)
 */
export function validateAndFlattenMessageObject(data: MessageDataObject): ValidatedData {
    const { item, filename } = data
    let { para, project } = item||{}
    const isProject = project !== undefined
    const isTask = !isProject

    if (!para) para = {}
    if (!project) project = {}

    // Check for required fields in para
    const activeObject = isProject ? project : para
    if (!filename && !activeObject?.filename) {
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
    } else {
        // is project
        if (!project?.title || !project?.filename) {
            logError(`Error validating data: ${JSP(data, 2)}`)
            throw new Error("Error validating data: Projects must have title and filename set.")
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
    if (isProject) result.project = { ...project }
    //$FlowIgnore[prop-missing]
    return result
}

/**
 * Get the feature flags which are set.
 * Note: Feature flags are only available to people with DEBUG logging enabled
 * @param {TAnyObject} pluginSettings 
 * @param {TAnyObject} sharedSettings 
 * @usage const { FFlagInteractiveProcessing } = getFeatureFlags(pluginSettings, sharedSettings)
//  */
export function getFeatureFlags(pluginSettings: TAnyObject, sharedSettings: TSharedSettings): TAnyObject {
    const isDebugLogging = sharedSettings?._logLevel === 'DEV'
    // find all keys that start with Fflag
    const featureFlags = (isDebugLogging ? Object.keys(sharedSettings).filter(k => k.startsWith('FFlag')).reduce((acc, k) => {
        // $FlowIgnore
        acc[k] = sharedSettings[k]
        return acc
    }, {}) : {})
    return featureFlags
}

/**
 * Returns a reduced version of the provided settings object
 * without the sharedSettings and reactSettings objects
 * @param {TAnyObject} settings
 * @returns {TAnyObject} The redacted settings object
 */
export function getSettingsRedacted(settings: TAnyObject): TAnyObject {
    const keysToEliminate = ['sharedSettings', 'reactSettings',"timeblockMustContainString"]
    const settingsRedacted = JSON.parse(JSON.stringify(settings))
    const keys = Object.keys(settingsRedacted)
    for (const key of keys) {
        if (keysToEliminate.includes(key)) {
            delete settingsRedacted[key]
        }
    }
    return settingsRedacted
}