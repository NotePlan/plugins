// @flow
//--------------------------------------------------------------------------
// Window Management Functions - Opening and managing React windows
//--------------------------------------------------------------------------

import pluginJson from '../plugin.json'
import { type PassedData } from './shared/types.js'
import { generateCSSFromTheme } from '@helpers/NPThemeToCSS'
import { logDebug, logError, timer, JSP } from '@helpers/dev'

const REACT_WINDOW_TITLE = 'Favorites'
const FAVORITES_BROWSER_WINDOW_ID = 'favorites-browser-window'

/**
 * Generate a unique window ID for a favorites browser window
 * @param {string} identifier - Optional identifier to make the window unique
 * @returns {string} - The unique window ID
 */
export function getFavoritesBrowserWindowId(identifier?: string): string {
  const suffix = identifier && identifier.trim() ? ` ${identifier.trim()}` : ''
  return `${FAVORITES_BROWSER_WINDOW_ID}${suffix}`
}

/**
 * Gathers key data for the React Window
 * @param {boolean} showFloating - Whether this is a floating window
 * @param {string} windowId - The window ID
 * @returns {PassedData} the React Data Window object
 */
export function createWindowInitData(showFloating: boolean, windowId: string): PassedData {
  const startTime = new Date()
  logDebug(pluginJson, `createWindowInitData: ENTRY`)

  const pluginData = getPluginData(showFloating, windowId)
  const ENV_MODE = 'development' /* helps during development. set to 'production' when ready to release */

  const dataToPass: PassedData = {
    pluginData: {
      ...pluginData,
      windowId: windowId,
    },
    title: REACT_WINDOW_TITLE,
    logProfilingMessage: false,
    debug: false,
    ENV_MODE,
    returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onFavoritesBrowserAction' },
    componentPath: `../dwertheimer.Favorites/react.c.FavoritesView.bundle.dev.js`,
    startTime,
  }
  return dataToPass
}

/**
 * Gather data you want passed to the React Window
 * @param {boolean} showFloating - Whether this is a floating window
 * @param {string} windowId - The window ID
 * @returns {[string]: mixed} - the data that your React Window will start with
 */
export function getPluginData(showFloating: boolean, windowId: string): { [string]: mixed } {
  logDebug(pluginJson, `getPluginData: ENTRY`)

  const pluginData = {
    platform: NotePlan.environment.platform,
    windowId: windowId,
    showFloating: showFloating,
  }

  return pluginData
}

/**
 * Opens the Favorites Browser React window
 * @param {boolean|string} _isFloating - If true or 'true', use openReactWindow instead of showInMainWindow
 */
export async function openFavoritesBrowser(_isFloating: boolean | string = false): Promise<void> {
  try {
    logDebug(pluginJson, `openFavoritesBrowser: Starting, _isFloating=${String(_isFloating)}`)
    const startTime = new Date()

    // Make sure we have np.Shared plugin which has the core react code
    await DataStore.installOrUpdatePluginsByID(['np.Shared'], false, false, true)
    logDebug(pluginJson, `openFavoritesBrowser: installOrUpdatePluginsByID ['np.Shared'] completed`)

    // Determine if this should be a floating window
    const isFloating = _isFloating === true || (typeof _isFloating === 'string' && /true/i.test(_isFloating))

    // Generate unique window ID based on whether it's floating or main window
    const windowId = isFloating ? getFavoritesBrowserWindowId('floating') : getFavoritesBrowserWindowId('main')

    // get initial data to pass to the React Window
    const data = createWindowInitData(isFloating, windowId)

    const cssTagsString = `
      <link rel="stylesheet" href="../np.Shared/css.w3.css">
      <link href="../np.Shared/fontawesome.css" rel="stylesheet">
      <link href="../np.Shared/regular.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/solid.min.flat4NP.css" rel="stylesheet">
      <link href="../np.Shared/light.min.flat4NP.css" rel="stylesheet">\n`

    const themeCSS = generateCSSFromTheme()
    // find the --tint-color from the themeCSS
    const tintColor = themeCSS.match(/--tint-color: (.*?);/)?.[1]
    let iconColorHex = ''
    if (tintColor) {
      logDebug(pluginJson, `openFavoritesBrowser: Found tint color: ${tintColor}`)
      iconColorHex = tintColor
    } else {
      logDebug(pluginJson, `openFavoritesBrowser: No tint color found in themeCSS`)
    }

    const windowOptions = {
      savedFilename: `../../${pluginJson['plugin.id']}/favorites_browser_output.html` /* for saving a debug version of the html file */,
      headerTags: cssTagsString,
      windowTitle: REACT_WINDOW_TITLE,
      width: 500,
      height: 800,
      customId: windowId, // Use unique window ID instead of constant
      shouldFocus: true,
      generalCSSIn: themeCSS,
      specificCSS: `
        /* Favorites browser - left justified, full height, expandable width */
        body, html {
          margin: 0;
          padding: 0;
          height: 100vh;
          overflow: hidden;
        }
        #root, .favorites-view-container {
          width: 100%;
          height: 100vh;
        }
        /* Keep header controls fixed size and left-aligned */
        .favorites-view-header {
          width: 100%;
        }
        /* Let list items expand to fill available space */
        .favorites-view-container .filterable-list-container {
          flex: 1;
          min-width: 0;
        }
        .favorites-view-container .list-container {
          width: 100%;
        }
      `,
      postBodyScript: `
        <script type="text/javascript" >
        // Set DataStore.settings so default logDebug etc. logging works in React
        let DataStore = { settings: {_logLevel: "${DataStore.settings._logLevel}" } };
        </script>
      `,
      // Options for showInMainWindow (main window mode)
      icon: 'star',
      iconColor: '#F8E160',
      splitView: false,
      autoTopPadding: true,
      showReloadButton: true,
      reloadPluginID: 'dwertheimer.Favorites',
      reloadCommandName: 'Sidebar - Open Favorites Browser Sidebar',
    }

    // Choose the appropriate command based on whether it's floating or main window
    const windowType = isFloating ? 'openReactWindow' : 'showInMainWindow'
    logDebug(pluginJson, `openFavoritesBrowser: Using ${windowType} (${isFloating ? 'floating' : 'main'} window)`)
    await DataStore.invokePluginCommandByName(windowType, 'np.Shared', [data, windowOptions])
    logDebug(pluginJson, `openFavoritesBrowser: Completed after ${timer(startTime)}`)
  } catch (error) {
    logError(pluginJson, `openFavoritesBrowser: Error: ${JSP(error)}`)
    throw error
  }
}
