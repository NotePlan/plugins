// @flow
import pluginJson from '../plugin.json'
import { openReactWindow } from './NPReactLocal'
import { sendToHTMLWindow, sendBannerMessage } from '@helpers/HTMLView'
import { logDebug, logError, logInfo, logWarn, JSP, clo } from '@helpers/dev'

/**
 * Type for a plugin version release
 */
type PluginVersion = {
  pluginId: string,
  pluginName: string,
  version: string,
  releaseDate: string,
  updatedAt: ?string,
  isBeta: boolean,
  tag: string,
  isInstalled: boolean,
  installedVersion: ?string,
  releaseBody: ?string,
  releaseUrl: ?string,
}

/**
 * Fetch all GitHub releases for NotePlan plugins (handles pagination)
 * @returns {Promise<Array<Object>>} Array of release objects from GitHub API
 */
async function fetchGitHubReleases(): Promise<Array<any>> {
  try {
    logDebug(pluginJson, 'fetchGitHubReleases: Fetching releases from GitHub API')
    const allReleases: Array<any> = []
    let page = 1
    const perPage = 100
    let hasMore = true
    
    while (hasMore) {
      const url = `https://api.github.com/repos/NotePlan/plugins/releases?per_page=${perPage}&page=${page}`
      const response = await fetch(url)
      
      if (!response) {
        logError(pluginJson, `fetchGitHubReleases: Failed to fetch releases page ${page}. No response.`)
        hasMore = false
      } else {
        // NotePlan's fetch returns a string, not a Response object
        const releases = JSON.parse(response)
        
        if (!releases || releases.length === 0) {
          // No more releases
          hasMore = false
        } else {
          allReleases.push(...releases)
          logDebug(pluginJson, `fetchGitHubReleases: Fetched page ${page}, ${releases.length} releases (total so far: ${allReleases.length})`)
          
          // If we got fewer than perPage, we're done
          if (releases.length < perPage) {
            hasMore = false
          } else {
            page++
          }
        }
      }
    }
    
    logDebug(pluginJson, `fetchGitHubReleases: Found ${allReleases.length} total releases`)
    return allReleases
  } catch (error) {
    logError(pluginJson, `fetchGitHubReleases: Error: ${JSP(error)}`)
    return []
  }
}

/**
 * Extract plugin ID and version from a GitHub release tag
 * Tags are in format: pluginId-v1.2.3 or pluginId-v1.2.3-beta
 * @param {string} tag - The release tag
 * @param {boolean} isPrerelease - Whether the GitHub release is marked as a prerelease
 * @returns {?{pluginId: string, version: string, isBeta: boolean}} Parsed plugin info or null
 */
function parseReleaseTag(tag: string, isPrerelease: boolean = false): ?{ pluginId: string, version: string, isBeta: boolean } {
  try {
    // Tag format: pluginId-v1.2.3 or pluginId-v1.2.3-beta
    const match = tag.match(/^(.+?)-v(.+)$/)
    if (!match) return null
    
    const [, pluginId, versionPart] = match
    // Check if version part contains beta/alpha/rc, or if GitHub marks it as prerelease
    const hasBetaInTag = versionPart.includes('-beta') || versionPart.includes('-alpha') || versionPart.includes('-rc')
    const isBeta = isPrerelease || hasBetaInTag
    
    // Clean version string (remove beta/alpha/rc suffixes for display)
    const version = versionPart.replace(/-beta$/, '').replace(/-alpha$/, '').replace(/-rc\d+$/, '')
    
    return { pluginId, version, isBeta }
  } catch (error) {
    logError(pluginJson, `parseReleaseTag: Error parsing tag "${tag}": ${JSP(error)}`)
    return null
  }
}

/**
 * Get installed plugins and their versions
 * @returns {Array<{id: string, version: string}>} Array of installed plugin info
 */
function getInstalledPlugins(): Array<{ id: string, version: string }> {
  try {
    const installed = DataStore.installedPlugins()
    return installed.map((p) => ({ id: p.id, version: p.version }))
  } catch (error) {
    logError(pluginJson, `getInstalledPlugins: Error: ${JSP(error)}`)
    return []
  }
}

/**
 * Process GitHub releases and group by plugin
 * Also fetches plugin data from NotePlan's DataStore.listPlugins() for comparison
 * @param {Array<any>} releases - Raw GitHub releases
 * @returns {Promise<Array<PluginVersion>>} Processed plugin versions
 */
async function processReleases(releases: Array<any>): Promise<Array<PluginVersion>> {
  const installedPlugins = getInstalledPlugins()
  const versionMap = new Map<string, Array<PluginVersion>>()
  
  // Get plugin data from NotePlan's DataStore (has more info like releaseUrl, etc.)
  let allPlugins: Array<any> = []
  try {
    allPlugins = await DataStore.listPlugins(true,true,false)
    logDebug(pluginJson, `processReleases: Fetched ${allPlugins.length} plugins from DataStore.listPlugins()`)
    clo(allPlugins, `processReleases: allPlugins`)
    throw new Error('test')
  } catch (error) {
    logWarn(pluginJson, `processReleases: Could not fetch plugin list: ${JSP(error)}`)
  }
  
  // Find a matching plugin to compare data sources
  let comparisonPlugin: ?any = null
  let comparisonRelease: ?any = null
  
  // Process all releases
  for (const release of releases) {
    // Check if release is marked as prerelease in GitHub (indicates beta/alpha/rc)
    const isPrerelease = release.prerelease === true
    const parsed = parseReleaseTag(release.tag_name, isPrerelease)
    if (!parsed) continue
    
    const { pluginId, version, isBeta } = parsed
    
    // Find matching plugin in NotePlan's data
    const noteplanPlugin = allPlugins.find((p) => p.id === pluginId)
    
    // For comparison, pick the first matching plugin we find
    if (!comparisonPlugin && noteplanPlugin) {
      comparisonPlugin = noteplanPlugin
      comparisonRelease = release
    }
    
    const installed = installedPlugins.find((p) => p.id === pluginId)
    
    const pluginVersion: PluginVersion = {
      pluginId,
      pluginName: noteplanPlugin?.name || pluginId, // Use NotePlan's plugin name if available
      version,
      releaseDate: release.published_at || release.created_at || '',
      updatedAt: release.updated_at || null,
      isBeta,
      tag: release.tag_name,
      isInstalled: installed != null,
      installedVersion: installed?.version || null,
      releaseBody: release.body || null,
      releaseUrl: release.html_url || null,
    }
    
    // Group by plugin ID
    if (!versionMap.has(pluginId)) {
      versionMap.set(pluginId, [])
    }
    versionMap.get(pluginId)?.push(pluginVersion)
  }
  
  // Log comparison of data sources for one matching plugin
  if (comparisonPlugin && comparisonRelease) {
    const parsed = parseReleaseTag(comparisonRelease.tag_name, comparisonRelease.prerelease === true)
    if (parsed) {
      clo(comparisonPlugin, `processReleases: NotePlan DataStore.listPlugins() data for plugin "${parsed.pluginId}":`)
      clo(comparisonRelease, `processReleases: GitHub API release data for plugin "${parsed.pluginId}":`)
      logDebug(
        pluginJson,
        `processReleases: Comparison - NotePlan has releaseUrl: ${comparisonPlugin.releaseUrl || 'none'}, GitHub has tag: ${comparisonRelease.tag_name}`,
      )
    }
  }
  
  // Flatten and add plugin names (already added above, but ensure all have names)
  const result: Array<PluginVersion> = []
  for (const [pluginId, versions] of versionMap.entries()) {
    const pluginInfo = allPlugins.find((p) => p.id === pluginId)
    const pluginName = pluginInfo?.name || pluginId
    
    // Sort versions by date (newest first)
    versions.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())
    
    // Ensure all versions have the correct plugin name
    versions.forEach((v) => {
      v.pluginName = pluginName
      result.push(v)
    })
  }
  
  // Sort by plugin name, then by version date
  result.sort((a, b) => {
    if (a.pluginName !== b.pluginName) {
      return a.pluginName.localeCompare(b.pluginName)
    }
    return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
  })
  
  return result
}

/**
 * Command handler for installing a plugin version
 * Called from React component via returnPluginCommand routing
 * Supports both REQUEST pattern (with correlation ID) and regular action pattern
 * @param {string} actionType - The action type (should be 'installPluginVersion')
 * @param {any} data - Data object containing pluginId, tag, and optionally __requestType, __correlationId, __windowId
 * @returns {Promise<any>} Response object (or empty if REQUEST pattern - response sent via sendToHTMLWindow)
 */
export async function onPluginVersionInstall(actionType: string, data: any): Promise<any> {
  try {
    logDebug(pluginJson, `onPluginVersionInstall: actionType="${actionType}", data=${JSP(data)}`)
    
    // Check if this is a REQUEST pattern message
    const isRequest = data?.__requestType === 'REQUEST'
    const correlationId = data?.__correlationId
    const windowId = data?.__windowId || ''
    
    if (actionType === 'installPluginVersion' && data?.pluginId && data?.tag) {
      const result = await handleInstallPluginVersion(data.pluginId, data.tag)
      
      // If REQUEST pattern, send response via sendToHTMLWindow
      if (isRequest && correlationId && windowId) {
        logDebug(pluginJson, `onPluginVersionInstall: Sending RESPONSE for correlationId="${correlationId}"`)
        logDebug(pluginJson, `onPluginVersionInstall: Response data: ${JSP(result)}`)
        
        // Send banner message if there's an error
        if (!result.success && windowId) {
          try {
            await sendBannerMessage(windowId, result.message || 'Installation failed', 'ERROR', 10000)
          } catch (bannerError) {
            logWarn(pluginJson, `onPluginVersionInstall: Failed to send banner message: ${JSP(bannerError)}`)
          }
        }
        
        await sendToHTMLWindow(windowId, 'RESPONSE', {
          correlationId,
          success: result.success,
          data: result.success ? { 
            success: result.success,
            installedVersion: result.installedVersion,
            message: result.message 
          } : null,
          error: result.success ? null : result.message,
        })
        return {} // Empty return for REQUEST pattern
      }
      
      // Regular action pattern - return result directly
      return result
    }
    
    logError(pluginJson, `onPluginVersionInstall: Invalid actionType or missing data`)
    const errorResponse = { success: false, message: 'Invalid request' }
    
    // If REQUEST pattern, send error response
    if (isRequest && correlationId && windowId) {
      try {
        await sendBannerMessage(windowId, 'Invalid request', 'ERROR', 10000)
      } catch (bannerError) {
        logWarn(pluginJson, `onPluginVersionInstall: Failed to send banner message: ${JSP(bannerError)}`)
      }
      await sendToHTMLWindow(windowId, 'RESPONSE', {
        correlationId,
        success: false,
        data: null,
        error: 'Invalid request',
      })
      return {}
    }
    
    return errorResponse
  } catch (error) {
    logError(pluginJson, `onPluginVersionInstall: Error: ${JSP(error)}`)
    const errorResponse = { success: false, message: error.message || JSP(error) }
    
    // If REQUEST pattern, send error response
    if (data?.__requestType === 'REQUEST' && data?.__correlationId && data?.__windowId) {
      const errorMsg = error.message || JSP(error)
      try {
        await sendBannerMessage(data.__windowId, errorMsg, 'ERROR', 10000)
      } catch (bannerError) {
        logWarn(pluginJson, `onPluginVersionInstall: Failed to send banner message: ${JSP(bannerError)}`)
      }
      await sendToHTMLWindow(data.__windowId, 'RESPONSE', {
        correlationId: data.__correlationId,
        success: false,
        data: null,
        error: errorMsg,
      })
      return {}
    }
    
    return errorResponse
  }
}

/**
 * Install a specific plugin version
 * Internal function called by onPluginVersionInstall
 * @param {string} pluginId - The plugin ID
 * @param {string} tag - The release tag (e.g., "pluginId-v1.2.3")
 * @returns {Promise<{success: boolean, message?: string}>} Success status
 */
async function handleInstallPluginVersion(pluginId: string, tag: string): Promise<{ success: boolean, message?: string, installedVersion?: string }> {
  try {
    logDebug(pluginJson, `handleInstallPluginVersion: START - Installing ${pluginId} version ${tag}`)
    
    // Get current installed version before installation
    const installedBefore = DataStore.installedPlugins()
    const pluginBefore = installedBefore.find((p) => p.id === pluginId)
    const versionBefore = pluginBefore?.version || 'not installed'
    logDebug(pluginJson, `handleInstallPluginVersion: Current installed version before install: ${versionBefore}`)
    
    // Extract version from tag (e.g., "jgclark.Dashboard-v2.4.0.b14-beta" -> "2.4.0.b14")
    const tagVersionMatch = tag.match(/-v(.+?)(?:-beta|-alpha|-rc)?$/i)
    const requestedVersion = tagVersionMatch ? tagVersionMatch[1] : tag
    logDebug(pluginJson, `handleInstallPluginVersion: Extracted requested version from tag: ${requestedVersion}`)
    
    // Normalize version for matching (handles variations like "2.4.0.b15" vs "2.4.0-b15")
    const normalizeVersion = (ver: string) => (ver || '').toLowerCase().replace(/[-_]/g, '.').trim()
    const normalizedRequested = normalizeVersion(requestedVersion)
    logDebug(pluginJson, `handleInstallPluginVersion: Normalized requested version: ${normalizedRequested}`)
    
    // Fetch all available plugins and find one that matches both pluginId AND version
    // Note: DataStore.listPlugins() may only return the latest version, not all versions
    const plugins = await DataStore.listPlugins(true, true, false)
    logDebug(pluginJson, `handleInstallPluginVersion: Found ${plugins?.length || 0} available plugins`)
    
    // Log all versions of the requested plugin for debugging
    const matchingPlugins = plugins?.filter(p => p.id === pluginId) || []
    logDebug(pluginJson, `handleInstallPluginVersion: Found ${matchingPlugins.length} plugin(s) with id "${pluginId}":`)
    matchingPlugins.forEach((p, idx) => {
      logDebug(pluginJson, `handleInstallPluginVersion:   [${idx}] id=${p.id}, version=${p.version}, name=${p.name || 'unknown'}`)
    })
    
    // Search for plugin with matching ID and version
    let plugin = null
    for (const p of plugins || []) {
      if (p.id === pluginId) {
        const normalizedPluginVersion = normalizeVersion(p.version || '')
        logDebug(pluginJson, `handleInstallPluginVersion: Checking plugin ${p.id} version ${p.version} (normalized: ${normalizedPluginVersion}) against requested ${requestedVersion} (normalized: ${normalizedRequested})`)
        
        // Match if normalized versions are equal or one contains the other
        const exactMatch = normalizedPluginVersion === normalizedRequested
        const containsMatch = normalizedPluginVersion.includes(normalizedRequested) || normalizedRequested.includes(normalizedPluginVersion)
        logDebug(pluginJson, `handleInstallPluginVersion:   exactMatch: ${exactMatch}, containsMatch: ${containsMatch}`)
        
        if (exactMatch || containsMatch) {
          plugin = p
          logDebug(pluginJson, `handleInstallPluginVersion: Found matching plugin: id=${plugin.id}, version=${plugin.version}, name=${plugin.name}`)
          break
        }
      }
    }
    
    if (!plugin) {
      const availableVersions = matchingPlugins.map(p => p.version).join(', ') || 'none'
      const message = `Could not find plugin "${pluginId}" version "${requestedVersion}" to install. NotePlan's API only shows the latest version. Available in NotePlan API: ${availableVersions}. You may need to install this version manually from GitHub.`
      logError(pluginJson, message)
      logDebug(pluginJson, `handleInstallPluginVersion: NotePlan's listPlugins() typically only returns the latest version of each plugin. To install older versions, we would need to download directly from GitHub releases.`)
      return { success: false, message }
    }
    
    logDebug(pluginJson, `handleInstallPluginVersion: Using plugin object: id=${plugin.id}, version=${plugin.version}, name=${plugin.name}`)
    
    // Note: DataStore.installPlugin might install the latest version, not a specific one
    // This is a limitation we'll need to work with for now
    logDebug(pluginJson, `handleInstallPluginVersion: Calling DataStore.installPlugin(${plugin.id}, true)`)
    const installedPlugin = await DataStore.installPlugin(plugin, true)
    logDebug(pluginJson, `handleInstallPluginVersion: DataStore.installPlugin returned: ${JSP(installedPlugin)}`)
    
    // Refresh installed plugins list to get actual installed version
    const installedAfter = DataStore.installedPlugins()
    const pluginAfter = installedAfter.find((p) => p.id === pluginId)
    const versionAfter = pluginAfter?.version || 'unknown'
    logDebug(pluginJson, `handleInstallPluginVersion: Installed version after install: ${versionAfter}`)
    
    if (versionAfter === versionBefore) {
      logWarn(pluginJson, `handleInstallPluginVersion: Version unchanged after install. Before: ${versionBefore}, After: ${versionAfter}, Requested: ${requestedVersion}`)
    } else {
      logInfo(pluginJson, `handleInstallPluginVersion: Version changed. Before: ${versionBefore}, After: ${versionAfter}, Requested: ${requestedVersion}`)
    }
    
    // Check if the installed version matches what was requested (normalizedRequested was already calculated above)
    const normalizedAfter = normalizeVersion(versionAfter)
    const versionMatches = normalizedAfter === normalizedRequested || normalizedAfter.includes(normalizedRequested) || normalizedRequested.includes(normalizedAfter)
    
    if (!versionMatches) {
      logWarn(pluginJson, `handleInstallPluginVersion: Installed version (${versionAfter}) does not match requested version (${requestedVersion}). NotePlan may have installed the latest version instead.`)
    }
    
    return { 
      success: true, 
      installedVersion: versionAfter,
      message: versionMatches 
        ? `Installed ${pluginId} version ${versionAfter}` 
        : `Installed ${pluginId} version ${versionAfter} (requested ${requestedVersion}, but NotePlan may have installed the latest version instead)`
    }
  } catch (error) {
    const message = `Error installing plugin: ${error.message || JSP(error)}`
    logError(pluginJson, `handleInstallPluginVersion: ERROR - ${message}`)
    return { success: false, message }
  }
}

/**
 * Main entry point for "Install Plugin Version" command
 * Shows a dialog with available plugin versions in a table
 */
export async function installPluginVersion(): Promise<void> {
  try {
    logDebug(pluginJson, 'installPluginVersion: Starting')
    
    // Fetch releases
    const releases = await fetchGitHubReleases()
    if (releases.length === 0) {
      logError(pluginJson, 'installPluginVersion: No plugin releases found. This might be a network issue.')
      return
    }
    
    // Process releases
    const pluginVersions = await processReleases(releases)
    if (pluginVersions.length === 0) {
      logError(pluginJson, 'installPluginVersion: No valid plugin versions found.')
      return
    }
    
    logDebug(pluginJson, `installPluginVersion: Found ${pluginVersions.length} plugin versions`)
    
    // Show React dialog with table
    showPluginVersionsDialog(pluginVersions)
  } catch (error) {
    logError(pluginJson, `installPluginVersion: Error: ${JSP(error)}`)
  }
}

/**
 * Show the plugin versions dialog using React
 * @param {Array<PluginVersion>} versions - Array of plugin versions to display
 */
function showPluginVersionsDialog(versions: Array<PluginVersion>): void {
  try {
    showPluginVersionsDialogReact(versions)
  } catch (error) {
    logError(pluginJson, `showPluginVersionsDialog: Error: ${JSP(error)}`)
  }
}

/**
 * Show plugin versions using React component in main window
 * @param {Array<PluginVersion>} versions - Array of plugin versions
 */
function showPluginVersionsDialogReact(versions: Array<PluginVersion>): void {
  // Set up the global data for the React window
  // Note: componentPath must point to a built bundle file, not the source .jsx
  // The bundle needs to be built first using: node np.Shared/src/react/support/performRollup.node.js
  const windowId = 'plugin-versions-installer'
  const globalData = {
    componentPath: `../np.Shared/react.c.PluginVersionsEntry.bundle.dev.js`,
    versions: versions,
    pluginId: pluginJson['plugin.id'],
    startTime: new Date(),
    ENV_MODE: 'development',
    // Set returnPluginCommand so React can send messages back to this plugin
    returnPluginCommand: { id: pluginJson['plugin.id'], command: 'onPluginVersionInstall' },
    // Set pluginData with windowId so React can send it back in requests
    pluginData: {
      windowId: windowId,
    },
  }
  
  logDebug(pluginJson, `showPluginVersionsDialogReact: Opening window with ${versions.length} versions`)
  
  // Use openReactWindow to display the React component (since we're in np.Shared, we can call it directly)
  openReactWindow(globalData, {
    windowTitle: 'Install Plugin Version',
    customId: windowId,
  })
}
