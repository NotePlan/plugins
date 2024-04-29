/* eslint-disable no-undef */
// @flow
//--------------------------------------------------------------------------
// Dashboard React component to main item content row
// Last updated 13.4.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------
import React, { useState } from 'react'
import type { TSection, TSectionItem, TParagraphForDashboard } from '../../types.js'
import { useAppContext } from './AppContext.jsx'
import ItemContent from './ItemContent.jsx'
import ItemNoteLink from './ItemNoteLink.jsx'
import { getFolderFromFilename } from '@helpers/folders'
import { clo } from '@helpers/dev'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard'
import { encodeRFC3986URIComponent } from '@helpers/stringTransforms'
import { logDebug } from '@helpers/react/reactDev'

//  handleIconClick(thisId, 'open', thisEncodedFilename, thisEncodedContent, metaKey)

type Props = {
  // key: number,
  item: TSectionItem,
  thisSection: TSection,
}

/**
 * Represents a single item within a section, displaying its status, content, and actions.
 */
function ItemRow(inputObj: Props): React$Node {
  const { item } = inputObj
  const { itemType } = item
  const [visible, setVisible] = useState(true)

  const { setReactSettings, sendActionToPlugin, pluginData } = useAppContext()

  /**
   * Handle clicking on item icons
   */
  function handleIconClick(event: MouseEvent) {
    const { metaKey } = extractModifierKeys(event) // Indicates whether a modifier key was pressed

    const objToSendToPlugin = {
      itemID: item.ID,
      itemType,
      filename: item?.para?.filename ?? '',
      content: item?.para?.content ?? '',
      type: 'unknown',
    }

    switch (itemType) {
      case 'open':
        objToSendToPlugin.type = metaKey ? 'cancelTask' : 'completeTask'
        setVisible(false)
        break
      case 'checklist':
        objToSendToPlugin.type = metaKey ? 'cancelChecklist' : 'completeChecklist'
        setVisible(false)
        break
      case 'review':
        objToSendToPlugin.type = 'showNoteInEditorFromFilename'
        break
      default:
        logDebug(`ItemRow`, `ERROR - handleIconClick: unknown itemType: ${itemType}`)
        break
    }

    clo(objToSendToPlugin, `ItemRow: item clicked: ${item.ID}`)

    sendActionToPlugin('onClickDashboardItem', objToSendToPlugin, `${item.ID} Row icon clicked`, true)

    // Send action to plugin after n seconds - this is a bit of a hack
    // to get around the updateCache not being reliable.
    setReactSettings((prev) => ({ ...prev, refreshing: true }))
    setTimeout(() => {
      setReactSettings((prev) => ({ ...prev, refreshing: false }))
      sendActionToPlugin('onClickDashboardItem', { type: 'refresh' }, `5s full refresh timer triggered`, false)
    }, 5000)
  }

  function handleEditClick(dataObjToPassToOnClick: any, isTask: boolean): void {
    setReactSettings((prev) => ({ ...prev, dialogData: { isOpen: true, isTask: isTask, details: dataObjToPassToOnClick } }))
  }

  const config = pluginData.settings
  // clo(config)

  const { thisSection } = inputObj
  const sectionType = thisSection.sectionType

  // console.log(`ItemRow for section ${sectionType}#${thisSection.ID}:${itemType}`)

  // -------------------------------------------------------
  if (itemType === 'review') {
    // Display a Project item
    const itemFilename = item.itemFilename
    // $FlowIgnore(cannot-resolve-name)
    const encodedItemFilename = encodeRFC3986URIComponent(itemFilename)
    // console.log(`- 'review': ${itemFilename}`)
    const noteTitle = item.itemNoteTitle ?? '<no title>'
    // console.log(`- making notelink with ${itemFilename}, ${noteTitle}`)
    const folderNamePart = config?.includeFolderName && getFolderFromFilename(itemFilename) !== '' ? `${getFolderFromFilename(itemFilename)} / ` : ''
    // console.log(`- folderNamePart = ${folderNamePart}`)

    const projectContent = `${folderNamePart}${makeNoteTitleWithOpenActionFromFilename(item, noteTitle)}`
    // console.log(`- projectContent = ${projectContent}`)

    const dataObjectToPassToControlDialog = {
      OS: 'macOS', // TODO: NotePlan.environment.platform,
      itemID: item.ID,
      // $FlowIgnore(cannot-resolve-name)
      encodedTitle: encodeRFC3986URIComponent(projectContent),
    }

    // Pass request back to plugin, as a single object
    const dataObjToPassToOnClick = { itemID: item.ID, type: 'showNoteInEditorFromFilename', encodedFilename: encodedItemFilename, encodedContent: '' }

    return (
      <div
        className="sectionItemRow"
        id={item.ID}
        data-section-type={sectionType}
        // $FlowIgnore(cannot-resolve-name)
        data-encoded-filename={encodeRFC3986URIComponent(itemFilename)}
        // $FlowIgnore(cannot-resolve-name)
        data-encoded-content={encodeRFC3986URIComponent(projectContent)}
      >
        <div className="reviewProject todo itemIcon">
          <i id={`${item.ID}I`} className="fa-regular fa-circle-play"></i>
        </div>

        <div className="sectionItemContent sectionItem">
          {/* <a className="content" dangerouslySetInnerHTML={{ __html: projectContent }}></a> */}
          {folderNamePart}
          <a className="noteTitle sectionItem" onClick={() => onClickDashboardItem(dataObjToPassToOnClick)}>
            <i className="fa-regular fa-file-lines pad-right"></i>
            {noteTitle}
          </a>

          <a
            className="dialogTrigger"
            // $FlowIgnore(cannot-resolve-name)
            onClick={() => showProjectControlDialog(dataObjectToPassToControlDialog)}
          >
            <i className="fa-light fa-edit pad-left" onClick={() => handleEditClick(dataObjectToPassToControlDialog, false)}></i>
          </a>
        </div>
      </div>
    )
  }
  // -------------------------------------------------------
  else if (itemType === 'congrats') {
    // Display congratulatory message
    return (
      <div className="sectionItemRow" id={item.ID} data-section-type={sectionType} data-encoded-filename="" data-encoded-content="">
        <div className="itemIcon checked">
          <i id={item.ID} className="fa-regular fa-circle-check"></i>
        </div>
        <div className="sectionItemContent sectionItem">
          <a className="content">
            <i>
              Nothing to do: take a break <i className="fa-regular fa-mug"></i>
            </i>
          </a>
        </div>
      </div>
    )
  }
  // -------------------------------------------------------
  else if (itemType === 'filterIndicator') {
    // Display filter indicator
    return (
      <div className="sectionItemRow" id={item.ID} data-section-type={sectionType} data-encoded-filename="" data-encoded-content="">
        <div className="itemIcon checked">
          <i id={item.ID} className="fa-light fa-plus"></i>
        </div>
        <div className="sectionItemContent sectionItem">
          <a className="content">
            <i>{item?.para?.content || '<no content>'}</i>
          </a>
        </div>
      </div>
    )
  }
  // -------------------------------------------------------
  else {
    // Display every other type of item
    if (!item.para) {
      console.log(`Info: No para passed with item ${thisSection.sectionType}/${thisSection.ID}`)
    }
    // compute the things we need later
    // const para: TParagraphForDashboard = item.para
    const divClassName = itemType === 'open' ? 'sectionItemTodo todo' : itemType === 'checklist' ? 'sectionItemChecklist todo' : itemType === 'congrats' ? 'checked' : ''
    const iconClassName =
      itemType === 'open' ? 'todo fa-regular fa-circle' : itemType === 'checklist' ? 'todo fa-regular fa-square' : itemType === 'congrats' ? 'fa-regular fa-circle-check' : ''
    const dataObjectToPassToControlDialog = {
      OS: 'macOS', // TODO: NotePlan.environment.platform,
      itemID: item.ID,
      sectionType: thisSection.sectionType,
      reschedOrMove: 'move', // TODO: reschedOrMove,
      itemType: 'task',
      noteType: item.noteType,
      para: item.para,
      title: item.itemNoteTitle,
    }
    // Note the visible && below removes the item immediately
    // Removing that will cause a fade-out to occur but leaves the space on the page
    return (
      visible && (
        <div
          className={`sectionItemRow${visible ? '' : ' fadeOutAndHide'}`}
          id={item.ID}
          data-section-type={sectionType}
          data-encoded-filename={encodeRFC3986URIComponent(item.para?.filename ?? '')}
          data-encoded-content={encodeRFC3986URIComponent(item.para?.content ?? '')}
        >
          <div className={`${divClassName} itemIcon`} onClick={handleIconClick}>
            <i id={`${item.ID}I`} className={`${iconClassName}`}></i>
          </div>
          <div className="sectionItemContent sectionItem">
            <ItemContent item={item} />
            {config?.includeTaskContext ? <ItemNoteLink item={item} thisSection={thisSection} /> : null}
            <a
              className="dialogTrigger"
              // $FlowIgnore(cannot-resolve-name)
              // onClick={() => showItemControlDialog(dataObjectToPassToControlDialog)}
            >
              <i className="fa-light fa-edit pad-left" onClick={() => handleEditClick(dataObjectToPassToControlDialog, true)}></i>
            </a>
          </div>
        </div>
      )
    )
  }
}

/**
 * Wrap string with href onClick event to show note in editor,
 * using item.filename param.
 * @param {SectionItem} item's details
 * @param {string} noteTitle
 * @returns {string} output
 */
function makeNoteTitleWithOpenActionFromFilename(item: TSectionItem, noteTitle: string): string {
  try {
    // console.log(`makeNoteTitleWithOpenActionFromFilename: - making notelink with ${item.filename}, ${noteTitle}`)
    // Pass request back to plugin, as a single object
    return `<a class="noteTitle sectionItem" onClick="onClickDashboardItem({itemID: '${item.ID}', type: 'showNoteInEditorFromFilename', encodedFilename: '${encodeURIComponent(
      item.itemFilename,
    )}', encodedContent: ''})"><i class="fa-regular fa-file-lines pad-right"></i> ${noteTitle}</a>`
  } catch (error) {
    console.error(`❗️ERROR❗️ ItemRow::makeNoteTitleWithOpenActionFromFilename: ${error.message} for input '${noteTitle}'`)
    return '(error)'
  }
}

export default ItemRow
