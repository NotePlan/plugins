// @flow
//--------------------------------------------------------------------------
// Shared component for rendering a clickable note title link with icon.
// Note: it does not handle Teamspace indicators or folder names.
// Used by both ItemNoteLink and ProjectItem components.
// Last updated 2026-02-05 for v2.4.0.b16+ by @jgclark
//--------------------------------------------------------------------------

import React, { useCallback } from 'react'
import type { TSectionItem, TParagraphForDashboard, TProjectForDashboard } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import { tailwindToHsl } from '@helpers/colors'
import { isDailyDateStr, isWeeklyDateStr, isMonthlyDateStr, isQuarterlyDateStr } from '@helpers/dateTime'
import { logDebug, logInfo } from '@helpers/react/reactDev.js'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

//-----------------------------------------------------------

type Props = {
  item: TSectionItem,
  noteData: TParagraphForDashboard | TProjectForDashboard, // either item.para or item.project
  actionType: 'showLineInEditorFromFilename' | 'showNoteInEditorFromFilename',
  defaultIcon?: string, // override default icon logic (for projects, use 'fa-regular fa-file-lines')
  iconClassName?: string, // additional classes for the icon (e.g., 'pad-left', 'pad-right')
  showTitle?: boolean, // whether to show the title (defaults to true)
  onClickLabel?: string, // label for logging the click action
}

//-----------------------------------------------------------

/**
 * Shared component for rendering a clickable note title link with icon
 * Handles icon computation, iconColor, and click handling
 */
function NoteTitleLink({
  item,
  noteData,
  actionType,
  defaultIcon,
  iconClassName = '',
  showTitle = true,
  onClickLabel,
}: Props): React$Node {
  const { sendActionToPlugin } = useAppContext()

  // ------ COMPUTED VALUES --------------------------------

  const filename = noteData.filename ?? ''
  const noteTitle = noteData.title ?? ''

  // Compute icon: use frontmatter icon if present, otherwise use default logic
  const noteIconToUse = noteData.icon
    ? `fa-regular fa-${noteData.icon}`
    : defaultIcon ?? (isDailyDateStr(filename)
    ? 'fa-regular fa-calendar-star'
    : isWeeklyDateStr(filename)
    ? 'fa-regular fa-calendar-week'
    : isMonthlyDateStr(filename)
    ? 'fa-regular fa-calendar-days'
    : isQuarterlyDateStr(filename)
    ? 'fa-regular fa-calendar-range'
    : 'fa-light fa-file-lines')

  // Get icon-color from frontmatter if present
  const possIconTailwindColor = noteData.iconColor
  const possNoteIconColor = possIconTailwindColor != null && possIconTailwindColor !== '' ? tailwindToHsl(possIconTailwindColor) : ''

  // logInfo('NoteTitleLink', `filename=${filename} noteTitle=${noteTitle} noteIconToUse=${noteIconToUse} possNoteIconColor=${possNoteIconColor} actionType=${actionType} filename=${filename} noteTitle=${noteTitle} `)

  // ------ HANDLERS ----------------------------------------

  // Handle click - memoized to prevent re-renders
  const handleLinkClick = useCallback((e: MouseEvent) => {
    const { modifierName } = extractModifierKeys(e)
    const dataObjectToPassToFunction =
      actionType === 'showNoteInEditorFromFilename'
        ? {
            actionType,
            modifierKey: modifierName,
            filename,
          }
        : {
            actionType,
            modifierKey: modifierName,
            item,
          }
    sendActionToPlugin(
      dataObjectToPassToFunction.actionType,
      dataObjectToPassToFunction,
      onClickLabel ?? `${noteTitle} clicked`,
      true,
    )
  }, [actionType, item, filename, noteTitle, onClickLabel, sendActionToPlugin])

  // ------ RENDER ----------------------------------------

  if (!showTitle) {
    return null
  }

  return (
    <a className="noteTitle" onClick={handleLinkClick}>
      <i className={`${iconClassName} ${noteIconToUse}`} style={{ color: possNoteIconColor ?? '' }}></i>
      {noteTitle}
    </a>
  )
}

export default NoteTitleLink
