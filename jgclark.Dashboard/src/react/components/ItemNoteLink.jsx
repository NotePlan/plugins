// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show Note Titles as clickable links. Handles Teamspace indicators and folder names.
// Last updated 2026-01-19 for v2.4.0.b16 by @jgclark
//--------------------------------------------------------------------------

import React from 'react'
import type { TSection, TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import NoteTitleLink from './NoteTitleLink.jsx'
import { parseTeamspaceFilename, TEAMSPACE_FA_ICON } from '@helpers/teamspace'

//-----------------------------------------------------------

type Props = {
  item: TSectionItem,
  thisSection: TSection,
  alwaysShowNoteTitle: boolean,
  suppressTeamspaceName?: boolean,
}

//-----------------------------------------------------------

/**
 * Dashboard React component to show Note Titles as clickable links.
 * Handles Teamspace indicators and folder names.
 */
function ItemNoteLink({ item, thisSection, alwaysShowNoteTitle = false, suppressTeamspaceName = false }: Props): React$Node {

  // ------ COMPUTED VALUES --------------------------------

  const { reactSettings, dashboardSettings } = useAppContext()
  const filename = item.para?.filename ?? '<no filename found>'
  const parsedTeamspace = parseTeamspaceFilename(filename)
  const isFromTeamspace = parsedTeamspace.isTeamspace
  const filenameWithoutTeamspacePrefix = parsedTeamspace.filename
  const trimmedFilePath = parsedTeamspace.filepath.trim()
  // For Teamspace calendar notes, filepath can be '/', so we need to check for both empty and '/'
  // Only show folder name if showFolderName setting is enabled
  let folderNamePart = dashboardSettings?.showFolderName && trimmedFilePath !== '/' && trimmedFilePath !== '' ? `${trimmedFilePath} /` : ''
  const showNoteTitle = alwaysShowNoteTitle || item.para?.noteType === 'Notes' || filenameWithoutTeamspacePrefix !== thisSection.sectionFilename

  // Show Teamspace indicator and name, if this is a Teamspace note
  let teamspaceName = null
  if (isFromTeamspace && !suppressTeamspaceName) {
    const teamspaceTitle = item.teamspaceTitle && item.teamspaceTitle !== 'Unknown Teamspace' ? item.teamspaceTitle : ''
    teamspaceName = (
      <span className="pad-left teamspaceName pad-right">
        <i className={`${TEAMSPACE_FA_ICON} pad-right`}></i>
        {teamspaceTitle}
      </span>
    )
    if (folderNamePart !== '' && !folderNamePart.endsWith('/')) {
      folderNamePart = `/ ${folderNamePart}`
    }
  }

  // ------ RENDER ----------------------------------------

  if (!item.para) {
    return null
  }

  return (
    <TooltipOnKeyPress
      altKey={{ text: 'Open in Split View' }}
      metaKey={{ text: 'Open in Floating Window' }}
      label={`${item.itemType}_${item.ID}_Open Note Link`}
      enabled={!reactSettings?.dialogData?.isOpen}
    >
      {/* If it's a teamspace note prepend that icon + title */}
      {isFromTeamspace && teamspaceName}
      {folderNamePart && <span className={`folderName`}>{folderNamePart}</span>}
      <NoteTitleLink
        item={item}
        noteData={item.para}
        actionType="showLineInEditorFromFilename"
        iconClassName="pad-left pad-right"
        showTitle={showNoteTitle}
      />
    </TooltipOnKeyPress>
  )
}

export default ItemNoteLink
