// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show Note Links after main item content
// Last updated 2026-01-16 for v2.4.0.b16 by @jgclark
//--------------------------------------------------------------------------
import React from 'react'
import type { TSection, TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import TooltipOnKeyPress from './ToolTipOnModifierPress.jsx'
import { getColorStyle, tailwindToHsl } from '@helpers/colors'
import { isDailyDateStr, isWeeklyDateStr, isMonthlyDateStr, isQuarterlyDateStr } from '@helpers/dateTime'
import { parseTeamspaceFilename, TEAMSPACE_FA_ICON } from '@helpers/teamspace'
import { clo, logDebug, logError, logInfo, logWarn } from '@helpers/dev' //'@helpers/react/reactDev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

//-----------------------------------------------------------

type Props = {
  item: TSectionItem,
  thisSection: TSection,
  alwaysShowNoteTitle: boolean,
  suppressTeamspaceName?: boolean,
}

//-----------------------------------------------------------

/**
 * Represents the main content for a single item within a section
 */
function ItemNoteLink({ item, thisSection, alwaysShowNoteTitle = false, suppressTeamspaceName = false }: Props): React$Node {
  // ------ COMPUTED VALUES --------------------------------

  const { sendActionToPlugin, reactSettings, dashboardSettings } = useAppContext()
  const filename = item.para?.filename ?? '<no filename found>'
  // compute the things we need later
  const noteTitle = item?.para?.title || ''

  // Compute the icon and link class and style depending whether this is a teamspace item, and/or note types
  // Use icon from frontmatter if present, otherwise use default logic based on note type
  const noteIconToUse = item.para?.icon
    ? `fa-regular fa-${item.para.icon}` // TODO(later): try adding icon-style too, though will probably overwhelm the UI
    : isDailyDateStr(filename)
    ? 'fa-regular fa-calendar-star'
    : isWeeklyDateStr(filename)
    ? 'fa-regular fa-calendar-week'
    : isMonthlyDateStr(filename)
    ? 'fa-regular fa-calendar-days'
    : isQuarterlyDateStr(filename)
    ? 'fa-regular fa-calendar-range'
    : 'fa-light fa-file-lines'
  // Get icon-color from frontmatter if present (not yet used in rendering)
  const possNoteIconColor = item.para?.iconColor
  const tailwindColor = possNoteIconColor != null && possNoteIconColor !== '' ? possNoteIconColor : ''
  const noteIconHSLColor = tailwindToHsl(tailwindColor) ?? ''
  // const noteIconRGBColor = getColorStyle(tailwindColor) ?? ''
  // logDebug(`ItemNoteLink`, `possNoteIconColor:${possNoteIconColor ?? '-'}, tailwindColor:${tailwindColor} -> HSL '${noteIconHSLColor}' / RGB '${noteIconRGBColor}'`)
  const parsedTeamspace = parseTeamspaceFilename(filename)
  const isFromTeamspace = parsedTeamspace.isTeamspace
  const filenameWithoutTeamspacePrefix = parsedTeamspace.filename
  const trimmedFilePath = parsedTeamspace.filepath.trim()
  // For Teamspace calendar notes, filepath can be '/', so we need to check for both empty and '/'
  // Only show folder name if showFolderName setting is enabled
  let folderNamePart = dashboardSettings?.showFolderName && trimmedFilePath !== '/' && trimmedFilePath !== '' ? `${trimmedFilePath} /` : ''
  // logDebug(`ItemNoteLink`, `initial filePath:${parsedTeamspace.filepath} with folderNamePart:${folderNamePart}`)
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

  // ------ HANDLERS ---------------------------------------

  const handleLinkClick = (e: MouseEvent) => {
    const { modifierName } = extractModifierKeys(e) // Indicates whether a modifier key was pressed

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
      enabled={!reactSettings?.dialogData?.isOpen}
    >
      {/* If it's a teamspace note prepend that icon + title */}
      {isFromTeamspace && teamspaceName}
      {folderNamePart && <span className={`folderName`}>{folderNamePart}</span>}
      <a className={`noteTitle`} onClick={handleLinkClick}>
        {/* Show note title if wanted */}
        {showNoteTitle && (
          <>
            <i className={`pad-left ${noteIconToUse} pad-right`}
              style={{ color: noteIconHSLColor }}></i>
            {noteTitle}
          </>
        )}
      </a>
    </TooltipOnKeyPress>
  )
}

export default ItemNoteLink
