// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a Project's item
// Called by ItemRow component
// Last updated 2026-01-17 for v2.4.0.b15 by @jgclark
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
// import { CircularProgressbar, CircularProgressbarWithChildren, buildStyles } from 'react-circular-progressbar'
// import 'react-circular-progressbar/dist/styles.css'
import type { TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import SmallCircularProgressIndicator from './SmallCircularProgressIndicator.jsx'
import { tailwindToHsl } from '@helpers/colors'
import { getFolderFromFilename } from '@helpers/folders'
import { getLineMainContentPos } from '@helpers/search'
import { prepAndTruncateMarkdownForDisplay } from '@helpers/stringTransforms'
import { clo, logDebug, logInfo } from '@helpers/react/reactDev.js'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

type Props = {
  item: TSectionItem,
}

function ProjectItem({ item }: Props): Node {
  const { sendActionToPlugin, setReactSettings, dashboardSettings } = useAppContext()

  const itemFilename = item.project?.filename ?? '<no filename>'
  const noteTitle = item.project?.title ?? '<no title>'
  const folderNamePart = dashboardSettings?.showFolderName && getFolderFromFilename(itemFilename) !== '/' ? `${getFolderFromFilename(itemFilename)} / ` : ''
  // logInfo(`ProjectItem`, `for ${itemFilename} folder='${getFolderFromFilename(itemFilename)}' (${folderNamePart} / ${noteTitle})`)
  // const percentComplete = item.project?.percentComplete ?? 0
  // const percentCompleteStr = isNaN(percentComplete) ? '' : ` ${String(percentComplete)}%`
  const progressText = item.project?.lastProgressComment ?? ''

  // Compute icon and iconColor from frontmatter if present
  const projectIcon = item.project?.icon
  const noteIconToUse = projectIcon
    ? `fa-regular fa-${projectIcon}`
    : 'fa-regular fa-file-lines'
  const possProjectIconColor = item.project?.iconColor
  const tailwindColor = possProjectIconColor != null && possProjectIconColor !== '' ? possProjectIconColor : ''
  const noteIconHSLColor = tailwindToHsl(tailwindColor) ?? ''
  // logDebug('ProjectItem', `possProjectIconColor=${String(possProjectIconColor)} tailwindColor=${String(tailwindColor)} noteIconHSLColor=${String(noteIconHSLColor)}`)
  const noteTitleWithOpenAction = (
    <a className="noteTitle" onClick={(e) => handleTitleClick(e)}>
      <i className={`${noteIconToUse} pad-right`} style={{ color: noteIconHSLColor }}></i>
      {noteTitle}
    </a>
  )

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

  const dataObjectToPassToControlDialog = {
    item: item,
    actionType: '' 
   }

  function handleTitleClick(e: MouseEvent) {
    const { modifierName } = extractModifierKeys(e) // Indicates whether a modifier key was pressed
    const dataObjectToPassToFunction = {
      actionType: 'showNoteInEditorFromFilename', // we only have note-level data for Project items
      modifierKey: modifierName,
      filename: item.project?.filename ?? '<no filename>',
    }
    sendActionToPlugin(dataObjectToPassToFunction.actionType, dataObjectToPassToFunction, 'Project Title clicked in Dialog', true)
  }

  const handleClickToOpenDialog = (event: MouseEvent): void => {
    // clo(dataObjectToPassToControlDialog, 'ProjectItem: handleClickToOpenDialog - setting dataObjectToPassToControlDialog to: ')
    const { metaKey } = extractModifierKeys(event)
    logDebug('ProjectItem/handleClickToOpenDialog', `- metaKey=${String(metaKey)}`)
    dataObjectToPassToControlDialog.modifierKey = metaKey // boolean
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
        {noteTitleWithOpenAction}
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
