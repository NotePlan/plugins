// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the done items counts at the top of the Dashboard window.
// Called by Heaer component.
// Last updated 2024-07-08 for v2.0.1 by @jgclark
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React from 'react'
import { useAppContext } from '../AppContext.jsx'
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
  const { /*dashboardSettings,*/ pluginData } = useAppContext()

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------

  //----------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------

  // Don't show counts on mobile, or if we don't have @done() dates available
  const isMobile = pluginData.platform === "iOS"
  const showCounts = pluginData.notePlanSettings.doneDatesAvailable && !isMobile

  const itemsDoneCount = totalDoneCounts.completedTasks // + totalDoneCounts.completedChecklists

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  if (showCounts) {
    return (
      <div className="totalCounts">
        <span id="totalDoneCount">{itemsDoneCount}</span> {itemsDoneCount !== 1 ? "tasks" : "task"} closed
      </div>
    )
  }
}

export default DoneCounts
