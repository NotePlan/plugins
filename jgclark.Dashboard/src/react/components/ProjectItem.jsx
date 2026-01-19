// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a Project's item
// Called by ItemRow component
// Last updated 2026-01-19 for v2.4.0.b16 by @jgclark
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
// import { CircularProgressbar, CircularProgressbarWithChildren, buildStyles } from 'react-circular-progressbar'
// import 'react-circular-progressbar/dist/styles.css'
import type { TSectionItem, MessageDataObject } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import SmallCircularProgressIndicator from './SmallCircularProgressIndicator.jsx'
import NoteTitleLink from './NoteTitleLink.jsx'
import { getFolderFromFilename } from '@helpers/folders'
import { prepAndTruncateMarkdownForDisplay } from '@helpers/stringTransforms'
import { logDebug } from '@helpers/react/reactDev.js'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

type Props = {
  item: TSectionItem,
}

function ProjectItem({ item }: Props): Node {
  const { setReactSettings, dashboardSettings } = useAppContext()

  const itemFilename = item.project?.filename ?? '<no filename>'
  const folderNamePart = dashboardSettings?.showFolderName && getFolderFromFilename(itemFilename) !== '/' ? `${getFolderFromFilename(itemFilename)} / ` : ''
  const progressText = item.project?.lastProgressComment ?? ''

  // Format and display project progress if present
  const progressContent = progressText && (
    <>
      <br></br>
      <div className="projectProgress">
        <i className="fa-regular fa-circle-info pad-right"></i>
        {progressText}
      </div>
    </>
  )

  // Format and display nextActions if present
  const nextActions = item.project?.nextActions
  const nextActionsContent = nextActions && nextActions.length > 0 ? (
    <>
      {nextActions.map((nextAction, index) => {
        const truncatedAction = prepAndTruncateMarkdownForDisplay(nextAction, 100)
        return (
          <React.Fragment key={index}>
            <div className="projectNextAction">
              <i className="fa-regular fa-circle pad-right"></i>
              {truncatedAction}
            </div>
          </React.Fragment>
        )
      })}
    </>
  ) : null

  const handleClickToOpenDialog = (event: MouseEvent): void => {
    const { metaKey } = extractModifierKeys(event)
    logDebug('ProjectItem/handleClickToOpenDialog', `- metaKey=${String(metaKey)}`)
    const dataObjectToPassToControlDialog: MessageDataObject = {
      item: item,
      actionType: 'unknown', // placeholder - actual action handled in dialog
      ...(metaKey ? { modifierKey: metaKey } : {}),
    }
    const clickPosition = { clientY: event.clientY, clientX: event.clientX }
    setReactSettings((prev) => ({
      ...prev,
      lastChange: `_Dashboard-ProjectDialogOpen`,
      dialogData: { isOpen: true, isTask: false, details: dataObjectToPassToControlDialog, clickPosition }
    }))
  }

  //----- RENDER ------------------------------------------

  return (
    <div className="sectionItemRow" id={item.ID}>
      <div className="projectIcon">
        <SmallCircularProgressIndicator item={item} />
      </div>

      <div className="sectionItemContent sectionItem">
        {folderNamePart &&
          <span className="folderName">{folderNamePart}</span>}
        {item.project && (
          // $FlowFixMe[incompatible-type] - TProjectForDashboard extends TNoteForDashboard, so this is safe
          <NoteTitleLink
            item={item}
            noteData={item.project}
            actionType="showNoteInEditorFromFilename"
            defaultIcon="fa-regular fa-file-lines"
            onClickLabel="Project Title clicked in Dialog"
          />
        )}
        <a className="dialogTriggerIcon">
          <i className="pad-left fa-light fa-edit" onClick={handleClickToOpenDialog}></i>
        </a>
        {progressContent}
        {nextActionsContent}
      </div>
    </div>
  )
}

export default ProjectItem
