// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show the main item content in a TaskItem in a ItemRow.
// Last updated 2026-04-13 for v2.4.0.b24 by @jgclark/@Cursor
//--------------------------------------------------------------------------
import React from 'react'
import type { MessageDataObject, TSection, TSectionItem } from '../../types.js'
import { applyDashboardSettingsToDisplayedItemHtml, makeParaContentToLookLikeNPDisplayInReact } from '../dashboardLineToNPDisplayHTML.js'
import { useAppContext } from './AppContext.jsx'
import ItemNoteLink from './ItemNoteLink.jsx'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'

//--------------------------------------------------------------------------

type Props = {
  item: TSectionItem,
  // children: Array<Node>,
  thisSection: TSection,
}

/**
 * Represents the main content for a single item within a section
 */
function ItemContent({ item /*, children */, thisSection }: Props): React$Node {
  const { sendActionToPlugin, setReactSettings, dashboardSettings } = useAppContext()

  //------ Constants & Calculations --------------------------

  const effectiveSectionCode = item.sectionCode ?? thisSection.sectionCode
  const messageObject: MessageDataObject = {
    item: item,
    actionType: '(not yet set)',
    sectionCodes: [effectiveSectionCode], // for the DialogForTaskItems (Wins rollup keeps source section on item)
  }

  // compute the things we need later
  let mainContent = makeParaContentToLookLikeNPDisplayInReact(item, 140)
  mainContent = applyDashboardSettingsToDisplayedItemHtml(mainContent, dashboardSettings)

  // Note: This is how to remove tag/mention, if they match the item's sectionCode. Decided not to keep this, as it is doesn't suit some use cases for tags/mentions.
  // if (thisSection.sectionCode === 'TAG') {
  //   const sectionTagOrMention = thisSection.name
  //   mainContent = mainContent.replace(sectionTagOrMention, '')
  // }

  // If dashboardSettings reveals that we only have 1 teamspace active, and it is not the private space, then suppress the Teamspace name in the note link
  const suppressTeamspaceName = dashboardSettings.includedTeamspaces.length === 1 && dashboardSettings.includedTeamspaces[0] !== 'private'

  // If hasChild, then set suitable display indicator
  // (Earlier options had used 'fa-arrow-down-from-line' and 'fa-block-quote' icons. But switched to ellipsis to match what main Editor added in 3.15.2)
  const possParentIcon = dashboardSettings.parentChildMarkersEnabled && item.para?.hasChild ? <i className="fa-solid fa-ellipsis parentMarkerIcon"></i> : ''
  const possChildMarker = ''

  const showItemNoteLink = dashboardSettings?.showTaskContext && item.para?.filename !== '<no filename found>' && item.para?.filename !== thisSection.sectionFilename

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
    <div className="sectionItemContent">
      {possChildMarker}
      <a className="content" onClick={(e) => handleTaskClick(e)} dangerouslySetInnerHTML={{ __html: mainContent }}></a>
      {possParentIcon}
      {/* <span className="pad-left">[ID:{item.ID}]</span> */}
      <a className="dialogTriggerIcon">
        <i className="fa-light fa-edit pad-right" onClick={handleClickToOpenEditDialog}></i>
      </a>
      {showItemNoteLink && <ItemNoteLink
        item={item}
        thisSection={thisSection}
        alwaysShowNoteTitle={false}
        suppressTeamspaceName={suppressTeamspaceName}
      />}
    </div>
  )
}

export default ItemContent
