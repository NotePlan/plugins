// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a Project's Icon
// Called by ProjectItem + DialogForProjectItems components
// Last updated 2024-08-25 for v2.1.0.a9 by @jgclark
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import type { TSectionItem } from '../../types.js'
import CircularProgressBar from './CircularProgressBar.jsx'
import { logDebug, logInfo } from '@helpers/react/reactDev.js'
import '../css/ProgressBar.css'

type Props = {
  item: TSectionItem,
}

function ProjectIcon({ item }: Props): Node {

  const percentComplete = item.project?.percentComplete ?? 0

  // using custom component adapted from https://blog.logrocket.com/build-svg-circular-progress-component-react-hooks/
  return (
    <CircularProgressBar
      size="1.0rem"
      progress={percentComplete}
      backgroundColor="var(--bg-sidebar-color)"
      trackWidth={8} // outer border width
      trackColor="var(--item-icon-color)"
      indicatorRadius={25} // (% of container) of middle of indicator
      indicatorWidth={50} // (% of container)
      indicatorColor="var(--item-icon-color)"
      indicatorCap="butt"
      label=""
      labelColor="black" // not used
      spinnerMode={false}
      spinnerSpeed={0}
    />
  )
}

export default ProjectIcon
