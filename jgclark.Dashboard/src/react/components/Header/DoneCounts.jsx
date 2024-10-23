// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the done items counts at the top of the Dashboard window.
// Called by Heaer component.
// Last updated 2024-07-22 for v2.1.0-a9 by @jgclark
//--------------------------------------------------------------------------
// FIXME: why is this being called every 40-60s between refreshes?

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React from 'react'
import { useAppContext } from '../AppContext.jsx'
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
  const { pluginData } = useAppContext()

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
  const isMobile = pluginData.platform !== "macOS"
  const showCounts = pluginData.notePlanSettings.doneDatesAvailable && !isMobile
  const isNarrowWidth = window.innerWidth <= 650

  const itemsDoneCount = totalDoneCounts.completedTasks
  const itemsDoneText = (isMobile || isNarrowWidth)
    ? "done"
    : `${itemsDoneCount !== 1 ? "tasks" : "task"} closed`

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  if (showCounts) {
    // ...

    return (
      <>
        <span id="totalDoneCount">{itemsDoneCount}</span> {itemsDoneText}
      </>
    )
  }
}

export default DoneCounts
