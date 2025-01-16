// @flow
import React from 'react'
import { createRoot } from 'react-dom/client'
import DynamicDialog, { type TDynamicDialogProps, type TSettingItem } from '../../np.Shared/src/react/DynamicDialog/DynamicDialog'
import { logDebug } from './reactDev'

/**
 * Shows a React modal dialog and returns the user input or null if canceled.
 * The user input object is returned from the onSave callback from an enter or save button click.
 * The object returned holds the form field values (keys specified in formFields), and is passed to the onSave callback.
 * See DynamicDialog.jsx for more details, including TSettingItem types for the formFields in the items array.
 * @param {TDynamicDialogProps} dialogProps - The properties to pass to the DynamicDialog component.
 * @returns {Promise<Object|null>} The user input object or null if canceled.
 */
export function showDialog(dialogProps: TDynamicDialogProps): Promise<TAnyObject | null> {
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
      logDebug('showDialog', 'closeDialog called')
    }

    const handleClose = () => {
      logDebug('showDialog', 'handleClose called')
      closeDialog()
      resolve(null)
    }

    const handleCancel = () => {
      logDebug('showDialog', 'handleCancel called')
      dialogProps.onCancel?.()
      closeDialog()
      resolve(null)
    }

    const handleSave = (userInputObj: Object) => {
      closeDialog()
      resolve(userInputObj)
    }

    const handleButtonClick = (key: string, value: string) => {
      logDebug('showDialog', 'handleButtonClick', key, value)
      dialogProps.handleButtonClick && dialogProps.handleButtonClick(key, value)
      handleClose()
    }

    const root = createRoot(container)
    root.render(
      <DynamicDialog
        title={dialogProps.title}
        items={dialogProps.items}
        className={dialogProps.className}
        labelPosition={dialogProps.labelPosition}
        allowEmptySubmit={dialogProps.allowEmptySubmit}
        submitButtonText={dialogProps.submitButtonText}
        isOpen={dialogProps.isOpen}
        style={dialogProps.style}
        isModal={dialogProps.isModal}
        onSave={handleSave}
        onCancel={handleCancel}
        hideDependentItems={dialogProps.hideDependentItems}
        submitOnEnter={dialogProps.submitOnEnter}
        hideHeaderButtons={dialogProps.hideHeaderButtons}
        handleButtonClick={handleButtonClick}
      >
        {dialogProps.children}
      </DynamicDialog>,
    )
  })
}

/**
 * Shows a confirmation dialog with "No" and "Yes" buttons.
 * @param {Object} options - Options to customize the confirmation dialog.
 * @param {string} options.title - The title of the dialog.
 * @param {string} options.message - The message to display in the dialog.
 * @param {Function} options.onConfirm - Callback when "Yes" is clicked.
 * @param {Function} options.onCancel - Callback when "No" is clicked.
 * @returns {Promise<boolean>} Resolves to true if "Yes" is clicked, false if "No" is clicked.
 */
export function showConfirmationDialog({
  title = 'Confirmation',
  message = 'Are you sure?',
  onConfirm,
  onCancel,
}: {
  title?: string,
  message?: string,
  onConfirm?: () => void,
  onCancel?: () => void,
}): Promise<boolean> {
  logDebug('showConfirmationDialog', 'Opening dialog')
  return new Promise((resolve) => {
    const dialogItems: Array<TSettingItem> = [
      {
        type: 'text',
        key: 'confirmationMessage',
        label: message,
        textType: 'title',
      },
      {
        type: 'button-group',
        key: 'confirmationButtons',
        options: [
          { label: 'No', value: 'no', isDefault: false },
          { label: 'Yes', value: 'yes', isDefault: true },
        ],
      },
    ]

    const handleButtonClick = (key: string, value: string) => {
      logDebug('showConfirmationDialog', 'handleButtonClick', key, value)
      if (value === 'yes') {
        onConfirm?.()
        resolve(true)
      } else {
        onCancel?.()
        resolve(false)
      }
    }

    const handleEnterKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleButtonClick('confirmationButtons', 'yes')
      }
    }

    document.addEventListener('keydown', handleEnterKey)

    showDialog({
      title,
      className: 'confirmation',
      items: dialogItems,
      isOpen: true,
      hideHeaderButtons: true,
      handleButtonClick,
      onCancel: () => {
        logDebug('showConfirmationDialog', 'onCancel called')
        onCancel?.()
        resolve(false)
      },
    }).finally(() => {
      document.removeEventListener('keydown', handleEnterKey)
    })
  })
}

/**
 * WARNING: Not yet tested.
 * Shows a message dialog with just an "OK" button.
 * @param {Object} options - Options to customize the confirmation dialog.
 * @param {string} options.title - The title of the dialog.
 * @param {string} options.message - The message to display in the dialog.
 * @param {Function} options.onOK - Callback when "OK" is clicked.
 */
export function showMessageDialog({
  title = 'Confirmation',
  message = 'Are you sure?',
  onOK
}: {
  title?: string,
  message?: string,
  onOK?: () => void
}): void {
  logDebug('showMessageDialog', 'Opening dialog')
  const dialogItems: Array<TSettingItem> = [
    {
      type: 'text',
      key: 'message',
      label: message,
      textType: 'title',
    },
    {
      type: 'button-group',
      key: 'messageButton',
      options: [
        { label: 'OK', value: 'ok', isDefault: true },
      ],
    },
  ]

  const handleButtonClick = (key: string, value: string) => {
    logDebug('showMessageDialog', 'handleButtonClick', key, value)
    if (value === 'ok') {
      onOK?.()
    }
  }

  const handleEnterKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleButtonClick('messageButton', 'yes')
    }
  }

  document.addEventListener('keydown', handleEnterKey)

  showDialog({
    title,
    className: 'confirmation',
    items: dialogItems,
    isOpen: true,
    hideHeaderButtons: true,
    handleButtonClick,
    onCancel: () => { }
  }).finally(() => {
    document.removeEventListener('keydown', handleEnterKey)
  })
}
