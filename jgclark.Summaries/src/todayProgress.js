// @flow
//-----------------------------------------------------------------------------
// Progress update for Today only
// Jonathan Clark, @jgclark
// Last updated 8.10.2022 for v0.20.0, @jgclark
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import {
  getSummariesSettings,
} from './summaryHelpers'
import {
  makeProgressUpdate
} from './progress'
import {
  clo, logDebug, logError, logInfo, logWarn, timer,
  overrideSettingsWithEncodedTypedArgs,
} from '@helpers/dev'

//-------------------------------------------------------------------------------

/**
 * This is the entry point for template use of makeTodayProgress
 * @param {?string} params as JSON string
 * @returns {string} - string returned to the Template
 */
export async function todayProgressFromTemplate(params: string = ''): Promise<string> {
  try {
    logDebug(pluginJson, `todayProgressFromTemplate() starting with params '${params}'`)

    let configFromParams = JSON.parse(params)
    const heading = configFromParams.todayProgressHeading ?? ''
    const itemsToShowStr = configFromParams.todayProgressTotal ?? ''
    if (itemsToShowStr === '') {
      throw new Error("Can't find any items to show - check you have specified 'todayProgressTotal' key in the parameters.")
    }

    const mentionsToShow = itemsToShowStr.split(',').filter((f) => f.startsWith('@'))
    const hashtagsToShow = itemsToShowStr.split(',').filter((f) => f.startsWith('#'))

    const paramsToPass = `{ "period": "today",
    "progressHeading": ${heading} ?? '',
    "progressDestination": "daily",
    "excludeToday": false,
    "showSparklines": false,
    "progressYesNo": [],
    "progressHashtags": [],
    "progressHashtagsAverage": [],
    "progressHashtagsTotal": ["${hashtagsToShow.join('","')}"]
    "mentionsHashtags": [],
    "mentionsHashtagsAverage": [],
    "mentionsHashtagsTotal": ["${mentionsToShow.join('","')}"]
     }`

    const summaryStr = await makeProgressUpdate(paramsToPass, 'template') ?? '<error>'
    logInfo('todayProgressFromTemplate()', '-> ' + summaryStr)
    return summaryStr
  }
  catch (err) {
    logError(pluginJson, 'todayProgressFromTemplate()' + err.message)
    return '<error>' // for completeness
  }
}

/**
 * This is the entry point for /command or x-callback use of makeProgressUpdate
 * @param {?string} itemsToShowStr as comma-separated list of @mentions or #tags
 * @returns {string} - returns string to Template or whatever
 */
export async function makeTodayProgress(itemsToShowArg: string = '', headingArg: string = ''): Promise<string> {
  try {
    logDebug(pluginJson, `makeTodayProgress() starting with itemsToShowStr '${itemsToShowArg}'`)
    const config = await getSummariesSettings()
    const itemsToShowStr = itemsToShowArg
      ? itemsToShowArg
      : config.todayProgressTotal
    logDebug('makeTodayProgress()', `itemsToShowStr '${itemsToShowStr}'`)
    const heading = headingArg ? headingArg : config.todayProgressHeading
    logDebug('makeTodayProgress()', `heading '${heading}'`)
    const mentionsToShow = itemsToShowStr.split(',').filter((f) => f.startsWith('@'))
    logDebug('makeMentionsToShow()', mentionsToShow)
    const hashtagsToShow = itemsToShowStr.split(',').filter((f) => f.startsWith('#'))
    logDebug('makeMentionsToShow()', hashtagsToShow)

    const paramsToPass = `{ "period": "today",
    "progressHeading": ${heading} ?? '',
    "progressDestination": "daily",
    "excludeToday": false,
    "showSparklines": false,
    "progressYesNo": [],
    "progressHashtags": [],
    "progressHashtagsAverage": [],
    "progressHashtagsTotal": ["${hashtagsToShow.join('","')}"]
    "mentionsHashtags": [],
    "mentionsHashtagsAverage": [],
    "mentionsHashtagsTotal": ["${mentionsToShow.join('","')}"]
     }`

    const summaryStr = await makeProgressUpdate(paramsToPass, 'callback') ?? '<error>'
    logInfo('makeTodayProgress() -> ' + summaryStr)
    return summaryStr
  }
  catch (err) {
    logError(pluginJson, 'makeTodayProgress() ' + err.message)
    return '<error>' // for completeness
  }
}
