// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show Note Links after main item content
// Last updated 2025-12-05 for v2.4.0 by @jgclark
//--------------------------------------------------------------------------
import React from 'react'
import type { TSection, TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import { isDailyDateStr, isWeeklyDateStr, isMonthlyDateStr, isQuarterlyDateStr } from '@helpers/dateTime'
import { parseTeamspaceFilename, TEAMSPACE_FA_ICON } from '@helpers/teamspace'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/react/reactDev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

//-----------------------------------------------------------

type Props = {
  item: TSectionItem,
  thisSection: TSection,
  alwaysShowNoteTitle: boolean,
  suppressTeamspaceName?: boolean
}

//-----------------------------------------------------------

/**
 * Represents the main content for a single item within a section
 */
function ItemNoteLink({ item, thisSection, alwaysShowNoteTitle = false, suppressTeamspaceName = false }: Props): React$Node {

  // ------ COMPUTED VALUES --------------------------------

  const { sendActionToPlugin, reactSettings } = useAppContext()
  const filename = item.para?.filename ?? '<no filename found>'
  // compute the things we need later
  const noteTitle = item?.para?.title || ''
  // logDebug(`ItemNoteLink`, `ItemNoteLink for item.itemFilename:${filename} noteTitle:${noteTitle} item.para.noteType:${item.para.noteType} / thisSection.filename=${thisSection.sectionFilename}`)

  // Compute the icon and link class and style depending whether this is a teamspace item, and/or note types
  const noteIconToUse = (isDailyDateStr(filename))
    ? 'fa-regular fa-calendar-star'
    : (isWeeklyDateStr(filename))
      ? 'fa-regular fa-calendar-week'
      : (isMonthlyDateStr(filename))
        ? 'fa-regular fa-calendar-days'
        : (isQuarterlyDateStr(filename))
          ? 'fa-regular fa-calendar-range'
          : 'fa-light fa-file-lines'
  const parsedTeamspace = parseTeamspaceFilename(filename)
  const isFromTeamspace = parsedTeamspace.isTeamspace
  const filenameWithoutTeamspacePrefix = parsedTeamspace.filename
  const trimmedFilePath = parsedTeamspace.filepath.trim()
  // For Teamspace calendar notes, filepath can be '/', so we need to check for both empty and '/'
  let folderNamePart = (trimmedFilePath !== '/' && trimmedFilePath !== '') ? `${trimmedFilePath} /` : ''
  // logDebug(`ItemNoteLink`, `initial filePath:${parsedTeamspace.filepath} with folderNamePart:${folderNamePart}`)
  const showNoteTitle = alwaysShowNoteTitle || item.para?.noteType === 'Notes' || filenameWithoutTeamspacePrefix !== thisSection.sectionFilename

  // Show Teamspace indicator and name, if this is a Teamspace note
  let teamspaceName = null
  if (isFromTeamspace && !suppressTeamspaceName) {
    const teamspaceTitle = item.teamspaceTitle && item.teamspaceTitle !== 'Unknown Teamspace' ? item.teamspaceTitle : ''
    teamspaceName = (
      <span className='pad-left teamspaceName pad-right'>
        <i className={`${TEAMSPACE_FA_ICON} pad-right`}></i>{teamspaceTitle}
      </span>
    )
    if (folderNamePart !== '' && !folderNamePart.endsWith('/')) {
      folderNamePart = `/ ${folderNamePart}`
    }
  }

  // ------ HANDLERS ---------------------------------------

  const handleLinkClick = (e:MouseEvent) => {
    const { modifierName  } = extractModifierKeys(e) // Indicates whether a modifier key was pressed

    const dataObjectToPassToFunction = {
      actionType: 'showLineInEditorFromFilename',
      modifierKey: modifierName,
      item,
    }
    sendActionToPlugin(dataObjectToPassToFunction.actionType, dataObjectToPassToFunction, `${noteTitle} clicked`, true)
  }

  // ------ RENDER ----------------------------------------

  return (
    <TooltipOnKeyPress
      altKey={{ text: 'Open in Split View' }}
      metaKey={{ text: 'Open in Floating Window' }}
      label={`${item.itemType}_${item.ID}_Open Note Link`}
      enabled={!reactSettings?.dialogData?.isOpen}>
      {/* If it's a teamspace note prepend that icon + title */}
      {isFromTeamspace && teamspaceName}
      {folderNamePart && <span className={`folderName`}>{folderNamePart}</span>}
      <a className={`noteTitle`} onClick={handleLinkClick}>
        {/* Show note title if wanted */}
        {showNoteTitle && (
          <>
            <i className={`pad-left ${noteIconToUse} pad-right`}></i>
            {noteTitle}
          </>
        )}
      </a>
    </TooltipOnKeyPress>
  )
}

export default ItemNoteLink
