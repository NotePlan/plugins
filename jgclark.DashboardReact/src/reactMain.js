// @flow

import moment from 'moment/min/moment-with-locales'
import pluginJson from '../plugin.json'
import {
  getSettings,
  type dashboardConfigType,
} from './dashboardHelpers'
import type { TSection, SectionItem } from './types'
import {
  openTodayParas,
  refTodayParas,
  openYesterdayParas,
  refYesterdayParas,
  demoOpenWeekParas,
  demoSortedWeekRefParas,
  openMonthParas,
  sortedMonthRefParas,
  tagParasFromNote,
  nextNotesToReview,
} from './demoData'
import { getTodaysDateUnhyphenated } from '@helpers/dateTime'
import { log, logError, logDebug, timer, clo, JSP } from '@helpers/dev'
import { getGlobalSharedData, sendToHTMLWindow, sendBannerMessage } from '@helpers/HTMLView'
import { toNPLocaleDateString } from '@helpers/NPdateTime'
import { checkForRequiredSharedFiles } from '@helpers/NPRequiredFiles'

const WEBVIEW_WINDOW_ID = `${pluginJson['plugin.id']} React Window` // will be used as the customId for your window
// you can leave it like this or if you plan to open multiple windows, make it more specific per window
const REACT_WINDOW_TITLE = 'Dashboard (XXX items)' // change this to what you want window title to display

export type PassedData = {
  startTime?: Date /* used for timing/debugging */,
  title?: string /* React Window Title */,
  pluginData: any /* Your plugin's data to pass on first launch (or edited later) */,
  ENV_MODE?: 'development' | 'production',
  debug: boolean /* set based on ENV_MODE above */,
  returnPluginCommand: { id: string, command: string } /* plugin jsFunction that will receive comms back from the React window */,
  componentPath: string /* the path to the rolled up webview bundle. should be ../pluginID/react.c.WebView.bundle.* */,
  passThroughVars?: any /* any data you want to pass through to the React Window */,
}

/**
 * Gathers key data for the React Window, including the callback function that is used for comms back to the plugin
 * @returns {PassedData} the React Data Window object
 */
export function getInitialDataForReactWindowObjectForReactView(useDemoData: boolean = false): PassedData {
  const startTime = new Date()
  // get whatever pluginData you want the React window to start with and include it in the object below. This all gets passed to the React window
  const pluginData = getInitialDataForReactWindow(useDemoData)
  const ENV_MODE = 'development' /* helps during development. set to 'production' when ready to release */
  const dataToPass: PassedData = {
    pluginData,
    title: REACT_WINDOW_TITLE,
    debug: ENV_MODE === 'development' ? true : false,
    ENV_MODE,
    returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onMessageFromHTMLView' },
    /* change the ID below to your plugin ID */
    componentPath: `../jgclark.DashboardReact/react.c.WebView.bundle.${ENV_MODE === 'development' ? 'dev' : 'min'}.js`,
    startTime,
  }
  return dataToPass
}

/*
 * REPLACE DUMMY DATA IN EACH OF THE FOLLOWING WITH FUNCTIONS TO COMPILE ACTUAL DATA
 */

function getTodaySectionData(useDemoData: boolean = false): any {
  const sectionNum = 0
  let itemCount = 0
  const items: Array<SectionItem> = []
  const today = new moment().toDate() // use moment instead of  `new Date` to ensure we get a date in the local timezone
  const todayDateLocale = toNPLocaleDateString(new Date(), "short") // uses moment's locale info from NP
  const thisFilename = `${getTodaysDateUnhyphenated()}.md`

  if (useDemoData) {
    const combinedSortedParas = openTodayParas.concat(refTodayParas)
    // write one combined section
    combinedSortedParas.map((p) => {
      const thisID = `${sectionNum}-${itemCount}`
      items.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type, noteTitle: '', priority: 0 })
      itemCount++
    })
    const section: Section = { ID: sectionNum, name: 'Today', sectionType: 'DT', description: `{count} from ${todayDateLocale} {addItems} {addItemsNextPeriod}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename, items: items }

    // return JSON.stringify(section)
    return section
  }

  return {
    name: 'Today',
    description: '14 items from daily note or scheduled to 3/23/2024',
    FAIconClass: 'fa-calendar-star',
    items: [
      {
        id: '0-0',
        content: 'Lorem ipsum dolor sit amet, #VidAI',
        noteTitle: '20240307',
        priority: 0 /** assumes you send numeric priority with the content, use getNumericPriorityFromPara() (from helpers/sorting.js) **/,
      },
      {
        id: '0-1',
        content: 'Consectetur adipiscing elit, maybe buy a TrackRig',
        noteTitle: '',
        priority: 2,
      },
    ],
  }
}

function getYesterdaySectionData(useDemoData: boolean = false) {
  const yesterday = new moment().subtract(1, 'days').toDate()
  const yesterdayDateLocale = toNPLocaleDateString(yesterday, "short") // uses moment's locale info from NP
  const thisFilename = `${moment(yesterday).format("YYYYMMDD")}.md`
  const sectionNum = 1
  let itemCount = 0
  const items: Array<SectionItem> = []

  if (useDemoData) {
    const combinedYesterdaySortedParas = openYesterdayParas.concat(refYesterdayParas)
    // write one combined section
    combinedYesterdaySortedParas.map((p) => {
      const thisID = `${sectionNum}-${itemCount}`
      items.push({ ID: thisID, content: p.content, rawContent: p.rawContent, filename: p.filename ?? '', type: p.type, noteTitle: '', priority: 0 })
      itemCount++
    })
    const section: Section = { ID: sectionNum, name: 'Yesterday', sectionType: 'DY', description: `{count} from ${yesterdayDateLocale} {scheduleAllYesterdayToday}`, FAIconClass: "fa-light fa-calendar-star", sectionTitleClass: "sidebarDaily", filename: thisFilename, items: items }

    // return JSON.stringify(section)
    return section
  }

  return {
    name: 'Yesterday',
    description: '1 item from daily note or scheduled to 3/22/2024',
    FAIconClass: 'fa-calendar-days',
    items: [
      {
        id: '1-0',
        content: 'Register poker event at lorem ipsum dolor sit',
        noteTitle: '',
      },
    ],
  }
}

function getProjectsSectionData() {
  return {
    name: 'Projects',
    description: '6 next projects to review',
    FAIconClass: 'fa-calendar-check',
    items: [
      {
        id: '5-0',
        content: 'Plugin Tester - HTML List Project',
        noteTitle: '',
      },
      {
        id: '5-1',
        content: 'Plugin Splitting into Smaller Plugins',
        noteTitle: '',
        priority: 1,
      },
      // Add more project items as needed
    ],
  }
}

function getTaggedSectionData() {
  return {
    name: '#home',
    description: 'All items ordered by priority',
    FAIconClass: 'fa-hashtag',
    items: [
      {
        id: '4-0',
        content: 'Test #home lorem ipsum',
        noteTitle: '20240320',
      },
    ],
  }
}

function getAllSectionsData(demoMode: boolean = false) {
  return [getTodaySectionData(demoMode),
  getYesterdaySectionData(demoMode),
  getProjectsSectionData(),
  getTaggedSectionData()]
}

/**
 * Gather data you want passed to the React Window (e.g. what you you will use to display)
 * You will likely use this function to pull together your starting window data
 * Must return an object, with any number of properties, however you cannot use the following reserved
 * properties: pluginData, title, debug, ENV_MODE, returnPluginCommand, componentPath, passThroughVars, startTime
 * @returns {[string]: mixed} - the data that your React Window will start with
 */
export function getInitialDataForReactWindow(demoMode: boolean = false): { [string]: mixed } {
  return {
    sections: getAllSectionsData(demoMode),
    lastUpdated: new Date().toLocaleString() /* placeholder */,
    settings: DataStore.settings,
    totalItems: 999 /* placeholder */,
  }
  // we return tableRows just as an example, but there's nothing magic about that property name
  // you could pass any object with any number of fields you want
}

/**
 * Router function that receives requests from the React Window and routes them to the appropriate function
 * (e.g. handleSubmitButtonClick example below)
 * Here's where you will process any other commands+data that comes back from the React Window
 * @author @dwertheimer
 */
export async function onMessageFromHTMLView(actionType: string, data: any): Promise<any> {
  try {
    logDebug(pluginJson, `NP Plugin return path (onMessageFromHTMLView) received actionType="${actionType}" (typeof=${typeof actionType})  (typeof data=${typeof data})`)
    clo(data, `Plugin onMessageFromHTMLView data=`)
    let reactWindowData = await getGlobalSharedData(WEBVIEW_WINDOW_ID) // get the current data from the React Window
    clo(reactWindowData, `Plugin onMessageFromHTMLView reactWindowData=`)
    if (data.passThroughVars) reactWindowData.passThroughVars = { ...reactWindowData.passThroughVars, ...data.passThroughVars }
    switch (actionType) {
      /* best practice here is not to actually do the processing but to call a function based on what the actionType was sent by React */
      /* you would probably call a different function for each actionType */
      case 'refresh':
        testReactWindow('refresh')
        break
      case 'onSubmitClick':
        reactWindowData = await handleSubmitButtonClick(data, reactWindowData) //update the data to send it back to the React Window
        break
      default:
        await sendBannerMessage(WEBVIEW_WINDOW_ID, `Plugin received an unknown actionType: "${actionType}" command with data:\n${JSON.stringify(data)}`)
        break
    }
    if (reactWindowData) {
      const updateText = `After ${actionType}, data was updated` /* this is just a string for debugging so you know what changed in the React Window */
      clo(reactWindowData, `Plugin onMessageFromHTMLView after updating window data,reactWindowData=`)
      sendToHTMLWindow(WEBVIEW_WINDOW_ID, 'SET_DATA', reactWindowData, updateText) // note this will cause the React Window to re-render with the currentJSData
    }
    return {} // this return value is ignored but needs to exist or we get an error
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}

/**
 * An example handler function that is called when someone clicks a button in the React Window
 * When someone clicks a "Submit" button in the React Window, it calls the router (onMessageFromHTMLView)
 * which sees the actionType === "onSubmitClick" so it routes to this function for processing
 * @param {any} data - the data sent from the React Window for the action 'onSubmitClick'
 * @param {any} reactWindowData - the current data in the React Window
 * @returns {any} - the updated data to send back to the React Window
 */
async function handleSubmitButtonClick(data: any, reactWindowData: PassedData): Promise<PassedData> {
  const { index: clickedIndex } = data //in our example, the button click just sends the index of the row clicked
  await sendBannerMessage(
    WEBVIEW_WINDOW_ID,
    `Plugin received an actionType: "onSubmitClick" command with data:<br/>${JSON.stringify(
      data,
    )}.<br/>Plugin then fired this message over the bridge to the React window and changed the data in the React window.`,
  )
  clo(reactWindowData, `handleSubmitButtonClick: reactWindowData BEFORE update`)
  // change the data in the React window for the row that was clicked (just an example)
  // find the right row, even though rows could have been scrambled by the user inside the React Window
  const index = reactWindowData.pluginData.tableRows.findIndex((row) => row.id === clickedIndex)
  reactWindowData.pluginData.tableRows[index].textValue = `Item ${clickedIndex} was updated by the plugin (see changed data in the debug section below)`
  return reactWindowData //updated data to send back to React Window
}

/**
 * Plugin Entry Point for "Test React Window"
 * @author @dwertheimer
 */
export async function showDemoDashboard(): Promise<void> {
  await testReactWindow('full', true)
}

/**
 * Plugin Entry Point for "Test React Window"
 * @author @dwertheimer
 */
export async function testReactWindow(callMode: string = 'full', demoMode: boolean = false): Promise<void> {
  try {
    logDebug(pluginJson, `testReactWindow starting up (mode '${callMode}')${demoMode ? ' in DEMO MODE' : ''}`)
    // make sure we have the np.Shared plugin which has the core react code and some basic CSS
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true) // you must have np.Shared code in order to open up a React Window
    // logDebug(pluginJson, `testReactWindow: installOrUpdatePluginsByID ['np.Shared'] completed`)

    // get initial data to pass to the React Window
    const data = await getInitialDataForReactWindowObjectForReactView(demoMode)

    // Note the first tag below uses the w3.css scaffolding for basic UI elements. You can delete that line if you don't want to use it
    // w3.css reference: https://www.w3schools.com/w3css/default.asp
    // The second line needs to be updated to your pluginID in order to load any specific CSS you want to include for the React Window (in requiredFiles)
    const cssTagsString = `
      <link rel="stylesheet" href="../np.Shared/css.w3.css">
      <link rel="stylesheet" href="../jgclark.DashboardReact/dashboard.css">
      <link rel="stylesheet" href="../jgclark.DashboardReact/dashboardDialog.css">
      <link rel="stylesheet" href="../jgclark.DashboardReact/dashboardHoverControls.css">
		  <link rel="stylesheet" href="../jgclark.DashboardReact/css.plugin.css">
      <!-- Load in fontawesome assets from np.Shared (licensed for NotePlan) -->
      <link href="../np.Shared/fontawesome.css" rel="stylesheet">
      <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">\n`
    const windowOptions = {
      savedFilename: `../../${pluginJson['plugin.id']}/dashboard-react.html`, /* for saving a debug version of the html file */
      headerTags: cssTagsString,
      windowTitle: data.title,
      customId: WEBVIEW_WINDOW_ID,
      shouldFocus: callMode !== 'refresh', /* focus window every time (unless this is a refresh) */
    }
    logDebug(`===== testReactWindow Calling React after ${timer(data.startTime || new Date())} =====`)
    logDebug(pluginJson, `testReactWindow invoking window. testReactWindow stopping here. It's all React from this point forward`)
    // clo(data, `testReactWindow data object passed`)
    // now ask np.Shared to open the React Window with the data we just gathered
    await DataStore.invokePluginCommandByName('openReactWindow', 'np.Shared', [data, windowOptions])
  } catch (error) {
    logError(pluginJson, JSP(error))
  }
}
