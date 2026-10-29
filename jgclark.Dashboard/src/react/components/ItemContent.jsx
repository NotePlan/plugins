// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the main item content in a TaskItem in a ItemRow.
// Last updated 2026-10-11 by @jgclark/@Cursor
//--------------------------------------------------------------------------
import React from 'react'
import { applyDashboardSettingsToDisplayedItemHtml, makeParaContentToLookLikeNPDisplayInReact } from '../dashboardLineToNPDisplayHTML.js'
import type { MessageDataObject, TSection, TSectionItem } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import DueDateChip from './DueDateChip.jsx'
import ItemNoteLink from './ItemNoteLink.jsx'
import './ItemContent.css'
import { dueDateChip } from '@helpers/dueStartDates'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

//--------------------------------------------------------------------------

const NORMAL_ITEM_TRUNCATE_LENGTH = 140
const COMPACT_ITEM_TRUNCATE_LENGTH = 70 // half of Normal when Display Density is Compact
/** Where the today/overdue chip sits in the task text. 'end' is after the words, 'start' is before them. */
const OVERDUE_CHIP_PLACE: 'start' | 'end' = 'end'
/** Far due-date chips show a relative date ("in 3 wks") when true, or the YYYY-MM-DD date when false. */
const SHOW_FAR_DUE_DATE_AS_RELATIVE = false

type Props = {
  item: TSectionItem,
  // children: Array<Node>,
  thisSection: TSection,
}

/**
 * Represents the main content for a single item within a section
 */
function ItemContent({ item /*, children */, thisSection }: Props): React.Node {
  const { sendActionToPlugin, setReactSettings, dashboardSettings, pluginData } = useAppContext()
  const timeblockMustContainString = pluginData?.notePlanSettings?.timeblockMustContainString ?? ''

  //------ Constants & Calculations --------------------------

  const effectiveSectionCode = item.sectionCode ?? thisSection.sectionCode
  const messageObject: MessageDataObject = {
    item: item,
    actionType: '(not yet set)',
    sectionCodes: [effectiveSectionCode], // for the DialogForTaskItems (Wins rollup keeps source section on item)
  }

  // compute the things we need later
  const isCompactDensity = dashboardSettings?.displayDensity === 'Compact'
  const truncateLength = isCompactDensity ? COMPACT_ITEM_TRUNCATE_LENGTH : NORMAL_ITEM_TRUNCATE_LENGTH
  // Countdown chip when the task is due today, overdue, or within the user's day window.
  // Due-soon sits at the end of the task text. Today and overdue follow OVERDUE_CHIP_PLACE.
  // The same !YYYY-MM-DD or !>YYYY-MM-DD is left out of the task line.
  const rawDueWindow = dashboardSettings?.showDueDatesWithinDays
  const parsedDueWindow = typeof rawDueWindow === 'number' ? rawDueWindow : parseInt(String(rawDueWindow ?? ''), 10)
  const dueWindow = Number.isNaN(parsedDueWindow) ? undefined : parsedDueWindow
  const dueChip = dueDateChip(item.para?.content ?? '', dueWindow)
  let mainContent = makeParaContentToLookLikeNPDisplayInReact(
    item,
    truncateLength,
    timeblockMustContainString,
    pluginData?.reminderDisplayById,
    dueChip != null,
    dueWindow,
    SHOW_FAR_DUE_DATE_AS_RELATIVE,
  )
  mainContent = applyDashboardSettingsToDisplayedItemHtml(mainContent, dashboardSettings)

  // Note: This is how to remove tag/mention, if they match the item's sectionCode. Decided not to keep this, as it is doesn't suit some use cases for tags/mentions.
  // if (thisSection.sectionCode === 'TAG') {
  //   const sectionTagOrMention = thisSection.name
  //   mainContent = mainContent.replace(sectionTagOrMention, '')
  // }

  // If dashboardSettings reveals that we only have 1 teamspace active, and it is not the private space, then suppress the Teamspace name in the note link
  // Compact single-row layout also suppresses teamspace + folder so the note title can stay visible on the RHS
  const suppressTeamspaceName =
    isCompactDensity || (dashboardSettings.includedTeamspaces.length === 1 && dashboardSettings.includedTeamspaces[0] !== 'private')

  // If hasChild, then set suitable display indicator
  // (Earlier options had used 'fa-arrow-down-from-line' and 'fa-block-quote' icons. But switched to ellipsis to match what main Editor added in 3.15.2)
  const possParentIcon = dashboardSettings.parentChildMarkersEnabled && item.para?.hasChild ? <i className="fa-solid fa-ellipsis parentMarkerIcon"></i> : ''
  const possChildMarker = ''

  // Show the folder and note name after the item content, if wanted (and not a project next action child)
  const isProjectNextActionChild = (effectiveSectionCode === 'PROJACT' || effectiveSectionCode === 'PROJREVIEW') && Boolean(item.parentID)
  const showItemNoteLink =
    dashboardSettings?.showTaskContext &&
    !isProjectNextActionChild &&
    item.para?.filename !== '<no filename found>' &&
    item.para?.filename !== thisSection.sectionFilename

  //------ HANDLERS ---------------------------------------

  function handleTaskClick(e: MouseEvent) {
    const { modifierName } = extractModifierKeys(e) // Indicates whether a modifier key was pressed -- Note: not yet used
    const dataObjectToPassToFunction = {
      actionType: 'showLineInEditorFromFilename',
      modifierKey: modifierName,
      item,
    }
    sendActionToPlugin(dataObjectToPassToFunction.actionType, dataObjectToPassToFunction, 'Item clicked', true)
  }

  const handleClickToOpenEditDialog = (event: MouseEvent): void => {
    const clickPosition = { clientY: event.clientY, clientX: event.clientX }
    const { metaKey } = extractModifierKeys(event)
    // logDebug('ItemContent/handleClickToOpenEditDialog', `- metaKey=${String(metaKey)}`)
    messageObject.modifierKey = metaKey // boolean
    const dialogData = { isOpen: true, isTask: true, details: messageObject, clickPosition }
    // logDebug('ItemContent/handleClickToOpenEditDialog', `- setting dialogData to: ${JSP(dialogData)}`)
    setReactSettings((prev) => ({
      ...prev,
      lastChange: `_Dashboard-TaskDialogOpen`,
      dialogData: dialogData,
    }))
  }

  //----- RENDER ------------------------------------------

  return (
    <div className="sectionItemContent taskItemContent">
      {possChildMarker}
      {/* Keep task text + parent marker + edit together; note link alone is RHS in Compact */}
      <span className="taskItemMainText">
        {dueChip != null && dueChip.urgent && OVERDUE_CHIP_PLACE === 'start' ? <DueDateChip chip={dueChip} place="start" /> : null}
        <a className="content" onClick={(e) => handleTaskClick(e)} dangerouslySetInnerHTML={{ __html: mainContent }}></a>
        {dueChip != null && (!dueChip.urgent || OVERDUE_CHIP_PLACE === 'end') ? <DueDateChip chip={dueChip} place="end" /> : null}
        {possParentIcon}
        {/* <span className="pad-left">[ID:{item.ID}]</span> */}
        <a className="dialogTriggerIcon">
          <i className="fa-light fa-edit" onClick={handleClickToOpenEditDialog}></i>
        </a>
      </span>
      {showItemNoteLink && (
        <span className="taskItemTrailing">
          <span className="itemNoteLinkEnd">
            <ItemNoteLink
              item={item}
              thisSection={thisSection}
              alwaysShowNoteTitle={false}
              suppressTeamspaceName={suppressTeamspaceName}
              suppressFolderName={isCompactDensity}
            />
          </span>
        </span>
      )}
    </div>
  )
}

export default ItemContent
