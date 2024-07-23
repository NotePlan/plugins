// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a Project's Icon
// Called by ProjectItem component
// Last updated 24.6.2024 for v2.0.0-b14 by @jgclark
//--------------------------------------------------------------------------

import { type Node } from 'react'
import type { TSectionItem } from '../../types.js'
import { logDebug, logInfo } from '@helpers/react/reactDev.js'

type Props = {
  item: TSectionItem,
}

function ProjectProgressText({ item }: Props): Node {


  return (
    <div className="projectIcon">
      {projectIcon}
    </div>
  )
}

export default ProjectProgressText
