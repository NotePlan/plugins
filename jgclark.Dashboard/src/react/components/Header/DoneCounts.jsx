// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the done items counts at the top of the Dashboard window.
// Called by Heaer component.
// Last updated 2024-06-29 for v2.0.0-b16 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React from 'react'
// import { getFeatureFlags } from '../../shared.js'
import { useAppContext } from '../AppContext.jsx'
// import { createFeatureFlagItems } from './featureFlagItems.js'
// import useLastFullRefresh from './useLastFullRefresh.js'
import type { TDoneCount } from '../../../types.js'
import { logDebug } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------

type Props = {
  totalDoneCounts: TDoneCount,
};

//--------------------------------------------------------------------------
// Header Component
//--------------------------------------------------------------------------

const DoneCounts = ({ totalDoneCounts }: Props): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { /*sharedSettings,*/ pluginData } = useAppContext()

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------

  //----------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------
  // const { FFlag_DashboardSettings } = getFeatureFlags(pluginData.settings, sharedSettings)

  // const { settings: pluginDataSettings } = pluginData

  // Don't show counts on mobile, or if we don't have @done() dates available
  const isMobile = pluginData.platform === "iOS"
  const showCounts = pluginData.settings.doneDatesAvailable && !isMobile

  const itemsDoneCount = totalDoneCounts.completedTasks // + totalDoneCounts.completedChecklists

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  if (showCounts) {
    return (
      <div className="totalCounts">
        <span id="totalDoneCount">{itemsDoneCount}</span> {itemsDoneCount > 1 ? "tasks" : "task"} closed.
      </div>
    )
  }
}

export default DoneCounts
