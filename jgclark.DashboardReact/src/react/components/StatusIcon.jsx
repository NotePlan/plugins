// StatusIcon.jsx
// @flow
import React, { useState } from 'react'
import type { Node } from 'react'
import type { TSectionItem, MessageDataObject } from '../../types'
import { useAppContext } from './AppContext.jsx'
import { extractModifierKeys } from '@helpers/react/reactMouseKeyboard.js'
import { logDebug, clo, JSP } from '@helpers/react/reactDev'

type Props = {
    item: TSectionItem,
    respondToClicks: boolean,
    onIconClick?: (item: TSectionItem, actionType: string) => void,
};

const StatusIcon = ({
    item,
    respondToClicks,
    onIconClick,
}: Props): Node => {

    const { sendActionToPlugin } = useAppContext()

    // Initial state setup for iconClassName based on the item type
    const [iconClassName, setIconClassName] = useState(getClassNameFromType(item.itemType))

    function getClassNameFromType(itemType: string): string {
        switch (itemType) {
            case 'open':
                return 'todo fa-regular fa-circle'
            case 'cancelled':
                return 'todo fa-regular fa-circle-xmark'
            case 'checklist':
                return 'todo fa-regular fa-square'
            case 'checklistCancelled':
                return 'todo fa-regular fa-square-xmark'
            case 'congrats':
                return 'fa-regular fa-circle-check'
            default:
                return '' // default case if none of the types match
        }
    }

    /**
     * Handle internal click events, determine the action, and notify the parent component.
     */
    function handleIconClick(event: MouseEvent) {
        if (!respondToClicks) return

        const { metaKey } = extractModifierKeys(event)
        const actionType = determineActionType(metaKey)
        const messageObject: MessageDataObject = {
            // $FlowFixMe[incompatible-type]
            actionType,
            item,
        }

        // Execute the internal logic before notifying the parent
        sendActionToPlugin(actionType, messageObject, `${item.ID} Row icon clicked`, true)

        // Update icon class name on click if necessary
        updateIconClassNameOnAction(actionType)

        // Call the external handler, if provided
        if (onIconClick) {
            onIconClick(item, actionType)
        }
    }

    function updateIconClassNameOnAction(actionType: string) {
        // Example of changing icon based on action, modify as needed
        if (actionType === 'completeTask' || actionType === 'cancelTask') {
            setIconClassName('fa-solid fa-check-circle') // Changing icon to a solid check-circle for example
        }
    }

    /**
     * Determine the action type based on the metaKey and item type.
     * Also updates the icon shape based on what action was taken
     */
    function determineActionType(metaKey: boolean): string {
        switch (item.itemType) {
            case 'open': {
                setIconClassName(getClassNameFromType(metaKey ? "" : "done"))
                return metaKey ? 'cancelTask' : 'completeTask'
            }
            case 'checklist': {
                setIconClassName(getClassNameFromType(metaKey ? "checklistCancelled" : "checklistDone"))
                return metaKey ? 'cancelChecklist' : 'completeChecklist'
            }
            case 'project': {
                return 'showNoteInEditorFromFilename'
            }
            default:
                logDebug(`StatusIcon`, `ERROR - Unknown itemType: ${item.itemType}`)
                return 'unknown'
        }
    }

    return (
        <div className="sectionItemTodo itemIcon todo">
            <i className={iconClassName} onClick={handleIconClick}></i>
        </div>
    )
}

export default StatusIcon
