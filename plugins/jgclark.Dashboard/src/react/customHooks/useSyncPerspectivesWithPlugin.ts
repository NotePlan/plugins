// @flow

import { useEffect, useRef } from 'react'
import { logDebug, clo } from '@np/helpers/react/reactDev.js'
import { compareObjects, getDiff } from '@np/helpers/dev'
import isEqual from 'lodash/isEqual'
import { PERSPECTIVE_ACTIONS } from '../reducers/actionTypes'

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
    const pluginDataPerspectivesChanged = pluginDataPerspectives && compareFn(lastpluginDataPerspectivesRef.current, pluginDataPerspectives) !== null
    lastpluginDataPerspectivesRef.current = pluginDataPerspectives
    if (pluginDataPerspectivesChanged) {
      const diff = compareFn(pluginDataPerspectives, perspectiveSettings)
      const realDiff = getDiff(pluginDataPerspectives, perspectiveSettings)
      console.log(`useSyncPerspectivesWithPlugin`, `CD pluginDataPerspectivesChanged: ${String(pluginDataPerspectivesChanged)}`, { pluginDataPerspectives })
      console.log(`useSyncPerspectivesWithPlugin pluginDataPerspectivesChanged realDiff=`, realDiff)
      if (diff && Object.keys(diff).length > 0) {
        console.log(`useSyncPerspectivesWithPlugin Dispatching to front-end to update perspectives: diff=`, diff)
        lastPerspectiveSettingsRef.current = pluginDataPerspectives
        dispatch({
          type: PERSPECTIVE_ACTIONS.SET_PERSPECTIVE_SETTINGS,
          payload: pluginDataPerspectives,
          reason: `pluginData.perspectiveSettings changed`,
        })
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
