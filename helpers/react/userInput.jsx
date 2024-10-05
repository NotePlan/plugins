// @flow
import React from 'react'
import { createRoot } from 'react-dom/client'
import DynamicDialog, { type TDynamicDialogProps } from '../../np.Shared/src/react/DynamicDialog/DynamicDialog'

/**
 * Shows a React modal dialog and returns the user input or null if canceled.
 * The user input object is returned from the onSave callback from an enter or save button click.
 * The object returned holds the form field values (keys specified in formFields), and is passed to the onSave callback.
 * See DynamicDialog.jsx for more details, including TSettingItem types for the formFields in the items array.
 * @param {TDynamicDialogProps} dialogProps - The properties to pass to the DynamicDialog component.
 * @returns {Promise<Object|null>} The user input object or null if canceled.
 */
export function showDialog(dialogProps: TDynamicDialogProps): Promise<TAnyObject|null> {
    return new Promise((resolve) => {
        const container = document.createElement('div')
        if (document.body) {
            document.body.appendChild(container)
        }

        const closeDialog = () => {
            if (root) {
                root.unmount()
            }
            if (document.body) {
                document.body.removeChild(container)
            }
        }

        const handleClose = () => {
            closeDialog()
            resolve(null)
        }

        const handleSave = (userInputObj: Object) => {
            closeDialog()
            resolve(userInputObj)
        }

        const root = createRoot(container)
        root.render(
            <DynamicDialog
                title={dialogProps.title}
                items={dialogProps.items}
                className={dialogProps.className}
                labelPosition={dialogProps.labelPosition}
                allowEmptySubmit={dialogProps.allowEmptySubmit}
                isOpen={dialogProps.isOpen}
                style={dialogProps.style}
                isModal={dialogProps.isModal}
                onSave={handleSave}
                onCancel={handleClose}
                hideDependentItems={dialogProps.hideDependentItems}
                submitOnEnter={dialogProps.submitOnEnter}
            >
                {dialogProps.children}
            </DynamicDialog>
        )
    })
}