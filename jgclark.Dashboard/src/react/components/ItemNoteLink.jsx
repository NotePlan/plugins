// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show Note Links after main item content
// Last updated 2025-07-22 for v2.3.0.b by @jgclark
//--------------------------------------------------------------------------
import React from 'react'
import type { TSection, TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import { isDailyDateStr, isWeeklyDateStr, isMonthlyDateStr, isQuarterlyDateStr } from '@helpers/dateTime'
import { getFolderFromFilename } from '@helpers/folders'
import { parseTeamspaceFilename, TEAMSPACE_FA_ICON } from '@helpers/teamspace'
import { logDebug, clo } from '@helpers/react/reactDev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

//-----------------------------------------------------------

type Props = {
  item: TSectionItem,
  thisSection: TSection,
  alwaysShowNoteTitle: boolean
}

//-----------------------------------------------------------

/**
 * Represents the main content for a single item within a section
 */
function ItemNoteLink({ item, thisSection, alwaysShowNoteTitle = false }: Props): React$Node {

  // ------ COMPUTED VALUES --------------------------------

  const { sendActionToPlugin, dashboardSettings, reactSettings } = useAppContext()
  const filename = item.para?.filename ?? '<no filename found>'
  // compute the things we need later
  const noteTitle = item?.para?.title || ''
  // logDebug(`ItemNoteLink`, `ItemNoteLink for item.itemFilename:${filename} noteTitle:${noteTitle} item.para.noteType:${item.para.noteType} / thisSection.filename=${thisSection.sectionFilename}`)
  const folderNamePart = dashboardSettings.showFolderName && filename !== '<no filename found>' && getFolderFromFilename(filename) !== '/' ? `${getFolderFromFilename(filename)} /` : ''

  // Compute the icon and link class and style depending whether this is a teamspace item, and/or note types
  // const isFromTeamspace = item.para?.isFromTeamspace ?? false

  const noteIconToUse = (isDailyDateStr(filename))
    ? 'fa-light fa-calendar-star'
    : (isWeeklyDateStr(filename))
      ? 'fa-light fa-calendar-week'
      : (isMonthlyDateStr(filename))
        ? 'fa-light fa-calendar-days'
        : (isQuarterlyDateStr(filename))
          ? 'fa-light fa-calendar-range'
          : 'fa-light fa-file-lines'
  const parsedTeamspace = parseTeamspaceFilename(filename)
  const filenameWithoutTeamspacePrefix = parsedTeamspace.filename
  const isFromTeamspace = parsedTeamspace.isTeamspace
  // logDebug(`ItemNoteLink`, `noteIconToUse:${noteIconToUse} with filenameWithoutTeamspacePrefix:${filenameWithoutTeamspacePrefix}`)
  // const linkClass = 'noteTitle'
  // const linkStyle = 'folderName'
  const showNoteTitle = alwaysShowNoteTitle || item.para?.noteType === 'Notes' || filenameWithoutTeamspacePrefix !== thisSection.sectionFilename

  // TODO: Break this out into a separate component
  let teamspaceIndicator = null
  if (isFromTeamspace) {
    const teamspaceTitle = item.teamspaceTitle && item.teamspaceTitle !== 'Unknown Teamspace' ? item.teamspaceTitle : ''
    teamspaceIndicator = (
      <span className='teamspaceName pad-right'>
        <i className={`${TEAMSPACE_FA_ICON} pad-right`}></i>
        {teamspaceTitle}
      </span>
    )
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
      <span className={`pad-left-larger folderName pad-right`}>{folderNamePart}</span>
      <a className={`noteTitle`} onClick={handleLinkClick}>
        {/* If it's a teamspace note prepend that icon + title */}
        {isFromTeamspace && teamspaceIndicator}
        {/* Show note title if wanted */}
        {showNoteTitle && (
          <>
            <i className={`${noteIconToUse} pad-right`}></i>
            {noteTitle}
          </>
        )}
      </a>
    </TooltipOnKeyPress>
  )
}

export default ItemNoteLink
