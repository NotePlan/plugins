// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a Project's item
// Called by ItemRow component
// Last updated 18.6.2024 for v2.0.0-b9 by @jgclark
//--------------------------------------------------------------------------

import * as React from 'react'
import { CircularProgressbar, CircularProgressbarWithChildren, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
import type { TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { getFolderFromFilename } from '@helpers/folders'
import { logDebug, clo } from '@helpers/react/reactDev.js'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

type Props = {
  item: TSectionItem,
}

function ProjectItem({ item }: Props): React.Node {
  const { sendActionToPlugin, setReactSettings, sharedSettings /*, setSharedSettings */ } = useAppContext()

  const itemFilename = item.project?.filename ?? '<no filename>'
  const noteTitle = item.project?.title ?? '<no title>'
  const folderNamePart = sharedSettings?.includeFolderName && getFolderFromFilename(itemFilename) !== '' ? `${getFolderFromFilename(itemFilename)} / ` : ''
  // logDebug(`ProjectItem`, `for ${itemFilename} (${folderNamePart} / ${noteTitle})`)
  const percentComplete = item.project?.percentComplete ?? 0
  // const percentCompleteStr = isNaN(percentComplete) ? '' : ` ${String(percentComplete)}%`
  const progressText = item.project?.lastProgressComment ?? ''

  const noteTitleWithOpenAction = (
    <a className="noteTitle sectionItem" onClick={(e) => handleTitleClick(e)}>
      <i className="fa-regular fa-file-lines pad-right"></i>
      {noteTitle}
    </a>
  )

  // const projectIcon = (percentComplete > 0) && (
  //   <>
  //     <div className="progress-bar">
  //       <progress value={String(percentComplete)} min="0" max="100">
  //         {percentCompleteStr}
  //       </progress>
  //     </div>
  //   </>
  // )
  // using https://www.npmjs.com/package/react-circular-progressbar
  const projectIcon = (
    <CircularProgressbarWithChildren
      // background path
      /*text={`${percentage}%`}*/
      value={percentComplete}
      strokeWidth={50}
      styles={buildStyles({
        strokeLinecap: "butt",
        backgroundColor: "var(--bg-sidebar-color)",
        // backgroundColor: "transparent",
        pathColor: "var(--tint-color)",
      })}
    >
      {/* foreground path */}
      <CircularProgressbar
        value={100}
        strokeWidth={5}
        styles={buildStyles({
          strokeLinecap: "butt",
          backgroundColor: "var(--bg-sidebar-color)",
          // backgroundColor: "transparent",
          pathColor: "var(--tint-color)",
        })}
      ></CircularProgressbar>
    </CircularProgressbarWithChildren>
  )

  const progressContent = progressText && (
    <>
      <br></br>
      <span className="projectProgress">
        <i className="fa-regular fa-circle-info"></i>
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

  const handleClickToOpenDialog = (e: MouseEvent): void => {
    // clo(dataObjectToPassToControlDialog, 'ProjectItem: handleClickToOpenDialog - setting dataObjectToPassToControlDialog to: ')
    const clickPosition = { clientY: e.clientY, clientX: e.clientX }
    setReactSettings((prev) => ({
      ...prev,
      lastChange: `_Dashboard-ProjectDialogOpen`,
      dialogData: { isOpen: true, isTask: false, details: dataObjectToPassToControlDialog, clickPosition }
    }))
  }

  return (
    <div className="sectionItemRow" id={item.ID}>
      <div className="projectIcon">
        {/* <i id={`${item.ID}I`} className="fa-regular fa-file-lines"></i> */}
        {projectIcon}
      </div>

      <div className="sectionItemContent sectionItem">
        {folderNamePart}
        {noteTitleWithOpenAction}
        <a className="dialogTrigger">
          <i className="fa-light fa-edit pad-left" onClick={handleClickToOpenDialog}></i>
        </a>
        {progressContent}
      </div>
    </div>
  )
}

export default ProjectItem
