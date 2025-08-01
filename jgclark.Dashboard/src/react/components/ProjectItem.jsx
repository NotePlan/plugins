// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a Project's item
// Called by ItemRow component
// Last updated 2025-04-06 for v2.2.0.a12 by @jgclark
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
// import { CircularProgressbar, CircularProgressbarWithChildren, buildStyles } from 'react-circular-progressbar'
// import 'react-circular-progressbar/dist/styles.css'
import type { TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import ProjectIcon from './ProjectIcon.jsx'
import { getFolderFromFilename } from '@helpers/folders'
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
  const noteTitleWithOpenAction = (
    // <a className="noteTitle sectionItem" onClick={(e) => handleTitleClick(e)}>
    <a className="noteTitle" onClick={(e) => handleTitleClick(e)}>
      <i className="fa-regular fa-file-lines pad-right"></i>
      {noteTitle}
    </a>
  )

  const progressContent = progressText && (
    <>
      <br></br>
      <span className="projectProgress">
        <i className="fa-regular fa-circle-info pad-right"></i>
        {progressText}
      </span>
    </>
  )

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
        <ProjectIcon item={item} />
      </div>

      <div className="sectionItemContent sectionItem">
        {folderNamePart &&
          <span className="folderName">{folderNamePart}</span>}
        {noteTitleWithOpenAction}
        <a className="dialogTriggerIcon">
          <i className="fa-light fa-edit pad-left-larger" onClick={handleClickToOpenDialog}></i>
        </a>
        {progressContent}
      </div>
    </div>
  )
}

export default ProjectItem
