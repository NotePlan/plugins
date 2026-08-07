// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show Note Titles as clickable links. Handles Teamspace indicators and folder names.
// Used by ItemContent and DialogFor*Items components.
// Last updated 2026-08-07 for v2.4.0.b61 by @jgclark
//--------------------------------------------------------------------------

import React from 'react'
import type { TSection, TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import NoteTitleLink from './NoteTitleLink.jsx'
import { logDebug, logInfo } from '@helpers/dev'
import { parseTeamspaceFilename, TEAMSPACE_FA_ICON } from '@helpers/teamspace'

//-----------------------------------------------------------

type Props = {
  item: TSectionItem, // contains either a TParagraphForDashboard or a TProjectForDashboard
  thisSection: TSection,
  alwaysShowNoteTitle: boolean,
  suppressTeamspaceName?: boolean,
  /** When true, use full (body) font size - for project title chips in PROJACT/PROJREVIEW. Default chip size is compact. */
  normalSize?: boolean,
}

//-----------------------------------------------------------

/**
 * Dashboard React component to show Note Titles as clickable links.
 * Handles Teamspace indicators and folder names.
 * @param {Props} props
 * @returns {React$Node}
 */
function ItemNoteLink({ item, thisSection, alwaysShowNoteTitle = false, suppressTeamspaceName = false, normalSize = false }: Props): React$Node {
  const { reactSettings, dashboardSettings } = useAppContext()

  // ------ COMPUTED VALUES --------------------------------

  const filename = item.para?.filename ?? item.project?.filename ?? '<no filename found>'
  let teamspaceName = null
  const parsedPossibleTeamspace = parseTeamspaceFilename(filename)
  const isFromTeamspace = parsedPossibleTeamspace.isTeamspace
  const filenameWithoutTeamspacePrefix = parsedPossibleTeamspace.filename
  const trimmedFilePath = parsedPossibleTeamspace.filepath.trim()

  if (!suppressTeamspaceName && isFromTeamspace) {
    // Show Teamspace indicator and name, if this is a Teamspace note
    const teamspaceTitle = item.teamspaceTitle && item.teamspaceTitle !== 'Unknown Teamspace' ? item.teamspaceTitle : ''
    // logDebug('ItemNoteLink', `- teamspaceTitle=${teamspaceTitle}`)
    teamspaceName = (
      <span className="teamspaceName pad-right">
        <i className={`fa-fw ${TEAMSPACE_FA_ICON} pad-right`}></i>
        {teamspaceTitle}
      </span>
    )
  }

  // For Teamspace calendar notes, filepath can be '/', so we need to check for both empty and '/'.
  // Only show folder name if showFolderName setting is enabled
  let folderNamePart = dashboardSettings?.showFolderName && trimmedFilePath !== '/' && trimmedFilePath !== '' ? `${trimmedFilePath} /` : ''
  if (folderNamePart !== '' && !folderNamePart.endsWith('/')) {
    folderNamePart = `/ ${folderNamePart}`
  }
  // if (isFromTeamspace) logDebug('ItemNoteLink', `- trimmedFilePath from Space=${trimmedFilePath} folderNamePart=${folderNamePart}`)
  const showNoteTitle = alwaysShowNoteTitle || item.para?.noteType === 'Notes' || filenameWithoutTeamspacePrefix !== thisSection.sectionFilename

  // ------ RENDER ----------------------------------------

  if (!item.para && !item.project) {
    return null
  }
  // At this point, we know at least one of para or project exists
  const noteData = item.para ?? item.project
  if (!noteData) {
    return null
  }

  return (
    <TooltipOnKeyPress
      altKey={{ text: 'Open in Split View' }}
      metaKey={{ text: 'Open in Floating Window' }}
      label={`${item.itemType}_${item.ID}_Open Note Link`}
      enabled={!reactSettings?.dialogData?.isOpen}
    >
      {/* Single lozenge wrapping teamspace + folder + note title (icons/colors kept on children) */}
      <span className={normalSize ? 'itemNoteLink itemNoteLinkNormalSize' : 'itemNoteLink'}>
        {isFromTeamspace && teamspaceName}
        {folderNamePart && <span className="folderName">{folderNamePart}</span>}
        <NoteTitleLink
          item={item}
          noteData={noteData}
          actionType="showNoteInEditorFromFilename"
          iconClassName="pad-right"
          showTitle={showNoteTitle}
        />
      </span>
    </TooltipOnKeyPress>
  )
}

export default ItemNoteLink
