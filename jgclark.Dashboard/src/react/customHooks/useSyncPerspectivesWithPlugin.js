// @flow

import { useEffect, useRef } from 'react'
import isEqual from 'lodash/isEqual'
import { PERSPECTIVE_ACTIONS } from '../reducers/actionTypes'
import { getDiff } from '@helpers/dev'
import { logDebug } from '@helpers/react/reactDev.js'

type DispatchAction = {
  type: string,
  payload: any,
  reason?: string,
}

type CompareFn = (a: any, b: any) => any

/**
 * Custom hook to synchronize perspective settings with plugin settings.
 * NOTE: We don't use this to send changes to the plugin because perspectives are always saved by the plugin not the front-end
 * So when a change is made, we send a sendActionToPlugin to update the perspectives
 * And then the plugin sends the revised perspectives here.
 * So really, all we are doing is listening for changes in pluginData.perspectiveSettings and applying it
 * @param {any} perspectiveSettings - The local perspective settings state.
 * @param {any} pluginDataPerspectives - The perspective settings from the plugin.
 * @param {Function} dispatch - Dispatch function to update local settings.
 * @param {string} actionType - The action type for dispatching changes.
 * @param {Function} compareFn - Function to compare local and plugin settings.
 */
export const useSyncPerspectivesWithPlugin = (
  perspectiveSettings: any,
  pluginDataPerspectives: any,
  dispatch: (action: DispatchAction) => void,
  compareFn: CompareFn = isEqual,
) => {
  const lastpluginDataPerspectivesRef = useRef<any>(pluginDataPerspectives)
  const lastPerspectiveSettingsRef = useRef<any>(perspectiveSettings)

  // Handle receiving changes from the plugin which need dispatching to the front-end
  useEffect(() => {
    if (!pluginDataPerspectives) return

    const pluginDataPerspectivesChanged = compareFn(lastpluginDataPerspectivesRef.current, pluginDataPerspectives) !== null

    if (pluginDataPerspectivesChanged) {
      const diff = compareFn(pluginDataPerspectives, perspectiveSettings)
      const realDiff = getDiff(pluginDataPerspectives, perspectiveSettings)
      logDebug(`useSyncPerspectivesWithPlugin`, `pluginDataPerspectivesChanged: ${String(pluginDataPerspectivesChanged)}`, { pluginDataPerspectives })
      logDebug(`useSyncPerspectivesWithPlugin`, `realDiff=`, realDiff)
      logDebug(`useSyncPerspectivesWithPlugin`, `diff=`, diff)

      // Check if diff exists and has changes
      // For arrays, compareObjects returns a sparse array, so we need to check if any elements exist
      // For objects, compareObjects returns an object with changed keys
      let hasChanges = false
      if (diff !== null) {
        if (Array.isArray(diff)) {
          // For sparse arrays returned by compareObjects, check if any index has a value
          // compareObjects returns an array where changed indices contain the diff object
          for (let i = 0; i < diff.length; i++) {
            if (i in diff && diff[i] !== null && diff[i] !== undefined) {
              hasChanges = true
              logDebug(`useSyncPerspectivesWithPlugin`, `found change at index ${i}:`, diff[i])
              break
            }
          }
        } else {
          hasChanges = Object.keys(diff).length > 0
        }
      }

      logDebug(`useSyncPerspectivesWithPlugin`, `hasChanges=${String(hasChanges)}`)

      // If plugin data changed, always dispatch (plugin is source of truth)
      // The comparison with React state is just to avoid unnecessary dispatches,
      // but if plugin sent new data, we should use it
      if (hasChanges || pluginDataPerspectivesChanged) {
        logDebug(`useSyncPerspectivesWithPlugin`, `Dispatching to front-end to update perspectives (hasChanges=${String(hasChanges)}, pluginDataPerspectivesChanged=${String(pluginDataPerspectivesChanged)})`)
        lastPerspectiveSettingsRef.current = pluginDataPerspectives
        lastpluginDataPerspectivesRef.current = pluginDataPerspectives
        dispatch({
          type: PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS,
          payload: pluginDataPerspectives,
          reason: `pluginData.perspectiveSettings changed`,
        })
      } else {
        // Still update the ref even if we don't dispatch, so we don't keep checking the same change
        lastpluginDataPerspectivesRef.current = pluginDataPerspectives
      }
    }
  }, [pluginDataPerspectives, perspectiveSettings, dispatch, compareFn])

  // Handle Perspectives front-end changes which need sending changes to the plugin
  //   useEffect(() => {
  //     const diff = perspectiveSettings ? compareFn(lastPerspectiveSettingsRef.current, perspectiveSettings) : null
  //     const perspectiveSettingsChanged = perspectiveSettings && diff !== null
  //     const realDiff = getDiff(lastPerspectiveSettingsRef.current, perspectiveSettings)
  //     if (perspectiveSettingsChanged) {
  //       lastPerspectiveSettingsRef.current = perspectiveSettings
  //     }
  //   }, [perspectiveSettings, pluginDataPerspectives, actionType, compareFn])
}
