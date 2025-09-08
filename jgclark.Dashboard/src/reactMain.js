/* eslint-disable max-len */
// @flow
//-----------------------------------------------------------------------------
// Dashboard plugin main file (for React v2.0.0+)
// Last updated 2025-08-30 for v2.3.0
//-----------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { allSectionDetails, WEBVIEW_WINDOW_ID } from './constants'
import { updateDoneCountsFromChangedNotes } from './countDoneTasks'
import { getDashboardSettings, getLogSettings, getNotePlanSettings, getListOfEnabledSections, setPluginData } from './dashboardHelpers'
import { dashboardFilterDefs, dashboardSettingDefs } from './dashboardSettings'
import { getAllSectionsData } from './dataGeneration'
import { getPerspectiveSettings, getActivePerspectiveDef, switchToPerspective } from './perspectiveHelpers'
import { bridgeClickDashboardItem } from './pluginToHTMLBridge'
import { incrementallyRefreshSomeSections } from './refreshClickHandlers'
import { generateTagMentionCache, isTagMentionCacheGenerationScheduled } from './tagMentionCache'
import type { TDashboardSettings, TPerspectiveDef, TPluginData, TPerspectiveSettings } from './types'
import { clo, clof, JSP, logDebug, logInfo, logError, logTimer, logWarn } from '@helpers/dev'
import { createPrettyRunPluginLink, createRunPluginCallbackUrl } from '@helpers/general'
import { getGlobalSharedData, sendToHTMLWindow, type HtmlWindowOptions } from '@helpers/HTMLView'
import { getSettings, saveSettings } from '@helpers/NPConfiguration'
import { checkForRequiredSharedFiles } from '@helpers/NPRequiredFiles'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { chooseOption, showMessage } from '@helpers/userInput'

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------
const pluginID = 'jgclark.Dashboard'

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------
export type PassedData = {
  pluginData: TPluginData /* Your plugin's data to pass on first launch (or edited later) */,
  returnPluginCommand: { id: string, command: string } /* plugin jsFunction that will receive comms back from the React window */,
  componentPath: string /* the path to the rolled up webview bundle. should be ../pluginID/react.c.WebView.bundle.* */,
  startTime?: Date /* used for timing/debugging */,
  title?: string /* React Window Title */,
  debug: boolean /* set based on ENV_MODE above */,
  ENV_MODE?: 'development' | 'production',
  passThroughVars?: any /* any data you want to pass through to the React Window */,
  windowID?: string,
}

// ------------------------------------------------------------

/**
 * Show dashboard using Demo dashboard, and last used perspective.
 */
export async function showDemoDashboard(): Promise<void> {
  await showDashboardReact('full', '', true)
}

/**
 * x-callback entry point to change a single setting.
 * (Note: see also setSettings which does many at the same time.)
 * FIXME: doesn't work for show*Sections?
 * @param {string} key
 * @param {string} value
 * @example noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=setSetting&arg0=rescheduleNotMove&arg1=true
 * @example noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=setSetting&arg0=ignoreItemsWithTerms&arg1=#waiting
 */
export async function setSetting(key: string, value: string): Promise<void> {
  try {
    logDebug('setSetting', `Request to set: '${key}' -> '${value}'`)
    const dashboardSettings = (await getDashboardSettings()) || {}
    // clo(dashboardSettings, 'dashboardSettings:')

    const allSettings = [...dashboardFilterDefs, ...dashboardSettingDefs].filter((k) => k.label && k.key)
    const allKeys = allSettings.map((s) => s.key)
    logDebug('setSetting', `Existing setting keys: ${String(allKeys)}`)
    if (allKeys.includes(key)) {
      const thisSettingDetail = allSettings.find((s) => s.key === key) || {}
      const setTo = thisSettingDetail.type === 'switch' ? value === 'true' : value
      // $FlowFixMe[prop-missing]
      dashboardSettings[key] = setTo
      // logDebug('setSetting', `Set ${key} to ${String(setTo)} in dashboardSettings (type: ${typeof setTo} / ${thisSettingType})`)
      // TEST: use helper to save settings from now on
      // DataStore.settings = { ...await getSettings('jgclark.Dashboard'), dashboardSettings: JSON.stringify(dashboardSettings) }
      const res = await saveSettings(pluginID, { ...await getSettings('jgclark.Dashboard'), dashboardSettings: JSON.stringify(dashboardSettings) })
      if (!res) {
        throw new Error(`saveSettings failed for setting '${key}:${value}'`)
      }
      await showDashboardReact('full', '', false)
    } else {
      throw new Error(`Key '${key}' not found in dashboardSettings. Available keys: [${allKeys.join(', ')}]`)
    }
  } catch (error) {
    logError('setSetting', error.message)
  }
}

/**
 * x-callback entry point to change multiple settings in one go.
 * @param {string} `key=value` pairs separated by ;
 * @example noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=setSetting&arg0=rescheduleNotMove=true;ignoreItemsWithTerms=#waiting
 */
export async function setSettings(paramsIn: string): Promise<void> {
  try {
    const dashboardSettings = (await getDashboardSettings()) || {}
    const allSettings = [...dashboardFilterDefs, ...dashboardSettingDefs].filter((k) => k.label && k.key)
    const allKeys = allSettings.map((s) => s.key)
    const params = paramsIn.split(';')
    logDebug('setSettings', `Given ${params.length} key=value pairs to set:`)
    const i = 0
    for (const param of params) {
      const [key, value] = param.split('=')
      logDebug('setSettings', `- ${String(i)}: setting '${key}' -> '${value}'`)
      if (allKeys.includes(key)) {
        const thisSettingDetail = allSettings.find((s) => s.key === key) || {}
        const setTo = thisSettingDetail.type === 'switch' ? value === 'true' : value
        // $FlowFixMe[prop-missing]
        dashboardSettings[key] = setTo
        logDebug('setSettings', `  - set ${key} to ${String(setTo)} in dashboardSettings (type: ${typeof setTo})`)
      } else {
        throw new Error(`Key '${key}' not found in dashboardSettings. Available keys: [${allKeys.join(', ')}]`)
      }
    }
    logDebug('setSettings', `Calling DataStore.settings, then showDashboardReact()`)
    // TEST: use helper to save settings from now on
    // DataStore.settings = { ...await getSettings('jgclark.Dashboard'), dashboardSettings: JSON.stringify(dashboardSettings) }
    const res = await saveSettings(pluginID, { ...await getSettings('jgclark.Dashboard'), dashboardSettings: JSON.stringify(dashboardSettings) })
    if (!res) {
      throw new Error(`saveSettings failed for params: '${paramsIn}'`)
    }
    await showDashboardReact('full', '', false)
  } catch (error) {
    logError('setSettings', error.message)
  }
}

/**
 * Make a callback with all the current settings in it, and
 */
export async function makeSettingsAsCallback(): Promise<void> {
  try {
    const dashboardSettings = (await getDashboardSettings()) || {}
    const params = Object.keys(dashboardSettings)
      .map((k) => `${k}=${String(dashboardSettings[k])}`)
      .join(';')
    // then give user the choice of whether they want a raw URL or a pretty link.
    const options = [
      { label: 'raw URL', value: 'raw' },
      { label: 'pretty link', value: 'link' },
    ]
    const result = await chooseOption('Settings as URL or Link?', options, 'raw URL')
    let output = ''
    // let clipboardType = ''
    // then make the URL, using helpers to deal with encodings.
    switch (result) {
      case 'raw':
        output = createRunPluginCallbackUrl('jgclark.Dashboard', 'setSettings', params)
        // clipboardType = 'public.url'
        break
      case 'link':
        output = createPrettyRunPluginLink('Set all Dashboard settings  to your current ones', 'jgclark.Dashboard', 'setSettings', params)
        // clipboardType = 'public.utf8-plain-text'
        break
      default:
        return
    }
    logDebug('makeSettingsAsCallback', `${result} output: '${output}'`)

    // now copy to Clipboard and tell the user
    // This does not work for JGC:
    // Clipboard.setStringForType(output, clipboardType)
    // But this simpler version does:
    Clipboard.string = output
    await showMessage('Settings as URL or Link copied to Clipboard', 'OK', 'Dashboard', false)
  } catch (error) {
    logError('makeSettingsAsCallback', error.message)
  }
}

/**
 * x-callback entry point to show (or switch to) Dashboard with a named Perspective.
 * @param {string} name (optional; if not given then will use last-used Perspective)
 * @example noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showPerspective&arg0=Work
 */
export async function showPerspective(name: string = ''): Promise<void> {
  try {
    logDebug('showPerspective', `Request to show Dashboard with Perspective '${name}'`)
    await showDashboardReact('full', name, false)
  } catch (error) {
    logError('showPerspective', error.message)
  }
}

/**
 * x-callback entry point to show (or switch to) Dashboard with a CSV list of specific Sections to show.
 * @param {string} sectionCodeList comma-separated list of sectionCodes (e.g. 'DT' for Today)
 * @example noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=showSections&arg0=DT,DO,@home
 */
export async function showSections(sectionCodeList: string = ''): Promise<void> {
  try {
    logDebug('showSections', `Request to show Dashboard with Sections '${sectionCodeList}'`)
    await showDashboardReact(sectionCodeList, '', false)
  } catch (error) {
    logError('showSections', error.message)
  }
}

/**
 * Set the dashboard settings to show only the sections in the CSV string.
 * (if user calls this from xcallback, it will override the current settings, showing only the sections in the CSV string)
 * This is less necessary now that we have the ability to load a specific perspective.
 * But it's still useful for xcallback calls to focus on a specific section or sections.
 * @param {string} limitToSections e.g. "TD,TY,#work"
 */
async function updateSectionFlagsToShowOnly(limitToSections: string): Promise<void> {
  try {
    if (!limitToSections) return
    logDebug('updateSectionFlagsToShowOnly', `Request to show only sections '${limitToSections}'`)
    const dashboardSettings: TDashboardSettings = (await getDashboardSettings()) || {}
    // set everything off to begin with
    const keys = Object.keys(dashboardSettings).filter((key) => key.startsWith('show') && key.endsWith('Section'))
    allSectionDetails.forEach((section) => {
      const key = section.showSettingName
      // $FlowIgnore[prop-missing]
      if (key) dashboardSettings[key] = false
    })

    // also turn off the specific tag sections (e.g. "showTagSection_@home")
    // $FlowIgnore[incompatible-type]
    keys.forEach((key) => (dashboardSettings[key] = false))
    const sectionsToShow = limitToSections.split(',')
    sectionsToShow.forEach((sectionCode) => {
      const showSectionKey = allSectionDetails.find((section) => section.sectionCode === sectionCode)?.showSettingName
      if (showSectionKey) {
        // $FlowIgnore
        dashboardSettings[showSectionKey] = true
      } else {
        if (sectionCode.startsWith('@') || sectionCode.startsWith('#')) {
          // $FlowIgnore
          dashboardSettings[`showTagSection_${sectionCode}`] = true
        } else {
          logWarn(pluginJson, `updateSectionFlagsToShowOnly: sectionCode '${sectionCode}' not found in allSectionDetails. Continuing with others.`)
        }
      }
    })

    // TEST: use helper to save settings from now on
    // DataStore.settings = { ...await getSettings('jgclark.Dashboard'), dashboardSettings: JSON.stringify(dashboardSettings) }
    const res = await saveSettings(pluginID, { ...await getSettings('jgclark.Dashboard'), dashboardSettings: JSON.stringify(dashboardSettings) })
    if (!res) {
      throw new Error(`saveSettings failed for sections '${limitToSections}'`)
    }
  } catch (error) {
    logError('updateSectionFlagsToShowOnly', error.message)
  }
}
/**
 * Plugin Entry Point for "Show Dashboard"
 * @author @dwertheimer
 * @param {string?} callMode (default: 'full') 'full' (i.e. by user call) | 'trigger' (by trigger: don't steal focus) | CSV of specific sections to load (e.g. from xcallback)
 * @param {string?} perspectiveName (default: ''): perspective to start it with. If none given (empty string) then open in the last used one.
 * @param {boolean?} useDemoData? (default: false)
 */
export async function showDashboardReact(callMode: string = 'full', perspectiveName: string = '', useDemoData: boolean = false): Promise<void> {
  try {
    logInfo(pluginJson, `showDashboardReact starting up (mode '${callMode}') with perpsectiveName '${perspectiveName}' ${useDemoData ? 'in DEMO MODE' : 'using LIVE data'}`)
    // clo(DataStore.settings, `showDashboardReact: DataStore.settings=`)
    const startTime = new Date()

    // If callMode is a CSV of specific wanted sections, then override section flags for them
    // (e.g. from xcallback)
    if (callMode !== 'trigger' && callMode !== 'full') await updateSectionFlagsToShowOnly(callMode)

    // make sure we have the np.Shared plugin which has the core react code and some basic CSS
    // TODO: can this be moved to onInstallOrUpdate?
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true) // you must have np.Shared code in order to open up a React Window
    // logDebug(pluginJson, `showDashboardReact: installOrUpdatePluginsByID ['np.Shared'] completed`)

    // log warnings if we don't have required files
    // TODO: can this be moved to onInstallOrUpdate?
    await checkForRequiredSharedFiles(pluginJson)
    // logDebug(pluginJson, `showDashboardReact: checkForRequiredSharedFiles completed`)

    // Get settings
    const config = await getDashboardSettings() // pulls the JSON stringified dashboardSettings and parses it into object
    // clo(config, `showDashboardReact: keys:${Object.keys(config).length} config=`)
    const logSettings = await getLogSettings()

    // get initial data to pass to the React Window
    const data = await getInitialDataForReactWindow(perspectiveName, useDemoData)
    // logDebug('showDashboardReact', `lastFullRefresh = ${String(data?.pluginData?.lastFullRefresh) || 'not set yet'}`)

    const resourceLinksInHeader = `
      <!-- <link rel="stylesheet" href="../${pluginJson['plugin.id']}/Dashboard.css"> -->
      <!-- <link rel="stylesheet" href="../${pluginJson['plugin.id']}/DashboardDialog.css"> -->
      <link rel="stylesheet" href="../np.Shared/css.w3.css">

      <!-- Load in fontawesome assets from np.Shared (licensed for NotePlan) -->
      <link href="../np.Shared/fontawesome.css" rel="stylesheet">
      <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">
      `
    const platform = NotePlan.environment.platform

    const windowOptions: HtmlWindowOptions = {
      windowTitle: data?.title || 'Dashboard',
      customId: WEBVIEW_WINDOW_ID,
      makeModal: false,
      savedFilename: `../../${pluginJson['plugin.id']}/dashboard-react.html` /* for saving a debug version of the html file */,
      shouldFocus: callMode !== 'trigger' /* focus window (unless called by a trigger) */,
      reuseUsersWindowRect: true,
      headerTags: `${resourceLinksInHeader}\n<meta name="startTime" content="${String(Date.now())}">`,
      generalCSSIn: generateCSSFromTheme(config.dashboardTheme), // either use dashboard-specific theme name, or get general CSS set automatically from current theme
      specificCSS: '', // set in separate CSS file referenced in header
      preBodyScript: `
        <script type="text/javascript" >
          // Set DataStore.settings so default logDebug etc. logging works in React
          // This setting comes from ${pluginJson['plugin.id']}
          let DataStore = { settings: {_logLevel: "${DataStore?.settings?._logLevel}" } };
        </script>`,
      postBodyScript: ``,
      paddingWidth: (platform === 'iPadOS') ? 32 : (platform === 'iOS') ? 0 : 0,
      paddingHeight: (platform === 'iPadOS') ? 32 : (platform === 'iOS') ? 0 : 0,
    }
    logTimer('showDashboardReact', startTime, `===== Calling React =====`)
    // clo(data, `showDashboardReact data object passed`)
    logDebug(pluginJson, `showDashboardReact invoking window. showDashboardReact stopping here. It's all React from this point forward...\n`)
    // now ask np.Shared to open the React Window with the data we just gathered
    await DataStore.invokePluginCommandByName('openReactWindow', 'np.Shared', [data, windowOptions])
  } catch (error) {
    logError('showDashboardReact', JSP(error))
  }
}

/**
 * This is called from Dashboard.jsx when the React Window has initialised, and is ready to start receiving Sections.
 * It kicks off the incremental generation of the Sections.
 * @returns {Promise<void>}
 */
export async function reactWindowInitialisedSoStartGeneratingData(): Promise<void> {
  try {
    logDebug('reactWindowInitialisedSoStartGeneratingData', `--> React Window reported back to plugin that it has loaded <--`)
    const config = await getDashboardSettings()
    const logSettings = await getLogSettings()
    const enabledSections = getListOfEnabledSections(config)

    // Start generating data for the enabled sections
    if (!config.FFlag_ForceInitialLoadForBrowserDebugging) {
      await incrementallyRefreshSomeSections({ sectionCodes: enabledSections, actionType: 'incrementallyRefreshSomeSections' }, false, true)
    } else {
      // If force initial load is enabled, we still need to set firstRun to false
      const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID)
      if (reactWindowData?.pluginData) {
        await setPluginData({ firstRun: false }, 'Setting firstRun to false after force initial load')
      }
    }
    logInfo('reactWindowInitialisedSoStartGeneratingData', `----- END OF GENERATION ------`)

    // ---------------------------------------------------------------
    // Now is the time to do any other background processing after the initial display is done
    // ---------------------------------------------------------------

    // Rebuild the tag mention cache. (Ideally this would be triggered by NotePlan once a day, but for now we will do it here.)
    if (isTagMentionCacheGenerationScheduled()) {
      logInfo('reactWindowInitialisedSoStartGeneratingData', `- now generating tag mention cache`)
      await generateTagMentionCache()
      // Now that the cache is generated, we want to re-generate any enabled tag section(s), just in case
      if (enabledSections.length > 0 && enabledSections.includes('TAG')) {
        logInfo('reactWindowInitialisedSoStartGeneratingData', `- now re-generating tag section(s)`)
        await incrementallyRefreshSomeSections({ sectionCodes: ['TAG'], actionType: 'incrementallyRefreshSomeSections' }, false, true)
      }
    }
  } catch (error) {
    logError('reactWindowInitialisedSoStartGeneratingData', error.message)
  }
}

/**
 * Because perspectiveSettings may need to be created on first run, we need to get the dashboardSettings from the perspectiveSettings
 * @param {Array<TPerspectiveDef>} perspectiveSettings
 * @returns {TDashboardSettings}
 */
async function getDashboardSettingsFromPerspective(perspectiveSettings: TPerspectiveSettings): Promise<TDashboardSettings> {
  try {
    const activeDef = getActivePerspectiveDef(perspectiveSettings)
    if (!activeDef) throw new Error(`getDashboardSettingsFromPerspective: getActivePerspectiveDef failed`)
    const prevDashboardSettings = await getDashboardSettings()
    if (!prevDashboardSettings) throw new Error(`getDashboardSettingsFromPerspective: getDashboardSettings failed`)
    // apply the new perspective's settings to the main dashboard settings
    const newDashboardSettings = {
      ...prevDashboardSettings,
      ...(activeDef.dashboardSettings || {}),
    }

    // use our more reliable helper to save settings
    const res = await saveSettings(pluginID, { ...await getSettings('jgclark.Dashboard'), dashboardSettings: JSON.stringify(newDashboardSettings) })
    if (!res) {
      throw new Error(`saveSettings failed`)
    }
    return newDashboardSettings
  } catch (error) {
    logError('getDashboardSettingsFromPerspective', error.message)
    // $FlowFixMe[prop-missing]
    return {}
  }
}

/**
 * Gathers key data for the React Window, including the callback function that is used for comms back to the plugin.
 * @param {string?} perspectiveName - the name of the Perspective to use, or blank to mean use the current one
 * @param {boolean?} useDemoData - whether to use demo data
 * @returns {PassedData} the React Data Window object
 */
export async function getInitialDataForReactWindow(perspectiveName: string = '', useDemoData: boolean = false): Promise<PassedData> {
  try {
    logDebug('getInitialDataForReactWindow', `>>>>> Starting`)
    const startTime = new Date()
    let perspectiveSettings = await getPerspectiveSettings()
    // If a perspective is specified, then update the setting to point to it before opening the React Window
    let dashboardSettings: TDashboardSettings = await getDashboardSettings()
    if (perspectiveName) {
      logDebug('getInitialDataForReactWindow', `will use perspective '${perspectiveName}'`)
      perspectiveSettings = (await switchToPerspective(perspectiveName, perspectiveSettings)) || perspectiveSettings
      dashboardSettings = await getDashboardSettingsFromPerspective(perspectiveSettings)
    }
    // clo(dashboardSettings, `getInitialDataForReactWindow: dashboardSettings=`)
    // get whatever pluginData you want the React window to start with and include it in the object below. This all gets passed to the React window
    const pluginData = await getPluginData(dashboardSettings, perspectiveSettings, useDemoData) // Note: the only time this is called.
    logDebug('getInitialDataForReactWindow', `lastFullRefresh = ${String(pluginData.lastFullRefresh)}`)
    clo(pluginData.dashboardSettings, `getInitialData pluginData.dashboardData`)
    const ENV_MODE = 'development' /* 'development' helps during development. set to 'production' when ready to release */
    const dataToPass: PassedData = {
      pluginData,
      returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onMessageFromHTMLView' },
      componentPath: `../${pluginJson['plugin.id']}/react.c.WebView.bundle.${ENV_MODE === 'development' ? 'dev' : 'min'}.js`,
      debug: false, // ENV_MODE === 'development' ? true : false, // certain logging on/off, including the pluginData display at the bottom of the screen
      title: useDemoData ? 'Dashboard (Demo Data)' : 'Dashboard',
      ENV_MODE,
      startTime,
      windowID: WEBVIEW_WINDOW_ID,
    }
    logDebug('getInitialDataForReactWindow', `<<<<< Finished`)
    return dataToPass
  } catch (error) {
    logError(pluginJson, error.message)
    // $FlowFixMe[prop-missing]
    return {}
  }
}

/**
 * Note: This comes from the React Template, but is no longer used, so commenting out.
 * Update the data in the React Window (and cause it to re-draw as necessary with the new data)
 * This is likely most relevant when a trigger has been sent from a NotePlan window, but could be used anytime a plugin wants to update the data in the React Window
 * This is exactly the same as onMessageFromHTMLView, but named updateReactWindowData to clarify that the plugin is updating the data in the React Window
 * rather than a user interaction having triggered it (the result is the same)
 * See discussion at https://discord.com/channels/@me/863719873175093259/1229524619615010856
 * @param {string} actionType - the reducer-type action to be dispatched -- see onMessageFromHTMLView above
 * @param {any} data - any data that the router (specified in onMessageFromHTMLView) needs -- may be nothing
 * @returns {Promise<any>} - does not return anything important
 */
export async function updateReactWindowData(actionType: string, data: any = null): Promise<any> {
  try {
    await onMessageFromHTMLView(actionType, data)
  } catch (error) {
    logError(`updateReactWindowData`, `Error "${error.message}" for action '${actionType}'`)
  }
}

/**
 * Router function that receives requests from the React Window and routes them to the appropriate function
 * (e.g. handleSubmitButtonClick example below)
 * Here's where you will process any other commands+data that comes back from the React Window
 * @author @dwertheimer
 */
export async function onMessageFromHTMLView(actionType: string, data: any): Promise<any> {
  try {
    let _newData = null
    logInfo(pluginJson, `actionType '${actionType}' received by onMessageFromHTMLView`)
    const reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID) // get the current data from the React Window
    if (data.passThroughVars) reactWindowData.passThroughVars = { ...reactWindowData.passThroughVars, ...data.passThroughVars }
    const dataToSend = { ...data }
    if (!dataToSend.actionType) dataToSend.actionType = actionType
    switch (actionType) {
      case 'SHOW_BANNER':
        sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'SHOW_BANNER', dataToSend)
        break
      // Note: SO THAT JGCLARK DOESN'T HAVE TO RE-INVENT THE WHEEL HERE, WE WILL JUST CALL THE PRE-EXISTING FUNCTION bridgeDashboardItem
      // every time
      default:
        _newData = (await bridgeClickDashboardItem(dataToSend)) || reactWindowData // the processing function can update the reactWindowData object and return it
        break
    }

    return {} // this return value is ignored but needs to exist or we get an error
  } catch (error) {
    logError(`onMessageFromHTMLView`, `Error "${error.message}" for action '${actionType}'`)
  }
}

/**
 * Gather data you want passed to the React Window (e.g. what you you will use to display).
 * You will likely use this function to pull together your starting window data.
 * Must return an object, with any number of properties, however you cannot use the following reserved properties:
 *   pluginData, title, debug, ENV_MODE, returnPluginCommand, componentPath, passThroughVars, startTime
 * @returns {[string]: mixed} - the data that your React Window will start with
 */

export async function getPluginData(dashboardSettings: TDashboardSettings, perspectiveSettings: Array<TPerspectiveDef>, useDemoData: boolean = false): Promise<TPluginData> {
  logDebug('getPluginData', `Starting ${useDemoData ? 'with DEMO DATA!' : ''}`)

  // Important Note: If we need to force load everything, it's easy.
  // But if we don't then 2 things are needed:
  // - the getSomeSectionsData() for just the Today section(s)
  // - then once the HTML Window is available, Dialog.jsx realises that <= 2 sections, and kicks off incrementallyRefreshSomeSections to generate the others
  const sections = dashboardSettings.FFlag_ForceInitialLoadForBrowserDebugging === true ? await getAllSectionsData(useDemoData, true, true) : []

  const NPSettings = getNotePlanSettings()

  const pluginData: TPluginData = {
    sections: sections,
    lastFullRefresh: new Date(),
    dashboardSettings: dashboardSettings,
    perspectiveSettings: perspectiveSettings,
    notePlanSettings: NPSettings,
    logSettings: await getLogSettings(),
    demoMode: useDemoData,
    platform: NotePlan.environment.platform, // used in window/dialog management
    themeName: dashboardSettings.dashboardTheme ? dashboardSettings.dashboardTheme : Editor.currentTheme?.name || '<could not get theme>',
    version: pluginJson['plugin.version'],
    pushFromServer: {
      dashboardSettings: true,
      perspectiveSettings: true,
    },
    totalDoneCount: 0,
    firstRun: true,
    currentMaxPriorityFromAllVisibleSections: 0,
  }
  logDebug('getPluginData', `After forming initial pluginData, firstRun = false`)

  // Calculate all done task counts (if the appropriate setting is on)
  if (NPSettings.doneDatesAvailable) {
    const totalDoneCount = await updateDoneCountsFromChangedNotes('end of getPluginData', dashboardSettings.FFlag_ShowSectionTimings === true)
    pluginData.totalDoneCount = totalDoneCount
  }

  return pluginData
}
