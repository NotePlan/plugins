// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a Project's item
// Called by ItemRow component
// Last updated 2026-01-24 for v2.4.0.b18 by @jgclark
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
import type { TSection, TSectionItem, MessageDataObject } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import SmallCircularProgressIndicator from './SmallCircularProgressIndicator.jsx'
import ItemNoteLink from './ItemNoteLink.jsx'
// import NoteTitleLink from './NoteTitleLink.jsx'
// import { getFolderFromFilename } from '@helpers/folders'
import { prepAndTruncateMarkdownForDisplay } from '@helpers/stringTransforms'
import { logDebug, logInfo } from '@helpers/react/reactDev.js'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import { parseTeamspaceFilename, TEAMSPACE_FA_ICON } from '@helpers/teamspace'
type Props = {
  item: TSectionItem,
  thisSection: TSection,
}

function ProjectItem({ item, thisSection }: Props): Node {
  const { setReactSettings, dashboardSettings } = useAppContext()

  const progressText = item.project?.lastProgressComment ?? ''

  // Sort out folder name, title and Teamspace indicator, as required
  const itemFilename = item.project?.filename ?? '<no filename>'
  const parsedTeamspace = parseTeamspaceFilename(itemFilename)
  const isFromTeamspace = parsedTeamspace.isTeamspace
  // const filenameWithoutTeamspacePrefix = parsedTeamspace.filename
  const trimmedFilePath = parsedTeamspace.filepath.trim()

  let folderNamePart = dashboardSettings?.showFolderName && trimmedFilePath !== '/' && trimmedFilePath !== '' ? `${trimmedFilePath} /` : ''

  // If dashboardSettings reveals that we only have 1 teamspace active, and it is not the private space, then suppress the Teamspace name in the note link
  const suppressTeamspaceName = dashboardSettings.includedTeamspaces.length === 1 /* && dashboardSettings.includedTeamspaces[0] !== 'private' */

  // Show Teamspace indicator and name, if this is a Teamspace note
  let teamspaceName = null
  if (isFromTeamspace) {
    const teamspaceTitle = item.teamspaceTitle && item.teamspaceTitle !== 'Unknown Teamspace' ? item.teamspaceTitle : ''
    teamspaceName = (
      <span className="pad-left teamspaceName pad-right">
        <i className={`${TEAMSPACE_FA_ICON} pad-right`}></i>
        {teamspaceTitle}
      </span>
    )
    if (folderNamePart !== '' && !folderNamePart.endsWith('/')) {
      folderNamePart = `/ ${folderNamePart} `
    }
  }

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
        {/* If it's a teamspace note prepend that icon + title */}
        {/* {isFromTeamspace && teamspaceName}
        {folderNamePart && <span className="folderName">{folderNamePart}</span>}
        {item.project && (
          // $FlowFixMe[incompatible-type] - TProjectForDashboard extends TNoteForDashboard, so this is safe
          <NoteTitleLink
            item={item}
            noteData={item.project}
            actionType="showNoteInEditorFromFilename"
            defaultIcon="fa-regular fa-file-lines"
            onClickLabel="Project Title clicked in Dialog"
          />
        )} */}

        <ItemNoteLink
          item={item}
          thisSection={thisSection}
          alwaysShowNoteTitle={true}
          suppressTeamspaceName={suppressTeamspaceName}
        />

        <a className="dialogTriggerIcon">
          {/* <i className="pad-left fa-light fa-edit" onClick={handleClickToOpenDialog}></i> */}
          <i className="pad pad-right fa-light fa-edit" onClick={handleClickToOpenDialog}></i>
        </a>

        {progressContent}
        {nextActionsContent}
      </div>
    </div>
  )
}

export default ProjectItem
