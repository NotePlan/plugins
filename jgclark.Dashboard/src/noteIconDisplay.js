// @flow
//--------------------------------------------------------------------------
// Shared note icon display helpers for Dashboard (NoteTitleLink + mid-task wiki links).
// Last updated 2026-07-21 for v2.4.0.b53 by @jgclark/@Cursor
//--------------------------------------------------------------------------

import { tailwindToHsl } from '@helpers/colors'
import { isDailyDateStr, isWeeklyDateStr, isMonthlyDateStr, isQuarterlyDateStr } from '@helpers/dateTime'

export type TNoteIconDisplayInput = {
  icon?: string,
  iconColor?: string,
  filenameOrTitle?: string,
  defaultIcon?: string,
}

export type TNoteIconDisplayProps = {
  iconClassName: string,
  /** Inline style object for React (color only when set) */
  iconStyle: { [string]: string },
  /** HTML style attribute value, e.g. 'color: hsl(...)' or '' */
  iconStyleAttr: string,
}

/**
 * Compute Font Awesome class + optional color for a note icon, matching NoteTitleLink rules.
 * Frontmatter icon name wins; else calendar heuristics from filename/title; else file-lines (or defaultIcon).
 * @param {TNoteIconDisplayInput} input
 * @returns {TNoteIconDisplayProps}
 */
export function getNoteIconDisplayProps(input: TNoteIconDisplayInput): TNoteIconDisplayProps {
  const icon = input.icon
  const filenameOrTitle = input.filenameOrTitle ?? ''
  const defaultIcon = input.defaultIcon

  const iconClassName = icon
    ? `fa-light fa-fw fa-${icon}`
    : defaultIcon ??
      (isDailyDateStr(filenameOrTitle)
        ? 'fa-light fa-fw fa-calendar-star'
        : isWeeklyDateStr(filenameOrTitle)
          ? 'fa-light fa-fw fa-calendar-week'
          : isMonthlyDateStr(filenameOrTitle)
            ? 'fa-light fa-fw fa-calendar-days'
            : isQuarterlyDateStr(filenameOrTitle)
              ? 'fa-light fa-fw fa-calendar-range'
              : 'fa-light fa-fw fa-file-lines')

  const possIconTailwindColor = input.iconColor
  const color =
    possIconTailwindColor != null && possIconTailwindColor !== '' ? tailwindToHsl(possIconTailwindColor) : ''

  const iconStyle: { [string]: string } = color ? { color } : {}
  const iconStyleAttr = color ? `color: ${color}` : ''

  return { iconClassName, iconStyle, iconStyleAttr }
}
