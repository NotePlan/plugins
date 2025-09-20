// @flow

import { logDebug, clo } from '../../helpers/dev'
import { showMessage, createFolderRepresentation, chooseDecoratedOptionWithModifiers, chooseOption } from '@helpers/userInput'
import { getFolderViewData, getFoldersWithNamedViews, getNamedViewsForFolder } from '@helpers/folders'
import { getAllTeamspaceIDsAndTitles } from '@helpers/NPTeamspace'

/**
 * Get and validate folder view data
 * @returns {Object|null} Parsed folder view data or null if not available
 */
function getValidatedFolderData(): Object | null {
  const folderData = getFolderViewData()
  if (!folderData) {
    showMessage('No folder view data available. Please ensure you have folder views configured.')
    return null
  }

  clo(folderData, `getValidatedFolderData: folderData (${typeof folderData})`)
  return folderData
}

/**
 * Create folder options with view counts and descriptions
 * @param {Array<string>} allFolders - List of all folders
 * @param {Object} folderData - The folder view data
 * @returns {Array<Object>} Array of folder option objects
 */
function createFolderOptions(allFolders: $ReadOnlyArray<string>, folderData: Object): Array<Object> {
  const teamspaceDefs = getAllTeamspaceIDsAndTitles()

  return allFolders.map((folderPath) => {
    // Check if this folder has named views
    const namedViews = getNamedViewsForFolder(folderData, folderPath)
    const hasNamedViews = namedViews && namedViews.length > 0

    if (hasNamedViews) {
      // For folders with named views, create decorated options
      const viewCount = namedViews.length
      const [simpleOption, dobj] = createFolderRepresentation(folderPath, true, teamspaceDefs)
      const decoratedOption: { ...TCommandBarOptionObject, views?: Object } = { ...dobj, views: [] }

      // Create label with folder name and view count
      const label = `${simpleOption} (${viewCount} view${viewCount !== 1 ? 's' : ''})`

      // Set short description based on view count
      decoratedOption.views = namedViews
      if (viewCount === 1) {
        // For single view, show the view name
        decoratedOption.shortDescription = `View: ${namedViews[0].name}`
      } else {
        // For multiple views, show first view + count of others
        const firstViewName = namedViews[0].name
        const othersCount = viewCount - 1
        decoratedOption.shortDescription = `Views: ${firstViewName} + ${othersCount} other${othersCount !== 1 ? 's' : ''}`
      }

      return {
        label: label,
        value: folderPath,
        ...decoratedOption,
      }
    } else {
      // For folders without named views, create standard folder options
      const [simpleOption, dobj] = createFolderRepresentation(folderPath, true, teamspaceDefs)
      return {
        label: simpleOption,
        value: folderPath,
        ...dobj,
        views: [], // Empty views array for consistency
      }
    }
  })
}

/**
 * Let user select a folder from the available options
 * @param {Array<Object>} folderOptions - Array of folder option objects
 * @returns {Object|null} Selected folder object or null if cancelled
 */
async function selectFolder(folderOptions: Array<Object>): Promise<Object | null> {
  clo(folderOptions, `selectFolder: folderOptions`)

  const selection = await chooseDecoratedOptionWithModifiers('Choose a folder', folderOptions)
  if (!selection) return null

  const selectedFolderObj = folderOptions[selection.index]
  clo(selection, `selectFolder: selection`)

  return selectedFolderObj
}

/**
 * Create view options for the selected folder
 * @param {Array<Object>} views - Array of named views for the folder
 * @returns {Array<Object>} Array of view option objects
 */
function createViewOptions(views: Array<Object>): Array<Object> {
  let viewOptions: Array<Object> = []

  // If there are named views, add them as options
  if (views && views.length > 0) {
    viewOptions = views.map((view: Object) => ({
      text: `${view.name}`,
      value: view.name,
      shortDescription: `(${view.layout})`,
    }))
  }

  // Always add option to open folder view default
  viewOptions.unshift({ text: '< Open the folder view default >', value: '_folder_', shortDescription: 'Default folder view' })

  clo(viewOptions, `createViewOptions: viewOptions`)
  return viewOptions
}

/**
 * Let user select a view from the available options
 * @param {Array<Object>} viewOptions - Array of view option objects
 * @param {string} selectedFolder - The selected folder path
 * @returns {string} Selected view name or empty string if cancelled
 */
async function selectView(viewOptions: Array<Object>, selectedFolder: string): Promise<string> {
  if (viewOptions.length === 0) return ''

  // If there's only the default option (no named views), just return it
  if (viewOptions.length === 1) {
    return viewOptions[0].value
  }
  clo(viewOptions, `selectView viewOptions`)
  const responseObj = await chooseDecoratedOptionWithModifiers(`Choose a view for '${selectedFolder}'`, viewOptions)
  if (responseObj) {
    clo(responseObj, `selectView responseObj`)
    return responseObj.value
  }
  return ''
}

/**
 * Build the callback URL based on selected folder and view
 * @param {string} selectedFolder - The selected folder path
 * @param {string} selectedViewName - The selected view name
 * @returns {string} The generated callback URL
 */
function buildCallbackUrl(selectedFolder: string, selectedViewName: string): string {
  // TODO: I asked @eduardme if he would make it possible to open the folder view default by supplying just the folder name, but he said no.
  // In the meantime, we have to do this workaround:
  let url = ''
  if (selectedViewName === '_folder_') {
    url = `noteplan://x-callback-url/openNote?filename=${encodeURIComponent(selectedFolder)}`
  } else {
    let params = `?`
    if (selectedViewName && selectedViewName !== '_folder_') {
      params += `name=${encodeURIComponent(selectedViewName)}&`
    }
    if (selectedFolder && selectedFolder !== '/') {
      params += `folder=${encodeURIComponent(selectedFolder)}`
    }
    url = `noteplan://x-callback-url/openView${params}`
  }

  clo(url, `buildCallbackUrl: Generated URL`)
  return url
}

/**
 * Main function to open a folder view
 * @returns {Promise<string>} The callback URL or empty string if cancelled
 */
export async function openFolderView(): Promise<string> {
  // Step 1: Get and validate folder data
  const folderData = getValidatedFolderData()
  if (!folderData) return ''

  // Step 2: Get ALL folders from DataStore
  const allFolders = DataStore.folders
  if (!allFolders || allFolders.length === 0) {
    await showMessage('No folders found. Please ensure you have folders in your NotePlan setup.')
    return ''
  }

  // Step 3: Create folder options for all folders and let user choose
  const folderOptions = createFolderOptions(allFolders, folderData)
  const selectedFolderObj = await selectFolder(folderOptions)
  if (!selectedFolderObj) return ''

  const { value: selectedFolder, views } = selectedFolderObj

  // Step 4: Create view options and let user choose
  const viewOptions = createViewOptions(views)
  const selectedViewName = await selectView(viewOptions, selectedFolder)
  if (!selectedViewName) return ''

  // Step 5: Build and return the callback URL
  return buildCallbackUrl(selectedFolder, selectedViewName)
}
