// @flow
//--------------------------------------------------------------------------
// shared.js
// shared functions between plugin and React
// Last updated 2024-07-09 for v2.0.1 by @jgclark
//--------------------------------------------------------------------------

import type { MessageDataObject, TSectionItem, TDashboardConfig } from './types'
import { clo, clof, JSP, log, logDebug, logError, logInfo, logWarn, timer } from '@helpers/dev'

export type ValidatedData = {
    filename: string,
    content: any,
    item?: TSectionItem,
    [string]: any,
}

export function parseSettings(settingsStr: string): any {
    try {
        if (!settingsStr) {
            throw new Error('Undefined settingsStr passed')
        }
        return JSON.parse(settingsStr)
    } catch (error) {
        logError(`shared/parseSettings`, `Error parsing settingsStr: ${error.message}: Settings string: ${(JSP(settingsStr))}`)
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
 * TODO: this is no longer used it seems. Is that right?
 * Get the feature flags which are set.
 * Note: Feature flags are only available to people with DEV logging enabled
 * @param {TAnyObject} pluginSettings 
 * @param {TAnyObject} dashboardSettings
 * @usage const { FFlagInteractiveProcessing } = getFeatureFlags(pluginSettings, dashboardSettings)
//  */
export function getFeatureFlags(NPSettings: TAnyObject, dashboardSettings: TDashboardConfig): TAnyObject {
    const isDebugLogging = NPSettings._logLevel === 'DEV'
    // find all keys that start with Fflag
    const featureFlags = (isDebugLogging ? Object.keys(dashboardSettings).filter(k => k.startsWith('FFlag')).reduce((acc, k) => {
        // $FlowIgnore
        acc[k] = dashboardSettings[k]
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